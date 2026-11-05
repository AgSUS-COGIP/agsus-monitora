import { describe, expect, it } from "vitest";
import {
  acoesDaPessoa,
  chaveDasPessoas,
  FILTRO_DAS_PESSOAS_INICIAL,
  filtrosDasPessoasEmUso,
  gruposDaSituacao,
  normalizarFiltroDasPessoas,
  recorteDasPessoas,
} from "../../src/lib/avaliacao-documental/pessoas-da-triagem.ts";

/*
  A aba Pessoas da Triagem (pessoas-da-triagem.ts): o filtro guardado na
  sessão, o que ele pede ao banco e as ações de cada pessoa.
*/

describe("filtro da aba Pessoas", () => {
  it("o guardado volta no formato de agora; o que não serve vira o padrão", () => {
    expect(normalizarFiltroDasPessoas(null)).toEqual(
      FILTRO_DAS_PESSOAS_INICIAL,
    );
    expect(
      normalizarFiltroDasPessoas({
        busca: "maria",
        vaga: 179698,
        situacao: "ELIMINADOS",
        sobra: true,
      }),
    ).toEqual({ busca: "maria", vaga: "179698", situacao: "ELIMINADOS" });
    expect(normalizarFiltroDasPessoas({ situacao: "QUALQUER" }).situacao).toBe(
      "TODAS",
    );
    expect(
      normalizarFiltroDasPessoas({ busca: "x".repeat(500) }).busca,
    ).toHaveLength(120);
  });

  it("conta a busca, a vaga e a situação diferente de Todas", () => {
    expect(filtrosDasPessoasEmUso(FILTRO_DAS_PESSOAS_INICIAL)).toBe(0);
    expect(
      filtrosDasPessoasEmUso({ busca: "  ", vaga: "", situacao: "TODAS" }),
    ).toBe(0);
    expect(
      filtrosDasPessoasEmUso({
        busca: "ana",
        vaga: "179698",
        situacao: "PODE_INCLUIR",
      }),
    ).toBe(3);
  });

  it("a chave é por edital; sem edital, nada se guarda", () => {
    expect(chaveDasPessoas("e93")).toBe("monitora:triagem:pessoas:e93");
    expect(chaveDasPessoas("")).toBe("");
  });

  it("Todas pede classificados e eliminados; o recorte leva a vaga e a busca aparada", () => {
    expect(gruposDaSituacao("TODAS")).toEqual(["CLASSIFICADOS", "ELIMINADOS"]);
    expect(gruposDaSituacao("PODE_INCLUIR")).toEqual(["PODE_INCLUIR"]);
    expect(
      recorteDasPessoas(
        { busca: " ana ", vaga: "", situacao: "TODAS" },
        "ELIMINADOS",
      ),
    ).toEqual({ vaga: null, grupo: "ELIMINADOS", busca: "ana" });
    expect(
      recorteDasPessoas(
        { busca: "digitando", vaga: "179698", situacao: "TODAS" },
        "CLASSIFICADOS",
        "di",
      ),
    ).toEqual({ vaga: "179698", grupo: "CLASSIFICADOS", busca: "di" });
  });
});

describe("ações de cada pessoa", () => {
  const coordena = { podeCoordenar: true };
  it("eliminado com motivo: o comunicado é a principal; incluir vai ao ⋯", () => {
    expect(
      acoesDaPessoa(
        { situacao: "ELIMINADO", motivo: "Cancelou", motivo_codigo: "CANC" },
        coordena,
      ),
    ).toEqual({
      principal: "comunicado",
      outras: ["incluir", "ver-vaga", "copiar"],
    });
  });

  it("quem saiu da Empregare não entra por decisão; sem motivo, sem comunicado", () => {
    expect(
      acoesDaPessoa(
        {
          situacao: "ELIMINADO",
          motivo: "",
          motivo_codigo: "SAIU_DA_EMPREGARE",
        },
        coordena,
      ),
    ).toEqual({ principal: null, outras: ["ver-vaga", "copiar"] });
  });

  it("fora do lote: incluir é a principal; no lote por decisão, revogar no ⋯", () => {
    expect(acoesDaPessoa({ situacao: "RANQUEADO" }, coordena)).toEqual({
      principal: "incluir",
      outras: ["ver-vaga", "copiar"],
    });
    expect(
      acoesDaPessoa(
        {
          situacao: "NO_LOTE",
          entrada: "DECISAO",
          decisao: { motivo: "Critério CORES" },
        },
        coordena,
      ),
    ).toEqual({ principal: null, outras: ["revogar", "ver-vaga", "copiar"] });
    expect(acoesDaPessoa({ situacao: "NO_LOTE" }, coordena)).toEqual({
      principal: null,
      outras: ["ver-vaga", "copiar"],
    });
  });

  it("quem não coordena não inclui nem revoga", () => {
    expect(
      acoesDaPessoa({ situacao: "RANQUEADO" }, { podeCoordenar: false }),
    ).toEqual({ principal: null, outras: ["ver-vaga", "copiar"] });
    expect(
      acoesDaPessoa(
        { situacao: "NO_LOTE", decisao: { motivo: "Critério CORES" } },
        { podeCoordenar: false },
      ).outras,
    ).not.toContain("revogar");
  });
});
