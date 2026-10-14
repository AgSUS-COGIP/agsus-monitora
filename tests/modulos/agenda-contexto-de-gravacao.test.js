import { describe, expect, it, vi } from "vitest";
import { criarEstadoDaAgenda } from "../../src/modulos/classificacao/estado-da-agenda.ts";
function banco() {
  const pendentes = [];
  let auth;
  const supabase = {
    auth: {
      onAuthStateChange: (fn) => {
        auth = fn;
      },
    },
    rpc: vi.fn((nome, args) =>
      nome === "obter_agenda_entrevista"
        ? Promise.resolve({
            data: {
              edital: { id: args.p_edital },
              regra: { versao: 2 },
              itens: [],
            },
            error: null,
          })
        : new Promise((resolve) => pendentes.push(resolve)),
    ),
  };
  return {
    supabase,
    pendentes,
    autenticar: (id) => auth("SIGNED_IN", { user: { id } }),
  };
}
describe("Agenda após mudança de contexto", () => {
  it.each(["regra", "agenda"])(
    "uma gravação antiga de %s não altera flags nem avisos depois de sair e voltar ao edital",
    async (tipo) => {
      const b = banco(),
        toast = vi.fn(),
        e = criarEstadoDaAgenda({ supabase: b.supabase, toast });
      await e.carregar("A");
      const salvar = () =>
        tipo === "regra"
          ? e.salvarRegra({})
          : e.salvarAgenda({ acao: "GERAR", itens: [] });
      const antiga = salvar();
      await e.carregar("B");
      await e.carregar("A");
      const nova = salvar();
      b.pendentes[0]({
        data:
          tipo === "regra"
            ? { versao: 9 }
            : { edital: { id: "A" }, regra: { versao: 9 }, itens: [] },
        error: null,
      });
      expect(await antiga).toBe(false);
      expect(e.obter().salvando).toBe(true);
      expect(e.obter().dados.regra.versao).toBe(2);
      expect(toast).not.toHaveBeenCalled();
      b.pendentes[1]({
        data:
          tipo === "regra"
            ? { versao: 3 }
            : { edital: { id: "A" }, regra: { versao: 3 }, itens: [] },
        error: null,
      });
      expect(await nova).toBe(true);
      expect(e.obter().salvando).toBe(false);
    },
  );
  it.each([null, { message: "Falha antiga" }])(
    "a gravação não produz avisos após troca de usuário (%j)",
    async (error) => {
      const b = banco(),
        toast = vi.fn(),
        e = criarEstadoDaAgenda({ supabase: b.supabase, toast });
      b.autenticar("u1");
      await e.carregar("A");
      const p = e.salvarRegra({});
      b.autenticar("u2");
      b.pendentes[0]({ data: { versao: 3 }, error });
      expect(await p).toBe(false);
      expect(e.obter().dados).toBeNull();
      expect(e.obter().salvando).toBe(false);
      expect(toast).not.toHaveBeenCalled();
    },
  );
  it("uma agenda de outro edital não substitui a versão aberta", async () => {
    const b = banco(),
      toast = vi.fn(),
      e = criarEstadoDaAgenda({ supabase: b.supabase, toast });
    await e.carregar("A");
    const p = e.salvarAgenda({ acao: "AJUSTAR", itens: [] });
    b.pendentes[0]({ data: { edital: { id: "B" }, itens: [] }, error: null });
    expect(await p).toBe(false);
    expect(e.obter().dados.edital.id).toBe("A");
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining("outro edital"),
      "error",
    );
  });
});
