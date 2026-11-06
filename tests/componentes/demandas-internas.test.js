import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { criarCalendarioEditais } from "../../src/modulos/cronograma/calendario-editais.tsx";
import { ResponsaveisDoEdital } from "../../src/modulos/editais/responsaveis-do-edital.tsx";
import { clicar, digitar, esperar } from "./interacoes.ts";
import {
  publicarLinhasDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { desenharNoTeste, montarTela } from "../montar-tela.ts";
import { criarEstadoDoResumoDoDia } from "../../src/modulos/resumo-do-dia/estado.ts";

/*
  Demandas internas no Cronograma e responsáveis pelo edital (20261104120000).
  "Hoje" é 15/09/2026. A demanda d1 terminou em 10/09 sem ser concluída:
  atrasada. A d3 é da SEDE e não aparece na Saúde Indígena.
*/
const HOJE = new Date(2026, 8, 15, 10);

beforeEach(() =>
  publicarLinhasDoMonitoramento([
    {
      id: 1,
      CO_AREA: "saude-indigena",
      edital: "10/2026",
      unidade: "DSEI Manaus",
    },
  ]),
);
afterEach(() => {
  redefinirDadosDoMonitoramento();
  localStorage.clear();
});

const ANA = { id: "p1", nome: "Ana Souza" };
const BRUNO = { id: "p2", nome: "Bruno Lima" };

const demanda = (campos) => ({
  area: "saude-indigena",
  edital_id: null,
  edital: null,
  unidade: null,
  descricao: null,
  concluida: false,
  concluida_em: null,
  concluida_por: null,
  responsaveis: [],
  pode_editar: true,
  criada_por: "Gestora",
  criada_em: "2026-09-01T12:00:00Z",
  ...campos,
});

const D1 = demanda({
  id: "d1",
  titulo: "Relatório mensal",
  data_inicio: "2026-09-08",
  data_fim: "2026-09-10",
  responsaveis: [ANA],
});
const D2 = demanda({
  id: "d2",
  titulo: "Reunião de alinhamento",
  data_inicio: "2026-09-18",
  data_fim: "2026-09-18",
  edital_id: "1",
  edital: "10/2026",
  unidade: "DSEI Manaus",
});
const D3 = demanda({
  id: "d3",
  area: "sede",
  titulo: "Demanda da SEDE",
  data_inicio: "2026-09-16",
  data_fim: "2026-09-16",
});

function supabaseFalso({
  podeCriarEm = ["saude-indigena"],
  podeEditar = true,
} = {}) {
  const demandas = [D1, D2, D3].map((item) => ({
    ...item,
    pode_editar: podeEditar,
  }));
  return {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "token" } },
        error: null,
      }),
    },
    rpc: vi.fn(async (nome, argumentos) => {
      switch (nome) {
        case "get_nucleo_cronograma_resumo":
          return {
            data: [
              {
                id: 1,
                unidade: "DSEI Manaus",
                edital: "10/2026",
                cronograma_total: 1,
              },
            ],
            error: null,
          };
        case "listar_etapas_do_cronograma":
          return {
            data: [
              {
                monitoramento_id: 1,
                atividade: "Inscrições",
                data_inicio: "2026-09-22",
                data_fim: "2026-09-22",
                ordem: 1,
              },
            ],
            error: null,
          };
        case "listar_demandas_internas":
          return {
            data: { pode_criar_em: podeCriarEm, demandas },
            error: null,
          };
        case "concluir_demanda_interna":
          return {
            data: {
              ...demandas.find((item) => item.id === argumentos.p_id),
              concluida: argumentos.p_concluida,
              concluida_em: argumentos.p_concluida
                ? "2026-09-15T13:00:00Z"
                : null,
              concluida_por: argumentos.p_concluida ? "Gestora" : null,
            },
            error: null,
          };
        case "listar_pessoas_da_area":
          return { data: [ANA, BRUNO], error: null };
        case "salvar_demanda_interna": {
          const p = argumentos.p_demanda;
          return {
            data: demanda({
              id: p.id || "nova",
              area: p.area,
              titulo: p.titulo,
              data_inicio: p.data_inicio,
              data_fim: p.data_fim,
              responsaveis: [ANA, BRUNO].filter((pessoa) =>
                p.responsaveis.includes(pessoa.id),
              ),
            }),
            error: null,
          };
        }
        case "excluir_demanda_interna":
          return { data: { ok: true, id: argumentos.p_id }, error: null };
        default:
          return { data: null, error: { message: `RPC inesperada: ${nome}` } };
      }
    }),
  };
}

const $ = (id) => document.getElementById(id);
const chamadas = (supabase, nome) =>
  supabase.rpc.mock.calls.filter(([chamada]) => chamada === nome);

async function montar(opcoes = {}) {
  document.body.innerHTML = `<section id="page-calendario" class="page active"></section>`;
  const supabase = supabaseFalso(opcoes);
  let controlador;
  await act(async () => {
    controlador = montarTela(criarCalendarioEditais, "page-calendario", {
      secao: $("page-calendario"),
      supabase,
      toast: vi.fn(),
      agora: () => new Date(HOJE),
      ...(opcoes.resumo ? { resumo: opcoes.resumo } : {}),
    });
  });
  await esperar(() => controlador.render());
  return { supabase, controlador };
}

let atual = null;
afterEach(() => {
  atual?.controlador?.raiz?.unmount();
  atual = null;
});

describe("demandas internas no Cronograma", () => {
  it("entram no calendário como 'Demanda interna', com a atrasada à vista, e só as da área", async () => {
    atual = await montar();
    const tipo = document.querySelector(
      '#calLegenda [data-tipo="demanda-interna"]',
    );
    expect(tipo?.textContent).toContain("Demanda interna");
    // "Ocultar concluídas" (ligado) não esconde a atrasada.
    expect($("calGrade").textContent).toContain("Relatório mensal · atrasada");
    expect($("calGrade").textContent).toContain("Reunião de alinhamento");
    expect($("calGrade").textContent).not.toContain("Demanda da SEDE");

    const itens = [...document.querySelectorAll(".demandas-item")];
    expect(itens.map((item) => item.dataset.demanda)).toEqual(["d1", "d2"]);
    expect(itens[0].querySelector(".demandas-atrasada")?.textContent).toBe(
      "Atrasada",
    );
    expect(itens[1].querySelector(".demandas-atrasada")).toBeNull();
    expect(itens[1].textContent).toContain("18/09/2026 · 10/2026");
  });

  it("na Semana, a demanda com período segue o critério do Mês: só início e fim", async () => {
    atual = await montar();
    await clicar(document.querySelector('.cal-visoes [data-valor="semana"]'));
    await clicar($("calMesAnterior")); // semana de 6 a 12/09; d1 vai de 8 a 10
    const nomes = [
      ...document.querySelectorAll(".cal-semana-vista .cal-mini-nome"),
    ]
      .map((item) => item.textContent)
      .filter((texto) => texto.includes("Relatório mensal"));
    expect(nomes).toHaveLength(2);
    const andamento = [
      ...document.querySelectorAll(".cal-semana-andamento"),
    ].map((botao) => botao.textContent);
    expect(andamento).toEqual(["1 em andamento"]);
  });

  it("desligar o tipo na legenda esconde as demandas do calendário", async () => {
    atual = await montar();
    await clicar(
      document.querySelector('#calLegenda [data-tipo="demanda-interna"]'),
    );
    expect($("calGrade").textContent).not.toContain("Relatório mensal");
    expect(localStorage.getItem("agsus:cronograma:tipos-ocultos")).toBe(
      '["demanda-interna"]',
    );
  });

  it("o detalhe mostra os responsáveis; Concluir grava e a demanda vai para as concluídas", async () => {
    const { supabase } = (atual = await montar());
    await clicar(document.querySelector('[data-demanda="d1"]'));
    expect($("demandaDetalhe")).not.toBeNull();
    expect($("demandaResponsaveisDetalhe").textContent).toBe("Ana Souza");

    await clicar($("demandaConcluir"));
    expect(chamadas(supabase, "concluir_demanda_interna")[0][1]).toEqual({
      p_id: "d1",
      p_concluida: true,
    });
    expect($("demandaConcluir").textContent).toBe("Reabrir");
    expect($("demandaDetalhe").textContent).toContain("Concluída · Gestora");
    expect(
      [
        ...document.querySelectorAll(
          ".demandas-card > .demandas-lista .demandas-item",
        ),
      ].map((item) => item.dataset.demanda),
    ).toEqual(["d2"]);
    expect($("demandasVerConcluidas").textContent).toContain("(1)");
    // No calendário, deixa de ser atrasada.
    expect($("calGrade").textContent).not.toContain("· atrasada");
  });

  it("Nova demanda: valida o formulário e salva com área, data única e responsáveis", async () => {
    const { supabase } = (atual = await montar());
    await clicar($("demandaNova"));
    await clicar($("demandaSalvar"));
    expect($("demandaErro").textContent).toBe(
      "O título precisa ter ao menos 3 caracteres.",
    );
    expect(chamadas(supabase, "salvar_demanda_interna")).toHaveLength(0);

    await digitar($("demandaTitulo"), "  Conferir   documentos ");
    await digitar($("demandaInicio"), "2026-09-25");
    await esperar();
    expect(chamadas(supabase, "listar_pessoas_da_area")[0][1]).toEqual({
      p_area: "saude-indigena",
      p_edital: null,
    });
    await clicar(
      document.querySelector(
        '#demandaFormulario input[type="checkbox"][value="p2"]',
      ),
    );
    await clicar($("demandaSalvar"));

    expect(chamadas(supabase, "salvar_demanda_interna")[0][1]).toEqual({
      p_demanda: {
        area: "saude-indigena",
        edital_id: null,
        titulo: "Conferir documentos",
        descricao: null,
        data_inicio: "2026-09-25",
        data_fim: "2026-09-25",
        responsaveis: ["p2"],
      },
    });
    expect($("demandaFormulario")).toBeNull();
    // Abre o detalhe da nova, já na lista e no calendário.
    expect($("demandaResponsaveisDetalhe").textContent).toBe("Bruno Lima");
    expect(document.querySelector('[data-demanda="nova"]')).not.toBeNull();
  });

  it("Excluir pede confirmação e tira a demanda da lista", async () => {
    const { supabase } = (atual = await montar());
    await clicar(document.querySelector('[data-demanda="d2"]'));
    await clicar($("demandaExcluir"));
    expect($("demandaExcluirConfirmar")).not.toBeNull();
    await clicar($("demandaExcluirSim"));
    expect(chamadas(supabase, "excluir_demanda_interna")[0][1]).toEqual({
      p_id: "d2",
    });
    expect(document.querySelector('[data-demanda="d2"]')).toBeNull();
    expect($("demandaDetalhe")).toBeNull();
    expect($("calGrade").textContent).not.toContain("Reunião de alinhamento");
  });

  it("quem só lê vê as demandas, sem Nova demanda nem ações", async () => {
    atual = await montar({ podeCriarEm: [], podeEditar: false });
    expect($("demandaNova")).toBeNull();
    await clicar(document.querySelector('[data-demanda="d1"]'));
    expect($("demandaResponsaveisDetalhe").textContent).toBe("Ana Souza");
    expect($("demandaConcluir")).toBeNull();
    expect($("demandaEditar")).toBeNull();
    expect($("demandaExcluir")).toBeNull();
  });
});

describe("Cronograma só com os da pessoa (?visao=meus, do resumo do dia)", () => {
  it("abrirVisao('meus') recorta nos editais e demandas dela; 'Ver todos' volta", async () => {
    const resumo = criarEstadoDoResumoDoDia({
      cliente: () => ({
        rpc: async () => ({
          data: {
            data: "2026-09-15",
            perfil: "p1",
            responsavel: true,
            editais: [],
            demandas: ["d1"],
            hoje: [],
            proximos: [],
            atrasadas: [],
          },
          error: null,
        }),
      }),
      armazenamento: () => null,
      podeAbrirSozinho: () => false,
    });
    await esperar(() => resumo.verificar());
    atual = await montar({ resumo });
    await esperar(() => atual.controlador.abrirVisao("meus"));
    expect($("calSoOsMeus")).not.toBeNull();
    expect($("calGrade").textContent).toContain("Relatório mensal");
    expect($("calGrade").textContent).not.toContain("Reunião de alinhamento");
    expect($("calGrade").textContent).not.toContain("Inscrições");

    await clicar($("calSoOsMeus").querySelector("button"));
    expect($("calSoOsMeus")).toBeNull();
    expect($("calGrade").textContent).toContain("Reunião de alinhamento");
  });
});

describe("responsáveis pelo edital", () => {
  function clienteDosResponsaveis({ podeEditar }) {
    let responsaveis = [ANA];
    return {
      rpc: vi.fn(async (nome, argumentos) => {
        if (nome === "obter_responsaveis_do_edital")
          return {
            data: {
              area: "saude-indigena",
              pode_editar: podeEditar,
              responsaveis,
            },
            error: null,
          };
        if (nome === "listar_pessoas_da_area")
          return { data: [ANA, BRUNO], error: null };
        if (nome === "salvar_responsaveis_do_edital") {
          responsaveis = [ANA, BRUNO].filter((pessoa) =>
            argumentos.p_responsaveis.includes(pessoa.id),
          );
          return {
            data: { area: "saude-indigena", pode_editar: true, responsaveis },
            error: null,
          };
        }
        return { data: null, error: { code: "PGRST202" } };
      }),
    };
  }

  let desmontar = () => {};
  afterEach(() => desmontar());

  async function desenhar(supabase) {
    document.body.innerHTML = `<div id="raiz"></div>`;
    await act(async () => {
      ({ desmontar } = desenharNoTeste(
        $("raiz"),
        createElement(ResponsaveisDoEdital, { editalId: "1", supabase }),
      ));
    });
    await esperar();
  }

  it("quem só vê lê os nomes", async () => {
    const supabase = clienteDosResponsaveis({ podeEditar: false });
    await desenhar(supabase);
    expect($("editalResponsaveisLista").textContent).toBe("Ana Souza");
    expect($("editalResponsaveisSalvar")).toBeNull();
    expect(chamadas(supabase, "listar_pessoas_da_area")).toHaveLength(0);
  });

  it("o gestor escolhe as pessoas e salva a lista inteira", async () => {
    const supabase = clienteDosResponsaveis({ podeEditar: true });
    await desenhar(supabase);
    expect($("editalResponsaveisSalvar").disabled).toBe(true);
    await clicar(
      document.querySelector('#editalResponsaveis input[value="p2"]'),
    );
    expect($("editalResponsaveisSalvar").disabled).toBe(false);
    await clicar($("editalResponsaveisSalvar"));
    expect(chamadas(supabase, "salvar_responsaveis_do_edital")[0][1]).toEqual({
      p_edital: "1",
      p_responsaveis: ["p1", "p2"],
    });
    expect(
      document.querySelector(".edital-responsaveis-salvo")?.textContent,
    ).toBe("Responsáveis salvos.");
    expect($("editalResponsaveisSalvar").disabled).toBe(true);
  });

  it("banco sem as RPCs: o bloco não aparece", async () => {
    await desenhar({
      rpc: vi.fn(async () => ({ data: null, error: { code: "PGRST202" } })),
    });
    expect($("editalResponsaveis")).toBeNull();
  });
});
