import { describe, expect, it, vi } from "vitest";
import { criarFontesDaAya } from "../../src/modulos/aya/fontes.js";

/*
  A Aya guarda os números por um minuto. A chave não tinha a pessoa: depois
  de trocar de conta na mesma aba, a pessoa B via os números lidos com a
  permissão da pessoa A.
*/
function supabaseComAuth() {
  let aoMudar = () => {};
  let leitura = 0;
  return {
    entrar: (id) => aoMudar("SIGNED_IN", id ? { user: { id } } : null),
    rpc: vi.fn(async () => ({
      data: [`leitura-${(leitura += 1)}`],
      error: null,
    })),
    auth: {
      onAuthStateChange: (funcao) => {
        aoMudar = funcao;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  };
}

const ler = (fontes) =>
  fontes.buscar("conferencia", { area: "saude-indigena", cargaDe: "x" });

describe("fontes da Aya: troca de conta", () => {
  it("outra conta na mesma aba não reaproveita o que a anterior leu", async () => {
    const supabase = supabaseComAuth();
    const fontes = criarFontesDaAya({ supabase, janela: {} });
    supabase.entrar("pessoa-a");
    expect(await ler(fontes)).toEqual({ em: "leitura-1" });
    expect(await ler(fontes)).toEqual({ em: "leitura-1" });

    supabase.entrar("pessoa-b");
    expect(await ler(fontes)).toEqual({ em: "leitura-2" });
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it("a leitura da conta anterior que chega depois da troca não fica guardada", async () => {
    const supabase = supabaseComAuth();
    let entregar;
    supabase.rpc.mockImplementationOnce(
      () => new Promise((resolver) => (entregar = resolver)),
    );
    const fontes = criarFontesDaAya({ supabase, janela: {} });
    supabase.entrar("pessoa-a");
    const daPessoaA = ler(fontes);
    await Promise.resolve();
    supabase.entrar("pessoa-b");
    entregar({ data: ["da-pessoa-a"], error: null });
    await daPessoaA;

    expect(await ler(fontes)).toEqual({ em: "leitura-1" });
  });

  it("o mesmo usuário (renovação do token) mantém o guardado", async () => {
    const supabase = supabaseComAuth();
    const fontes = criarFontesDaAya({ supabase, janela: {} });
    supabase.entrar("pessoa-a");
    await ler(fontes);
    supabase.entrar("pessoa-a");
    await ler(fontes);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
});
