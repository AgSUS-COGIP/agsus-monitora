/*
  RECORTE POR COORDENAÇÃO NAS RPCs (permissões, parte 3)

  Depende de 20260929121100_coordenacoes.sql. As RPCs são SECURITY DEFINER de
  `postgres` (passam por cima das policies), então cada uma repete o recorte:

  GRAVAÇÃO — sem reescrever as RPCs: os dois porteiros que todas já chamam
  passam a conferir a coordenação.
    * FC_EXIGIR_AREA_EDITAL(id): o edital tem de ser visível (FC_PODE_VER_EDITAL).
    * FC_EXIGIR_AREA_SALVAR_EDITAL(payload): além da área, quem está numa
      coordenação com recorte só grava edital que caia na regra dela
      (responsável/unidades). Edital atribuído à coordenação pela lista
      explícita pode ser editado mesmo fora da regra. Coordenação só com
      editais listados não cria edital novo (o admin atribui).

  LEITURA — os corpos abaixo são os ATUAIS (arquivo de origem citado antes de
  cada um), com uma única troca, gerada por script e revisada:
    * editais: ao lado de `m."CO_AREA" = any (FC_AREAS_USUARIO())` entra
      `(FC_EDITAIS_VISIVEIS() is null or m.id = any (FC_EDITAIS_VISIVEIS()))`;
      `not (m."CO_AREA" = any (…))` vira `not FC_PODE_VER_EDITAL(m.id)`;
    * análises: ao lado de `grupo_norm = any (v_grupos_norm)` entra o recorte
      por edital_norm/unidade_norm; no detalhe, a linha tem de estar no recorte.
  Tudo dentro de `(select …)`: InitPlan, uma chamada por consulta.

  Quem não está em coordenação (ou está numa sem regra e sem editais) recebe
  FC_EDITAIS_VISIVEIS() = null: o comportamento de antes, só por área.

  ROLLBACK: reaplicar os corpos dos arquivos citados em cada função.
*/
begin;

-- Porteiros de gravação ---------------------------------------------------------------
create or replace function private."FC_EXIGIR_AREA_EDITAL"(p_edital_id text)
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
       and not private."FC_PODE_VER_EDITAL"(m.id)
  ) then
    raise exception 'Sem permissão para editais desta área ou coordenação' using errcode = '42501';
  end if;
end;
$$;
comment on function private."FC_EXIGIR_AREA_EDITAL"(text) is
  'Barra (42501) gravação em edital fora da área ou da coordenação do usuário. Edital inexistente passa (a RPC trata).';

create or replace function private."FC_EXIGIR_AREA_SALVAR_EDITAL"(p_payload jsonb)
returns void
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_area text := nullif(btrim(p_payload ->> 'co_area'), '');
  v_id text := nullif(p_payload ->> 'id', '');
  v_coordenacao text;
  v_responsavel text;
  v_unidades text[];
begin
  -- Área atual (edital existente) e área nova (o salvar regrava unidade e responsável do payload).
  perform private."FC_EXIGIR_AREA_EDITAL"(v_id);
  if v_area is not null then
    -- Com área pretendida, é ela que vale (FC_ACERTAR_AREA_EDITAL confere a unidade).
    if not (v_area = any (private."FC_AREAS_USUARIO"())) then
      raise exception 'Sem permissão para editais desta área' using errcode = '42501';
    end if;
  elsif not (private."FC_AREA_EDITAL"(nullif(p_payload ->> 'responsavel', ''), nullif(p_payload ->> 'unidade', ''))
          = any (private."FC_AREAS_USUARIO"())) then
    raise exception 'Sem permissão para editais desta área' using errcode = '42501';
  end if;

  -- Coordenação com recorte: o edital gravado tem de continuar dentro dela.
  if private."FC_EDITAIS_VISIVEIS"() is null then
    return;
  end if;
  v_coordenacao := private."FC_COORDENACAO_USUARIO"();
  if v_id is not null and exists (
    select 1 from public."RL_COORDENACAO_EDITAL" e
     where e."CO_COORDENACAO" = v_coordenacao and e."CO_EDITAL"::text = v_id
  ) then
    return;
  end if;
  select c."TP_RESPONSAVEL" into v_responsavel from public."TB_COORDENACAO" c where c."CO_COORDENACAO" = v_coordenacao;
  select coalesce(array_agg(public.analises_norm_key(u."NO_UNIDADE")), '{}') into v_unidades
    from public."RL_COORDENACAO_UNIDADE" u where u."CO_COORDENACAO" = v_coordenacao;
  if v_responsavel is null and cardinality(v_unidades) = 0 then
    raise exception 'Sua coordenação trabalha só com editais atribuídos. Peça ao administrador para cadastrar e atribuir o edital.'
      using errcode = '42501';
  end if;
  if v_responsavel is not null and upper(btrim(coalesce(p_payload ->> 'responsavel', ''))) <> v_responsavel then
    raise exception 'Sua coordenação só grava editais com responsável %', v_responsavel using errcode = '42501';
  end if;
  if cardinality(v_unidades) > 0
     and not (coalesce(public.analises_norm_key(p_payload ->> 'unidade'), '') = any (v_unidades)) then
    raise exception 'Esta unidade não é da sua coordenação' using errcode = '42501';
  end if;
end;
$$;
comment on function private."FC_EXIGIR_AREA_SALVAR_EDITAL"(jsonb) is
  'Barra (42501) salvar edital fora da área do usuário ou fora da regra da coordenação dele.';

-- Leituras --------------------------------------------------------------------------------
-- public.listar_etapas_do_cronograma: corpo de 20260925181000_recorta_dados_por_area.sql, com o recorte da coordenação.
CREATE OR REPLACE FUNCTION public.listar_etapas_do_cronograma()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
begin
  if not private.has_perm('cores') then
    raise exception 'Sem permissao para consultar cronograma';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'monitoramento_id', c.monitoramento_id,
      'ordem', c.ordem,
      'atividade', c.atividade,
      'data_inicio', c.data_inicio,
      'data_fim', c.data_fim
    ) order by c.monitoramento_id, c.ordem)
    from public."TB_CRONOGRAMA_MONIT_INDIG" c
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id = c.monitoramento_id
    where m.ativo
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
  ), '[]'::jsonb);
end;
$function$;

-- public.get_nucleo_cronograma_resumo: corpo de 20260925181000_recorta_dados_por_area.sql, com o recorte da coordenação.
CREATE OR REPLACE FUNCTION public.get_nucleo_cronograma_resumo()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
begin
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then
    raise exception 'Sem permissao para consultar resumo da Equipe Nucleo';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id,
      'edital', m.edital,
      'unidade', m.unidade,
      'status', e ->> 'status',
      'etapa', e ->> 'etapa',
      'cronograma_automatico', m.cronograma_automatico,
      'cronograma_total', coalesce(c.total, 0),
      'tem_resultado_final', coalesce(c.tem_resultado_final, false),
      'percentual', coalesce((e ->> 'percentual')::numeric, 0),
      'proxima_atividade', e ->> 'proxima_atividade',
      'proxima_data', e ->> 'proxima_data',
      'dias_para_proxima', (e ->> 'dias_para_proxima')::integer,
      'status_override', m.status_override,
      'alerta_tipo', case
        when nullif(m.status_override, '') is not null then 'excepcional'
        when not m.cronograma_automatico or coalesce(c.total, 0) = 0 then 'sem_cronograma'
        when coalesce(c.total, 0) < 2 or not coalesce(c.tem_resultado_final, false) then 'incompleto'
        when (e ->> 'dias_para_proxima')::integer between 0 and 3 then 'proxima_3d'
        when (e ->> 'dias_para_proxima')::integer between 4 and 7 then 'proxima_7d'
        else 'ok'
      end
    ) order by m.unidade, m.edital)
    from public."TB_MONITORAMENTO_INDIGENA" m
    cross join lateral public.get_monitoramento_cronograma_estado(m.id, current_date) e
    left join lateral (
      select
        count(*)::integer as total,
        bool_or(lower(atividade) like '%resultado final%') as tem_resultado_final
      from public."TB_CRONOGRAMA_MONIT_INDIG" c
      where c.monitoramento_id = m.id
    ) c on true
    where m.ativo is true
      and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
  ), '[]'::jsonb);
end;
$function$;

-- public.get_monitoramento_cronograma: corpo de 20260925181000_recorta_dados_por_area.sql, com o recorte da coordenação.
CREATE OR REPLACE FUNCTION public.get_monitoramento_cronograma(p_monitoramento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
begin
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then
    raise exception 'Sem permissao para consultar cronograma';
  end if;

  if exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_monitoramento_id and not private."FC_PODE_VER_EDITAL"(m.id)) then
    raise exception 'Sem permissão para editais desta área' using errcode='42501';
  end if;

  return jsonb_build_object(
    'monitoramento', (
      select jsonb_build_object(
        'id', m.id,
        'edital', m.edital,
        'unidade', m.unidade,
        'cronograma_automatico', m.cronograma_automatico,
        'cronograma_origem', m.cronograma_origem,
        'cronograma_revisado_at', m.cronograma_revisado_at,
        'status_override', m.status_override,
        'etapa_override', m.etapa_override,
        'status_override_motivo', m.status_override_motivo,
        'status_override_data', m.status_override_data,
        'status_override_previsao_retomada', m.status_override_previsao_retomada,
        'cronograma_ultima_errata', m.cronograma_ultima_errata
      )
      from public."TB_MONITORAMENTO_INDIGENA" m
      where m.id = p_monitoramento_id
    ),
    'estado', public.get_monitoramento_cronograma_estado(p_monitoramento_id, current_date),
    'etapas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'ordem', c.ordem,
        'atividade', c.atividade,
        'tipo_atividade', c.tipo_atividade,
        'data_inicio', c.data_inicio,
        'data_fim', c.data_fim,
        'concluida', c.concluida,
        'observacao', c.observacao,
        'origem', c.origem,
        'confianca_extracao', c.confianca_extracao
      ) order by c.ordem)
      from public."TB_CRONOGRAMA_MONIT_INDIG" c
      where c.monitoramento_id = p_monitoramento_id
    ), '[]'::jsonb),
    'historico', public.get_monitoramento_cronograma_historico(p_monitoramento_id, 20)
  );
end;
$function$;

-- public.get_monitoramento_cronograma_historico: corpo de 20260925181000_recorta_dados_por_area.sql, com o recorte da coordenação.
CREATE OR REPLACE FUNCTION public.get_monitoramento_cronograma_historico(p_monitoramento_id uuid, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
begin
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if not ((private.pode_recurso('dashboard') or private.pode_recurso('nucleo') or private.pode_recurso('calendario') or private.pode_recurso('aprovados') or private.pode_recurso('importacao'))) then
    raise exception 'Sem permissao para consultar historico do cronograma';
  end if;

  if exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_monitoramento_id and not private."FC_PODE_VER_EDITAL"(m.id)) then
    raise exception 'Sem permissão para editais desta área' using errcode='42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', v.id,
      'acao', v.acao,
      'motivo', v.motivo,
      'numero_errata', v.numero_errata,
      'created_by_email', v.created_by_email,
      'alteracoes', v.alteracoes,
      'total_alteracoes', v.total_alteracoes,
      'created_at', v.created_at
    ) order by v.created_at desc)
    from (
      select *
      from public."TH_CRONOGRAMA_MONIT_INDIG"
      where monitoramento_id = p_monitoramento_id
      order by created_at desc
      limit least(greatest(coalesce(p_limit, 20), 1), 100)
    ) v
  ), '[]'::jsonb);
end;
$function$;

-- public.listar_candidatos_aprovados: corpo de 20260925181000_recorta_dados_por_area.sql, com o recorte da coordenação.
CREATE OR REPLACE FUNCTION public.listar_candidatos_aprovados()
 RETURNS TABLE(candidato_id uuid, lista_id uuid, edital_id text, edital text, unidade text, cargo text, classificacao integer, nota numeric, nome text, modalidade text, status text, processo_sei text, matricula text, sub_judice boolean, lista_ativa boolean, arquivo_nome text, importado_em timestamp with time zone, codigo_vaga text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not (private.pode_recurso('aprovados',1)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if private.papel_recurso('aprovados') = '' then
    raise exception 'Perfil sem acesso ao sistema';
  end if;
  return query
  select c.id, l.id, l.edital_id, m.edital, m.unidade, c.cargo, c.classificacao,
         c.nota, c.nome, c.modalidade, c.status, c.processo_sei, c.matricula,
         c.sub_judice, l.ativo, l.arquivo_nome, l.importado_em, c.codigo_vaga
  from public."TB_LISTA_APROVADO" l
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
  join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
  where l.vigente is true
    and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
    and c.removido_em is null
  order by m.edital, c.cargo, c.classificacao nulls last, c.nome;
end;
$function$;

-- public.listar_configuracao_convocacao: corpo de 20260925181000_recorta_dados_por_area.sql, com o recorte da coordenação.
CREATE OR REPLACE FUNCTION public.listar_configuracao_convocacao()
 RETURNS TABLE(edital_id text, proporcionalidade boolean, modelo_id uuid, padrao_imediata integer, vagas jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not ((private.pode_recurso('aprovados') or private.pode_recurso('importacao',2))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if private.monitora_role() = '' then
    raise exception 'Perfil sem acesso ao sistema';
  end if;
  return query
  select c."CO_EDITAL",
         c."TP_CONVOCACAO" = 'COM_PROPORCIONALIDADE',
         c."CO_MODELO",
         c."QT_PADRAO_IMEDIATA",
         coalesce(
           (
             select jsonb_agg(
               jsonb_build_object(
                 'codigo_vaga', v."CO_VAGA",
                 'cargo', v."NO_CARGO",
                 'imediatas', v."QT_VAGA_IMEDIATA",
                 'manual', v."ST_QUADRO_MANUAL" = 'S',
                 'quadro', v."DS_QUADRO_MANUAL"
               )
               order by v."CO_VAGA"
             )
             from public."TB_VAGA_IMEDIATA" v
             where v."CO_EDITAL" = c."CO_EDITAL"
           ),
           '[]'::jsonb
         )
  from public."TB_CONVOCACAO_EDITAL" c
  where c."CO_EDITAL" in (
    select m.id::text from public."TB_MONITORAMENTO_INDIGENA" m
     where m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
  )
  order by c."CO_EDITAL";
end;
$function$;

-- public.listar_listas_aprovados: corpo de 20260928180000_autoria_e_trava_da_lista_de_aprovados.sql, com o recorte da coordenação.
CREATE OR REPLACE FUNCTION public.listar_listas_aprovados()
returns table (
  lista_id uuid,
  edital_id text,
  edital text,
  unidade text,
  ativo boolean,
  arquivo_nome text,
  arquivo_path text,
  importado_em timestamptz,
  total_candidatos bigint,
  importado_por_email text,
  importado_por_nome text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not ((private.pode_recurso('aprovados') or private.pode_recurso('importacao',2))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  return query
  select l.id, l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome,
         l.arquivo_path, l.importado_em,
         count(c.id) filter (where c.removido_em is null),
         l."DS_EMAIL_IMPORTACAO"::text, l."NO_USUARIO_IMPORTACAO"::text
  from public."TB_LISTA_APROVADO" l
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
  left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
  where l.vigente is true
    and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
  group by l.id, m.edital, m.unidade
  order by m.edital, m.unidade;
end;
$function$;

-- public.listar_anexos_candidatos_aprovados: corpo de 20260928200000_anexos_do_candidato_em_bytea.sql, com o recorte da coordenação.
CREATE OR REPLACE FUNCTION public.listar_anexos_candidatos_aprovados()
returns table(
  anexo_id uuid,
  candidato_id uuid,
  arquivo_nome text,
  tamanho integer,
  incluido_em timestamptz
)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not (private.pode_recurso('aprovados',1)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  return query
  select a."CO_ANEXO", a."CO_CANDIDATO", a."NO_ARQUIVO",
         a."QT_TAMANHO_BYTES", a."DT_INCLUSAO"
    from public."TB_ANEXO_CANDIDATO_APROVADO" a
    join public."TB_CANDIDATO_APROVADO" c on c.id = a."CO_CANDIDATO"
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
   where l.vigente is true
     and c.removido_em is null
     and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
   order by a."CO_CANDIDATO", a."DT_INCLUSAO";
end;
$function$;

-- public.baixar_anexo_candidato_aprovado: corpo de 20260928200000_anexos_do_candidato_em_bytea.sql, com o recorte da coordenação.
CREATE OR REPLACE FUNCTION public.baixar_anexo_candidato_aprovado(p_anexo_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_nome text;
  v_arquivo bytea;
begin
  if not (private.pode_recurso('aprovados',1)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  select a."NO_ARQUIVO", a."IM_ARQUIVO" into v_nome, v_arquivo
    from public."TB_ANEXO_CANDIDATO_APROVADO" a
    join public."TB_CANDIDATO_APROVADO" c on c.id = a."CO_CANDIDATO"
    join public."TB_LISTA_APROVADO" l on l.id = c.lista_id
    join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
   where a."CO_ANEXO" = p_anexo_id
     and l.vigente is true
     and c.removido_em is null
     and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]));
  if not found then raise exception 'Anexo não encontrado'; end if;

  -- encode quebra a linha a cada 76 caracteres; o navegador quer uma só.
  return jsonb_build_object(
    'arquivo_nome', v_nome,
    'arquivo_base64', translate(encode(v_arquivo, 'base64'), E'\n', '')
  );
end;
$function$;

-- public.listar_candidatos_aprovados_compacto: corpo de 20260928210000_aprovados_numa_chamada.sql, com o recorte da coordenação.
CREATE OR REPLACE FUNCTION public.listar_candidatos_aprovados_compacto()
returns json
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_listas json;
  v_linhas json;
begin
  if not (private.pode_recurso('aprovados',1)) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if private.papel_recurso('aprovados') = '' then
    raise exception 'Perfil sem acesso ao sistema';
  end if;

  -- Dados da lista vão uma vez por lista (≈110), não repetidos em cada candidato.
  select coalesce(json_object_agg(l.id, json_build_array(
           l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome, l.importado_em
         )), '{}'::json)
    into v_listas
  from public."TB_LISTA_APROVADO" l
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
  where l.vigente is true
    and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]));

  select coalesce(json_agg(json_build_array(
           c.id, l.id, c.cargo, c.classificacao, c.nota, c.nome, c.modalidade,
           c.status, c.processo_sei, c.matricula, c.sub_judice, c.codigo_vaga
         ) order by m.edital, c.cargo, c.classificacao nulls last, c.nome), '[]'::json)
    into v_linhas
  from public."TB_LISTA_APROVADO" l
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
  join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
  where l.vigente is true
    and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
      and ((select private."FC_EDITAIS_VISIVEIS"()) is null or m.id = any ((select private."FC_EDITAIS_VISIVEIS"())::uuid[]))
    and c.removido_em is null;

  return json_build_object(
    'colunas_da_lista', json_build_array(
      'edital_id', 'edital', 'unidade', 'lista_ativa', 'arquivo_nome', 'importado_em'
    ),
    'listas', v_listas,
    'colunas', json_build_array(
      'candidato_id', 'lista_id', 'cargo', 'classificacao', 'nota', 'nome',
      'modalidade', 'status', 'processo_sei', 'matricula', 'sub_judice',
      'codigo_vaga'
    ),
    'linhas', v_linhas,
    'total', json_array_length(v_linhas)
  );
end;
$function$;

-- public.get_analises_dashboard_payload_v2: corpo de 20260928200000_analises_painel_mais_leve.sql, com o recorte da coordenação.
CREATE OR REPLACE FUNCTION public.get_analises_dashboard_payload_v2(p_scope text DEFAULT 'ativo'::text, p_area text DEFAULT 'saude-indigena'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '15s'
 SET lock_timeout TO '3s'
 SET work_mem TO '64MB'
 SET jit TO 'off'
AS $function$
declare
  v_scope text := lower(btrim(coalesce(p_scope, 'ativo')));
  v_area text := lower(btrim(coalesce(p_area, 'saude-indigena')));
  v_area_nome text;
  v_com_municipio boolean;
  v_columns json := json_build_array(
    'id', 'grupo', 'unidade', 'edital', 'codigo_vaga',
    'nome_vaga', 'candidato', 'categoria', 'modalidade_concorrencia',
    'status_consolidado', 'etapa', 'responsavel_analise', 'data_analise',
    'nota_final_ajustada', 'pontuacao_escolaridade',
    'pontuacao_cursos_aperfeicoamento', 'pontuacao_experiencia_profissional',
    'pontuacao_criterio_etnico', 'experiencia_saude_indigena_total',
    'experiencia_atencao_basica_total', 'link_pdf', 'pdf_status',
    'erro_pdf', 'origem_arquivo_id', 'data_inicio_analise', 'data_fim_analise',
    'data_validacao_status', 'updated_at', 'ultima_atualizacao', 'edital_status',
    'experiencia_profissional_anos', 'experiencia_profissional_meses',
    'experiencia_profissional_dias', 'experiencia_profissional_total',
    'municipio_uf'
  );
  v_rows json;
  v_editais json;
  v_grupos_norm text[];
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  if v_scope not in ('ativo', 'inativo', 'todos') then
    raise exception 'Escopo invalido. Use ativo, inativo ou todos.';
  end if;

  v_grupos_norm := private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);
  select a."NO_AREA" into v_area_nome from public."TB_AREA" a where a."CO_AREA" = v_area;
  v_com_municipio := v_area <> 'saude-indigena';

  select coalesce(json_agg(json_build_array(
    v.id, v.grupo, v.unidade, v.edital, v.codigo_vaga,
    v.nome_vaga, v.candidato, v.categoria, v.modalidade_concorrencia,
    v.status_consolidado, v.etapa, v.responsavel_analise, v.data_analise,
    v.nota_final_ajustada, v.pontuacao_escolaridade,
    v.pontuacao_cursos_aperfeicoamento, v.pontuacao_experiencia_profissional,
    v.pontuacao_criterio_etnico, v.experiencia_saude_indigena_total,
    v.experiencia_atencao_basica_total, v.link_pdf, v.pdf_status,
    v.erro_pdf, v.origem_arquivo_id, v.data_inicio_analise, v.data_fim_analise,
    v.data_validacao_status, v.updated_at, v.ultima_atualizacao, v.edital_status,
    ac.experiencia_profissional_anos, ac.experiencia_profissional_meses,
    ac.experiencia_profissional_dias, ac.experiencia_profissional_total,
    nullif(btrim(mu.partes[1]), '') || '/' || mu.partes[2]
  ) order by v.unidade, v.edital, v.codigo_vaga, v.candidato), '[]'::json)
  into v_rows
  from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
  join public."TB_ANALISE_CURRICULAR" ac on ac.id = v.id
  left join lateral regexp_match(v.nome_vaga, 'UBS m[óo]vel ([^/]+)/([A-Z]{2})') as mu(partes)
    on v_com_municipio
  where case
    when v_scope = 'ativo' then v.ativo is true and v.edital_ativo is true
    when v_scope = 'inativo' then v.edital_ativo is false
    else true
  end
    and ac.grupo_norm = any (v_grupos_norm)
    and ((select private."FC_EDITAIS_VISIVEIS"()) is null
      or ac.edital_norm = any ((select private."FC_EDITAIS_NORM_VISIVEIS"())::text[])
      or ac.unidade_norm = any ((select private."FC_UNIDADES_NORM_VISIVEIS"())::text[]));

  select coalesce(json_agg(json_build_object(
    'grupo', e.grupo,
    'unidade', e.unidade,
    'edital', e.edital,
    'ativo', e.ativo,
    'data_inicio_analise', e.data_inicio_analise,
    'data_fim_analise', e.data_fim_analise
  ) order by e.unidade, e.edital), '[]'::json)
  into v_editais
  from public."TB_EDITAL_ANALISE" e
  where e.grupo_norm = any (v_grupos_norm)
    and ((select private."FC_EDITAIS_VISIVEIS"()) is null
      or e.edital_norm = any ((select private."FC_EDITAIS_NORM_VISIVEIS"())::text[])
      or e.unidade_norm = any ((select private."FC_UNIDADES_NORM_VISIVEIS"())::text[]));

  return json_build_object(
    'schema_version', 3,
    'scope', v_scope,
    'area', v_area,
    'area_nome', v_area_nome,
    'columns', v_columns,
    'rows', v_rows,
    'editais', v_editais,
    'total', json_array_length(v_rows),
    'textos_sob_demanda', true,
    'generated_at', now(),
    'cache', json_build_object('hit', false, 'refreshed_at', now())
  );
end;
$function$;

-- public.get_analises_dashboard_filtrado: corpo de 20260928200000_analises_painel_mais_leve.sql, com o recorte da coordenação.
CREATE OR REPLACE FUNCTION public.get_analises_dashboard_filtrado(p_scope text, p_unidades text[] DEFAULT NULL::text[], p_editais text[] DEFAULT NULL::text[], p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000, p_include_total boolean DEFAULT true, p_area text DEFAULT 'saude-indigena'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '20s'
AS $function$
declare
  v_area text := lower(btrim(coalesce(p_area, 'saude-indigena')));
  v_area_nome text;
  v_grupos_norm text[];
  v_scope text := lower(btrim(coalesce(p_scope, '')));
  v_unidades text[];
  v_editais text[];
  v_unidades_norm text[];
  v_editais_norm text[];
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 1000);
  v_total bigint := null;
  v_rows json := '[]'::json;
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  if v_scope not in ('inativo', 'todos') then
    raise exception 'Escopo invalido. Use inativo ou todos.';
  end if;

  v_grupos_norm := private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);
  select a."NO_AREA" into v_area_nome from public."TB_AREA" a where a."CO_AREA" = v_area;

  select
    array_agg(distinct btrim(value) order by btrim(value)),
    array_agg(distinct public.analises_norm_key(value) order by public.analises_norm_key(value))
  into v_unidades, v_unidades_norm
  from unnest(coalesce(p_unidades, array[]::text[])) as item(value)
  where btrim(value) <> '';

  select
    array_agg(distinct btrim(value) order by btrim(value)),
    array_agg(distinct public.analises_norm_key(value) order by public.analises_norm_key(value))
  into v_editais, v_editais_norm
  from unnest(coalesce(p_editais, array[]::text[])) as item(value)
  where btrim(value) <> '';

  if coalesce(cardinality(v_unidades_norm), 0) = 0
     and coalesce(cardinality(v_editais_norm), 0) = 0 then
    raise exception 'Selecione pelo menos uma unidade ou um edital antes da consulta.';
  end if;

  -- Recorte pelas colunas geradas *_norm da tabela (mesmo valor de
  -- analises_norm_key, sem uma chamada de função por linha).
  if coalesce(p_include_total, true) then
    select count(*)
      into v_total
    from public."VW_ANALISES_DASHBOARD_BASE_TODOS" as base
    join public."TB_ANALISE_CURRICULAR" as f on f.id = base.id
    where (v_scope = 'todos' or base.edital_ativo is false)
      and f.grupo_norm = any (v_grupos_norm)
    and ((select private."FC_EDITAIS_VISIVEIS"()) is null
      or f.edital_norm = any ((select private."FC_EDITAIS_NORM_VISIVEIS"())::text[])
      or f.unidade_norm = any ((select private."FC_UNIDADES_NORM_VISIVEIS"())::text[]))
      and (
        coalesce(cardinality(v_unidades_norm), 0) = 0
        or f.unidade_norm = any(v_unidades_norm)
      )
      and (
        coalesce(cardinality(v_editais_norm), 0) = 0
        or f.edital_norm = any(v_editais_norm)
      );
  end if;

  -- As colunas da view seguem como antes; o tempo de experiência profissional
  -- entra como chaves a mais no fim de cada linha. Cada linha segue montada em
  -- jsonb (no máximo 1000 por página); só a lista e o envelope viram json.
  select coalesce(json_agg(filtered.linha order by filtered.ordem), '[]'::json)
    into v_rows
  from (
    select
      to_jsonb(base) || jsonb_build_object(
        'experiencia_profissional_anos', ac.experiencia_profissional_anos,
        'experiencia_profissional_meses', ac.experiencia_profissional_meses,
        'experiencia_profissional_dias', ac.experiencia_profissional_dias,
        'experiencia_profissional_total', ac.experiencia_profissional_total
      ) as linha,
      row_number() over (
        order by base.unidade, base.edital, base.codigo_vaga, base.candidato, base.id
      ) as ordem
    from (
      select b.*
      from public."VW_ANALISES_DASHBOARD_BASE_TODOS" as b
      join public."TB_ANALISE_CURRICULAR" as f on f.id = b.id
      where (v_scope = 'todos' or b.edital_ativo is false)
        and f.grupo_norm = any (v_grupos_norm)
    and ((select private."FC_EDITAIS_VISIVEIS"()) is null
      or f.edital_norm = any ((select private."FC_EDITAIS_NORM_VISIVEIS"())::text[])
      or f.unidade_norm = any ((select private."FC_UNIDADES_NORM_VISIVEIS"())::text[]))
        and (
          coalesce(cardinality(v_unidades_norm), 0) = 0
          or f.unidade_norm = any(v_unidades_norm)
        )
        and (
          coalesce(cardinality(v_editais_norm), 0) = 0
          or f.edital_norm = any(v_editais_norm)
        )
      order by b.unidade, b.edital, b.codigo_vaga, b.candidato, b.id
      offset v_offset
      limit v_limit
    ) as base
    left join public."TB_ANALISE_CURRICULAR" ac on ac.id = base.id
  ) as filtered;

  return json_build_object(
    'scope', v_scope,
    'area', v_area,
    'area_nome', v_area_nome,
    'rows', v_rows,
    'total', v_total,
    'offset', v_offset,
    'limit', v_limit,
    'has_more', json_array_length(v_rows) = v_limit,
    'filters', json_build_object(
      'unidades', coalesce(to_json(v_unidades), '[]'::json),
      'editais', coalesce(to_json(v_editais), '[]'::json)
    ),
    'generated_at', now()
  );
end;
$function$;

-- public.get_analise_detalhe_do_painel: corpo de 20260928200000_analises_painel_mais_leve.sql, com o recorte da coordenação.
CREATE OR REPLACE FUNCTION public.get_analise_detalhe_do_painel(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '5s'
AS $function$
declare
  v_id uuid;
  v_analise text;
  v_chave text;
  v_grupo_norm text;
  v_area text;
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  select a.id, a.analise, a.chave_natural, a.grupo_norm
    into v_id, v_analise, v_chave, v_grupo_norm
    from public."TB_ANALISE_CURRICULAR" a
   where a.id = p_id;

  if not found then
    return null;
  end if;

  select ar."CO_AREA" into v_area
    from public."TB_AREA" ar
   where public.analises_norm_key(ar."NO_GRUPO_PLANILHA") = v_grupo_norm;

  if not (private.is_master() or (v_area is not null and private."FC_PODE_AREA"(v_area)
      and (private."FC_EDITAIS_VISIVEIS"() is null or exists (
        select 1 from public."TB_ANALISE_CURRICULAR" x
         where x.id = v_id
           and (x.edital_norm = any (private."FC_EDITAIS_NORM_VISIVEIS"())
                or x.unidade_norm = any (private."FC_UNIDADES_NORM_VISIVEIS"())))))) then
    raise exception 'Sem permissão para as análises desta área' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'id', v_id,
    'area', v_area,
    'analise', v_analise,
    'chave_natural', v_chave
  );
end;
$function$;

-- public.get_analises_texto_do_painel: corpo de 20260928200000_analises_painel_mais_leve.sql, com o recorte da coordenação.
CREATE OR REPLACE FUNCTION public.get_analises_texto_do_painel(p_scope text DEFAULT 'ativo'::text, p_area text DEFAULT 'saude-indigena'::text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '15s'
 SET work_mem TO '64MB'
 SET jit TO 'off'
AS $function$
declare
  v_scope text := lower(btrim(coalesce(p_scope, 'ativo')));
  v_area text := lower(btrim(coalesce(p_area, 'saude-indigena')));
  v_grupos_norm text[];
  v_rows json;
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;

  if v_scope not in ('ativo', 'inativo', 'todos') then
    raise exception 'Escopo invalido. Use ativo, inativo ou todos.';
  end if;

  v_grupos_norm := private."FC_GRUPOS_ANALISES_DA_AREA"(v_area);

  select coalesce(json_agg(json_build_array(v.id, v.analise)), '[]'::json)
  into v_rows
  from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
  join public."TB_ANALISE_CURRICULAR" ac on ac.id = v.id
  where case
    when v_scope = 'ativo' then v.ativo is true and v.edital_ativo is true
    when v_scope = 'inativo' then v.edital_ativo is false
    else true
  end
    and ac.grupo_norm = any (v_grupos_norm)
    and ((select private."FC_EDITAIS_VISIVEIS"()) is null
      or ac.edital_norm = any ((select private."FC_EDITAIS_NORM_VISIVEIS"())::text[])
      or ac.unidade_norm = any ((select private."FC_UNIDADES_NORM_VISIVEIS"())::text[]))
    and v.analise is not null;

  return json_build_object(
    'scope', v_scope,
    'area', v_area,
    'columns', json_build_array('id', 'analise'),
    'rows', v_rows,
    'total', json_array_length(v_rows),
    'generated_at', now()
  );
end;
$function$;

commit;
