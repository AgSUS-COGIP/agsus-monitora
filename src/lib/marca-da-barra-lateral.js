/*
  Logo e cor da barra lateral, sem DOM: o que vale como valor gravado
  (`ui_sidebar_logo_url`, `ui_sidebar_background_color`) e onde ficam as
  logos enviadas no armazenamento. Quem pinta a barra é
  src/modules/sidebar-branding.js; quem escolhe é Configurações › Aparência
  (src/modulos/configuracoes/aparencia.jsx).
*/

import { ACCESS_BACKGROUND_FOLDER } from "./access-background-storage.js";

export const CHAVE_DO_LOGO_DA_BARRA = "ui_sidebar_logo_url";
export const CHAVE_DA_COR_DA_BARRA = "ui_sidebar_background_color";
export const LOGO_PADRAO_DA_BARRA = "/assets/agsus-logo.webp";
export const COR_PADRAO_DA_BARRA = "#ffffff";

export const PASTA_DOS_LOGOS_DA_BARRA = `${ACCESS_BACKGROUND_FOLDER}/sidebar`;
const PREFIXO_DO_LOGO = "logo-";
const COR_HEX = /^#[0-9a-f]{6}$/i;
const EXTENSAO_POR_TIPO = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
});

/** Logo que pode ir para a barra: caminho do site ou https; o resto vira o padrão. */
export function logoDaBarraSegura(valor) {
  const bruto = String(valor || "").trim();
  if (!bruto) return LOGO_PADRAO_DA_BARRA;
  if (bruto.startsWith("/")) return bruto;
  if (/^https:\/\//i.test(bruto)) return bruto;
  return LOGO_PADRAO_DA_BARRA;
}

/** Cor #rrggbb em minúsculas; o resto vira o branco padrão. */
export function corDaBarraSegura(valor) {
  const bruto = String(valor || "")
    .trim()
    .toLowerCase();
  return COR_HEX.test(bruto) ? bruto : COR_PADRAO_DA_BARRA;
}

export function caminhoDoNovoLogoDaBarra(arquivo, gerarId) {
  const extensao = EXTENSAO_POR_TIPO[arquivo?.type] || "png";
  const id =
    gerarId?.() ||
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${PASTA_DOS_LOGOS_DA_BARRA}/${PREFIXO_DO_LOGO}${id}.${extensao}`;
}

/** Arquivo da pasta que é uma logo enviada (logo-*.jpg|png|webp). */
export function ehLogoDaBarraGuardada(nome) {
  const texto = String(nome || "");
  return (
    texto.startsWith(PREFIXO_DO_LOGO) && /\.(?:jpe?g|png|webp)$/i.test(texto)
  );
}

/** Arquivo da pasta de artes que é uma imagem (a subpasta das logos fica de fora). */
export function ehImagemGuardada(nome) {
  return /\.(?:jpe?g|png|webp)$/i.test(String(nome || ""));
}
