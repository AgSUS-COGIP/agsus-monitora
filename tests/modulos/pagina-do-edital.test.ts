// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ContextoDoApp } from "../../src/app/contexto-do-app.ts";
import { avisar } from "../../src/app/avisos.ts";
import { ESTADO_INICIAL_DA_NAVEGACAO } from "../../src/app/navegacao.ts";
import type {
  EstadoDaNavegacao,
  LeituraDaNavegacao,
} from "../../src/app/navegacao.ts";
import {
  definirAreaAtual,
  definirAreasDoUsuario,
  publicarLinhasDoMonitoramento,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";
import { PaginaDoEdital } from "../../src/modulos/pagina-do-edital/pagina-do-edital.tsx";
import { criarEstadoDaPaginaDoEdital } from "../../src/modulos/pagina-do-edital/estado.ts";
import { abrirPaginaDoEdital } from "../../src/modulos/pagina-do-edital/abrir.ts";
import type { ClienteDaPaginaDoEdital } from "../../src/modulos/pagina-do-edital/estado.ts";
import { desenharNoTeste } from "../montar-tela.ts";
import { clicar, esperar } from "../componentes/interacoes.ts";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/*
  A página do edital (src/modulos/pagina-do-edital/): o edital do endereço
  achado entre as linhas da área, o cabeçalho com a situação excepcional, as
  vagas, os candidatos, a linha do tempo e as retificações; o "Voltar" pela
  navegação. Dados fictícios.
*/

const ID = "0b7c9a52-2d55-4c4e-9f7a-1c3d5e7f9a1b";
const HOJE = new Date("2026-11-18T15:00:00Z");
const LINHAS = [
  {
    id: ID,
    CO_AREA: "saude-indigena",
    edital: "Edital nº 105/2026",
    unidade: "DSEI Fictício",
    status: "Suspenso",
    vagas_total: 70,
    contratados: 0,
    data_inicio: "2026-10-01",
    data_fim: "2026-12-20",
    link_edital: "https://exemplo.org/edital-105.pdf",
  },
  {
    id: "outro",
    CO_AREA: "saude-indigena",
    edital: "Edital 120/2026",
    unidade: "DSEI A",
  },
  {
    id: "outro-2",
    CO_AREA: "saude-indigena",
    edital: "Edital 120/2026",
    unidade: "DSEI B",
  },
];
const CRONOGRAMA = {
  monitoramento: {
    id: ID,
    status_override: "Suspenso",
    status_override_motivo: "Decisão judicial",
    status_override_data: "2026-11-05",
  },
  estado: { status: "Suspenso", etapa: "Inscrições" },
  etapas: [
    { ordem: 1, atividade: "Publicação do edital", data_inicio: "2026-10-01" },
    {
      ordem: 2,
      atividade: "Inscrições",
      data_inicio: "2026-10-02",
      data_fim: "2026-11-30",
    },
    { ordem: 3, atividade: "Resultado final", data_inicio: "2026-12-20" },
  ],
  historico: [
    {
      acao: "errata",
      numero_errata: "Errata nº 1",
      motivo: "SEI 00000.000000/2026-00",
      total_alteracoes: 2,
      created_at: "2026-10-20T13:00:00Z",
    },
  ],
};

function clienteFalso() {
  const rpc = vi.fn<ClienteDaPaginaDoEdital["rpc"]>(async () => ({
    data: CRONOGRAMA,
    error: null,
  }));
  return {
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "token" } },
        error: null,
      }),
    },
    rpc,
  };
}

function navegacaoFalsa(mudancas: Partial<EstadoDaNavegacao>) {
  const estado: EstadoDaNavegacao = {
    ...ESTADO_INICIAL_DA_NAVEGACAO,
    view: "edital",
    area: "saude-indigena",
    ...mudancas,
  };
  const voltarDaPaginaDoEdital = vi.fn(() => true);
  const navegacao: LeituraDaNavegacao = {
    obter: () => estado,
    assinar: () => () => {},
    esquecerEditalEVisao: () => {},
    abrirRegrasDoEdital: () => false,
    fecharRegrasDoEdital: () => {},
    voltarDaPaginaDoEdital,
    irParaInicio: () => {},
  };
  return { navegacao, voltarDaPaginaDoEdital };
}

let desmontar: (() => void) | null = null;

async function montar(
  edital: string,
  {
    retorno = null,
    acompanhamento = {
      listas: [
        { monitoramento_id: ID, aprovados: 30, com_status: 18, desistentes: 3 },
      ],
    },
  }: {
    retorno?: EstadoDaNavegacao["retorno"];
    acompanhamento?: unknown;
  } = {},
) {
  const cliente = clienteFalso();
  const buscarAcompanhamento = vi.fn(async () => acompanhamento);
  const estado = criarEstadoDaPaginaDoEdital({
    supabase: cliente,
    buscarAcompanhamento,
  });
  const { navegacao, voltarDaPaginaDoEdital } = navegacaoFalsa({
    edital,
    retorno,
  });
  const elemento = document.createElement("section");
  document.body.append(elemento);
  const desenho = desenharNoTeste(
    elemento,
    createElement(
      ContextoDoApp.Provider,
      { value: { navegacao, avisar, pecas: null } },
      createElement(PaginaDoEdital, { estado, agora: () => HOJE }),
    ),
  );
  desmontar = desenho.desmontar;
  await esperar(() => new Promise((resolver) => setTimeout(resolver, 0)));
  return { elemento, cliente, buscarAcompanhamento, voltarDaPaginaDoEdital };
}

beforeEach(() => {
  act(() => {
    definirAreasDoUsuario(["saude-indigena"]);
    definirAreaAtual("saude-indigena");
    publicarLinhasDoMonitoramento(LINHAS);
  });
});
afterEach(() => {
  desmontar?.();
  desmontar = null;
  redefinirDadosDoMonitoramento();
  document.body.innerHTML = "";
});

describe("a página do edital", () => {
  it("acha o edital pelo número e mostra cabeçalho, vagas, candidatos e linha do tempo", async () => {
    const { elemento, cliente } = await montar("105-2026");
    const texto = elemento.textContent || "";
    expect(elemento.querySelector("h2")?.textContent).toBe(
      "Edital nº 105/2026",
    );
    expect(texto).toContain("DSEI Fictício");
    expect(texto).toContain(
      "Edital suspenso desde 05/11/2026: Decisão judicial",
    );
    expect(cliente.rpc).toHaveBeenCalledWith("get_monitoramento_cronograma", {
      p_monitoramento_id: ID,
    });
    // Vagas: 0 de 70.
    expect(
      elemento.querySelector('[title="0 de 70 preenchidas"]'),
    ).not.toBeNull();
    // Candidatos: 30 aprovados, 12 aguardando, 15 nas demais (3 desistentes à parte).
    expect(texto).toContain("Aguardando chamada");
    expect(texto).toContain("3 desistentes à parte");
    // Linha do tempo pelas datas de hoje.
    const etapas = [...elemento.querySelectorAll("[data-marca]")].map((li) => [
      li.querySelector("strong")?.textContent,
      li.getAttribute("data-marca"),
    ]);
    expect(etapas).toEqual([
      ["Publicação do edital", "concluida"],
      ["Inscrições", "atual"],
      ["Resultado final", "prevista"],
    ]);
    expect(
      elemento.querySelector('[aria-current="step"] strong')?.textContent,
    ).toBe("Inscrições");
    // A retificação do histórico.
    expect(texto).toContain("Errata nº 1");
    expect(texto).toContain("SEI 00000.000000/2026-00");
    // O edital publicado (link da linha).
    expect(
      elemento.querySelector<HTMLAnchorElement>(
        'a[href^="https://exemplo.org"]',
      )?.textContent,
    ).toContain("Edital publicado");
  });

  it("o Voltar diz para onde volta e chama a navegação", async () => {
    const { elemento, voltarDaPaginaDoEdital } = await montar("105-2026", {
      retorno: { view: "calendario", titulo: "Cronograma", edital: "105-2026" },
    });
    const voltar = elemento.querySelector<HTMLButtonElement>(
      ".pagina-do-edital-voltar",
    );
    expect(voltar?.textContent).toContain("Voltar para Cronograma");
    await clicar(voltar);
    expect(voltarDaPaginaDoEdital).toHaveBeenCalledTimes(1);
  });

  it("dois editais com o mesmo número: a escolha leva ao endereço de cada um", async () => {
    const navigate = vi.fn(() => true);
    vi.stubGlobal("navigate", navigate);
    const { elemento } = await montar("120-2026");
    const botoes = [
      ...elemento.querySelectorAll(".pagina-do-edital-escolha button"),
    ];
    expect(botoes.map((b) => b.textContent)).toEqual([
      "Edital 120/2026 · DSEI A",
      "Edital 120/2026 · DSEI B",
    ]);
    await clicar(botoes[1]);
    expect(navigate).toHaveBeenCalledWith("edital", { edital: "outro-2" });
    vi.unstubAllGlobals();
  });

  it("edital que não é da área: avisa sem pedir nada ao banco", async () => {
    const { elemento, cliente } = await montar("7-2030");
    expect(elemento.textContent).toContain("Edital 7/2030 não encontrado");
    expect(cliente.rpc).not.toHaveBeenCalled();
  });
});

describe("abrir a página do edital", () => {
  it("vai pelo número do edital (ou pelo id, se o número se repete)", () => {
    const navigate = vi.fn(() => true);
    expect(abrirPaginaDoEdital(LINHAS[0]!, LINHAS, { navigate })).toBe(true);
    expect(navigate).toHaveBeenLastCalledWith("edital", { edital: "105-2026" });
    abrirPaginaDoEdital(LINHAS[1]!, LINHAS, { navigate });
    expect(navigate).toHaveBeenLastCalledWith("edital", { edital: "outro" });
    expect(abrirPaginaDoEdital(LINHAS[0]!, LINHAS, {})).toBe(false);
  });
});
