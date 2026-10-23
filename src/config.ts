// Listas fixas do formulário.
// Para adicionar ou remover opções de OKR, edite apenas este arquivo e rode
// `npm run build`. Os tipos abaixo são derivados das listas, então o
// compilador acompanha a mudança sozinho.
// Squads e siglas são só as opções iniciais: novas podem ser cadastradas no
// próprio formulário (ver squadsDisponiveis/siglasDisponiveis em app.ts).

// OKRs iniciais: valem enquanto nenhum for cadastrado na aba de edição
// (cartão "OKRs e KRs", ver okrs.ts). Depois, a lista vem do cadastro.
const OKRS = ["A", "B", "C"] as const;

// Cor de cada OKR (cartões do dashboard e seletor do formulário), em rodízio pela ordem do cadastro.
const CORES_OKR = ["var(--okr-1)", "var(--okr-2)", "var(--okr-3)", "var(--okr-4)"];

const SIGLAS = ["FT5", "JQ9"] as const;

// Squads fixas: começa vazia; as reais são cadastradas pelo "+ Nova squad".
const SQUADS: readonly string[] = [];

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
// A release é sempre a do trimestre da data de fim (validado no cadastro e nas importações).
const MESES_POR_RELEASE = 3;

// Primeiro ano acompanhado: entregas com data de fim anterior não são aceitas
// e, se já existirem no navegador, ficam fora do dashboard.
const ANO_INICIAL = 2026;

// PROTEÇÃO PROVISÓRIA: senha fixa da aba de edição. Ela fica visível no
// código-fonte e os dados continuam legíveis no localStorage, então isso só
// evita edição acidental, não é segurança de verdade. Troque aqui quando quiser.
const SENHA_EDICAO = "123";

// Camada técnica do que a entrega mexeu. Obrigatória no formulário (ao menos uma).
const CAMADAS = ["Backend", "Frontend", "Database", "Infra"] as const;

// Serviços AWS envolvidos: opções iniciais. Outros podem ser cadastrados no
// formulário, como as siglas (ver servicosAwsDisponiveis em app.ts).
const SERVICOS_AWS = [
  "ECS",
  "Lambda",
  "SQS",
  "SNS",
  "EventBridge",
  "S3",
  "RDS",
  "DynamoDB",
  "API Gateway",
  "CloudFront",
  "CloudWatch",
  "Step Functions",
  "ECR",
  "Secrets Manager",
  "IAM",
] as const;

// Microsserviços criados ou alterados: começa vazio e cresce pelo formulário.
const MICROSSERVICOS: readonly string[] = [];

// Intensidade com que uma entrega move um ponto do PDI, da menor para a maior.
const INTENSIDADES_PDI = ["baixo", "médio", "forte"] as const;

// Chave da seção PDI do dashboard, liberada só com a senha do coordenador.
// Gerada por `node scripts/senha-pdi.mjs` (ver README): a senha NÃO fica aqui,
// só o sal do PBKDF2, a chave pública e a chave privada cifrada com a senha.
// null = senha ainda não configurada (a seção fica bloqueada para todos).
const CHAVE_PDI: ChavePdi | null = {
  salt: "Ll1aGoWud0cJDUsUA2B4/A==",
  iteracoes: 600000,
  iv: "64TGnlH0jnGTZ2wr",
  chavePrivada: "O/7d1xrTOCwxnzNKTZW5en7OtVIf1/fF9n1u8KY8Dvn8lSLjDGM7A7oFTUwWJ5q9B6TNF2D7IHxjrVb1zOZ3RajsKnrUII+zvJIJ0WMFChyNVZXavohaKkIfb+kJCtrvvWIAHB+r6F40foUlR50l3fdkLeiGafnqyMxGEkXFO6XRoFqVu7lfkPiwF2ePYd2knYJ8BSRSlkUqn7FxsvjWdMiOXXYH03jjDsVqdqzT9wOhq+z4zZxUXrTdi80YkX2lp3Y0X8yRGaRK+o3S87GQEZLgu1hGaCrlaqEIPPrHgl9PCh2yZrnhfBSFbuNz6fM8f1RaGbW/rP5MxghXjNybQO6bQTPAtc7snlLG9vhcCCo5Bt28O4L27v3vOjqcNiMvCO4x+7/Z9zknYiKJyoz7UlRL5C+skR2awnpZPAci2E9pSj2xicH7lMjJ0U8kP0QX+krpNp1GBhZ6WJXJyaXaK52WqN3eYeVcNSGRlvaEDWQhXF+faYJFnZWSUdujVu194ffPWhnviuIAeV0nXOD97Nbn7OqaVH04Y9KxItMli6jQOjls6HsKgMz9hS/4IRA3RYT45+fnAqRuKLbVp7DMgrIIRk8eJRMf6NZNMZL47f/OScG1pVuMCEO9xg7tbcT7KMbSipsPX2dDXshxo/7Tgn9JXpxSaTsDsnEM8aF8EFKQBwJNR1NEuJK9S9eNblIoz5UlTbdaJjUmwQMXW9BKKAeO4INhpaXQO842258+nRe2wY7TPwq+3Qdo2M48JDBFzEhWo2FCTyMhMC1nPOv1vxonRe0O2134QIGHQ2kVfKIhP+ri65E77fvYL9Zsh2Ej0BzoTxH6TArQGIRjTi2Q8YempwLxOxVjDrckqhuqhX9yKXX8dpZV9BD25urgxHKQRxs6n0XtMtgHccPIfsPy30vOABZvnnkduGvqgcruX5l5p+pW2TXBCV7QI768RpfJo7uUiIL/jz89wJkt2YT/cv2cV7/HMUsuDNrXK3/yOFZpb2MZqvr6/tMNxV4VDOpIM7LN7sN8j7YOUZNzygvSGp2vX5dydUhhTBgdFSGvjsDy84Uc0hd5haGSotz3PlkdWwstgl8KUVakLcHmTLPeKyZGZk5jIwwuHjlJY1UsQAMmgOHeTupjJUmFS/r746iC3q6f9zgTcH4lZb4JuZ2YAEZEYflFYg7tCYXIX9xFmm1yLRJqFlhdu2HG2N0Xq8GNQ+0VI/8b3swSdj//iw7U2M1WzvuHGnJ82XDjaZG4Mk1xNW+eSLCV05DlMsLrRKdJuZ+vdo9Q6RnZxsbSr55NsASl/Zf3cdspzYiyWYlURPAyW6Y8N0cDD6JlOyo6//C94hjKbsvCsTJk5nuvYkJ1myi8+hiYIzRbDBXOSuQcDDXPHvP+quXUFeJWDTwtiXvrjgwjgUCbkbtuQWhOLQ3f8GY92Momgny0SSb5v/6+Fe4813IljnCp/kYmMH4gOw/i5g/AwtG8I8A0HeZWH/RL9gqOnrCU0Qe5OvSQQbQDEKVH66XUEHP33R1BpV9OucpDyVe3Wj6lu3qs7WuL0SWbwvPyNotPwRnXmxMf926d/6ZlVgq3o1/rbvI+lFEczMZsaA4ao8PjWSTRLz7Dv4j79ySR5+9b5eSQP8LrmT/Cbm8x8xs=",
  chavePublica: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAl2NGhNVpVglliZmmLkRy0W6CG0FiSGeW6SUwP8SYFCgldMCZRPbFFGEuvGeZX1GXho6+ObzE9DHpGY6LwqCMlkAkZFBJXgAR5VZv5CNn6RG29cDVvE2jRPvVN96yCWTQQwcu3a+jZ3Z9CqYbRXySPxmGdNTICsLv83qTdsKiqTmcPpOzEYVTENlCaCfogcCqrTLGglrjjmdxY3Fk6QV2wjmnPPwgGYjnIrJI8uzMuEdk7sSBXN6qHqu8Lw6xfyEmJHHmemACcme8L0eCTEpOSg2ZH3/94lLSErqYe1X7hzjrk0WG8R01dV3BJj9QcCgPjgBmv1aygDoLEYNf+CQ+HwIDAQAB",
};

// Nome exibido no cabeçalho, ao lado da foto (ver perfil.ts).
const NOME_RESPONSAVEL = "Júlio César Cordeiro Batista";

// Código do OKR (ex.: "A"): aberto, porque a lista vem do cadastro.
type Okr = string;
type GrauImpacto = (typeof GRAUS_IMPACTO)[number];
// Abertos (string): a lista cresce em tempo de execução.
type Sigla = string;
type Camada = (typeof CAMADAS)[number];
type Squad = string;
type TipoItem = (typeof TIPOS_ITEM)[number];
type Release = (typeof RELEASES)[number];
type Sprint = (typeof SPRINTS)[number];
type IntensidadePdi = (typeof INTENSIDADES_PDI)[number];

// Tudo em base64. Ver abrirChavePdi em pdi.ts.
interface ChavePdi {
  salt: string;
  iteracoes: number;
  iv: string;
  chavePrivada: string; // pkcs8 RSA-OAEP cifrada com AES-GCM (chave derivada da senha)
  chavePublica: string; // spki RSA-OAEP: cifra o PDI publicado sem precisar da senha
}

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
