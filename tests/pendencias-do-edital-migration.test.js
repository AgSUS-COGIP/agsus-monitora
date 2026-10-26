import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RESOURCES, niveisDoRecurso } from "../src/lib/permissoes-recursos.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";
import { DECISOES, ORDEM_DOS_TIPOS } from "../src/lib/pendencias-do-edital.ts";

/*
  A migration "Pendências do edital" (20261026190000), ainda não aplicada: o
  ensaio com os dados reais está em supabase/ensaios/ e o teste das RPCs (com
  as identidades reais e dados fictícios, em begin…rollback) em
  supabase/tests/pendencias_do_edital.sql. Aqui, as invariantes estáticas:
  transação, ensaio com o mesmo corpo, rollback; toda função SECURITY DEFINER
  com search_path vazio; as tabelas fechadas; o job só service_role; a tela e
  as decisões para authenticated, sempre pela mesma permissão (administrador
  global sempre; os outros, pelo recurso "aprovados_pendencias" da matriz de
  Acessos, no recorte de área e edital) e pela mesma abertura (motivo, aberta,
  linhas na lista); os tipos e decisões iguais aos do Python e da tela.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261026190000_pendencias_do_edital.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const TESTE = ler("supabase/tests/pendencias_do_edital.sql");
const REGRA = ler("python/monitora/aprovados/pendencias.py");

const corpo = (sql) =>
  sql.slice(sql.indexOf("\nbegin;\n") + 8, sql.lastIndexOf("commit;")).trim();

/** Cada função criada: nome → definição (do create até o $function$; que fecha). */
function funcoes(sql) {
  const saida = new Map();
  const re =
    /create (?:or replace )?function ([a-z_]+\.(?:"[A-Z_]+"|[a-z_]+))\(/g;
  for (const m of sql.matchAll(re)) {
    const fim = sql.indexOf(
      "$function$;",
      sql.indexOf("$function$", m.index) + 1,
    );
    saida.set(m[1], sql.slice(m.index, fim));
  }
  return saida;
}
const FUNCOES = funcoes(MIGRATION);
const DECISAO = [
  "public.escolher_vinculo_do_contratado",
  "public.escolher_lista_da_contratacao",
  "public.manter_linha_da_pessoa_repetida",
  "public.confirmar_empate_da_posicao",
  "public.corrigir_posicao_da_pendencia",
  "public.registrar_desfecho_da_pendencia",
];

describe("Pendências do edital (20261026190000)", () => {
  it("é uma transação; o ensaio roda o mesmo corpo e desfaz; o rollback desfaz tudo", () => {
    expect(MIGRATION.startsWith("/*")).toBe(true);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\ncommit;/);
    expect(ENSAIO).toContain(
      "set local agsus.segredo_disparo_robos = 'ensaio-sem-chave';",
    );
    expect(TESTE.trimEnd().endsWith("rollback;")).toBe(true);
    expect(TESTE).not.toMatch(/\ncommit;/);
    for (const nome of FUNCOES.keys()) {
      if (nome === 'private."FC_RECURSOS_MODULO"') continue;
      expect(ROLLBACK, nome).toContain(`drop function if exists ${nome}(`);
    }
    expect(ROLLBACK).toContain(
      'drop table if exists public."TB_PENDENCIA_APROVADO";',
    );
    expect(ROLLBACK).toContain(
      'drop table if exists public."TH_PENDENCIA_APROVADO";',
    );
    expect(ROLLBACK).toContain(
      'delete from public."TA_GRUPO_ACESSO_RECURSO" where "NO_RECURSO" = \'aprovados_pendencias\';',
    );
    expect(ROLLBACK).not.toContain("'aprovados_pendencias']");
  });

  it("toda função SECURITY DEFINER tem search_path vazio; as tabelas são fechadas", () => {
    for (const [nome, def] of FUNCOES) {
      expect(def, nome).toMatch(/set search_path to ''/i);
      if (nome !== 'private."FC_RECURSOS_MODULO"')
        expect(def, nome).toMatch(/\bsecurity definer\b/);
    }
    for (const tabela of ["TB_PENDENCIA_APROVADO", "TH_PENDENCIA_APROVADO"]) {
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
      expect(MIGRATION).toContain(
        `revoke all on public."${tabela}" from public, anon, authenticated, service_role;`,
      );
    }
  });

  it("o job só service_role; a tela e as decisões só authenticated", () => {
    for (const rpc of [
      "public.pendencias_ler_aprovados()",
      "public.gravar_pendencias_do_edital(text, timestamptz, jsonb)",
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function ${rpc} from public, anon, authenticated;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${rpc} to service_role;`,
      );
    }
    for (const nome of ["public.listar_pendencias_do_edital", ...DECISAO]) {
      expect(MIGRATION).toMatch(
        new RegExp(
          `revoke all on function ${nome.replace(".", "\\.")}\\([^)]*\\) from public, anon;`,
        ),
      );
      expect(MIGRATION).toMatch(
        new RegExp(
          `grant execute on function ${nome.replace(".", "\\.")}\\([^)]*\\) to authenticated;`,
        ),
      );
      expect(CONTRATO_RPC[nome.slice("public.".length)], nome).toBeTruthy();
    }
    for (const nome of FUNCOES.keys())
      if (nome.startsWith("private."))
        expect(MIGRATION, nome).toMatch(
          new RegExp(
            `revoke all on function ${nome.replace(/[."]/g, (c) => `\\${c}`)}\\([^)]*\\) from public, anon, authenticated;|FC_RECURSOS_MODULO`,
          ),
        );
  });

  it("toda decisão abre a pendência pela mesma porta e fecha pelo mesmo caminho", () => {
    for (const nome of DECISAO) {
      const def = FUNCOES.get(nome);
      expect(def, nome).toContain(
        'private."FC_PENDENCIA_PARA_DECIDIR"(p_pendencia, array[',
      );
      expect(def, nome).toContain('private."FC_FECHAR_PENDENCIA"(');
      expect(def, nome).not.toMatch(
        /insert into public\."TH_PENDENCIA_APROVADO"/,
      );
    }
    const porta = FUNCOES.get('private."FC_PENDENCIA_PARA_DECIDIR"');
    expect(porta).toContain(
      'private."FC_PODE_DECIDIR_PENDENCIA"(v."CO_MONITORAMENTO")',
    );
    expect(porta).toContain("between 3 and 500");
    expect(porta).toContain("for update");
    const fecho = FUNCOES.get('private."FC_FECHAR_PENDENCIA"');
    expect(fecho).toContain(
      'private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(v."CO_MONITORAMENTO")',
    );
    expect(fecho).toContain('private."FC_FECHAR_CASOS_DO_AVISO"(v_conferencia');
    for (const c of [
      "APROVADOS_CONTRATADO_DUPLICADO",
      "APROVADOS_MESMA_MATRICULA_EM_DUAS_LINHAS",
      "APROVADOS_CONVOCADO_SEM_DESFECHO",
    ])
      expect(fecho).toContain(`'${c}'`);
    // O status muda pelo histórico do status (o gatilho do "Contratado em outra lista" refaz a decisão do job).
    expect(FUNCOES.get('private."FC_STATUS_PELA_PENDENCIA"')).toContain(
      'insert into public."TH_CANDIDATO_APROVADO"',
    );
    // Pessoa repetida: remoção lógica, nunca delete.
    const repetida = FUNCOES.get("public.manter_linha_da_pessoa_repetida");
    expect(repetida).toContain(
      "set removido_em = now(), removido_por = (select auth.uid())",
    );
    expect(MIGRATION).not.toMatch(
      /delete from public\."TB_CANDIDATO_APROVADO"/,
    );
  });

  it("a permissão: administrador global sempre; os outros pelo recurso da matriz, no recorte", () => {
    const pode = FUNCOES.get('private."FC_PODE_DECIDIR_PENDENCIA"');
    expect(pode).toContain("select private.is_master()");
    expect(pode).toContain("private.pode_recurso('aprovados_pendencias', 2)");
    expect(pode).toContain('private."FC_PODE_VER_EDITAL"(p_edital)');
    expect(pode).not.toMatch(/monitora_role|edital_gestor/);
    const tela = FUNCOES.get("public.listar_pendencias_do_edital");
    expect(tela).toContain(
      "not private.is_master() and not private.pode_recurso('aprovados', 1)",
    );
    expect(tela).toContain(
      'private.is_master() or private."FC_PODE_VER_EDITAL"(p."CO_MONITORAMENTO")',
    );
    // O recurso na matriz do banco e na do front, com os quatro níveis.
    expect(MIGRATION).toMatch(
      /'avaliacao_documental','aprovados_pendencias'\]::text\[\]/,
    );
    expect(RESOURCES.map(([id]) => id)).toContain("aprovados_pendencias");
    expect(niveisDoRecurso("aprovados_pendencias").map(([n]) => n)).toEqual([
      "sem_acesso",
      "leitor",
      "editor",
      "admin",
    ]);
    expect(TESTE).toContain("'permissao_concedida_decide'");
    expect(TESTE).toContain("'permissao_tirada_recusa_42501'");
    expect(TESTE).toContain("'admin_global_pode_tudo'");
  });

  it("os tipos e as decisões são os mesmos no banco, no Python e na tela", () => {
    const tiposDoBanco =
      /"CK_PENDAPROV_TPPENDENCIA" check \("TP_PENDENCIA" in \(([^)]*)\)\)/
        .exec(MIGRATION)[1]
        .match(/'([A-Z_]+)'/g)
        .map((t) => t.slice(1, -1));
    expect(tiposDoBanco).toEqual([...ORDEM_DOS_TIPOS]);
    for (const tipo of tiposDoBanco) expect(REGRA).toContain(`"${tipo}"`);
    const decisoesDoBanco =
      /"CK_PENDAPROV_TPDECISAO" check \("TP_DECISAO" is null or "TP_DECISAO" in \(([^)]*)\)\)/
        .exec(MIGRATION)[1]
        .match(/'([A-Z_]+)'/g)
        .map((t) => t.slice(1, -1));
    expect(decisoesDoBanco.sort()).toEqual(Object.keys(DECISOES).sort());
    // A chave do Python (40 hex) e a execução (pend-…) que o banco aceita.
    expect(REGRA).toContain(".hexdigest()[:40]");
    expect(MIGRATION).toContain("'^pend-[0-9]{8}T[0-9]{6}-[0-9a-f]{8}$'");
  });

  it("a leitura do job não leva nome, CPF nem matrícula", () => {
    const leitura = FUNCOES.get("public.pendencias_ler_aprovados");
    const saida = leitura.slice(leitura.indexOf("select jsonb_build_object("));
    expect(saida).not.toMatch(/c\.nome|matricula|cpf|email/i);
    expect(leitura).toContain(
      "left(encode(sha256(convert_to('pendencia:nome:'",
    );
  });
});
