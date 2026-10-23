import { describe, expect, it, vi } from "vitest";
import { criarEstadoDaClassificacao } from "../../src/modulos/classificacao/estado.ts";
import { calcularClassificacao } from "../../src/modulos/classificacao/classificacao.tsx";

/*
  O estado da Classificação com a chave "Gerar listas pelo Python" ligada
  (20261023200000): o prazo da espera, a troca de edital no meio da espera e a
  falha de conexão que não derruba a espera. A tela inteira está em
  tests/modulos/classificacao.test.js ("Gerar com a lista calculada pelo Python").
*/
const PEDIDO = "aaaaaaaa-1111-4111-8111-111111111111";

function banco(respostas = {}) {
  return {
    rpc: vi.fn(async (nome, args) => {
      if (nome === "listar_editais_classificacao")
        return {
          data: { editais: [{ id: "A" }], pode_editar: true },
          error: null,
        };
      if (nome.startsWith("obter_classificacao_do_edital"))
        return {
          data: {
            edital: { id: args.p_edital },
            regra: { versao: 2, configuracao: {} },
            listas: [],
            candidatos: [],
            pode_editar: true,
          },
          error: null,
        };
      if (nome.startsWith("listar_")) return { data: [], error: null };
      if (nome === "pedir_calculo_classificacao")
        return {
          data: { ligada: true, pedido: PEDIDO, situacao: "PEDIDO" },
          error: null,
        };
      const resposta = respostas[nome];
      if (resposta instanceof Error) return { data: null, error: resposta };
      return { data: resposta?.(args) ?? null, error: null };
    }),
  };
}

describe("Gerar pelo Python: a espera", () => {
  it("o job não responde no prazo: aviso de prazo, nada registrado", async () => {
    let relogio = 0;
    const supabase = banco({
      obter_calculo_classificacao: () => ({
        pedido: PEDIDO,
        situacao: "PEDIDO",
      }),
    });
    const e = criarEstadoDaClassificacao({
      supabase,
      toast: vi.fn(),
      intervaloDoCalculoMs: 0,
      prazoDoCalculoMs: 300000,
      agora: () => (relogio += 60000),
    });
    await e.escolherEdital("A");
    const resultado = calcularClassificacao(e.obter().dados, "FINAL");
    expect(await e.gerarLista(resultado)).toBeNull();
    expect(e.obter().calculo).toMatchObject({
      tipo: "FINAL",
      pedido: PEDIDO,
      situacao: "prazo",
      mensagem: "O cálculo em Python não chegou em 5 min.",
    });
    expect(e.obter().gerando).toBe(false);
    const nomes = supabase.rpc.mock.calls.map(([n]) => n);
    expect(nomes).not.toContain("registrar_lista_calculada");
    expect(nomes).not.toContain("registrar_lista_classificacao");
  });

  it("a conexão caiu numa releitura: continua esperando; trocar de edital encerra sem aviso", async () => {
    let leituras = 0;
    const queda = Object.assign(new Error("Failed to fetch"), {
      name: "NetworkError",
    });
    const supabase = banco({
      obter_calculo_classificacao: () => {
        leituras += 1;
        return { pedido: PEDIDO, situacao: "CALCULANDO" };
      },
    });
    // A primeira releitura dá erro de rede (a resposta vira `error`).
    const rpc = supabase.rpc;
    supabase.rpc = vi.fn(async (nome, args) => {
      if (nome === "obter_calculo_classificacao" && leituras === 0) {
        leituras += 1;
        return { data: null, error: queda };
      }
      return rpc(nome, args);
    });
    const e = criarEstadoDaClassificacao({
      supabase,
      toast: vi.fn(),
      intervaloDoCalculoMs: 0,
    });
    await e.escolherEdital("A");
    const resultado = calcularClassificacao(e.obter().dados, "FINAL");
    const gerando = e.gerarLista(resultado);
    await vi.waitFor(() => expect(leituras).toBeGreaterThanOrEqual(3));
    expect(e.obter().calculo?.situacao).toBe("calculando");
    await e.escolherEdital("");
    expect(await gerando).toBeNull();
    expect(e.obter().calculo).toBeNull();
  });
});
