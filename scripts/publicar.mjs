#!/usr/bin/env node
// Gera publicar/index.html: uma página ÚNICA, com CSS, JS, ícone e o CSV das
// entregas embutidos, para hospedar num bucket S3 privado e compartilhar por
// link pré-assinado.
//
// Por que um arquivo só: o link pré-assinado vale para um objeto do S3. Com
// style.css e dist/*.js separados, cada um precisaria do próprio link e a
// página quebraria. E os dados precisam ir junto: quem abre o link não tem o
// localStorage de quem cadastrou.
//
// Uso (sem dependências; Node 18+):
//   node scripts/publicar.mjs                         gera publicar/index.html
//   node scripts/publicar.mjs --csv outro.csv         usa outro CSV
//   node scripts/publicar.mjs --bucket meu-bucket     gera, sobe e imprime o link (1h)
//       [--chave pasta/index.html] [--expira 3600]

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------- Argumentos ----------

function argumento(nome, padrao) {
  const indice = process.argv.indexOf(`--${nome}`);
  return indice >= 0 && process.argv[indice + 1] ? process.argv[indice + 1] : padrao;
}

const caminhoCsv = join(raiz, argumento("csv", "dados/entregas.csv"));
const bucket = argumento("bucket", "");
const chave = argumento("chave", "registro-entregas/index.html");
const expira = Number(argumento("expira", "3600"));
const saida = join(raiz, "publicar", "index.html");

function falhar(mensagem) {
  console.error(`\n✖ ${mensagem}\n`);
  process.exit(1);
}

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

if (!existsSync(caminhoCsv)) {
  falhar(
    `CSV não encontrado: ${relative(raiz, caminhoCsv)}\n` +
      "  Copie dados/modelo-entregas.csv para dados/entregas.csv e preencha (ver README).",
  );
}
if (!existsSync(join(raiz, "dist", "app.js"))) {
  falhar("Pasta dist/ não encontrada. Rode `npm install` e `npm run build` primeiro.");
}

// ---------- Montagem ----------

// Dentro de <script>, "</script" encerraria a tag antes da hora.
const seguroEmScript = (codigo) => codigo.replaceAll("</script", "<\\/script");

const csv = lerCsv(caminhoCsv).replace(/^﻿/, "");
if (csv.toLowerCase().includes("</script")) {
  falhar('O CSV contém o texto "</script", que quebraria a página. Remova-o da célula.');
}
const linhasDeDados = csv.split(/\r?\n/).filter((linha) => linha.trim() !== "").length - 1;

let html = ler("index.html");

// Ícone e CSS embutidos.
const favicon = `data:image/svg+xml;base64,${Buffer.from(ler("favicon.svg")).toString("base64")}`;
html = html.replace('href="favicon.svg"', `href="${favicon}"`);
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${ler("style.css")}\n</style>`);

// tema.js fica no <head> (sem defer): aplica o tema antes do primeiro render.
html = html.replace('<script src="dist/tema.js"></script>', () => `<script>\n${seguroEmScript(ler("dist/tema.js"))}\n</script>`);

// Os demais eram "defer": inline não aceita defer, então vão para o fim do
// <body>, na mesma ordem, depois do CSV (csv.js lê a tag de dados ao carregar).
const scripts = [];
html = html.replace(/\s*<script src="dist\/([\w-]+\.js)" defer><\/script>/g, (_, arquivo) => {
  scripts.push(arquivo);
  return "";
});
if (scripts.length === 0) falhar("Nenhum <script src=\"dist/...\" defer> encontrado no index.html.");

const fimDoCorpo =
  `<script type="text/plain" id="dados-publicados">\n${csv}\n</script>\n` +
  scripts.map((arquivo) => `<script>\n${seguroEmScript(ler(`dist/${arquivo}`))}\n</script>`).join("\n") +
  "\n</body>";
html = html.replace("</body>", () => fimDoCorpo);

mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, html);

console.log(`✔ Página gerada: ${relative(raiz, saida)} (${(html.length / 1024).toFixed(0)} KB, ${linhasDeDados} entregas no CSV)`);
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
  console.log(`\n✔ Link válido por ${minutos} min (até ${new Date(Date.now() + expira * 1000).toLocaleTimeString("pt-BR")}):\n\n${link}\n`);
} catch (erro) {
  falhar(`Falha na AWS CLI (credenciais? bucket?): ${erro.message}`);
}
