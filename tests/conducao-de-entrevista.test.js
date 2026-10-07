import { describe, expect, it } from "vitest";
import {
  aplicarRoteiroNaConfiguracao,
  avaliadoresDaFicha,
  calcularEntrevista,
  completarMembrosPelaComposicao,
  dadosDaConfiguracaoParaSalvar,
  editaisParaConduzir,
  errosDaConfiguracao,
  filtrarConvocados,
  mapaDasAvaliacoes,
  mensagemDoErroDaEntrevista,
  motivosDoParecer,
  notasAlteradas,
  podeLancarPor,
  progressoDasNotas,
  rascunhoDaConfiguracao,
} from "../src/lib/conducao-de-entrevista.js";

const CONVOCACAO = {
  multiplo_imediatas: 5,
  posicao_cadastro_reserva: 10,
  excecoes: [
    {
      termo_cargo: "Enfermagem",
      multiplo_imediatas: 10,
      posicao_cadastro_reserva: 20,
    },
  ],
};

const NIVEIS = {
  id: "r1",
  versao: 1,
  escala: "NIVEIS",
  nota_minima_total: 8,
  notas_eliminatorias: [0, 1],
  ausencia_elimina: true,
  competencias: [1, 2, 3, 4].map((ordem) => ({
    id: `c${ordem}`,
    ordem,
    nome: `C${ordem}`,
    nota_maxima: 5,
    peso: 1,
    minimo: 2,
    tipo_minimo: "VALOR",
  })),
  niveis: [0, 1, 2, 3, 4, 5].map((nota) => ({ nota, nome: `N${nota}` })),
  convocacao_padrao: CONVOCACAO,
  banca_padrao: [
    { origem: "AgSUS", quantidade: 1 },
    { origem: "CONDISI", quantidade: 2 },
  ],
};

const FAIXA = {
  id: "r2",
  escala: "FAIXA",
  passo: 0.5,
  nota_minima_total: 5,
  notas_eliminatorias: [],
  ausencia_elimina: false,
  competencias: [
    {
      id: "p1",
      ordem: 1,
      nome: "Técnica",
      nota_maxima: 2,
      peso: 1,
      minimo: 50,
      tipo_minimo: "PERCENTUAL",
    },
    {
      id: "p2",
      ordem: 2,
      nome: "Intercultural",
      nota_maxima: 2,
      peso: 1.5,
      minimo: 50,
      tipo_minimo: "PERCENTUAL",
    },
  ],
};

/* Notas de dois avaliadores: `{ competencia: [nota do a1, nota do a2] }`. */
const notas = (porCompetencia) =>
  Object.entries(porCompetencia).flatMap(([competencia, valores]) =>
    valores.map((nota, i) => ({ competencia, avaliador: `a${i + 1}`, nota })),
  );

describe("cálculo do resultado (espelho de FC_CALCULAR_ENTREVISTA)", () => {
  it("APTO: média × peso por competência, total e mínimos cumpridos", () => {
    const r = calcularEntrevista({
      roteiro: NIVEIS,
      compareceu: "S",
      avaliacoes: notas({ c1: [3, 4], c2: [2, 3], c3: [5, 5], c4: [2, 2] }),
    });
    expect(r.competencias.map((c) => c.nota)).toEqual([3.5, 2.5, 5, 2]);
    expect(r.total).toBe(13);
    expect(r.parecer).toBe("APTO");
  });

  it("INAPTO por média eliminatória, por mínimo da competência e pelo total", () => {
    const eliminatoria = calcularEntrevista({
      roteiro: NIVEIS,
      compareceu: "S",
      avaliacoes: notas({ c1: [1, 1], c2: [5, 5], c3: [5, 5], c4: [5, 5] }),
    });
    expect(eliminatoria.competencias[0]).toMatchObject({
      media: 1,
      eliminatoria: true,
      abaixoDoMinimo: true,
    });
    expect(eliminatoria.parecer).toBe("INAPTO");

    // média 1,5 não é eliminatória, mas fica abaixo do mínimo 2.
    const minimo = calcularEntrevista({
      roteiro: NIVEIS,
      compareceu: "S",
      avaliacoes: notas({ c1: [1, 2], c2: [5, 5], c3: [5, 5], c4: [5, 5] }),
    });
    expect(minimo.competencias[0]).toMatchObject({
      media: 1.5,
      eliminatoria: false,
      abaixoDoMinimo: true,
    });
    expect(minimo.parecer).toBe("INAPTO");

    const total = calcularEntrevista({
      roteiro: { ...NIVEIS, nota_minima_total: 12 },
      compareceu: "S",
      avaliacoes: notas({ c1: [2, 2], c2: [2, 2], c3: [3, 3], c4: [2, 2] }),
    });
    expect(total.total).toBe(9);
    expect(total.parecer).toBe("INAPTO");
    expect(total.abaixoDoMinimoTotal).toBe(true);
  });

  it("peso e mínimo percentual (1,5 = +50%)", () => {
    const r = calcularEntrevista({
      roteiro: FAIXA,
      compareceu: "S",
      avaliacoes: notas({ p1: [2, 1.5], p2: [1.5, 2] }),
    });
    expect(r.competencias.map((c) => c.nota)).toEqual([1.75, 2.63]);
    expect(r.competencias[1].minimo).toBe(1.5);
    expect(r.total).toBe(4.38);
    expect(r.parecer).toBe("INAPTO"); // total < 5
  });

  it("média de quem lançou; competência sem nota = SEM_PARECER", () => {
    const r = calcularEntrevista({
      roteiro: NIVEIS,
      compareceu: "S",
      avaliacoes: [
        { competencia: "c1", avaliador: "a1", nota: 4 },
        { competencia: "c2", avaliador: "a1", nota: 4 },
        { competencia: "c3", avaliador: "a1", nota: 4 },
      ],
    });
    expect(r.falta).toBe(true);
    expect(r.total).toBe(12);
    expect(r.parecer).toBe("SEM_PARECER");
    expect(motivosDoParecer(r, "S", NIVEIS)).toEqual(["Sem nota em “C4”."]);
    expect(
      calcularEntrevista({ roteiro: NIVEIS, compareceu: "S", avaliacoes: [] })
        .total,
    ).toBeNull();
  });

  it("comparecimento: falta elimina (ou não), não informado fica sem parecer", () => {
    const todas = notas({ c1: [5], c2: [5], c3: [5], c4: [5] });
    const faltou = calcularEntrevista({
      roteiro: NIVEIS,
      compareceu: "N",
      avaliacoes: todas,
    });
    expect(faltou).toMatchObject({ total: 0, parecer: "INAPTO" });
    expect(motivosDoParecer(faltou, "N", NIVEIS)[0]).toMatch(
      /ausência elimina/,
    );
    expect(
      calcularEntrevista({
        roteiro: { ...NIVEIS, ausencia_elimina: false },
        compareceu: "N",
        avaliacoes: todas,
      }).parecer,
    ).toBe("SEM_PARECER");
    expect(
      calcularEntrevista({
        roteiro: NIVEIS,
        compareceu: null,
        avaliacoes: todas,
      }).parecer,
    ).toBe("SEM_PARECER");
  });

  it("total no mínimo exato é APTO (3,3 + 4,85 + 3,85 = 12, sem o 11,999… do ponto flutuante)", () => {
    const competencia = (id, ordem) => ({
      id,
      ordem,
      nome: id,
      nota_maxima: 5,
      peso: 1,
    });
    const r = calcularEntrevista({
      roteiro: {
        escala: "FAIXA",
        nota_minima_total: 12,
        notas_eliminatorias: [],
        competencias: [
          competencia("t1", 1),
          competencia("t2", 2),
          competencia("t3", 3),
        ],
      },
      compareceu: "S",
      avaliacoes: notas({ t1: [3.3], t2: [4.85], t3: [3.85] }),
    });
    expect(r.total).toBe(12);
    expect(r.abaixoDoMinimoTotal).toBe(false);
    expect(r.parecer).toBe("APTO");
  });

  it("mínimo percentual sem arredondar, como o banco: 10,84% de 10 = 1,084 e a nota 1,08 fica abaixo", () => {
    const r = calcularEntrevista({
      roteiro: {
        escala: "FAIXA",
        notas_eliminatorias: [],
        competencias: [
          {
            id: "m1",
            ordem: 1,
            nome: "Técnica",
            nota_maxima: 10,
            peso: 1,
            minimo: 10.84,
            tipo_minimo: "PERCENTUAL",
          },
        ],
      },
      compareceu: "S",
      avaliacoes: notas({ m1: [1.08] }),
    });
    expect(r.competencias[0].minimo).toBe(1.084);
    expect(r.competencias[0].abaixoDoMinimo).toBe(true);
    expect(r.parecer).toBe("INAPTO");
  });
});

describe("ficha de notas", () => {
  const AVALIADORES = [
    { id: "a1", nome: "Ana", banca: 1, perfil: "p-ana", ativo: true },
    { id: "a2", nome: "Beto", banca: 1, perfil: null, ativo: true },
    { id: "a3", nome: "Caio", banca: 2, perfil: null, ativo: true },
    { id: "a4", nome: "Dora", banca: 1, perfil: null, ativo: false },
  ];

  it("só envia o que mudou (null apaga a nota)", () => {
    const original = mapaDasAvaliacoes([
      { competencia: "c1", avaliador: "a1", nota: 3 },
      { competencia: "c2", avaliador: "a1", nota: 4 },
    ]);
    expect(original).toEqual({ "c1|a1": "3", "c2|a1": "4" });
    const atual = { ...original, "c1|a1": "3.0", "c2|a1": "", "c3|a2": "5" };
    expect(notasAlteradas(original, atual)).toEqual([
      { competencia: "c2", avaliador: "a1", nota: null },
      { competencia: "c3", avaliador: "a2", nota: 5 },
    ]);
  });

  it("avaliadores da banca, mais quem já deu nota", () => {
    const convocado = {
      avaliacoes: [{ competencia: "c1", avaliador: "a4", nota: 3 }],
    };
    expect(
      avaliadoresDaFicha(AVALIADORES, convocado, 1).map((a) => a.id),
    ).toEqual(["a1", "a2", "a4"]);
    expect(
      avaliadoresDaFicha(AVALIADORES, { avaliacoes: [] }, null).map(
        (a) => a.id,
      ),
    ).toEqual(["a1", "a2", "a3"]);
    expect(
      progressoDasNotas(
        convocado,
        AVALIADORES.slice(0, 2),
        NIVEIS.competencias,
      ),
    ).toEqual({
      lancadas: 0,
      esperadas: 8,
    });
  });

  it("modo AVALIADOR: só a própria coluna (o admin global lança por todos)", () => {
    const base = {
      pode_editar: true,
      meu_perfil: "p-ana",
      admin_global: false,
      configuracao: { lancamento: "AVALIADOR" },
    };
    expect(podeLancarPor(base, AVALIADORES[0])).toBe(true);
    expect(podeLancarPor(base, AVALIADORES[1])).toBe(false);
    expect(podeLancarPor({ ...base, admin_global: true }, AVALIADORES[1])).toBe(
      true,
    );
    expect(
      podeLancarPor(
        { ...base, configuracao: { lancamento: "SECRETARIA" } },
        AVALIADORES[1],
      ),
    ).toBe(true);
    expect(podeLancarPor({ ...base, pode_editar: false }, AVALIADORES[0])).toBe(
      false,
    );
    expect(podeLancarPor({ ...base, admin_global: true }, AVALIADORES[3])).toBe(
      false,
    );
  });

  it("filtra os convocados por vaga, banca e busca", () => {
    const lista = [
      { id: "1", candidato: "João", codigo: "C1", vaga: "V1", banca: 1 },
      { id: "2", candidato: "Maria", codigo: "C2", vaga: "V2", banca: null },
    ];
    expect(
      filtrarConvocados(lista, { vaga: "V1", banca: "", busca: "" }).map(
        (c) => c.id,
      ),
    ).toEqual(["1"]);
    expect(
      filtrarConvocados(lista, { vaga: "", banca: "sem", busca: "" }).map(
        (c) => c.id,
      ),
    ).toEqual(["2"]);
    expect(
      filtrarConvocados(lista, { vaga: "", banca: "", busca: "joao" }).map(
        (c) => c.id,
      ),
    ).toEqual(["1"]);
  });
});

describe("configuração do edital", () => {
  const DADOS = {
    meu_perfil: "p1",
    configuracao: null,
    avaliadores: [
      {
        id: "a1",
        nome: "Ana",
        origem: "AgSUS",
        banca: 1,
        perfil: null,
        ativo: true,
      },
      {
        id: "a2",
        nome: "Saiu",
        origem: "DSEI",
        banca: 1,
        perfil: null,
        ativo: false,
      },
    ],
    convocados: [],
  };

  it("escolher o roteiro pré-preenche a banca; convocação e vagas não são da entrevista", () => {
    const r = aplicarRoteiroNaConfiguracao(
      rascunhoDaConfiguracao(DADOS),
      NIVEIS,
    );
    expect(r.roteiro).toBe("r1");
    expect(r.banca.map((b) => b.origem)).toEqual(["AgSUS", "CONDISI"]);
    expect(r.avaliadores.map((a) => a.id)).toEqual(["a1"]);
    expect(r).not.toHaveProperty("convocacao");
    expect(r).not.toHaveProperty("vagas");
  });

  it("completa os membros pela composição e valida", () => {
    const r = aplicarRoteiroNaConfiguracao(
      rascunhoDaConfiguracao(DADOS),
      NIVEIS,
    );
    const membros = completarMembrosPelaComposicao(r.avaliadores, r.banca);
    expect(membros.map((a) => a.origem)).toEqual([
      "AgSUS",
      "CONDISI",
      "CONDISI",
    ]);
    const erros = errosDaConfiguracao({ ...r, avaliadores: membros });
    expect(Object.keys(erros).filter((k) => k.endsWith(".nome"))).toHaveLength(
      2,
    );
    expect(errosDaConfiguracao({ ...r, roteiro: "" }).roteiro).toBeTruthy();
  });

  it("monta o p_dados de configurar_entrevista_edital", () => {
    const r = aplicarRoteiroNaConfiguracao(
      rascunhoDaConfiguracao(DADOS),
      NIVEIS,
    );
    const dados = dadosDaConfiguracaoParaSalvar({
      ...r,
      lancamento: "AVALIADOR",
      avaliadores: [
        ...r.avaliadores,
        {
          chave: "x",
          id: null,
          nome: " Bia ",
          origem: "CONDISI",
          banca: "2",
          perfil: "",
        },
      ],
    });
    expect(dados).toEqual({
      roteiro: "r1",
      banca: NIVEIS.banca_padrao,
      lancamento: "AVALIADOR",
      avaliadores: [
        { id: "a1", nome: "Ana", origem: "AgSUS", banca: 1, perfil: null },
        { nome: "Bia", origem: "CONDISI", banca: 2, perfil: null },
      ],
    });
  });
});

describe("editais e erros", () => {
  it("marca os que já têm entrevistas e não acrescenta edital fora da lista", () => {
    const lista = editaisParaConduzir(
      [
        { id: "m2", edital: "105/2026", unidade: "DSEI Litoral Sul" },
        { id: "m1", edital: "100/2026", unidade: "CASAI Brasília" },
      ],
      [
        { edital_id: "m1", edital: "100/2026" },
        { edital_id: "m3", edital: "110/2026", unidade: "DSEI Porto Velho" },
        { edital_id: null, edital: "sem id" },
      ],
    );
    expect(lista.map((e) => [e.id, e.comEntrevistas])).toEqual([
      ["m2", false],
      ["m1", true],
    ]);
  });

  it("descreve a janela e o motivo de o edital aparecer", async () => {
    const { marcaDoEdital, textoDaJanela } =
      await import("../src/lib/conducao-de-entrevista.js");
    const [liberado, fora, pendente, semCronograma] = editaisParaConduzir(
      [
        {
          id: "a",
          edital: "120/2026",
          na_janela: false,
          visivel_por: "liberado",
          liberado_ate: "2026-11-15",
          janela_inicio: "2026-12-01",
          janela_fim: "2026-12-20",
        },
        { id: "b", edital: "119/2026", na_janela: false, visivel_por: "admin" },
        {
          id: "c",
          edital: "118/2026",
          na_janela: false,
          visivel_por: "convocados",
          pendentes: 3,
        },
        { id: "d", edital: "117/2026", na_janela: true, visivel_por: "janela" },
      ],
      [],
    );
    expect(marcaDoEdital(liberado)).toBe("liberado até 15/11");
    expect(marcaDoEdital(fora)).toBe("fora da janela");
    expect(marcaDoEdital(pendente)).toBe("3 sem parecer");
    expect(marcaDoEdital(semCronograma)).toBe("");
    expect(textoDaJanela(liberado)).toBe("janela da entrevista: 01/12 a 20/12");
    expect(textoDaJanela(fora)).toBe("sem etapa de entrevista no cronograma");
  });

  it("traduz os códigos das RPCs", () => {
    expect(
      mensagemDoErroDaEntrevista({
        code: "22023",
        message: "Nota 7 fora da faixa",
      }),
    ).toBe("Dado inválido: Nota 7 fora da faixa.");
    expect(
      mensagemDoErroDaEntrevista({
        code: "42501",
        message: "Neste edital cada avaliador lança a própria nota",
      }),
    ).toMatch(/^Sem permissão: Neste edital/);
    expect(
      mensagemDoErroDaEntrevista({
        code: "23514",
        message: "Configure a entrevista do edital antes de convocar",
      }),
    ).toBe("Configure a entrevista do edital antes de convocar.");
    expect(mensagemDoErroDaEntrevista({ code: "PGRST202" })).toMatch(
      /publicada/,
    );
  });
});

describe("ajustes de 30/09: ordem dos editais e nome do cargo", () => {
  it("editais do mais novo para o mais antigo", async () => {
    const { editaisParaConduzir } =
      await import("../src/lib/conducao-de-entrevista.js");
    const lista = editaisParaConduzir(
      [
        { id: "a", edital: "03/2025", unidade: "X" },
        { id: "b", edital: "06/2026", unidade: "Y" },
        { id: "c", edital: "110/2026", unidade: "Z" },
      ],
      [],
    );
    expect(lista.map((e) => e.edital)).toEqual([
      "110/2026",
      "06/2026",
      "03/2025",
    ]);
  });

  it("tira o resto da planilha do nome do cargo", async () => {
    const { nomeDoCargo } =
      await import("../src/lib/conducao-de-entrevista.js");
    expect(
      nomeDoCargo(
        "Enfermeiro - DSEI Porto Velho em Excel (questionário NÍVEL SUPERIOR",
      ),
    ).toBe("Enfermeiro - DSEI Porto Velho");
    expect(nomeDoCargo("Analista Técnico de Saúde Indígena")).toBe(
      "Analista Técnico de Saúde Indígena",
    );
  });
});

describe("selo PcD", () => {
  it("só o sim da planilha conta como PcD", async () => {
    const { ehPcd } = await import("../src/lib/conducao-de-entrevista.js");
    expect(["SIM", "Sim", " s ", "true", true, 1].map(ehPcd)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(
      ["NÃO", "Não", "nao", "N", "", null, undefined, false, 0].map(ehPcd),
    ).toEqual(Array(9).fill(false));
  });
});

describe("ficha com aspectos", async () => {
  const lib = await import("../src/lib/conducao-de-entrevista.js");
  const ASPECTOS = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];

  it("mapa por aspecto, ida e volta", () => {
    const mapa = lib.mapaDasAvaliacoes(
      [
        {
          competencia: "c1",
          avaliador: "a1",
          nota: 1.33,
          aspectos: [
            { aspecto: "s1", nota: 2 },
            { aspecto: "s2", nota: 1 },
            { aspecto: "s3", nota: 1 },
          ],
        },
      ],
      ASPECTOS,
    );
    expect(mapa).toEqual({ "c1|a1|s1": "2", "c1|a1|s2": "1", "c1|a1|s3": "1" });
    expect(lib.avaliacoesDoMapa(mapa, ASPECTOS)).toEqual([
      {
        competencia: "c1",
        avaliador: "a1",
        aspectos: [
          { aspecto: "s1", nota: 2 },
          { aspecto: "s2", nota: 1 },
          { aspecto: "s3", nota: 1 },
        ],
      },
    ]);
  });

  it("alteradas: todos os aspectos, nulo ao apagar; incompleta fica de fora", () => {
    const original = { "c1|a1|s1": "2", "c1|a1|s2": "1", "c1|a1|s3": "1" };
    const atual = {
      "c1|a1|s1": "",
      "c1|a1|s2": "",
      "c1|a1|s3": "",
      "c1|a2|s1": "3",
      "c2|a1|s1": "4",
      "c2|a1|s2": "4",
      "c2|a1|s3": "5",
    };
    expect(lib.notasAlteradas(original, atual, ASPECTOS)).toEqual([
      { competencia: "c1", avaliador: "a1", aspectos: null },
      {
        competencia: "c2",
        avaliador: "a1",
        aspectos: [
          { aspecto: "s1", nota: 4 },
          { aspecto: "s2", nota: 4 },
          { aspecto: "s3", nota: 5 },
        ],
      },
    ]);
    expect(lib.aspectosIncompletos(atual, ASPECTOS)).toEqual([
      { competencia: "c1", avaliador: "a2" },
    ]);
  });

  it("média dos aspectos só com todos", () => {
    expect(
      lib.mediaDosAspectos(ASPECTOS, { s1: "2", s2: "2", s3: "3" }),
    ).toBeCloseTo(7 / 3);
    expect(lib.mediaDosAspectos(ASPECTOS, { s1: "2" })).toBeNull();
  });
});
