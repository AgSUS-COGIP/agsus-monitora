import { describe, expect, it } from "vitest";
import {
  marcaDaImportacao,
  normalizarPrevia,
  parciaisDaMarca,
  resumoDaImportacao,
  semMarcaDaImportacao,
} from "../../src/lib/avaliacao-documental/importacao-da-planilha.ts";
import { lancamentoInicial } from "../../src/lib/avaliacao-documental/ficha.ts";

/*
  A importação da avaliação da planilha (fase F8, 16/11/2026): a prévia que a
  coordenação vê e a marca da ficha importada. O banco faz a importação
  (20261116233000_importar_avaliacao_da_planilha; o ensaio confere o 93/2026).
*/

describe("prévia da importação", () => {
  it("o 93/2026: 60 aprovados e 34 reprovados, 2 fichas saem do lote", () => {
    const r = resumoDaImportacao(
      normalizarPrevia({
        aprovados: 60,
        reprovados: 34,
        em_aberto: 0,
        saem_do_lote: 2,
        analista_sem_cadastro: 0,
        problemas: {},
        origem: "PLANILHA",
      }),
    );
    expect(r).toEqual({
      importa: true,
      pode: true,
      linhas: [
        "60 aprovados e 34 reprovados viram fichas concluídas, com o resultado, a nota, o parecer e a data da planilha.",
        "2 fichas sem análise na planilha saem do lote.",
      ],
      problemas: [],
    });
  });

  it("problema trava a importação e diz o que resolver, no singular e no plural", () => {
    const r = resumoDaImportacao(
      normalizarPrevia({
        aprovados: 1,
        reprovados: 0,
        problemas: { EM_REVISAO: 1, SEM_PARECER: 3, NOVO: 2 },
      }),
    );
    expect(r.importa).toBe(true);
    expect(r.pode).toBe(false);
    expect(r.linhas[0]).toBe(
      "1 aprovado e 0 reprovados viram fichas concluídas, com o resultado, a nota, o parecer e a data da planilha.",
    );
    expect(r.problemas).toEqual([
      "1 análise em revisão na planilha (termine a revisão lá)",
      "3 análises decididas sem parecer",
      "2 casos que impedem (NOVO)",
    ]);
  });

  it("sem análise decidida na planilha, a troca é a simples", () => {
    const r = resumoDaImportacao(normalizarPrevia({ em_aberto: 5 }));
    expect(r.importa).toBe(false);
    expect(r.pode).toBe(false);
  });

  it("resposta vazia ou estranha vira zeros", () => {
    expect(normalizarPrevia(null)).toEqual({
      aprovados: 0,
      reprovados: 0,
      em_aberto: 0,
      saem_do_lote: 0,
      analista_sem_cadastro: 0,
      problemas: {},
      origem: "PLANILHA",
    });
    expect(
      normalizarPrevia({ aprovados: "x", problemas: { A: 0, B: -1, C: 2 } })
        .problemas,
    ).toEqual({ C: 2 });
  });

  it("analista sem cadastro e análise em aberto aparecem na prévia", () => {
    const r = resumoDaImportacao(
      normalizarPrevia({
        aprovados: 2,
        reprovados: 1,
        analista_sem_cadastro: 1,
        em_aberto: 3,
      }),
    );
    expect(r.linhas).toContain(
      "1 análise tem analista sem cadastro no Yeendé: a ficha fica em nome de quem importa, e o nome da planilha continua no painel.",
    );
    expect(r.linhas).toContain("3 análises em aberto continuam na fila.");
  });
});

describe("marca da ficha importada", () => {
  const lancamento = {
    importada_da_planilha: {
      linha: "6c0d…",
      versao: 3,
      em: "2026-11-16T23:40:00+00:00",
      status: "Aprovado",
      responsavel: "Ana Analista",
      data: "2026-10-06",
      nota_final: 52.5,
      parciais: { FORMACAO: 20, EXPERIENCIA: 32.5, CURSOS: null },
      modalidade: "Ampla concorrência",
      link_pdf: "https://drive.google.com/x",
    },
  };

  it("lê a marca e as parciais na ordem da nota", () => {
    const m = marcaDaImportacao(lancamento)!;
    expect(m).toMatchObject({
      status: "Aprovado",
      responsavel: "Ana Analista",
      data: "2026-10-06",
      nota: 52.5,
      modalidade: "Ampla concorrência",
      link: "https://drive.google.com/x",
    });
    expect(parciaisDaMarca(m)).toEqual([
      { codigo: "FORMACAO", rotulo: "Escolaridade", valor: "20,00" },
      {
        codigo: "EXPERIENCIA",
        rotulo: "Experiência profissional",
        valor: "32,50",
      },
    ]);
  });

  it("ficha comum não tem marca; link que não é https não vira botão", () => {
    expect(marcaDaImportacao({ blocos: {} })).toBeNull();
    expect(marcaDaImportacao(null)).toBeNull();
    expect(marcaDaImportacao({ importada_da_planilha: [] })).toBeNull();
    expect(
      marcaDaImportacao({
        importada_da_planilha: { link_pdf: "javascript:alert(1)" },
      })!.link,
    ).toBe("");
  });

  it("reaberta, a marca não volta a ser gravada (o lançamento inicial a tira)", () => {
    expect(semMarcaDaImportacao(lancamento)).toEqual({});
    const comum = { blocos: { A: {} } };
    expect(semMarcaDaImportacao(comum)).toBe(comum);
    const inicial = lancamentoInicial({
      regra: { blocos: [] },
      respostas: {},
      gravado: lancamento as never,
    }) as Record<string, unknown>;
    expect(inicial).not.toHaveProperty("importada_da_planilha");
  });
});
