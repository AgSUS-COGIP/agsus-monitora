import { afterEach, describe, expect, it } from "vitest";
import {
  agoraEmBrasilia,
  calcularRitmo,
  destaquesDoDia,
  metaDaEquipeBatida,
  MINIMO_DO_SELO,
  diasUteisAtePrazo,
  diaUtilDepois,
  ehDiaUtil,
  etapaDaAnalise,
  lerRitmoDaAnalise,
  nomeCurtoDaEtapa,
  ritmosDaArea,
  fracaoDoExpediente,
  gravarRitmoRecolhido,
  lerRitmoRecolhido,
  noMomentoDoResumo,
  ritmoDoDia,
  seloDoCard,
  textoDeReferencia,
  textoDoDia,
  textoDoMomento,
  textoDoPrazo,
  textoDoRitmo,
  textoRecolhido,
} from "../src/lib/ritmo-da-analise.ts";

/* O cronograma real do 114/2026 (resumido nas etapas que importam). */
const CRONOGRAMA_114 = [
  {
    ordem: 3,
    atividade: "Período de Inscrições",
    tipo: null,
    inicio: "2026-10-05",
    fim: "2026-10-14",
  },
  {
    ordem: 4,
    atividade:
      "Validação das inscrições, por meio da verificação da documentação obrigatória / Análise do processo de Heteroidentificação",
    tipo: null,
    inicio: "2026-10-15",
    fim: "2026-10-22",
  },
  {
    ordem: 5,
    atividade:
      "Divulgação do resultado preliminar da validação da documentação obrigatória e da heteroidentificação e abertura do prazo para interposição de recurso",
    tipo: null,
    inicio: "2026-10-26",
    fim: "2026-10-26",
  },
  {
    ordem: 7,
    atividade:
      "Envio do espelho da análise de títulos e experiência profissional",
    tipo: null,
    inicio: "2026-10-28",
    fim: "2026-10-30",
  },
  {
    ordem: 8,
    atividade: "Submissão de recursos relativos à análise documental",
    tipo: null,
    inicio: "2026-11-03",
    fim: "2026-11-04",
  },
];

const edital = (mudancas = {}) => ({
  id: "bcecfb08",
  edital: "114/2026",
  situacoes: {
    pendente: 1086,
    em_analise: 12,
    revisar: 0,
    concluida: 414,
    fora_lote: 448,
  },
  porDia: [
    { dia: "2026-10-16", qt: 266 },
    { dia: "2026-10-19", qt: 148 },
  ],
  qtEquipe: 9,
  qtAvaliadoresRecentes: 7,
  cronograma: CRONOGRAMA_114,
  ...mudancas,
});

const SEGUNDA_MEIO_DIA = { hoje: "2026-10-19", hora: 12 };

describe("dias úteis", () => {
  it("segunda a sexta, sem fim de semana nem feriado nacional fixo", () => {
    expect(ehDiaUtil("2026-10-16")).toBe(true); // sexta
    expect(ehDiaUtil("2026-10-17")).toBe(false); // sábado
    expect(ehDiaUtil("2026-10-18")).toBe(false); // domingo
    expect(ehDiaUtil("2026-10-12")).toBe(false); // feriado (segunda)
    expect(ehDiaUtil("2026-11-02")).toBe(false); // Finados
  });

  it("hoje conta até o fim do expediente (18h)", () => {
    expect(diasUteisAtePrazo(SEGUNDA_MEIO_DIA, "2026-10-22")).toBe(4);
    expect(
      diasUteisAtePrazo({ hoje: "2026-10-19", hora: 18 }, "2026-10-22"),
    ).toBe(3);
  });

  it("no fim de semana, começa na segunda", () => {
    expect(
      diasUteisAtePrazo({ hoje: "2026-10-17", hora: 10 }, "2026-10-22"),
    ).toBe(4);
    expect(diaUtilDepois("2026-10-16", 1)).toBe("2026-10-19");
  });

  it("hoje e hora em Brasília", () => {
    expect(agoraEmBrasilia(new Date("2026-10-19T15:00:00Z"))).toEqual({
      ...SEGUNDA_MEIO_DIA,
      minuto: 0,
    });
    expect(agoraEmBrasilia(new Date("2026-10-20T02:30:00Z"))).toEqual({
      hoje: "2026-10-19",
      hora: 23,
      minuto: 30,
    });
  });
});

describe("etapa da análise no cronograma", () => {
  it("acha a validação da documentação do 114, não a divulgação nem os recursos", () => {
    expect(etapaDaAnalise(CRONOGRAMA_114, "2026-10-19")?.ordem).toBe(4);
    expect(nomeCurtoDaEtapa(CRONOGRAMA_114[1].atividade)).toBe(
      "Validação da documentação",
    );
  });

  it("com o prazo passado, fica a última que casou", () => {
    expect(etapaDaAnalise(CRONOGRAMA_114, "2026-10-27")?.ordem).toBe(4);
  });

  it("análise curricular e o tipo da atividade, quando houver", () => {
    const cronograma = [
      {
        ordem: 1,
        atividade: "Período de Análise Curricular",
        tipo: null,
        inicio: "2026-09-30",
        fim: "2026-10-08",
      },
      {
        ordem: 2,
        atividade: "Resultado preliminar da análise curricular",
        tipo: null,
        inicio: "2026-10-09",
        fim: "2026-10-09",
      },
      {
        ordem: 3,
        atividade: "Etapa X",
        tipo: "analise_documental",
        inicio: "2026-10-10",
        fim: "2026-10-20",
      },
    ];
    expect(etapaDaAnalise(cronograma.slice(0, 2), "2026-10-01")?.ordem).toBe(1);
    expect(etapaDaAnalise(cronograma, "2026-10-01")?.ordem).toBe(3);
  });

  it("sem cronograma ou sem etapa que case: nada", () => {
    expect(etapaDaAnalise([], "2026-10-19")).toBeNull();
    expect(etapaDaAnalise([CRONOGRAMA_114[0]], "2026-10-19")).toBeNull();
  });
});

describe("calcularRitmo", () => {
  it("o 114 em 19/10 ao meio-dia: ≈275 por dia, ≈31 por avaliador, um dia útil depois do prazo", () => {
    const r = calcularRitmo(edital(), SEGUNDA_MEIO_DIA);
    expect(r).toMatchObject({
      faltam: 1098,
      concluidas: 414,
      percentual: 27,
      diasRestantes: 4,
      porDia: 275,
      avaliadores: 9,
      avaliadoresDaEquipe: true,
      porAvaliador: 31,
      ritmo: 266,
      diasDoRitmo: 1,
      concluidasHoje: 148,
      termino: "2026-10-23",
      diasDeAtraso: 1,
      situacao: "abaixo",
    });
    expect(textoDoPrazo(r)).toBe("Prazo: 22/10 · Validação da documentação");
    expect(textoDoRitmo(r)).toBe(
      "No ritmo atual (≈266 por dia), termina por volta de 23/10, um dia útil depois do prazo de 22/10.",
    );
  });

  it("ritmo suficiente: no ritmo, antes do prazo", () => {
    const r = calcularRitmo(
      edital({
        porDia: [
          { dia: "2026-10-15", qt: 380 },
          { dia: "2026-10-16", qt: 400 },
        ],
      }),
      SEGUNDA_MEIO_DIA,
    );
    expect(r.ritmo).toBe(390);
    expect(r.situacao).toBe("no-ritmo");
    expect(textoDoRitmo(r)).toContain("antes do prazo de 22/10");
  });

  it("média dos últimos 3 dias com análise; hoje entra depois do expediente", () => {
    const porDia = [
      { dia: "2026-10-13", qt: 10 },
      { dia: "2026-10-14", qt: 100 },
      { dia: "2026-10-15", qt: 200 },
      { dia: "2026-10-16", qt: 300 },
      { dia: "2026-10-19", qt: 400 },
    ];
    expect(calcularRitmo(edital({ porDia }), SEGUNDA_MEIO_DIA).ritmo).toBe(200);
    expect(
      calcularRitmo(edital({ porDia }), { hoje: "2026-10-19", hora: 19 }).ritmo,
    ).toBe(300);
  });

  it("prazo passado: vencido, sem necessárias por dia", () => {
    const r = calcularRitmo(edital(), { hoje: "2026-10-26", hora: 9 });
    expect(r.situacao).toBe("vencido");
    expect(r.porDia).toBeNull();
    expect(r.porAvaliador).toBeNull();
    expect(textoDoRitmo(r)).toContain("o prazo era 22/10");
  });

  it("concluído", () => {
    const r = calcularRitmo(
      edital({
        situacoes: {
          pendente: 0,
          em_analise: 0,
          revisar: 0,
          concluida: 1500,
          fora_lote: 448,
        },
      }),
      SEGUNDA_MEIO_DIA,
    );
    expect(r).toMatchObject({
      situacao: "concluido",
      percentual: 100,
      faltam: 0,
      porDia: null,
      termino: null,
    });
  });

  it("sem cronograma: sem prazo e sem inventar data", () => {
    const r = calcularRitmo(edital({ cronograma: [] }), SEGUNDA_MEIO_DIA);
    expect(r).toMatchObject({
      situacao: "sem-prazo",
      etapa: null,
      porDia: null,
    });
    expect(textoDoPrazo(r)).toBe("Sem etapa de análise no cronograma");
    expect(textoDoRitmo(r)).toBe(
      "No ritmo atual (≈266 por dia), termina por volta de 23/10.",
    );
  });

  it("sem histórico: sem ritmo e sem projeção", () => {
    const r = calcularRitmo(
      edital({ porDia: [{ dia: "2026-10-19", qt: 20 }] }),
      SEGUNDA_MEIO_DIA,
    );
    expect(r).toMatchObject({
      situacao: "sem-historico",
      ritmo: null,
      termino: null,
      porDia: 275,
    });
    expect(textoDoRitmo(r)).toBe("Sem dias com análise para medir o ritmo.");
  });

  it("por avaliador: a equipe; sem equipe, quem concluiu nos últimos 7 dias; sem ninguém, nada", () => {
    expect(
      calcularRitmo(edital({ qtEquipe: 0 }), SEGUNDA_MEIO_DIA),
    ).toMatchObject({
      avaliadores: 7,
      avaliadoresDaEquipe: false,
      porAvaliador: 40,
    });
    expect(
      calcularRitmo(
        edital({ qtEquipe: 0, qtAvaliadoresRecentes: 0 }),
        SEGUNDA_MEIO_DIA,
      ).porAvaliador,
    ).toBeNull();
  });
});

describe("leitura e editais do card", () => {
  it("lê o retrato da RPC e descarta o malformado", () => {
    const [e] = lerRitmoDaAnalise([
      {
        editais: [
          {
            id: "x",
            edital: "114/2026",
            situacoes: { pendente: "3", concluida: 2 },
            por_dia: [
              { dia: "2026-10-16", qt: 2 },
              { dia: "lixo", qt: 1 },
            ],
            qt_equipe: 2,
            cronograma: [
              { ordem: 1, atividade: "Análise curricular", fim: "2026-10-22" },
            ],
          },
          { edital: "sem id" },
        ],
      },
    ]);
    expect(e).toMatchObject({
      id: "x",
      situacoes: { pendente: 3, em_analise: 0, concluida: 2 },
      qtEquipe: 2,
    });
    expect(e.porDia).toEqual([{ dia: "2026-10-16", qt: 2 }]);
    expect(lerRitmoDaAnalise(null)).toEqual([]);
    expect(lerRitmoDaAnalise({ editais: "x" })).toEqual([]);
  });

  it("edital sem nenhuma concluída e com o prazo vencido sai (análise feita fora do sistema)", () => {
    const fora = edital({
      id: "93",
      situacoes: {
        pendente: 93,
        em_analise: 3,
        revisar: 0,
        concluida: 0,
        fora_lote: 1,
      },
      porDia: [],
      cronograma: [
        {
          ordem: 4,
          atividade: "Período de Análise Curricular",
          tipo: null,
          inicio: "2026-09-30",
          fim: "2026-10-08",
        },
      ],
    });
    expect(
      ritmosDaArea([edital(), fora], SEGUNDA_MEIO_DIA).map((r) => r.id),
    ).toEqual(["bcecfb08"]);
  });
});

/*
  O bloco "Hoje" (pedido de 19/10/2026): a meta do dia e um selo que oscila ao
  longo do expediente (08:00–18:00, Brasília).
*/
describe("o dia: meta, feito e o selo que oscila", () => {
  const PRAZO = "2026-10-22"; // segunda 19 → 19, 20, 21 e 22: 4 dias úteis
  const dia = (faltam, feito, agora, prazo = PRAZO) =>
    ritmoDoDia({ faltam, feito, prazo, avaliadores: 9 }, agora);

  it("a fração do expediente: 0 antes das 8h, metade às 13h, 1 depois das 18h", () => {
    expect(fracaoDoExpediente({ hoje: "2026-10-19", hora: 7 })).toBe(0);
    expect(fracaoDoExpediente({ hoje: "2026-10-19", hora: 13 })).toBe(0.5);
    expect(
      fracaoDoExpediente({ hoje: "2026-10-19", hora: 12, minuto: 30 }),
    ).toBeCloseTo(0.45);
    expect(fracaoDoExpediente({ hoje: "2026-10-19", hora: 19 })).toBe(1);
  });

  it("antes das 8h: meta inteira pela frente, esperado 0, no ritmo", () => {
    expect(dia(1000, 0, { hoje: "2026-10-19", hora: 7 })).toEqual({
      situacao: "no-ritmo",
      meta: 250,
      feito: 0,
      faltam: 250,
      porAvaliador: 28,
      esperado: 0,
      excedente: 0,
    });
  });

  it("no meio do expediente, o selo depende do esperado para a hora", () => {
    const meio = { hoje: "2026-10-19", hora: 13 };
    // A meta é a do começo do dia: (faltam + feito) ÷ 4 = 250, feito o que for.
    expect(dia(900, 100, meio)).toMatchObject({
      meta: 250,
      esperado: 125,
      faltam: 150,
      situacao: "abaixo",
    });
    expect(dia(870, 130, meio)).toMatchObject({
      meta: 250,
      situacao: "no-ritmo",
      porAvaliador: 14,
    });
  });

  it("depois das 18h, o esperado é a meta", () => {
    expect(dia(800, 200, { hoje: "2026-10-19", hora: 19 })).toMatchObject({
      esperado: 250,
      situacao: "abaixo",
      faltam: 50,
    });
  });

  it("meta batida: faltam 0, com o excedente", () => {
    expect(dia(740, 260, { hoje: "2026-10-19", hora: 15 })).toMatchObject({
      situacao: "batida",
      faltam: 0,
      excedente: 10,
      porAvaliador: null,
    });
  });

  it("fim de semana e feriado não são dia útil; sem prazo, sem meta", () => {
    expect(dia(1000, 0, { hoje: "2026-10-17", hora: 10 }).situacao).toBe(
      "nao-util",
    );
    expect(
      dia(1000, 0, { hoje: "2026-11-02", hora: 10 }, "2026-11-30").situacao,
    ).toBe("nao-util");
    expect(dia(1000, 0, SEGUNDA_MEIO_DIA, null).situacao).toBe("sem-meta");
  });

  it("prazo vencido: tudo é a meta de hoje", () => {
    expect(dia(300, 20, SEGUNDA_MEIO_DIA, "2026-10-16").meta).toBe(320);
  });

  it("o card: o selo principal é o do dia; recolhido, 'hoje X de Y'", () => {
    const r = calcularRitmo(edital(), { hoje: "2026-10-19", hora: 13 });
    // (1.098 + 148 feitas hoje) ÷ 4 = 311,5 → 312; esperado às 13h: 156.
    expect(r.dia).toMatchObject({ meta: 312, feito: 148, esperado: 156 });
    expect(seloDoCard(r)).toEqual({
      rotulo: "Abaixo do ritmo hoje",
      situacao: "abaixo",
    });
    expect(textoRecolhido(r)).toBe("hoje 148 de 312");
    expect(textoDoDia(r)).toBe(
      "≈19 por avaliador até o fim do expediente (9 avaliadores) · esperado até agora: 156",
    );
    expect(textoDeReferencia(r)).toMatch(
      /^Média dos últimos dias ≈\d+\/dia · termina por volta de \d{2}\/\d{2}/,
    );
    const sabado = calcularRitmo(edital(), { hoje: "2026-10-17", hora: 10 });
    expect(seloDoCard(sabado).rotulo).toBe("Hoje não é dia útil");
    expect(textoRecolhido(sabado)).toBe("faltam 1.098");
  });
});

describe("as contagens do resumo do Painel", () => {
  const linha = (status, mudancas = {}) => ({
    edital: "114/2026",
    status_consolidado: status,
    ...mudancas,
  });

  it("faltam = Pendente + Em análise + Revisar; concluídas = Aprovado + Reprovado; hoje pela data", () => {
    const linhas = [
      linha("Pendente"),
      linha("Pendente"),
      linha("Em análise"),
      linha("Revisar", { data_analise: "19/10/2026" }),
      linha("Aprovado", { data_analise: "19/10/2026" }),
      linha("Reprovado", { data_analise: "2026-10-19" }),
      linha("Aprovado", { data_analise: "16/10/2026" }),
      // Outro edital não entra; o mesmo número com zero à esquerda, sim.
      linha("Pendente", { edital: "93/2026" }),
      linha("Pendente", { edital: "Edital 0114/2026 (Projetos)" }),
    ];
    const [e] = noMomentoDoResumo([edital()], linhas, "2026-10-19");
    expect(e.situacoes).toEqual({
      pendente: 3,
      em_analise: 1,
      revisar: 1,
      concluida: 3,
      fora_lote: 448,
    });
    // Hoje: as do resumo (2), não as ao vivo (148); os dias anteriores ficam.
    expect(e.porDia).toEqual([
      { dia: "2026-10-16", qt: 266 },
      { dia: "2026-10-19", qt: 2 },
    ]);
  });

  it("em Todos, só as linhas do pacote Ativo contam (Inativo e desativadas ficam fora)", () => {
    const linha = (status_consolidado, __escopo) => ({
      edital: "114/2026",
      status_consolidado,
      __escopo,
    });
    const [e] = noMomentoDoResumo(
      [edital()],
      [
        linha("Pendente", "ativo"),
        linha("Aprovado", "ativo"),
        linha("Pendente", "desativadas"),
        linha("Pendente", "inativo"),
        // Linha sem a marca (payload antigo): conta, como antes.
        linha("Pendente", undefined),
      ],
      "2026-10-19",
    );
    expect(e.situacoes.pendente).toBe(2);
    expect(e.situacoes.concluida).toBe(1);
  });

  it("edital sem linha no resumo sai", () => {
    expect(noMomentoDoResumo([edital()], [], "2026-10-19")).toEqual([]);
    expect(noMomentoDoResumo([edital()], null, "2026-10-19")).toEqual([]);
  });

  it("o momento é o do 'Conferido às' do topo", () => {
    const agora = new Date("2026-10-19T15:00:00Z");
    expect(textoDoMomento("114/2026", "2026-10-19T14:20:00Z", agora)).toBe(
      "Conferido às 11:20 · só o 114/2026",
    );
    expect(textoDoMomento("114/2026", null, agora)).toBe("Só o 114/2026");
  });
});

describe("recolher o card: escolha de cada pessoa", () => {
  afterEach(() => localStorage.clear());

  it("recolhido por padrão; aberto fica guardado só para quem abriu", () => {
    expect(lerRitmoRecolhido("u1")).toBe(true);
    gravarRitmoRecolhido("u1", false);
    expect(lerRitmoRecolhido("u1")).toBe(false);
    expect(lerRitmoRecolhido("u2")).toBe(true);
    gravarRitmoRecolhido("u1", true);
    expect(lerRitmoRecolhido("u1")).toBe(true);
  });
});

describe("destaques de hoje: medalhas e selo Precisão", () => {
  const HOJE = "2026-10-21";
  const retrato = (avaliadores, dia = HOJE) => ({ dia, avaliadores });
  const a = (nome, qt, reabertas = 0) => ({ nome, qt, reabertas });

  it("as três maiores contagens levam ouro, prata e bronze; empate leva a mesma", () => {
    const { medalhas } = destaquesDoDia(
      retrato([
        a("Bruna Lima", 30),
        a("Ana Souza", 30),
        a("Caio Reis", 25),
        a("Davi Melo", 20),
        a("Eva Dias", 12),
      ]),
      HOJE,
    );
    expect(medalhas.map((m) => [m.posicao, m.nome])).toEqual([
      [1, "Ana Souza"],
      [1, "Bruna Lima"],
      [2, "Caio Reis"],
      [3, "Davi Melo"],
    ]);
  });

  it("selo Precisão: mínimo de fichas no dia e nenhuma reaberta", () => {
    expect(MINIMO_DO_SELO).toBe(10);
    const { precisao } = destaquesDoDia(
      retrato([
        a("Ana Souza", 40, 1), // ouro, mas teve ficha reaberta: sem selo
        a("Caio Reis", 15),
        a("Davi Melo", 10),
        a("Eva Dias", 9), // pódio (bronze), abaixo do mínimo: sem selo
      ]),
      HOJE,
    );
    expect(precisao).toEqual(["Caio Reis", "Davi Melo"]);
  });

  it("zera no dia seguinte: retrato de ontem não mostra nada", () => {
    const ontem = retrato([a("Ana Souza", 40)], "2026-10-20");
    expect(destaquesDoDia(ontem, HOJE)).toEqual({ medalhas: [], precisao: [] });
    expect(destaquesDoDia(ontem, "2026-10-20").medalhas).toHaveLength(1);
    expect(destaquesDoDia(null, HOJE).medalhas).toEqual([]);
  });

  it("lê o campo da RPC e o card só calcula para hoje", () => {
    const [e] = lerRitmoDaAnalise({
      editais: [
        {
          id: "x",
          edital: "114/2026",
          destaques: {
            dia: HOJE,
            avaliadores: [
              { nome: "Ana Souza", qt: "12", reabertas: 0 },
              { nome: "", qt: 5 },
              { nome: "Sem fichas", qt: 0 },
            ],
          },
        },
        { id: "y", edital: "1/2026" },
      ],
    });
    expect(e.destaques).toEqual({
      dia: HOJE,
      avaliadores: [{ nome: "Ana Souza", qt: 12, reabertas: 0 }],
    });
    const r = calcularRitmo(edital({ destaques: e.destaques }), {
      hoje: HOJE,
      hora: 10,
    });
    expect(r.destaques.medalhas[0]).toMatchObject({
      nome: "Ana Souza",
      posicao: 1,
    });
    expect(r.destaques.precisao).toEqual(["Ana Souza"]);
    expect(
      calcularRitmo(edital({ destaques: e.destaques }), {
        hoje: "2026-10-22",
        hora: 10,
      }).destaques.medalhas,
    ).toEqual([]);
  });

  it("meta da equipe batida: o edital cujo selo do dia é 'batida'", () => {
    const agora = { hoje: "2026-10-19", hora: 15 };
    const batida = calcularRitmo(
      edital({ porDia: [{ dia: "2026-10-19", qt: 400 }] }),
      agora,
    );
    expect(batida.dia.situacao).toBe("batida");
    expect(metaDaEquipeBatida([batida])).toBe(batida);
    expect(metaDaEquipeBatida([calcularRitmo(edital(), agora)])).toBeNull();
  });
});
