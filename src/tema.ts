// Tema (escuro/claro) e cor de destaque da aplicação inteira.
//
// Este arquivo é carregado no <head> SEM defer, antes do CSS: assim os
// atributos data-theme e data-accent já estão no <html> no primeiro render e a
// página não pisca com o tema errado. Por rodar antes dos outros scripts, ele
// não usa nada de config.ts nem de app.ts. As cores em si ficam em style.css.

const TEMAS = ["dark", "light"] as const;
const DESTAQUES = ["lima", "azul", "roxo", "laranja", "rosa"] as const;

type Tema = (typeof TEMAS)[number];
type Destaque = (typeof DESTAQUES)[number];

// v2: o escuro passou a ser o padrão. A chave nova descarta a escolha salva
// antes disso, então todo mundo volta a abrir no escuro uma vez.
const CHAVE_TEMA = "registro-entregas:tema:v2";
const CHAVE_DESTAQUE = "registro-entregas:destaque";

function lerPreferencia<T extends string>(chave: string, opcoes: readonly T[], padrao: T): T {
  try {
    const salvo = localStorage.getItem(chave);
    return opcoes.find((opcao) => opcao === salvo) ?? padrao;
  } catch {
    return padrao;
  }
}

let temaAtual: Tema = lerPreferencia(CHAVE_TEMA, TEMAS, "dark");
let destaqueAtual: Destaque = lerPreferencia(CHAVE_DESTAQUE, DESTAQUES, "lima");

function aplicarTema(): void {
  document.documentElement.dataset.theme = temaAtual;
  document.documentElement.dataset.accent = destaqueAtual;
}

aplicarTema();

// ---------- Controles no cabeçalho (só existem depois de o HTML carregar) ----------

document.addEventListener("DOMContentLoaded", () => {
  const botaoTema = document.getElementById("btn-tema");
  const listaDestaques = document.getElementById("lista-destaques");
  if (!botaoTema || !listaDestaques) return;

  const amostras = DESTAQUES.map((destaque) => {
    const amostra = document.createElement("button");
    amostra.type = "button";
    amostra.className = "amostra-destaque";
    // O próprio botão recebe data-accent: o CSS pinta cada amostra com a sua cor.
    amostra.dataset.accent = destaque;
    amostra.title = `Cor de destaque: ${destaque}`;
    amostra.ariaLabel = `Cor de destaque: ${destaque}`;
    amostra.addEventListener("click", () => {
      destaqueAtual = destaque;
      localStorage.setItem(CHAVE_DESTAQUE, destaque);
      atualizar();
    });
    return amostra;
  });
  listaDestaques.append(...amostras);

  function atualizar(): void {
    aplicarTema();
    // O botão anuncia o tema para o qual ele troca. O ícone (sol/lua) é escolhido
    // pelo CSS a partir de data-theme; aqui só vão o texto e a acessibilidade.
    const rotulo = temaAtual === "dark" ? "Tema claro" : "Tema escuro";
    botaoTema!.title = rotulo;
    botaoTema!.ariaLabel = "Tema escuro";
    // Interruptor: "ligado" = escuro. O CSS move a bolinha por data-theme.
    botaoTema!.ariaChecked = String(temaAtual === "dark");
    const textoRotulo = document.getElementById("btn-tema-rotulo");
    if (textoRotulo) textoRotulo.textContent = rotulo;
    for (const amostra of amostras) {
      amostra.ariaPressed = String(amostra.dataset.accent === destaqueAtual);
    }
  }

  botaoTema.addEventListener("click", () => {
    temaAtual = temaAtual === "dark" ? "light" : "dark";
    localStorage.setItem(CHAVE_TEMA, temaAtual);
    atualizar();
  });

  atualizar();
});
