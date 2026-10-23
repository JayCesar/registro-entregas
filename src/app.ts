// ---------- Modelo ----------

// União discriminada: BCP e complexidade só existem quando funcional === true.
type DetalheHistoria =
  | { funcional: true; bcp: string; complexidade: number | null }
  | { funcional: false };

interface Gmud {
  nome: string;
  link: string | null;
}

interface AlteracaoGit {
  linkPullRequest: string | null;
  linkActions: string | null;
}

interface OkrImpactado {
  okr: Okr;
  motivo: string;
  grau: GrauImpacto | null; // null só em registros migrados do modelo antigo (um OKR, sem grau)
}

interface Registro {
  id: string;
  tipo: TipoItem;
  assunto: string;
  descricao: string;
  okrs: OkrImpactado[];
  squad: Squad;
  siglas: Sigla[];
  dataInicio: string; // yyyy-mm-dd
  dataFim: string; // yyyy-mm-dd
  release: Release | null; // null só em registros anteriores a este campo
  sprint: Sprint | null; // idem
  impeditivo: string; // vazio = não houve impeditivo
  historia: DetalheHistoria | null; // só para História
  gmud: Gmud | null; // só para História ou Bug
  git: AlteracaoGit | null; // null = sem alteração em repositório
}

type DadosRegistro = Omit<Registro, "id">;

// Chave = atributo name do campo no formulário.
type Erros = Record<string, string>;

type Validacao = { ok: true; dados: DadosRegistro } | { ok: false; erros: Erros };

// ---------- Persistência ----------

const CHAVE_STORAGE = "registro-entregas:v1";

// Formato antigo: um único `okr` por registro. O OKR é preservado na nova lista;
// motivo e grau não existiam, então ficam vazios até o registro ser editado.
// Release, sprint e impeditivo também não existiam: entram como "sem release/sprint".
// historia, gmud e git podem faltar num JSON escrito à mão: viram null.
type RegistroSalvo = Omit<Registro, "okrs" | "release" | "sprint" | "impeditivo" | "historia" | "gmud" | "git"> & {
  okrs?: OkrImpactado[];
  okr?: Okr;
  release?: Release | null;
  sprint?: Sprint | null;
  impeditivo?: string;
  historia?: DetalheHistoria | null;
  gmud?: Gmud | null;
  git?: AlteracaoGit | null;
};

function migrarRegistro(salvo: RegistroSalvo): Registro {
  const { okr, okrs, ...resto } = salvo;
  return {
    ...resto,
    okrs: Array.isArray(okrs) ? okrs : okr ? [{ okr, motivo: "", grau: null }] : [],
    release: salvo.release ?? null,
    sprint: salvo.sprint ?? null,
    impeditivo: salvo.impeditivo ?? "",
    historia: salvo.historia ?? null,
    gmud: salvo.gmud ?? null,
    git: salvo.git ?? null,
  };
}

function carregarRegistros(): Registro[] {
  try {
    const bruto = localStorage.getItem(CHAVE_STORAGE);
    const dados: unknown = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(dados) ? (dados as RegistroSalvo[]).map(migrarRegistro) : [];
  } catch {
    return [];
  }
}

function salvarRegistros(lista: Registro[]): void {
  localStorage.setItem(CHAVE_STORAGE, JSON.stringify(lista));
}

// ---------- Squads e siglas cadastradas ----------

// Opções criadas pelo usuário no formulário, além das listas de config.ts.
const CHAVE_SQUADS = "registro-entregas:squads";
const CHAVE_SIGLAS = "registro-entregas:siglas";

function carregarLista(chave: string): string[] {
  try {
    const dados: unknown = JSON.parse(localStorage.getItem(chave) ?? "[]");
    return Array.isArray(dados) ? dados.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

const squadsCadastradas = carregarLista(CHAVE_SQUADS);
const siglasCadastradas = carregarLista(CHAVE_SIGLAS);

// Squads/siglas novas que aparecem num CSV valem como opção enquanto ele é lido
// (ver registrosDoCsv em csv.ts). Depois da importação passam a vir dos registros.
const opcoesDoCsvEmLeitura = { squads: new Set<string>(), siglas: new Set<string>() };

// config.ts + cadastradas + as que já aparecem em registros (ex.: vindas de um
// JSON importado), para nenhum registro ficar com valor fora da lista.
function squadsDisponiveis(): string[] {
  return [
    ...new Set([...SQUADS, ...squadsCadastradas, ...registros.map((r) => r.squad), ...opcoesDoCsvEmLeitura.squads]),
  ];
}

function siglasDisponiveis(): string[] {
  return [
    ...new Set([
      ...SIGLAS,
      ...siglasCadastradas,
      ...registros.flatMap((r) => r.siglas),
      ...opcoesDoCsvEmLeitura.siglas,
    ]),
  ];
}

// Compara sem diferenciar maiúsculas: "squad alfa" encontra "Squad Alfa".
function encontrarOpcao(lista: string[], valor: string): string | undefined {
  return lista.find((opcao) => opcao.toLowerCase() === valor.toLowerCase());
}

// ---------- Utilitários ----------

function el<T extends HTMLElement>(id: string): T {
  const elemento = document.getElementById(id);
  if (!elemento) throw new Error(`Elemento #${id} não encontrado no index.html`);
  return elemento as T;
}

function pertence<T extends string>(lista: readonly T[], valor: string): valor is T {
  return (lista as readonly string[]).includes(valor);
}

function texto(dados: FormData, nome: string): string {
  const valor = dados.get(nome);
  return typeof valor === "string" ? valor.trim() : "";
}

function urlValida(valor: string): boolean {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function leadTimeEmDias(registro: Registro): number {
  const umDiaMs = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(registro.dataFim) - Date.parse(registro.dataInicio)) / umDiaMs);
}

// O ano da release vem da data de fim. Ex.: "2026 · R2".
function rotuloRelease(registro: Registro): string {
  if (!registro.release) return "Sem release";
  return `${registro.dataFim.slice(0, 4)} · R${registro.release}`;
}

// Ex.: "2026 · R2 · S3".
function rotuloReleaseSprint(registro: Registro): string {
  if (!registro.release || !registro.sprint) return "Sem release/sprint";
  return `${rotuloRelease(registro)} · S${registro.sprint}`;
}

// Release do trimestre da data (aaaa-mm-dd): outubro -> "4".
function releaseDaData(iso: string): Release {
  const mes = Number(iso.slice(5, 7));
  return RELEASES[Math.floor((mes - 1) / MESES_POR_RELEASE)] ?? RELEASES[0];
}

// Mesmas regras de data para o formulário, o CSV e o JSON. Devolve a mensagem
// do problema ou null. `release` vazia/nula não é checada aqui.
function erroDeDataERelease(dataFim: string, release: string | null): string | null {
  if (Number(dataFim.slice(0, 4)) < ANO_INICIAL) {
    return `Só entram entregas a partir de ${ANO_INICIAL} (data de fim ${formatarData(dataFim)}).`;
  }
  const esperada = releaseDaData(dataFim);
  if (release && release !== esperada) {
    // mesesDaRelease está em dashboard.ts (mesmo escopo global; só roda depois de tudo carregado).
    return (
      `Release R${release} não bate com a data de fim ${formatarData(dataFim)}, ` +
      `que cai na R${esperada} (${mesesDaRelease(esperada)}).`
    );
  }
  return null;
}

function gerarId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- Validação ----------

function validar(dados: FormData): Validacao {
  const erros: Erros = {};

  const tipo = texto(dados, "tipo");
  const squad = texto(dados, "squad");
  const assunto = texto(dados, "assunto");
  const descricao = texto(dados, "descricao");
  const dataInicio = texto(dados, "dataInicio");
  const dataFim = texto(dados, "dataFim");
  const release = texto(dados, "release");
  const sprint = texto(dados, "sprint");
  const impeditivo = texto(dados, "impeditivo");

  if (!pertence(TIPOS_ITEM, tipo)) erros.tipo = "Selecione o tipo de item.";

  // Cada linha de OKR envia os três campos, então as listas têm o mesmo tamanho e ordem.
  const okrsInformados = dados.getAll("okr");
  const motivos = dados.getAll("okrMotivo");
  const graus = dados.getAll("okrGrau");
  const okrs: OkrImpactado[] = [];
  for (const [indice, valorOkr] of okrsInformados.entries()) {
    const okr = typeof valorOkr === "string" ? valorOkr : "";
    const valorMotivo = motivos[indice];
    const valorGrau = graus[indice];
    const motivo = typeof valorMotivo === "string" ? valorMotivo.trim() : "";
    const grau = typeof valorGrau === "string" ? valorGrau : "";
    const linha = `OKR ${indice + 1}`;
    if (!pertence(OKRS, okr)) {
      erros.okrs ??= `${linha}: selecione o OKR.`;
    } else if (okrs.some((o) => o.okr === okr)) {
      erros.okrs ??= `${linha}: o OKR ${okr} já foi adicionado nesta entrega.`;
    } else if (!pertence(GRAUS_IMPACTO, grau)) {
      erros.okrs ??= `${linha}: selecione o grau de impacto.`;
    } else if (!motivo) {
      erros.okrs ??= `${linha}: explique o motivo do impacto.`;
    } else {
      okrs.push({ okr, motivo, grau });
    }
  }
  if (okrsInformados.length === 0) erros.okrs = "Adicione ao menos um OKR impactado.";

  if (!pertence(squadsDisponiveis(), squad)) erros.squad = "Selecione a squad.";
  if (!pertence(RELEASES, release)) erros.release = "Selecione a release.";
  if (!pertence(SPRINTS, sprint)) erros.sprint = "Selecione a sprint.";
  if (!assunto) erros.assunto = "Informe o assunto.";
  if (!descricao) erros.descricao = "Descreva brevemente o que foi feito.";
  if (!dataInicio) erros.dataInicio = "Informe a data de início.";
  if (!dataFim) {
    erros.dataFim = "Informe a data de fim.";
  } else if (dataInicio && dataFim < dataInicio) {
    // Datas ISO (yyyy-mm-dd) ordenam corretamente como string.
    erros.dataFim = "A data de fim não pode ser anterior à data de início.";
  } else {
    const erro = erroDeDataERelease(dataFim, pertence(RELEASES, release) ? release : null);
    // Ano fora do foco é problema da data; release de outro trimestre, da release.
    if (erro?.startsWith("Só entram")) erros.dataFim = erro;
    else if (erro) erros.release = erro;
  }

  let historia: DetalheHistoria | null = null;
  if (tipo === "História") {
    const classificacao = texto(dados, "classificacao");
    if (classificacao === "funcional") {
      const bcp = texto(dados, "bcp");
      const complexidadeTexto = texto(dados, "complexidade");
      const complexidade = complexidadeTexto === "" ? null : Number(complexidadeTexto);
      if (!bcp) erros.bcp = "BCP é obrigatório para história funcional.";
      if (complexidade !== null && (!Number.isFinite(complexidade) || complexidade < 0)) {
        erros.complexidade = "Informe um número maior ou igual a zero.";
      }
      historia = { funcional: true, bcp, complexidade };
    } else if (classificacao === "nao-funcional") {
      historia = { funcional: false };
    } else {
      erros.classificacao = "Informe se a história é funcional ou não funcional.";
    }
  }

  let gmud: Gmud | null = null;
  if (tipo === "História" || tipo === "Bug") {
    const nome = texto(dados, "gmudNome");
    const link = texto(dados, "gmudLink");
    if (link && !nome) erros.gmudNome = "Informe o nome/número da GMUD para usar o link.";
    if (link && !urlValida(link)) erros.gmudLink = "Link inválido (use http:// ou https://).";
    if (nome) gmud = { nome, link: link || null };
  }

  let git: AlteracaoGit | null = null;
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
  } else if (houveAlteracaoGit !== "nao") {
    erros.git = "Informe se houve alteração em repositório Git.";
  }

  const siglas = dados
    .getAll("siglas")
    .filter((s): s is Sigla => typeof s === "string" && pertence(siglasDisponiveis(), s));

  // Os pertence() se repetem aqui só para o compilador estreitar string -> tipo da lista.
  if (
    Object.keys(erros).length > 0 ||
    !pertence(TIPOS_ITEM, tipo) ||
    !pertence(squadsDisponiveis(), squad) ||
    !pertence(RELEASES, release) ||
    !pertence(SPRINTS, sprint)
  ) {
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
      dataInicio,
      dataFim,
      release,
      sprint,
      impeditivo,
      historia,
      gmud,
      git,
    },
  };
}

// ---------- Elementos ----------

const formulario = el<HTMLFormElement>("form-registro");
const tituloFormulario = el<HTMLHeadingElement>("titulo-form");
const botaoSalvar = el<HTMLButtonElement>("btn-salvar");
const botaoCancelar = el<HTMLButtonElement>("btn-cancelar");
const corpoTabela = el<HTMLTableSectionElement>("corpo-tabela");
const contador = el<HTMLSpanElement>("contador");

const campoTipo = el<HTMLSelectElement>("tipo");
const listaOkrs = el<HTMLDivElement>("lista-okrs");
const botaoAdicionarOkr = el<HTMLButtonElement>("btn-adicionar-okr");
const campoSquad = el<HTMLSelectElement>("squad");
const campoRelease = el<HTMLSelectElement>("release");
const campoSprint = el<HTMLSelectElement>("sprint");
const filtroRelease = el<HTMLSelectElement>("filtro-release");
const filtroSprint = el<HTMLSelectElement>("filtro-sprint");
const filtroImpeditivo = el<HTMLSelectElement>("filtro-impeditivo");
const botaoExportar = el<HTMLButtonElement>("btn-exportar");
const campoImportar = el<HTMLInputElement>("importar");
const campoGmudNome = el<HTMLInputElement>("gmudNome");
const listaSiglas = el<HTMLDivElement>("lista-siglas");

const secaoClassificacao = el<HTMLElement>("sec-classificacao");
const secaoFuncional = el<HTMLElement>("sec-funcional");
const secaoGmud = el<HTMLElement>("sec-gmud");
const secaoGit = el<HTMLElement>("sec-git");
const secaoActions = el<HTMLElement>("sec-actions");

// ---------- Estado ----------

let registros: Registro[] = carregarRegistros();
let idEmEdicao: string | null = null;

// ---------- Formulário ----------

function preencherSelect(select: HTMLSelectElement, opcoes: readonly string[]): void {
  select.append(new Option("Selecione...", ""));
  for (const opcao of opcoes) select.append(new Option(opcao, opcao));
}

function adicionarCaixaSigla(sigla: string, marcada = false): void {
  const rotulo = document.createElement("label");
  const caixa = document.createElement("input");
  caixa.type = "checkbox";
  caixa.name = "siglas";
  caixa.value = sigla;
  caixa.checked = marcada;
  rotulo.append(caixa, ` ${sigla}`);
  listaSiglas.append(rotulo);
}

// Squads e siglas podem ter mudado (cadastro ou importação): refaz as opções
// mantendo o que estava escolhido.
function preencherSquadsESiglas(): void {
  const squadAtual = campoSquad.value;
  campoSquad.replaceChildren();
  preencherSelect(campoSquad, squadsDisponiveis());
  campoSquad.value = squadAtual;

  const marcadas = new Set(
    [...listaSiglas.querySelectorAll<HTMLInputElement>("input:checked")].map((caixa) => caixa.value),
  );
  listaSiglas.replaceChildren();
  for (const sigla of siglasDisponiveis()) adicionarCaixaSigla(sigla, marcadas.has(sigla));
}

// Squad já existente (mesmo com outra caixa) só é selecionada, sem duplicar.
function cadastrarSquad(nome: string): string | null {
  if (!nome) return "Informe o nome da squad.";
  const existente = encontrarOpcao(squadsDisponiveis(), nome);
  if (!existente) {
    squadsCadastradas.push(nome);
    localStorage.setItem(CHAVE_SQUADS, JSON.stringify(squadsCadastradas));
    campoSquad.append(new Option(nome, nome));
  }
  campoSquad.value = existente ?? nome;
  return null;
}

// Siglas são códigos: ficam sempre em maiúsculas. A nova já entra marcada.
function cadastrarSigla(valor: string): string | null {
  const sigla = valor.toUpperCase();
  if (!sigla) return "Informe a sigla.";
  if (/\s/.test(sigla)) return "A sigla não pode ter espaços.";
  const existente = encontrarOpcao(siglasDisponiveis(), sigla);
  if (existente) {
    const caixa = listaSiglas.querySelector<HTMLInputElement>(`input[value="${CSS.escape(existente)}"]`);
    if (caixa) caixa.checked = true;
    return null;
  }
  siglasCadastradas.push(sigla);
  localStorage.setItem(CHAVE_SIGLAS, JSON.stringify(siglasCadastradas));
  adicionarCaixaSigla(sigla, true);
  return null;
}

// "+ Nova squad" que se abre em campo + Adicionar/Cancelar. O campo não tem
// name, então não entra no FormData do registro. `aoAdicionar` devolve a
// mensagem de erro, ou null quando deu certo.
function criarCadastroRapido(
  container: HTMLElement,
  rotulo: string,
  aoAdicionar: (valor: string) => string | null,
): void {
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

  const fechar = (): void => {
    campo.value = "";
    erro.textContent = "";
    linha.hidden = true;
    abrir.hidden = false;
  };

  const confirmar = (): void => {
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
    } else if (evento.key === "Escape") {
      fechar();
    }
  });

  linha.append(campo, criarBotao("Adicionar", "", confirmar), criarBotao("Cancelar", "secundario", fechar));
  container.append(abrir, linha, erro);
}

function adicionarLinhaOkr(impacto?: OkrImpactado): void {
  const linha = document.createElement("div");
  linha.className = "linha-okr";

  const okr = document.createElement("select");
  okr.name = "okr";
  okr.ariaLabel = "OKR impactado";
  preencherSelect(okr, OKRS);

  const grau = document.createElement("select");
  grau.name = "okrGrau";
  grau.ariaLabel = "Grau de impacto";
  grau.append(new Option("Grau de impacto...", ""));
  for (const opcao of GRAUS_IMPACTO) grau.append(new Option(opcao, opcao));

  const motivo = document.createElement("input");
  motivo.type = "text";
  motivo.name = "okrMotivo";
  motivo.ariaLabel = "Motivo do impacto";
  motivo.placeholder = "Motivo do impacto";

  if (impacto) {
    okr.value = impacto.okr;
    grau.value = impacto.grau ?? "";
    motivo.value = impacto.motivo;
  }

  linha.append(okr, grau, motivo, criarBotao("Remover", "perigo", () => linha.remove()));
  listaOkrs.append(linha);
}

function radioMarcado(nome: string): string {
  const radio = formulario.querySelector<HTMLInputElement>(`input[name="${nome}"]:checked`);
  return radio?.value ?? "";
}

function marcarRadio(nome: string, valor: string): void {
  for (const radio of formulario.querySelectorAll<HTMLInputElement>(`input[name="${nome}"]`)) {
    radio.checked = radio.value === valor;
  }
}

// Campo escondido também fica desabilitado: assim ele não entra no FormData
// nem recebe foco pelo teclado.
function mostrar(secao: HTMLElement, visivel: boolean): void {
  secao.hidden = !visivel;
  for (const campo of secao.querySelectorAll<HTMLInputElement>("input")) {
    campo.disabled = !visivel;
  }
}

function atualizarCamposCondicionais(): void {
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

function exibirErros(erros: Erros): void {
  for (const alvo of formulario.querySelectorAll<HTMLElement>("[data-erro]")) {
    alvo.textContent = erros[alvo.dataset.erro ?? ""] ?? "";
  }
}

function limparFormulario(): void {
  formulario.reset();
  listaOkrs.replaceChildren();
  adicionarLinhaOkr();
  idEmEdicao = null;
  tituloFormulario.textContent = "Novo registro";
  botaoSalvar.textContent = "Adicionar registro";
  botaoCancelar.textContent = "Limpar";
  exibirErros({});
  atualizarCamposCondicionais();
}

function definirValor(nome: string, valor: string): void {
  const campo = formulario.elements.namedItem(nome);
  if (
    campo instanceof HTMLInputElement ||
    campo instanceof HTMLSelectElement ||
    campo instanceof HTMLTextAreaElement
  ) {
    campo.value = valor;
  }
}

function iniciarEdicao(registro: Registro): void {
  limparFormulario();
  idEmEdicao = registro.id;

  definirValor("tipo", registro.tipo);
  listaOkrs.replaceChildren();
  for (const impacto of registro.okrs) adicionarLinhaOkr(impacto);
  definirValor("squad", registro.squad);
  definirValor("assunto", registro.assunto);
  definirValor("descricao", registro.descricao);
  definirValor("dataInicio", registro.dataInicio);
  definirValor("dataFim", registro.dataFim);
  definirValor("release", registro.release ?? "");
  definirValor("sprint", registro.sprint ?? "");
  definirValor("impeditivo", registro.impeditivo);

  if (registro.historia) {
    marcarRadio("classificacao", registro.historia.funcional ? "funcional" : "nao-funcional");
    if (registro.historia.funcional) {
      definirValor("bcp", registro.historia.bcp);
      definirValor("complexidade", registro.historia.complexidade?.toString() ?? "");
    }
  }

  definirValor("gmudNome", registro.gmud?.nome ?? "");
  definirValor("gmudLink", registro.gmud?.link ?? "");

  marcarRadio("git", registro.git ? "sim" : "nao");
  definirValor("linkPr", registro.git?.linkPullRequest ?? "");
  definirValor("linkActions", registro.git?.linkActions ?? "");

  for (const caixa of listaSiglas.querySelectorAll<HTMLInputElement>("input")) {
    caixa.checked = (registro.siglas as string[]).includes(caixa.value);
  }

  tituloFormulario.textContent = "Editando registro";
  botaoSalvar.textContent = "Salvar alterações";
  botaoCancelar.textContent = "Cancelar edição";
  atualizarCamposCondicionais();
  formulario.scrollIntoView({ behavior: "smooth" });
}

function aoEnviar(evento: SubmitEvent): void {
  evento.preventDefault();

  const resultado = validar(new FormData(formulario));
  if (!resultado.ok) {
    exibirErros(resultado.erros);
    formulario.querySelector("[data-erro]:not(:empty)")?.scrollIntoView({ block: "center" });
    return;
  }

  if (idEmEdicao) {
    const id = idEmEdicao;
    registros = registros.map((r) => (r.id === id ? { id, ...resultado.dados } : r));
  } else {
    registros = [...registros, { id: gerarId(), ...resultado.dados }];
  }

  salvarRegistros(registros);
  limparFormulario();
  renderizarTabela();
}

function remover(registro: Registro): void {
  if (!confirm(`Remover o registro "${registro.assunto}"?`)) return;
  registros = registros.filter((r) => r.id !== registro.id);
  salvarRegistros(registros);
  if (idEmEdicao === registro.id) limparFormulario();
  renderizarTabela();
}

// ---------- Tabela ----------

const VAZIO = "—";

function criarLink(url: string, rotulo: string): HTMLElement {
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

function criarBotao(rotulo: string, classe: string, aoClicar: () => void): HTMLButtonElement {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.textContent = rotulo;
  botao.className = classe;
  botao.addEventListener("click", aoClicar);
  return botao;
}

function criarLinha(registro: Registro): HTMLTableRowElement {
  const { historia, gmud, git } = registro;

  let classificacao = VAZIO;
  let bcp = VAZIO;
  let complexidade = VAZIO;
  if (historia) {
    classificacao = historia.funcional ? "Funcional" : "Não funcional";
    if (historia.funcional) {
      bcp = historia.bcp;
      complexidade = historia.complexidade?.toString() ?? VAZIO;
    }
  }

  const okrs = document.createElement("div");
  okrs.className = "okrs-celula";
  for (const impacto of registro.okrs) {
    const item = document.createElement("div");
    const detalhe = [impacto.grau ?? "grau não informado", impacto.motivo].filter(Boolean).join(": ");
    item.textContent = `${impacto.okr} (${detalhe})`;
    okrs.append(item);
  }
  if (registro.okrs.length === 0) okrs.textContent = VAZIO;

  const impeditivo = document.createElement("div");
  impeditivo.className = "texto-celula";
  impeditivo.textContent = registro.impeditivo || VAZIO;

  const acoes = document.createElement("div");
  acoes.className = "acoes-linha";
  acoes.append(
    criarBotao("Editar", "secundario", () => iniciarEdicao(registro)),
    criarBotao("Remover", "perigo", () => remover(registro)),
  );

  // Mesma ordem dos <th> em index.html.
  const colunas: (string | Node)[] = [
    registro.tipo,
    registro.assunto,
    registro.descricao,
    classificacao,
    bcp,
    complexidade,
    gmud ? (gmud.link ? criarLink(gmud.link, gmud.nome) : gmud.nome) : VAZIO,
    okrs,
    registro.squad,
    registro.siglas.join(", ") || VAZIO,
    formatarData(registro.dataInicio),
    formatarData(registro.dataFim),
    `${leadTimeEmDias(registro)} d`,
    rotuloRelease(registro),
    registro.sprint ? `S${registro.sprint}` : "Sem sprint",
    impeditivo,
    git ? "Sim" : "Não",
    git?.linkPullRequest ? criarLink(git.linkPullRequest, "Pull Request") : VAZIO,
    git?.linkActions ? criarLink(git.linkActions, "Actions (prod)") : VAZIO,
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
function passaNosFiltros(registro: Registro): boolean {
  const release = filtroRelease.value;
  const sprint = filtroSprint.value;
  const impeditivo = filtroImpeditivo.value;
  if (release && (registro.release ?? "sem") !== release) return false;
  if (sprint && (registro.sprint ?? "sem") !== sprint) return false;
  if (impeditivo && (registro.impeditivo ? "com" : "sem") !== impeditivo) return false;
  return true;
}

function renderizarTabela(): void {
  const total = registros.length;
  const visiveis = registros.filter(passaNosFiltros);
  const totalTexto = total === 1 ? "1 registro" : `${total} registros`;
  contador.textContent = visiveis.length === total ? totalTexto : `${visiveis.length} de ${totalTexto}`;

  if (visiveis.length === 0) {
    const linha = document.createElement("tr");
    const celula = document.createElement("td");
    celula.colSpan = 20;
    celula.className = "vazio";
    celula.textContent =
      total === 0
        ? "Nenhum registro ainda. Use o formulário acima para adicionar o primeiro."
        : "Nenhum registro corresponde aos filtros selecionados.";
    linha.append(celula);
    corpoTabela.replaceChildren(linha);
    return;
  }

  // Entregas mais recentes primeiro.
  const ordenados = [...visiveis].sort((a, b) => b.dataFim.localeCompare(a.dataFim));
  corpoTabela.replaceChildren(...ordenados.map(criarLinha));
}

// ---------- Exportar / importar JSON ----------

function exportarJson(): void {
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
const fonteDoArquivoUnico = (window as Window & { fonteDoArquivoUnico?: string }).fonteDoArquivoUnico;

function gerarPaginaPublicada(): void {
  if (!fonteDoArquivoUnico) return;
  if (registros.length === 0) {
    alert("Não há entregas para publicar: importe o CSV primeiro.");
    return;
  }
  // Mesmo formato do `npm run publicar --json`: "<" escapado para nenhum texto
  // fechar a tag <script> antes da hora.
  const json = JSON.stringify(registros).replaceAll("<", "\\u003c");
  const scripts = [...document.querySelectorAll<HTMLScriptElement>("script[data-app]")]
    .map((script) => `<script data-app>${script.textContent ?? ""}</script>`)
    .join("\n");
  const pagina = fonteDoArquivoUnico.replace(
    "</body>",
    () => `<script type="application/json" id="dados-publicados">${json}</script>\n${scripts}\n</body>`,
  );

  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([pagina], { type: "text/html" }));
  link.download = `registro-entregas-publicado-${new Date().toISOString().slice(0, 10)}.html`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function registroImportavel(valor: unknown): valor is RegistroSalvo {
  if (typeof valor !== "object" || valor === null) return false;
  const r = valor as Record<string, unknown>;
  const dataIso = /^\d{4}-\d{2}-\d{2}$/;
  return (
    typeof r.id === "string" &&
    typeof r.tipo === "string" &&
    typeof r.assunto === "string" &&
    typeof r.descricao === "string" &&
    typeof r.squad === "string" &&
    Array.isArray(r.siglas) &&
    typeof r.dataInicio === "string" &&
    dataIso.test(r.dataInicio) &&
    typeof r.dataFim === "string" &&
    dataIso.test(r.dataFim)
  );
}

// Confere valores de lista e datas de cada entrega: o JSON pode ter sido escrito
// à mão (ver exemplos/entregas-exemplo.json). Grau, release e sprint nulos
// continuam aceitos porque existem em registros antigos.
function errosDoRegistroJson(r: RegistroSalvo, posicao: number): string[] {
  const erros: string[] = [];
  const onde = `Entrega ${posicao} (id "${r.id}")`;
  const lista = (opcoes: readonly string[]): string => opcoes.join(", ");

  if (!pertence(TIPOS_ITEM, r.tipo)) erros.push(`${onde}: tipo "${r.tipo}" inválido. Use: ${lista(TIPOS_ITEM)}.`);
  if (!r.assunto.trim()) erros.push(`${onde}: assunto vazio.`);
  if (!r.squad.trim()) erros.push(`${onde}: squad vazia.`);
  if (r.dataFim < r.dataInicio) erros.push(`${onde}: dataFim antes de dataInicio.`);
  const erroDeData = erroDeDataERelease(r.dataFim, r.release ?? null);
  if (erroDeData) erros.push(`${onde}: ${erroDeData}`);
  if (r.release != null && !pertence(RELEASES, r.release)) {
    erros.push(`${onde}: release "${r.release}" inválida. Use: ${lista(RELEASES)} (como texto).`);
  }
  if (r.sprint != null && !pertence(SPRINTS, r.sprint)) {
    erros.push(`${onde}: sprint "${r.sprint}" inválida. Use: ${lista(SPRINTS)} (como texto).`);
  }
  if (!r.siglas.every((sigla) => typeof sigla === "string")) erros.push(`${onde}: siglas devem ser textos.`);
  if (r.okrs !== undefined && !Array.isArray(r.okrs)) erros.push(`${onde}: okrs deve ser uma lista.`);
  for (const impacto of Array.isArray(r.okrs) ? r.okrs : []) {
    if (typeof impacto !== "object" || impacto === null) {
      erros.push(`${onde}: cada item de okrs deve ser { "okr", "grau", "motivo" }.`);
      continue;
    }
    if (!pertence(OKRS, impacto.okr)) erros.push(`${onde}: OKR "${impacto.okr}" inválido. Use: ${lista(OKRS)}.`);
    if (impacto.grau !== null && !pertence(GRAUS_IMPACTO, impacto.grau)) {
      erros.push(`${onde}: grau "${impacto.grau}" inválido. Use: ${lista(GRAUS_IMPACTO)}.`);
    }
  }
  return erros;
}

async function importarJson(): Promise<void> {
  const arquivo = campoImportar.files?.[0];
  if (!arquivo) return;

  let dados: unknown;
  try {
    dados = JSON.parse(await arquivo.text());
  } catch {
    dados = null;
  }
  // Limpa o campo para permitir escolher o mesmo arquivo de novo.
  campoImportar.value = "";

  if (!Array.isArray(dados)) {
    alert('Arquivo inválido: o JSON precisa ser uma lista [ ... ] de entregas (ver exemplos/entregas-exemplo.json).');
    return;
  }

  // Como no CSV, é tudo ou nada: com qualquer entrega inválida, nada é importado.
  const erros: string[] = [];
  const ids = new Set<string>();
  for (const [indice, item] of dados.entries()) {
    const posicao = indice + 1;
    if (!registroImportavel(item)) {
      erros.push(
        `Entrega ${posicao}: faltam campos obrigatórios ou o formato está errado ` +
          "(id, tipo, assunto, descricao, squad, siglas, dataInicio e dataFim em aaaa-mm-dd).",
      );
      continue;
    }
    if (ids.has(item.id)) erros.push(`Entrega ${posicao}: id "${item.id}" repetido no arquivo.`);
    ids.add(item.id);
    erros.push(...errosDoRegistroJson(item, posicao));
  }

  if (erros.length > 0) {
    const exibidos = erros.slice(0, MAXIMO_ERROS_EXIBIDOS);
    if (erros.length > exibidos.length) exibidos.push(`... e mais ${erros.length - exibidos.length} erro(s).`);
    alert(`JSON inválido, nada foi importado:\n\n${exibidos.join("\n")}`);
    return;
  }

  aplicarImportacao((dados as RegistroSalvo[]).map(migrarRegistro));
}

// Usada pelas importações de JSON e de CSV (csv.ts).
function aplicarImportacao(importados: Registro[]): void {
  const mensagem = `Importar ${importados.length} registro(s)? Registros com o mesmo id serão substituídos pelos do arquivo.`;
  if (!confirm(mensagem)) return;

  const idsImportados = new Set(importados.map((r) => r.id));
  registros = [...registros.filter((r) => !idsImportados.has(r.id)), ...importados];
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
for (const release of RELEASES) filtroRelease.append(new Option(`R${release}`, release));
filtroRelease.append(new Option("Sem release", "sem"));
filtroSprint.append(new Option("Todas", ""));
for (const sprint of SPRINTS) filtroSprint.append(new Option(`S${sprint}`, sprint));
filtroSprint.append(new Option("Sem sprint", "sem"));
preencherSquadsESiglas();
criarCadastroRapido(el("nova-squad"), "Nova squad", cadastrarSquad);
criarCadastroRapido(el("nova-sigla"), "Nova sigla", cadastrarSigla);

// A release segue o trimestre da data de fim: escolher a data já preenche a release.
el<HTMLInputElement>("dataFim").addEventListener("change", (evento) => {
  const data = (evento.target as HTMLInputElement).value;
  if (data) campoRelease.value = releaseDaData(data);
});

formulario.addEventListener("submit", aoEnviar);
formulario.addEventListener("input", atualizarCamposCondicionais);
botaoCancelar.addEventListener("click", limparFormulario);
botaoAdicionarOkr.addEventListener("click", () => adicionarLinhaOkr());
filtroRelease.addEventListener("change", renderizarTabela);
filtroSprint.addEventListener("change", renderizarTabela);
filtroImpeditivo.addEventListener("change", renderizarTabela);
botaoExportar.addEventListener("click", exportarJson);
const botaoGerarPublicada = el<HTMLButtonElement>("btn-gerar-publicada");
botaoGerarPublicada.hidden = !fonteDoArquivoUnico;
botaoGerarPublicada.addEventListener("click", gerarPaginaPublicada);
campoImportar.addEventListener("change", importarJson);

adicionarLinhaOkr();

atualizarCamposCondicionais();
renderizarTabela();
