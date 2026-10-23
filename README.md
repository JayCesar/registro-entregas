# Registro de entregas

Dashboard das entregas do time (histórias, bugs, tasks, oportunidades e discoveries), com lead time, impacto nos OKRs, volumetria por release/sprint e o detalhe de cada entrega.

- **Sem servidor e sem banco:** é HTML + CSS + JavaScript. Abre direto do arquivo (`index.html`) ou de um bucket S3.
- **Os dados vêm de um CSV** que você vai preenchendo a cada entrega nova.
- **Para mostrar aos gestores**, o projeto gera uma página única com tudo embutido. Ela sobe para um bucket S3 privado e é compartilhada por um link que vale 1 hora.

> Os dados reais **nunca** vão para o GitHub: `dados/entregas.csv` e a pasta `publicar/` estão no `.gitignore`.

---

## 1. Colocar para funcionar no PC do trabalho

### Só visualizar ou editar localmente (não precisa instalar nada)

1. Clone o repositório (ou baixe o ZIP pelo GitHub e extraia):
   ```bash
   git clone https://github.com/JayCesar/registro-entregas.git
   ```
2. Abra o `index.html` no navegador (Chrome ou Edge). A pasta `dist/` já vem compilada.

### Para publicar no S3 (uma vez por máquina)

| Ferramenta | Para quê | Como conferir |
|---|---|---|
| [Node.js 18+](https://nodejs.org) | rodar o script de publicação | `node --version` |
| [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) | subir o arquivo e gerar o link | `aws --version` |

Configure as credenciais da AWS como o time já usa: `aws configure`, ou `aws sso login --profile ...` com `AWS_PROFILE` definido.

### Só se for mexer no código (`src/*.ts`)

```bash
npm install      # instala o TypeScript
npm run build    # recompila src/ para dist/
```

---

## 2. Fluxo a cada entrega nova

```
dados/entregas.csv  ──(preenche no Excel)──►  npm run publicar  ──►  publicar/index.html  ──►  S3 + link de 1h
```

1. **Primeira vez:** copie o modelo para criar sua planilha:
   ```bash
   cp dados/modelo-entregas.csv dados/entregas.csv
   ```
2. **Abra `dados/entregas.csv` no Excel** e adicione uma linha por entrega (formato na seção 3). Salve como **CSV (separado por ponto e vírgula)** ou **CSV UTF-8**.
3. **Gere a página:**
   ```bash
   npm run publicar
   ```
4. **Abra `publicar/index.html` no navegador para conferir.** Se alguma linha do CSV tiver problema, aparece um aviso com o número da linha e o motivo, e essa linha fica fora da página. Corrija e gere de novo.
5. **Suba e gere o link de 1h:**
   ```bash
   npm run publicar -- --bucket NOME-DO-BUCKET
   ```
   O comando imprime o link. É só mandar para os gestores.

Opções do comando:

| Opção | Padrão | O que faz |
|---|---|---|
| `--bucket` | (nenhum) | sobe para o S3 e gera o link; sem ele, só gera o arquivo |
| `--chave` | `registro-entregas/index.html` | caminho do arquivo dentro do bucket |
| `--expira` | `3600` | validade do link em segundos (3600 = 1h) |
| `--csv` | `dados/entregas.csv` | usar outro CSV |

> **Conferir antes de publicar (opcional):** no `index.html` local, aba **Edição** (senha em `src/config.ts`), botão **Importar CSV**. A importação é "tudo ou nada" e lista os erros por linha.

---

## 3. Formato do CSV

O modelo está em `dados/modelo-entregas.csv`; um exemplo completo e preenchido está em `exemplos/entregas-exemplo.csv`.

- **Separador:** `;` (padrão do Excel em pt-BR). `,` também funciona.
- **Codificação:** UTF-8 ou a padrão do Excel (Windows-1252). As duas são aceitas.
- **Uma linha por entrega**, com a primeira linha sendo o cabeçalho (não altere os nomes das colunas).
- Maiúsculas e acentos não importam nos valores de lista: `historia` vira `História` e `squad alfa` vira `Squad Alfa`.

| Coluna | Obrigatória | Valores aceitos | Exemplo |
|---|---|---|---|
| `id` | não | qualquer texto único. Se preenchido, reimportar **atualiza** a entrega em vez de duplicar | `2026-r4-01` |
| `tipo` | **sim** | `História`, `Bug`, `Task`, `Oportunidade`, `Discovery` | `História` |
| `assunto` | **sim** | texto curto | `Consulta de saldo consolidado` |
| `descricao` | **sim** | o que foi feito | `Nova tela com saldo de todas as contas.` |
| `squad` | **sim** | nome da squad; uma squad nova é aceita e passa a existir | `Squad Alfa` |
| `siglas` | não | separadas por `\|`; siglas novas são aceitas (ficam em maiúsculas) | `FT5\|JQ9` |
| `dataInicio` | **sim** | `aaaa-mm-dd` ou `dd/mm/aaaa` | `03/11/2026` |
| `dataFim` | **sim** | igual; não pode ser antes do início. **O ano da entrega vem daqui** | `21/11/2026` |
| `release` | **sim** | `1` a `4` (ou `R1` a `R4`). R1 = jan–mar, R2 = abr–jun, R3 = jul–set, R4 = out–dez | `4` |
| `sprint` | **sim** | `1` a `4` (ou `S1` a `S4`) | `2` |
| `impeditivo` | não | texto; em branco = não houve | `Ambiente de homologação fora do ar` |
| `classificacao` | só para **História** | `funcional` ou `nao-funcional` | `funcional` |
| `bcp` | só para História **funcional** | texto | `BCP-1042` |
| `complexidade` | não | número (aceita vírgula) | `3,5` |
| `gmudNome` | não (História/Bug) | nome/número da GMUD | `GMUD-48211` |
| `gmudLink` | não | URL `https://...`; exige `gmudNome` | `https://gmud.empresa/48211` |
| `git` | não | `sim` ou `nao` (em branco = `nao`) | `sim` |
| `linkPr` | não | URL do Pull Request | `https://github.com/.../pull/312` |
| `linkActions` | não | URL do deploy em produção (só vale com GMUD) | `https://github.com/.../actions/runs/77` |
| `okr1` | **sim** | `A`, `B` ou `C` (lista em `src/config.ts`) | `A` |
| `okr1Grau` | **sim** | `Alto`, `Médio` ou `Baixo` | `Alto` |
| `okr1Motivo` | **sim** | por que a entrega impacta esse OKR | `Reduz chamadas ao atendimento` |
| `okr2…`, `okr3…` | não | mesmo trio para mais OKRs. Precisa de mais? Crie `okr4`, `okr4Grau`, `okr4Motivo` | |

Os OKRs, a senha da aba de edição e as listas iniciais de squads e siglas ficam em `src/config.ts`. Depois de alterar, rode `npm run build`.

---

## 4. Hospedagem no S3 com link de 1 hora

**Dá para fazer assim, sim.** O caminho certo é um **link pré-assinado** (*presigned URL*), sem deixar o bucket público:

- **O bucket continua privado**, com o *Block Public Access* ligado. Ninguém acessa sem o link.
- **`npm run publicar -- --bucket ...`** sobe `publicar/index.html` e roda `aws s3 presign --expires-in 3600`. Depois de 1h o link para de funcionar.
- **Cada publicação gera um link novo.** Para cortar um link antes de expirar, apague ou substitua o objeto no bucket.

Por que a página é **um arquivo só**: o link pré-assinado vale para um único objeto. Se o CSS e os scripts fossem arquivos separados, o navegador não conseguiria baixá-los sem link próprio e a página quebraria. Além disso, os dados precisam estar dentro da página, porque quem abre o link não tem os dados do seu navegador.

**Permissões mínimas** para quem publica: `s3:PutObject` e `s3:GetObject` em `arn:aws:s3:::NOME-DO-BUCKET/registro-entregas/*`.

**Limites a conhecer:**

- **Credenciais temporárias:** com SSO ou role assumida, o link também expira quando a sua sessão expira, o que pode acontecer antes de 1h. Gere o link logo depois do `aws sso login`.
- **Cópias da página:** o link vence em 1h, mas quem abriu pode salvar a página (Ctrl+S) e ela continua funcionando offline, com os dados dentro. A 1h limita o link, não as cópias.
- **Fonte:** a página carrega a fonte Manrope do Google Fonts. Sem acesso a ele (rede corporativa), usa a fonte do sistema, sem quebrar nada.
- **Página publicada é só leitura:** a aba de edição não aparece. A foto de perfil não vai junto (fica no navegador de quem cadastrou); aparecem as iniciais.

---

## 5. Estrutura

```
index.html            página (abas Entregas e Edição)
style.css             estilos (tema escuro/claro, cores de destaque)
favicon.svg           ícone da aba
src/*.ts              código-fonte (TypeScript, scripts clássicos sem módulos)
dist/*.js             código compilado (versionado para abrir sem instalar nada)
dados/                modelo do CSV (o seu entregas.csv fica aqui e não vai para o Git)
exemplos/             CSV de exemplo preenchido
scripts/publicar.mjs  gera a página única e, opcionalmente, sobe para o S3
```

**Segurança da aba de edição:** a senha em `src/config.ts` só evita edição acidental. Ela fica visível no código-fonte, não é proteção de verdade.
