/*
  ENSAIO de 20261113210000_admissoes_conciliadas_e_ciclo_na_visao_geral: aplica, confere e testa a carga; termina em rollback.
*/
begin;

set local lock_timeout = '5s';

do $guarda$
declare
  v_md5 text := md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_acompanhamento_da_visao_geral(text)')), chr(13), ''));
begin
  if to_regclass('public."TB_ADMISSAO_CONCILIADA"') is not null or v_md5 = '488c5da46e823a31ebffe55052af7bee' then
    raise exception 'A migration 20261113210000 já foi aplicada.';
  end if;
  if v_md5 is distinct from '1b38c7dbeb75abac997b64cc14186865' then
    raise exception 'listar_acompanhamento_da_visao_geral mudou depois de 13/11/2026 (md5 %): junte as mudanças antes de aplicar.', v_md5;
  end if;
end;
$guarda$;

-- 1. A tabela
create table public."TB_ADMISSAO_CONCILIADA" (
  "CO_VINCULO" varchar(40) not null,
  "CO_MONITORAMENTO" uuid not null,
  "CO_CANDIDATO_APROVADO" uuid,
  "DT_ADMISSAO" date not null,
  "DT_DESLIGAMENTO" date,
  "CO_CARGA" varchar(60) not null,
  "DT_CARGA" timestamptz not null default now(),
  constraint "PK_ADMISSAO_CONCILIADA" primary key ("CO_VINCULO"),
  constraint "FK_MONITORAMENTO_ADMISCONCIL" foreign key ("CO_MONITORAMENTO")
    references public."TB_MONITORAMENTO_INDIGENA" (id) on delete cascade,
  constraint "CK_ADMISCONCIL_COVINCULO" check ("CO_VINCULO" ~ '^[0-9a-f]{8,40}$'),
  constraint "CK_ADMISCONCIL_DTADMISSAO" check ("DT_ADMISSAO" between date '2015-01-01' and date '2100-12-31'),
  constraint "CK_ADMISCONCIL_DTDESLIGAMENTO" check ("DT_DESLIGAMENTO" is null or "DT_DESLIGAMENTO" >= "DT_ADMISSAO"),
  constraint "CK_ADMISCONCIL_COCARGA" check (length(btrim("CO_CARGA")) between 1 and 60)
);
create index "IN_ADMISCONCIL_MONITORAMENTO" on public."TB_ADMISSAO_CONCILIADA" ("CO_MONITORAMENTO", "DT_ADMISSAO");

alter table public."TB_ADMISSAO_CONCILIADA" enable row level security;
revoke all on table public."TB_ADMISSAO_CONCILIADA" from public, anon, authenticated;

comment on table public."TB_ADMISSAO_CONCILIADA" is 'Admissões conciliadas com o RH (Impacto), uma por vínculo, carregadas da aba "Vínculos conciliados" das planilhas de conciliação (carregar_admissoes_conciliadas). Sem nome, CPF nem matrícula. A Visão geral mostra a 1ª e a última admissão de cada edital (20261113210000). Só a service_role grava; a leitura é pela RPC.';
comment on column public."TB_ADMISSAO_CONCILIADA"."CO_VINCULO" is 'Token do vínculo na planilha de conciliação (hexadecimal; não identifica a pessoa).';
comment on column public."TB_ADMISSAO_CONCILIADA"."CO_MONITORAMENTO" is 'Edital (TB_MONITORAMENTO_INDIGENA) a que o vínculo foi atribuído.';
comment on column public."TB_ADMISSAO_CONCILIADA"."CO_CANDIDATO_APROVADO" is 'Linha da lista de aprovados (TB_CANDIDATO_APROVADO) que a conciliação ligou ao vínculo. Sem chave estrangeira: a linha some quando a lista é trocada.';
comment on column public."TB_ADMISSAO_CONCILIADA"."DT_ADMISSAO" is 'Data de admissão no RH (Impacto).';
comment on column public."TB_ADMISSAO_CONCILIADA"."DT_DESLIGAMENTO" is 'Data de desligamento no RH, se houver.';
comment on column public."TB_ADMISSAO_CONCILIADA"."CO_CARGA" is 'Identificador da carga que gravou a linha (o script de carga põe a data).';
comment on column public."TB_ADMISSAO_CONCILIADA"."DT_CARGA" is 'Quando a linha foi gravada ou mudou pela última vez.';
comment on constraint "PK_ADMISSAO_CONCILIADA" on public."TB_ADMISSAO_CONCILIADA" is 'Um registro por vínculo.';
comment on constraint "FK_MONITORAMENTO_ADMISCONCIL" on public."TB_ADMISSAO_CONCILIADA" is 'O edital existe; apagado o edital, saem as admissões.';
comment on constraint "CK_ADMISCONCIL_COVINCULO" on public."TB_ADMISSAO_CONCILIADA" is 'Token hexadecimal de 8 a 40 caracteres.';
comment on constraint "CK_ADMISCONCIL_DTADMISSAO" on public."TB_ADMISSAO_CONCILIADA" is 'Data de admissão plausível.';
comment on constraint "CK_ADMISCONCIL_DTDESLIGAMENTO" on public."TB_ADMISSAO_CONCILIADA" is 'Desligamento não antes da admissão.';
comment on constraint "CK_ADMISCONCIL_COCARGA" on public."TB_ADMISSAO_CONCILIADA" is 'Carga de 1 a 60 caracteres.';
comment on index public."IN_ADMISCONCIL_MONITORAMENTO" is 'A 1ª e a última admissão por edital (listar_acompanhamento_da_visao_geral).';

-- 2. A carga
create function public.carregar_admissoes_conciliadas(p_carga text, p_linhas jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_carga text := btrim(coalesce(p_carga, ''));
  v_recebidas integer;
  v_sem_edital integer;
  v_removidas integer;
  v_gravadas integer;
begin
  if v_carga = '' or length(v_carga) > 60 then
    raise exception 'Informe a carga (1 a 60 caracteres).' using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) = 0 then
    raise exception 'A carga veio sem linhas.' using errcode = '22023';
  end if;

  drop table if exists pg_temp.tmp_admissao;
  create temporary table tmp_admissao on commit drop as
  select btrim(x.vinculo) as vinculo, x.edital, x.linha, x.admissao, x.desligamento
    from jsonb_to_recordset(p_linhas) as x(vinculo text, edital uuid, linha uuid, admissao date, desligamento date);
  get diagnostics v_recebidas = row_count;

  if exists (select 1 from tmp_admissao group by vinculo having count(*) > 1) then
    raise exception 'A carga tem vínculo repetido.' using errcode = '22023';
  end if;
  if exists (select 1 from tmp_admissao where vinculo is null or edital is null or admissao is null) then
    raise exception 'Toda linha precisa de vínculo, edital e data de admissão.' using errcode = '22023';
  end if;

  delete from tmp_admissao t
   where not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = t.edital);
  get diagnostics v_sem_edital = row_count;

  -- A planilha de conciliação é o retrato inteiro: o que saiu dela sai daqui.
  delete from public."TB_ADMISSAO_CONCILIADA" a
   where not exists (select 1 from tmp_admissao t where t.vinculo = a."CO_VINCULO");
  get diagnostics v_removidas = row_count;

  insert into public."TB_ADMISSAO_CONCILIADA" as a
         ("CO_VINCULO", "CO_MONITORAMENTO", "CO_CANDIDATO_APROVADO", "DT_ADMISSAO", "DT_DESLIGAMENTO", "CO_CARGA")
  select t.vinculo, t.edital, t.linha, t.admissao, t.desligamento, v_carga from tmp_admissao t
  on conflict ("CO_VINCULO") do update
     set "CO_MONITORAMENTO" = excluded."CO_MONITORAMENTO",
         "CO_CANDIDATO_APROVADO" = excluded."CO_CANDIDATO_APROVADO",
         "DT_ADMISSAO" = excluded."DT_ADMISSAO",
         "DT_DESLIGAMENTO" = excluded."DT_DESLIGAMENTO",
         "CO_CARGA" = excluded."CO_CARGA",
         "DT_CARGA" = now()
   where (a."CO_MONITORAMENTO", a."CO_CANDIDATO_APROVADO", a."DT_ADMISSAO", a."DT_DESLIGAMENTO")
         is distinct from (excluded."CO_MONITORAMENTO", excluded."CO_CANDIDATO_APROVADO",
                           excluded."DT_ADMISSAO", excluded."DT_DESLIGAMENTO");
  get diagnostics v_gravadas = row_count;

  return jsonb_build_object('recebidas', v_recebidas, 'sem_edital', v_sem_edital,
                            'gravadas', v_gravadas, 'removidas', v_removidas,
                            'total', (select count(*) from public."TB_ADMISSAO_CONCILIADA"));
end;
$function$;

-- 3. A RPC da Visão geral
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
    ), '[]'::jsonb),
    -- A 1ª e a última admissão por edital, das admissões conciliadas com o RH (20261113210000).
    'admissoes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'monitoramento_id', x.edital,
               'primeira', x.primeira,
               'ultima', x.ultima,
               'quantidade', x.quantidade
             ) order by x.edital)
        from (
          select a."CO_MONITORAMENTO" as edital,
                 min(a."DT_ADMISSAO") as primeira,
                 max(a."DT_ADMISSAO") as ultima,
                 count(*)::integer as quantidade
            from public."TB_ADMISSAO_CONCILIADA" a
           where a."CO_MONITORAMENTO" = any (v_editais)
           group by a."CO_MONITORAMENTO"
        ) x
    ), '[]'::jsonb)
  );
end;
$function$;

comment on function public.listar_acompanhamento_da_visao_geral(p_area text) is 'Visão geral de uma área (só leitura): as etapas do cronograma; por edital com lista de aprovados vigente, as contagens de aprovados, com status, contratados (Contratado/Migração) e desistentes; e por edital, a 1ª e a última admissão conciliadas com o RH (TB_ADMISSAO_CONCILIADA, 20261113210000). Recurso dashboard, área do usuário e recorte da coordenação.';
comment on function public.carregar_admissoes_conciliadas(p_carga text, p_linhas jsonb) is 'Carga das admissões conciliadas com o RH (scripts/carregar-admissoes-conciliadas.mjs): troca TB_ADMISSAO_CONCILIADA pelo conteúdo da carga (o que não veio sai), ignora vínculo de edital inexistente e devolve recebidas, sem_edital, gravadas, removidas e total. Recusa carga vazia ou com vínculo repetido. Só service_role (20261113210000).';
revoke all on function public.carregar_admissoes_conciliadas(text, jsonb) from public, anon, authenticated;
grant execute on function public.carregar_admissoes_conciliadas(text, jsonb) to service_role;

select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();

-- 4. O ciclo
update public."TB_MONITORAMENTO_INDIGENA"
   set ciclo = substring(ciclo from '\d+')::integer || 'º ciclo'
 where ciclo ~ '\d'
   and ciclo is distinct from substring(ciclo from '\d+')::integer || 'º ciclo';

do $confere$
declare
  v_fora integer;
begin
  if md5(replace((select prosrc from pg_proc where oid = to_regprocedure('public.listar_acompanhamento_da_visao_geral(text)')), chr(13), '')) is distinct from '488c5da46e823a31ebffe55052af7bee' then
    raise exception 'O corpo aplicado não tem o md5 esperado.';
  end if;
  if not exists (select 1 from private."TD_FONTE_DA_LEITURA" f
                  where f."NO_LEITURA" = 'acompanhamento_visao_geral' and f."NO_FONTE" = 'public.TB_ADMISSAO_CONCILIADA') then
    raise exception 'A marca da Visão geral não acompanha TB_ADMISSAO_CONCILIADA.';
  end if;
  select count(*) into v_fora from public."TB_MONITORAMENTO_INDIGENA" where ciclo ~ '\d' and ciclo !~ '^\d+º ciclo$';
  if v_fora <> 0 then raise exception 'Ainda há % ciclos fora do padrão.', v_fora; end if;
  raise notice 'Ciclos: %', (select string_agg(distinct ciclo, ', ' order by ciclo) from public."TB_MONITORAMENTO_INDIGENA");
end;
$confere$;

-- Ensaio: uma carga de dois vínculos de um edital, recarregada com um só.
do $carga$
declare
  v_edital uuid := (select m.id from public."TB_MONITORAMENTO_INDIGENA" m where m.ativo order by m.id limit 1);
  v_r jsonb;
begin
  v_r := public.carregar_admissoes_conciliadas('ensaio', jsonb_build_array(
    jsonb_build_object('vinculo', 'aaaa0000bbbb1111cccc', 'edital', v_edital, 'admissao', '2025-05-12'),
    jsonb_build_object('vinculo', 'aaaa0000bbbb1111dddd', 'edital', v_edital, 'admissao', '2026-01-07', 'desligamento', '2026-03-01'),
    jsonb_build_object('vinculo', 'aaaa0000bbbb1111eeee', 'edital', gen_random_uuid(), 'admissao', '2025-01-01')));
  raise notice 'Carga 1: %', v_r;
  if (v_r ->> 'gravadas')::integer <> 2 or (v_r ->> 'sem_edital')::integer <> 1 then
    raise exception 'Carga 1 errada: %', v_r;
  end if;
  if (select min("DT_ADMISSAO")::text || '|' || max("DT_ADMISSAO")::text
        from public."TB_ADMISSAO_CONCILIADA" where "CO_MONITORAMENTO" = v_edital)
     is distinct from '2025-05-12|2026-01-07' then
    raise exception 'A 1ª e a última não conferem.';
  end if;
  v_r := public.carregar_admissoes_conciliadas('ensaio-2', jsonb_build_array(
    jsonb_build_object('vinculo', 'aaaa0000bbbb1111cccc', 'edital', v_edital, 'admissao', '2025-05-12')));
  raise notice 'Carga 2: %', v_r;
  if (v_r ->> 'removidas')::integer <> 1 or (v_r ->> 'gravadas')::integer <> 0 or (v_r ->> 'total')::integer <> 1 then
    raise exception 'Carga 2 errada: %', v_r;
  end if;
  begin
    perform public.carregar_admissoes_conciliadas('ensaio-3', '[]'::jsonb);
    raise exception 'Aceitou carga vazia.';
  exception when sqlstate '22023' then null;
  end;
  if has_function_privilege('authenticated', 'public.carregar_admissoes_conciliadas(text, jsonb)', 'execute') then
    raise exception 'authenticated não pode carregar.';
  end if;
  raise notice 'Ensaio 20261113210000 ok';
end;
$carga$;

rollback;
