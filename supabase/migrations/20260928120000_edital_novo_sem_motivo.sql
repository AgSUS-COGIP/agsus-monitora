/*
  EDITAL NOVO NÃO PEDE JUSTIFICATIVA

  Criar um edital na aba Editais pedia "Informe o motivo da alteração do
  cronograma" — não há alteração: o edital ainda não existia. Agora:
    - edital novo (sem id): o histórico registra "Cadastro do edital";
    - edital existente: continua exigindo o motivo (registro de quem mudou o
      quê, e por quê).

  Aproveita para consertar os acentos das mensagens desta função, gravados
  estragados ("alteraÃ§Ã£o") desde a padronização de 18/09/2026. A trava de
  área (FC_EXIGIR_AREA_SALVAR_EDITAL, etapa 5) continua igual.

  ROLLBACK: supabase/rollback/20260928120000_edital_novo_sem_motivo.sql
*/
begin;

CREATE OR REPLACE FUNCTION public.salvar_monitoramento_com_cronograma_v2(p_payload jsonb, p_cronograma jsonb DEFAULT '[]'::jsonb, p_motivo text DEFAULT NULL::text, p_numero_errata text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
 SET lock_timeout TO '5s'
AS $function$
declare
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_result jsonb;
  v_antes jsonb := '[]'::jsonb;
  v_depois jsonb := '[]'::jsonb;
  v_alteracoes jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_versao_id uuid;
  v_motivo text := nullif(btrim(p_motivo), '');
  v_errata text := nullif(btrim(p_numero_errata), '');
  v_override text := nullif(btrim(p_payload ->> 'status_override'), '');
  v_override_motivo text := nullif(btrim(p_payload ->> 'status_override_motivo'), '');
  v_override_data date := nullif(p_payload ->> 'status_override_data', '')::date;
begin
  perform private."FC_EXIGIR_AREA_SALVAR_EDITAL"(p_payload);
  if not ((private.pode_recurso('nucleo',2) or private.pode_recurso('calendario',2))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if not private.has_perm('cores') then
    raise exception 'Sem permissao para salvar monitoramento indigena';
  end if;

  /*
    Edital novo não tem cronograma anterior a justificar: o histórico registra
    "Cadastro do edital". Edital existente continua exigindo o motivo.
  */
  if v_motivo is null then
    if v_id is null then
      v_motivo := 'Cadastro do edital';
    else
      raise exception 'Informe o motivo da alteração do cronograma';
    end if;
  end if;

  if jsonb_typeof(coalesce(p_cronograma, '[]'::jsonb)) <> 'array' then
    raise exception 'Cronograma inválido';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_cronograma, '[]'::jsonb)) as x(
      ordem integer, atividade text, data_inicio date, data_fim date
    )
    where nullif(btrim(atividade), '') is null
       or data_inicio is null
       or data_fim is null
       or data_fim < data_inicio
  ) then
    raise exception 'Existem etapas incompletas ou com período inválido';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_cronograma, '[]'::jsonb)) as x(atividade text)
    group by lower(btrim(atividade))
    having count(*) > 1
  ) then
    raise exception 'Existem atividades duplicadas no cronograma';
  end if;

  if v_override is not null and (v_override_motivo is null or v_override_data is null) then
    raise exception 'Status excepcional exige motivo e data da decisão';
  end if;

  if not pg_try_advisory_xact_lock(hashtext('cronograma:' || coalesce(v_id::text, auth.uid()::text, 'novo'))::bigint) then
    raise exception 'Outra alteração deste cronograma está em andamento';
  end if;

  if v_id is not null then
    v_antes := private.snapshot_monitoramento_cronograma(v_id);
  end if;

  v_result := public.salvar_monitoramento_com_cronograma(p_payload, p_cronograma);
  v_id := nullif(v_result #>> '{registro,id}', '')::uuid;

  if v_id is null then
    raise exception 'O salvamento não retornou o identificador do edital';
  end if;

  update public."TB_MONITORAMENTO_INDIGENA"
  set status_override_motivo = v_override_motivo,
      status_override_data = v_override_data,
      status_override_previsao_retomada = nullif(p_payload ->> 'status_override_previsao_retomada', '')::date,
      cronograma_ultima_errata = coalesce(v_errata, cronograma_ultima_errata),
      updated_by = auth.uid(),
      updated_at = now()
  where id = v_id;

  v_depois := private.snapshot_monitoramento_cronograma(v_id);
  v_alteracoes := private.diff_monitoramento_cronograma(v_antes, v_depois);
  v_total := jsonb_array_length(v_alteracoes);

  insert into public."TH_CRONOGRAMA_MONIT_INDIG"(
    monitoramento_id,
    acao,
    motivo,
    numero_errata,
    created_by,
    created_by_email,
    cronograma_antes,
    cronograma_depois,
    alteracoes,
    total_alteracoes
  ) values (
    v_id,
    case when v_errata is null then 'salvar' else 'errata' end,
    v_motivo,
    v_errata,
    auth.uid(),
    nullif(auth.jwt() ->> 'email', ''),
    v_antes,
    v_depois,
    v_alteracoes,
    v_total
  ) returning id into v_versao_id;

  return v_result || jsonb_build_object(
    'versao_id', v_versao_id,
    'total_alteracoes', v_total,
    'alteracoes', v_alteracoes,
    'motivo', v_motivo,
    'numero_errata', v_errata
  );
end;
$function$;

commit;
