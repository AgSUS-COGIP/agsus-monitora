/*
  ENSAIO — 20261002130000_kpis_de_todo_edital_com_fonte.sql

  Roda tudo numa transação e desfaz no fim (rollback): nada fica no banco.
  Ordem: retrato "antes" dos editais ativos, a migration (as duas funções e o
  recálculo), retrato "depois", conferências, rollback. Cole inteiro no SQL
  Editor do Supabase (cada select devolve uma grade).

  O que conferir:
  1. por área, antes × depois: vagas imediatas, contratadas (imediatas,
     limitadas às vagas), em seleção, ociosas, cadastro reserva, inscritos —
     a conta da tela nova (Vagas imediatas = Contratadas + Em seleção +
     Ociosas; cancelados fora) — e as colunas do banco (contratados,
     vagas_ociosas). Esperado em 02/10: SEDE contratados 434 → ~1.001 e
     ociosas da coluna 163 → ~33 (FGV); Projetos 239 → ~742 e 713 → ~213 (FCC);
     Saúde Indígena quase sem mudança.
     A tela conta também como "Ociosas" os editais na fase Contratação; aqui
     só os concluídos.
  2. os editais que mudaram, coluna a coluna (antes → depois);
  3. FGV e FCC;
  4. editais cuja chave de análise (número ou nome) se repete na área: ficam
     com o aprovados_analise anterior;
  5. a carga da Seleção chama o recálculo (finalizar_sync_selecao tem a
     chamada).
*/
begin;

create temporary table vg_antes on commit drop as
select v.id, v."CO_AREA" as area, v.edital, v.unidade, v.status,
       coalesce(v.vagas_total, 0) as vagas, coalesce(v.contratados, 0) as contratados,
       coalesce(v.vagas_ociosas, 0) as ociosas_coluna, coalesce(v.inscritos, 0) as inscritos,
       coalesce(v.aprovados_analise, 0) as aprovados_analise, coalesce(v.entrevistados, 0) as entrevistados,
       coalesce(v.aptos_analise, 0) as aptos_analise
  from public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL" v
 where v.ativo;

-- ===========================================================================
-- Migration (sem begin/commit)
-- ===========================================================================

create or replace function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_qt integer;
begin
  with ed as materialized (
    select m.id, m."CO_AREA",
           coalesce(private."FC_NUMERO_EDITAL"(m.edital),
                    nullif('nome:' || private."FC_TEXTO_BUSCA_RECURSO"(m.edital), 'nome:')) as chave
      from public."TB_MONITORAMENTO_INDIGENA" m
     where m.ativo
  ),
  -- A chave da análise só vale quando aponta para um edital só na área.
  chave_unica as (
    select e."CO_AREA", e.chave, min(e.id::text)::uuid as id
      from ed e
     where e.chave is not null
     group by 1, 2
    having count(*) = 1
  ),
  sel as (
    select s."CO_MONITORAMENTO" id,
           sum(coalesce(s."QT_INSCRITO", 0))::integer inscritos,
           sum(coalesce(s."QT_APTO_ANALISE", 0))::integer aptos,
           sum(coalesce(s."QT_CANCELADO", 0))::integer cancelados,
           sum(coalesce(s."QT_ELIMINADO_NOTA", 0))::integer eliminados_nota,
           sum(coalesce(s."QT_REPROVADO_ANALISE", 0))::integer reprovados,
           sum(coalesce(s."QT_TOTAL_ELIMINADO", 0))::integer total_eliminados
      from public."TB_SELECAO_VAGA" s
     where s."ST_REGISTRO_ATIVO" = 'S' and s."CO_MONITORAMENTO" in (select id from ed)
     group by 1
  ),
  -- Cada fonte só conta para o edital que ela cobre (linha no grupo = tem a fonte).
  aprov as (
    select u.id, (count(*) filter (where a.status_consolidado = 'Aprovado'))::integer qt
      from chave_unica u
      join public."TB_ANALISE_CURRICULAR" a
        on a."CO_AREA" = u."CO_AREA" and a.ativo
       and coalesce(private."FC_NUMERO_EDITAL"(a.edital),
                    nullif('nome:' || private."FC_TEXTO_BUSCA_RECURSO"(a.edital), 'nome:')) = u.chave
     group by 1
  ),
  entr as (
    select e."CO_MONITORAMENTO" id, (count(*) filter (where e."TP_PARECER" in ('APTO', 'INAPTO')))::integer qt
      from public."TB_ENTREVISTA" e
     where e."ST_ATIVO" = 'S' and e."CO_MONITORAMENTO" in (select id from ed)
     group by 1
  ),
  contr as (
    select l.edital_id::uuid id,
           (count(c.id) filter (where c.status in ('Contratado', 'Migração')))::integer qt
      from public."TB_LISTA_APROVADO" l
      left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
     where l.vigente is true and l.edital_id in (select id::text from ed)
     group by 1
  ),
  novo as (
    select t.id, s.inscritos, s.aptos, s.cancelados, s.eliminados_nota, s.reprovados, s.total_eliminados,
           a.qt aprovados, e.qt entrevistados, c.qt contratados
      from ed t
      left join sel s on s.id = t.id
      left join aprov a on a.id = t.id
      left join entr e on e.id = t.id
      left join contr c on c.id = t.id
     where s.id is not null or a.id is not null or e.id is not null or c.id is not null
  )
  update public."TB_MONITORAMENTO_INDIGENA" m
     set inscritos = coalesce(n.inscritos, m.inscritos),
         aptos_analise = coalesce(n.aptos, m.aptos_analise),
         cancelados = coalesce(n.cancelados, m.cancelados),
         eliminados_nota = coalesce(n.eliminados_nota, m.eliminados_nota),
         reprovados_analise = coalesce(n.reprovados, m.reprovados_analise),
         total_eliminados = coalesce(n.total_eliminados, m.total_eliminados),
         aprovados_analise = coalesce(n.aprovados, m.aprovados_analise),
         entrevistados = coalesce(n.entrevistados, m.entrevistados),
         contratados = coalesce(n.contratados, m.contratados),
         updated_at = now()
    from novo n
   where m.id = n.id
     and (m.inscritos, m.aptos_analise, m.cancelados, m.eliminados_nota, m.reprovados_analise,
          m.total_eliminados, m.aprovados_analise, m.entrevistados, m.contratados)
         is distinct from
         (coalesce(n.inscritos, m.inscritos), coalesce(n.aptos, m.aptos_analise),
          coalesce(n.cancelados, m.cancelados), coalesce(n.eliminados_nota, m.eliminados_nota),
          coalesce(n.reprovados, m.reprovados_analise), coalesce(n.total_eliminados, m.total_eliminados),
          coalesce(n.aprovados, m.aprovados_analise), coalesce(n.entrevistados, m.entrevistados),
          coalesce(n.contratados, m.contratados));
  get diagnostics v_qt = row_count;
  return v_qt;
end;
$function$;
comment on function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"() is 'Recalcula os KPIs de todo edital ativo (TB_MONITORAMENTO_INDIGENA) que tem a fonte: Seleção nativa (pelo id), lista de aprovados vigente (pelo id), entrevistas (pelo id) e análises (número do edital ou nome, quando único na área). Sem a fonte, o valor anterior fica; só grava o que mudou. Devolve quantos editais mudaram. Roda pelo pg_cron e no fim da carga da Seleção.';
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
  v_kpis integer;
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

  -- Os KPIs da Visão geral já com a carga nova (o mesmo lock do pg_cron).
  if pg_try_advisory_xact_lock(hashtext('agsus_kpis_do_edital_pela_selecao')) then
    v_kpis := private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();
  end if;

  update public."TL_SYNC_SELECAO" set
    "TP_SITUACAO" = 'CONCLUIDA', "DT_FIM" = now(),
    "QT_SEM_EDITAL" = v_sem_edital, "QT_DESATIVADA" = v_desativadas,
    "DS_MENSAGEM" = case when coalesce(p_forcar, false) then 'Fechada com forçar.' end
   where "CO_SYNC" = p_sync;

  return jsonb_build_object('situacao', 'CONCLUIDA', 'linhas', v_sync."QT_LINHA",
    'sem_edital', v_sem_edital, 'desativadas', v_desativadas, 'kpis', v_kpis);
end;
$function$;
comment on function public.finalizar_sync_selecao(text, boolean) is
  'Fecha uma carga da aba Seleção: desativa (ST_REGISTRO_ATIVO = N) o que saiu da planilha, liga o edital e acerta a área (FC_LIGAR_SELECAO_AOS_EDITAIS: DSEI/CASAI só na Saúde Indígena), recalcula os KPIs dos editais (FC_ATUALIZAR_KPIS_PELA_SELECAO) e grava os totais no log. Recusa carga com menos da metade das linhas ativas sem p_forcar. Só service_role.';

-- Os números de hoje, com a regra nova.
select private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();


-- ===========================================================================
-- Conferências
-- ===========================================================================
create temporary table vg_depois on commit drop as
select v.id, v."CO_AREA" as area, v.edital, v.unidade, v.status,
       coalesce(v.vagas_total, 0) as vagas, coalesce(v.contratados, 0) as contratados,
       coalesce(v.vagas_ociosas, 0) as ociosas_coluna, coalesce(v.inscritos, 0) as inscritos,
       coalesce(v.aprovados_analise, 0) as aprovados_analise, coalesce(v.entrevistados, 0) as entrevistados,
       coalesce(v.aptos_analise, 0) as aptos_analise
  from public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL" v
 where v.ativo;

-- 1. Por área, antes × depois.
with x as (
  select 'antes' as momento, a.* from vg_antes a
  union all
  select 'depois', d.* from vg_depois d
),
y as (
  select momento, area, vagas, contratados, ociosas_coluna, inscritos,
         lower(status) like 'cancel%' as cancelado,
         lower(status) like 'conclu%' as concluido,
         least(contratados, vagas) as imediatas
    from x
)
select area, momento,
       count(*) as editais,
       sum(vagas) filter (where not cancelado) as vagas_imediatas,
       sum(imediatas) filter (where not cancelado) as contratadas,
       sum(vagas - imediatas) filter (where not cancelado and not concluido) as em_selecao,
       sum(vagas - imediatas) filter (where not cancelado and concluido) as ociosas,
       sum(greatest(contratados - vagas, 0)) filter (where not cancelado) as cadastro_reserva,
       sum(inscritos) filter (where not cancelado) as inscritos,
       sum(contratados) as contratados_coluna,
       sum(ociosas_coluna) as vagas_ociosas_coluna
  from y
 group by area, momento
 order by area, momento desc;

-- 2. Editais que mudaram.
select d.area, d.edital, d.unidade, d.status,
       a.contratados || ' → ' || d.contratados as contratados,
       a.ociosas_coluna || ' → ' || d.ociosas_coluna as vagas_ociosas,
       a.inscritos || ' → ' || d.inscritos as inscritos,
       a.aptos_analise || ' → ' || d.aptos_analise as aptos,
       a.aprovados_analise || ' → ' || d.aprovados_analise as aprovados_analise,
       a.entrevistados || ' → ' || d.entrevistados as entrevistados
  from vg_depois d
  join vg_antes a on a.id = d.id
 where (a.contratados, a.ociosas_coluna, a.inscritos, a.aptos_analise, a.aprovados_analise, a.entrevistados)
       is distinct from
       (d.contratados, d.ociosas_coluna, d.inscritos, d.aptos_analise, d.aprovados_analise, d.entrevistados)
 order by d.area, d.edital;

-- 3. FGV e FCC (sem número de edital).
select d.area, d.edital, d.vagas, a.contratados as contratados_antes, d.contratados as contratados_depois,
       a.ociosas_coluna as ociosas_antes, d.ociosas_coluna as ociosas_depois
  from vg_depois d
  join vg_antes a on a.id = d.id
 where private."FC_NUMERO_EDITAL"(d.edital) is null
 order by d.area, d.edital;

-- 4. Chave de análise repetida na área (fica com o valor anterior).
select m."CO_AREA" as area,
       coalesce(private."FC_NUMERO_EDITAL"(m.edital), 'nome:' || private."FC_TEXTO_BUSCA_RECURSO"(m.edital)) as chave,
       count(*) as editais, string_agg(m.edital || ' · ' || m.unidade, ' | ') as quais
  from public."TB_MONITORAMENTO_INDIGENA" m
 where m.ativo
 group by 1, 2
having count(*) > 1
 order by 1, 2;

-- 5. A carga da Seleção recalcula os KPIs.
select position('FC_ATUALIZAR_KPIS_PELA_SELECAO' in pg_get_functiondef('public.finalizar_sync_selecao(text, boolean)'::regprocedure)) > 0
       as carga_recalcula_kpis;

rollback;
