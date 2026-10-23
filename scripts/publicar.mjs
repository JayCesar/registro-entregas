#!/usr/bin/env node
// Gera publicar/index.html: uma página ÚNICA, com CSS, JS, ícone e os dados das
// entregas embutidos, para hospedar num bucket S3 privado e compartilhar por
// link pré-assinado.
//
// Por que um arquivo só: o link pré-assinado vale para um objeto do S3. Com
// style.css e dist/*.js separados, cada um precisaria do próprio link e a
// página quebraria. E os dados precisam ir junto: quem abre o link não tem o
// localStorage de quem cadastrou.
//
// Dados (em ordem de preferência):
//   --json arquivo.json   o "Exportar JSON" da aba de edição: tudo o que já foi
//                         importado no site (fluxo semanal; é o recomendado)
//   --csv arquivo.csv     um CSV no formato do modelo
//   (nenhum)              o registro-entregas-*.json mais recente em dados/
//                         ou, se não houver, dados/entregas.csv
//
// Uso (sem dependências; Node 18+):
//   node scripts/publicar.mjs                         gera publicar/index.html
//   node scripts/publicar.mjs --json ~/Downloads/registro-entregas-2026-10-25.json
//   node scripts/publicar.mjs --bucket meu-bucket     gera, sobe e imprime o link (1h)
//       [--chave pasta/index.html] [--expira 3600]
//
// Modo --arquivo-unico (roda junto do `npm run build`): gera registro-entregas.html
// na raiz, o app COMPLETO (com a aba de edição e sem dados) num arquivo só. É o
// que se leva para um PC onde não dá para baixar o repositório (ver README). Ele
// mesmo gera a página publicada pelo botão "Gerar página para o S3".

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------- Argumentos ----------

function argumento(nome, padrao) {
  const indice = process.argv.indexOf(`--${nome}`);
  return indice >= 0 && process.argv[indice + 1] ? process.argv[indice + 1] : padrao;
}

const bucket = argumento("bucket", "");
const chave = argumento("chave", "registro-entregas/index.html");
const expira = Number(argumento("expira", "3600"));
const arquivoUnico = process.argv.includes("--arquivo-unico");
const saida = arquivoUnico ? join(raiz, "registro-entregas.html") : join(raiz, "publicar", "index.html");

function falhar(mensagem) {
  console.error(`\n✖ ${mensagem}\n`);
  process.exit(1);
}

// O nome do arquivo exportado tem a data (registro-entregas-aaaa-mm-dd.json):
// a ordem alfabética já é a cronológica.
function jsonMaisRecenteEmDados() {
  const pasta = join(raiz, "dados");
  if (!existsSync(pasta)) return null;
  const exportados = readdirSync(pasta)
    .filter((nome) => /^registro-entregas-.*\.json$/.test(nome))
    .sort();
  return exportados.length > 0 ? join(pasta, exportados.at(-1)) : null;
}

// Caminhos passados na linha de comando são relativos à pasta de onde se roda.
function escolherFonte() {
  const json = argumento("json", "");
  if (json) return { tipo: "json", caminho: resolve(json) };
  const csv = argumento("csv", "");
  if (csv) return { tipo: "csv", caminho: resolve(csv) };
  const recente = jsonMaisRecenteEmDados();
  if (recente) return { tipo: "json", caminho: recente };
  return { tipo: "csv", caminho: join(raiz, "dados", "entregas.csv") };
}

const fonte = escolherFonte();

// ---------- Leitura ----------

const ler = (arquivo) => readFileSync(join(raiz, arquivo), "utf8");

// O Excel em pt-BR costuma salvar CSV em Windows-1252: tenta UTF-8 e cai para ele.
function lerCsv(caminho) {
  const bytes = readFileSync(caminho);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

if (!arquivoUnico && !existsSync(fonte.caminho)) {
  falhar(
    `Arquivo de dados não encontrado: ${fonte.caminho}\n` +
      '  No site: aba Edição > "Exportar JSON" e passe o arquivo com --json (ver README).',
  );
}
if (!existsSync(join(raiz, "dist", "app.js"))) {
  falhar("Pasta dist/ não encontrada. Rode `npm install` e `npm run build` primeiro.");
}

// Tag com os dados, lida por csv.js ao carregar a página (ver src/csv.ts).
// JSON: confere que é a lista exportada pelo site e escapa "<" (um "</script"
// dentro de algum texto fecharia a tag antes da hora). CSV: vai como texto puro.
function montarTagDeDados() {
  if (fonte.tipo === "json") {
    let entregas;
    try {
      entregas = JSON.parse(readFileSync(fonte.caminho, "utf8"));
    } catch {
      falhar(`JSON inválido: ${fonte.caminho}`);
    }
    if (!Array.isArray(entregas)) falhar('O JSON não é uma lista de entregas. Use o "Exportar JSON" do site.');
    if (entregas.length === 0) falhar("O JSON está vazio: importe o CSV no site antes de exportar.");
    // Os vínculos com o PDI (campos pdis e o antigo pdi) são restritos ao coordenador e não vão
    // abertos. Só o botão "Gerar página para o S3" leva o PDI, cifrado.
    // Pessoas envolvidas só servem para a aba de edição: também ficam fora.
    const semPdi = entregas.map(({ pdi, ...entrega }) => ({ ...entrega, pdis: [], pessoas: [] }));
    const json = JSON.stringify(semPdi).replaceAll("<", "\\u003c");
    return { quantidade: entregas.length, tag: `<script type="application/json" id="dados-publicados">${json}</script>` };
  }

  const csv = lerCsv(fonte.caminho).replace(/^﻿/, "");
  if (csv.toLowerCase().includes("</script")) {
    falhar('O CSV contém o texto "</script", que quebraria a página. Remova-o da célula.');
  }
  const quantidade = csv.split(/\r?\n/).filter((linha) => linha.trim() !== "").length - 1;
  return { quantidade, tag: `<script type="text/plain" id="dados-publicados">\n${csv}\n</script>` };
}

// ---------- Montagem ----------

// Dentro de <script>, "</script" encerraria a tag antes da hora.
const seguroEmScript = (codigo) => codigo.replaceAll("</script", "<\\/script");

const dados = arquivoUnico ? null : montarTagDeDados();
let html = ler("index.html");

// Ícone e CSS embutidos.
const favicon = `data:image/svg+xml;base64,${Buffer.from(ler("favicon.svg")).toString("base64")}`;
html = html.replace('href="favicon.svg"', `href="${favicon}"`);
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${ler("style.css")}\n</style>`);

// tema.js fica no <head> (sem defer): aplica o tema antes do primeiro render.
html = html.replace(
  '<script src="dist/tema.js"></script>',
  () => `<script>\n${seguroEmScript(ler("dist/tema.js"))}\n</script>`,
);

// Os demais eram "defer": inline não aceita defer, então vão para o fim do
// <body>, na mesma ordem, depois da tag de dados.
const scripts = [];
html = html.replace(/\s*<script src="dist\/([\w-]+\.js)" defer><\/script>/g, (_, arquivo) => {
  scripts.push(arquivo);
  return "";
});
if (scripts.length === 0) falhar('Nenhum <script src="dist/..." defer> encontrado no index.html.');

// data-app marca os scripts do app: o botão "Gerar página para o S3" do arquivo
// único os copia para a página publicada (ver gerarPaginaPublicada em app.ts).
// No arquivo único, um script antes deles guarda o HTML da página como estava
// antes de qualquer script mexer no DOM: é a base da página publicada.
const captura =
  "<script>window.fonteDoArquivoUnico = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;</script>";
const fimDoCorpo =
  `${arquivoUnico ? captura : dados.tag}\n` +
  scripts
    .map((arquivo) => `<script data-app>\n${seguroEmScript(ler(`dist/${arquivo}`))}\n</script>`)
    .join("\n") +
  "\n</body>";
html = html.replace("</body>", () => fimDoCorpo);

mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, html);

console.log(`✔ Página gerada: ${relative(raiz, saida)} (${(html.length / 1024).toFixed(0)} KB)`);
if (arquivoUnico) {
  console.log("  App completo num arquivo só, para levar para o banco (ver README).");
  process.exit(0);
}
console.log(`  Dados: ${fonte.caminho} (${fonte.tipo.toUpperCase()}, ${dados.quantidade} entregas)`);
console.log("  Abra o arquivo no navegador para conferir antes de subir.");

// ---------- Upload + link de 1h (opcional) ----------

if (!bucket) {
  console.log("  Para subir e gerar o link: npm run publicar -- --bucket NOME-DO-BUCKET");
  process.exit(0);
}

const destino = `s3://${bucket}/${chave}`;
const aws = (args, opcoes = {}) => execFileSync("aws", args, { encoding: "utf8", ...opcoes });

try {
  aws(
    ["s3", "cp", saida, destino, "--content-type", "text/html; charset=utf-8", "--cache-control", "no-store"],
    { stdio: "inherit" },
  );
  const link = aws(["s3", "presign", destino, "--expires-in", String(expira)]).trim();
  const minutos = Math.round(expira / 60);
  const ate = new Date(Date.now() + expira * 1000).toLocaleTimeString("pt-BR");
  console.log(`\n✔ Link válido por ${minutos} min (até ${ate}):\n\n${link}\n`);
} catch (erro) {
  falhar(`Falha na AWS CLI (credenciais? bucket?): ${erro.message}`);
}
