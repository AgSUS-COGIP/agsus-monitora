/*
  Rollback de 20261021100000_medalhas_do_dia: volta public.obter_ritmo_da_analise
  à definição de 20261019170000 (sem o campo "destaques", conferida com
  pg_get_functiondef em 21/10/2026) e tira o índice parcial das reaberturas.
  O front sem "destaques" só não mostra o bloco "Destaques de hoje" (o resto
  do card segue igual).
*/

create or replace function public.obter_ritmo_da_analise(p_area text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
set statement_timeout to '5s'
as $function$
declare
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_visiveis uuid[];
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_desde timestamptz;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Sessão necessária.';
  end if;
  if not private.pode_recurso('analises') then
    raise exception using errcode = '42501', message = 'Sem permissão para este recurso';
  end if;
  -- Área válida (22023) e da pessoa ou admin (42501), antes de qualquer leitura.
  perform private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);
  v_visiveis := private."FC_EDITAIS_VISIVEIS"();
  v_desde := ((v_hoje - 14)::timestamp at time zone 'America/Sao_Paulo');

  return jsonb_build_object(
    'gerado_em', now(),
    'editais', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'edital', m.edital,
               'situacoes', s.situacoes,
               'por_dia', coalesce((
                 select jsonb_agg(jsonb_build_object('dia', d.dia, 'qt', d.qt) order by d.dia)
                   from (select (f."DT_CONCLUSAO" at time zone 'America/Sao_Paulo')::date as dia,
                                count(*) as qt
                           from public."TB_FICHA_ANALISE" f
                          where f."CO_MONITORAMENTO" = m.id
                            and f."TP_SITUACAO" = 'CONCLUIDA'
                            and f."DT_CONCLUSAO" >= v_desde
                          group by 1) d), '[]'::jsonb),
               'qt_equipe', (
                 select count(distinct a."CO_USUARIO")
                   from public."RL_ANALISTA_EDITAL" a
                  where a."CO_MONITORAMENTO" = m.id
                    and a."ST_ATIVO" = 'S'
                    and a."TP_PAPEL" = 'ANALISTA'),
               'qt_avaliadores_recentes', (
                 select count(distinct f."CO_USUARIO_CONCLUSAO")
                   from public."TB_FICHA_ANALISE" f
                  where f."CO_MONITORAMENTO" = m.id
                    and f."TP_SITUACAO" = 'CONCLUIDA'
                    and f."DT_CONCLUSAO" >= now() - interval '7 days'),
               'cronograma', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'ordem', c.ordem, 'atividade', c.atividade,
                          'tipo', c.tipo_atividade,
                          'inicio', c.data_inicio, 'fim', c.data_fim)
                        order by c.ordem)
                   from public."TB_CRONOGRAMA_MONIT_INDIG" c
                  where c.monitoramento_id = m.id), '[]'::jsonb))
             order by m.edital)
        from public."TB_MONITORAMENTO_INDIGENA" m
        cross join lateral (
          select jsonb_build_object(
                   'pendente',   count(*) filter (where f."TP_SITUACAO" = 'PENDENTE'),
                   'em_analise', count(*) filter (where f."TP_SITUACAO" = 'EM_ANALISE'),
                   'revisar',    count(*) filter (where f."TP_SITUACAO" = 'REVISAR'),
                   'concluida',  count(*) filter (where f."TP_SITUACAO" = 'CONCLUIDA'),
                   'fora_lote',  count(*) filter (where f."TP_SITUACAO" = 'FORA_LOTE')) as situacoes,
                 count(*) filter (where f."TP_SITUACAO" <> 'FORA_LOTE') as no_lote
            from public."TB_FICHA_ANALISE" f
           where f."CO_MONITORAMENTO" = m.id) s
        join public."TB_ORIGEM_ANALISE_EDITAL" o
          on o."CO_MONITORAMENTO" = m.id and o."TP_ORIGEM" = 'MONITORA'
       where m."CO_AREA" = v_area
         and m.ativo is true
         and coalesce(m."ST_TREINAMENTO", 'N') <> 'S'
         and (v_visiveis is null or m.id = any (v_visiveis))
         and s.no_lote > 0), '[]'::jsonb));
end;
$function$;

comment on function public.obter_ritmo_da_analise(text) is
  'Card "Ritmo da análise" do Painel das análises: por edital da área com a avaliação documental no MONITORA e fichas no lote, as contagens por situação, as concluídas por dia (últimos 14 dias, horário de Brasília), a equipe de analistas ativa, quem concluiu nos últimos 7 dias e o cronograma. A conta do ritmo é do front (src/lib/ritmo-da-analise.ts). Só quem pode ler o Painel das análises da área (20261019170000).';

revoke all on function public.obter_ritmo_da_analise(text) from public, anon;
grant execute on function public.obter_ritmo_da_analise(text) to authenticated;


drop index if exists public."IN_THFICHA_REABRIR";
