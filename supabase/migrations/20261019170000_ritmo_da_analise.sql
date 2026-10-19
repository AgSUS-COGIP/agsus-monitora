/*
  RITMO DA ANÁLISE NO PAINEL DAS ANÁLISES

  O card "Ritmo da análise" do Painel das análises mostra, para cada edital com
  avaliação documental no próprio sistema (fichas em TB_FICHA_ANALISE; hoje o
  114/2026, Projetos), quanto falta, quantas por dia são precisas até o prazo
  do cronograma e o ritmo atual. A conta (dias úteis, etapa do cronograma,
  projeção) é do front, em src/lib/ritmo-da-analise.ts; o banco só entrega o
  retrato pequeno:

    public.obter_ritmo_da_analise(p_area) → jsonb
      { gerado_em, editais: [ {
          id, edital,
          situacoes: { pendente, em_analise, revisar, concluida, fora_lote },
          por_dia:   [ { dia, qt } ]   -- concluídas por dia (America/Sao_Paulo),
                                       -- últimos 14 dias corridos
          qt_equipe,                   -- analistas ativos em RL_ANALISTA_EDITAL
          qt_avaliadores_recentes,     -- quem concluiu ficha nos últimos 7 dias
          cronograma: [ { ordem, atividade, tipo, inicio, fim } ]
      } ] }

  Editais: os da área (TB_MONITORAMENTO_INDIGENA."CO_AREA") com a avaliação
  documental no MONITORA (TB_ORIGEM_ANALISE_EDITAL = MONITORA; o 93/2026, pela
  planilha, fica de fora), ativos, fora do treinamento, no recorte de
  coordenação da pessoa (FC_EDITAIS_VISIVEIS) e com ao menos uma ficha no lote
  (fora FORA_LOTE).

  Carga: o banco é NANO. Nada de polling: a tela chama junto com a carga do
  painel (abrir, trocar de área, "Atualizar", reabrir depois de 5 min). As
  contagens usam IN_FICHAANALISE_FILA; as concluídas por dia, o índice
  parcial novo IN_FICHAANALISE_CONCLUIDA (só fichas concluídas, com o
  autor incluído: leitura só no índice). Ensaio (19/10/2026): 3,2 ms (763 buffers, todos em cache) em
  Projetos (114/2026); o pacote do painel, para comparar, 84 ms.

  Permissão: sessão, private.pode_recurso('analises') e a área da pessoa
  (FC_GRUPOS_ANALISES_DA_AREA: 22023 área inválida, 42501 sem a área), como
  get_analises_dashboard_payload_v2.

  Rollback: supabase/rollback/20261019170000_ritmo_da_analise.sql
  Ensaio:   supabase/ensaios/20261019170000_ritmo_da_analise.sql
*/


create index if not exists "IN_FICHAANALISE_CONCLUIDA"
  on public."TB_FICHA_ANALISE" ("CO_MONITORAMENTO", "DT_CONCLUSAO")
  include ("CO_USUARIO_CONCLUSAO")
  where "TP_SITUACAO" = 'CONCLUIDA';

comment on index public."IN_FICHAANALISE_CONCLUIDA" is
  'Fichas concluídas por edital e data de conclusão (com o autor): concluídas por dia e avaliadores recentes do card Ritmo da análise (20261019170000).';

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

