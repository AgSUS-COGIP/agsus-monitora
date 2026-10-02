import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CRITERIO_POR_CODIGO } from "../src/lib/classificacao/catalogo.js";
import { classificar } from "../src/lib/classificacao/motor.js";
import {
  normalizarRegra,
  validarRegra,
} from "../src/lib/classificacao/regra.js";

/*
  O seed das regras de TODOS os editais (lidas dos PDFs oficiais em 02/10/2026)
  e um edital representativo de cada modelo passando pelo motor.

  Modelos (texto-base comum; ver scratchpad/classificacao/todos/relatorio-regras.md):
    SI26-83, SI26-ART, SI26-A, SI25-ENTREVISTA, SI25-CURRICULAR (Saúde Indígena);
    SEDE25-CORES, SEDE25-BAREMA, SEDE25-MEDIA, SEDE25-PROVA (Sede);
    PROJ26-CURRICULAR, PROJ26-MFC, PROJ25-PROVA, PROJ25-FRONTEIRAS (Projetos).
*/

const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261002-regras-de-classificacao-todos-os-editais.sql";
const SEED = ler(`supabase/correcoes/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const MOTIVO = "Regra lida do edital (PDF oficial) — conferir";

const LINHA =
  /\('([0-9a-f-]{36})'::uuid, '([^']+)', '([^']+)', '([^']+)', \$r\$(.*?)\$r\$::jsonb\)/g;
const REGRAS = [...SEED.matchAll(LINHA)].map((m) => ({
  id: m[1],
  edital: m[2],
  area: m[3],
  modelo: m[4],
  regra: JSON.parse(m[5]),
}));
const doModelo = (modelo) => REGRAS.find((r) => r.modelo === modelo).regra;

const corpo = (sql) => {
  const inicio = sql.indexOf(
    "create function pg_temp.aplicar_regras_dos_editais()",
  );
  const fim = sql.indexOf("$seed$;", inicio) + "$seed$;".length;
  return sql.slice(inicio, fim);
};

describe("seed das regras de todos os editais", () => {
  it("131 regras, uma por edital, sem o 83/2026 e o 100/2026 (que já têm)", () => {
    expect(REGRAS).toHaveLength(131);
    expect(new Set(REGRAS.map((r) => r.id)).size).toBe(REGRAS.length);
    const daSaude = REGRAS.filter((r) => r.area === "saude-indigena").map(
      (r) => r.edital,
    );
    expect(daSaude).not.toContain("83/2026");
    expect(daSaude).not.toContain("100/2026");
  });

  it("toda regra é válida, já normalizada e só usa critérios do catálogo", () => {
    for (const { edital, area, regra } of REGRAS) {
      expect(validarRegra(regra), `${edital} ${area}`).toEqual([]);
      expect(normalizarRegra(regra), `${edital} ${area}`).toEqual(regra);
      for (const d of regra.desempate)
        expect(CRITERIO_POR_CODIGO[d.criterio], d.criterio).toBeTruthy();
      expect(regra.data_corte).toBeNull();
      expect(regra.importacao.modelo).toBeTruthy();
    }
  });

  it("idempotente: só cria regra para edital sem regra, conferindo número e área", () => {
    const c = corpo(SEED);
    expect(c).toContain(
      'if exists (select 1 from public."TB_REGRA_CLASSIFICACAO" x where x."CO_MONITORAMENTO" = r.edital_id) then',
    );
    expect(c).toContain(
      'private."FC_NUMERO_EDITAL"(v_edital.edital) is distinct from private."FC_NUMERO_EDITAL"(r.numero)',
    );
    expect(c).toContain(`'${MOTIVO}'`);
    expect(c).toContain(
      'perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(r.configuracao);',
    );
    expect(SEED).toMatch(
      /\nbegin;\n[\s\S]+\nselect pg_temp\.aplicar_regras_dos_editais\(\);\n\ncommit;\n$/,
    );
  });

  it("ensaio: o mesmo corpo, roda duas vezes (idempotência) e termina em rollback", () => {
    expect(corpo(ENSAIO)).toBe(corpo(SEED));
    expect(
      ENSAIO.match(/select pg_temp\.aplicar_regras_dos_editais\(\);/g),
    ).toHaveLength(2);
    for (const marca of ["ok E1", "ok E2", "ok E3", "ok E4", "ENSAIO OK"])
      expect(ENSAIO).toContain(marca);
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\ncommit;/);
  });

  it("rollback: só as v1 do seed, sem versão 2, sem lista e sem desempate", () => {
    expect(ROLLBACK).toContain(`h."DS_MOTIVO" = '${MOTIVO}'`);
    expect(ROLLBACK).toContain('r."NU_VERSAO_VIGENTE" = 1');
    expect(ROLLBACK).toContain('public."TB_LISTA_CLASSIFICACAO" l');
    expect(ROLLBACK).toContain('public."TB_DESEMPATE_CLASSIFICACAO" d');
    expect(ROLLBACK).toContain('h2."NU_VERSAO" > 1');
  });

  it("os 13 modelos estão no seed", () => {
    expect([...new Set(REGRAS.map((r) => r.modelo))].sort()).toEqual([
      "PROJ25-FRONTEIRAS",
      "PROJ25-PROVA",
      "PROJ26-CURRICULAR",
      "PROJ26-MFC",
      "SEDE25-BAREMA",
      "SEDE25-CORES",
      "SEDE25-MEDIA",
      "SEDE25-PROVA",
      "SI25-CURRICULAR",
      "SI25-ENTREVISTA",
      "SI26-83",
      "SI26-A",
      "SI26-ART",
    ]);
  });
});

/* ── Um edital representativo de cada modelo pelo motor ─────────────── */

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const cand = (nome, doc, campos = {}) => ({
  analise_id: id(),
  codigo: String(100 + n),
  nome,
  vaga: "900001",
  cargo: "Enfermeiro",
  modalidade: "Ampla concorrência",
  status: "Aprovado",
  nota_documental: doc,
  quadro: "q1",
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
const quadro = (vagas, cargo = "Enfermeiro") => [
  {
    id: "q1",
    ordem: 1,
    cargo,
    vagas_imediatas: vagas,
    modalidades: {},
    cadastro_reserva: true,
  },
];
const nomes = (linhas) => linhas.map((l) => `${l.posicao} ${l.nome}`);
const motivos = (v) =>
  Object.fromEntries(v.eliminados.map((e) => [e.nome, e.motivo]));

describe("SI26-83 (texto-base do 83/2026) — 36/2026 DSEI Potiguara", () => {
  const regra = doModelo("SI26-83");
  it("nota mínima por nível (superior 8, técnico 6) e entrevista ≥ 10 e ≥ 2,5 por competência", () => {
    const a = cand("Ana", 9);
    const b = cand("Bia", 7.9);
    const t = cand("Téo", 6, { cargo: "Técnico de Enfermagem" });
    const c = cand("Caio", 12);
    const r = classificar({
      tipo: "FINAL",
      regra,
      candidatos: [a, b, t, c],
      entrevistas: [
        ent(a, 15),
        ent(t, 12),
        ent(c, 14, {
          notas: [
            { ordem: 1, nota: 2 },
            { ordem: 2, nota: 4 },
            { ordem: 3, nota: 4 },
            { ordem: 4, nota: 4 },
          ],
        }),
      ],
      quadro: quadro(1),
      dataCorte: "2026-06-29",
    });
    const v = r.vagas[0];
    expect(nomes(v.geral)).toEqual(["1 Ana", "2 Téo"]);
    expect(motivos(v)).toMatchObject({
      Bia: "ABAIXO_NOTA_MINIMA_DOCUMENTAL",
      Caio: "COMPETENCIA_ABAIXO_MINIMO",
    });
    expect(regra.convocacao).toMatchObject({
      multiplo_vagas: 10,
      posicao_max_cr: 20,
    });
  });
});

describe("SI26-ART (texto-base do 100/2026: ART + lote) — 88/2026 DSEI Xavante", () => {
  const regra = doModelo("SI26-ART");
  it("sem mínimo documental; nota 1 numa competência elimina; preliminar desempata por critérios", () => {
    const ind = cand("Iara", 13, {
      modalidade: "Indígenas",
      pontuacao_etnica: 8,
    });
    const ac = cand("Ana", 13);
    const baixa = cand("Bruno", 2);
    const pre = classificar({
      tipo: "PRELIMINAR",
      regra,
      candidatos: [ac, ind, baixa],
      quadro: quadro(2),
      dataCorte: "2026-08-01",
    });
    expect(nomes(pre.vagas[0].geral)).toEqual(["1 Iara", "2 Ana", "3 Bruno"]);
    const fin = classificar({
      tipo: "FINAL",
      regra,
      candidatos: [ac, ind],
      entrevistas: [
        ent(ac, 15, {
          notas: [
            { ordem: 1, nota: 1 },
            { ordem: 2, nota: 5 },
            { ordem: 3, nota: 5 },
            { ordem: 4, nota: 4 },
          ],
        }),
        ent(ind, 9),
      ],
      quadro: quadro(2),
      dataCorte: "2026-08-01",
    });
    expect(motivos(fin.vagas[0]).Ana).toBe("COMPETENCIA_ELIMINATORIA");
    expect(nomes(fin.vagas[0].geral)).toEqual(["1 Iara"]);
  });
});

describe("SI26-A (Sanitarista, 100 pontos) — 34/2026", () => {
  const regra = doModelo("SI26-A");
  it("mínimo documental 40 (único) e convocação 5× / até a 10ª", () => {
    const r = classificar({
      tipo: "PRELIMINAR",
      regra,
      candidatos: [cand("Ana", 41), cand("Bia", 39.9)],
      quadro: quadro(1, "Sanitarista"),
    });
    expect(nomes(r.vagas[0].geral)).toEqual(["1 Ana"]);
    expect(motivos(r.vagas[0]).Bia).toBe("ABAIXO_NOTA_MINIMA_DOCUMENTAL");
    expect(regra.convocacao).toMatchObject({
      multiplo_vagas: 5,
      posicao_max_cr: 10,
      excecoes: [],
    });
  });
});

describe("SI25-ENTREVISTA (2025: reserva conjunta PPIQ 30%) — 11/2025", () => {
  const regra = doModelo("SI25-ENTREVISTA");
  it("quem declarou pretos e pardos, indígena ou quilombola entra na lista PPIQ", () => {
    const pp = cand("Paula", 20, { modalidade: "Pretos e pardos" });
    const pq = cand("Quitéria", 19, { modalidade: "Quilombola" });
    const ac = cand("Ana", 25);
    const r = classificar({
      tipo: "FINAL",
      regra,
      candidatos: [pp, pq, ac],
      entrevistas: [ent(pp, 15), ent(pq, 15), ent(ac, 15)],
      quadro: quadro(4),
    });
    const v = r.vagas[0];
    expect(nomes(v.porModalidade.PPIQ)).toEqual(["1 Paula", "2 Quitéria"]);
    expect(v.vagasPorModalidade).toEqual({ AC: 2, PCD: 1, PPIQ: 1 });
    expect(regra.desempate.map((d) => d.criterio)).not.toContain("IDOSO_60");
  });
});

describe("SI25-CURRICULAR (2025, só análise curricular) — 03/2025", () => {
  const regra = doModelo("SI25-CURRICULAR");
  it("sem entrevista: o resultado final é a nota documental, com mínimo 10", () => {
    const r = classificar({
      tipo: "FINAL",
      regra,
      candidatos: [cand("Ana", 50), cand("Bia", 9)],
      quadro: quadro(1),
    });
    expect(nomes(r.vagas[0].geral)).toEqual(["1 Ana"]);
    expect(r.vagas[0].geral[0]).toMatchObject({ nota: 50, situacao: "VAGA" });
    expect(regra.etapas.entrevista).toBe(false);
  });
});

describe("SEDE25-CORES (entrevista só apto/inapto) — 01/2025", () => {
  const regra = doModelo("SEDE25-CORES");
  it("apto sem nota não é eliminado; inapto e sem parecer saem; a final é a curricular", () => {
    const a = cand("Ana", 80);
    const b = cand("Bia", 90);
    const c = cand("Caio", 85);
    const d = cand("Duda", 75);
    const r = classificar({
      tipo: "FINAL",
      regra,
      candidatos: [a, b, c, d],
      entrevistas: [
        ent(a, null),
        ent(b, null, { parecer: "INAPTO" }),
        ent(c, null, { parecer: "" }),
        ent(d, null),
      ],
      quadro: quadro(1, "Analista"),
    });
    const v = r.vagas[0];
    expect(nomes(v.geral)).toEqual(["1 Ana", "2 Duda"]);
    expect(motivos(v)).toMatchObject({
      Bia: "INAPTO_ENTREVISTA",
      Caio: "SEM_PARECER_ENTREVISTA",
    });
    const lista = classificar({
      tipo: "ENTREVISTA",
      regra,
      candidatos: [a, d],
      entrevistas: [ent(a, null), ent(d, null)],
      quadro: quadro(1, "Analista"),
    });
    expect(nomes(lista.vagas[0].geral)).toEqual(["1 Ana", "2 Duda"]);
  });
});

describe("SEDE25-BAREMA — 08/2025", () => {
  it("mínimo 70 e desempate por maior idade", () => {
    const regra = doModelo("SEDE25-BAREMA");
    const velho = cand("Velho", 80, { data_nascimento: "1970-01-01" });
    const novo = cand("Novo", 80, { data_nascimento: "1990-01-01" });
    const r = classificar({
      tipo: "FINAL",
      regra,
      candidatos: [novo, velho],
      entrevistas: [ent(novo, null), ent(velho, null)],
      quadro: quadro(1, "Analista"),
      dataCorte: "2025-06-17",
    });
    expect(nomes(r.vagas[0].geral)).toEqual(["1 Velho", "2 Novo"]);
  });
});

describe("modelos com prova (SEDE25-PROVA, SEDE25-MEDIA, PROJ25-PROVA)", () => {
  it("a regra cobre a etapa curricular; a prova está em aberto (não modelada)", () => {
    for (const modelo of ["SEDE25-PROVA", "SEDE25-MEDIA", "PROJ25-PROVA"]) {
      const regra = doModelo(modelo);
      expect(regra.etapas.entrevista, modelo).toBe(false);
      expect(regra.importacao.em_aberto.join(" "), modelo).toMatch(/prova/i);
    }
    expect(
      doModelo("SEDE25-PROVA").modalidades.find((m) => m.codigo === "PP")
        .agrupa,
    ).toEqual(["PI", "PQ"]);
    expect(doModelo("PROJ25-PROVA").desempate.map((d) => d.criterio)).toEqual([
      "IDOSO_60",
      "NOTA_CONHECIMENTOS_ESPECIFICOS",
      "MAIOR_IDADE",
    ]);
  });
});

describe("PROJ26-MFC — 05/2026", () => {
  it("empate final por sorteio (lido no edital): sem registro, fica pendente", () => {
    const regra = doModelo("PROJ26-MFC");
    expect(regra.empate_final.metodo).toBe("SORTEIO");
    const r = classificar({
      tipo: "FINAL",
      regra,
      candidatos: [cand("Ana", 30), cand("Bia", 30)],
      quadro: quadro(1, "Médico"),
    });
    expect(r.pendencias).toHaveLength(1);
    expect(r.avisos.map((a) => a.codigo)).toContain("DADO_FALTANDO");
  });
});

describe("PROJ26-CURRICULAR — 114/2026, 93/2026, 30/2026", () => {
  it("só curricular, mínimo da regra e cotas com reversão PI ↔ PQ → PP", () => {
    const regra = doModelo("PROJ26-CURRICULAR");
    const r = classificar({
      tipo: "FINAL",
      regra,
      candidatos: [
        cand("Ana", regra.documental.nota_minima + 1),
        cand("Bia", regra.documental.nota_minima - 1),
      ],
      quadro: quadro(1, "Analista"),
    });
    expect(nomes(r.vagas[0].geral)).toEqual(["1 Ana"]);
  });
});

describe("PROJ25-FRONTEIRAS — 23/2025", () => {
  it("desempata também a lista preliminar (maior idade primeiro)", () => {
    const regra = doModelo("PROJ25-FRONTEIRAS");
    const r = classificar({
      tipo: "PRELIMINAR",
      regra,
      candidatos: [
        cand("Novo", 40, { data_nascimento: "1995-01-01" }),
        cand("Velho", 40, { data_nascimento: "1960-01-01" }),
      ],
      quadro: quadro(1, "Médico"),
      dataCorte: "2025-07-01",
    });
    expect(nomes(r.vagas[0].geral)).toEqual(["1 Velho", "2 Novo"]);
  });
});
