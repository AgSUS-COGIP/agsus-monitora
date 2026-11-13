import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cicloPadronizado,
  numeroDoCiclo,
  opcoesDeCiclo,
} from "../src/lib/ciclo-do-edital.ts";
import { editalParaSalvar } from "../src/lib/editais-do-nucleo.ts";
import {
  acompanhamentoDaResposta,
  COLUNAS_DA_TABELA,
  COLUNAS_INICIAIS,
  csvDaVisaoGeral,
  enriquecerLinhas,
  filtrosVazios,
  valorParaOrdenar,
} from "../src/lib/visao-geral.ts";

/*
  A 1ª E A ÚLTIMA ADMISSÃO E O CICLO NA VISÃO GERAL (pedido de 13/11/2026)

  "Precisa ter mais uma coluna de data de admissão" e "os editais tiveram
  ciclos". As admissões vêm conciliadas com o RH (TB_ADMISSAO_CONCILIADA,
  migration 20261113210000), por edital: a 1ª e a última. O ciclo estava
  escrito de vários jeitos no banco e voltou ao formulário do edital. Dados
  fictícios.
*/

const resposta = {
  etapas: [],
  listas: [],
  admissoes: [
    {
      monitoramento_id: "e1",
      primeira: "2025-05-12",
      ultima: "2026-06-11",
      quantidade: 111,
    },
    { monitoramento_id: "e3", primeira: null, ultima: null, quantidade: 0 },
  ],
};

const linhas = [
  { id: "e1", edital: "04/2025", ciclo: "1º CICLO", status: "Concluído" },
  { id: "e2", edital: "70/2025", ciclo: "", status: "Concluído" },
  { id: "e3", edital: "05/2026", ciclo: "4", status: "Concluído" },
];

describe("ciclo do edital", () => {
  it("padroniza como 'Nº ciclo' e deixa o vazio vazio", () => {
    expect(
      ["1º CICLO", "4", "4º", " 5º ", "2º ciclo"].map(cicloPadronizado),
    ).toEqual(["1º ciclo", "4º ciclo", "4º ciclo", "5º ciclo", "2º ciclo"]);
    expect(cicloPadronizado("")).toBe("");
    expect(cicloPadronizado(null)).toBe("");
    expect(cicloPadronizado("Piloto")).toBe("Piloto");
    expect(numeroDoCiclo("3º ciclo")).toBe(3);
    expect(numeroDoCiclo("")).toBeNull();
  });

  it("o formulário oferece do 1º ao 9º ciclo e mantém um valor de fora", () => {
    expect(opcoesDeCiclo()).toHaveLength(9);
    expect(opcoesDeCiclo("12")).toContain("12º ciclo");
    expect(opcoesDeCiclo("Piloto").at(-1)).toBe("Piloto");
  });

  it("o edital sai para o banco com o ciclo padronizado", () => {
    const payload = editalParaSalvar(
      {
        id: "",
        processo: "",
        edital: "01/2026",
        responsavel: "",
        unidade: "",
        unidadeNova: "",
        idUnidade: "",
        siglaUnidade: "",
        tipoUnidade: "",
        uf: "",
        ciclo: "3",
        link: "",
        vagas: "0",
        dataInicio: "",
        dataFim: "",
        status: "",
        etapa: "",
        risco: "Baixo",
        observacoes: "",
        observacoesInternas: "",
      },
      null,
      { automatico: false, etapas: [] },
      { status: "", etapa: "" },
    );
    expect(payload.ciclo).toBe("3º ciclo");
  });

  it("o formulário do edital tem o campo Ciclo", () => {
    const tela = readFileSync(
      "src/modulos/editais/modal-do-edital.tsx",
      "utf8",
    );
    expect(tela).toContain('<Campo rotulo="Ciclo">');
    expect(tela).toContain("opcoesDeCiclo(formulario.ciclo)");
  });
});

describe("admissões e ciclo na Visão geral", () => {
  const acompanhamento = acompanhamentoDaResposta(resposta);
  const enriquecidas = enriquecerLinhas(linhas, {
    hoje: "2026-11-13",
    acompanhamento,
  });
  const comAdmissao = enriquecidas[0]!;
  const semAdmissao = enriquecidas[1]!;
  const semDatas = enriquecidas[2]!;

  it("a linha recebe a 1ª e a última admissão; sem admissão, nulas", () => {
    expect(comAdmissao).toMatchObject({
      primeira_admissao: "2025-05-12",
      ultima_admissao: "2026-06-11",
      admissoes: 111,
      ciclo: "1º ciclo",
    });
    expect(semAdmissao).toMatchObject({
      primeira_admissao: null,
      ultima_admissao: null,
      admissoes: 0,
      ciclo: "",
    });
    // Registro sem datas não vale como admissão.
    expect(semDatas).toMatchObject({
      primeira_admissao: null,
      ciclo: "4º ciclo",
    });
  });

  it("Ciclo, 1ª e Última admissão são colunas padrão; Ciclo é filtro", () => {
    const campos = COLUNAS_DA_TABELA.map((c) => c.campo);
    expect(campos.indexOf("ciclo")).toBe(campos.indexOf("edital") + 1);
    expect(campos.indexOf("primeira_admissao")).toBe(
      campos.indexOf("contratados") + 1,
    );
    expect(campos.indexOf("ultima_admissao")).toBe(
      campos.indexOf("primeira_admissao") + 1,
    );
    for (const campo of ["ciclo", "primeira_admissao", "ultima_admissao"])
      expect(COLUNAS_INICIAIS).toContain(campo);
    expect(Object.keys(filtrosVazios())).toContain("ciclo");
  });

  it("ordena o ciclo pelo número e as admissões pela data", () => {
    expect(valorParaOrdenar(comAdmissao, "ciclo")).toBe(1);
    expect(valorParaOrdenar(semAdmissao, "ciclo")).toBe(-1);
    expect(valorParaOrdenar(comAdmissao, "primeira_admissao")).toBe(
      Date.parse("2025-05-12"),
    );
    expect(valorParaOrdenar(semAdmissao, "ultima_admissao")).toBe(0);
  });

  it("o arquivo exportado leva as admissões", () => {
    const [cabecalho, linha] = csvDaVisaoGeral([comAdmissao]).split(/\r?\n/);
    expect(cabecalho).toContain(
      '"Primeira Admissão";"Última Admissão";"Admissões Conciliadas com o RH"',
    );
    expect(linha).toContain('"2025-05-12";"2026-06-11";"111"');
    expect(linha).toContain('"1º ciclo"');
  });
});
