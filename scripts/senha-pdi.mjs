#!/usr/bin/env node
// Define a senha do coordenador da seção PDI: grava CHAVE_PDI em src/config.ts.
//
// A senha não é gravada em lugar nenhum. O script gera um par de chaves RSA,
// cifra a chave privada com AES-GCM numa chave derivada da senha (PBKDF2,
// SHA-256, 600 mil iterações) e grava em config.ts só o sal, o iv, a privada
// cifrada e a pública. No navegador, a senha certa é a que decifra a privada
// (ver abrirChavePdi em src/pdi.ts).
//
// Uso (Node 18+, sem dependências), com o coordenador digitando a senha:
//   node scripts/senha-pdi.mjs
//   (ou, sem terminal: duas linhas iguais pela entrada padrão)
//   npm run build        recompila dist/ e o registro-entregas.html
//
// Trocar a senha = rodar de novo. Páginas já publicadas continuam abrindo só
// com a senha antiga.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ITERACOES = 600_000;
const TAMANHO_MINIMO = 8;
const config = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "config.ts");
const { subtle } = globalThis.crypto;

function falhar(mensagem) {
  console.error(`\n✖ ${mensagem}\n`);
  process.exit(1);
}

// Sem terminal (entrada redirecionada): uma senha por linha.
const linhasDaEntrada = process.stdin.isTTY
  ? null
  : readFileSync(0, "utf8").split(/\r?\n/);

// Lê sem mostrar o que se digita.
function perguntarSenha(pergunta) {
  if (linhasDaEntrada) return Promise.resolve(linhasDaEntrada.shift() ?? "");
  return new Promise((resolver) => {
    const entrada = process.stdin;
    process.stdout.write(pergunta);
    entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding("utf8");
    let senha = "";
    const aoDigitar = (tecla) => {
      for (const caractere of tecla) {
        if (caractere === "\r" || caractere === "\n") {
          entrada.setRawMode(false);
          entrada.pause();
          entrada.off("data", aoDigitar);
          process.stdout.write("\n");
          resolver(senha);
          return;
        }
        if (caractere === "\u0003") process.exit(130); // Ctrl+C
        if (caractere === "\u007f" || caractere === "\b") senha = senha.slice(0, -1);
        else senha += caractere;
      }
    };
    entrada.on("data", aoDigitar);
  });
}

const base64 = (dados) => Buffer.from(dados).toString("base64");

const senha = await perguntarSenha("Senha do coordenador para a seção PDI: ");
if (senha.length < TAMANHO_MINIMO) falhar(`Use pelo menos ${TAMANHO_MINIMO} caracteres.`);
if ((await perguntarSenha("Repita a senha: ")) !== senha) falhar("As senhas não conferem.");

const rsa = { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };
const { publicKey, privateKey } = await subtle.generateKey(rsa, true, ["encrypt", "decrypt"]);

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveKey"]);
const chaveDaSenha = await subtle.deriveKey(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERACOES },
  base,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt"],
);
const privadaCifrada = await subtle.encrypt(
  { name: "AES-GCM", iv },
  chaveDaSenha,
  await subtle.exportKey("pkcs8", privateKey),
);

const bloco =
  "const CHAVE_PDI: ChavePdi | null = {\n" +
  `  salt: "${base64(salt)}",\n` +
  `  iteracoes: ${ITERACOES},\n` +
  `  iv: "${base64(iv)}",\n` +
  `  chavePrivada: "${base64(privadaCifrada)}",\n` +
  `  chavePublica: "${base64(await subtle.exportKey("spki", publicKey))}",\n` +
  "};";

const original = readFileSync(config, "utf8");
const padrao = /const CHAVE_PDI: ChavePdi \| null = (null|\{[^}]*\});/;
if (!padrao.test(original)) falhar(`Não achei "const CHAVE_PDI: ChavePdi | null = ..." em ${config}.`);
writeFileSync(config, original.replace(padrao, () => bloco));

console.log("✔ CHAVE_PDI gravada em src/config.ts (a senha em si não fica salva).");
console.log("  Agora rode `npm run build` e leve o novo registro-entregas.html para o banco.");
