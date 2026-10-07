import { describe, expect, it, vi } from "vitest";
import {
  normalizarAvisos,
  normalizarCaso,
  normalizarCasos,
  contagemPorModulo,
  quemDoCaso,
  motivoDoCaso,
  destinoDoCaso,
  csvDosCasos,
} from "../src/lib/avisos-de-conferencia.ts";
import { criarEstadoDosAvisos } from "../src/modulos/conferencias/estado.ts";

describe("fronteiras das conferências", () => {
  it.each([null, undefined, [], "resposta inválida"])(
    "aceita payload ausente ou fora do formato: %s",
    (entrada) => {
      expect(normalizarAvisos(entrada)).toEqual({
        geradoEm: null,
        ultimaExecucao: null,
        abertos: [],
        ignorados: [],
      });
      expect(normalizarCasos(entrada)).toEqual({ total: 0, casos: [] });
    },
  );

  it("ignora entradas que não são registros e normaliza campos desconhecidos", () => {
    const lista = normalizarAvisos({
      ultima_execucao: [],
      avisos: [
        null,
        [],
        "inválido",
        {
          id: "av1",
          gravidade: "constructor",
          modulo: "constructor",
          area: "constructor",
          quantidade: Infinity,
          exemplos: [null, {}, "123"],
          primeira_vez: {},
          pode_ignorar: "true",
        },
      ],
    });
    expect(lista.abertos).toHaveLength(1);
    expect(lista.ultimaExecucao).toBeNull();
    expect(lista.abertos[0]).toMatchObject({
      id: "av1",
      gravidade: "ATENCAO",
      quantidade: 0,
      onde: "Sem área",
      exemplos: ["123"],
      primeiraVez: null,
      podeIgnorar: false,
    });
    expect(contagemPorModulo(lista)).toEqual({
      analises: 0,
      entrevistas: 0,
      classificacao: 0,
      aprovados: 0,
      cargas: 0,
    });
  });

  it("trata notas, detalhes e referências inválidos sem produzir texto de objeto", () => {
    const caso = normalizarCaso({
      aviso_id: "av1",
      ordem: "2",
      conferencia: "ANALISE_APROVADA_ABAIXO_DO_CORTE",
      nome: {},
      nota: {},
      detalhe: { nota: {}, corte: Infinity },
      analises: [null, [], { id: "an1" }],
      vinculos: [null],
      fora_do_acesso: Infinity,
      resolucao: "constructor",
    });
    expect(caso).toMatchObject({
      chave: "av1:2",
      nome: "",
      nota: null,
      foraDoAcesso: 0,
      resolucao: "ok",
      motivo: "Nota — · mínima —",
      vinculos: [],
    });
    expect(caso.analises).toHaveLength(1);
    expect(destinoDoCaso(caso)?.view).toBe("analises");
    expect(csvDosCasos([caso])).not.toContain("[object Object]");
    expect(motivoDoCaso("ANALISE_EM_DOIS_EDITAIS", { editais: {} }, caso)).toBe(
      "Em mais de um edital ativo",
    );
  });

  it("não transforma chaves herdadas de objetos em rótulos de listas", () => {
    const caso = normalizarCaso({
      tipo: "lista_classificacao",
      lista: { tipo: "constructor" },
    });
    expect(quemDoCaso(caso)).toBe("Lista de classificação");
    expect(normalizarCaso({ lista: [] }).lista).toBeNull();
  });

  it("o CSV encerra quando a RPC repete a página, sem repetir casos", async () => {
    const supabase = {
      rpc: vi.fn(async () => ({
        data: {
          total: 1001,
          casos: [{ aviso_id: "av1", ordem: 1, nome: "=1+1" }],
        },
        error: null,
      })),
    };
    const baixar = vi.fn();
    const estado = criarEstadoDosAvisos({ supabase, baixar });
    expect(await estado.exportarCasos()).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(baixar.mock.calls[0][0].split("\n")).toHaveLength(2);
    expect(baixar.mock.calls[0][0]).toContain("'=1+1");
  });
});
