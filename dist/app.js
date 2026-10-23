"use strict";
// ---------- Modelo ----------
const PADRAO_PONTO_PDI = /^(gap|exp)_[a-z0-9]+$/;
// ---------- Persistência ----------
const CHAVE_STORAGE = "registro-entregas:v1";
function migrarRegistro(salvo) {
    // `pdi` (formato antigo, um ponto só) vira a lista `pdis` e não fica no registro.
    const { okr, okrs, pdi, ...resto } = salvo;
    return {
        ...resto,
        okrs: Array.isArray(okrs) ? okrs : okr ? [{ okr, motivo: "", grau: null }] : [],
        release: salvo.release ?? null,
        sprint: salvo.sprint ?? null,
        impeditivo: salvo.impeditivo ?? "",
        historia: salvo.historia ?? null,
        gmud: salvo.gmud ?? null,
        git: salvo.git ?? null,
        pdis: Array.isArray(salvo.pdis) ? salvo.pdis : pdi ? [pdi] : [],
        camadas: salvo.camadas ?? [],
        servicosAws: salvo.servicosAws ?? [],
        microsservicos: salvo.microsservicos ?? [],
        tags: salvo.tags ?? [],
        itemPortal: salvo.itemPortal ?? null,
        pessoas: salvo.pessoas ?? [],
    };
}
function carregarRegistros() {
    try {
        const bruto = localStorage.getItem(CHAVE_STORAGE);
        const dados = bruto ? JSON.parse(bruto) : [];
        return Array.isArray(dados) ? dados.map(migrarRegistro) : [];
    }
    catch {
        return [];
    }
}
function salvarRegistros(lista) {
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(lista));
}
// ---------- Squads, siglas, serviços AWS e microsserviços cadastrados ----------
// Opções criadas pelo usuário no formulário, além das listas de config.ts.
const CHAVE_SQUADS = "registro-entregas:squads";
const CHAVE_SIGLAS = "registro-entregas:siglas";
const CHAVE_SERVICOS_AWS = "registro-entregas:servicos-aws";
const CHAVE_MICROSSERVICOS = "registro-entregas:microsservicos";
const CHAVE_PESSOAS = "registro-entregas:pessoas";
const CHAVE_TAGS = "registro-entregas:tags";
function carregarLista(chave) {
    try {
        const dados = JSON.parse(localStorage.getItem(chave) ?? "[]");
        return Array.isArray(dados) ? dados.filter((v) => typeof v === "string") : [];
    }
    catch {
        return [];
    }
}
const squadsCadastradas = carregarLista(CHAVE_SQUADS);
const siglasCadastradas = carregarLista(CHAVE_SIGLAS);
const servicosAwsCadastrados = carregarLista(CHAVE_SERVICOS_AWS);
const microsservicosCadastrados = carregarLista(CHAVE_MICROSSERVICOS);
const pessoasCadastradas = carregarLista(CHAVE_PESSOAS);
const tagsCadastradas = carregarLista(CHAVE_TAGS);
// Opções novas que aparecem num CSV valem enquanto ele é lido (ver
// registrosDoCsv em csv.ts). Depois da importação passam a vir dos registros.
const opcoesDoCsvEmLeitura = {
    squads: new Set(),
    siglas: new Set(),
    servicosAws: new Set(),
    microsservicos: new Set(),
    pessoas: new Set(),
    tags: new Set(),
};
// config.ts + cadastradas + as que já aparecem em registros (ex.: vindas de um
// JSON importado), para nenhum registro ficar com valor fora da lista.
function squadsDisponiveis() {
    return [
        ...new Set([...SQUADS, ...squadsCadastradas, ...registros.map((r) => r.squad), ...opcoesDoCsvEmLeitura.squads]),
    ];
}
function siglasDisponiveis() {
    return [
        ...new Set([
            ...SIGLAS,
            ...siglasCadastradas,
            ...registros.flatMap((r) => r.siglas),
            ...opcoesDoCsvEmLeitura.siglas,
        ]),
    ];
}
function servicosAwsDisponiveis() {
    return [
        ...new Set([
            ...SERVICOS_AWS,
            ...servicosAwsCadastrados,
            ...registros.flatMap((r) => r.servicosAws),
            ...opcoesDoCsvEmLeitura.servicosAws,
        ]),
    ];
}
function microsservicosDisponiveis() {
    return [
        ...new Set([
            ...MICROSSERVICOS,
            ...microsservicosCadastrados,
            ...registros.flatMap((r) => r.microsservicos),
            ...opcoesDoCsvEmLeitura.microsservicos,
        ]),
    ];
}
function tagsDisponiveis() {
    return [
        ...new Set([...TAGS, ...tagsCadastradas, ...registros.flatMap((r) => r.tags), ...opcoesDoCsvEmLeitura.tags]),
    ];
}
function pessoasDisponiveis() {
    return [
        ...new Set([...pessoasCadastradas, ...registros.flatMap((r) => r.pessoas), ...opcoesDoCsvEmLeitura.pessoas]),
    ];
}
// Compara sem diferenciar maiúsculas: "squad alfa" encontra "Squad Alfa".
function encontrarOpcao(lista, valor) {
    return lista.find((opcao) => opcao.toLowerCase() === valor.toLowerCase());
}
// ---------- Utilitários ----------
function el(id) {
    const elemento = document.getElementById(id);
    if (!elemento)
        throw new Error(`Elemento #${id} não encontrado no index.html`);
    return elemento;
}
function pertence(lista, valor) {
    return lista.includes(valor);
}
function texto(dados, nome) {
    const valor = dados.get(nome);
    return typeof valor === "string" ? valor.trim() : "";
}
function urlValida(valor) {
    try {
        const url = new URL(valor);
        return url.protocol === "https:" || url.protocol === "http:";
    }
    catch {
        return false;
    }
}
// "GMUD-12345 · Ajuste no portal" (ou só o número, se não houver nome).
function rotuloGmud(gmud) {
    return gmud.titulo ? `${gmud.nome} · ${gmud.titulo}` : gmud.nome;
}
function formatarData(iso) {
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
}
function leadTimeEmDias(registro) {
    const umDiaMs = 24 * 60 * 60 * 1000;
    return Math.round((Date.parse(registro.dataFim) - Date.parse(registro.dataInicio)) / umDiaMs);
}
// O ano da release vem da data de fim. Ex.: "2026 · R2".
function rotuloRelease(registro) {
    if (!registro.release)
        return "Sem release";
    return `${registro.dataFim.slice(0, 4)} · R${registro.release}`;
}
// Ex.: "2026 · R2 · S3".
function rotuloReleaseSprint(registro) {
    if (!registro.release || !registro.sprint)
        return "Sem release/sprint";
    return `${rotuloRelease(registro)} · S${registro.sprint}`;
}
// Release do trimestre da data (aaaa-mm-dd): outubro -> "4".
function releaseDaData(iso) {
    const mes = Number(iso.slice(5, 7));
    return RELEASES[Math.floor((mes - 1) / MESES_POR_RELEASE)] ?? RELEASES[0];
}
// Mesmas regras de data para o formulário, o CSV e o JSON. Devolve a mensagem
// do problema ou null. `release` vazia/nula não é checada aqui.
function erroDeDataERelease(dataFim, release) {
    if (Number(dataFim.slice(0, 4)) < ANO_INICIAL) {
        return `Só entram entregas a partir de ${ANO_INICIAL} (data de fim ${formatarData(dataFim)}).`;
    }
    const esperada = releaseDaData(dataFim);
    if (release && release !== esperada) {
        // mesesDaRelease está em dashboard.ts (mesmo escopo global; só roda depois de tudo carregado).
        return (`Release R${release} não bate com a data de fim ${formatarData(dataFim)}, ` +
            `que cai na R${esperada} (${mesesDaRelease(esperada)}).`);
    }
    return null;
}
function gerarId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
// ---------- Validação ----------
// `regrasDoFormulario` = false no CSV: planilhas de antes das colunas "camadas" e
// "gmudEvidencias" continuam válidas (no formulário os dois são obrigatórios).
function validar(dados, regrasDoFormulario = true) {
    const erros = {};
    const tipo = texto(dados, "tipo");
    const squad = texto(dados, "squad");
    const assunto = texto(dados, "assunto");
    const descricao = texto(dados, "descricao");
    const dataInicio = texto(dados, "dataInicio");
    const dataFim = texto(dados, "dataFim");
    const release = texto(dados, "release");
    const sprint = texto(dados, "sprint");
    const impeditivo = texto(dados, "impeditivo");
    if (!pertence(TIPOS_ITEM, tipo))
        erros.tipo = "Selecione o tipo de item.";
    // Listas alinhadas (mesmo tamanho e ordem), montadas por anexarOkrsDoFormulario
    // (okrs.ts) ou pelo CSV. okrKr pode faltar (CSV antigo): vale o OKR como um todo.
    const okrsInformados = dados.getAll("okr");
    const krsInformados = dados.getAll("okrKr");
    const motivos = dados.getAll("okrMotivo");
    const graus = dados.getAll("okrGrau");
    const okrs = [];
    for (const [indice, valorOkr] of okrsInformados.entries()) {
        const okr = typeof valorOkr === "string" ? valorOkr : "";
        const valorMotivo = motivos[indice];
        const valorGrau = graus[indice];
        const motivo = typeof valorMotivo === "string" ? valorMotivo.trim() : "";
        const grau = typeof valorGrau === "string" ? valorGrau : "";
        const valorKr = krsInformados[indice];
        const kr = typeof valorKr === "string" ? valorKr.trim() : "";
        const linha = `OKR ${okr || indice + 1}`;
        const krsDoOkr = okrDe(okr)?.krs.map((k) => k.codigo) ?? [];
        if (!pertence(okrsDisponiveis(), okr)) {
            erros.okrs ??= `${linha}: OKR desconhecido (cadastre-o no cartão "OKRs e KRs").`;
        }
        else if (kr && !krsDoOkr.includes(kr)) {
            erros.okrs ??= `${linha}: o KR "${kr}" não existe nesse OKR.`;
        }
        else if (okrs.some((o) => o.okr === okr)) {
            erros.okrs ??= `${linha}: o OKR ${okr} já foi adicionado nesta entrega.`;
        }
        else if (!pertence(GRAUS_IMPACTO, grau)) {
            erros.okrs ??= `${linha}: selecione o grau de impacto.`;
        }
        else if (!motivo) {
            erros.okrs ??= `${linha}: explique o motivo do impacto.`;
        }
        else {
            okrs.push({ okr, kr: kr || null, motivo, grau });
        }
    }
    if (okrsInformados.length === 0)
        erros.okrs = "Escolha ao menos um OKR impactado (abra o OKR e marque o KR).";
    if (!pertence(squadsDisponiveis(), squad))
        erros.squad = "Selecione a squad.";
    if (!pertence(RELEASES, release))
        erros.release = "Selecione a release.";
    if (!pertence(SPRINTS, sprint))
        erros.sprint = "Selecione a sprint.";
    if (!assunto)
        erros.assunto = "Informe o assunto.";
    // Link do item no portal: obrigatório no formulário; no CSV, opcional (planilhas antigas).
    const itemNome = texto(dados, "itemNome");
    const itemLink = texto(dados, "itemLink");
    if (itemLink && !urlValida(itemLink))
        erros.itemLink = "Link inválido (use http:// ou https://).";
    else if (!itemLink && regrasDoFormulario)
        erros.itemLink = "Informe o link do item no portal.";
    else if (!itemLink && itemNome)
        erros.itemLink = "Informe o link do item (o nome sozinho não basta).";
    const itemPortal = itemLink ? { nome: itemNome, link: itemLink } : null;
    if (!descricao)
        erros.descricao = "Descreva brevemente o que foi feito.";
    if (!dataInicio)
        erros.dataInicio = "Informe a data de início.";
    if (!dataFim) {
        erros.dataFim = "Informe a data de fim.";
    }
    else if (dataInicio && dataFim < dataInicio) {
        // Datas ISO (yyyy-mm-dd) ordenam corretamente como string.
        erros.dataFim = "A data de fim não pode ser anterior à data de início.";
    }
    else {
        const erro = erroDeDataERelease(dataFim, pertence(RELEASES, release) ? release : null);
        // Ano fora do foco é problema da data; release de outro trimestre, da release.
        if (erro?.startsWith("Só entram"))
            erros.dataFim = erro;
        else if (erro)
            erros.release = erro;
    }
    let historia = null;
    if (tipo === "História") {
        const classificacao = texto(dados, "classificacao");
        if (classificacao === "funcional") {
            // Aceita vírgula decimal ("7,5").
            const bcp = texto(dados, "bcp").replace(",", ".");
            if (!bcp)
                erros.bcp = "BCP-Score é obrigatório para história funcional.";
            else if (!Number.isFinite(Number(bcp)))
                erros.bcp = "O BCP-Score deve ser um número.";
            historia = { funcional: true, bcp };
        }
        else if (classificacao === "nao-funcional") {
            historia = { funcional: false };
        }
        else {
            erros.classificacao = "Informe se a história é funcional ou não funcional.";
        }
    }
    let gmud = null;
    if (tipo === "História" || tipo === "Bug") {
        const nome = texto(dados, "gmudNome");
        const link = texto(dados, "gmudLink");
        if (link && !nome)
            erros.gmudNome = "Informe o nome/número da GMUD para usar o link.";
        if (link && !urlValida(link))
            erros.gmudLink = "Link inválido (use http:// ou https://).";
        const titulo = texto(dados, "gmudTitulo");
        if (titulo && !nome)
            erros.gmudNome = "Informe o número da GMUD para usar o nome.";
        // Teve GMUD, tem que ter evidências.
        const evidencias = texto(dados, "gmudEvidencias");
        if (evidencias && !nome)
            erros.gmudNome = "Informe o número da GMUD para usar as evidências.";
        if (evidencias && !urlValida(evidencias))
            erros.gmudEvidencias = "Link inválido (use http:// ou https://).";
        else if (nome && !evidencias && regrasDoFormulario)
            erros.gmudEvidencias = "Com GMUD, informe o link das evidências.";
        if (nome)
            gmud = { nome, titulo: titulo || null, link: link || null, evidencias: evidencias || null };
    }
    let git = null;
    const houveAlteracaoGit = texto(dados, "git");
    if (houveAlteracaoGit === "sim") {
        const linkPullRequest = texto(dados, "linkPr");
        const linkActions = texto(dados, "linkActions");
        if (linkPullRequest && !urlValida(linkPullRequest)) {
            erros.linkPr = "Link inválido (use http:// ou https://).";
        }
        if (linkActions && !urlValida(linkActions)) {
            erros.linkActions = "Link inválido (use http:// ou https://).";
        }
        git = {
            linkPullRequest: linkPullRequest || null,
            // O link de deploy em produção só faz sentido quando há GMUD.
            linkActions: gmud ? linkActions || null : null,
        };
    }
    else if (houveAlteracaoGit !== "nao") {
        erros.git = "Informe se houve alteração em repositório Git.";
    }
    // Opcional. O CSV não tem essas colunas: lá o vínculo fica null (ver aplicarImportacao).
    // "versão|ponto": o mesmo ponto pode existir em mais de uma versão do PDI (ver pdi.ts).
    // Cada ponto marcado vem como "versão|ponto" (o mesmo ponto pode existir em mais de
    // uma versão do PDI) e tem a sua intensidade em pdiIntensidade-<versão|ponto> (ver pdi.ts).
    const pdis = [];
    for (const valor of dados.getAll("pdiPonto")) {
        if (typeof valor !== "string" || !valor)
            continue;
        const [pdiVersao = "", pdiPonto = ""] = valor.split("|");
        const pdiIntensidade = texto(dados, `pdiIntensidade-${valor}`);
        if (!PADRAO_PONTO_PDI.test(pdiPonto))
            erros.pdiPonto ??= "Ponto do PDI inválido.";
        else if (!pertence(INTENSIDADES_PDI, pdiIntensidade))
            erros.pdiPonto ??= "Escolha a intensidade de cada ponto do PDI marcado.";
        else
            pdis.push({ versao: pdiVersao || null, ponto: pdiPonto, intensidade: pdiIntensidade });
    }
    const siglas = dados
        .getAll("siglas")
        .filter((s) => typeof s === "string" && pertence(siglasDisponiveis(), s));
    const camadas = dados.getAll("camadas").filter((c) => typeof c === "string" && pertence(CAMADAS, c));
    if (regrasDoFormulario && camadas.length === 0)
        erros.camadas = "Marque ao menos uma camada (backend, frontend, database ou infra).";
    const servicosAws = dados
        .getAll("servicosAws")
        .filter((s) => typeof s === "string" && pertence(servicosAwsDisponiveis(), s));
    const microsservicos = dados
        .getAll("microsservicos")
        .filter((m) => typeof m === "string" && pertence(microsservicosDisponiveis(), m));
    const tags = dados
        .getAll("tags")
        .filter((t) => typeof t === "string" && pertence(tagsDisponiveis(), t));
    const pessoas = dados
        .getAll("pessoas")
        .filter((p) => typeof p === "string" && pertence(pessoasDisponiveis(), p));
    // Os pertence() se repetem aqui só para o compilador estreitar string -> tipo da lista.
    if (Object.keys(erros).length > 0 ||
        !pertence(TIPOS_ITEM, tipo) ||
        !pertence(squadsDisponiveis(), squad) ||
        !pertence(RELEASES, release) ||
        !pertence(SPRINTS, sprint)) {
        return { ok: false, erros };
    }
    return {
        ok: true,
        dados: {
            tipo,
            assunto,
            descricao,
            okrs,
            squad,
            siglas,
            camadas,
            servicosAws,
            microsservicos,
            tags,
            pessoas,
            itemPortal,
            dataInicio,
            dataFim,
            release,
            sprint,
            impeditivo,
            historia,
            gmud,
            git,
            pdis,
        },
    };
}
// ---------- Elementos ----------
const formulario = el("form-registro");
const tituloFormulario = el("titulo-form");
const botaoSalvar = el("btn-salvar");
const botaoCancelar = el("btn-cancelar");
const corpoTabela = el("corpo-tabela");
const contador = el("contador");
const campoTipo = el("tipo");
const listaSquads = el("lista-squads");
const campoRelease = el("release");
const campoSprint = el("sprint");
const filtroRelease = el("filtro-release");
const filtroSprint = el("filtro-sprint");
const filtroImpeditivo = el("filtro-impeditivo");
const buscaTabela = el("busca-tabela");
const botaoExportar = el("btn-exportar");
const campoImportar = el("importar");
const campoGmudNome = el("gmudNome");
const listaSiglas = el("lista-siglas");
const listaCamadas = el("lista-camadas");
const listaServicosAws = el("lista-servicos-aws");
const listaMicrosservicos = el("lista-microsservicos");
const listaPessoas = el("lista-pessoas");
const listaTags = el("lista-tags");
const secaoClassificacao = el("sec-classificacao");
const secaoFuncional = el("sec-funcional");
const secaoGmud = el("sec-gmud");
const secaoGit = el("sec-git");
const secaoActions = el("sec-actions");
// ---------- Estado ----------
let registros = carregarRegistros();
let idEmEdicao = null;
// ---------- Formulário ----------
function preencherSelect(select, opcoes) {
    select.append(new Option("Selecione...", ""));
    for (const opcao of opcoes)
        select.append(new Option(opcao, opcao));
}
// Pílula clicável: o input (radio ou checkbox) fica escondido dentro do
// <label> e o CSS pinta o <span> quando ele está marcado (ver .escolha em style.css).
function criarEscolha(tipo, nome, valor, rotulo, marcada = false) {
    const escolha = document.createElement("label");
    escolha.className = "escolha";
    const entrada = document.createElement("input");
    entrada.type = tipo;
    entrada.name = nome;
    entrada.value = valor;
    entrada.checked = marcada;
    // defaultChecked: o reset() do formulário volta para esta marcação.
    entrada.defaultChecked = marcada;
    const texto = document.createElement("span");
    texto.append(rotulo);
    escolha.append(entrada, texto);
    return escolha;
}
const LISTA_SIGLAS = {
    lista: listaSiglas,
    nome: "siglas",
    chave: CHAVE_SIGLAS,
    cadastradas: siglasCadastradas,
    disponiveis: siglasDisponiveis,
};
const LISTA_SERVICOS_AWS = {
    lista: listaServicosAws,
    nome: "servicosAws",
    chave: CHAVE_SERVICOS_AWS,
    cadastradas: servicosAwsCadastrados,
    disponiveis: servicosAwsDisponiveis,
};
const LISTA_MICROSSERVICOS = {
    lista: listaMicrosservicos,
    nome: "microsservicos",
    chave: CHAVE_MICROSSERVICOS,
    cadastradas: microsservicosCadastrados,
    disponiveis: microsservicosDisponiveis,
};
const LISTA_TAGS = {
    lista: listaTags,
    nome: "tags",
    chave: CHAVE_TAGS,
    cadastradas: tagsCadastradas,
    disponiveis: tagsDisponiveis,
};
const LISTA_PESSOAS = {
    lista: listaPessoas,
    nome: "pessoas",
    chave: CHAVE_PESSOAS,
    cadastradas: pessoasCadastradas,
    disponiveis: pessoasDisponiveis,
};
function refazerLista({ lista, nome, disponiveis }) {
    const marcadas = new Set([...lista.querySelectorAll("input:checked")].map((caixa) => caixa.value));
    lista.replaceChildren(...disponiveis().map((opcao) => criarEscolha("checkbox", nome, opcao, opcao, marcadas.has(opcao))));
    if (disponiveis().length === 0) {
        lista.append(Object.assign(document.createElement("span"), { className: "dica", textContent: "Nenhum cadastrado ainda." }));
    }
}
// Opção já existente (mesmo com outra caixa) só é marcada, sem duplicar. A nova já entra marcada.
function cadastrarNaLista(alvo, valor) {
    const existente = encontrarOpcao(alvo.disponiveis(), valor);
    if (!existente) {
        alvo.cadastradas.push(valor);
        localStorage.setItem(alvo.chave, JSON.stringify(alvo.cadastradas));
        alvo.lista.querySelector("span.dica")?.remove();
        alvo.lista.append(criarEscolha("checkbox", alvo.nome, valor, valor, true));
        return;
    }
    const caixa = alvo.lista.querySelector(`input[value="${CSS.escape(existente)}"]`);
    if (caixa)
        caixa.checked = true;
}
function marcarCaixas(lista, valores) {
    for (const caixa of lista.querySelectorAll("input"))
        caixa.checked = valores.includes(caixa.value);
}
function adicionarSquad(squad, marcada = false) {
    listaSquads.append(criarEscolha("radio", "squad", squad, squad, marcada));
}
// Squads e siglas podem ter mudado (cadastro ou importação): refaz as opções
// mantendo o que estava escolhido.
function preencherSquadsESiglas() {
    const squadAtual = radioMarcado("squad");
    listaSquads.replaceChildren();
    for (const squad of squadsDisponiveis())
        adicionarSquad(squad);
    if (squadsDisponiveis().length === 0) {
        listaSquads.append(Object.assign(document.createElement("span"), { className: "dica", textContent: "Nenhuma squad ainda: use “+ Nova squad”." }));
    }
    marcarRadio("squad", squadAtual);
    for (const alvo of [LISTA_SIGLAS, LISTA_SERVICOS_AWS, LISTA_MICROSSERVICOS, LISTA_TAGS, LISTA_PESSOAS])
        refazerLista(alvo);
}
// Squad já existente (mesmo com outra caixa) só é selecionada, sem duplicar.
function cadastrarSquad(nome) {
    if (!nome)
        return "Informe o nome da squad.";
    const existente = encontrarOpcao(squadsDisponiveis(), nome);
    if (!existente) {
        squadsCadastradas.push(nome);
        localStorage.setItem(CHAVE_SQUADS, JSON.stringify(squadsCadastradas));
        listaSquads.querySelector("span.dica")?.remove();
        adicionarSquad(nome);
    }
    marcarRadio("squad", existente ?? nome);
    return null;
}
// Siglas são códigos: ficam sempre em maiúsculas. A nova já entra marcada.
function cadastrarSigla(valor) {
    const sigla = valor.toUpperCase();
    if (!sigla)
        return "Informe a sigla.";
    if (/\s/.test(sigla))
        return "A sigla não pode ter espaços.";
    cadastrarNaLista(LISTA_SIGLAS, sigla);
    return null;
}
function cadastrarServicoAws(valor) {
    if (!valor)
        return "Informe o serviço AWS.";
    cadastrarNaLista(LISTA_SERVICOS_AWS, valor);
    return null;
}
function cadastrarTag(valor) {
    if (!valor)
        return "Informe a tag.";
    cadastrarNaLista(LISTA_TAGS, valor);
    return null;
}
function cadastrarPessoa(valor) {
    if (!valor)
        return "Informe o nome da pessoa.";
    cadastrarNaLista(LISTA_PESSOAS, valor);
    return null;
}
// Nome como está no repositório/cluster (ex.: ms-reservas): mantém a caixa digitada.
function cadastrarMicrosservico(valor) {
    if (!valor)
        return "Informe o nome do microsserviço.";
    if (/\s/.test(valor))
        return "Use o nome sem espaços (ex.: ms-reservas).";
    cadastrarNaLista(LISTA_MICROSSERVICOS, valor);
    return null;
}
// "+ Nova squad" que se abre em campo + Adicionar/Cancelar. O campo não tem
// name, então não entra no FormData do registro. `aoAdicionar` devolve a
// mensagem de erro, ou null quando deu certo.
function criarCadastroRapido(container, rotulo, aoAdicionar) {
    const linha = document.createElement("div");
    linha.className = "cadastro-rapido";
    linha.hidden = true;
    const campo = document.createElement("input");
    campo.type = "text";
    campo.placeholder = rotulo;
    campo.ariaLabel = rotulo;
    const erro = document.createElement("small");
    erro.className = "erro";
    const abrir = criarBotao(`+ ${rotulo}`, "botao-texto", () => {
        abrir.hidden = true;
        linha.hidden = false;
        campo.focus();
    });
    const fechar = () => {
        campo.value = "";
        erro.textContent = "";
        linha.hidden = true;
        abrir.hidden = false;
    };
    const confirmar = () => {
        const mensagem = aoAdicionar(campo.value.trim());
        if (mensagem) {
            erro.textContent = mensagem;
            campo.focus();
            return;
        }
        fechar();
        abrir.focus();
    };
    // Enter aqui não pode enviar o formulário do registro.
    campo.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter") {
            evento.preventDefault();
            confirmar();
        }
        else if (evento.key === "Escape") {
            fechar();
        }
    });
    linha.append(campo, criarBotao("Adicionar", "", confirmar), criarBotao("Cancelar", "secundario", fechar));
    container.append(abrir, linha, erro);
}
function radioMarcado(nome) {
    const radio = formulario.querySelector(`input[name="${nome}"]:checked`);
    return radio?.value ?? "";
}
function marcarRadio(nome, valor) {
    for (const radio of formulario.querySelectorAll(`input[name="${nome}"]`)) {
        radio.checked = radio.value === valor;
    }
}
// Campo escondido também fica desabilitado: assim ele não entra no FormData
// nem recebe foco pelo teclado.
function mostrar(secao, visivel) {
    secao.hidden = !visivel;
    for (const campo of secao.querySelectorAll("input")) {
        campo.disabled = !visivel;
    }
}
function atualizarCamposCondicionais() {
    const tipo = campoTipo.value;
    const ehHistoria = tipo === "História";
    const aceitaGmud = ehHistoria || tipo === "Bug";
    const houveAlteracaoGit = radioMarcado("git") === "sim";
    const temGmud = aceitaGmud && campoGmudNome.value.trim() !== "";
    mostrar(secaoClassificacao, ehHistoria);
    mostrar(secaoFuncional, ehHistoria && radioMarcado("classificacao") === "funcional");
    mostrar(secaoGmud, aceitaGmud);
    // A ordem importa: sec-actions fica dentro de sec-git.
    mostrar(secaoGit, houveAlteracaoGit);
    mostrar(secaoActions, houveAlteracaoGit && temGmud);
}
function exibirErros(erros) {
    for (const alvo of formulario.querySelectorAll("[data-erro]")) {
        alvo.textContent = erros[alvo.dataset.erro ?? ""] ?? "";
    }
}
function limparFormulario() {
    formulario.reset();
    preencherVinculoPdi([]); // pdi.ts: versão mais recente aberta, nenhum ponto marcado
    preencherOkrsEntrega([]); // okrs.ts: todos os OKRs fechados, sem escolha
    idEmEdicao = null;
    tituloFormulario.textContent = "Novo registro";
    botaoSalvar.textContent = "Adicionar registro";
    botaoCancelar.textContent = "Limpar";
    exibirErros({});
    atualizarCamposCondicionais();
}
function definirValor(nome, valor) {
    const campo = formulario.elements.namedItem(nome);
    if (campo instanceof HTMLInputElement ||
        campo instanceof HTMLSelectElement ||
        campo instanceof HTMLTextAreaElement) {
        campo.value = valor;
    }
}
function iniciarEdicao(registro) {
    limparFormulario();
    idEmEdicao = registro.id;
    definirValor("tipo", registro.tipo);
    preencherOkrsEntrega(registro.okrs); // okrs.ts
    marcarRadio("squad", registro.squad);
    definirValor("assunto", registro.assunto);
    definirValor("descricao", registro.descricao);
    definirValor("itemNome", registro.itemPortal?.nome ?? "");
    definirValor("itemLink", registro.itemPortal?.link ?? "");
    definirValor("dataInicio", registro.dataInicio);
    definirValor("dataFim", registro.dataFim);
    definirValor("release", registro.release ?? "");
    definirValor("sprint", registro.sprint ?? "");
    definirValor("impeditivo", registro.impeditivo);
    if (registro.historia) {
        marcarRadio("classificacao", registro.historia.funcional ? "funcional" : "nao-funcional");
        if (registro.historia.funcional)
            definirValor("bcp", registro.historia.bcp);
    }
    definirValor("gmudNome", registro.gmud?.nome ?? "");
    definirValor("gmudLink", registro.gmud?.link ?? "");
    definirValor("gmudTitulo", registro.gmud?.titulo ?? "");
    definirValor("gmudEvidencias", registro.gmud?.evidencias ?? "");
    marcarRadio("git", registro.git ? "sim" : "nao");
    definirValor("linkPr", registro.git?.linkPullRequest ?? "");
    definirValor("linkActions", registro.git?.linkActions ?? "");
    marcarCaixas(listaSiglas, registro.siglas);
    marcarCaixas(listaCamadas, registro.camadas);
    marcarCaixas(listaServicosAws, registro.servicosAws);
    marcarCaixas(listaMicrosservicos, registro.microsservicos);
    marcarCaixas(listaTags, registro.tags);
    marcarCaixas(listaPessoas, registro.pessoas);
    // pdi.ts: versão, ponto e intensidade do registro, mesmo que o ponto já tenha saído do PDI.
    preencherVinculoPdi(registro.pdis);
    tituloFormulario.textContent = "Editando registro";
    botaoSalvar.textContent = "Salvar alterações";
    botaoCancelar.textContent = "Cancelar edição";
    atualizarCamposCondicionais();
    formulario.scrollIntoView({ behavior: "smooth" });
}
function aoEnviar(evento) {
    evento.preventDefault();
    const dados = new FormData(formulario);
    anexarOkrsDoFormulario(dados); // okrs.ts: um item por OKR escolhido
    const resultado = validar(dados);
    if (!resultado.ok) {
        exibirErros(resultado.erros);
        formulario.querySelector("[data-erro]:not(:empty)")?.scrollIntoView({ block: "center" });
        return;
    }
    const editando = idEmEdicao !== null;
    const salvo = { id: idEmEdicao ?? gerarId(), ...resultado.dados };
    registros = editando ? registros.map((r) => (r.id === salvo.id ? salvo : r)) : [...registros, salvo];
    salvarRegistros(registros);
    limparFormulario();
    renderizarTabela();
    mostrarConfirmacao(salvo, editando);
}
// ---------- Confirmação depois de salvar ----------
const modalConfirmacao = el("modal-confirmacao");
function linhaConfirmacao(rotulo, valor) {
    const linha = document.createElement("div");
    const termo = document.createElement("dt");
    termo.textContent = rotulo;
    const definicao = document.createElement("dd");
    definicao.textContent = valor;
    linha.append(termo, definicao);
    return linha;
}
// Modal com o resumo do que foi salvo: OK fecha; "Ver nos registros" leva à tabela.
function mostrarConfirmacao(registro, editado) {
    const conteudo = document.createElement("div");
    conteudo.className = "confirmacao";
    conteudo.style.setProperty("--cor-tipo", CORES_TIPO[registro.tipo]);
    const selo = document.createElement("span");
    selo.className = "confirmacao-selo";
    selo.textContent = "✓";
    const titulo = document.createElement("h2");
    titulo.id = "confirmacao-titulo";
    titulo.textContent = editado ? "Alterações salvas" : "Item adicionado";
    const assunto = document.createElement("p");
    assunto.className = "confirmacao-assunto";
    assunto.textContent = registro.assunto;
    const resumo = document.createElement("dl");
    resumo.className = "confirmacao-resumo";
    resumo.append(linhaConfirmacao("Tipo", registro.tipo), linhaConfirmacao("Release / sprint", rotuloReleaseSprint(registro)), linhaConfirmacao("Squad", registro.squad), linhaConfirmacao("OKRs", registro.okrs.map((o) => (o.kr ? `${o.okr} · ${o.kr}` : o.okr)).join(", ")), linhaConfirmacao("Pontos do PDI", registro.pdis.length > 0 ? String(registro.pdis.length) : "nenhum"));
    const acoes = document.createElement("div");
    acoes.className = "acoes-form";
    const ok = criarBotao("OK", "", () => modalConfirmacao.close());
    acoes.append(ok, criarBotao("Ver nos registros", "secundario", () => {
        modalConfirmacao.close();
        corpoTabela.closest("section")?.scrollIntoView({ behavior: "smooth" });
    }));
    conteudo.append(selo, titulo, assunto, resumo, acoes);
    modalConfirmacao.replaceChildren(conteudo);
    modalConfirmacao.showModal();
    ok.focus();
}
function remover(registro) {
    if (!confirm(`Remover o registro "${registro.assunto}"?`))
        return;
    registros = registros.filter((r) => r.id !== registro.id);
    salvarRegistros(registros);
    if (idEmEdicao === registro.id)
        limparFormulario();
    renderizarTabela();
}
// ---------- Tabela ----------
const VAZIO = "—";
function criarLink(url, rotulo) {
    // Registros importados de arquivo não passaram pela validação do formulário.
    if (!urlValida(url)) {
        const semLink = document.createElement("span");
        semLink.textContent = rotulo;
        return semLink;
    }
    const link = document.createElement("a");
    link.href = url;
    link.textContent = rotulo;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
}
function criarBotao(rotulo, classe, aoClicar) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = rotulo;
    botao.className = classe;
    botao.addEventListener("click", aoClicar);
    return botao;
}
function criarLinha(registro) {
    const { historia, gmud, git } = registro;
    let classificacao = VAZIO;
    let bcp = VAZIO;
    if (historia) {
        classificacao = historia.funcional ? "Funcional" : "Não funcional";
        if (historia.funcional)
            bcp = historia.bcp;
    }
    const okrs = document.createElement("div");
    okrs.className = "okrs-celula";
    for (const impacto of registro.okrs) {
        const item = document.createElement("div");
        const detalhe = [impacto.grau ?? "grau não informado", impacto.motivo].filter(Boolean).join(": ");
        const kr = impacto.kr ? ` · ${impacto.kr}` : "";
        item.textContent = `${impacto.okr}${kr} (${detalhe})`;
        okrs.append(item);
    }
    if (registro.okrs.length === 0)
        okrs.textContent = VAZIO;
    const impeditivo = document.createElement("div");
    impeditivo.className = "texto-celula";
    impeditivo.textContent = registro.impeditivo || VAZIO;
    const acoes = document.createElement("div");
    acoes.className = "acoes-linha";
    acoes.append(criarBotao("Editar", "secundario", () => iniciarEdicao(registro)), criarBotao("Remover", "perigo", () => remover(registro)));
    // Mesma ordem dos <th> em index.html.
    const colunas = [
        registro.tipo,
        registro.assunto,
        registro.itemPortal ? criarLink(registro.itemPortal.link, registro.itemPortal.nome || "Abrir item") : VAZIO,
        registro.descricao,
        classificacao,
        bcp,
        gmud ? (gmud.link ? criarLink(gmud.link, rotuloGmud(gmud)) : rotuloGmud(gmud)) : VAZIO,
        okrs,
        textoDoVinculoPdi(registro.pdis), // pdi.ts
        registro.squad,
        registro.siglas.join(", ") || VAZIO,
        registro.camadas.join(", ") || VAZIO,
        registro.servicosAws.join(", ") || VAZIO,
        registro.microsservicos.join(", ") || VAZIO,
        registro.tags.join(", ") || VAZIO,
        registro.pessoas.join(", ") || VAZIO,
        formatarData(registro.dataInicio),
        formatarData(registro.dataFim),
        `${leadTimeEmDias(registro)} d`,
        rotuloRelease(registro),
        registro.sprint ? `S${registro.sprint}` : "Sem sprint",
        impeditivo,
        git ? "Sim" : "Não",
        git?.linkPullRequest ? criarLink(git.linkPullRequest, "Pull Request") : VAZIO,
        git?.linkActions ? criarLink(git.linkActions, "Actions (prod)") : VAZIO,
        gmud?.evidencias ? criarLink(gmud.evidencias, "Evidências") : VAZIO,
        acoes,
    ];
    const linha = document.createElement("tr");
    for (const conteudo of colunas) {
        const celula = document.createElement("td");
        // textContent/append com string nunca interpreta HTML: seguro para texto digitado.
        celula.append(conteudo);
        linha.append(celula);
    }
    return linha;
}
// Valor "" = sem filtro; "sem" = registros sem release/sprint/impeditivo.
function passaNosFiltros(registro) {
    const release = filtroRelease.value;
    const sprint = filtroSprint.value;
    const impeditivo = filtroImpeditivo.value;
    if (release && (registro.release ?? "sem") !== release)
        return false;
    if (sprint && (registro.sprint ?? "sem") !== sprint)
        return false;
    if (impeditivo && (registro.impeditivo ? "com" : "sem") !== impeditivo)
        return false;
    return true;
}
// Linha única ocupando todas as colunas, para tabela vazia ou busca sem resultado.
function mostrarTabelaVazia(texto) {
    const linha = document.createElement("tr");
    const celula = document.createElement("td");
    celula.colSpan = 27;
    celula.className = "vazio";
    celula.textContent = texto;
    linha.append(celula);
    corpoTabela.replaceChildren(linha);
}
function renderizarTabela() {
    const total = registros.length;
    // Entregas mais recentes primeiro. A busca olha o texto de todas as colunas da
    // linha (inclusive pessoas, GMUD e PDI), sem diferenciar acento nem maiúscula.
    const palavras = semAcentoNaBusca(buscaTabela.value).split(/\s+/).filter(Boolean);
    const linhas = registros
        .filter(passaNosFiltros)
        .sort((a, b) => b.dataFim.localeCompare(a.dataFim))
        .map(criarLinha)
        .filter((linha) => {
        const conteudo = semAcentoNaBusca(linha.textContent ?? "");
        return palavras.every((palavra) => conteudo.includes(palavra));
    });
    const totalTexto = total === 1 ? "1 registro" : `${total} registros`;
    contador.textContent = linhas.length === total ? totalTexto : `${linhas.length} de ${totalTexto}`;
    if (total === 0)
        mostrarTabelaVazia("Nenhum registro ainda. Use o formulário acima para adicionar o primeiro.");
    else if (linhas.length === 0 && palavras.length > 0)
        mostrarTabelaVazia(`Nenhum registro encontrado para "${buscaTabela.value.trim()}".`);
    else if (linhas.length === 0)
        mostrarTabelaVazia("Nenhum registro corresponde aos filtros selecionados.");
    else
        corpoTabela.replaceChildren(...linhas);
}
function semAcentoNaBusca(texto) {
    return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}
// ---------- Exportar / importar JSON ----------
function exportarJson() {
    const arquivo = new Blob([JSON.stringify(registros, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(arquivo);
    link.download = `registro-entregas-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
}
// Confere só o mínimo para a tabela e o dashboard não quebrarem. Campos novos
// ausentes (okrs, release, sprint, impeditivo) são completados por migrarRegistro.
// ---------- Página publicada gerada no navegador (arquivo único) ----------
// No arquivo único (registro-entregas.html, gerado pelo `npm run build`)
// um script guarda o HTML original da página antes de o app mexer no DOM. Com
// ele, a página do S3 é montada aqui mesmo, sem Node nem AWS CLI: é o caminho
// para PCs onde não dá para baixar o repositório.
const fonteDoArquivoUnico = window.fonteDoArquivoUnico;
async function gerarPaginaPublicada() {
    if (!fonteDoArquivoUnico)
        return;
    if (registros.length === 0) {
        alert("Não há entregas para publicar: importe o CSV primeiro.");
        return;
    }
    // Os vínculos com o PDI não vão abertos: seguem cifrados, junto com o PDI,
    // na tag de tagDoPdiPublicado (pdi.ts), que só a senha do coordenador abre.
    // Pessoas envolvidas também ficam fora: só servem para a aba de edição.
    const semPdi = registros.map((r) => ({ ...r, pdis: [], pessoas: [] }));
    // Mesmo formato do `npm run publicar --json`: "<" escapado para nenhum texto
    // fechar a tag <script> antes da hora.
    const json = JSON.stringify(semPdi).replaceAll("<", "\\u003c");
    const tagPdi = await tagDoPdiPublicado();
    // Catálogo de OKRs/KRs, para o dashboard mostrar títulos (ver carregarOkrsCadastrados em okrs.ts).
    const okrs = JSON.stringify(carregarOkrsCadastrados()).replaceAll("<", "\\u003c");
    const tagOkrs = `<script type="application/json" id="okrs-publicados">${okrs}</script>\n`;
    // Foto do cabeçalho (perfil.ts): quem abre o link não tem o localStorage de quem publica.
    const foto = lerFoto();
    const tagFoto = foto
        ? `<script type="application/json" id="foto-publicada">${JSON.stringify(foto).replaceAll("<", "\\u003c")}</script>\n`
        : "";
    const scripts = [...document.querySelectorAll("script[data-app]")]
        .map((script) => `<script data-app>${script.textContent ?? ""}</script>`)
        .join("\n");
    const pagina = fonteDoArquivoUnico.replace("</body>", () => `<script type="application/json" id="dados-publicados">${json}</script>\n${tagOkrs}${tagFoto}${tagPdi}${scripts}\n</body>`);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([pagina], { type: "text/html" }));
    link.download = `registro-entregas-publicado-${new Date().toISOString().slice(0, 10)}.html`;
    link.click();
    URL.revokeObjectURL(link.href);
}
function registroImportavel(valor) {
    if (typeof valor !== "object" || valor === null)
        return false;
    const r = valor;
    const dataIso = /^\d{4}-\d{2}-\d{2}$/;
    return (typeof r.id === "string" &&
        typeof r.tipo === "string" &&
        typeof r.assunto === "string" &&
        typeof r.descricao === "string" &&
        typeof r.squad === "string" &&
        Array.isArray(r.siglas) &&
        typeof r.dataInicio === "string" &&
        dataIso.test(r.dataInicio) &&
        typeof r.dataFim === "string" &&
        dataIso.test(r.dataFim));
}
// Confere valores de lista e datas de cada entrega: o JSON pode ter sido escrito
// à mão (ver exemplos/entregas-exemplo.json). Grau, release e sprint nulos
// continuam aceitos porque existem em registros antigos.
function errosDoRegistroJson(r, posicao) {
    const erros = [];
    const onde = `Entrega ${posicao} (id "${r.id}")`;
    const lista = (opcoes) => opcoes.join(", ");
    if (!pertence(TIPOS_ITEM, r.tipo))
        erros.push(`${onde}: tipo "${r.tipo}" inválido. Use: ${lista(TIPOS_ITEM)}.`);
    if (!r.assunto.trim())
        erros.push(`${onde}: assunto vazio.`);
    if (!r.squad.trim())
        erros.push(`${onde}: squad vazia.`);
    if (r.dataFim < r.dataInicio)
        erros.push(`${onde}: dataFim antes de dataInicio.`);
    const erroDeData = erroDeDataERelease(r.dataFim, r.release ?? null);
    if (erroDeData)
        erros.push(`${onde}: ${erroDeData}`);
    if (r.release != null && !pertence(RELEASES, r.release)) {
        erros.push(`${onde}: release "${r.release}" inválida. Use: ${lista(RELEASES)} (como texto).`);
    }
    if (r.sprint != null && !pertence(SPRINTS, r.sprint)) {
        erros.push(`${onde}: sprint "${r.sprint}" inválida. Use: ${lista(SPRINTS)} (como texto).`);
    }
    if (!r.siglas.every((sigla) => typeof sigla === "string"))
        erros.push(`${onde}: siglas devem ser textos.`);
    if (r.camadas !== undefined && (!Array.isArray(r.camadas) || !r.camadas.every((c) => pertence(CAMADAS, c)))) {
        erros.push(`${onde}: camadas deve ser uma lista com: ${lista(CAMADAS)}.`);
    }
    if (r.itemPortal != null) {
        const { nome, link } = r.itemPortal;
        if (typeof nome !== "string" || typeof link !== "string" || !urlValida(link)) {
            erros.push(`${onde}: itemPortal deve ser { "nome": texto, "link": "https://..." }.`);
        }
    }
    for (const campo of ["servicosAws", "microsservicos", "tags", "pessoas"]) {
        const valor = r[campo];
        if (valor !== undefined && (!Array.isArray(valor) || !valor.every((v) => typeof v === "string"))) {
            erros.push(`${onde}: ${campo} deve ser uma lista de textos.`);
        }
    }
    if (r.okrs !== undefined && !Array.isArray(r.okrs))
        erros.push(`${onde}: okrs deve ser uma lista.`);
    for (const impacto of Array.isArray(r.okrs) ? r.okrs : []) {
        if (typeof impacto !== "object" || impacto === null) {
            erros.push(`${onde}: cada item de okrs deve ser { "okr", "grau", "motivo" }.`);
            continue;
        }
        if (!pertence(okrsDisponiveis(), impacto.okr)) {
            erros.push(`${onde}: OKR "${impacto.okr}" inválido. Use: ${lista(okrsDisponiveis())} (ou cadastre-o).`);
        }
        if (impacto.kr != null && typeof impacto.kr !== "string")
            erros.push(`${onde}: kr deve ser texto ou null.`);
        if (impacto.grau !== null && !pertence(GRAUS_IMPACTO, impacto.grau)) {
            erros.push(`${onde}: grau "${impacto.grau}" inválido. Use: ${lista(GRAUS_IMPACTO)}.`);
        }
    }
    if (r.pdis !== undefined && !Array.isArray(r.pdis))
        erros.push(`${onde}: pdis deve ser uma lista.`);
    for (const vinculo of [...(Array.isArray(r.pdis) ? r.pdis : []), ...(r.pdi ? [r.pdi] : [])]) {
        const { ponto, intensidade, versao } = vinculo;
        if (versao != null && typeof versao !== "string")
            erros.push(`${onde}: versao do PDI deve ser texto.`);
        if (typeof ponto !== "string" || !PADRAO_PONTO_PDI.test(ponto)) {
            erros.push(`${onde}: ponto do PDI deve ser "gap_<id>" ou "exp_<id>".`);
        }
        if (!pertence(INTENSIDADES_PDI, intensidade)) {
            erros.push(`${onde}: intensidade "${intensidade}" inválida. Use: ${lista(INTENSIDADES_PDI)}.`);
        }
    }
    return erros;
}
async function importarJson() {
    const arquivo = campoImportar.files?.[0];
    if (!arquivo)
        return;
    let dados;
    try {
        dados = JSON.parse(await arquivo.text());
    }
    catch {
        dados = null;
    }
    // Limpa o campo para permitir escolher o mesmo arquivo de novo.
    campoImportar.value = "";
    if (!Array.isArray(dados)) {
        alert('Arquivo inválido: o JSON precisa ser uma lista [ ... ] de entregas (ver exemplos/entregas-exemplo.json).');
        return;
    }
    // Como no CSV, é tudo ou nada: com qualquer entrega inválida, nada é importado.
    const erros = [];
    const ids = new Set();
    for (const [indice, item] of dados.entries()) {
        const posicao = indice + 1;
        if (!registroImportavel(item)) {
            erros.push(`Entrega ${posicao}: faltam campos obrigatórios ou o formato está errado ` +
                "(id, tipo, assunto, descricao, squad, siglas, dataInicio e dataFim em aaaa-mm-dd).");
            continue;
        }
        if (ids.has(item.id))
            erros.push(`Entrega ${posicao}: id "${item.id}" repetido no arquivo.`);
        ids.add(item.id);
        erros.push(...errosDoRegistroJson(item, posicao));
    }
    if (erros.length > 0) {
        const exibidos = erros.slice(0, MAXIMO_ERROS_EXIBIDOS);
        if (erros.length > exibidos.length)
            exibidos.push(`... e mais ${erros.length - exibidos.length} erro(s).`);
        alert(`JSON inválido, nada foi importado:\n\n${exibidos.join("\n")}`);
        return;
    }
    aplicarImportacao(dados.map(migrarRegistro));
}
// Usada pelas importações de JSON e de CSV (csv.ts).
function aplicarImportacao(importados) {
    const mensagem = `Importar ${importados.length} registro(s)? Registros com o mesmo id serão substituídos pelos do arquivo.`;
    if (!confirm(mensagem))
        return;
    // O CSV pode não trazer o vínculo com o PDI, camadas, serviços AWS,
    // microsserviços, pessoas nem o nome da GMUD: reimportar a planilha da semana não pode apagar o que foi
    // preenchido no formulário. Campo vazio no arquivo mantém o valor atual.
    const atuais = new Map(registros.map((r) => [r.id, r]));
    const preservados = importados.map((r) => {
        const atual = atuais.get(r.id);
        if (!atual)
            return r;
        return {
            ...r,
            pdis: r.pdis.length > 0 ? r.pdis : atual.pdis,
            camadas: r.camadas.length > 0 ? r.camadas : atual.camadas,
            servicosAws: r.servicosAws.length > 0 ? r.servicosAws : atual.servicosAws,
            microsservicos: r.microsservicos.length > 0 ? r.microsservicos : atual.microsservicos,
            tags: r.tags.length > 0 ? r.tags : atual.tags,
            itemPortal: r.itemPortal ?? atual.itemPortal,
            pessoas: r.pessoas.length > 0 ? r.pessoas : atual.pessoas,
            // CSV sem okrNKr: o KR escolhido no formulário continua no mesmo OKR.
            okrs: r.okrs.map((o) => (o.kr ? o : { ...o, kr: atual.okrs.find((a) => a.okr === o.okr)?.kr ?? null })),
            // Mesma GMUD sem nome/evidências no CSV: mantém os do formulário.
            gmud: r.gmud && atual.gmud?.nome === r.gmud.nome
                ? {
                    ...r.gmud,
                    titulo: r.gmud.titulo || atual.gmud.titulo || null,
                    evidencias: r.gmud.evidencias || atual.gmud.evidencias || null,
                }
                : r.gmud,
        };
    });
    const idsImportados = new Set(importados.map((r) => r.id));
    registros = [...registros.filter((r) => !idsImportados.has(r.id)), ...preservados];
    salvarRegistros(registros);
    preencherSquadsESiglas();
    limparFormulario();
    renderizarTabela();
}
// ---------- Inicialização ----------
preencherSelect(campoTipo, TIPOS_ITEM);
preencherSelect(campoRelease, RELEASES);
preencherSelect(campoSprint, SPRINTS);
filtroRelease.append(new Option("Todas", ""));
for (const release of RELEASES)
    filtroRelease.append(new Option(`R${release}`, release));
filtroRelease.append(new Option("Sem release", "sem"));
filtroSprint.append(new Option("Todas", ""));
for (const sprint of SPRINTS)
    filtroSprint.append(new Option(`S${sprint}`, sprint));
filtroSprint.append(new Option("Sem sprint", "sem"));
preencherSquadsESiglas();
criarCadastroRapido(el("nova-squad"), "Nova squad", cadastrarSquad);
criarCadastroRapido(el("nova-sigla"), "Nova sigla", cadastrarSigla);
criarCadastroRapido(el("novo-servico-aws"), "Novo serviço AWS", cadastrarServicoAws);
criarCadastroRapido(el("novo-microsservico"), "Novo microsserviço", cadastrarMicrosservico);
criarCadastroRapido(el("nova-tag"), "Nova tag", cadastrarTag);
criarCadastroRapido(el("nova-pessoa"), "Nova pessoa", cadastrarPessoa);
listaCamadas.append(...CAMADAS.map((camada) => criarEscolha("checkbox", "camadas", camada, camada)));
// A release segue o trimestre da data de fim: escolher a data já preenche a release.
el("dataFim").addEventListener("change", (evento) => {
    const data = evento.target.value;
    if (data)
        campoRelease.value = releaseDaData(data);
});
formulario.addEventListener("submit", aoEnviar);
// Clicar no fundo escurecido fecha a confirmação (Esc já fecha nativamente).
modalConfirmacao.addEventListener("click", (evento) => {
    if (evento.target === modalConfirmacao)
        modalConfirmacao.close();
});
formulario.addEventListener("input", atualizarCamposCondicionais);
botaoCancelar.addEventListener("click", limparFormulario);
filtroRelease.addEventListener("change", renderizarTabela);
filtroSprint.addEventListener("change", renderizarTabela);
filtroImpeditivo.addEventListener("change", renderizarTabela);
buscaTabela.addEventListener("input", renderizarTabela);
botaoExportar.addEventListener("click", exportarJson);
const botaoGerarPublicada = el("btn-gerar-publicada");
botaoGerarPublicada.hidden = !fonteDoArquivoUnico;
botaoGerarPublicada.addEventListener("click", () => void gerarPaginaPublicada());
campoImportar.addEventListener("change", importarJson);
atualizarCamposCondicionais();
// A tabela é desenhada pela primeira vez em pdi.ts: a coluna PDI depende dele.
