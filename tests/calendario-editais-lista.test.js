import { describe, expect, it } from "vitest";
import {
  cabecalhoDoDiaDaLista,
  chaveDoDia,
  chavesDaSemana,
  contarEtapasNoIntervalo,
  corDaUnidade,
  diasDaLista,
  emAndamentoNoDia,
  etapasAtivasNoDia,
  inicioDaSemana,
  intervaloDoMes,
  marcaNoDia,
  montarEtapasDosEditais,
  rotuloDaSemana,
  visaoInicial,
} from "../src/lib/calendario-editais.ts";

/*
  As regras das vistas Lista e Semana do Cronograma. As etapas passam pelo
  mesmo parser da carga (`montarEtapasDosEditais`), para os testes verem as
  datas como a tela as vê — inclusive as que chegam como timestamp.
*/

const EDITAL = { id: 1, unidade: "DSEI Yanomami", edital: "20/2026" };
const etapas = (...brutas) =>
  montarEtapasDosEditais(
    [{ ...EDITAL, cronograma_total: brutas.length }],
    [brutas.map((etapa, indice) => ({ ordem: indice + 1, ...etapa }))],
  ).etapas;

const CARREGADAS = etapas(
  {
    atividade: "Inscrições",
    data_inicio: "2026-11-01",
    data_fim: "2026-11-03",
  },
  {
    atividade: "Prazo de recurso",
    data_inicio: "2026-10-20",
    data_fim: "2026-11-20",
  },
  // Timestamp à meia-noite: tem de cair em 30/11, não em 29/11.
  {
    atividade: "Entrevistas",
    data_inicio: "2026-11-30T00:00:00",
    data_fim: "2026-12-02T23:59:59",
  },
  {
    atividade: "Resultado final",
    data_inicio: "2026-11-10",
    data_fim: "2026-11-10",
  },
);
// A carga ordena pelo início; aqui cada uma é achada pelo nome.
const pelaAtividade = (nome) =>
  CARREGADAS.find((etapa) => etapa.atividade === nome);
const CURTA = pelaAtividade("Inscrições");
const VIRADA = pelaAtividade("Entrevistas");
const PONTUAL = pelaAtividade("Resultado final");
const TODAS = CARREGADAS;

describe("marcaNoDia (começa ou termina no dia)", () => {
  it("marca o começo, o último dia, o dia único e os dias pelo meio", () => {
    expect(marcaNoDia(CURTA, "2026-11-01")).toBe("começa");
    expect(marcaNoDia(CURTA, "2026-11-02")).toBe("em andamento");
    expect(marcaNoDia(CURTA, "2026-11-03")).toBe("último dia");
    expect(marcaNoDia(PONTUAL, "2026-11-10")).toBe("no dia");
    expect(marcaNoDia(CURTA, "2026-10-31")).toBeNull();
    expect(marcaNoDia(CURTA, "2026-11-04")).toBeNull();
  });

  it("o timestamp à meia-noite fica no próprio dia (sem fuso a empurrar)", () => {
    expect(VIRADA.data_inicio).toBe("2026-11-30");
    expect(marcaNoDia(VIRADA, "2026-11-29")).toBeNull();
    expect(marcaNoDia(VIRADA, "2026-11-30")).toBe("começa");
    expect(marcaNoDia(VIRADA, "2026-12-02")).toBe("último dia");
  });
});

describe("diasDaLista", () => {
  const { inicio, fim } = intervaloDoMes(new Date(2026, 10, 15));

  it("agrupa por dia só o que começa ou termina, sem repetir o período longo", () => {
    const dias = diasDaLista(TODAS, inicio, fim);
    expect(dias.map((dia) => dia.chave)).toEqual([
      "2026-11-01",
      "2026-11-03",
      "2026-11-10",
      "2026-11-20",
      "2026-11-30",
    ]);
    expect(dias[0].titulo).toBe("1 de novembro de 2026 · domingo");
    expect(
      dias.map((dia) =>
        dia.itens.map(({ etapa, marca }) => `${etapa.atividade}:${marca}`),
      ),
    ).toEqual([
      ["Inscrições:começa"],
      ["Inscrições:último dia"],
      ["Resultado final:no dia"],
      ["Prazo de recurso:último dia"],
      ["Entrevistas:começa"],
    ]);
  });

  it("respeita as bordas do mês: o fim em dezembro não entra em novembro", () => {
    const dezembro = intervaloDoMes(new Date(2026, 11, 1));
    expect(dezembro).toEqual({ inicio: "2026-12-01", fim: "2026-12-31" });
    const dias = diasDaLista(TODAS, dezembro.inicio, dezembro.fim);
    expect(dias.map((dia) => dia.chave)).toEqual(["2026-12-02"]);
  });

  it("fevereiro e a virada do ano têm a última chave certa", () => {
    expect(intervaloDoMes(new Date(2028, 1, 10)).fim).toBe("2028-02-29");
    expect(intervaloDoMes(new Date(2026, 11, 31, 23, 59)).fim).toBe(
      "2026-12-31",
    );
  });

  it("deixa de fora a etapa de data impossível", () => {
    const [errada] = etapas({
      atividade: "Ano digitado errado",
      data_inicio: "0202-11-05",
      data_fim: "0202-11-06",
    });
    expect(diasDaLista([errada], "0202-11-01", "0202-11-30")).toEqual([]);
    expect(emAndamentoNoDia([errada], "0202-11-05")).toEqual([]);
  });
});

describe("emAndamentoNoDia", () => {
  it("só o que atravessa o dia — começar ou terminar nele não conta", () => {
    expect(
      emAndamentoNoDia(TODAS, "2026-11-02").map((etapa) => etapa.atividade),
    ).toEqual(["Inscrições", "Prazo de recurso"]);
    expect(
      emAndamentoNoDia(TODAS, "2026-11-01").map((etapa) => etapa.atividade),
    ).toEqual(["Prazo de recurso"]);
    expect(emAndamentoNoDia(TODAS, "2026-11-20")).toEqual([]);
  });

  it("vem pelo fim mais próximo", () => {
    expect(
      emAndamentoNoDia(TODAS, "2026-12-01").map((etapa) => etapa.atividade),
    ).toEqual(["Entrevistas"]);
  });

  it("hoje às 23h30 e às 00h30 do dia seguinte são dias diferentes", () => {
    expect(chaveDoDia(new Date(2026, 10, 2, 23, 30))).toBe("2026-11-02");
    expect(chaveDoDia(new Date(2026, 10, 3, 0, 30))).toBe("2026-11-03");
    const noite = emAndamentoNoDia(
      TODAS,
      chaveDoDia(new Date(2026, 10, 2, 23, 30)),
    );
    const madrugada = emAndamentoNoDia(
      TODAS,
      chaveDoDia(new Date(2026, 10, 3, 0, 30)),
    );
    expect(noite.map((etapa) => etapa.atividade)).toContain("Inscrições");
    expect(madrugada.map((etapa) => etapa.atividade)).not.toContain(
      "Inscrições",
    );
  });
});

describe("semana", () => {
  it("começa no domingo e atravessa o mês e o ano", () => {
    const inicio = inicioDaSemana(new Date(2026, 11, 31, 0, 5));
    expect(chaveDoDia(inicio)).toBe("2026-12-27");
    expect(chavesDaSemana(inicio)).toEqual([
      "2026-12-27",
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
    expect(rotuloDaSemana(inicio)).toBe(
      "27 de dezembro de 2026 a 2 de janeiro de 2027",
    );
    expect(rotuloDaSemana(inicioDaSemana(new Date(2026, 10, 3)))).toBe(
      "1 a 7 de novembro de 2026",
    );
    expect(rotuloDaSemana(inicioDaSemana(new Date(2026, 10, 30)))).toBe(
      "29 de novembro a 5 de dezembro de 2026",
    );
  });

  it("lista as ativas no dia, as pontas antes do que só atravessa", () => {
    expect(
      etapasAtivasNoDia(TODAS, "2026-11-02").map(
        ({ etapa, marca }) => `${etapa.atividade}:${marca}`,
      ),
    ).toEqual(["Prazo de recurso:em andamento", "Inscrições:em andamento"]);
    expect(
      etapasAtivasNoDia(TODAS, "2026-11-03").map(({ marca }) => marca),
    ).toEqual(["último dia", "em andamento"]);
    expect(contarEtapasNoIntervalo(TODAS, "2026-11-01", "2026-11-07")).toBe(2);
  });
});

describe("cor da unidade e vista inicial", () => {
  it("a cor é estável, de 1 a 6, e ignora acento e caixa", () => {
    const cor = corDaUnidade("DSEI Alto Rio Negro");
    expect(cor).toBeGreaterThanOrEqual(1);
    expect(cor).toBeLessThanOrEqual(6);
    expect(corDaUnidade("DSEI Alto Rio Negro")).toBe(cor);
    expect(corDaUnidade("dsei alto rio negro")).toBe(cor);
    expect(corDaUnidade("CASAI São Paulo")).toBe(
      corDaUnidade("CASAI Sao Paulo"),
    );
  });

  it("guardada vale; senão Mês no computador e Lista no celular", () => {
    expect(visaoInicial("semana", true)).toBe("semana");
    expect(visaoInicial(null, false)).toBe("mes");
    expect(visaoInicial(null, true)).toBe("lista");
    expect(visaoInicial("ano", false)).toBe("mes");
  });

  it("o cabeçalho do dia é por extenso, com o dia da semana", () => {
    expect(cabecalhoDoDiaDaLista("2026-11-03")).toBe(
      "3 de novembro de 2026 · terça-feira",
    );
  });
});
