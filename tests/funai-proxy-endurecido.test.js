import { describe, expect, it } from "vitest";
import { origemDeTerceiro } from "../src/lib/origem-da-requisicao.js";

function req(headers) {
  return { headers };
}

describe("origem da requisição aos proxies da Funai", () => {
  it("aceita requisição da própria aplicação", () => {
    expect(
      origemDeTerceiro(
        req({
          host: "agsus-monitora.vercel.app",
          referer: "https://agsus-monitora.vercel.app/index.html",
        }),
      ),
    ).toBe(false);
  });

  it("recusa site de terceiro usando o MONITORA como relé", () => {
    expect(
      origemDeTerceiro(
        req({
          host: "agsus-monitora.vercel.app",
          origin: "https://site-qualquer.example",
        }),
      ),
    ).toBe(true);
  });

  /*
    Deliberadamente frouxo: navegador ou política de privacidade que remove o
    cabeçalho não pode ficar sem mapa. O vetor de abuso real — terceiro
    embutindo nosso endereço — sempre envia a origem dele.
  */
  it("deixa passar quem não declara origem", () => {
    expect(origemDeTerceiro(req({ host: "agsus-monitora.vercel.app" }))).toBe(
      false,
    );
  });

  it("vale em preview e em desenvolvimento, sem domínio fixo em código", () => {
    expect(
      origemDeTerceiro(
        req({ host: "localhost:8000", referer: "http://localhost:8000/" }),
      ),
    ).toBe(false);
    expect(
      origemDeTerceiro(
        req({
          host: "agsus-monitora-git-branch.vercel.app",
          origin: "https://agsus-monitora-git-branch.vercel.app",
        }),
      ),
    ).toBe(false);
  });

  it("ignora cabeçalho malformado em vez de quebrar", () => {
    expect(
      origemDeTerceiro(req({ host: "app.example", referer: "não é uma url" })),
    ).toBe(false);
    expect(origemDeTerceiro(req({}))).toBe(false);
    expect(origemDeTerceiro(undefined)).toBe(false);
  });

  it("compara sem diferenciar maiúsculas", () => {
    expect(
      origemDeTerceiro(
        req({ host: "App.Example", origin: "https://app.example" }),
      ),
    ).toBe(false);
  });
});
