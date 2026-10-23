"use strict";
// OKRs e KRs: cadastro na aba de edição e seletor do formulário da entrega.
// Hierarquia: objetivo (tema, ex.: "Cliente") > OKR (nome + código) > KR1..N.
//
// A entrega guarda o código do OKR (ex.: "A") e, opcionalmente, o código do KR
// (ex.: "KR1") em OkrImpactado (app.ts). Assim o CSV (okr1, okr1Kr...) e os
// registros antigos, que só tinham o código do OKR, continuam valendo.
//
// Carrega antes de csv.ts: a página publicada valida o CSV embutido ao abrir, e
// validar() já usa okrsDisponiveis().
const CHAVE_STORAGE_OKRS = "registro-entregas:okrs";
function okrCadastradoValido(valor) {
    if (typeof valor !== "object" || valor === null)
        return false;
    const { objetivo, codigo, titulo, krs } = valor;
    return ((objetivo === undefined || typeof objetivo === "string") &&
        typeof codigo === "string" &&
        typeof titulo === "string" &&
        Array.isArray(krs) &&
        krs.every((kr) => {
            const k = kr;
            return typeof k === "object" && k !== null && typeof k.codigo === "string" && typeof k.titulo === "string";
        }));
}
// Página publicada: o catálogo vem embutido (#okrs-publicados), não do navegador
// de quem abre. Sem nada cadastrado: os OKRs iniciais de config.ts, sem título.
function carregarOkrsCadastrados() {
    try {
        const publicado = document.getElementById("okrs-publicados")?.textContent;
        const dados = JSON.parse(publicado ?? localStorage.getItem(CHAVE_STORAGE_OKRS) ?? "null");
        if (Array.isArray(dados) && dados.every(okrCadastradoValido)) {
            return dados.map((okr) => ({ ...okr, objetivo: okr.objetivo ?? "" }));
        }
    }
    catch {
        // cai nos iniciais
    }
    return OKRS.map((codigo) => ({ objetivo: "", codigo, titulo: "", krs: [] }));
}
const SEM_OBJETIVO = "Sem objetivo";
// OKRs agrupados pelo objetivo, na ordem em que cada objetivo aparece no cadastro.
function okrsPorObjetivo(okrs) {
    const grupos = new Map();
    for (const okr of okrs) {
        const objetivo = okr.objetivo.trim() || SEM_OBJETIVO;
        grupos.set(objetivo, [...(grupos.get(objetivo) ?? []), okr]);
    }
    return [...grupos];
}
// Cadastrados + os que já aparecem em registros (ex.: OKR que saiu do cadastro).
function okrsDisponiveis() {
    return [
        ...new Set([...carregarOkrsCadastrados().map((o) => o.codigo), ...registros.flatMap((r) => r.okrs.map((o) => o.okr))]),
    ];
}
function okrDe(codigo) {
    return carregarOkrsCadastrados().find((o) => o.codigo === codigo);
}
// "OKR A · Aumentar receita" (ou só "OKR A", sem título).
function rotuloOkr(codigo) {
    const titulo = okrDe(codigo)?.titulo.trim();
    return titulo ? `OKR ${codigo} · ${titulo}` : `OKR ${codigo}`;
}
function corDoOkr(codigo) {
    const indice = Math.max(0, okrsDisponiveis().indexOf(codigo));
    return CORES_OKR[indice % CORES_OKR.length] ?? "var(--destaque)";
}
// "KR1 · Reduzir chamadas" ou "OKR como um todo".
function rotuloKr(okr, kr) {
    if (!kr)
        return "OKR como um todo";
    const titulo = okrDe(okr)?.krs.find((k) => k.codigo === kr)?.titulo.trim();
    return titulo ? `${kr} · ${titulo}` : kr;
}
// ---------- Seletor no formulário da entrega ----------
// Um bloco recolhível por OKR. Dentro: "Não impacta" / "OKR como um todo" / um
// cartão por KR; escolhido algo, aparecem grau e motivo. Os radios têm nome por
// bloco (okrAlvo-<i>, okrGrau-<i>) e anexarOkrsDoFormulario monta as listas
// alinhadas okr/okrKr/okrGrau/okrMotivo que validar() lê (as mesmas do CSV).
const escolhaOkrs = el("okr-escolha");
const OKR_INTEIRO = "*";
function criarCartaoAlvo(nome, valor, etiqueta, titulo, cor, marcado) {
    const conteudo = document.createElement("span");
    conteudo.className = "ponto-escolha-conteudo";
    const marca = document.createElement("span");
    marca.className = "ponto-escolha-etiqueta";
    marca.textContent = etiqueta;
    const texto = document.createElement("span");
    texto.className = "ponto-escolha-titulo";
    texto.textContent = titulo;
    texto.title = titulo;
    conteudo.append(marca, texto);
    const cartao = criarEscolha("radio", nome, valor, conteudo, marcado);
    cartao.classList.add("ponto-escolha");
    if (!valor)
        cartao.classList.add("ponto-escolha-nenhum");
    cartao.style.setProperty("--cor-ponto", cor);
    return cartao;
}
function criarBlocoOkr(okr, indice, impacto) {
    const objetivo = okr;
    const cor = corDoOkr(objetivo.codigo);
    const bloco = document.createElement("details");
    bloco.className = "pdi-versao-bloco okr-bloco";
    bloco.dataset.okr = objetivo.codigo;
    bloco.open = !!impacto;
    bloco.style.setProperty("--cor-ponto", cor);
    const resumo = document.createElement("summary");
    const letra = document.createElement("span");
    letra.className = "okr-letra";
    letra.textContent = objetivo.codigo;
    const nome = document.createElement("strong");
    nome.textContent = objetivo.titulo.trim() || `OKR ${objetivo.codigo}`;
    const escolhido = document.createElement("span");
    escolhido.className = "pdi-versao-escolhido";
    resumo.append(letra, nome, escolhido);
    const alvo = impacto ? (impacto.kr ?? OKR_INTEIRO) : "";
    const nomeAlvo = `okrAlvo-${indice}`;
    const grade = document.createElement("div");
    grade.className = "pontos-escolha";
    grade.append(criarCartaoAlvo(nomeAlvo, "", "Não impacta", "Esta entrega não mexe neste OKR", cor, !alvo), criarCartaoAlvo(nomeAlvo, OKR_INTEIRO, "OKR como um todo", "Impacta o objetivo, sem um KR específico", cor, alvo === OKR_INTEIRO), ...objetivo.krs.map((kr) => criarCartaoAlvo(nomeAlvo, kr.codigo, kr.codigo, kr.titulo || kr.codigo, cor, alvo === kr.codigo)));
    // KR que saiu do cadastro continua escolhido enquanto a entrega o usar.
    if (alvo && alvo !== OKR_INTEIRO && !objetivo.krs.some((k) => k.codigo === alvo)) {
        grade.append(criarCartaoAlvo(nomeAlvo, alvo, alvo, "KR que não existe mais no cadastro", cor, true));
    }
    // Grau e motivo: só com um alvo escolhido (ver atualizarBlocosOkr).
    const detalhe = document.createElement("div");
    detalhe.className = "vinculo-pdi-intensidade okr-detalhe-escolha";
    const pergunta = document.createElement("span");
    pergunta.className = "dica";
    pergunta.textContent = "Com que grau a entrega impacta e por quê?";
    const graus = document.createElement("div");
    graus.className = "escolhas";
    graus.append(...[...GRAUS_IMPACTO].reverse().map((grau) => {
        const texto = document.createElement("span");
        texto.className = `intensidade-escolha intensidade-${grau === "Alto" ? "forte" : grau === "Médio" ? "medio" : "baixo"}`;
        const forte = document.createElement("strong");
        forte.textContent = grau;
        texto.append(forte);
        return criarEscolha("radio", `okrGrau-${indice}`, grau, texto, impacto?.grau === grau);
    }));
    const motivo = document.createElement("input");
    motivo.type = "text";
    motivo.className = "okr-motivo";
    motivo.placeholder = "Motivo do impacto";
    motivo.ariaLabel = `Motivo do impacto no OKR ${objetivo.codigo}`;
    motivo.value = impacto?.motivo ?? "";
    detalhe.append(pergunta, graus, motivo);
    bloco.append(resumo, grade, detalhe);
    return bloco;
}
// Mostra grau/motivo só no bloco com alvo e resume a escolha no título do bloco.
function atualizarBlocosOkr() {
    for (const bloco of escolhaOkrs.querySelectorAll(".okr-bloco")) {
        const alvo = bloco.querySelector('input[name^="okrAlvo-"]:checked')?.value ?? "";
        const detalhe = bloco.querySelector(".okr-detalhe-escolha");
        if (detalhe)
            detalhe.hidden = !alvo;
        for (const campo of detalhe?.querySelectorAll("input") ?? [])
            campo.disabled = !alvo;
        const grau = bloco.querySelector('input[name^="okrGrau-"]:checked')?.value;
        const resumo = bloco.querySelector(".pdi-versao-escolhido");
        if (resumo) {
            const okr = bloco.dataset.okr ?? "";
            resumo.textContent = alvo ? `✓ ${rotuloKr(okr, alvo === OKR_INTEIRO ? null : alvo)}${grau ? ` · ${grau}` : ""}` : "";
        }
        bloco.classList.toggle("com-escolha", !!alvo);
    }
}
// OKRs do cadastro, agrupados pelo objetivo, + os que só existem nas entregas
// (para não perder o vínculo ao editar).
function preencherOkrsEntrega(impactos) {
    const okrs = carregarOkrsCadastrados();
    for (const { okr } of impactos) {
        if (!okrs.some((o) => o.codigo === okr))
            okrs.push({ objetivo: "Fora do cadastro", codigo: okr, titulo: `OKR ${okr}`, krs: [] });
    }
    let indice = 0;
    escolhaOkrs.replaceChildren(...okrsPorObjetivo(okrs).map(([objetivo, doObjetivo]) => {
        const grupo = document.createElement("div");
        grupo.className = "okr-grupo";
        const titulo = document.createElement("span");
        titulo.className = "okr-grupo-titulo";
        titulo.textContent = objetivo;
        grupo.append(titulo, ...doObjetivo.map((okr) => criarBlocoOkr(okr, indice++, impactos.find((i) => i.okr === okr.codigo))));
        return grupo;
    }));
    if (okrs.length === 0) {
        escolhaOkrs.append(Object.assign(document.createElement("p"), {
            className: "dica",
            textContent: "Nenhum OKR cadastrado: cadastre no cartão “OKRs e KRs”, mais abaixo nesta aba.",
        }));
    }
    atualizarBlocosOkr();
}
// Chamada em aoEnviar (app.ts) antes de validar().
function anexarOkrsDoFormulario(dados) {
    for (const bloco of escolhaOkrs.querySelectorAll(".okr-bloco")) {
        const alvo = bloco.querySelector('input[name^="okrAlvo-"]:checked')?.value ?? "";
        if (!alvo)
            continue;
        dados.append("okr", bloco.dataset.okr ?? "");
        dados.append("okrKr", alvo === OKR_INTEIRO ? "" : alvo);
        dados.append("okrGrau", bloco.querySelector('input[name^="okrGrau-"]:checked')?.value ?? "");
        dados.append("okrMotivo", bloco.querySelector(".okr-motivo")?.value ?? "");
    }
}
// ---------- Cadastro (aba de edição) ----------
const listaCadastroOkrs = el("okrs-cadastro");
const statusOkrs = el("okrs-status");
const campoImportarOkrs = el("importar-okrs");
function criarCampoTexto(rotulo, classe, valor, placeholder = "") {
    const campo = document.createElement("label");
    campo.className = "campo";
    const texto = document.createElement("span");
    texto.textContent = rotulo;
    const entrada = document.createElement("input");
    entrada.type = "text";
    entrada.className = classe;
    entrada.value = valor;
    entrada.placeholder = placeholder;
    campo.append(texto, entrada);
    return campo;
}
// Próximo KR da lista: um a mais que o maior "KRn" (remover um do meio não repete número).
function proximoCodigoKr(lista) {
    const numeros = [...lista.querySelectorAll(".kr-codigo")].map((campo) => Number(/^kr(\d+)$/i.exec(campo.value.trim())?.[1] ?? 0));
    return `KR${Math.max(0, ...numeros) + 1}`;
}
function adicionarLinhaKr(lista, kr) {
    const linha = document.createElement("div");
    linha.className = "kr-linha";
    const codigo = criarCampoTexto("KR", "kr-codigo", kr?.codigo ?? proximoCodigoKr(lista));
    const titulo = criarCampoTexto("Key result", "kr-titulo", kr?.titulo ?? "", "Ex.: Reduzir em 20% as chamadas ao atendimento");
    linha.append(codigo, titulo, criarBotao("Remover", "perigo", () => linha.remove()));
    lista.append(linha);
}
// Primeira letra livre (A, B, C...) entre o cadastro na tela e as entregas; depois, O27, O28...
// Pula códigos de entregas antigas: um OKR novo nunca herda sem querer entregas de
// um OKR que deixou de existir. Para herdar, digite o código antigo no campo.
function proximoCodigoOkr() {
    const usados = new Set([
        ...[...listaCadastroOkrs.querySelectorAll(".okr-codigo")].map((c) => c.value.trim().toUpperCase()),
        ...registros.flatMap((r) => r.okrs.map((o) => o.okr.toUpperCase())),
    ]);
    for (let i = 0; i < 26; i++) {
        const letra = String.fromCharCode(65 + i);
        if (!usados.has(letra))
            return letra;
    }
    let numero = 27;
    while (usados.has(`O${numero}`))
        numero++;
    return `O${numero}`;
}
function adicionarCartaoOkr(container, okr) {
    const cartao = document.createElement("fieldset");
    cartao.className = "okr-cadastro";
    const indice = listaCadastroOkrs.querySelectorAll(".okr-cadastro").length;
    cartao.style.setProperty("--cor-okr", CORES_OKR[indice % CORES_OKR.length] ?? "var(--destaque)");
    const topo = document.createElement("div");
    topo.className = "okr-cadastro-topo";
    topo.append(criarCampoTexto("Código", "okr-codigo", okr?.codigo ?? proximoCodigoOkr()), criarCampoTexto("OKR *", "okr-titulo", okr?.titulo ?? "", "Ex.: Aumentar a satisfação do cliente"), criarBotao("Remover OKR", "perigo", () => cartao.remove()));
    const krs = document.createElement("div");
    krs.className = "kr-linhas";
    container.append(cartao);
    for (const kr of okr?.krs ?? [])
        adicionarLinhaKr(krs, kr);
    // OKR novo já começa com o KR1.
    if (!okr)
        adicionarLinhaKr(krs);
    cartao.append(topo, krs, criarBotao("+ Adicionar KR", "secundario", () => adicionarLinhaKr(krs)));
}
// Um bloco por objetivo (ex.: "Cliente"), com os OKRs dele dentro.
function adicionarGrupoObjetivo(nome = "", okrs = []) {
    listaCadastroOkrs.querySelector(":scope > .estado-vazio")?.remove();
    const grupo = document.createElement("section");
    grupo.className = "objetivo-cadastro";
    const cabecalho = document.createElement("div");
    cabecalho.className = "objetivo-cadastro-topo";
    const okrsDoGrupo = document.createElement("div");
    okrsDoGrupo.className = "okrs-do-objetivo";
    cabecalho.append(criarCampoTexto("Objetivo *", "objetivo-nome", nome === SEM_OBJETIVO ? "" : nome, "Ex.: Cliente"), criarBotao("+ OKR neste objetivo", "secundario", () => adicionarCartaoOkr(okrsDoGrupo)), criarBotao("Remover objetivo", "perigo", () => grupo.remove()));
    grupo.append(cabecalho, okrsDoGrupo);
    listaCadastroOkrs.append(grupo);
    if (okrs.length === 0)
        adicionarCartaoOkr(okrsDoGrupo);
    for (const okr of okrs)
        adicionarCartaoOkr(okrsDoGrupo, okr);
}
function renderizarCadastroOkrs() {
    listaCadastroOkrs.replaceChildren();
    const grupos = okrsPorObjetivo(carregarOkrsCadastrados());
    for (const [objetivo, okrs] of grupos)
        adicionarGrupoObjetivo(objetivo, okrs);
    if (grupos.length === 0) {
        listaCadastroOkrs.append(Object.assign(document.createElement("p"), {
            className: "estado-vazio",
            textContent: "Nenhum OKR cadastrado ainda. Clique em “+ Novo objetivo” para começar (ex.: Cliente).",
        }));
    }
}
function okrsDoCadastro() {
    const valor = (raiz, classe) => raiz.querySelector(`.${classe}`)?.value.trim() ?? "";
    return [...listaCadastroOkrs.querySelectorAll(".objetivo-cadastro")].flatMap((grupo) => [...grupo.querySelectorAll(".okr-cadastro")].map((cartao) => ({
        objetivo: valor(grupo, "objetivo-nome"),
        codigo: valor(cartao, "okr-codigo"),
        titulo: valor(cartao, "okr-titulo"),
        krs: [...cartao.querySelectorAll(".kr-linha")].map((linha) => ({
            codigo: valor(linha, "kr-codigo"),
            titulo: valor(linha, "kr-titulo"),
        })),
    })));
}
// Códigos obrigatórios e únicos, objetivo e nome preenchidos. Impedem salvar.
function errosDosOkrs(objetivos) {
    const erros = [];
    const codigos = objetivos.map((o) => o.codigo.toLowerCase());
    for (const [indice, objetivo] of objetivos.entries()) {
        const onde = `OKR ${objetivo.codigo || indice + 1}`;
        if (!objetivo.codigo)
            erros.push(`${onde}: informe o código (ex.: A).`);
        else if (codigos.indexOf(objetivo.codigo.toLowerCase()) !== indice)
            erros.push(`${onde}: o código "${objetivo.codigo}" está repetido.`);
        if (!objetivo.objetivo)
            erros.push(`${onde}: informe o objetivo do grupo (ex.: Cliente).`);
        if (!objetivo.titulo)
            erros.push(`${onde}: informe o nome do OKR.`);
        const krs = objetivo.krs.map((k) => k.codigo.toLowerCase());
        for (const [i, kr] of objetivo.krs.entries()) {
            if (!kr.codigo)
                erros.push(`${onde}, KR ${i + 1}: informe o código (ex.: KR1).`);
            else if (krs.indexOf(kr.codigo.toLowerCase()) !== i)
                erros.push(`${onde}: o KR "${kr.codigo}" está repetido.`);
        }
    }
    return [...new Set(erros)];
}
// OKRs/KRs usados por entregas que não estão no cadastro novo, com quantas entregas
// cada um ("OKR A: 5 entregas"). Não impede salvar: as entregas mantêm o código e
// aparecem como "Fora do cadastro" até serem editadas.
function avisosDosOkrs(objetivos) {
    const contagem = new Map();
    for (const registro of registros) {
        for (const { okr, kr } of registro.okrs) {
            const cadastrado = objetivos.find((o) => o.codigo === okr);
            const chave = !cadastrado ? `OKR ${okr}` : kr && !cadastrado.krs.some((k) => k.codigo === kr) ? `${kr} do OKR ${okr}` : "";
            if (chave)
                contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
        }
    }
    return [...contagem].map(([chave, total]) => `• ${chave}: ${total} ${total === 1 ? "entrega" : "entregas"}`);
}
function salvarOkrsCadastrados(objetivos) {
    const erros = errosDosOkrs(objetivos);
    if (erros.length > 0) {
        alert(`OKRs não salvos:\n\n${erros.slice(0, MAXIMO_ERROS_EXIBIDOS).join("\n")}`);
        return false;
    }
    const avisos = avisosDosOkrs(objetivos);
    if (avisos.length > 0 &&
        !confirm(`Estas entregas usam OKRs/KRs que não estão no cadastro:\n\n${avisos.slice(0, MAXIMO_ERROS_EXIBIDOS).join("\n")}\n\n` +
            "Elas continuam com o código antigo e aparecem como “Fora do cadastro” até você editá-las " +
            "(ou cadastre um OKR com o mesmo código). Salvar mesmo assim?")) {
        return false;
    }
    localStorage.setItem(CHAVE_STORAGE_OKRS, JSON.stringify(objetivos));
    // O formulário da entrega e a tabela mostram títulos e KRs: refaz sem perder o que está marcado.
    const marcados = new FormData();
    anexarOkrsDoFormulario(marcados);
    preencherOkrsEntrega(okrsDoFormData(marcados));
    renderizarTabela();
    return true;
}
function okrsDoFormData(dados) {
    const krs = dados.getAll("okrKr");
    const graus = dados.getAll("okrGrau");
    const motivos = dados.getAll("okrMotivo");
    return dados.getAll("okr").map((okr, i) => ({
        okr: String(okr),
        kr: String(krs[i] ?? "") || null,
        grau: pertence(GRAUS_IMPACTO, String(graus[i] ?? "")) ? String(graus[i]) : null,
        motivo: String(motivos[i] ?? ""),
    }));
}
function aoSalvarOkrs() {
    if (!salvarOkrsCadastrados(okrsDoCadastro()))
        return;
    renderizarCadastroOkrs();
    statusOkrs.textContent = `OKRs salvos às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`;
}
function exportarOkrs() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(carregarOkrsCadastrados(), null, 2)], { type: "application/json" }));
    link.download = `okrs-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
}
async function importarOkrs() {
    const arquivo = campoImportarOkrs.files?.[0];
    if (!arquivo)
        return;
    let dados;
    try {
        dados = JSON.parse(await arquivo.text());
    }
    catch {
        dados = null;
    }
    campoImportarOkrs.value = "";
    if (!Array.isArray(dados) || !dados.every(okrCadastradoValido)) {
        alert('Arquivo inválido: use uma lista [ { "objetivo", "codigo", "titulo", "krs": [ { "codigo", "titulo" } ] } ].');
        return;
    }
    if (!confirm("Substituir os OKRs cadastrados pelos do arquivo?"))
        return;
    if (!salvarOkrsCadastrados(dados))
        return;
    renderizarCadastroOkrs();
    statusOkrs.textContent = "OKRs importados.";
}
// ---------- Inicialização ----------
preencherOkrsEntrega([]);
renderizarCadastroOkrs();
escolhaOkrs.addEventListener("change", atualizarBlocosOkr);
el("btn-adicionar-objetivo").addEventListener("click", () => adicionarGrupoObjetivo());
el("btn-salvar-okrs").addEventListener("click", aoSalvarOkrs);
el("btn-exportar-okrs").addEventListener("click", exportarOkrs);
campoImportarOkrs.addEventListener("change", () => void importarOkrs());
