import { describe, expect, it } from "vitest";
import {
  FILTROS_VAZIOS,
  alternarTipoOculto,
  cabecalhoDoDiaDaLista,
  chaveDoDia,
  chavesDaSemana,
  contarEtapasNoIntervalo,
  contarEtapasNoMes,
  diasDaLista,
  emAndamentoNoDia,
  etapasAtivasNoDia,
  filtrarEtapas,
  inicioDaSemana,
  intervaloDoMes,
  marcaNoDia,
  montarEtapasDosEditais,
  montarGradeDoMes,
  rotuloDaSemana,
  rotuloDoNumeroDoEdital,
  tiposOcultosValidos,
  unidadeCurta,
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
    const dias = diasDaLista(TODAS, inicio, fim, 2026);
    expect(dias.map((dia) => dia.chave)).toEqual([
      "2026-11-01",
      "2026-11-03",
      "2026-11-10",
      "2026-11-20",
      "2026-11-30",
    ]);
    expect(dias[0].titulo).toBe("Dom, 1 de novembro");
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

describe("dentro do dia: pela legenda, depois pela unidade", () => {
  const varias = montarEtapasDosEditais(
    [
      { id: 1, unidade: "DSEI Xingu", edital: "1/2026", cronograma_total: 2 },
      {
        id: 2,
        unidade: "DSEI Alto Rio Purus",
        edital: "2/2026",
        cronograma_total: 2,
      },
    ],
    [
      [
        {
          atividade: "Período de Entrevistas",
          data_inicio: "2026-11-03",
          data_fim: "2026-11-03",
          ordem: 1,
        },
        {
          atividade: "Prazo de recurso",
          data_inicio: "2026-11-03",
          data_fim: "2026-11-03",
          ordem: 2,
        },
      ],
      [
        {
          atividade: "Período de Entrevistas",
          data_inicio: "2026-11-03",
          data_fim: "2026-11-03",
          ordem: 1,
        },
        {
          atividade: "Resultado final do processo seletivo",
          data_inicio: "2026-11-03",
          data_fim: "2026-11-03",
          ordem: 2,
        },
      ],
    ],
  ).etapas;

  it("Recursos, Resultado final, Entrevistas; empate pela unidade", () => {
    const [dia] = diasDaLista(varias, "2026-11-01", "2026-11-30", 2026);
    expect(
      dia.itens.map(({ etapa }) => `${etapa.tipo.rotulo}:${etapa.unidade}`),
    ).toEqual([
      "Recursos:DSEI Xingu",
      "Resultado final:DSEI Alto Rio Purus",
      "Entrevistas:DSEI Alto Rio Purus",
      "Entrevistas:DSEI Xingu",
    ]);
  });
});

describe("marcos do mês (chips só no início e no fim)", () => {
  const grade = montarGradeDoMes(new Date(2026, 10, 1), TODAS, {
    hoje: new Date(2026, 10, 1),
  });
  const dia = (chave) => grade.find((celula) => celula.chave === chave);
  const marcos = (chave) =>
    dia(chave).marcos.map(({ etapa, marca }) => `${etapa.atividade}:${marca}`);

  it("a etapa com período aparece só no dia em que começa e no dia em que termina", () => {
    expect(marcos("2026-11-01")).toEqual(["Inscrições:começa"]);
    expect(marcos("2026-11-03")).toEqual(["Inscrições:último dia"]);
    expect(marcos("2026-11-20")).toEqual(["Prazo de recurso:último dia"]);
  });

  it("o dia do meio fica sem chip, mas a etapa continua ativa nele", () => {
    expect(marcos("2026-11-02")).toEqual([]);
    expect(dia("2026-11-02").pontos).toEqual([]);
    // O recurso e as inscrições atravessam o dia 2: o popup lista as duas.
    expect(dia("2026-11-02").total).toBe(2);
    expect(dia("2026-11-02").rotulo).toBe(
      "2 de novembro: 2 etapas, 2 em andamento",
    );
  });

  it("a etapa de um dia é um chip no próprio dia", () => {
    expect(marcos("2026-11-10")).toEqual(["Resultado final:no dia"]);
    expect(dia("2026-11-10").rotulo).toBe(
      "10 de novembro: 2 etapas, 1 em andamento",
    );
  });
});

describe("filtro de tipo da legenda", () => {
  it("os tipos desligados saem das etapas e da contagem do mês", () => {
    const semResultado = filtrarEtapas(TODAS, FILTROS_VAZIOS, {
      hoje: new Date(2026, 10, 1),
      tiposOcultos: ["resultado"],
    });
    expect(semResultado.map(({ atividade }) => atividade)).not.toContain(
      "Resultado final",
    );
    expect(contarEtapasNoMes(semResultado, new Date(2026, 10, 1))).toBe(
      contarEtapasNoMes(TODAS, new Date(2026, 10, 1)) - 1,
    );
  });

  it("alterna um tipo e só aceita, do que estava guardado, tipos da legenda", () => {
    expect(alternarTipoOculto([], "recursos")).toEqual(["recursos"]);
    expect(alternarTipoOculto(["recursos", "outros"], "recursos")).toEqual([
      "outros",
    ]);
    expect(tiposOcultosValidos('["recursos","inventado","recursos"]')).toEqual([
      "recursos",
    ]);
    expect(tiposOcultosValidos("{quebrado")).toEqual([]);
    expect(tiposOcultosValidos(null)).toEqual([]);
  });
});

describe("textos curtos", () => {
  it("tira o 'DSEI ' da frente; o resto fica como está", () => {
    expect(unidadeCurta("DSEI Alto Rio Purus")).toBe("Alto Rio Purus");
    expect(unidadeCurta("dsei - Litoral Sul")).toBe("Litoral Sul");
    expect(unidadeCurta("CASAI São Paulo")).toBe("CASAI São Paulo");
    expect(unidadeCurta("DSEI")).toBe("DSEI");
  });

  it("o edital sai como está guardado, sem inventar ano nem repetir 'Ed.'", () => {
    expect(rotuloDoNumeroDoEdital("112/2026")).toBe("Ed. 112/2026");
    expect(rotuloDoNumeroDoEdital("115")).toBe("Ed. 115");
    expect(rotuloDoNumeroDoEdital("Edital 115")).toBe("Ed. 115");
    expect(rotuloDoNumeroDoEdital("Ed. 115")).toBe("Ed. 115");
  });
});

describe("vista inicial e cabeçalho do dia", () => {
  it("guardada vale; senão Mês no computador e Lista no celular", () => {
    expect(visaoInicial("semana", true)).toBe("semana");
    expect(visaoInicial(null, false)).toBe("mes");
    expect(visaoInicial(null, true)).toBe("lista");
    expect(visaoInicial("ano", false)).toBe("mes");
  });

  it("o cabeçalho do dia é curto; o ano só quando não é o de hoje", () => {
    expect(cabecalhoDoDiaDaLista("2026-11-03", 2026)).toBe(
      "Ter, 3 de novembro",
    );
    expect(cabecalhoDoDiaDaLista("2027-01-01", 2026)).toBe(
      "Sex, 1 de janeiro de 2027",
    );
  });
});
