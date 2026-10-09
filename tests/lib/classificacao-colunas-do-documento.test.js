import { describe, expect, it } from "vitest";
import {
  colunasDisponiveis,
  colunasEscolhidas,
  colunasPadrao,
  colunasParaGuardar,
  ehOPadrao,
} from "../../src/lib/classificacao/colunas-do-documento.js";

/*
  As colunas das tabelas do documento oficial que o gestor escolhe em "Como
  fica no SEI": o padrão enxuto, as disponíveis conforme o retrato e o que
  vai para a regra do edital.
*/
const retrato = (tipo, extra = {}) => ({
  tipo,
  modalidades: [{ codigo: "PCD", nome: "Pessoas com Deficiência" }],
  parciais: ["FORMACAO", "CURSOS"],
  vagas: [{ eliminados: [{ nome: "X", nota: 1 }] }],
  ...extra,
});
const ids = (colunas) => colunas.map((c) => c.id);

describe("colunas do documento oficial", () => {
  it("padrão enxuto por publicação; a convocação é fixa", () => {
    expect(colunasPadrao("PRELIMINAR_PRELIMINAR")).toEqual([
      "CLASSIFICACAO",
      "NOME",
      "MODALIDADE",
      "NOTA",
    ]);
    expect(colunasPadrao("ENTREVISTA_FINAL")).toEqual([
      "CLASSIFICACAO",
      "NOME",
      "NOTA",
    ]);
    expect(colunasPadrao("FINAL_FINAL_ELIMINADOS")).toEqual([
      "NOME",
      "NOTA",
      "JUSTIFICATIVA",
    ]);
    expect(colunasPadrao("CONVOCACAO")).toBeNull();
  });

  it("disponíveis: modalidade só com todas as listas; parciais só na documental; situação no final", () => {
    expect(ids(colunasDisponiveis(retrato("PRELIMINAR"), "todas"))).toEqual([
      "CLASSIFICACAO",
      "NOME",
      "MODALIDADE",
      "NOTA",
      "PARCIAL_FORMACAO",
      "PARCIAL_CURSOS",
    ]);
    expect(ids(colunasDisponiveis(retrato("PRELIMINAR"), "geral"))).toEqual([
      "CLASSIFICACAO",
      "NOME",
      "NOTA",
      "PARCIAL_FORMACAO",
      "PARCIAL_CURSOS",
    ]);
    expect(ids(colunasDisponiveis(retrato("FINAL"), "geral"))).toEqual([
      "CLASSIFICACAO",
      "NOME",
      "NOTA",
      "SITUACAO",
    ]);
    expect(
      ids(colunasDisponiveis(retrato("PRELIMINAR"), "eliminados")),
    ).toEqual([
      "NOME",
      "NOTA",
      "PARCIAL_FORMACAO",
      "PARCIAL_CURSOS",
      "JUSTIFICATIVA",
    ]);
    expect(colunasDisponiveis(retrato("CONVOCACAO"), "todas")).toBeNull();
    const [classificacao, nome, , nota] = colunasDisponiveis(
      retrato("PRELIMINAR"),
      "todas",
    );
    expect(classificacao.obrigatoria && nome.obrigatoria).toBe(true);
    expect(nota).toMatchObject({ rotulo: "Nota Final", obrigatoria: false });
  });

  it("escolhidas: as guardadas que a lista tem, com as obrigatórias", () => {
    const disponiveis = colunasDisponiveis(retrato("PRELIMINAR"), "geral");
    const chave = "PRELIMINAR_PRELIMINAR";
    expect(colunasEscolhidas(disponiveis, undefined, chave)).toEqual([
      "CLASSIFICACAO",
      "NOME",
      "NOTA",
    ]);
    expect(
      colunasEscolhidas(disponiveis, ["PARCIAL_CURSOS", "NOME"], chave),
    ).toEqual(["CLASSIFICACAO", "PARCIAL_CURSOS", "NOME"]);
  });

  it("guardar: mantém a Modalidade (que a lista geral não tem) no lugar dela", () => {
    const disponiveis = colunasDisponiveis(retrato("PRELIMINAR"), "geral");
    const chave = "PRELIMINAR_PRELIMINAR";
    expect(
      colunasParaGuardar(
        ["CLASSIFICACAO", "NOME", "NOTA", "PARCIAL_FORMACAO"],
        disponiveis,
        undefined,
        chave,
      ),
    ).toEqual([
      "CLASSIFICACAO",
      "NOME",
      "MODALIDADE",
      "NOTA",
      "PARCIAL_FORMACAO",
    ]);
    expect(
      ehOPadrao(
        colunasParaGuardar(
          ["CLASSIFICACAO", "NOME", "NOTA"],
          disponiveis,
          undefined,
          chave,
        ),
        chave,
      ),
    ).toBe(true);
    expect(ehOPadrao(["NOME", "CLASSIFICACAO"], chave)).toBe(false);
    expect(ehOPadrao(undefined, chave)).toBe(true);
  });
});
