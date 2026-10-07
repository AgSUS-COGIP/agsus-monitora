import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  alternarCartao,
  alternarDeclarada,
  cartoesDaRegra,
  codigoDoTexto,
  comEliminacao,
  comItemDaDeclarada,
  comPergunta,
  eliminacaoDoCartao,
  ligacoesDaRegra,
  ligarAutomaticamente,
  motivoDoPontoDePartida,
  moverNaLista,
  opcoesDePerguntas,
  regraDoPontoDePartida,
  respostasDaPergunta,
  situacaoDaPergunta,
  sugerirPerguntas,
} from "../../src/lib/avaliacao-documental/assistente-da-regra.ts";
import {
  regrasIguais,
  validarRegraAnalise,
} from "../../src/lib/avaliacao-documental/regra.js";
import {
  htmlDoResumo,
  resumoDaRegra,
  textoDoResumo,
} from "../../src/lib/avaliacao-documental/resumo-da-regra.ts";
import {
  diferencasEntreRegras,
  fraseDaDiferenca,
} from "../../src/lib/avaliacao-documental/comparar-regras.ts";

/*
  O assistente da regra da avaliação documental (src/lib/avaliacao-documental/
  assistente-da-regra.ts). Critério de aceite: refazer pelo assistente a regra
  v7 do 93/2026 a partir do modelo PROJ26-CURRICULAR (o da correção, copiado
  em casos-de-pontuacao.json) + as escolhas dá o mesmo JSON da v7 vigente.
  Fixtures sem dado pessoal: a regra (tests/fixtures/avaliacao-documental/
  regra-93-2026-v7.json) e só os NOMES das colunas "Pergunta N - …" da última
  carga das vagas do 93/2026 (colunas-da-empregare-93-2026.json).
*/

const ler = (arquivo) =>
  JSON.parse(
    readFileSync(`tests/fixtures/avaliacao-documental/${arquivo}`, "utf8"),
  );
const PROJ26 = ler("casos-de-pontuacao.json").regras["PROJ26-CURRICULAR"];
const V7 = ler("regra-93-2026-v7.json");
const VAGAS = ler("colunas-da-empregare-93-2026.json");

const cartao = (regra, id, opcoes) =>
  cartoesDaRegra(regra, opcoes).find((c) => c.id === id);

/* As escolhas da coordenação no assistente, como a tela faz. */
function refazerA_v7() {
  // 1. Ponto de partida: o modelo, com o rótulo deste edital.
  let regra = regraDoPontoDePartida(
    { tipo: "modelo", codigo: "PROJ26-CURRICULAR", configuracao: PROJ26 },
    { editalRotulo: "Edital 93/2026" },
  );
  // 2. Cardápio: o questionário não finalizado elimina (decisão da CORES).
  const contexto = { fontes: [PROJ26], guardados: {} };
  const questionario = cartao(regra, "eliminacao:QUESTIONARIO", {
    area: "projetos",
  });
  expect(questionario.marcado).toBe(false);
  ({ regra } = alternarCartao(regra, questionario, true, contexto));
  regra = comEliminacao(regra, questionario, {
    ...eliminacaoDoCartao(regra, questionario),
    motivo: "Não finalizou o questionário (decisão da coordenação CORES)",
  });
  // O corte por pontos mínimos já vem do modelo (15, item 8.2.6).
  expect(cartao(regra, "corte").marcado).toBe(true);

  // 3. Perguntas da Empregare: as que a coordenação escolheu na lista.
  const ligar = (codigo, textos) => {
    for (const texto of textos) {
      const ligacao = ligacoesDaRegra(regra).find(
        (l) => l.grupo === "bloco" && l.codigo === codigo,
      );
      regra = comPergunta(regra, ligacao, texto, { adicionar: true });
    }
  };
  ligar("IDENTIDADE", [
    "Anexe o documento de identificação",
    "Anexe um documento de identificação",
  ]);
  ligar("ESCOLARIDADE", [
    "Você possui Graduação na área da vaga",
    "Você possui Ensino Médio completo e Curso Técnico",
    "Anexe a comprovação de Nível",
    "Anexe a comprovação de conclusão do Ensino Médio",
  ]);
  ligar("REGISTRO_CONSELHO", [
    "Você possui registro profissional ativo",
    "Anexe o comprovante do seu registro profissional",
  ]);
  ligar("COTA_PP", [
    "Candidatos às vagas destinadas a Pretos ou Pardos",
    "Candidatos concorrendo às vagas destinadas a Pretos ou Pardos",
  ]);
  ligar("COTA_PCD", ["Os candidatos que concorrem às vagas destinadas a PcD"]);
  ligar("COTA_PI", ["Para candidatos que se declaram indígenas"]);
  ligar("COTA_PQ", ["Para candidatos que se declaram quilombolas"]);
  ligar("FORMACAO", [
    "Qual seu Nível de Titulação Acadêmica",
    "Anexe seu comprovante de Titulação Acadêmica",
  ]);
  ligar("CURSOS", [
    "Selecione a pontuação relativa à carga horária de Cursos",
    "Anexe os seus Certificados de Conclusão dos Cursos",
  ]);
  ligar("EXPERIENCIA", [
    "Experiência Profissional em atividades",
    "Anexe o comprovante de Experiência Profissional",
  ]);

  // Nota declarada: titulação, cursos e experiência (por nível) valem pontos.
  for (const parcial of ["FORMACAO", "CURSOS", "EXPERIENCIA"])
    regra = alternarDeclarada(regra, parcial, true);
  const declarada = regra.provisoria.nota_declarada;
  const [formacao, cursos, experiencia] = V7.provisoria.nota_declarada;
  regra = comItemDaDeclarada(regra, 0, {
    ...declarada[0],
    pontos: formacao.pontos,
  });
  regra = comItemDaDeclarada(regra, 1, {
    ...declarada[1],
    pontos: cursos.pontos,
  });
  const { pontos: _semPontos, ...itemDaExperiencia } = declarada[2];
  regra = comItemDaDeclarada(regra, 2, {
    ...itemDaExperiencia,
    pergunta: "Experiência Profissional",
    pontos_por_nivel: experiencia.pontos_por_nivel,
  });
  // Desempate pela experiência declarada: a mesma pergunta.
  regra = comPergunta(
    regra,
    ligacoesDaRegra(regra).find((l) => l.id === "experiencia"),
    "Experiência Profissional",
  );
  // O corte e a ordem do lote pela nota declarada (item 8.2.6).
  regra = {
    ...regra,
    provisoria: { ...regra.provisoria, base_da_nota: "DECLARADA" },
  };
  return regra;
}

describe("critério de aceite: a v7 do 93/2026 pelo assistente", () => {
  it("PROJ26 + as escolhas = a v7 vigente (mesmo JSON, válido)", () => {
    const regra = refazerA_v7();
    expect(validarRegraAnalise(regra)).toEqual([]);
    expect(regrasIguais(regra, V7)).toBe(true);
  });

  it("as perguntas da v7 nas colunas do 93/2026: verdes, e a da cota PP ambígua", () => {
    const situacoes = Object.fromEntries(
      ligacoesDaRegra(V7).map((l) => [
        l.id,
        situacaoDaPergunta(l.pergunta, VAGAS),
      ]),
    );
    expect(situacoes["declarada:2"].situacao).toBe("achou");
    expect(situacoes["declarada:2"].comUma).toBe(5);
    expect(situacoes.experiencia.situacao).toBe("achou");
    expect(situacoes["bloco:EXPERIENCIA:0"].situacao).toBe("achou");
    // "Você possui Graduação…" só existe nas 3 vagas de nível superior.
    expect(situacoes["bloco:ESCOLARIDADE:0"]).toMatchObject({
      situacao: "achou",
      comUma: 3,
    });
    // O &nbsp; da Empregare vira espaço: "Candidatos concorrendo…" casa com duas colunas.
    expect(situacoes["bloco:COTA_PP:1"].situacao).toBe("ambigua");
    expect(situacoes["bloco:COTA_PP:1"].ambiguas[0].colunas).toHaveLength(2);
  });
});

describe("ponto de partida", () => {
  it("sempre uma cópia independente; de outro edital sai o lote por vaga e entra o rótulo deste", () => {
    const outro = { ...V7, lote: { ...V7.lote, por_vaga: { 177001: 12 } } };
    const regra = regraDoPontoDePartida(
      { tipo: "edital", edital: "93/2026", versao: 7, configuracao: outro },
      { editalRotulo: "Edital 114/2026" },
    );
    expect(regra.edital_rotulo).toBe("Edital 114/2026");
    expect(regra.lote.por_vaga).toBeUndefined();
    regra.blocos[0].titulo = "mudou";
    expect(V7.blocos[0].titulo).not.toBe("mudou");
    expect(
      motivoDoPontoDePartida({ tipo: "edital", edital: "93/2026", versao: 7 }),
    ).toBe("Criada no assistente a partir da regra v7 do edital 93/2026");
  });

  it("do zero: nenhum bloco, e a validação pede ao menos um", () => {
    const regra = regraDoPontoDePartida(
      { tipo: "zero" },
      { editalRotulo: "Edital 1/2026" },
    );
    expect(regra.blocos).toEqual([]);
    expect(validarRegraAnalise(regra)).toContain("De 1 a 40 blocos.");
  });
});

describe("cardápio", () => {
  const base = () =>
    regraDoPontoDePartida({
      tipo: "modelo",
      codigo: "PROJ26-CURRICULAR",
      configuracao: PROJ26,
    });

  it("o critério étnico só aparece na Saúde Indígena", () => {
    const regra = base();
    expect(cartao(regra, "bloco:ETNICO", { area: "projetos" })).toBeUndefined();
    expect(
      cartao(regra, "bloco:ETNICO", { area: "saude-indigena" }).marcado,
    ).toBe(false);
  });

  it("desmarcar some com o bloco; marcar de novo volta igual", () => {
    let regra = base();
    let guardados = {};
    const cursos = cartao(regra, "bloco:CURSOS");
    ({ regra, guardados } = alternarCartao(regra, cursos, false, {
      guardados,
    }));
    expect(regra.blocos.some((b) => b.tipo === "CURSOS")).toBe(false);
    ({ regra, guardados } = alternarCartao(regra, cursos, true, { guardados }));
    expect(regrasIguais(regra, base())).toBe(true);
    expect(guardados).toEqual({});
  });

  it("marcar traz os valores sugeridos da fonte (sem peso no código)", () => {
    const si = { ...PROJ26, blocos: [] };
    const etnico = {
      codigo: "ETNICO",
      titulo: "Critério étnico",
      tipo: "PONTUACAO",
      parcial: "ETNICO",
      condicao: "INDIGENA",
      indigena: 8,
      aldeia: 6,
      teto: 14,
      perguntas: [],
      efeitos: {},
      motivos: [],
    };
    const fonte = { ...PROJ26, blocos: [etnico] };
    const regra = regraDoPontoDePartida({
      tipo: "modelo",
      codigo: "X",
      configuracao: si,
    });
    const c = cartao(regra, "bloco:ETNICO", { area: "saude-indigena" });
    const comFonte = alternarCartao(regra, c, true, { fontes: [fonte] }).regra;
    expect(comFonte.blocos[0]).toMatchObject({
      indigena: 8,
      aldeia: 6,
      teto: 14,
    });
    const semFonte = alternarCartao(regra, c, true).regra;
    expect(semFonte.blocos[0]).toMatchObject({
      indigena: 0,
      aldeia: 0,
      tipo: "PONTUACAO",
    });
  });

  it("bloco novo entra na ordem dos tipos (documentos antes das cotas e dos pontos)", () => {
    let regra = base();
    const identidade = cartao(regra, "bloco:IDENTIDADE");
    ({ regra } = alternarCartao(regra, identidade, false));
    ({ regra } = alternarCartao(regra, identidade, true));
    expect(regra.blocos.map((b) => b.tipo).slice(0, 4)).toEqual([
      "DOCUMENTO",
      "DOCUMENTO",
      "DOCUMENTO",
      "COTA",
    ]);
  });

  it("corte por pontos mínimos: desmarcar volta ao múltiplo das vagas; marcar traz a nota de volta", () => {
    let regra = base();
    let guardados = {};
    const corte = cartao(regra, "corte");
    ({ regra, guardados } = alternarCartao(regra, corte, false, { guardados }));
    expect(regra.lote.base).toBe("MULTIPLO_VAGAS");
    ({ regra, guardados } = alternarCartao(regra, corte, true, {
      guardados,
      notaMinima: 20,
    }));
    expect(regra.lote).toMatchObject({
      base: "NOTA_MINIMA",
      nota_minima: 15,
      item_edital: "8.2.6",
    });
  });

  it("código de motivo a partir do texto", () => {
    expect(codigoDoTexto("Sem frente e verso")).toBe("SEM_FRENTE_E_VERSO");
    expect(codigoDoTexto("Sem frente e verso", ["SEM_FRENTE_E_VERSO"])).toBe(
      "SEM_FRENTE_E_VERSO_2",
    );
  });
});

describe("perguntas da Empregare", () => {
  it("lista as perguntas da carga sem repetir, com em quantas vagas aparecem", () => {
    const opcoes = opcoesDePerguntas(VAGAS);
    const experiencia = opcoes.find((o) =>
      o.texto.startsWith("Experiência Profissional em atividades"),
    );
    expect(experiencia.vagas).toBe(5);
    expect(
      sugerirPerguntas(["titulacao academica"], VAGAS).map((o) => o.texto),
    ).toEqual([
      "Qual seu Nível de Titulação Acadêmica",
      "Anexe seu comprovante de Titulação Acadêmica.",
    ]);
  });

  it("vermelho quando nenhuma vaga tem; sem carga, não decide", () => {
    expect(situacaoDaPergunta("Pergunta que não existe", VAGAS).situacao).toBe(
      "nao_achou",
    );
    expect(situacaoDaPergunta("Experiência", []).situacao).toBe("sem_carga");
    expect(situacaoDaPergunta("", VAGAS).situacao).toBe("vazia");
  });

  it("liga sozinho o bloco sem pergunta, pelo enunciado, e não mexe no que já está ligado", () => {
    const regra = regraDoPontoDePartida({
      tipo: "modelo",
      codigo: "PROJ26-CURRICULAR",
      configuracao: PROJ26,
    });
    const { regra: ligada, ligadas } = ligarAutomaticamente(regra, VAGAS);
    expect(ligadas).toBeGreaterThan(5);
    const formacao = ligada.blocos.find((b) => b.codigo === "FORMACAO");
    expect(formacao.perguntas[0]).toBe("Qual seu Nível de Titulação Acadêmica");
    for (const l of ligacoesDaRegra(ligada).filter(
      (x) => x.grupo === "bloco" && x.pergunta,
    ))
      expect(situacaoDaPergunta(l.pergunta, VAGAS).situacao, l.id).not.toBe(
        "nao_achou",
      );
    const outraVez = ligarAutomaticamente(ligada, VAGAS);
    expect(outraVez.ligadas).toBe(0);
  });

  it("as respostas da carga da pergunta (sem aspas), somadas entre colunas", () => {
    const carga = [
      {
        coluna:
          "Pergunta 11 - Experiência Profissional em atividades compatíveis",
        respostas: [
          { valor: '"1 ano"', quantidade: 3 },
          { valor: '"2 anos"', quantidade: 2 },
        ],
        outras: 0,
      },
      {
        coluna:
          "Pergunta 12 - Experiência Profissional em atividades compatíveis",
        respostas: [{ valor: '"1 ano"', quantidade: 4 }],
        outras: 0,
      },
    ];
    expect(respostasDaPergunta("Experiência Profissional", carga)).toEqual([
      { valor: "1 ano", quantidade: 7 },
      { valor: "2 anos", quantidade: 2 },
    ]);
  });

  it("desligar a última nota declarada volta a base do lote para a ART", () => {
    let regra = refazerA_v7();
    for (const parcial of ["FORMACAO", "CURSOS", "EXPERIENCIA"])
      regra = alternarDeclarada(regra, parcial, false);
    expect(regra.provisoria.base_da_nota).toBe("ART");
    expect(validarRegraAnalise(regra)).toEqual([]);
  });
});

describe("desempate", () => {
  it("move na lista sem mudar a original", () => {
    const lista = ["IDOSO", "EXPERIENCIA_DECLARADA", "MAIOR_IDADE"];
    expect(moverNaLista(lista, 2, 0)).toEqual([
      "MAIOR_IDADE",
      "IDOSO",
      "EXPERIENCIA_DECLARADA",
    ]);
    expect(lista[0]).toBe("IDOSO");
    expect(moverNaLista(lista, 0, 5)).toEqual(lista);
  });
});

describe("resumo de uma página", () => {
  it("o que elimina, quanto vale cada item, corte e desempate, em frases simples", () => {
    const resumo = resumoDaRegra(V7, {
      versao: 7,
      notaMinima: 15,
      desempateDaClassificacao: [
        "60 anos ou mais na data de corte",
        "Maior idade",
      ],
    });
    expect(resumo.subtitulo).toBe("Edital 93/2026 · versão 7");
    const texto = textoDoResumo(resumo);
    expect(texto).toContain(
      "- Documento de identificação oficial com foto (item 6.5): não enviado ou não conforme elimina.",
    );
    expect(texto).toContain(
      "Titulação acadêmica (a maior), nível superior: Especialização 5, Mestrado 8, Doutorado 10.",
    );
    expect(texto).toContain(
      "Experiência na área ou no SUS: 5 pontos a cada 6 meses além do mínimo, até 35 pontos.",
    );
    expect(texto).toContain(
      "Lote: todos com pelo menos 15 pontos pela nota declarada na inscrição (item 8.2.6).",
    );
    expect(texto).toContain(
      "Na inscrição: Não finalizou o questionário (decisão da coordenação CORES) (colunas SITUAÇÃO -… diferente de FINALIZADO).",
    );
    expect(texto).toContain(
      "Classificação: 1º 60 anos ou mais na data de corte; 2º Maior idade.",
    );
    expect(texto).toContain(
      "Lista do lote (Provisória): 1º Idade de 60 anos ou mais",
    );
  });

  it("o HTML do SEI escapa o texto da regra", () => {
    const regra = { ...V7, titulo_etapa: "Etapa <b>" };
    const html = htmlDoResumo(resumoDaRegra(regra));
    expect(html).toContain("Regra da Etapa &lt;b&gt;");
    expect(html).not.toContain("<b>");
  });
});

describe("comparar versões", () => {
  it("diz o que entrou, saiu e mudou, com o nome de cada coisa", () => {
    const frases = diferencasEntreRegras(PROJ26, V7).map(fraseDaDiferenca);
    expect(frases).toContain("edital no parecer: — → Edital 93/2026");
    expect(frases).toContain(
      'Entrou: Provisória › eliminação automática › eliminação "Não finalizou o questionário (decisão da coordenação CORES)"',
    );
    expect(frases).toContain(
      "Provisória › nota do corte e da ordem do lote: ART → DECLARADA",
    );
    expect(frases).toContain(
      "Titulação acadêmica (a maior) › perguntas: — → Qual seu Nível de Titulação Acadêmica; Anexe seu comprovante de Titulação Acadêmica",
    );
  });

  it("regras iguais: nenhuma diferença", () => {
    expect(diferencasEntreRegras(V7, structuredClone(V7))).toEqual([]);
  });

  it("teto que muda num bloco", () => {
    const depois = structuredClone(V7);
    depois.blocos.find((b) => b.codigo === "CURSOS").teto = 6;
    expect(diferencasEntreRegras(V7, depois).map(fraseDaDiferenca)).toEqual([
      "Cursos de aperfeiçoamento na área da vaga (mínimo 40h) › teto: 5 → 6",
    ]);
  });
});
