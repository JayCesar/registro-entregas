"use strict";
// Importação de registros por CSV (carga em lote).
//
// Cada linha vira um FormData com os mesmos nomes de campo do formulário e passa
// por validar() (app.ts): as regras são as mesmas do cadastro manual. O arquivo
// é tudo ou nada — com qualquer linha inválida, nada é importado.
//
// Formato: ver exemplos/entregas-exemplo.csv. Resumo:
// - separador ";" ou "," (detectado pelo cabeçalho); UTF-8 ou Windows-1252 (Excel);
// - datas em aaaa-mm-dd ou dd/mm/aaaa;
// - OKRs em trios de colunas numeradas: okr1, okr1Grau, okr1Motivo, okr2...,
//   com okr1Kr opcional (código do KR; em branco = o OKR como um todo);
// - siglas, camadas, servicosAws, microsservicos, tags e pessoas separados por "|" na mesma célula;
// - id opcional: se preenchido, reimportar o arquivo atualiza em vez de duplicar;
// - squads, siglas, serviços AWS e microsserviços que ainda não existem são
//   aceitos e passam a existir. Camadas só da lista fixa (config.ts).
// ---------- Colunas ----------
// Nomes iguais ao atributo name dos campos do formulário (mais id e siglas).
const COLUNAS_CSV_OBRIGATORIAS = [
    "tipo",
    "assunto",
    "descricao",
    "squad",
    "dataInicio",
    "dataFim",
    "release",
    "sprint",
];
const COLUNAS_CSV_OPCIONAIS = [
    "id",
    "siglas",
    "camadas",
    "servicosAws",
    "microsservicos",
    "tags",
    "pessoas",
    "impeditivo",
    "classificacao",
    "bcp",
    // Campo removido: a coluna ainda é aceita (planilhas antigas), mas é ignorada.
    "complexidade",
    "gmudNome",
    "gmudTitulo",
    "gmudLink",
    "gmudEvidencias",
    "git",
    "linkPr",
    "linkActions",
];
// Colunas copiadas para o FormData sem tratamento.
const COLUNAS_CSV_TEXTO = [
    "assunto",
    "descricao",
    "impeditivo",
    "bcp",
    "gmudNome",
    "gmudTitulo",
    "gmudLink",
    "gmudEvidencias",
    "linkPr",
    "linkActions",
];
const COLUNA_OKR = /^okr(\d+)(grau|motivo|kr)?$/;
const MAXIMO_ERROS_EXIBIDOS = 10;
// ---------- Elementos ----------
const campoImportarCsv = el("importar-csv");
// ---------- Leitura do arquivo ----------
// O Excel em pt-BR costuma salvar CSV em Windows-1252; como UTF-8 os acentos
// viriam corrompidos e "História" não bateria com a lista de tipos.
function decodificarCsv(bytes) {
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
    catch {
        return new TextDecoder("windows-1252").decode(bytes);
    }
}
function detectarSeparador(conteudo) {
    const cabecalho = conteudo.split(/\r?\n/, 1)[0] ?? "";
    return cabecalho.split(";").length >= cabecalho.split(",").length ? ";" : ",";
}
// RFC 4180: campos entre aspas podem conter o separador, quebras de linha e
// aspas duplicadas ("").
function analisarCsv(conteudo, separador) {
    const linhas = [];
    let linha = [];
    let campo = "";
    let entreAspas = false;
    for (let i = 0; i < conteudo.length; i++) {
        const caractere = conteudo[i];
        if (entreAspas) {
            if (caractere !== '"') {
                campo += caractere;
            }
            else if (conteudo[i + 1] === '"') {
                campo += '"';
                i++;
            }
            else {
                entreAspas = false;
            }
        }
        else if (caractere === '"') {
            entreAspas = true;
        }
        else if (caractere === separador) {
            linha.push(campo);
            campo = "";
        }
        else if (caractere === "\n") {
            linha.push(campo);
            linhas.push(linha);
            linha = [];
            campo = "";
        }
        else if (caractere !== "\r") {
            campo += caractere;
        }
    }
    if (campo !== "" || linha.length > 0) {
        linha.push(campo);
        linhas.push(linha);
    }
    // Linhas em branco (comuns no fim do arquivo) são ignoradas.
    return linhas.filter((campos) => campos.some((valor) => valor.trim() !== ""));
}
// ---------- Normalização ----------
function semAcento(valor) {
    return valor
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();
}
// "historia" -> "História": aceita diferença de caixa e acento nas listas de config.ts.
function canonico(lista, valor) {
    return lista.find((opcao) => semAcento(opcao) === semAcento(valor)) ?? valor;
}
// Devolve yyyy-mm-dd, ou null se a data não existir ou estiver em outro formato.
function dataIsoDoCsv(valor) {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
    const brasileira = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(valor);
    const [ano, mes, dia] = iso
        ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
        : brasileira
            ? [Number(brasileira[3]), Number(brasileira[2]), Number(brasileira[1])]
            : [0, 0, 0];
    // Date aceita 30/02 e empurra para março: confere se a data voltou igual.
    const data = new Date(Date.UTC(ano, mes - 1, dia));
    if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) {
        return null;
    }
    return data.toISOString().slice(0, 10);
}
// ---------- Conversão ----------
function validarCabecalho(cabecalho) {
    const erros = [];
    const conhecidas = [...COLUNAS_CSV_OBRIGATORIAS, ...COLUNAS_CSV_OPCIONAIS].map((c) => c.toLowerCase());
    for (const coluna of COLUNAS_CSV_OBRIGATORIAS) {
        if (!cabecalho.includes(coluna.toLowerCase()))
            erros.push(`Coluna obrigatória ausente: ${coluna}.`);
    }
    if (!cabecalho.includes("okr1"))
        erros.push("Coluna obrigatória ausente: okr1 (com okr1Grau e okr1Motivo).");
    for (const [indice, coluna] of cabecalho.entries()) {
        if (!conhecidas.includes(coluna) && !COLUNA_OKR.test(coluna)) {
            erros.push(`Coluna desconhecida: "${coluna || `(vazia, posição ${indice + 1})`}".`);
        }
        else if (cabecalho.indexOf(coluna) !== indice) {
            erros.push(`Coluna repetida: "${coluna}".`);
        }
    }
    return erros;
}
// Monta o FormData que o formulário enviaria para a mesma entrega.
function formDataDaLinha(linha, numerosOkr, erros) {
    const dados = new FormData();
    const valor = (coluna) => linha[coluna.toLowerCase()] ?? "";
    for (const coluna of COLUNAS_CSV_TEXTO)
        dados.set(coluna, valor(coluna));
    dados.set("tipo", canonico(TIPOS_ITEM, valor("tipo")));
    dados.set("squad", canonico(squadsDisponiveis(), valor("squad")));
    // Aceita "2" ou "R2", "3" ou "S3".
    dados.set("release", valor("release").replace(/^r/i, ""));
    dados.set("sprint", valor("sprint").replace(/^s/i, ""));
    // Aceita "nao-funcional", "Não funcional"...
    dados.set("classificacao", semAcento(valor("classificacao")).replace(/\s+/g, "-"));
    for (const coluna of ["dataInicio", "dataFim"]) {
        const data = dataIsoDoCsv(valor(coluna));
        if (valor(coluna) && !data)
            erros[coluna] = "Data inválida (use aaaa-mm-dd ou dd/mm/aaaa).";
        dados.set(coluna, data ?? "");
    }
    // Em branco = "nao", como o padrão do formulário.
    const git = semAcento(valor("git"));
    if (git === "" || git === "nao" || git === "n")
        dados.set("git", "nao");
    else if (git === "sim" || git === "s")
        dados.set("git", "sim");
    else
        erros.git = 'Use "sim" ou "nao".';
    for (const sigla of valor("siglas").split("|")) {
        const informada = sigla.trim().toUpperCase();
        if (!informada)
            continue;
        const siglas = siglasDisponiveis();
        const encontrada = canonico(siglas, informada);
        if (pertence(siglas, encontrada))
            dados.append("siglas", encontrada);
        else
            erros.siglas = `Sigla desconhecida: "${informada}" (opções: ${siglas.join(", ")}).`;
    }
    // Lista fixa: valor fora dela é erro. Coluna ausente ou vazia é aceita (planilhas antigas).
    for (const camada of valor("camadas").split("|")) {
        const informada = camada.trim();
        if (!informada)
            continue;
        const encontrada = canonico(CAMADAS, informada);
        if (pertence(CAMADAS, encontrada))
            dados.append("camadas", encontrada);
        else
            erros.camadas = `Camada desconhecida: "${informada}" (opções: ${CAMADAS.join(", ")}).`;
    }
    // Novos já viraram opção em registrosDoCsv: aqui só pega a grafia cadastrada.
    for (const [coluna, disponiveis] of [
        ["servicosAws", servicosAwsDisponiveis],
        ["microsservicos", microsservicosDisponiveis],
        ["tags", tagsDisponiveis],
        ["pessoas", pessoasDisponiveis],
    ]) {
        for (const item of valor(coluna).split("|")) {
            const informado = item.trim();
            if (informado)
                dados.append(coluna, canonico(disponiveis(), informado));
        }
    }
    for (const numero of numerosOkr) {
        const okr = valor(`okr${numero}`);
        const grau = valor(`okr${numero}Grau`);
        const motivo = valor(`okr${numero}Motivo`);
        const kr = valor(`okr${numero}Kr`);
        // Trio todo em branco = a entrega não tem esse OKR.
        if (!okr && !grau && !motivo)
            continue;
        const codigo = canonico(okrsDisponiveis(), okr);
        dados.append("okr", codigo);
        // KR opcional ("KR1", "kr1"...): em branco = o OKR como um todo.
        dados.append("okrKr", kr ? canonico(okrDe(codigo)?.krs.map((k) => k.codigo) ?? [], kr) : "");
        dados.append("okrGrau", canonico(GRAUS_IMPACTO, grau));
        dados.append("okrMotivo", motivo);
    }
    return dados;
}
function registrosDoCsv(conteudo) {
    const [primeira, ...linhas] = analisarCsv(conteudo, detectarSeparador(conteudo));
    if (!primeira)
        return { registros: [], erros: ["O arquivo está vazio."] };
    const cabecalho = primeira.map((coluna) => coluna.trim().toLowerCase());
    const errosCabecalho = validarCabecalho(cabecalho);
    if (errosCabecalho.length > 0)
        return { registros: [], erros: errosCabecalho };
    if (linhas.length === 0)
        return { registros: [], erros: ["O arquivo só tem o cabeçalho."] };
    const numerosOkr = cabecalho
        .map((coluna) => /^okr(\d+)$/.exec(coluna)?.[1])
        .filter((numero) => numero !== undefined)
        .map(Number)
        .sort((a, b) => a - b);
    const importados = [];
    const erros = [];
    const ids = new Set();
    // Squads e siglas novas do arquivo viram opções válidas durante a leitura.
    // Só entram as que não batem (sem acento/caixa) com uma existente: "squad alfa"
    // continua sendo "Squad Alfa". Siglas novas ficam em maiúsculas, como no formulário.
    const posicaoSquad = cabecalho.indexOf("squad");
    const posicaoSiglas = cabecalho.indexOf("siglas");
    for (const campos of linhas) {
        const squad = (campos[posicaoSquad] ?? "").trim();
        if (squad && !encontrarOpcaoSemAcento(squadsDisponiveis(), squad))
            opcoesDoCsvEmLeitura.squads.add(squad);
        for (const sigla of (posicaoSiglas >= 0 ? (campos[posicaoSiglas] ?? "") : "").split("|")) {
            const informada = sigla.trim().toUpperCase();
            if (informada && !encontrarOpcaoSemAcento(siglasDisponiveis(), informada)) {
                opcoesDoCsvEmLeitura.siglas.add(informada);
            }
        }
        for (const [coluna, disponiveis] of [
            ["servicosaws", servicosAwsDisponiveis],
            ["microsservicos", microsservicosDisponiveis],
            ["tags", tagsDisponiveis],
            ["pessoas", pessoasDisponiveis],
        ]) {
            const posicao = cabecalho.indexOf(coluna);
            const novos = {
                servicosaws: opcoesDoCsvEmLeitura.servicosAws,
                microsservicos: opcoesDoCsvEmLeitura.microsservicos,
                tags: opcoesDoCsvEmLeitura.tags,
                pessoas: opcoesDoCsvEmLeitura.pessoas,
            }[coluna];
            for (const item of (posicao >= 0 ? (campos[posicao] ?? "") : "").split("|")) {
                const informado = item.trim();
                if (informado && !encontrarOpcaoSemAcento(disponiveis(), informado))
                    novos.add(informado);
            }
        }
    }
    try {
        lerLinhasDoCsv(linhas, cabecalho, numerosOkr, importados, erros, ids);
    }
    finally {
        opcoesDoCsvEmLeitura.squads.clear();
        opcoesDoCsvEmLeitura.siglas.clear();
        opcoesDoCsvEmLeitura.servicosAws.clear();
        opcoesDoCsvEmLeitura.microsservicos.clear();
        opcoesDoCsvEmLeitura.pessoas.clear();
        opcoesDoCsvEmLeitura.tags.clear();
    }
    return { registros: importados, erros };
}
function encontrarOpcaoSemAcento(lista, valor) {
    return lista.find((opcao) => semAcento(opcao) === semAcento(valor));
}
function lerLinhasDoCsv(linhas, cabecalho, numerosOkr, importados, erros, ids) {
    for (const [indice, campos] of linhas.entries()) {
        // +2: a linha 1 é o cabeçalho. Vale como número da linha na planilha
        // enquanto nenhuma célula tiver quebra de linha.
        const numeroLinha = indice + 2;
        const linha = {};
        for (const [posicao, coluna] of cabecalho.entries())
            linha[coluna] = (campos[posicao] ?? "").trim();
        const errosLinha = {};
        if (campos.length > cabecalho.length)
            errosLinha.colunas = "Há mais células do que colunas no cabeçalho.";
        const resultado = validar(formDataDaLinha(linha, numerosOkr, errosLinha), false); // regras só do formulário ficam de fora
        // Os erros da conversão (data inválida etc.) são mais específicos que os de validar().
        if (!resultado.ok)
            Object.assign(errosLinha, { ...resultado.erros, ...errosLinha });
        const id = linha.id || gerarId();
        if (ids.has(id))
            errosLinha.id = `Id repetido no arquivo: "${id}".`;
        ids.add(id);
        for (const [campo, mensagem] of Object.entries(errosLinha)) {
            erros.push(`Linha ${numeroLinha} (${campo}): ${mensagem}`);
        }
        if (resultado.ok)
            importados.push({ id, ...resultado.dados });
    }
}
// ---------- Importação ----------
async function importarCsv() {
    const arquivo = campoImportarCsv.files?.[0];
    if (!arquivo)
        return;
    const conteudo = decodificarCsv(await arquivo.arrayBuffer());
    // Limpa o campo para permitir escolher o mesmo arquivo de novo.
    campoImportarCsv.value = "";
    const { registros: importados, erros } = registrosDoCsv(conteudo);
    if (erros.length > 0) {
        const exibidos = erros.slice(0, MAXIMO_ERROS_EXIBIDOS);
        const restantes = erros.length - exibidos.length;
        if (restantes > 0)
            exibidos.push(`... e mais ${restantes} erro(s).`);
        alert(`CSV inválido, nada foi importado:\n\n${exibidos.join("\n")}`);
        return;
    }
    aplicarImportacao(importados);
}
// ---------- Inicialização ----------
campoImportarCsv.addEventListener("change", importarCsv);
// ---------- Versão publicada (página única para o S3) ----------
// `npm run publicar` (scripts/publicar.mjs) embute os dados nesta tag: o JSON do
// botão "Exportar JSON" (fluxo semanal) ou um CSV. Nesse modo a página é só
// leitura: os registros vêm do arquivo embutido, não do localStorage de quem
// abre, e a aba de edição some (ver style.css).
const tagPublicada = document.getElementById("dados-publicados");
// Mesmo formato e mesma checagem da importação de JSON da aba de edição.
function registrosDoJsonPublicado(conteudo) {
    try {
        const dados = JSON.parse(conteudo);
        if (!Array.isArray(dados))
            return { registros: [], erros: ["O JSON publicado não é uma lista de entregas."] };
        const validos = dados.filter(registroImportavel);
        const erros = validos.length < dados.length ? [`${dados.length - validos.length} entrega(s) com formato inválido.`] : [];
        return { registros: validos.map(migrarRegistro), erros };
    }
    catch {
        return { registros: [], erros: ["O JSON publicado está corrompido."] };
    }
}
if (tagPublicada) {
    const conteudo = tagPublicada.textContent ?? "";
    const { registros: publicados, erros } = tagPublicada.getAttribute("type") === "application/json"
        ? registrosDoJsonPublicado(conteudo)
        : registrosDoCsv(conteudo);
    // Linhas inválidas ficam de fora. Abrindo o arquivo gerado no próprio PC
    // (file://), antes de subir para o S3, quem publica vê o aviso com os erros.
    if (erros.length > 0) {
        console.warn("Entregas publicadas ignoradas:", erros);
        if (location.protocol === "file:") {
            const exibidos = erros.slice(0, MAXIMO_ERROS_EXIBIDOS).join("\n");
            alert(`Atenção: ${erros.length} problema(s) nos dados; essas entregas ficaram fora da página.\n\n${exibidos}`);
        }
    }
    registros = publicados;
    document.body.dataset.publicado = "sim";
}
