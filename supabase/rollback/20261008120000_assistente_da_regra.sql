-- ROLLBACK de supabase/migrations/20261008120000_assistente_da_regra.sql
-- Apaga obter_apoio_regra_analise e volta private."FC_REGRA_ANALISE_JSON" e
-- conferir_regra_analise às versões de 20261006100000 (sem a dupla conferência e
-- sem conferir_pede_outra_pessoa). As regras, as versões e as conferências ficam.
-- A tela continua funcionando: sem a RPC nova, o assistente abre sem as perguntas
-- por vaga, sem as regras da área e sem a regra de classificação.
begin;

drop function if exists public.obter_apoio_regra_analise(uuid);

create or replace function private."FC_REGRA_ANALISE_JSON"(p_edital uuid)
returns json
language sql
stable
security definer
set search_path to ''
as $function$
  select json_build_object(
           'versao', r."NU_VERSAO_VIGENTE",
           'situacao', r."TP_SITUACAO",
           'modelo_origem', r."CO_MODELO_ORIGEM",
           'configuracao', v."DS_CONFIGURACAO",
           'hash', v."DS_HASH",
           'atualizado_em', v."DT_CRIACAO",
           'por', coalesce(p.nome, p.email),
           'conferida_em', r."DT_CONFERENCIA",
           'conferida_por', coalesce(pc.nome, pc.email),
           'versoes', coalesce((
             select json_agg(json_build_object(
                      'versao', h."NU_VERSAO", 'em', h."DT_CRIACAO", 'por', coalesce(pu.nome, pu.email),
                      'motivo', h."DS_MOTIVO", 'hash', h."DS_HASH", 'configuracao', h."DS_CONFIGURACAO")
                    order by h."NU_VERSAO" desc)
               from public."TH_REGRA_ANALISE" h
               left join public."TB_PERFIL_USUARIO" pu on pu.user_id = h."CO_USUARIO"
              where h."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE"), '[]'::json))
    from public."TB_REGRA_ANALISE" r
    join public."TH_REGRA_ANALISE" v
      on v."CO_REGRA_ANALISE" = r."CO_REGRA_ANALISE" and v."NU_VERSAO" = r."NU_VERSAO_VIGENTE"
    left join public."TB_PERFIL_USUARIO" p on p.user_id = v."CO_USUARIO"
    left join public."TB_PERFIL_USUARIO" pc on pc.user_id = r."CO_USUARIO_CONFERENCIA"
   where r."CO_MONITORAMENTO" = p_edital;
$function$;
comment on function private."FC_REGRA_ANALISE_JSON"(uuid) is
  'Regra da avaliação vigente do edital (versão, situação, configuração, hash, quem e quando, conferência) e o histórico de versões; null sem regra.';
revoke all on function private."FC_REGRA_ANALISE_JSON"(uuid) from public, anon, authenticated;

create or replace function public.conferir_regra_analise(p_edital uuid, p_versao integer)
returns json
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  v_regra public."TB_REGRA_ANALISE";
begin
  select * into v_regra from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = p_edital for update;
  if v_regra."CO_REGRA_ANALISE" is null then
    raise exception 'O edital ainda não tem regra.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_regra."NU_VERSAO_VIGENTE" then
    raise exception 'A regra mudou (versão %); confira de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = '40001';
  end if;
  if v_regra."TP_SITUACAO" <> 'CONFERIDA' then
    update public."TB_REGRA_ANALISE"
       set "TP_SITUACAO" = 'CONFERIDA', "CO_USUARIO_CONFERENCIA" = (select auth.uid()), "DT_CONFERENCIA" = now(), "DT_ATUALIZACAO" = now()
     where "CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";
  end if;
  return json_build_object('regra', private."FC_REGRA_ANALISE_JSON"(p_edital), 'fichas_afetadas', '[]'::json);
end;
$function$;
comment on function public.conferir_regra_analise(uuid, integer) is
  'Marca a versão vigente da regra como conferida (quem e quando). p_versao tem de ser a vigente (senão 40001). Salvar uma versão nova volta para Conferir. Só a coordenação do edital.';
revoke all on function public.conferir_regra_analise(uuid, integer) from public, anon;
grant execute on function public.conferir_regra_analise(uuid, integer) to authenticated, service_role;

commit;
