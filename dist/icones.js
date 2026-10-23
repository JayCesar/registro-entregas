"use strict";
// Ícones de traço em SVG, sem biblioteca externa. Os desenhos são strings fixas
// deste arquivo (nunca dados do usuário), por isso podem ir via innerHTML.
// No HTML, qualquer <span data-icone="nome"> recebe o ícone ao carregar.
const ICONES = {
    marca: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/>',
    grade: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/>' +
        '<rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    medidor: '<path d="M3.3 19a10 10 0 1 1 17.4 0"/><path d="m12 14 4-4"/>',
    barras: '<path d="M3 3v18h18"/><path d="M8 17v-6M13 17V7M18 17v-3"/>',
    alvo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    lista: '<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    lapis: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    "seta-baixo": '<path d="M12 4v16M5 13l7 7 7-7"/>',
    "seta-diagonal": '<path d="M7 17 17 7M8 7h9v9"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alerta: '<path d="M12 3 2 20h20Z"/><path d="M12 10v4M12 17h.01"/>',
    calendario: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    camadas: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
    ciclo: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    pico: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    objetivo: '<circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4.5"/><circle cx="11" cy="13" r="1"/>' +
        '<path d="m11 13 8.5-8.5"/><path d="M16 3.5 19.5 4.5 20.5 8"/>',
    cursor: '<path d="M4 3l7 17 2.5-7.5L21 10z"/><path d="m13.5 13.5 6 6"/>',
    lupa: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    sol: '<circle cx="12" cy="12" r="4"/>' +
        '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    lua: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    documento: '<path d="M14 3H6v18h12V7Z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
    // Tipos de item
    livro: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    inseto: '<rect x="8" y="6" width="8" height="14" rx="4"/>' +
        '<path d="M19 8l-3 2M5 8l3 2M19 18l-3-2M5 18l3-2M20 13h-4M4 13h4M10 3l1 3M14 3l-1 3"/>',
    tarefa: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 3 3 5-6"/>',
    lampada: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
    bussola: '<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/>',
};
const ICONE_TIPO = {
    História: "livro",
    Bug: "inseto",
    Task: "tarefa",
    Oportunidade: "lampada",
    Discovery: "bussola",
};
function criarIcone(nome, classe = "icone") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", classe);
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = ICONES[nome];
    return svg;
}
for (const alvo of document.querySelectorAll("[data-icone]")) {
    const nome = alvo.dataset.icone;
    // A classe icone-<nome> deixa o CSS escolher entre ícones irmãos (ex.: sol/lua do tema).
    if (nome && nome in ICONES)
        alvo.replaceWith(criarIcone(nome, `icone icone-${nome}`));
}
