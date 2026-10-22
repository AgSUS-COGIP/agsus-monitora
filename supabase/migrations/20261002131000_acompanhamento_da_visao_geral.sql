/*
  Acompanhamento da Visão geral: o cronograma inteiro e o resumo das listas de
  aprovados de cada edital da área, numa leitura só.

  A Visão geral lê as linhas de VW_MONITORAMENTO_INDIGENA_OPERACIONAL, que
  trazem do cronograma só a atividade de hoje e a próxima. Para o "crítico"
  calculado (edital parado: sem mudança de etapa há 15 dias), a agenda
  "Próximos 7 dias" e o bloco "Pós-resultado" (concluídos sem lista vigente,
  lista sem nenhum status, desistências) ela precisa das etapas e das listas.
  listar_etapas_do_cronograma exige o recurso do Núcleo/Calendário, que quem só
  vê a Visão geral não tem; esta função usa o recurso da Visão geral
  (dashboard), o mesmo de get_monitoramento_cronograma, que já mostra o
  cronograma de cada edital na gaveta.

  public.listar_acompanhamento_da_visao_geral(p_area) → jsonb
    {
      "etapas": [{ monitoramento_id, ordem, atividade, data_inicio, data_fim }],
      "listas": [{ monitoramento_id, aprovados, com_status, contratados,
                   desistentes }]   -- só editais com lista vigente
    }
  Recorte: editais ativos da área pedida, que precisa ser do usuário
  (FC_AREAS_USUARIO), e da coordenação dele (FC_EDITAIS_VISIVEIS). Só leitura;
  nenhum nome de candidato sai daqui, só contagens.

  Rollback: supabase/rollback/20261002131000_acompanhamento_da_visao_geral.sql
*/
begin;

create function public.listar_acompanhamento_da_visao_geral(p_area text)
returns jsonb
language plpgsql
stable
security definer
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
                 (count(c.id) filter (where c.status in ('Contratado', 'Migração')))::integer as contratados,
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
comment on function public.listar_acompanhamento_da_visao_geral(text) is
  'Visão geral de uma área (só leitura): as etapas do cronograma e, por edital com lista de aprovados vigente, as contagens de aprovados, com status, contratados (Contratado/Migração) e desistentes. Recurso dashboard, área do usuário e recorte da coordenação.';
revoke all on function public.listar_acompanhamento_da_visao_geral(text) from public, anon;
grant execute on function public.listar_acompanhamento_da_visao_geral(text) to authenticated, service_role;

commit;
