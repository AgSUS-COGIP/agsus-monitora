import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { regraDaFicha } from "../../src/lib/avaliacao-documental/ficha.ts";
import {
  comJustificativasDosItens,
  justificativaDoBloco,
  TAMANHO_DA_JUSTIFICATIVA,
} from "../../src/lib/avaliacao-documental/justificativa-dos-itens.ts";
import { calcularAvaliacao } from "../../src/lib/avaliacao-documental/pontuacao.ts";

/*
  A "Justificativa do ajuste" (pedido das COREs na Avaliação documental): o
  resumo dos itens aceitos e dos não pontuados, montado do que foi lançado, e
  quando ele acompanha os itens no campo justificativa_livre. Regra
  PROJ26-CURRICULAR dos casos dourados (cursos: faixas 40–60, 61–119 e ≥120 h,
  teto 5; titulação: a maior; experiência: blocos de 6 meses além do mínimo
  de 6). Dados fictícios.
*/
const CASOS = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
);
const REGRA = CASOS.regras["PROJ26-CURRICULAR"];
const bloco = (codigo) => REGRA.blocos.find((b) => b.codigo === codigo);

/* A leitura de um arquivo com três certificados (o terceiro foi recusado). */
const LEITURAS = [
  {
    resposta: "8019889",
    pergunta: "915",
    arquivo: 1,
    situacao: "LIDO",
    metodo: "TEXTO",
    itens: [
      { tipo: "CURSO", curso: "Arboviroses", horas: 145 },
      { tipo: "CURSO", curso: "Saúde Indígena", horas: 60 },
      { tipo: "CURSO", curso: "Primeiros Socorros", horas: 20 },
    ],
  },
];

function retrato(lancamento, declarada = null) {
  const regra = regraDaFicha(REGRA, lancamento);
  return {
    regra,
    lancamento,
    avaliacao: calcularAvaliacao(regra, lancamento),
    declarada,
  };
}

const base = (extra = {}) => ({
  nivel: "superior",
  modalidade: "AC",
  blocos: {},
  titulos: [],
  cursos: [],
  vinculos: [],
  ...extra,
});

describe("resumo dos cursos", () => {
  it("aceitos com a faixa e os pontos; não pontuados agrupados pelo motivo", () => {
    const l = base({
      blocos: { CURSOS: { situacao: "CONFORME" } },
      cursos: [
        { nome: "A", horas: 145, aceito: true },
        { nome: "B", horas: 60, aceito: true },
        { nome: "C", horas: 30, aceito: true },
        { nome: "D", horas: 20, aceito: true },
        { nome: "Congresso", horas: 16, aceito: false, motivo: "EVENTO" },
        { nome: "Sem horas", horas: "", aceito: true },
        { nome: "", horas: "", aceito: true },
      ],
      recusas_lidas: { "8019889:915:1:2": { motivo: "CARGA_NAO_COMPROVADA" } },
    });
    const j = justificativaDoBloco(retrato(l), bloco("CURSOS"), LEITURAS);
    expect(j.texto).toBe(
      "Aceitos 2 cursos (205 h): 145 h (faixa ≥120 h, 3 pontos) e 60 h (faixa 40–60 h, 1 ponto). " +
        "Não pontuados: 2 cursos (30 h e 20 h) — abaixo de 40 h (8.2.6); " +
        "1 curso de 16 h — eventos acadêmicos, palestras, workshops, simpósios, seminários, congressos e afins não são pontuados (6.4); " +
        "1 curso — sem carga horária; 1 curso de 20 h — carga horária não comprovada.",
    );
    expect(j.naoPontuados).toBe(5);
    expect(j.precisa).toBe(true);
  });

  it("a soma acima do teto aparece; o nível muda as faixas", () => {
    const cursos = [120, 130].map((horas) => ({ horas, aceito: true }));
    const superior = base({
      blocos: { CURSOS: { situacao: "CONFORME" } },
      cursos,
    });
    expect(
      justificativaDoBloco(retrato(superior), bloco("CURSOS"), []).texto,
    ).toBe(
      "Aceitos 2 cursos (250 h): 120 h (faixa ≥120 h, 3 pontos) e 130 h (faixa ≥120 h, 3 pontos). Soma de 6 pontos limitada ao teto de 5.",
    );
    const tecnico = { ...superior, nivel: "tecnico" };
    expect(
      justificativaDoBloco(retrato(tecnico), bloco("CURSOS"), []).texto,
    ).toContain(
      "6 pontos) e 130 h (faixa ≥120 h, 6 pontos). Soma de 12 pontos limitada ao teto de 10.",
    );
  });

  it("todos aceitos e pontuação igual à declarada: não precisa", () => {
    const l = base({
      blocos: { CURSOS: { situacao: "CONFORME" } },
      cursos: [{ horas: 120, aceito: true }],
    });
    const j = justificativaDoBloco(
      retrato(l, { parciais: { CURSOS: 3 } }),
      bloco("CURSOS"),
      [],
    );
    expect(j).toEqual({
      texto: "Aceito 1 curso: 120 h (faixa ≥120 h, 3 pontos).",
      naoPontuados: 0,
      precisa: false,
    });
    // Declarou 5: a diferença pede a justificativa.
    expect(
      justificativaDoBloco(
        retrato(l, { parciais: { CURSOS: 5 } }),
        bloco("CURSOS"),
        [],
      ).precisa,
    ).toBe(true);
  });

  it("sem Confere (Não confere ou sem decisão) não precisa", () => {
    const cursos = [{ horas: 30, aceito: true }];
    for (const situacao of [undefined, "NAO_CONFORME"]) {
      const l = base({ blocos: { CURSOS: { situacao } }, cursos });
      const j = justificativaDoBloco(retrato(l), bloco("CURSOS"), []);
      expect(j.texto).toBe(
        "Nenhum curso pontuado. Não pontuados: 1 curso de 30 h — abaixo de 40 h (8.2.6).",
      );
      expect(j.precisa).toBe(false);
    }
  });

  it("o texto respeita o limite do campo no banco", () => {
    // Um curso lançado à mão e aceito: ficha antiga, com a lista.
    const cursos = [
      { nome: "A", horas: 40, aceito: true },
      ...Array.from({ length: 49 }, (_, i) => ({
        horas: 1 + i,
        aceito: false,
        motivo: i % 2 ? "EVENTO" : "OUTRO",
      })),
    ];
    const l = base({ blocos: { CURSOS: { situacao: "CONFORME" } }, cursos });
    const blocoLongo = {
      ...bloco("CURSOS"),
      motivos: [
        ...bloco("CURSOS").motivos,
        { codigo: "OUTRO", texto: "x".repeat(1900), item_edital: "6.4" },
      ],
    };
    const j = justificativaDoBloco(retrato(l), blocoLongo, []);
    expect(j.texto.length).toBe(TAMANHO_DA_JUSTIFICATIVA);
    expect(j.texto.endsWith("…")).toBe(true);
  });
});

describe("resumo da titulação e da experiência", () => {
  it("titulação: vale o maior; recusado com o motivo; sem pontos no nível", () => {
    const l = base({
      blocos: { FORMACAO: { situacao: "CONFORME" } },
      titulos: [
        { titulo: "ESPECIALIZACAO", aceito: true },
        { titulo: "MESTRADO", aceito: true },
        {
          titulo: "ESPECIALIZACAO",
          aceito: false,
          motivo: "LATO_SENSU_SEM_CH",
        },
        { titulo: "GRADUACAO", aceito: true },
      ],
    });
    const j = justificativaDoBloco(retrato(l), bloco("FORMACAO"), []);
    expect(j.texto).toBe(
      "Aceitos 2 títulos: Especialização (5 pontos) e Mestrado (8 pontos); vale o maior. " +
        "Não pontuados: 1 título (Especialização) — certificado de pós-graduação lato sensu sem a carga horária mínima de 360h não foi pontuado (8.2.10.4); " +
        "1 título (Graduação) — sem pontos no nível da vaga.",
    );
    expect(j.naoPontuados).toBe(2);
  });

  it("experiência: dias unidos, dias em comum, a conta além do mínimo e os não contados", () => {
    const l = base({
      blocos: { EXPERIENCIA: { situacao: "CONFORME" } },
      vinculos: [
        {
          categoria: "AREA_OU_SUS",
          inicio: "2020-01-01",
          fim: "2021-12-31",
          aceito: true,
        },
        {
          categoria: "AREA_OU_SUS",
          inicio: "2021-07-01",
          fim: "2022-12-31",
          aceito: true,
        },
        {
          categoria: "AREA_OU_SUS",
          inicio: "2018-01-01",
          fim: "2018-12-31",
          aceito: false,
          motivo: "ESTAGIO_OU_SIMILAR",
        },
      ],
    });
    const j = justificativaDoBloco(retrato(l), bloco("EXPERIENCIA"), []);
    expect(j.texto).toBe(
      "Aceitos 2 vínculos: 1.096 dias unidos (3 anos e 1 dia; 36 meses); 184 dias em comum entre vínculos contam uma vez. " +
        "Além do mínimo de 6 meses: 30 meses → 5 períodos de 6 meses → 25 pontos. " +
        "Não contados: 1 vínculo — estágio curricular, monitoria, tutoria, docência, bolsa ou voluntariado não comprovam experiência profissional (8.2.5).",
    );
  });

  it("experiência abaixo do mínimo: a conta fica de fora (o parecer já diz)", () => {
    const l = base({
      blocos: { EXPERIENCIA: { situacao: "CONFORME" } },
      vinculos: [
        {
          categoria: "AREA_OU_SUS",
          inicio: "2024-01-01",
          fim: "2024-03-31",
          aceito: true,
        },
      ],
    });
    const j = justificativaDoBloco(retrato(l), bloco("EXPERIENCIA"), []);
    expect(j.texto).toBe(
      "Aceito 1 vínculo: 91 dias unidos (3 meses e 1 dia; 3 meses).",
    );
    expect(j.texto).not.toContain("mínimo");
  });
});

describe("a justificativa acompanha os itens (comJustificativasDosItens)", () => {
  const comCursos = (cursos, blocoCursos = { situacao: "CONFORME" }) =>
    base({ blocos: { CURSOS: blocoCursos }, cursos });
  const texto = (l) => l.blocos.CURSOS?.justificativa_livre;

  it("na abertura, preenche só o campo vazio do item que precisa", () => {
    const l = comCursos([{ horas: 30, aceito: true }]);
    const aberto = comJustificativasDosItens(null, retrato(l), []);
    expect(texto(aberto)).toBe(
      "Nenhum curso pontuado. Não pontuados: 1 curso de 30 h — abaixo de 40 h (8.2.6).",
    );
    const escrito = comCursos([{ horas: 30, aceito: true }], {
      situacao: "CONFORME",
      justificativa_livre: "Texto do avaliador.",
    });
    expect(comJustificativasDosItens(null, retrato(escrito), [])).toBe(escrito);
    const semNecessidade = comCursos([{ horas: 120, aceito: true }]);
    expect(
      comJustificativasDosItens(
        null,
        retrato(semNecessidade, { parciais: { CURSOS: 3 } }),
        [],
      ),
    ).toBe(semNecessidade);
  });

  it("o texto automático segue os itens; o editado fica; sem necessidade, sai", () => {
    const antes = retrato(
      comJustificativasDosItens(
        null,
        retrato(comCursos([{ horas: 30, aceito: true }])),
        [],
      ),
    );
    // Mais um curso: o resumo muda e o texto automático acompanha.
    const mais = structuredClone(antes.lancamento);
    mais.cursos.push({ horas: 60, aceito: true });
    const depois = comJustificativasDosItens(antes, retrato(mais), []);
    expect(texto(depois)).toBe(
      "Aceito 1 curso: 60 h (faixa 40–60 h, 1 ponto). Não pontuados: 1 curso de 30 h — abaixo de 40 h (8.2.6).",
    );
    // O avaliador editou: mexer nos itens não apaga o texto dele.
    const editado = structuredClone(depois);
    editado.blocos.CURSOS.justificativa_livre = "Texto do avaliador.";
    const outro = structuredClone(editado);
    outro.cursos.push({ horas: 120, aceito: true });
    expect(
      texto(comJustificativasDosItens(retrato(editado), retrato(outro), [])),
    ).toBe("Texto do avaliador.");
    // Tirou o curso de 30 h (sem não pontuado, sem declarada): o automático sai.
    const semTrinta = structuredClone(depois);
    semTrinta.cursos = [{ horas: 60, aceito: true }];
    expect(
      texto(comJustificativasDosItens(retrato(depois), retrato(semTrinta), [])),
    ).toBe("");
  });

  it("apagado pelo avaliador fica apagado enquanto os itens não mudam", () => {
    const l = comCursos([{ horas: 30, aceito: true }], {
      situacao: "CONFORME",
      justificativa_livre: "",
    });
    const antes = retrato(l);
    const outra = { ...structuredClone(l), observacoes: "Observação geral." };
    const depois = comJustificativasDosItens(antes, retrato(outra), []);
    expect(texto(depois)).toBe("");
  });

  it("Não confere tira o texto automático; voltar a Confere põe de novo", () => {
    const aberto = comJustificativasDosItens(
      null,
      retrato(comCursos([{ horas: 30, aceito: true }])),
      [],
    );
    const naoConfere = structuredClone(aberto);
    naoConfere.blocos.CURSOS.situacao = "NAO_CONFORME";
    const semTexto = comJustificativasDosItens(
      retrato(aberto),
      retrato(naoConfere),
      [],
    );
    expect(texto(semTexto)).toBe("");
    const confere = structuredClone(semTexto);
    confere.blocos.CURSOS.situacao = "CONFORME";
    expect(
      texto(comJustificativasDosItens(retrato(semTexto), retrato(confere), [])),
    ).toContain("abaixo de 40 h");
  });

  it("o texto entra no parecer sem repetir o motivo escolhido que ele já cita", () => {
    const l = comJustificativasDosItens(
      null,
      retrato(
        comCursos(
          [
            { horas: 120, aceito: true },
            { horas: 16, aceito: false, motivo: "EVENTO" },
          ],
          { situacao: "CONFORME", justificativas: ["EVENTO"] },
        ),
      ),
      [],
    );
    const { observacoes } = calcularAvaliacao(REGRA, l);
    expect(observacoes).toEqual([
      "Item 8.2.6: Aceito 1 curso: 120 h (faixa ≥120 h, 3 pontos). Não pontuados: 1 curso de 16 h — eventos acadêmicos, palestras, workshops, simpósios, seminários, congressos e afins não são pontuados (6.4).",
    ]);
  });
});
