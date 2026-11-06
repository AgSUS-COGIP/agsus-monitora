import { act, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SininhoDoResumo } from "../../src/modulos/resumo-do-dia/resumo-do-dia.tsx";
import { criarEstadoDoResumoDoDia } from "../../src/modulos/resumo-do-dia/estado.ts";
import { clicar, esperar } from "./interacoes.ts";
import { desenharNoTeste } from "../montar-tela.ts";

/*
  O sininho do topo e o popup do resumo do dia (20261104130000). "Agora" é
  15/09/2026 às 10h de Brasília (13h UTC): "Bom dia".
*/
const AGORA = new Date("2026-09-15T13:00:00Z");

const item = (campos) => ({
  tipo: "etapa",
  edital_id: "e1",
  edital: "10/2026",
  unidade: "DSEI Manaus",
  area: "saude-indigena",
  data_inicio: "2026-09-15",
  data_fim: "2026-09-15",
  marco: "dia_unico",
  data: "2026-09-15",
  pode_concluir: false,
  ...campos,
});

const RESUMO = {
  data: "2026-09-15",
  perfil: "p1",
  nome: "Ana Maria Souza",
  responsavel: true,
  editais: ["e1"],
  demandas: ["d1"],
  mostrar_ao_entrar: true,
  hoje: [item({ id: "c1", titulo: "Entrevistas", marco: "fim" })],
  proximos: Array.from({ length: 7 }, (_, i) =>
    item({
      id: `c${i + 2}`,
      titulo: `Inscrições ${i + 1}`,
      marco: "inicio",
      data: `2026-09-${16 + i}`,
    }),
  ),
  atrasadas: [
    item({
      tipo: "demanda",
      id: "d1",
      titulo: "Relatório mensal",
      edital_id: null,
      edital: null,
      unidade: null,
      data_inicio: "2026-09-08",
      data_fim: "2026-09-10",
      marco: "fim",
      data: "2026-09-10",
      pode_concluir: true,
    }),
  ],
};

function cliente(resumo = RESUMO) {
  return {
    rpc: vi.fn(async (nome, argumentos) => {
      if (nome === "obter_meu_resumo_do_dia")
        return { data: resumo, error: null };
      if (nome === "concluir_demanda_interna")
        return { data: { id: argumentos.p_id }, error: null };
      if (nome === "salvar_minha_preferencia_do_resumo")
        return {
          data: { mostrar_ao_entrar: argumentos.p_mostrar },
          error: null,
        };
      return { data: null, error: { code: "PGRST202" } };
    }),
  };
}

function armazenamentoFalso() {
  const mapa = new Map();
  return {
    getItem: (chave) => mapa.get(chave) ?? null,
    setItem: (chave, valor) => mapa.set(chave, String(valor)),
    mapa,
  };
}

const $ = (id) => document.getElementById(id);
let desmontar = () => {};
afterEach(() => desmontar());

async function entrar({
  resumo = RESUMO,
  armazenamento = armazenamentoFalso(),
  livre = true,
} = {}) {
  const supabase = cliente(resumo);
  const estado = criarEstadoDoResumoDoDia({
    cliente: () => supabase,
    armazenamento: () => armazenamento,
    podeAbrirSozinho: () => livre,
  });
  const janela = { navigate: vi.fn() };
  document.body.innerHTML = `<div id="topo"></div>`;
  await act(async () => {
    ({ desmontar } = desenharNoTeste(
      $("topo"),
      createElement(SininhoDoResumo, { estado, agora: () => AGORA, janela }),
    ));
  });
  await esperar(() => estado.verificar({ aoEntrar: true }));
  return { estado, supabase, armazenamento, janela };
}

describe("resumo do dia do responsável", () => {
  it("abre no primeiro acesso: saudação, três blocos, cor do tipo e 'e mais N'", async () => {
    await entrar();
    expect($("resumoDoDia")).not.toBeNull();
    expect($("resumoDoDia").querySelector("h3").textContent).toBe(
      "Bom dia, Ana — seus editais hoje",
    );
    const blocos = [...document.querySelectorAll(".resumo-bloco")];
    expect(blocos.map((bloco) => bloco.dataset.bloco)).toEqual([
      "hoje",
      "proximos",
      "atrasadas",
    ]);
    const proximos = blocos[1];
    expect(proximos.querySelectorAll(".resumo-item")).toHaveLength(5);
    expect(proximos.querySelector(".resumo-mais").textContent).toBe("e mais 2");
    // "Entrevistas": a cor das entrevistas no Cronograma.
    expect(blocos[0].querySelector(".resumo-item").dataset.cor).toBe(
      "violeta-claro",
    );
    expect(blocos[0].textContent).toContain("10/2026 · DSEI Manaus");
    expect(blocos[0].textContent).toContain("termina 15/09");
    const atrasada = blocos[2].querySelector(".resumo-item");
    expect(atrasada.dataset.cor).toBe("demanda");
    expect(atrasada.textContent).toContain("venceu 10/09");
    expect($("resumoDoDiaSininho").getAttribute("aria-label")).toBe(
      "Resumo do dia: 9 pendências",
    );
    expect($("resumoDoDiaSininho").textContent).toBe("9");
  });

  it("Fechar não deixa voltar sozinho no mesmo dia; o sininho reabre", async () => {
    const armazenamento = armazenamentoFalso();
    await entrar({ armazenamento });
    await clicar($("resumoFechar"));
    expect($("resumoDoDia")).toBeNull();
    expect(
      armazenamento.mapa.get("agsus:resumo-do-dia:visto:p1:2026-09-15"),
    ).toBe("1");
    desmontar();

    // Nova entrada no mesmo dia, mesmo navegador: não abre sozinho.
    const { supabase } = await entrar({ armazenamento });
    expect($("resumoDoDia")).toBeNull();
    await clicar($("resumoDoDiaSininho"));
    expect($("resumoDoDia")).not.toBeNull();
    // Uma chamada ao entrar e outra ao abrir pelo sininho; sem polling.
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it("sem pendência não abre; sem ser responsável, nem sininho", async () => {
    await entrar({
      resumo: { ...RESUMO, hoje: [], proximos: [], atrasadas: [] },
    });
    expect($("resumoDoDia")).toBeNull();
    expect($("resumoDoDiaSininho").getAttribute("aria-label")).toBe(
      "Resumo do dia",
    );
    desmontar();

    await entrar({ resumo: { ...RESUMO, responsavel: false } });
    expect($("resumoDoDiaSininho")).toBeNull();
    expect($("resumoDoDia")).toBeNull();
  });

  it("preferência desligada: só o sininho; a caixa grava a preferência", async () => {
    const { supabase } = await entrar({
      resumo: { ...RESUMO, mostrar_ao_entrar: false },
    });
    expect($("resumoDoDia")).toBeNull();
    await clicar($("resumoDoDiaSininho"));
    expect($("resumoMostrarAoEntrar").checked).toBe(false);
    await clicar($("resumoMostrarAoEntrar"));
    expect(
      supabase.rpc.mock.calls.find(
        ([nome]) => nome === "salvar_minha_preferencia_do_resumo",
      )[1],
    ).toEqual({ p_mostrar: true });
  });

  it("com a tela ocupada (modal aberto ou digitação) não abre sozinho", async () => {
    await entrar({ livre: false });
    expect($("resumoDoDia")).toBeNull();
    expect($("resumoDoDiaSininho")).not.toBeNull();
  });

  it("Concluir na demanda atrasada grava, tira da lista e avisa o Cronograma", async () => {
    const ouvinte = vi.fn();
    document.addEventListener("agsus:nucleo-cronograma-saved", ouvinte);
    const { supabase } = await entrar();
    await clicar(document.querySelector('[data-concluir="d1"]'));
    expect(
      supabase.rpc.mock.calls.find(
        ([nome]) => nome === "concluir_demanda_interna",
      )[1],
    ).toEqual({ p_id: "d1", p_concluida: true });
    expect(document.querySelector('[data-bloco="atrasadas"]')).toBeNull();
    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect($("resumoDoDiaSininho").textContent).toBe("8");
    document.removeEventListener("agsus:nucleo-cronograma-saved", ouvinte);
  });

  it("Ver no cronograma fecha e abre o Cronograma só com os da pessoa", async () => {
    const { janela } = await entrar();
    await clicar($("resumoVerNoCronograma"));
    expect($("resumoDoDia")).toBeNull();
    expect(janela.navigate).toHaveBeenCalledWith("calendario", {
      visao: "meus",
    });
  });

  it("banco sem a RPC: nada aparece", async () => {
    const estado = criarEstadoDoResumoDoDia({
      cliente: () => ({
        rpc: vi.fn(async () => ({ data: null, error: { code: "PGRST202" } })),
      }),
      armazenamento: () => armazenamentoFalso(),
      podeAbrirSozinho: () => true,
    });
    document.body.innerHTML = `<div id="topo"></div>`;
    await act(async () => {
      ({ desmontar } = desenharNoTeste(
        $("topo"),
        createElement(SininhoDoResumo, { estado }),
      ));
    });
    await esperar(() => estado.verificar({ aoEntrar: true }));
    expect($("resumoDoDiaSininho")).toBeNull();
  });
});
