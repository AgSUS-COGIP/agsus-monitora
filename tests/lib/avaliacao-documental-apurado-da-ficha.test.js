import { describe, expect, it } from "vitest";
import {
  abreComLinhaNova,
  apuradoDoBloco,
  blocoComDecisao,
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
  it("abre com linha nova só com declarado > 0, lista vazia e sem Não conforme/Não enviado", () => {
    expect(abreComLinhaNova(CURSOS, lancamento(), declarada)).toBe(true);
    expect(
      abreComLinhaNova(CURSOS, lancamento(), { parciais: { CURSOS: 0 } }),
    ).toBe(false);
    expect(
      abreComLinhaNova(CURSOS, lancamento({}, { cursos: [{}] }), declarada),
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
    const texto =
      "Registre o curso comprovado (ou marque Não conforme ou Não enviado).";
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
