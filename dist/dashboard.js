"use strict";
// Aba de exibição (gestores): somente leitura. Nada aqui cria, edita ou remove
// registros; o arquivo só lê a lista `registros` mantida por app.ts.
// A página é dividida em seções (hero, indicadores, volumetria, impacto, PDI e
// entregas), navegáveis pelo trilho lateral.
// `registrosDaSelecao` passa nos filtros do topo (período, release e sprint);
// `registrosFiltrados` aplica por cima o tipo escolhido nos cartões do hero.
// Os cartões de tipo usam o primeiro, para os outros tipos não zerarem; o resto usa o segundo.
// ---------- Elementos ----------
const dashKpis = el("dash-kpis");
const dashGraficosVolume = el("dash-graficos-volume");
const dashNumerosVolume = el("dash-numeros-volume");
const dashGraficosImpacto = el("dash-graficos-impacto");
const dashOkrs = el("dash-okrs");
const dashHeroTexto = el("dash-hero-texto");
const dashHeroVisual = el("dash-hero-visual");
const dashTipos = el("dash-tipos");
const dashExplorar = el("dash-explorar");
const dashEntregas = el("dash-entregas");
const dashPeriodo = el("dash-periodo");
const dashAno = el("dash-ano");
const dashSprintDica = el("dash-sprint-dica");
const dashReleaseAtual = el("dash-release-atual");
const dashBusca = el("dash-busca");
const dashBuscaTipos = el("dash-busca-tipos");
const dashRelease = el("dash-release");
const dashSprint = el("dash-sprint");
const dashResumoFiltros = el("dash-resumo-filtros");
const dashLimpar = el("dash-limpar");
const dashVazio = el("dash-vazio");
const dashVazioTexto = el("dash-vazio-texto");
const dashConteudo = el("dash-conteudo");
const dashModal = el("dash-modal");
const dashModalConteudo = el("dash-modal-conteudo");
// ---------- Utilitários ----------
const GRAU_NAO_INFORMADO = "Não informado";
// Classe CSS de cada grau (cores em style.css). Record garante que todo grau tem a sua.
const CLASSE_GRAU = {
    Baixo: "grau-baixo",
    Médio: "grau-medio",
    Alto: "grau-alto",
};
function classeDoGrau(grau) {
    return grau ? CLASSE_GRAU[grau] : "grau-indefinido";
}
function criarElemento(tag, classe = "", conteudo = "") {
    const elemento = document.createElement(tag);
    if (classe)
        elemento.className = classe;
    if (conteudo)
        elemento.textContent = conteudo;
    return elemento;
}
function plural(quantidade, singular, pluralizado) {
    return `${quantidade} ${quantidade === 1 ? singular : pluralizado}`;
}
// Opções da lista fixa primeiro (mesmo com zero), depois valores antigos que
// ainda existam em registros mas já saíram da lista.
function comExtras(lista, usados) {
    return [...new Set([...lista, ...usados])];
}
const ANO_ATUAL = new Date().getFullYear().toString();
// Não são salvos: a página sempre abre no ano corrente, com todas as releases.
const FILTROS_PADRAO = { ano: ANO_ATUAL, release: "", sprint: "", tipo: "" };
let filtros = { ...FILTROS_PADRAO };
let registrosDaSelecao = [];
let registrosFiltrados = [];
const anoDe = (registro) => registro.dataFim.slice(0, 4);
// Entregas de anos anteriores a ANO_INICIAL (ex.: dados antigos ainda no
// navegador) ficam fora do dashboard. Na aba de edição elas continuam visíveis.
function registrosNoFoco() {
    return registros.filter((r) => Number(anoDe(r)) >= ANO_INICIAL);
}
// Identifica a release junto com o ano (os números se repetem a cada ano). "" = sem release.
function chaveRelease(registro) {
    return registro.release ? `${anoDe(registro)}-${registro.release}` : "";
}
// ---------- Meses ----------
const MESES_ABREVIADOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function chaveDoMes(data) {
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}
// Índices (0 a 11) dos meses de uma release: R2 -> [3, 4, 5].
function indicesDosMesesDaRelease(release) {
    const inicio = (Number(release) - 1) * MESES_POR_RELEASE;
    return Array.from({ length: MESES_POR_RELEASE }, (_, deslocamento) => inicio + deslocamento);
}
// "2" -> "abr–jun"
function mesesDaRelease(release) {
    const indices = indicesDosMesesDaRelease(release);
    return `${MESES_ABREVIADOS[indices[0] ?? 0]}–${MESES_ABREVIADOS[indices.at(-1) ?? 0]}`;
}
// Release em que cai a data de hoje (para o atalho "Release atual").
function releaseAtual() {
    return String(Math.floor(new Date().getMonth() / MESES_POR_RELEASE) + 1);
}
// Grupo de chips de escolha única: um clique já aplica o filtro. `detalhe` é um
// texto menor dentro do chip (ex.: os meses da release).
function renderizarChips(grupo, opcoes, atual, aoEscolher, desabilitado = false) {
    grupo.classList.toggle("desabilitado", desabilitado);
    grupo.replaceChildren(...opcoes.map(([rotulo, valor, detalhe]) => {
        const chip = criarElemento("button", "chip", rotulo);
        chip.type = "button";
        chip.disabled = desabilitado;
        if (detalhe)
            chip.append(criarElemento("span", "chip-detalhe", detalhe));
        chip.setAttribute("aria-pressed", String(valor === atual));
        chip.addEventListener("click", () => {
            if (valor !== atual)
                aoEscolher(valor);
        });
        return chip;
    }));
}
function aplicarFiltro(mudanca) {
    filtros = { ...filtros, ...mudanca };
    // Sprint é subdivisão da release: sem release, não há sprint.
    if (!filtros.release)
        filtros.sprint = "";
    renderizarDashboard();
}
// Os anos vêm dos dados (mais o atual); por isso os chips são refeitos a cada renderização.
function renderizarFiltros() {
    const anos = [...new Set([ANO_ATUAL, ...registrosNoFoco().map(anoDe)])].sort().reverse();
    if (filtros.ano && !anos.includes(filtros.ano))
        filtros.ano = "";
    renderizarChips(dashAno, [...anos.map((ano) => [ano, ano]), ["Todos", ""]], filtros.ano, (ano) => aplicarFiltro({ ano }));
    renderizarChips(dashRelease, [["Todas", ""], ...RELEASES.map((release) => [`R${release}`, release, mesesDaRelease(release)])], filtros.release, (release) => aplicarFiltro({ release }));
    renderizarChips(dashSprint, [["Todas", ""], ...SPRINTS.map((sprint) => [`S${sprint}`, sprint])], filtros.sprint, (sprint) => aplicarFiltro({ sprint }), !filtros.release);
    dashSprintDica.hidden = Boolean(filtros.release);
    dashReleaseAtual.hidden = filtros.ano === ANO_ATUAL && filtros.release === releaseAtual();
}
function filtrosNoPadrao() {
    return (filtros.ano === FILTROS_PADRAO.ano &&
        filtros.release === FILTROS_PADRAO.release &&
        filtros.sprint === FILTROS_PADRAO.sprint &&
        filtros.tipo === FILTROS_PADRAO.tipo);
}
// Ex.: "Bugs · 2026 · R3 (jul–set) · S2" ou "todos os anos".
function descricaoDosFiltros() {
    const partes = [];
    if (pertence(TIPOS_ITEM, filtros.tipo))
        partes.push(PLURAL_TIPO[filtros.tipo]);
    partes.push(filtros.ano || "todos os anos");
    if (filtros.release)
        partes.push(`R${filtros.release} (${mesesDaRelease(filtros.release)})`);
    if (filtros.sprint)
        partes.push(`S${filtros.sprint}`);
    return partes.join(" · ");
}
// Todos os meses de "yyyy-mm" a "yyyy-mm", inclusive os sem entregas.
function mesesEntre(primeiro, ultimo) {
    const [ano, mes] = primeiro.split("-").map(Number);
    const meses = [];
    for (let avanco = 0; meses.at(-1) !== ultimo && avanco < 240; avanco++) {
        meses.push(chaveDoMes(new Date(ano ?? 0, (mes ?? 1) - 1 + avanco, 1)));
    }
    return meses;
}
// "2026-08" -> "ago/2026"
function rotuloMes(mes) {
    const [ano, numero] = mes.split("-");
    return `${MESES_ABREVIADOS[Number(numero) - 1] ?? numero}/${ano}`;
}
// Colunas fixas do gráfico mensal quando há ano escolhido: os 3 meses da
// release ou os 12 do ano (no ano corrente, só até o mês atual). null = sem ano.
function mesesDoFiltro() {
    if (!filtros.ano)
        return null;
    const ano = Number(filtros.ano);
    if (filtros.release) {
        return indicesDosMesesDaRelease(filtros.release).map((indice) => chaveDoMes(new Date(ano, indice, 1)));
    }
    const ultimo = filtros.ano === ANO_ATUAL ? new Date().getMonth() : 11;
    return Array.from({ length: ultimo + 1 }, (_, indice) => chaveDoMes(new Date(ano, indice, 1)));
}
// Colunas do gráfico mensal: os meses do filtro ou, em "Todo o período", do
// primeiro ao último mês com entrega entre os registros filtrados.
function mesesDoGrafico() {
    const doFiltro = mesesDoFiltro();
    if (doFiltro)
        return doFiltro;
    const comEntrega = registrosFiltrados.map((r) => r.dataFim.slice(0, 7)).sort();
    const primeiro = comEntrega[0];
    const ultimo = comEntrega.at(-1);
    return primeiro && ultimo ? mesesEntre(primeiro, ultimo) : [];
}
// ---------- KPIs e totais por tipo ----------
const PLURAL_TIPO = {
    História: "Histórias",
    Bug: "Bugs",
    Task: "Tasks",
    Oportunidade: "Oportunidades",
    Discovery: "Discoveries",
};
// Ordem dos cards pedida para o dashboard (as cores continuam vindo de CORES_TIPO).
const ORDEM_CARDS = ["História", "Bug", "Task", "Oportunidade", "Discovery"];
function criarAmostra(cor) {
    const amostra = criarElemento("span", "legenda-cor");
    amostra.style.background = cor;
    return amostra;
}
function percentualDe(parte, total) {
    return total > 0 ? Math.round((parte / total) * 100) : 0;
}
function criarIndicador(rotulo, valor, opcoes = {}) {
    const { complemento, icone, unidade, percentual, corMedidor = COR_SERIE } = opcoes;
    const indicador = criarElemento("div", "indicador");
    const titulo = criarElemento("span", "indicador-rotulo");
    if (icone)
        titulo.append(criarIcone(icone));
    titulo.append(rotulo);
    const numero = criarElemento("strong", "indicador-valor", valor);
    if (unidade)
        numero.append(criarElemento("span", "indicador-unidade", unidade));
    const linha = criarElemento("div", "indicador-linha");
    linha.append(numero);
    if (percentual !== undefined)
        linha.append(criarMedidorAnel(rotulo, percentual, corMedidor));
    indicador.append(titulo, linha);
    if (complemento)
        indicador.append(criarElemento("span", "dica", complemento));
    return indicador;
}
function leadTimeMedio(lista) {
    const soma = lista.reduce((total, r) => total + leadTimeEmDias(r), 0);
    return lista.length > 0 ? Math.round(soma / lista.length) : 0;
}
// Número = quantidade absoluta; anel = o mesmo valor em percentual.
function renderizarKpis() {
    const total = registrosFiltrados.length;
    const impactos = registrosFiltrados.flatMap((r) => r.okrs);
    const comImpactoAlto = registrosFiltrados.filter((r) => r.okrs.some((o) => o.grau === "Alto")).length;
    const okrsAtingidos = new Set(impactos.map((o) => o.okr)).size;
    const mediaLeadTime = leadTimeMedio(registrosFiltrados);
    // Um item "teve impeditivo" quando o campo Impeditivo está preenchido.
    const comImpeditivo = registrosFiltrados.filter((r) => r.impeditivo).length;
    const comGmud = registrosFiltrados.filter((r) => r.gmud).length;
    const dasEntregas = `das ${plural(total, "entrega", "entregas")}`;
    dashKpis.replaceChildren(criarIndicador("Entregas", total.toString(), { icone: "grade", complemento: "concluídas na seleção" }), criarIndicador("Lead time médio", mediaLeadTime.toString(), {
        icone: "relogio",
        complemento: "do início ao fim da entrega",
        unidade: mediaLeadTime === 1 ? "dia" : "dias",
    }), criarIndicador("OKRs impactados", okrsAtingidos.toString(), {
        icone: "alvo",
        complemento: `de ${okrsDisponiveis().length} acompanhados`,
        percentual: percentualDe(okrsAtingidos, okrsDisponiveis().length),
    }), criarIndicador("Impacto alto", comImpactoAlto.toString(), {
        icone: "medidor",
        complemento: `${dasEntregas}, em ao menos um OKR`,
        percentual: percentualDe(comImpactoAlto, total),
    }), criarIndicador("Impeditivos", comImpeditivo.toString(), {
        icone: "alerta",
        complemento: dasEntregas,
        percentual: percentualDe(comImpeditivo, total),
        corMedidor: "var(--perigo)",
    }), criarIndicador("GMUDs", comGmud.toString(), {
        icone: "documento",
        complemento: `${dasEntregas} com mudança em produção`,
        percentual: percentualDe(comGmud, total),
        corMedidor: "var(--tipo-task)",
    }));
}
// ---------- Hero (visão geral) ----------
function criarMiniDestaque(icone, rotulo, valor) {
    const item = criarElemento("div", "hero-mini");
    const titulo = criarElemento("span", "hero-mini-rotulo");
    titulo.append(criarIcone(icone), rotulo);
    item.append(titulo, criarElemento("strong", "", valor));
    return item;
}
function renderizarHero() {
    const total = registrosFiltrados.length;
    const tipoAtivo = pertence(TIPOS_ITEM, filtros.tipo) ? filtros.tipo : null;
    const squads = new Set(registrosFiltrados.map((r) => r.squad)).size;
    const okrs = new Set(registrosFiltrados.flatMap((r) => r.okrs.map((o) => o.okr))).size;
    const comImpactoAlto = registrosFiltrados.filter((r) => r.okrs.some((o) => o.grau === "Alto")).length;
    const comImpeditivo = registrosFiltrados.filter((r) => r.impeditivo).length;
    const mediaLeadTime = leadTimeMedio(registrosFiltrados);
    const titulo = criarElemento("h2", "hero-titulo");
    titulo.append(criarElemento("strong", "", total.toString()), tipoAtivo ? PLURAL_TIPO[tipoAtivo].toLowerCase() : total === 1 ? "entrega" : "entregas");
    // Composição por tipo da seleção (sem o filtro de tipo): o tipo ativo fica aceso.
    const composicao = criarElemento("div", "hero-composicao");
    for (const tipo of ORDEM_CARDS) {
        const quantidade = registrosDaSelecao.filter((r) => r.tipo === tipo).length;
        if (quantidade === 0)
            continue;
        const parte = criarElemento("span", tipoAtivo && tipo !== tipoAtivo ? "apagada" : "");
        // Base 0: a largura fica proporcional só à quantidade.
        parte.style.flex = `${quantidade} 1 0`;
        parte.style.background = CORES_TIPO[tipo];
        parte.title = `${PLURAL_TIPO[tipo]}: ${quantidade}`;
        composicao.append(parte);
    }
    const minis = criarElemento("div", "hero-minis");
    minis.append(criarMiniDestaque("relogio", "Lead time médio", plural(mediaLeadTime, "dia", "dias")), criarMiniDestaque("medidor", "Impacto alto", `${percentualDe(comImpactoAlto, total)}%`), criarMiniDestaque("alerta", "Impeditivos", `${percentualDe(comImpeditivo, total)}%`));
    dashHeroTexto.replaceChildren(criarElemento("span", "hero-sobretitulo", `01 · Visão geral · ${descricaoDosFiltros()}`), titulo, criarElemento("p", "hero-resumo", `Entregues por ${plural(squads, "squad", "squads")}, impactando ${plural(okrs, "OKR", "OKRs")}.`), composicao, minis);
    const fatias = segmentosPorTipo(registrosDaSelecao);
    const rotuloAtivo = tipoAtivo ? PLURAL_TIPO[tipoAtivo] : undefined;
    const rotuloCentro = tipoAtivo ? "do total" : total === 1 ? "entrega" : "entregas";
    const visual = criarElemento("div", "hero-orbita");
    visual.append(criarGraficoRosca("Distribuição por tipo", fatias, {
        rotuloDoCentro: rotuloCentro,
        destaque: rotuloAtivo,
        textoDoCentro: tipoAtivo ? `${percentualDe(total, registrosDaSelecao.length)}%` : undefined,
        // Clicar numa fatia é o mesmo que clicar no cartão do tipo.
        aoClicar: (rotulo) => {
            const tipo = ORDEM_CARDS.find((t) => PLURAL_TIPO[t] === rotulo);
            if (tipo)
                aplicarFiltro({ tipo: tipo === tipoAtivo ? "" : tipo });
        },
    }));
    dashHeroVisual.replaceChildren(visual, criarElemento("p", "hero-orbita-dica", "Passe o mouse ou clique numa fatia"));
    // Cartões de tipo: clicar filtra a página; clicar no ativo volta para todos.
    dashTipos.replaceChildren(...ORDEM_CARDS.map((tipo) => {
        const quantidade = registrosDaSelecao.filter((r) => r.tipo === tipo).length;
        const ativo = tipo === tipoAtivo;
        const cartao = criarElemento("button", "tipo-cartao");
        cartao.type = "button";
        cartao.style.setProperty("--cor-tipo", CORES_TIPO[tipo]);
        cartao.setAttribute("aria-pressed", String(ativo));
        cartao.disabled = quantidade === 0 && !ativo;
        cartao.title = ativo ? "Mostrar todos os tipos" : `Focar em ${PLURAL_TIPO[tipo]}`;
        // Hover no cartão acende a fatia correspondente na rosca.
        const fatia = () => dashHeroVisual.querySelector(`path[data-rotulo="${PLURAL_TIPO[tipo]}"]`);
        cartao.addEventListener("mouseenter", () => fatia()?.dispatchEvent(new Event("mouseenter")));
        cartao.addEventListener("mouseleave", () => fatia()?.dispatchEvent(new Event("mouseleave")));
        const icone = criarElemento("span", "tipo-icone");
        icone.append(criarIcone(ICONE_TIPO[tipo]));
        const status = criarElemento("span", "tipo-status");
        status.append(criarElemento("span", "tipo-ponto"), `${quantidade} · ${percentualDe(quantidade, registrosDaSelecao.length)}%`);
        cartao.append(criarIcone("seta-diagonal", "icone tipo-seta"), icone, criarElemento("strong", "tipo-nome", PLURAL_TIPO[tipo]), status, 
        // Chamada para ação explícita: deixa claro que o cartão é um botão.
        criarElemento("span", "tipo-acao", ativo ? "Ver todos os tipos" : "Clique para focar"));
        cartao.addEventListener("click", () => aplicarFiltro({ tipo: ativo ? "" : tipo }));
        return cartao;
    }));
}
// ---------- Gráficos SVG (graficos.ts) ----------
// Barras de série única usam a cor de destaque do tema.
const COR_SERIE = "var(--destaque)";
function agrupar(lista, chaveDe) {
    const grupos = new Map();
    for (const registro of lista) {
        const chave = chaveDe(registro);
        grupos.set(chave, [...(grupos.get(chave) ?? []), registro]);
    }
    // Comparação simples de string (não localeCompare): mantém "~" depois dos dígitos.
    return [...grupos.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}
function segmentosPorTipo(itens) {
    return TIPOS_ITEM.map((tipo) => ({
        rotulo: PLURAL_TIPO[tipo],
        valor: itens.filter((r) => r.tipo === tipo).length,
        cor: CORES_TIPO[tipo],
    }));
}
function criarLegendaTipos() {
    const legenda = criarElemento("div", "legenda");
    for (const tipo of TIPOS_ITEM) {
        const item = criarElemento("span", "legenda-item");
        item.append(criarAmostra(CORES_TIPO[tipo]), tipo);
        legenda.append(item);
    }
    return legenda;
}
// `colunas` é a classe de largura no grid de 12 colunas (ex.: "col-4").
function criarCartaoGrafico(titulo, explicacao, colunas) {
    const cartao = criarElemento("section", `cartao grafico ${colunas}`);
    cartao.append(criarElemento("h2", "", titulo), criarElemento("p", "dica", explicacao), criarElemento("div", "grafico-rolagem"));
    return cartao;
}
// O SVG é desenhado na largura real do cartão, por isso o cartão precisa já estar na página.
function desenhar(cartao, colunas, larguraMinimaColuna) {
    const area = cartao.querySelector(".grafico-rolagem");
    const titulo = cartao.querySelector("h2")?.textContent ?? "";
    area?.replaceChildren(criarGraficoColunas(titulo, colunas, area.clientWidth, larguraMinimaColuna));
}
// "~" ordena depois dos números: itens sem release/sprint ficam por último.
const SEM_RELEASE = "~";
// ---------- Big numbers de volume ----------
// "2,5" (uma casa, vírgula decimal); inteiro fica sem casa: "3".
function formatarMedia(valor) {
    return valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
function maiorGrupo(grupos) {
    return grupos.reduce((maior, grupo) => (!maior || grupo[1].length > maior[1].length ? grupo : maior), undefined);
}
// Ritmo de entrega: médias por release, sprint e mês, e os picos.
// Itens sem release/sprint (registros antigos) ficam fora das médias por release/sprint.
function renderizarNumerosVolume() {
    const comRelease = registrosFiltrados.filter((r) => r.release);
    const comSprint = comRelease.filter((r) => r.sprint);
    const releases = agrupar(comRelease, chaveRelease);
    const sprints = agrupar(comSprint, (r) => `${chaveRelease(r)}-${r.sprint}`);
    const meses = mesesDoGrafico();
    const porMes = meses.map((mes) => [
        mes,
        registrosFiltrados.filter((r) => r.dataFim.startsWith(mes)),
    ]);
    const media = (quantidade, grupos) => (grupos > 0 ? quantidade / grupos : null);
    // Em português, abaixo de 2 o substantivo fica no singular ("1,5 entrega").
    const unidade = (valor) => valor === null ? undefined : valor < 2 ? "entrega" : "entregas";
    const numero = (valor) => (valor === null ? VAZIO : formatarMedia(valor));
    const mediaRelease = media(comRelease.length, releases.length);
    const mediaSprint = media(comSprint.length, sprints.length);
    const mediaMes = media(registrosFiltrados.length, meses.length);
    const sprintPico = maiorGrupo(sprints);
    const mesPico = maiorGrupo(porMes);
    const primeiroDoPico = sprintPico?.[1][0];
    const picoSprint = sprintPico ? sprintPico[1].length : null;
    const picoMes = mesPico && mesPico[1].length > 0 ? mesPico[1].length : null;
    dashNumerosVolume.replaceChildren(criarIndicador("Por release", numero(mediaRelease), {
        icone: "camadas",
        unidade: unidade(mediaRelease),
        complemento: `média em ${plural(releases.length, "release", "releases")} com entrega`,
    }), criarIndicador("Por sprint", numero(mediaSprint), {
        icone: "ciclo",
        unidade: unidade(mediaSprint),
        complemento: `média em ${plural(sprints.length, "sprint", "sprints")} com entrega`,
    }), criarIndicador("Por mês", numero(mediaMes), {
        icone: "calendario",
        unidade: unidade(mediaMes),
        complemento: `média em ${plural(meses.length, "mês", "meses")} do período`,
    }), criarIndicador("Sprint de pico", numero(picoSprint), {
        icone: "pico",
        unidade: unidade(picoSprint),
        complemento: primeiroDoPico ? rotuloReleaseSprint(primeiroDoPico) : "sem sprint informada",
    }), criarIndicador("Mês de pico", numero(picoMes), {
        icone: "barras",
        unidade: unidade(picoMes),
        complemento: mesPico && picoMes !== null ? nomeDoMes(mesPico[0]) : "sem entregas no período",
    }));
}
function criarGraficoBarras(titulo, explicacao, linhas, colunas) {
    const cartao = criarElemento("section", `cartao grafico ${colunas}`);
    cartao.append(criarElemento("h2", "", titulo), criarElemento("p", "dica", explicacao));
    const totais = linhas.map((l) => l.partes.reduce((soma, p) => soma + p.valor, 0));
    const maximo = Math.max(1, ...totais);
    for (const [indice, linha] of linhas.entries()) {
        const total = totais[indice] ?? 0;
        const barra = criarElemento("div", "barra");
        // A largura da barra inteira é proporcional ao maior total do gráfico.
        barra.style.width = `${(total / maximo) * 100}%`;
        for (const parte of linha.partes) {
            if (parte.valor === 0)
                continue;
            const segmento = criarElemento("span", `barra-parte ${parte.classe}`);
            segmento.style.flexGrow = parte.valor.toString();
            segmento.title = `${linha.rotulo} · ${parte.rotulo}: ${parte.valor}`;
            barra.append(segmento);
        }
        const trilho = criarElemento("div", "barra-trilho");
        trilho.append(barra, criarElemento("span", "barra-valor", total.toString()));
        const item = criarElemento("div", "barra-linha");
        item.append(criarElemento("span", "barra-rotulo", linha.rotulo), trilho);
        cartao.append(item);
    }
    return cartao;
}
function barrasSimples(lista, valores) {
    return comExtras(lista, valores).map((rotulo) => ({
        rotulo,
        partes: [{ rotulo: "Entregas", valor: valores.filter((v) => v === rotulo).length, classe: "serie" }],
    }));
}
// ---------- Grid de gráficos ----------
// ---------- Entregas por camada ----------
// Cor e ícone de cada camada (mesma ordem de CAMADAS em config.ts).
const ESTILO_CAMADA = {
    Backend: { cor: "var(--okr-1)", icone: "servidor" },
    Frontend: { cor: "var(--okr-4)", icone: "monitor" },
    Database: { cor: "var(--okr-3)", icone: "banco" },
    Infra: { cor: "var(--okr-2)", icone: "nuvem" },
};
// Os mais frequentes de uma lista com repetição ("ECS · SQS · Lambda").
function maisFrequentes(valores, quantos) {
    const contagem = new Map();
    for (const valor of valores)
        contagem.set(valor, (contagem.get(valor) ?? 0) + 1);
    return [...contagem]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, quantos)
        .map(([valor]) => valor);
}
function criarCartaoCamada(camada, itens, total) {
    const { cor, icone } = ESTILO_CAMADA[camada];
    const cartao = criarElemento("article", itens.length === 0 ? "camada-cartao vazio" : "camada-cartao");
    cartao.style.setProperty("--cor-camada", cor);
    const topo = criarElemento("div", "camada-topo");
    const badge = criarElemento("span", "camada-icone");
    badge.append(criarIcone(icone));
    const nome = criarElemento("div");
    nome.append(criarElemento("strong", "", camada), criarElemento("span", "dica", `${percentualDe(itens.length, total)}% da seleção`));
    topo.append(badge, nome, criarMedidorAnel(`Entregas em ${camada}`, percentualDe(itens.length, total), cor));
    const numero = criarElemento("div", "camada-numero");
    numero.append(criarElemento("strong", "", itens.length.toString()), criarElemento("span", "dica", itens.length === 1 ? "entrega" : "entregas"));
    cartao.append(topo, numero);
    if (itens.length === 0)
        return cartao;
    // Barra empilhada por tipo de item, nas cores fixas dos tipos.
    const barra = criarElemento("div", "camada-barra");
    for (const tipo of ORDEM_CARDS) {
        const quantidade = itens.filter((r) => r.tipo === tipo).length;
        if (quantidade === 0)
            continue;
        const parte = criarElemento("span");
        parte.style.flex = `${quantidade} 1 0`;
        parte.style.background = CORES_TIPO[tipo];
        parte.title = `${tipo}: ${quantidade}`;
        barra.append(parte);
    }
    cartao.append(barra);
    const destaques = [
        ["Serviços AWS", maisFrequentes(itens.flatMap((r) => r.servicosAws), 3)],
        ["Microsserviços", maisFrequentes(itens.flatMap((r) => r.microsservicos), 3)],
    ];
    for (const [rotulo, valores] of destaques) {
        if (valores.length === 0)
            continue;
        const linha = criarElemento("div", "camada-destaque");
        linha.append(criarElemento("span", "dica", rotulo), ...valores.map((valor) => criarElemento("span", "etiqueta", valor)));
        cartao.append(linha);
    }
    return cartao;
}
function criarPainelCamadas() {
    const cartao = criarElemento("section", "cartao grafico col-12 camadas");
    const semCamada = registrosFiltrados.filter((r) => r.camadas.length === 0).length;
    cartao.append(criarElemento("h2", "", "Entregas por camada"), criarElemento("p", "dica", "Em que parte do sistema as entregas mexeram. Uma entrega pode contar em mais de uma camada; a barra mostra os tipos de item." +
        (semCamada > 0 ? ` ${plural(semCamada, "entrega não tem", "entregas não têm")} camada informada.` : "")));
    const grade = criarElemento("div", "camadas-grade");
    grade.append(...CAMADAS.map((camada) => criarCartaoCamada(camada, registrosFiltrados.filter((r) => r.camadas.includes(camada)), registrosFiltrados.length)));
    cartao.append(grade, criarLegendaTipos());
    return cartao;
}
const GRANULARIDADES = [
    ["mes", "Mensal"],
    ["sprint", "Por sprint"],
    ["release", "Por release"],
];
// Fica entre renderizações (como `busca`): trocar filtro não volta para "Mensal".
let granularidadeRitmo = "mes";
// Maior grau de impacto da entrega entre todos os OKRs dela (null = sem grau).
// Cada entrega conta numa só linha de grau, então Alto + Médio + Baixo = entregas com grau.
function maiorGrau(registro) {
    return GRAUS_DECRESCENTES.find((grau) => registro.okrs.some((o) => o.grau === grau)) ?? null;
}
const SERIES_RITMO = [
    { rotulo: "Entregas", cor: "var(--serie-a)", incluir: () => true },
    { rotulo: "Impacto alto", cor: "var(--serie-b)", incluir: (r) => maiorGrau(r) === "Alto" },
    { rotulo: "Impacto médio", cor: "var(--serie-c)", incluir: (r) => maiorGrau(r) === "Médio" },
    { rotulo: "Impacto baixo", cor: "var(--serie-d)", incluir: (r) => maiorGrau(r) === "Baixo" },
];
// Pontos do eixo X na granularidade escolhida, cada um com as entregas dele.
// A seção PDI (pdi-dashboard.ts) usa o mesmo agrupamento com as entregas ligadas ao PDI.
function pontosDoRitmo(lista = registrosFiltrados, granularidade = granularidadeRitmo) {
    if (granularidade === "mes") {
        const meses = mesesDoGrafico();
        return {
            rotulos: meses.map((mes) => rotuloMes(mes).replace("/20", "/")),
            titulos: meses.map(rotuloMes),
            grupos: meses.map((mes) => lista.filter((r) => r.dataFim.startsWith(mes))),
        };
    }
    const porSprint = granularidade === "sprint";
    const grupos = agrupar(lista.filter((r) => r.release && (!porSprint || r.sprint)), (r) => (porSprint ? `${chaveRelease(r)}-${r.sprint}` : chaveRelease(r))).map(([, itens]) => itens);
    const primeiro = (itens) => itens[0];
    return {
        rotulos: grupos.map((itens) => {
            const r = primeiro(itens);
            return r ? (porSprint ? `R${r.release}·S${r.sprint}` : `R${r.release}/${anoDe(r).slice(2)}`) : "";
        }),
        titulos: grupos.map((itens) => {
            const r = primeiro(itens);
            return r ? (porSprint ? rotuloReleaseSprint(r) : rotuloRelease(r)) : "";
        }),
        grupos,
    };
}
function criarCartaoRitmo() {
    const cartao = criarElemento("section", "cartao grafico col-12 ritmo");
    const cabecalho = criarElemento("div", "ritmo-cabecalho");
    const textos = criarElemento("div");
    textos.append(criarElemento("h2", "", "Ritmo de entregas"), criarElemento("p", "dica", "Total entregue e quanto dele impactou OKRs, por grau. Cada entrega conta pelo maior grau que teve."));
    const abas = criarElemento("div", "abas-texto");
    abas.setAttribute("role", "group");
    abas.ariaLabel = "Granularidade";
    for (const [valor, rotulo] of GRANULARIDADES) {
        const aba = criarBotao(rotulo, "aba-texto", () => {
            granularidadeRitmo = valor;
            renderizarGraficos();
        });
        aba.setAttribute("aria-pressed", String(valor === granularidadeRitmo));
        abas.append(aba);
    }
    cabecalho.append(textos, abas);
    const legenda = criarElemento("div", "legenda");
    for (const { rotulo, cor } of SERIES_RITMO) {
        const item = criarElemento("span", "legenda-item");
        item.append(criarAmostra(cor), rotulo);
        legenda.append(item);
    }
    cartao.append(cabecalho, criarElemento("div", "grafico-rolagem"), legenda);
    return cartao;
}
function desenharRitmo(cartao) {
    const area = cartao.querySelector(".grafico-rolagem");
    if (!area)
        return;
    const { rotulos, titulos, grupos } = pontosDoRitmo();
    if (rotulos.length === 0) {
        area.replaceChildren(criarElemento("p", "estado-vazio", "Sem release/sprint informada nas entregas da seleção."));
        return;
    }
    area.replaceChildren(criarGraficoLinhas("Ritmo de entregas", rotulos, titulos, SERIES_RITMO.map(({ rotulo, cor, incluir }) => ({
        rotulo,
        cor,
        valores: grupos.map((grupo) => grupo.filter(incluir).length),
    })), area.clientWidth));
}
// ---------- Grid de gráficos ----------
const grauDe = (o) => o.grau ?? GRAU_NAO_INFORMADO;
const classeDoNomeDoGrau = (grau) => pertence(GRAUS_IMPACTO, grau) ? CLASSE_GRAU[grau] : "grau-indefinido";
// Ordem e larguras no grid de 12 colunas, por seção:
//   Volumetria: ritmo (12) / por release (6) | evolução mensal (6) / por sprint (12)
//   Impacto:    painel de OKRs (fora do grid) / por grau (6) | por squad (6)
function renderizarGraficos() {
    const ritmo = criarCartaoRitmo();
    const porRelease = criarCartaoGrafico("Volumetria por release", "Itens entregues em cada release, por tipo de item.", "col-6");
    const porMes = criarCartaoGrafico("Evolução mensal", "Total de itens entregues em cada mês.", "col-6");
    const porSprint = criarCartaoGrafico("Volumetria por sprint", "Itens entregues em cada sprint, agrupadas por release, por tipo de item.", "col-12");
    porRelease.append(criarLegendaTipos());
    porSprint.append(criarLegendaTipos());
    const impactos = registrosFiltrados.flatMap((r) => r.okrs);
    // "Não informado" só aparece se houver registro antigo sem grau.
    const graus = comExtras(GRAUS_IMPACTO, impactos.map(grauDe));
    const porGrau = criarGraficoBarras("Impactos por grau", "Quantas vezes uma entrega impactou um OKR em cada grau, somando todos os OKRs.", graus.map((grau) => ({
        rotulo: grau,
        partes: [
            {
                rotulo: "Impactos",
                valor: impactos.filter((o) => grauDe(o) === grau).length,
                classe: classeDoNomeDoGrau(grau),
            },
        ],
    })), "col-6");
    const porSquad = criarGraficoBarras("Entregas por squad", "Quantidade de entregas de cada squad.", barrasSimples(squadsDisponiveis(), registrosFiltrados.map((r) => r.squad)), "col-6");
    // Camada e serviços AWS: uma entrega pode contar em mais de um (ex.: backend e database).
    const porCamada = criarPainelCamadas();
    const usosAws = registrosFiltrados.flatMap((r) => r.servicosAws);
    const servicosUsados = [...new Set(usosAws)]
        .map((servico) => ({ servico, total: usosAws.filter((s) => s === servico).length }))
        .sort((a, b) => b.total - a.total || a.servico.localeCompare(b.servico))
        .slice(0, 10);
    const porServicoAws = criarGraficoBarras("Serviços AWS mais envolvidos", servicosUsados.length > 0
        ? "Quantas entregas mexeram em cada serviço (os 10 mais frequentes)."
        : "Nenhuma entrega da seleção tem serviço AWS informado.", servicosUsados.map(({ servico, total }) => ({
        rotulo: servico,
        partes: [{ rotulo: "Entregas", valor: total, classe: "serie" }],
    })), "col-12");
    dashGraficosVolume.replaceChildren(ritmo, porRelease, porMes, porSprint, porCamada, porServicoAws);
    dashGraficosImpacto.replaceChildren(porGrau, porSquad);
    desenharRitmo(ritmo);
    desenhar(porRelease, agrupar(registrosFiltrados, (r) => chaveRelease(r) || SEM_RELEASE).map(([, itens]) => {
        const rotulo = itens[0] ? rotuloRelease(itens[0]) : "";
        return { rotulo, titulo: rotulo, segmentos: segmentosPorTipo(itens) };
    }), 84);
    desenhar(porSprint, agrupar(registrosFiltrados, (r) => r.release && r.sprint ? `${chaveRelease(r)}-${r.sprint}` : SEM_RELEASE).map(([chave, itens]) => {
        const primeiro = itens[0];
        const semSprint = chave === SEM_RELEASE || !primeiro;
        return {
            rotulo: semSprint ? VAZIO : `S${primeiro.sprint}`,
            titulo: primeiro ? rotuloReleaseSprint(primeiro) : "",
            grupo: semSprint ? "Sem sprint" : rotuloRelease(primeiro),
            segmentos: segmentosPorTipo(itens),
        };
    }));
    desenhar(porMes, mesesDoGrafico().map((mes) => ({
        // Rótulo curto ("ago/26") para caber mais meses; o tooltip mostra o ano completo.
        rotulo: rotuloMes(mes).replace("/20", "/"),
        titulo: rotuloMes(mes),
        segmentos: [
            {
                rotulo: "Itens entregues",
                valor: registrosFiltrados.filter((r) => r.dataFim.startsWith(mes)).length,
                cor: COR_SERIE,
            },
        ],
    })), 52);
}
// ---------- Impacto nos OKRs (painel interativo) ----------
// Peso de cada grau para a "intensidade média" (de 1 a 3).
const PESO_GRAU = { Baixo: 1, Médio: 2, Alto: 3 };
// Do mais forte para o mais fraco: é a ordem em que o gestor quer ler.
const GRAUS_DECRESCENTES = [...GRAUS_IMPACTO].reverse();
// Seleção do painel: ficam entre renderizações enquanto fizerem sentido.
let okrSelecionado = "";
let grauSelecionado = "";
// A lista do detalhe mostra 6 entregas por vez; "Exibir mais" soma outras 6.
const LINHAS_POR_PAGINA = 6;
let limiteLinhasOkr = LINHAS_POR_PAGINA;
function intensidadeMedia(itens) {
    const pesos = itens.flatMap(({ impacto }) => (impacto.grau ? [PESO_GRAU[impacto.grau]] : []));
    return pesos.length > 0 ? pesos.reduce((soma, peso) => soma + peso, 0) / pesos.length : null;
}
function nomeDaIntensidade(media) {
    return media >= 2.5 ? "Alto" : media >= 1.5 ? "Médio" : "Baixo";
}
// Três barrinhas, acesas até a intensidade média (arredondada).
function criarMedidorIntensidade(media) {
    const medidor = criarElemento("div", "intensidade");
    const barras = criarElemento("span", "intensidade-barras");
    const acesas = media === null ? 0 : Math.round(media);
    for (let nivel = 1; nivel <= 3; nivel++) {
        barras.append(criarElemento("span", nivel <= acesas ? "acesa" : ""));
    }
    const texto = media === null
        ? "Intensidade: sem grau informado"
        : `Intensidade média: ${nomeDaIntensidade(media).toLowerCase()} (${formatarMedia(media)} de 3)`;
    medidor.append(barras, criarElemento("span", "", texto));
    return medidor;
}
// Mesmo desenho dos cartões de entrega: capa ilustrada (aqui, um alvo) e os
// números abaixo. Clicar abre o detalhe do OKR.
function criarCartaoOkr(okr, indice, doOkr, total) {
    const selecionado = okr === okrSelecionado;
    const semEntregas = doOkr.length === 0;
    const cartao = criarBotao("", "okr-cartao", () => {
        okrSelecionado = okr;
        grauSelecionado = "";
        limiteLinhasOkr = LINHAS_POR_PAGINA;
        renderizarOkrs();
        el("dash-okr-detalhe").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    cartao.style.setProperty("--cor-tipo", CORES_OKR[indice % CORES_OKR.length] ?? "var(--destaque)");
    const titulo = okrDe(okr)?.titulo.trim();
    const objetivo = okrDe(okr)?.objetivo.trim();
    cartao.setAttribute("aria-pressed", String(selecionado));
    cartao.disabled = semEntregas;
    const capa = criarElemento("span", "entrega-capa capa-okr");
    capa.append(criarElemento("span", "etiqueta etiqueta-tipo", `OKR ${okr}`), criarIcone("seta-diagonal", "icone tipo-seta"), criarIcone("objetivo", "icone capa-icone"));
    const numero = criarElemento("div", "okr-numero");
    numero.append(criarElemento("strong", "", doOkr.length.toString()), criarElemento("span", "dica", `${doOkr.length === 1 ? "entrega impacta" : "entregas impactam"} · ${percentualDe(doOkr.length, total)}% da seleção`));
    // Barra empilhada por grau + linhas com quantidade e % de cada grau.
    const graus = comExtras(GRAUS_DECRESCENTES, doOkr.map(({ impacto }) => grauDe(impacto)));
    const barra = criarElemento("div", "okr-barra");
    const linhas = criarElemento("div", "okr-graus");
    for (const grau of graus) {
        const quantidade = doOkr.filter(({ impacto }) => grauDe(impacto) === grau).length;
        if (quantidade > 0) {
            const parte = criarElemento("span", classeDoNomeDoGrau(grau));
            parte.style.flex = `${quantidade} 1 0`;
            parte.title = `${grau}: ${quantidade}`;
            barra.append(parte);
        }
        const linha = criarElemento("div", "okr-grau-linha");
        linha.append(criarElemento("span", `grau ${classeDoNomeDoGrau(grau)}`, grau), criarElemento("strong", "", quantidade.toString()), criarElemento("span", "dica", `${percentualDe(quantidade, doOkr.length)}%`));
        linhas.append(linha);
    }
    const info = criarElemento("span", "okr-info");
    info.append(...(objetivo ? [criarElemento("span", "okr-objetivo", objetivo)] : []), criarElemento("strong", "okr-nome", titulo || `OKR ${okr}`), ...(titulo ? [criarElemento("span", "okr-titulo", `OKR ${okr}`)] : []), numero, barra, linhas, criarMedidorIntensidade(intensidadeMedia(doOkr)), criarElemento("span", "tipo-acao", semEntregas ? "Sem entregas na seleção" : selecionado ? "Em detalhe abaixo ↓" : "Clique para ver as entregas"));
    cartao.append(capa, info);
    return cartao;
}
function criarDetalheOkr(okr, doOkr) {
    const painel = criarElemento("section", "okr-detalhe");
    painel.id = "dash-okr-detalhe";
    const cabecalho = criarElemento("div", "okr-detalhe-cabecalho");
    const titulo = criarElemento("div");
    titulo.append(criarElemento("h3", "", `Como as entregas impactam o ${rotuloOkr(okr)}`), criarElemento("p", "dica", "Cada linha é uma entrega: o grau diz o quanto ela move o OKR, o motivo diz por quê. Clique para abrir a entrega."));
    // Quantas entregas em cada KR (e no OKR como um todo), na ordem do cadastro.
    const krs = comExtras(okrDe(okr)?.krs.map((k) => k.codigo) ?? [], doOkr.flatMap(({ impacto }) => (impacto.kr ? [impacto.kr] : [])));
    const porKr = criarElemento("div", "okr-krs");
    for (const kr of [...krs, ""]) {
        const quantidade = doOkr.filter(({ impacto }) => (impacto.kr ?? "") === kr).length;
        if (!kr && quantidade === 0)
            continue;
        const item = criarElemento("span", quantidade === 0 ? "etiqueta zerado" : "etiqueta");
        item.title = rotuloKr(okr, kr || null);
        item.append(`${kr || "OKR como um todo"} `, criarElemento("strong", "", quantidade.toString()));
        porKr.append(item);
    }
    if (krs.length > 0)
        titulo.append(porKr);
    const graus = comExtras(GRAUS_DECRESCENTES, doOkr.map(({ impacto }) => grauDe(impacto)));
    const chips = criarElemento("div", "segmentado");
    chips.setAttribute("role", "group");
    chips.ariaLabel = "Filtrar por grau de impacto";
    renderizarChips(chips, [
        ["Todos", "", doOkr.length.toString()],
        ...graus.map((grau) => [
            grau,
            grau,
            doOkr.filter(({ impacto }) => grauDe(impacto) === grau).length.toString(),
        ]),
    ], grauSelecionado, (grau) => {
        grauSelecionado = grau;
        limiteLinhasOkr = LINHAS_POR_PAGINA;
        renderizarOkrs();
    });
    cabecalho.append(titulo, chips);
    // Mais forte primeiro; dentro do mesmo grau, a mais recente primeiro.
    const peso = ({ impacto }) => (impacto.grau ? PESO_GRAU[impacto.grau] : 0);
    const visiveis = doOkr
        .filter(({ impacto }) => !grauSelecionado || grauDe(impacto) === grauSelecionado)
        .sort((a, b) => peso(b) - peso(a) || b.registro.dataFim.localeCompare(a.registro.dataFim));
    const lista = criarElemento("div", "okr-lista");
    for (const { registro, impacto } of visiveis.slice(0, limiteLinhasOkr)) {
        const linha = criarBotao("", "okr-linha", () => abrirDetalhesEntrega(registro));
        linha.style.setProperty("--cor-tipo", CORES_TIPO[registro.tipo]);
        const grau = criarElemento("div", "okr-linha-grau");
        grau.append(criarElemento("span", `grau ${classeDoGrau(impacto.grau)}`, impacto.grau ?? "Sem grau"));
        const corpo = criarElemento("div", "okr-linha-corpo");
        const meta = criarElemento("div", "okr-linha-meta");
        meta.append(criarElemento("span", "etiqueta etiqueta-tipo", registro.tipo), ...(impacto.kr ? [criarElemento("span", "etiqueta okr-kr", rotuloKr(okr, impacto.kr))] : []), criarElemento("span", "dica", `${rotuloReleaseSprint(registro)} · ${registro.squad} · ${formatarData(registro.dataFim)}`));
        const motivo = criarElemento("p", "okr-linha-motivo");
        motivo.append(criarElemento("strong", "", "Motivo: "), impacto.motivo || "não informado.");
        corpo.append(meta, criarElemento("strong", "okr-linha-assunto", registro.assunto), motivo);
        linha.append(grau, corpo, criarIcone("seta-diagonal", "icone okr-linha-seta"));
        lista.append(linha);
    }
    if (visiveis.length === 0) {
        lista.append(criarElemento("p", "estado-vazio", `Nenhuma entrega com impacto ${grauSelecionado.toLowerCase()} neste OKR.`));
    }
    painel.append(cabecalho, lista);
    // Rodapé: quantas aparecem e o botão para ver mais (ou recolher, quando tudo já aparece).
    if (visiveis.length > LINHAS_POR_PAGINA) {
        const exibidas = Math.min(limiteLinhasOkr, visiveis.length);
        const restantes = visiveis.length - exibidas;
        const rodape = criarElemento("div", "okr-lista-rodape");
        rodape.append(criarElemento("span", "dica", `Mostrando ${exibidas} de ${visiveis.length}`), restantes > 0
            ? criarBotao(`Exibir mais (${Math.min(restantes, LINHAS_POR_PAGINA)})`, "secundario", () => {
                limiteLinhasOkr += LINHAS_POR_PAGINA;
                renderizarOkrs();
            })
            : criarBotao("Exibir menos", "secundario", () => {
                limiteLinhasOkr = LINHAS_POR_PAGINA;
                renderizarOkrs();
                el("dash-okr-detalhe").scrollIntoView({ behavior: "smooth", block: "start" });
            }));
        painel.append(rodape);
    }
    return painel;
}
// Um cartão por OKR (quanto e com que intensidade) e, abaixo, o detalhe do
// OKR escolhido: cada entrega com o grau e o motivo do impacto.
function renderizarOkrs() {
    const impactos = registrosFiltrados.flatMap((registro) => registro.okrs.map((impacto) => ({ registro, impacto })));
    const okrs = comExtras(okrsDisponiveis(), impactos.map(({ impacto }) => impacto.okr));
    const doOkr = (okr) => impactos.filter(({ impacto }) => impacto.okr === okr);
    // A seleção pode ter ficado sem entregas depois de um filtro: vai para o primeiro com impacto.
    if (doOkr(okrSelecionado).length === 0) {
        okrSelecionado = okrs.find((okr) => doOkr(okr).length > 0) ?? "";
        grauSelecionado = "";
        limiteLinhasOkr = LINHAS_POR_PAGINA;
    }
    const cartoes = criarElemento("div", "okr-cartoes");
    cartoes.append(...okrs.map((okr, indice) => criarCartaoOkr(okr, indice, doOkr(okr), registrosFiltrados.length)));
    dashOkrs.replaceChildren(cartoes, okrSelecionado
        ? criarDetalheOkr(okrSelecionado, doOkr(okrSelecionado))
        : criarElemento("p", "estado-vazio", "Nenhuma entrega da seleção impactou OKRs."));
}
// ---------- Entregas em detalhe ----------
function adicionarDetalhe(lista, rotulo, valor) {
    const item = criarElemento("div", "detalhe");
    const conteudo = criarElemento("dd");
    conteudo.append(valor);
    item.append(criarElemento("dt", "", rotulo), conteudo);
    lista.append(item);
}
function criarSecaoEntrega(titulo, conteudo) {
    const secao = criarElemento("section", "entrega-secao");
    secao.append(criarElemento("h5", "", titulo), conteudo);
    return secao;
}
function criarChipOkr(impacto) {
    const kr = impacto.kr ? ` · ${impacto.kr}` : "";
    const chip = criarElemento("span", `grau ${classeDoGrau(impacto.grau)}`, `OKR ${impacto.okr}${kr} · ${impacto.grau ?? "s/ grau"}`);
    chip.title = `${rotuloOkr(impacto.okr)} · ${rotuloKr(impacto.okr, impacto.kr)}`;
    return chip;
}
// Classe da capa de cada tipo: muda a textura de fundo (ver style.css).
const CLASSE_CAPA = {
    História: "capa-historia",
    Bug: "capa-bug",
    Task: "capa-task",
    Oportunidade: "capa-oportunidade",
    Discovery: "capa-discovery",
};
// Capa ilustrada do cartão: textura + ícone grande do tipo, como a imagem de um portfólio.
function criarCapaEntrega(registro) {
    const capa = criarBotao("", `entrega-capa ${CLASSE_CAPA[registro.tipo]}`, () => abrirDetalhesEntrega(registro));
    capa.ariaLabel = `Ver detalhes: ${registro.assunto}`;
    capa.append(criarElemento("span", "etiqueta etiqueta-tipo", registro.tipo), criarElemento("span", "capa-data", formatarData(registro.dataFim)), criarIcone(ICONE_TIPO[registro.tipo], "icone capa-icone"));
    if (registro.impeditivo)
        capa.append(criarElemento("span", "etiqueta etiqueta-alerta capa-alerta", "Impeditivo"));
    return capa;
}
// Cartão da grade: capa por tipo e, abaixo, "o quê, quando e para qual OKR".
// O restante dos campos fica no modal (abrirDetalhesEntrega).
function criarCartaoEntrega(registro) {
    const cartao = criarElemento("article", "entrega");
    cartao.style.setProperty("--cor-tipo", CORES_TIPO[registro.tipo]);
    const chips = criarElemento("div", "entrega-chips");
    chips.append(criarElemento("span", "etiqueta", rotuloReleaseSprint(registro)), criarElemento("span", "etiqueta", registro.squad), ...registro.okrs.map(criarChipOkr), ...registro.camadas.map((camada) => criarElemento("span", "etiqueta etiqueta-camada", camada)), ...registro.servicosAws.map((servico) => criarElemento("span", "etiqueta etiqueta-aws", servico)));
    const rodape = criarElemento("div", "entrega-rodape");
    rodape.append(criarElemento("span", "dica", `Lead time: ${plural(leadTimeEmDias(registro), "dia", "dias")}`), criarBotao("Ver detalhes", "link", () => abrirDetalhesEntrega(registro)));
    const info = criarElemento("div", "entrega-info");
    info.append(criarElemento("h4", "", registro.assunto), criarElemento("p", "entrega-descricao", registro.descricao), chips, rodape);
    cartao.append(criarCapaEntrega(registro), info);
    return cartao;
}
// Modal no mesmo visual da seção de abertura (hero): linhas-guia, sobretítulo,
// título grande, resumo, mini destaques e um "visual" pulsando na cor do tipo.
function abrirDetalhesEntrega(registro) {
    const { historia, gmud, git } = registro;
    dashModalConteudo.style.setProperty("--cor-tipo", CORES_TIPO[registro.tipo]);
    const linhasGuia = criarElemento("div", "hero-linhas");
    linhasGuia.setAttribute("aria-hidden", "true");
    linhasGuia.append(criarElemento("span"), criarElemento("span"));
    const fechar = criarBotao("\u00d7", "modal-fechar", () => dashModal.close());
    fechar.setAttribute("aria-label", "Fechar");
    // ----- Topo (hero) -----
    const titulo = criarElemento("h2", "modal-titulo", registro.assunto);
    titulo.id = "modal-titulo";
    const minis = criarElemento("div", "hero-minis modal-minis");
    minis.append(criarMiniDestaque("relogio", "Lead time", plural(leadTimeEmDias(registro), "dia", "dias")), criarMiniDestaque("calendario", "Período", `${formatarData(registro.dataInicio)} – ${formatarData(registro.dataFim)}`), criarMiniDestaque("camadas", "Release · Sprint", rotuloReleaseSprint(registro)), criarMiniDestaque("grade", "Squad", registro.squad));
    const texto = criarElemento("div", "modal-hero-texto");
    texto.append(criarElemento("span", "hero-sobretitulo", `${registro.tipo} · concluída em ${formatarData(registro.dataFim)}`), titulo, criarElemento("p", "hero-resumo", registro.descricao), minis);
    const visual = criarElemento("div", "modal-orbita");
    visual.setAttribute("aria-hidden", "true");
    visual.append(criarIcone(ICONE_TIPO[registro.tipo], "icone modal-orbita-icone"));
    const topo = criarElemento("div", "modal-hero-topo");
    topo.append(texto, visual);
    // ----- Corpo -----
    const corpo = criarElemento("div", "modal-corpo");
    if (registro.okrs.length > 0) {
        const okrs = criarElemento("ul", "entrega-okrs");
        for (const impacto of registro.okrs) {
            const item = criarElemento("li");
            const tituloOkr = criarElemento("div", "entrega-okr-titulo");
            tituloOkr.append(criarElemento("strong", "", rotuloOkr(impacto.okr)), ...(impacto.kr ? [criarElemento("span", "etiqueta", rotuloKr(impacto.okr, impacto.kr))] : []), criarElemento("span", `grau ${classeDoGrau(impacto.grau)}`, impacto.grau ? `Impacto ${impacto.grau.toLowerCase()}` : "Grau não informado"));
            const motivo = criarElemento("p");
            motivo.append(criarElemento("strong", "", "Motivo: "), impacto.motivo || "não informado.");
            item.append(tituloOkr, motivo);
            okrs.append(item);
        }
        corpo.append(criarSecaoEntrega("OKRs impactados", okrs));
    }
    // Só aparece quando houve: o modal mostra o que existe, não campos vazios.
    if (registro.impeditivo) {
        corpo.append(criarSecaoEntrega("Impeditivo", criarElemento("p", "entrega-impeditivo", registro.impeditivo)));
    }
    const detalhes = criarElemento("dl", "detalhes");
    if (registro.siglas.length > 0)
        adicionarDetalhe(detalhes, "Siglas", registro.siglas.join(", "));
    if (registro.camadas.length > 0)
        adicionarDetalhe(detalhes, "Camadas", registro.camadas.join(", "));
    if (registro.servicosAws.length > 0)
        adicionarDetalhe(detalhes, "Serviços AWS", registro.servicosAws.join(", "));
    if (registro.microsservicos.length > 0)
        adicionarDetalhe(detalhes, "Microsserviços", registro.microsservicos.join(", "));
    if (historia) {
        adicionarDetalhe(detalhes, "Classificação", historia.funcional ? "Funcional" : "Não funcional");
        if (historia.funcional)
            adicionarDetalhe(detalhes, "BCP-Score", historia.bcp);
    }
    if (gmud)
        adicionarDetalhe(detalhes, "GMUD", rotuloGmud(gmud));
    adicionarDetalhe(detalhes, "Alteração em Git", git ? "Sim" : "Não");
    corpo.append(criarSecaoEntrega("Ficha", detalhes));
    const links = criarElemento("div", "entrega-links");
    if (gmud?.link)
        links.append(criarLink(gmud.link, `GMUD ${gmud.nome}`));
    if (gmud?.evidencias)
        links.append(criarLink(gmud.evidencias, "Evidências da GMUD"));
    if (git?.linkPullRequest)
        links.append(criarLink(git.linkPullRequest, "Pull Request"));
    if (git?.linkActions)
        links.append(criarLink(git.linkActions, "Deploy (Actions)"));
    if (links.childElementCount > 0)
        corpo.append(criarSecaoEntrega("Links", links));
    dashModalConteudo.replaceChildren(linhasGuia, fechar, topo, corpo);
    dashModal.showModal();
    dashModalConteudo.scrollTop = 0;
    fechar.focus();
}
// "2026-10" -> "Outubro de 2026"
function nomeDoMes(mes) {
    const [ano, numero] = mes.split("-");
    const nome = new Date(Number(ano), Number(numero) - 1, 1).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
    });
    return nome.charAt(0).toUpperCase() + nome.slice(1);
}
// ---------- Busca ----------
// Fica fora de `filtros`: só restringe a lista de entregas, não os números da página.
let busca = "";
// Minúsculas e sem acento: "Histórico" encontra "historico".
function normalizar(texto) {
    return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}
function textoPesquisavel(registro) {
    const { historia, gmud } = registro;
    return normalizar([
        registro.tipo,
        registro.assunto,
        registro.descricao,
        registro.squad,
        ...registro.siglas,
        ...registro.camadas,
        ...registro.servicosAws,
        ...registro.microsservicos,
        historia?.funcional ? historia.bcp : "",
        gmud?.nome ?? "",
        gmud?.titulo ?? "",
        registro.impeditivo,
        rotuloReleaseSprint(registro),
        ...registro.okrs.map((o) => `OKR ${o.okr} ${o.kr ?? ""} ${o.motivo}`),
    ].join(" "));
}
// Cada palavra digitada precisa aparecer em algum campo (em qualquer ordem).
function passaNaBusca(registro) {
    const termos = normalizar(busca).split(/\s+/).filter(Boolean);
    if (termos.length === 0)
        return true;
    const texto = textoPesquisavel(registro);
    return termos.every((termo) => texto.includes(termo));
}
// Atalho de tipo ao lado da busca; é o mesmo filtro dos cartões do hero.
function renderizarTiposDaBusca() {
    renderizarChips(dashBuscaTipos, [
        ["Todos", ""],
        ...ORDEM_CARDS.filter((tipo) => registrosDaSelecao.some((r) => r.tipo === tipo)).map((tipo) => [PLURAL_TIPO[tipo], tipo]),
    ], filtros.tipo, (tipo) => aplicarFiltro({ tipo }));
}
function renderizarEntregas() {
    // Entregas mais recentes primeiro, como na tabela de edição.
    const encontrados = registrosFiltrados
        .filter(passaNaBusca)
        .sort((a, b) => b.dataFim.localeCompare(a.dataFim));
    const inicios = encontrados.map((r) => r.dataInicio).sort();
    const primeiroInicio = inicios[0];
    const ultimoFim = encontrados[0]?.dataFim;
    const periodo = primeiroInicio && ultimoFim ? ` entre ${formatarData(primeiroInicio)} e ${formatarData(ultimoFim)}` : "";
    dashPeriodo.textContent = busca.trim()
        ? `${encontrados.length} de ${plural(registrosFiltrados.length, "entrega", "entregas")} para "${busca.trim()}"${periodo}`
        : `${plural(encontrados.length, "entrega", "entregas")}${periodo}`;
    if (encontrados.length === 0) {
        dashEntregas.replaceChildren(criarElemento("p", "estado-vazio", `Nenhuma entrega encontrada para "${busca.trim()}". Tente outra palavra.`));
        return;
    }
    // Um grupo por mês de conclusão, com os cartões lado a lado; `encontrados` já deixa os meses em ordem.
    const grupos = [];
    for (const [mes, itens] of agruparPorMes(encontrados)) {
        const grupo = criarElemento("section", "entregas-mes");
        const titulo = criarElemento("h3", "", nomeDoMes(mes));
        titulo.append(criarElemento("span", "dica", plural(itens.length, "entrega", "entregas")));
        const grade = criarElemento("div", "entregas-grade");
        grade.append(...itens.map(criarCartaoEntrega));
        grupo.append(titulo, grade);
        grupos.push(grupo);
    }
    dashEntregas.replaceChildren(...grupos);
}
function agruparPorMes(lista) {
    const meses = new Map();
    for (const registro of lista) {
        const mes = registro.dataFim.slice(0, 7);
        meses.set(mes, [...(meses.get(mes) ?? []), registro]);
    }
    return meses;
}
// ---------- Dashboard ----------
function renderizarDashboard() {
    // Os dados podem ter mudado na aba de edição: refaz as opções de release.
    renderizarFiltros();
    // Os filtros se combinam (E lógico), do mais amplo (ano) ao mais fino (sprint).
    registrosDaSelecao = registrosNoFoco().filter((r) => (!filtros.ano || anoDe(r) === filtros.ano) &&
        (!filtros.release || r.release === filtros.release) &&
        (!filtros.sprint || r.sprint === filtros.sprint));
    // O tipo escolhido pode ter sumido da seleção ao mudar outro filtro: volta para todos.
    if (filtros.tipo && !registrosDaSelecao.some((r) => r.tipo === filtros.tipo))
        filtros.tipo = "";
    registrosFiltrados = filtros.tipo ? registrosDaSelecao.filter((r) => r.tipo === filtros.tipo) : registrosDaSelecao;
    const total = registrosFiltrados.length;
    const descricao = descricaoDosFiltros();
    // Primeira letra maiúscula: "últimos 3 meses, 4 entregas" -> "Últimos 3 meses, 4 entregas".
    const resumo = `${descricao}, ${plural(total, "entrega", "entregas")}`;
    dashResumoFiltros.textContent = resumo.charAt(0).toUpperCase() + resumo.slice(1);
    dashLimpar.hidden = filtrosNoPadrao();
    const vazio = total === 0;
    dashVazio.hidden = !vazio;
    dashConteudo.hidden = vazio;
    if (vazio) {
        if (registrosNoFoco().length === 0) {
            dashVazioTexto.textContent =
                "Ainda não há entregas registradas. Assim que houver, os números aparecem aqui.";
        }
        else if (filtrosNoPadrao()) {
            dashVazioTexto.textContent = `Nenhuma entrega concluída em ${descricao}. Escolha outro ano ou "Todos".`;
        }
        else {
            dashVazioTexto.textContent = `Nenhuma entrega encontrada para ${descricao}. Ajuste os filtros ou use "Limpar filtros".`;
        }
        return;
    }
    renderizarHero();
    renderizarKpis();
    renderizarNumerosVolume();
    renderizarGraficos();
    renderizarOkrs();
    renderizarPdi(); // pdi-dashboard.ts
    renderizarTiposDaBusca();
    renderizarEntregas();
}
// ---------- Inicialização ----------
// Fecha clicando fora do conteúdo (no fundo escurecido). Esc já fecha nativamente.
dashModal.addEventListener("click", (evento) => {
    if (evento.target === dashModal)
        dashModal.close();
});
dashReleaseAtual.addEventListener("click", () => aplicarFiltro({ ano: ANO_ATUAL, release: releaseAtual() }));
// A busca só refaz a lista: o campo não perde o foco enquanto se digita.
dashBusca.addEventListener("input", () => {
    busca = dashBusca.value;
    renderizarEntregas();
});
// "/" em qualquer lugar do dashboard leva à busca (atalho comum em apps web).
document.addEventListener("keydown", (evento) => {
    const digitando = evento.target instanceof HTMLInputElement || evento.target instanceof HTMLTextAreaElement;
    if (evento.key !== "/" || digitando || el("painel-dashboard").hidden || dashModal.open)
        return;
    evento.preventDefault();
    dashBusca.focus();
    dashBusca.scrollIntoView({ behavior: "smooth", block: "center" });
});
dashLimpar.addEventListener("click", () => {
    filtros = { ...FILTROS_PADRAO };
    renderizarDashboard();
});
// Os gráficos SVG são desenhados na largura do cartão: redesenha se ela mudar.
// ResizeObserver (e não window.resize) pega também a barra de rolagem que surge
// depois do primeiro desenho. Compara a largura para não redesenhar à toa.
let larguraDosGraficos = 0;
new ResizeObserver(([entrada]) => {
    const largura = Math.round(entrada?.contentRect.width ?? 0);
    if (largura === 0 || largura === larguraDosGraficos)
        return;
    const primeiraMedida = larguraDosGraficos === 0;
    larguraDosGraficos = largura;
    if (!primeiraMedida)
        renderizarGraficos();
}).observe(dashGraficosVolume);
dashExplorar.addEventListener("click", () => {
    document.getElementById("sec-indicadores")?.scrollIntoView({ behavior: "smooth" });
});
// ---------- Navegação entre seções (trilho lateral) ----------
const linksSecoes = [...document.querySelectorAll("#trilho-nav a")];
function marcarSecaoAtiva(id) {
    for (const link of linksSecoes)
        link.classList.toggle("ativa", link.hash === `#${id}`);
}
// A seção que cruza a faixa central da tela é a "atual".
const observadorSecoes = new IntersectionObserver((entradas) => {
    for (const entrada of entradas)
        if (entrada.isIntersecting)
            marcarSecaoAtiva(entrada.target.id);
}, { rootMargin: "-45% 0px -50% 0px" });
for (const link of linksSecoes) {
    const secao = document.querySelector(link.hash);
    if (secao)
        observadorSecoes.observe(secao);
    link.addEventListener("click", (evento) => {
        evento.preventDefault();
        // Vindo da aba de edição: volta ao dashboard antes de rolar.
        if (el("painel-dashboard").hidden)
            el("aba-dashboard").click();
        secao?.scrollIntoView({ behavior: "smooth" });
        marcarSecaoAtiva(link.hash.slice(1));
    });
}
