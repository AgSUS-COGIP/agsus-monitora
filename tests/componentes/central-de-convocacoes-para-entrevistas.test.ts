import { act, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registrarTelas } from "../../src/app/registro-das-telas.ts";
import {
  CentralDeConvocacoes,
  usarConducaoLigada,
} from "../../src/modulos/aprovados/central-de-convocacoes.tsx";
import { paginaDesligada } from "../../src/lib/pagina-desligada.ts";
import type { TipoDaCentralDeConvocacoes } from "../../src/modulos/aprovados/central-de-convocacoes.tsx";
import { criarConducaoDeEntrevistas } from "../../src/modulos/entrevistas/conduzir.tsx";
import type { ClienteDaConducao } from "../../src/modulos/entrevistas/tipos-do-estado-da-conducao.ts";
import { desenharNoTeste } from "../montar-tela.ts";
import { clicar, escolher, esperar } from "./interacoes.ts";

/* A página desligada pela coordenação (Módulos e abas): por padrão, ligada. */
vi.mock("../../src/lib/pagina-desligada.ts", () => ({
  paginaDesligada: vi.fn(() => false),
}));

/*
  Central de convocações (aba Convocação da Lista de aprovados), "Para
  entrevistas": a lista de convocação da Classificação, só leitura, lida da
  MESMA loja de Conduzir entrevistas (o controlador da tela a entrega pelo
  registro). Nada de estado próprio: o edital escolhido aqui é o de
  Conduzir entrevistas, e convocar continua lá.
*/

const RETRATO = {
  schema: 1,
  tipo: "CONVOCACAO",
  vagas: [
    {
      chave: "V1",
      codigo: "V1",
      cargo: "Enfermeiro",
      total: 1,
      origem_das_vagas: "QUADRO",
      limite_convocacao: { limite: 5, origem: "5 × 1 vaga(s)" },
      geral: [
        {
          posicao: 1,
          analise_id: "a1",
          nome: "Ana",
          nota: 90,
          modalidades: ["AC"],
        },
        {
          posicao: 2,
          analise_id: "a2",
          nome: "Bia",
          nota: 80,
          modalidades: ["AC"],
        },
      ],
      listas: {},
      eliminados: [],
    },
  ],
};

const edital = (id: string) => ({
  edital: { id, edital: `${id}/2026` },
  pode_editar: true,
  configuracao: { roteiro: { id: "r1", nome: "Roteiro", versao: 1 } },
  regra_classificacao: { versao: 3, convocacao: { multiplo_vagas: 5 } },
  lista_convocacao: {
    lista: {
      id: `lista-${id}`,
      versao_regra: 3,
      gerada_em: "2026-11-05T12:00:00Z",
    },
    retrato: RETRATO,
  },
  convocados: [
    {
      id: "e1",
      analise_id: "a1",
      vaga: "V1",
      candidato: "Ana",
      avaliacoes: [],
    },
  ],
});

function bancoFalso() {
  const chamadas: { nome: string; argumentos?: Record<string, unknown> }[] = [];
  const respostas: Record<string, (a?: Record<string, unknown>) => unknown> = {
    listar_editais_entrevista: () => ({
      admin_global: false,
      editais: [
        { id: "E1", edital: "E1/2026", unidade: "CASAI Brasília" },
        { id: "E2", edital: "E2/2026", unidade: "CASAI Manaus" },
      ],
    }),
    obter_entrevistas_do_edital: (a) => edital(String(a?.["p_edital"])),
    obter_previsao_entrevista_edital: () => ({
      situacao: "PREVISTA",
      motivo: null,
      pode_alterar: false,
    }),
    obter_agenda_entrevista: () => null,
  };
  const cliente: ClienteDaConducao = {
    rpc: (nome, argumentos) => {
      chamadas.push({ nome, ...(argumentos ? { argumentos } : {}) });
      const responder = respostas[nome];
      return Promise.resolve(
        responder
          ? { data: responder(argumentos), error: null }
          : { data: null, error: { message: `sem ${nome}` } },
      );
    },
  };
  return { cliente, chamadas };
}

let desmontar: (() => void) | null = null;
afterEach(() => {
  desmontar?.();
  desmontar = null;
  registrarTelas({});
  document.body.replaceChildren();
  Reflect.deleteProperty(window, "navigate");
  vi.mocked(paginaDesligada).mockReturnValue(false);
});

async function montar({
  tipo = "entrevista" as TipoDaCentralDeConvocacoes,
  podeEntrevistas = true,
  podeClassificacao = true,
} = {}) {
  const { cliente, chamadas } = bancoFalso();
  const criar = vi.fn(() =>
    criarConducaoDeEntrevistas({
      supabase: cliente,
      toast: () => {},
      areaAtual: () => "saude-indigena",
      armazenamento: () => undefined,
    }),
  );
  registrarTelas({ "conduzir-entrevistas": { criar } });
  const elemento = document.createElement("div");
  document.body.append(elemento);
  // A tela de Conduzir entrevistas chega numa promessa: dentro do `act`.
  const desenho = await act(async () =>
    desenharNoTeste(
      elemento,
      createElement(CentralDeConvocacoes, {
        tipo,
        aoMudar: () => {},
        podeEntrevistas,
        podeClassificacao,
      }),
    ),
  );
  desmontar = desenho.desmontar;
  return { elemento, criar, chamadas };
}

const botoes = (raiz: Element) =>
  [...raiz.querySelectorAll("button.btn")].map((b) => b.textContent?.trim());

describe("Central de convocações: Para entrevistas", () => {
  it("mostra a lista da Classificação do edital aberto, sem marcar nem convocar", async () => {
    const { elemento, criar } = await montar();
    await esperar();
    await esperar();

    expect(criar).toHaveBeenCalledTimes(1);
    const bloco = elemento.querySelector(
      "[data-tour='central-convocacoes-entrevistas']",
    );
    expect(bloco).not.toBeNull();
    // Dois editais e nenhum lembrado: escolhe-se o edital.
    const select = elemento.querySelector("select");
    expect(select?.value).toBe("");
    expect(
      [...(select?.options ?? [])].map((o) => o.textContent).sort(),
    ).toEqual([
      "E1/2026 · CASAI Brasília",
      "E2/2026 · CASAI Manaus",
      "Escolha o edital…",
    ]);

    await escolher(select, "E1");
    await esperar();

    const linhas = [...elemento.querySelectorAll("tbody tr")].map((tr) =>
      tr.textContent?.replace(/\s+/g, " ").trim(),
    );
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toContain("Ana");
    expect(linhas[0]).toContain("Convocado");
    expect(linhas[1]).toContain("Bia");
    expect(linhas[1]).toContain("A convocar");
    expect(elemento.textContent).toContain(
      "Lista de convocação da Classificação",
    );
    // Só leitura: sem caixas, sem "Convocar selecionados" nem "Desconvocar".
    expect(elemento.querySelectorAll("input[type=checkbox]")).toHaveLength(0);
    expect(botoes(elemento)).not.toContain("Desconvocar");
    expect(
      botoes(elemento).some((b) => b?.startsWith("Convocar selecionados")),
    ).toBe(false);
    expect(botoes(elemento)).toEqual([
      "Convocar em Conduzir entrevistas",
      "Abrir listas da Classificação",
    ]);
  });

  it("o edital escolhido é o de Conduzir entrevistas (a mesma loja)", async () => {
    const { elemento, criar } = await montar();
    await esperar();
    await escolher(elemento.querySelector("select"), "E2");
    await esperar();
    const controlador = criar.mock.results[0]?.value as ReturnType<
      typeof criarConducaoDeEntrevistas
    >;
    expect(controlador.conducao.obter().editalId).toBe("E2");
    expect(controlador.conducao.obter().edital?.edital?.id).toBe("E2");
  });

  it("'Convocar em Conduzir entrevistas' abre Preparar sem trocar de edital", async () => {
    const navigate = vi.fn();
    Object.assign(window, { navigate });
    const { elemento } = await montar();
    await esperar();
    await escolher(elemento.querySelector("select"), "E1");
    await esperar();
    await clicar(
      [...elemento.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Convocar em Conduzir entrevistas",
      ),
    );
    expect(navigate).toHaveBeenCalledWith("conduzir-entrevistas", {
      visao: "preparar",
    });
  });

  it("sem acesso à Classificação, não oferece as listas dela", async () => {
    const { elemento } = await montar({ podeClassificacao: false });
    await esperar();
    expect(botoes(elemento)).not.toContain("Abrir listas da Classificação");
  });

  it("não baixa Conduzir entrevistas na contratação nem sem acesso às entrevistas", async () => {
    const naContratacao = await montar({ tipo: "contratacao" });
    await esperar();
    expect(naContratacao.criar).not.toHaveBeenCalled();
    expect(naContratacao.chamadas).toHaveLength(0);
    expect(
      naContratacao.elemento.querySelector(
        "[data-tour='central-convocacoes-entrevistas']",
      ),
    ).toBeNull();
    desmontar?.();

    const semAcesso = await montar({ podeEntrevistas: false });
    await esperar();
    expect(semAcesso.criar).not.toHaveBeenCalled();
    expect(semAcesso.elemento.textContent).toBe("");
  });

  it("se Conduzir entrevistas não abre, avisa e mantém o link antigo", async () => {
    const navigate = vi.fn();
    Object.assign(window, { navigate });
    const { elemento } = await montar();
    registrarTelas({});
    desmontar?.();
    const outro = document.createElement("div");
    document.body.append(outro);
    const desenho = await act(async () =>
      desenharNoTeste(
        outro,
        createElement(CentralDeConvocacoes, {
          tipo: "entrevista",
          aoMudar: () => {},
          podeEntrevistas: true,
          podeClassificacao: true,
        }),
      ),
    );
    desmontar = desenho.desmontar;
    await esperar();
    expect(elemento.textContent).toBe("");
    expect(outro.querySelector(".ui-aviso")?.textContent).toContain(
      "Não foi possível abrir a convocação para entrevistas",
    );
    await clicar(
      [...outro.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Abrir Convocação para entrevistas",
      ),
    );
    expect(navigate).toHaveBeenCalledWith("conduzir-entrevistas");
  });

  it("Conduzir entrevistas desligada na área: a central não oferece as entrevistas", async () => {
    // StrictMode desenha duas vezes: vale para as duas (o afterEach volta a ligar).
    vi.mocked(paginaDesligada).mockReturnValue(true);
    let ligada: boolean | null = null;
    function Sonda() {
      ligada = usarConducaoLigada();
      return null;
    }
    const elemento = document.createElement("div");
    document.body.append(elemento);
    const desenho = await act(async () =>
      desenharNoTeste(elemento, createElement(Sonda)),
    );
    desmontar = desenho.desmontar;
    expect(ligada).toBe(false);
    expect(vi.mocked(paginaDesligada)).toHaveBeenLastCalledWith(
      expect.objectContaining({ view: "conduzir-entrevistas" }),
    );
  });
});
