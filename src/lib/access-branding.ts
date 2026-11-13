/** A identidade da tela de acesso: logo, arte de fundo, cor do painel e textos. */
export interface MarcaDoAcesso {
  logoUrl: string;
  backgroundUrl: string;
  panelColor: string;
  greeting: string;
  buttonText: string;
}

export const DEFAULT_ACCESS_BRANDING: Readonly<MarcaDoAcesso> = Object.freeze({
  logoUrl: "/assets/agsus-logo.webp",
  backgroundUrl: "/assets/access-background-default.svg",
  panelColor: "#c296eb",
  greeting: "Boas-vindas!",
  /* Texto do botão quando `auth_google_button_text` está vazio. */
  buttonText: "Entrar com Google",
});

/*
  A linha de apoio acima do botão da tela de acesso. Constante: não há campo
  para ela em Configurações (saudação e texto do botão é que são configuráveis).
*/
export const ACCESS_INSTRUCTION = "Acesse com sua conta institucional.";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function resolveLocalAssetUrl(url: string): string {
  if (!url.startsWith("/")) return url;
  try {
    const origin = globalThis?.location?.origin;
    if (origin && /^https:\/\//i.test(origin)) {
      return new URL(url, origin).href;
    }
  } catch (error) {
    return url;
  }
  return url;
}

export function normalizeAccessBackgroundUrl(value: unknown): string {
  const url = String(value || "").trim();
  if (!url) return resolveLocalAssetUrl(DEFAULT_ACCESS_BRANDING.backgroundUrl);
  if (url.startsWith("/")) return resolveLocalAssetUrl(url);
  if (url.startsWith("https://")) return url;
  return resolveLocalAssetUrl(DEFAULT_ACCESS_BRANDING.backgroundUrl);
}

/*
  A arte na tela de acesso em versões leves (13/11/2026: a tela demorava a
  carregar em processador fraco). O original (3200×1370, 689 KB) era baixado,
  decodificado e desenhado duas vezes, uma delas com blur(28px) em tela cheia.
  O Storage do Supabase entrega a mesma imagem redimensionada
  (`/render/image/`, WebP, cache de um ano): a nítida com 1200 px de altura
  (~157 KB, a altura de uma tela comum) e a do fundo desfocado com 64 px de
  largura (~2 KB), que ampliada já é desfocada. A configuração continua com o
  endereço original; outro endereço (a arte padrão, um https qualquer) fica
  como está. A mesma regra está no script do <head> do index.html; o teste
  tests/arte-leve-no-acesso.test.ts impede as duas de se separarem.
*/
const OBJETO_PUBLICO_DO_STORAGE =
  /^(https:\/\/[^/?#]+)\/storage\/v1\/object\/public\/([^?#]+)$/;

export function enderecosDaArteNaTela(url: unknown): {
  nitida: string;
  desfocada: string;
} {
  const original = String(url ?? "").trim();
  const achado = original.match(OBJETO_PUBLICO_DO_STORAGE);
  if (!achado) return { nitida: original, desfocada: original };
  const base = `${achado[1]}/storage/v1/render/image/public/${achado[2]}`;
  return {
    nitida: `${base}?height=1200&quality=75`,
    desfocada: `${base}?width=64&quality=50`,
  };
}

export function normalizeAccessLogoUrl(value: unknown): string {
  const url = String(value || "").trim();
  if (!url) return resolveLocalAssetUrl(DEFAULT_ACCESS_BRANDING.logoUrl);
  if (url.startsWith("/")) return resolveLocalAssetUrl(url);
  if (url.startsWith("https://")) return url;
  return resolveLocalAssetUrl(DEFAULT_ACCESS_BRANDING.logoUrl);
}

export function normalizeAccessPanelColor(value: unknown): string {
  const color = String(value || "")
    .trim()
    .toLowerCase();
  return HEX_COLOR.test(color) ? color : DEFAULT_ACCESS_BRANDING.panelColor;
}

export function needsLightForeground(color: unknown): boolean {
  const normalized = normalizeAccessPanelColor(color).slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 < 145;
}
