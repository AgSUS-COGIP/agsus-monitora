import { describe, expect, it, vi } from "vitest";
import { NOVIDADES, novidadesVisiveis } from "../src/lib/novidades.ts";
import {
  ehErroDeTelaAntiga,
  lerVersaoPublicada,
  novidadeParaMostrar,
  observarRespostasDoBanco,
} from "../src/lib/versao-do-sistema.ts";

const novidade = (id, data, visivel = true) => ({
  id,
  data,
  texto: `texto de ${id}`,
  visivel,
});

describe("versao.json publicado", () => {
  it("aceita versão e só as novidades visíveis e bem formadas", () => {
    expect(
      lerVersaoPublicada({
        versao: " abc123 ",
        novidades: [
          novidade("a", "2026-10-20"),
          novidade("b", "2026-10-21", false),
          { id: "c" },
        ],
      }),
    ).toEqual({ versao: "abc123", novidades: [novidade("a", "2026-10-20")] });
  });

  it("recusa o que não é o arquivo da versão", () => {
    expect(lerVersaoPublicada(null)).toBeNull();
    expect(lerVersaoPublicada("<html>")).toBeNull();
    expect(lerVersaoPublicada({ versao: "" })).toBeNull();
  });
});

describe("novidade para mostrar", () => {
  it("é a visível mais recente que a versão aberta ainda não tem", () => {
    const publicadas = [
      novidade("velha", "2026-10-01"),
      novidade("nova", "2026-10-21"),
      novidade("media", "2026-10-10"),
    ];
    expect(novidadeParaMostrar(publicadas, [])).toBe("texto de nova");
    expect(
      novidadeParaMostrar(publicadas, [novidade("nova", "2026-10-21")]),
    ).toBe("texto de media");
  });

  it("só quando marcada como visível", () => {
    expect(
      novidadeParaMostrar([novidade("x", "2026-10-21", false)], []),
    ).toBeNull();
    expect(novidadeParaMostrar([], [])).toBeNull();
  });

  it("o build publica só as visíveis, da mais recente para a mais antiga", () => {
    const lista = novidadesVisiveis([
      novidade("a", "2026-10-01"),
      novidade("b", "2026-10-03", false),
      novidade("c", "2026-10-02"),
    ]);
    expect(lista.map((n) => n.id)).toEqual(["c", "a"]);
    expect(novidadesVisiveis(NOVIDADES).every((n) => n.visivel)).toBe(true);
  });

  it("as novidades do repositório têm id único, data AAAA-MM-DD e texto curto", () => {
    const ids = NOVIDADES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of NOVIDADES) {
      expect(n.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(n.texto.length).toBeLessThanOrEqual(80);
      expect(n.texto).not.toMatch(/\.$/);
    }
  });
});

describe("erro de tela antiga", () => {
  it("PGRST202 (função ou assinatura que não existe mais)", () => {
    expect(ehErroDeTelaAntiga({ code: "PGRST202", message: "x" })).toBe(true);
  });

  it("'recarregue a página' com 22023 ou PT409", () => {
    const message =
      "Escolha o motivo da reabertura na lista. Se a lista não aparece, recarregue a página.";
    expect(ehErroDeTelaAntiga({ code: "22023", message })).toBe(true);
    expect(ehErroDeTelaAntiga({ code: "PT409", message })).toBe(true);
  });

  it("não confunde com outros erros", () => {
    expect(
      ehErroDeTelaAntiga({ code: "22023", message: "Edital inválido" }),
    ).toBe(false);
    expect(
      ehErroDeTelaAntiga({ code: "42501", message: "recarregue a página" }),
    ).toBe(false);
    expect(ehErroDeTelaAntiga(null)).toBe(false);
  });
});

describe("fetch do cliente Supabase", () => {
  const corpo = (dados, status) =>
    new Response(JSON.stringify(dados), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  it("avisa quando uma RPC falha com PGRST202 e devolve a resposta igual", async () => {
    const aoSinal = vi.fn();
    const base = vi.fn(async () =>
      corpo({ code: "PGRST202", message: "Could not find" }, 404),
    );
    const observado = observarRespostasDoBanco(base, aoSinal);
    const resposta = await observado(
      "https://x.supabase.co/rest/v1/rpc/reabrir_analise?x=1",
      { method: "POST" },
    );
    expect(resposta.status).toBe(404);
    expect((await resposta.json()).code).toBe("PGRST202");
    await vi.waitFor(() =>
      expect(aoSinal).toHaveBeenCalledWith({
        rpc: "reabrir_analise",
        codigo: "PGRST202",
      }),
    );
  });

  it("não lê o corpo de resposta boa nem de rota que não é RPC", async () => {
    const aoSinal = vi.fn();
    const boa = corpo([], 200);
    const clonar = vi.spyOn(boa, "clone");
    await observarRespostasDoBanco(
      async () => boa,
      aoSinal,
    )("https://x.supabase.co/rest/v1/rpc/listar");
    expect(clonar).not.toHaveBeenCalled();
    await observarRespostasDoBanco(
      async () => corpo({ code: "PGRST202" }, 404),
      aoSinal,
    )("https://x.supabase.co/auth/v1/token");
    await new Promise((r) => setTimeout(r, 0));
    expect(aoSinal).not.toHaveBeenCalled();
  });

  it("ignora erro que não é de tela antiga e corpo que não é JSON", async () => {
    const aoSinal = vi.fn();
    const url = "https://x.supabase.co/rest/v1/rpc/salvar";
    await observarRespostasDoBanco(
      async () => corpo({ code: "42501", message: "sem permissão" }, 403),
      aoSinal,
    )(url);
    await observarRespostasDoBanco(
      async () => new Response("<html>", { status: 502 }),
      aoSinal,
    )(url);
    await new Promise((r) => setTimeout(r, 0));
    expect(aoSinal).not.toHaveBeenCalled();
  });
});
