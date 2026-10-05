import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TIPOS_DE_LISTA } from "../../src/lib/classificacao/catalogo.js";
import {
  instantaneoDaLista,
  linhasDaPlanilha,
} from "../../src/lib/classificacao/exportacao.js";
import { documentoOficial } from "../../src/lib/classificacao/documento-sei.js";
import { classificar } from "../../src/lib/classificacao/motor.js";

/*
  As quatro listas por etapa, no padrão das publicações da AgSUS
  (scratchpad/classificacao/listas-publicadas.md): avaliação documental com as
  parciais e os eliminados com justificativa, convocação para entrevista,
  resultado da entrevista (empate na mesma posição, como o 83/2026 publicou) e
  resultado final com vaga imediata × cadastro reserva.
*/

const SEED = readFileSync(
  "supabase/correcoes/20261002-regras-de-classificacao-83-e-100.sql",
  "utf8",
);
const regraDoSeed = (marca) => {
  const inicio = SEED.indexOf(`$${marca}$`) + marca.length + 2;
  return JSON.parse(SEED.slice(inicio, SEED.indexOf(`$${marca}$`, inicio)));
};
const REGRA_83 = {
  ...regraDoSeed("regra83"),
  documental: {
    ...regraDoSeed("regra83").documental,
    parciais: ["FORMACAO", "CURSOS", "EXPERIENCIA", "ETNICO"],
  },
};

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const cand = (nome, doc, campos = {}) => ({
  analise_id: id(),
  codigo: String(100 + n),
  nome,
  vaga: "169681",
  cargo: "Cirurgião Dentista - Área de abrangência DSEI Xingu",
  modalidade: "Ampla concorrência",
  pcd: "Não",
  status: "Aprovado",
  nota_documental: doc,
  quadro: "q1",
  pontuacao_formacao: 1,
  pontuacao_cursos: 2,
  pontuacao_experiencia: 10,
  pontuacao_etnica: 0,
  ...campos,
});
const ent = (c, nota, campos = {}) => ({
  id: id(),
  analise_id: c.analise_id,
  nome: c.nome,
  vaga: c.vaga,
  nota,
  parecer: "APTO",
  compareceu: "S",
  ligacao: "codigo",
  origem: "sistema",
  notas: [],
  ...campos,
});
const QUADRO = [
  {
    id: "q1",
    ordem: 1,
    cargo: "Cirurgião Dentista",
    lotacao: "Área de abrangência DSEI Xingu",
    modalidades: { "Ampla Concorrência": 1 },
    vagas_imediatas: 1,
    cadastro_reserva: true,
  },
];

// Vaga com 1 vaga imediata: 83 convoca 5 × 1 = 5.
const jucikely = cand("Jucikely", 14);
const pedro = cand("Pedro", 13);
const vanderlei = cand("Vanderlei", 12);
const ana = cand("Ana", 11);
const bia = cand("Bia", 10);
const fora = cand("Fora do limite", 9);
const reprovada = cand("Reprovada", 4, { pontuacao_experiencia: 1 });
const candidatos = [jucikely, pedro, vanderlei, ana, bia, fora, reprovada];
const entrevistas = [
  ent(jucikely, 17.3),
  ent(pedro, 17.3),
  ent(vanderlei, 16),
  ent(ana, 9), // abaixo de 10
  ent(bia, 12, { compareceu: "N" }),
  ent(fora, 20), // fora do limite: não é desta etapa
];
const base = {
  regra: REGRA_83,
  candidatos,
  entrevistas,
  quadro: QUADRO,
  dataCorte: "2026-07-20",
};
const nomes = (linhas) => linhas.map((l) => `${l.posicao} ${l.nome}`);

describe("tipos de lista", () => {
  it("as quatro etapas, na ordem das publicações", () => {
    expect(TIPOS_DE_LISTA.map(([v]) => v)).toEqual([
      "PRELIMINAR",
      "CONVOCACAO",
      "ENTREVISTA",
      "FINAL",
    ]);
  });
});

describe("avaliação documental: parciais e eliminados com justificativa", () => {
  const r = classificar({ ...base, tipo: "PRELIMINAR" });
  const retrato = instantaneoDaLista(r, {
    edital: { edital: "83/2026", unidade: "DSEI Xingu" },
    regra: REGRA_83,
  });

  it("a linha leva as parciais que a regra publica", () => {
    expect(retrato.parciais).toEqual([
      "FORMACAO",
      "CURSOS",
      "EXPERIENCIA",
      "ETNICO",
    ]);
    expect(retrato.vagas[0].geral[0]).toMatchObject({
      nome: "Jucikely",
      parciais: { FORMACAO: 1, CURSOS: 2, EXPERIENCIA: 10, ETNICO: 0 },
    });
  });

  const rotulos = (t) => t.colunas.map((c) => c.rotulo);

  it("documento (como o 83/2026): Classificação | Nome | Nota Final | parciais", () => {
    const doc = documentoOficial(retrato, { lista: "geral", regra: REGRA_83 });
    expect(doc.titulo).toEqual([
      "RESULTADO PRELIMINAR - ETAPA DE ANÁLISE CURRICULAR",
    ]);
    expect(doc.preliminares[1].texto).toContain(
      "ordem decrescente de pontuação",
    );
    const [geral] = doc.blocos[0].tabelas;
    expect(rotulos(geral)).toEqual([
      "Classificação",
      "Nome",
      "Nota Final",
      "Formação Acadêmica",
      "Cursos de Aperfeiçoamento",
      "Experiência Profissional",
      "Pontuação Étnica",
    ]);
    expect(geral.linhas[0]).toEqual([
      "1º",
      "Jucikely",
      "14,0",
      "1,0",
      "2,0",
      "10,0",
      "0,0",
    ]);
  });

  it("fase final no título (depois dos recursos) e as disposições finais da convocação", () => {
    const doc = documentoOficial(retrato, { fase: "FINAL", regra: REGRA_83 });
    expect(doc.titulo).toEqual([
      "RESULTADO FINAL - ETAPA DE ANÁLISE CURRICULAR",
    ]);
    expect(doc.finais[0].texto).toContain("nos termos do item 8.24");
  });

  it("lista de eliminados: nome, nota, parciais e justificativa", () => {
    const doc = documentoOficial(retrato, {
      lista: "eliminados",
      regra: REGRA_83,
    });
    expect(doc.nome).toBe(
      "Resultado Preliminar - Etapa de Análise Curricular - Eliminados",
    );
    expect(doc.preliminares[0].texto).toContain(
      "**Resultado Preliminar da Etapa de Avaliação Documental e de Títulos dos Candidatos Eliminados**",
    );
    const [t] = doc.blocos[0].tabelas;
    expect(rotulos(t).at(0)).toBe("Nome");
    expect(rotulos(t).at(-1)).toBe("Justificativa");
    expect(t.linhas).toEqual([
      [
        "Reprovada",
        "4,0",
        "1,0",
        "2,0",
        "1,0",
        "0,0",
        "Abaixo da nota mínima da avaliação documental. Nota 4,0; mínimo 7,0 (superior).",
      ],
    ]);
    expect(t.colunas.reduce((soma, c) => soma + c.largura, 0)).toBe(100);
  });
});

describe("convocação para entrevista", () => {
  it("5 × 1 vaga: os cinco primeiros; o 6º fica fora com o motivo", () => {
    const r = classificar({ ...base, tipo: "CONVOCACAO" });
    expect(nomes(r.vagas[0].geral)).toEqual([
      "1 Jucikely",
      "2 Pedro",
      "3 Vanderlei",
      "4 Ana",
      "5 Bia",
    ]);
    expect(
      r.vagas[0].eliminados.find((e) => e.nome === "Fora do limite").motivo,
    ).toBe("NAO_CONVOCADO");
  });
});

describe("resultado da entrevista", () => {
  const r = classificar({ ...base, tipo: "ENTREVISTA" });
  const v = r.vagas[0];

  it("só os convocados aptos, pela nota da entrevista; empate na mesma posição", () => {
    expect(nomes(v.geral)).toEqual(["1 Jucikely", "1 Pedro", "2 Vanderlei"]);
    expect(v.geral.every((l) => l.situacao === "APTO")).toBe(true);
    expect(r.pendencias).toEqual([]);
  });

  it("eliminados da entrevista com motivo; quem não foi convocado não aparece", () => {
    expect(v.eliminados.map((e) => [e.nome, e.motivo])).toEqual([
      ["Bia", "AUSENTE"],
      ["Ana", "ABAIXO_NOTA_MINIMA_ENTREVISTA"],
    ]);
    const todos = [...v.geral, ...v.eliminados].map((l) => l.nome);
    expect(todos).not.toContain("Fora do limite");
    expect(todos).not.toContain("Reprovada");
  });

  it("documento no padrão: RESULTADO PRELIMINAR - ETAPA DE ENTREVISTA, Classificação | Nome | Nota", () => {
    const retrato = instantaneoDaLista(r, {
      edital: { edital: "83/2026" },
      regra: REGRA_83,
    });
    expect(retrato.parciais).toBeUndefined();
    const doc = documentoOficial(retrato, { lista: "geral", regra: REGRA_83 });
    expect(doc.titulo).toEqual(["RESULTADO PRELIMINAR - ETAPA DE ENTREVISTA"]);
    expect(doc.blocos[0].tabelas[0].colunas.map((c) => c.rotulo)).toEqual([
      "Classificação",
      "NOME",
      "NOTA",
    ]);
    expect(doc.blocos[0].tabelas[0].linhas.map((l) => l[0])).toEqual([
      "1º",
      "1º",
      "2º",
    ]);
    expect(linhasDaPlanilha(retrato).classificacao[1].at(-1)).toBe("Apto");
  });

  it("com critérios na lista da entrevista, o que sobra continua na mesma posição (sem sorteio)", () => {
    const regra = {
      ...REGRA_83,
      listas: { ...REGRA_83.listas, ENTREVISTA: { empate: "CRITERIOS" } },
      empate_final: { metodo: "SORTEIO", numeracao: "DENSA" },
    };
    const x = classificar({ ...base, regra, tipo: "ENTREVISTA" });
    // Jucikely tem nota documental maior (critério e): passa à frente.
    expect(nomes(x.vagas[0].geral).slice(0, 2)).toEqual([
      "1 Jucikely",
      "2 Pedro",
    ]);
    expect(x.pendencias).toEqual([]);
  });
});

describe("resultado final: vaga imediata e cadastro reserva", () => {
  it("documento como o 83/2026: CLASSIFICAÇÃO | NOME | NOTA FINAL (sem situação)", () => {
    const r = classificar({ ...base, tipo: "FINAL" });
    const retrato = instantaneoDaLista(r, {
      edital: { edital: "83/2026" },
      regra: REGRA_83,
    });
    const doc = documentoOficial(retrato, { lista: "geral", regra: REGRA_83 });
    expect(doc.titulo).toEqual(["RESULTADO FINAL - PROCESSO SELETIVO"]);
    const [t] = doc.blocos[0].tabelas;
    expect(t.colunas.map((c) => c.rotulo)).toEqual([
      "CLASSIFICAÇÃO",
      "NOME",
      "NOTA FINAL",
    ]);
    expect(t.linhas).toEqual([
      ["1º", "Jucikely", "31,3"],
      ["2º", "Pedro", "30,3"],
      ["3º", "Fora do limite", "29,0"],
      ["4º", "Vanderlei", "28,0"],
    ]);
    expect(linhasDaPlanilha(retrato).classificacao[1].at(-1)).toBe(
      "Dentro das vagas",
    );
  });

  it("entrevistado fora do limite de convocação vira aviso (não some, não entra calado)", () => {
    const r = classificar({ ...base, tipo: "FINAL" });
    expect(
      r.avisos.filter((a) => a.codigo === "ENTREVISTADO_NAO_CONVOCADO"),
    ).toHaveLength(1);
  });
});
