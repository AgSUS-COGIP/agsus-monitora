-- ENSAIO de supabase/migrations/20261022200000_funil_do_edital_de_uma_fonte_so.sql: roda o corpo e desfaz (rollback).
-- Rodado em 22/10/2026 (banco tabmkiokfuxyqjuvfiha, begin…rollback): todas as conferências passaram.
-- Recálculo 867 ms; pacote das entrevistas: SI 380 ms aquecido (antes 350 ms), Projetos 42 ms, SEDE 6 ms.
-- Editais ativos por fonte: SELECAO 130, AVALIACAO_DOCUMENTAL 4, ANALISES 4, sem fonte 14.
-- aptos > inscritos: 1 antes (treinamento SI), 0 depois; aprovados > aptos: 8 antes, 2 depois (81/2025 e
-- 83/2025, sem fonte de funil); 48 editais mudam (114/2026: inscritos 1.512 → 7.726, aptos 0 → 1.513).
-- Esperado: nenhum edital ativo com aptos > inscritos; a restrição criada; o recálculo
-- (FC_ATUALIZAR_KPIS_PELA_SELECAO, 2ª chamada, que lê todas as fontes de novo) abaixo de
-- 8 s no NANO; o pacote de cada área sem duas entrevistas da mesma análise nem edital
-- inativo. O resultado (json) traz os tempos, os editais por fonte e o antes × depois de
-- cada edital que mudou (número do edital e contagens; nenhum nome de candidato).
begin;

-- Antes: o funil de cada edital ativo.
create temp table t_antes on commit drop as
select m.id, m."CO_AREA" as area, m.edital, m.inscritos, m.aptos_analise, m.cancelados, m.eliminados_nota,
       m.total_eliminados, m.reprovados_analise, m.aprovados_analise, m.entrevistados, m.contratados
  from public."TB_MONITORAMENTO_INDIGENA" m
 where m.ativo;

create temp table t_tempo (etapa text primary key, ms integer) on commit drop;

-- O corpo da migration (inclui o recálculo e a restrição).
set local lock_timeout = '10s';

-- 0. Pré-requisitos -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_PRE_CLASSIF_VAGA"') is null
     or to_regclass('public."TH_INSCRICAO_VAGA_EDITAL"') is null
     or to_regclass('public."TB_FICHA_ANALISE"') is null
     or to_regclass('public."TB_ORIGEM_ANALISE_EDITAL"') is null
     or to_regprocedure('private."FC_MARCAR_CACHE"(text[], text[], text)') is null
     or to_regprocedure('private."FC_EDITAL_EH_TREINAMENTO"(uuid)') is null
     or to_regprocedure('private."FC_ANALISE_EH_TREINAMENTO"(text)') is null
     or to_regprocedure('private."FC_CONVOCADOS_DA_LISTA"(uuid)') is null then
    raise exception 'Aplique antes as migrations da avaliação documental, dos caches e da convocação única.';
  end if;
end;
$$;

-- 1. A fonte do funil no edital -----------------------------------------------------------------
alter table public."TB_MONITORAMENTO_INDIGENA"
  add column if not exists "TP_FONTE_FUNIL" varchar(20),
  add column if not exists "DT_FONTE_FUNIL" timestamptz;
alter table public."TB_MONITORAMENTO_INDIGENA"
  drop constraint if exists "CK_MONIT_INDIG_FONTE_FUNIL";
alter table public."TB_MONITORAMENTO_INDIGENA"
  add constraint "CK_MONIT_INDIG_FONTE_FUNIL" check (
    "TP_FONTE_FUNIL" is null or "TP_FONTE_FUNIL" in ('AVALIACAO_DOCUMENTAL', 'SELECAO', 'ANALISES'));
comment on column public."TB_MONITORAMENTO_INDIGENA"."TP_FONTE_FUNIL" is
  'De onde vem o funil do edital (inscritos, aptos, cancelados, eliminados, reprovados): AVALIACAO_DOCUMENTAL (pré-classificação ou retrato das inscrições), SELECAO (vagas da Seleção) ou ANALISES (análises curriculares). Nulo: sem fonte, valores da carga original. Gravada por FC_ATUALIZAR_KPIS_PELA_SELECAO (20261022200000).';
comment on column public."TB_MONITORAMENTO_INDIGENA"."DT_FONTE_FUNIL" is
  'Data dos dados da fonte do funil: última gravação da pré-classificação ou do retrato, última carga concluída da Seleção ou última mudança nas análises do edital.';
comment on constraint "CK_MONIT_INDIG_FONTE_FUNIL" on public."TB_MONITORAMENTO_INDIGENA" is 'Fontes válidas do funil do edital.';

-- Campo do funil que a fonte não tem fica NULO ("—" na tela), não 0: zero inscritos
-- acenderia o crítico "Sem inscritos" nos editais que só têm as análises. O padrão 0
-- continua para o edital novo.
alter table public."TB_MONITORAMENTO_INDIGENA"
  alter column inscritos drop not null,
  alter column aptos_analise drop not null,
  alter column cancelados drop not null,
  alter column eliminados_nota drop not null,
  alter column total_eliminados drop not null,
  alter column reprovados_analise drop not null;

-- 2. A entrevista que vale por (edital, análise) -----------------------------------------------
create or replace function private."FC_ENTREVISTAS_VIGENTES"(p_area text default null)
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select distinct on (coalesce(e."CO_ANALISE_CURRICULAR"::text,
                               'candidato:' || coalesce(e."CO_MONITORAMENTO"::text, '') || '|' || e."CO_VAGA" || '|' || e."CO_CANDIDATO",
                               'entrevista:' || e."CO_ENTREVISTA"::text))
         e."CO_ENTREVISTA"
    from public."TB_ENTREVISTA" e
   where e."ST_ATIVO" = 'S'
     and (p_area is null or e."CO_AREA" = p_area)
   order by coalesce(e."CO_ANALISE_CURRICULAR"::text,
                     'candidato:' || coalesce(e."CO_MONITORAMENTO"::text, '') || '|' || e."CO_VAGA" || '|' || e."CO_CANDIDATO",
                     'entrevista:' || e."CO_ENTREVISTA"::text),
            (e."TP_PARECER" in ('APTO', 'INAPTO')) desc,
            (e."VL_NOTA_TOTAL" is not null) desc,
            (e."TP_ORIGEM" = 'sistema') desc,
            e."DT_ATUALIZACAO" desc,
            e."CO_ENTREVISTA" desc;
$function$;
comment on function private."FC_ENTREVISTAS_VIGENTES"(text) is
  'A entrevista ativa que vale por pessoa (a análise, que é de um edital só; sem análise, edital + vaga + código do candidato; sem código, a própria entrevista): com parecer, com nota, do sistema, a mais recente, o maior id. A mesma regra de src/lib/entrevista-vigente.ts (20261022200000).';
revoke all on function private."FC_ENTREVISTAS_VIGENTES"(text) from public, anon, authenticated;

create or replace function private."FC_DESATIVAR_ENTREVISTAS_REPETIDAS"(p_area text, p_edital uuid default null, p_usuario uuid default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_qt integer;
begin
  with repetidas as (
    select e."CO_ENTREVISTA", s."CO_ENTREVISTA" as do_sistema
      from public."TB_ENTREVISTA" e
      join lateral (
        select x."CO_ENTREVISTA" from public."TB_ENTREVISTA" x
         where x."CO_ANALISE_CURRICULAR" = e."CO_ANALISE_CURRICULAR"
           and x."TP_ORIGEM" = 'sistema' and x."ST_ATIVO" = 'S'
           and (p_edital is null or x."CO_MONITORAMENTO" = p_edital)
         order by x."DT_ATUALIZACAO" desc limit 1
      ) s on true
     where e."CO_AREA" = p_area and e."TP_ORIGEM" = 'planilha' and e."ST_ATIVO" = 'S'
       and e."CO_ANALISE_CURRICULAR" is not null
       and e."CO_ENTREVISTA" not in (select v from private."FC_ENTREVISTAS_VIGENTES"(p_area) v)
  ),
  desativadas as (
    update public."TB_ENTREVISTA" e set "ST_ATIVO" = 'N', "DT_ATUALIZACAO" = now()
      from repetidas r
     where e."CO_ENTREVISTA" = r."CO_ENTREVISTA"
    returning e."CO_ENTREVISTA", r.do_sistema
  )
  insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
  select d."CO_ENTREVISTA", 'repetida', 'S', 'N: a análise tem a entrevista do sistema ' || d.do_sistema, p_usuario
    from desativadas d;
  get diagnostics v_qt = row_count;
  return v_qt;
end;
$function$;
comment on function private."FC_DESATIVAR_ENTREVISTAS_REPETIDAS"(text, uuid, uuid) is
  'Desativa (ST_ATIVO = N, com histórico "repetida") a entrevista da planilha cuja análise já tem entrevista ativa do sistema, quando a da planilha não é a vigente (FC_ENTREVISTAS_VIGENTES). Nunca desativa a do sistema. p_edital: só as do sistema desse edital. Devolve quantas desativou (20261022200000).';
revoke all on function private."FC_DESATIVAR_ENTREVISTAS_REPETIDAS"(text, uuid, uuid) from public, anon, authenticated;

comment on column public."TB_ENTREVISTA"."ST_ATIVO" is
  'S: está na planilha (ou convocada no sistema); N: saiu da planilha numa carga, ou repetida da entrevista do sistema da mesma análise (FC_DESATIVAR_ENTREVISTAS_REPETIDAS, histórico "repetida"). Fica para o histórico.';

-- 3. KPIs do edital: o funil de uma fonte só ---------------------------------------------------
create or replace function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_qt integer;
  v_carga_selecao timestamptz;
begin
  select max(t."DT_FIM") into v_carga_selecao
    from public."TL_SYNC_SELECAO" t where t."TP_SITUACAO" = 'CONCLUIDA';

  with ed as materialized (
    select m.id, m."CO_AREA",
           coalesce(private."FC_NUMERO_EDITAL"(m.edital),
                    nullif('nome:' || private."FC_TEXTO_BUSCA_RECURSO"(m.edital), 'nome:')) as chave,
           exists (select 1 from public."TB_ORIGEM_ANALISE_EDITAL" o
                    where o."CO_MONITORAMENTO" = m.id and o."TP_ORIGEM" = 'MONITORA') as no_monitora
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
  -- Fonte 1: avaliação documental nativa (resumo da última execução de cada vaga).
  pre as (
    select pv."CO_MONITORAMENTO" id,
           sum(pv."QT_INSCRITO")::integer inscritos,
           sum(pv."QT_LOTE" + pv."QT_ACIMA_CORTE")::integer aptos,
           sum(pv."QT_ELIMINADO")::integer total_eliminados,
           max(pv."DT_ATUALIZACAO") em
      from public."TB_PRE_CLASSIF_VAGA" pv
     where pv."CO_MONITORAMENTO" in (select id from ed)
     group by 1
  ),
  pre_cancelados as (
    select p."CO_MONITORAMENTO" id, count(*)::integer qt
      from public."TB_PRE_CLASSIFICACAO" p
     where p."CO_MONITORAMENTO" in (select id from pre)
       and p."TP_SITUACAO" = 'ELIMINADO' and p."CO_MOTIVO_ELIMINACAO" = 'CANCELADO'
     group by 1
  ),
  -- Fonte 1 sem resumo: o último retrato das inscrições de cada vaga.
  retrato as (
    select r."CO_MONITORAMENTO" id,
           sum(r."QT_INSCRITO")::integer inscritos,
           case when count(*) = count(r."QT_APTO") then sum(r."QT_APTO")::integer end aptos,
           case when count(*) = count(r."QT_ELIMINADO") then sum(r."QT_ELIMINADO")::integer end total_eliminados,
           max(r."DT_ATUALIZACAO") em
      from (select distinct on (t."CO_MONITORAMENTO", t."CO_VAGA") t.*
              from public."TH_INSCRICAO_VAGA_EDITAL" t
             where t."CO_MONITORAMENTO" in (select id from ed)
               and t."CO_MONITORAMENTO" not in (select id from pre)
             order by t."CO_MONITORAMENTO", t."CO_VAGA", t."DT_RETRATO" desc) r
     group by 1
  ),
  -- Avaliação no MONITORA: o resultado das fichas, pelo id do edital.
  fichas as (
    select f."CO_MONITORAMENTO" id,
           (count(*) filter (where f."TP_SITUACAO" = 'CONCLUIDA' and f."TP_RESULTADO" = 'APTO'))::integer aprovados,
           (count(*) filter (where f."TP_SITUACAO" = 'CONCLUIDA' and f."TP_RESULTADO" is distinct from 'APTO'))::integer reprovados
      from public."TB_FICHA_ANALISE" f
     where f."CO_MONITORAMENTO" in (select id from ed where no_monitora)
     group by 1
  ),
  -- Fonte 2: a Seleção, só quando coerente (aptos <= inscritos).
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
    having sum(coalesce(s."QT_APTO_ANALISE", 0)) <= sum(coalesce(s."QT_INSCRITO", 0))
  ),
  -- Fonte 3: as análises do edital (número ou nome único na área).
  aprov as (
    select u.id,
           (count(*) filter (where a.status_consolidado = 'Aprovado'))::integer qt,
           (count(*) filter (where a.status_consolidado = 'Reprovado'))::integer reprovados,
           count(*)::integer candidatos,
           max(a.updated_at) em
      from chave_unica u
      join public."TB_ANALISE_CURRICULAR" a
        on a."CO_AREA" = u."CO_AREA" and a.ativo
       and coalesce(private."FC_NUMERO_EDITAL"(a.edital),
                    nullif('nome:' || private."FC_TEXTO_BUSCA_RECURSO"(a.edital), 'nome:')) = u.chave
     group by 1
  ),
  -- Entrevistados: pessoas distintas (a entrevista vigente) que compareceram.
  entr as (
    select e."CO_MONITORAMENTO" id,
           (count(*) filter (where e."ST_COMPARECEU" = 'S'
                               or (e."ST_COMPARECEU" is null and e."TP_PARECER" in ('APTO', 'INAPTO'))))::integer qt
      from public."TB_ENTREVISTA" e
     where e."CO_ENTREVISTA" in (select v from private."FC_ENTREVISTAS_VIGENTES"(null) v)
       and e."CO_MONITORAMENTO" in (select id from ed)
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
  fonte as (
    select t.id, t.no_monitora,
           case when p.id is not null or r.id is not null then 'AVALIACAO_DOCUMENTAL'
                when s.id is not null then 'SELECAO'
                when a.id is not null then 'ANALISES' end as fonte
      from ed t
      left join pre p on p.id = t.id
      left join retrato r on r.id = t.id
      left join sel s on s.id = t.id
      left join aprov a on a.id = t.id
  ),
  novo as (
    select t.id, t.fonte,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then coalesce(p.inscritos, r.inscritos)
                        when 'SELECAO' then s.inscritos end inscritos,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then coalesce(p.aptos, r.aptos)
                        when 'SELECAO' then s.aptos
                        when 'ANALISES' then a.candidatos end aptos,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then case when p.id is not null then coalesce(pc.qt, 0) end
                        when 'SELECAO' then s.cancelados end cancelados,
           case t.fonte when 'SELECAO' then s.eliminados_nota end eliminados_nota,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then coalesce(p.total_eliminados, r.total_eliminados)
                        when 'SELECAO' then s.total_eliminados end total_eliminados,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then
                          case when t.no_monitora then coalesce(f.reprovados, 0) else a.reprovados end
                        when 'SELECAO' then s.reprovados
                        when 'ANALISES' then a.reprovados end reprovados,
           case t.fonte when 'AVALIACAO_DOCUMENTAL' then coalesce(p.em, r.em)
                        when 'SELECAO' then v_carga_selecao
                        when 'ANALISES' then a.em end em,
           case when t.no_monitora then coalesce(f.aprovados, 0) else a.qt end aprovados,
           (a.id is not null or t.no_monitora) tem_aprovados,
           e.qt entrevistados, c.qt contratados
      from fonte t
      left join pre p on p.id = t.id
      left join pre_cancelados pc on pc.id = t.id
      left join retrato r on r.id = t.id
      left join fichas f on f.id = t.id
      left join sel s on s.id = t.id
      left join aprov a on a.id = t.id
      left join entr e on e.id = t.id
      left join contr c on c.id = t.id
     where t.fonte is not null or t.no_monitora or e.id is not null or c.id is not null
  ),
  -- Com fonte, todo campo do funil vem dela (ou nulo); sem fonte, o funil não muda.
  final as (
    select n.id,
           case when n.fonte is null then m.inscritos else n.inscritos end inscritos,
           case when n.fonte is null then m.aptos_analise else n.aptos end aptos_analise,
           case when n.fonte is null then m.cancelados else n.cancelados end cancelados,
           case when n.fonte is null then m.eliminados_nota else n.eliminados_nota end eliminados_nota,
           case when n.fonte is null then m.total_eliminados else n.total_eliminados end total_eliminados,
           case when n.fonte is null then m.reprovados_analise else n.reprovados end reprovados_analise,
           case when n.fonte is null then m."TP_FONTE_FUNIL" else n.fonte end fonte,
           case when n.fonte is null then m."DT_FONTE_FUNIL" else n.em end em,
           case when n.tem_aprovados then n.aprovados else m.aprovados_analise end aprovados_analise,
           coalesce(n.entrevistados, m.entrevistados) entrevistados,
           coalesce(n.contratados, m.contratados) contratados
      from novo n
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = n.id
  )
  update public."TB_MONITORAMENTO_INDIGENA" m
     set inscritos = f.inscritos,
         aptos_analise = f.aptos_analise,
         cancelados = f.cancelados,
         eliminados_nota = f.eliminados_nota,
         total_eliminados = f.total_eliminados,
         reprovados_analise = f.reprovados_analise,
         "TP_FONTE_FUNIL" = f.fonte,
         "DT_FONTE_FUNIL" = f.em,
         aprovados_analise = f.aprovados_analise,
         entrevistados = f.entrevistados,
         contratados = f.contratados,
         updated_at = now()
    from final f
   where m.id = f.id
     and (m.inscritos, m.aptos_analise, m.cancelados, m.eliminados_nota, m.total_eliminados,
          m.reprovados_analise, m."TP_FONTE_FUNIL", m."DT_FONTE_FUNIL", m.aprovados_analise,
          m.entrevistados, m.contratados)
         is distinct from
         (f.inscritos, f.aptos_analise, f.cancelados, f.eliminados_nota, f.total_eliminados,
          f.reprovados_analise, f.fonte, f.em, f.aprovados_analise, f.entrevistados, f.contratados);
  get diagnostics v_qt = row_count;
  return v_qt;
end;
$function$;
comment on function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"() is
  'Recalcula os KPIs de todo edital ativo (TB_MONITORAMENTO_INDIGENA). O funil (inscritos, aptos, cancelados, eliminados, reprovados) vem de UMA fonte, na ordem: avaliação documental nativa (TB_PRE_CLASSIF_VAGA; sem ela, o último TH_INSCRICAO_VAGA_EDITAL), Seleção coerente (pelo id), análises (aptos = candidatos; inscritos nulo); com fonte, campo sem valor nela fica nulo; sem fonte, o funil não muda. Grava TP_FONTE_FUNIL e DT_FONTE_FUNIL. Aprovados: fichas (avaliação no MONITORA, pelo id) ou análises; entrevistados: pessoas distintas que compareceram (FC_ENTREVISTAS_VIGENTES); contratados: lista vigente. Só grava o que mudou; devolve quantos editais mudaram (20261022200000).';
revoke all on function private."FC_ATUALIZAR_KPIS_PELA_SELECAO"() from public, anon, authenticated;

-- 4. Convocar: a linha da planilha da mesma análise sai -----------------------------------------
CREATE OR REPLACE FUNCTION public.convocar_para_entrevista(p_edital uuid, p_lista uuid, p_analises uuid[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_ENTREVISTAS_EDITAL"(p_edital, 2);
  v_m public."TB_MONITORAMENTO_INDIGENA";
  v_roteiro uuid;
  v_vigente uuid;
  v_fora integer;
  v_qt integer;
begin
  select "CO_ROTEIRO" into v_roteiro from public."TB_ENTREVISTA_EDITAL" where "CO_MONITORAMENTO" = p_edital;
  if v_roteiro is null then raise exception 'Configure a entrevista do edital antes de convocar' using errcode = '23514'; end if;
  if coalesce(cardinality(p_analises), 0) not between 1 and 2000 then raise exception 'Escolha de 1 a 2000 candidatos' using errcode = '22023'; end if;

  -- Uma convocação por vez no edital; a tela tem de estar na lista vigente.
  perform pg_advisory_xact_lock(hashtextextended('convocacao_entrevista:' || p_edital::text, 0));
  v_vigente := private."FC_LISTA_CONVOCACAO_VIGENTE"(p_edital);
  if v_vigente is null then
    raise exception 'Gere a lista de convocação na Classificação antes de convocar' using errcode = '23514';
  end if;
  if p_lista is distinct from v_vigente then
    raise exception 'A lista de convocação mudou na Classificação; recarregue' using errcode = 'PT409';
  end if;
  select count(*) into v_fora
    from (select distinct x.analise from unnest(p_analises) x(analise)) s
   where s.analise is null
      or not exists (select 1 from private."FC_CONVOCADOS_DA_LISTA"(v_vigente) c(analise) where c.analise = s.analise);
  if v_fora > 0 then
    raise exception '% candidato(s) fora da lista de convocação vigente da Classificação', v_fora using errcode = '23514';
  end if;

  select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = p_edital;
  insert into public."TB_ENTREVISTA" as e ("CO_AREA", "CO_MONITORAMENTO", "CO_ANALISE_CURRICULAR", "TP_LIGACAO_ANALISE",
    "NO_UNIDADE", "DS_EDITAL", "CO_VAGA", "NO_CANDIDATO", "CO_CANDIDATO", "DS_MODALIDADE", "NO_CARGO", "TP_PARECER",
    "TP_ORIGEM", "DS_CHAVE_ORIGEM", "CO_ROTEIRO", "ST_ATIVO")
  select v_area, p_edital, a.id, 'codigo', left(coalesce(v_m.unidade, ''), 200), left(v_m.edital, 120), left(a.codigo_vaga, 60),
         left(a.candidato, 200), left(a.id_origem, 60), left(a.modalidade_concorrencia, 300), left(a.nome_vaga, 400), 'SEM_PARECER',
         'sistema', 'sistema|' || p_edital || '|' || a.id, v_roteiro, 'S'
    from public."TB_ANALISE_CURRICULAR" a
   where a.id = any (p_analises) and a."CO_AREA" = v_area
     and private."FC_NUMERO_EDITAL"(a.edital) = private."FC_NUMERO_EDITAL"(v_m.edital)
  on conflict ("DS_CHAVE_ORIGEM") do update set "ST_ATIVO" = 'S', "CO_ROTEIRO" = excluded."CO_ROTEIRO", "DT_ATUALIZACAO" = now();
  get diagnostics v_qt = row_count;

  insert into public."TH_ENTREVISTA_AVALIACAO" ("CO_ENTREVISTA", "DS_CAMPO", "DS_VALOR_NOVO", "CO_USUARIO")
  select e."CO_ENTREVISTA", 'convocacao', 'convocado pela lista ' || v_vigente, (select auth.uid())
    from public."TB_ENTREVISTA" e where e."DS_CHAVE_ORIGEM" = any (select 'sistema|' || p_edital || '|' || x from unnest(p_analises) x);

  -- A linha da planilha da mesma análise não fica ativa ao lado da do sistema (20261022200000).
  perform private."FC_DESATIVAR_ENTREVISTAS_REPETIDAS"(v_area, p_edital, (select auth.uid()));

  return json_build_object('convocados', v_qt, 'lista', v_vigente, 'dados', public.obter_entrevistas_do_edital(p_edital));
end;
$function$;

-- 5. Fechamento da carga de entrevistas: edital ativo primeiro e sem repetidas -----------------
create or replace function public.finalizar_sync_entrevistas(p_sync text, p_area text, p_forcar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
set statement_timeout = '30s'
as $function$
declare
  v_sync public."TL_SYNC_ENTREVISTA";
  v_ativas integer;
  v_desativadas integer;
  v_repetidas integer;
  v_ligadas integer;
  v_sem_analise integer;
  v_sem_edital integer;
begin
  select * into v_sync from public."TL_SYNC_ENTREVISTA" s where s."CO_SYNC" = p_sync for update;
  if v_sync."CO_SYNC" is null or v_sync."CO_AREA" <> p_area or v_sync."TP_SITUACAO" <> 'EM_ANDAMENTO' then
    raise exception 'Carga % não encontrada, de outra área ou já fechada', p_sync using errcode = '22023';
  end if;

  select count(*) into v_ativas from public."TB_ENTREVISTA" e
   where e."CO_AREA" = p_area and e."TP_ORIGEM" = 'planilha' and e."ST_ATIVO" = 'S';
  if not coalesce(p_forcar, false) and v_ativas > 0 and v_sync."QT_LINHA" * 2 < v_ativas then
    update public."TL_SYNC_ENTREVISTA" set "TP_SITUACAO" = 'RECUSADA', "DT_FIM" = now(),
      "DS_MENSAGEM" = format('Carga com %s linhas e %s ativas no banco: menos da metade. Nada foi desativado; confira a planilha ou rode com forçar.', v_sync."QT_LINHA", v_ativas)
     where "CO_SYNC" = p_sync;
    return jsonb_build_object('situacao', 'RECUSADA', 'linhas', v_sync."QT_LINHA", 'ativas', v_ativas);
  end if;

  update public."TB_ENTREVISTA" e set "ST_ATIVO" = 'N', "DT_ATUALIZACAO" = now()
   where e."CO_AREA" = p_area and e."TP_ORIGEM" = 'planilha' and e."ST_ATIVO" = 'S'
     and e."CO_SYNC" is distinct from p_sync;
  get diagnostics v_desativadas = row_count;

  -- Edital: número + área; com mais de um, o ATIVO e, entre eles, o da mesma unidade (20261022200000).
  with ent as materialized (
    select e."CO_ENTREVISTA", e."CO_MONITORAMENTO",
           private."FC_NUMERO_EDITAL"(e."DS_EDITAL") as num,
           private."FC_TEXTO_BUSCA_RECURSO"(e."NO_UNIDADE") as uni
      from public."TB_ENTREVISTA" e
     where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
  ), m as materialized (
    select m1.id, private."FC_NUMERO_EDITAL"(m1.edital) as num,
           private."FC_TEXTO_BUSCA_RECURSO"(m1.unidade) as uni, m1.ativo
      from public."TB_MONITORAMENTO_INDIGENA" m1
     where m1."CO_AREA" = p_area
  ), alvo as (
    select distinct on (ent."CO_ENTREVISTA") ent."CO_ENTREVISTA", ent."CO_MONITORAMENTO" as atual, m.id
      from ent
      left join m on m.num = ent.num
     order by ent."CO_ENTREVISTA", m.ativo desc nulls last, (m.uni = ent.uni) desc nulls last
  )
  update public."TB_ENTREVISTA" e set "CO_MONITORAMENTO" = alvo.id
    from alvo
   where e."CO_ENTREVISTA" = alvo."CO_ENTREVISTA"
     and alvo.atual is distinct from alvo.id;

  -- Análise: código do candidato + vaga; senão nome sem acento + vaga.
  with ent as materialized (
    select e."CO_ENTREVISTA", e."CO_ANALISE_CURRICULAR" as atual, e."TP_LIGACAO_ANALISE" as modo_atual,
           e."CO_VAGA", e."CO_CANDIDATO",
           private."FC_NUMERO_EDITAL"(e."DS_EDITAL") as num,
           private."FC_TEXTO_BUSCA_RECURSO"(e."NO_CANDIDATO") as nome
      from public."TB_ENTREVISTA" e
     where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
  ), an as materialized (
    select a.id, a.codigo_vaga, a.id_origem, a.ativo,
           private."FC_NUMERO_EDITAL"(a.edital) as num,
           private."FC_TEXTO_BUSCA_RECURSO"(a.candidato) as nome
      from public."TB_ANALISE_CURRICULAR" a
     where a."CO_AREA" = p_area
       and a.codigo_vaga in (select distinct ent."CO_VAGA" from ent)
  ), cand as (
    select ent."CO_ENTREVISTA", an.id,
           case when ent."CO_CANDIDATO" is not null and an.id_origem = ent."CO_CANDIDATO" then 'codigo' else 'nome' end as modo,
           an.num = ent.num as mesmo_edital, an.ativo
      from ent
      join an on an.codigo_vaga = ent."CO_VAGA"
             and ((ent."CO_CANDIDATO" is not null and an.id_origem = ent."CO_CANDIDATO") or an.nome = ent.nome)
  ), melhor as (
    select distinct on (c."CO_ENTREVISTA") c."CO_ENTREVISTA", c.id, c.modo
      from cand c
     order by c."CO_ENTREVISTA", (c.modo = 'codigo') desc, c.mesmo_edital desc nulls last, c.ativo desc
  ), alvo as (
    select ent."CO_ENTREVISTA", ent.atual, ent.modo_atual, melhor.id, melhor.modo
      from ent left join melhor on melhor."CO_ENTREVISTA" = ent."CO_ENTREVISTA"
  )
  update public."TB_ENTREVISTA" e set "CO_ANALISE_CURRICULAR" = alvo.id, "TP_LIGACAO_ANALISE" = alvo.modo
    from alvo
   where e."CO_ENTREVISTA" = alvo."CO_ENTREVISTA"
     and (alvo.atual is distinct from alvo.id or alvo.modo_atual is distinct from alvo.modo);

  -- A linha da planilha cuja análise já tem a entrevista do sistema sai (20261022200000).
  v_repetidas := private."FC_DESATIVAR_ENTREVISTAS_REPETIDAS"(p_area, null, null);

  select count(*) filter (where e."CO_ANALISE_CURRICULAR" is not null),
         count(*) filter (where e."CO_ANALISE_CURRICULAR" is null),
         count(*) filter (where e."CO_MONITORAMENTO" is null)
    into v_ligadas, v_sem_analise, v_sem_edital
    from public."TB_ENTREVISTA" e
   where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S';

  update public."TL_SYNC_ENTREVISTA" set
    "TP_SITUACAO" = 'CONCLUIDA', "DT_FIM" = now(),
    "QT_LIGADA_ANALISE" = v_ligadas, "QT_SEM_ANALISE" = v_sem_analise,
    "QT_SEM_EDITAL" = v_sem_edital, "QT_DESATIVADA" = v_desativadas + v_repetidas,
    "DS_MENSAGEM" = case when coalesce(p_forcar, false) then 'Fechada com forçar.' end
   where "CO_SYNC" = p_sync;

  return jsonb_build_object('situacao', 'CONCLUIDA', 'linhas', v_sync."QT_LINHA",
    'ligadas_analise', v_ligadas, 'sem_analise', v_sem_analise,
    'sem_edital', v_sem_edital, 'desativadas', v_desativadas, 'repetidas', v_repetidas);
end;
$function$;

-- 6. Pacote do Painel de entrevistas: a entrevista vigente, sem edital inativo -----------------
CREATE OR REPLACE FUNCTION private."FC_MONTAR_ENTREVISTAS_AREA"(p_area text, p_editais uuid[])
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return (
    with e as (
      select e.*
        from public."TB_ENTREVISTA" e
       where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
         and e."CO_ENTREVISTA" in (select v from private."FC_ENTREVISTAS_VIGENTES"(p_area) v)
         and not private."FC_EDITAL_EH_TREINAMENTO"(e."CO_MONITORAMENTO")
         and (e."CO_MONITORAMENTO" is null
              or exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                          where m.id = e."CO_MONITORAMENTO" and m.ativo))
         and (p_editais is null or e."CO_MONITORAMENTO" = any (p_editais))
    ),
    criterios as (
      select n."DS_CRITERIO" as criterio, row_number() over (order by min(n."NU_ORDEM"), n."DS_CRITERIO") - 1 as i
        from public."TB_ENTREVISTA_NOTA" n
        join e on e."CO_ENTREVISTA" = n."CO_ENTREVISTA"
       where n."VL_NOTA" is not null
       group by n."DS_CRITERIO"
    ),
    vagas as (
      select distinct e."CO_VAGA" from e
    ),
    sem_entrevista as (
      select a.id, a.candidato, a.id_origem, a.codigo_vaga, a.nome_vaga, a.edital, a.unidade,
             a.nota_final_ajustada, a.modalidade_concorrencia
        from public."TB_ANALISE_CURRICULAR" a
        join vagas v on v."CO_VAGA" = a.codigo_vaga
       where a."CO_AREA" = p_area and a.ativo
         and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
         and a.status_consolidado = 'Aprovado'
         and not exists (select 1 from public."TB_ENTREVISTA" x
                          where x."CO_ANALISE_CURRICULAR" = a.id and x."ST_ATIVO" = 'S')
         and (p_editais is null or exists (
               select 1 from public."TB_MONITORAMENTO_INDIGENA" m
                where m.id = any (p_editais) and m."CO_AREA" = a."CO_AREA"
                  and private."FC_NUMERO_EDITAL"(m.edital) = private."FC_NUMERO_EDITAL"(a.edital)))
       order by a.edital, a.codigo_vaga, a.candidato
       limit 3000
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'gerado_em', now(),
      'ultima_carga', (
        select json_build_object('em', s."DT_FIM", 'linhas', s."QT_LINHA",
                                 'ligadas_analise', s."QT_LIGADA_ANALISE",
                                 'sem_analise', s."QT_SEM_ANALISE", 'sem_edital', s."QT_SEM_EDITAL")
          from public."TL_SYNC_ENTREVISTA" s
         where s."CO_AREA" = p_area and s."TP_SITUACAO" = 'CONCLUIDA'
         order by s."DT_FIM" desc limit 1
      ),
      'criterios', (select coalesce(json_agg(c.criterio order by c.i), '[]'::json) from criterios c),
      'entrevistas', (
        select coalesce(json_agg(json_build_object(
            'id', e."CO_ENTREVISTA",
            'edital_id', e."CO_MONITORAMENTO",
            'edital', coalesce(m.edital, e."DS_EDITAL"),
            'edital_planilha', e."DS_EDITAL",
            'unidade', coalesce(m.unidade, e."NO_UNIDADE"),
            'vaga', e."CO_VAGA",
            'cargo', coalesce(a.nome_vaga, e."NO_CARGO"),
            'candidato', e."NO_CANDIDATO",
            'codigo', e."CO_CANDIDATO",
            'modalidade', coalesce(a.modalidade_concorrencia, e."DS_MODALIDADE"),
            'nota', e."VL_NOTA_TOTAL",
            'parecer', e."TP_PARECER",
            'compareceu', e."ST_COMPARECEU",
            'origem', e."TP_ORIGEM",
            'atualizado_em', e."DT_ATUALIZACAO",
            'link', e."DS_LINK_PLANILHA",
            'notas', (
              select coalesce(json_agg(json_build_array(c.i, n."VL_NOTA") order by n."NU_ORDEM"), '[]'::json)
                from public."TB_ENTREVISTA_NOTA" n
                join criterios c on c.criterio = n."DS_CRITERIO"
               where n."CO_ENTREVISTA" = e."CO_ENTREVISTA" and n."VL_NOTA" is not null
            ),
            'analise', case when a.id is null then null else json_build_object(
              'id', a.id,
              'ligacao', e."TP_LIGACAO_ANALISE",
              'nota', a.nota_final_ajustada,
              'resultado', a.status_consolidado,
              'etapa', a.etapa,
              'responsavel', a.responsavel_analise,
              'ativo', a.ativo
            ) end
          ) order by coalesce(m.edital, e."DS_EDITAL"), e."CO_VAGA", e."VL_NOTA_TOTAL" desc nulls last, e."NO_CANDIDATO"), '[]'::json)
          from e
          left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = e."CO_MONITORAMENTO"
          left join public."TB_ANALISE_CURRICULAR" a on a.id = e."CO_ANALISE_CURRICULAR"
      ),
      'aprovados_sem_entrevista', (
        select coalesce(json_agg(json_build_object(
            'analise_id', s.id,
            'candidato', s.candidato,
            'codigo', s.id_origem,
            'vaga', s.codigo_vaga,
            'cargo', s.nome_vaga,
            'edital', s.edital,
            'unidade', s.unidade,
            'nota', s.nota_final_ajustada,
            'modalidade', s.modalidade_concorrencia
          )), '[]'::json)
          from sem_entrevista s
      )
    )
  );
end;
$function$;

-- 7. Seleção: trava do #2 também pelo código e convocados sem duplicata ---------------------------
create or replace function public.get_selecao_da_area(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_editais uuid[];
begin
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = p_area) then
    raise exception 'Área inválida' using errcode = '22023';
  end if;
  if not private.pode_recurso('selecao', 1) then
    raise exception 'Sem permissão para Seleção' using errcode = '42501';
  end if;
  if not private."FC_PODE_AREA"(p_area) then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];

  return (
    with s as (
      select s.*, private."FC_NUMERO_EDITAL"(s."DS_EDITAL") as numero
        from public."TB_SELECAO_VAGA" s
       where s."CO_AREA" = p_area and s."ST_REGISTRO_ATIVO" = 'S'
         and (v_editais is null or s."CO_MONITORAMENTO" = any (v_editais))
    ),
    -- Convocados: a entrevista vigente de cada pessoa (FC_ENTREVISTAS_VIGENTES) por edital e vaga.
    convocados as (
      select private."FC_NUMERO_EDITAL"(e."DS_EDITAL") as numero, e."CO_VAGA" as vaga, count(*)::integer as qt
        from public."TB_ENTREVISTA" e
       where e."CO_AREA" = p_area and e."ST_ATIVO" = 'S'
         and e."CO_ENTREVISTA" in (select v from private."FC_ENTREVISTAS_VIGENTES"(p_area) v)
       group by 1, 2
    ),
    editais_com_entrevista as (
      select distinct c.numero from convocados c where c.numero is not null
    ),
    -- Lista de aprovados vigente dos editais ligados.
    listas as (
      select l.id, l.edital_id
        from public."TB_LISTA_APROVADO" l
       where l.vigente is true
         and l.edital_id in (select s."CO_MONITORAMENTO"::text from s where s."CO_MONITORAMENTO" is not null)
    ),
    aprovados as (
      select l.edital_id, regexp_replace(coalesce(c.codigo_vaga, ''), '[^0-9]', '', 'g') as vaga,
             count(*)::integer as total,
             (count(*) filter (where c.status in ('Contratado', 'Migração')))::integer as contratados
        from listas l
        join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
       group by 1, 2
    ),
    -- Outras bancas (CESPE, FGV…): sem código numérico, o "id da vaga" da lista é
    -- o nome do cargo. Chave: o texto sem acento, caixa nem pontuação.
    aprovados_por_cargo as (
      select l.edital_id,
             btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(c.codigo_vaga), '[^a-z0-9]+', ' ', 'g')) as cargo,
             count(*)::integer as total,
             (count(*) filter (where c.status in ('Contratado', 'Migração')))::integer as contratados
        from listas l
        join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id and c.removido_em is null
       group by 1, 2
    ),
    linhas as (
      select s.*,
             m.edital as edital_cadastrado,
             (s.numero is not null and s.numero in (select x.numero from editais_com_entrevista x)) as usa_entrevistas,
             cv.qt as qt_convocado_entrevistas,
             exists (select 1 from listas l where l.edital_id = s."CO_MONITORAMENTO"::text) as tem_lista,
             coalesce(ap.total, apc.total) as qt_aprovado,
             coalesce(ap.contratados, apc.contratados) as qt_contratado
        from s
        left join public."TB_MONITORAMENTO_INDIGENA" m on m.id = s."CO_MONITORAMENTO"
        left join convocados cv on cv.numero = s.numero and cv.vaga = s."CO_VAGA"
        -- A 2ª vaga de mesmo código (chave com #2…) não recebe de novo os mesmos aprovados (20261022200000).
        left join aprovados ap
          on ap.edital_id = s."CO_MONITORAMENTO"::text and ap.vaga = s."CO_VAGA"
         and s."DS_CHAVE_ORIGEM" !~ '#[0-9]+$'
        -- Vaga sem código (outra banca): pelo nome do cargo; a 2ª vaga de mesmo nome
        -- (chave com #2…) não recebe de novo os mesmos aprovados.
        left join aprovados_por_cargo apc
          on s."CO_VAGA" is null
         and s."DS_CHAVE_ORIGEM" !~ '#[0-9]+$'
         and apc.edital_id = s."CO_MONITORAMENTO"::text
         and apc.cargo = btrim(regexp_replace(private."FC_TEXTO_BUSCA_RECURSO"(s."DS_VAGA_PLANILHA"), '[^a-z0-9]+', ' ', 'g'))
    )
    select json_build_object(
      'schema_version', 1,
      'area', p_area,
      'gerado_em', now(),
      'ultima_carga', (
        select json_build_object('em', t."DT_FIM", 'linhas', t."QT_LINHA", 'sem_edital', t."QT_SEM_EDITAL")
          from public."TL_SYNC_SELECAO" t
         where t."TP_SITUACAO" = 'CONCLUIDA'
         order by t."DT_FIM" desc limit 1
      ),
      'vagas', (
        select coalesce(json_agg(json_build_object(
            'id', l."CO_SELECAO_VAGA",
            'edital_id', l."CO_MONITORAMENTO",
            'edital', coalesce(l.edital_cadastrado, l."DS_EDITAL"),
            'edital_planilha', l."DS_EDITAL",
            'unidade', l."NO_UNIDADE",
            'vaga', l."CO_VAGA",
            'vaga_planilha', l."DS_VAGA_PLANILHA",
            'cargo', l."NO_CARGO",
            'inscritos', l."QT_INSCRITO",
            'aptos', l."QT_APTO_ANALISE",
            'cancelados', l."QT_CANCELADO",
            'reprovados_questionario', l."QT_REPROVADO_QUESTIONARIO",
            'eliminados_nota', l."QT_ELIMINADO_NOTA",
            'reprovados_analise', l."QT_REPROVADO_ANALISE",
            'triados', l."QT_TRIADO",
            'total_eliminados', l."QT_TOTAL_ELIMINADO",
            'observacao', l."DS_OBSERVACAO",
            'convocados', case when l.usa_entrevistas then coalesce(l.qt_convocado_entrevistas, 0)
                               else l."QT_CONVOCADO_PLANILHA" end,
            'origem_convocados', case when l.usa_entrevistas then 'entrevistas' else 'planilha' end,
            'aprovados', case when l.tem_lista then coalesce(l.qt_aprovado, 0) end,
            'contratados', case when l.tem_lista then coalesce(l.qt_contratado, 0) end,
            'nao_contratados', case when l.tem_lista then coalesce(l.qt_aprovado, 0) - coalesce(l.qt_contratado, 0) end
          ) order by coalesce(l.edital_cadastrado, l."DS_EDITAL"), l."NO_UNIDADE", l."NO_CARGO", l."CO_VAGA"), '[]'::json)
          from linhas l
      )
    )
  );
end;
$function$;
comment on function public.get_selecao_da_area(text) is
  'Leitura da aba Seleção de uma área (json): o funil de cada vaga (aba Resultado da Auditoria), os convocados (entrevistas vigentes, FC_ENTREVISTAS_VIGENTES, quando o edital tem entrevista; senão o V da planilha) e aprovados/contratados/não contratados da lista vigente (a 2ª vaga de mesmo código ou cargo não repete os aprovados). Exige selecao >= leitor, a área e o recorte da coordenação.';

-- 8. Ligar a Seleção aos editais: o edital ativo primeiro --------------------------------------
create or replace function private."FC_LIGAR_SELECAO_AOS_EDITAIS"()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_qt integer;
begin
  with m as materialized (
    select m.id, m."CO_AREA" as area, m.ativo,
           private."FC_NUMERO_EDITAL"(m.edital) as numero,
           private."FC_TEXTO_BUSCA_RECURSO"(m.unidade) as unidade
      from public."TB_MONITORAMENTO_INDIGENA" m
     where private."FC_NUMERO_EDITAL"(m.edital) is not null
  ),
  u as materialized (
    select private."FC_TEXTO_BUSCA_RECURSO"(u."NO_UNIDADE") as unidade, u."CO_AREA" as area
      from public."TA_UNIDADE_AREA" u
  ),
  s as materialized (
    select s."CO_SELECAO_VAGA" as id,
           private."FC_NUMERO_EDITAL"(s."DS_EDITAL") as numero,
           private."FC_TEXTO_BUSCA_RECURSO"(s."NO_UNIDADE") as unidade,
           private."FC_TEXTO_BUSCA_RECURSO"(s."NO_UNIDADE") ~ '^(dsei|casai)( |$)' as indigena
      from public."TB_SELECAO_VAGA" s
     where s."ST_REGISTRO_ATIVO" = 'S'
  ),
  com_tabela as (
    select s.*, (select u.area from u where u.unidade = s.unidade limit 1) as area_tabela
      from s
  ),
  alvo as (
    select c.id,
           e.id as edital_id,
           case when c.indigena then 'saude-indigena'
                else coalesce(e.area, c.area_tabela, 'sede') end as area
      from com_tabela c
      left join lateral (
        select m.id, m.area from m
         where c.numero is not null and m.numero = c.numero
           and (case when c.indigena then m.area = 'saude-indigena'
                     else m.area <> 'saude-indigena' end)
         order by m.ativo desc,
                  (m.unidade = c.unidade) desc,
                  (m.area = c.area_tabela) desc
         limit 1
      ) e on true
  )
  update public."TB_SELECAO_VAGA" s set
    "CO_MONITORAMENTO" = alvo.edital_id,
    "CO_AREA" = alvo.area
    from alvo
   where s."CO_SELECAO_VAGA" = alvo.id
     and (s."CO_MONITORAMENTO" is distinct from alvo.edital_id
          or s."CO_AREA" is distinct from alvo.area);
  get diagnostics v_qt = row_count;
  return v_qt;
end;
$function$;
comment on function private."FC_LIGAR_SELECAO_AOS_EDITAIS"() is
  'Liga cada vaga ativa de TB_SELECAO_VAGA ao edital cadastrado e acerta a área: DSEI/CASAI só na Saúde Indígena; as outras unidades só na SEDE ou em Projetos (edital de mesmo número: o ativo primeiro, depois a mesma unidade e a área de TA_UNIDADE_AREA; sem edital, TA_UNIDADE_AREA ou sede). Devolve quantas linhas mudaram.';

-- 9. A fonte do funil na leitura do monitoramento ----------------------------------------------
create or replace view public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL"
with (security_invoker = true) as
 SELECT m.id,
    m.processo,
    m.edital,
    m.id_unidade,
    m.sigla_unidade,
    m.tipo_unidade,
    m.unidade,
    m.uf,
    m.ciclo,
    m.cargos,
    m.vagas_total,
    m.inscritos,
    m.aptos_analise,
    m.cancelados,
    m.eliminados_nota,
    m.reprovados_analise,
    m.total_eliminados,
    m.aprovados_analise,
    m.aprovados_prova,
    m.entrevistados,
    m.contratados,
    m.vagas_ociosas,
    COALESCE((estado.estado ->> 'data_inicio'::text)::date, m.data_inicio) AS data_inicio,
    COALESCE((estado.estado ->> 'data_fim'::text)::date, m.data_fim) AS data_fim,
    COALESCE(estado.estado ->> 'status'::text, m.status, ''::text) AS status,
    COALESCE(estado.estado ->> 'etapa'::text, m.etapa, ''::text) AS etapa,
    m.risco,
    m.responsavel,
    m.link_edital,
    m.observacoes,
    m.observacoes_internas,
    m.ativo,
    m.created_by,
    m.updated_by,
    m.created_at,
    m.updated_at,
    m.quantidade_cadastro_reserva,
    m.dias_ate_encerramento,
    m.duracao_total_processo,
    m.origem_carga,
    m.raw_json,
    m.cronograma_automatico,
    m.cronograma_pdf_path,
    m.cronograma_pdf_nome,
    m.cronograma_origem,
    m.cronograma_revisado_at,
    m.cronograma_revisado_por,
    m.status_override,
    m.etapa_override,
    COALESCE((estado.estado ->> 'percentual'::text)::numeric, 0::numeric) AS cronograma_percentual,
    estado.estado ->> 'atividade_atual'::text AS cronograma_atividade_atual,
    estado.estado ->> 'proxima_atividade'::text AS cronograma_proxima_atividade,
    (estado.estado ->> 'proxima_data'::text)::date AS cronograma_proxima_data,
    (estado.estado ->> 'dias_para_proxima'::text)::integer AS cronograma_dias_para_proxima,
    m."CO_AREA",
    m."ST_TREINAMENTO",
    m."TP_FONTE_FUNIL",
    m."DT_FONTE_FUNIL"
   FROM public."TB_MONITORAMENTO_INDIGENA" m
     CROSS JOIN LATERAL public.get_monitoramento_cronograma_estado(m.id, CURRENT_DATE) estado(estado);

create or replace function public.listar_monitoramento_operacional(p_versao text default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private."FC_SE_MUDOU"(jsonb_build_object('linhas', coalesce((
    select jsonb_agg(to_jsonb(l) order by l.unidade, l.edital)
      from (
        select v.aprovados_analise, v.aprovados_prova, v.aptos_analise, v.ativo,
               v.cancelados, v.cargos, v.ciclo, v.contratados,
               v.cronograma_atividade_atual, v.cronograma_automatico,
               v.cronograma_dias_para_proxima, v.cronograma_percentual,
               v.cronograma_proxima_atividade, v.cronograma_proxima_data,
               v.data_fim, v.data_inicio, v.edital, v.eliminados_nota,
               v.entrevistados, v.etapa, v.id, v.id_unidade, v.inscritos,
               v.link_edital, v.observacoes, v.observacoes_internas, v.processo,
               v.reprovados_analise, v.responsavel, v.risco, v.sigla_unidade,
               v.status, v.tipo_unidade, v.total_eliminados, v.uf, v.unidade,
               v.vagas_ociosas, v.vagas_total, v."CO_AREA", v."ST_TREINAMENTO",
               v."TP_FONTE_FUNIL", v."DT_FONTE_FUNIL"
          from public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL" v
         where v.ativo is true
      ) l), '[]'::jsonb)), p_versao);
$$;

-- 10. Os números de hoje, com a regra nova -----------------------------------------------------
select private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();

-- 11. Aptos nunca acima dos inscritos (só se o recálculo deixou tudo coerente) ------------------
do $$
declare
  v_ruins text;
begin
  select string_agg(m.edital || ' (' || m."CO_AREA" || '): ' || m.aptos_analise || ' aptos > ' || m.inscritos || ' inscritos', '; ')
    into v_ruins
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.ativo is true and m.aptos_analise > m.inscritos;
  if v_ruins is not null then
    raise exception 'Editais ativos ainda com aptos > inscritos depois do recálculo: %', v_ruins;
  end if;
end;
$$;
alter table public."TB_MONITORAMENTO_INDIGENA"
  drop constraint if exists "CK_MONIT_INDIG_APTOS_INSCRITOS";
alter table public."TB_MONITORAMENTO_INDIGENA"
  add constraint "CK_MONIT_INDIG_APTOS_INSCRITOS" check (
    ativo is not true or aptos_analise is null or inscritos is null or aptos_analise <= inscritos);
comment on constraint "CK_MONIT_INDIG_APTOS_INSCRITOS" on public."TB_MONITORAMENTO_INDIGENA" is
  'Edital ativo com aptos e inscritos: aptos <= inscritos (o funil vem de uma fonte só, FC_ATUALIZAR_KPIS_PELA_SELECAO, 20261022200000).';

-- 12. O pacote das entrevistas remonta na próxima rodada ------------------------------------------
select private."FC_MARCAR_CACHE"(array['ENTREVISTAS'], array(select a."CO_AREA" from public."TB_AREA" a),
                                 'migration 20261022200000');

-- Tempos: o recálculo inteiro de novo (nada muda, mas lê todas as fontes) e o pacote de cada área.
do $tempo$
declare
  v_ini timestamptz;
  v_area text;
begin
  v_ini := clock_timestamp();
  perform private."FC_ATUALIZAR_KPIS_PELA_SELECAO"();
  insert into t_tempo values ('FC_ATUALIZAR_KPIS_PELA_SELECAO', (extract(epoch from clock_timestamp() - v_ini) * 1000)::integer);
  for v_area in select a."CO_AREA" from public."TB_AREA" a order by 1 loop
    v_ini := clock_timestamp();
    perform private."FC_MONTAR_ENTREVISTAS_AREA"(v_area, null);
    insert into t_tempo values ('FC_MONTAR_ENTREVISTAS_AREA:' || v_area, (extract(epoch from clock_timestamp() - v_ini) * 1000)::integer);
  end loop;
end;
$tempo$;

do $ensaio$
declare
  v_qt integer;
  v_area text;
  v_pacote json;
begin
  select count(*) into v_qt from public."TB_MONITORAMENTO_INDIGENA" m
   where m.ativo and m.aptos_analise > m.inscritos;
  assert v_qt = 0, format('%s editais ativos com aptos > inscritos', v_qt);
  assert exists (select 1 from pg_constraint where conname = 'CK_MONIT_INDIG_APTOS_INSCRITOS'),
    'a restrição de aptos <= inscritos não foi criada';
  -- Com fonte, o funil é todo dela: ANALISES não tem inscritos; a avaliação nativa não elimina por nota.
  select count(*) into v_qt from public."TB_MONITORAMENTO_INDIGENA" m
   where m.ativo and m."TP_FONTE_FUNIL" = 'ANALISES' and m.inscritos is not null;
  assert v_qt = 0, format('%s editais com fonte ANALISES e inscritos', v_qt);
  select count(*) into v_qt from public."TB_MONITORAMENTO_INDIGENA" m
   where m.ativo and m."TP_FONTE_FUNIL" = 'AVALIACAO_DOCUMENTAL' and m.eliminados_nota is not null;
  assert v_qt = 0, format('%s editais nativos com eliminados por nota', v_qt);
  -- A entrevista vigente: uma por análise.
  select count(*) into v_qt from (
    select e."CO_ANALISE_CURRICULAR" from public."TB_ENTREVISTA" e
     where e."CO_ENTREVISTA" in (select v from private."FC_ENTREVISTAS_VIGENTES"(null) v)
       and e."CO_ANALISE_CURRICULAR" is not null
     group by 1 having count(*) > 1) x;
  assert v_qt = 0, format('%s análises com mais de uma entrevista vigente', v_qt);
  -- O pacote de cada área: sem análise repetida e sem edital inativo.
  for v_area in select a."CO_AREA" from public."TB_AREA" a loop
    v_pacote := private."FC_MONTAR_ENTREVISTAS_AREA"(v_area, null);
    select count(*) into v_qt from (
      select x -> 'analise' ->> 'id' from json_array_elements(v_pacote -> 'entrevistas') x
       where x -> 'analise' ->> 'id' is not null
       group by x -> 'analise' ->> 'id' having count(*) > 1) r;
    assert v_qt = 0, format('pacote %s com %s análises repetidas', v_area, v_qt);
    select count(*) into v_qt from json_array_elements(v_pacote -> 'entrevistas') x
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = (x ->> 'edital_id')::uuid
     where not m.ativo;
    assert v_qt = 0, format('pacote %s com %s entrevistas de edital inativo', v_area, v_qt);
  end loop;
  select max(ms) into v_qt from t_tempo where etapa = 'FC_ATUALIZAR_KPIS_PELA_SELECAO';
  assert v_qt < 8000, format('recálculo levou %s ms (corte de 8 s)', v_qt);
end;
$ensaio$;

-- Resultado: tempos, editais por fonte e o que mudou (só contagens e números de edital).
select json_build_object(
  'tempos_ms', (select json_object_agg(t.etapa, t.ms order by t.etapa) from t_tempo t),
  'editais_por_fonte', (
    select json_object_agg(coalesce(x.fonte, 'sem fonte'), x.qt)
      from (select m."TP_FONTE_FUNIL" fonte, count(*) qt from public."TB_MONITORAMENTO_INDIGENA" m
             where m.ativo group by 1) x),
  'antes_aptos_maior_que_inscritos', (select count(*) from t_antes a where a.aptos_analise > a.inscritos),
  'antes_aprovados_maior_que_aptos', (select count(*) from t_antes a where a.aprovados_analise > a.aptos_analise),
  'depois_aprovados_maior_que_aptos', (select count(*) from public."TB_MONITORAMENTO_INDIGENA" m
                                       where m.ativo and m.aprovados_analise > m.aptos_analise),
  'antes_entrevistados_maior_que_inscritos', (select count(*) from t_antes a where a.entrevistados > a.inscritos),
  'depois_entrevistados_maior_que_inscritos', (select count(*) from public."TB_MONITORAMENTO_INDIGENA" m
                                               where m.ativo and m.entrevistados > m.inscritos),
  'mudancas', (
    select coalesce(json_agg(json_build_object(
             'edital', a.edital, 'area', a.area, 'fonte', m."TP_FONTE_FUNIL",
             'inscritos', json_build_array(a.inscritos, m.inscritos),
             'aptos', json_build_array(a.aptos_analise, m.aptos_analise),
             'cancelados', json_build_array(a.cancelados, m.cancelados),
             'eliminados_nota', json_build_array(a.eliminados_nota, m.eliminados_nota),
             'total_eliminados', json_build_array(a.total_eliminados, m.total_eliminados),
             'reprovados', json_build_array(a.reprovados_analise, m.reprovados_analise),
             'aprovados', json_build_array(a.aprovados_analise, m.aprovados_analise),
             'entrevistados', json_build_array(a.entrevistados, m.entrevistados))
             order by a.area, a.edital), '[]'::json)
      from t_antes a
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = a.id
     where (a.inscritos, a.aptos_analise, a.cancelados, a.eliminados_nota, a.total_eliminados,
            a.reprovados_analise, a.aprovados_analise, a.entrevistados)
           is distinct from
           (m.inscritos, m.aptos_analise, m.cancelados, m.eliminados_nota, m.total_eliminados,
            m.reprovados_analise, m.aprovados_analise, m.entrevistados))
) as resultado;

rollback;
