import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clicar, esperar } from "./interacoes.js";

/*
  Status das atualizações com as chaves da automação (20261022190000): a
  carga de chave desligada mostra "Desligada pelo administrador" (com quem,
  quando e motivo), não pede atenção no resumo, e o Rodar agora dela pede
  confirmação antes de chamar disparar_robo. Sem a função das chaves no
  banco, a tela segue como antes.
*/

const { montarSaudeDasCargas } =
  await import("../../src/componentes/saude-das-cargas/saude-das-cargas.tsx");

const AGORA = new Date("2026-10-22T14:00:00Z");
const SAUDE = {
  schema_version: 1,
  gerado_em: AGORA.toISOString(),
  analises: [],
  // Última carga em 16/10: sem a chave seria "Atrasada".
  entrevistas: [
    {
      inicio: "2026-10-16T10:05:00Z",
      fim: "2026-10-16T10:05:30Z",
      situacao: "CONCLUIDA",
    },
  ],
  selecao: [],
  tarefas: null,
};
const CHAVES = {
  chaves: [
    {
      chave: "entrevistas",
      nome: "Entrevistas",
      ligada: false,
      motivo: "Pausa de propósito desde 16/10/2026",
      em: "2026-10-22T13:00:00Z",
      por: "Gestão da Informação de Pessoal",
      tarefas: [],
    },
  ],
};
const ADMIN = { id: "u", ativo: true, admin_global: true };

let raiz;
let controlador;

async function montar(rpcs) {
  raiz = document.createElement("div");
  document.body.append(raiz);
  const supabase = {
    rpc: vi.fn(async (nome, argumentos) =>
      rpcs[nome] ? rpcs[nome](argumentos) : { data: SAUDE, error: null },
    ),
  };
  await act(async () => {
    controlador = montarSaudeDasCargas({
      raizDaTela: raiz,
      supabase,
      getProfile: () => ADMIN,
      agora: () => AGORA,
      agendar: vi.fn(),
    });
  });
  await act(async () => {
    await controlador.render();
  });
  await esperar();
  return supabase;
}

const linhaDe = (id) => document.querySelector(`[data-carga="${id}"]`);

afterEach(async () => {
  await act(async () => controlador?.raiz?.unmount());
  raiz?.remove();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("Status das atualizações com as chaves da automação", () => {
  it("a carga desligada diz isso, com quem e o motivo, e não pede atenção", async () => {
    await montar({
      get_saude_das_cargas: async () => ({ data: SAUDE, error: null }),
      obter_chaves_da_automacao: async () => ({ data: CHAVES, error: null }),
    });
    const linha = linhaDe("entrevistas");
    expect(linha.textContent).toContain("Desligada pelo administrador");
    expect(linha.textContent).not.toContain("Atrasada");
    expect(linha.querySelector(".saude-desligada").textContent).toContain(
      "Gestão da Informação de Pessoal · Pausa de propósito desde 16/10/2026",
    );
    expect(document.querySelector(".saude-resumo").textContent).toContain(
      "Tudo em dia.",
    );
  });

  it("o Rodar agora da carga desligada pede confirmação", async () => {
    const confirmar = vi.spyOn(globalThis, "confirm").mockReturnValue(false);
    const supabase = await montar({
      get_saude_das_cargas: async () => ({ data: SAUDE, error: null }),
      obter_chaves_da_automacao: async () => ({ data: CHAVES, error: null }),
      disparar_robo: async () => ({ data: 7, error: null }),
      situacao_do_disparo_robo: async () => ({
        data: { situacao: "PEDIDO" },
        error: null,
      }),
    });
    const botao = linhaDe("entrevistas").querySelector(".saude-rodar");
    await clicar(botao);
    expect(confirmar).toHaveBeenCalledWith(
      "A automação de Entrevistas está desligada pelo administrador. Rodar agora mesmo assim?",
    );
    expect(supabase.rpc.mock.calls.map(([nome]) => nome)).not.toContain(
      "disparar_robo",
    );

    confirmar.mockReturnValue(true);
    await clicar(botao);
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("disparar_robo", {
      p_robo: "entrevistas",
      p_inputs: {},
    });
  });

  it("sem a função das chaves no banco, segue como antes (atrasada)", async () => {
    await montar({
      get_saude_das_cargas: async () => ({ data: SAUDE, error: null }),
      obter_chaves_da_automacao: async () => ({
        data: null,
        error: { code: "PGRST202", message: "not found" },
      }),
    });
    expect(linhaDe("entrevistas").textContent).toContain("Atrasada");
  });
});
