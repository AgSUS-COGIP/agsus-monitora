/*
  KPIs do edital (Visão geral) calculados pela Seleção nativa.

  Os contadores de TB_MONITORAMENTO_INDIGENA (inscritos, aptos, eliminados…)
  vinham do Apps Script "resultado_indicadores_v10" (atualizar_indicadores_
  dashboard), parado desde 18/09/2026. A Seleção nativa (TB_SELECAO_VAGA,
  PR #188) lê a mesma aba Resultado da planilha "Auditoria" e está em dia.
  Só os KPIs mudam de fonte: cronograma e vagas_total seguem vindo do cadastro
  do edital.

  1. private.FC_ATUALIZAR_KPIS_PELA_SELECAO(): para cada edital com vaga ativa
     na Seleção, grava
       inscritos, aptos_analise, cancelados, eliminados_nota,
       reprovados_analise, total_eliminados  ← soma das vagas da Seleção;
       aprovados_analise ← análises "Aprovado" do edital (TB_ANALISE_CURRICULAR);
       entrevistados     ← entrevistas ativas com parecer APTO/INAPTO;
       contratados       ← lista de aprovados vigente, Contratado/Migração
                           (a mesma regra de get_selecao_da_area).
     Os três últimos só quando o sistema tem a fonte daquele edital (tem
     análise, tem entrevista, tem lista vigente); sem fonte, o valor atual
     fica — a planilha de entrevistas não cobre todos os editais (91/2026 tem
     231 entrevistados na Auditoria e nenhum na planilha de entrevistas).
     Só grava o que mudou. aprovados_prova, cargos e observações não mudam.
     Edital fora da Seleção fica como está.
  2. pg_cron "agsus_kpis_do_edital_pela_selecao" a cada 10 minutos, sem
     atropelo (pg_try_advisory_xact_lock), e uma primeira carga agora.
  3. atualizar_indicadores_dashboard (o script antigo) passa a só registrar a
     carga como ignorada, sem mexer nos KPIs — se o gatilho da planilha voltar,
     não sobrescreve os números da Seleção. Desligar o gatilho na planilha.

  Rollback: supabase/rollback/20260930235800_kpis_do_edital_pela_selecao.sql
*/
begin;

create function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"()
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

-- O script antigo não sobrescreve mais os KPIs.
create or replace function public.atualizar_indicadores_dashboard(p_sync_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_result jsonb := jsonb_build_object('ok', false, 'sync_id', p_sync_id,
    'motivo', 'Desativada em 30/09/2026: os KPIs do edital vêm da Seleção nativa (FC_ATUALIZAR_KPIS_PELA_SELECAO). Desligue o gatilho desta planilha.');
begin
  update public."TL_SYNC_MONIT_INDIGENA"
     set status = 'ignorado', resultado = v_result, erro = null, finished_at = now(), updated_at = now()
   where sync_id = p_sync_id;
  delete from public."TM_DASHBOARD_MONIT_INDIG" where sync_id = p_sync_id;
  return v_result;
end;
$function$;
comment on function public.atualizar_indicadores_dashboard(uuid) is 'Desativada (30/09/2026): registra a carga do script antigo como ignorada; os KPIs vêm da Seleção nativa.';

do $$
declare
  v_comando constant text :=
    'select private."FC_ATUALIZAR_KPIS_PELA_SELECAO"() where pg_try_advisory_xact_lock(hashtext(''agsus_kpis_do_edital_pela_selecao''));';
begin
  if exists (select 1 from cron.job where jobname = 'agsus_kpis_do_edital_pela_selecao') then
    perform cron.alter_job((select jobid from cron.job where jobname = 'agsus_kpis_do_edital_pela_selecao'),
                           schedule => '3-59/10 * * * *', command => v_comando);
  else
    perform cron.schedule('agsus_kpis_do_edital_pela_selecao', '3-59/10 * * * *', v_comando);
  end if;
end;
$$;

select private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();

commit;
