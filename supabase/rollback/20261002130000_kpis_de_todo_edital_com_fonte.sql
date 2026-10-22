-- Desfaz 20261002130000: FC_ATUALIZAR_KPIS_PELA_SELECAO volta a só recalcular os editais com vaga na Seleção (corpo de 20260930235800) e finalizar_sync_selecao deixa de recalcular os KPIs (corpo de 20261001100000). Os valores já recalculados ficam.
begin;

create or replace function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_qt integer;
begin
  with sel as (
    select s."CO_MONITORAMENTO" id,
           sum(coalesce(s."QT_INSCRITO", 0))::integer inscritos,
           sum(coalesce(s."QT_APTO_ANALISE", 0))::integer aptos,
           sum(coalesce(s."QT_CANCELADO", 0))::integer cancelados,
           sum(coalesce(s."QT_ELIMINADO_NOTA", 0))::integer eliminados_nota,
           sum(coalesce(s."QT_REPROVADO_ANALISE", 0))::integer reprovados,
           sum(coalesce(s."QT_TOTAL_ELIMINADO", 0))::integer total_eliminados
      from public."TB_SELECAO_VAGA" s
     where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_MONITORAMENTO" is not null
     group by 1
  ),
  alvo as (
    select m.id, m."CO_AREA", private."FC_NUMERO_EDITAL"(m.edital) numero
      from public."TB_MONITORAMENTO_INDIGENA" m
     where m.ativo and m.id in (select id from sel)
  ),
  -- Cada fonte só conta para o edital que ela cobre (linha no grupo = tem a fonte).
  aprov as (
    select t.id, (count(*) filter (where a.status_consolidado = 'Aprovado'))::integer qt
      from alvo t
      join public."TB_ANALISE_CURRICULAR" a
        on a."CO_AREA" = t."CO_AREA" and a.ativo
       and private."FC_NUMERO_EDITAL"(a.edital) = t.numero
     group by 1
  ),
  entr as (
    select e."CO_MONITORAMENTO" id, (count(*) filter (where e."TP_PARECER" in ('APTO', 'INAPTO')))::integer qt
      from public."TB_ENTREVISTA" e
     where e."ST_ATIVO" = 'S' and e."CO_MONITORAMENTO" in (select id from alvo)
     group by 1
  ),
  contr as (
    select l.edital_id::uuid id,
           (count(c.id) filter (where c.status in ('Contratado', 'Migração')))::integer qt
      from public."TB_LISTA_APROVADO" l
      left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
     where l.vigente is true and l.edital_id in (select id::text from alvo)
     group by 1
  ),
  novo as (
    select t.id, s.inscritos, s.aptos, s.cancelados, s.eliminados_nota, s.reprovados, s.total_eliminados,
           a.qt aprovados, e.qt entrevistados, c.qt contratados
      from alvo t
      join sel s on s.id = t.id
      left join aprov a on a.id = t.id
      left join entr e on e.id = t.id
      left join contr c on c.id = t.id
  )
  update public."TB_MONITORAMENTO_INDIGENA" m
     set inscritos = n.inscritos, aptos_analise = n.aptos, cancelados = n.cancelados,
         eliminados_nota = n.eliminados_nota, reprovados_analise = n.reprovados,
         total_eliminados = n.total_eliminados, aprovados_analise = coalesce(n.aprovados, m.aprovados_analise),
         entrevistados = coalesce(n.entrevistados, m.entrevistados),
         contratados = coalesce(n.contratados, m.contratados), updated_at = now()
    from novo n
   where m.id = n.id
     and (m.inscritos, m.aptos_analise, m.cancelados, m.eliminados_nota, m.reprovados_analise,
          m.total_eliminados, m.aprovados_analise, m.entrevistados, m.contratados)
         is distinct from
         (n.inscritos, n.aptos, n.cancelados, n.eliminados_nota, n.reprovados, n.total_eliminados,
          coalesce(n.aprovados, m.aprovados_analise), coalesce(n.entrevistados, m.entrevistados),
          coalesce(n.contratados, m.contratados));
  get diagnostics v_qt = row_count;
  return v_qt;
end;
$function$;
comment on function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"() is 'Recalcula os KPIs do edital (TB_MONITORAMENTO_INDIGENA) pela Seleção nativa, análises, entrevistas e lista de aprovados; só grava o que mudou. Devolve quantos editais mudaram. Roda pelo pg_cron.';
revoke all on function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"() from public, anon, authenticated;

create or replace function public.finalizar_sync_selecao(p_sync text, p_forcar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sync public."TL_SYNC_SELECAO";
  v_ativas integer;
  v_desativadas integer;
  v_sem_edital integer;
begin
  select * into v_sync from public."TL_SYNC_SELECAO" s where s."CO_SYNC" = p_sync for update;
  if v_sync."CO_SYNC" is null or v_sync."TP_SITUACAO" <> 'EM_ANDAMENTO' then
    raise exception 'Carga % não encontrada ou já fechada', p_sync using errcode = '22023';
  end if;

  select count(*) into v_ativas from public."TB_SELECAO_VAGA" s where s."ST_REGISTRO_ATIVO" = 'S';
  if not coalesce(p_forcar, false) and v_ativas > 0 and v_sync."QT_LINHA" * 2 < v_ativas then
    update public."TL_SYNC_SELECAO" set "TP_SITUACAO" = 'RECUSADA', "DT_FIM" = now(),
      "DS_MENSAGEM" = format('Carga com %s linhas e %s ativas no banco: menos da metade. Nada foi desativado; confira a planilha ou rode com forçar.', v_sync."QT_LINHA", v_ativas)
     where "CO_SYNC" = p_sync;
    return jsonb_build_object('situacao', 'RECUSADA', 'linhas', v_sync."QT_LINHA", 'ativas', v_ativas);
  end if;

  update public."TB_SELECAO_VAGA" s set "ST_REGISTRO_ATIVO" = 'N', "DT_ATUALIZACAO" = now()
   where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_SYNC" is distinct from p_sync;
  get diagnostics v_desativadas = row_count;

  perform private."FC_LIGAR_SELECAO_AOS_EDITAIS"();

  select count(*) filter (where s."CO_MONITORAMENTO" is null) into v_sem_edital
    from public."TB_SELECAO_VAGA" s where s."ST_REGISTRO_ATIVO" = 'S';

  update public."TL_SYNC_SELECAO" set
    "TP_SITUACAO" = 'CONCLUIDA', "DT_FIM" = now(),
    "QT_SEM_EDITAL" = v_sem_edital, "QT_DESATIVADA" = v_desativadas,
    "DS_MENSAGEM" = case when coalesce(p_forcar, false) then 'Fechada com forçar.' end
   where "CO_SYNC" = p_sync;

  return jsonb_build_object('situacao', 'CONCLUIDA', 'linhas', v_sync."QT_LINHA",
    'sem_edital', v_sem_edital, 'desativadas', v_desativadas);
end;
$function$;
comment on function public.finalizar_sync_selecao(text, boolean) is
  'Fecha uma carga da aba Seleção: desativa (ST_REGISTRO_ATIVO = N) o que saiu da planilha, liga o edital e acerta a área (FC_LIGAR_SELECAO_AOS_EDITAIS: DSEI/CASAI só na Saúde Indígena) e grava os totais no log. Recusa carga com menos da metade das linhas ativas sem p_forcar. Só service_role.';

commit;
