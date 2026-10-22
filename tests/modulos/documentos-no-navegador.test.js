import { Blob as BlobDoNode } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copiarParaAreaDeTransferencia,
  imprimirPagina,
  logoEmPng,
} from "../../src/modulos/classificacao/documento-no-navegador.ts";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete document.execCommand;
  document.body.innerHTML = "";
});

describe("cópia do documento para o SEI", () => {
  it("a API leva HTML e texto juntos", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    class Item {
      constructor(dados) {
        this.dados = dados;
      }
    }
    expect(
      await copiarParaAreaDeTransferencia(
        { html: "<b>Ana</b>", texto: "Ana" },
        { navegador: { clipboard: { write } }, documento: null, Item },
      ),
    ).toBe("html");
    expect(Object.keys(write.mock.calls[0][0][0].dados)).toEqual([
      "text/html",
      "text/plain",
    ]);
  });
  it("a recusa da API tenta o evento copy e remove o listener", async () => {
    const setData = vi.fn(),
      remover = vi.spyOn(document, "removeEventListener");
    const evento = new Event("copy", { cancelable: true });
    Object.defineProperty(evento, "clipboardData", { value: { setData } });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => {
        document.dispatchEvent(evento);
        return true;
      }),
    });
    class Item {}
    expect(
      await copiarParaAreaDeTransferencia(
        { html: "<b>Ana</b>", texto: "Ana" },
        {
          navegador: {
            clipboard: {
              write: vi.fn().mockRejectedValue(new Error("sem acesso")),
            },
          },
          documento: document,
          Item,
        },
      ),
    ).toBe("html");
    expect(setData.mock.calls).toEqual([
      ["text/html", "<b>Ana</b>"],
      ["text/plain", "Ana"],
    ]);
    expect(remover).toHaveBeenCalledWith("copy", expect.any(Function));
    expect(evento.defaultPrevented).toBe(true);
  });
  it("sem suporte a HTML usa o texto", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(
      await copiarParaAreaDeTransferencia(
        { html: "<b>Ana</b>", texto: "Ana" },
        {
          navegador: { clipboard: { writeText } },
          documento: null,
          Item: null,
        },
      ),
    ).toBe("texto");
    expect(writeText).toHaveBeenCalledWith("Ana");
  });
  it("uma cópia recusada não informa sucesso", async () => {
    expect(
      await copiarParaAreaDeTransferencia(
        { html: "", texto: "Ana" },
        {
          navegador: {
            clipboard: {
              writeText: vi.fn().mockRejectedValue(new Error("sem acesso")),
            },
          },
          documento: null,
          Item: null,
        },
      ),
    ).toBe("");
  });
});

function prepararLogo() {
  vi.stubGlobal("Blob", BlobDoNode);
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, blob: async () => new BlobDoNode() });
  vi.stubGlobal("fetch", fetch);
  const close = vi.fn();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 100, height: 50, close }),
  );
  const contexto = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(contexto);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback) => callback(new BlobDoNode([new Uint8Array([1, 2, 3])])),
  );
  return { fetch, close, contexto };
}
describe("logo em PNG", () => {
  it("compartilha a conversão da mesma URL e largura", async () => {
    const { fetch, close, contexto } = prepararLogo();
    const a = logoEmPng("/cache-compartilhado.webp", { largura: 200 });
    const b = logoEmPng("/cache-compartilhado.webp", { largura: 200 });
    expect(a).toBe(b);
    expect(await a).toEqual({
      bytes: new Uint8Array([1, 2, 3]),
      largura: 200,
      altura: 100,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
    expect(contexto.fillStyle).toBe("#ffffff");
  });
  it("outra URL ou largura recebe sua própria conversão", async () => {
    const { fetch } = prepararLogo();
    const a = await logoEmPng("/marca-a.webp", { largura: 200 });
    const b = await logoEmPng("/marca-b.webp", { largura: 300 });
    const c = await logoEmPng("/marca-b.webp", { largura: 400 });
    expect([a.largura, b.largura, c.largura]).toEqual([200, 300, 400]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("uma falha permite tentar novamente", async () => {
    const { fetch } = prepararLogo();
    fetch.mockRejectedValueOnce(new Error("rede"));
    expect(await logoEmPng("/tentar-novamente.webp")).toBeNull();
    expect(await logoEmPng("/tentar-novamente.webp")).not.toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("canvas indisponível libera a imagem e volta ao timbrado textual", async () => {
    const { close } = prepararLogo();
    HTMLCanvasElement.prototype.getContext.mockReturnValue(null);
    expect(await logoEmPng("/sem-canvas.webp")).toBeNull();
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("largura inválida não inicia a conversão", async () => {
    const { fetch } = prepararLogo();
    expect(
      await logoEmPng("/largura-invalida.webp", { largura: 0 }),
    ).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("impressão", () => {
  it("usa iframe sem script e o remove após a impressão", () => {
    vi.useFakeTimers();
    imprimirPagina("<p>Ana</p>");
    const quadro = document.querySelector("iframe");
    expect(quadro.getAttribute("sandbox")).toBe(
      "allow-modals allow-same-origin",
    );
    expect(quadro.srcdoc).toBe("<p>Ana</p>");
    vi.spyOn(quadro.contentWindow, "print").mockImplementation(() => {});
    vi.spyOn(quadro.contentWindow, "focus").mockImplementation(() => {});
    quadro.dispatchEvent(new Event("load"));
    quadro.contentWindow.dispatchEvent(new Event("afterprint"));
    vi.advanceTimersByTime(500);
    expect(document.querySelector("iframe")).toBeNull();
  });
});
