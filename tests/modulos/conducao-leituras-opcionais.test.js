import { describe, expect, it, vi } from "vitest";
import {
  criarEstadoDaConducao,
  opcionalDaConducao,
} from "../../src/modulos/entrevistas/estado-da-conducao.ts";

/*
  Leituras opcionais da condução (agenda, configuração e modelos da
  convocação): sem a migration ou sem acesso, segue sem elas; outra falha
  aparece. Antes, `.catch(() => null)` engolia qualquer erro — a agenda que
  caiu por rede virava "sem agenda" e a convocação era calculada sem a
  configuração, calada.
*/

const EDITAL_COM_LISTA = {
  edital: { id: "m1" },
  pode_editar: true,
  lista_convocacao: { lista: { id: "lista1" } },
  convocados: [],
};
const EDITAL_SEM_LISTA = { ...EDITAL_COM_LISTA, lista_convocacao: null };

function supabaseCom(respostas) {
  return {
    rpc: vi.fn(async (nome) => {
      if (nome === "obter_previsao_entrevista_edital")
        return {
          data: {
        situacao: "NAO_INFORMADA",
        motivo: null,
        pode_alterar: false,
      },
          error: null,
        };
      return respostas[nome] ? respostas[nome]() : { data: null, error: null };
    }),
  };
}

describe("leituras opcionais da condução", () => {
  it("sem a função ou sem acesso: nulo; outra falha passa adiante", async () => {
    await expect(
      opcionalDaConducao(Promise.reject({ code: "PGRST202" })),
    ).resolves.toBeNull();
    await expect(
      opcionalDaConducao(Promise.reject({ code: "42501" })),
    ).resolves.toBeNull();
    await expect(
      opcionalDaConducao(Promise.reject({ message: "Failed to fetch" })),
    ).rejects.toEqual({ message: "Failed to fetch" });
  });

  it("agenda que falhou por rede: o edital abre e a falha é avisada", async () => {
    const toast = vi.fn();
    const conducao = criarEstadoDaConducao({
      supabase: supabaseCom({
        obter_entrevistas_do_edital: () => ({
          data: EDITAL_COM_LISTA,
          error: null,
        }),
        obter_agenda_entrevista: () => ({
          data: null,
          error: { message: "tempo esgotado", code: "57014" },
        }),
      }),
      toast,
    });
    await expect(conducao.abrirEdital("m1")).resolves.toBe(true);
    expect(conducao.obter().agenda).toBeNull();
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining("Não foi possível carregar a agenda"),
      "warn",
    );
  });

  it("agenda sem a migration: segue calada, como sempre", async () => {
    const toast = vi.fn();
    const conducao = criarEstadoDaConducao({
      supabase: supabaseCom({
        obter_entrevistas_do_edital: () => ({
          data: EDITAL_COM_LISTA,
          error: null,
        }),
        obter_agenda_entrevista: () => ({
          data: null,
          error: { message: "não existe", code: "PGRST202" },
        }),
      }),
      toast,
    });
    await conducao.abrirEdital("m1");
    expect(toast).not.toHaveBeenCalled();
  });

  it("configuração da convocação que falhou vira erro do cálculo, não ordem calada", async () => {
    const conducao = criarEstadoDaConducao({
      supabase: supabaseCom({
        obter_entrevistas_do_edital: () => ({
          data: EDITAL_SEM_LISTA,
          error: null,
        }),
        obter_classificacao_do_edital: () => ({
          data: { regra: { versao: 1 } },
          error: null,
        }),
        listar_configuracao_convocacao: () => ({
          data: null,
          error: { message: "falha no banco", code: "XX000" },
        }),
        listar_modelos_convocacao: () => ({ data: [], error: null }),
      }),
      toast: () => {},
    });
    await conducao.abrirEdital("m1");
    expect(conducao.obter().calculo).toEqual({
      erro: expect.any(String),
    });
  });
});
