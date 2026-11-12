/*
  O LEAFLET SOB DEMANDA

  O Leaflet (1.9.4, do cdnjs, com SRI) não está no index.html: a tela de
  acesso não espera por ele. Quem monta um mapa chama `carregarLeaflet()`
  antes, e a promessa só resolve com tudo pronto:

    1. o CSS e o script do Leaflet injetados no <head> (uma vez só; se
       `window.L` já existe, o script não é baixado de novo);
    2. os módulos que ainda envolvem o `L`, nesta ordem:
       `map-base-layer-switcher.ts` (Mapa/Satélite) e
       `indigenous-territories-layer.ts` (Terras Indígenas e abrangência dos
       DSEI), com o CSS deles. A guarda do mapa (limites, zoom, teclado) não
       envolve nada: `criarMapa` a liga em cada mapa (`guarda-do-mapa.ts`).

  Falhou (rede, CDN fora): a promessa rejeita e a próxima chamada tenta de
  novo. Os módulos das guardas passam por `importarComRecarga` (versão nova
  publicada com a página aberta recarrega uma vez em vez de quebrar).
*/
import { importarComRecarga } from "../../lib/importar-com-recarga.ts";

export const LEAFLET_JS = Object.freeze({
  src: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
  integrity:
    "sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g==",
});

export const LEAFLET_CSS = Object.freeze({
  href: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  integrity:
    "sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw==",
});

export interface OpcoesDoLeaflet {
  documento?: Document;
  janela?: object;
  /** As guardas que envolvem o `L` (nos testes, um falso). */
  instalarGuardas?: () => Promise<void>;
}

const carregarGuardas = importarComRecarga(() =>
  Promise.all([
    import("../../modules/map-base-layer-switcher.ts"),
    import("../../modules/indigenous-territories-layer.ts"),
    import("../../styles/map-base-layer-switcher.css"),
    import("../../styles/indigenous-territories-layer.css"),
  ]),
);

async function instalarGuardasPadrao() {
  const [fundo, terras] = await carregarGuardas();
  fundo.installMapBaseLayerSwitcher();
  terras.installIndigenousTerritoriesLayer();
}

/* Um <link>/<script> do CDN no <head>; resolve no `load`. */
function injetar(
  documento: Document,
  seletor: string,
  criar: () => HTMLLinkElement | HTMLScriptElement,
): Promise<void> {
  const existente = documento.head.querySelector<HTMLElement>(seletor);
  if (existente?.dataset.carregado === "sim") return Promise.resolve();
  const elemento = existente ?? criar();
  const pronto = new Promise<void>((resolver, rejeitar) => {
    elemento.addEventListener(
      "load",
      () => {
        elemento.dataset.carregado = "sim";
        resolver();
      },
      { once: true },
    );
    elemento.addEventListener(
      "error",
      () => {
        elemento.remove();
        rejeitar(new Error("o Leaflet não respondeu"));
      },
      { once: true },
    );
  });
  if (!existente) documento.head.append(elemento);
  return pronto;
}

function doCdn<E extends HTMLLinkElement | HTMLScriptElement>(elemento: E) {
  elemento.crossOrigin = "anonymous";
  elemento.referrerPolicy = "no-referrer";
  return elemento;
}

let pedido: Promise<void> | null = null;

/** Baixa o Leaflet e instala as guardas; uma vez por página. */
export function carregarLeaflet({
  documento = globalThis.document,
  janela = globalThis,
  instalarGuardas = instalarGuardasPadrao,
}: OpcoesDoLeaflet = {}): Promise<void> {
  pedido ??= (async () => {
    const estilo = injetar(
      documento,
      `link[href="${LEAFLET_CSS.href}"]`,
      () => {
        const link = doCdn(documento.createElement("link"));
        link.rel = "stylesheet";
        link.href = LEAFLET_CSS.href;
        link.integrity = LEAFLET_CSS.integrity;
        return link;
      },
      // Sem o CSS o mapa abre torto, mas abre: a falha dele não impede.
    ).catch(() => {});
    // `L` já na página (outra aba do app, testes): nada a baixar nem a esperar.
    if (Reflect.get(janela, "L")) return instalarGuardas();
    await injetar(documento, `script[src="${LEAFLET_JS.src}"]`, () => {
      const script = doCdn(documento.createElement("script"));
      script.src = LEAFLET_JS.src;
      script.integrity = LEAFLET_JS.integrity;
      script.async = true;
      return script;
    });
    await instalarGuardas();
    // O mapa mede o contêiner ao nascer: com o CSS do Leaflet já aplicado.
    await estilo;
  })();
  pedido.catch(() => {
    pedido = null;
  });
  return pedido;
}

/** Só para os testes: esquece a carga. */
export function esquecerLeaflet(): void {
  pedido = null;
}
