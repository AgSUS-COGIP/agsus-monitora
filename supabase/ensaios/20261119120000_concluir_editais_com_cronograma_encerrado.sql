/*
  ENSAIO de 20261119120000_concluir_editais_com_cronograma_encerrado (não grava: termina em rollback).

  1. Aplica a migration e confere funções, CHECK e grants.
  2. Conta, sem permissão, os editais que a regra pega (o recorte da conferência).
  3. Num savepoint, como um administrador global ativo (só o id na sessão da transação; nada é
     impresso dele): a lista tem os mesmos editais; concluir todos marca todos e recusa nenhum; a
     lista fica vazia; o histórico ganha um registro 'status' por edital; um edital fora da regra é
     recusado com o motivo. Volta ao savepoint.
  4. Aplica o rollback e confere que funções e CHECK voltaram ao de antes.

  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/ensaios/20261119120000_concluir_editais_com_cronograma_encerrado.sql
*/

begin;

-- 1. Migration ────────────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';

-- Guarda: a CHECK da ação é a de hoje (ou já é a nova) e as dependências existem.
do $$
declare
  v_antiga text := (select pg_get_constraintdef(c.oid) from pg_constraint c
                     where c.conrelid = 'public."TH_CRONOGRAMA_MONIT_INDIG"'::regclass
                       and c.conname = 'monitoramento_indigena_cronograma_versoes_acao_check');
  v_nova text := (select pg_get_constraintdef(c.oid) from pg_constraint c
                   where c.conrelid = 'public."TH_CRONOGRAMA_MONIT_INDIG"'::regclass
                     and c.conname = 'CK_HISTCRONOGRAMA_ACAO');
begin
  if v_nova is null and v_antiga is distinct from 'CHECK ((acao = ANY (ARRAY[''salvar''::text, ''errata''::text])))' then
    raise exception 'A CHECK da ação do histórico do cronograma mudou depois do retrato de 19/11/2026: %', v_antiga;
  end if;
  if to_regprocedure('private."FC_ESTADO_DO_CRONOGRAMA"(uuid, date)') is null
     or to_regprocedure('private."FC_PODE_VER_EDITAL"(uuid)') is null
     or to_regprocedure('private."FC_PODE_VER_AVISO"(text, text, uuid)') is null
     or to_regprocedure('private."FC_PODE_IGNORAR_AVISO"(text, text, uuid)') is null
     or to_regprocedure('private."FC_TEXTO_SEGURO_DO_AVISO"(text)') is null
     or to_regprocedure('private.snapshot_monitoramento_cronograma(uuid)') is null
     or to_regprocedure('private."FC_NUMERO_EDITAL"(text)') is null
     or to_regprocedure('private."FC_EH_TREINAMENTO"(text)') is null then
    raise exception 'Falta uma função de que esta migration depende (estado do cronograma, permissões ou avisos).';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'TB_AVISO_CONFERENCIA'
                    and column_name = 'TP_TRATAMENTO') then
    raise exception 'A central de avisos (20261118140000) não está aplicada.';
  end if;
end;
$$;

-- 1. A ação 'status' no histórico do cronograma ──────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_constraint
              where conrelid = 'public."TH_CRONOGRAMA_MONIT_INDIG"'::regclass
                and conname = 'monitoramento_indigena_cronograma_versoes_acao_check') then
    alter table public."TH_CRONOGRAMA_MONIT_INDIG"
      drop constraint monitoramento_indigena_cronograma_versoes_acao_check;
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public."TH_CRONOGRAMA_MONIT_INDIG"'::regclass
                    and conname = 'CK_HISTCRONOGRAMA_ACAO') then
    alter table public."TH_CRONOGRAMA_MONIT_INDIG"
      add constraint "CK_HISTCRONOGRAMA_ACAO" check (acao in ('salvar', 'errata', 'status'));
  end if;
end;
$$;

comment on constraint "CK_HISTCRONOGRAMA_ACAO" on public."TH_CRONOGRAMA_MONIT_INDIG" is
  'Ações do histórico do cronograma: salvar (o formulário do edital), errata (retificação) e status (status marcado Concluído em lote pela tela de Editais, com motivo; 20261119120000).';

-- 2. A regra: por que o edital não pode ser marcado Concluído ───────────────────────────────────
create or replace function private."FC_RECUSA_CONCLUIR_EDITAL"(p_status text, p_estado jsonb)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when coalesce((p_estado ->> 'tem_cronograma')::boolean, false) is not true
      then 'Edital sem cronograma'
    when (p_estado ->> 'status') is distinct from 'Concluído'
      then format('Pelo cronograma, o edital está "%s", não concluído', coalesce(p_estado ->> 'status', 'sem estado'))
    when lower(translate(btrim(coalesce(p_status, '')), 'ÁÂÃÀÉÊÍÓÔÕÚÇáâãàéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc')) = 'concluido'
      then 'O status já é Concluído'
    when lower(translate(btrim(coalesce(p_status, '')), 'ÁÂÃÀÉÊÍÓÔÕÚÇáâãàéêíóôõúç', 'AAAAEEIOOOUCaaaaeeiooouc')) in ('cancelado', 'encerrado')
      then format('O status gravado é "%s": decida no próprio edital', btrim(p_status))
  end;
$$;

comment on function private."FC_RECUSA_CONCLUIR_EDITAL"(text, jsonb) is
  'Por que o edital NÃO pode ser marcado Concluído em lote (null = pode): p_status é o status gravado e p_estado o de private."FC_ESTADO_DO_CRONOGRAMA". Pode quando há cronograma, o estado calculado é "Concluído" e o gravado é outro, fora de cancelado e encerrado (20261119120000).';

revoke all on function private."FC_RECUSA_CONCLUIR_EDITAL"(text, jsonb) from public, anon, authenticated;

-- 3. A lista da tela de Editais ───────────────────────────────────────────────────────────────────
create or replace function public.listar_editais_com_cronograma_encerrado()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not (private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario')
          or private.pode_recurso('aprovados') or private.pode_recurso('importacao')) then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'hoje', v_hoje,
    'pode_concluir', private.pode_recurso('nucleo', 2) or private.pode_recurso('calendario', 2),
    'editais', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', x.id,
          'edital', x.edital,
          'numero', private."FC_NUMERO_EDITAL"(x.edital),
          'unidade', x.unidade,
          'area', x."CO_AREA",
          'status', x.status,
          'etapa', x.estado ->> 'etapa',
          'calculo', x.estado ->> 'calculo',
          'fim', x.estado ->> 'data_fim',
          'aviso', case when x.aviso_id is null then null else jsonb_build_object(
              'id', x.aviso_id,
              'tratamento', x.aviso_tratamento,
              'pode_dispensar', private."FC_PODE_IGNORAR_AVISO"('editais', x.aviso_area, x.id)) end,
          'pendencias', x.pendencias)
        order by x.estado ->> 'data_fim', x.unidade, x.edital)
        from (
          select m.id, m.edital, m.unidade, m."CO_AREA", m.status, e.estado,
                 a."CO_AVISO_CONFERENCIA" as aviso_id, a."TP_TRATAMENTO" as aviso_tratamento,
                 a."CO_AREA" as aviso_area,
                 coalesce((
                   select jsonb_agg(jsonb_build_object(
                       'conferencia', p."CO_CONFERENCIA",
                       'gravidade', p."TP_GRAVIDADE",
                       'quantidade', p."QT_OCORRENCIA",
                       'tratamento', p."TP_TRATAMENTO")
                     order by case p."TP_GRAVIDADE" when 'CRITICA' then 0 when 'ATENCAO' then 1 else 2 end,
                              p."CO_CONFERENCIA")
                     from public."TB_AVISO_CONFERENCIA" p
                    where p."CO_MONITORAMENTO" = m.id
                      and p."TP_SITUACAO" = 'ABERTO'
                      and p."TP_TRATAMENTO" <> 'DISPENSADO'
                      and p."CO_CONFERENCIA" <> 'EDITAL_CRONOGRAMA_ENCERRADO'
                      and private."FC_PODE_VER_AVISO"(p."CO_MODULO", p."CO_AREA", p."CO_MONITORAMENTO")
                 ), '[]'::jsonb) as pendencias
            from public."TB_MONITORAMENTO_INDIGENA" m
            cross join lateral (select private."FC_ESTADO_DO_CRONOGRAMA"(m.id, v_hoje) as estado) e
            left join lateral (
              select av."CO_AVISO_CONFERENCIA", av."TP_TRATAMENTO", av."CO_AREA"
                from public."TB_AVISO_CONFERENCIA" av
               where av."CO_MONITORAMENTO" = m.id
                 and av."CO_CONFERENCIA" = 'EDITAL_CRONOGRAMA_ENCERRADO'
                 and av."TP_SITUACAO" = 'ABERTO'
               order by av."DT_ULTIMA_VEZ" desc
               limit 1
            ) a on true
           where m.ativo is true
             and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
             and nullif(btrim(coalesce(m.status_override, '')), '') is null
             and private."FC_PODE_VER_EDITAL"(m.id)
             and private."FC_RECUSA_CONCLUIR_EDITAL"(m.status, e.estado) is null
             -- Dispensado na central com justificativa: a equipe já decidiu manter o status.
             and a."TP_TRATAMENTO" is distinct from 'DISPENSADO'
        ) x
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.listar_editais_com_cronograma_encerrado() is
  'Editais cujo cronograma já terminou pelas datas (private."FC_ESTADO_DO_CRONOGRAMA" = "Concluído") com o status gravado ainda em outro valor (fora de concluído, cancelado e encerrado): o recorte da conferência EDITAL_CRONOGRAMA_ENCERRADO (ativo, fora do treinamento, sem status manual), só os que a pessoa vê, sem os já dispensados na central. Por edital: número, unidade, área, status gravado, etapa, cálculo, fim do cronograma, o aviso da central (id, tratamento, pode_dispensar) e as outras pendências abertas do edital (conferência, gravidade, quantidade). pode_concluir: quem edita editais (Núcleo ou Calendário, editor). Leitura de quem vê os editais (20261119120000).';

revoke all on function public.listar_editais_com_cronograma_encerrado() from public, anon;
grant execute on function public.listar_editais_com_cronograma_encerrado() to authenticated;

-- 4. A gravação em lote ──────────────────────────────────────────────────────────────────────────
create or replace function public.concluir_editais_com_cronograma_encerrado(p_editais uuid[], p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  v_uid uuid := (select auth.uid());
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ids uuid[];
  v_id uuid;
  v_m public."TB_MONITORAMENTO_INDIGENA"%rowtype;
  v_estado jsonb;
  v_recusa text;
  v_cronograma jsonb;
  v_concluidos jsonb := '[]'::jsonb;
  v_recusados jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  -- A mesma permissão de salvar o edital (salvar_monitoramento_com_cronograma_v2) e, por edital, a área.
  if not (private.pode_recurso('nucleo', 2) or private.pode_recurso('calendario', 2)) then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;
  if v_motivo is null or length(v_motivo) not between 10 and 500 then
    raise exception 'Escreva o motivo (10 a 500 caracteres)' using errcode = '22023';
  end if;
  if not private."FC_TEXTO_SEGURO_DO_AVISO"(v_motivo) then
    raise exception 'O motivo não pode ter CPF nem e-mail' using errcode = '22023';
  end if;

  select array_agg(distinct x) into v_ids from unnest(coalesce(p_editais, '{}'::uuid[])) x where x is not null;
  if v_ids is null then
    raise exception 'Escolha ao menos um edital' using errcode = '22023';
  end if;
  if cardinality(v_ids) > 200 then
    raise exception 'Até 200 editais por vez' using errcode = '22023';
  end if;

  foreach v_id in array v_ids loop
    select * into v_m from public."TB_MONITORAMENTO_INDIGENA" where id = v_id for update;
    if not found or not private."FC_PODE_VER_EDITAL"(v_id) then
      v_recusados := v_recusados || jsonb_build_object('id', v_id, 'edital', null, 'motivo', 'Edital não encontrado');
      continue;
    end if;
    -- A mesma trava do salvar do edital.
    if not pg_try_advisory_xact_lock(hashtext('cronograma:' || v_id::text)::bigint) then
      v_recusados := v_recusados || jsonb_build_object('id', v_id, 'edital', v_m.edital,
                                                       'motivo', 'Outra alteração deste edital está em andamento');
      continue;
    end if;
    v_estado := private."FC_ESTADO_DO_CRONOGRAMA"(v_id, v_hoje);
    v_recusa := private."FC_RECUSA_CONCLUIR_EDITAL"(v_m.status, v_estado);
    if v_recusa is not null then
      v_recusados := v_recusados || jsonb_build_object('id', v_id, 'edital', v_m.edital, 'motivo', v_recusa);
      continue;
    end if;

    -- O que o salvar do edital gravaria: o status e a etapa do estado calculado.
    update public."TB_MONITORAMENTO_INDIGENA"
       set status = 'Concluído',
           etapa = coalesce(nullif(v_estado ->> 'etapa', ''), etapa),
           updated_by = v_uid,
           updated_at = now()
     where id = v_id;

    v_cronograma := private.snapshot_monitoramento_cronograma(v_id);
    insert into public."TH_CRONOGRAMA_MONIT_INDIG" (
      monitoramento_id, acao, motivo, created_by, created_by_email,
      cronograma_antes, cronograma_depois, alteracoes, total_alteracoes)
    values (
      v_id, 'status', v_motivo, v_uid, nullif((select auth.jwt()) ->> 'email', ''),
      v_cronograma, v_cronograma,
      jsonb_build_array(jsonb_build_object('tipo', 'status', 'campo', 'status',
                                           'antes', v_m.status, 'depois', 'Concluído')),
      1);

    v_concluidos := v_concluidos || jsonb_build_object('id', v_id, 'edital', v_m.edital, 'status_anterior', v_m.status);
  end loop;

  return jsonb_build_object('concluidos', v_concluidos, 'recusados', v_recusados,
                            'motivo', v_motivo, 'concluido_em', now());
end;
$$;

comment on function public.concluir_editais_com_cronograma_encerrado(uuid[], text) is
  'Marca "Concluído" (e a etapa do estado calculado, como o salvar do edital faria) nos editais escolhidos (até 200) cujo cronograma terminou pelas datas e cujo status gravado é outro (private."FC_RECUSA_CONCLUIR_EDITAL"); recusa os demais com o motivo, sem parar o lote. Exige quem edita editais (Núcleo ou Calendário, editor) e a área de cada edital; motivo de 10 a 500 caracteres, sem CPF nem e-mail. Cada edital marcado vai ao histórico do cronograma (TH_CRONOGRAMA_MONIT_INDIG, ação status) com quem, quando e o motivo. Não muda o aviso da central: ele some na próxima conferência. Devolve {concluidos:[{id, edital, status_anterior}], recusados:[{id, edital, motivo}], motivo, concluido_em} (20261119120000).';

revoke all on function public.concluir_editais_com_cronograma_encerrado(uuid[], text) from public, anon;
grant execute on function public.concluir_editais_com_cronograma_encerrado(uuid[], text) to authenticated;

do $$
begin
  if to_regprocedure('public.listar_editais_com_cronograma_encerrado()') is null
     or to_regprocedure('public.concluir_editais_com_cronograma_encerrado(uuid[], text)') is null
     or to_regprocedure('private."FC_RECUSA_CONCLUIR_EDITAL"(text, jsonb)') is null then
    raise exception 'ENSAIO: função da migration ausente';
  end if;
  if has_function_privilege('anon', 'public.concluir_editais_com_cronograma_encerrado(uuid[], text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.listar_editais_com_cronograma_encerrado()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.concluir_editais_com_cronograma_encerrado(uuid[], text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.listar_editais_com_cronograma_encerrado()', 'EXECUTE') then
    raise exception 'ENSAIO: grants errados (anon não executa; authenticated executa)';
  end if;
  if (select pg_get_constraintdef(c.oid) from pg_constraint c
       where c.conrelid = 'public."TH_CRONOGRAMA_MONIT_INDIG"'::regclass and c.conname = 'CK_HISTCRONOGRAMA_ACAO')
     is distinct from 'CHECK ((acao = ANY (ARRAY[''salvar''::text, ''errata''::text, ''status''::text])))' then
    raise exception 'ENSAIO: CHECK da ação errada';
  end if;
end;
$$;

-- 2 e 3. A regra e o ciclo como administrador global ──────────────────────────────────────────────
create temp table ensaio_regra on commit drop as
select m.id, private."FC_NUMERO_EDITAL"(m.edital) as numero
  from public."TB_MONITORAMENTO_INDIGENA" m
  cross join lateral (select private."FC_ESTADO_DO_CRONOGRAMA"(m.id, (now() at time zone 'America/Sao_Paulo')::date) as estado) e
  left join lateral (select av."TP_TRATAMENTO" from public."TB_AVISO_CONFERENCIA" av
                      where av."CO_MONITORAMENTO" = m.id and av."CO_CONFERENCIA" = 'EDITAL_CRONOGRAMA_ENCERRADO'
                        and av."TP_SITUACAO" = 'ABERTO' order by av."DT_ULTIMA_VEZ" desc limit 1) a on true
 where m.ativo is true
   and not private."FC_EH_TREINAMENTO"(m."ST_TREINAMENTO")
   and nullif(btrim(coalesce(m.status_override, '')), '') is null
   and private."FC_RECUSA_CONCLUIR_EDITAL"(m.status, e.estado) is null
   and a."TP_TRATAMENTO" is distinct from 'DISPENSADO';

do $$
begin
  raise notice 'ENSAIO: % editais na regra: %', (select count(*) from ensaio_regra),
    (select string_agg(numero, ', ' order by numero) from ensaio_regra);
end;
$$;

savepoint ensaio_ciclo;

do $$
declare
  v_admin uuid := (select p.user_id from public."TB_PERFIL_USUARIO" p
                     join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = p.perfil
                    where p.ativo is true and g."ST_ADMIN_GLOBAL" limit 1);
  v_lista jsonb;
  v_ids uuid[];
  v_r jsonb;
  v_fora uuid;
  v_historico_antes integer := (select count(*) from public."TH_CRONOGRAMA_MONIT_INDIG" where acao = 'status');
begin
  if v_admin is null then
    raise notice 'ENSAIO: sem administrador global ativo; ciclo pulado';
    return;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  v_lista := public.listar_editais_com_cronograma_encerrado();
  if (v_lista ->> 'pode_concluir')::boolean is not true then
    raise exception 'ENSAIO: o administrador global não pode concluir';
  end if;
  select array_agg((e ->> 'id')::uuid) into v_ids from jsonb_array_elements(v_lista -> 'editais') e;
  if coalesce(cardinality(v_ids), 0) <> (select count(*) from ensaio_regra)
     or exists (select id from ensaio_regra except select unnest(coalesce(v_ids, '{}'::uuid[]))) then
    raise exception 'ENSAIO: a lista (%) não bate com a regra (%)', coalesce(cardinality(v_ids), 0), (select count(*) from ensaio_regra);
  end if;
  raise notice 'ENSAIO: lista com % editais; % com aviso aberto na central; % com outras pendências',
    coalesce(cardinality(v_ids), 0),
    (select count(*) from jsonb_array_elements(v_lista -> 'editais') e where e -> 'aviso' <> 'null'::jsonb),
    (select count(*) from jsonb_array_elements(v_lista -> 'editais') e where jsonb_array_length(e -> 'pendencias') > 0);

  if v_ids is not null then
    v_r := public.concluir_editais_com_cronograma_encerrado(v_ids, 'Ensaio: conferido com a equipe em 19/11');
    if jsonb_array_length(v_r -> 'concluidos') <> cardinality(v_ids) or jsonb_array_length(v_r -> 'recusados') <> 0 then
      raise exception 'ENSAIO: concluir marcou % e recusou % de %', jsonb_array_length(v_r -> 'concluidos'),
        jsonb_array_length(v_r -> 'recusados'), cardinality(v_ids);
    end if;
    if jsonb_array_length(public.listar_editais_com_cronograma_encerrado() -> 'editais') <> 0 then
      raise exception 'ENSAIO: a lista não esvaziou depois de concluir';
    end if;
    if (select count(*) from public."TH_CRONOGRAMA_MONIT_INDIG" where acao = 'status') - v_historico_antes <> cardinality(v_ids) then
      raise exception 'ENSAIO: o histórico não ganhou um registro por edital';
    end if;
    if exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" where id = any (v_ids) and status <> 'Concluído') then
      raise exception 'ENSAIO: edital sem o status Concluído depois de concluir';
    end if;
    -- Concluir de novo: recusa todos ("O status já é Concluído").
    v_r := public.concluir_editais_com_cronograma_encerrado(v_ids[1:1], 'Ensaio: segunda vez no mesmo');
    if jsonb_array_length(v_r -> 'recusados') <> 1 or (v_r #>> '{recusados,0,motivo}') <> 'O status já é Concluído' then
      raise exception 'ENSAIO: a segunda vez não foi recusada: %', v_r;
    end if;
  end if;

  -- Um edital ativo em andamento pelas datas: recusado com o motivo.
  select m.id into v_fora from public."TB_MONITORAMENTO_INDIGENA" m
   where m.ativo is true
     and private."FC_ESTADO_DO_CRONOGRAMA"(m.id, (now() at time zone 'America/Sao_Paulo')::date) ->> 'status' = 'Em andamento'
   limit 1;
  if v_fora is not null then
    v_r := public.concluir_editais_com_cronograma_encerrado(array[v_fora], 'Ensaio: edital ainda em andamento');
    if jsonb_array_length(v_r -> 'concluidos') <> 0 or (v_r #>> '{recusados,0,motivo}') not like 'Pelo cronograma, o edital está%' then
      raise exception 'ENSAIO: edital em andamento não foi recusado: %', v_r;
    end if;
  end if;

  -- Motivo curto: recusado inteiro.
  begin
    perform public.concluir_editais_com_cronograma_encerrado(array[gen_random_uuid()], 'curto');
    raise exception 'ENSAIO: motivo curto passou';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ENSAIO: ciclo ok';
end;
$$;

rollback to savepoint ensaio_ciclo;

-- 4. Rollback ─────────────────────────────────────────────────────────────────────────────────────
set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('public.concluir_editais_com_cronograma_encerrado(uuid[], text)') is null
     and not exists (select 1 from pg_constraint
                      where conrelid = 'public."TH_CRONOGRAMA_MONIT_INDIG"'::regclass
                        and conname = 'CK_HISTCRONOGRAMA_ACAO') then
    raise exception 'A migration 20261119120000 não está aplicada.';
  end if;
  if exists (select 1 from public."TH_CRONOGRAMA_MONIT_INDIG" where acao = 'status') then
    raise exception 'Há registro com a ação status no histórico do cronograma: a CHECK antiga não o aceita (desfaça só as funções).';
  end if;
end;
$$;

drop function if exists public.concluir_editais_com_cronograma_encerrado(uuid[], text);
drop function if exists public.listar_editais_com_cronograma_encerrado();
drop function if exists private."FC_RECUSA_CONCLUIR_EDITAL"(text, jsonb);

alter table public."TH_CRONOGRAMA_MONIT_INDIG" drop constraint if exists "CK_HISTCRONOGRAMA_ACAO";
alter table public."TH_CRONOGRAMA_MONIT_INDIG"
  add constraint monitoramento_indigena_cronograma_versoes_acao_check
  check ((acao = any (array['salvar'::text, 'errata'::text])));

do $$
begin
  if to_regprocedure('public.listar_editais_com_cronograma_encerrado()') is not null
     or to_regprocedure('public.concluir_editais_com_cronograma_encerrado(uuid[], text)') is not null
     or to_regprocedure('private."FC_RECUSA_CONCLUIR_EDITAL"(text, jsonb)') is not null then
    raise exception 'ENSAIO: o rollback deixou função';
  end if;
  if (select pg_get_constraintdef(c.oid) from pg_constraint c
       where c.conrelid = 'public."TH_CRONOGRAMA_MONIT_INDIG"'::regclass
         and c.conname = 'monitoramento_indigena_cronograma_versoes_acao_check')
     is distinct from 'CHECK ((acao = ANY (ARRAY[''salvar''::text, ''errata''::text])))'
     or exists (select 1 from pg_constraint where conrelid = 'public."TH_CRONOGRAMA_MONIT_INDIG"'::regclass
                  and conname = 'CK_HISTCRONOGRAMA_ACAO') then
    raise exception 'ENSAIO: o rollback não devolveu a CHECK de antes';
  end if;
  raise notice 'ENSAIO: rollback ok';
end;
$$;

rollback;
