import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  20261022200000_funil_do_edital_de_uma_fonte_so.sql, lida como texto (o banco
  não é consultado): o funil do edital (inscritos, aptos, cancelados,
  eliminados, reprovados) de UMA fonte por edital, a regra única da entrevista
  vigente, sem a linha da planilha ao lado da do sistema, e as travas da
  Seleção. Com rollback, ensaio (begin…rollback) e a correção de dados.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const semComentarios = (sql) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
const NOME = "20261022200000_funil_do_edital_de_uma_fonte_so.sql";
const SQL = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const CORRECAO = ler(
  "supabase/correcoes/20261022-entrevistas-repetidas-planilha-e-sistema.sql",
);
const ENSAIO_CORRECAO = ler(
  "supabase/ensaios/20261022-entrevistas-repetidas-planilha-e-sistema.sql",
);

function corpo(sql, nome) {
  const inicio = sql.indexOf(nome);
  const abre = sql.indexOf("$function$", inicio);
  const fecha = sql.indexOf("$function$;", abre + 10);
  return semComentarios(sql.slice(abre, fecha));
}

describe("20261022200000: funil do edital de uma fonte só", () => {
  const kpis = corpo(
    SQL,
    'private."FC_ATUALIZAR_KPIS_PELA_SELECAO"()\nreturns',
  );

  it("transação, pré-requisitos e search_path vazio nas funções", () => {
    expect(SQL).toMatch(/\nbegin;\n/);
    expect(SQL.trimEnd().endsWith("commit;")).toBe(true);
    const definer = SQL.match(/security definer/gi) || [];
    const vazios = SQL.match(/set search_path to ''/gi) || [];
    expect(vazios.length).toBeGreaterThanOrEqual(definer.length);
  });

  it("ordem das fontes: avaliação documental nativa, Seleção coerente, análises", () => {
    expect(kpis).toContain('from public."TB_PRE_CLASSIF_VAGA" pv');
    expect(kpis).toContain('pv."QT_LOTE" + pv."QT_ACIMA_CORTE"');
    expect(kpis).toContain('from public."TH_INSCRICAO_VAGA_EDITAL" t');
    expect(kpis).toContain(
      `having sum(coalesce(s."QT_APTO_ANALISE", 0)) <= sum(coalesce(s."QT_INSCRITO", 0))`,
    );
    expect(kpis).toMatch(
      /when p\.id is not null or r\.id is not null then 'AVALIACAO_DOCUMENTAL'\s+when s\.id is not null then 'SELECAO'\s+when a\.id is not null then 'ANALISES'/,
    );
  });

  it("nunca mistura campo novo com velho: com fonte, sem coalesce com o valor antigo", () => {
    for (const campo of [
      "inscritos",
      "aptos_analise",
      "cancelados",
      "eliminados_nota",
      "total_eliminados",
      "reprovados_analise",
    ])
      expect(kpis).not.toMatch(
        new RegExp(`coalesce\\(n\\.[a-z_]+, m\\.${campo}\\)`),
      );
    expect(kpis).toContain(
      "case when n.fonte is null then m.inscritos else n.inscritos end inscritos",
    );
    // O "piso" saiu: inscritos das análises não existe mais.
    expect(kpis).not.toContain("coalesce(s.inscritos, a.candidatos)");
    expect(kpis).toContain("when 'ANALISES' then a.candidatos end aptos");
  });

  it("editais nativos pelo id (fichas) e entrevistados = pessoas que compareceram", () => {
    expect(kpis).toContain('from public."TB_FICHA_ANALISE" f');
    expect(kpis).toContain(`o."TP_ORIGEM" = 'MONITORA'`);
    expect(kpis).toContain('private."FC_ENTREVISTAS_VIGENTES"(null)');
    expect(kpis).toContain(`e."ST_COMPARECEU" = 'S'`);
    expect(kpis).toContain('"TP_FONTE_FUNIL" = f.fonte');
  });

  it("aptos <= inscritos só depois do recálculo e só se tudo passa", () => {
    const recalculo = SQL.indexOf(
      'select private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();',
    );
    const restricao = SQL.indexOf(
      'add constraint "CK_MONIT_INDIG_APTOS_INSCRITOS"',
    );
    expect(recalculo).toBeGreaterThan(0);
    expect(restricao).toBeGreaterThan(recalculo);
    expect(SQL).toContain("m.ativo is true and m.aptos_analise > m.inscritos");
    expect(SQL).toContain("alter column inscritos drop not null");
  });

  it("entrevista vigente: parecer, nota, sistema, mais recente, maior id", () => {
    const vigentes = SQL.slice(
      SQL.indexOf(
        'create or replace function private."FC_ENTREVISTAS_VIGENTES"',
      ),
      SQL.indexOf('comment on function private."FC_ENTREVISTAS_VIGENTES"'),
    );
    expect(vigentes).toMatch(
      /\(e\."TP_PARECER" in \('APTO', 'INAPTO'\)\) desc,\s+\(e\."VL_NOTA_TOTAL" is not null\) desc,\s+\(e\."TP_ORIGEM" = 'sistema'\) desc,\s+e\."DT_ATUALIZACAO" desc,\s+e\."CO_ENTREVISTA" desc/,
    );
  });

  it("a linha da planilha sai ao convocar e ao fechar a carga; a do sistema nunca", () => {
    const desativar = corpo(
      SQL,
      'private."FC_DESATIVAR_ENTREVISTAS_REPETIDAS"(p_area text',
    );
    expect(desativar).toContain(`e."TP_ORIGEM" = 'planilha'`);
    expect(desativar).toContain(`x."TP_ORIGEM" = 'sistema'`);
    expect(desativar).toContain("'repetida'");
    expect(corpo(SQL, "public.convocar_para_entrevista(")).toContain(
      'perform private."FC_DESATIVAR_ENTREVISTAS_REPETIDAS"(v_area, p_edital, (select auth.uid()))',
    );
    const fechar = corpo(SQL, "public.finalizar_sync_entrevistas(");
    expect(fechar).toContain(
      'private."FC_DESATIVAR_ENTREVISTAS_REPETIDAS"(p_area, null, null)',
    );
    // Edital ativo antes da mesma unidade, e o limite de 30 s continua.
    expect(fechar).toContain(
      "m.ativo desc nulls last, (m.uni = ent.uni) desc nulls last",
    );
    expect(SQL).toMatch(
      /finalizar_sync_entrevistas[\s\S]*?set statement_timeout = '30s'/,
    );
  });

  it("pacote do painel: só a vigente e sem edital inativo", () => {
    const pacote = corpo(
      SQL,
      'private."FC_MONTAR_ENTREVISTAS_AREA"(p_area text',
    );
    expect(pacote).toContain('private."FC_ENTREVISTAS_VIGENTES"(p_area)');
    expect(pacote).toContain('where m.id = e."CO_MONITORAMENTO" and m.ativo');
    expect(pacote).toContain("'origem', e.\"TP_ORIGEM\"");
  });

  it("Seleção: #2 também pelo código, convocados vigentes e edital ativo primeiro", () => {
    const selecao = corpo(SQL, "public.get_selecao_da_area(");
    expect(selecao).toMatch(
      /left join aprovados ap\s+on ap\.edital_id = s\."CO_MONITORAMENTO"::text and ap\.vaga = s\."CO_VAGA"\s+and s\."DS_CHAVE_ORIGEM" !~ '#\[0-9\]\+\$'/,
    );
    expect(selecao).toContain('private."FC_ENTREVISTAS_VIGENTES"(p_area)');
    const ligar = corpo(
      SQL,
      'private."FC_LIGAR_SELECAO_AOS_EDITAIS"()\nreturns',
    );
    expect(ligar).toMatch(
      /order by m\.ativo desc,\s+\(m\.unidade = c\.unidade\) desc/,
    );
  });

  it("rollback volta as funções e o NOT NULL; ensaio termina em rollback", () => {
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_ENTREVISTAS_VIGENTES"(text);',
    );
    expect(ROLLBACK).toContain("alter column inscritos set not null");
    expect(ROLLBACK).toContain("coalesce(n.inscritos, m.inscritos)");
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\ncommit;/);
    expect(ENSAIO).toContain("CK_MONIT_INDIG_APTOS_INSCRITOS");
    expect(ENSAIO).toContain("v_qt < 8000");
  });

  it("correção assinada pela conta do setor, com ensaio em rollback", () => {
    expect(CORRECAO).toContain("a01afddb-f64b-47d9-80e8-476a1ed14e43");
    expect(CORRECAO).toContain("NÃO RODAR SEM AUTORIZAÇÃO");
    expect(ENSAIO_CORRECAO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO_CORRECAO).toContain(
      "alguma entrevista do sistema foi desativada",
    );
  });
});
