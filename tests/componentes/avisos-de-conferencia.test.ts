// @vitest-environment jsdom
import { act, createElement } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { definido } from "../definido.ts";
import { clicar, digitar, escolher, esperar } from "./interacoes.ts";
import {
  definirAreaAtual,
  definirAreasDoUsuario,
  redefinirDadosDoMonitoramento,
} from "../../src/componentes/dados-do-monitoramento.ts";

/*
  Avisos de conferência (React, src/modulos/conferencias/): o selo de cada
  tela pede só os avisos do módulo na área atual, some sem aviso e abre a
  gaveta; o cartão do Status das atualizações filtra por módulo e agrupa por
  edital; a central de avisos (20261118140000): dispensar exige justificativa e
  relê a lista; o gestor atribui responsável e prazo; evidência de um caso; o
  histórico.
*/

const { SeloDeAvisos, CartaoDeAvisos } =
  await import("../../src/modulos/conferencias/avisos-de-conferencia.tsx");
const { esquecerAvisosGuardados } =
  await import("../../src/modulos/conferencias/estado.ts");

const aviso = (extra: Record<string, unknown> = {}) => ({
  id: "a1",
  conferencia: "ANALISE_APROVADA_ABAIXO_DO_CORTE",
  escopo: "edital:e1",
  gravidade: "CRITICA",
  modulo: "analises",
  area: "saude-indigena",
  edital_id: "e1",
  edital: "101/2026",
  quantidade: 3,
  exemplos: ["00000000-0000-4000-a000-0000000000a1"],
  resumo: "3 análises aprovadas com nota abaixo de 60 no edital 101/2026.",
  situacao: "ABERTO",
  primeira_vez: "2026-10-05T09:00:00Z",
  ultima_vez: "2026-10-06T09:00:00Z",
  tratamento: "PENDENTE",
  pode_gerir: true,
  pode_tratar: true,
  ...extra,
});

/* Os parâmetros que as RPCs dos avisos recebem (o falso só lê a versão). */
type ParametrosDosAvisos = {
  p_versao?: string | null;
  [parametro: string]: unknown;
};

function supabaseFalso(avisos: () => unknown[]) {
  return {
    rpc: vi.fn(async (nome: string, _argumentos?: ParametrosDosAvisos) => {
      if (nome === "listar_avisos_conferencia_se_mudou")
        return { data: { avisos: avisos() }, error: null };
      if (nome === "listar_responsaveis_aviso_conferencia")
        return {
          data: [{ id: "u1", nome: "Pessoa Fictícia" }],
          error: null,
        };
      if (nome === "listar_casos_aviso_conferencia")
        return {
          data: {
            total: 1,
            casos: [
              {
                aviso_id: "a1",
                ordem: 1,
                conferencia: "ANALISE_APROVADA_ABAIXO_DO_CORTE",
                analise_id: "an1",
                codigo: "4512",
                nome: "Pessoa Fictícia",
              },
            ],
          },
          error: null,
        };
      if (nome === "listar_historico_aviso_conferencia")
        return {
          data: {
            eventos: [
              {
                id: 2,
                evento: "TRATAMENTO",
                tratamento: "DISPENSADO",
                motivo: "Conferido com a banca.",
                por: "Pessoa Fictícia",
                em: "2026-10-06T10:00:00Z",
              },
              { id: 1, evento: "ACHADO", quantidade: 3, robo: true },
            ],
            evidencias: [],
          },
          error: null,
        };
      return { data: { id: "a1" }, error: null };
    }),
  };
}

const botao = (dentro: Element, texto: string) =>
  [...dentro.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(texto),
  );

let raiz: HTMLDivElement | undefined;
let montagem: Root | undefined;

async function montar(elemento: ReactElement) {
  const novaRaiz = document.createElement("div");
  raiz = novaRaiz;
  document.body.append(novaRaiz);
  const novaMontagem = createRoot(novaRaiz);
  montagem = novaMontagem;
  await act(async () => novaMontagem.render(elemento));
  await esperar();
}

beforeEach(() => {
  sessionStorage.clear();
  esquecerAvisosGuardados();
  definirAreasDoUsuario(["saude-indigena"]);
  definirAreaAtual("saude-indigena");
});

afterEach(async () => {
  await act(async () => montagem?.unmount());
  raiz?.remove();
  document.body.innerHTML = "";
  redefinirDadosDoMonitoramento();
});

describe("selo de avisos no topo da tela", () => {
  it("pede os avisos do módulo na área atual e abre a gaveta", async () => {
    const supabase = supabaseFalso(() => [aviso()]);
    await montar(createElement(SeloDeAvisos, { modulo: "analises", supabase }));
    expect(supabase.rpc).toHaveBeenCalledWith(
      "listar_avisos_conferencia_se_mudou",
      { p_area: "saude-indigena", p_modulo: "analises", p_versao: null },
    );
    const selo = document.querySelector(".conf-selo-do-modulo");
    expect(selo?.textContent).toContain("1 aviso");
    expect(selo?.className).toContain("conf-selo-do-modulo--perigo");
    await clicar(selo);
    expect(document.body.textContent).toContain(
      "Aprovada com nota abaixo da mínima",
    );
    expect(document.body.textContent).toContain("Edital 101/2026");
  });

  it("sem aviso aberto, não aparece", async () => {
    const supabase = supabaseFalso(() => []);
    await montar(
      createElement(SeloDeAvisos, { modulo: "entrevistas", supabase }),
    );
    expect(document.querySelector(".conf-selo-do-modulo")).toBeNull();
  });
});

describe("cartão do Status das atualizações", () => {
  it("filtra por módulo, agrupa por edital e dispensa com justificativa", async () => {
    let dispensado = false;
    const supabase = supabaseFalso(() => [
      aviso(
        dispensado
          ? {
              tratamento: "DISPENSADO",
              motivo: "Conferido com a banca.",
            }
          : {},
      ),
      aviso({
        id: "a2",
        conferencia: "CARGA_VARIACAO_BRUSCA",
        escopo: "vaga:177979",
        gravidade: "ATENCAO",
        modulo: "cargas",
        area: null,
        edital_id: null,
        edital: null,
        pode_gerir: false,
        pode_tratar: false,
      }),
    ]);
    await montar(createElement(CartaoDeAvisos, { supabase }));
    expect(supabase.rpc).toHaveBeenCalledWith(
      "listar_avisos_conferencia_se_mudou",
      { p_area: null, p_modulo: null, p_versao: null },
    );
    expect(document.querySelectorAll(".conf-aviso")).toHaveLength(2);
    expect(
      [...document.querySelectorAll(".conf-grupo__titulo")].map(
        (t) => t.firstChild?.textContent,
      ),
    ).toEqual(["Edital 101/2026", "Vaga 177979"]);
    expect(document.body.textContent).toContain("rechecado em 06/10/2026");

    await clicar(document.querySelector('[data-valor="cargas"]'));
    expect(document.querySelectorAll(".conf-aviso")).toHaveLength(1);
    // Sem permissão, nada de "Tratar".
    expect(
      botao(definido(document.querySelector(".conf-aviso")), "Tratar"),
    ).toBeUndefined();
    await clicar(document.querySelector('[data-valor="todos"]'));

    const analise = definido(
      document.querySelector(
        '[data-conferencia="ANALISE_APROVADA_ABAIXO_DO_CORTE"]',
      ),
    );
    await clicar(botao(analise, "Tratar"));
    await escolher(analise.querySelector("select"), "DISPENSADO");
    await clicar(botao(analise, "Salvar situação"));
    expect(analise.textContent).toContain("pelo menos 10");
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      "tratar_aviso_conferencia",
      expect.anything(),
    );

    await digitar(analise.querySelector("textarea"), "Conferido com a banca.");
    dispensado = true;
    await clicar(botao(analise, "Salvar situação"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("tratar_aviso_conferencia", {
      p_id: "a1",
      p_tratamento: "DISPENSADO",
      p_motivo: "Conferido com a banca.",
    });
    expect(document.body.textContent).toContain("Dispensados (1)");
  });

  it("o gestor atribui responsável e prazo; prazo vencido em destaque", async () => {
    const supabase = supabaseFalso(() => [
      aviso({
        responsavel_id: "u1",
        responsavel: "Pessoa Fictícia",
        prazo: "2026-01-02",
      }),
    ]);
    await montar(createElement(CartaoDeAvisos, { supabase }));
    expect(
      document.querySelector(".conf-prazo--vencido")?.textContent,
    ).toContain("02/01/2026");
    const item = definido(document.querySelector(".conf-aviso"));
    await clicar(botao(item, "Tratar"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "listar_responsaveis_aviso_conferencia",
      { p_id: "a1" },
    );
    const [, pessoa] = item.querySelectorAll("select");
    await escolher(pessoa, "");
    await clicar(botao(item, "Salvar responsável"));
    expect(supabase.rpc).toHaveBeenCalledWith("atribuir_aviso_conferencia", {
      p_id: "a1",
      p_responsavel: null,
      p_prazo: null,
    });
  });

  it("evidência de um caso e o histórico, que não se apaga", async () => {
    const supabase = supabaseFalso(() => [aviso()]);
    await montar(createElement(CartaoDeAvisos, { supabase }));
    const item = definido(document.querySelector(".conf-aviso"));
    await clicar(botao(item, "3 casos"));
    await esperar();
    await clicar(item.querySelector(".conf-caso__evidencia"));
    await esperar();
    expect(item.textContent).toContain("Do caso 4512 · Pessoa Fictícia");
    expect(item.textContent).toContain("Conferido com a banca.");
    expect(item.textContent).toContain("Conferência automática");
    await digitar(
      item.querySelector('.conf-painel input[type="text"]'),
      "25000.000001/2026-01",
    );
    await clicar(botao(item, "Juntar evidência"));
    expect(supabase.rpc).toHaveBeenCalledWith(
      "incluir_evidencia_aviso_conferencia",
      {
        p_id: "a1",
        p_tipo: "SEI",
        p_descricao: "25000.000001/2026-01",
        p_url: null,
        p_chave_caso: "analise:an1",
      },
    );
  });
});

describe("releitura só quando muda", () => {
  it("o selo montado de novo manda a versão; sem mudança, a mesma lista sem baixar", async () => {
    const versoes: unknown[] = [];
    const supabase = {
      rpc: vi.fn(async (nome: string, argumentos: ParametrosDosAvisos) => {
        if (nome !== "listar_avisos_conferencia_se_mudou")
          return { data: null, error: null };
        versoes.push(argumentos.p_versao);
        if (argumentos.p_versao === "v1")
          return { data: { inalterado: true, versao: "v1" }, error: null };
        return { data: { avisos: [aviso()], versao: "v1" }, error: null };
      }),
    };
    await montar(createElement(SeloDeAvisos, { modulo: "analises", supabase }));
    expect(
      document.querySelector(".conf-selo-do-modulo")?.textContent,
    ).toContain("1 aviso");
    await act(async () => definido(montagem).unmount());
    definido(raiz).remove();
    await montar(createElement(SeloDeAvisos, { modulo: "analises", supabase }));
    expect(versoes).toEqual([null, "v1"]);
    expect(
      document.querySelector(".conf-selo-do-modulo")?.textContent,
    ).toContain("1 aviso");
  });

  it("o cartão relê quando a marca da conferência muda, e só então", async () => {
    const supabase = supabaseFalso(() => [aviso()]);
    await montar(createElement(CartaoDeAvisos, { supabase, marca: "a" }));
    const leituras = () =>
      supabase.rpc.mock.calls.filter(
        ([nome]) => nome === "listar_avisos_conferencia_se_mudou",
      ).length;
    expect(leituras()).toBe(1);
    await act(async () =>
      definido(montagem).render(
        createElement(CartaoDeAvisos, { supabase, marca: "a" }),
      ),
    );
    expect(leituras()).toBe(1);
    await act(async () =>
      definido(montagem).render(
        createElement(CartaoDeAvisos, { supabase, marca: "b" }),
      ),
    );
    await esperar();
    expect(leituras()).toBe(2);
  });
});
