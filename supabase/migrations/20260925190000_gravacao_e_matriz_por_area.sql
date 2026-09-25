/*
  GRAVAÇÃO POR ÁREA E ÁREAS NA MATRIZ DE ACESSOS (etapa 5, parte 3)

  1. As 9 RPCs que gravam dados de editais passam a conferir a área logo no
     início, por private."FC_EXIGIR_AREA_EDITAL" (edital direto, por lista ou
     por candidato) ou private."FC_EXIGIR_AREA_SALVAR_EDITAL" (salvar edital:
     confere a área atual e a nova, calculada pela unidade e responsável do
     payload — assim ninguém cria nem move edital para área que não é sua).
  2. Configurações → Acessos: cada área vira uma coluna da matriz, como recurso
     "area:<código>" com nível sem_acesso (Não) ou leitor (Sim). O dado continua
     em RL_PERFIL_USUARIO_AREA; a matriz só lê e grava ali, e registra em
     TH_PERMISSAO_RECURSO como as outras permissões (com motivo). Admin já vê
     todas as áreas e não é editável.

  ROLLBACK: supabase/rollback/20260925190000_gravacao_e_matriz_por_area.sql
*/
begin;

create function private."FC_EXIGIR_AREA_EDITAL"(p_edital_id text)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if p_edital_id is not null and exists (
    select 1 from public."TB_MONITORAMENTO_INDIGENA" m
     where m.id::text = p_edital_id
       and not (m."CO_AREA" = any (private."FC_AREAS_USUARIO"()))
  ) then
    raise exception 'Sem permissão para editais desta área' using errcode = '42501';
  end if;
end;
$$;
comment on function private."FC_EXIGIR_AREA_EDITAL"(text) is
  'Barra gravação em edital de área que o usuário logado não vê. Edital inexistente passa (a RPC trata).';
revoke all on function private."FC_EXIGIR_AREA_EDITAL"(text) from public, anon, authenticated;

create function private."FC_EXIGIR_AREA_SALVAR_EDITAL"(p_payload jsonb)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  -- Área atual (edital existente) e área nova (o salvar regrava unidade e responsável do payload).
  perform private."FC_EXIGIR_AREA_EDITAL"(nullif(p_payload ->> 'id', ''));
  if not (private."FC_AREA_EDITAL"(nullif(p_payload ->> 'responsavel', ''), nullif(p_payload ->> 'unidade', ''))
          = any (private."FC_AREAS_USUARIO"())) then
    raise exception 'Sem permissão para editais desta área' using errcode = '42501';
  end if;
end;
$$;
comment on function private."FC_EXIGIR_AREA_SALVAR_EDITAL"(jsonb) is
  'Barra salvar edital se a área atual ou a nova (pela unidade e responsável do payload) não for do usuário logado.';
revoke all on function private."FC_EXIGIR_AREA_SALVAR_EDITAL"(jsonb) from public, anon, authenticated;

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

  if v_motivo is null then
    raise exception 'Informe o motivo da alteraÃ§Ã£o do cronograma';
  end if;

  if jsonb_typeof(coalesce(p_cronograma, '[]'::jsonb)) <> 'array' then
    raise exception 'Cronograma invÃ¡lido';
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
    raise exception 'Existem etapas incompletas ou com perÃ­odo invÃ¡lido';
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
    raise exception 'Status excepcional exige motivo e data da decisÃ£o';
  end if;

  if not pg_try_advisory_xact_lock(hashtext('cronograma:' || coalesce(v_id::text, auth.uid()::text, 'novo'))::bigint) then
    raise exception 'Outra alteraÃ§Ã£o deste cronograma estÃ¡ em andamento';
  end if;

  if v_id is not null then
    v_antes := private.snapshot_monitoramento_cronograma(v_id);
  end if;

  v_result := public.salvar_monitoramento_com_cronograma(p_payload, p_cronograma);
  v_id := nullif(v_result #>> '{registro,id}', '')::uuid;

  if v_id is null then
    raise exception 'O salvamento nÃ£o retornou o identificador do edital';
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

CREATE OR REPLACE FUNCTION public.salvar_monitoramento_com_cronograma(p_payload jsonb, p_cronograma jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
 SET lock_timeout TO '5s'
AS $function$
declare
  v_id uuid;
  v_row public."TB_MONITORAMENTO_INDIGENA"%rowtype;
  v_item jsonb;
  v_ordem integer := 0;
  v_auto boolean := coalesce((p_payload ->> 'cronograma_automatico')::boolean, false);
  v_total integer := jsonb_array_length(coalesce(p_cronograma,'[]'::jsonb));
  v_inicio date;
  v_fim date;
  v_estado jsonb;
begin
  perform private."FC_EXIGIR_AREA_SALVAR_EDITAL"(p_payload);
  if not ((private.pode_recurso('nucleo',2) or private.pode_recurso('calendario',2))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if not private.has_perm('cores') then
    raise exception 'Sem permissao para salvar monitoramento indigena';
  end if;

  v_id := nullif(p_payload ->> 'id','')::uuid;

  if v_id is null then
    insert into public."TB_MONITORAMENTO_INDIGENA"(
      processo, edital, id_unidade, sigla_unidade, tipo_unidade, unidade, uf, ciclo,
      vagas_total, data_inicio, data_fim, status, etapa, risco, responsavel,
      link_edital, observacoes, observacoes_internas, ativo, created_by, updated_by,
      cronograma_automatico, cronograma_pdf_path, cronograma_pdf_nome, cronograma_origem,
      cronograma_revisado_at, cronograma_revisado_por, status_override, etapa_override
    ) values (
      nullif(p_payload ->> 'processo',''),
      nullif(p_payload ->> 'edital',''),
      nullif(p_payload ->> 'id_unidade',''),
      nullif(p_payload ->> 'sigla_unidade',''),
      nullif(p_payload ->> 'tipo_unidade',''),
      nullif(p_payload ->> 'unidade',''),
      nullif(upper(p_payload ->> 'uf'),''),
      nullif(p_payload ->> 'ciclo',''),
      coalesce(nullif(p_payload ->> 'vagas_total','')::integer,0),
      nullif(p_payload ->> 'data_inicio','')::date,
      nullif(p_payload ->> 'data_fim','')::date,
      nullif(p_payload ->> 'status',''),
      nullif(p_payload ->> 'etapa',''),
      coalesce(nullif(p_payload ->> 'risco',''),'Baixo'),
      nullif(p_payload ->> 'responsavel',''),
      nullif(p_payload ->> 'link_edital',''),
      nullif(p_payload ->> 'observacoes',''),
      nullif(p_payload ->> 'observacoes_internas',''),
      true,
      auth.uid(), auth.uid(),
      v_auto,
      nullif(p_payload ->> 'cronograma_pdf_path',''),
      nullif(p_payload ->> 'cronograma_pdf_nome',''),
      nullif(p_payload ->> 'cronograma_origem',''),
      case when v_total > 0 then now() else null end,
      case when v_total > 0 then auth.uid() else null end,
      nullif(p_payload ->> 'status_override',''),
      nullif(p_payload ->> 'etapa_override','')
    ) returning * into v_row;
    v_id := v_row.id;
  else
    update public."TB_MONITORAMENTO_INDIGENA"
    set processo = nullif(p_payload ->> 'processo',''),
        edital = nullif(p_payload ->> 'edital',''),
        id_unidade = nullif(p_payload ->> 'id_unidade',''),
        sigla_unidade = nullif(p_payload ->> 'sigla_unidade',''),
        tipo_unidade = nullif(p_payload ->> 'tipo_unidade',''),
        unidade = nullif(p_payload ->> 'unidade',''),
        uf = nullif(upper(p_payload ->> 'uf'),''),
        ciclo = nullif(p_payload ->> 'ciclo',''),
        vagas_total = coalesce(nullif(p_payload ->> 'vagas_total','')::integer,0),
        data_inicio = nullif(p_payload ->> 'data_inicio','')::date,
        data_fim = nullif(p_payload ->> 'data_fim','')::date,
        status = nullif(p_payload ->> 'status',''),
        etapa = nullif(p_payload ->> 'etapa',''),
        risco = coalesce(nullif(p_payload ->> 'risco',''),'Baixo'),
        responsavel = nullif(p_payload ->> 'responsavel',''),
        link_edital = nullif(p_payload ->> 'link_edital',''),
        observacoes = nullif(p_payload ->> 'observacoes',''),
        observacoes_internas = nullif(p_payload ->> 'observacoes_internas',''),
        updated_by = auth.uid(),
        updated_at = now(),
        cronograma_automatico = v_auto,
        cronograma_pdf_path = coalesce(nullif(p_payload ->> 'cronograma_pdf_path',''), cronograma_pdf_path),
        cronograma_pdf_nome = coalesce(nullif(p_payload ->> 'cronograma_pdf_nome',''), cronograma_pdf_nome),
        cronograma_origem = nullif(p_payload ->> 'cronograma_origem',''),
        cronograma_revisado_at = case when v_total > 0 then now() else cronograma_revisado_at end,
        cronograma_revisado_por = case when v_total > 0 then auth.uid() else cronograma_revisado_por end,
        status_override = nullif(p_payload ->> 'status_override',''),
        etapa_override = nullif(p_payload ->> 'etapa_override','')
    where id = v_id
    returning * into v_row;
  end if;

  if v_row.id is null then
    raise exception 'Registro nao encontrado ou nao salvo';
  end if;

  if p_cronograma is not null then
    delete from public."TB_CRONOGRAMA_MONIT_INDIG" where monitoramento_id = v_id;
    for v_item in select * from jsonb_array_elements(coalesce(p_cronograma,'[]'::jsonb)) loop
      v_ordem := v_ordem + 1;
      insert into public."TB_CRONOGRAMA_MONIT_INDIG"(
        monitoramento_id, ordem, atividade, tipo_atividade, data_inicio, data_fim,
        concluida, observacao, origem, confianca_extracao, created_by, updated_by
      ) values (
        v_id,
        coalesce(nullif(v_item ->> 'ordem','')::integer, v_ordem),
        nullif(v_item ->> 'atividade',''),
        nullif(v_item ->> 'tipo_atividade',''),
        (v_item ->> 'data_inicio')::date,
        (v_item ->> 'data_fim')::date,
        nullif(v_item ->> 'concluida','')::boolean,
        nullif(v_item ->> 'observacao',''),
        coalesce(nullif(upper(v_item ->> 'origem'),''),'MANUAL'),
        nullif(v_item ->> 'confianca_extracao','')::numeric,
        auth.uid(), auth.uid()
      );
    end loop;
  end if;

  if v_auto and v_total > 0 then
    select min(data_inicio), max(data_fim)
    into v_inicio, v_fim
    from public."TB_CRONOGRAMA_MONIT_INDIG"
    where monitoramento_id = v_id;

    update public."TB_MONITORAMENTO_INDIGENA"
    set data_inicio = v_inicio,
        data_fim = v_fim,
        updated_at = now()
    where id = v_id;
  end if;

  v_estado := public.get_monitoramento_cronograma_estado(v_id, current_date);

  update public."TB_MONITORAMENTO_INDIGENA"
  set status = coalesce(v_estado ->> 'status', status),
      etapa = coalesce(v_estado ->> 'etapa', etapa),
      updated_at = now()
  where id = v_id
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'registro', to_jsonb(v_row),
    'estado', v_estado,
    'cronograma_total', v_total
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.importar_lista_aprovados(p_edital_id text, p_ativo boolean, p_arquivo_nome text, p_arquivo_path text, p_candidatos jsonb, p_substituir boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.papel_recurso('importacao');
  v_lista_id uuid;
  v_lista_atual uuid;
  v_ja_teve_lista boolean;
  v_total integer;
  v_edital text;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital_id);
  if not (private.pode_recurso('importacao',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if (select auth.uid()) is null then raise exception 'Usuario nao autenticado'; end if;
  if v_role not in ('edital_gestor', 'contratador', 'admin') then
    raise exception 'Perfil sem permissao para importar lista de aprovados';
  end if;
  if p_edital_id is null then raise exception 'Edital nao informado'; end if;
  if nullif(btrim(p_arquivo_nome), '') is null or nullif(btrim(p_arquivo_path), '') is null then
    raise exception 'Arquivo XLSX nao informado';
  end if;
  if jsonb_typeof(p_candidatos) <> 'array' or jsonb_array_length(p_candidatos) = 0 then
    raise exception 'A lista precisa conter pelo menos um candidato';
  end if;

  select m.edital into v_edital from public."TB_MONITORAMENTO_INDIGENA" m where m.id::text = p_edital_id;
  if not found then raise exception 'Edital nao encontrado na Equipe Nucleo'; end if;

  select exists(select 1 from public."TB_LISTA_APROVADO" where edital_id = p_edital_id)
    into v_ja_teve_lista;
  select id into v_lista_atual
  from public."TB_LISTA_APROVADO"
  where edital_id = p_edital_id and vigente is true
  for update;

  if v_ja_teve_lista and v_role <> 'admin' then
    raise exception 'Somente admin pode substituir ou importar novamente uma lista ja cadastrada';
  end if;
  if v_lista_atual is not null and not coalesce(p_substituir, false) then
    raise exception 'Este edital ja possui lista. Use a opcao de substituicao administrativa';
  end if;
  if coalesce(p_substituir, false) and v_role <> 'admin' then
    raise exception 'Somente admin pode substituir lista de aprovados';
  end if;

  if v_lista_atual is not null then
    update public."TB_LISTA_APROVADO"
    set vigente = false, ativo = false, substituido_por = (select auth.uid()),
        substituido_em = now(), updated_at = now()
    where id = v_lista_atual;
  end if;

  insert into public."TB_LISTA_APROVADO"(
    edital_id, ativo, vigente, arquivo_nome, arquivo_path, importado_por
  ) values (
    p_edital_id, coalesce(p_ativo, true), true, btrim(p_arquivo_nome),
    btrim(p_arquivo_path), (select auth.uid())
  ) returning id into v_lista_id;

  insert into public."TB_CANDIDATO_APROVADO"(
    lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade,
    sub_judice, created_by, updated_by
  )
  select v_lista_id,
         nullif(btrim(x.codigo_vaga), ''),
         nullif(btrim(x.cargo), ''),
         x.classificacao,
         x.nota,
         nullif(btrim(x.nome), ''),
         nullif(btrim(x.modalidade), ''),
         false,
         (select auth.uid()),
         (select auth.uid())
  from jsonb_to_recordset(p_candidatos) as x(
    codigo_vaga text,
    cargo text,
    classificacao integer,
    nota numeric,
    nome text,
    modalidade text
  );

  get diagnostics v_total = row_count;
  if v_total <> jsonb_array_length(p_candidatos) then
    raise exception 'Nem todos os candidatos puderam ser importados';
  end if;

  return jsonb_build_object(
    'ok', true, 'lista_id', v_lista_id, 'edital_id', p_edital_id,
    'edital', v_edital, 'total', v_total, 'ativo', coalesce(p_ativo, true)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.incluir_sub_judice(p_edital_id text, p_cargo text, p_nome text, p_nota numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.papel_recurso('aprovados');
  v_lista public."TB_LISTA_APROVADO"%rowtype;
  v_candidato_id uuid;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital_id);
  if not (private.pode_recurso('aprovados',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if v_role not in ('contratador', 'admin') then raise exception 'Perfil sem permissao para incluir sub judice'; end if;
  if nullif(btrim(coalesce(p_cargo, '')), '') is null then raise exception 'Cargo obrigatorio'; end if;
  if nullif(btrim(coalesce(p_nome, '')), '') is null then raise exception 'Nome obrigatorio'; end if;
  if p_nota is null or p_nota < 0 then raise exception 'Nota invalida'; end if;

  select * into v_lista
  from public."TB_LISTA_APROVADO"
  where edital_id = p_edital_id and vigente is true
  for update;
  if not found then raise exception 'O edital ainda nao possui lista vigente'; end if;
  if not v_lista.ativo then raise exception 'A lista esta inativa e nao permite incluir sub judice'; end if;

  if not exists (
    select 1 from public."TB_CANDIDATO_APROVADO"
    where lista_id = v_lista.id and removido_em is null and cargo = btrim(p_cargo)
  ) then
    raise exception 'Cargo nao pertence a lista vigente deste edital';
  end if;

  insert into public."TB_CANDIDATO_APROVADO"(
    lista_id, cargo, nota, nome, sub_judice, created_by, updated_by
  ) values (
    v_lista.id, btrim(p_cargo), p_nota, btrim(p_nome), true,
    (select auth.uid()), (select auth.uid())
  ) returning id into v_candidato_id;

  return jsonb_build_object('ok', true, 'candidato_id', v_candidato_id, 'lista_id', v_lista.id, 'sub_judice', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_configuracao_convocacao(p_edital_id text, p_proporcionalidade boolean, p_modelo_id uuid, p_padrao_imediata integer, p_vagas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_edital text := btrim(p_edital_id);
  v_tipo text := case
    when coalesce(p_proporcionalidade, true) then 'COM_PROPORCIONALIDADE'
    else 'SEM_PROPORCIONALIDADE'
  end;
  v_total integer := 0;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"(p_edital_id);
  if not (private.pode_recurso('importacao',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if not private.pode_recurso('importacao',2) then
    raise exception 'Perfil sem permissao para configurar a convocacao';
  end if;
  if nullif(v_edital, '') is null then
    raise exception 'Edital nao informado';
  end if;
  if not exists (
    select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id::text = v_edital
  ) then
    raise exception 'Edital nao encontrado na Equipe Nucleo';
  end if;
  if p_modelo_id is not null and not exists (
    select 1 from public."TB_MODELO_CONVOCACAO" where "CO_MODELO" = p_modelo_id
  ) then
    raise exception 'Modelo de convocacao nao encontrado';
  end if;
  if p_vagas is not null and jsonb_typeof(p_vagas) <> 'array' then
    raise exception 'A lista de vagas precisa ser um arranjo';
  end if;

  insert into public."TB_CONVOCACAO_EDITAL"(
    "CO_EDITAL", "TP_CONVOCACAO", "CO_MODELO",
    "QT_PADRAO_IMEDIATA", "CO_USUARIO_ATUALIZACAO"
  ) values (
    v_edital, v_tipo, p_modelo_id,
    greatest(coalesce(p_padrao_imediata, 0), 0),
    (select auth.uid())
  )
  on conflict ("CO_EDITAL") do update
  set "TP_CONVOCACAO" = excluded."TP_CONVOCACAO",
      "CO_MODELO" = excluded."CO_MODELO",
      "QT_PADRAO_IMEDIATA" = excluded."QT_PADRAO_IMEDIATA",
      "CO_USUARIO_ATUALIZACAO" = excluded."CO_USUARIO_ATUALIZACAO",
      "DT_ATUALIZACAO" = now();

  delete from public."TB_VAGA_IMEDIATA" where "CO_EDITAL" = v_edital;

  if p_vagas is not null and jsonb_array_length(p_vagas) > 0 then
    insert into public."TB_VAGA_IMEDIATA"(
      "CO_EDITAL", "CO_VAGA", "NO_CARGO",
      "QT_VAGA_IMEDIATA", "ST_QUADRO_MANUAL", "DS_QUADRO_MANUAL",
      "CO_USUARIO_ATUALIZACAO"
    )
    select v_edital,
           btrim(x.codigo_vaga),
           nullif(btrim(x.cargo), ''),
           greatest(coalesce(x.imediatas, 0), 0),
           case when coalesce(x.manual, false) then 'S' else 'N' end,
           case when jsonb_typeof(coalesce(x.quadro, '{}'::jsonb)) = 'object'
                then coalesce(x.quadro, '{}'::jsonb) else '{}'::jsonb end,
           (select auth.uid())
    from jsonb_to_recordset(p_vagas) as x(
      codigo_vaga text,
      cargo text,
      imediatas integer,
      manual boolean,
      quadro jsonb
    )
    where nullif(btrim(x.codigo_vaga), '') is not null;
    get diagnostics v_total = row_count;
  end if;

  return jsonb_build_object(
    'ok', true,
    'edital_id', v_edital,
    'modelo_id', p_modelo_id,
    'vagas', v_total
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.alterar_status_candidato_aprovado(p_candidato_id uuid, p_status text, p_processo_sei text DEFAULT NULL::text, p_matricula text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.papel_recurso('aprovados');
  v_candidato public."TB_CANDIDATO_APROVADO"%rowtype;
  v_lista public."TB_LISTA_APROVADO"%rowtype;
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
  v_matricula text := nullif(btrim(coalesce(p_matricula, '')), '');
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_CANDIDATO_APROVADO" c join public."TB_LISTA_APROVADO" l on l.id = c.lista_id where c.id = p_candidato_id));
  if not (private.pode_recurso('aprovados',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if v_role not in ('contratador', 'admin') then
    raise exception 'Perfil sem permissao para alterar status';
  end if;

  if v_status is not null and v_status not in (
    'Contratado', 'Desistente', 'Migração', 'Documentação Rejeitada', 'Fim de Fila'
  ) then
    raise exception 'Status invalido';
  end if;

  if v_status in ('Contratado', 'Migração') and v_matricula is null then
    raise exception 'Matricula obrigatoria para Contratado ou Migracao';
  end if;

  select * into v_candidato
  from public."TB_CANDIDATO_APROVADO"
  where id = p_candidato_id and removido_em is null
  for update;
  if not found then raise exception 'Candidato nao encontrado'; end if;

  select * into v_lista
  from public."TB_LISTA_APROVADO"
  where id = v_candidato.lista_id and vigente is true
  for update;
  if not found then raise exception 'Lista vigente nao encontrada'; end if;
  if not v_lista.ativo then
    raise exception 'A lista esta inativa e nao permite alterar candidatos';
  end if;

  insert into public."TH_CANDIDATO_APROVADO"(
    candidato_id, lista_id, status_anterior, status_novo,
    processo_sei, matricula, alterado_por
  ) values (
    v_candidato.id, v_candidato.lista_id, v_candidato.status, v_status,
    nullif(btrim(coalesce(p_processo_sei, '')), ''), v_matricula,
    (select auth.uid())
  );

  update public."TB_CANDIDATO_APROVADO"
  set status = v_status,
      processo_sei = nullif(btrim(coalesce(p_processo_sei, '')), ''),
      matricula = case
        when v_status in ('Contratado', 'Migração') then v_matricula
        else null
      end,
      updated_by = (select auth.uid()),
      updated_at = now()
  where id = v_candidato.id;

  return jsonb_build_object(
    'ok', true,
    'candidato_id', v_candidato.id,
    'status', v_status,
    'matricula', v_matricula
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.remover_sub_judice(p_candidato_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.papel_recurso('aprovados');
  v_lista_id uuid;
  v_ativo boolean;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_CANDIDATO_APROVADO" c join public."TB_LISTA_APROVADO" l on l.id = c.lista_id where c.id = p_candidato_id));
  if not (private.pode_recurso('aprovados',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if v_role not in ('contratador', 'admin') then raise exception 'Perfil sem permissao para remover sub judice'; end if;

  select c.lista_id, l.ativo into v_lista_id, v_ativo
  from public."TB_CANDIDATO_APROVADO" c
  join public."TB_LISTA_APROVADO" l on l.id = c.lista_id and l.vigente is true
  where c.id = p_candidato_id and c.sub_judice is true and c.removido_em is null
  for update of c, l;
  if not found then raise exception 'Candidato sub judice vigente nao encontrado'; end if;
  if not v_ativo then raise exception 'A lista esta inativa e nao permite remover sub judice'; end if;

  update public."TB_CANDIDATO_APROVADO"
  set removido_em = now(), removido_por = (select auth.uid()),
      updated_by = (select auth.uid()), updated_at = now()
  where id = p_candidato_id;

  return jsonb_build_object('ok', true, 'candidato_id', p_candidato_id, 'lista_id', v_lista_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.definir_lista_aprovados_ativa(p_lista_id uuid, p_ativo boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_role text := private.papel_recurso('importacao');
  v_edital_id text;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_LISTA_APROVADO" l where l.id = p_lista_id));
  if not (private.pode_recurso('importacao',2)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if v_role not in ('edital_gestor', 'contratador', 'admin') then
    raise exception 'Perfil sem permissao para alterar a lista';
  end if;
  update public."TB_LISTA_APROVADO"
  set ativo = coalesce(p_ativo, false), updated_at = now()
  where id = p_lista_id and vigente is true
  returning edital_id into v_edital_id;
  if not found then raise exception 'Lista vigente nao encontrada'; end if;
  return jsonb_build_object('ok', true, 'lista_id', p_lista_id, 'edital_id', v_edital_id, 'ativo', coalesce(p_ativo, false));
end;
$function$;

CREATE OR REPLACE FUNCTION public.remover_lista_aprovados(p_lista_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_edital_id text;
begin
  perform private."FC_EXIGIR_AREA_EDITAL"((select l.edital_id from public."TB_LISTA_APROVADO" l where l.id = p_lista_id));
  if not (private.pode_recurso('importacao',3)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if private.papel_recurso('importacao') <> 'admin' then raise exception 'Somente admin pode remover lista de aprovados'; end if;
  update public."TB_LISTA_APROVADO"
  set vigente = false, ativo = false, substituido_por = (select auth.uid()),
      substituido_em = now(), updated_at = now()
  where id = p_lista_id and vigente is true
  returning edital_id into v_edital_id;
  if not found then raise exception 'Lista vigente nao encontrada'; end if;
  return jsonb_build_object('ok', true, 'lista_id', p_lista_id, 'edital_id', v_edital_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.obter_matriz_acessos(p_busca text DEFAULT ''::text, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare resultado jsonb;
begin
  if not private.is_master() then raise exception 'Somente administradores podem gerenciar acessos' using errcode='42501'; end if;
  with usuarios as (
    select u.id,u.user_id,u.email,u.nome,u.perfil,u.ativo from public."TB_PERFIL_USUARIO" u
    where u.ativo and (coalesce(u.nome,'') ilike '%'||left(p_busca,100)||'%' or u.email ilike '%'||left(p_busca,100)||'%')
    order by lower(u.email),u.id limit 30 offset greatest(p_offset,0)
  ), recursos as (
    select m recurso from unnest(array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes']) m
    union all select 'painel:'||id from public."TB_PAINEL_EXTERNO" where ativo
    union all select 'area:'||a."CO_AREA" from public."TB_AREA" a
  )
  select jsonb_build_object('usuarios',coalesce((select jsonb_agg(to_jsonb(u)||jsonb_build_object('permissoes',
    (select jsonb_object_agg(r.recurso,jsonb_build_object('nivel',case when r.recurso like 'area:%' then case when exists(select 1 from public."RL_PERFIL_USUARIO_AREA" x where x."CO_PERFIL_USUARIO"=u.id and 'area:'||x."CO_AREA"=r.recurso) then 'leitor' else 'sem_acesso' end else coalesce(g.nivel,case when r.recurso like 'painel:%' then 'sem_acesso' else private.nivel_padrao_recurso(u.perfil,r.recurso) end) end,'revisao',coalesce(g.revisao,0)))
    from recursos r left join public."TB_PERMISSAO_RECURSO" g on g.perfil_usuario_id=u.id and g.recurso=r.recurso))) from usuarios u),'[]'::jsonb),
    'total',(select count(*) from public."TB_PERFIL_USUARIO" u where u.ativo and (coalesce(u.nome,'') ilike '%'||left(p_busca,100)||'%' or u.email ilike '%'||left(p_busca,100)||'%')),
    'areas',coalesce((select jsonb_agg(jsonb_build_object('id',a."CO_AREA",'titulo',a."NO_AREA") order by a."NU_ORDEM") from public."TB_AREA" a),'[]'::jsonb),
    'paineis',coalesce((select jsonb_agg(jsonb_build_object('id',id,'titulo',titulo) order by ordem,titulo) from public."TB_PAINEL_EXTERNO" where ativo),'[]'::jsonb),
    'historico',coalesce((select jsonb_agg(to_jsonb(h)) from (
      select h.*,u.email,autor.email autor from public."TH_PERMISSAO_RECURSO" h
      left join public."TB_PERFIL_USUARIO" u on u.id=h.perfil_usuario_id
      left join lateral (select a.email from public."TB_PERFIL_USUARIO" a where a.user_id=h.alterado_por order by a.updated_at desc limit 1) autor on true
      order by h.alterado_em desc,h.id desc limit 50) h),'[]'::jsonb)) into resultado;
  return resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION public.salvar_matriz_acessos(p_alteracoes jsonb, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item jsonb; alvo public."TB_PERFIL_USUARIO"; anterior text; revisao_atual integer; recurso_atual text; novo text; quantidade integer:=0;
begin
  if not private.is_master() then raise exception 'Somente administradores podem gerenciar acessos' using errcode='42501'; end if;
  if jsonb_typeof(p_alteracoes) is distinct from 'array' or jsonb_array_length(p_alteracoes) not between 1 and 500 then raise exception 'Alterações inválidas'; end if;
  if length(btrim(coalesce(p_motivo,''))) not between 3 and 500 then raise exception 'Informe um motivo entre 3 e 500 caracteres'; end if;
  -- Serializes absent-row inserts as well as updates. Revision checks avoid lost updates.
  perform pg_advisory_xact_lock(73923124153);
  for item in select value from jsonb_array_elements(p_alteracoes) loop
    select * into alvo from public."TB_PERFIL_USUARIO" where id=(item->>'usuario_id')::uuid and ativo for update;
    if alvo.id is null then raise exception 'Usuário ativo não encontrado'; end if;
    if alvo.user_id=(select auth.uid()) or lower(alvo.email)=lower(coalesce((select auth.jwt()->>'email'),'')) then raise exception 'Outro administrador deve alterar seu acesso'; end if;
    recurso_atual:=item->>'recurso'; novo:=item->>'nivel';
    if recurso_atual like 'area:%' then
      if not exists(select 1 from public."TB_AREA" a where 'area:'||a."CO_AREA"=recurso_atual) then raise exception 'Área inválida'; end if;
      if novo is null or novo not in ('sem_acesso','leitor') then raise exception 'Área aceita apenas Sim ou Não'; end if;
      if lower(coalesce(alvo.perfil,''))='admin' then raise exception 'Administrador já vê todas as áreas'; end if;
      anterior:=case when exists(select 1 from public."RL_PERFIL_USUARIO_AREA" x where x."CO_PERFIL_USUARIO"=alvo.id and 'area:'||x."CO_AREA"=recurso_atual) then 'leitor' else 'sem_acesso' end;
      if anterior=novo then continue; end if;
      if novo='leitor' then
        insert into public."RL_PERFIL_USUARIO_AREA"("CO_PERFIL_USUARIO","CO_AREA") values(alvo.id,substr(recurso_atual,6));
      else
        delete from public."RL_PERFIL_USUARIO_AREA" where "CO_PERFIL_USUARIO"=alvo.id and "CO_AREA"=substr(recurso_atual,6);
      end if;
      insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id,recurso,nivel_anterior,nivel_novo,alterado_por,motivo)
      values(alvo.id,recurso_atual,anterior,novo,(select auth.uid()),btrim(p_motivo));
      quantidade:=quantidade+1;
      continue;
    end if;
    if recurso_atual is null or (recurso_atual not in ('dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes') and not exists(select 1 from public."TB_PAINEL_EXTERNO" where 'painel:'||id=recurso_atual and ativo)) then raise exception 'Recurso inválido'; end if;
    if novo is null or novo not in ('sem_acesso','leitor','editor','admin') then raise exception 'Nível inválido'; end if;
    if recurso_atual='configuracoes' and novo='leitor' then raise exception 'Configurações exige Editor ou Administrador'; end if;
    if recurso_atual like 'painel:%' and novo not in ('sem_acesso','leitor') then raise exception 'Painel externo permite apenas acesso de leitura no portal'; end if;
    select nivel,revisao into anterior,revisao_atual from public."TB_PERMISSAO_RECURSO" where perfil_usuario_id=alvo.id and recurso=recurso_atual;
    if item->>'revisao' is null or coalesce(revisao_atual,0)<>(item->>'revisao')::integer then raise exception 'Permissão alterada por outro administrador. Recarregue a matriz.' using errcode='40001'; end if;
    anterior:=coalesce(anterior,case when recurso_atual like 'painel:%' then 'sem_acesso' else private.nivel_padrao_recurso(alvo.perfil,recurso_atual) end);
    if anterior=novo then continue; end if;
    insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id,recurso,nivel,updated_by) values(alvo.id,recurso_atual,novo,(select auth.uid()))
    on conflict(perfil_usuario_id,recurso) do update set nivel=excluded.nivel,revisao="TB_PERMISSAO_RECURSO".revisao+1,updated_at=now(),updated_by=excluded.updated_by;
    insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id,recurso,nivel_anterior,nivel_novo,alterado_por,motivo)
    values(alvo.id,recurso_atual,anterior,novo,(select auth.uid()),btrim(p_motivo));
    quantidade:=quantidade+1;
  end loop;
  return jsonb_build_object('alteradas',quantidade);
end;
$function$;

commit;
