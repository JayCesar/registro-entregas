"use strict";
// Seção "PDI" do dashboard: como as entregas da seleção movem cada ponto do
// PDI. Só aparece com a senha do coordenador (ver a cifra em pdi.ts).
//
// No navegador de quem cadastra, o PDI e os vínculos vêm do localStorage e a
// senha só destrava a exibição. Na página publicada eles vêm cifrados na tag
// #pdi-publicado e só existem em memória depois da senha certa.
// ---------- Estado ----------
const dashPdi = el("dash-pdi");
const tagPdiPublicado = document.getElementById("pdi-publicado");
// "local" = PDI e vínculos lidos do navegador a cada desenho. Fica só em
// memória: recarregar a página bloqueia de novo.
let pdiLiberado = null;
// Formulário da senha guardado entre desenhos: mudar um filtro não apaga o que se digitou.
let bloqueioPdi = null;
const CLASSE_INTENSIDADE = {
    baixo: "grau-baixo",
    médio: "grau-medio",
    forte: "grau-alto",
};
const PESO_INTENSIDADE = { baixo: 1, médio: 2, forte: 3 };
const INTENSIDADES_DECRESCENTES = [...INTENSIDADES_PDI].reverse();
const maiuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);
// ---------- Desbloqueio ----------
// Páginas publicadas antes das versões levavam { pdi, vinculos }: vira uma versão só.
function conteudoPublicado(valor) {
    if (typeof valor !== "object" || valor === null)
        return null;
    const { versoes, pdi, vinculos } = valor;
    if (typeof vinculos !== "object" || vinculos === null)
        return null;
    const mapa = vinculos;
    if (Array.isArray(versoes) && versoes.every(versaoPdiValida))
        return { versoes, vinculos: mapa };
    if (pdiValido(pdi))
        return { versoes: [{ id: "publicado", criadaEm: "", pdi }], vinculos: mapa };
    return null;
}
// Devolve a mensagem de erro, ou null quando liberou.
async function liberarPdi(senha) {
    const privada = await abrirChavePdi(senha);
    if (!privada)
        return "Senha incorreta.";
    if (document.body.dataset.publicado !== "sim") {
        pdiLiberado = "local";
        return null;
    }
    try {
        const conteudo = conteudoPublicado(await decifrarDoCoordenador(JSON.parse(tagPdiPublicado?.textContent ?? ""), privada));
        if (!conteudo)
            return "O PDI desta página está corrompido.";
        pdiLiberado = conteudo;
        return null;
    }
    catch {
        // Senha certa, mas a página foi gerada com outra chave (senha trocada depois).
        return "Esta página foi publicada com outra senha do coordenador.";
    }
}
function criarBloqueioPdi() {
    const formulario = criarElemento("form", "cartao pdi-bloqueio");
    formulario.noValidate = true;
    const campo = criarElemento("div", "campo");
    const rotulo = criarElemento("label", "", "Senha do coordenador");
    rotulo.htmlFor = "senha-pdi";
    const senha = criarElemento("input");
    senha.type = "password";
    senha.id = "senha-pdi";
    senha.autocomplete = "off";
    const erro = criarElemento("small", "erro");
    campo.append(rotulo, senha, erro);
    const botao = criarElemento("button", "", "Ver PDI");
    botao.type = "submit";
    const acoes = criarElemento("div", "acoes-form");
    acoes.append(botao);
    const aviso = criarElemento("div", "pdi-bloqueio-aviso");
    aviso.append(criarIcone("cadeado"), criarElemento("p", "dica", "Esta seção é restrita ao coordenador. Sem a senha, nada do PDI é exibido."));
    formulario.append(aviso, campo, acoes);
    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        // O PBKDF2 leva cerca de 1 segundo de propósito: atrasa quem tenta adivinhar.
        botao.disabled = true;
        botao.textContent = "Conferindo…";
        const mensagem = await liberarPdi(senha.value);
        botao.disabled = false;
        botao.textContent = "Ver PDI";
        senha.value = "";
        if (mensagem) {
            erro.textContent = mensagem;
            senha.focus();
            return;
        }
        erro.textContent = "";
        renderizarPdi();
    });
    return formulario;
}
function renderizarBloqueioPdi() {
    if (!CHAVE_PDI) {
        dashPdi.replaceChildren(criarElemento("p", "estado-vazio", "A senha do coordenador ainda não foi configurada (ver README, seção PDI)."));
        return;
    }
    if (document.body.dataset.publicado === "sim" && !tagPdiPublicado) {
        dashPdi.replaceChildren(criarElemento("p", "estado-vazio", "Esta publicação não inclui o PDI."));
        return;
    }
    bloqueioPdi ??= criarBloqueioPdi();
    if (!dashPdi.contains(bloqueioPdi))
        dashPdi.replaceChildren(bloqueioPdi);
}
// Versão mostrada ("" = a mais recente) e pontos com a lista de entregas aberta.
let versaoPdiDashboard = "";
const pontosExpandidos = new Set();
const ENTREGAS_POR_PONTO = 3;
const pontuacaoDe = (itens) => itens.reduce((soma, i) => soma + PESO_INTENSIDADE[i.intensidade], 0);
function nomeDaMedia(media) {
    return media >= 2.5 ? "forte" : media >= 1.5 ? "médio" : "baixo";
}
function criarBarraIntensidades(itens) {
    const barra = criarElemento("div", "okr-barra");
    for (const intensidade of INTENSIDADES_DECRESCENTES) {
        const quantidade = itens.filter((i) => i.intensidade === intensidade).length;
        if (quantidade === 0)
            continue;
        const parte = criarElemento("span", CLASSE_INTENSIDADE[intensidade]);
        parte.style.flex = `${quantidade} 1 0`;
        parte.title = `${maiuscula(intensidade)}: ${quantidade}`;
        barra.append(parte);
    }
    return barra;
}
// "Forte 1 · Médio 2 · Baixo 0", com a amostra de cor de cada intensidade.
function criarLegendaIntensidades(itens) {
    const legenda = criarElemento("div", "pdi-intensidades");
    for (const intensidade of INTENSIDADES_DECRESCENTES) {
        const quantidade = itens.filter((i) => i.intensidade === intensidade).length;
        const item = criarElemento("span", quantidade === 0 ? "zerado" : "");
        item.append(criarElemento("span", `legenda-cor ${CLASSE_INTENSIDADE[intensidade]}`), `${maiuscula(intensidade)} `);
        item.append(criarElemento("strong", "", quantidade.toString()));
        legenda.append(item);
    }
    return legenda;
}
function criarLinhaEntregaPdi({ registro, intensidade }) {
    const linha = criarBotao("", "okr-linha pdi-entrega", () => abrirDetalhesEntrega(registro));
    linha.style.setProperty("--cor-tipo", CORES_TIPO[registro.tipo]);
    const grau = criarElemento("div", "okr-linha-grau");
    grau.append(criarElemento("span", `grau ${CLASSE_INTENSIDADE[intensidade]}`, maiuscula(intensidade)));
    const corpo = criarElemento("div", "okr-linha-corpo");
    const meta = criarElemento("div", "okr-linha-meta");
    meta.append(criarElemento("span", "etiqueta etiqueta-tipo", registro.tipo), criarElemento("span", "dica", `${rotuloReleaseSprint(registro)} · ${formatarData(registro.dataFim)}`));
    corpo.append(meta, criarElemento("strong", "okr-linha-assunto", registro.assunto));
    linha.append(grau, corpo, criarIcone("seta-diagonal", "icone okr-linha-seta"));
    return linha;
}
function criarCartaoPonto(resumo, campos, pontuacaoTotal) {
    const { ponto, estilo, itens, pontuacao } = resumo;
    const cartao = criarElemento("article", itens.length === 0 ? "pdi-ponto sem-entregas" : "pdi-ponto");
    cartao.style.setProperty("--cor-ponto", estilo.cor);
    const [, id] = ponto.id.split("_");
    const valor = (coluna) => (campos[`${ponto.tipo}_${id}_${coluna}`] ?? "").trim();
    // Topo: ícone e categoria à esquerda; à direita, quanto do esforço no PDI foi para este ponto.
    const topo = criarElemento("div", "pdi-ponto-topo");
    const icone = criarElemento("span", "pdi-ponto-icone");
    icone.append(criarIcone(estilo.icone));
    topo.append(icone, criarElemento("span", "etiqueta", etiquetaDoPonto(ponto)));
    if (pontuacaoTotal > 0) {
        const fatia = percentualDe(pontuacao, pontuacaoTotal);
        const anel = criarElemento("span", "pdi-ponto-anel");
        anel.title = `${fatia}% da pontuação de todas as entregas ligadas ao PDI`;
        anel.append(criarMedidorAnel("Parte do esforço no PDI", fatia, estilo.cor));
        topo.append(anel);
    }
    const titulo = criarElemento("h3", "pdi-ponto-titulo", tituloDoPonto(ponto));
    titulo.title = titulo.textContent ?? "";
    const extra = ponto.tipo === "gap"
        ? valor("criterio") && `Critério de evolução: ${valor("criterio")}`
        : [ponto.detalhe, valor("responsavel"), valor("prazo") && `prazo ${formatarData(valor("prazo"))}`]
            .filter(Boolean)
            .join(" · ");
    cartao.append(topo, titulo);
    if (extra) {
        const detalhe = criarElemento("p", "dica pdi-ponto-detalhe", extra);
        detalhe.title = extra;
        cartao.append(detalhe);
    }
    if (itens.length === 0) {
        const vazio = criarElemento("p", "pdi-ponto-vazio");
        vazio.append(criarIcone("relogio"), "Ainda sem entregas nesta seleção");
        cartao.append(vazio);
        return cartao;
    }
    const numeros = criarElemento("div", "pdi-ponto-numeros");
    const media = pontuacao / itens.length;
    numeros.append(criarElemento("strong", "", itens.length.toString()), criarElemento("span", "dica", itens.length === 1 ? "entrega" : "entregas"), criarElemento("strong", "", pontuacao.toString()), criarElemento("span", "dica", "pts"), criarElemento("span", `grau ${CLASSE_INTENSIDADE[nomeDaMedia(media)]}`, `média ${nomeDaMedia(media)}`));
    // Mais forte primeiro; dentro da mesma intensidade, a mais recente primeiro.
    const ordenados = [...itens].sort((a, b) => PESO_INTENSIDADE[b.intensidade] - PESO_INTENSIDADE[a.intensidade] ||
        b.registro.dataFim.localeCompare(a.registro.dataFim));
    const expandido = pontosExpandidos.has(ponto.id);
    const lista = criarElemento("div", "okr-lista");
    lista.append(...ordenados.slice(0, expandido ? undefined : ENTREGAS_POR_PONTO).map(criarLinhaEntregaPdi));
    cartao.append(numeros, criarBarraIntensidades(itens), criarLegendaIntensidades(itens), lista);
    if (ordenados.length > ENTREGAS_POR_PONTO) {
        const rotulo = expandido ? "Mostrar menos" : `Ver todas (${ordenados.length})`;
        cartao.append(criarBotao(rotulo, "botao-texto pdi-ponto-mais", () => {
            if (expandido)
                pontosExpandidos.delete(ponto.id);
            else
                pontosExpandidos.add(ponto.id);
            renderizarPdi();
        }));
    }
    return cartao;
}
// Ranking: uma barra por ponto, empilhada por intensidade e proporcional à pontuação.
function criarRankingPontos(resumos) {
    const cartao = criarElemento("section", "cartao grafico col-8 pdi-ranking");
    cartao.append(criarElemento("h2", "", "Quanto cada ponto está sendo mexido"), criarElemento("p", "dica", "Pontuação das entregas ligadas a cada ponto (forte 3, médio 2, baixo 1). A cor mostra a intensidade."));
    const maximo = Math.max(1, ...resumos.map((r) => r.pontuacao));
    const ordenados = [...resumos].sort((a, b) => b.pontuacao - a.pontuacao || b.itens.length - a.itens.length);
    for (const { ponto, estilo, itens, pontuacao } of ordenados) {
        const linha = criarElemento("div", "pdi-ranking-linha");
        linha.style.setProperty("--cor-ponto", estilo.cor);
        const nome = criarElemento("div", "pdi-ranking-nome");
        const icone = criarElemento("span", "pdi-ponto-icone");
        icone.append(criarIcone(estilo.icone));
        const texto = criarElemento("span", "pdi-ranking-texto", tituloDoPonto(ponto));
        texto.title = `${etiquetaDoPonto(ponto)}: ${tituloDoPonto(ponto)}`;
        nome.append(icone, texto);
        const trilho = criarElemento("div", "pdi-ranking-trilho");
        const barra = criarBarraIntensidades(itens);
        barra.style.width = `${(pontuacao / maximo) * 100}%`;
        trilho.append(barra);
        const valor = criarElemento("span", "pdi-ranking-valor");
        valor.append(criarElemento("strong", "", pontuacao.toString()), ` pts · ${itens.length}`);
        linha.append(nome, trilho, valor);
        cartao.append(linha);
    }
    return cartao;
}
// Rosca: para onde foi o esforço, por categoria (técnica, comportamental, experiência...).
function criarRoscaCategorias(resumos) {
    const cartao = criarElemento("section", "cartao grafico col-4 pdi-categorias");
    cartao.append(criarElemento("h2", "", "Esforço por categoria"), criarElemento("p", "dica", "Pontuação somada por tipo de ponto do PDI."));
    const fatias = new Map();
    for (const { estilo, pontuacao } of resumos) {
        const fatia = fatias.get(estilo.categoria) ?? { rotulo: estilo.categoria, valor: 0, cor: estilo.cor };
        fatia.valor += pontuacao;
        fatias.set(estilo.categoria, fatia);
    }
    const lista = [...fatias.values()];
    const rosca = criarElemento("div", "pdi-rosca");
    rosca.append(criarGraficoRosca("Esforço por categoria do PDI", lista, { rotuloDoCentro: "pts" }));
    const legenda = criarElemento("div", "legenda");
    for (const fatia of lista) {
        const item = criarElemento("span", "legenda-item");
        item.append(criarAmostra(fatia.cor), `${fatia.rotulo} · ${fatia.valor}`);
        legenda.append(item);
    }
    cartao.append(rosca, legenda);
    return cartao;
}
// ---------- Ritmo do PDI (mesmo gráfico de linhas do "Ritmo de entregas") ----------
let granularidadeRitmoPdi = "mes";
// Intensidade de cada entrega ligada à versão exibida; preenchido a cada desenho do painel.
let intensidadesNoRitmoPdi = new Map();
const SERIES_RITMO_PDI = [
    { rotulo: "Entregas no PDI", cor: "var(--serie-a)", incluir: () => true },
    { rotulo: "Forte", cor: "var(--serie-b)", incluir: (i) => i === "forte" },
    { rotulo: "Médio", cor: "var(--serie-c)", incluir: (i) => i === "médio" },
    { rotulo: "Baixo", cor: "var(--serie-d)", incluir: (i) => i === "baixo" },
];
function criarCartaoRitmoPdi() {
    const cartao = criarElemento("section", "cartao grafico col-12 ritmo pdi-ritmo");
    const cabecalho = criarElemento("div", "ritmo-cabecalho");
    const textos = criarElemento("div");
    textos.append(criarElemento("h2", "", "Ritmo do PDI"), criarElemento("p", "dica", "Entregas ligadas a pontos do PDI ao longo do tempo, no total e por intensidade."));
    const abas = criarElemento("div", "abas-texto");
    abas.setAttribute("role", "group");
    abas.ariaLabel = "Granularidade do ritmo do PDI";
    for (const [valor, rotulo] of GRANULARIDADES) {
        const aba = criarBotao(rotulo, "aba-texto", () => {
            granularidadeRitmoPdi = valor;
            renderizarPdi();
        });
        aba.setAttribute("aria-pressed", String(valor === granularidadeRitmoPdi));
        abas.append(aba);
    }
    cabecalho.append(textos, abas);
    const legenda = criarElemento("div", "legenda");
    for (const { rotulo, cor } of SERIES_RITMO_PDI) {
        const item = criarElemento("span", "legenda-item");
        item.append(criarAmostra(cor), rotulo);
        legenda.append(item);
    }
    cartao.append(cabecalho, criarElemento("div", "grafico-rolagem"), legenda);
    return cartao;
}
// Precisa do cartão já na página: o SVG é desenhado na largura real dele.
function desenharRitmoPdi() {
    const area = dashPdi.querySelector(".pdi-ritmo .grafico-rolagem");
    if (!area)
        return;
    const ligadas = registrosFiltrados.filter((r) => intensidadesNoRitmoPdi.has(r.id));
    const { rotulos, titulos, grupos } = pontosDoRitmo(ligadas, granularidadeRitmoPdi);
    if (rotulos.length === 0) {
        area.replaceChildren(criarElemento("p", "estado-vazio", "Sem release/sprint informada nas entregas ligadas ao PDI."));
        return;
    }
    area.replaceChildren(criarGraficoLinhas("Ritmo do PDI", rotulos, titulos, SERIES_RITMO_PDI.map(({ rotulo, cor, incluir }) => ({
        rotulo,
        cor,
        valores: grupos.map((grupo) => grupo.filter((r) => incluir(intensidadesNoRitmoPdi.get(r.id) ?? "baixo")).length),
    })), area.clientWidth));
}
function renderizarPainelPdi(conteudo) {
    const versoes = conteudo === "local" ? carregarVersoesPdi() : conteudo.versoes;
    const vinculoDe = (registro) => {
        const vinculo = conteudo === "local" ? registro.pdi : (conteudo.vinculos[registro.id] ?? null);
        return vinculo && { ...vinculo, versao: idDaVersaoDoVinculo(vinculo, versoes) };
    };
    const versao = versoes.find((v) => v.id === versaoPdiDashboard) ?? versoes.at(-1);
    const pdi = versao?.pdi ?? null;
    const campos = pdi?.campos ?? {};
    const cabecalho = criarElemento("div", "okr-detalhe-cabecalho");
    const titulo = criarElemento("div");
    const contexto = [
        campos.lideranca?.trim() && `Liderança: ${campos.lideranca.trim()}`,
        campos.funcao?.trim(),
        campos.proxima_revisao && `próxima revisão em ${formatarData(campos.proxima_revisao)}`,
    ].filter(Boolean);
    titulo.append(criarElemento("h3", "", campos.colaborador?.trim() ? `PDI de ${campos.colaborador.trim()}` : "PDI"), criarElemento("p", "dica", contexto.join(" · ")));
    const acoes = criarElemento("div", "pdi-cabecalho-acoes");
    // Versões, da mais recente para a mais antiga: cada entrega conta na versão em que foi registrada.
    if (versoes.length > 1) {
        const chips = criarElemento("div", "segmentado");
        chips.setAttribute("role", "group");
        chips.ariaLabel = "Versão do PDI";
        renderizarChips(chips, [...versoes].reverse().map((v) => [rotuloVersaoPdi(v, versoes), v.id]), versao?.id ?? "", (id) => {
            versaoPdiDashboard = id;
            renderizarPdi();
        });
        acoes.append(chips);
    }
    acoes.append(criarBotao("Bloquear PDI", "secundario", () => {
        pdiLiberado = null;
        renderizarPdi();
    }));
    cabecalho.append(titulo, acoes);
    if (!versao || !pdi) {
        dashPdi.replaceChildren(cabecalho, criarElemento("p", "estado-vazio", "Nenhum PDI cadastrado ainda (aba Edição)."));
        return;
    }
    const pontos = pontosDoPdi(pdi);
    const porPonto = new Map(pontos.map((p) => [p.id, []]));
    const foraDoPdi = [];
    for (const registro of registrosFiltrados) {
        const vinculo = vinculoDe(registro);
        if (!vinculo || vinculo.versao !== versao.id)
            continue;
        (porPonto.get(vinculo.ponto) ?? foraDoPdi).push({ registro, intensidade: vinculo.intensidade });
    }
    const resumos = pontos.map((ponto) => {
        const itens = porPonto.get(ponto.id) ?? [];
        return { ponto, estilo: estiloDoPonto(ponto), itens, pontuacao: pontuacaoDe(itens) };
    });
    if (foraDoPdi.length > 0) {
        const ponto = { id: "gap_removido", tipo: "gap", rotulo: "Removido", detalhe: "Pontos que saíram desta versão do PDI" };
        resumos.push({ ponto, estilo: { categoria: "Removido", cor: "var(--grau-indefinido)", icone: "alerta" }, itens: foraDoPdi, pontuacao: pontuacaoDe(foraDoPdi) });
    }
    const todas = resumos.flatMap((r) => r.itens);
    const pontuacaoTotal = pontuacaoDe(todas);
    const movidos = resumos.filter((r) => r.itens.length > 0).length;
    const media = todas.length > 0 ? pontuacaoTotal / todas.length : 0;
    const kpis = criarElemento("div", "faixa-kpis pdi-kpis");
    kpis.append(criarIndicador("Entregas no PDI", todas.length.toString(), {
        icone: "lista",
        unidade: `de ${registrosFiltrados.length}`,
        percentual: percentualDe(todas.length, registrosFiltrados.length),
        complemento: "da seleção movem algum ponto desta versão",
    }), criarIndicador("Pontos em movimento", movidos.toString(), {
        icone: "alvo",
        unidade: `de ${pontos.length}`,
        percentual: percentualDe(movidos, pontos.length),
        complemento: "gaps e experiências com ao menos uma entrega",
    }), criarIndicador("Intensidade média", todas.length > 0 ? formatarMedia(media) : "—", {
        icone: "medidor",
        unidade: "de 3",
        percentual: Math.round((media / 3) * 100),
        complemento: todas.length > 0 ? `nível ${nomeDaMedia(media)} · ${pontuacaoTotal} pts no total` : "nenhuma entrega ligada ainda",
    }));
    intensidadesNoRitmoPdi = new Map(todas.map((item) => [item.registro.id, item.intensidade]));
    const graficos = criarElemento("div", "grade-12");
    if (todas.length > 0) {
        graficos.append(criarCartaoRitmoPdi(), criarRankingPontos(resumos), criarRoscaCategorias(resumos));
    }
    const cartoes = criarElemento("div", "pdi-pontos");
    cartoes.append(...resumos.map((resumo) => criarCartaoPonto(resumo, campos, pontuacaoTotal)));
    if (pontos.length === 0)
        cartoes.append(criarElemento("p", "estado-vazio", "Esta versão do PDI não tem gaps nem experiências preenchidos."));
    dashPdi.replaceChildren(cabecalho, kpis, graficos, cartoes);
    desenharRitmoPdi();
}
// Chamada por renderizarDashboard (dashboard.ts) a cada desenho.
function renderizarPdi() {
    if (pdiLiberado)
        renderizarPainelPdi(pdiLiberado);
    else
        renderizarBloqueioPdi();
}
// Redesenha o ritmo do PDI quando a largura muda (como os gráficos do dashboard).
let larguraDoPdi = 0;
new ResizeObserver(([entrada]) => {
    const largura = Math.round(entrada?.contentRect.width ?? 0);
    if (largura === 0 || largura === larguraDoPdi)
        return;
    larguraDoPdi = largura;
    if (pdiLiberado)
        desenharRitmoPdi();
}).observe(dashPdi);
