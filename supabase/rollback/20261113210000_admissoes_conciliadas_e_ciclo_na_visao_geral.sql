/*
  ROLLBACK de 20261113210000_admissoes_conciliadas_e_ciclo_na_visao_geral: volta listar_acompanhamento_da_visao_geral ao corpo de
  antes, apaga a função de carga e a tabela de admissões. O ciclo continua
  padronizado ("Nº ciclo"): o texto de antes não volta.
*/
begin;

set local lock_timeout = '5s';

do $guarda$
declare
  v_md5 text := md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_acompanhamento_da_visao_geral(text)')), chr(13), ''));
begin
  if v_md5 is distinct from '488c5da46e823a31ebffe55052af7bee' then
    raise exception 'listar_acompanhamento_da_visao_geral não está no corpo da 20261113210000 (md5 %).', v_md5;
  end if;
end;
$guarda$;

create or replace function public.listar_acompanhamento_da_visao_geral(p_area text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
 set statement_timeout to '5s'
as $function$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_editais uuid[];
begin
  if not private.pode_recurso('dashboard') then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
    raise exception 'Sem permissão para esta área' using errcode = '42501';
  end if;

  select coalesce(array_agg(m.id), '{}') into v_editais
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.ativo
     and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
     and m."CO_AREA" = v_area
     and ((select private."FC_EDITAIS_VISIVEIS"()) is null
          or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]));

  return jsonb_build_object(
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', c.monitoramento_id,
               'ordem', c.ordem,
               'atividade', c.atividade,
               'data_inicio', c.data_inicio,
               'data_fim', c.data_fim
             ) order by c.monitoramento_id, c.data_inicio, c.ordem)
        from public."TB_CRONOGRAMA_MONIT_INDIG" c
       where c.monitoramento_id = any (v_editais)
    ), '[]'::jsonb),
    'listas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', r.edital_id,
               'aprovados', r.aprovados,
               'com_status', r.com_status,
               'contratados', r.contratados,
               'desistentes', r.desistentes
             ) order by r.edital_id)
        from (
          select l.edital_id,
                 count(c.id)::integer as aprovados,
                 (count(c.id) filter (where nullif(btrim(c.status), '') is not null))::integer as com_status,
                 (count(c.id) filter (where c.status in ('Contratado', 'Migração') and not private."FC_EM_OUTRA_LISTA"(c.id)))::integer as contratados,
                 (count(c.id) filter (where c.status = 'Desistente'))::integer as desistentes
            from public."TB_LISTA_APROVADO" l
            left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
           where l.vigente is true
             and l.edital_id = any (select unnest(v_editais)::text)
           group by l.edital_id
        ) r
    ), '[]'::jsonb)
  );
end;
$function$;

comment on function public.listar_acompanhamento_da_visao_geral(p_area text) is 'Visão geral de uma área (só leitura): as etapas do cronograma e, por edital com lista de aprovados vigente, as contagens de aprovados, com status, contratados (Contratado/Migração) e desistentes. Recurso dashboard, área do usuário e recorte da coordenação.';

drop function public.carregar_admissoes_conciliadas(text, jsonb);
drop table public."TB_ADMISSAO_CONCILIADA";

select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();

commit;
