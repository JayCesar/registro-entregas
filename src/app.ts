// ---------- Modelo ----------

// União discriminada: o BCP-Score (um número, guardado como texto) só existe
// quando funcional === true. Registros antigos podem ter "complexidade": é ignorada.
type DetalheHistoria = { funcional: true; bcp: string } | { funcional: false };

interface Gmud {
  nome: string; // número/identificador (ex.: GMUD-12345)
  titulo?: string | null; // nome descritivo; ausente em registros anteriores a este campo
  link: string | null;
  evidencias?: string | null; // link da pasta/documento com as evidências; idem
}

interface AlteracaoGit {
  linkPullRequest: string | null;
  linkActions: string | null;
}

interface OkrImpactado {
  okr: Okr;
  kr?: string | null; // código do KR (ver okrs.ts); null/ausente = o OKR como um todo
  motivo: string;
  grau: GrauImpacto | null; // null só em registros migrados do modelo antigo (um OKR, sem grau)
}

// Ponto do PDI que a entrega move. `ponto` é o prefixo das chaves do JSON do
// PDI: "gap_<id>" (evidências e gaps) ou "exp_<id>" (plano de experiências).
// `versao` é o id da versão do PDI (ver VersaoPdi em pdi.ts); null só em
// vínculos de antes das versões, que contam como da primeira versão.
interface VinculoPdi {
  versao: string | null;
  ponto: string;
  intensidade: IntensidadePdi;
}

const PADRAO_PONTO_PDI = /^(gap|exp)_[a-z0-9]+$/;

interface Registro {
  id: string;
  tipo: TipoItem;
  assunto: string;
  descricao: string;
  okrs: OkrImpactado[];
  squad: Squad;
  siglas: Sigla[];
  camadas: Camada[]; // vazio só em registros anteriores a este campo
  servicosAws: string[];
  microsservicos: string[];
  pessoas: string[]; // só na aba de edição: não vai para o dashboard nem para a página publicada
  dataInicio: string; // yyyy-mm-dd
  dataFim: string; // yyyy-mm-dd
  release: Release | null; // null só em registros anteriores a este campo
  sprint: Sprint | null; // idem
  impeditivo: string; // vazio = não houve impeditivo
  historia: DetalheHistoria | null; // só para História
  gmud: Gmud | null; // só para História ou Bug
  git: AlteracaoGit | null; // null = sem alteração em repositório
  pdi: VinculoPdi | null; // null = sem vínculo com o PDI (e em registros anteriores a este campo)
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
// pdi, camadas, servicosAws e microsservicos não existiam: entram vazios.
type RegistroSalvo = Omit<
  Registro,
  "okrs" | "release" | "sprint" | "impeditivo" | "historia" | "gmud" | "git" | "pdi" | "camadas" | "servicosAws" | "microsservicos" | "pessoas"
> & {
  okrs?: OkrImpactado[];
  okr?: Okr;
  release?: Release | null;
  sprint?: Sprint | null;
  impeditivo?: string;
  historia?: DetalheHistoria | null;
  gmud?: Gmud | null;
  git?: AlteracaoGit | null;
  pdi?: VinculoPdi | null;
  camadas?: Camada[];
  servicosAws?: string[];
  microsservicos?: string[];
  pessoas?: string[];
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
    pdi: salvo.pdi ?? null,
    camadas: salvo.camadas ?? [],
    servicosAws: salvo.servicosAws ?? [],
    microsservicos: salvo.microsservicos ?? [],
    pessoas: salvo.pessoas ?? [],
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

// ---------- Squads, siglas, serviços AWS e microsserviços cadastrados ----------

// Opções criadas pelo usuário no formulário, além das listas de config.ts.
const CHAVE_SQUADS = "registro-entregas:squads";
const CHAVE_SIGLAS = "registro-entregas:siglas";
const CHAVE_SERVICOS_AWS = "registro-entregas:servicos-aws";
const CHAVE_MICROSSERVICOS = "registro-entregas:microsservicos";
const CHAVE_PESSOAS = "registro-entregas:pessoas";

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
const servicosAwsCadastrados = carregarLista(CHAVE_SERVICOS_AWS);
const microsservicosCadastrados = carregarLista(CHAVE_MICROSSERVICOS);
const pessoasCadastradas = carregarLista(CHAVE_PESSOAS);

// Opções novas que aparecem num CSV valem enquanto ele é lido (ver
// registrosDoCsv em csv.ts). Depois da importação passam a vir dos registros.
const opcoesDoCsvEmLeitura = {
  squads: new Set<string>(),
  siglas: new Set<string>(),
  servicosAws: new Set<string>(),
  microsservicos: new Set<string>(),
  pessoas: new Set<string>(),
};

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

function servicosAwsDisponiveis(): string[] {
  return [
    ...new Set([
      ...SERVICOS_AWS,
      ...servicosAwsCadastrados,
      ...registros.flatMap((r) => r.servicosAws),
      ...opcoesDoCsvEmLeitura.servicosAws,
    ]),
  ];
}

function microsservicosDisponiveis(): string[] {
  return [
    ...new Set([
      ...MICROSSERVICOS,
      ...microsservicosCadastrados,
      ...registros.flatMap((r) => r.microsservicos),
      ...opcoesDoCsvEmLeitura.microsservicos,
    ]),
  ];
}

function pessoasDisponiveis(): string[] {
  return [
    ...new Set([...pessoasCadastradas, ...registros.flatMap((r) => r.pessoas), ...opcoesDoCsvEmLeitura.pessoas]),
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

// "GMUD-12345 · Ajuste no portal" (ou só o número, se não houver nome).
function rotuloGmud(gmud: Gmud): string {
  return gmud.titulo ? `${gmud.nome} · ${gmud.titulo}` : gmud.nome;
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

// `regrasDoFormulario` = false no CSV: planilhas de antes das colunas "camadas" e
// "gmudEvidencias" continuam válidas (no formulário os dois são obrigatórios).
function validar(dados: FormData, regrasDoFormulario = true): Validacao {
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

  // Listas alinhadas (mesmo tamanho e ordem), montadas por anexarOkrsDoFormulario
  // (okrs.ts) ou pelo CSV. okrKr pode faltar (CSV antigo): vale o OKR como um todo.
  const okrsInformados = dados.getAll("okr");
  const krsInformados = dados.getAll("okrKr");
  const motivos = dados.getAll("okrMotivo");
  const graus = dados.getAll("okrGrau");
  const okrs: OkrImpactado[] = [];
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
    } else if (kr && !krsDoOkr.includes(kr)) {
      erros.okrs ??= `${linha}: o KR "${kr}" não existe nesse OKR.`;
    } else if (okrs.some((o) => o.okr === okr)) {
      erros.okrs ??= `${linha}: o OKR ${okr} já foi adicionado nesta entrega.`;
    } else if (!pertence(GRAUS_IMPACTO, grau)) {
      erros.okrs ??= `${linha}: selecione o grau de impacto.`;
    } else if (!motivo) {
      erros.okrs ??= `${linha}: explique o motivo do impacto.`;
    } else {
      okrs.push({ okr, kr: kr || null, motivo, grau });
    }
  }
  if (okrsInformados.length === 0) erros.okrs = "Escolha ao menos um OKR impactado (abra o OKR e marque o KR).";

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
      // Aceita vírgula decimal ("7,5").
      const bcp = texto(dados, "bcp").replace(",", ".");
      if (!bcp) erros.bcp = "BCP-Score é obrigatório para história funcional.";
      else if (!Number.isFinite(Number(bcp))) erros.bcp = "O BCP-Score deve ser um número.";
      historia = { funcional: true, bcp };
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
    const titulo = texto(dados, "gmudTitulo");
    if (titulo && !nome) erros.gmudNome = "Informe o número da GMUD para usar o nome.";
    // Teve GMUD, tem que ter evidências.
    const evidencias = texto(dados, "gmudEvidencias");
    if (evidencias && !nome) erros.gmudNome = "Informe o número da GMUD para usar as evidências.";
    if (evidencias && !urlValida(evidencias)) erros.gmudEvidencias = "Link inválido (use http:// ou https://).";
    else if (nome && !evidencias && regrasDoFormulario) erros.gmudEvidencias = "Com GMUD, informe o link das evidências.";
    if (nome) gmud = { nome, titulo: titulo || null, link: link || null, evidencias: evidencias || null };
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

  // Opcional. O CSV não tem essas colunas: lá o vínculo fica null (ver aplicarImportacao).
  // "versão|ponto": o mesmo ponto pode existir em mais de uma versão do PDI (ver pdi.ts).
  const [pdiVersao = "", pdiPonto = ""] = texto(dados, "pdiPonto").split("|");
  const pdiIntensidade = texto(dados, "pdiIntensidade");
  let pdi: VinculoPdi | null = null;
  if (pdiPonto) {
    if (!PADRAO_PONTO_PDI.test(pdiPonto)) erros.pdiPonto = "Ponto do PDI inválido.";
    else if (!pertence(INTENSIDADES_PDI, pdiIntensidade)) erros.pdiIntensidade = "Escolha a intensidade.";
    else pdi = { versao: pdiVersao || null, ponto: pdiPonto, intensidade: pdiIntensidade };
  } else if (pdiIntensidade) {
    erros.pdiPonto = "Escolha o ponto do PDI (ou deixe a intensidade em branco).";
  }

  const siglas = dados
    .getAll("siglas")
    .filter((s): s is Sigla => typeof s === "string" && pertence(siglasDisponiveis(), s));
  const camadas = dados.getAll("camadas").filter((c): c is Camada => typeof c === "string" && pertence(CAMADAS, c));
  if (regrasDoFormulario && camadas.length === 0) erros.camadas = "Marque ao menos uma camada (backend, frontend, database ou infra).";
  const servicosAws = dados
    .getAll("servicosAws")
    .filter((s): s is string => typeof s === "string" && pertence(servicosAwsDisponiveis(), s));
  const microsservicos = dados
    .getAll("microsservicos")
    .filter((m): m is string => typeof m === "string" && pertence(microsservicosDisponiveis(), m));
  const pessoas = dados
    .getAll("pessoas")
    .filter((p): p is string => typeof p === "string" && pertence(pessoasDisponiveis(), p));

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
      camadas,
      servicosAws,
      microsservicos,
      pessoas,
      dataInicio,
      dataFim,
      release,
      sprint,
      impeditivo,
      historia,
      gmud,
      git,
      pdi,
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
const listaSquads = el<HTMLDivElement>("lista-squads");
const campoRelease = el<HTMLSelectElement>("release");
const campoSprint = el<HTMLSelectElement>("sprint");
const filtroRelease = el<HTMLSelectElement>("filtro-release");
const filtroSprint = el<HTMLSelectElement>("filtro-sprint");
const filtroImpeditivo = el<HTMLSelectElement>("filtro-impeditivo");
const buscaTabela = el<HTMLInputElement>("busca-tabela");
const botaoExportar = el<HTMLButtonElement>("btn-exportar");
const campoImportar = el<HTMLInputElement>("importar");
const campoGmudNome = el<HTMLInputElement>("gmudNome");
const listaSiglas = el<HTMLDivElement>("lista-siglas");
const listaCamadas = el<HTMLDivElement>("lista-camadas");
const listaServicosAws = el<HTMLDivElement>("lista-servicos-aws");
const listaMicrosservicos = el<HTMLDivElement>("lista-microsservicos");
const listaPessoas = el<HTMLDivElement>("lista-pessoas");
const secaoGmudTitulo = el<HTMLElement>("sec-gmud-titulo");

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

// Pílula clicável: o input (radio ou checkbox) fica escondido dentro do
// <label> e o CSS pinta o <span> quando ele está marcado (ver .escolha em style.css).
function criarEscolha(tipo: "radio" | "checkbox", nome: string, valor: string, rotulo: string | Node, marcada = false): HTMLLabelElement {
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

// Pílulas de múltipla escolha que crescem pelo formulário (siglas, serviços AWS, microsserviços).
interface ListaCadastravel {
  lista: HTMLElement;
  nome: string; // name das caixas no FormData
  chave: string; // localStorage das opções cadastradas
  cadastradas: string[];
  disponiveis: () => string[];
}

const LISTA_SIGLAS: ListaCadastravel = {
  lista: listaSiglas,
  nome: "siglas",
  chave: CHAVE_SIGLAS,
  cadastradas: siglasCadastradas,
  disponiveis: siglasDisponiveis,
};
const LISTA_SERVICOS_AWS: ListaCadastravel = {
  lista: listaServicosAws,
  nome: "servicosAws",
  chave: CHAVE_SERVICOS_AWS,
  cadastradas: servicosAwsCadastrados,
  disponiveis: servicosAwsDisponiveis,
};
const LISTA_MICROSSERVICOS: ListaCadastravel = {
  lista: listaMicrosservicos,
  nome: "microsservicos",
  chave: CHAVE_MICROSSERVICOS,
  cadastradas: microsservicosCadastrados,
  disponiveis: microsservicosDisponiveis,
};
const LISTA_PESSOAS: ListaCadastravel = {
  lista: listaPessoas,
  nome: "pessoas",
  chave: CHAVE_PESSOAS,
  cadastradas: pessoasCadastradas,
  disponiveis: pessoasDisponiveis,
};

function refazerLista({ lista, nome, disponiveis }: ListaCadastravel): void {
  const marcadas = new Set([...lista.querySelectorAll<HTMLInputElement>("input:checked")].map((caixa) => caixa.value));
  lista.replaceChildren(...disponiveis().map((opcao) => criarEscolha("checkbox", nome, opcao, opcao, marcadas.has(opcao))));
  if (disponiveis().length === 0) {
    lista.append(Object.assign(document.createElement("span"), { className: "dica", textContent: "Nenhum cadastrado ainda." }));
  }
}

// Opção já existente (mesmo com outra caixa) só é marcada, sem duplicar. A nova já entra marcada.
function cadastrarNaLista(alvo: ListaCadastravel, valor: string): void {
  const existente = encontrarOpcao(alvo.disponiveis(), valor);
  if (!existente) {
    alvo.cadastradas.push(valor);
    localStorage.setItem(alvo.chave, JSON.stringify(alvo.cadastradas));
    alvo.lista.querySelector("span.dica")?.remove();
    alvo.lista.append(criarEscolha("checkbox", alvo.nome, valor, valor, true));
    return;
  }
  const caixa = alvo.lista.querySelector<HTMLInputElement>(`input[value="${CSS.escape(existente)}"]`);
  if (caixa) caixa.checked = true;
}

function marcarCaixas(lista: HTMLElement, valores: readonly string[]): void {
  for (const caixa of lista.querySelectorAll<HTMLInputElement>("input")) caixa.checked = valores.includes(caixa.value);
}

function adicionarSquad(squad: string, marcada = false): void {
  listaSquads.append(criarEscolha("radio", "squad", squad, squad, marcada));
}

// Squads e siglas podem ter mudado (cadastro ou importação): refaz as opções
// mantendo o que estava escolhido.
function preencherSquadsESiglas(): void {
  const squadAtual = radioMarcado("squad");
  listaSquads.replaceChildren();
  for (const squad of squadsDisponiveis()) adicionarSquad(squad);
  if (squadsDisponiveis().length === 0) {
    listaSquads.append(
      Object.assign(document.createElement("span"), { className: "dica", textContent: "Nenhuma squad ainda: use “+ Nova squad”." }),
    );
  }
  marcarRadio("squad", squadAtual);

  for (const alvo of [LISTA_SIGLAS, LISTA_SERVICOS_AWS, LISTA_MICROSSERVICOS, LISTA_PESSOAS]) refazerLista(alvo);
}

// Squad já existente (mesmo com outra caixa) só é selecionada, sem duplicar.
function cadastrarSquad(nome: string): string | null {
  if (!nome) return "Informe o nome da squad.";
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
function cadastrarSigla(valor: string): string | null {
  const sigla = valor.toUpperCase();
  if (!sigla) return "Informe a sigla.";
  if (/\s/.test(sigla)) return "A sigla não pode ter espaços.";
  cadastrarNaLista(LISTA_SIGLAS, sigla);
  return null;
}

function cadastrarServicoAws(valor: string): string | null {
  if (!valor) return "Informe o serviço AWS.";
  cadastrarNaLista(LISTA_SERVICOS_AWS, valor);
  return null;
}

function cadastrarPessoa(valor: string): string | null {
  if (!valor) return "Informe o nome da pessoa.";
  cadastrarNaLista(LISTA_PESSOAS, valor);
  return null;
}

// Nome como está no repositório/cluster (ex.: ms-reservas): mantém a caixa digitada.
function cadastrarMicrosservico(valor: string): string | null {
  if (!valor) return "Informe o nome do microsserviço.";
  if (/\s/.test(valor)) return "Use o nome sem espaços (ex.: ms-reservas).";
  cadastrarNaLista(LISTA_MICROSSERVICOS, valor);
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
  // O nome da GMUD só aparece quando há GMUD informada.
  mostrar(secaoGmudTitulo, temGmud);
}

function exibirErros(erros: Erros): void {
  for (const alvo of formulario.querySelectorAll<HTMLElement>("[data-erro]")) {
    alvo.textContent = erros[alvo.dataset.erro ?? ""] ?? "";
  }
}

function limparFormulario(): void {
  formulario.reset();
  preencherVinculoPdi(null); // pdi.ts: volta para a versão mais recente, sem vínculo
  preencherOkrsEntrega([]); // okrs.ts: todos os OKRs fechados, sem escolha
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
  preencherOkrsEntrega(registro.okrs); // okrs.ts
  marcarRadio("squad", registro.squad);
  definirValor("assunto", registro.assunto);
  definirValor("descricao", registro.descricao);
  definirValor("dataInicio", registro.dataInicio);
  definirValor("dataFim", registro.dataFim);
  definirValor("release", registro.release ?? "");
  definirValor("sprint", registro.sprint ?? "");
  definirValor("impeditivo", registro.impeditivo);

  if (registro.historia) {
    marcarRadio("classificacao", registro.historia.funcional ? "funcional" : "nao-funcional");
    if (registro.historia.funcional) definirValor("bcp", registro.historia.bcp);
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
  marcarCaixas(listaPessoas, registro.pessoas);

  // pdi.ts: versão, ponto e intensidade do registro, mesmo que o ponto já tenha saído do PDI.
  preencherVinculoPdi(registro.pdi);

  tituloFormulario.textContent = "Editando registro";
  botaoSalvar.textContent = "Salvar alterações";
  botaoCancelar.textContent = "Cancelar edição";
  atualizarCamposCondicionais();
  formulario.scrollIntoView({ behavior: "smooth" });
}

function aoEnviar(evento: SubmitEvent): void {
  evento.preventDefault();

  const dados = new FormData(formulario);
  anexarOkrsDoFormulario(dados); // okrs.ts: um item por OKR escolhido
  const resultado = validar(dados);
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
  if (historia) {
    classificacao = historia.funcional ? "Funcional" : "Não funcional";
    if (historia.funcional) bcp = historia.bcp;
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
    gmud ? (gmud.link ? criarLink(gmud.link, rotuloGmud(gmud)) : rotuloGmud(gmud)) : VAZIO,
    okrs,
    textoDoVinculoPdi(registro.pdi), // pdi.ts
    registro.squad,
    registro.siglas.join(", ") || VAZIO,
    registro.camadas.join(", ") || VAZIO,
    registro.servicosAws.join(", ") || VAZIO,
    registro.microsservicos.join(", ") || VAZIO,
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
function passaNosFiltros(registro: Registro): boolean {
  const release = filtroRelease.value;
  const sprint = filtroSprint.value;
  const impeditivo = filtroImpeditivo.value;
  if (release && (registro.release ?? "sem") !== release) return false;
  if (sprint && (registro.sprint ?? "sem") !== sprint) return false;
  if (impeditivo && (registro.impeditivo ? "com" : "sem") !== impeditivo) return false;
  return true;
}

// Linha única ocupando todas as colunas, para tabela vazia ou busca sem resultado.
function mostrarTabelaVazia(texto: string): void {
  const linha = document.createElement("tr");
  const celula = document.createElement("td");
  celula.colSpan = 25;
  celula.className = "vazio";
  celula.textContent = texto;
  linha.append(celula);
  corpoTabela.replaceChildren(linha);
}

function renderizarTabela(): void {
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

  if (total === 0) mostrarTabelaVazia("Nenhum registro ainda. Use o formulário acima para adicionar o primeiro.");
  else if (linhas.length === 0 && palavras.length > 0) mostrarTabelaVazia(`Nenhum registro encontrado para "${buscaTabela.value.trim()}".`);
  else if (linhas.length === 0) mostrarTabelaVazia("Nenhum registro corresponde aos filtros selecionados.");
  else corpoTabela.replaceChildren(...linhas);
}

function semAcentoNaBusca(texto: string): string {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
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

async function gerarPaginaPublicada(): Promise<void> {
  if (!fonteDoArquivoUnico) return;
  if (registros.length === 0) {
    alert("Não há entregas para publicar: importe o CSV primeiro.");
    return;
  }
  // Os vínculos com o PDI não vão abertos: seguem cifrados, junto com o PDI,
  // na tag de tagDoPdiPublicado (pdi.ts), que só a senha do coordenador abre.
  // Pessoas envolvidas também ficam fora: só servem para a aba de edição.
  const semPdi = registros.map((r) => ({ ...r, pdi: null, pessoas: [] }));
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
  const scripts = [...document.querySelectorAll<HTMLScriptElement>("script[data-app]")]
    .map((script) => `<script data-app>${script.textContent ?? ""}</script>`)
    .join("\n");
  const pagina = fonteDoArquivoUnico.replace(
    "</body>",
    () => `<script type="application/json" id="dados-publicados">${json}</script>\n${tagOkrs}${tagFoto}${tagPdi}${scripts}\n</body>`,
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
  if (r.camadas !== undefined && (!Array.isArray(r.camadas) || !r.camadas.every((c) => pertence(CAMADAS, c)))) {
    erros.push(`${onde}: camadas deve ser uma lista com: ${lista(CAMADAS)}.`);
  }
  for (const campo of ["servicosAws", "microsservicos", "pessoas"] as const) {
    const valor = r[campo];
    if (valor !== undefined && (!Array.isArray(valor) || !valor.every((v) => typeof v === "string"))) {
      erros.push(`${onde}: ${campo} deve ser uma lista de textos.`);
    }
  }
  if (r.okrs !== undefined && !Array.isArray(r.okrs)) erros.push(`${onde}: okrs deve ser uma lista.`);
  for (const impacto of Array.isArray(r.okrs) ? r.okrs : []) {
    if (typeof impacto !== "object" || impacto === null) {
      erros.push(`${onde}: cada item de okrs deve ser { "okr", "grau", "motivo" }.`);
      continue;
    }
    if (!pertence(okrsDisponiveis(), impacto.okr)) {
      erros.push(`${onde}: OKR "${impacto.okr}" inválido. Use: ${lista(okrsDisponiveis())} (ou cadastre-o).`);
    }
    if (impacto.kr != null && typeof impacto.kr !== "string") erros.push(`${onde}: kr deve ser texto ou null.`);
    if (impacto.grau !== null && !pertence(GRAUS_IMPACTO, impacto.grau)) {
      erros.push(`${onde}: grau "${impacto.grau}" inválido. Use: ${lista(GRAUS_IMPACTO)}.`);
    }
  }
  if (r.pdi != null) {
    const { ponto, intensidade } = r.pdi;
    if (r.pdi.versao != null && typeof r.pdi.versao !== "string") erros.push(`${onde}: pdi.versao deve ser texto.`);
    if (typeof ponto !== "string" || !PADRAO_PONTO_PDI.test(ponto)) {
      erros.push(`${onde}: pdi.ponto deve ser "gap_<id>" ou "exp_<id>".`);
    }
    if (!pertence(INTENSIDADES_PDI, intensidade)) {
      erros.push(`${onde}: pdi.intensidade "${intensidade}" inválida. Use: ${lista(INTENSIDADES_PDI)}.`);
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

  // O CSV pode não trazer o vínculo com o PDI, camadas, serviços AWS,
  // microsserviços, pessoas nem o nome da GMUD: reimportar a planilha da semana não pode apagar o que foi
  // preenchido no formulário. Campo vazio no arquivo mantém o valor atual.
  const atuais = new Map(registros.map((r) => [r.id, r]));
  const preservados = importados.map((r) => {
    const atual = atuais.get(r.id);
    if (!atual) return r;
    return {
      ...r,
      pdi: r.pdi ?? atual.pdi,
      camadas: r.camadas.length > 0 ? r.camadas : atual.camadas,
      servicosAws: r.servicosAws.length > 0 ? r.servicosAws : atual.servicosAws,
      microsservicos: r.microsservicos.length > 0 ? r.microsservicos : atual.microsservicos,
      pessoas: r.pessoas.length > 0 ? r.pessoas : atual.pessoas,
      // CSV sem okrNKr: o KR escolhido no formulário continua no mesmo OKR.
      okrs: r.okrs.map((o) => (o.kr ? o : { ...o, kr: atual.okrs.find((a) => a.okr === o.okr)?.kr ?? null })),
      // Mesma GMUD sem nome/evidências no CSV: mantém os do formulário.
      gmud:
        r.gmud && atual.gmud?.nome === r.gmud.nome
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
for (const release of RELEASES) filtroRelease.append(new Option(`R${release}`, release));
filtroRelease.append(new Option("Sem release", "sem"));
filtroSprint.append(new Option("Todas", ""));
for (const sprint of SPRINTS) filtroSprint.append(new Option(`S${sprint}`, sprint));
filtroSprint.append(new Option("Sem sprint", "sem"));
preencherSquadsESiglas();
criarCadastroRapido(el("nova-squad"), "Nova squad", cadastrarSquad);
criarCadastroRapido(el("nova-sigla"), "Nova sigla", cadastrarSigla);
criarCadastroRapido(el("novo-servico-aws"), "Novo serviço AWS", cadastrarServicoAws);
criarCadastroRapido(el("novo-microsservico"), "Novo microsserviço", cadastrarMicrosservico);
criarCadastroRapido(el("nova-pessoa"), "Nova pessoa", cadastrarPessoa);
listaCamadas.append(...CAMADAS.map((camada) => criarEscolha("checkbox", "camadas", camada, camada)));

// A release segue o trimestre da data de fim: escolher a data já preenche a release.
el<HTMLInputElement>("dataFim").addEventListener("change", (evento) => {
  const data = (evento.target as HTMLInputElement).value;
  if (data) campoRelease.value = releaseDaData(data);
});

formulario.addEventListener("submit", aoEnviar);
formulario.addEventListener("input", atualizarCamposCondicionais);
botaoCancelar.addEventListener("click", limparFormulario);
filtroRelease.addEventListener("change", renderizarTabela);
filtroSprint.addEventListener("change", renderizarTabela);
filtroImpeditivo.addEventListener("change", renderizarTabela);
buscaTabela.addEventListener("input", renderizarTabela);
botaoExportar.addEventListener("click", exportarJson);
const botaoGerarPublicada = el<HTMLButtonElement>("btn-gerar-publicada");
botaoGerarPublicada.hidden = !fonteDoArquivoUnico;
botaoGerarPublicada.addEventListener("click", () => void gerarPaginaPublicada());
campoImportar.addEventListener("change", importarJson);


atualizarCamposCondicionais();
// A tabela é desenhada pela primeira vez em pdi.ts: a coluna PDI depende dele.
