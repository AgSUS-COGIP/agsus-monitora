import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  A VAGA DE DSEI OU CASAI SÓ SE LIGA AO EDITAL DA MESMA UNIDADE (13/11/2026)

  13 vagas de Parintins vieram na planilha Auditoria com EDITAL 110/2026 e
  caíram no edital de Porto Velho. A migration 20261113120000 troca
  private."FC_LIGAR_SELECAO_AOS_EDITAIS"() para exigir a mesma unidade nas
  vagas de DSEI/CASAI. O comportamento é conferido no banco pelo ensaio;
  aqui, que migration, ensaio, rollback e retrato contam a mesma história.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const NOME = "20261113120000_ligar_selecao_so_ao_edital_da_mesma_unidade";
const ler = (relativo: string) =>
  fs.readFileSync(path.join(RAIZ, relativo), "utf8").replace(/\r\n/g, "\n");

/* O corpo entre o delimitador de abertura e o de fechamento, a partir de `inicio`. */
function corpo(
  sql: string,
  inicio: string,
  abre: string,
  fecha: string,
): string {
  const i = sql.indexOf(inicio);
  expect(i).toBeGreaterThan(-1);
  const de = sql.indexOf(abre, i) + abre.length;
  return sql.slice(de, sql.indexOf(fecha, de));
}

const CRIA =
  'create or replace function private."FC_LIGAR_SELECAO_AOS_EDITAIS"()';
const doArquivo = (sql: string) =>
  corpo(sql, CRIA, "as $function$", "$function$;");
const md5 = (texto: string) => createHash("md5").update(texto).digest("hex");

describe("migration 20261113120000: Seleção liga DSEI/CASAI só ao edital da mesma unidade", () => {
  const migration = ler(`supabase/migrations/${NOME}.sql`);
  const ensaio = ler(`supabase/ensaios/${NOME}.sql`);
  const rollback = ler(`supabase/rollback/${NOME}.sql`);
  const retrato = corpo(
    ler("supabase/esquema-atual.sql"),
    'CREATE FUNCTION private."FC_LIGAR_SELECAO_AOS_EDITAIS"()',
    "AS $_$",
    "$_$;",
  );
  const novo = doArquivo(migration);
  const antigo = doArquivo(rollback);

  it("o rollback guarda o corpo de antes (md5 conferido no banco em 13/11/2026)", () => {
    expect(md5(antigo)).toBe("c7f7a1383861bf420e9ed7b4ed3e3083");
  });

  it("o retrato mostra o corpo de antes ou o da migration", () => {
    expect([antigo, novo]).toContain(retrato);
  });

  it("o ensaio aplica exatamente o corpo da migration", () => {
    expect(doArquivo(ensaio)).toBe(novo);
  });

  it("as guardas usam o md5 do corpo de antes e do de depois", () => {
    expect(migration).toContain(`is distinct from '${md5(antigo)}'`);
    expect(migration).toContain(`if v_md5 = '${md5(novo)}'`);
    expect(rollback).toContain(`is distinct from '${md5(novo)}'`);
    expect(ensaio).toContain(`is distinct from '${md5(antigo)}'`);
    expect(ensaio).toContain(`is distinct from '${md5(novo)}'`);
  });

  it("só a ligação de DSEI/CASAI muda: exige a mesma unidade, sem hífen nem espaço repetido", () => {
    const normaliza = (x: string) =>
      `btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(${x}), '[[:space:]-]+', ' ', 'g'))`;
    expect(novo).toBe(
      antigo
        .replace(
          'private."FC_TEXTO_BUSCA_RECURSO"(m.unidade) as unidade\n',
          `private."FC_TEXTO_BUSCA_RECURSO"(m.unidade) as unidade,\n           ${normaliza("m.unidade")} as unidade_sem_hifen\n`,
        )
        .replace(
          'private."FC_TEXTO_BUSCA_RECURSO"(s."NO_UNIDADE") as unidade,\n',
          `private."FC_TEXTO_BUSCA_RECURSO"(s."NO_UNIDADE") as unidade,\n           ${normaliza('s."NO_UNIDADE"')} as unidade_sem_hifen,\n`,
        )
        .replace(
          "           and (case when c.indigena then m.area = 'saude-indigena'\n",
          "           -- DSEI/CASAI: só o edital da Saúde Indígena da mesma unidade.\n" +
            "           and (case when c.indigena then m.area = 'saude-indigena'\n" +
            "                                          and m.unidade_sem_hifen = c.unidade_sem_hifen\n",
        ),
    );
  });

  it("o ensaio repete os erros da planilha e reprova se os números mudarem", () => {
    expect(ensaio).toContain("\"DS_EDITAL\" = '110/2026'");
    expect(ensaio).toContain("'DSEI  Tocantins'");
    expect(ensaio).toContain("'DSEI Guama Tocantins'");
    expect(ensaio).toContain(
      'perform private."FC_ATUALIZAR_KPIS_PELA_SELECAO"()',
    );
    expect(ensaio.trimEnd().endsWith("rollback;")).toBe(true);
  });
});
