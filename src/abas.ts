// Navegação entre as duas abas e bloqueio da aba de edição.
//
// PROTEÇÃO PROVISÓRIA: a senha (SENHA_EDICAO, em config.ts) é conferida no
// próprio navegador. Serve para os gestores não caírem na tela de edição, mas
// quem abrir o código-fonte ou o DevTools consegue passar. Segurança de verdade
// exige autenticação em um backend.

type Aba = "dashboard" | "edicao";

// ---------- Elementos ----------

const botaoAbaDashboard = el<HTMLButtonElement>("aba-dashboard");
const botaoAbaEdicao = el<HTMLButtonElement>("aba-edicao");
const botaoBloquear = el<HTMLButtonElement>("btn-bloquear");
const botaoTrilhoEdicao = el<HTMLButtonElement>("trilho-edicao");
const painelDashboard = el<HTMLElement>("painel-dashboard");
const painelSenha = el<HTMLElement>("painel-senha");
const painelEdicao = el<HTMLElement>("painel-edicao");
const formularioSenha = el<HTMLFormElement>("form-senha");
const campoSenha = el<HTMLInputElement>("senha");
const erroSenha = el<HTMLElement>("erro-senha");

// ---------- Estado ----------

// Fica só em memória: recarregar a página bloqueia a edição de novo.
let edicaoLiberada = false;

// ---------- Abas ----------

function mostrarAba(aba: Aba): void {
  const ehEdicao = aba === "edicao";

  painelDashboard.hidden = ehEdicao;
  // Sem a senha, o painel de edição continua com `hidden`: não aparece nem recebe foco.
  painelSenha.hidden = !ehEdicao || edicaoLiberada;
  painelEdicao.hidden = !ehEdicao || !edicaoLiberada;
  botaoBloquear.hidden = !edicaoLiberada;

  botaoAbaDashboard.classList.toggle("ativa", !ehEdicao);
  botaoAbaEdicao.classList.toggle("ativa", ehEdicao);
  botaoTrilhoEdicao.classList.toggle("ativa", ehEdicao);
  // O CSS usa para apagar os links de seção do trilho fora do dashboard.
  document.body.dataset.aba = aba;

  if (!ehEdicao) {
    // Redesenha a cada visita para refletir o que foi salvo na aba de edição.
    renderizarDashboard();
  } else if (!edicaoLiberada) {
    campoSenha.focus();
  }
}

function aoEnviarSenha(evento: SubmitEvent): void {
  evento.preventDefault();

  if (campoSenha.value !== SENHA_EDICAO) {
    erroSenha.textContent = "Senha incorreta.";
    campoSenha.select();
    return;
  }

  edicaoLiberada = true;
  erroSenha.textContent = "";
  formularioSenha.reset();
  mostrarAba("edicao");
}

function bloquearEdicao(): void {
  edicaoLiberada = false;
  mostrarAba("dashboard");
}

// ---------- Inicialização ----------

botaoAbaDashboard.addEventListener("click", () => mostrarAba("dashboard"));
botaoAbaEdicao.addEventListener("click", () => mostrarAba("edicao"));
botaoTrilhoEdicao.addEventListener("click", () => mostrarAba("edicao"));
botaoBloquear.addEventListener("click", bloquearEdicao);
formularioSenha.addEventListener("submit", aoEnviarSenha);

mostrarAba("dashboard");
