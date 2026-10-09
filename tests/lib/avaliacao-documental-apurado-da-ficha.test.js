import { describe, expect, it } from "vitest";
import {
  abreComLinhaNova,
  apuradoDoBloco,
  blocoComDecisao,
  blocoComEscolha,
  escolhaDoBloco,
  lancamentoComEscolha,
  tituloDaResposta,
} from "../../src/lib/avaliacao-documental/apurado-da-ficha.ts";
import {
  faltaDoComprovado,
  itemCompleto,
  lancamentoParaGravar,
  opcoesDeJustificativa,
} from "../../src/lib/avaliacao-documental/ficha.js";

/*
  O Apurado dos itens que pontuam: vem do Calculado pelos itens registrados
  (o Declarado não preenche mais), o ajuste à mão fica por cima, Não conforme
  e Não enviado zeram (e tiram a justificativa da nota). O registro é
  obrigatório: com Declarado acima de 0 o cartão abre com uma linha e o
  Conforme pede um item completo e aceito; a linha incompleta não trava o
  rascunho.
*/
const CURSOS = { codigo: "CURSOS", tipo: "CURSOS", teto: 5, motivos: [] };
const declarada = { parciais: { CURSOS: 3 } };
const lancamento = (blocos = {}, extra = {}) => ({
  nivel: "superior",
  blocos,
  cursos: [],
  ...extra,
});

describe("apurado da ficha", () => {
  it("vem do calculado (não do declarado); com ajuste, o ajuste", () => {
    expect(
      apuradoDoBloco({ bloco: CURSOS, calculado: 0, lancamento: lancamento() }),
    ).toEqual({ valor: 0, origem: "calculado" });
    expect(
      apuradoDoBloco({
        bloco: CURSOS,
        calculado: 1,
        lancamento: lancamento({}, { cursos: [{ horas: 40 }] }),
      }),
    ).toEqual({ valor: 1, origem: "calculado" });
    expect(
      apuradoDoBloco({
        bloco: CURSOS,
        calculado: 1,
        lancamento: lancamento({ CURSOS: { nota_ajustada: 2 } }),
      }),
    ).toEqual({ valor: 2, origem: "ajustado" });
  });

  it("Conforme segue o calculado; Não conforme e Não enviado zeram e tiram a justificativa", () => {
    const decidir = (l, situacao) =>
      blocoComDecisao({ bloco: CURSOS, lancamento: l, situacao });
    const conforme = decidir(lancamento(), "CONFORME");
    expect(conforme).toEqual({ situacao: "CONFORME", motivos: [] });
    const nao = decidir(
      lancamento({
        CURSOS: {
          ...conforme,
          motivos: ["X"],
          justificativas: ["CURSOS_DIMINUIDA"],
          justificativa_livre: "texto",
        },
      }),
      "NAO_CONFORME",
    );
    expect(nao).toMatchObject({
      nota_ajustada: 0,
      justificativas: [],
      justificativa_livre: "",
      motivos: ["X"],
    });
    expect(decidir(lancamento(), "NAO_ENVIADO").nota_ajustada).toBe(0);
    // Volta ao Conforme ou desmarca: o zero sai (volta o calculado).
    expect(
      decidir(lancamento({ CURSOS: nao }), "CONFORME").nota_ajustada,
    ).toBeNull();
    expect(decidir(lancamento({ CURSOS: nao }), null).nota_ajustada).toBeNull();
    // Um ajuste feito pelo analista fica no Conforme.
    expect(
      decidir(lancamento({ CURSOS: { nota_ajustada: 2 } }), "CONFORME")
        .nota_ajustada,
    ).toBe(2);
  });
});

describe("registro obrigatório dos itens", () => {
  it("abre com linha nova no Confere com declarado > 0 (ou no Editar), lista vazia", () => {
    const conferido = lancamento({ CURSOS: { situacao: "CONFORME" } });
    // Sem escolha, a lista não aparece: nada abre.
    expect(abreComLinhaNova(CURSOS, lancamento(), declarada)).toBe(false);
    expect(abreComLinhaNova(CURSOS, conferido, declarada)).toBe(true);
    // Rascunho antigo, Conforme sem item: abre igual.
    expect(
      abreComLinhaNova(
        CURSOS,
        lancamento({ CURSOS: { situacao: "CONFORME", nota_ajustada: 3 } }),
        declarada,
      ),
    ).toBe(true);
    expect(
      abreComLinhaNova(
        CURSOS,
        lancamento({ CURSOS: { situacao: "CONFORME", edita_nota: true } }),
        { parciais: { CURSOS: 0 } },
      ),
    ).toBe(true);
    expect(
      abreComLinhaNova(CURSOS, conferido, { parciais: { CURSOS: 0 } }),
    ).toBe(false);
    expect(
      abreComLinhaNova(CURSOS, { ...conferido, cursos: [{}] }, declarada),
    ).toBe(false);
    expect(
      abreComLinhaNova(
        CURSOS,
        lancamento({ CURSOS: { situacao: "NAO_ENVIADO" } }),
        declarada,
      ),
    ).toBe(false);
    expect(
      abreComLinhaNova({ codigo: "X", tipo: "DOCUMENTO" }, lancamento(), null),
    ).toBe(false);
  });

  it("título pré-selecionado pela resposta do candidato", () => {
    const opcoes = [
      { codigo: "ESPECIALIZACAO", rotulo: "Especialização" },
      { codigo: "MESTRADO", rotulo: "Mestrado" },
      { codigo: "DOUTORADO", rotulo: "Doutorado" },
    ];
    expect(tituloDaResposta(opcoes, ["Mestrado"])).toBe("MESTRADO");
    expect(tituloDaResposta(opcoes, ["especializacao lato sensu"])).toBe(
      "ESPECIALIZACAO",
    );
    expect(tituloDaResposta(opcoes, ["Não possuo"])).toBeNull();
  });

  it("Conforme com declarado > 0 pede um item completo e aceito", () => {
    const texto = "Registre ao menos um curso com carga horária.";
    expect(faltaDoComprovado(CURSOS, lancamento(), declarada)).toBe(texto);
    // Linha vazia ou recusada não conta.
    expect(
      faltaDoComprovado(
        CURSOS,
        lancamento({}, { cursos: [{ nome: "", horas: "" }] }),
        declarada,
      ),
    ).toBe(texto);
    expect(
      faltaDoComprovado(
        CURSOS,
        lancamento({}, { cursos: [{ horas: 40, aceito: false }] }),
        declarada,
      ),
    ).toBe(texto);
    expect(
      faltaDoComprovado(
        CURSOS,
        lancamento({}, { cursos: [{ horas: 40, aceito: true }] }),
        declarada,
      ),
    ).toBeNull();
    // Declarado 0 ("Não possuo"): não pede item.
    expect(
      faltaDoComprovado(CURSOS, lancamento(), { parciais: { CURSOS: 0 } }),
    ).toBeNull();
    expect(itemCompleto("vinculos", { inicio: "2024-01-01", fim: "" })).toBe(
      false,
    );
    expect(itemCompleto("titulos", { titulo: "MESTRADO" })).toBe(true);
  });

  it("linha incompleta não trava o rascunho; no Não conforme/Não enviado ela sai", () => {
    const regra = {
      blocos: [
        { codigo: "CURSOS", tipo: "CURSOS", titulo: "Cursos", motivos: [] },
        {
          codigo: "EXPERIENCIA",
          tipo: "VINCULOS",
          titulo: "Experiência",
          motivos: [],
          categorias: [{ codigo: "AREA", rotulo: "Área" }],
        },
      ],
    };
    const l = {
      nivel: "superior",
      blocos: { EXPERIENCIA: { situacao: "NAO_ENVIADO" } },
      cursos: [
        { nome: "Curso", horas: "" },
        { nome: "Outro", horas: 40 },
      ],
      vinculos: [
        { categoria: "AREA", inicio: "", fim: "" },
        { categoria: "AREA", inicio: "2020-01-01", fim: "2021-01-01" },
      ],
    };
    const gravado = lancamentoParaGravar(regra, l);
    // O curso sem horas vai sem o campo (o banco aceita); o resto fica.
    expect(gravado.cursos).toEqual([
      { nome: "Curso" },
      { nome: "Outro", horas: 40 },
    ]);
    // Experiência Não enviado: a linha sem datas sai.
    expect(gravado.vinculos).toEqual([
      { categoria: "AREA", inicio: "2020-01-01", fim: "2021-01-01" },
    ]);
    // O lançamento da tela não muda.
    expect(l.cursos[0].horas).toBe("");
    expect(l.vinculos).toHaveLength(2);
  });

  it("observação pronta de texto igual a um motivo do bloco não se repete", () => {
    const regra = {
      blocos: [],
      observacoes_prontas: [
        {
          codigo: "EVENTOS",
          rotulo: "Eventos acadêmicos não são pontuados",
          texto: "Eventos acadêmicos não são pontuados.",
        },
        { codigo: "OUTRA", rotulo: "Outra", texto: "Outra observação." },
      ],
    };
    const bloco = {
      codigo: "CURSOS",
      tipo: "CURSOS",
      motivos: [
        { codigo: "EVENTO", texto: "Eventos acadêmicos não são pontuados." },
      ],
    };
    expect(opcoesDeJustificativa(regra, bloco).map((o) => o.codigo)).toEqual([
      "EVENTO",
      "OUTRA",
    ]);
  });
});

describe("as três escolhas: Confere, Não confere e Editar nota", () => {
  const escolher = (l, escolha, extra = {}) =>
    blocoComEscolha({
      bloco: CURSOS,
      lancamento: l,
      escolha,
      declarada,
      ...extra,
    });

  it("Confere aceita o declarado: pontuação = declarado, sem justificativa", () => {
    expect(
      escolher(
        lancamento({
          CURSOS: { justificativas: ["X"], justificativa_livre: "t" },
        }),
        "CONFERE",
      ),
    ).toEqual({
      situacao: "CONFORME",
      motivos: [],
      edita_nota: false,
      nota_ajustada: 3,
      justificativas: [],
      justificativa_livre: "",
    });
  });

  it("Não confere zera; 'não enviou' vira NAO_ENVIADO e os motivos ficam", () => {
    const nao = escolher(
      lancamento({ CURSOS: { motivos: ["M1"], edita_nota: true } }),
      "NAO_CONFERE",
    );
    expect(nao).toMatchObject({
      situacao: "NAO_CONFORME",
      nota_ajustada: 0,
      edita_nota: true,
    });
    expect(nao.motivos).toEqual(["M1"]);
    expect(
      escolher(lancamento({ CURSOS: nao }), "NAO_CONFERE", { naoEnviou: true }),
    ).toMatchObject({
      situacao: "NAO_ENVIADO",
      nota_ajustada: 0,
      motivos: ["M1"],
    });
  });

  it("Editar nota: a pontuação vem do calculado; o ajuste de quem já editava fica", () => {
    const editar = escolher(
      lancamento({ CURSOS: { situacao: "CONFORME", nota_ajustada: 3 } }),
      "EDITAR",
    );
    expect(editar).toMatchObject({
      situacao: "CONFORME",
      edita_nota: true,
      nota_ajustada: null,
    });
    expect(
      escolher(
        lancamento({
          CURSOS: { situacao: "CONFORME", edita_nota: true, nota_ajustada: 2 },
        }),
        "EDITAR",
      ).nota_ajustada,
    ).toBe(2);
    // Desmarcar tira a escolha e o ajuste.
    const nada = escolher(lancamento({ CURSOS: editar }), null);
    expect(nada.situacao).toBeNull();
    expect(nada.nota_ajustada).toBeNull();
    expect("edita_nota" in nada).toBe(false);
  });

  it("blocos que não pontuam: só Confere e Não confere, sem nota", () => {
    const doc = { codigo: "IDENTIDADE", tipo: "DOCUMENTO" };
    expect(
      blocoComEscolha({
        bloco: doc,
        lancamento: lancamento(),
        escolha: "CONFERE",
        declarada,
      }),
    ).toEqual({ situacao: "CONFORME", motivos: [] });
    expect(escolhaDoBloco(doc, { situacao: "CONFORME" }, declarada, null)).toBe(
      "CONFERE",
    );
  });

  it("a escolha gravada; rascunhos de antes pela pontuação (igual ao declarado = Confere)", () => {
    const de = (lancado, calculado = 0) =>
      escolhaDoBloco(CURSOS, lancado, declarada, calculado);
    expect(de({})).toBeNull();
    expect(de({ situacao: "NAO_ENVIADO" })).toBe("NAO_CONFERE");
    expect(
      de({ situacao: "CONFORME", edita_nota: true, nota_ajustada: 3 }),
    ).toBe("EDITAR");
    expect(
      de({ situacao: "CONFORME", edita_nota: false, nota_ajustada: 1 }),
    ).toBe("CONFERE");
    // Rascunho antigo: o Declarado gravado como ajuste do Apurado = Confere.
    expect(de({ situacao: "CONFORME", nota_ajustada: 3 })).toBe("CONFERE");
    // Rascunho da tela anterior: o Apurado pelos itens, diferente = Editar.
    expect(de({ situacao: "CONFORME" }, 1)).toBe("EDITAR");
    expect(de({ situacao: "CONFORME" }, 3)).toBe("CONFERE");
  });

  it("Confere com declarado > 0 já abre a linha; Não confere não abre nada", () => {
    const comLinha = lancamentoComEscolha({
      bloco: CURSOS,
      lancamento: lancamento(),
      escolha: "CONFERE",
      declarada,
      respostas: ['"3 pontos"'],
    });
    expect(comLinha.cursos).toEqual([{ nome: "", horas: "", aceito: true }]);
    expect(
      lancamentoComEscolha({
        bloco: CURSOS,
        lancamento: lancamento(),
        escolha: "NAO_CONFERE",
        declarada,
        respostas: [],
      }).cursos,
    ).toEqual([]);
  });
});
