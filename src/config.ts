// Listas fixas do formulário.
// Para adicionar ou remover opções de OKR, edite apenas este arquivo e rode
// `npm run build`. Os tipos abaixo são derivados das listas, então o
// compilador acompanha a mudança sozinho.
// Squads e siglas são só as opções iniciais: novas podem ser cadastradas no
// próprio formulário (ver squadsDisponiveis/siglasDisponiveis em app.ts).

const OKRS = ["A", "B", "C"] as const;

const SIGLAS = ["FT5", "JQ9"] as const;

// Opções de exemplo: substitua pelas squads reais.
const SQUADS = ["Squad Alfa", "Squad Beta", "Squad Gama"] as const;

// Atenção: "História" e "Bug" são usados nas regras de campos condicionais
// em app.ts. Renomear esses dois exige ajustar lá também.
const TIPOS_ITEM = ["História", "Bug", "Oportunidade", "Discovery", "Task"] as const;

// Grau de impacto de uma entrega em um OKR, do menor para o maior.
const GRAUS_IMPACTO = ["Baixo", "Médio", "Alto"] as const;

// Release e sprint em que o item foi entregue. Os números se repetem a cada
// ano; o ano vem da data de fim do registro.
const RELEASES = ["1", "2", "3", "4"] as const;
const SPRINTS = ["1", "2", "3", "4"] as const;

// Cada release dura um trimestre do ano (R1 = jan a mar...) e tem 4 sprints.
// Usado nos rótulos do filtro e no gráfico mensal do dashboard.
const MESES_POR_RELEASE = 3;

// PROTEÇÃO PROVISÓRIA: senha fixa da aba de edição. Ela fica visível no
// código-fonte e os dados continuam legíveis no localStorage, então isso só
// evita edição acidental, não é segurança de verdade. Troque aqui quando quiser.
const SENHA_EDICAO = "123";

// Nome exibido no cabeçalho, ao lado da foto (ver perfil.ts).
const NOME_RESPONSAVEL = "Júlio César Cordeiro Batista";

type Okr = (typeof OKRS)[number];
type GrauImpacto = (typeof GRAUS_IMPACTO)[number];
// Abertos (string): a lista cresce em tempo de execução.
type Sigla = string;
type Squad = string;
type TipoItem = (typeof TIPOS_ITEM)[number];
type Release = (typeof RELEASES)[number];
type Sprint = (typeof SPRINTS)[number];

// Cor fixa de cada tipo de item, igual em todos os gráficos do dashboard.
// Aqui fica só o nome do token; os valores (um por tema) estão em style.css.
// Record obriga a definir uma cor para todo tipo novo em TIPOS_ITEM.
const CORES_TIPO: Record<TipoItem, string> = {
  História: "var(--tipo-historia)",
  Bug: "var(--tipo-bug)",
  Oportunidade: "var(--tipo-oportunidade)",
  Discovery: "var(--tipo-discovery)",
  Task: "var(--tipo-task)",
};
