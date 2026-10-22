import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  Migration 20261009200000 (a ficha da Avaliação documental alimenta
  TB_ANALISE_CURRICULAR quando o edital está em MONITORA) e a correção do
  114/2026. Invariantes estáticas: a coluna de origem no padrão MAD, o gatilho
  na ficha, o vocabulário da planilha, a sincronização que ignora o MONITORA, a
  janela do painel, a troca de dono com guarda, o ensaio igual à migration e o
  rollback.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261009200000_fichas_no_painel_das_analises.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const CORRECAO = ler(
  "supabase/correcoes/20261009-edital-114-analise-no-monitora.sql",
);
const corpo = (texto) =>
  texto.slice(texto.indexOf("\nbegin;\n") + 8, texto.lastIndexOf("\ncommit;"));
const trecho = (inicio, fim) =>
  MIGRATION.slice(MIGRATION.indexOf(inicio), MIGRATION.indexOf(fim));
const PUBLICAR = trecho(
  'create function private."FC_PUBLICAR_FICHA_ANALISE"',
  'create function private."FC_TG_PUBLICAR_FICHA_ANALISE"',
);
const DEFINIR = trecho(
  'create function private."FC_DEFINIR_ORIGEM_ANALISE"',
  "create function public.definir_origem_analise",
);
const LOTE = trecho(
  "CREATE OR REPLACE FUNCTION public.processar_sync_analises_lote",
  "CREATE OR REPLACE FUNCTION public.finalizar_sync_analises_lotes",
);
const FIM_LOTES = trecho(
  "CREATE OR REPLACE FUNCTION public.finalizar_sync_analises_lotes",
  "CREATE OR REPLACE FUNCTION public.finalizar_sync_analises_incremental",
);
const FIM_INCREMENTAL = trecho(
  "CREATE OR REPLACE FUNCTION public.finalizar_sync_analises_incremental",
  'CREATE OR REPLACE FUNCTION private."FC_MONTAR_PAINEL_ANALISE"',
);
const AUSENTES = trecho(
  'CREATE OR REPLACE FUNCTION public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"',
  "CREATE OR REPLACE FUNCTION public.processar_sync_analises_lote",
);

describe("migration da ficha no Painel das análises", () => {
  it("a coluna de origem da linha no padrão MAD, com padrão PLANILHA", () => {
    expect(MIGRATION).toContain(
      `add column "TP_ORIGEM_REGISTRO" varchar(10) not null default 'PLANILHA'`,
    );
    expect(MIGRATION).toContain(
      `add constraint "CK_ANALISECURRIC_TPORIGEMREG" check ("TP_ORIGEM_REGISTRO" in ('PLANILHA', 'MONITORA'))`,
    );
    expect(MIGRATION).toContain(
      'comment on column public."TB_ANALISE_CURRICULAR"."TP_ORIGEM_REGISTRO" is',
    );
    expect(MIGRATION).toContain(
      'comment on constraint "CK_ANALISECURRIC_TPORIGEMREG" on public."TB_ANALISE_CURRICULAR"',
    );
  });

  it("o gatilho na ficha publica ao criar e ao mudar o que o painel mostra", () => {
    expect(MIGRATION).toContain(
      'create trigger "TG_FICHAANALISE_PUBLICA_INS" after insert on public."TB_FICHA_ANALISE"',
    );
    expect(MIGRATION).toContain(
      'create trigger "TG_FICHAANALISE_PUBLICA_UPD" after update on public."TB_FICHA_ANALISE"',
    );
    const quando = MIGRATION.slice(
      MIGRATION.indexOf('create trigger "TG_FICHAANALISE_PUBLICA_UPD"'),
      MIGRATION.indexOf(
        "execute function",
        MIGRATION.indexOf('create trigger "TG_FICHAANALISE_PUBLICA_UPD"'),
      ),
    );
    for (const coluna of [
      "TP_SITUACAO",
      "CO_USUARIO_RESPONSAVEL",
      "TP_RESULTADO",
      "VL_NOTA_FINAL",
      "DS_PARECER",
      "DT_CONCLUSAO",
      "CO_VAGA",
    ])
      expect(quando).toContain(`old."${coluna}"`);
    // Renovar a reserva (só DT_RESERVA_EXPIRA) não dispara.
    expect(quando).not.toContain("DT_RESERVA_EXPIRA");
    expect(MIGRATION).toMatch(
      /comment on trigger "TG_FICHAANALISE_PUBLICA_INS"/,
    );
    expect(MIGRATION).toMatch(
      /comment on trigger "TG_FICHAANALISE_PUBLICA_UPD"/,
    );
  });

  it("publica só com o edital em MONITORA, no vocabulário da planilha", () => {
    expect(PUBLICAR).toContain(
      `where o."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and o."TP_ORIGEM" = 'MONITORA'`,
    );
    for (const par of [
      "then 'Aprovado'",
      "then 'Reprovado'",
      "then 'Revisar'",
      "then 'Em análise'",
      "else 'Pendente'",
      "then 'Triados'",
      "when v_status = 'Revisar' then 'Avaliação documental'",
    ])
      expect(PUBLICAR).toContain(par);
    expect(PUBLICAR).toContain("v_f.\"TP_SITUACAO\" <> 'FORA_LOTE'");
    expect(PUBLICAR).toContain(
      "v_chave := 'monitora|' || v_f.\"CO_MONITORAMENTO\" || '|' || v_f.\"CO_EMPREGARE_CANDIDATO\";",
    );
    // A linha da planilha do mesmo edital, vaga e código é adotada (mesmo id).
    expect(PUBLICAR).toContain("btrim(a.id_origem) = v_codigo");
    expect(PUBLICAR).toContain(
      "order by a.\"TP_ORIGEM_REGISTRO\" = 'MONITORA' desc, a.ativo desc",
    );
    expect(PUBLICAR).toContain(`"TP_ORIGEM_REGISTRO" = 'MONITORA'`);
    // Inapto por requisito: parciais 0; experiência em dias (anos de 365, meses de 30).
    expect(PUBLICAR).toContain("when v_inapto_requisito then 0");
    expect(PUBLICAR).toContain("v_dias / 365, (v_dias % 365) / 30");
    // Treinamento continua fora do painel.
    expect(PUBLICAR).toContain(
      `case when private."FC_EH_TREINAMENTO"(v_m."ST_TREINAMENTO") then 'treinamento' end`,
    );
    // Só escreve o que mudou.
    expect(PUBLICAR).toContain("is distinct from");
  });

  it("a sincronização da planilha ignora as linhas e os editais MONITORA", () => {
    expect(LOTE).toContain(
      `public."FC_EDITAL_ANALISE_NO_MONITORA"(v_planilha, public.jsonb_text_or_null(s.payload,'edital'))`,
    );
    expect(LOTE).toContain(`where a."TP_ORIGEM_REGISTRO" = 'MONITORA'`);
    expect(LOTE).toContain(
      `and "TB_ANALISE_CURRICULAR"."TP_ORIGEM_REGISTRO"='PLANILHA';`,
    );
    expect(LOTE).toContain("'ignoradas_monitora',v_monitora");
    expect(FIM_LOTES).toContain(`and a."TP_ORIGEM_REGISTRO"='PLANILHA'`);
    expect(FIM_LOTES).toContain(
      `delete from tmp_editais x where public."FC_EDITAL_ANALISE_NO_MONITORA"(v_planilha, x.edital);`,
    );
    expect(FIM_INCREMENTAL).toContain(
      `delete from tmp_editais_incremental x where public."FC_EDITAL_ANALISE_NO_MONITORA"(v_planilha, x.edital);`,
    );
    expect(FIM_INCREMENTAL).toContain(
      `and a."TP_ORIGEM_REGISTRO" = 'PLANILHA'`,
    );
    for (const f of [FIM_LOTES, FIM_INCREMENTAL])
      expect(f).toContain(
        `and not public."FC_EDITAL_ANALISE_NO_MONITORA"(v_planilha, e.edital)`,
      );
    expect(AUSENTES.match(/"TP_ORIGEM_REGISTRO" = 'PLANILHA'/g)).toHaveLength(
      3,
    );
    // A auxiliar roda com a service_role da sincronização (que não usa o schema private).
    expect(MIGRATION).toContain(
      'grant execute on function public."FC_EDITAL_ANALISE_NO_MONITORA"(text, text) to service_role;',
    );
    expect(MIGRATION).toContain(
      'revoke all on function public."FC_EDITAL_ANALISE_NO_MONITORA"(text, text) from public, anon, authenticated;',
    );
  });

  it("o painel lista o edital MONITORA com a janela da avaliação documental", () => {
    expect(MIGRATION).toContain(
      'create function private."FC_JANELA_AVALIACAO_DOCUMENTAL"(p_edital uuid, out inicio date, out fim date)',
    );
    expect(MIGRATION).toContain(
      'cross join lateral private."FC_JANELA_AVALIACAO_DOCUMENTAL"(m.id) j',
    );
    expect(MIGRATION).toContain(
      `and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")`,
    );
  });

  it("a troca de dono: coordenação, motivo, histórico, guarda e publicação", () => {
    expect(MIGRATION).toContain(
      'perform private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);',
    );
    expect(DEFINIR).toContain("length(v_motivo) not between 10 and 2000");
    expect(DEFINIR).toContain('insert into public."TH_ORIGEM_ANALISE_EDITAL"');
    expect(DEFINIR).toContain(
      "a.status_consolidado in ('Aprovado', 'Reprovado', 'Revisar')",
    );
    expect(DEFINIR).toContain("using errcode = '23514'");
    expect(DEFINIR).toContain(
      'if private."FC_PUBLICAR_FICHA_ANALISE"(v_ficha) is not null then',
    );
    expect(DEFINIR).toContain(`set "TP_ORIGEM_REGISTRO" = 'PLANILHA'`);
    expect(DEFINIR).toContain(
      `private."FC_MARCAR_CACHE"(array['ANALISES'], array[v_m."CO_AREA"], 'TB_ORIGEM_ANALISE_EDITAL')`,
    );
    for (const assinatura of [
      'private."FC_PUBLICAR_FICHA_ANALISE"(uuid) from public, anon, authenticated, service_role;',
      'private."FC_DEFINIR_ORIGEM_ANALISE"(uuid, text, text, uuid) from public, anon, authenticated, service_role;',
      'private."FC_TG_PUBLICAR_FICHA_ANALISE"() from public, anon, authenticated, service_role;',
      'private."FC_JANELA_AVALIACAO_DOCUMENTAL"(uuid) from public, anon, authenticated, service_role;',
    ])
      expect(MIGRATION).toContain(`revoke all on function ${assinatura}`);
    expect(MIGRATION).toContain(
      "grant execute on function public.definir_origem_analise(uuid, text, text) to authenticated;",
    );
    expect(CONTRATO_RPC.definir_origem_analise.argumentos).toEqual([
      "p_edital",
      "p_origem",
      "p_motivo",
    ]);
  });

  it("preenche as fichas que já existem dos editais em MONITORA", () => {
    const preenchimento = MIGRATION.slice(
      MIGRATION.indexOf("-- 8. Preenchimento"),
    );
    expect(preenchimento).toContain(
      `join public."TB_ORIGEM_ANALISE_EDITAL" o on o."CO_MONITORAMENTO" = f."CO_MONITORAMENTO" and o."TP_ORIGEM" = 'MONITORA'`,
    );
    expect(preenchimento).toContain(
      'private."FC_PUBLICAR_FICHA_ANALISE"(v_ficha)',
    );
    expect(MIGRATION).not.toMatch(/disable\s+trigger/i);
    expect(MIGRATION).not.toMatch(
      /\bdelete\s+from\s+public\."(TB_ANALISE_CURRICULAR|TB_FICHA_ANALISE|TB_ORIGEM_ANALISE_EDITAL)"/i,
    );
  });

  it("o ensaio aplica o mesmo corpo e termina em rollback", () => {
    const a = "-- ===== corpo da migration (sem begin/commit) =====\n";
    const b = "\n-- ===== fim do corpo =====";
    expect(ENSAIO.slice(ENSAIO.indexOf(a) + a.length, ENSAIO.indexOf(b))).toBe(
      corpo(MIGRATION),
    );
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
  });

  it("o rollback recusa com linhas publicadas fora do treinamento e desfaz o resto", () => {
    expect(ROLLBACK).toContain(
      `where a."TP_ORIGEM_REGISTRO" = 'MONITORA'\n                and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)) then`,
    );
    for (const objeto of [
      'drop trigger if exists "TG_FICHAANALISE_PUBLICA_INS" on public."TB_FICHA_ANALISE";',
      'drop trigger if exists "TG_FICHAANALISE_PUBLICA_UPD" on public."TB_FICHA_ANALISE";',
      "drop function if exists public.definir_origem_analise(uuid, text, text);",
      'drop function if exists private."FC_PUBLICAR_FICHA_ANALISE"(uuid);',
      'drop function if exists public."FC_EDITAL_ANALISE_NO_MONITORA"(text, text);',
      'drop column if exists "TP_ORIGEM_REGISTRO";',
    ])
      expect(ROLLBACK).toContain(objeto);
    // A sincronização volta à definição de antes (sem o MONITORA).
    expect(ROLLBACK).toContain(
      "CREATE OR REPLACE FUNCTION public.processar_sync_analises_lote",
    );
    expect(ROLLBACK).not.toContain('FC_EDITAL_ANALISE_NO_MONITORA"(v_planilha');
    expect(ROLLBACK).not.toContain("TP_ORIGEM_REGISTRO\"='PLANILHA'");
  });

  it("a correção do 114/2026 troca o dono pela função, pelo id e pelo número", () => {
    expect(CORRECAO).toContain(
      "c_edital constant uuid := 'bcecfb08-88ef-4e06-8401-bcad6bf88fd0';",
    );
    expect(CORRECAO).toContain(
      "private.\"FC_NUMERO_EDITAL\"(m.edital) = '114/2026'",
    );
    expect(CORRECAO).toContain("m.\"CO_AREA\" = 'projetos'");
    expect(CORRECAO).toContain(
      "private.\"FC_DEFINIR_ORIGEM_ANALISE\"(c_edital, 'MONITORA', c_motivo, v_autor)",
    );
    expect(CORRECAO).not.toMatch(/\bdelete\s+from\b/i);
  });
});
