import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calcularFicha,
  conferenciaDaFicha,
  pendenciasDaFicha,
  pontuacaoAcimaDoComprovado,
} from "../../src/lib/avaliacao-documental/ficha.ts";

/*
  Auditoria de 20/10/2026 (edital 114/2026): o Confere da experiência grava a
  declarada como ajuste (nota_ajustada) e a parcial fica acima do que os
  vínculos aceitos comprovam (16 meses = 5 pontos, ficha com 35). A ficha
  passa a pedir (tipo "acima") que os vínculos sejam lançados ou a pontuação
  ajustada em Editar nota com justificativa; o banco pede o mesmo
  (FC_PENDENCIAS_FICHA, migration 20261020180000). Dados fictícios.
*/
const CASOS = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/casos-de-pontuacao.json",
    "utf8",
  ),
);
const REGRA = CASOS.regras["PROJ26-CURRICULAR"];
const EXPERIENCIA = REGRA.blocos.find((b) => b.codigo === "EXPERIENCIA");
const DOCUMENTAL = { nota_minima: 15, nota_minima_por_nivel: {} };
const DECLARADA = { parciais: { EXPERIENCIA: 35, FORMACAO: 0, CURSOS: 0 } };
const vinculo = (inicio, fim, extra = {}) => ({
  empregador: "Empresa fictícia",
  categoria: "AREA_OU_SUS",
  inicio,
  fim,
  aceito: true,
  ...extra,
});
// 2025-01-01 a 2026-04-30: 485 dias = 16 meses → (16 − 6) / 6 = 1 período = 5 pontos.
const DEZESSEIS_MESES = [vinculo("2025-01-01", "2026-04-30")];
const lancamento = (experiencia, vinculos = DEZESSEIS_MESES) => ({
  nivel: "superior",
  modalidade: "AC",
  indigena: false,
  mora_aldeia: false,
  aldeia_na_lista: false,
  estagio_horas: 0,
  blocos: {
    IDENTIDADE: { motivos: [], situacao: "CONFORME" },
    ESCOLARIDADE: { motivos: [], situacao: "CONFORME" },
    REGISTRO_CONSELHO: { motivos: [], situacao: "CONFORME" },
    FORMACAO: { motivos: [], situacao: "CONFORME" },
    CURSOS: { motivos: [], situacao: "CONFORME" },
    EXPERIENCIA: { motivos: [], ...experiencia },
  },
  titulos: [],
  cursos: [],
  vinculos,
  observacoes_prontas: [],
});
// O Confere como a tela grava (blocoComEscolha): a declarada como ajuste.
const CONFERE = { situacao: "CONFORME", edita_nota: false, nota_ajustada: 35 };
const avaliar = (l) => calcularFicha(REGRA, l, DOCUMENTAL);
const pendencias = (l) => pendenciasDaFicha(REGRA, l, avaliar(l), DECLARADA);
const doTipo = (l, tipo) =>
  pendencias(l).filter((p) => p.bloco === "EXPERIENCIA" && p.tipo === tipo);

describe("experiência confirmada acima do que os vínculos aceitos comprovam", () => {
  it("Confere com a declarada acima do calculado: pendência", () => {
    const l = lancamento(CONFERE);
    const av = avaliar(l);
    expect(av.parciais.EXPERIENCIA).toBe(35);
    expect(av.calculados.EXPERIENCIA).toBe(5);
    expect(pontuacaoAcimaDoComprovado(EXPERIENCIA, l, av)).toEqual({
      parcial: "EXPERIENCIA",
      valor: 35,
      calculado: 5,
      meses: 16,
    });
    expect(doTipo(l, "acima")).toEqual([
      {
        bloco: "EXPERIENCIA",
        tipo: "acima",
        texto:
          "Experiência confirmada com 35 pontos, mas os vínculos aceitos comprovam 16 meses (5 pontos). Lance os vínculos que comprovam o período declarado ou ajuste a pontuação em Editar nota, com justificativa.",
      },
    ]);
    // A diferença da declarada não aparece (parcial = declarada): só esta falta.
    expect(doTipo(l, "justificativa")).toEqual([]);
    expect(
      conferenciaDaFicha(REGRA, l, av, pendencias(l)).texto_da_falta,
    ).toContain("pontuação acima do comprovado");
  });

  it("eliminado por outro critério: sem pendência (pontuação só informativa)", () => {
    // 21/10/2026: a equipe confirma a experiência do candidato já eliminado só
    // para registrar o mínimo; a ficha não pode travar (20261021090000).
    const l = lancamento(CONFERE);
    l.blocos.IDENTIDADE = {
      situacao: "NAO_CONFORME",
      motivos: [
        REGRA.blocos.find((b) => b.codigo === "IDENTIDADE").motivos[0].codigo,
      ],
    };
    expect(avaliar(l).resultado).toBe("INAPTO_REQUISITO");
    expect(doTipo(l, "acima")).toEqual([]);
  });

  it("vínculos que comprovam o declarado: sem pendência", () => {
    // 2016-01-01 a 2025-10-31: 119 meses → 35 pontos (teto).
    const l = lancamento(CONFERE, [vinculo("2016-01-01", "2025-10-31")]);
    expect(avaliar(l).calculados.EXPERIENCIA).toBe(35);
    expect(doTipo(l, "acima")).toEqual([]);
  });

  it("Editar nota com justificativa: sem pendência (o caminho legítimo)", () => {
    const l = lancamento({
      situacao: "CONFORME",
      edita_nota: true,
      nota_ajustada: 35,
      justificativas: ["ANTES_DO_DIPLOMA"],
    });
    expect(doTipo(l, "acima")).toEqual([]);
  });

  it("Editar nota acima do calculado sem justificativa: pendência", () => {
    const l = lancamento({
      situacao: "CONFORME",
      edita_nota: true,
      nota_ajustada: 35,
      justificativas: [],
      justificativa_livre: "",
    });
    expect(doTipo(l, "acima")).toHaveLength(1);
  });

  it("Editar nota pelo calculado: sem pendência (a diferença pede a justificativa de sempre)", () => {
    const l = lancamento({
      situacao: "CONFORME",
      edita_nota: true,
      nota_ajustada: null,
    });
    expect(doTipo(l, "acima")).toEqual([]);
    expect(doTipo(l, "justificativa")).toHaveLength(1);
  });

  it("abaixo do mínimo ou sem vínculo: a falta é a do mínimo/registro, não esta", () => {
    expect(
      doTipo(
        lancamento(CONFERE, [vinculo("2026-01-01", "2026-03-31")]),
        "acima",
      ),
    ).toEqual([]);
    expect(doTipo(lancamento(CONFERE, []), "acima")).toEqual([]);
    expect(doTipo(lancamento(CONFERE, []), "comprovado")).toHaveLength(1);
  });

  it("Não confere: a regra existente (mínimo), sem esta", () => {
    const l = lancamento({
      situacao: "NAO_CONFORME",
      motivos: ["ESTAGIO_OU_SIMILAR"],
      nota_ajustada: 0,
    });
    expect(doTipo(l, "acima")).toEqual([]);
    expect(doTipo(l, "minimo").map((p) => p.texto)).toEqual([
      "Experiência marcada como Não confere, mas os vínculos aceitos somam 16 meses (mínimo 6 meses). Desmarque os vínculos que não foram aceitos — sem a experiência mínima o candidato é eliminado — ou marque Confere.",
    ]);
  });

  it("a pendência não muda a conta (espelho inalterado)", () => {
    const l = lancamento(CONFERE);
    const antes = avaliar(l);
    const copia = structuredClone(antes);
    pendenciasDaFicha(REGRA, l, antes, DECLARADA);
    expect(antes).toEqual(copia);
    expect(avaliar(l)).toEqual(copia);
    expect(antes.parciais.EXPERIENCIA).toBe(35);
    expect(antes.parecer).toBe(copia.parecer);
  });
});
