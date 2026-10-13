import { describe, expect, it, vi } from "vitest";
import { criarEstadoDaClassificacao } from "../../src/modulos/classificacao/estado.ts";
import { calcularClassificacao } from "../../src/modulos/classificacao/classificacao.tsx";
function banco() {
  const pendentes = [];
  let auth;
  const supabase = {
    auth: {
      onAuthStateChange: (fn) => {
        auth = fn;
      },
    },
    rpc: vi.fn((nome, args) => {
      if (nome === "listar_editais_classificacao")
        return Promise.resolve({
          data: { editais: [{ id: "A" }], pode_editar: true },
          error: null,
        });
      if (nome === "obter_classificacao_do_edital")
        return Promise.resolve({
          data: {
            edital: { id: args.p_edital },
            regra: { versao: 2, configuracao: {} },
            listas: [],
            candidatos: [],
            pode_editar: true,
          },
          error: null,
        });
      if (nome.startsWith("listar_"))
        return Promise.resolve({ data: [], error: null });
      return new Promise((resolve) =>
        pendentes.push({ nome, resolver: resolve }),
      );
    }),
  };
  return {
    supabase,
    pendentes,
    autenticar: (id) => auth("SIGNED_IN", { user: { id } }),
  };
}
describe("Classificação após mudança de contexto", () => {
  it("pede conferência da lista quando o banco não confirma uma publicação enviada", async () => {
    const b = banco(),
      toast = vi.fn(),
      e = criarEstadoDaClassificacao({ supabase: b.supabase, toast });
    await e.escolherEdital("A");
    const p = e.publicarComoListaDeAprovados({ listaId: "l1", vinculos: [] });
    b.pendentes[0].resolver({ data: { ok: true }, error: null });
    expect(await p).toBeNull();
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining(
        "Confira a Lista de aprovados antes de tentar novamente",
      ),
      "warning",
    );
    expect(toast).not.toHaveBeenCalledWith(expect.anything(), "success");
  });

  it("descarta a confirmação de aprovados após sair e voltar ao mesmo edital", async () => {
    const b = banco(),
      toast = vi.fn(),
      e = criarEstadoDaClassificacao({ supabase: b.supabase, toast });
    await e.escolherEdital("A");
    const p = e.publicarComoListaDeAprovados({ listaId: "l1", vinculos: [] });
    await e.escolherEdital("B");
    await e.escolherEdital("A");
    b.pendentes[0].resolver({
      data: { ok: true, candidatos: 3, pendencias: [] },
      error: null,
    });
    expect(await p).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });

  it("uma geração antiga não libera o botão nem insere uma lista no contexto novo", async () => {
    const b = banco(),
      toast = vi.fn(),
      e = criarEstadoDaClassificacao({ supabase: b.supabase, toast });
    await e.escolherEdital("A");
    const resultado = calcularClassificacao(e.obter().dados, "FINAL");
    const antiga = e.gerarLista(resultado);
    await e.escolherEdital("B");
    await e.escolherEdital("A");
    const nova = e.gerarLista(resultado);
    b.pendentes[0].resolver({ data: { id: "antiga" }, error: null });
    expect(await antiga).toBeNull();
    expect(e.obter().gerando).toBe(true);
    expect(e.obter().dados.listas).toEqual([]);
    expect(toast).not.toHaveBeenCalled();
    b.pendentes[1].resolver({ data: { id: "nova" }, error: null });
    expect(await nova).toMatchObject({ id: "nova" });
    expect(e.obter().gerando).toBe(false);
  });
  it("não inicia download do documento depois da troca de área durante a carga do logo", async () => {
    const b = banco(),
      baixar = vi.fn();
    let concluir;
    const logo = new Promise((resolve) => {
      concluir = resolve;
    });
    const e = criarEstadoDaClassificacao({
      supabase: b.supabase,
      baixar,
      carregarLogo: () => logo,
    });
    await e.carregar("a");
    await e.escolherEdital("A");
    const exportacao = e.exportar(
      {
        id: "l1",
        retrato: {
          tipo: "FINAL",
          edital: { id: "A", edital: "105/2026" },
          vagas: [],
          modalidades: [],
        },
      },
      "docx",
    );
    await Promise.resolve();
    await e.carregar("b");
    concluir(null);
    expect(await exportacao).toBe(false);
    expect(baixar).not.toHaveBeenCalled();
  });

  it.each([null, { message: "Falha antiga" }])(
    "uma regra antiga não muda dados, flags nem avisos depois de sair e voltar ao mesmo edital (%j)",
    async (error) => {
      const b = banco(),
        toast = vi.fn(),
        e = criarEstadoDaClassificacao({ supabase: b.supabase, toast });
      await e.carregar("a");
      await e.escolherEdital("A");
      const antiga = e.salvarRegra({});
      await e.escolherEdital("B");
      await e.escolherEdital("A");
      const nova = e.salvarRegra({});
      b.pendentes[0].resolver({ data: { versao: 9 }, error });
      expect(await antiga).toBe(false);
      expect(e.obter().dados.regra.versao).toBe(2);
      expect(e.obter().salvando).toBe(true);
      expect(toast).not.toHaveBeenCalled();
      b.pendentes[1].resolver({ data: { versao: 3 }, error: null });
      expect(await nova).toBe(true);
      expect(e.obter().dados.regra.versao).toBe(3);
      expect(e.obter().salvando).toBe(false);
    },
  );
  it("uma publicação antiga não mostra aviso após troca de área", async () => {
    const b = banco(),
      toast = vi.fn(),
      e = criarEstadoDaClassificacao({ supabase: b.supabase, toast });
    await e.carregar("a");
    await e.escolherEdital("A");
    const p = e.publicarLista("l1");
    await e.carregar("b");
    b.pendentes[0].resolver({ data: { id: "l1" }, error: null });
    expect(await p).toBeNull();
    expect(toast).not.toHaveBeenCalled();
    expect(e.obter().dados).toBeNull();
  });
  it("uma gravação antiga da hora não altera o estado após troca de usuário", async () => {
    const b = banco(),
      toast = vi.fn(),
      e = criarEstadoDaClassificacao({ supabase: b.supabase, toast });
    b.autenticar("u1");
    await e.escolherEdital("A");
    const p = e.salvarHoraDeNascimento("a1", "10:00:00");
    b.autenticar("u2");
    b.pendentes[0].resolver({
      data: { hora_nascimento: "10:00:00" },
      error: null,
    });
    expect(await p).toBe(false);
    expect(toast).not.toHaveBeenCalled();
    expect(e.obter().dados).toBeNull();
  });
});
