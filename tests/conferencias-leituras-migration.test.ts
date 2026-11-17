import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A MIGRATION DAS LEITURAS DAS CONFERÊNCIAS (20261117193000), enquanto pendente

  Conferência de 17/11/2026: a "inscrição" das análises passa a ser a candidatura no mesmo edital, os
  aprovados trazem a admissão conciliada com o RH e as listas, a versão da regra. As regras que usam
  isso estão em scripts/conferencias/regras.py (tests/python/test_conferencias.py). Aqui, o texto:
  a guarda parte dos corpos do retrato (supabase/esquema-atual.sql), cada troca está lá e o rollback
  devolve os corpos e comentários de antes, letra por letra. Aplicada a migration (e regerado o
  retrato), este teste sai junto com ela.
*/
const NOME = "20261117193000_corrigir_leituras_das_conferencias.sql";
const ler = (caminho: string) =>
  readFileSync(caminho, "utf8").replace(/\r/g, "");
const RETRATO = ler("supabase/esquema-atual.sql");
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const FUNCOES = [
  "conferencia_ler_analises(",
  "conferencia_ler_aprovados(",
  "conferencia_ler_listas_e_quadros(",
] as const;

/** A definição inteira (do CREATE ao `$tag$;`) e o corpo, de um texto SQL. */
function definicao(texto: string, funcao: string, inicio = "CREATE FUNCTION") {
  const i = texto.indexOf(`${inicio} public.${funcao}`);
  expect(i, `${inicio} ${funcao}`).toBeGreaterThanOrEqual(0);
  const resto = texto.slice(i);
  const achado = /AS (\$[A-Za-z_]*\$)/.exec(resto);
  const tag = achado?.[1];
  if (!achado || !tag) throw new Error(`sem corpo: ${funcao}`);
  const ini = achado.index + achado[0].length;
  const fim = resto.indexOf(tag, ini);
  return {
    inteira: resto.slice(0, fim + tag.length),
    corpo: resto.slice(ini, fim),
  };
}

const comentario = (texto: string, funcao: string) => {
  const i = texto.indexOf(`COMMENT ON FUNCTION public.${funcao}`);
  return texto.slice(i, texto.indexOf("\n", i));
};

const md5 = (texto: string) => createHash("md5").update(texto).digest("hex");

describe("migration das leituras das conferências", () => {
  it("a guarda parte do md5 dos corpos do retrato", () => {
    for (const f of FUNCOES) {
      const { corpo } = definicao(RETRATO, f);
      expect(MIGRATION, f).toContain(`is distinct from '${md5(corpo)}'`);
    }
  });

  it("inscrição só da candidatura no mesmo edital ou na vaga da análise", () => {
    const { corpo } = definicao(
      MIGRATION,
      "conferencia_ler_analises(",
      "CREATE OR REPLACE FUNCTION",
    );
    expect(corpo).toContain(`v."CO_MONITORAMENTO" = e.edital_id`);
    expect(corpo).toContain(`c."CO_VAGA" = nullif(btrim(p.codigo_vaga), '')`);
  });

  it("aprovados com a admissão conciliada; a linha admitida entra com qualquer status", () => {
    const { corpo } = definicao(
      MIGRATION,
      "conferencia_ler_aprovados(",
      "CREATE OR REPLACE FUNCTION",
    );
    expect(corpo).toContain(`public."TB_ADMISSAO_CONCILIADA"`);
    expect(corpo).toContain(
      `(c.status in ('Convocado', 'Contratado') or ad.admissao is not null)`,
    );
    expect(corpo).toContain(
      `'admitido', c.admissao is not null, 'admissao', c.admissao`,
    );
    // A lista ativa continua exigida (a vencida recusa mudar status: aviso sem como resolver).
    expect(corpo).toContain("coalesce(l.ativo, true)");
  });

  it("listas com a versão da regra", () => {
    const { corpo } = definicao(
      MIGRATION,
      "conferencia_ler_listas_e_quadros(",
      "CREATE OR REPLACE FUNCTION",
    );
    expect(corpo).toContain(`'versao_regra', u."NU_VERSAO_REGRA"`);
  });

  it("o rollback devolve corpos e comentários do retrato, letra por letra", () => {
    for (const f of FUNCOES) {
      const antes = definicao(RETRATO, f).inteira.replace(
        "CREATE FUNCTION",
        "CREATE OR REPLACE FUNCTION",
      );
      expect(ROLLBACK, f).toContain(antes);
      expect(ROLLBACK, f).toContain(comentario(RETRATO, f));
    }
  });

  it("o rollback e o ensaio conferem o md5 do corpo novo; o ensaio termina em rollback", () => {
    for (const f of FUNCOES) {
      const { corpo } = definicao(MIGRATION, f, "CREATE OR REPLACE FUNCTION");
      expect(ROLLBACK, f).toContain(`is distinct from '${md5(corpo)}'`);
    }
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
  });
});
