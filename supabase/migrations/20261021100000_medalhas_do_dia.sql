/*
  MEDALHAS DO DIA NO CARD "RITMO DA ANÁLISE"

  O card "Ritmo da análise" do Painel das análises ganha o bloco "Destaques de
  hoje": 🥇🥈🥉 para os três que mais concluíram fichas no dia e o selo
  "Precisão" (🎯) para quem concluiu ao menos 10 fichas hoje sem nenhuma delas
  reaberta. Zera todo dia (America/Sao_Paulo), sem ranking acumulado. A regra
  (medalha, empate, mínimo do selo) é do front, em src/lib/ritmo-da-analise.ts;
  o banco só entrega, por edital, um campo pequeno a mais em
  public.obter_ritmo_da_analise(p_area) (definição vigente de 20261019170000,
  só acrescentada):

    destaques: { dia, avaliadores: [ { nome, qt, reabertas } ] }

  - Conclusões de hoje: fichas em TB_FICHA_ANALISE hoje CONCLUIDA com
    DT_CONCLUSAO desde 00:00 de Brasília, por CO_USUARIO_CONCLUSAO (a mesma
    conta do "feito hoje"; leitura só no índice IN_FICHAANALISE_CONCLUIDA).
  - Reabertas: TH_FICHA_ANALISE com TP_ACAO = 'REABRIR' (CONCLUIDA →
    EM_ANALISE, pela coordenação ou pelo próprio avaliador para corrigir)
    registradas hoje cuja conclusão anterior (o CONCLUIR imediatamente antes,
    na mesma ficha) também é de hoje: contam para quem fez aquele CONCLUIR (no
    histórico até 21/10/2026, sempre o CO_USUARIO_RESP_ANTERIOR do REABRIR).
    REINICIAR não conta (é o reinício administrativo do edital ou de testes).
    Ficha reaberta e concluída de novo no mesmo dia continua contando como
    reaberta.
  - Só vão no retrato os do pódio (dense_rank ≤ 3 por conclusões) e quem
    chegou ao mínimo do selo (10): ninguém mais aparece, nem a contagem.
  - Nome: nome e sobrenome do cadastro (private."FC_NOME_E_SOBRENOME" de
    TB_PERFIL_USUARIO.nome); sem cadastro, "Avaliador".

  Índice parcial novo IN_THFICHA_REABRIR (só as linhas REABRIR, dezenas) para
  achar as reabertas de hoje sem varrer o histórico (21 MB).

  Permissão: a mesma do card (sessão, pode_recurso('analises'), área da
  pessoa e recorte de coordenação). Sem polling: vem junto com a carga do
  painel, como antes.

  Rollback: supabase/rollback/20261021100000_medalhas_do_dia.sql
  Ensaio:   supabase/ensaios/20261021100000_medalhas_do_dia.sql
*/

create index if not exists "IN_THFICHA_REABRIR"
  on public."TH_FICHA_ANALISE" ("DT_REGISTRO")
  include ("CO_FICHA_ANALISE")
  where "TP_ACAO" = 'REABRIR';

comment on index public."IN_THFICHA_REABRIR" is
  'Reaberturas de ficha (TP_ACAO REABRIR) por data: selo Precisão dos Destaques de hoje no card Ritmo da análise (20261021100000).';

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
  v_inicio_hoje timestamptz;
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
  v_inicio_hoje := (v_hoje::timestamp at time zone 'America/Sao_Paulo');

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
               -- Destaques de hoje (20261021100000): quem concluiu fichas hoje
               -- (America/Sao_Paulo), só os do pódio (dense_rank ≤ 3) ou com o
               -- mínimo do selo (10); o front decide medalha e selo.
               'destaques', jsonb_build_object(
                 'dia', v_hoje,
                 'avaliadores', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'nome', x.nome, 'qt', x.qt, 'reabertas', x.reabertas)
                          order by x.qt desc, x.nome)
                     from (select coalesce(private."FC_NOME_E_SOBRENOME"(p.nome), 'Avaliador') as nome,
                                  c.qt,
                                  coalesce(r.qt, 0) as reabertas,
                                  dense_rank() over (order by c.qt desc) as posicao
                             from (select f."CO_USUARIO_CONCLUSAO" as usuario, count(*) as qt
                                     from public."TB_FICHA_ANALISE" f
                                    where f."CO_MONITORAMENTO" = m.id
                                      and f."TP_SITUACAO" = 'CONCLUIDA'
                                      and f."DT_CONCLUSAO" >= v_inicio_hoje
                                      and f."CO_USUARIO_CONCLUSAO" is not null
                                    group by 1) c
                             left join public."TB_PERFIL_USUARIO" p on p.user_id = c.usuario
                             -- Reabertas: REABRIR de hoje cuja conclusão anterior
                             -- (o CONCLUIR imediatamente antes) também é de hoje;
                             -- conta para quem concluiu. REINICIAR não conta.
                             left join (
                               select ant.usuario, count(distinct h."CO_FICHA_ANALISE") as qt
                                 from public."TH_FICHA_ANALISE" h
                                 join public."TB_FICHA_ANALISE" fa
                                   on fa."CO_FICHA_ANALISE" = h."CO_FICHA_ANALISE"
                                  and fa."CO_MONITORAMENTO" = m.id
                                 cross join lateral (
                                   select c2."CO_USUARIO" as usuario, c2."DT_REGISTRO" as em
                                     from public."TH_FICHA_ANALISE" c2
                                    where c2."CO_FICHA_ANALISE" = h."CO_FICHA_ANALISE"
                                      and c2."TP_ACAO" = 'CONCLUIR'
                                      and c2."DT_REGISTRO" < h."DT_REGISTRO"
                                    order by c2."DT_REGISTRO" desc
                                    limit 1) ant
                                where h."TP_ACAO" = 'REABRIR'
                                  and h."DT_REGISTRO" >= v_inicio_hoje
                                  and ant.em >= v_inicio_hoje
                                group by 1) r on r.usuario = c.usuario) x
                    where x.posicao <= 3 or x.qt >= 10), '[]'::jsonb)),
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
  'Card "Ritmo da análise" do Painel das análises: por edital da área com a avaliação documental no MONITORA e fichas no lote, as contagens por situação, as concluídas por dia (últimos 14 dias, horário de Brasília), a equipe de analistas ativa, quem concluiu nos últimos 7 dias, o cronograma e os destaques de hoje (pódio e candidatos ao selo Precisão: nome, concluídas e reabertas hoje; 20261021100000). A conta do ritmo e das medalhas é do front (src/lib/ritmo-da-analise.ts). Só quem pode ler o Painel das análises da área (20261019170000).';

revoke all on function public.obter_ritmo_da_analise(text) from public, anon;
grant execute on function public.obter_ritmo_da_analise(text) to authenticated;
