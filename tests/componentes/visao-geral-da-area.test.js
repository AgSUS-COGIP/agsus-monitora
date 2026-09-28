import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { montarVisaoGeralDaArea } from "../../src/componentes/visao-geral-da-area/visao-geral-da-area.jsx";
import {
  definirAreaAtual,
  publicarLinhasDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.js";
import { clicar, esperar } from "./interacoes.js";

/*
  A Visão geral da SEDE e de Projetos: a faixa de indicadores (mesma conta da
  Saúde Indígena), as próximas etapas, os editais da área e, em Projetos, o
  mapa dos municípios. "Hoje" é 28/09/2026. O Leaflet não existe no jsdom: o
  mapa fica só com a lista ao lado, que é o que se confere aqui.
*/

const HOJE = new Date(2026, 8, 28, 10);
const PERFIL = { nome: "MARIA DA SILVA", email: "maria@agenciasus.org.br" };

const LINHAS = [
  {
    id: "s1",
    CO_AREA: "sede",
    edital: "21/2026",
    unidade: "SEDE",
    status: "Em andamento",
    etapa: "Inscrições",
    risco: "Alto",
    vagas_total: 3,
    inscritos: 40,
    contratados: 0,
    vagas_ociosas: 3,
    cronograma_proxima_atividade: "Resultado preliminar",
    cronograma_proxima_data: "2026-09-30",
  },
  {
    id: "s2",
    CO_AREA: "sede",
    edital: "07/2025",
    unidade: "SEDE",
    status: "Concluído",
    etapa: "Resultado final",
    risco: "Baixo",
    vagas_total: 7,
    inscritos: 100,
    contratados: 7,
    vagas_ociosas: 0,
  },
  {
    id: "p1",
    CO_AREA: "projetos",
    edital: "93/2026",
    unidade: "Escritório Distrital e Regional",
    status: "Em andamento",
    etapa: "Período de inscrição",
    risco: "Baixo",
    vagas_total: 11,
    inscritos: 0,
    contratados: 0,
    vagas_ociosas: 11,
  },
  {
    id: "i1",
    CO_AREA: "saude-indigena",
    edital: "01/2026",
    unidade: "DSEI Xingu",
    status: "Em andamento",
    vagas_total: 500,
  },
];

const MUNICIPIOS = [
  {
    municipio_uf: "Irati/PR",
    municipio: "Irati",
    uf: "PR",
    vagas: 5,
    candidatos: 70,
    aprovados: 43,
    reprovados: 27,
  },
  {
    municipio_uf: "Seropédica/RJ",
    municipio: "Seropédica",
    uf: "RJ",
    vagas: 5,
    candidatos: 647,
    aprovados: 287,
    reprovados: 360,
  },
];

function supabaseFalso(resposta = { data: MUNICIPIOS, error: null }) {
  return {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "token" } },
        error: null,
      }),
    },
    rpc: vi.fn(async () => resposta),
  };
}

let controlador = null;

async function montar({ area, linhas = LINHAS, supabase = supabaseFalso() }) {
  document.body.innerHTML = `<section id="page-visao-area" class="page active"></section>`;
  definirAreaAtual(area);
  if (linhas) publicarLinhasDoMonitoramento(linhas);
  await act(async () => {
    controlador = montarVisaoGeralDaArea({
      secao: document.getElementById("page-visao-area"),
      supabase,
      obterPerfil: () => PERFIL,
      agora: () => new Date(HOJE),
    });
  });
  await esperar(() => controlador.render());
  await esperar();
  return { supabase };
}

beforeEach(() => localStorage.clear());

afterEach(async () => {
  await act(async () => controlador?.raiz?.unmount());
  controlador = null;
  redefinirDadosDoMonitoramento();
  document.body.innerHTML = "";
});

const kpi = (rotulo) =>
  [...document.querySelectorAll(".kpi")]
    .find((item) => item.textContent.includes(rotulo))
    ?.querySelector("b")?.textContent;
const linhasDaTabela = () =>
  [...document.querySelectorAll(".visao-da-area__tabela tbody tr")].map(
    (linha) => linha.cells[0].textContent,
  );
const botao = (texto) =>
  [...document.querySelectorAll("button")].find((item) =>
    item.textContent.includes(texto),
  );

describe("SEDE", () => {
  it("mostra os indicadores só da área, com a conta da Saúde Indígena", async () => {
    const { supabase } = await montar({ area: "sede" });
    expect(kpi("Processos seletivos")).toBe("2");
    expect(kpi("Vagas imediatas previstas")).toBe("10");
    expect(kpi("Contratações")).toBe("7");
    expect(kpi("Vagas ociosas")).toBe("3");
    expect(kpi("Processos críticos")).toBe("1");
    expect(kpi("Inscritos")).toBe("140");
    // Sem mapa: a SEDE não pede nada ao banco.
    expect(document.querySelector(".visao-da-area__mapa-card")).toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("dá boas-vindas e lista as próximas etapas da semana", async () => {
    await montar({ area: "sede" });
    const boasVindas = document.querySelector(".boas-vindas");
    expect(boasVindas.textContent).toContain("Bom dia, Maria");
    expect(boasVindas.textContent).toContain(
      "1 edital tem etapa nos próximos 7 dias.",
    );
    const etapa = document.querySelector(".visao-da-area__etapa");
    expect(etapa.textContent).toContain("30/09");
    expect(etapa.textContent).toContain("Em 2 dias");
    expect(etapa.textContent).toContain("Resultado preliminar");
    expect(etapa.textContent).toContain("Edital 21/2026");

    await clicar(boasVindas.querySelector(".boas-vindas__fechar"));
    expect(document.querySelector(".boas-vindas")).toBeNull();
  });

  it("a tabela esconde os encerrados até pedir, e o KPI crítico filtra", async () => {
    await montar({ area: "sede" });
    expect(linhasDaTabela()).toEqual(["21/2026"]);

    await clicar(botao("Mostrar encerrados (1)"));
    expect(linhasDaTabela()).toEqual(["21/2026", "07/2025"]);

    const critico = document.querySelector(".kpi-clickable");
    await clicar(critico);
    expect(critico.getAttribute("aria-pressed")).toBe("true");
    expect(linhasDaTabela()).toEqual(["21/2026"]);
  });
});

describe("Projetos", () => {
  it("mostra o mapa com os municípios das vagas, do maior para o menor", async () => {
    const { supabase } = await montar({ area: "projetos" });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "listar_municipios_das_vagas_da_area",
      { p_area: "projetos" },
    );
    const municipios = [
      ...document.querySelectorAll(".visao-da-area__municipio"),
    ].map((item) => item.querySelector("strong").textContent);
    expect(municipios).toEqual(["Seropédica/RJ", "Irati/PR"]);
    const cabecalho = document.querySelector(
      ".visao-da-area__mapa-card .chip",
    ).textContent;
    expect(cabecalho).toBe("2 municípios · 717 candidatos");
    expect(kpi("Processos seletivos")).toBe("1");
  });

  it("não repete o pedido ao reabrir a página (cache)", async () => {
    const { supabase } = await montar({ area: "projetos" });
    await esperar(() => controlador.render());
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("com o banco ainda sem a função, avisa no mapa e segue com o resto", async () => {
    await montar({
      area: "projetos",
      supabase: supabaseFalso({ data: null, error: { code: "PGRST202" } }),
    });
    expect(
      document.querySelector(".visao-da-area__mapa-card").textContent,
    ).toContain("Mapa ainda indisponível");
    expect(kpi("Processos seletivos")).toBe("1");
  });

  it("sem município nas vagas, o mapa diz que não há o que mostrar", async () => {
    await montar({
      area: "projetos",
      supabase: supabaseFalso({ data: [], error: null }),
    });
    expect(
      document.querySelector(".visao-da-area__mapa-card").textContent,
    ).toContain("Nenhum município nas vagas");
  });
});

describe("estados vazios", () => {
  it("área sem editais mostra o aviso, sem indicadores", async () => {
    await montar({
      area: "sede",
      linhas: LINHAS.filter((linha) => linha.CO_AREA !== "sede"),
    });
    expect(document.querySelector(".kpis")).toBeNull();
    expect(document.querySelector(".visao-da-area").textContent).toContain(
      "SEDE: nenhum edital ainda",
    );
  });

  it("antes de os editais chegarem, mostra que está carregando", async () => {
    await montar({ area: "sede", linhas: null });
    expect(document.querySelector(".visao-da-area").textContent).toContain(
      "Carregando os editais da área",
    );
  });
});
