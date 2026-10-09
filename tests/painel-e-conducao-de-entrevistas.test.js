import { describe, expect, it } from "vitest";
import {
  andamentoDaEntrevista,
  FILTROS_VAZIOS,
  filtrarEntrevistas,
  pendenciasDasEntrevistas,
} from "../src/lib/entrevistas-do-painel.ts";
import {
  contadorDoDia,
  contagemDosRecortes,
  iniciais,
  montarFila,
  progressoDoConvocado,
  recortarFila,
  recorteInicial,
  resumoDasSituacoes,
  rotuloDoDia,
  situacaoDoConvocado,
  vagasDaFila,
} from "../src/lib/fila-de-conducao.ts";
import {
  editalDoRecorte,
  gruposEmpatados,
  mapaDeEmpates,
  proximosDiasDaAgenda,
} from "../src/lib/painel-de-entrevistas.ts";
import {
  criteriosDeDesempate,
  textoDoEmpateFinal,
} from "../src/lib/convocacao-da-entrevista.js";
import { destinoDaTela } from "../src/lib/navegacao.js";
import { paginasPermitidas } from "../src/lib/access-roles.js";
import { bloqueioDaTela } from "../src/lib/navegacao.js";

/*
  O painel (acompanhar) e Conduzir entrevistas (fazer), sem React: a fila do
  dia (situações, recortes, contador), o edital do recorte, os
  empates na nota da entrevista, a agenda dos próximos dias, as pendências de
  andamento, o desempate da Classificação e os links antigos.
*/

const HOJE = "2026-10-07";

it("IDs externos inválidos não viram destinos da agenda ou do desempate", () => {
  const entrevistas = [
    {
      id: "e1",
      edital: "93/2026",
      edital_id: { id: "externo" },
      vaga: "V1",
      nota: 12,
      compareceu: "S",
    },
    {
      id: "e2",
      edital: "93/2026",
      edital_id: 7,
      vaga: "V1",
      nota: 12,
      compareceu: "S",
    },
  ];
  expect(editalDoRecorte(entrevistas, "").editalId).toBeNull();
  expect(gruposEmpatados(entrevistas)[0].editalId).toBeNull();
  entrevistas[1].edital_id = "edital-real";
  expect(editalDoRecorte(entrevistas, "").editalId).toBe("edital-real");
});
const comp = [{ id: "c1" }, { id: "c2" }];
const avaliadores = [
  { id: "a1", banca: 1, ativo: true },
  { id: "a2", banca: 1, ativo: true },
];
const nota = (competencia, avaliador, valor = 3) => ({
  competencia,
  avaliador,
  nota: valor,
});
const todas = ["c1", "c2"].flatMap((c) => [nota(c, "a1"), nota(c, "a2")]);

const convocados = [
  {
    id: "e1",
    analise_id: "an1",
    candidato: "Ana Lúcia Terena",
    vaga: "V1",
    banca: 1,
    compareceu: null,
    parecer: "SEM_PARECER",
    avaliacoes: [],
  },
  {
    id: "e2",
    analise_id: "an2",
    candidato: "Bruno",
    vaga: "V2",
    banca: 1,
    compareceu: "S",
    parecer: "SEM_PARECER",
    avaliacoes: [nota("c1", "a1")],
  },
  {
    id: "e3",
    analise_id: "an3",
    candidato: "Carla da Silva",
    vaga: "V1",
    banca: 1,
    compareceu: "S",
    parecer: "APTO",
    avaliacoes: todas,
  },
  {
    id: "e4",
    analise_id: "an4",
    candidato: "Diego",
    vaga: "V2",
    banca: 1,
    compareceu: "N",
    parecer: "INAPTO",
    avaliacoes: [],
  },
  {
    id: "e5",
    analise_id: "an5",
    candidato: "Eva",
    vaga: "V1",
    banca: 1,
    compareceu: null,
    parecer: "SEM_PARECER",
    avaliacoes: [],
  },
  {
    id: "e6",
    analise_id: null,
    candidato: "Fábio",
    vaga: "V3",
    banca: null,
    compareceu: null,
    parecer: "SEM_PARECER",
    avaliacoes: [],
  },
];
const agenda = {
  itens: [
    {
      analise_id: "an2",
      data: HOJE,
      inicio: "09:00:00",
      fim: "09:30",
      banca: 1,
    },
    { analise_id: "an1", data: HOJE, inicio: "08:00", fim: "08:30", banca: 1 },
    { analise_id: "an3", data: HOJE, inicio: "10:00", fim: "10:30", banca: 2 },
    { analise_id: "an4", data: HOJE, inicio: "11:00", fim: "11:30", banca: 1 },
    {
      analise_id: "an5",
      data: "2026-10-08",
      inicio: "08:00",
      fim: "08:30",
      banca: 1,
    },
  ],
};
const dados = {
  convocados,
  avaliadores,
  configuracao: { roteiro: { competencias: comp } },
};

describe("fila de Conduzir entrevistas", () => {
  const fila = montarFila(dados, agenda);

  it("junta a agenda, ordena por dia e horário (sem horário no fim) e dá a situação de cada um", () => {
    expect(fila.map((i) => [i.id, i.inicio, i.situacao])).toEqual([
      ["e1", "08:00", "aguardando"],
      ["e2", "09:00", "em_andamento"],
      ["e3", "10:00", "concluida"],
      ["e4", "11:00", "faltou"],
      ["e5", "08:00", "aguardando"],
      ["e6", null, "aguardando"],
    ]);
    expect(fila.find((i) => i.id === "e3")).toMatchObject({
      banca: 2,
      lancadas: 4,
      esperadas: 4,
    });
  });

  it("todas as notas lançadas (mesmo sem parecer) conta como concluída; aspectos contam o par uma vez", () => {
    const comAspectos = {
      ...convocados[1],
      avaliacoes: [...todas, { ...nota("c1", "a1"), aspecto: "x" }],
    };
    const p = progressoDoConvocado(comAspectos, avaliadores, comp);
    expect(p).toEqual({ lancadas: 4, esperadas: 4 });
    expect(situacaoDoConvocado(comAspectos, p)).toBe("concluida");
  });

  it("recortes Hoje / Próximos / Todos, vaga e o recorte inicial", () => {
    expect(contagemDosRecortes(fila, HOJE)).toEqual({
      hoje: 4,
      proximos: 1,
      todos: 6,
    });
    expect(recorteInicial(fila, HOJE)).toBe("hoje");
    expect(recorteInicial(fila, "2026-10-08")).toBe("hoje");
    expect(recorteInicial(fila, "2026-10-01")).toBe("proximos");
    expect(recorteInicial(montarFila(dados, null), HOJE)).toBe("todos");
    expect(
      recortarFila(fila, { recorte: "hoje", vaga: "V2", hoje: HOJE }).map(
        (i) => i.id,
      ),
    ).toEqual(["e2", "e4"]);
    expect(
      recortarFila(fila, { recorte: "proximos", hoje: HOJE }).map((i) => i.id),
    ).toEqual(["e5"]);
    expect(vagasDaFila(fila)).toEqual(["V1", "V2", "V3"]);
  });

  it("contador do dia: concluídas e faltas entre as de hoje; completo só com todas", () => {
    expect(contadorDoDia(fila, HOJE)).toEqual({
      feitas: 2,
      total: 4,
      completo: false,
    });
    const feitas = montarFila(
      {
        ...dados,
        convocados: convocados.map((c) =>
          c.id === "e1" || c.id === "e2" ? { ...c, compareceu: "N" } : c,
        ),
      },
      agenda,
    );
    expect(contadorDoDia(feitas, HOJE)).toEqual({
      feitas: 4,
      total: 4,
      completo: true,
    });
    expect(contadorDoDia(fila, "2026-10-01").completo).toBe(false);
    expect(resumoDasSituacoes(fila)).toEqual({
      aguardando: 3,
      em_andamento: 1,
      concluida: 1,
      faltou: 1,
    });
  });

  it("iniciais do avatar e o rótulo do dia", () => {
    expect(iniciais("Ana Lúcia Terena")).toBe("AT");
    expect(iniciais("Carla da Silva")).toBe("CS");
    expect(iniciais("Bruno")).toBe("BR");
    expect(iniciais("  ")).toBe("?");
    expect(rotuloDoDia(HOJE, HOJE)).toBe("Hoje");
    expect(rotuloDoDia("2026-10-08", HOJE)).toBe("Amanhã");
    expect(rotuloDoDia("2026-10-09", HOJE)).toBe("sex., 09/10");
    expect(rotuloDoDia(null, HOJE)).toBe("Sem horário");
  });
});

const doPainel = (extra) => ({
  id: extra.id,
  edital_id: "m1",
  edital: "100/2026",
  unidade: "DSEI Xingu",
  vaga: "V1",
  cargo: "Enfermeiro",
  candidato: extra.id,
  nota: null,
  parecer: "SEM_PARECER",
  compareceu: null,
  ...extra,
});
const painel = [
  doPainel({ id: "p1", compareceu: "S", nota: 12, parecer: "APTO" }),
  doPainel({ id: "p2", compareceu: "S", nota: 12, parecer: "APTO" }),
  doPainel({ id: "p3", compareceu: "S", nota: 4, parecer: "INAPTO" }),
  doPainel({ id: "p4", compareceu: "N", parecer: "INAPTO" }),
  doPainel({ id: "p5", compareceu: "S" }),
  doPainel({ id: "p6", compareceu: "S", nota: 8 }),
  doPainel({
    id: "p7",
    vaga: "V2",
    compareceu: "S",
    nota: 12,
    parecer: "APTO",
  }),
  doPainel({
    id: "p8",
    edital: "83/2026",
    edital_id: "m2",
    vaga: "V1",
    compareceu: "S",
    nota: 12,
    parecer: "APTO",
  }),
];

describe("Painel de entrevistas", () => {
  it("edital do recorte: o filtrado ou, havendo um só, ele", () => {
    expect(editalDoRecorte(painel, "100/2026")).toEqual({
      edital: "100/2026",
      editalId: "m1",
    });
    expect(editalDoRecorte(painel, "")).toBeNull();
    expect(
      editalDoRecorte(
        painel.filter((e) => e.edital === "83/2026"),
        "",
      ),
    ).toEqual({ edital: "83/2026", editalId: "m2" });
    expect(editalDoRecorte(painel, "999/2026")).toBeNull();
  });

  it("empate: mesma nota no mesmo edital e na mesma vaga, só de quem compareceu", () => {
    const grupos = gruposEmpatados(painel);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]).toMatchObject({
      edital: "100/2026",
      editalId: "m1",
      vaga: "V1",
      nota: 12,
      ids: ["p1", "p2"],
    });
    expect([...mapaDeEmpates(grupos)]).toEqual([
      ["p1", 2],
      ["p2", 2],
    ]);
  });

  it("agenda dos próximos dias: de hoje em diante, por horário, até N dias", () => {
    const dias = proximosDiasDaAgenda(
      [
        { analise_id: "x", data: "2026-10-06", inicio: "08:00" },
        { analise_id: "b", data: HOJE, inicio: "10:00" },
        { analise_id: "a", data: HOJE, inicio: "08:00" },
        { analise_id: "c", data: "2026-10-09", inicio: "08:00" },
        { analise_id: "d", data: null, inicio: null },
      ],
      HOJE,
      1,
    );
    expect(dias).toEqual([
      {
        data: HOJE,
        itens: [
          { analise_id: "a", data: HOJE, inicio: "08:00" },
          { analise_id: "b", data: HOJE, inicio: "10:00" },
        ],
      },
    ]);
  });

  it("pendências de andamento e o filtro: sem comparecimento, sem nota, sem parecer", () => {
    const normal = (e) => ({
      ...e,
      divergente: false,
      semEdital: false,
      analise: {},
      busca: "",
    });
    const lista = painel.map(normal);
    expect(lista.map(andamentoDaEntrevista)).toEqual([
      "",
      "",
      "",
      "",
      "sem_nota",
      "sem_parecer",
      "",
      "",
    ]);
    const semCompareceu = normal(doPainel({ id: "p9" }));
    expect(andamentoDaEntrevista(semCompareceu)).toBe("sem_comparecimento");
    const p = Object.fromEntries(
      pendenciasDasEntrevistas([...lista, semCompareceu], []).map((x) => [
        x.chave,
        [x.valor, x.campo],
      ]),
    );
    expect(p.sem_comparecimento).toEqual([1, "andamento"]);
    expect(p.sem_nota).toEqual([1, "andamento"]);
    expect(p.sem_parecer).toEqual([1, "andamento"]);
    expect(
      filtrarEntrevistas(lista, {
        ...FILTROS_VAZIOS,
        andamento: "sem_nota",
      }).map((e) => e.id),
    ).toEqual(["p5"]);
    expect(
      filtrarEntrevistas(lista, { ...FILTROS_VAZIOS, vaga: "V2" }).map(
        (e) => e.id,
      ),
    ).toEqual(["p7"]);
  });
});

describe("desempate da entrevista é o da Classificação", () => {
  it("critérios do catálogo, na ordem, com o empate final", () => {
    const regra = {
      desempate: [
        { criterio: "NOTA_ENTREVISTA", direcao: "MAIOR_PRIMEIRO" },
        { criterio: "IDOSO_60" },
        { criterio: "INVENTADO" },
      ],
      empate_final: { metodo: "SORTEIO" },
    };
    expect(criteriosDeDesempate(regra).map((c) => c.codigo)).toEqual([
      "NOTA_ENTREVISTA",
      "IDOSO_60",
    ]);
    expect(criteriosDeDesempate(regra)[1].nome).toBe(
      "60 anos ou mais na data de corte",
    );
    expect(textoDoEmpateFinal(regra)).toBe("Sorteio registrado");
    // Banco antigo (sem a chave) ou sem regra: nada a mostrar.
    expect(criteriosDeDesempate({ convocacao: {} })).toBeNull();
    expect(criteriosDeDesempate(null)).toBeNull();
    expect(textoDoEmpateFinal(null)).toBe("");
  });
});

describe("menu e links antigos", () => {
  it("links antigos da tela de Entrevistas vão para o lugar novo", () => {
    expect(destinoDaTela("entrevistas:conduzir")).toEqual({
      view: "conduzir-entrevistas",
      visao: "fila",
    });
    expect(destinoDaTela("entrevistas:roteiros")).toEqual({
      view: "conduzir-entrevistas",
      visao: "preparar",
    });
    expect(destinoDaTela("entrevistas:resultados")).toEqual({
      view: "entrevistas",
      visao: "",
    });
    expect(destinoDaTela(" entrevistas ")).toEqual({
      view: "entrevistas",
      visao: "",
    });
  });

  it("quem acessa Entrevistas acessa o painel e Conduzir; sem o recurso, nenhum", () => {
    const perfil = (nivel) => ({
      perfil: "analista",
      permissoes: { entrevistas: nivel },
    });
    expect(paginasPermitidas(perfil("leitor"))).toMatchObject({
      entrevistas: true,
      "conduzir-entrevistas": true,
    });
    expect(paginasPermitidas(perfil("sem_acesso"))).toMatchObject({
      entrevistas: false,
      "conduzir-entrevistas": false,
    });
    expect(bloqueioDaTela("conduzir-entrevistas", perfil("leitor"))).toBe("");
    expect(bloqueioDaTela("conduzir-entrevistas", perfil("sem_acesso"))).toBe(
      "Sem permissão para Entrevistas.",
    );
  });
});
