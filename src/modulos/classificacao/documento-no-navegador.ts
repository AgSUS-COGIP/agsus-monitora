import type { LogoDoDocumento } from "../../lib/classificacao/tipos-dos-documentos.ts";
/*
  O que o documento oficial precisa do navegador (fora de src/lib, que não
  toca DOM): a área de transferência, o logo em PNG para o .docx e a
  impressão (PDF) da página "Como fica no SEI".
*/
import { LOGO_PADRAO_DA_BARRA } from "../../lib/marca-da-barra-lateral.ts";

/*
  Copia o documento com os dois formatos: text/html (o editor do SEI cola com
  as classes e as tabelas) e text/plain. Ordem: Clipboard API com
  ClipboardItem; senão o evento "copy" (execCommand), que também leva o HTML
  sem inserir nada na página; por último, só o texto.
  Devolve "html", "texto" ou "" (não copiou).
*/
export async function copiarParaAreaDeTransferencia(
  { html, texto }: { html: string; texto: string },
  {
    navegador = globalThis.navigator,
    documento = globalThis.document,
    Item = globalThis.ClipboardItem,
  }: {
    navegador?: {
      clipboard?: Partial<Pick<Clipboard, "write" | "writeText">>;
    } | null;
    documento?: Pick<
      Document,
      "execCommand" | "addEventListener" | "removeEventListener"
    > | null;
    Item?: typeof ClipboardItem | null;
  } = {},
): Promise<"html" | "texto" | ""> {
  if (navegador?.clipboard?.write && typeof Item === "function") {
    try {
      await navegador.clipboard.write([
        new Item({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([texto], { type: "text/plain" }),
        }),
      ]);
      return "html";
    } catch {
      // Sem permissão ou sem suporte a text/html: tenta o evento "copy".
    }
  }
  if (documento?.execCommand) {
    let copiou = false;
    const aoCopiar = (evento: ClipboardEvent) => {
      if (!evento.clipboardData) return;
      evento.clipboardData.setData("text/html", html);
      evento.clipboardData.setData("text/plain", texto);
      evento.preventDefault();
      copiou = true;
    };
    documento.addEventListener("copy", aoCopiar);
    try {
      documento.execCommand("copy");
    } catch {
      copiou = false;
    } finally {
      documento.removeEventListener("copy", aoCopiar);
    }
    if (copiou) return "html";
  }
  if (navegador?.clipboard?.writeText) {
    try {
      await navegador.clipboard.writeText(texto);
      return "texto";
    } catch {
      return "";
    }
  }
  return "";
}

const logosGuardados = new Map<string, Promise<LogoDoDocumento | null>>();

/*
  O logo da AgSUS (/assets/agsus-logo.webp) convertido em PNG (o Word não lê
  WebP), sobre fundo branco: { bytes, largura, altura }. Guardado depois da
  primeira conversão. Falhou → null (o .docx sai só com o texto do cabeçalho).
*/
export function logoEmPng(
  url = LOGO_PADRAO_DA_BARRA,
  { largura = 320 } = {},
): Promise<LogoDoDocumento | null> {
  if (!Number.isSafeInteger(largura) || largura < 1)
    return Promise.resolve(null);
  const chave = JSON.stringify([url, largura]);
  const anterior = logosGuardados.get(chave);
  if (anterior) return anterior;
  const tentativa = (async () => {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error(`Logo: HTTP ${resposta.status}`);
    const imagem = await createImageBitmap(await resposta.blob());
    try {
      const escala = largura / imagem.width;
      const tela = document.createElement("canvas");
      tela.width = largura;
      tela.height = Math.max(1, Math.round(imagem.height * escala));
      const contexto = tela.getContext("2d");
      if (!contexto) throw new Error("Logo: canvas indisponível");
      contexto.fillStyle = "#ffffff";
      contexto.fillRect(0, 0, tela.width, tela.height);
      contexto.drawImage(imagem, 0, 0, tela.width, tela.height);
      const png = await new Promise<Blob>((resolver, rejeitar) =>
        tela.toBlob(
          (b) => (b ? resolver(b) : rejeitar(new Error("Logo: sem PNG"))),
          "image/png",
        ),
      );
      return {
        bytes: new Uint8Array(await png.arrayBuffer()),
        largura: tela.width,
        altura: tela.height,
      };
    } finally {
      imagem.close();
    }
  })().catch(() => {
    logosGuardados.delete(chave);
    return null;
  });
  logosGuardados.set(chave, tentativa);
  return tentativa;
}

/* Impressão ("Salvar como PDF") da página "Como fica no SEI", num iframe sem script. */
export function imprimirPagina(html: string) {
  const quadro = document.createElement("iframe");
  quadro.setAttribute("aria-hidden", "true");
  quadro.setAttribute("sandbox", "allow-modals allow-same-origin");
  quadro.tabIndex = -1;
  quadro.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  quadro.addEventListener(
    "load",
    () => {
      const janela = quadro.contentWindow;
      janela?.addEventListener?.(
        "afterprint",
        () => setTimeout(() => quadro.remove(), 500),
        { once: true },
      );
      janela?.focus?.();
      janela?.print?.();
      setTimeout(() => quadro.remove(), 60_000);
    },
    { once: true },
  );
  quadro.srcdoc = html;
  document.body.append(quadro);
}
