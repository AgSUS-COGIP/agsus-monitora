import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TIPOS_DE_BLOCO } from "../../src/lib/avaliacao-documental/catalogo.js";
import {
  blocoNovo,
  codigoLivre,
  normalizarPergunta,
  normalizarRegraAnalise,
  perguntaDoTexto,
  regrasIguais,
  textoDaPergunta,
  validarRegraAnalise,
} from "../../src/lib/avaliacao-documental/regra.js";
import {
  linhaDaEquipe,
  resumoDaEquipe,
  validarEquipe,
} from "../../src/lib/avaliacao-documental/equipe.js";

/*
  Formato e validação da regra da avaliação documental (AM-2.x) e da equipe
  (AM-3.x). O banco repete a validação (FC_VALIDAR_REGRA_ANALISE); o ensaio
  da migration recusa as mesmas regras ruins.
*/
const { regras } = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
);
const boa = () => structuredClone(regras["PROJ26-CURRICULAR"]);
const comBloco = (codigo, mudar) => {
  const r = boa();
  mudar(r.blocos.find((b) => b.codigo === codigo));
  return r;
};

describe("validarRegraAnalise", () => {
  it.each(Object.keys(regras))("o modelo %s é válido", (codigo) => {
    expect(validarRegraAnalise(regras[codigo])).toEqual([]);
  });

  it("a regra normalizada de um objeto vazio só falta os blocos", () => {
    expect(validarRegraAnalise(normalizarRegraAnalise({}))).toEqual([
      "De 1 a 40 blocos.",
    ]);
  });

  it.each([
    ["não objeto", () => [], "Regra inválida"],
    ["schema 2", () => ({ ...boa(), schema: 2 }), "schema"],
    [
      "sem título da etapa",
      () => ({ ...boa(), titulo_etapa: "" }),
      "Título da etapa",
    ],
    [
      "bloco repetido",
      () => ({ ...boa(), blocos: [...boa().blocos, boa().blocos[0]] }),
      "repetido",
    ],
    [
      "código minúsculo",
      () => comBloco("IDENTIDADE", (b) => (b.codigo = "identidade")),
      "código",
    ],
    [
      "tipo inventado",
      () => comBloco("IDENTIDADE", (b) => (b.tipo = "FOTO")),
      "tipo desconhecido",
    ],
    [
      "efeito inventado",
      () => comBloco("IDENTIDADE", (b) => (b.efeitos.NAO_CONFORME = "SOME")),
      "efeito desconhecido",
    ],
    [
      "Conforme que elimina",
      () => comBloco("IDENTIDADE", (b) => (b.efeitos.CONFORME = "ELIMINA")),
      "Conforme não pode",
    ],
    [
      "documento que zera pontos",
      () =>
        comBloco("IDENTIDADE", (b) => (b.efeitos.NAO_CONFORME = "ZERA_PONTOS")),
      "só bloco que pontua",
    ],
    [
      "documento que encaminha",
      () =>
        comBloco(
          "IDENTIDADE",
          (b) => (b.efeitos.CONFORME = "ENCAMINHA_PERICIA"),
        ),
      "só bloco de cota",
    ],
    [
      "motivo sem texto",
      () => comBloco("IDENTIDADE", (b) => (b.motivos[0].texto = "")),
      "texto",
    ],
    [
      "condição inventada",
      () => comBloco("COTA_PP", (b) => (b.condicao = "SE_QUISER")),
      "condição",
    ],
    [
      "dois blocos de títulos",
      () => ({
        ...boa(),
        blocos: [
          ...boa().blocos,
          {
            ...boa().blocos.find((b) => b.tipo === "TITULOS"),
            codigo: "OUTRO",
          },
        ],
      }),
      "Só um bloco do tipo TITULOS",
    ],
    [
      "título desconhecido",
      () =>
        comBloco(
          "FORMACAO",
          (b) => (b.pontos_por_nivel.superior[0].titulo = "MBA"),
        ),
      "título conhecido",
    ],
    [
      "nível desconhecido",
      () => comBloco("FORMACAO", (b) => (b.pontos_por_nivel.pos = [])),
      "nível pos",
    ],
    [
      "faixa invertida",
      () => comBloco("CURSOS", (b) => (b.faixas[0].max_horas = 10)),
      "mínimo ≤ máximo",
    ],
    [
      "faixa por nível sem pontos",
      () =>
        comBloco("CURSOS", (b) => (b.por_nivel.tecnico.faixas[0].pontos = -1)),
      "tecnico, faixa 1",
    ],
    [
      "período zero",
      () => comBloco("EXPERIENCIA", (b) => (b.periodo_meses = 0)),
      "período",
    ],
    [
      "desempate repetido",
      () =>
        comBloco(
          "EXPERIENCIA",
          (b) =>
            b.categorias.push(
              { codigo: "OUTRA", rotulo: "Outra", desempate: null },
              { codigo: "MAIS", rotulo: "Mais", desempate: null },
            ) &&
            (b.categorias[1].desempate = 1) &&
            (b.categorias[2].desempate = 1),
        ),
      "desempate 1 repetido",
    ],
    [
      "data limite inválida",
      () => comBloco("EXPERIENCIA", (b) => (b.data_limite = "2026-02-30")),
      "data limite",
    ],
    [
      "lote sem múltiplo",
      () => ({
        ...boa(),
        lote: { ...boa().lote, base: "MULTIPLO_VAGAS", multiplo: 0 },
      }),
      "múltiplo",
    ],
    [
      "lote pela nota mínima sem a nota",
      () => ({
        ...boa(),
        lote: { ...boa().lote, base: "NOTA_MINIMA", nota_minima: null },
      }),
      "nota mínima",
    ],
    [
      "desempate pela experiência sem a pergunta",
      () => ({
        ...boa(),
        provisoria: {
          ...boa().provisoria,
          desempate: ["EXPERIENCIA_DECLARADA"],
          pergunta_experiencia: null,
        },
      }),
      "pergunta da experiência",
    ],
    [
      "lote fixo sem número",
      () => ({ ...boa(), lote: { ...boa().lote, base: "FIXO", fixo: null } }),
      "número fixo",
    ],
    [
      "distribuição inventada",
      () => ({ ...boa(), distribuicao: { modo: "SORTEIO" } }),
      "Distribuição",
    ],
    [
      "amostra acima de 100%",
      () => ({
        ...boa(),
        revisao: { ...boa().revisao, amostra_percentual: 150 },
      }),
      "amostra",
    ],
    [
      "nota mínima fora da regra de classificação",
      () => ({ ...boa(), corte: { fonte: "AQUI" } }),
      "regra de classificação",
    ],
    [
      "parecer sem modelo de apto",
      () => ({ ...boa(), parecer: { ...boa().parecer, APTO: "" } }),
      "Parecer (APTO)",
    ],
    [
      "eliminação sem coluna",
      () => ({
        ...boa(),
        provisoria: {
          ...boa().provisoria,
          eliminacao_automatica: [{ codigo: "X1", quando: ["A"], motivo: "m" }],
        },
      }),
      "coluna",
    ],
    [
      "nota declarada com pontos negativos",
      () => ({
        ...boa(),
        provisoria: {
          ...boa().provisoria,
          nota_declarada: [
            {
              parcial: "FORMACAO",
              pergunta: "Pergunta 1 -",
              tipo: "OPCAO",
              pontos: { Sim: -1 },
            },
          ],
        },
      }),
      "pontos de cada resposta",
    ],
    [
      "pergunta da experiência em lista vazia",
      () => ({
        ...boa(),
        provisoria: { ...boa().provisoria, pergunta_experiencia: [] },
      }),
      "lista de 1 a 10 textos",
    ],
    [
      "pergunta da nota declarada em lista com texto vazio",
      () => ({
        ...boa(),
        provisoria: {
          ...boa().provisoria,
          nota_declarada: [
            {
              parcial: "ETNICO",
              pergunta: ["Você é indígena", " "],
              tipo: "OPCAO",
              pontos: { Sim: 1 },
            },
          ],
        },
      }),
      "lista de 1 a 10 textos",
    ],
    [
      "observação pronta repetida",
      () => ({
        ...boa(),
        observacoes_prontas: [
          boa().observacoes_prontas[0],
          boa().observacoes_prontas[0],
        ],
      }),
      "repetido",
    ],
  ])("recusa %s", (_nome, montar, trecho) => {
    const erros = validarRegraAnalise(montar());
    expect(erros.join(" | ")).toContain(trecho);
  });
});

describe("a pergunta da regra: texto ou lista de alternativas", () => {
  const alternativas = [
    "Selecione sua Experiência Profissional",
    "Marque a pontuação referente a sua experiência profissional",
  ];

  it("aceita lista na experiência do desempate e na nota declarada", () => {
    const r = boa();
    r.provisoria.desempate = ["IDOSO", "EXPERIENCIA_DECLARADA"];
    r.provisoria.pergunta_experiencia = alternativas;
    r.provisoria.nota_declarada = [
      {
        parcial: "ETNICO",
        pergunta: ["Você é indígena e mora em aldeia", "Você é indígena"],
        tipo: "OPCOES_SOMADAS",
        pontos: { "Sou indígena": 8 },
        teto: 14,
      },
    ];
    expect(validarRegraAnalise(r)).toEqual([]);
  });

  it("normaliza: tira espaços e textos vazios; sem texto, null", () => {
    expect(normalizarPergunta([" a ", "", 3, "b"])).toEqual(["a", "b"]);
    expect(normalizarPergunta([" "])).toBeNull();
    expect(normalizarPergunta("  Experiência  ")).toBe("Experiência");
    expect(normalizarPergunta(undefined)).toBeNull();
    expect(
      normalizarRegraAnalise({ provisoria: { pergunta_experiencia: [" x "] } })
        .provisoria.pergunta_experiencia,
    ).toEqual(["x"]);
  });

  it("a tela mostra as alternativas separadas por ';' e lê de volta", () => {
    expect(textoDaPergunta(alternativas)).toBe(
      "Selecione sua Experiência Profissional; Marque a pontuação referente a sua experiência profissional",
    );
    expect(perguntaDoTexto(textoDaPergunta(alternativas))).toEqual(
      alternativas,
    );
    expect(perguntaDoTexto("Experiência Profissional ")).toBe(
      "Experiência Profissional",
    );
    expect(perguntaDoTexto(" ; ")).toBe("");
  });
});

describe("blocos novos", () => {
  it.each(TIPOS_DE_BLOCO.map(([tipo]) => tipo))(
    "%s nasce sem peso inventado e fica válido com título",
    (tipo) => {
      const bloco = { ...blocoNovo(tipo, "NOVO"), titulo: "Novo" };
      if (tipo === "TITULOS")
        bloco.pontos_por_nivel.superior.push({ titulo: "MESTRADO", pontos: 0 });
      const regra = { ...normalizarRegraAnalise({}), blocos: [bloco] };
      expect(validarRegraAnalise(regra)).toEqual([]);
      for (const chave of [
        "indigena",
        "aldeia",
        "pontos_por_mes",
        "pontos_por_periodo",
      ])
        if (chave in bloco) expect(bloco[chave]).toBe(0);
    },
  );

  it("código livre não repete", () => {
    expect(codigoLivre([{ codigo: "BLOCO_2" }])).toBe("BLOCO_3");
    expect(codigoLivre([])).toBe("BLOCO_1");
  });

  it("regras iguais ignoram a ordem das chaves", () => {
    expect(
      regrasIguais(
        { a: 1, b: [1, { c: 2, d: 3 }] },
        { b: [1, { d: 3, c: 2 }], a: 1 },
      ),
    ).toBe(true);
    expect(regrasIguais({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe("equipe do edital (AM-3)", () => {
  const ana = "00000000-0000-4000-a000-000000000001";
  const bia = "00000000-0000-4000-a000-000000000002";

  it("linha da tela vira o formato do banco", () => {
    expect(
      linhaDaEquipe({
        usuario: ana,
        papel: "analista",
        vaga: " 177979 ",
        limite: "30",
      }),
    ).toEqual({
      usuario: ana,
      papel: "ANALISTA",
      vaga: "177979",
      limite: 30,
    });
    expect(
      linhaDaEquipe({ usuario: ana, papel: "REVISOR", vaga: "", limite: "" }),
    ).toMatchObject({ vaga: null, limite: null });
  });

  it("confere pessoa, papel, vaga, limite e repetição", () => {
    expect(
      validarEquipe([
        { usuario: ana, papel: "ANALISTA" },
        { usuario: ana, papel: "REVISOR" },
      ]),
    ).toEqual([]);
    const erros = validarEquipe(
      [
        { usuario: "", papel: "ANALISTA" },
        { usuario: ana, papel: "CHEFE" },
        { usuario: ana, papel: "ANALISTA", vaga: "12a" },
        { usuario: ana, papel: "ANALISTA", limite: "0" },
        { usuario: bia, papel: "COORDENADOR", vaga: "1" },
        { usuario: ana, papel: "REVISOR" },
        { usuario: ana, papel: "REVISOR" },
        { usuario: bia, papel: "COORDENADOR" },
      ],
      { gestores: [{ usuario: bia }] },
    );
    expect(erros).toEqual([
      "Linha 1: escolha a pessoa.",
      "Linha 2: escolha o papel.",
      "Linha 3: código da vaga só com dígitos.",
      "Linha 4: limite de fichas de 1 a 5.000.",
      "Linha 5: a coordenação é do edital todo, sem vaga.",
      "Linha 5: o gestor do edital já coordena.",
      "Linha 7: repetida.",
      "Linha 8: o gestor do edital já coordena.",
    ]);
  });

  it("AM-3.1: o gestor conta como coordenação sem linha", () => {
    expect(
      resumoDaEquipe([{ usuario: ana, papel: "ANALISTA" }], [{ usuario: bia }]),
    ).toEqual({
      ANALISTA: 1,
      REVISOR: 0,
      COORDENADOR: 1,
    });
  });
});
