import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  blocoSeAplica,
  calcularFicha,
  composicaoDaNota,
  conferenciaDaFicha,
  declaradaDaFicha,
  divergenciaDoBloco,
  enderecoDaVagaNaEmpregare,
  ehAnexo,
  enderecoDoCandidatoNaEmpregare,
  etapasDaFicha,
  lancamentoInicial,
  nivelDaFicha,
  nomeCurtoDoBloco,
  nomeDaEtapa,
  opcoesDeJustificativa,
  PASSO_DA_CONCLUSAO,
  passosDaFicha,
  pendenciasDaFicha,
  previaDoParecer,
  proximoPassoPendente,
  respostasDoBloco,
  resumoParaGravar,
  situacaoDaTecla,
  sugereNaoEnviado,
  textoDaAlteracao,
  textoDaSituacaoDaConferencia,
  TEXTO_DO_PARECER_EM_ANALISE,
  textoDoProgresso,
  titulosDoNivel,
} from "../../src/lib/avaliacao-documental/ficha.js";

/*
  A ficha da avaliação documental (fase F4, src/lib/avaliacao-documental/ficha.js):
  o que o candidato declarou por bloco (no formato real da Empregare), o que
  falta para concluir (incluindo a justificativa de nota diferente da
  declarada) e o resumo que vai para o banco. Dados fictícios.
*/
const CASOS = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
);
const BASE = CASOS.regras["PROJ26-CURRICULAR"];

/* A regra do 93/2026 com as perguntas ligadas e a nota declarada (como a correção de 07/10). */
const REGRA = structuredClone(BASE);
const PERGUNTAS = {
  IDENTIDADE: ["Anexe o documento de identificação"],
  FORMACAO: ["Qual seu Nível de Titulação Acadêmica"],
  CURSOS: ["Selecione a pontuação relativa à carga horária de Cursos"],
  EXPERIENCIA: [
    "Experiência Profissional em atividades",
    "Anexe o comprovante de Experiência Profissional",
  ],
  COTA_PI: ["Para candidatos que se declaram indígenas"],
};
for (const b of REGRA.blocos) b.perguntas = PERGUNTAS[b.codigo] ?? [];
REGRA.provisoria = {
  ...REGRA.provisoria,
  nota_declarada: [
    {
      parcial: "FORMACAO",
      pergunta: "Qual seu Nível de Titulação Acadêmica",
      tipo: "OPCAO",
      pontos: { Especialização: 5, Mestrado: 8, "Não possuo": 0 },
    },
    {
      parcial: "CURSOS",
      pergunta: "Selecione a pontuação relativa à carga horária de Cursos",
      tipo: "OPCAO",
      pontos: { "Não possuo": 0, "4 pontos": 4, "5 pontos": 5 },
    },
  ],
};

const RESPOSTAS = {
  "Pergunta 4 - Anexe o documento de identificação com foto, frente e verso":
    "Anexo",
  "Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo: (contabilizada a partir de 06 meses)":
    '"4 anos ou mais&nbsp;"',
  "Pergunta 12 - Anexe o comprovante de Experiência Profissional em atividades compatíveis com o cargo.":
    "--",
  "Pergunta 13 - Qual seu Nível de Titulação Acadêmica?(será necessária a comprovação)":
    '"Especialização"',
  "Pergunta 14 - Selecione a pontuação relativa à carga horária de Cursos de Aperfeiçoamento na área":
    '"5 pontos"',
};
const DOCUMENTAL = { nota_minima: 15, nota_minima_por_nivel: {} };
const bloco = (codigo) => REGRA.blocos.find((b) => b.codigo === codigo);

function lancamentoCompleto(extra = {}) {
  return {
    ...lancamentoInicial({
      regra: REGRA,
      respostas: RESPOSTAS,
      modalidade: "AC",
      cargo: "Engenheiro de Segurança do Trabalho",
      documental: DOCUMENTAL,
    }),
    blocos: {
      IDENTIDADE: { situacao: "CONFORME" },
      ESCOLARIDADE: { situacao: "CONFORME" },
      REGISTRO_CONSELHO: { situacao: "CONFORME" },
      FORMACAO: { situacao: "CONFORME" },
      CURSOS: { situacao: "CONFORME" },
      EXPERIENCIA: { situacao: "CONFORME" },
    },
    titulos: [
      { titulo: "ESPECIALIZACAO", nome: "Especialização", aceito: true },
    ],
    cursos: [
      { nome: "Curso A", horas: 120, aceito: true },
      { nome: "Curso B", horas: 61, aceito: true },
    ],
    vinculos: [
      {
        empregador: "Empresa fictícia",
        categoria: "AREA_OU_SUS",
        inicio: "2020-01-01",
        fim: "2022-12-31",
        aceito: true,
      },
    ],
    ...extra,
  };
}

describe("o que o candidato declarou", () => {
  it("lê a resposta das perguntas ligadas ao bloco no formato da Empregare", () => {
    const linhas = respostasDoBloco(bloco("EXPERIENCIA"), RESPOSTAS);
    expect(linhas.map((l) => l.texto)).toEqual(["4 anos ou mais", ""]);
    expect(linhas[0].enunciado).toBe(
      "Experiência Profissional em atividades compatíveis com o cargo",
    );
    expect(respostasDoBloco(bloco("IDENTIDADE"), RESPOSTAS)[0].texto).toBe(
      "Anexo",
    );
  });

  it("múltipla escolha vira a lista das opções marcadas", () => {
    const linhas = respostasDoBloco(
      { perguntas: ["Você se declara"] },
      { "Pergunta 6 - Você se declara:": '"Sou indígena", "Moro em aldeia"' },
    );
    expect(linhas[0].texto).toBe("Sou indígena, Moro em aldeia");
    expect(linhas[0].opcoes).toEqual(["Sou indígena", "Moro em aldeia"]);
  });

  it("sem resposta em nenhuma pergunta sugere Não enviado (AM-7.5)", () => {
    expect(sugereNaoEnviado([{ texto: "" }, { texto: "" }])).toBe(true);
    expect(sugereNaoEnviado([{ texto: "Anexo" }, { texto: "" }])).toBe(false);
    expect(sugereNaoEnviado([])).toBe(false);
  });

  it("pontos declarados só das parciais cuja pergunta foi achada", () => {
    const d = declaradaDaFicha(REGRA, RESPOSTAS);
    expect(d.parciais).toEqual({ FORMACAO: 5, CURSOS: 5 });
    expect(declaradaDaFicha(REGRA, {}).parciais).toEqual({});
  });
});

describe("lançamento inicial", () => {
  it("nível pela regra de classificação; sem regra, superior", () => {
    expect(
      nivelDaFicha("Técnico de Enfermagem do Trabalho", {
        niveis_por_cargo: [{ termo: "Técnico", nivel: "tecnico" }],
      }),
    ).toBe("tecnico");
    expect(nivelDaFicha("Engenheiro", {})).toBe("superior");
  });

  it("sem termo na regra, o nível escrito no cargo (93/2026: '(Nível Superior)', 'TÉCNICO DE…')", () => {
    expect(nivelDaFicha("TÉCNICO DE ENFERMAGEM DO TRABALHO", {})).toBe(
      "tecnico",
    );
    expect(
      nivelDaFicha("TÉCNICO DE SEGURANÇA DO TRABALHO (Nível Médio)", {}),
    ).toBe("medio");
    expect(
      nivelDaFicha("ANALISTA DE GESTÃO: MÉDICO DO TRABALHO (Nível Superior)"),
    ).toBe("superior");
  });

  it("indígena e aldeia como o candidato respondeu, só com critério étnico na regra", () => {
    const regra = structuredClone(REGRA);
    regra.blocos.push({
      codigo: "ETNICO",
      titulo: "Critério étnico",
      tipo: "PONTUACAO",
      perguntas: ["Você se declara"],
      indigena: 8,
      aldeia: 6,
      teto: 14,
    });
    const l = lancamentoInicial({
      regra,
      respostas: {
        "Pergunta 6 - Você se declara:": '"Sou indígena", "Moro em aldeia"',
      },
      modalidade: "AC",
    });
    expect(l).toMatchObject({ indigena: true, mora_aldeia: true });
    expect(
      lancamentoInicial({
        regra,
        respostas: { "Pergunta 6 - Você se declara:": '"Não sou indígena"' },
      }).indigena,
    ).toBe(false);
    expect(
      lancamentoInicial({ regra: REGRA, respostas: RESPOSTAS }).indigena,
    ).toBe(false);
  });

  it("o gravado vem por cima", () => {
    const l = lancamentoInicial({
      regra: REGRA,
      respostas: RESPOSTAS,
      gravado: {
        nivel: "tecnico",
        blocos: { CURSOS: { situacao: "NAO_ENVIADO" } },
      },
    });
    expect(l.nivel).toBe("tecnico");
    expect(l.blocos.CURSOS.situacao).toBe("NAO_ENVIADO");
    expect(l.vinculos).toEqual([]);
  });
});

describe("o que falta para concluir", () => {
  const declarada = declaradaDaFicha(REGRA, RESPOSTAS);

  it("ficha completa e igual à declarada: nada falta", () => {
    const lanc = lancamentoCompleto({
      cursos: [
        { nome: "Curso A", horas: 120, aceito: true },
        { horas: 61, aceito: true },
      ],
    });
    const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
    expect(av.parciais).toEqual({ FORMACAO: 5, CURSOS: 5, EXPERIENCIA: 25 });
    expect(pendenciasDaFicha(REGRA, lanc, av, declarada)).toEqual([]);
  });

  it("bloco sem situação e Não conforme sem motivo", () => {
    const lanc = lancamentoCompleto();
    delete lanc.blocos.IDENTIDADE;
    lanc.blocos.ESCOLARIDADE = { situacao: "NAO_CONFORME" };
    const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
    const p = pendenciasDaFicha(REGRA, lanc, av, declarada);
    expect(p).toContainEqual({
      bloco: "IDENTIDADE",
      tipo: "situacao",
      texto: "Marque Conforme, Não conforme ou Não enviado.",
    });
    expect(p).toContainEqual({
      bloco: "ESCOLARIDADE",
      tipo: "motivo",
      texto: "Escolha o motivo.",
    });
  });

  it("cota de outra modalidade não pede nada", () => {
    const lanc = lancamentoCompleto();
    expect(blocoSeAplica(bloco("COTA_PP"), lanc)).toBe(false);
    expect(blocoSeAplica(bloco("COTA_PP"), { ...lanc, modalidade: "PP" })).toBe(
      true,
    );
  });

  it("nota diferente da declarada exige justificativa; com ela, não", () => {
    const lanc = lancamentoCompleto({
      cursos: [{ nome: "Curso A", horas: 120, aceito: true }],
    });
    const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
    expect(divergenciaDoBloco(bloco("CURSOS"), av, declarada)).toMatchObject({
      declarada: 5,
      apurada: 3,
      diferenca: -2,
    });
    expect(pendenciasDaFicha(REGRA, lanc, av, declarada)).toEqual([
      {
        bloco: "CURSOS",
        tipo: "justificativa",
        texto: "Nota diferente da declarada: escolha a justificativa.",
      },
    ]);
    lanc.blocos.CURSOS = {
      situacao: "CONFORME",
      justificativas: ["CURSOS_DIMINUIDA"],
    };
    const av2 = calcularFicha(REGRA, lanc, DOCUMENTAL);
    expect(pendenciasDaFicha(REGRA, lanc, av2, declarada)).toEqual([]);
    expect(av2.parecer).toContain(
      "Nota de cursos de aperfeiçoamento diminuída",
    );
  });

  it("nota ajustada para mais também exige justificativa e respeita o teto", () => {
    const lanc = lancamentoCompleto({
      cursos: [
        { horas: 120, aceito: true },
        { horas: 61, aceito: true },
      ],
    });
    lanc.blocos.FORMACAO = { situacao: "CONFORME", nota_ajustada: 8 };
    const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
    expect(av.parciais.FORMACAO).toBe(8);
    expect(pendenciasDaFicha(REGRA, lanc, av, declarada)).toHaveLength(1);
    lanc.blocos.FORMACAO.nota_ajustada = 12;
    expect(
      pendenciasDaFicha(
        REGRA,
        lanc,
        calcularFicha(REGRA, lanc, DOCUMENTAL),
        declarada,
      ),
    ).toContainEqual({
      bloco: "FORMACAO",
      tipo: "nota",
      texto: "Nota ajustada de 0 a 10.",
    });
  });

  it("inapto por requisito não pede justificativa de nota", () => {
    const lanc = lancamentoCompleto({ cursos: [] });
    lanc.blocos.IDENTIDADE = { situacao: "NAO_ENVIADO", motivos: ["ILEGIVEL"] };
    const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
    expect(av.resultado).toBe("INAPTO_REQUISITO");
    expect(pendenciasDaFicha(REGRA, lanc, av, declarada)).toEqual([]);
  });

  it("item recusado sem motivo, vínculo sem data e curso sem horas", () => {
    const lanc = lancamentoCompleto({
      titulos: [{ titulo: "MESTRADO", aceito: false }],
      vinculos: [{ categoria: "AREA_OU_SUS", inicio: "2020-01-01", fim: "" }],
      cursos: [{ nome: "Sem horas", horas: 0 }],
    });
    const textos = pendenciasDaFicha(
      REGRA,
      lanc,
      calcularFicha(REGRA, lanc, DOCUMENTAL),
      {},
    ).map((p) => `${p.bloco}: ${p.texto}`);
    expect(textos).toEqual(
      expect.arrayContaining([
        "FORMACAO: Item recusado sem motivo.",
        "EXPERIENCIA: Vínculo com data de início ou fim inválida.",
        "CURSOS: Curso sem carga horária.",
      ]),
    );
  });
});

describe("apoio da tela", () => {
  it("atalhos 1, 2 e 3", () => {
    expect(["1", "2", "3", "4"].map(situacaoDaTecla)).toEqual([
      "CONFORME",
      "NAO_CONFORME",
      "NAO_ENVIADO",
      null,
    ]);
  });

  it("justificativas: os motivos do bloco e as observações prontas", () => {
    const opcoes = opcoesDeJustificativa(REGRA, bloco("EXPERIENCIA"));
    expect(opcoes.map((o) => o.codigo)).toEqual([
      "ANTES_DO_DIPLOMA",
      "ESTAGIO_OU_SIMILAR",
      "ALTERACAO_DE_NOME",
      "EXPERIENCIA_DIMINUIDA",
      "CURSOS_DIMINUIDA",
    ]);
    expect(opcoes[3]).toMatchObject({
      texto: "Nota de experiência diminuída",
      grupo: "Observações prontas",
    });
  });

  it("títulos do nível com os pontos da regra", () => {
    expect(titulosDoNivel(bloco("FORMACAO"), "superior")).toEqual([
      { codigo: "ESPECIALIZACAO", rotulo: "Especialização", pontos: 5 },
      { codigo: "MESTRADO", rotulo: "Mestrado", pontos: 8 },
      { codigo: "DOUTORADO", rotulo: "Doutorado", pontos: 10 },
    ]);
    expect(titulosDoNivel(bloco("FORMACAO"), "tecnico").length).toBeGreaterThan(
      3,
    );
  });

  it("resumo para gravar traz o que o banco confere", () => {
    const lanc = lancamentoCompleto();
    const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
    const r = resumoParaGravar(av, declaradaDaFicha(REGRA, RESPOSTAS));
    expect(Object.keys(r)).toEqual(
      expect.arrayContaining([
        "resultado",
        "nota_apurada",
        "nota_final",
        "parciais",
        "declarada",
        "eliminatorios",
        "experiencia",
      ]),
    );
    expect(r.declarada).toEqual({ FORMACAO: 5, CURSOS: 5 });
    expect(r.experiencia.meses).toBe(36);
  });

  it("endereço da vaga na Empregare só com código numérico", () => {
    expect(enderecoDaVagaNaEmpregare("177979")).toBe(
      "https://corporate.empregare.com/empresa/vagas",
    );
    expect(enderecoDaVagaNaEmpregare("abc")).toBeNull();
  });

  it("com o identificador interno, a vaga abre direto nas candidaturas", () => {
    expect(enderecoDaVagaNaEmpregare("177979", "Ab1cD2eF3g|")).toBe(
      "https://corporate.empregare.com/empresa/vagas/candidaturas/Ab1cD2eF3g|",
    );
    // O código numérico não abre (Sem permissão) e lixo não vira endereço: lista de vagas.
    for (const ruim of ["177979|", "177979", "a b", "x/../y", "", null])
      expect(enderecoDaVagaNaEmpregare("177979", ruim)).toBe(
        "https://corporate.empregare.com/empresa/vagas",
      );
  });

  it("link do candidato só se for a página de detalhes da Empregare", () => {
    const link =
      "https://corporate.empregare.com/empresa/curriculo/detalhes?tokenCandidato=TKfict&id=IDfict|&candidatura=CDfict||";
    expect(enderecoDoCandidatoNaEmpregare(link)).toBe(link);
    for (const ruim of [
      null,
      "",
      "javascript:alert(1)",
      "https://exemplo.invalid/empresa/curriculo/detalhes?x=1",
      "http://corporate.empregare.com/empresa/curriculo/detalhes?x=1",
      `${link}"><script>`,
    ])
      expect(enderecoDoCandidatoNaEmpregare(ruim)).toBeNull();
  });

  it("alteração do histórico em texto", () => {
    expect(textoDaAlteracao({ rotulo: "Experiência", de: 25, para: 20 })).toBe(
      "Experiência: 25 → 20",
    );
    expect(
      textoDaAlteracao({ rotulo: "Situação", de: null, para: "CONFORME" }),
    ).toBe("Situação: — → CONFORME");
  });
});

describe("conferência: em análise, progresso e o que falta", () => {
  const declarada = declaradaDaFicha(REGRA, RESPOSTAS);
  const conferir = (lanc) => {
    const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
    const pendencias = pendenciasDaFicha(REGRA, lanc, av, declarada);
    return {
      av,
      pendencias,
      c: conferenciaDaFicha(REGRA, lanc, av, pendencias),
    };
  };
  const nova = () =>
    lancamentoInicial({
      regra: REGRA,
      respostas: RESPOSTAS,
      modalidade: "AC",
      cargo: "Engenheiro de Segurança do Trabalho",
      documental: DOCUMENTAL,
    });

  it("ficha recém-aberta: em análise (neutro), não Inapto, mesmo com a conta dando Inapto", () => {
    const { av, c } = conferir(nova());
    // A conta conta o bloco não marcado como Conforme e a experiência sem vínculo elimina.
    expect(av.resultado).toBe("INAPTO_REQUISITO");
    expect(c.situacao).toBe("EM_ANALISE");
    expect(c).toMatchObject({
      total: 6,
      conferidos: 0,
      requisitos: { total: 4, conferidos: 0 },
      pode_concluir: false,
    });
    expect(textoDaSituacaoDaConferencia(c)).toBe(
      "Em análise · 0 de 4 requisitos conferidos",
    );
    expect(textoDoProgresso(c)).toBe("0 de 6 itens conferidos");
  });

  it("antes de conferir, a nota diferente da declarada não pede justificativa", () => {
    const lanc = nova();
    lanc.cursos = [{ nome: "Curso A", horas: 120, aceito: true }];
    const { av, pendencias } = conferir(lanc);
    expect(divergenciaDoBloco(bloco("CURSOS"), av, declarada)).not.toBeNull();
    expect(
      pendencias.filter((p) => p.bloco === "CURSOS").map((p) => p.tipo),
    ).toEqual(["situacao"]);
    lanc.blocos.CURSOS = { situacao: "CONFORME" };
    lanc.vinculos = lancamentoCompleto().vinculos;
    expect(
      conferir(lanc)
        .pendencias.filter((p) => p.bloco === "CURSOS")
        .map((p) => p.tipo),
    ).toEqual(["justificativa"]);
  });

  it("Inapto só quando um requisito conferido elimina", () => {
    const lanc = nova();
    lanc.blocos.IDENTIDADE = { situacao: "CONFORME" };
    expect(conferir(lanc).c.situacao).toBe("EM_ANALISE");
    lanc.blocos.REGISTRO_CONSELHO = {
      situacao: "NAO_ENVIADO",
      motivos: ["SEM_REGISTRO"],
    };
    const { c } = conferir(lanc);
    expect(c.situacao).toBe("INAPTO_REQUISITO");
    expect(textoDaSituacaoDaConferencia(c)).toBe("Inapto (requisito)");
    expect(c.requisitos).toEqual({ total: 4, conferidos: 2 });
  });

  it("experiência conferida abaixo do mínimo elimina; tudo conferido mostra o resultado da conta", () => {
    const lanc = nova();
    lanc.blocos.EXPERIENCIA = { situacao: "CONFORME" };
    expect(conferir(lanc).c.situacao).toBe("INAPTO_REQUISITO");
    const completo = lancamentoCompleto();
    const { c } = conferir(completo);
    expect(c).toMatchObject({
      situacao: "APTO",
      conferidos: 6,
      total: 6,
      texto_da_falta: "",
      pode_concluir: true,
    });
  });

  it("o que falta, com o tipo da falta entre parênteses", () => {
    const lanc = lancamentoCompleto({
      cursos: [{ nome: "Curso A", horas: 120, aceito: true }],
    });
    delete lanc.blocos.FORMACAO;
    const { c } = conferir(lanc);
    expect(c.texto_da_falta).toBe(
      "Falta: Formação Acadêmica, Cursos de Aperfeiçoamento (justificativa)",
    );
    expect(c.pode_concluir).toBe(false);
    const { c: tudo } = conferir(nova());
    expect(tudo.texto_da_falta).toBe(
      "Falta: Documento de identificação oficial com foto, Formação exigida pela vaga, Registro ativo no conselho de classe e mais 3",
    );
    expect(nomeCurtoDoBloco(bloco("COTA_PCD"))).toBe("Pessoa com deficiência");
  });
});

describe("experiência declarada por nível (93/2026)", () => {
  const COM_EXP = structuredClone(REGRA);
  COM_EXP.provisoria.nota_declarada.push({
    parcial: "EXPERIENCIA",
    pergunta: "Experiência Profissional",
    tipo: "OPCAO",
    pontos_por_nivel: {
      superior: { "6 meses obrigatórios": 0, "2 anos": 15 },
      tecnico: { "6 meses obrigatórios": 0, "2 anos": 12 },
      medio: { "6 meses obrigatórios": 0, "2 anos": 12 },
    },
  });
  const RESP = {
    ...RESPOSTAS,
    "Pergunta 11 - Experiência Profissional em atividades compatíveis com o cargo: (contabilizada a partir de 06 meses)":
      '"2 anos&nbsp;"',
  };

  it("o bloco de experiência mostra os pontos declarados do nível da vaga", () => {
    expect(declaradaDaFicha(COM_EXP, RESP, "superior").parciais).toEqual({
      FORMACAO: 5,
      CURSOS: 5,
      EXPERIENCIA: 15,
    });
    expect(
      declaradaDaFicha(COM_EXP, RESP, "tecnico").parciais.EXPERIENCIA,
    ).toBe(12);
    expect(
      declaradaDaFicha(COM_EXP, RESP, "fundamental").parciais.EXPERIENCIA,
    ).toBeUndefined();
  });

  it("nota apurada da experiência diferente da declarada exige justificativa", () => {
    const lanc = lancamentoCompleto();
    const av = calcularFicha(COM_EXP, lanc, DOCUMENTAL);
    expect(av.parciais.EXPERIENCIA).toBe(25);
    const declarada = declaradaDaFicha(COM_EXP, RESP, lanc.nivel);
    expect(pendenciasDaFicha(COM_EXP, lanc, av, declarada)).toContainEqual({
      bloco: "EXPERIENCIA",
      tipo: "justificativa",
      texto: "Nota diferente da declarada: escolha a justificativa.",
    });
    expect(resumoParaGravar(av, declarada).declarada.EXPERIENCIA).toBe(15);
  });
});

describe("modo de análise: etapas, prévia do parecer e anexos", () => {
  const declarada = declaradaDaFicha(REGRA, RESPOSTAS);
  const nova = () =>
    lancamentoInicial({
      regra: REGRA,
      respostas: RESPOSTAS,
      modalidade: "AC",
      cargo: "Engenheiro de Segurança do Trabalho",
      documental: DOCUMENTAL,
    });
  const conta = (lanc) => {
    const av = calcularFicha(REGRA, lanc, DOCUMENTAL);
    const pendencias = pendenciasDaFicha(REGRA, lanc, av, declarada);
    return {
      av,
      pendencias,
      c: conferenciaDaFicha(REGRA, lanc, av, pendencias),
    };
  };

  it("nomes curtos das etapas do 93/2026", () => {
    expect(
      REGRA.blocos
        .filter((b) => b.tipo !== "COTA" && b.tipo !== "REGISTRO")
        .map(nomeDaEtapa),
    ).toEqual([
      "Identidade",
      "Formação",
      "Conselho",
      "Titulação",
      "Cursos",
      "Experiência",
    ]);
    expect(nomeDaEtapa({ titulo: "Qualquer", rotulo_curto: "Meu" })).toBe(
      "Meu",
    );
  });

  it("estado de cada etapa: não conferido, conforme, não enviado e pendência", () => {
    const lanc = nova();
    lanc.blocos.IDENTIDADE = { situacao: "CONFORME" };
    lanc.blocos.ESCOLARIDADE = { situacao: "NAO_ENVIADO" };
    lanc.blocos.REGISTRO_CONSELHO = {
      situacao: "NAO_CONFORME",
      motivos: ["SEM_REGISTRO"],
    };
    const { pendencias } = conta(lanc);
    expect(etapasDaFicha(REGRA, lanc, pendencias)).toEqual([
      { codigo: "IDENTIDADE", nome: "Identidade", estado: "CONFORME" },
      { codigo: "ESCOLARIDADE", nome: "Formação", estado: "pendencia" },
      { codigo: "REGISTRO_CONSELHO", nome: "Conselho", estado: "NAO_CONFORME" },
      { codigo: "FORMACAO", nome: "Titulação", estado: "nao_conferido" },
      { codigo: "CURSOS", nome: "Cursos", estado: "nao_conferido" },
      { codigo: "EXPERIENCIA", nome: "Experiência", estado: "nao_conferido" },
    ]);
  });

  it("com item não conferido, a prévia do parecer não traz resultado; só os motivos já lançados", () => {
    const lanc = nova();
    const { av, c } = conta(lanc);
    // A conta, sozinha, já daria INABILITADO (experiência sem vínculo).
    expect(av.parecer).toContain("INABILITADO");
    const previa = previaDoParecer(av, c, lanc);
    expect(previa).toEqual({
      completa: false,
      texto: TEXTO_DO_PARECER_EM_ANALISE,
      motivos: [],
    });
    lanc.blocos.REGISTRO_CONSELHO = {
      situacao: "NAO_ENVIADO",
      motivos: ["SEM_REGISTRO"],
    };
    const depois = conta(lanc);
    const comMotivo = previaDoParecer(depois.av, depois.c, lanc);
    expect(comMotivo.completa).toBe(false);
    expect(comMotivo.texto).not.toMatch(/HABILITADO/);
    expect(comMotivo.motivos).toHaveLength(1);
    expect(comMotivo.motivos[0]).toMatch(/^Item 6\.4: /);
  });

  it("tudo conferido: o parecer da conta", () => {
    const lanc = lancamentoCompleto();
    const { av, c } = conta(lanc);
    expect(previaDoParecer(av, c, lanc)).toEqual({
      completa: true,
      texto: av.parecer,
      motivos: [],
    });
    expect(av.parecer).toContain("HABILITADO(A)");
  });

  it("anexo: a resposta que a Empregare escreve como Anexo", () => {
    expect(ehAnexo("Anexo")).toBe(true);
    expect(ehAnexo(" anexo ")).toBe(true);
    expect(ehAnexo("Especialização")).toBe(false);
    expect(ehAnexo("")).toBe(false);
  });
});

describe("modo foco: passos, próximo pendente e composição da nota", () => {
  const nova = () =>
    lancamentoInicial({
      regra: REGRA,
      respostas: RESPOSTAS,
      modalidade: "AC",
      cargo: "Engenheiro de Segurança do Trabalho",
      documental: DOCUMENTAL,
    });
  const declarada = declaradaDaFicha(REGRA, RESPOSTAS);
  const pendencias = (lanc) =>
    pendenciasDaFicha(
      REGRA,
      lanc,
      calcularFicha(REGRA, lanc, DOCUMENTAL),
      declarada,
    );

  it("as etapas e, no fim, a Conclusão (pronta só sem pendência)", () => {
    const lanc = nova();
    const passos = passosDaFicha(REGRA, lanc, pendencias(lanc));
    expect(passos.map((p) => p.codigo)).toEqual([
      "IDENTIDADE",
      "ESCOLARIDADE",
      "REGISTRO_CONSELHO",
      "FORMACAO",
      "CURSOS",
      "EXPERIENCIA",
      PASSO_DA_CONCLUSAO,
    ]);
    expect(passos.at(-1)).toEqual({
      codigo: "CONCLUSAO",
      nome: "Conclusão",
      estado: "nao_conferido",
    });
    expect(passosDaFicha(REGRA, lanc, []).at(-1).estado).toBe("pronta");
  });

  it("o critério étnico fica nos passos mesmo antes de valer (é nele que se marca Indígena)", () => {
    const regra = structuredClone(REGRA);
    regra.blocos.push({
      codigo: "ETNICO",
      titulo: "Critério étnico",
      tipo: "PONTUACAO",
      perguntas: [],
      indigena: 8,
      aldeia: 6,
      teto: 14,
    });
    const lanc = { ...nova(), indigena: false };
    const etnico = passosDaFicha(regra, lanc, []).find(
      (p) => p.codigo === "ETNICO",
    );
    expect(etnico).toEqual({
      codigo: "ETNICO",
      nome: "Critério étnico",
      estado: "opcional",
    });
    const comIndigena = passosDaFicha(regra, { ...lanc, indigena: true }, []);
    expect(comIndigena.find((p) => p.codigo === "ETNICO").estado).toBe(
      "nao_conferido",
    );
  });

  it("depois de decidir, vai ao próximo que pede algo; volta ao começo; com tudo resolvido, à Conclusão", () => {
    const passos = [
      { codigo: "A", estado: "CONFORME" },
      { codigo: "B", estado: "nao_conferido" },
      { codigo: "C", estado: "NAO_CONFORME" },
      { codigo: "D", estado: "pendencia" },
      { codigo: "E", estado: "opcional" },
      { codigo: PASSO_DA_CONCLUSAO, estado: "nao_conferido" },
    ];
    expect(proximoPassoPendente(passos, "A")).toBe("B");
    expect(proximoPassoPendente(passos, "B")).toBe("D");
    expect(proximoPassoPendente(passos, "D")).toBe("B");
    expect(proximoPassoPendente(passos, null)).toBe("B");
    expect(
      proximoPassoPendente(
        passos.map((p) => ({ ...p, estado: "CONFORME" })),
        "A",
      ),
    ).toBe(PASSO_DA_CONCLUSAO);
  });

  it("a composição: apurado só depois de conferir, declarado, teto no nível e a diferença", () => {
    const lanc = nova();
    const av0 = calcularFicha(REGRA, lanc, DOCUMENTAL);
    expect(composicaoDaNota(REGRA, lanc, av0, declarada)).toEqual([
      {
        bloco: "FORMACAO",
        parcial: "FORMACAO",
        rotulo: "Formação Acadêmica",
        apurado: null,
        declarado: 5,
        teto: 10,
        divergente: false,
      },
      {
        bloco: "CURSOS",
        parcial: "CURSOS",
        rotulo: "Cursos de Aperfeiçoamento",
        apurado: null,
        declarado: 5,
        teto: 5,
        divergente: false,
      },
      expect.objectContaining({
        bloco: "EXPERIENCIA",
        apurado: null,
        teto: 35,
      }),
    ]);
    lanc.blocos.FORMACAO = { situacao: "CONFORME" };
    const av1 = calcularFicha(REGRA, lanc, DOCUMENTAL);
    expect(composicaoDaNota(REGRA, lanc, av1, declarada)[0]).toMatchObject({
      apurado: 0,
      divergente: true,
    });
  });
});
