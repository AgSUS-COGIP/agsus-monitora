import { describe, expect, it } from "vitest";
import {
  arredondar,
  dadosDoRoteiroParaSalvar,
  errosDoRoteiro,
  lerListaDeNotas,
  lerNumero,
  minimoEmPontos,
  moverItem,
  notaNaEscala,
  opcoesDaEscala,
  pontuacaoMaxima,
  rascunhoDoRoteiro,
  resumoDoRoteiro,
  rotuloDoPeso,
  textoDaPontuacao,
} from "../src/lib/roteiro-de-entrevista.ts";

/* Os dois roteiros iniciais da migration 20260930220000. */
const SAUDE_INDIGENA = {
  id: "r1",
  origem: "r1",
  versao: 1,
  area: "saude-indigena",
  nome: "Saúde Indígena 2026 — Entrevista individual",
  etapa: "Entrevista Individual",
  escala: "NIVEIS",
  passo: 1,
  notas_permitidas: [],
  nota_minima_total: 8,
  notas_eliminatorias: [0, 1],
  ausencia_elimina: true,
  desempate: ["Idade igual ou superior a 60 anos", "Ser indígena"],
  soma_analise: true,
  convocacao_padrao: {
    multiplo_imediatas: 5,
    posicao_cadastro_reserva: 10,
    excecoes: [
      {
        termo_cargo: "Enfermagem",
        multiplo_imediatas: 10,
        posicao_cadastro_reserva: 20,
      },
    ],
  },
  banca_padrao: [{ origem: "AgSUS", quantidade: 1 }],
  competencias: [1, 2, 3, 4].map((ordem) => ({
    id: `c${ordem}`,
    ordem,
    nome: `Competência ${ordem}`,
    descricao: null,
    nota_maxima: 5,
    peso: 1,
    minimo: 2,
    tipo_minimo: "VALOR",
    avaliacao: "INDIVIDUAL",
  })),
  niveis: [0, 1, 2, 3, 4, 5].map((nota) => ({
    nota,
    nome: `Nível ${nota}`,
    descricao: `Descrição ${nota}`,
  })),
  editais_em_uso: 3,
};

const SESMT = {
  ...SAUDE_INDIGENA,
  id: "r2",
  origem: "r2",
  escala: "FAIXA",
  passo: 0.5,
  nota_minima_total: 5,
  notas_eliminatorias: [],
  niveis: [],
  competencias: [
    {
      id: "p1",
      ordem: 1,
      nome: "Técnica",
      nota_maxima: 2,
      peso: 1,
      minimo: 50,
      tipo_minimo: "PERCENTUAL",
      avaliacao: "INDIVIDUAL",
    },
    {
      id: "p2",
      ordem: 2,
      nome: "Intercultural",
      nota_maxima: 2,
      peso: 1.5,
      minimo: 50,
      tipo_minimo: "PERCENTUAL",
      avaliacao: "INDIVIDUAL",
    },
    {
      id: "p3",
      ordem: 3,
      nome: "Comportamental",
      nota_maxima: 2,
      peso: 1.5,
      minimo: 50,
      tipo_minimo: "PERCENTUAL",
      avaliacao: "INDIVIDUAL",
    },
    {
      id: "p4",
      ordem: 4,
      nome: "Estudo de caso",
      nota_maxima: 2,
      peso: 1,
      minimo: 50,
      tipo_minimo: "PERCENTUAL",
      avaliacao: "GRUPO",
    },
  ],
};

describe("números do formulário", () => {
  it("lê vírgula e ponto, vazio vira nulo e texto vira NaN", () => {
    expect(lerNumero("1,5")).toBe(1.5);
    expect(lerNumero("1.5")).toBe(1.5);
    expect(lerNumero(" ")).toBeNull();
    expect(lerNumero("abc")).toBeNaN();
    expect(lerNumero(2)).toBe(2);
    expect(lerListaDeNotas("0; 1; 2,5 ; x")).toEqual([0, 1, 2.5]);
  });

  it("arredonda como o PostgreSQL (metade para longe do zero)", () => {
    expect(arredondar(2.345)).toBe(2.35);
    expect(arredondar(1.005)).toBe(1.01);
    expect(arredondar(3.3333)).toBe(3.33);
  });
});

describe("peso, mínimo e pontuação", () => {
  it("mostra o peso como acréscimo amigável", () => {
    expect(rotuloDoPeso(1.5)).toBe("+50%");
    expect(rotuloDoPeso("2")).toBe("+100%");
    expect(rotuloDoPeso(0.5)).toBe("−50%");
    expect(rotuloDoPeso(1)).toBe("");
    expect(rotuloDoPeso("")).toBe("");
  });

  it("converte o mínimo em % da nota máxima × peso", () => {
    expect(minimoEmPontos(SESMT.competencias[1])).toBe(1.5);
    expect(minimoEmPontos(SAUDE_INDIGENA.competencias[0])).toBe(2);
    expect(minimoEmPontos({ nota_maxima: 5, minimo: null })).toBeNull();
  });

  it("soma a pontuação máxima e escreve a prévia", () => {
    expect(pontuacaoMaxima(SAUDE_INDIGENA.competencias)).toBe(20);
    expect(pontuacaoMaxima(SESMT.competencias)).toBe(10);
    expect(textoDaPontuacao(SAUDE_INDIGENA)).toBe(
      "Pontuação máxima 20 · mínimo 8",
    );
    expect(
      textoDaPontuacao({
        competencias: SESMT.competencias,
        nota_minima_total: "",
      }),
    ).toBe("Pontuação máxima 10 · sem mínimo total");
  });

  it("resume o roteiro para o cartão", () => {
    expect(resumoDoRoteiro(SESMT)).toMatchObject({
      competencias: 4,
      maxima: 10,
      minimo: 5,
      emUso: 3,
      versao: 1,
      grupo: true,
    });
  });
});

describe("escala", () => {
  it("FAIXA: de 0 ao máximo, de passo em passo", () => {
    expect(opcoesDaEscala(SESMT, 2).map((o) => o.valor)).toEqual([
      0, 0.5, 1, 1.5, 2,
    ]);
    expect(notaNaEscala(SESMT, SESMT.competencias[0], 1.5)).toBe(true);
    expect(notaNaEscala(SESMT, SESMT.competencias[0], 1.25)).toBe(false);
    expect(notaNaEscala(SESMT, SESMT.competencias[0], 2.5)).toBe(false);
  });

  it("NIVEIS: os níveis até a nota máxima, com nome e descrição", () => {
    const opcoes = opcoesDaEscala(SAUDE_INDIGENA, 3);
    expect(opcoes.map((o) => o.valor)).toEqual([0, 1, 2, 3]);
    expect(opcoes[2]).toEqual({
      valor: 2,
      rotulo: "Nível 2",
      descricao: "Descrição 2",
    });
    expect(
      notaNaEscala(SAUDE_INDIGENA, SAUDE_INDIGENA.competencias[0], 4),
    ).toBe(true);
    expect(
      notaNaEscala(SAUDE_INDIGENA, SAUDE_INDIGENA.competencias[0], 3.5),
    ).toBe(false);
  });

  it("LISTA: só as notas permitidas, sem repetir", () => {
    const lista = { escala: "LISTA", notas_permitidas: [5, 0, 2.5, 2.5, 10] };
    expect(opcoesDaEscala(lista, 5).map((o) => o.valor)).toEqual([0, 2.5, 5]);
    expect(notaNaEscala(lista, { nota_maxima: 5 }, 2.5)).toBe(true);
    expect(notaNaEscala(lista, { nota_maxima: 5 }, 1)).toBe(false);
  });
});

describe("rascunho, validação e gravação", () => {
  it("editar mantém a origem (grava a versão seguinte); duplicar cria outro", () => {
    const edicao = rascunhoDoRoteiro(SAUDE_INDIGENA, { modo: "editar" });
    expect(edicao.origem).toBe("r1");
    expect(edicao.versao).toBe(1);
    expect(edicao.competencias).toHaveLength(4);
    expect(edicao.niveis[5]).toMatchObject({ nota: "5", nome: "Nível 5" });
    expect(dadosDoRoteiroParaSalvar(edicao).origem).toBe("r1");

    const copia = rascunhoDoRoteiro(SAUDE_INDIGENA, { modo: "duplicar" });
    expect(copia.origem).toBeNull();
    expect(copia.nome).toMatch(/\(cópia\)$/);
    expect("origem" in dadosDoRoteiroParaSalvar(copia)).toBe(false);
  });

  it("o roteiro do banco volta igual pelo formulário", () => {
    const dados = dadosDoRoteiroParaSalvar(rascunhoDoRoteiro(SAUDE_INDIGENA));
    expect(dados).toMatchObject({
      nome: SAUDE_INDIGENA.nome,
      escala: "NIVEIS",
      nota_minima_total: 8,
      notas_eliminatorias: [0, 1],
      ausencia_elimina: true,
      soma_analise: true,
      desempate: SAUDE_INDIGENA.desempate,
      convocacao_padrao: SAUDE_INDIGENA.convocacao_padrao,
      banca_padrao: SAUDE_INDIGENA.banca_padrao,
    });
    expect(dados.competencias[0]).toEqual({
      nome: "Competência 1",
      descricao: null,
      nota_maxima: 5,
      peso: 1,
      minimo: 2,
      tipo_minimo: "VALOR",
      avaliacao: "INDIVIDUAL",
    });
    expect(dados.niveis).toHaveLength(6);
    expect(errosDoRoteiro(rascunhoDoRoteiro(SAUDE_INDIGENA))).toEqual({});
    expect(errosDoRoteiro(rascunhoDoRoteiro(SESMT))).toEqual({});
  });

  it("aponta os campos inválidos", () => {
    const r = rascunhoDoRoteiro(null, { area: "projetos" });
    expect(r.area).toBe("projetos");
    const vazio = errosDoRoteiro(r);
    expect(vazio.nome).toBeTruthy();
    expect(vazio[`competencia.${r.competencias[0].chave}.nome`]).toBeTruthy();

    const c = {
      ...r.competencias[0],
      nome: "Técnica",
      nota_maxima: "5",
      peso: "20",
      minimo: "30",
    };
    const erros = errosDoRoteiro({
      ...r,
      nome: "Roteiro",
      escala: "LISTA",
      notas_permitidas: "",
      competencias: [c],
      nota_minima_total: "999",
      desempate: [""],
      convocacao: {
        multiplo_imediatas: "0",
        posicao_cadastro_reserva: "10",
        excecoes: [{ chave: "e1", termo_cargo: "" }],
      },
    });
    expect(Object.keys(erros).sort()).toEqual(
      [
        "notas_permitidas",
        `competencia.${c.chave}.peso`,
        "nota_minima_total",
        "desempate.0",
        // A convocação padrão não vale mais (é a da Classificação): não é conferida.
      ].sort(),
    );

    const niveis = errosDoRoteiro({
      ...rascunhoDoRoteiro(SAUDE_INDIGENA),
      niveis: [
        { chave: "n1", nota: "1", nome: "Um" },
        { chave: "n2", nota: "1", nome: "X" },
      ],
    });
    expect(niveis["nivel.n2.nota"]).toMatch(/mesma nota/);
    expect(niveis["nivel.n2.nome"]).toBeTruthy();
  });

  it("move itens da lista", () => {
    expect(moverItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moverItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});

describe("aspectos do roteiro", async () => {
  const lib = await import("../src/lib/roteiro-de-entrevista.ts");

  it("rascunho, validação e o que vai ao banco", () => {
    const r = lib.rascunhoDoRoteiro({
      id: "r1",
      nome: "Roteiro",
      escala: "FAIXA",
      passo: 1,
      competencias: [{ id: "c1", ordem: 1, nome: "Uma", nota_maxima: 5 }],
      notas_eliminatorias: [0],
      aspectos: [
        { id: "s2", ordem: 2, nome: "Propriedade" },
        { id: "s1", ordem: 1, nome: "Conceitua" },
      ],
    });
    expect(r.aspectos.map((a) => a.nome)).toEqual(["Conceitua", "Propriedade"]);
    expect(lib.errosDoRoteiro(r)).toEqual({});
    const dados = lib.dadosDoRoteiroParaSalvar(r);
    expect(dados.aspectos).toEqual([
      { nome: "Conceitua" },
      { nome: "Propriedade" },
    ]);
    expect(dados.notas_eliminatorias).toEqual([]);
    const repetido = {
      ...r,
      aspectos: [...r.aspectos, lib.novoAspecto("conceitua")],
    };
    expect(Object.values(lib.errosDoRoteiro(repetido))).toContain(
      "Dois aspectos com o mesmo nome.",
    );
    expect(lib.MODELO_DE_ASPECTOS).toEqual([
      "Conceitua",
      "Propriedade",
      "Profundidade",
    ]);
    expect(lib.resumoDoRoteiro(r).aspectos).toEqual([
      "Conceitua",
      "Propriedade",
    ]);
  });
});
