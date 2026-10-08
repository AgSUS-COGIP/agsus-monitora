import { describe, expect, it, vi } from "vitest";
import {
  normalizarArvoreDosModulos,
  normalizarResultadoDosModulos,
} from "../src/lib/arvore-dos-modulos.ts";
import { criarEstadoDosModulos } from "../src/modulos/modulos/estado.ts";

describe("contrato da árvore de módulos e abas", () => {
  it("mantém campos usados pela tela e aceita listas opcionais ausentes", () => {
    const arvore = normalizarArvoreDosModulos({
      areas: [
        {
          co_area: "sede",
          ativo: false,
          abas: [{ co_aba: "editais", beta: true }],
        },
      ],
      paineis: [{ id: "p1", em_manutencao: true }],
      campoExtra: "ignorado",
    });
    expect(arvore.areas[0]).toMatchObject({ co_area: "sede", ativo: false });
    expect(arvore.areas[0].abas[0].beta).toBe(true);
    expect(arvore.paineis[0].em_manutencao).toBe(true);
    expect(arvore.abas).toEqual([]);
    expect(arvore.historico).toEqual([]);
    expect(arvore).not.toHaveProperty("campoExtra");
  });

  it.each([
    null,
    [],
    { areas: {} },
    { abas: [null] },
    { areas: [{ co_area: " " }] },
    { areas: [{ co_area: "sede", abas: [{ co_aba: 42 }] }] },
    { paineis: [{ id: "p1", ativo: "false" }] },
    { sistema: { comemoracoes: "true" } },
    { sistema: { mensagem: {} } },
    { historico: [{ quando: 123 }] },
  ])("recusa campos malformados: %j", (dados) => {
    expect(() => normalizarArvoreDosModulos(dados)).toThrow(
      "Resposta de módulos e abas inválida",
    );
  });

  it("usa o total do lote quando a confirmação não contém uma contagem válida", () => {
    for (const dados of [
      null,
      {},
      { alteradas: "2" },
      { alteradas: {} },
      { alteradas: -1 },
      { alteradas: 1.5 },
    ])
      expect(normalizarResultadoDosModulos(dados, 2)).toBe(2);
    expect(normalizarResultadoDosModulos({ alteradas: 0 }, 2)).toBe(0);
    expect(normalizarResultadoDosModulos({ alteradas: 3 }, 2)).toBe(3);
  });
});

function criarCliente(
  obterArvore = () => ({ areas: [{ co_area: "sede", ativo: true }] }),
) {
  let auth;
  const rpc = vi.fn(async () => ({ data: obterArvore(), error: null }));
  const cliente = {
    rpc,
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "teste" } },
        error: null,
      }),
      onAuthStateChange: (callback) => {
        auth = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  };
  return { cliente, auth: (...args) => auth(...args) };
}

describe("estado dos módulos diante de respostas e sessões inválidas", () => {
  it("mantém a árvore válida e o rascunho quando a releitura vem malformada", async () => {
    let dados = { areas: [{ co_area: "sede", ativo: true }] };
    const { cliente } = criarCliente(() => dados);
    const estado = criarEstadoDosModulos({ supabase: cliente });
    const consoleErro = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await estado.carregar();
      const arvore = estado.obter().arvore;
      estado.mudarCampo({ escopo: "area", area: "sede" }, "mensagem", "Ajuste");
      dados = { areas: [{ co_area: "sede", ativo: "false" }] };
      await estado.carregar();
      expect(estado.obter()).toMatchObject({ status: "error", arvore });
      expect(estado.obter().erro).toContain("inválida");
      expect(estado.temAlteracoesPendentes()).toBe(true);
      dados = { areas: [{ co_area: "sede", ativo: true }] };
      await estado.carregar();
      expect(estado.obter().status).toBe("ready");
      expect(estado.temAlteracoesPendentes()).toBe(true);
    } finally {
      estado.desligar();
      consoleErro.mockRestore();
    }
  });

  it.each([null, { code: "42501" }])(
    "não publica um salvamento antigo após trocar de usuário (%j)",
    async (erro) => {
      const { cliente, auth } = criarCliente();
      const toast = vi.fn();
      const estado = criarEstadoDosModulos({ supabase: cliente, toast });
      let concluir;
      try {
        auth("SIGNED_IN", { user: { id: "admin-1" } });
        await estado.carregar();
        estado.mudarCampo(
          { escopo: "area", area: "sede" },
          "mensagem",
          "Primeiro ajuste",
        );
        cliente.rpc.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              concluir = resolve;
            }),
        );
        const salvamento = estado.salvar("Manutenção programada");
        await vi.waitFor(() => expect(concluir).toBeTypeOf("function"));
        auth("SIGNED_IN", { user: { id: "admin-2" } });
        await estado.carregar();
        estado.mudarCampo(
          { escopo: "area", area: "sede" },
          "mensagem",
          "Novo ajuste",
        );
        const rascunho = estado.obter().rascunho;
        const chamadas = cliente.rpc.mock.calls.length;
        concluir({ data: { alteradas: 1 }, error: erro });
        expect(await salvamento).toBe(false);
        expect(estado.obter().rascunho).toBe(rascunho);
        expect(estado.obter().aviso).toBeNull();
        expect(toast).not.toHaveBeenCalled();
        expect(cliente.rpc.mock.calls).toHaveLength(chamadas);
      } finally {
        estado.desligar();
      }
    },
  );
});
