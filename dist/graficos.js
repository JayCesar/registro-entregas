"use strict";
// Gráficos de colunas (simples ou empilhadas) e de rosca em SVG, sem biblioteca externa.
// As cores chegam como tokens CSS (ex.: "var(--tipo-bug)") e são aplicadas via
// style, porque o atributo fill do SVG não aceita var().
// Usado pelo dashboard; não conhece o modelo de registro, só recebe colunas prontas.
const SVG_NS = "http://www.w3.org/2000/svg";
function criarSvg(tag, atributos = {}, conteudo = "") {
    const elemento = document.createElementNS(SVG_NS, tag);
    for (const [nome, valor] of Object.entries(atributos))
        elemento.setAttribute(nome, String(valor));
    if (conteudo)
        elemento.textContent = conteudo;
    return elemento;
}
// ---------- Tooltip ----------
// Um único tooltip para todos os gráficos, posicionado junto ao mouse.
const dicaGrafico = document.createElement("div");
dicaGrafico.className = "dica-grafico";
dicaGrafico.hidden = true;
document.body.append(dicaGrafico);
function mostrarDica(evento, linhas) {
    dicaGrafico.replaceChildren(...linhas.map((linha, indice) => {
        const item = document.createElement(indice === 0 ? "strong" : "span");
        item.textContent = linha;
        return item;
    }));
    dicaGrafico.hidden = false;
    const margem = 12;
    // Não deixa o tooltip sair pela direita da janela.
    const maximoX = window.innerWidth - dicaGrafico.offsetWidth - margem;
    dicaGrafico.style.left = `${Math.max(margem, Math.min(evento.clientX + margem, maximoX))}px`;
    dicaGrafico.style.top = `${evento.clientY + margem}px`;
}
function esconderDica() {
    dicaGrafico.hidden = true;
}
// ---------- Gráfico de colunas ----------
// Intervalo entre as marcas do eixo: sempre inteiro e com no máximo ~5 marcas.
function passoDoEixo(maximo) {
    for (const passo of [1, 2, 5, 10, 20, 50, 100, 200, 500]) {
        if (maximo / passo <= 5)
            return passo;
    }
    return 1000;
}
// Degradê vertical de uma cor (cheia no topo, translúcida na base), criado uma
// vez por cor em cada gráfico. Devolve o valor para `fill`: "url(#id)".
function criarPreenchimentoDegrade(defs, cache, cor) {
    const existente = cache.get(cor);
    if (existente)
        return existente;
    const id = `colunas-degrade-${++degradesCriados}`;
    const gradiente = criarSvg("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 });
    for (const [offset, opacidade] of [
        ["0%", "1"],
        ["100%", "0.35"],
    ]) {
        const parada = criarSvg("stop", { offset: offset ?? "0%" });
        parada.style.stopColor = cor;
        parada.style.stopOpacity = opacidade ?? "1";
        gradiente.append(parada);
    }
    defs.append(gradiente);
    const preenchimento = `url(#${id})`;
    cache.set(cor, preenchimento);
    return preenchimento;
}
let degradesCriados = 0;
function criarGraficoColunas(descricao, colunas, larguraDisponivel, larguraMinimaColuna = 56) {
    const temGrupos = colunas.some((c) => c.grupo !== undefined);
    const margem = { topo: 30, direita: 12, base: temGrupos ? 60 : 34, esquerda: 40 };
    const alturaPlot = 300;
    const espacoEntreGrupos = 24;
    const iniciaGrupo = (indice) => indice > 0 && colunas[indice]?.grupo !== colunas[indice - 1]?.grupo;
    const espacoGrupos = colunas.filter((_, indice) => iniciaGrupo(indice)).length * espacoEntreGrupos;
    // Se as colunas não cabem, o SVG fica mais largo e o contêiner rola na horizontal.
    const larguraMinima = margem.esquerda + margem.direita + espacoGrupos + colunas.length * larguraMinimaColuna;
    const largura = Math.max(larguraDisponivel, larguraMinima);
    const altura = margem.topo + alturaPlot + margem.base;
    const larguraPlot = largura - margem.esquerda - margem.direita;
    const faixa = Math.min(170, (larguraPlot - espacoGrupos) / Math.max(1, colunas.length));
    const larguraBarra = Math.min(72, faixa * 0.62);
    const totais = colunas.map((c) => c.segmentos.reduce((soma, s) => soma + s.valor, 0));
    const maior = Math.max(1, ...totais);
    const passo = passoDoEixo(maior);
    const topoDoEixo = Math.ceil(maior / passo) * passo;
    const yDe = (valor) => margem.topo + alturaPlot * (1 - valor / topoDoEixo);
    const yBase = yDe(0);
    const svg = criarSvg("svg", { class: "grafico-svg", width: largura, height: altura, role: "img" });
    svg.setAttribute("aria-label", descricao);
    const defs = criarSvg("defs");
    svg.append(defs);
    const degradesPorCor = new Map();
    // Linhas de grade e valores do eixo.
    for (let valor = 0; valor <= topoDoEixo; valor += passo) {
        svg.append(criarSvg("line", {
            class: valor === 0 ? "eixo-base" : "eixo-grade",
            x1: margem.esquerda,
            x2: largura - margem.direita,
            y1: yDe(valor),
            y2: yDe(valor),
        }), criarSvg("text", { x: margem.esquerda - 10, y: yDe(valor) + 5, "text-anchor": "end" }, valor.toString()));
    }
    // Com poucas colunas a faixa bate no limite e sobra espaço: centraliza o conjunto.
    const sobra = Math.max(0, larguraPlot - espacoGrupos - faixa * colunas.length);
    let x = margem.esquerda + sobra / 2;
    let inicioDoGrupo = x;
    const rotularGrupo = (grupo, fim) => {
        if (grupo === undefined)
            return;
        svg.append(criarSvg("text", { class: "grafico-grupo", x: (inicioDoGrupo + fim) / 2, y: yBase + 48, "text-anchor": "middle" }, grupo));
    };
    for (const [indice, coluna] of colunas.entries()) {
        if (iniciaGrupo(indice)) {
            rotularGrupo(colunas[indice - 1]?.grupo, x);
            x += espacoEntreGrupos;
            inicioDoGrupo = x;
        }
        const centro = x + faixa / 2;
        const esquerda = centro - larguraBarra / 2;
        const direita = centro + larguraBarra / 2;
        const total = totais[indice] ?? 0;
        const visiveis = coluna.segmentos.filter((s) => s.valor > 0);
        let acumulado = 0;
        for (const [posicao, segmento] of visiveis.entries()) {
            // Segmentos acima do primeiro deixam 2px de respiro para o de baixo.
            const base = yDe(acumulado) - (posicao === 0 ? 0 : 2);
            acumulado += segmento.valor;
            const topo = Math.min(yDe(acumulado), base - 1);
            const ehOTopoDaColuna = posicao === visiveis.length - 1;
            // Só a ponta da coluna é arredondada; a base fica reta, apoiada no eixo.
            const raio = ehOTopoDaColuna ? Math.min(6, base - topo, larguraBarra / 2) : 0;
            const marca = criarSvg("path", {
                class: "grafico-segmento",
                d: `M${esquerda},${base} V${topo + raio} Q${esquerda},${topo} ${esquerda + raio},${topo} ` +
                    `H${direita - raio} Q${direita},${topo} ${direita},${topo + raio} V${base} Z`,
            });
            // Cada segmento tem o próprio degradê (bounding box), então numa coluna
            // empilhada todos os tipos ficam com o mesmo "brilho" no topo.
            marca.style.fill = criarPreenchimentoDegrade(defs, degradesPorCor, segmento.cor);
            marca.style.stroke = segmento.cor;
            const linhas = [coluna.titulo, `${segmento.rotulo}: ${segmento.valor}`];
            if (coluna.segmentos.length > 1)
                linhas.push(`Total: ${total}`);
            marca.addEventListener("mousemove", (evento) => mostrarDica(evento, linhas));
            marca.addEventListener("mouseleave", esconderDica);
            svg.append(marca);
        }
        svg.append(criarSvg("text", { class: "grafico-total", x: centro, y: yDe(total) - 8, "text-anchor": "middle" }, total.toString()), criarSvg("text", { x: centro, y: yBase + 23, "text-anchor": "middle" }, coluna.rotulo));
        x += faixa;
    }
    rotularGrupo(colunas.at(-1)?.grupo, x);
    return svg;
}
// Cada gráfico precisa de ids próprios para os gradientes das áreas.
let gradientesCriados = 0;
// Curva cúbica monotônica (Fritsch–Carlson): suaviza sem "passar do ponto",
// então a linha nunca desce abaixo de zero nem inventa picos entre os valores.
function caminhoSuave(xs, ys) {
    const n = xs.length;
    if (n === 0)
        return "";
    if (n === 1)
        return `M${xs[0]},${ys[0]}`;
    const x = (i) => xs[i] ?? 0;
    const y = (i) => ys[i] ?? 0;
    const inclinacoes = Array.from({ length: n - 1 }, (_, i) => (y(i + 1) - y(i)) / (x(i + 1) - x(i)));
    const s = (i) => inclinacoes[i] ?? 0;
    const tangentes = Array.from({ length: n }, (_, i) => i === 0 ? s(0) : i === n - 1 ? s(n - 2) : s(i - 1) * s(i) <= 0 ? 0 : (s(i - 1) + s(i)) / 2);
    for (let i = 0; i < n - 1; i++) {
        if (s(i) === 0) {
            tangentes[i] = 0;
            tangentes[i + 1] = 0;
            continue;
        }
        const a = (tangentes[i] ?? 0) / s(i);
        const b = (tangentes[i + 1] ?? 0) / s(i);
        const h = a * a + b * b;
        if (h > 9) {
            const tau = 3 / Math.sqrt(h);
            tangentes[i] = tau * a * s(i);
            tangentes[i + 1] = tau * b * s(i);
        }
    }
    let d = `M${x(0)},${y(0)}`;
    for (let i = 0; i < n - 1; i++) {
        const passo = (x(i + 1) - x(i)) / 3;
        d +=
            ` C${x(i) + passo},${y(i) + (tangentes[i] ?? 0) * passo}` +
                ` ${x(i + 1) - passo},${y(i + 1) - (tangentes[i + 1] ?? 0) * passo}` +
                ` ${x(i + 1)},${y(i + 1)}`;
    }
    return d;
}
// Linhas suaves com área em degradê e um ponto por valor. O hover numa coluna
// mostra a guia vertical, aumenta os pontos daquela posição e abre o tooltip.
function criarGraficoLinhas(descricao, rotulos, // texto curto no eixo X
titulos, // texto completo no tooltip
series, larguraDisponivel) {
    const margem = { topo: 24, direita: 20, base: 36, esquerda: 40 };
    const alturaPlot = 260;
    const n = rotulos.length;
    const largura = Math.max(larguraDisponivel, margem.esquerda + margem.direita + n * 44);
    const altura = margem.topo + alturaPlot + margem.base;
    const larguraPlot = largura - margem.esquerda - margem.direita;
    // Respiro nas pontas para os pontos não colarem nas bordas.
    const respiro = Math.min(24, larguraPlot / 8);
    const xDe = (i) => n === 1
        ? margem.esquerda + larguraPlot / 2
        : margem.esquerda + respiro + (i * (larguraPlot - 2 * respiro)) / (n - 1);
    const maior = Math.max(1, ...series.flatMap((serie) => serie.valores));
    const passo = passoDoEixo(maior);
    const topoDoEixo = Math.ceil(maior / passo) * passo;
    const yDe = (valor) => margem.topo + alturaPlot * (1 - valor / topoDoEixo);
    const yBase = yDe(0);
    const svg = criarSvg("svg", { class: "grafico-svg grafico-linhas", width: largura, height: altura, role: "img" });
    svg.setAttribute("aria-label", descricao);
    for (let valor = 0; valor <= topoDoEixo; valor += passo) {
        svg.append(criarSvg("line", {
            class: "eixo-grade",
            x1: margem.esquerda,
            x2: largura - margem.direita,
            y1: yDe(valor),
            y2: yDe(valor),
        }), criarSvg("text", { x: margem.esquerda - 10, y: yDe(valor) + 5, "text-anchor": "end" }, valor.toString()));
    }
    // Com muitos pontos, mostra só parte dos rótulos do eixo X para não encavalar.
    const pularRotulos = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(larguraPlot / 60))));
    for (const [i, rotulo] of rotulos.entries()) {
        if (i % pularRotulos !== 0 && i !== n - 1)
            continue;
        svg.append(criarSvg("text", { x: xDe(i), y: yBase + 26, "text-anchor": "middle" }, rotulo));
    }
    const guia = criarSvg("line", { class: "linhas-guia", x1: 0, x2: 0, y1: margem.topo, y2: yBase });
    guia.style.visibility = "hidden";
    svg.append(guia);
    const defs = criarSvg("defs");
    svg.append(defs);
    const pontosPorIndice = Array.from({ length: n }, () => []);
    for (const [indiceSerie, serie] of series.entries()) {
        const id = `linhas-gradiente-${++gradientesCriados}`;
        const gradiente = criarSvg("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 });
        const inicio = criarSvg("stop", { offset: "0%" });
        inicio.style.stopColor = serie.cor;
        // Só a primeira série (o total) tem área forte; as outras ficam sutis para não embaralhar.
        inicio.style.stopOpacity = indiceSerie === 0 ? "0.3" : "0.12";
        const fim = criarSvg("stop", { offset: "100%" });
        fim.style.stopColor = serie.cor;
        fim.style.stopOpacity = "0";
        gradiente.append(inicio, fim);
        defs.append(gradiente);
        const xs = serie.valores.map((_, i) => xDe(i));
        const ys = serie.valores.map(yDe);
        const linha = caminhoSuave(xs, ys);
        if (n > 1) {
            svg.append(criarSvg("path", {
                class: "linhas-area",
                d: `${linha} L${xs.at(-1)},${yBase} L${xs[0]},${yBase} Z`,
                fill: `url(#${id})`,
            }));
        }
        const traco = criarSvg("path", { class: "linhas-traco", d: linha });
        traco.style.stroke = serie.cor;
        svg.append(traco);
        for (const [i, valor] of serie.valores.entries()) {
            const ponto = criarSvg("circle", { class: "linhas-ponto", cx: xDe(i), cy: yDe(valor), r: 4 });
            ponto.style.fill = serie.cor;
            svg.append(ponto);
            pontosPorIndice[i]?.push(ponto);
        }
    }
    // Faixas invisíveis, uma por ponto, que capturam o mouse.
    const meiaFaixa = n === 1 ? larguraPlot / 2 : (larguraPlot - 2 * respiro) / (n - 1) / 2;
    for (let i = 0; i < n; i++) {
        const faixa = criarSvg("rect", {
            class: "linhas-faixa",
            x: xDe(i) - meiaFaixa,
            y: margem.topo,
            width: meiaFaixa * 2,
            height: alturaPlot,
        });
        const linhasDaDica = [titulos[i] ?? "", ...series.map((serie) => `${serie.rotulo}: ${serie.valores[i] ?? 0}`)];
        faixa.addEventListener("mousemove", (evento) => {
            guia.setAttribute("x1", String(xDe(i)));
            guia.setAttribute("x2", String(xDe(i)));
            guia.style.visibility = "visible";
            for (const ponto of pontosPorIndice[i] ?? [])
                ponto.classList.add("ativo");
            mostrarDica(evento, linhasDaDica);
        });
        faixa.addEventListener("mouseleave", () => {
            guia.style.visibility = "hidden";
            for (const ponto of pontosPorIndice[i] ?? [])
                ponto.classList.remove("ativo");
            esconderDica();
        });
        svg.append(faixa);
    }
    return svg;
}
// Hover numa fatia: ela se desloca para fora, as outras esmaecem e o centro
// passa a mostrar o percentual e o nome dela. Para acionar de fora (ex.: hover
// num cartão), dispare "mouseenter"/"mouseleave" no path[data-rotulo].
function criarGraficoRosca(descricao, fatias, opcoes) {
    const { rotuloDoCentro, destaque, textoDoCentro, aoClicar } = opcoes;
    const centro = 90;
    const raioExterno = 86;
    const raioInterno = 64;
    const deslocamentoNoHover = 6;
    const voltaCompleta = Math.PI * 2;
    const ponto = (raio, angulo) => `${centro + raio * Math.cos(angulo)},${centro + raio * Math.sin(angulo)}`;
    const total = fatias.reduce((soma, f) => soma + f.valor, 0);
    const visiveis = fatias.filter((f) => f.valor > 0);
    const svg = criarSvg("svg", { class: "grafico-svg grafico-rosca", viewBox: "0 0 180 180", role: "img" });
    svg.setAttribute("aria-label", descricao);
    // Textos do centro: criados antes das fatias para o hover poder trocá-los.
    // Texto customizado (ex.: "22%") é mais largo que o total: usa a fonte menor.
    const numeroPadrao = textoDoCentro ?? total.toString();
    const classeNumeroPadrao = textoDoCentro ? "grafico-rosca-total compacto" : "grafico-rosca-total";
    const numero = criarSvg("text", { class: classeNumeroPadrao, x: centro, y: centro + 13, "text-anchor": "middle" }, numeroPadrao);
    const legenda = criarSvg("text", { x: centro, y: centro + 31, "text-anchor": "middle" }, rotuloDoCentro);
    const restaurarCentro = () => {
        numero.textContent = numeroPadrao;
        numero.setAttribute("class", classeNumeroPadrao);
        legenda.textContent = rotuloDoCentro;
    };
    // Começa no topo (12h) e segue no sentido horário.
    let angulo = -Math.PI / 2;
    for (const fatia of visiveis) {
        const abertura = (fatia.valor / total) * voltaCompleta;
        // Um arco SVG não fecha 360°: a fatia de 100% é desenhada em duas metades.
        const pedacos = visiveis.length === 1 ? 2 : 1;
        let d = "";
        for (let pedaco = 0; pedaco < pedacos; pedaco++) {
            const inicio = angulo + (abertura / pedacos) * pedaco;
            const fim = angulo + (abertura / pedacos) * (pedaco + 1);
            const arcoGrande = fim - inicio > Math.PI ? 1 : 0;
            d +=
                `M${ponto(raioExterno, inicio)} A${raioExterno},${raioExterno} 0 ${arcoGrande} 1 ${ponto(raioExterno, fim)} ` +
                    `L${ponto(raioInterno, fim)} A${raioInterno},${raioInterno} 0 ${arcoGrande} 0 ${ponto(raioInterno, inicio)} Z `;
        }
        const meio = angulo + abertura / 2;
        angulo += abertura;
        // A separação entre fatias é um contorno na cor do cartão (ver style.css).
        const classes = ["grafico-fatia"];
        if (pedacos === 2)
            classes.push("inteira");
        if (destaque !== undefined && fatia.rotulo !== destaque)
            classes.push("apagada");
        if (aoClicar)
            classes.push("clicavel");
        const marca = criarSvg("path", { class: classes.join(" "), d, "data-rotulo": fatia.rotulo });
        marca.style.fill = fatia.cor;
        // Direção do "salto" no hover: para fora, no meio do arco (a de 100% não se move).
        const salto = pedacos === 2 ? 0 : deslocamentoNoHover;
        marca.style.setProperty("--dx", `${(Math.cos(meio) * salto).toFixed(2)}px`);
        marca.style.setProperty("--dy", `${(Math.sin(meio) * salto).toFixed(2)}px`);
        const percentual = Math.round((fatia.valor / total) * 100);
        marca.addEventListener("mouseenter", () => {
            svg.classList.add("em-foco");
            marca.classList.add("realcada");
            numero.textContent = `${percentual}%`;
            numero.setAttribute("class", "grafico-rosca-total compacto");
            legenda.textContent = `${fatia.rotulo} · ${fatia.valor}`;
        });
        marca.addEventListener("mouseleave", () => {
            svg.classList.remove("em-foco");
            marca.classList.remove("realcada");
            restaurarCentro();
        });
        if (aoClicar)
            marca.addEventListener("click", () => aoClicar(fatia.rotulo));
        svg.append(marca);
    }
    svg.append(numero, legenda);
    return svg;
}
// ---------- Medidor percentual (anel) ----------
// Anel com o percentual no centro. `cor` é um token CSS, como nas outras marcas.
function criarMedidorAnel(descricao, percentual, cor) {
    const centro = 40;
    const raio = 33;
    const circunferencia = 2 * Math.PI * raio;
    const limitado = Math.max(0, Math.min(100, percentual));
    const svg = criarSvg("svg", { class: "medidor-anel", viewBox: "0 0 80 80", role: "img" });
    svg.setAttribute("aria-label", `${descricao}: ${limitado}%`);
    svg.append(criarSvg("circle", { class: "medidor-trilho", cx: centro, cy: centro, r: raio }));
    // Com 0% não desenha o arco: a ponta arredondada apareceria como um ponto.
    if (limitado > 0) {
        const arco = criarSvg("circle", {
            class: "medidor-arco",
            cx: centro,
            cy: centro,
            r: raio,
            "stroke-dasharray": `${(circunferencia * limitado) / 100} ${circunferencia}`,
            // Começa no topo (12h), como a rosca.
            transform: `rotate(-90 ${centro} ${centro})`,
        });
        arco.style.stroke = cor;
        svg.append(arco);
    }
    svg.append(criarSvg("text", { class: "medidor-texto", x: centro, y: centro + 6, "text-anchor": "middle" }, `${limitado}%`));
    return svg;
}
