"use strict";
// Foto e nome de quem registra as entregas, exibidos no cabeçalho.
//
// O nome vem de config.ts (NOME_RESPONSAVEL). A foto é enviada na aba de edição,
// recortada em quadrado, reduzida e guardada no localStorage como data URL:
// como os registros, ela vale só para este navegador. Sem foto, o cabeçalho
// mostra as iniciais do nome. Na página publicada a foto vai embutida
// (#foto-publicada, ver gerarPaginaPublicada em app.ts).
const CHAVE_FOTO = "registro-entregas:foto";
// Lado da foto salva, em pixels. O cabeçalho exibe menor; a folga cobre telas de alta densidade.
const LADO_FOTO = 256;
// ---------- Elementos ----------
const perfilNome = el("perfil-nome");
const perfilFoto = el("perfil-foto");
const perfilIniciais = el("perfil-iniciais");
const campoFoto = el("foto-arquivo");
const botaoRemoverFoto = el("btn-remover-foto");
const erroFoto = el("erro-foto");
// ---------- Foto ----------
// Primeira letra do primeiro e do último nome: "Júlio ... Batista" -> "JB".
function iniciais(nome) {
    const partes = nome.trim().split(/\s+/);
    const primeira = partes[0]?.[0] ?? "";
    const ultima = partes.length > 1 ? (partes.at(-1)?.[0] ?? "") : "";
    return (primeira + ultima).toUpperCase();
}
// Na página publicada a foto vem só do próprio arquivo (JSON com o data URL);
// sem ela, ficam as iniciais, e nunca a foto do navegador de quem abre.
const ehPaginaPublicada = document.getElementById("dados-publicados") !== null;
const fotoPublicada = document.getElementById("foto-publicada")?.textContent;
function lerFoto() {
    try {
        if (ehPaginaPublicada) {
            if (!fotoPublicada)
                return null;
            const foto = JSON.parse(fotoPublicada);
            return typeof foto === "string" && foto.startsWith("data:image/") ? foto : null;
        }
        return localStorage.getItem(CHAVE_FOTO);
    }
    catch {
        return null;
    }
}
function exibirFoto() {
    const foto = lerFoto();
    perfilFoto.hidden = !foto;
    perfilIniciais.hidden = Boolean(foto);
    botaoRemoverFoto.hidden = !foto;
    if (foto)
        perfilFoto.src = foto;
    else
        perfilFoto.removeAttribute("src");
}
// Recorta o centro da imagem em um quadrado de LADO_FOTO e devolve um JPEG em data URL.
async function reduzirFoto(arquivo) {
    const imagem = await createImageBitmap(arquivo);
    const lado = Math.min(imagem.width, imagem.height);
    const tela = document.createElement("canvas");
    tela.width = LADO_FOTO;
    tela.height = LADO_FOTO;
    const contexto = tela.getContext("2d");
    if (!contexto)
        throw new Error("Canvas indisponível");
    contexto.drawImage(imagem, (imagem.width - lado) / 2, (imagem.height - lado) / 2, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);
    imagem.close();
    return tela.toDataURL("image/jpeg", 0.85);
}
async function aoEscolherFoto() {
    const arquivo = campoFoto.files?.[0];
    if (!arquivo)
        return;
    try {
        localStorage.setItem(CHAVE_FOTO, await reduzirFoto(arquivo));
        erroFoto.textContent = "";
    }
    catch {
        erroFoto.textContent = "Não foi possível usar esse arquivo. Envie uma imagem JPG ou PNG.";
    }
    // Limpa o campo para permitir escolher o mesmo arquivo de novo.
    campoFoto.value = "";
    exibirFoto();
}
function removerFoto() {
    localStorage.removeItem(CHAVE_FOTO);
    erroFoto.textContent = "";
    exibirFoto();
}
// ---------- Inicialização ----------
perfilNome.textContent = NOME_RESPONSAVEL;
perfilFoto.alt = `Foto de ${NOME_RESPONSAVEL}`;
perfilIniciais.textContent = iniciais(NOME_RESPONSAVEL);
campoFoto.addEventListener("change", aoEscolherFoto);
botaoRemoverFoto.addEventListener("click", removerFoto);
exibirFoto();
