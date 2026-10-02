/*
  Apresentação das seções de Configurações, sem DOM: o tom da faixa de aviso
  global e o endereço de imagem que pode ir para as prévias. As telas são de
  src/modulos/configuracoes/.
*/

const txt = (valor) => String(valor ?? "").trim();

/** Faixa de aviso: tom do design.md 11.12 para cada tipo gravado. */
export function tomDoAviso(tipo) {
  const tons = {
    info: { tom: "info", icone: "info", rotulo: "Informação" },
    warning: { tom: "warning", icone: "triangle-alert", rotulo: "Alerta" },
    danger: { tom: "danger", icone: "circle-alert", rotulo: "Crítico" },
  };
  return tons[txt(tipo)] || tons.info;
}

/**
 * Endereço de imagem que pode ir para um <img>: caminho do próprio site
 * ("/assets/…") ou http(s). Qualquer outra coisa (javascript:, data:) vira "".
 */
export function urlDeImagem(valor) {
  const bruto = txt(valor);
  if (!bruto) return "";
  if (/^\/(?!\/)/.test(bruto)) return bruto;
  try {
    const url = new URL(bruto);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}
