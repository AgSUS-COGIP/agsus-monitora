import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration 20261013110000: o lote pode ser refeito do zero com fichas abertas
  desde que TODAS estejam intocadas (o 114/2026 refaz em 13, 14 e 15/10).
  Invariantes estáticas: a ação REFAZER_LOTE no histórico, a regra "ficha
  iniciada" num lugar só (FC_FICHA_INICIADA), a gravação, o gatilho e a
  leitura dos editais usando essa regra, cada função recriada mudando só o
  trecho do refazer (o resto é a definição de antes, guardada no rollback), o
  ensaio com o mesmo corpo e o job/workflow com a recusa clara.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261013110000_refazer_lote_com_fichas_intocadas.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const JOB = ler("scripts/pre_classificacao/pre_classificacao.py");
const WORKFLOW = ler(".github/workflows/pre-classificacao.yml");

const funcao = (texto, nome) => {
  const inicio = texto.toLowerCase().indexOf(`function ${nome}(`.toLowerCase());
  expect(inicio, nome).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};
const desfaz = (texto, trocas) =>
  trocas.reduce((t, [novo, velho]) => {
    expect(t, novo.slice(0, 60)).toContain(novo);
    return t.replace(novo, velho);
  }, texto);

describe("refazer o lote com as fichas intocadas", () => {
  it("histórico ganha REFAZER_LOTE (com motivo) e a migration fecha em commit", () => {
    expect(MIGRATION).toMatch(
      /"CK_THFICHA_TPACAO" check \("TP_ACAO" in \([^)]*'REINICIAR',\s*'REFAZER_LOTE'\)\)/,
    );
    expect(MIGRATION).toMatch(
      /"TP_ACAO" not in \([^)]*'REINICIAR', 'REFAZER_LOTE'\)\n\s+or length\(btrim\(coalesce\("DS_MOTIVO", ''\)\)\) between 10 and 2000/,
    );
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain("set local lock_timeout = '10s';");
  });

  it("ficha iniciada: situação, conteúdo, atribuição, reserva e histórico além do lote", () => {
    const f = funcao(MIGRATION, 'private."FC_FICHA_INICIADA"');
    expect(f).toContain(`p_f."TP_SITUACAO" not in ('PENDENTE', 'FORA_LOTE')`);
    for (const coluna of [
      "CO_USUARIO_RESPONSAVEL",
      "DT_ATRIBUICAO",
      "CO_USUARIO_RESERVA",
      "DS_LANCAMENTO",
      "DS_RESULTADO",
      "DS_PARECER",
      "TP_RESULTADO",
      "VL_NOTA_APURADA",
      "VL_NOTA_FINAL",
      "CO_USUARIO_RASCUNHO",
      "CO_USUARIO_CONCLUSAO",
    ])
      expect(f).toContain(`p_f."${coluna}" is not null`);
    expect(f).toContain(
      `h."TP_ACAO" not in ('CRIAR', 'SAIR_LOTE', 'VOLTAR_LOTE', 'REFAZER_LOTE')`,
    );
    for (const nova of [
      'private."FC_FICHA_INICIADA"(public."TB_FICHA_ANALISE")',
      'private."FC_FICHAS_INICIADAS"(uuid)',
      'private."FC_LOTE_REFEITO_EM"(text)',
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function ${nova} from public, anon, authenticated, service_role;`,
      );
      expect(MIGRATION).toContain(`comment on function ${nova} is`);
    }
  });

  it("gravação recusa o refazer com ficha iniciada; o resto é a definição de antes", () => {
    const nova = funcao(MIGRATION, "public.gravar_pre_classificacao_vaga");
    expect(nova).toContain(
      "raise exception 'Lote não refeito: o lote já está em análise: % fichas iniciadas', v_iniciadas",
    );
    expect(nova).toContain(
      "perform pg_advisory_xact_lock(hashtextextended('avaliacao-documental:fichas:' || p_edital::text, 0));",
    );
    const inicio = nova.indexOf("  -- Refazer o lote do zero só com TODAS");
    const fim =
      nova.indexOf("  end if;\n  end if;\n", inicio) +
      "  end if;\n  end if;\n".length;
    const desfeita = nova.slice(0, inicio) + nova.slice(fim);
    expect(desfeita.replace("  v_iniciadas integer;\n", "")).toBe(
      funcao(ROLLBACK, "public.gravar_pre_classificacao_vaga"),
    );
  });

  it("gatilho: na execução que refaz, sai só quem tem ficha intocada", () => {
    const nova = funcao(MIGRATION, 'private."FC_TG_LOTE_COM_FICHA"');
    expect(nova).toContain('and (private."FC_FICHA_INICIADA"(f)');
    expect(nova).toContain(`and t."ST_REFAZER_LOTE" = 'S'`);
    expect(nova).not.toContain("refazer o lote só antes das fichas");
  });

  it("leitura dos editais: refazer_permitido exige 0 fichas iniciadas", () => {
    const nova = funcao(MIGRATION, "public.pre_classificacao_ler_editais");
    expect(nova).toContain("'fichas_iniciadas', fi.n,");
    expect(nova).toContain("'refazer_permitido', fi.n = 0");
    expect(nova).toContain(
      'cross join lateral (select private."FC_FICHAS_INICIADAS"(m.id) as n) fi',
    );
  });

  it("abertura das fichas: FORA_LOTE com 'Lote refeito em dd/mm' e REFAZER_LOTE", () => {
    const nova = funcao(MIGRATION, 'private."FC_ABRIR_FICHAS"');
    expect(nova).toContain("then 'Lote refeito em ' || r.refeito_em");
    expect(nova).toContain("then 'REFAZER_LOTE' else 'SAIR_LOTE' end as acao");
    expect(nova).toContain(
      'perform private."FC_HISTORICO_FICHA"(v_item.ficha, v_item.acao,',
    );
    expect(nova).toContain(
      "coalesce('Entrou no lote refeito em ' || r.refeito_em,",
    );
    expect(nova).toContain(
      "coalesce('Voltou ao lote refeito em ' || r.refeito_em,",
    );
    // Nada se apaga: nenhuma linha de DELETE nas fichas.
    expect(MIGRATION).not.toMatch(
      /delete\s+from\s+public\."TB_FICHA_ANALISE"/i,
    );
  });

  it("rollback: recusa se já houve lote refeito, volta as funções e a checagem", () => {
    expect(ROLLBACK).toContain(
      `if exists (select 1 from public."TH_FICHA_ANALISE" where "TP_ACAO" = 'REFAZER_LOTE') then`,
    );
    for (const nova of [
      'private."FC_FICHAS_INICIADAS"(uuid)',
      'private."FC_FICHA_INICIADA"(public."TB_FICHA_ANALISE")',
      'private."FC_LOTE_REFEITO_EM"(text)',
    ])
      expect(ROLLBACK).toContain(`drop function if exists ${nova};`);
    expect(ROLLBACK).not.toMatch(/'REFAZER_LOTE'\)\)/);
    for (const nome of [
      "public.pre_classificacao_ler_editais",
      'private."FC_TG_LOTE_COM_FICHA"',
      'private."FC_ABRIR_FICHAS"',
    ])
      expect(funcao(ROLLBACK, nome)).not.toContain("FICHA_INICIADA");
    expect(funcao(ROLLBACK, 'private."FC_ABRIR_FICHAS"')).not.toContain(
      "REFAZER_LOTE",
    );
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("ensaio usa o corpo da migration e termina em rollback", () => {
    const corpo = MIGRATION.slice(
      MIGRATION.indexOf("begin;\n") + "begin;\n".length,
      MIGRATION.lastIndexOf("commit;"),
    ).trim();
    const noEnsaio = ENSAIO.slice(
      ENSAIO.indexOf("═══ CORPO DA MIGRATION (início) ═══\n") +
        "═══ CORPO DA MIGRATION (início) ═══\n".length,
      ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (fim) ═══"),
    ).trim();
    expect(noEnsaio).toBe(corpo);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    for (const e of [
      "E1_antes",
      "E2_refazer",
      "E3_analise_curricular",
      "E4_recusa",
    ])
      expect(ENSAIO).toContain(e);
  });

  it("job e workflow: recusa clara e o modo refazer_lote com as fichas intocadas", () => {
    expect(JOB).toContain(
      'f"lote não refeito: o lote já está em análise: {iniciadas} fichas iniciadas"',
    );
    expect(JOB).toContain('edital.get("fichas_iniciadas")');
    expect(JOB).not.toContain("REFAZER_RECUSADO");
    expect(WORKFLOW).toContain(
      "refazer_lote = recorta o lote do zero (só com todas as fichas do edital intocadas)",
    );
    expect(WORKFLOW).toContain(
      "20261013110000_refazer_lote_com_fichas_intocadas.sql",
    );
  });
});
