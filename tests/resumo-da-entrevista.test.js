import { describe, expect, it } from "vitest";
import {
  fraseDaConvocacao,
  fraseDoDesempate,
  frasesDaBanca,
  frasesDaNota,
  linhasDasVagas,
  listaBr,
  resumoDasRegrasDaEntrevista,
} from "../src/lib/resumo-da-entrevista.ts";

/*
  O resumo das regras da entrevista em linguagem simples (Conduzir ›
  Preparar): as frases saem dos dados da regra, do roteiro e da banca.
*/
const comp = (id, ordem, nome, extra = {}) => ({
  id,
  ordem,
  nome,
  nota_maxima: 5,
  peso: 1,
  minimo: 2,
  tipo_minimo: "VALOR",
  ...extra,
});
const ROTEIRO_SI = {
  nome: "Treinamento",
  escala: "NIVEIS",
  nota_minima_total: 8,
  notas_eliminatorias: [],
  ausencia_elimina: true,
  niveis: [0, 1, 2, 3, 4, 5].map((nota) => ({ nota, nome: `N${nota}` })),
  aspectos: [
    { id: "s1", ordem: 1, nome: "Conceitua" },
    { id: "s2", ordem: 2, nome: "Propriedade" },
    { id: "s3", ordem: 3, nome: "Profundidade" },
  ],
  competencias: [
    comp("c1", 1, "Comunicação e escuta"),
    comp("c2", 2, "Trabalho em equipe"),
    comp("c3", 3, "Respeito à diversidade cultural"),
    comp("c4", 4, "Conhecimento da função"),
  ],
};
const BANCA = [
  {
    id: "a1",
    nome: "Avaliador Teste 1",
    origem: "AgSUS",
    banca: 1,
    ativo: true,
    competencias: null,
  },
  {
    id: "a2",
    nome: "Avaliador Teste 2",
    origem: "DSEI",
    banca: 1,
    ativo: true,
    competencias: ["c2"],
  },
];

describe("resumo das regras da entrevista", () => {
  it("lista em português", () => {
    expect(listaBr(["A"])).toBe("A");
    expect(listaBr(["A", "B", "C"])).toBe("A, B e C");
  });

  it("quem é chamado: múltiplo, exceção, cadastro reserva e empatados", () => {
    expect(
      fraseDaConvocacao({
        multiplo_vagas: 3,
        posicao_max_cr: 5,
        incluir_empatados: true,
        excecoes: [{ termos: ["Enfermeiro"], multiplo_vagas: 6 }],
      }),
    ).toBe(
      "até 3 pessoas por vaga imediata (Enfermeiro: 6 pessoas); nas vagas só de cadastro reserva, até a 5ª posição; quem empatar com o último chamado também entra",
    );
    expect(
      fraseDaConvocacao({ multiplo_vagas: 1, incluir_empatados: false }),
    ).toBe(
      "até 1 pessoa por vaga imediata; quem empatar com o último chamado só entra se couber no limite",
    );
    expect(fraseDaConvocacao({ posicao_max_cr: 10 })).toBe(
      "até a 10ª posição de cada vaga; quem empatar com o último chamado também entra",
    );
    expect(fraseDaConvocacao({})).toBe(
      "todos os classificados (a regra não tem limite)",
    );
    expect(fraseDaConvocacao(null)).toBe("");
  });

  it("a tabelinha das vagas", () => {
    expect(
      linhasDasVagas([
        { vaga: "001", cargo: "Enfermeiro", total: 1, limite: 6 },
        { vaga: "003", cargo: "Agente", total: 0, limite: 5 },
        { vaga: "009", cargo: "Antiga", semVagasNaLista: true, limite: null },
      ]),
    ).toEqual([
      {
        vaga: "001",
        cargo: "Enfermeiro",
        imediatas: "1",
        chamaAte: "até a 6ª",
      },
      {
        vaga: "003",
        cargo: "Agente",
        imediatas: "cadastro reserva",
        chamaAte: "até a 5ª",
      },
      { vaga: "009", cargo: "Antiga", imediatas: "—", chamaAte: "—" },
    ]);
  });

  it("como a nota é calculada: aspectos, média de quem avalia, inapto e falta", () => {
    expect(frasesDaNota(ROTEIRO_SI, true)).toEqual([
      "Cada avaliador dá 3 notas (Conceitua, Propriedade e Profundidade) de 0 a 5 em cada uma das 4 competências; a nota dele na competência é a média dessas notas.",
      "A nota da competência é a média dos avaliadores que a avaliam; a nota final é a soma das competências, até 20 pontos.",
      "Abaixo de 2 em qualquer competência ou abaixo de 8 no total, o candidato fica inapto.",
      "Quem falta é eliminado.",
    ]);
  });

  it("sem aspectos: uma nota, peso, mínimos diferentes, eliminatórias e falta que não elimina", () => {
    const frases = frasesDaNota({
      escala: "FAIXA",
      passo: 0.5,
      nota_minima_total: null,
      notas_eliminatorias: [0, 1],
      ausencia_elimina: false,
      competencias: [
        comp("p1", 1, "Técnica", {
          nota_maxima: 2,
          minimo: 50,
          tipo_minimo: "PERCENTUAL",
        }),
        comp("p2", 2, "Intercultural", {
          nota_maxima: 2,
          peso: 1.5,
          minimo: null,
        }),
      ],
    });
    expect(frases[0]).toBe(
      "Cada avaliador dá uma nota (0; 0,5; 1; 1,5 ou 2) em cada uma das 2 competências.",
    );
    expect(frases[1]).toBe(
      "A nota da competência é a média dos avaliadores vezes o peso (Intercultural: peso 1,5); a nota final é a soma das competências, até 5 pontos.",
    );
    expect(frases[2]).toBe(
      "Abaixo do mínimo da competência (Técnica: 1) ou com média 0 ou 1 em alguma competência, o candidato fica inapto.",
    );
    expect(frases[3]).toBe("Quem falta fica com nota 0, sem ser eliminado.");
  });

  it("quem avalia: por banca, só as competências de cada um, contagem e avisos", () => {
    const { frases, avisos } = frasesDaBanca(BANCA, ROTEIRO_SI, "SECRETARIA");
    expect(frases).toEqual([
      "Banca 1 — Avaliador Teste 1 (AgSUS) avalia todas as competências; Avaliador Teste 2 (DSEI) avalia só Trabalho em equipe.",
      "Na banca 1, Trabalho em equipe: 2 avaliadores; as outras: 1 avaliador.",
      "A secretaria passa a limpo as notas de cada avaliador.",
    ]);
    expect(avisos).toEqual([]);
    const semNinguem = frasesDaBanca(
      [
        { ...BANCA[1], banca: 2 },
        { ...BANCA[0], competencias: ["c1", "c3", "c4"] },
      ],
      ROTEIRO_SI,
      "AVALIADOR",
    );
    expect(semNinguem.avisos).toEqual([
      "Na banca 1, ninguém avalia “Trabalho em equipe”.",
      "Na banca 2, ninguém avalia “Comunicação e escuta”.",
      "Na banca 2, ninguém avalia “Respeito à diversidade cultural”.",
      "Na banca 2, ninguém avalia “Conhecimento da função”.",
    ]);
    expect(semNinguem.frases.at(-1)).toBe(
      "Cada avaliador lança as próprias notas no sistema.",
    );
    expect(frasesDaBanca([], ROTEIRO_SI).frases).toEqual([
      "Ainda sem membros na banca.",
    ]);
  });

  it("desempate na ordem, com o empate final", () => {
    expect(
      fraseDoDesempate(
        [
          { nome: "60 anos ou mais na data de corte" },
          { nome: "Maior pontuação na entrevista" },
        ],
        "Sorteio registrado",
      ),
    ).toBe(
      "Se a nota final empatar, vale, nesta ordem: 1º 60 anos ou mais na data de corte; 2º maior pontuação na entrevista. Se ainda empatar: sorteio registrado.",
    );
    expect(fraseDoDesempate([], "")).toBe("");
  });

  it("o resumo inteiro: quatro blocos, cada um com o caminho para editar", () => {
    const blocos = resumoDasRegrasDaEntrevista({
      temRegra: true,
      convocacao: { multiplo_vagas: 3, posicao_max_cr: 5 },
      vagas: [{ vaga: "001", cargo: "Enfermeiro", total: 1, limite: 3 }],
      roteiro: ROTEIRO_SI,
      avaliadores: BANCA,
      lancamento: "SECRETARIA",
      desempate: [{ nome: "Maior pontuação na entrevista" }],
      empateFinal: "Sorteio registrado",
      convocados: { naFicha: 2, naLista: 3 },
    });
    expect(blocos.map((b) => b.id)).toEqual([
      "convocacao",
      "nota",
      "banca",
      "desempate",
    ]);
    expect(blocos[0].frases).toEqual([
      "Até 3 pessoas por vaga imediata; nas vagas só de cadastro reserva, até a 5ª posição; quem empatar com o último chamado também entra.",
      "Na ficha de notas: 2 de 3 da lista de convocação.",
    ]);
    expect(blocos[0].vagas).toHaveLength(1);
    expect(blocos.map((b) => b.acoes.map((a) => a.destino))).toEqual([
      ["classificacao", "convocacao"],
      ["roteiro"],
      ["configuracao"],
      ["classificacao"],
    ]);
    expect(blocos[1].frases[1]).toContain("dos avaliadores que a avaliam");
  });

  it("sem regra e sem roteiro: diz onde definir", () => {
    const blocos = resumoDasRegrasDaEntrevista({ temRegra: false });
    expect(blocos[0].frases[0]).toBe(
      "O edital ainda não tem regra de classificação: quem é chamado é definido lá.",
    );
    expect(blocos[1].acoes).toEqual([
      { destino: "configuracao", rotulo: "Escolher roteiro" },
    ]);
    expect(blocos[1].frases[1] ?? "").toBe("");
    // Todos avaliam todas: a média é "dos avaliadores" (sem "que a avaliam").
    const todas = resumoDasRegrasDaEntrevista({
      temRegra: true,
      roteiro: ROTEIRO_SI,
      avaliadores: [BANCA[0]],
    });
    expect(todas[1].frases[1]).not.toContain("que a avaliam");
  });
});
