import { describe, expect, it } from "vitest";
import { expandirCandidatosCompactos } from "../../src/lib/candidatos-aprovados-compactos.ts";
import {
  STATUS_DO_CANDIDATO,
  matriculaNormalizada,
  outrasLinhasContratadasDaMatricula,
  statusEfetivo,
  statusGuardaMatricula,
  summarizeApprovedCandidates,
  tomDoStatus,
} from "../../src/lib/lista-aprovados-rules.ts";
import {
  estaForaDaFila,
  jaFoiChamado,
  statusNaFila,
} from "../../src/lib/lista-convocacao-rules.ts";

/*
  "Contratado em outra lista" (migration 20261024120000): o status explícito
  (fixado pela equipe) e a situação que o job Python decide e o pacote da
  Lista de aprovados traz no dicionário `contratacao`. Dados fictícios.
*/
const linha = (extra) => ({
  candidato_id: "c",
  edital_id: "e1",
  status: "Contratado",
  matricula: "M-1",
  ...extra,
});

describe("o pacote traz a situação decidida pelo job", () => {
  it("dicionário contratacao vira contratacao_situacao e contratacao_motivo só nas linhas decididas", () => {
    const pacote = {
      colunas: ["candidato_id", "lista_id", "status"],
      colunas_da_lista: ["lista_id", "edital_id"],
      listas: [["L1", "e1"]],
      dicionarios: {
        status: ["Contratado"],
        contratacao: { b: ["OUTRA_LISTA", "Motivo."] },
      },
      linhas: [
        ["a", 0, 0],
        ["b", 0, 0],
      ],
    };
    const [a, b] = expandirCandidatosCompactos(pacote);
    expect(a).not.toHaveProperty("contratacao_situacao");
    expect(b).toMatchObject({
      status: "Contratado",
      contratacao_situacao: "OUTRA_LISTA",
      contratacao_motivo: "Motivo.",
    });
  });
});

describe("regras da tela", () => {
  it("o status efetivo: explícito, decidido pelo sistema ou o gravado", () => {
    expect(statusEfetivo(linha({ status: "Contratado em outra lista" }))).toBe(
      "Contratado em outra lista",
    );
    expect(statusEfetivo(linha({ contratacao_situacao: "OUTRA_LISTA" }))).toBe(
      "Contratado em outra lista",
    );
    expect(statusEfetivo(linha({ contratacao_situacao: "AMBIGUO" }))).toBe(
      "Contratado",
    );
    // Só vale sobre Contratado: com outro status gravado, a decisão antiga não pesa.
    expect(
      statusEfetivo(
        linha({ status: "Desistente", contratacao_situacao: "OUTRA_LISTA" }),
      ),
    ).toBe("Desistente");
  });

  it("não conta nos contratados: tem contagem própria", () => {
    const resumo = summarizeApprovedCandidates([
      linha({ candidato_id: "1" }),
      linha({ candidato_id: "2", contratacao_situacao: "OUTRA_LISTA" }),
      linha({ candidato_id: "3", status: "Contratado em outra lista" }),
    ]);
    expect(resumo).toMatchObject({
      total: 3,
      contratado: 1,
      contratadoEmOutraLista: 2,
    });
  });

  it("o status novo é opção da tela, guarda a matrícula sem exigi-la e tem tom neutro", () => {
    expect(STATUS_DO_CANDIDATO).toContain("Contratado em outra lista");
    expect(statusGuardaMatricula("Contratado em outra lista")).toBe(true);
    expect(tomDoStatus("Contratado em outra lista")).toBe("neutral");
  });

  it("a sugestão acha a mesma matrícula Contratado em outra linha do edital", () => {
    expect(matriculaNormalizada(" 00.12-3a ")).toBe("123A");
    const atual = linha({ candidato_id: "a", status: "" });
    const outras = outrasLinhasContratadasDaMatricula(
      [
        atual,
        linha({ candidato_id: "b", matricula: "0123a" }),
        linha({ candidato_id: "c", matricula: "123A", edital_id: "e2" }),
        linha({ candidato_id: "d", matricula: "123A", status: "Desistente" }),
        linha({
          candidato_id: "e",
          matricula: "123A",
          contratacao_situacao: "OUTRA_LISTA",
        }),
      ],
      atual,
      "123-a",
    );
    expect(outras.map((o) => o.candidato_id)).toEqual(["b"]);
    expect(outrasLinhasContratadasDaMatricula([atual], atual, "")).toEqual([]);
  });
});

describe("convocação: não ocupa vaga", () => {
  it("explícito ou decidido pelo sistema, sai da fila", () => {
    for (const candidato of [
      linha({ status: "Contratado em outra lista" }),
      linha({ contratacao_situacao: "OUTRA_LISTA" }),
    ]) {
      expect(statusNaFila(candidato)).toBe("Contratado em outra lista");
      expect(estaForaDaFila(candidato)).toBe(true);
      expect(jaFoiChamado(candidato)).toBe(false);
    }
    const contratacao = linha({ contratacao_situacao: "CONTRATACAO" });
    expect(estaForaDaFila(contratacao)).toBe(false);
    expect(jaFoiChamado(contratacao)).toBe(true);
  });
});
