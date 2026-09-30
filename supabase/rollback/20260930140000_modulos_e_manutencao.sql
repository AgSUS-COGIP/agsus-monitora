-- Desfaz Módulos e abas: funções, histórico, situação do sistema e as colunas novas.
-- (A situação gravada nas colunas se perde; ST_ATIVO de abas/áreas-das-abas continua.)
begin;

drop function if exists public.salvar_situacao_modulos(jsonb, text);
drop function if exists public.obter_modulos_e_abas();
drop function if exists public.obter_situacao_do_sistema();

CREATE OR REPLACE FUNCTION public.listar_abas_do_menu()
 RETURNS json
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce(json_agg(json_build_object(
      'co_aba', a."CO_ABA",
      'no_aba', a."NO_ABA",
      'ds_icone', a."DS_ICONE",
      'nu_ordem', a."NU_ORDEM",
      'co_view', a."CO_VIEW",
      'co_recurso', a."CO_RECURSO",
      'tp_aba', a."TP_ABA",
      'areas', coalesce((
        select json_agg(json_build_object(
            'co_area', r."CO_AREA",
            'nu_ordem', coalesce(r."NU_ORDEM", a."NU_ORDEM"),
            'co_view', coalesce(r."CO_VIEW", a."CO_VIEW"),
            'ds_icone', coalesce(r."DS_ICONE", a."DS_ICONE")
          ) order by ar."NU_ORDEM", r."CO_AREA")
        from public."RL_ABA_AREA" r
        join public."TB_AREA" ar on ar."CO_AREA" = r."CO_AREA"
        where r."CO_ABA" = a."CO_ABA"
          and r."ST_ATIVO" = 'S'
      ), '[]'::json)
    ) order by a."NU_ORDEM", a."CO_ABA"), '[]'::json)
  from public."TB_ABA" a
  where a."ST_ATIVO" = 'S';
$function$;

drop table if exists public."TH_SITUACAO_MODULO";
drop table if exists public."TB_SITUACAO_SISTEMA";

alter table public."RL_ABA_AREA"
  drop constraint if exists "CK_ABAAREA_TPSITUACAO", drop constraint if exists "CK_ABAAREA_MENSAGEM",
  drop column if exists "TP_SITUACAO", drop column if exists "DS_MENSAGEM_MANUTENCAO", drop column if exists "DT_PREVISAO_RETORNO";
alter table public."TB_ABA"
  drop constraint if exists "CK_ABA_TPSITUACAO", drop constraint if exists "CK_ABA_MENSAGEM", drop constraint if exists "CK_ABA_STBETA",
  drop column if exists "TP_SITUACAO", drop column if exists "DS_MENSAGEM_MANUTENCAO", drop column if exists "DT_PREVISAO_RETORNO", drop column if exists "ST_BETA";
alter table public."TB_AREA"
  drop constraint if exists "CK_AREA_STATIVO", drop constraint if exists "CK_AREA_TPSITUACAO", drop constraint if exists "CK_AREA_MENSAGEM",
  drop column if exists "ST_ATIVO", drop column if exists "TP_SITUACAO", drop column if exists "DS_MENSAGEM_MANUTENCAO", drop column if exists "DT_PREVISAO_RETORNO";

commit;
