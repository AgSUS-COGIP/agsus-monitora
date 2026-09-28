/*
  EDITAL SEMPRE NA ÁREA CERTA

  Até aqui a área do edital ("CO_AREA") era só deduzida pelo gatilho
  TBA_MONITORAMENTO_INDIGENA: unidade em TA_UNIDADE_AREA; senão responsável
  CORES -> sede; senão saude-indigena. Criar um edital na SEDE com uma unidade
  que a tabela não conhecia o jogava, calado, na Saúde Indígena — e ele sumia
  da tela de quem o criou.

  O QUE MUDA
    1. private."FC_AREA_DA_UNIDADE"(unidade): a área conhecida da unidade —
       TA_UNIDADE_AREA; senão, unidade do catálogo TD_UNIDADE (DSEI/CASAI) ->
       saude-indigena; senão NULL (unidade que o banco não conhece).
    2. salvar_monitoramento_com_cronograma_v2 aceita a área pretendida no
       próprio p_payload, em "co_area" (a assinatura não muda). Com ela:
         - a área tem de existir e ser do usuário (FC_AREAS_USUARIO; admin tem
           todas) — senão 22023 / 42501;
         - edital existente só é salvo na área em que está (mudar de área é o
           mover_edital_de_area, só admin);
         - unidade nova ou trocada: se a unidade é de outra área, recusa com a
           mensagem "A unidade X é da área Y; …"; se o banco não a conhece,
           registra em TA_UNIDADE_AREA com a área pretendida;
         - o edital fica com "CO_AREA" = área pretendida.
       Sem "co_area" (o front já publicado), tudo como antes.
    3. O gatilho passa a respeitar uma área gravada explicitamente: no INSERT
       só deduz quando "CO_AREA" vem vazio; no UPDATE só deduz quando o
       responsável ou a unidade mudam de verdade e "CO_AREA" não foi trocado
       no mesmo comando. Antes ele deduzia de novo a cada salvar (o UPDATE do
       salvar regrava unidade e responsável), o que desfaria qualquer mudança
       de área. Nenhuma linha existente é alterada por esta migration.
    4. mover_edital_de_area(p_id, p_area, p_motivo): só admin (is_master).
       Troca "CO_AREA" do edital (não mexe em TA_UNIDADE_AREA) e registra em
       TH_MONITORAMENTO, a auditoria que já existe: campo_alterado = 'CO_AREA',
       valor_anterior/valor_novo, e o motivo em snapshot_json (quem e quando:
       usuario_id, usuario_email, created_at). O gatilho de histórico continua
       gravando também a foto da linha.
    5. listar_unidades_por_area(): as linhas de TA_UNIDADE_AREA, para o
       formulário oferecer só as unidades da área.

  ARQUIVAR
    O edital já tem "ativo" (o front lê só ativo = true e o histórico registra
    'desativado'). Não há RPC para arquivar pelo app; nada aqui apaga linha.

  Ensaiado em begin…rollback no banco de produção em 28/09/2026 (ver
  docs/banco-de-dados.md, seção 7).

  ROLLBACK: supabase/rollback/20260928220000_edital_na_area_certa.sql
*/
begin;

-- 1. Área conhecida de uma unidade ------------------------------------------
create or replace function private."FC_AREA_DA_UNIDADE"(p_unidade text)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (select r."CO_AREA" from public."TA_UNIDADE_AREA" r
      where public.analises_norm_key(r."NO_UNIDADE") = public.analises_norm_key(p_unidade)
      order by r."NO_UNIDADE" limit 1),
    (select 'saude-indigena' from public."TD_UNIDADE" u
      where public.analises_norm_key(u.nome_oficial) = public.analises_norm_key(p_unidade)
      limit 1)
  );
$$;
comment on function private."FC_AREA_DA_UNIDADE"(text) is
  'Área conhecida de uma unidade: TA_UNIDADE_AREA; senão catálogo TD_UNIDADE (DSEI/CASAI) -> saude-indigena; senão NULL.';
revoke all on function private."FC_AREA_DA_UNIDADE"(text) from public, anon, authenticated;

-- 2a. Área pretendida no salvar: valida e registra unidade nova ---------------
create or replace function private."FC_ACERTAR_AREA_EDITAL"(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_area text := nullif(btrim(p_payload ->> 'co_area'), '');
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_unidade text := nullif(btrim(p_payload ->> 'unidade'), '');
  v_area_atual text;
  v_unidade_atual text;
  v_da_unidade text;
  v_nome_area text;
begin
  -- Chamada sem área (front anterior): nada muda.
  if v_area is null then
    return null;
  end if;

  select a."NO_AREA" into v_nome_area from public."TB_AREA" a where a."CO_AREA" = v_area;
  if v_nome_area is null then
    raise exception 'Área inválida: %', v_area using errcode = '22023';
  end if;
  if not (v_area = any (private."FC_AREAS_USUARIO"())) then
    raise exception 'Sem permissão para editais desta área' using errcode = '42501';
  end if;

  if v_id is not null then
    select m."CO_AREA", m.unidade into v_area_atual, v_unidade_atual
      from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_id;
    if found then
      if v_area_atual is distinct from v_area then
        raise exception 'Este edital é da área %. Para mudar de área, peça a um administrador (Mover para outra área).',
          coalesce((select a."NO_AREA" from public."TB_AREA" a where a."CO_AREA" = v_area_atual), v_area_atual)
          using errcode = '22023';
      end if;
      -- Mesma unidade de antes: nada a conferir (o edital pode ter sido movido de área).
      if public.analises_norm_key(v_unidade_atual) is not distinct from public.analises_norm_key(v_unidade) then
        return v_area;
      end if;
    end if;
  end if;

  if v_unidade is null then
    return v_area;
  end if;

  v_da_unidade := private."FC_AREA_DA_UNIDADE"(v_unidade);
  if v_da_unidade is null then
    if length(v_unidade) > 150 then
      raise exception 'Nome de unidade longo demais (máximo de 150 caracteres)' using errcode = '22023';
    end if;
    insert into public."TA_UNIDADE_AREA"("NO_UNIDADE", "CO_AREA")
    values (v_unidade, v_area)
    on conflict ("NO_UNIDADE") do nothing;
  elsif v_da_unidade <> v_area then
    raise exception 'A unidade % é da área %; escolha uma unidade de % ou peça ao administrador para mover.',
      v_unidade,
      coalesce((select a."NO_AREA" from public."TB_AREA" a where a."CO_AREA" = v_da_unidade), v_da_unidade),
      v_nome_area
      using errcode = '22023';
  end if;
  return v_area;
end;
$$;
comment on function private."FC_ACERTAR_AREA_EDITAL"(jsonb) is
  'Salvar com área pretendida (p_payload.co_area): valida permissão, recusa unidade de outra área e registra em TA_UNIDADE_AREA a unidade que o banco não conhece. Sem co_area devolve NULL.';
revoke all on function private."FC_ACERTAR_AREA_EDITAL"(jsonb) from public, anon, authenticated;

-- 2b. A trava de área do salvar considera a área pretendida --------------------
create or replace function private."FC_EXIGIR_AREA_SALVAR_EDITAL"(p_payload jsonb)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_area text := nullif(btrim(p_payload ->> 'co_area'), '');
begin
  -- Área atual (edital existente) e área nova (o salvar regrava unidade e responsável do payload).
  perform private."FC_EXIGIR_AREA_EDITAL"(nullif(p_payload ->> 'id', ''));
  if v_area is not null then
    -- Com área pretendida, é ela que vale (FC_ACERTAR_AREA_EDITAL confere a unidade).
    if not (v_area = any (private."FC_AREAS_USUARIO"())) then
      raise exception 'Sem permissão para editais desta área' using errcode = '42501';
    end if;
    return;
  end if;
  if not (private."FC_AREA_EDITAL"(nullif(p_payload ->> 'responsavel', ''), nullif(p_payload ->> 'unidade', ''))
          = any (private."FC_AREAS_USUARIO"())) then
    raise exception 'Sem permissão para editais desta área' using errcode = '42501';
  end if;
end;
$$;

-- 3. Gatilho: área explícita não é desfeita -----------------------------------
create or replace function private."FC_DEFINIR_AREA_EDITAL"()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'INSERT' then
    if new."CO_AREA" is null then
      new."CO_AREA" := private."FC_AREA_EDITAL"(new.responsavel, new.unidade);
    end if;
  elsif new."CO_AREA" is distinct from old."CO_AREA" then
    -- Mudança explícita (mover_edital_de_area, salvar com área): respeita.
    null;
  elsif new.responsavel is distinct from old.responsavel
     or new.unidade is distinct from old.unidade then
    new."CO_AREA" := private."FC_AREA_EDITAL"(new.responsavel, new.unidade);
  end if;
  return new;
end;
$$;
revoke all on function private."FC_DEFINIR_AREA_EDITAL"() from public, anon, authenticated;

-- 2c. O salvar usa a área pretendida ------------------------------------------
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
  v_area text;
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

  -- Área pretendida (p_payload.co_area): confere a unidade e registra a nova. Sem ela, NULL.
  v_area := private."FC_ACERTAR_AREA_EDITAL"(p_payload);

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
      "CO_AREA" = coalesce(v_area, "CO_AREA"),
      updated_by = auth.uid(),
      updated_at = now()
  where id = v_id;

  if v_area is not null then
    v_result := jsonb_set(v_result, '{registro,CO_AREA}', to_jsonb(v_area));
  end if;

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

-- 4. Mover edital de área (só admin) ------------------------------------------
create or replace function public.mover_edital_de_area(p_id uuid, p_area text, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path to ''
set lock_timeout to '5s'
as $$
declare
  v_area text := nullif(btrim(p_area), '');
  v_motivo text := nullif(btrim(p_motivo), '');
  v_de text;
begin
  if not private.is_master() then
    raise exception 'Só administradores podem mover editais de área' using errcode = '42501';
  end if;
  if v_motivo is null then
    raise exception 'Informe o motivo da mudança de área' using errcode = '22023';
  end if;
  if v_area is null or not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
    raise exception 'Área inválida: %', coalesce(v_area, '(vazia)') using errcode = '22023';
  end if;

  select m."CO_AREA" into v_de
    from public."TB_MONITORAMENTO_INDIGENA" m
   where m.id = p_id
   for update;
  if not found then
    raise exception 'Edital não encontrado' using errcode = 'P0002';
  end if;
  if v_de = v_area then
    raise exception 'O edital já está nesta área' using errcode = '22023';
  end if;

  update public."TB_MONITORAMENTO_INDIGENA"
     set "CO_AREA" = v_area,
         updated_by = (select auth.uid()),
         updated_at = now()
   where id = p_id;

  insert into public."TH_MONITORAMENTO"(
    id_registro, usuario_id, usuario_email, evento,
    campo_alterado, valor_anterior, valor_novo, snapshot_json
  ) values (
    p_id,
    (select auth.uid()),
    nullif((select auth.jwt()) ->> 'email', ''),
    'atualizado',
    'CO_AREA',
    v_de,
    v_area,
    jsonb_build_object('acao', 'mover_edital_de_area', 'de', v_de, 'para', v_area, 'motivo', v_motivo)
  );

  return jsonb_build_object('ok', true, 'id', p_id, 'de', v_de, 'para', v_area);
end;
$$;
comment on function public.mover_edital_de_area(uuid, text, text) is
  'Só admin: muda a área (CO_AREA) de um edital, com motivo, e registra em TH_MONITORAMENTO (campo_alterado = CO_AREA). Não mexe em TA_UNIDADE_AREA.';
revoke all on function public.mover_edital_de_area(uuid, text, text) from public, anon;
grant execute on function public.mover_edital_de_area(uuid, text, text) to authenticated, service_role;

-- 5. Unidades por área, para o formulário -------------------------------------
create or replace function public.listar_unidades_por_area()
returns table(unidade text, area text)
language sql
stable
security definer
set search_path to ''
as $$
  select r."NO_UNIDADE", r."CO_AREA"
    from public."TA_UNIDADE_AREA" r
   where (select auth.uid()) is not null
   order by r."CO_AREA", r."NO_UNIDADE";
$$;
comment on function public.listar_unidades_por_area() is
  'Unidades com área definida (TA_UNIDADE_AREA). Unidade do catálogo TD_UNIDADE fora daqui é da Saúde Indígena.';
revoke all on function public.listar_unidades_por_area() from public, anon;
grant execute on function public.listar_unidades_por_area() to authenticated, service_role;

commit;
