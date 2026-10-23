// PDI (Plano de Desenvolvimento Individual): cadastro na aba de edição, vínculo
// de cada entrega com um ponto do PDI e a cifra da seção restrita ao coordenador.
//
// O formato é o JSON exportado pelo site da gestora, sem transformação:
//   { "versao": 1, "campos": { "colaborador": "...", "gap_<id>_dimensao": "...", ... } }
// `campos` é plano e só tem textos. As linhas de "Evidências e gaps" e do
// "Plano de experiências" viram grupos de chaves com o mesmo <id>
// (gap_<id>_dimensao, gap_<id>_evidencia...). Cada grupo é um "ponto" do PDI.
//
// Senha do coordenador: não fica no código. CHAVE_PDI (config.ts) guarda uma chave
// pública RSA e a chave privada cifrada com AES-GCM, numa chave derivada da
// senha por PBKDF2. Abrir a privada é a própria verificação da senha. A página
// publicada leva o PDI e os vínculos cifrados com a pública: quem gera a página
// não precisa da senha, e quem só tem o link não consegue ler sem ela.

// ---------- Modelo ----------

interface Pdi {
  versao: number;
  campos: Record<string, string>;
}

type TipoPonto = "gap" | "exp";

interface PontoPdi {
  id: string; // "gap_<id>" ou "exp_<id>": o mesmo valor de VinculoPdi.ponto
  tipo: TipoPonto;
  rotulo: string; // dimensão (gap) ou experiência/desafio (exp)
  detalhe: string; // gap a desenvolver (gap) ou objetivo de desenvolvimento (exp)
}

// Cada PDI novo (checkpoint) é uma versão. O JSON da gestora vai intacto em `pdi`.
interface VersaoPdi {
  id: string; // referenciado por VinculoPdi.versao
  criadaEm: string; // ISO
  pdi: Pdi;
}

// O que vai cifrado na página publicada.
interface ConteudoPdiPublicado {
  versoes: VersaoPdi[];
  vinculos: Record<string, VinculoPdi>; // id da entrega -> vínculo (sempre com versão)
}

// Cor e ícone de cada ponto, iguais no formulário e no dashboard.
interface EstiloPonto {
  categoria: string; // "Técnica", "Comportamental", "Gap", "Experiência"...
  cor: string; // token CSS
  icone: NomeIcone;
}

interface EnvelopePdi {
  chave: string; // chave AES do conteúdo, cifrada com a pública (RSA-OAEP)
  iv: string;
  dados: string;
}

// ---------- Campos do formulário ----------

// Mesmos rótulos e chaves do PDF/JSON da gestora, na mesma ordem: o JSON
// exportado sai com as chaves na ordem do formulário.
type TipoCampoPdi = "texto" | "area" | "data" | "lista";

interface CampoPdi {
  chave: string;
  rotulo: string;
  tipo: TipoCampoPdi;
  placeholder?: string;
}

interface SecaoPdi {
  titulo: string;
  campos: CampoPdi[];
  linhas?: TipoPonto; // seção de linhas repetidas, depois dos campos
}

const SECOES_PDI: SecaoPdi[] = [
  {
    titulo: "Contexto",
    campos: [
      { chave: "colaborador", rotulo: "Colaborador", tipo: "texto" },
      { chave: "lideranca", rotulo: "Liderança", tipo: "texto" },
      { chave: "funcao", rotulo: "Função / nível atual", tipo: "texto" },
      { chave: "data", rotulo: "Data do checkpoint", tipo: "data" },
      { chave: "aspiracao", rotulo: "Aspiração de carreira", tipo: "area" },
    ],
  },
  {
    titulo: "Jornada de evolução",
    campos: [
      { chave: "onde_estou", rotulo: "Onde estou", tipo: "area" },
      { chave: "onde_chegar", rotulo: "Onde quero chegar", tipo: "area" },
      { chave: "o_que_falta", rotulo: "O que falta", tipo: "area" },
      { chave: "como_avancar", rotulo: "Como vamos avançar", tipo: "area" },
      { chave: "prontidao", rotulo: "Prontidão atual", tipo: "lista" },
    ],
  },
  { titulo: "Evidências e gaps", campos: [], linhas: "gap" },
  { titulo: "Plano de experiências", campos: [], linhas: "exp" },
  {
    titulo: "Responsabilidade compartilhada",
    campos: [
      { chave: "comp_colaborador", rotulo: "Compromissos do colaborador", tipo: "area" },
      { chave: "comp_lideranca", rotulo: "Compromissos da liderança", tipo: "area" },
    ],
  },
  {
    titulo: "Checkpoint e confiança",
    campos: [
      { chave: "clareza", rotulo: "Clareza", tipo: "lista" },
      { chave: "oportunidades", rotulo: "Oportunidades", tipo: "lista" },
      { chave: "feedback", rotulo: "Feedback", tipo: "lista" },
      { chave: "avancos", rotulo: "Principais avanços", tipo: "area" },
      { chave: "ajustes", rotulo: "Próximos ajustes", tipo: "area" },
      { chave: "combinados", rotulo: "Decisões, responsáveis e próximos passos", tipo: "area" },
    ],
  },
  {
    titulo: "Fechamento",
    campos: [
      { chave: "proxima_revisao", rotulo: "Próxima revisão", tipo: "data" },
      { chave: "versao", rotulo: "Versão", tipo: "texto", placeholder: "Ex.: 1.0" },
    ],
  },
];

// Colunas de cada linha: a chave final é `${tipo}_${id}_${coluna}`.
const COLUNAS_PONTO: Record<TipoPonto, CampoPdi[]> = {
  gap: [
    { chave: "dimensao", rotulo: "Dimensão", tipo: "area" },
    { chave: "evidencia", rotulo: "Evidência atual", tipo: "area" },
    { chave: "gap", rotulo: "Gap a desenvolver", tipo: "area" },
    { chave: "criterio", rotulo: "Critério de evolução", tipo: "area" },
  ],
  exp: [
    { chave: "desafio", rotulo: "Experiência / desafio", tipo: "area" },
    { chave: "objetivo", rotulo: "Objetivo de desenvolvimento", tipo: "area" },
    { chave: "responsavel", rotulo: "Responsável por viabilizar", tipo: "area" },
    { chave: "prazo", rotulo: "Prazo", tipo: "data" },
  ],
};

// Os selects do site da gestora só aparecem com o valor escolhido nas imagens
// (Alta, Fortes, Adequado; prontidão vazia). As demais opções são palpites:
// por isso são só sugestões (datalist) e qualquer texto continua aceito.
const SUGESTOES_PDI: Record<string, readonly string[]> = {
  prontidao: ["Pronto agora", "Pronto em até 12 meses", "Pronto em mais de 12 meses"],
  clareza: ["Alta", "Média", "Baixa"],
  oportunidades: ["Fortes", "Moderadas", "Fracas"],
  feedback: ["Adequado", "Parcial", "Insuficiente"],
};

const ROTULO_LINHA: Record<TipoPonto, string> = { gap: "gap", exp: "experiência" };

// ---------- Persistência ----------

const CHAVE_STORAGE_PDI = "registro-entregas:pdi";

function pdiValido(valor: unknown): valor is Pdi {
  if (typeof valor !== "object" || valor === null) return false;
  const { versao, campos } = valor as Record<string, unknown>;
  return (
    typeof versao === "number" &&
    typeof campos === "object" &&
    campos !== null &&
    !Array.isArray(campos) &&
    Object.values(campos).every((v) => typeof v === "string")
  );
}

// Da mais antiga para a mais recente.
const CHAVE_STORAGE_VERSOES_PDI = "registro-entregas:pdis";

function versaoPdiValida(valor: unknown): valor is VersaoPdi {
  if (typeof valor !== "object" || valor === null) return false;
  const { id, criadaEm, pdi } = valor as Record<string, unknown>;
  return typeof id === "string" && typeof criadaEm === "string" && pdiValido(pdi);
}

function gerarIdVersaoPdi(): string {
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Antes das versões havia um PDI só (CHAVE_STORAGE_PDI): vira a primeira versão.
function carregarVersoesPdi(): VersaoPdi[] {
  try {
    const dados: unknown = JSON.parse(localStorage.getItem(CHAVE_STORAGE_VERSOES_PDI) ?? "null");
    if (Array.isArray(dados)) return dados.filter(versaoPdiValida);
    const antigo: unknown = JSON.parse(localStorage.getItem(CHAVE_STORAGE_PDI) ?? "null");
    if (!pdiValido(antigo)) return [];
    const versoes = [{ id: gerarIdVersaoPdi(), criadaEm: new Date().toISOString(), pdi: antigo }];
    salvarVersoesPdi(versoes);
    localStorage.removeItem(CHAVE_STORAGE_PDI);
    return versoes;
  } catch {
    return [];
  }
}

function salvarVersoesPdi(versoes: VersaoPdi[]): void {
  localStorage.setItem(CHAVE_STORAGE_VERSOES_PDI, JSON.stringify(versoes));
}

// Vínculo de antes das versões (versao null) conta como da primeira versão.
function idDaVersaoDoVinculo(vinculo: VinculoPdi, versoes: VersaoPdi[]): string {
  return vinculo.versao ?? versoes[0]?.id ?? "";
}

// "v1.0 · checkpoint 09/10/2026" ou, sem versão no PDI, "Versão 2 · checkpoint ...".
function rotuloVersaoPdi(versao: VersaoPdi, versoes: VersaoPdi[]): string {
  const declarada = versao.pdi.campos.versao?.trim();
  const data = versao.pdi.campos.data;
  return [
    declarada ? `v${declarada}` : `Versão ${versoes.indexOf(versao) + 1}`,
    data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? `checkpoint ${formatarData(data)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

// ---------- Pontos ----------

// Ids das linhas na ordem em que aparecem no JSON.
function idsDasLinhas(campos: Record<string, string>, tipo: TipoPonto): string[] {
  const padrao = new RegExp(`^${tipo}_([a-z0-9]+)_`);
  return [...new Set(Object.keys(campos).flatMap((chave) => padrao.exec(chave)?.[1] ?? []))];
}

// Linhas totalmente vazias não são pontos: não aparecem para vincular nem no dashboard.
function pontosDoPdi(pdi: Pdi | null): PontoPdi[] {
  if (!pdi) return [];
  const { campos } = pdi;
  const valor = (tipo: TipoPonto, id: string, coluna: string): string => (campos[`${tipo}_${id}_${coluna}`] ?? "").trim();
  const pontos: PontoPdi[] = [];
  for (const id of idsDasLinhas(campos, "gap")) {
    const dimensao = valor("gap", id, "dimensao");
    const evidencia = valor("gap", id, "evidencia");
    const gap = valor("gap", id, "gap");
    if (!dimensao && !evidencia && !gap && !valor("gap", id, "criterio")) continue;
    pontos.push({ id: `gap_${id}`, tipo: "gap", rotulo: dimensao || "Gap", detalhe: gap || evidencia });
  }
  for (const id of idsDasLinhas(campos, "exp")) {
    const desafio = valor("exp", id, "desafio");
    const objetivo = valor("exp", id, "objetivo");
    if (!desafio && !objetivo && !valor("exp", id, "responsavel")) continue;
    pontos.push({ id: `exp_${id}`, tipo: "exp", rotulo: desafio || "Experiência", detalhe: objetivo });
  }
  return pontos;
}

const semAcentoMinusculo = (texto: string): string =>
  texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

function estiloDoPonto(ponto: PontoPdi): EstiloPonto {
  if (ponto.tipo === "exp") return { categoria: "Experiência", cor: "var(--okr-2)", icone: "pico" };
  const dimensao = semAcentoMinusculo(ponto.rotulo);
  if (dimensao.startsWith("tecnic")) return { categoria: "Técnica", cor: "var(--okr-1)", icone: "camadas" };
  if (dimensao.startsWith("comportament")) return { categoria: "Comportamental", cor: "var(--okr-4)", icone: "ciclo" };
  const nome = ponto.rotulo === "Gap" ? "Gap" : ponto.rotulo.charAt(0).toUpperCase() + ponto.rotulo.slice(1);
  return { categoria: nome, cor: "var(--okr-3)", icone: "alvo" };
}

// Etiqueta curta: "Gap · Técnica", "Gap" (sem dimensão) ou "Experiência".
function etiquetaDoPonto(ponto: PontoPdi): string {
  const { categoria } = estiloDoPonto(ponto);
  return ponto.tipo === "exp" || categoria === "Gap" ? categoria : `Gap · ${categoria}`;
}

// Texto principal: o gap a desenvolver ou a experiência.
function tituloDoPonto(ponto: PontoPdi): string {
  return ponto.tipo === "gap" ? ponto.detalhe || ponto.rotulo : ponto.rotulo;
}

// ---------- Vínculo no formulário da entrega ----------

// "Sem vínculo" e um bloco recolhível (<details>) por versão do PDI, com os
// pontos em cartões. O mesmo ponto pode existir em várias versões, então o
// radio pdiPonto leva "versão|ponto" (ver validar em app.ts). A intensidade
// (pdiIntensidade) só aparece com um ponto escolhido.
const escolhaVinculoPdi = el<HTMLDivElement>("pdi-vinculo-escolha");
const escolhaIntensidadesPdi = el<HTMLDivElement>("pdi-intensidades-escolha");
const blocoIntensidadePdi = el<HTMLElement>("pdi-intensidade-bloco");
// Sem ponto escolhido, a intensidade volta (escondida) para o lugar dela no HTML.
const lugarDaIntensidadePdi = blocoIntensidadePdi.parentElement;

const DICA_INTENSIDADE: Record<IntensidadePdi, string> = {
  baixo: "tocou no ponto",
  médio: "avançou o ponto",
  forte: "foi decisiva para o ponto",
};

// Vínculo salvo ou o que está marcado agora (a intensidade pode ainda não ter sido escolhida).
type VinculoEmEdicao = { versao: string | null; ponto: string; intensidade: string };

function criarCartaoEscolhaPonto(valor: string, ponto: PontoPdi | null, marcado: boolean): HTMLLabelElement {
  const conteudo = document.createElement("span");
  conteudo.className = "ponto-escolha-conteudo";
  const etiqueta = document.createElement("span");
  etiqueta.className = "ponto-escolha-etiqueta";
  const titulo = document.createElement("span");
  titulo.className = "ponto-escolha-titulo";

  let cor = "var(--texto-suave)";
  if (ponto) {
    const estilo = estiloDoPonto(ponto);
    cor = estilo.cor;
    const icone = document.createElement("span");
    icone.className = "ponto-escolha-icone";
    icone.append(criarIcone(estilo.icone));
    etiqueta.append(icone, etiquetaDoPonto(ponto));
    titulo.textContent = tituloDoPonto(ponto);
    titulo.title = titulo.textContent;
  } else if (valor) {
    etiqueta.textContent = "Fora desta versão";
    titulo.textContent = "Ponto que não existe mais nesta versão do PDI";
  } else {
    etiqueta.textContent = "Sem vínculo";
    titulo.textContent = "Esta entrega não move nenhum ponto do PDI";
  }
  conteudo.append(etiqueta, titulo);

  const cartao = criarEscolha("radio", "pdiPonto", valor, conteudo, marcado);
  cartao.classList.add("ponto-escolha");
  // A cor vai no cartão inteiro: a faixa lateral acompanha a altura da linha da grade.
  cartao.style.setProperty("--cor-ponto", cor);
  if (!valor) cartao.classList.add("ponto-escolha-nenhum");
  return cartao;
}

function criarBlocoVersao(
  versao: VersaoPdi | null,
  idVersao: string,
  rotulo: string,
  selecionado: VinculoEmEdicao | null,
  aberto: boolean,
  maisRecente: boolean,
): HTMLDetailsElement {
  const bloco = document.createElement("details");
  bloco.className = "pdi-versao-bloco";
  bloco.open = aberto;
  bloco.dataset.versao = idVersao;

  const resumo = document.createElement("summary");
  const nome = document.createElement("strong");
  nome.textContent = rotulo;
  const pontos = versao ? pontosDoPdi(versao.pdi) : [];
  const info = document.createElement("span");
  info.className = "dica";
  info.textContent = versao ? `${pontos.length} pontos` : "versão excluída";
  // Preenchido por atualizarIntensidadePdi: mostra o ponto escolhido com o bloco fechado.
  const escolhido = document.createElement("span");
  escolhido.className = "pdi-versao-escolhido";
  resumo.append(nome);
  if (maisRecente) {
    const marca = document.createElement("span");
    marca.className = "etiqueta";
    marca.textContent = "mais recente";
    resumo.append(marca);
  }
  resumo.append(info, escolhido);

  const grade = document.createElement("div");
  grade.className = "pontos-escolha";
  const pontoMarcado = selecionado?.versao === idVersao ? selecionado.ponto : "";
  grade.append(...pontos.map((ponto) => criarCartaoEscolhaPonto(`${idVersao}|${ponto.id}`, ponto, ponto.id === pontoMarcado)));
  if (pontoMarcado && !pontos.some((p) => p.id === pontoMarcado)) {
    grade.append(criarCartaoEscolhaPonto(`${idVersao}|${pontoMarcado}`, null, true));
  }
  bloco.append(resumo, grade);
  return bloco;
}

// A intensidade é do ponto escolhido: fica dentro do bloco da versão dele, logo
// abaixo dos cartões. Sem ponto, some e fica desabilitada (não entra no FormData).
function atualizarIntensidadePdi(): void {
  const marcado = escolhaVinculoPdi.querySelector<HTMLInputElement>("input:checked");
  const temPonto = !!marcado?.value;
  const blocoDaVersao = temPonto ? marcado?.closest<HTMLDetailsElement>(".pdi-versao-bloco") : null;
  if (blocoDaVersao) blocoDaVersao.append(blocoIntensidadePdi);
  else lugarDaIntensidadePdi?.append(blocoIntensidadePdi);
  blocoIntensidadePdi.hidden = !temPonto;
  for (const radio of escolhaIntensidadesPdi.querySelectorAll("input")) radio.disabled = !temPonto;
  for (const bloco of escolhaVinculoPdi.querySelectorAll<HTMLDetailsElement>(".pdi-versao-bloco")) {
    const escolhidoAqui = marcado && bloco.contains(marcado) ? marcado : null;
    const texto = escolhidoAqui?.closest("label")?.querySelector(".ponto-escolha-titulo")?.textContent ?? "";
    const alvo = bloco.querySelector(".pdi-versao-escolhido");
    if (alvo) alvo.textContent = texto ? `✓ ${texto}` : "";
  }
}

function preencherVinculoPdi(vinculo: VinculoEmEdicao | null): void {
  const versoes = carregarVersoesPdi();
  const selecionado = vinculo && { ...vinculo, versao: vinculo.versao ?? versoes[0]?.id ?? "" };
  const aberta = selecionado?.versao ?? versoes.at(-1)?.id ?? "";

  const blocos = [...versoes].reverse().map((versao) =>
    criarBlocoVersao(versao, versao.id, rotuloVersaoPdi(versao, versoes), selecionado, versao.id === aberta, versao === versoes.at(-1)),
  );
  // Vínculo numa versão que foi excluída continua visível enquanto a entrega o usar.
  if (selecionado?.versao && !versoes.some((v) => v.id === selecionado.versao)) {
    blocos.push(criarBlocoVersao(null, selecionado.versao, "Versão excluída", selecionado, true, false));
  }

  escolhaVinculoPdi.replaceChildren(criarCartaoEscolhaPonto("", null, !selecionado), ...blocos);
  if (versoes.length === 0) {
    const aviso = document.createElement("p");
    aviso.className = "dica";
    aviso.textContent = "Cadastre o PDI no fim desta aba para vincular entregas.";
    escolhaVinculoPdi.append(aviso);
  }

  escolhaIntensidadesPdi.replaceChildren(
    ...INTENSIDADES_PDI.map((intensidade) => {
      const texto = document.createElement("span");
      texto.className = `intensidade-escolha intensidade-${semAcentoMinusculo(intensidade)}`;
      const nome = document.createElement("strong");
      nome.textContent = intensidade.charAt(0).toUpperCase() + intensidade.slice(1);
      const dica = document.createElement("small");
      dica.textContent = DICA_INTENSIDADE[intensidade];
      texto.append(nome, dica);
      return criarEscolha("radio", "pdiIntensidade", intensidade, texto, vinculo?.intensidade === intensidade);
    }),
  );
  atualizarIntensidadePdi();
}

// O que está marcado agora no formulário da entrega (para refazer as opções sem perder).
function vinculoNoFormulario(): VinculoEmEdicao | null {
  const marcado = (nome: string): string =>
    document.querySelector<HTMLInputElement>(`#form-registro input[name="${nome}"]:checked`)?.value ?? "";
  const [versao = "", ponto = ""] = marcado("pdiPonto").split("|");
  return ponto ? { versao: versao || null, ponto, intensidade: marcado("pdiIntensidade") } : null;
}

// ---------- Formulário do PDI (aba de edição) ----------

const formularioPdi = el<HTMLFormElement>("form-pdi");
const camposPdi = el<HTMLDivElement>("pdi-campos");
const statusPdi = el<HTMLSpanElement>("pdi-status");
const campoImportarPdi = el<HTMLInputElement>("importar-pdi");

const cartoesVersoesPdi = el<HTMLDivElement>("pdi-versoes-cartoes");
const versaoAbertaPdi = el<HTMLParagraphElement>("pdi-versao-aberta");

// Versão em edição (id de VersaoPdi); null = nenhuma salva ainda.
let versaoPdiEmEdicao: string | null = null;

// Versão do arquivo e chaves que o formulário não conhece: voltam intactas ao salvar.
let versaoArquivoPdi = 1;
let camposExtrasPdi: Record<string, string> = {};

// Mesmo formato dos ids do site da gestora (ex.: "mv16ltqvp5bg0").
function gerarIdLinhaPdi(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function criarCampoPdi(nome: string, campo: CampoPdi, valor: string): HTMLElement {
  const caixa = document.createElement("div");
  caixa.className = campo.tipo === "area" ? "campo largo" : "campo";

  const id = `pdi-${nome}`;
  const rotulo = document.createElement("label");
  rotulo.htmlFor = id;
  rotulo.textContent = campo.rotulo;

  let entrada: HTMLInputElement | HTMLTextAreaElement;
  if (campo.tipo === "area") {
    entrada = document.createElement("textarea");
    entrada.rows = 2;
  } else {
    entrada = document.createElement("input");
    entrada.type = campo.tipo === "data" ? "date" : "text";
    const sugestoes = SUGESTOES_PDI[campo.chave];
    if (campo.tipo === "lista" && sugestoes) {
      const lista = document.createElement("datalist");
      lista.id = `${id}-sugestoes`;
      for (const sugestao of sugestoes) lista.append(new Option(sugestao));
      entrada.setAttribute("list", lista.id);
      caixa.append(lista);
    }
  }
  entrada.id = id;
  entrada.name = nome;
  entrada.value = valor;
  if (campo.placeholder) entrada.placeholder = campo.placeholder;

  caixa.prepend(rotulo);
  caixa.append(entrada);
  return caixa;
}

// Numa linha, o rótulo vira aria-label e só aparece no cabeçalho da tabela.
function adicionarLinhaPdi(lista: HTMLElement, tipo: TipoPonto, id: string, campos: Record<string, string>): void {
  const linha = document.createElement("div");
  linha.className = "pdi-linha";
  for (const coluna of COLUNAS_PONTO[tipo]) {
    const nome = `${tipo}_${id}_${coluna.chave}`;
    const caixa = criarCampoPdi(nome, coluna, campos[nome] ?? "");
    caixa.className = "campo";
    caixa.querySelector("label")?.remove();
    const entrada = caixa.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
    if (entrada) entrada.ariaLabel = coluna.rotulo;
    linha.append(caixa);
  }
  linha.append(criarBotao("Remover", "perigo", () => linha.remove()));
  lista.append(linha);
}

function criarSecaoLinhas(tipo: TipoPonto, campos: Record<string, string>): HTMLElement[] {
  const cabecalho = document.createElement("div");
  cabecalho.className = "pdi-linha pdi-linha-cabecalho";
  cabecalho.setAttribute("aria-hidden", "true");
  for (const coluna of COLUNAS_PONTO[tipo]) {
    const titulo = document.createElement("span");
    titulo.textContent = coluna.rotulo;
    cabecalho.append(titulo);
  }

  const lista = document.createElement("div");
  lista.className = "pdi-linhas";
  const ids = idsDasLinhas(campos, tipo);
  for (const id of ids.length > 0 ? ids : [gerarIdLinhaPdi()]) adicionarLinhaPdi(lista, tipo, id, campos);

  const adicionar = criarBotao(`+ Adicionar ${ROTULO_LINHA[tipo]}`, "secundario", () =>
    adicionarLinhaPdi(lista, tipo, gerarIdLinhaPdi(), {}),
  );
  return [cabecalho, lista, adicionar];
}

function renderizarFormularioPdi(pdi: Pdi | null): void {
  const campos = pdi?.campos ?? {};
  versaoArquivoPdi = pdi?.versao ?? 1;

  const conhecidas = new Set<string>();
  const secoes = SECOES_PDI.map((secao, indice) => {
    const bloco = document.createElement("fieldset");
    bloco.className = "pdi-secao";
    // criarElemento (dashboard.ts) ainda não existe quando isto roda na carga da página.
    const legenda = document.createElement("legend");
    legenda.textContent = `${indice + 1}. ${secao.titulo}`;
    bloco.append(legenda);
    const grade = document.createElement("div");
    grade.className = "grade";
    for (const campo of secao.campos) {
      conhecidas.add(campo.chave);
      grade.append(criarCampoPdi(campo.chave, campo, campos[campo.chave] ?? ""));
    }
    if (secao.campos.length > 0) bloco.append(grade);
    if (secao.linhas) bloco.append(...criarSecaoLinhas(secao.linhas, campos));
    return bloco;
  });

  const linha = /^(gap|exp)_[a-z0-9]+_/;
  camposExtrasPdi = Object.fromEntries(
    Object.entries(campos).filter(([chave]) => !conhecidas.has(chave) && !linha.test(chave)),
  );
  camposPdi.replaceChildren(...secoes);
}

// Textos como foram digitados (sem trim), na ordem do formulário.
function pdiDoFormulario(): Pdi {
  const campos: Record<string, string> = {};
  for (const elemento of formularioPdi.elements) {
    if ((elemento instanceof HTMLInputElement || elemento instanceof HTMLTextAreaElement) && elemento.name) {
      campos[elemento.name] = elemento.value;
    }
  }
  return { versao: versaoArquivoPdi, campos: { ...campos, ...camposExtrasPdi } };
}

// Refaz o seletor de versões e o formulário com a versão escolhida (ou a mais recente).
function mostrarVersaoPdi(id: string | null): void {
  const versoes = carregarVersoesPdi();
  const versao = versoes.find((v) => v.id === id) ?? versoes.at(-1) ?? null;
  versaoPdiEmEdicao = versao?.id ?? null;

  // Um cartão por versão, da mais recente para a mais antiga; o aberto fica destacado.
  cartoesVersoesPdi.replaceChildren(...[...versoes].reverse().map((v) => criarCartaoVersaoPdi(v, versoes)));
  if (versoes.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "dica";
    vazio.textContent = "Nenhuma versão salva ainda: preencha o formulário abaixo e salve, ou importe o JSON da gestora.";
    cartoesVersoesPdi.append(vazio);
  }
  versaoAbertaPdi.textContent = versao ? `Editando: ${rotuloVersaoPdi(versao, versoes)}` : "";
  el<HTMLButtonElement>("btn-excluir-versao-pdi").disabled = versoes.length === 0;
  el<HTMLButtonElement>("btn-nova-versao-pdi").disabled = versoes.length === 0;
  el<HTMLButtonElement>("btn-salvar-pdi").textContent = versao ? "Salvar alterações nesta versão" : "Salvar PDI";

  renderizarFormularioPdi(versao?.pdi ?? null);
}

function criarCartaoVersaoPdi(versao: VersaoPdi, versoes: VersaoPdi[]): HTMLButtonElement {
  const aberta = versao.id === versaoPdiEmEdicao;
  const cartao = criarBotao("", "pdi-versao-cartao", () => mostrarVersaoPdi(versao.id));
  cartao.setAttribute("aria-pressed", String(aberta));

  const numero = versao.pdi.campos.versao?.trim() ? `v${versao.pdi.campos.versao.trim()}` : `Versão ${versoes.indexOf(versao) + 1}`;
  const topo = document.createElement("span");
  topo.className = "pdi-versao-cartao-topo";
  const nome = document.createElement("strong");
  nome.textContent = numero;
  topo.append(nome);
  if (versao === versoes.at(-1)) {
    const recente = document.createElement("span");
    recente.className = "etiqueta";
    recente.textContent = "mais recente";
    topo.append(recente);
  }

  const data = versao.pdi.campos.data;
  const checkpoint = document.createElement("span");
  checkpoint.className = "pdi-versao-cartao-data";
  checkpoint.textContent = data && /^\d{4}-\d{2}-\d{2}$/.test(data) ? `Checkpoint ${formatarData(data)}` : "Sem data de checkpoint";

  const numeros = document.createElement("span");
  numeros.className = "dica";
  const entregas = vinculosDaVersao(versao.id, versoes);
  numeros.textContent = `${pontosDoPdi(versao.pdi).length} pontos · ${entregas} ${entregas === 1 ? "entrega" : "entregas"}`;

  const estado = document.createElement("span");
  estado.className = "pdi-versao-cartao-estado";
  estado.textContent = aberta ? "Aberta abaixo" : "Clique para abrir";

  cartao.append(topo, checkpoint, numeros, estado);
  return cartao;
}

function vinculosDaVersao(id: string, versoes: VersaoPdi[]): number {
  return registros.filter((r) => r.pdi && idDaVersaoDoVinculo(r.pdi, versoes) === id).length;
}

// Nova versão entra no fim (mais recente) e passa a ser a sugerida nas entregas novas.
function adicionarVersaoPdi(pdi: Pdi): void {
  const versoes = carregarVersoesPdi();
  const nova: VersaoPdi = { id: gerarIdVersaoPdi(), criadaEm: new Date().toISOString(), pdi };
  salvarVersoesPdi([...versoes, nova]);
  mostrarVersaoPdi(nova.id);
  preencherVinculoPdi(null);
}

const agora = (): string => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function aoSalvarPdi(evento: SubmitEvent): void {
  evento.preventDefault();
  const pdi = pdiDoFormulario();
  const versoes = carregarVersoesPdi();
  if (!versoes.some((v) => v.id === versaoPdiEmEdicao)) {
    adicionarVersaoPdi(pdi);
  } else {
    salvarVersoesPdi(versoes.map((v) => (v.id === versaoPdiEmEdicao ? { ...v, pdi } : v)));
    mostrarVersaoPdi(versaoPdiEmEdicao);
  }
  renderizarTabela(); // os textos da coluna PDI podem ter mudado
  // Sem limpar o que está sendo digitado na entrega: só refaz as opções.
  const atual = vinculoNoFormulario();
  preencherVinculoPdi(atual);
  statusPdi.textContent = `PDI salvo às ${agora()}.`;
}

function criarNovaVersaoPdi(): void {
  adicionarVersaoPdi(pdiDoFormulario());
  statusPdi.textContent = "Nova versão criada a partir da anterior: ajuste o que mudou e salve.";
}

function excluirVersaoPdi(): void {
  const versoes = carregarVersoesPdi();
  const versao = versoes.find((v) => v.id === versaoPdiEmEdicao);
  if (!versao) return;
  const ligadas = vinculosDaVersao(versao.id, versoes);
  if (ligadas > 0) {
    alert(`Não dá para excluir: ${ligadas} entrega(s) estão ligadas a esta versão. Troque a versão delas antes.`);
    return;
  }
  if (!confirm(`Excluir a versão "${rotuloVersaoPdi(versao, versoes)}" do PDI?`)) return;
  salvarVersoesPdi(versoes.filter((v) => v.id !== versao.id));
  mostrarVersaoPdi(null);
  preencherVinculoPdi(vinculoNoFormulario());
  statusPdi.textContent = "Versão excluída.";
}

function exportarPdi(): void {
  const versao = carregarVersoesPdi().find((v) => v.id === versaoPdiEmEdicao);
  if (!versao) {
    alert("Salve o PDI antes de exportar.");
    return;
  }
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(versao.pdi, null, 2)], { type: "application/json" }));
  link.download = `pdi-${versao.pdi.campos.data || new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Todo arquivo importado vira uma versão nova: as entregas já ligadas continuam
// na versão em que foram registradas.
async function importarPdi(): Promise<void> {
  const arquivo = campoImportarPdi.files?.[0];
  if (!arquivo) return;
  let dados: unknown;
  try {
    dados = JSON.parse(await arquivo.text());
  } catch {
    dados = null;
  }
  campoImportarPdi.value = "";

  if (!pdiValido(dados)) {
    alert('Arquivo inválido: o JSON do PDI precisa ser { "versao": número, "campos": { ... só textos } }.');
    return;
  }
  adicionarVersaoPdi(dados);
  statusPdi.textContent = "PDI importado como nova versão (a mais recente).";
}

// ---------- Cifra (Web Crypto) ----------

const RSA_OAEP: RsaHashedImportParams = { name: "RSA-OAEP", hash: "SHA-256" };

function paraBase64(dados: ArrayBuffer | Uint8Array): string {
  let binario = "";
  for (const byte of dados instanceof Uint8Array ? dados : new Uint8Array(dados)) binario += String.fromCharCode(byte);
  return btoa(binario);
}

function deBase64(texto: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(texto), (caractere) => caractere.charCodeAt(0));
}

// null = senha errada (o AES-GCM recusa a chave derivada) ou senha não configurada.
async function abrirChavePdi(senha: string): Promise<CryptoKey | null> {
  if (!CHAVE_PDI) return null;
  try {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveKey"]);
    const chaveDaSenha = await crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt: deBase64(CHAVE_PDI.salt), iterations: CHAVE_PDI.iteracoes },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
    const pkcs8 = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: deBase64(CHAVE_PDI.iv) },
      chaveDaSenha,
      deBase64(CHAVE_PDI.chavePrivada),
    );
    return await crypto.subtle.importKey("pkcs8", pkcs8, RSA_OAEP, false, ["decrypt"]);
  } catch {
    return null;
  }
}

// RSA só cifra poucos bytes: o conteúdo vai em AES-GCM e a chave AES, na RSA.
async function cifrarParaCoordenador(chave: ChavePdi, conteudo: ConteudoPdiPublicado): Promise<EnvelopePdi> {
  const publica = await crypto.subtle.importKey("spki", deBase64(chave.chavePublica), RSA_OAEP, false, ["encrypt"]);
  const chaveConteudo = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    chaveConteudo,
    new TextEncoder().encode(JSON.stringify(conteudo)),
  );
  const bruta = await crypto.subtle.exportKey("raw", chaveConteudo);
  const chaveCifrada = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publica, bruta);
  return { chave: paraBase64(chaveCifrada), iv: paraBase64(iv), dados: paraBase64(dados) };
}

async function decifrarDoCoordenador(envelope: EnvelopePdi, privada: CryptoKey): Promise<unknown> {
  const bruta = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privada, deBase64(envelope.chave));
  const chaveConteudo = await crypto.subtle.importKey("raw", bruta, "AES-GCM", false, ["decrypt"]);
  const dados = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: deBase64(envelope.iv) },
    chaveConteudo,
    deBase64(envelope.dados),
  );
  return JSON.parse(new TextDecoder().decode(dados));
}

// Tag com as versões do PDI e os vínculos cifrados, para gerarPaginaPublicada
// (app.ts). Vazia sem senha configurada ou sem PDI: a seção publicada avisa.
async function tagDoPdiPublicado(): Promise<string> {
  const versoes = carregarVersoesPdi();
  if (!CHAVE_PDI || versoes.length === 0) return "";
  // Vínculos antigos (sem versão) já vão com a versão resolvida.
  const vinculos = Object.fromEntries(
    registros.flatMap((r) => (r.pdi ? [[r.id, { ...r.pdi, versao: idDaVersaoDoVinculo(r.pdi, versoes) }]] : [])),
  );
  const envelope = await cifrarParaCoordenador(CHAVE_PDI, { versoes, vinculos });
  // Só base64 e JSON: nenhum "<" que feche a tag antes da hora.
  return `<script type="application/json" id="pdi-publicado">${JSON.stringify(envelope)}</script>\n`;
}

// ---------- Coluna PDI na tabela da aba de edição ----------

// "Gap · Técnica: <gap a desenvolver> (forte)"; com várias versões, diz qual.
function textoDoVinculoPdi(vinculo: VinculoPdi | null): string {
  if (!vinculo) return "—";
  const versoes = carregarVersoesPdi();
  const versao = versoes.find((v) => v.id === idDaVersaoDoVinculo(vinculo, versoes));
  const ponto = pontosDoPdi(versao?.pdi ?? null).find((p) => p.id === vinculo.ponto);
  const nome = ponto ? `${etiquetaDoPonto(ponto)}: ${tituloDoPonto(ponto)}` : "Ponto fora do PDI";
  const qual = versoes.length > 1 && versao ? ` · ${rotuloVersaoPdi(versao, versoes)}` : "";
  return `${nome} (${vinculo.intensidade})${qual}`;
}

// ---------- Inicialização ----------

mostrarVersaoPdi(null);
preencherVinculoPdi(null);
renderizarTabela(); // app.ts: primeira vez aqui, porque a coluna PDI usa textoDoVinculoPdi

formularioPdi.addEventListener("submit", aoSalvarPdi);
el<HTMLButtonElement>("btn-nova-versao-pdi").addEventListener("click", criarNovaVersaoPdi);
el<HTMLButtonElement>("btn-excluir-versao-pdi").addEventListener("click", excluirVersaoPdi);
el<HTMLButtonElement>("btn-exportar-pdi").addEventListener("click", exportarPdi);
campoImportarPdi.addEventListener("change", () => void importarPdi());
escolhaVinculoPdi.addEventListener("change", atualizarIntensidadePdi);
