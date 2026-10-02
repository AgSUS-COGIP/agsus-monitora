/*
  O que o documento oficial precisa do navegador (fora de src/lib, que não
  toca DOM): a área de transferência, o logo em PNG para o .docx e a
  impressão (PDF) da página "Como fica no SEI".
*/
import { LOGO_PADRAO_DA_BARRA } from "../../lib/marca-da-barra-lateral.js";

/*
  Copia o documento com os dois formatos: text/html (o editor do SEI cola com
  as classes e as tabelas) e text/plain. Ordem: Clipboard API com
  ClipboardItem; senão o evento "copy" (execCommand), que também leva o HTML
  sem inserir nada na página; por último, só o texto.
  Devolve "html", "texto" ou "" (não copiou).
*/
export async function copiarParaAreaDeTransferencia(
  { html, texto },
  {
    navegador = globalThis.navigator,
    documento = globalThis.document,
    Item = globalThis.ClipboardItem,
  } = {},
) {
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
    const aoCopiar = (evento) => {
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

let logoGuardado = null;

/*
  O logo da AgSUS (/assets/agsus-logo.webp) convertido em PNG (o Word não lê
  WebP), sobre fundo branco: { bytes, largura, altura }. Guardado depois da
  primeira conversão. Falhou → null (o .docx sai só com o texto do cabeçalho).
*/
export function logoEmPng(url = LOGO_PADRAO_DA_BARRA, { largura = 320 } = {}) {
  if (!logoGuardado)
    logoGuardado = (async () => {
      const resposta = await fetch(url);
      if (!resposta.ok) throw new Error(`Logo: HTTP ${resposta.status}`);
      const imagem = await createImageBitmap(await resposta.blob());
      const escala = largura / imagem.width;
      const tela = document.createElement("canvas");
      tela.width = largura;
      tela.height = Math.max(1, Math.round(imagem.height * escala));
      const contexto = tela.getContext("2d");
      contexto.fillStyle = "#ffffff";
      contexto.fillRect(0, 0, tela.width, tela.height);
      contexto.drawImage(imagem, 0, 0, tela.width, tela.height);
      const png = await new Promise((resolver, rejeitar) =>
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
    })().catch(() => {
      logoGuardado = null;
      return null;
    });
  return logoGuardado;
}

/* Impressão ("Salvar como PDF") da página "Como fica no SEI", num iframe sem script. */
export function imprimirPagina(html) {
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
