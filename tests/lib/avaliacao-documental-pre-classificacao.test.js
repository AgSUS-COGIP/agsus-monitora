import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  artDasColunas,
  congelaADeclarada,
  declaradaCongelada,
  eliminacaoDoCandidato,
  fimDasInscricoes,
  idadeEm,
  mesesDeclarados,
  modalidadeDoCandidato,
  numeroNoTexto,
  perguntasAmbiguas,
  preClassificarVaga,
  tamanhoDoLote,
  vagasPorModalidade,
} from "../../src/lib/avaliacao-documental/pre-classificacao.js";
import { nivelDaVaga } from "../../src/lib/classificacao/vagas.js";
import {
  calcularNotaDeclarada,
  chaveDaOpcao,
  colunaDaPergunta,
  divergeDaArt,
  lerArt,
  opcoesDaResposta,
  perguntaAmbigua,
  textoDaResposta,
} from "../../src/lib/avaliacao-documental/nota-declarada.js";
import {
  normalizarRegraAnalise,
  validarRegraAnalise,
} from "../../src/lib/avaliacao-documental/regra.js";

/*
  Os mesmos casos rodam no pytest (tests/python/test_pre_classificacao.py),
  contra a conta oficial do job (python/monitora/avaliacao_documental/).
*/
const CASOS = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pre-classificacao.json",
    "utf8",
  ),
);
const CAMPOS = [
  "situacao",
  "motivo_codigo",
  "posicao",
  "posicao_modalidade",
  "lote",
  "lista_lote",
  "entrada",
  "motivo_entrada",
  "nota",
  "origem_nota",
  "divergente",
  "modalidade",
];

const rodar = (c) =>
  preClassificarVaga({
    regra: normalizarRegraAnalise(c.regra),
    vaga: c.vaga,
    candidatos: c.candidatos,
    anterior: c.anterior,
    ultimo_lote: c.ultimo_lote,
    refazer: c.refazer,
    hoje: c.hoje,
    congelar: c.congelar ?? false,
  });

describe("casos dourados da pré-classificação", () => {
  it.each(CASOS.casos.map((c) => [`${c.historia} — ${c.nome}`, c]))(
    "%s",
    (_nome, c) => {
      const r = rodar(c);
      const linhas = Object.fromEntries(
        r.linhas.map((l) => [
          l.id,
          Object.fromEntries(CAMPOS.map((k) => [k, l[k]])),
        ]),
      );
      expect(linhas).toEqual(c.esperado.linhas);
      expect(r.resumo).toEqual(c.esperado.resumo);
      if (c.esperado.declaradas)
        expect(
          Object.fromEntries(
            r.linhas.map((l) => [
              l.id,
              {
                declarada: l.declarada,
                art: l.art,
                congelada: l.declarada_congelada?.total ?? null,
              },
            ]),
          ),
        ).toEqual(c.esperado.declaradas);
    },
  );

  it("a regra de cada caso é uma regra válida", () => {
    for (const c of CASOS.casos)
      expect(validarRegraAnalise(normalizarRegraAnalise(c.regra))).toEqual([]);
  });

  it("rodar de novo com o resultado como anterior não muda nada (AM-4.2)", () => {
    for (const c of CASOS.casos) {
      const primeira = rodar(c);
      const anterior = Object.fromEntries(
        primeira.linhas.map((l) => [l.id, l]),
      );
      const segunda = rodar({
        ...c,
        candidatos: c.candidatos.filter(
          (x) => x.ativo !== false || anterior[x.id],
        ),
        anterior,
        refazer: false,
        ultimo_lote: Math.max(0, ...primeira.linhas.map((l) => l.lote ?? 0)),
      });
      expect(segunda.linhas.map((l) => [l.id, l.situacao, l.lote])).toEqual(
        primeira.linhas.map((l) => [l.id, l.situacao, l.lote]),
      );
      expect(segunda.resumo.entraram).toBe(0);
    }
  });
});

describe("a pergunta pelo começo do enunciado (os mesmos casos no pytest)", () => {
  it.each(CASOS.perguntas.map((c) => [c.nome, c]))("%s", (_nome, c) => {
    const colunas = Object.fromEntries(c.colunas.map((n) => [n, "x"]));
    expect({
      coluna: colunaDaPergunta(colunas, c.pergunta),
      ambigua: perguntaAmbigua(colunas, c.pergunta),
    }).toEqual(c.esperado);
  });

  it("as perguntas ambíguas da regra viram os códigos dos avisos", () => {
    const regra = normalizarRegraAnalise(CASOS.casos.at(-1).regra);
    const candidato = CASOS.casos.at(-1).candidatos.at(-1);
    expect(
      perguntasAmbiguas(
        regra,
        candidato.colunas,
        regra.provisoria.pergunta_experiencia,
      ).sort(),
    ).toEqual(CASOS.casos.at(-1).esperado.resumo.avisos);
    expect(perguntasAmbiguas(regra, {}, "x")).toEqual([]);
  });
});

describe("as respostas no formato da Empregare (os mesmos casos no pytest)", () => {
  const R = CASOS.respostas;
  it.each(R.texto)("texto de %j", (valor, esperado) =>
    expect(textoDaResposta(valor)).toBe(esperado),
  );
  it.each(R.opcoes)("opções de %j", (valor, esperado) =>
    expect(opcoesDaResposta(valor)).toEqual(esperado),
  );
  it.each(R.mesma_opcao)("%j e %j são a mesma opção? %j", (a, b, igual) =>
    expect(chaveDaOpcao(a) === chaveDaOpcao(b)).toBe(igual),
  );
  it.each(R.meses)("meses de %j", (valor, esperado) =>
    expect(mesesDeclarados(valor)).toBe(esperado),
  );
  it.each(R.art)("ART de %j", (valor, esperado) =>
    expect(lerArt(valor)).toBe(esperado),
  );
});

describe("peças da conta", () => {
  it("ART da coluna NOTA - …", () => {
    expect(artDasColunas({ "NOTA - Questionário": "24,5/30,0" })).toBe(24.5);
    expect(artDasColunas({ "nota - x": "x/30", "NOTA - y": "3/30" })).toBe(3);
    expect(artDasColunas({ NOTAS: "10" })).toBeNull();
  });

  it("eliminação: a primeira regra que vale, e as colunas ausentes", () => {
    const regra = normalizarRegraAnalise(CASOS.casos[0].regra);
    expect(
      eliminacaoDoCandidato(regra, {
        SITUAÇÃO: "cancelado",
        "SITUAÇÃO - Q": "EM ANDAMENTO",
      }).eliminacao.codigo,
    ).toBe("CANCELADO");
    const semColunas = eliminacaoDoCandidato(regra, {});
    expect(semColunas.eliminacao).toBeNull();
    expect(semColunas.ausentes).toEqual([
      "CANCELADO",
      "QUESTIONARIO",
      "REPROVADO_EMPREGARE",
      "TERMO",
    ]);
  });

  it("modalidade pelo bloco MODALIDADE; sem ele, ampla", () => {
    const regra = normalizarRegraAnalise(CASOS.casos[0].regra);
    expect(
      modalidadeDoCandidato(regra, {
        "Pergunta 5 - Sistema": "Pessoa com deficiência (PcD)",
      }),
    ).toBe("PCD");
    expect(modalidadeDoCandidato({ blocos: [] }, {})).toBe("AC");
  });

  it("tamanho do lote: múltiplo, CR, fixo, por vaga e sem quadro", () => {
    const lote = normalizarRegraAnalise({}).lote;
    expect(
      tamanhoDoLote(lote, { vagas_imediatas: 11, cadastro_reserva: true })
        .descricao,
    ).toBe("3 × (11 + CR) = 36");
    expect(
      tamanhoDoLote(
        { ...lote, multiplo: 2.5, inclui_cr: false },
        { vagas_imediatas: 3, cadastro_reserva: true },
      ),
    ).toMatchObject({ tamanho: 8, descricao: "2,5 × 3 = 8" });
    expect(
      tamanhoDoLote(lote, { vagas_imediatas: 0, cadastro_reserva: false })
        .aviso,
    ).toBe("SEM_VAGAS");
    expect(
      tamanhoDoLote(
        { ...lote, por_modalidade: true },
        {
          vagas_imediatas: 2,
          cadastro_reserva: false,
          modalidades: { AC: null },
        },
      ).aviso,
    ).toBe("QUADRO_SEM_MODALIDADES");
  });

  it("lote pela nota mínima: a descrição sai com o item; sem nota, aviso", () => {
    expect(
      tamanhoDoLote(
        { base: "NOTA_MINIMA", nota_minima: 15, item_edital: "8.2.6" },
        { vagas_imediatas: null },
      ),
    ).toEqual({
      tamanho: null,
      descricao: "nota ≥ 15 (item 8.2.6)",
      por_modalidade: null,
      aviso: null,
      nota_minima: 15,
    });
    expect(
      tamanhoDoLote({ base: "NOTA_MINIMA", nota_minima: null }, {}).aviso,
    ).toBe("SEM_NOTA_MINIMA");
  });

  it("meses de experiência declarados pela faixa", () => {
    expect(mesesDeclarados("De 1 a 2 anos")).toBe(12);
    expect(mesesDeclarados("Mais de 5 anos")).toBe(60);
    expect(mesesDeclarados("De 6 meses a 1 ano")).toBe(6);
    expect(mesesDeclarados("Sem experiência")).toBe(0);
    expect(mesesDeclarados("1,5 ano")).toBe(18);
    expect(mesesDeclarados(24)).toBe(24);
    expect(mesesDeclarados("texto livre")).toBeNull();
    expect(mesesDeclarados("")).toBeNull();
  });

  it("vagas por modalidade do quadro", () => {
    expect(
      vagasPorModalidade({
        "Ampla Concorrência": "2",
        PcD: null,
        Indígenas: 1,
      }),
    ).toEqual({ AC: 2, PCD: 0, PI: 1 });
    expect(vagasPorModalidade({ "Ampla Concorrência": null })).toBeNull();
  });

  it("idade e número no texto", () => {
    expect(idadeEm("1966-10-07", "2026-10-06")).toBe(59);
    expect(idadeEm("1966-10-06", "2026-10-06")).toBe(60);
    expect(idadeEm(null, "2026-10-06")).toBeNull();
    expect(numeroNoTexto(24)).toBe("24");
    expect(numeroNoTexto(18.5)).toBe("18,5");
  });
});

describe("base da nota do lote e declarada congelada (os mesmos casos no pytest)", () => {
  const casoDaBase = CASOS.casos.find((c) =>
    c.nome.startsWith("base da nota pela declarada"),
  );

  it("sem base na regra: DECLARADA com nota declarada, ART sem", () => {
    expect(normalizarRegraAnalise({}).provisoria.base_da_nota).toBe("ART");
    expect(
      normalizarRegraAnalise(casoDaBase.regra).provisoria.base_da_nota,
    ).toBe("DECLARADA");
    expect(
      normalizarRegraAnalise({
        ...casoDaBase.regra,
        provisoria: { ...casoDaBase.regra.provisoria, base_da_nota: "ART" },
      }).provisoria.base_da_nota,
    ).toBe("ART");
  });

  it("recusa base desconhecida e a declarada sem nota declarada", () => {
    const com = (provisoria) =>
      validarRegraAnalise(
        normalizarRegraAnalise({ ...casoDaBase.regra, provisoria }),
      ).join(" ");
    expect(
      com({ ...casoDaBase.regra.provisoria, base_da_nota: "MAIOR" }),
    ).toMatch(/Base da nota do lote: DECLARADA ou ART/);
    expect(
      com({
        ...casoDaBase.regra.provisoria,
        nota_declarada: [],
        base_da_nota: "DECLARADA",
      }),
    ).toMatch(/configure a nota declarada/);
    expect(com({ ...casoDaBase.regra.provisoria, base_da_nota: "ART" })).toBe(
      "",
    );
  });

  it("com a base ART o mesmo caso volta à ordem pela ART", () => {
    const r = rodar({
      ...casoDaBase,
      regra: {
        ...casoDaBase.regra,
        provisoria: { ...casoDaBase.regra.provisoria, base_da_nota: "ART" },
      },
    });
    const porCodigo = Object.fromEntries(r.linhas.map((l) => [l.codigo, l]));
    expect(porCodigo["2171493"].situacao).toBe("RANQUEADO");
    expect(porCodigo["7100004"].situacao).toBe("NO_LOTE");
    expect(r.resumo.base_da_nota).toBe("ART");
    expect(r.resumo.avisos).not.toContain("SEM_DECLARADA_COMPLETA");
  });

  it.each(CASOS.congelamento.fim_das_inscricoes)(
    "fim das inscrições de %j",
    (cronograma, esperado) =>
      expect(fimDasInscricoes(cronograma)).toBe(esperado),
  );

  it.each(CASOS.congelamento.congela)(
    "congela em %s com fim %s: %s",
    (hoje, fim, esperado) =>
      expect(congelaADeclarada(hoje, fim)).toBe(esperado),
  );

  it("a congelada guarda as respostas usadas e o anterior inválido é ignorado", () => {
    const c = CASOS.casos.find((x) => x.nome.startsWith("congelamento:"));
    const linha = rodar(c).linhas.find((l) => l.codigo === "2171493");
    expect(linha.declarada_congelada.respostas).toHaveLength(3);
    expect(linha.declarada_congelada.respostas[2]).toEqual({
      parcial: "EXPERIENCIA",
      coluna: "Pergunta 5 - Experiência Profissional em atividades compatíveis",
      resposta: '"1 ano"',
      pontos: 10,
    });
    expect(declaradaCongelada({ total: "20" })).toBeNull();
    expect(declaradaCongelada(null)).toBeNull();
    expect(declaradaCongelada({ total: 20 })).toEqual({
      total: 20,
      parciais: {},
      sem_mapa: 0,
      respostas: [],
    });
  });
});

describe("regra: desempate e lote por vaga", () => {
  it("o padrão do desempate é idoso e candidatura", () => {
    expect(normalizarRegraAnalise({}).provisoria.desempate).toEqual([
      "IDOSO",
      "CANDIDATURA",
    ]);
  });

  it("recusa desempate desconhecido ou repetido e lote por vaga inválido", () => {
    const base = normalizarRegraAnalise(CASOS.casos[0].regra);
    const com = (mudar) => {
      const r = structuredClone(base);
      mudar(r);
      return validarRegraAnalise(r).join(" ");
    };
    expect(com((r) => (r.provisoria.desempate = ["SORTEIO"]))).toMatch(
      /Desempate da Provisória/,
    );
    expect(com((r) => (r.provisoria.desempate = ["IDOSO", "IDOSO"]))).toMatch(
      /Desempate da Provisória/,
    );
    expect(com((r) => (r.lote.por_vaga = { "17A": 3 }))).toMatch(
      /Lote por vaga/,
    );
    expect(com((r) => (r.lote.por_vaga = { 179698: 0 }))).toMatch(
      /Lote por vaga/,
    );
    expect(com((r) => (r.lote.por_vaga = { 179698: 40 }))).toBe("");
  });
});

describe("nota declarada por nível da vaga (os mesmos casos no pytest)", () => {
  const ND = CASOS.nota_declarada_por_nivel;
  it.each(ND.casos.map((c) => [c.nome, c]))("%s", (_nome, c) => {
    expect(calcularNotaDeclarada(ND.regra, c.respostas, c.nivel)).toEqual(
      c.esperado,
    );
  });

  it("caso real do 93/2026: vaga técnica, '5 anos e 6 meses ou mais' + cursos '10 pontos' = 50 = ART", () => {
    const r = calcularNotaDeclarada(ND.regra, ND.casos[0].respostas, "tecnico");
    expect(r.parciais).toEqual({ FORMACAO: 0, CURSOS: 10, EXPERIENCIA: 40 });
    expect(r.total).toBe(50);
    expect(r.completa).toBe(true);
    expect(divergeDaArt(artDasColunas(ND.casos[0].respostas), r.total)).toBe(
      false,
    );
  });

  it("a mesma resposta vale pontos diferentes por nível; sem nível não soma", () => {
    const respostas = { "Pergunta 11 - Experiência Profissional": '"1 ano"' };
    const exp = (nivel) =>
      calcularNotaDeclarada(ND.regra, respostas, nivel).parciais.EXPERIENCIA;
    expect([exp("superior"), exp("tecnico"), exp("medio")]).toEqual([5, 4, 4]);
    const sem = calcularNotaDeclarada(ND.regra, respostas, null);
    expect(sem.parciais.EXPERIENCIA).toBeUndefined();
    expect(sem.itens[2].nivel_desconhecido).toBe(true);
    expect(sem.completa).toBe(false);
    expect(sem.sem_mapa).toBe(0);
  });

  it("o nível da vaga sai do cargo e da regra de classificação", () => {
    for (const c of CASOS.niveis_da_vaga.casos)
      expect(
        nivelDaVaga({ cargo: c.cargo ?? "" }, { documental: c.documental }),
        String(c.cargo),
      ).toBe(c.esperado);
  });

  it("divergência ART × declarada só com a declarada completa; sem nível vira aviso", () => {
    const [porNivel, semNivel] = CASOS.casos.filter((c) =>
      c.nome.includes("nível"),
    );
    const div = (caso) =>
      Object.fromEntries(rodar(caso).linhas.map((l) => [l.id, l.divergente]));
    expect(div(porNivel)).toEqual({
      t01: false,
      t02: false,
      t03: true,
      t04: false,
    });
    expect(div(semNivel)).toEqual({
      t01: false,
      t02: false,
      t03: false,
      t04: false,
    });
    expect(rodar(semNivel).resumo.avisos).toEqual([
      "SEM_NIVEL:NOTA_EXPERIENCIA",
    ]);
    for (const caso of [porNivel, semNivel])
      expect(
        Object.fromEntries(
          rodar(caso).linhas.map((l) => [
            l.id,
            { declarada: l.declarada, parciais: l.declarada_parciais },
          ]),
        ),
      ).toEqual(caso.esperado_declarada);
  });

  it("a regra aceita pontos por nível só em OPCAO/OPCOES_SOMADAS, com nível conhecido, sem os pontos simples", () => {
    const regra = (item) =>
      normalizarRegraAnalise({
        ...CASOS.casos[0].regra,
        provisoria: {
          ...CASOS.casos[0].regra.provisoria,
          nota_declarada: [item],
        },
      });
    const exp = ND.regra.provisoria.nota_declarada[2];
    const erros = (item) => validarRegraAnalise(regra(item)).join(" ");
    expect(erros(exp)).toBe("");
    expect(erros({ ...exp, tipo: "OPCOES_SOMADAS" })).toBe("");
    expect(erros({ ...exp, pontos: { "1 ano": 5 } })).toMatch(/não os dois/);
    expect(
      erros({ ...exp, tipo: "FAIXA_EM_MESES", meses: {}, pontos_por_mes: 1 }),
    ).toMatch(/só em OPCAO ou OPCOES_SOMADAS/);
    expect(erros({ ...exp, pontos_por_nivel: { doutor: { a: 1 } } })).toMatch(
      /pontos por nível/,
    );
    expect(erros({ ...exp, pontos_por_nivel: {} })).toMatch(/pontos por nível/);
    expect(
      erros({ ...exp, pontos_por_nivel: { superior: { a: 101 } } }),
    ).toMatch(/pontos por nível/);
  });
});
