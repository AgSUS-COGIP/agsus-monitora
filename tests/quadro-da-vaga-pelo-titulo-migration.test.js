import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { nivelDaVaga } from "../src/lib/classificacao/vagas.js";

/*
  Invariantes da migration 20261013140000 (a linha do quadro de cada vaga pelo
  título da Empregare, quando a análise não vem da planilha — 114/2026) e o
  nível que sai do "(Nível …)" do cargo do quadro sem niveis_por_cargo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261013140000_quadro_da_vaga_pelo_titulo.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const NOVAS = [
  ["FC_TITULO_DA_VAGA_EMPREGARE", "(text)"],
  ["FC_NUMERO_DO_CARGO", "(text)"],
  ["FC_UF_DA_LOTACAO", "(text)"],
  ["FC_QUADRO_PELO_TITULO_EMPREGARE", "(uuid, text)"],
];

describe("a migration", () => {
  it("transação com lock_timeout", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION).toContain("set local lock_timeout = '10s';");
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
  });

  it.each(NOVAS)("%s é privada e sem execução para ninguém", (nome, args) => {
    expect(MIGRATION).toContain(`create or replace function private."${nome}"`);
    expect(MIGRATION).toContain(
      `revoke all on function private."${nome}"${args} from public, anon, authenticated, service_role;`,
    );
    expect(ROLLBACK).toContain(
      `drop function if exists private."${nome}"${args};`,
    );
  });

  it("o caminho da planilha vem antes do título", () => {
    const corpo = MIGRATION.slice(
      MIGRATION.indexOf(
        'create or replace function private."FC_QUADRO_DA_VAGA_EMPREGARE"',
      ),
    );
    expect(
      corpo.indexOf('"FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga)'),
    ).toBeLessThan(
      corpo.indexOf('"FC_QUADRO_PELO_TITULO_EMPREGARE"(p_edital, p_vaga)'),
    );
    expect(corpo).toContain('returns public."TB_QUADRO_VAGA_EDITAL"');
  });

  it("título sem enfeites, número do cargo e lotação pela UF dos inscritos das irmãs", () => {
    for (const trecho of [
      "'^Candidatos da vaga [0-9]+ - (.+?) em Excel'",
      "'^\\s*\\[vaga\\]\\s*'",
      "'\\s*-\\s*empregare(\\s+ats)?\\s*$'",
      "'\\s*\\(n[íi]vel [^)]*\\)\\s*$'",
      "'^cargo (?:n |no )?([0-9]{1,3})(?: |$)'",
      "c.\"DS_COLUNA_ORIGINAL\" ->> 'ESTADO'",
      "(c.n + 1)::numeric / (sum(c.n) over (partition by c.id) + 2)",
      "(select count(distinct id) from escolha) = (select count(*) from linhas)",
    ])
      expect(MIGRATION).toContain(trecho);
  });

  it("pode ser aplicada antes da 20261013130000 (repete FC_TEXTO_DO_CARGO)", () => {
    expect(MIGRATION).toContain(
      'create or replace function private."FC_TEXTO_DO_CARGO"(p_texto text)',
    );
    expect(ROLLBACK).not.toContain(
      'drop function if exists private."FC_TEXTO_DO_CARGO"',
    );
  });

  it("o ensaio confere as 30 vagas, o nível e o que o job lê, sem gravar", () => {
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    expect(ENSAIO).toContain("count(*) from t_vagas_114) <> 30");
    expect(ENSAIO).toContain("public.pre_classificacao_ler_editais(");
    expect(ENSAIO).toContain(
      "when numero between 11 and 15 then 'medio' when numero = 9 then 'tecnico'",
    );
  });
});

describe("o nível pelo cargo do quadro (sem niveis_por_cargo)", () => {
  const REGRA_114 = {
    documental: { niveis_por_cargo: [], nivel_padrao: null, nota_minima: 10 },
  };
  it.each([
    ["CARGO 15: MOTORISTA - Categoria D (Nível Médio)", "medio"],
    [
      "CARGO 11: AUXILIAR ADMINISTRATIVO - Auxiliar de Logística (Nível Médio)",
      "medio",
    ],
    ["CARGO 9: TÉCNICO DE LABORATÓRIO (Nível Técnico)", "tecnico"],
    ["CARGO 1: QUÍMICO - Análise da Água (Nível Superior)", "superior"],
  ])("%s → %s", (cargo, nivel) => {
    expect(nivelDaVaga({ cargo }, REGRA_114)).toBe(nivel);
  });
});
