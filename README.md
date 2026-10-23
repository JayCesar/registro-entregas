# Registro de entregas

Dashboard das entregas do time (histórias, bugs, tasks, oportunidades e discoveries), com lead time, impacto nos OKRs, volumetria por release/sprint e o detalhe de cada entrega.

- **Sem servidor e sem banco:** é HTML + CSS + JavaScript. Abre direto do arquivo (`index.html`) ou de um bucket S3.
- **Os dados entram por CSV**: você preenche durante a semana e importa no site no fim de semana.
- **Para mostrar aos gestores**, o projeto gera uma página única com tudo embutido. Ela sobe para um bucket S3 privado e é compartilhada por um link que vale 1 hora.

> Os dados reais **nunca** vão para o GitHub: tudo em `dados/` (menos o modelo) e a pasta `publicar/` estão no `.gitignore`.

---

## 0. No banco: usar sem baixar o repositório (passo a passo)

Para quando não dá para clonar nem baixar o ZIP. O app inteiro (telas, estilos, código e o gerador da página do S3) está **num arquivo só**: [`registro-entregas.html`](registro-entregas.html). Não precisa de Node, Git nem AWS CLI; só um navegador e o console da AWS.

### Passo 1: levar o arquivo para o PC do banco (uma vez, e a cada atualização)

1. No navegador do banco, abra: <https://github.com/JayCesar/registro-entregas/blob/main/registro-entregas.html>
2. **Se o download for permitido:** clique no ícone **Download raw file** (seta para baixo, no canto direito acima do código). Pronto, vá para o passo 2.
3. **Se não for:** clique em **Raw**. Vai abrir uma página só com o código.
   1. `Ctrl+A` e depois `Ctrl+C` para copiar tudo.
   2. Abra o **Bloco de Notas** e cole com `Ctrl+V`.
   3. Vá em **Arquivo → Salvar como** e preencha:
      - **Nome:** `registro-entregas.html`
      - **Tipo:** *Todos os arquivos (\*.\*)*, para não virar `.txt`
      - **Codificação:** *UTF-8*
   4. Salve numa pasta fixa, por exemplo `Documentos\registro-entregas\`.

### Passo 2: abrir

- Dê dois cliques no `registro-entregas.html`. Ele abre no Edge ou no Chrome.
- **Use sempre o mesmo navegador.** As entregas importadas ficam guardadas nele, não no arquivo.

**Senha da aba Edição:** o arquivo do GitHub vem com a senha `123`. Para usar outra só no seu PC, sem expô-la no GitHub:
1. Abra o `registro-entregas.html` no Bloco de Notas.
2. Com `Ctrl+F`, procure `SENHA_EDICAO = "123"` e troque o `123` pela sua senha.
3. Salve. Lembre de repetir isso quando atualizar o arquivo.

### Passo 3: criar a planilha (uma vez)

1. Abra o Bloco de Notas, cole a linha abaixo e salve como `entregas.csv` (Tipo: *Todos os arquivos*, Codificação: *UTF-8*):
   ```
   id;tipo;assunto;descricao;squad;siglas;dataInicio;dataFim;release;sprint;impeditivo;classificacao;bcp;complexidade;gmudNome;gmudLink;git;linkPr;linkActions;okr1;okr1Grau;okr1Motivo;okr2;okr2Grau;okr2Motivo;okr3;okr3Grau;okr3Motivo
   ```
2. Abra o `entregas.csv` no Excel. Cada nome vira uma coluna, porque o `;` é o separador padrão do Excel em pt-BR.
3. Preencha uma linha por entrega. O formato de cada coluna está na seção 3.

### Passo 4: toda semana

1. Abra o `registro-entregas.html`, vá na aba **Edição** e entre com a senha.
2. Clique em **Importar CSV** e escolha a planilha da semana. Se alguma linha tiver erro, nada entra e aparece a lista dos problemas. Corrija e importe de novo.
3. Confira o resultado na aba **Entregas**.
4. Clique em **Exportar JSON**. Esse arquivo é o seu **backup**: guarde-o.
5. Clique em **Gerar página para o S3**. O navegador baixa o arquivo `registro-entregas-publicado-AAAA-MM-DD.html`, que é a página dos gestores, só leitura e com os dados dentro. Dê dois cliques nele para conferir.

### Passo 5: subir no S3 e gerar o link de 1 hora (pelo console da AWS)

1. Entre no **console da AWS**, abra o **S3** e entre no bucket.
2. Clique em **Carregar** (*Upload*), adicione o `registro-entregas-publicado-AAAA-MM-DD.html` e confirme em **Carregar**.
3. Volte à lista e **marque o arquivo** enviado.
4. No menu **Ações do objeto** (*Object actions*), escolha **Compartilhar com um URL pré-assinado** (*Share with a presigned URL*).
5. Em **Intervalo de tempo**, escolha **Horas: 1** e clique em **Criar URL pré-assinado**. O link já fica copiado.
6. Mande o link para os gestores. Depois de 1 hora ele para de funcionar.

> Para tirar a página do ar antes de 1 hora, apague o arquivo no bucket.

### Atualizar o app quando houver versão nova

Repita o **Passo 1**, salvando por cima do `registro-entregas.html` antigo. As entregas **não se perdem**, porque ficam no navegador e não no arquivo. Se você trocou a senha, troque de novo.

### Se perder os dados do navegador

Se o cache do navegador for limpo, se você trocar de navegador ou de PC:
1. Abra o `registro-entregas.html` e vá na aba **Edição**.
2. Clique em **Importar JSON** e escolha o último backup exportado no passo 4.

---

## 1. No seu PC (com Git e Node)

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
npm run build    # recompila src/ para dist/ e regenera o registro-entregas.html
```

---

## 2. Fluxo semanal

```
durante a semana            fim de semana (no seu PC)                                   gestores
────────────────            ─────────────────────────                                   ────────
planilha CSV  ──►  site local: Importar CSV  ──►  Exportar JSON  ──►  npm run publicar  ──►  link de 1h (S3)
                   (acumula com as semanas)        (tudo até hoje)    (página única)
```

**Durante a semana:** copie `dados/modelo-entregas.csv` para começar a planilha e adicione uma linha por entrega no Excel. Salve como **CSV (separado por ponto e vírgula)** ou **CSV UTF-8**. O formato está na seção 3.

**No fim de semana:**

1. **Importe no site local.** Abra o `index.html`, vá na aba **Edição** (senha em `src/config.ts`) e clique em **Importar CSV**. A importação é "tudo ou nada": se alguma linha tiver erro, nada entra e aparece a lista dos problemas por linha. As entregas se **somam** às das semanas anteriores.
2. **Confira** na aba **Entregas** se ficou como esperado.
3. **Exporte.** Na aba **Edição**, clique em **Exportar JSON**. O arquivo (`registro-entregas-aaaa-mm-dd.json`) tem **todas** as entregas até hoje. Guarde-o em `dados/`: ele é o seu backup e o que vai para o S3.
4. **Publique e gere o link de 1h:**
   ```bash
   npm run publicar -- --bucket NOME-DO-BUCKET
   ```
   Sem `--json`, o script usa o `registro-entregas-*.json` mais recente da pasta `dados/`. Para usar outro arquivo: `--json caminho/do/arquivo.json`.
   O comando sobe a página e imprime o link. É só mandar para os gestores.

Quer conferir antes de subir? Rode sem `--bucket` (`npm run publicar`) e abra `publicar/index.html` no navegador.

### Por que publicar pelo JSON e não direto pelo CSV

As entregas se **acumulam no site** a cada importação semanal. O CSV de uma semana tem só as entregas daquela semana. Publicar a partir dele faria a página dos gestores mostrar só aquela semana.

O **Exportar JSON** gera um arquivo com **tudo** o que já foi importado. Por isso ele é a fonte da publicação, e serve também de backup.

Ordem que o `npm run publicar` usa para achar os dados:

1. o arquivo passado em `--json` (ou em `--csv`);
2. senão, o `registro-entregas-*.json` mais recente em `dados/`;
3. senão, `dados/entregas.csv`.

> Atenção: se não houver nenhum JSON em `dados/`, o script cai no passo 3. Mantenha o JSON da semana em `dados/` (ou passe `--json`) para não publicar uma planilha antiga.

### Cuidados com os dados

- **Os dados acumulados ficam no navegador** (localStorage) do PC onde você importa. Se o cache do navegador for limpo, ou se você trocar de PC ou de navegador, eles somem dali.
  - Para recuperar, abra o site, vá na aba **Edição**, clique em **Importar JSON** e escolha o último arquivo exportado.
  - É por isso que o passo 3 (Exportar JSON) é feito toda semana.
- **Não importe a mesma linha duas vezes.**
  - Use um CSV novo por semana, só com as entregas novas.
  - Se preferir manter uma planilha única e reimportar tudo, **preencha a coluna `id`**: aí reimportar atualiza a entrega em vez de duplicar. Vale o mesmo para o JSON.

Opções do `npm run publicar`:

| Opção | Padrão | O que faz |
|---|---|---|
| `--json` | o `registro-entregas-*.json` mais recente em `dados/` | arquivo do "Exportar JSON" a publicar |
| `--csv` | (nenhum) | publicar direto de um CSV, sem passar pelo site |
| `--bucket` | (nenhum) | sobe para o S3 e gera o link; sem ele, só gera o arquivo |
| `--chave` | `registro-entregas/index.html` | caminho do arquivo dentro do bucket |
| `--expira` | `3600` | validade do link em segundos (3600 = 1h) |

---

## 3. Formato do CSV

O modelo está em `dados/modelo-entregas.csv`. Um exemplo preenchido, com 20 entregas de **todos os tipos** (inclusive História funcional e não funcional), está em `exemplos/entregas-exemplo.csv`.

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
| `dataFim` | **sim** | igual; não pode ser antes do início. **O ano e a release vêm daqui**; só datas a partir de 2026 | `21/11/2026` |
| `release` | **sim** | `1` a `4` (ou `R1` a `R4`), **igual ao trimestre da `dataFim`**: R1 = jan–mar, R2 = abr–jun, R3 = jul–set, R4 = out–dez | `4` |
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

**Duas regras valem para o formulário, o CSV e o JSON:**

- **A release é a do trimestre da data de fim.** Uma entrega com fim em outubro só pode ser R4; se vier como R1, a linha é recusada com o motivo. No formulário, escolher a data de fim já preenche a release.
- **Só entram entregas com data de fim a partir de 2026** (`ANO_INICIAL` em `src/config.ts`). Entregas mais antigas que já estejam no navegador ficam fora do dashboard, mas continuam na tabela da aba Edição, onde podem ser excluídas.

Os OKRs, a senha da aba de edição, o `ANO_INICIAL` e as listas iniciais de squads e siglas ficam em `src/config.ts`. Depois de alterar, rode `npm run build`.

---

## 3.1 Formato do JSON (alternativa ao CSV)

O **Importar JSON** aceita o arquivo do **Exportar JSON** (backup) e também um JSON escrito à mão. Um exemplo pronto para importar, com **todos os tipos**, está em [`exemplos/entregas-exemplo.json`](exemplos/entregas-exemplo.json):

| Tipo | O que o exemplo mostra |
|---|---|
| História (funcional) | `historia` com BCP e complexidade, GMUD com link, PR + deploy (Actions), 2 OKRs |
| História (não funcional) | `{ "funcional": false }` e impeditivo preenchido |
| Bug | GMUD sem link (`"link": null`), só PR, impeditivo |
| Task | sem GMUD (`"gmud": null`), duas siglas |
| Oportunidade | sem GMUD, só PR |
| Discovery | só os campos obrigatórios + OKR (sem `historia`, `gmud`, `git` e `impeditivo`) |

O arquivo é uma **lista** `[ ... ]` com um objeto por entrega:

```json
[
  {
    "id": "2026-r4-s1-01",
    "tipo": "História",
    "assunto": "Agendamento de transferências",
    "descricao": "Cliente pode agendar transferências para até 60 dias.",
    "squad": "Squad Alfa",
    "siglas": ["FT5"],
    "dataInicio": "2026-10-01",
    "dataFim": "2026-10-16",
    "release": "4",
    "sprint": "1",
    "okrs": [
      { "okr": "A", "grau": "Alto", "motivo": "Funcionalidade mais pedida pelos clientes" }
    ],
    "impeditivo": "",
    "historia": { "funcional": true, "bcp": "BCP-1077", "complexidade": 8 },
    "gmud": { "nome": "GMUD-49388", "link": "https://gmud.exemplo.com.br/49388" },
    "git": { "linkPullRequest": "https://github.com/.../pull/419", "linkActions": null }
  }
]
```

| Campo | Obrigatório | Formato |
|---|---|---|
| `id` | **sim** | texto único no arquivo. Uma entrega com o mesmo `id` de uma já existente **a substitui** |
| `tipo` | **sim** | `"História"`, `"Bug"`, `"Task"`, `"Oportunidade"` ou `"Discovery"` (com acento, exatamente assim) |
| `assunto`, `descricao` | **sim** | texto |
| `squad` | **sim** | texto; squad nova é aceita |
| `siglas` | **sim** | lista de textos; `[]` se não houver |
| `dataInicio`, `dataFim` | **sim** | `"aaaa-mm-dd"`; o fim não pode ser antes do início; só datas de fim a partir de 2026 |
| `release`, `sprint` | não | `"1"` a `"4"` **como texto** (entre aspas). A `release` tem que ser a do trimestre da `dataFim` |
| `okrs` | não | lista de `{ "okr": "A", "grau": "Alto", "motivo": "..." }`; `okr` em `A`, `B`, `C` e `grau` em `Baixo`, `Médio`, `Alto` |
| `impeditivo` | não | texto; `""` ou ausente = não houve |
| `historia` | não | só para História: `{ "funcional": true, "bcp": "...", "complexidade": 5 }` ou `{ "funcional": false }` |
| `gmud` | não | `{ "nome": "GMUD-123", "link": "https://..." }` (`link` pode ser `null`) |
| `git` | não | `{ "linkPullRequest": "https://...", "linkActions": "https://..." }`; `null` ou ausente = sem alteração em Git |

Diferenças em relação ao CSV:

- **Valores exatos:** no JSON os valores de lista precisam estar exatamente como na tabela (`"História"`, não `"historia"`), e as datas só no formato `aaaa-mm-dd`.
- **Mesma importação "tudo ou nada":** se algo estiver errado, nada entra e aparece a lista dos problemas, com o número da entrega e o motivo.

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
registro-entregas.html  app completo num arquivo só (gerado pelo `npm run build`; ver seção 0)
src/*.ts              código-fonte (TypeScript, scripts clássicos sem módulos)
dist/*.js             código compilado (versionado para abrir sem instalar nada)
dados/                modelo do CSV; seus CSVs e JSONs exportados ficam aqui e não vão para o Git
exemplos/             CSV e JSON de exemplo, prontos para importar
scripts/publicar.mjs  gera a página única e, opcionalmente, sobe para o S3
```

**Segurança da aba de edição:** a senha em `src/config.ts` só evita edição acidental. Ela fica visível no código-fonte, não é proteção de verdade.
