import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MARCA_SEM_VALOR_OFICIAL,
  editalEscolhido,
  ehEditalDeTreinamento,
  semTreinamento,
  sufixoDeTreinamento,
} from "../src/lib/edital-de-treinamento.js";
import {
  normalizarPainel,
  opcoesDosEditais,
} from "../src/lib/painel-dos-robos.ts";
import { documentoOficial } from "../src/lib/classificacao/documento-sei.js";
import {
  instantaneoDaLista,
  nomeDoArquivo,
} from "../src/lib/classificacao/exportacao.js";
import { editaisParaConduzir } from "../src/lib/conducao-de-entrevista.js";
import { editaisDaEscolha } from "../src/lib/avaliacao-documental/editais.js";
import { indicadoresDaVisaoGeral } from "../src/lib/visao-geral.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";
import { COLUNAS_DO_MONITORAMENTO } from "../src/app/carga.js";

/*
  O edital de treinamento (migration 20261007230000): fora da Visão geral,
  indicadores, painéis e robôs no modo padrão; com o selo "Treinamento" nas
  telas operacionais; documento oficial com "TREINAMENTO — SEM VALOR OFICIAL".
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");

const REAL = {
  id: "r1",
  edital: "93/2026",
  unidade: "DSEI Manaus",
  status: "Em andamento",
  ativo: true,
  vagas_total: 10,
  contratados: 4,
  vagas_ociosas: 6,
  CO_AREA: "saude-indigena",
  ST_TREINAMENTO: "N",
};
const TREINO = {
  id: "t1",
  edital: "Treinamento – Saúde Indígena (991/2099)",
  unidade: "DSEI Treinamento",
  status: "Em andamento",
  ativo: true,
  vagas_total: 7,
  contratados: 0,
  vagas_ociosas: 7,
  CO_AREA: "saude-indigena",
  ST_TREINAMENTO: "S",
};

describe("o predicado do front", () => {
  it("reconhece a marca da linha (ST_TREINAMENTO) e a das RPCs (treinamento)", () => {
    expect(ehEditalDeTreinamento(TREINO)).toBe(true);
    expect(ehEditalDeTreinamento({ treinamento: true })).toBe(true);
    expect(ehEditalDeTreinamento({ st_treinamento: "s" })).toBe(true);
    for (const outro of [REAL, { treinamento: false }, {}, null, "S"])
      expect(ehEditalDeTreinamento(outro)).toBe(false);
  });

  it("semTreinamento tira só o de treinamento (e devolve a mesma lista sem ele)", () => {
    const linhas = [REAL, TREINO];
    expect(semTreinamento(linhas)).toEqual([REAL]);
    const soReais = [REAL];
    expect(semTreinamento(soReais)).toBe(soReais);
    expect(semTreinamento(null)).toEqual([]);
  });

  it("sufixo do seletor e edital escolhido", () => {
    expect(sufixoDeTreinamento({ treinamento: true })).toBe(" · Treinamento");
    expect(sufixoDeTreinamento(REAL)).toBe("");
    expect(editalEscolhido([REAL, TREINO], "t1")).toBe(TREINO);
    expect(editalEscolhido([REAL], "")).toBeNull();
  });

  it("a coluna vem na carga do monitoramento", () => {
    expect(COLUNAS_DO_MONITORAMENTO.split(",")).toContain("ST_TREINAMENTO");
  });
});

describe("fora dos indicadores e da Visão geral", () => {
  it("os indicadores da Visão geral, sobre as linhas sem treinamento, não contam o edital", () => {
    const com = indicadoresDaVisaoGeral([REAL, TREINO]);
    const sem = indicadoresDaVisaoGeral(semTreinamento([REAL, TREINO]));
    expect(sem).toEqual(indicadoresDaVisaoGeral([REAL]));
    expect(sem).not.toEqual(com);
  });

  it("a Visão geral, as boas-vindas e os indicadores de Editais aplicam o predicado", () => {
    expect(ler("src/modulos/visao-geral/estado.ts")).toContain(
      "semTreinamento(linhasDaArea(linhasDaResposta(linhas), areaAtual))",
    );
    expect(ler("src/modulos/visao-geral/boas-vindas.tsx")).toContain(
      "semTreinamento(linhasDaArea(linhasDaResposta(linhas), areaAtual))",
    );
    expect(ler("src/modulos/editais/nucleo.jsx")).toContain(
      "resumoDasLinhas(doResumo.resumo, semTreinamento(linhas))",
    );
  });
});

describe("robôs: só quando pedido", () => {
  const painel = normalizarPainel({
    areas: [{ area: "saude-indigena", nome: "Saúde Indígena" }],
    editais: [
      { ...REAL, numero: "93/2026", area: "saude-indigena" },
      {
        ...TREINO,
        numero: "991/2099",
        area: "saude-indigena",
        treinamento: true,
      },
    ],
  });

  it("o de treinamento não está entre os vigentes; com 'mostrar todos' vem com o rótulo", () => {
    expect(opcoesDosEditais(painel.editais, painel.areas).opcoes).toEqual([
      { value: "r1", label: "93/2026 · DSEI Manaus (Saúde Indígena)" },
    ]);
    expect(
      opcoesDosEditais(painel.editais, painel.areas, { todos: true }).opcoes,
    ).toContainEqual({
      value: "t1",
      label: "991/2099 · DSEI Treinamento (Saúde Indígena) · Treinamento",
    });
  });
});

describe("telas operacionais: aparece, com a marca", () => {
  it("Entrevistas › Conduzir leva a marca do edital", () => {
    const [treino] = editaisParaConduzir(
      [{ id: "t1", edital: TREINO.edital, treinamento: true }],
      [],
    );
    expect(treino.treinamento).toBe(true);
    expect(
      editaisParaConduzir([{ id: "r1", edital: "93/2026" }], [])[0].treinamento,
    ).toBe(false);
  });

  it("Avaliação documental: o de treinamento (em andamento) está entre os vigentes", () => {
    expect(
      editaisDaEscolha([{ ...TREINO, treinamento: true }]).lista,
    ).toHaveLength(1);
  });

  it("as três telas mostram o selo no seletor e no topo", () => {
    for (const arquivo of [
      "src/modulos/entrevistas/conducao.jsx",
      "src/modulos/avaliacao-documental/avaliacao-documental.jsx",
      "src/modulos/classificacao/classificacao.jsx",
    ]) {
      const fonte = ler(arquivo);
      expect(fonte, arquivo).toContain("<SeloDeTreinamento");
      expect(fonte, arquivo).toContain("sufixoDeTreinamento(");
    }
  });
});

describe("documento oficial do treinamento", () => {
  const retrato = (edital) => ({
    schema: 1,
    tipo: "CONVOCACAO",
    edital,
    casas: 2,
    modalidades: [],
    vagas: [
      {
        chave: "9909910001",
        codigo: "9909910001",
        cabecalho: "Vaga 9909910001 — Enfermeiro",
        geral: [
          {
            posicao: 1,
            nome: "Candidato Teste 01",
            nota: 82.5,
            modalidades: [],
          },
        ],
        listas: {},
        eliminados: [],
      },
    ],
  });

  it("título e nome com a marca; edital real sem a marca", () => {
    const doc = documentoOficial(
      retrato({ id: "t1", edital: TREINO.edital, treinamento: true }),
      { regra: {}, hoje: new Date("2026-10-07T12:00:00Z") },
    );
    expect(doc.titulo[0]).toBe(`**${MARCA_SEM_VALOR_OFICIAL}**`);
    expect(doc.nome.startsWith("TREINAMENTO - ")).toBe(true);
    expect(doc.treinamento).toBe(true);
    const real = documentoOficial(retrato({ id: "r1", edital: "93/2026" }), {
      regra: {},
      hoje: new Date("2026-10-07T12:00:00Z"),
    });
    expect(real.titulo.join(" ")).not.toContain("TREINAMENTO");
    expect(real.treinamento).toBe(false);
  });

  it("a opção explícita vale mesmo com retrato sem a marca", () => {
    const doc = documentoOficial(retrato({ id: "t1", edital: TREINO.edital }), {
      regra: {},
      treinamento: true,
    });
    expect(doc.titulo[0]).toContain(MARCA_SEM_VALOR_OFICIAL);
  });

  it("o retrato só ganha a marca no treinamento e o arquivo começa com 'treinamento'", () => {
    const resultado = {
      tipo: "CONVOCACAO",
      casas: 2,
      vagas: [],
      avisos: [],
      pendencias: [],
      totais: {},
    };
    const treino = instantaneoDaLista(resultado, {
      edital: { id: "t1", edital: TREINO.edital, treinamento: true },
      regra: {},
    });
    const real = instantaneoDaLista(resultado, {
      edital: { id: "r1", edital: "93/2026" },
      regra: {},
    });
    expect(treino.edital.treinamento).toBe(true);
    expect(real.edital).not.toHaveProperty("treinamento");
    expect(nomeDoArquivo(treino)).toMatch(/^treinamento-classificacao-/);
    expect(nomeDoArquivo(real)).toMatch(/^classificacao-/);
  });
});

describe("contrato", () => {
  it("reiniciar_edital_treinamento está no contrato de RPC", () => {
    expect(CONTRATO_RPC.reiniciar_edital_treinamento?.argumentos).toEqual([
      "p_edital",
    ]);
  });
});
