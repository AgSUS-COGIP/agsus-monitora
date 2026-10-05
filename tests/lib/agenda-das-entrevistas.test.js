import { describe, expect, it } from "vitest";
import {
  agendaPorCandidato,
  conflitosDaAgenda,
  convocadosDaLista,
  diasDaRegra,
  gerarAgenda,
  gerarXlsxDaAgenda,
  horariosDaRegra,
  horariosLivres,
  itensParaSalvar,
  juntarComConvocados,
  lerDias,
  linhasDaAgenda,
  moverNaAgenda,
  normalizarRegraDaAgenda,
  ordenarConvocados,
  temAjusteManual,
  textoDaDuracao,
  trocarNaAgenda,
  validarRegraDaAgenda,
} from "../../src/lib/agenda-das-entrevistas.js";

/*
  O motor da agenda das entrevistas (src/lib/agenda-das-entrevistas.js):
  dias da regra, horários (duração, intervalo, pausa, reserva), distribuição
  pelas bancas, ordem dos candidatos, agrupar por cargo, o aviso de que não
  cabe ou de que sobra muito, e o ajuste manual com conflitos.
*/

const regra = (campos = {}) => ({
  datas: {
    modo: "INTERVALO",
    inicio: "2026-10-09", // sexta
    fim: "2026-10-13", // terça
    so_dias_uteis: true,
  },
  periodos: [{ inicio: "08:00", fim: "10:00" }],
  duracao_min: 30,
  intervalo_min: 0,
  bancas: 1,
  ...campos,
});

const c = (n, campos = {}) => ({
  analiseId: `a${n}`,
  nome: `Candidato ${n}`,
  vaga: "V1",
  cargo: "Enfermeiro",
  posicao: n,
  modalidades: ["AC"],
  ...campos,
});

describe("regra da agenda: dias e validação", () => {
  it("intervalo com dias úteis pula sábado e domingo; feriado excluído sai", () => {
    expect(diasDaRegra(regra())).toEqual([
      "2026-10-09",
      "2026-10-12",
      "2026-10-13",
    ]);
    expect(
      diasDaRegra(
        regra({
          datas: { ...regra().datas, excluir: ["2026-10-12"] },
        }),
      ),
    ).toEqual(["2026-10-09", "2026-10-13"]);
    expect(
      diasDaRegra(regra({ datas: { ...regra().datas, so_dias_uteis: false } })),
    ).toHaveLength(5);
  });

  it("lista de dias aceita dd/mm/aaaa e ISO, sem repetir, e acusa os inválidos", () => {
    expect(lerDias("06/10/2026, 2026-10-05 6/10/2026 31/02/2026")).toEqual({
      dias: ["2026-10-05", "2026-10-06"],
      invalidos: ["31/02/2026"],
    });
    expect(
      diasDaRegra({ datas: { modo: "LISTA", dias: ["2026-10-10"] } }),
    ).toEqual(["2026-10-10"]);
  });

  it("recusa período invertido ou sobreposto, pausa invertida, duração e bancas fora dos limites", () => {
    expect(validarRegraDaAgenda(regra())).toEqual([]);
    const erros = validarRegraDaAgenda(
      regra({
        periodos: [
          { inicio: "08:00", fim: "12:00" },
          { inicio: "11:00", fim: "13:00" },
        ],
        pausa: { inicio: "13:00", fim: "12:00" },
        duracao_min: 2,
        bancas: 30,
      }),
    );
    expect(erros).toEqual([
      "Os períodos não podem se sobrepor.",
      "Duração de cada entrevista entre 5 e 240 minutos.",
      "A pausa precisa de início antes do fim (HH:MM).",
      "De 1 a 20 bancas simultâneas.",
    ]);
    expect(validarRegraDaAgenda({ datas: { modo: "INTERVALO" } })[0]).toBe(
      "Informe a data de início e a de fim.",
    );
  });

  it("normaliza o que falta com os padrões e fixa o fuso de Brasília", () => {
    const r = normalizarRegraDaAgenda({ ordem: "INVENTADA", fuso: "UTC" });
    expect(r.ordem).toBe("CLASSIFICACAO");
    expect(r.fuso).toBe("America/Sao_Paulo");
    expect(r.periodos).toEqual([
      { inicio: "08:00", fim: "12:00" },
      { inicio: "14:00", fim: "18:00" },
    ]);
  });
});

describe("horários: duração, intervalo, pausa e reserva", () => {
  it("de duração + intervalo em duração + intervalo, sem passar do fim do período", () => {
    const h = horariosDaRegra(
      regra({
        datas: { modo: "LISTA", dias: ["2026-10-13"] },
        duracao_min: 40,
        intervalo_min: 10,
      }),
    );
    expect(h.map((x) => `${x.inicio}-${x.fim}`)).toEqual([
      "08:00-08:40",
      "08:50-09:30",
    ]);
  });

  it("a pausa não recebe entrevista: a próxima começa no fim dela", () => {
    const h = horariosDaRegra(
      regra({
        datas: { modo: "LISTA", dias: ["2026-10-13"] },
        periodos: [{ inicio: "11:00", fim: "14:00" }],
        duracao_min: 45,
        pausa: { inicio: "12:00", fim: "13:00" },
      }),
    );
    expect(h.map((x) => x.inicio)).toEqual(["11:00", "13:00"]);
  });

  it("reservar o primeiro horário marca o primeiro de cada período, que não é distribuído", () => {
    const r = regra({
      datas: { modo: "LISTA", dias: ["2026-10-13"] },
      periodos: [
        { inicio: "08:00", fim: "09:00" },
        { inicio: "14:00", fim: "15:00" },
      ],
      reservar_primeiro_horario: true,
    });
    expect(
      horariosDaRegra(r)
        .filter((h) => h.reservado)
        .map((h) => h.inicio),
    ).toEqual(["08:00", "14:00"]);
    const { itens } = gerarAgenda([c(1), c(2), c(3)], r);
    expect(itens.map((i) => i.inicio)).toEqual(["08:30", "14:30"]);
  });
});

describe("distribuição pelas bancas", () => {
  it("no mesmo horário, banca 1, banca 2…; depois o próximo horário e o próximo dia", () => {
    const { itens, totais } = gerarAgenda(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => c(n)),
      regra({ bancas: 2 }),
    );
    expect(
      itens.slice(0, 4).map((i) => [i.analiseId, i.data, i.inicio, i.banca]),
    ).toEqual([
      ["a1", "2026-10-09", "08:00", 1],
      ["a2", "2026-10-09", "08:00", 2],
      ["a3", "2026-10-09", "08:30", 1],
      ["a4", "2026-10-09", "08:30", 2],
    ]);
    expect(itens[8]).toMatchObject({
      data: "2026-10-12",
      inicio: "08:00",
      banca: 1,
      origem: "GERADA",
      fim: "08:30",
    });
    expect(totais).toMatchObject({
      convocados: 9,
      comHorario: 9,
      semHorario: 0,
      lugares: 24,
      diasNecessarios: 2,
    });
  });

  it("não cabe: avisa quantos ficaram sem horário e quanto tempo falta", () => {
    const r = regra({
      datas: { modo: "LISTA", dias: ["2026-10-13"] },
      intervalo_min: 10,
      bancas: 2,
    });
    // 08:00, 08:40, 09:20 → 3 horários × 2 bancas = 6 lugares.
    const res = gerarAgenda(
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => c(n)),
      r,
    );
    expect(res.semHorario.map((x) => x.analiseId)).toEqual(["a7", "a8", "a9"]);
    expect(res.totais.faltaMin).toBe(80);
    expect(res.avisos).toEqual([
      expect.objectContaining({
        codigo: "NAO_CABE",
        texto:
          "3 convocados ficaram sem horário: faltam cerca de 1 h 20 min de entrevistas com 2 bancas. Acrescente dias, períodos ou bancas.",
      }),
    ]);
  });

  it("sobra muito: avisa os horários livres e quantos dias bastam", () => {
    const res = gerarAgenda([c(1), c(2)], regra());
    expect(res.avisos[0]).toMatchObject({
      codigo: "SOBRA",
      texto: "Sobram 10 horários livres: bastam 1 dos 3 dias.",
    });
  });
});

describe("ordem dos candidatos e agrupar por cargo", () => {
  const lista = [
    c(2, { nome: "Zeca", vaga: "V2", cargo: "Médico", modalidades: ["PP"] }),
    c(1, { nome: "Ana", vaga: "V2", cargo: "Médico" }),
    c(1, {
      analiseId: "b1",
      nome: "Bruno",
      vaga: "V1",
      cargo: "Enfermeiro",
      modalidades: ["PCD"],
    }),
    c(2, { analiseId: "b2", nome: "Ícaro", vaga: "V1", cargo: "Enfermeiro" }),
  ];
  const ordem = (o, extra = {}) =>
    ordenarConvocados(lista, { ordem: o, ...extra }).map((x) => x.nome);

  it("classificação: posição em todas as vagas, empate pela ordem da lista", () => {
    expect(ordem("CLASSIFICACAO")).toEqual(["Ana", "Bruno", "Zeca", "Ícaro"]);
  });
  it("vaga/cargo: pelo código da vaga e depois a posição", () => {
    expect(ordem("VAGA")).toEqual(["Bruno", "Ícaro", "Ana", "Zeca"]);
  });
  it("alfabética, sem diferenciar acentos", () => {
    expect(ordem("ALFABETICA")).toEqual(["Ana", "Bruno", "Ícaro", "Zeca"]);
  });
  it("modalidade: ampla primeiro, depois as cotas em ordem alfabética", () => {
    expect(ordem("MODALIDADE")).toEqual(["Ana", "Ícaro", "Bruno", "Zeca"]);
  });
  it("agrupar por cargo junta o cargo inteiro antes do próximo, na ordem escolhida", () => {
    expect(ordem("CLASSIFICACAO", { agrupar_por_cargo: true })).toEqual([
      "Ana",
      "Zeca",
      "Bruno",
      "Ícaro",
    ]);
  });
  it("com bancas, um cargo novo começa num horário novo", () => {
    const { itens } = gerarAgenda(
      [
        c(1, { cargo: "Médico" }),
        c(2, { analiseId: "e1", cargo: "Enfermeiro" }),
        c(3, { analiseId: "e2", cargo: "Enfermeiro" }),
      ],
      regra({ bancas: 2, agrupar_por_cargo: true }),
    );
    expect(itens.map((i) => [i.analiseId, i.inicio, i.banca])).toEqual([
      ["a1", "08:00", 1],
      ["e1", "08:30", 1],
      ["e2", "08:30", 2],
    ]);
  });
});

describe("convocados da lista de convocação", () => {
  it("lê o retrato (analise_id) e o resultado do motor (analiseId), sem repetir o cotista", () => {
    const retrato = {
      vagas: [
        {
          codigo: "169681",
          cargo: "Cirurgião Dentista",
          geral: [
            { analise_id: "x1", nome: "Ana", posicao: 1, modalidades: ["AC"] },
          ],
          listas: {
            PP: [
              { analise_id: "x1", nome: "Ana", posicao: 1 },
              {
                analise_id: "x2",
                nome: "Caio",
                posicao: 1,
                modalidades: ["PP"],
              },
            ],
          },
        },
      ],
    };
    expect(
      convocadosDaLista(retrato).map((x) => [x.analiseId, x.vaga]),
    ).toEqual([
      ["x1", "169681"],
      ["x2", "169681"],
    ]);
    const resultado = {
      vagas: [
        {
          codigo: "1",
          geral: [{ analiseId: "y1", nome: "Bia", posicao: 1 }],
          porModalidade: {},
        },
      ],
    };
    expect(convocadosDaLista(resultado)[0].analiseId).toBe("y1");
  });
});

describe("ajuste manual e conflitos", () => {
  const r = regra({ bancas: 2 });
  const base = () => gerarAgenda([c(1), c(2), c(3)], r).itens;

  it("mover para um horário livre vira ajuste manual; tirar o horário deixa sem horário", () => {
    const livre = horariosLivres(base(), r)[0];
    expect(livre).toMatchObject({
      data: "2026-10-09",
      inicio: "08:30",
      banca: 2,
    });
    const movido = moverNaAgenda(base(), "a1", livre);
    expect(movido[0]).toMatchObject({
      inicio: "08:30",
      banca: 2,
      origem: "MANUAL",
    });
    expect(temAjusteManual(movido)).toBe(true);
    expect(temAjusteManual(base())).toBe(false);
    expect(itensParaSalvar(moverNaAgenda(base(), "a1", null))).toHaveLength(2);
  });

  it("trocar dois de lugar troca horário e banca, os dois como manuais", () => {
    const trocado = trocarNaAgenda(base(), "a1", "a3");
    expect(trocado.find((i) => i.analiseId === "a1")).toMatchObject({
      inicio: "08:30",
      banca: 1,
      origem: "MANUAL",
    });
    expect(trocado.find((i) => i.analiseId === "a3")).toMatchObject({
      inicio: "08:00",
      banca: 1,
      origem: "MANUAL",
    });
    expect(conflitosDaAgenda(trocado)).toEqual([]);
  });

  it("acusa mesma banca e horário sobreposto, e candidato repetido", () => {
    const itens = moverNaAgenda(base(), "a3", {
      data: "2026-10-09",
      inicio: "08:15",
      fim: "08:45",
      banca: 1,
    });
    const conflitos = conflitosDaAgenda([...itens, { ...itens[1] }], {
      nomes_das_bancas: ["Sala A"],
    });
    expect(conflitos.map((x) => x.tipo).sort()).toEqual([
      "HORARIO",
      "REPETIDO",
    ]);
    expect(conflitos.find((x) => x.tipo === "HORARIO").texto).toBe(
      "Candidato 1 e Candidato 3: Sala A, 09/10/2026, 08:00.",
    );
  });

  it("o mapa do documento traz data, hora e banca por análise", () => {
    expect(agendaPorCandidato(base()).get("a2")).toEqual({
      data: "2026-10-09",
      inicio: "08:00",
      fim: "08:30",
      banca: 2,
    });
  });

  it("a agenda salva se junta à lista atual; quem saiu da lista fica marcado", () => {
    const salvos = [
      {
        analiseId: "a1",
        data: "2026-10-09",
        inicio: "08:00",
        fim: "08:30",
        banca: 1,
        origem: "MANUAL",
      },
      {
        analiseId: "zz",
        nome: "Fora",
        data: "2026-10-09",
        inicio: "09:00",
        fim: "09:30",
        banca: 1,
        origem: "GERADA",
      },
    ];
    const itens = juntarComConvocados(salvos, [c(1), c(2)]);
    expect(
      itens.map((i) => [i.analiseId, i.inicio, Boolean(i.foraDaLista)]),
    ).toEqual([
      ["a1", "08:00", false],
      ["a2", null, false],
      ["zz", "09:00", true],
    ]);
    expect(itens[0].origem).toBe("MANUAL");
  });
});

describe("exportação", () => {
  it("planilha por dia, hora e banca, com o nome da banca e quem ficou sem horário no fim", () => {
    const itens = moverNaAgenda(
      gerarAgenda([c(1), c(2)], regra({ bancas: 2 })).itens,
      "a1",
      null,
    );
    const linhas = linhasDaAgenda(itens, { nomes_das_bancas: ["", "Sala B"] });
    expect(linhas[0][2]).toBe("Início (Brasília)");
    expect(linhas[1]).toEqual([
      "09/10/2026",
      "sex",
      "08:00",
      "08:30",
      "Sala B",
      "Candidato 2",
      "V1",
      "Enfermeiro",
      "AC",
      "Gerada",
    ]);
    expect(linhas[2][0]).toBe("Sem horário");
    const bytes = gerarXlsxDaAgenda(itens);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
  });

  it("duração por extenso", () => {
    expect(textoDaDuracao(45)).toBe("45 min");
    expect(textoDaDuracao(120)).toBe("2 h");
    expect(textoDaDuracao(150)).toBe("2 h 30 min");
  });
});

describe("agenda do dia (Entrevistas)", () => {
  it("hoje é o dia de Brasília, mesmo de madrugada em UTC", async () => {
    const { hojeEmBrasilia } =
      await import("../../src/lib/agenda-das-entrevistas.js");
    expect(hojeEmBrasilia(new Date("2026-10-06T02:30:00Z"))).toBe("2026-10-05");
  });

  it("abre em hoje, ou no próximo dia com entrevista, ou no último", async () => {
    const { diaInicialDaAgenda } =
      await import("../../src/lib/agenda-das-entrevistas.js");
    const dias = ["2026-10-08", "2026-10-06", "2026-10-06"];
    expect(diaInicialDaAgenda(dias, "2026-10-06")).toBe("2026-10-06");
    expect(diaInicialDaAgenda(dias, "2026-10-07")).toBe("2026-10-08");
    expect(diaInicialDaAgenda(dias, "2026-10-09")).toBe("2026-10-08");
    expect(diaInicialDaAgenda([], "2026-10-09")).toBe("");
  });
});
