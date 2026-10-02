import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  classificar,
  limiteDaConvocacao,
} from "../../src/lib/classificacao/motor.js";
import { normalizarRegra } from "../../src/lib/classificacao/regra.js";
import {
  chaveDoGrupo,
  ordemDoSorteio,
} from "../../src/lib/classificacao/sorteio.js";

/*
  O motor da classificação com casos montados a partir das listas publicadas
  dos editais 83/2026 e 100/2026 (levantamento em
  scratchpad/classificacao/listas-publicadas.md e verificacao-desempate.md) e
  com as regras de exemplo dos seeds (supabase/correcoes/20261002-…).
*/

const SEED = readFileSync(
  "supabase/correcoes/20261002-regras-de-classificacao-83-e-100.sql",
  "utf8",
);
const regraDoSeed = (marca) => {
  const inicio = SEED.indexOf(`$${marca}$`) + marca.length + 2;
  return JSON.parse(SEED.slice(inicio, SEED.indexOf(`$${marca}$`, inicio)));
};
export const REGRA_83 = regraDoSeed("regra83");
export const REGRA_100 = regraDoSeed("regra100");

let sequencia = 0;
const uuid = () => {
  sequencia += 1;
  return `00000000-0000-4000-8000-${String(sequencia).padStart(12, "0")}`;
};

/* Um candidato da análise como o RPC devolve. */
function candidato(nome, campos = {}) {
  return {
    analise_id: uuid(),
    codigo: String(1000 + sequencia),
    nome,
    vaga: "169681",
    cargo: "Cirurgião Dentista - Área de abrangência DSEI Xingu",
    modalidade: "Ampla concorrência",
    pcd: "Não",
    status: "Aprovado",
    pontuacao_etnica: 0,
    ...campos,
  };
}
const entrevista = (c, nota, campos = {}) => ({
  id: uuid(),
  analise_id: c.analise_id,
  nome: c.nome,
  vaga: c.vaga,
  nota,
  parecer: "APTO",
  compareceu: "S",
  ligacao: "codigo",
  origem: "planilha",
  notas: [],
  ...campos,
});
const nomes = (linhas) => linhas.map((l) => l.nome);
const posicoes = (linhas) => linhas.map((l) => `${l.posicao} ${l.nome}`);
const vagaDe = (r, chave) => r.vagas.find((v) => v.chave === chave);
const avisosDe = (r, codigo) => r.avisos.filter((a) => a.codigo === codigo);

const QUADRO_169681 = {
  id: "q1",
  ordem: 1,
  cargo: "Cirurgião Dentista",
  lotacao: "Área de abrangência DSEI Xingu",
  modalidades: { "Ampla Concorrência": 2, "Pretos e Pardos": 1, PcD: null },
  vagas_imediatas: 3,
  cadastro_reserva: true,
};

describe("edital 83/2026 — resultado final da vaga 169681 (Cirurgião Dentista)", () => {
  const kayanaku = candidato("Kayanaku Mehinako", {
    nota_documental: "14,6",
    modalidade: "Indígenas",
    pontuacao_etnica: 12,
    quadro: "q1",
  });
  const jucikely = candidato("Jucikely Miguel da Silva", {
    nota_documental: "13,0",
    quadro: "q1",
  });
  const vanderlei = candidato("Vanderlei Tadeu Bertanha", {
    nota_documental: "11,2",
    quadro: "q1",
  });
  const pedro = candidato("Pedro Alexandre Schmidt Passos", {
    nota_documental: "8,8",
    quadro: "q1",
  });
  const ercilio = candidato("Ercilio Faria Coronheiro", {
    nota_documental: "9,0",
    quadro: "q1",
  });
  // Aprovada na entrevista (12) e ausente da lista final publicada: aqui ela não some.
  const marquele = candidato("Marquele Sousa da Silva", {
    nota_documental: "11,3",
    quadro: "q1",
  });
  const candidatos = [jucikely, kayanaku, vanderlei, pedro, ercilio, marquele];
  const entrevistas = [
    entrevista(kayanaku, 20),
    entrevista(jucikely, 17.33),
    entrevista(vanderlei, 16.67),
    entrevista(pedro, 17.33),
    entrevista(ercilio, 10),
    entrevista(marquele, 12),
  ];
  const r = classificar({
    tipo: "FINAL",
    regra: REGRA_83,
    candidatos,
    entrevistas,
    quadro: [QUADRO_169681],
    unidade: "DSEI Xingu",
    dataCorte: "2026-07-20",
  });
  const vaga = vagaDe(r, "169681");

  it("nota final = documental + entrevista, com a casa decimal da publicação", () => {
    expect(vaga.geral.map((l) => [l.nome, l.nota])).toEqual([
      ["Kayanaku Mehinako", 34.6],
      ["Jucikely Miguel da Silva", 30.3],
      ["Vanderlei Tadeu Bertanha", 27.9],
      ["Pedro Alexandre Schmidt Passos", 26.1],
      ["Marquele Sousa da Silva", 23.3],
      ["Ercilio Faria Coronheiro", 19],
    ]);
  });

  it("ninguém aprovado some: a candidata ausente da publicação fica em 5º", () => {
    expect(posicoes(vaga.geral)).toContain("5 Marquele Sousa da Silva");
    expect(vaga.eliminados).toEqual([]);
  });

  it("a indígena aparece também na lista própria, recomeçando em 1º", () => {
    expect(posicoes(vaga.porModalidade.PI)).toEqual(["1 Kayanaku Mehinako"]);
    expect(vaga.porModalidade.PP).toEqual([]);
  });

  it("cabeçalho no padrão da publicação", () => {
    expect(vaga.cabecalho).toBe(
      "VAGA 169681 - Cirurgião Dentista - Área de abrangência DSEI Xingu - 3 vagas (2 AC + 1 Pretos e Pardos + CR)",
    );
  });

  it("vagas: 2 AC aos primeiros; a de PP sem candidato vai para a ampla (remanejamento)", () => {
    expect(vaga.geral.map((l) => [l.nome, l.situacao, l.vagaPor])).toEqual([
      ["Kayanaku Mehinako", "VAGA", "AC"],
      ["Jucikely Miguel da Silva", "VAGA", "AC"],
      ["Vanderlei Tadeu Bertanha", "VAGA", "AC"],
      ["Pedro Alexandre Schmidt Passos", "CR", null],
      ["Marquele Sousa da Silva", "CR", null],
      ["Ercilio Faria Coronheiro", "CR", null],
    ]);
  });

  it("explicação da posição sem empate", () => {
    expect(r.explicacoes[jucikely.analise_id].explicacao[0]).toBe(
      "Nota 30,3 (documental 13,0 + entrevista 17,3).",
    );
  });
});

describe("edital 83/2026 — vaga 169682 (Enfermeiro): cotista nas duas listas (item 5.12)", () => {
  const q = {
    ...QUADRO_169681,
    id: "q2",
    cargo: "Enfermeiro",
    lotacao: "Polo Base Leonardo",
    modalidades: { "Ampla Concorrência": 3, "Pretos e Pardos": 1 },
    vagas_imediatas: 4,
  };
  const base = {
    vaga: "169682",
    cargo: "Enfermeiro - Polo Base Leonardo",
    quadro: "q2",
  };
  const mujugi = candidato("Mujugi Neymax Kalapalo Kuikuro", {
    ...base,
    nota_documental: 15.8,
    modalidade: "Indígenas",
    pontuacao_etnica: 12,
  });
  const ana = candidato("Ana Paula Fernandes Duarte", {
    ...base,
    nota_documental: 13,
  });
  const leticia = candidato("Letícia Rezende Pereira", {
    ...base,
    nota_documental: 13,
  });
  const marciano = candidato("Marciano Ribeiro Saraiva", {
    ...base,
    nota_documental: 13,
  });
  const claudiano = candidato("Claudiano da Conceição Lima", {
    ...base,
    nota_documental: 13,
    modalidade: "Pretos e pardos",
  });
  const r = classificar({
    tipo: "FINAL",
    regra: REGRA_83,
    candidatos: [mujugi, ana, leticia, marciano, claudiano],
    entrevistas: [
      entrevista(mujugi, 14.67),
      entrevista(ana, 17.33),
      entrevista(leticia, 16.67),
      entrevista(marciano, 14),
      entrevista(claudiano, 10),
    ],
    quadro: [q],
    dataCorte: "2026-07-20",
  });
  const vaga = vagaDe(r, "169682");

  it("o cotista de PP está na geral (5º) e na lista PP (1º) — a publicação o deixou só na PP", () => {
    expect(posicoes(vaga.geral)).toEqual([
      "1 Mujugi Neymax Kalapalo Kuikuro",
      "2 Ana Paula Fernandes Duarte",
      "3 Letícia Rezende Pereira",
      "4 Marciano Ribeiro Saraiva",
      "5 Claudiano da Conceição Lima",
    ]);
    expect(posicoes(vaga.porModalidade.PP)).toEqual([
      "1 Claudiano da Conceição Lima",
    ]);
  });

  it("a vaga reservada de PP é do cotista; o 4º da geral fica no cadastro reserva", () => {
    const situacao = Object.fromEntries(
      vaga.geral.map((l) => [l.nome, `${l.situacao}:${l.vagaPor}`]),
    );
    expect(situacao["Claudiano da Conceição Lima"]).toBe("VAGA:PP");
    expect(situacao["Marciano Ribeiro Saraiva"]).toBe("CR:null");
  });
});

describe("edital 83/2026 — preliminar documental com parciais idênticas (vaga 169682, nota 13)", () => {
  const base = { vaga: "169682", cargo: "Enfermeiro - Polo Base Leonardo" };
  const lista = [
    candidato("Mujugi Neymax Kalapalo Kuikuro", {
      ...base,
      nota_documental: "15,8",
      modalidade: "Indígenas",
      pontuacao_etnica: 12,
    }),
    ...[
      "Ana Paula Fernandes Duarte",
      "Andreia Medeiros",
      "Marciano Ribeiro Saraiva",
      "Letícia Rezende Pereira",
    ].map((n) => candidato(n, { ...base, nota_documental: "13" })),
    candidato("Claudiano da Conceição Lima", {
      ...base,
      nota_documental: "13",
      modalidade: "Pretos e pardos",
    }),
    candidato("Reprovada na nota mínima", { ...base, nota_documental: "6,9" }),
    candidato("Reprovado por requisito", {
      ...base,
      nota_documental: "10",
      status: "Reprovado",
    }),
  ];
  const r = classificar({
    tipo: "PRELIMINAR",
    regra: REGRA_83,
    candidatos: lista,
    dataCorte: "2026-07-20",
  });
  const vaga = vagaDe(r, "169682");

  it("a regra do 83 não desempata a preliminar: os cinco com 13 ficam na mesma posição", () => {
    expect(vaga.geral.map((l) => l.posicao)).toEqual([1, 2, 2, 2, 2, 2]);
    const explicacao = r.explicacoes[lista[1].analise_id].explicacao.join(" ");
    expect(explicacao).toContain("Empatado em 13,0 com 4.");
    expect(explicacao).toContain("Nesta lista o empate fica na mesma posição.");
  });

  it("nota mínima de nível superior (7) elimina; requisito não atendido elimina com o motivo", () => {
    expect(vaga.eliminados.map((e) => [e.nome, e.motivo])).toEqual([
      ["Reprovado por requisito", "NAO_HABILITADO"],
      ["Reprovada na nota mínima", "ABAIXO_NOTA_MINIMA_DOCUMENTAL"],
    ]);
    expect(vaga.eliminados[1].detalhe).toBe("Nota 6,9; mínimo 7,0 (superior).");
  });
});

describe("edital 100/2026 — preliminar com desempate (vaga 178529, nota 13,00)", () => {
  const base = {
    vaga: "178529",
    cargo: "Analista Técnico de Saúde Indígena - CASAI Brasília",
  };
  const primeiro = candidato("Primeira Colocada", {
    ...base,
    nota_documental: "15,00",
  });
  const eulalio = candidato("Eulálio Silva de Oliveira", {
    ...base,
    nota_documental: "13,00",
    modalidade: "Indígenas",
    pontuacao_etnica: 8,
  });
  const laudeci = candidato("Laudeci Cedraz de Oliveira", {
    ...base,
    nota_documental: "13,00",
  });
  const elida = candidato("Elida Calheira", {
    ...base,
    nota_documental: "13,00",
  });

  it("indígena comprovado antes (critério b), como na lista publicada; os outros dois ficam juntos", () => {
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: REGRA_100,
      candidatos: [primeiro, laudeci, elida, eulalio],
      dataCorte: "2026-09-20",
    });
    expect(posicoes(vagaDe(r, "178529").geral)).toEqual([
      "1 Primeira Colocada",
      "2 Eulálio Silva de Oliveira",
      "3 Elida Calheira",
      "3 Laudeci Cedraz de Oliveira",
    ]);
    expect(r.explicacoes[eulalio.analise_id].explicacao.join(" ")).toContain(
      "à frente de Elida Calheira por indígena comprovado (sim × não)",
    );
    // Sem data de nascimento: o critério 60+ não decide e vira aviso.
    expect(avisosDe(r, "DADO_FALTANDO").length).toBeGreaterThan(0);
  });

  it("60 anos ou mais na data de corte vem ANTES de indígena (critério a) — o que o Apps Script não fazia", () => {
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: REGRA_100,
      candidatos: [
        primeiro,
        { ...laudeci, data_nascimento: "1980-01-01" },
        { ...elida, data_nascimento: "1966-09-20" },
        { ...eulalio, data_nascimento: "1990-05-05" },
      ],
      dataCorte: "2026-09-20",
    });
    expect(nomes(vagaDe(r, "178529").geral)).toEqual([
      "Primeira Colocada",
      "Elida Calheira",
      "Eulálio Silva de Oliveira",
      "Laudeci Cedraz de Oliveira",
    ]);
    expect(r.explicacoes[elida.analise_id].explicacao.join(" ")).toContain(
      "por 60+ (sim × não)",
    );
  });

  it("vaga 178530: Iudemar (PI) antes de Thaylline (PP), ambos com 13,00", () => {
    const b = {
      vaga: "178530",
      cargo: "Apoiador Técnico em Saúde - CASAI Brasília",
    };
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: REGRA_100,
      candidatos: [
        candidato("Thaylline Kellen da Silva Araújo", {
          ...b,
          nota_documental: 13,
          modalidade: "Pretos e pardos",
        }),
        candidato("Iudemar Ribeiro Beserra", {
          ...b,
          nota_documental: 13,
          modalidade: "Indígenas",
          pontuacao_etnica: 8,
        }),
      ],
      dataCorte: "2026-09-20",
    });
    const vaga = vagaDe(r, "178530");
    expect(posicoes(vaga.geral)).toEqual([
      "1 Iudemar Ribeiro Beserra",
      "2 Thaylline Kellen da Silva Araújo",
    ]);
    expect(posicoes(vaga.porModalidade.PP)).toEqual([
      "1 Thaylline Kellen da Silva Araújo",
    ]);
    expect(posicoes(vaga.porModalidade.PI)).toEqual([
      "1 Iudemar Ribeiro Beserra",
    ]);
  });
});

describe("números pt-BR: nota com vírgula não vira zero", () => {
  it("12,5 fica à frente de 9,8 e 1.234,5 é mil duzentos e trinta e quatro", () => {
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: { documental: { situacoes_aptas: [] } },
      candidatos: [
        candidato("Nove e oito", { nota_documental: "9,8" }),
        candidato("Doze e meio", { nota_documental: "12,5" }),
        candidato("Milhar", { nota_documental: "1.234,5" }),
      ],
    });
    expect(vagaDe(r, "169681").geral.map((l) => [l.nome, l.nota])).toEqual([
      ["Milhar", 1234.5],
      ["Doze e meio", 12.5],
      ["Nove e oito", 9.8],
    ]);
  });

  it("texto que não é número vira aviso e o candidato sai por falta de nota (nunca 0 calado)", () => {
    const c = candidato("Nota ilegível", { nota_documental: "doze" });
    const r = classificar({ tipo: "PRELIMINAR", regra: {}, candidatos: [c] });
    expect(avisosDe(r, "NUMERO_INVALIDO")[0].texto).toContain('"doze"');
    expect(vagaDe(r, "169681").eliminados[0].motivo).toBe(
      "SEM_NOTA_DOCUMENTAL",
    );
  });
});

describe("entrevista ligada à análise SÓ pelo id (CO_ANALISE_CURRICULAR)", () => {
  const regra = { documental: { situacoes_aptas: [] } };
  const a = candidato("Maria da Silva", { nota_documental: 10 });
  const b = candidato("Maria da Silva", { nota_documental: 9 });

  it("homônimas na mesma vaga ficam cada uma com a sua entrevista", () => {
    const r = classificar({
      tipo: "FINAL",
      regra,
      candidatos: [a, b],
      entrevistas: [entrevista(a, 5), entrevista(b, 15)],
    });
    expect(vagaDe(r, "169681").geral.map((l) => [l.analiseId, l.nota])).toEqual(
      [
        [b.analise_id, 24],
        [a.analise_id, 15],
      ],
    );
  });

  it("entrevista sem análise vira aviso (antes o candidato sumia sem aviso)", () => {
    const r = classificar({
      tipo: "FINAL",
      regra,
      candidatos: [a],
      entrevistas: [
        { ...entrevista(a, 18), analise_id: null, nome: "Fulano Sem Análise" },
      ],
    });
    expect(avisosDe(r, "ENTREVISTA_SEM_ANALISE")[0].texto).toContain(
      "Fulano Sem Análise",
    );
    expect(vagaDe(r, "169681").eliminados[0].motivo).toBe("SEM_ENTREVISTA");
  });

  it("ligação feita pelo nome na carga e entrevista repetida viram aviso", () => {
    const r = classificar({
      tipo: "FINAL",
      regra,
      candidatos: [a],
      entrevistas: [
        entrevista(a, 12, { ligacao: "nome" }),
        entrevista(a, 14, { origem: "sistema" }),
      ],
    });
    expect(avisosDe(r, "ENTREVISTA_PELO_NOME")).toHaveLength(1);
    expect(avisosDe(r, "ENTREVISTA_REPETIDA")).toHaveLength(1);
    expect(vagaDe(r, "169681").geral[0].nota).toBe(24);
  });
});

describe("eliminação na entrevista, com motivo padronizado", () => {
  const notas = (valores) =>
    valores.map((nota, i) => ({ ordem: i + 1, criterio: `C${i + 1}`, nota }));
  const casos = [
    ["sem entrevista", null, "SEM_ENTREVISTA"],
    ["ausente", { compareceu: "N", nota: null }, "AUSENTE"],
    ["inapto", { parecer: "INAPTO", nota: 12 }, "INAPTO_ENTREVISTA"],
    ["sem nota", { nota: null }, "SEM_NOTA_ENTREVISTA"],
    ["abaixo de 10", { nota: 9.9 }, "ABAIXO_NOTA_MINIMA_ENTREVISTA"],
    [
      "competência abaixo de 2,5",
      { nota: 12, notas: notas([4, 4, 2.4, 1.6]) },
      "COMPETENCIA_ABAIXO_MINIMO",
    ],
  ];
  it.each(casos)("83: %s", (_, campos, motivo) => {
    const c = candidato("Candidata", { nota_documental: 10 });
    const r = classificar({
      tipo: "FINAL",
      regra: REGRA_83,
      candidatos: [c],
      entrevistas: campos ? [entrevista(c, campos.nota ?? null, campos)] : [],
      dataCorte: "2026-07-20",
    });
    expect(vagaDe(r, "169681").eliminados.map((e) => e.motivo)).toEqual([
      motivo,
    ]);
  });

  it("100: nota 1 numa competência elimina (9.12.1), mesmo com total acima de 8", () => {
    const c = candidato("Candidata", { nota_documental: 10, vaga: "178529" });
    const r = classificar({
      tipo: "FINAL",
      regra: REGRA_100,
      candidatos: [c],
      entrevistas: [entrevista(c, 13, { notas: notas([5, 5, 2, 1]) })],
      dataCorte: "2026-09-20",
    });
    const e = vagaDe(r, "178529").eliminados[0];
    expect(e.motivo).toBe("COMPETENCIA_ELIMINATORIA");
    expect(e.detalhe).toBe("Habilidade interpessoal: 1,00 (elimina até 1,00).");
  });

  it("sem as notas por competência: não elimina, mas avisa", () => {
    const c = candidato("Candidata", { nota_documental: 10 });
    const r = classificar({
      tipo: "FINAL",
      regra: REGRA_83,
      candidatos: [c],
      entrevistas: [entrevista(c, 15)],
      dataCorte: "2026-07-20",
    });
    expect(vagaDe(r, "169681").geral).toHaveLength(1);
    expect(avisosDe(r, "SEM_NOTAS_COMPETENCIA")).toHaveLength(1);
  });

  it("entrevistado que não passou na documental vira aviso", () => {
    const c = candidato("Sem habilitação", {
      nota_documental: 10,
      status: "Reprovado",
    });
    const r = classificar({
      tipo: "FINAL",
      regra: REGRA_83,
      candidatos: [c],
      entrevistas: [entrevista(c, 15)],
      dataCorte: "2026-07-20",
    });
    expect(avisosDe(r, "ENTREVISTADO_NAO_HABILITADO")).toHaveLength(1);
  });
});

describe("60 anos ou mais NA DATA DE CORTE (fim das inscrições)", () => {
  const regra = {
    documental: { situacoes_aptas: [] },
    listas: { PRELIMINAR: { empate: "CRITERIOS" } },
    desempate: [{ criterio: "IDOSO_60", direcao: "SIM_PRIMEIRO" }],
  };
  const fez60 = candidato("Fez 60 no último dia", {
    nota_documental: 10,
    data_nascimento: "1966-07-20",
  });
  const faz60depois = candidato("Faz 60 no dia seguinte", {
    nota_documental: 10,
    data_nascimento: "1966-07-21",
  });

  it("o aniversário no último dia de inscrição conta; o do dia seguinte, não", () => {
    const r = classificar({
      tipo: "PRELIMINAR",
      regra,
      candidatos: [faz60depois, fez60],
      dataCorte: "2026-07-20",
    });
    expect(posicoes(vagaDe(r, "169681").geral)).toEqual([
      "1 Fez 60 no último dia",
      "2 Faz 60 no dia seguinte",
    ]);
  });

  it("a data de corte da regra vale sobre a do cronograma", () => {
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: { ...regra, data_corte: "2026-07-21" },
      candidatos: [fez60, faz60depois],
      dataCorte: "2026-07-20",
    });
    expect(vagaDe(r, "169681").geral.map((l) => l.posicao)).toEqual([1, 1]);
    expect(r.dataCorte).toBe("2026-07-21");
  });

  it("sem data de corte, avisa", () => {
    const r = classificar({ tipo: "PRELIMINAR", regra, candidatos: [fez60] });
    expect(avisosDe(r, "SEM_DATA_CORTE")).toHaveLength(1);
  });
});

describe("empate final: o gestor escolhe", () => {
  const empatados = () => [
    candidato("Bruna", { nota_documental: 10, codigo: "300" }),
    candidato("Ana", { nota_documental: 10, codigo: "20" }),
    candidato("Carla", { nota_documental: 9, codigo: "1" }),
  ];
  const regraCom = (metodo, numeracao = "DENSA") => ({
    documental: { situacoes_aptas: [] },
    listas: { PRELIMINAR: { empate: "CRITERIOS" } },
    desempate: [{ criterio: "INDIGENA_COMPROVADO", direcao: "SIM_PRIMEIRO" }],
    empate_final: { metodo, numeracao },
  });

  it("mesma posição: 1º, 1º, 2º (densa) ou 1º, 1º, 3º (saltando)", () => {
    const lista = empatados();
    const densa = classificar({
      tipo: "PRELIMINAR",
      regra: regraCom("MESMA_POSICAO"),
      candidatos: lista,
    });
    expect(posicoes(vagaDe(densa, "169681").geral)).toEqual([
      "1 Ana",
      "1 Bruna",
      "2 Carla",
    ]);
    const saltando = classificar({
      tipo: "PRELIMINAR",
      regra: regraCom("MESMA_POSICAO", "SALTANDO"),
      candidatos: lista,
    });
    expect(vagaDe(saltando, "169681").geral.map((l) => l.posicao)).toEqual([
      1, 1, 3,
    ]);
    expect(
      densa.explicacoes[lista[0].analise_id].explicacao.join(" "),
    ).toContain("Empate final: mesma posição.");
  });

  it("ordem de inscrição: o código numérico menor primeiro (20 antes de 300)", () => {
    const lista = empatados();
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: regraCom("ORDEM_INSCRICAO"),
      candidatos: lista,
    });
    expect(posicoes(vagaDe(r, "169681").geral)).toEqual([
      "1 Ana",
      "2 Bruna",
      "3 Carla",
    ]);
    expect(r.explicacoes[lista[1].analise_id].explicacao.join(" ")).toContain(
      "ordem de inscrição (código 20)",
    );
  });

  it("sorteio sem registro: fica pendente, com aviso, e a lista não esconde o empate", () => {
    const lista = empatados();
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: regraCom("SORTEIO"),
      candidatos: lista,
    });
    expect(r.pendencias).toHaveLength(1);
    expect(r.pendencias[0]).toMatchObject({
      metodo: "SORTEIO",
      tipoLista: "PRELIMINAR",
      vaga: "169681",
    });
    expect(r.pendencias[0].chave).toBe(
      chaveDoGrupo("PRELIMINAR", "169681", [
        lista[0].analise_id,
        lista[1].analise_id,
      ]),
    );
    expect(vagaDe(r, "169681").geral.map((l) => l.posicao)).toEqual([1, 1, 2]);
    expect(avisosDe(r, "EMPATE_PENDENTE")).toHaveLength(1);
  });

  it("sorteio registrado: vale a ordem da semente, e a explicação cita o sorteio", () => {
    const lista = empatados();
    const ids = [lista[0].analise_id, lista[1].analise_id];
    const chave = chaveDoGrupo("PRELIMINAR", "169681", ids);
    const ordem = ordemDoSorteio("semente-publica-123", ids);
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: regraCom("SORTEIO"),
      candidatos: lista,
      desempates: [
        {
          id: "d1",
          tipo_lista: "PRELIMINAR",
          vaga: "169681",
          chave,
          metodo: "SORTEIO",
          semente: "semente-publica-123",
          ordem,
        },
      ],
    });
    const geral = vagaDe(r, "169681").geral;
    expect(geral.map((l) => l.analiseId).slice(0, 2)).toEqual(ordem);
    expect(geral.map((l) => l.posicao)).toEqual([1, 2, 3]);
    expect(r.pendencias).toEqual([]);
    expect(r.explicacoes[ordem[0]].explicacao.join(" ")).toContain(
      "resolvido por sorteio (semente semente-publ",
    );
  });

  it("decisão manual registrada: vale a ordem decidida, com a justificativa na explicação", () => {
    const lista = empatados();
    const ids = [lista[0].analise_id, lista[1].analise_id];
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: regraCom("DECISAO_MANUAL"),
      candidatos: lista,
      desempates: [
        {
          id: "d2",
          tipo_lista: "PRELIMINAR",
          chave: chaveDoGrupo("PRELIMINAR", "169681", ids),
          metodo: "MANUAL",
          ordem: [ids[0], ids[1]],
          justificativa: "Decisão da comissão (ata 12).",
        },
      ],
    });
    expect(nomes(vagaDe(r, "169681").geral)).toEqual(["Bruna", "Ana", "Carla"]);
    expect(r.explicacoes[ids[0]].explicacao.join(" ")).toContain(
      "decisão manual: Decisão da comissão (ata 12).",
    );
  });

  it("registro de um grupo que mudou não vale mais e avisa", () => {
    const lista = empatados();
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: regraCom("SORTEIO"),
      candidatos: lista,
      desempates: [
        {
          id: "velho",
          tipo_lista: "PRELIMINAR",
          vaga: "169681",
          chave: "PRELIMINAR|169681|x,y",
          metodo: "SORTEIO",
          ordem: ["x", "y"],
        },
      ],
    });
    expect(avisosDe(r, "DESEMPATE_OBSOLETO")).toHaveLength(1);
    expect(r.pendencias).toHaveLength(1);
  });

  it("critérios decidem antes do empate final; a explicação diz quem e por quê", () => {
    const lista = [
      candidato("Indígena", { nota_documental: 52, pontuacao_etnica: 7 }),
      candidato("Não indígena", { nota_documental: 52 }),
      candidato("Outra", { nota_documental: 52 }),
    ];
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: regraCom("MESMA_POSICAO"),
      candidatos: lista,
    });
    const texto = r.explicacoes[lista[0].analise_id].explicacao.join(" ");
    expect(texto).toContain("Empatado em 52,00 com 2.");
    expect(texto).toContain(
      "à frente de Não indígena por indígena comprovado (sim × não)",
    );
    expect(r.explicacoes[lista[1].analise_id].explicacao.join(" ")).toContain(
      "atrás de Indígena por indígena comprovado (não × sim)",
    );
  });
});

describe("convocação para entrevista", () => {
  const base = (n, nota, campos = {}) =>
    candidato(n, { nota_documental: nota, quadro: "qc", ...campos });
  const quadro = [
    {
      id: "qc",
      ordem: 1,
      cargo: "Cirurgião Dentista",
      lotacao: "",
      modalidades: { "Ampla Concorrência": 1 },
      vagas_imediatas: 1,
      cadastro_reserva: true,
    },
  ];
  const regra = {
    documental: { situacoes_aptas: [] },
    convocacao: {
      multiplo_vagas: 5,
      posicao_max_cr: 10,
      incluir_empatados: true,
    },
  };
  const lista = [
    base("A", 20),
    base("B", 19),
    base("C", 18),
    base("D", 17),
    base("E", 16),
    base("F", 16),
    base("G", 15),
  ];

  it("5 × 1 vaga = 5, com o empate do 5º incluído (6 convocados)", () => {
    const r = classificar({
      tipo: "CONVOCACAO",
      regra,
      candidatos: lista,
      quadro,
    });
    const vaga = vagaDe(r, "169681");
    expect(nomes(vaga.geral)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(vaga.geral.every((l) => l.situacao === "CONVOCADO")).toBe(true);
    expect(vaga.eliminados).toEqual([
      {
        analiseId: lista[6].analise_id,
        nome: "G",
        motivo: "NAO_CONVOCADO",
        detalhe: "Limite: 5 × 1 vaga(s).",
      },
    ]);
  });

  it("sem incluir empatados, corta no limite e avisa", () => {
    const r = classificar({
      tipo: "CONVOCACAO",
      regra: {
        ...regra,
        convocacao: { ...regra.convocacao, incluir_empatados: false },
      },
      candidatos: lista,
      quadro,
    });
    expect(vagaDe(r, "169681").geral).toHaveLength(5);
    expect(avisosDe(r, "EMPATE_NO_LIMITE")).toHaveLength(1);
  });

  it("exceção por cargo (Enfermeiro 10×) e vaga só de cadastro reserva (até a k-ésima)", () => {
    const n = normalizarRegra(REGRA_83);
    expect(limiteDaConvocacao({ cargo: "Enfermeiro", total: 2 }, n)).toEqual({
      limite: 20,
      origem: "10 × 2 vaga(s) (exceção do cargo)",
    });
    expect(
      limiteDaConvocacao({ cargo: "Técnico de Enfermagem", total: 0 }, n)
        .limite,
    ).toBe(20);
    expect(
      limiteDaConvocacao({ cargo: "Cirurgião Dentista", total: 0 }, n),
    ).toEqual({ limite: 10, origem: "até a 10ª posição" });
    expect(
      limiteDaConvocacao(
        { cargo: "Cirurgião Dentista", total: 3 },
        normalizarRegra(REGRA_100),
      ).limite,
    ).toBe(18);
  });

  it("no resultado final, convocado sem entrevista lançada vira aviso", () => {
    const r = classificar({
      tipo: "FINAL",
      regra,
      candidatos: lista,
      quadro,
      entrevistas: [entrevista(lista[0], 10)],
    });
    expect(
      avisosDe(r, "CONVOCADO_SEM_ENTREVISTA").map((a) => a.analiseId),
    ).toEqual(lista.slice(1, 6).map((c) => c.analise_id));
  });
});

describe("modalidades, acúmulo e remanejamento", () => {
  it("cotista fora da geral quando a regra manda; posição da geral quando não recomeça", () => {
    const regra = {
      documental: { situacoes_aptas: [] },
      modalidades: [
        { codigo: "AC" },
        {
          codigo: "PP",
          nome: "Pretos e Pardos",
          lista_propria: true,
          recomeca_posicao: false,
        },
        {
          codigo: "PI",
          nome: "Indígenas",
          lista_propria: true,
          aparece_na_geral: false,
        },
      ],
    };
    const lista = [
      candidato("Ampla", { nota_documental: 20 }),
      candidato("Parda", {
        nota_documental: 15,
        modalidade: "Pretos e pardos",
      }),
      candidato("Indígena", { nota_documental: 18, modalidade: "Indígenas" }),
    ];
    const vaga = vagaDe(
      classificar({ tipo: "PRELIMINAR", regra, candidatos: lista }),
      "169681",
    );
    expect(nomes(vaga.geral)).toEqual(["Ampla", "Parda"]);
    expect(posicoes(vaga.porModalidade.PP)).toEqual(["2 Parda"]);
    expect(posicoes(vaga.porModalidade.PI)).toEqual(["1 Indígena"]);
  });

  it("acúmulo no 83: no final fica só na de maior percentual (PP 25% > PI 3%)", () => {
    const c = candidato("Duas cotas", {
      nota_documental: 10,
      modalidade: "Pretos e pardos / Indígenas",
    });
    const r = classificar({
      tipo: "FINAL",
      regra: REGRA_83,
      candidatos: [c],
      entrevistas: [entrevista(c, 15)],
      dataCorte: "2026-07-20",
    });
    const vaga = vagaDe(r, "169681");
    expect(nomes(vaga.porModalidade.PP)).toEqual(["Duas cotas"]);
    expect(vaga.porModalidade.PI).toEqual([]);
    // Na preliminar ela aparece nas duas.
    const p = classificar({
      tipo: "PRELIMINAR",
      regra: REGRA_83,
      candidatos: [c],
    });
    expect(nomes(vagaDe(p, "169681").porModalidade.PI)).toEqual(["Duas cotas"]);
  });

  it("acúmulo no 100: PcD e mais uma", () => {
    const c = candidato("Três cotas", {
      nota_documental: 10,
      vaga: "178529",
      modalidade: "Pretos e pardos / Indígenas",
      pcd: "Sim",
    });
    const r = classificar({
      tipo: "FINAL",
      regra: REGRA_100,
      candidatos: [c],
      entrevistas: [entrevista(c, 15)],
      dataCorte: "2026-09-20",
    });
    const vaga = vagaDe(r, "178529");
    expect(
      Object.entries(vaga.porModalidade)
        .filter(([, l]) => l.length)
        .map(([m]) => m)
        .sort(),
    ).toEqual(["PCD", "PP"]);
  });

  it("100: a vaga de PcD sem candidato vai para indígena (4.1.1)", () => {
    const q = {
      id: "qp",
      ordem: 1,
      cargo: "Analista",
      lotacao: "CASAI Brasília",
      modalidades: { "Ampla Concorrência": 1, PcD: 1 },
      vagas_imediatas: 2,
      cadastro_reserva: true,
    };
    const b = { vaga: "178529", quadro: "qp" };
    const lista = [
      candidato("Ampla 1", { ...b, nota_documental: 20 }),
      candidato("Ampla 2", { ...b, nota_documental: 19 }),
      candidato("Indígena", {
        ...b,
        nota_documental: 10,
        modalidade: "Indígenas",
        pontuacao_etnica: 8,
      }),
    ];
    const r = classificar({
      tipo: "FINAL",
      regra: REGRA_100,
      candidatos: lista,
      quadro: [q],
      entrevistas: lista.map((c) => entrevista(c, 10)),
      dataCorte: "2026-09-20",
    });
    expect(
      vagaDe(r, "178529").geral.map(
        (l) => `${l.nome}:${l.situacao}:${l.vagaPor}`,
      ),
    ).toEqual(["Ampla 1:VAGA:AC", "Ampla 2:CR:null", "Indígena:VAGA:PI"]);
  });
});

describe("composição da nota, vagas e avisos de dados", () => {
  it("pesos e arredondamento da regra (2 × documental + entrevista, truncar em 1 casa)", () => {
    const c = candidato("Pesada", { nota_documental: "10,07" });
    const r = classificar({
      tipo: "FINAL",
      regra: {
        documental: { situacoes_aptas: [] },
        composicao: {
          componentes: [
            { codigo: "DOCUMENTAL", peso: 2 },
            { codigo: "ENTREVISTA", peso: 1 },
          ],
          casas: 1,
          arredondamento: "TRUNCAR",
        },
      },
      candidatos: [c],
      entrevistas: [entrevista(c, 5.09)],
    });
    expect(vagaDe(r, "169681").geral[0].nota).toBe(25.2);
    expect(r.explicacoes[c.analise_id].explicacao[0]).toBe(
      "Nota 25,2 (documental 10,1 × 2,00 + entrevista 5,1).",
    );
  });

  it("componente que falta (ART) não soma e avisa", () => {
    const c = candidato("Sem ART", { nota_documental: 10 });
    const r = classificar({
      tipo: "FINAL",
      regra: {
        documental: { situacoes_aptas: [] },
        composicao: {
          componentes: [
            { codigo: "DOCUMENTAL", peso: 1 },
            { codigo: "ART", peso: 1 },
          ],
        },
        etapas: { entrevista: false },
      },
      candidatos: [c],
    });
    expect(vagaDe(r, "169681").geral[0].nota).toBe(10);
    expect(avisosDe(r, "COMPONENTE_FALTANDO")).toHaveLength(1);
  });

  it("linha do quadro sem candidato aparece vazia; vaga sem quadro avisa", () => {
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: {},
      candidatos: [candidato("Sozinha", { nota_documental: 10, vaga: "999" })],
      quadro: [
        {
          id: "qv",
          ordem: 1,
          cargo: "Nutricionista",
          lotacao: "Polo X",
          modalidades: {},
          vagas_imediatas: 0,
          cadastro_reserva: true,
        },
      ],
    });
    expect(r.vagas.map((v) => v.cabecalho)).toEqual([
      "VAGA 999 - Cirurgião Dentista - Área de abrangência DSEI Xingu",
      "VAGA - Nutricionista - Polo X - Cadastro Reserva",
    ]);
    expect(r.vagas[1].geral).toEqual([]);
    expect(avisosDe(r, "VAGA_SEM_QUADRO")).toHaveLength(1);
  });

  it("nível da vaga desconhecido com mínimo por nível: avisa e não elimina", () => {
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: {
        documental: {
          situacoes_aptas: [],
          nota_minima_por_nivel: { superior: 7 },
        },
      },
      candidatos: [candidato("Sem nível", { nota_documental: 3 })],
    });
    expect(vagaDe(r, "169681").geral).toHaveLength(1);
    expect(avisosDe(r, "NIVEL_DESCONHECIDO")).toHaveLength(1);
  });

  it("totais batem com as listas", () => {
    const lista = [
      candidato("A", { nota_documental: 10 }),
      candidato("B", { nota_documental: 5, status: "Reprovado" }),
    ];
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: { documental: { situacoes_aptas: ["Aprovado"] } },
      candidatos: lista,
    });
    expect(r.totais).toMatchObject({
      candidatos: 2,
      elegiveis: 1,
      eliminados: 1,
      vagas: 1,
      pendencias: 0,
    });
  });
});
