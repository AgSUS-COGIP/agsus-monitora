import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  AS ABAS 2 E 3 DO RELATÓRIO DA DIRETORIA NO BANCO (migration 20261116120000)

  O comportamento é conferido no banco pelo ensaio (como administrador
  global, terminando em rollback); aqui, as regras que não podem afrouxar:
  quem lê, o que sai e o registro de cada download com nome e matrícula.
*/

const RAIZ = path.resolve(import.meta.dirname, "..");
const NOME = "20261116120000_relatorio_da_diretoria_por_cargo_e_aprovados";
const ler = (relativo: string) =>
  fs.readFileSync(path.join(RAIZ, relativo), "utf8").replace(/\r\n/g, "\n");

function funcao(sql: string, nome: string) {
  const i = sql.indexOf(`create function public.${nome}(`);
  expect(i).toBeGreaterThan(-1);
  return sql.slice(i, sql.indexOf("$funcao$;", i));
}

describe("migration 20261116120000", () => {
  const migration = ler(`supabase/migrations/${NOME}.sql`);
  const ensaio = ler(`supabase/ensaios/${NOME}.sql`);
  const rollback = ler(`supabase/rollback/${NOME}.sql`);
  const porCargo = funcao(migration, "listar_vagas_por_cargo_da_visao_geral");
  const aprovados = funcao(migration, "exportar_aprovados_da_diretoria");

  it("as duas RPCs são SECURITY DEFINER, search_path vazio, só para quem entrou", () => {
    for (const corpo of [porCargo, aprovados]) {
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path = ''");
      expect(corpo).toContain("errcode = '28000'");
      expect(corpo).toContain('private."FC_AREAS_USUARIO"()');
      expect(corpo).toContain('private."FC_EDITAIS_VISIVEIS"()');
      expect(corpo).toContain('private."FC_EH_TREINAMENTO"');
    }
    for (const nome of [
      "listar_vagas_por_cargo_da_visao_geral(text, uuid[])",
      "exportar_aprovados_da_diretoria(text, text, uuid[])",
    ]) {
      expect(migration).toContain(
        `revoke all on function public.${nome} from public, anon;`,
      );
      expect(migration).toContain(
        `grant execute on function public.${nome} to authenticated;`,
      );
    }
  });

  it("a aba 2 é do recurso dashboard e não traz dado pessoal", () => {
    expect(porCargo).toContain("private.pode_recurso('dashboard')");
    expect(porCargo).toContain("stable security definer");
    expect(porCargo).not.toMatch(/c\.nome|matricula|"DS_EMAIL|cpf/i);
  });

  it("a aba 3 pede Aprovados leitor e registra o download antes de devolver", () => {
    expect(aprovados).toContain("private.pode_recurso('aprovados', 1)");
    expect(aprovados).toContain("'matricula', nullif(btrim(c.matricula), '')");
    expect(aprovados).toContain('"TB_ADMISSAO_CONCILIADA"');
    const grava = aprovados.indexOf(
      'insert into public."TL_EXPORTACAO_APROVADO"',
    );
    const devolve = aprovados.indexOf("return jsonb_build_object(");
    expect(grava).toBeGreaterThan(-1);
    expect(grava).toBeLessThan(devolve);
    expect(aprovados).toContain("'DIRETORIA'");
    // O registro não guarda dado de candidato: só os editais.
    expect(aprovados).toContain(
      "jsonb_build_object('editais', to_jsonb(v_editais))",
    );
  });

  it("o registro aceita DIRETORIA, e o rollback não apaga downloads registrados", () => {
    expect(migration).toContain(
      `check ("TP_CONTEUDO" in ('LISTA', 'RESUMO', 'DIRETORIA'))`,
    );
    expect(migration).toContain('alter column "TP_CONTEUDO" type varchar(10)');
    expect(rollback).toContain(
      "drop function if exists public.exportar_aprovados_da_diretoria(text, text, uuid[]);",
    );
    expect(rollback).toContain(
      "drop function if exists public.listar_vagas_por_cargo_da_visao_geral(text, uuid[]);",
    );
    expect(rollback).not.toMatch(
      /delete from public\."TL_EXPORTACAO_APROVADO"/,
    );
  });

  it("o ensaio aplica o mesmo corpo e termina em rollback", () => {
    const corpo = migration.slice(
      migration.indexOf("begin;"),
      migration.lastIndexOf("commit;"),
    );
    expect(ensaio).toContain(corpo);
    expect(ensaio.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ensaio).not.toMatch(/^commit;/m);
  });
});
