/*
  ROLLBACK de 20261110215930_fundamento_conferido_da_eliminacao.sql

  Volta ao retrato de 10/11/2026:
    - public.conferir_eliminados_pre_classificacao volta ao corpo de antes, letra por
      letra (copiado de supabase/esquema-atual.sql; o teste confere), com o comentário
      de antes: os candidatos deixam de trazer "fundamento" e o comunicado sai sem
      item do edital, como antes;
    - saem obter_fundamentos_da_eliminacao, conferir_fundamento_da_eliminacao,
      FC_FUNDAMENTO_DA_ELIMINACAO, o gatilho, FC_TG_FUNDAMENTO_IMUTAVEL e a tabela
      TH_FUNDAMENTO_ELIMINACAO.

  Guarda: não roda se a migration não foi aplicada. Com conferências gravadas, o
  rollback apagaria um registro de auditoria: só roda se quem opera o banco exportar
  antes as linhas de TH_FUNDAMENTO_ELIMINACAO e ligar, na mesma sessão,
    set agsus.descartar_fundamentos_exportados = 'sim';
  Nada em TB_PRE_CLASSIFICACAO, nas regras ou nas listas muda (a migration não os tocou).
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if to_regclass('public."TH_FUNDAMENTO_ELIMINACAO"') is null then
    raise exception 'A migration 20261110215930 não está aplicada (TH_FUNDAMENTO_ELIMINACAO não existe).';
  end if;
  if exists (select 1 from public."TH_FUNDAMENTO_ELIMINACAO")
     and coalesce(current_setting('agsus.descartar_fundamentos_exportados', true), '') <> 'sim' then
    raise exception 'Há conferências de fundamento gravadas (auditoria). Exporte TH_FUNDAMENTO_ELIMINACAO e ligue agsus.descartar_fundamentos_exportados = ''sim'' antes do rollback.';
  end if;
end;
$$;

-- 1. A conferência dos eliminados volta ao corpo de antes ----------------------------------------
CREATE OR REPLACE FUNCTION public.conferir_eliminados_pre_classificacao(p_edital uuid, p_chaves text[]) RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
begin
  if cardinality(p_chaves) > 10000 then
    raise exception 'No máximo 10.000 por vez.' using errcode = '22023';
  end if;
  return (
    with pedidas as (
      select split_part(k, '|', 1) as vaga, split_part(k, '|', 2) as codigo
        from unnest(coalesce(p_chaves, '{}')) k
    ),
    linhas as (
      select a."CO_VAGA"::text as vaga, c."CO_CANDIDATO_EMPREGARE"::text as codigo, c."NO_CANDIDATO" as nome,
             a."TP_SITUACAO" as situacao, a."DS_MOTIVO_ELIMINACAO" as motivo, a."CO_MOTIVO_ELIMINACAO" as motivo_codigo,
             a."NO_MODALIDADE" as modalidade, a."VL_ART" as art, a."VL_NOTA_DECLARADA" as declarada,
             a."VL_NOTA_ORDEM" as nota, a."TP_ORIGEM_NOTA" as origem_nota
        from pedidas p
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_VAGA" = p.vaga and c."CO_CANDIDATO_EMPREGARE"::text = p.codigo
        join public."TB_PRE_CLASSIFICACAO" a
          on a."CO_MONITORAMENTO" = p_edital and a."CO_EMPREGARE_CANDIDATO" = c."CO_EMPREGARE_CANDIDATO"
    )
    select json_build_object(
      'schema_version', 1,
      'edital', p_edital,
      'candidatos', coalesce((select json_agg(row_to_json(l)) from linhas l), '[]'::json),
      'vagas', coalesce((
        select json_agg(json_build_object('codigo', pv."CO_VAGA", 'cargo', pv."NO_CARGO"))
          from public."TB_PRE_CLASSIF_VAGA" pv
         where pv."CO_MONITORAMENTO" = p_edital and pv."CO_VAGA" in (select distinct l.vaga from linhas l)), '[]'::json)));
end;
$$;

COMMENT ON FUNCTION public.conferir_eliminados_pre_classificacao(p_edital uuid, p_chaves text[]) IS 'Comunicados de eliminação: a situação de agora só dos marcados (chaves vaga|código) e o cargo das vagas deles, em vez de reler a pré-classificação inteira. Coordenação do edital.';

-- 2. Saem as funções e a tabela -------------------------------------------------------------------
drop function public.obter_fundamentos_da_eliminacao(uuid);
drop function public.conferir_fundamento_da_eliminacao(uuid, text, integer, text, text, text);
drop function private."FC_FUNDAMENTO_DA_ELIMINACAO"(uuid, text);
drop trigger "TG_THFUNDELIM_IMUTAVEL" on public."TH_FUNDAMENTO_ELIMINACAO";
drop function private."FC_TG_FUNDAMENTO_IMUTAVEL"();
drop table public."TH_FUNDAMENTO_ELIMINACAO";

commit;
