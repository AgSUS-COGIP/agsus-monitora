/*
  NEM TODO `*.trycloudflare.com` NA SAÍDA DO CLOUDFLARED É O TÚNEL

  O cloudflared imprime o endereço do quick tunnel no stderr, dentro de uma
  moldura de texto. Não há saída estruturada: extrair do texto é a via
  disponível. Só que ele também escreve outros endereços do mesmo domínio —
  quando o pedido de túnel falha, o erro menciona o próprio serviço da
  Cloudflare, `api.trycloudflare.com`. A expressão que lia a saída aceitava-o,
  e o serviço chegou a anunciar `https://api.trycloudflare.com` como se fosse a
  máquina que hospeda a IA da Aya.

  O hostname de um quick tunnel é sempre um punhado de palavras separadas por
  hífen. Um nome de palavra única é da Cloudflare, não nosso.

  Este módulo é separado do serviço de propósito: `aya-servico.mjs` sobe
  processos ao ser importado, e uma função que se quer testar não pode viver
  num ficheiro assim.
*/
const HOSTNAME_DO_TUNEL = /https:\/\/([a-z0-9-]+)\.trycloudflare\.com/i;
const NOMES_QUE_NAO_SAO_TUNEL = new Set(["api", "www", "dash"]);

export function urlDoTunel(texto) {
  const achado = String(texto ?? "").match(HOSTNAME_DO_TUNEL);
  if (!achado) return "";
  const nome = achado[1].toLowerCase();
  if (NOMES_QUE_NAO_SAO_TUNEL.has(nome)) return "";
  if (!nome.includes("-")) return "";
  return achado[0];
}
