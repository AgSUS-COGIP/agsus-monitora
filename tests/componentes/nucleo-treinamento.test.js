import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarNucleo } from "../../src/modulos/editais/nucleo.jsx";
import {
  publicarLinhasDoMonitoramento,
  publicarUnidadesDoCatalogo,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import { clicar, esperar } from "./interacoes.js";

/*
  Editais com o edital de treinamento (migration 20261007230000): o selo
  "Treinamento" na linha, o botão "Reiniciar treinamento" só para o admin
  global e só no edital de treinamento, com a confirmação na própria linha, e
  os indicadores do painel sem o edital de treinamento.
*/

const LINHAS = () => [
  {
    id: "real",
    unidade: "DSEI Manaus",
    edital: "10/2026",
    status: "Em andamento",
    etapa: "Análise curricular",
    risco: "Baixo",
    vagas_total: 10,
    ST_TREINAMENTO: "N",
  },
  {
    id: "treino",
    unidade: "DSEI Treinamento",
    edital: "Treinamento – Saúde Indígena (991/2099)",
    status: "Em andamento",
    etapa: "Entrevistas",
    risco: "Baixo",
    vagas_total: 7,
    ST_TREINAMENTO: "S",
  },
];

const RESUMO = [
  {
    id: "real",
    alerta_tipo: "ok",
    status: "Em andamento",
    cronograma_total: 2,
  },
  {
    id: "treino",
    alerta_tipo: "ok",
    status: "Em andamento",
    cronograma_total: 12,
  },
];

function supabaseFalso({ erro = null } = {}) {
  return {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "x" } },
        error: null,
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    rpc: vi.fn(async (nome, argumentos) => {
      if (nome === "get_nucleo_cronograma_resumo")
        return { data: RESUMO, error: null };
      if (nome === "reiniciar_edital_treinamento")
        return erro
          ? { data: null, error: erro }
          : { data: { edital: argumentos.p_edital }, error: null };
      return { data: null, error: { message: `RPC inesperada: ${nome}` } };
    }),
  };
}

let controlador = null;

async function montar({ perfil, supabase = supabaseFalso() } = {}) {
  document.body.innerHTML = `<section id="page-nucleo" class="page active"></section>`;
  const toast = vi.fn();
  const aoSalvar = vi.fn(async () => {});
  const confirmar = vi.fn(() => true);
  await act(async () => {
    controlador = montarNucleo({
      secao: document.getElementById("page-nucleo"),
      supabase,
      toast,
      loader: () => {},
      getProfile: () => perfil,
      confirmar,
      aoSalvar,
      agora: () => new Date(2026, 9, 7, 10),
    });
  });
  await act(async () => {
    publicarUnidadesDoCatalogo([]);
    publicarLinhasDoMonitoramento(LINHAS());
  });
  await esperar(() => controlador.render());
  return { supabase, toast, aoSalvar, confirmar };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  window.localStorage.clear();
});

afterEach(async () => {
  await act(async () => controlador?.raiz?.unmount());
  controlador?.estado.desligar();
  controlador = null;
  await act(async () => redefinirDadosDoMonitoramento());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const linha = (id) =>
  document.querySelector(`#nucleoRows tr[data-record-id="${id}"]`);
const botaoReiniciar = (id) =>
  linha(id)?.querySelector('[aria-label^="Reiniciar treinamento"]');
const ADMIN = { perfil: "admin", admin_global: true };

describe("edital de treinamento em Editais", () => {
  it("a linha do treinamento tem o selo; a do edital real, não", async () => {
    await montar({ perfil: { perfil: "edital_gestor" } });
    await esperar(() => linha("treino"));
    expect(
      linha("treino").querySelector(".selo-de-treinamento").textContent,
    ).toBe("Treinamento");
    expect(linha("real").querySelector(".selo-de-treinamento")).toBeNull();
  });

  it("só o admin global vê 'Reiniciar treinamento', e só no edital de treinamento", async () => {
    await montar({ perfil: { perfil: "edital_gestor" } });
    await esperar(() => linha("treino"));
    expect(botaoReiniciar("treino")).toBeFalsy();
    await act(async () => controlador?.raiz?.unmount());
    controlador?.estado.desligar();
    await act(async () => redefinirDadosDoMonitoramento());

    await montar({ perfil: ADMIN });
    await esperar(() => linha("treino"));
    expect(botaoReiniciar("treino")).toBeTruthy();
    expect(botaoReiniciar("real")).toBeFalsy();
  });

  it("confirma na própria linha (sem window.confirm) e chama o RPC com o edital", async () => {
    const { supabase, confirmar, aoSalvar, toast } = await montar({
      perfil: ADMIN,
    });
    await esperar(() => botaoReiniciar("treino"));
    await clicar(botaoReiniciar("treino"));
    const grupo = linha("treino").querySelector(".nucleo-confirma-reinicio");
    expect(grupo.getAttribute("role")).toBe("group");
    expect(grupo.textContent).toContain("Treinamento – Saúde Indígena");
    const chamadasAntes = supabase.rpc.mock.calls.filter(
      ([n]) => n === "reiniciar_edital_treinamento",
    );
    expect(chamadasAntes).toHaveLength(0);

    const [reiniciar] = [...grupo.querySelectorAll("button")].filter(
      (b) => b.textContent === "Reiniciar",
    );
    await clicar(reiniciar);
    await esperar(() =>
      supabase.rpc.mock.calls.some(
        ([n]) => n === "reiniciar_edital_treinamento",
      ),
    );
    expect(supabase.rpc).toHaveBeenCalledWith("reiniciar_edital_treinamento", {
      p_edital: "treino",
    });
    expect(confirmar).not.toHaveBeenCalled();
    await esperar(() => aoSalvar.mock.calls.length > 0);
    expect(toast).toHaveBeenCalledWith("Treinamento reiniciado.");
  });

  it("Cancelar fecha a confirmação sem chamar o banco", async () => {
    const { supabase } = await montar({ perfil: ADMIN });
    await esperar(() => botaoReiniciar("treino"));
    await clicar(botaoReiniciar("treino"));
    const cancelar = [
      ...linha("treino").querySelectorAll(".nucleo-confirma-reinicio button"),
    ].find((b) => b.textContent === "Cancelar");
    await clicar(cancelar);
    expect(
      linha("treino").querySelector(".nucleo-confirma-reinicio"),
    ).toBeNull();
    expect(
      supabase.rpc.mock.calls.some(
        ([n]) => n === "reiniciar_edital_treinamento",
      ),
    ).toBe(false);
  });

  it("o estado recusa edital real e quem não é admin, sem ir ao banco", async () => {
    const { supabase, toast } = await montar({ perfil: ADMIN });
    expect(
      await controlador.estado.reiniciarTreinamento({
        id: "real",
        ST_TREINAMENTO: "N",
      }),
    ).toBe(false);
    expect(toast).toHaveBeenCalledWith(
      "Só o edital de treinamento pode ser reiniciado.",
      "warn",
    );
    expect(
      supabase.rpc.mock.calls.some(
        ([n]) => n === "reiniciar_edital_treinamento",
      ),
    ).toBe(false);
  });
});
