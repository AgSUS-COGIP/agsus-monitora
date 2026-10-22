import { describe, expect, it } from "vitest";
import { criarEstadoDosAvisos } from "../../src/modulos/conferencias/estado.ts";

/*
  O selo de avisos recarrega ao trocar de área. Antes, a lista da área
  anterior ficava no estado durante a carga e, se a leitura falhasse, o selo
  continuava mostrando a contagem da área de antes.
*/
const aviso = {
  id: "a1",
  conferencia: "ANALISE_APROVADA_ABAIXO_DO_CORTE",
  escopo: "edital:e1",
  gravidade: "CRITICA",
  modulo: "analises",
  area: "saude-indigena",
  quantidade: 3,
  resumo: "3 análises aprovadas abaixo do corte.",
  situacao: "ABERTO",
};

describe("Avisos de conferência: troca de área", () => {
  it("não mantém a lista da área anterior quando a leitura da nova falha", async () => {
    let falhar = false;
    const supabase = {
      rpc: async () =>
        falhar
          ? { data: null, error: { message: "sem permissão", code: "42501" } }
          : { data: { avisos: [aviso] }, error: null },
    };
    const estado = criarEstadoDosAvisos({ supabase });
    await estado.carregar({ area: "saude-indigena", modulo: "analises" });
    expect(estado.obter().lista.abertos).toHaveLength(1);

    falhar = true;
    await estado.carregar({ area: "projetos", modulo: "analises" });

    expect(estado.obter().status).toBe("error");
    expect(estado.obter().lista).toBeNull();
  });

  it("recarregar o mesmo recorte mantém a lista enquanto lê", async () => {
    const supabase = {
      rpc: async () => ({ data: { avisos: [aviso] }, error: null }),
    };
    const estado = criarEstadoDosAvisos({ supabase });
    await estado.carregar({ area: "saude-indigena", modulo: "analises" });
    const promessa = estado.carregar({
      area: "saude-indigena",
      modulo: "analises",
    });
    expect(estado.obter().lista.abertos).toHaveLength(1);
    await promessa;
  });
});
