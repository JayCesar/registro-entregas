// OKRs e KRs: cadastro na aba de edição e seletor do formulário da entrega.
//
// A entrega guarda o código do OKR (ex.: "A") e, opcionalmente, o código do KR
// (ex.: "KR1") em OkrImpactado (app.ts). Assim o CSV (okr1, okr1Kr...) e os
// registros antigos, que só tinham o código do OKR, continuam valendo.
//
// Carrega antes de csv.ts: a página publicada valida o CSV embutido ao abrir, e
// validar() já usa okrsDisponiveis().

// ---------- Modelo ----------

interface KeyResult {
  codigo: string; // "KR1"
  titulo: string;
}

interface Objetivo {
  codigo: string; // "A"
  titulo: string;
  krs: KeyResult[];
}

const CHAVE_STORAGE_OKRS = "registro-entregas:okrs";

function objetivoValido(valor: unknown): valor is Objetivo {
  if (typeof valor !== "object" || valor === null) return false;
  const { codigo, titulo, krs } = valor as Record<string, unknown>;
  return (
    typeof codigo === "string" &&
    typeof titulo === "string" &&
    Array.isArray(krs) &&
    krs.every((kr) => {
      const k = kr as Record<string, unknown> | null;
      return typeof k === "object" && k !== null && typeof k.codigo === "string" && typeof k.titulo === "string";
    })
  );
}

// Página publicada: o catálogo vem embutido (#okrs-publicados), não do navegador
// de quem abre. Sem nada cadastrado: os OKRs iniciais de config.ts, sem título.
function carregarObjetivos(): Objetivo[] {
  try {
    const publicado = document.getElementById("okrs-publicados")?.textContent;
    const dados: unknown = JSON.parse(publicado ?? localStorage.getItem(CHAVE_STORAGE_OKRS) ?? "null");
    if (Array.isArray(dados) && dados.every(objetivoValido)) return dados;
  } catch {
    // cai nos iniciais
  }
  return OKRS.map((codigo) => ({ codigo, titulo: "", krs: [] }));
}

// Cadastrados + os que já aparecem em registros (ex.: OKR que saiu do cadastro).
function okrsDisponiveis(): string[] {
  return [
    ...new Set([...carregarObjetivos().map((o) => o.codigo), ...registros.flatMap((r) => r.okrs.map((o) => o.okr))]),
  ];
}

function objetivoDe(codigo: string): Objetivo | undefined {
  return carregarObjetivos().find((o) => o.codigo === codigo);
}

// "OKR A · Aumentar receita" (ou só "OKR A", sem título).
function rotuloOkr(codigo: string): string {
  const titulo = objetivoDe(codigo)?.titulo.trim();
  return titulo ? `OKR ${codigo} · ${titulo}` : `OKR ${codigo}`;
}

function corDoOkr(codigo: string): string {
  const indice = Math.max(0, okrsDisponiveis().indexOf(codigo));
  return CORES_OKR[indice % CORES_OKR.length] ?? "var(--destaque)";
}

// "KR1 · Reduzir chamadas" ou "OKR como um todo".
function rotuloKr(okr: string, kr: string | null | undefined): string {
  if (!kr) return "OKR como um todo";
  const titulo = objetivoDe(okr)?.krs.find((k) => k.codigo === kr)?.titulo.trim();
  return titulo ? `${kr} · ${titulo}` : kr;
}

// ---------- Seletor no formulário da entrega ----------

// Um bloco recolhível por OKR. Dentro: "Não impacta" / "OKR como um todo" / um
// cartão por KR; escolhido algo, aparecem grau e motivo. Os radios têm nome por
// bloco (okrAlvo-<i>, okrGrau-<i>) e anexarOkrsDoFormulario monta as listas
// alinhadas okr/okrKr/okrGrau/okrMotivo que validar() lê (as mesmas do CSV).
const escolhaOkrs = el<HTMLDivElement>("okr-escolha");
const OKR_INTEIRO = "*";

function criarCartaoAlvo(nome: string, valor: string, etiqueta: string, titulo: string, cor: string, marcado: boolean): HTMLLabelElement {
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
  if (!valor) cartao.classList.add("ponto-escolha-nenhum");
  cartao.style.setProperty("--cor-ponto", cor);
  return cartao;
}

function criarBlocoOkr(objetivo: Objetivo, indice: number, impacto: OkrImpactado | undefined): HTMLDetailsElement {
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
  grade.append(
    criarCartaoAlvo(nomeAlvo, "", "Não impacta", "Esta entrega não mexe neste OKR", cor, !alvo),
    criarCartaoAlvo(nomeAlvo, OKR_INTEIRO, "OKR como um todo", "Impacta o objetivo, sem um KR específico", cor, alvo === OKR_INTEIRO),
    ...objetivo.krs.map((kr) => criarCartaoAlvo(nomeAlvo, kr.codigo, kr.codigo, kr.titulo || kr.codigo, cor, alvo === kr.codigo)),
  );
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
  graus.append(
    ...[...GRAUS_IMPACTO].reverse().map((grau) => {
      const texto = document.createElement("span");
      texto.className = `intensidade-escolha intensidade-${grau === "Alto" ? "forte" : grau === "Médio" ? "medio" : "baixo"}`;
      const forte = document.createElement("strong");
      forte.textContent = grau;
      texto.append(forte);
      return criarEscolha("radio", `okrGrau-${indice}`, grau, texto, impacto?.grau === grau);
    }),
  );
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
function atualizarBlocosOkr(): void {
  for (const bloco of escolhaOkrs.querySelectorAll<HTMLDetailsElement>(".okr-bloco")) {
    const alvo = bloco.querySelector<HTMLInputElement>('input[name^="okrAlvo-"]:checked')?.value ?? "";
    const detalhe = bloco.querySelector<HTMLElement>(".okr-detalhe-escolha");
    if (detalhe) detalhe.hidden = !alvo;
    for (const campo of detalhe?.querySelectorAll("input") ?? []) campo.disabled = !alvo;
    const grau = bloco.querySelector<HTMLInputElement>('input[name^="okrGrau-"]:checked')?.value;
    const resumo = bloco.querySelector(".pdi-versao-escolhido");
    if (resumo) {
      const okr = bloco.dataset.okr ?? "";
      resumo.textContent = alvo ? `✓ ${rotuloKr(okr, alvo === OKR_INTEIRO ? null : alvo)}${grau ? ` · ${grau}` : ""}` : "";
    }
    bloco.classList.toggle("com-escolha", !!alvo);
  }
}

// OKRs do cadastro + os que só existem nas entregas (para não perder o vínculo ao editar).
function preencherOkrsEntrega(impactos: OkrImpactado[]): void {
  const objetivos = carregarObjetivos();
  for (const { okr } of impactos) {
    if (!objetivos.some((o) => o.codigo === okr)) objetivos.push({ codigo: okr, titulo: "Fora do cadastro", krs: [] });
  }
  escolhaOkrs.replaceChildren(
    ...objetivos.map((objetivo, indice) => criarBlocoOkr(objetivo, indice, impactos.find((i) => i.okr === objetivo.codigo))),
  );
  atualizarBlocosOkr();
}

// Chamada em aoEnviar (app.ts) antes de validar().
function anexarOkrsDoFormulario(dados: FormData): void {
  for (const bloco of escolhaOkrs.querySelectorAll<HTMLDetailsElement>(".okr-bloco")) {
    const alvo = bloco.querySelector<HTMLInputElement>('input[name^="okrAlvo-"]:checked')?.value ?? "";
    if (!alvo) continue;
    dados.append("okr", bloco.dataset.okr ?? "");
    dados.append("okrKr", alvo === OKR_INTEIRO ? "" : alvo);
    dados.append("okrGrau", bloco.querySelector<HTMLInputElement>('input[name^="okrGrau-"]:checked')?.value ?? "");
    dados.append("okrMotivo", bloco.querySelector<HTMLInputElement>(".okr-motivo")?.value ?? "");
  }
}

// ---------- Cadastro (aba de edição) ----------

const listaCadastroOkrs = el<HTMLDivElement>("okrs-cadastro");
const statusOkrs = el<HTMLSpanElement>("okrs-status");
const campoImportarOkrs = el<HTMLInputElement>("importar-okrs");

function criarCampoTexto(rotulo: string, classe: string, valor: string, placeholder = ""): HTMLElement {
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

function adicionarLinhaKr(lista: HTMLElement, kr?: KeyResult): void {
  const linha = document.createElement("div");
  linha.className = "kr-linha";
  const proximo = `KR${lista.children.length + 1}`;
  const codigo = criarCampoTexto("Código", "kr-codigo", kr?.codigo ?? proximo);
  const titulo = criarCampoTexto("Key result", "kr-titulo", kr?.titulo ?? "", "Ex.: Reduzir em 20% as chamadas ao atendimento");
  linha.append(codigo, titulo, criarBotao("Remover", "perigo", () => linha.remove()));
  lista.append(linha);
}

function adicionarCartaoObjetivo(objetivo?: Objetivo): void {
  const cartao = document.createElement("fieldset");
  cartao.className = "okr-cadastro";
  const indice = listaCadastroOkrs.children.length;
  cartao.style.setProperty("--cor-okr", CORES_OKR[indice % CORES_OKR.length] ?? "var(--destaque)");

  const topo = document.createElement("div");
  topo.className = "okr-cadastro-topo";
  topo.append(
    criarCampoTexto("Código *", "okr-codigo", objetivo?.codigo ?? String.fromCharCode(65 + indice)),
    criarCampoTexto("Objetivo *", "okr-titulo", objetivo?.titulo ?? "", "Ex.: Aumentar a autonomia do cliente no portal"),
    criarBotao("Remover OKR", "perigo", () => cartao.remove()),
  );

  const krs = document.createElement("div");
  krs.className = "kr-linhas";
  for (const kr of objetivo?.krs ?? []) adicionarLinhaKr(krs, kr);

  cartao.append(topo, krs, criarBotao("+ Adicionar KR", "secundario", () => adicionarLinhaKr(krs)));
  listaCadastroOkrs.append(cartao);
}

function renderizarCadastroOkrs(): void {
  listaCadastroOkrs.replaceChildren();
  for (const objetivo of carregarObjetivos()) adicionarCartaoObjetivo(objetivo);
}

function objetivosDoCadastro(): Objetivo[] {
  const valor = (raiz: Element, classe: string): string => raiz.querySelector<HTMLInputElement>(`.${classe}`)?.value.trim() ?? "";
  return [...listaCadastroOkrs.querySelectorAll(".okr-cadastro")].map((cartao) => ({
    codigo: valor(cartao, "okr-codigo"),
    titulo: valor(cartao, "okr-titulo"),
    krs: [...cartao.querySelectorAll(".kr-linha")].map((linha) => ({
      codigo: valor(linha, "kr-codigo"),
      titulo: valor(linha, "kr-titulo"),
    })),
  }));
}

// Códigos obrigatórios e únicos; OKR ou KR usado por alguma entrega não pode sumir.
function errosDosObjetivos(objetivos: Objetivo[]): string[] {
  const erros: string[] = [];
  const codigos = objetivos.map((o) => o.codigo.toLowerCase());
  for (const [indice, objetivo] of objetivos.entries()) {
    const onde = `OKR ${indice + 1}`;
    if (!objetivo.codigo) erros.push(`${onde}: informe o código (ex.: A).`);
    else if (codigos.indexOf(objetivo.codigo.toLowerCase()) !== indice) erros.push(`${onde}: o código "${objetivo.codigo}" está repetido.`);
    if (!objetivo.titulo) erros.push(`${onde}: informe o objetivo.`);
    const krs = objetivo.krs.map((k) => k.codigo.toLowerCase());
    for (const [i, kr] of objetivo.krs.entries()) {
      if (!kr.codigo) erros.push(`${onde}, KR ${i + 1}: informe o código (ex.: KR1).`);
      else if (krs.indexOf(kr.codigo.toLowerCase()) !== i) erros.push(`${onde}: o KR "${kr.codigo}" está repetido.`);
    }
  }
  for (const registro of registros) {
    for (const { okr, kr } of registro.okrs) {
      const objetivo = objetivos.find((o) => o.codigo === okr);
      if (!objetivo) erros.push(`O OKR ${okr} está na entrega "${registro.assunto}": não dá para remover.`);
      else if (kr && !objetivo.krs.some((k) => k.codigo === kr)) {
        erros.push(`O ${kr} do OKR ${okr} está na entrega "${registro.assunto}": não dá para remover.`);
      }
    }
  }
  return [...new Set(erros)];
}

function salvarObjetivos(objetivos: Objetivo[]): boolean {
  const erros = errosDosObjetivos(objetivos);
  if (erros.length > 0) {
    alert(`OKRs não salvos:\n\n${erros.slice(0, MAXIMO_ERROS_EXIBIDOS).join("\n")}`);
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

function okrsDoFormData(dados: FormData): OkrImpactado[] {
  const krs = dados.getAll("okrKr");
  const graus = dados.getAll("okrGrau");
  const motivos = dados.getAll("okrMotivo");
  return dados.getAll("okr").map((okr, i) => ({
    okr: String(okr),
    kr: String(krs[i] ?? "") || null,
    grau: pertence(GRAUS_IMPACTO, String(graus[i] ?? "")) ? (String(graus[i]) as GrauImpacto) : null,
    motivo: String(motivos[i] ?? ""),
  }));
}

function aoSalvarOkrs(): void {
  if (!salvarObjetivos(objetivosDoCadastro())) return;
  renderizarCadastroOkrs();
  statusOkrs.textContent = `OKRs salvos às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`;
}

function exportarOkrs(): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(carregarObjetivos(), null, 2)], { type: "application/json" }));
  link.download = `okrs-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importarOkrs(): Promise<void> {
  const arquivo = campoImportarOkrs.files?.[0];
  if (!arquivo) return;
  let dados: unknown;
  try {
    dados = JSON.parse(await arquivo.text());
  } catch {
    dados = null;
  }
  campoImportarOkrs.value = "";
  if (!Array.isArray(dados) || !dados.every(objetivoValido)) {
    alert('Arquivo inválido: use uma lista [ { "codigo", "titulo", "krs": [ { "codigo", "titulo" } ] } ].');
    return;
  }
  if (!confirm("Substituir os OKRs cadastrados pelos do arquivo?")) return;
  if (!salvarObjetivos(dados)) return;
  renderizarCadastroOkrs();
  statusOkrs.textContent = "OKRs importados.";
}

// ---------- Inicialização ----------

preencherOkrsEntrega([]);
renderizarCadastroOkrs();

escolhaOkrs.addEventListener("change", atualizarBlocosOkr);
el<HTMLButtonElement>("btn-adicionar-objetivo").addEventListener("click", () => adicionarCartaoObjetivo());
el<HTMLButtonElement>("btn-salvar-okrs").addEventListener("click", aoSalvarOkrs);
el<HTMLButtonElement>("btn-exportar-okrs").addEventListener("click", exportarOkrs);
campoImportarOkrs.addEventListener("change", () => void importarOkrs());
