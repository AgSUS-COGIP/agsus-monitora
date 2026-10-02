import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  As migrations da Visão geral de 02/10/2026, lidas como texto (o banco não é
  consultado):
  - 20261002130000: FC_ATUALIZAR_KPIS_PELA_SELECAO para todo edital ativo com
    a fonte (FGV na SEDE e FCC em Projetos tinham 0 contratados com 567 e 503
    na lista vigente) e o recálculo no fim da carga da Seleção;
  - 20261002131000: listar_acompanhamento_da_visao_geral (etapas do
    cronograma e resumo das listas) para o crítico "parado", a agenda e o
    Pós-resultado.
  Cada uma com rollback e ensaio (begin…rollback).
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const semComentarios = (sql) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");

const KPIS = ler(
  "supabase/migrations/20261002130000_kpis_de_todo_edital_com_fonte.sql",
);
const KPIS_ROLLBACK = ler(
  "supabase/rollback/20261002130000_kpis_de_todo_edital_com_fonte.sql",
);
const KPIS_ENSAIO = ler(
  "supabase/ensaios/20261002130000_kpis_de_todo_edital_com_fonte.sql",
);
const ANTERIOR = ler(
  "supabase/migrations/20260930235800_kpis_do_edital_pela_selecao.sql",
);
const SYNC_ANTERIOR = ler(
  "supabase/migrations/20261001100000_selecao_area_pelos_editais.sql",
);
const ACOMP = ler(
  "supabase/migrations/20261002131000_acompanhamento_da_visao_geral.sql",
);
const ACOMP_ROLLBACK = ler(
  "supabase/rollback/20261002131000_acompanhamento_da_visao_geral.sql",
);
const ACOMP_ENSAIO = ler(
  "supabase/ensaios/20261002131000_acompanhamento_da_visao_geral.sql",
);

/* O corpo de uma função (do `as $function$` ao `$function$;`). */
function corpo(sql, nome) {
  const inicio = sql.indexOf(nome);
  const abre = sql.indexOf("$function$", inicio);
  const fecha = sql.indexOf("$function$;", abre + 10);
  return sql.slice(abre, fecha);
}

describe("20261002130000: KPIs de todo edital com fonte", () => {
  const funcao = semComentarios(
    corpo(KPIS, 'private."FC_ATUALIZAR_KPIS_PELA_SELECAO"()'),
  );

  it("parte de todo edital ativo, não só dos ligados à Seleção", () => {
    expect(funcao).toMatch(
      /with ed as materialized \(\s+select m\.id, m\."CO_AREA"/,
    );
    expect(funcao).toContain("where m.ativo");
    // A regra antiga (só "alvo" = editais com vaga na Seleção) saiu.
    expect(ANTERIOR).toContain("m.id in (select id from sel)");
    expect(funcao).not.toContain("m.id in (select id from sel)");
    expect(funcao).not.toMatch(/\balvo\b/);
  });

  it("liga pelo id: Seleção, entrevistas e lista vigente; análises pelo número ou nome único", () => {
    expect(funcao).toContain(`s."CO_MONITORAMENTO" in (select id from ed)`);
    expect(funcao).toContain(`e."CO_MONITORAMENTO" in (select id from ed)`);
    expect(funcao).toContain(
      "l.vigente is true and l.edital_id in (select id::text from ed)",
    );
    expect(funcao).toContain("c.status in ('Contratado', 'Migração')");
    expect(funcao).toContain(`e."TP_PARECER" in ('APTO', 'INAPTO')`);
    // Edital sem número ("FGV", "FCC"): o nome normalizado.
    expect(funcao).toContain(
      `'nome:' || private."FC_TEXTO_BUSCA_RECURSO"(m.edital)`,
    );
    expect(funcao).toMatch(/chave_unica as \([\s\S]*having count\(\*\) = 1/);
  });

  it("sem a fonte, o valor anterior fica; só grava o que mudou", () => {
    for (const coluna of [
      "inscritos = coalesce(n.inscritos, m.inscritos)",
      "aptos_analise = coalesce(n.aptos, m.aptos_analise)",
      "aprovados_analise = coalesce(n.aprovados, m.aprovados_analise)",
      "entrevistados = coalesce(n.entrevistados, m.entrevistados)",
      "contratados = coalesce(n.contratados, m.contratados)",
    ])
      expect(funcao).toContain(coluna);
    expect(funcao).toContain("is distinct from");
    expect(funcao).toContain(
      "where s.id is not null or a.id is not null or e.id is not null or c.id is not null",
    );
    // vagas_total não muda (vem do cadastro do edital).
    expect(funcao).not.toMatch(/vagas_total\s*=/);
  });

  it("a carga da Seleção recalcula, com o lock do pg_cron; o resto do fechamento é o de antes", () => {
    const sync = semComentarios(
      corpo(KPIS, "function public.finalizar_sync_selecao"),
    );
    expect(sync).toContain(
      `if pg_try_advisory_xact_lock(hashtext('agsus_kpis_do_edital_pela_selecao')) then
    v_kpis := private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();`,
    );
    expect(sync).toContain("'kpis', v_kpis");
    const antes = semComentarios(
      corpo(SYNC_ANTERIOR, "function public.finalizar_sync_selecao"),
    );
    for (const trecho of [
      `perform private."FC_LIGAR_SELECAO_AOS_EDITAIS"();`,
      `v_sync."QT_LINHA" * 2 < v_ativas`,
      `"TP_SITUACAO" = 'CONCLUIDA'`,
    ]) {
      expect(antes).toContain(trecho);
      expect(sync).toContain(trecho);
    }
  });

  it("security definer, search_path vazio, sem acesso direto; recalcula ao aplicar", () => {
    expect(KPIS).toMatch(
      /create or replace function private\."FC_ATUALIZAR_KPIS_PELA_SELECAO"\(\)\nreturns integer\nlanguage plpgsql\nsecurity definer\nset search_path to ''/,
    );
    expect(KPIS).toContain(
      `revoke all on function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"() from public, anon, authenticated;`,
    );
    expect(KPIS.trim().startsWith("/*")).toBe(true);
    expect(semComentarios(KPIS).trim()).toMatch(/^begin;[\s\S]*commit;$/);
    expect(KPIS).toContain(
      `select private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();\n\ncommit;`,
    );
  });

  it("o rollback devolve as duas funções de antes", () => {
    expect(KPIS_ROLLBACK).toContain(
      semComentarios(
        corpo(ANTERIOR, 'private."FC_ATUALIZAR_KPIS_PELA_SELECAO"()'),
      )
        .trim()
        .split("\n")[3],
    );
    expect(KPIS_ROLLBACK).toContain("m.id in (select id from sel)");
    expect(KPIS_ROLLBACK).not.toContain("v_kpis");
    expect(KPIS_ROLLBACK).toMatch(/^-- Desfaz 20261002130000/);
    expect(KPIS_ROLLBACK.trim()).toMatch(/begin;[\s\S]*commit;$/);
  });

  it("o ensaio roda a migration inteira e desfaz, com antes × depois por área", () => {
    const ensaio = semComentarios(KPIS_ENSAIO).trim();
    expect(ensaio.startsWith("begin;")).toBe(true);
    expect(ensaio.endsWith("rollback;")).toBe(true);
    expect(ensaio).not.toMatch(/\bcommit;/);
    expect(KPIS_ENSAIO).toContain(
      corpo(KPIS, 'private."FC_ATUALIZAR_KPIS_PELA_SELECAO"()'),
    );
    expect(KPIS_ENSAIO).toContain(
      corpo(KPIS, "function public.finalizar_sync_selecao"),
    );
    for (const coluna of [
      "vagas_imediatas",
      "contratadas",
      "em_selecao",
      "ociosas",
      "cadastro_reserva",
      "contratados_coluna",
      "vagas_ociosas_coluna",
    ])
      expect(KPIS_ENSAIO).toContain(`as ${coluna}`);
  });
});

describe("20261002131000: acompanhamento da Visão geral", () => {
  const funcao = semComentarios(
    corpo(ACOMP, "public.listar_acompanhamento_da_visao_geral"),
  );

  it("recurso da Visão geral, área do usuário e recorte da coordenação", () => {
    expect(funcao).toContain("if not private.pode_recurso('dashboard') then");
    expect(funcao).toContain(
      `if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then`,
    );
    expect(funcao).toContain(`private."FC_EDITAIS_VISIVEIS"()`);
    expect(funcao).toContain("where m.ativo");
    expect(funcao).toMatch(/errcode = '42501'/);
  });

  it("devolve etapas e contagens das listas vigentes, sem nome de candidato", () => {
    for (const campo of [
      "'etapas'",
      "'listas'",
      "'monitoramento_id'",
      "'atividade'",
      "'data_inicio'",
      "'data_fim'",
      "'aprovados'",
      "'com_status'",
      "'contratados'",
      "'desistentes'",
    ])
      expect(funcao).toContain(campo);
    expect(funcao).toContain("l.vigente is true");
    expect(funcao).toContain("c.status = 'Desistente'");
    expect(funcao).not.toMatch(/\bnome\b|\bcpf\b|\bemail\b/i);
  });

  it("só leitura, segura e exposta só a quem entra; rollback e ensaio", () => {
    expect(ACOMP).toMatch(
      /returns jsonb\nlanguage plpgsql\nstable\nsecurity definer\nset search_path to ''/,
    );
    expect(funcao).not.toMatch(/\b(insert|update|delete)\b/i);
    expect(ACOMP).toContain(
      "revoke all on function public.listar_acompanhamento_da_visao_geral(text) from public, anon;",
    );
    expect(ACOMP_ROLLBACK).toContain(
      "drop function if exists public.listar_acompanhamento_da_visao_geral(text);",
    );
    const ensaio = semComentarios(ACOMP_ENSAIO).trim();
    expect(ensaio.startsWith("begin;")).toBe(true);
    expect(ensaio.endsWith("rollback;")).toBe(true);
  });

  it("está no contrato de RPC, com o argumento da área", () => {
    expect(CONTRATO_RPC.listar_acompanhamento_da_visao_geral).toMatchObject({
      argumentos: ["p_area"],
      critica: false,
    });
  });
});
