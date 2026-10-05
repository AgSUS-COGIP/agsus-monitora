import { describe, expect, it } from "vitest";
import {
  candidatoAtual,
  classificarEdital,
  itensDoAjuste,
  itensParaEnviar,
  listaDaOrigem,
  montarItens,
  previaDoAjuste,
  validarAjuste,
} from "../../src/lib/classificacao/ajustes.js";
import { listaDesatualizada } from "../../src/lib/classificacao/dados.js";
import { instantaneoDaLista } from "../../src/lib/classificacao/exportacao.js";

/*
  O ajuste da pontuação aprovado em recurso (migration 20261005130000) no
  motor da Classificação: substitui o valor da análise sem tocar a planilha,
  marca o candidato e entra na explicação; a prévia mostra a nova posição e
  quem muda de lugar por causa dele.
*/

const REGRA = {
  etapas: { documental: true, entrevista: true },
  documental: {
    situacoes_aptas: ["Aprovado"],
    parciais: ["FORMACAO", "EXPERIENCIA", "ETNICO"],
  },
  entrevista: {
    competencias: [
      { ordem: 1, nome: "Comunicação" },
      { ordem: 2, nome: "Trabalho em equipe" },
    ],
  },
  composicao: {
    componentes: [
      { codigo: "DOCUMENTAL", peso: 1 },
      { codigo: "ENTREVISTA", peso: 1 },
    ],
    casas: 2,
  },
};

const candidato = (id, nome, nota, parciais = {}) => ({
  analise_id: id,
  codigo: id,
  nome,
  vaga: "V1",
  cargo: "Enfermeiro",
  modalidade: "Ampla concorrência",
  status: "Aprovado",
  nota_documental: nota,
  pontuacao_formacao: parciais.formacao ?? 5,
  pontuacao_experiencia: parciais.experiencia ?? 10,
  pontuacao_etnica: parciais.etnico ?? 0,
});

const entrevista = (id, nota, notas = []) => ({
  id: `e-${id}`,
  analise_id: id,
  nome: id,
  vaga: "V1",
  nota,
  parecer: "APTO",
  compareceu: "S",
  ligacao: "codigo",
  origem: "sistema",
  notas,
});

function dadosDoEdital(extra = {}) {
  return {
    edital: { id: "ed1", unidade: "DSEI" },
    regra: { versao: 1, configuracao: REGRA },
    candidatos: [
      candidato("a", "Ana", 20),
      candidato("b", "Bruno", 18),
      candidato("c", "Carla", 15, { formacao: 3, experiencia: 9, etnico: 3 }),
    ],
    entrevistas: [],
    quadro: [],
    cronograma: [],
    desempates: [],
    ajustes: [],
    ...extra,
  };
}

const ajusteDaCarla = (itens, campos = {}) => ({
  id: "aj1",
  recurso_id: "r7",
  numero: 7,
  analise_id: "c",
  versao: 1,
  aprovado_em: "2026-10-05T12:00:00Z",
  itens,
  ...campos,
});

const posicoes = (resultado) =>
  resultado.vagas[0].geral.map((l) => `${l.posicao} ${l.nome}`);

describe("ajuste aprovado no motor da Classificação", () => {
  it("o valor novo substitui o da análise: a candidata passa para 1º e a planilha não muda", () => {
    const dados = dadosDoEdital();
    expect(posicoes(classificarEdital(dados, "PRELIMINAR"))).toEqual([
      "1 Ana",
      "2 Bruno",
      "3 Carla",
    ]);
    const comAjuste = {
      ...dados,
      ajustes: [
        ajusteDaCarla([
          { codigo: "FORMACAO", anterior: 3, novo: 9 },
          { codigo: "DOCUMENTAL", anterior: 15, novo: 21 },
        ]),
      ],
    };
    const r = classificarEdital(comAjuste, "PRELIMINAR");
    expect(posicoes(r)).toEqual(["1 Carla", "2 Ana", "3 Bruno"]);
    const carla = r.vagas[0].geral[0];
    expect(carla.nota).toBe(21);
    expect(carla.recursos).toEqual([7]);
    expect(carla.parciais.FORMACAO).toBe(9);
    expect(r.vagas[0].geral[1]).not.toHaveProperty("recursos");
    expect(r.explicacoes.c.explicacao.join(" ")).toContain(
      "Nota alterada pelo recurso nº 7: formação acadêmica 3,00 → 9,00; nota documental 15,00 → 21,00.",
    );
    // A entrada (o json do banco) fica como veio.
    expect(comAjuste.candidatos[2].nota_documental).toBe(15);
    expect(comAjuste.candidatos[2].pontuacao_formacao).toBe(3);
  });

  it("sem ajuste aprovado (proposto não chega ao motor), a lista é a da análise", () => {
    const r = classificarEdital(dadosDoEdital(), "PRELIMINAR");
    expect(r.explicacoes.c).not.toHaveProperty("recursos");
    expect(r.avisos.some((a) => a.codigo.startsWith("AJUSTE_"))).toBe(false);
  });

  it("avisa quando a análise mudou depois do ajuste e aplica na ordem da aprovação", () => {
    const dados = dadosDoEdital({
      ajustes: [
        ajusteDaCarla([{ codigo: "DOCUMENTAL", anterior: 14, novo: 16 }], {
          aprovado_em: "2026-10-05T12:00:00Z",
        }),
        ajusteDaCarla([{ codigo: "DOCUMENTAL", anterior: 16, novo: 19 }], {
          id: "aj2",
          recurso_id: "r8",
          numero: 8,
          aprovado_em: "2026-10-06T12:00:00Z",
        }),
      ],
    });
    const r = classificarEdital(dados, "PRELIMINAR");
    expect(r.explicacoes.c.nota).toBe(19);
    expect(r.explicacoes.c.recursos).toEqual([7, 8]);
    const divergentes = r.avisos.filter(
      (a) => a.codigo === "AJUSTE_DIVERGENTE",
    );
    expect(divergentes).toHaveLength(1);
    expect(divergentes[0].texto).toContain("recurso nº 7");
  });

  it("entrevista: ajusta a nota da entrevista no resultado final; sem entrevista, avisa", () => {
    const dados = dadosDoEdital({
      entrevistas: [
        entrevista("a", 10),
        entrevista("b", 10),
        entrevista("c", 10),
      ],
      ajustes: [
        ajusteDaCarla([{ codigo: "ENTREVISTA", anterior: 10, novo: 20 }]),
      ],
    });
    const r = classificarEdital(dados, "FINAL");
    expect(r.explicacoes.c.nota).toBe(35);
    expect(posicoes(r)[0]).toBe("1 Carla");

    const semEntrevista = classificarEdital(
      dadosDoEdital({
        ajustes: [
          ajusteDaCarla([{ codigo: "COMPETENCIA_1", anterior: 5, novo: 8 }]),
        ],
      }),
      "PRELIMINAR",
    );
    expect(
      semEntrevista.avisos.some((a) => a.codigo === "AJUSTE_SEM_ENTREVISTA"),
    ).toBe(true);
  });

  it("o retrato da lista leva o número do recurso (para auditoria e documentos)", () => {
    const r = classificarEdital(
      dadosDoEdital({
        ajustes: [
          ajusteDaCarla([{ codigo: "DOCUMENTAL", anterior: 15, novo: 21 }]),
        ],
      }),
      "PRELIMINAR",
    );
    const retrato = instantaneoDaLista(r, { regra: REGRA, versao: 1 });
    expect(retrato.vagas[0].geral[0]).toMatchObject({
      nome: "Carla",
      recursos: [7],
    });
    expect(retrato.vagas[0].geral[1]).not.toHaveProperty("recursos");
  });
});

describe("componentes ajustáveis pela regra do edital", () => {
  it("parciais da regra, documental somada, competências e entrevista somada", () => {
    const dados = dadosDoEdital({
      entrevistas: [
        entrevista("c", 12, [
          { ordem: 1, criterio: "Comunicação", nota: 6 },
          { ordem: 2, criterio: "Equipe", nota: 6 },
        ]),
      ],
    });
    const c = candidatoAtual(dados, "c");
    const itens = itensDoAjuste(REGRA, c);
    expect(itens.map((i) => i.codigo)).toEqual([
      "FORMACAO",
      "EXPERIENCIA",
      "ETNICO",
      "DOCUMENTAL",
      "COMPETENCIA_1",
      "COMPETENCIA_2",
      "ENTREVISTA",
    ]);
    expect(itens.find((i) => i.codigo === "DOCUMENTAL")).toMatchObject({
      atual: 15,
      calculado: true,
    });
    expect(itens.find((i) => i.codigo === "COMPETENCIA_2").rotulo).toBe(
      "Trabalho em equipe",
    );
  });

  it("sem parciais na regra, a nota documental é editável; só parecer não tem entrevista; ART quando compõe a nota", () => {
    const regra = {
      ...REGRA,
      documental: { situacoes_aptas: ["Aprovado"], parciais: [] },
      entrevista: { so_parecer: true },
      composicao: {
        componentes: [
          { codigo: "DOCUMENTAL", peso: 1 },
          { codigo: "ART", peso: 1 },
        ],
      },
    };
    const dados = dadosDoEdital({ entrevistas: [entrevista("c", 10)] });
    const itens = itensDoAjuste(regra, candidatoAtual(dados, "c"));
    expect(itens.map((i) => [i.codigo, i.calculado])).toEqual([
      ["DOCUMENTAL", false],
      ["ART", false],
    ]);
  });

  it("o valor atual desconsidera o ajuste aprovado do próprio recurso (a nova versão o substitui)", () => {
    const dados = dadosDoEdital({
      ajustes: [
        ajusteDaCarla([{ codigo: "DOCUMENTAL", anterior: 15, novo: 21 }]),
      ],
    });
    expect(candidatoAtual(dados, "c").notaDocumental).toBe(21);
    expect(
      candidatoAtual(dados, "c", { semRecurso: "r7" }).notaDocumental,
    ).toBe(15);
  });

  it("monta o rascunho: o total soma as diferenças; valida e envia só o que mudou", () => {
    const itens = itensDoAjuste(REGRA, candidatoAtual(dadosDoEdital(), "c"));
    const montados = montarItens(itens, {
      valores: { FORMACAO: "9", EXPERIENCIA: "9,5" },
      justificativas: { FORMACAO: "Diploma de mestrado aceito." },
    });
    expect(montados.find((i) => i.codigo === "DOCUMENTAL").novo).toBe(21.5);
    expect(validarAjuste(montados, "")).toEqual([
      "Escreva a justificativa geral ou a de cada componente alterado (10 caracteres ou mais).",
    ]);
    expect(validarAjuste(montados, "Recurso deferido em parte.")).toEqual([]);
    expect(itensParaEnviar(montados)).toEqual([
      {
        codigo: "FORMACAO",
        anterior: 3,
        novo: 9,
        justificativa: "Diploma de mestrado aceito.",
      },
      { codigo: "EXPERIENCIA", anterior: 9, novo: 9.5 },
      {
        codigo: "DOCUMENTAL",
        anterior: 15,
        novo: 21.5,
        justificativa: "Soma das diferenças dos componentes ajustados.",
      },
    ]);
    expect(
      validarAjuste(montarItens(itens, {}), "Justificativa longa."),
    ).toEqual(["Altere ao menos um valor."]);
    expect(
      validarAjuste(
        montarItens(itens, { valores: { ETNICO: "abc" } }),
        "Justificativa longa.",
      )[0],
    ).toBe("Valor de 0 a 1000 em: Pertencimento étnico.");
  });
});

describe("prévia do ajuste", () => {
  it("nova nota, nova posição e quem muda de lugar por causa dele", () => {
    const previa = previaDoAjuste({
      dados: dadosDoEdital(),
      tipo: "PRELIMINAR",
      analiseId: "c",
      recursoId: "r7",
      numero: 7,
      itens: [{ codigo: "DOCUMENTAL", anterior: 15, novo: 21 }],
    });
    expect(previa).toMatchObject({
      tipo: "PRELIMINAR",
      vaga: "V1",
      mudou: true,
      antes: { posicao: 3, nota: 15 },
      depois: { posicao: 1, nota: 21 },
      totalAfetados: 2,
    });
    expect(previa.afetados).toEqual([
      expect.objectContaining({ nome: "Ana", antes: 1, depois: 2 }),
      expect.objectContaining({ nome: "Bruno", antes: 2, depois: 3 }),
    ]);
    // json pequeno, gravável
    expect(JSON.stringify(previa).length).toBeLessThan(2000);
  });

  it("ajuste que não muda a posição: mudou = false e ninguém afetado", () => {
    const previa = previaDoAjuste({
      dados: dadosDoEdital(),
      tipo: "PRELIMINAR",
      analiseId: "c",
      recursoId: "r7",
      itens: [{ codigo: "DOCUMENTAL", anterior: 15, novo: 16 }],
    });
    expect(previa.mudou).toBe(false);
    expect(previa.afetados).toEqual([]);
  });

  it("a versão nova substitui a aprovada do mesmo recurso no 'depois'; o 'antes' é a lista de agora", () => {
    const dados = dadosDoEdital({
      ajustes: [
        ajusteDaCarla([{ codigo: "DOCUMENTAL", anterior: 15, novo: 21 }]),
      ],
    });
    const previa = previaDoAjuste({
      dados,
      tipo: "PRELIMINAR",
      analiseId: "c",
      recursoId: "r7",
      itens: [{ codigo: "DOCUMENTAL", anterior: 15, novo: 19 }],
    });
    // Agora (v1 aprovada, 21) ela é a 1ª; com a v2 (19) fica atrás de Ana (20).
    expect(previa.antes).toMatchObject({ posicao: 1, nota: 21 });
    expect(previa.depois).toMatchObject({ posicao: 2, nota: 19 });
  });

  it("a lista da prévia segue a origem do recurso", () => {
    expect(listaDaOrigem("analise-curricular")).toBe("PRELIMINAR");
    expect(listaDaOrigem("entrevista")).toBe("ENTREVISTA");
    expect(listaDaOrigem("resultado-final")).toBe("FINAL");
    expect(listaDaOrigem("outra")).toBe("FINAL");
  });
});

describe("lista desatualizada", () => {
  it("avisa quando um ajuste foi aprovado (ou cancelado) depois da geração", () => {
    const lista = { gerada_em: "2026-10-05T10:00:00Z" };
    expect(listaDesatualizada(lista, "2026-10-05T11:00:00Z")).toBe(true);
    expect(listaDesatualizada(lista, "2026-10-05T09:00:00Z")).toBe(false);
    expect(listaDesatualizada(lista, null)).toBe(false);
    expect(listaDesatualizada(null, "2026-10-05T11:00:00Z")).toBe(false);
  });
});
