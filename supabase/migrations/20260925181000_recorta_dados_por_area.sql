/*
  RECORTE DOS DADOS POR ÁREA (etapa 5 de docs/arquitetura.md, parte 2)

  Depende de 20260925180000_areas_do_usuario.sql. A partir daqui, quem não é
  admin só recebe dados das áreas em RL_PERFIL_USUARIO_AREA. Admin vê tudo.

  DUAS CAMADAS, porque as RPCs são SECURITY DEFINER de `postgres`, que tem
  BYPASSRLS e passa por cima de qualquer policy:

  1. Policies RESTRITIVAS (somam-se com AND às permissivas que já existem) nas
     leituras diretas: TB_MONITORAMENTO_INDIGENA — e, por ela, as views
     security_invoker VW_MONITORAMENTO_INDIGENA_* e get_monitoramento_dashboard_payload
     (invoker) —, histórico, listas e candidatos aprovados, convocação, vagas,
     análises e catálogo de editais das análises. As filhas usam
     `coluna in (select … from TB_MONITORAMENTO_INDIGENA)`: a subconsulta já
     passa pela policy da mãe.
  2. Filtro explícito nas RPCs de leitura: cronograma (resumo, etapas, por
     edital e histórico), listas e candidatos aprovados, configuração de
     convocação, e as duas do painel Análises.

  `(select private."FC_AREAS_USUARIO"())::text[]` vira InitPlan: roda
  uma vez por consulta, não uma por linha.

  Análises sem área conhecida (grupo fora de TB_AREA) só aparecem para admin.
  Modelos de convocação (TB_MODELO_CONVOCACAO) são globais e não têm área.

  Fora desta parte: as RPCs de GRAVAÇÃO (salvar edital, importar lista, status
  de candidato, convocação) ainda não conferem área. Gravar direto na tabela de
  editais já é barrado pela policy com WITH CHECK.

  ROLLBACK: supabase/rollback/20260925181000_recorta_dados_por_area.sql
*/
begin;

create policy "PL_MONITORAMENTO_INDIGENA_AREA" on public."TB_MONITORAMENTO_INDIGENA" as restrictive for all to authenticated
  using ("CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[]))
  with check ("CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[]));
create policy "PL_MONITORAMENTO_AREA" on public."TH_MONITORAMENTO" as restrictive for select to authenticated
  using (id_registro in (select m.id from public."TB_MONITORAMENTO_INDIGENA" m));
create policy "PL_LISTA_APROVADO_AREA" on public."TB_LISTA_APROVADO" as restrictive for select to authenticated
  using (edital_id in (select m.id::text from public."TB_MONITORAMENTO_INDIGENA" m));
create policy "PL_CANDIDATO_APROVADO_AREA" on public."TB_CANDIDATO_APROVADO" as restrictive for select to authenticated
  using (lista_id in (select l.id from public."TB_LISTA_APROVADO" l));
create policy "PL_CONVOCACAO_EDITAL_AREA" on public."TB_CONVOCACAO_EDITAL" as restrictive for select to authenticated
  using ("CO_EDITAL" in (select m.id::text from public."TB_MONITORAMENTO_INDIGENA" m));
create policy "PL_VAGA_IMEDIATA_AREA" on public."TB_VAGA_IMEDIATA" as restrictive for select to authenticated
  using ("CO_EDITAL" in (select m.id::text from public."TB_MONITORAMENTO_INDIGENA" m));
create policy "PL_ANALISE_CURRICULAR_AREA" on public."TB_ANALISE_CURRICULAR" as restrictive for select to authenticated
  using ((select private.is_master()) or "CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[]));
create policy "PL_EDITAL_ANALISE_AREA" on public."TB_EDITAL_ANALISE" as restrictive for select to authenticated
  using ((select private.is_master()) or public.analises_norm_key(grupo) in (select public.analises_norm_key(a."NO_GRUPO_PLANILHA") from public."TB_AREA" a where a."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])));

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
  ), '[]'::jsonb);
end;
$function$;

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
  ), '[]'::jsonb);
end;
$function$;

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

  if exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_monitoramento_id and not (m."CO_AREA" = any (private."FC_AREAS_USUARIO"()))) then
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

  if exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_monitoramento_id and not (m."CO_AREA" = any (private."FC_AREAS_USUARIO"()))) then
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

CREATE OR REPLACE FUNCTION public.listar_listas_aprovados()
 RETURNS TABLE(lista_id uuid, edital_id text, edital text, unidade text, ativo boolean, arquivo_nome text, arquivo_path text, importado_em timestamp with time zone, total_candidatos bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not ((private.pode_recurso('aprovados') or private.pode_recurso('importacao',2))) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  if not ((private.pode_recurso('aprovados') or private.pode_recurso('importacao',2))) then raise exception 'Perfil sem acesso ao sistema'; end if;
  return query
  select l.id, l.edital_id, m.edital, m.unidade, l.ativo, l.arquivo_nome,
         l.arquivo_path, l.importado_em,
         count(c.id) filter (where c.removido_em is null)
  from public."TB_LISTA_APROVADO" l
  join public."TB_MONITORAMENTO_INDIGENA" m on m.id::text = l.edital_id
  left join public."TB_CANDIDATO_APROVADO" c on c.lista_id = l.id
  where l.vigente is true
    and m."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])
  group by l.id, m.edital, m.unidade
  order by m.edital, m.unidade;
end;
$function$;

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
    and c.removido_em is null
  order by m.edital, c.cargo, c.classificacao nulls last, c.nome;
end;
$function$;

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
  )
  order by c."CO_EDITAL";
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_analises_dashboard_payload_v2(p_scope text DEFAULT 'ativo'::text)
 RETURNS jsonb
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
  v_can_view boolean;
  v_columns jsonb := jsonb_build_array(
    'id', 'chave_natural', 'grupo', 'unidade', 'edital', 'codigo_vaga',
    'nome_vaga', 'candidato', 'categoria', 'modalidade_concorrencia',
    'status_consolidado', 'etapa', 'responsavel_analise', 'data_analise',
    'nota_final_ajustada', 'pontuacao_escolaridade',
    'pontuacao_cursos_aperfeicoamento', 'pontuacao_experiencia_profissional',
    'pontuacao_criterio_etnico', 'experiencia_saude_indigena_total',
    'experiencia_atencao_basica_total', 'analise', 'link_pdf', 'pdf_status',
    'erro_pdf', 'origem_arquivo_id', 'data_inicio_analise', 'data_fim_analise',
    'data_validacao_status', 'updated_at', 'ultima_atualizacao', 'edital_status'
  );
  v_rows jsonb;
  v_editais jsonb;
  v_ve_tudo boolean := private.is_master();
  v_grupos_norm text[] := array(
    select public.analises_norm_key(a."NO_GRUPO_PLANILHA") from public."TB_AREA" a
     where a."CO_AREA" = any (private."FC_AREAS_USUARIO"())
  );
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  select (
    private.pode_recurso('analises')
  ) into v_can_view;

  if not coalesce(v_can_view, false) then
    raise exception 'Sem permissao para visualizar painel de analises';
  end if;

  if v_scope not in ('ativo', 'inativo', 'todos') then
    raise exception 'Escopo invalido. Use ativo, inativo ou todos.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_array(
    v.id, v.chave_natural, v.grupo, v.unidade, v.edital, v.codigo_vaga,
    v.nome_vaga, v.candidato, v.categoria, v.modalidade_concorrencia,
    v.status_consolidado, v.etapa, v.responsavel_analise, v.data_analise,
    v.nota_final_ajustada, v.pontuacao_escolaridade,
    v.pontuacao_cursos_aperfeicoamento, v.pontuacao_experiencia_profissional,
    v.pontuacao_criterio_etnico, v.experiencia_saude_indigena_total,
    v.experiencia_atencao_basica_total, v.analise, v.link_pdf, v.pdf_status,
    v.erro_pdf, v.origem_arquivo_id, v.data_inicio_analise, v.data_fim_analise,
    v.data_validacao_status, v.updated_at, v.ultima_atualizacao, v.edital_status
  ) order by v.unidade, v.edital, v.codigo_vaga, v.candidato), '[]'::jsonb)
  into v_rows
  from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
  where case
    when v_scope = 'ativo' then v.ativo is true and v.edital_ativo is true
    when v_scope = 'inativo' then v.edital_ativo is false
    else true
  end
    and (v_ve_tudo or public.analises_norm_key(v.grupo) = any (v_grupos_norm));

  select coalesce(jsonb_agg(jsonb_build_object(
    'grupo', e.grupo,
    'unidade', e.unidade,
    'edital', e.edital,
    'ativo', e.ativo,
    'data_inicio_analise', e.data_inicio_analise,
    'data_fim_analise', e.data_fim_analise
  ) order by e.unidade, e.edital), '[]'::jsonb)
  into v_editais
  from public."TB_EDITAL_ANALISE" e
  where v_ve_tudo or public.analises_norm_key(e.grupo) = any (v_grupos_norm);

  return jsonb_build_object(
    'schema_version', 2,
    'scope', v_scope,
    'columns', v_columns,
    'rows', v_rows,
    'editais', v_editais,
    'total', jsonb_array_length(v_rows),
    'generated_at', now(),
    'cache', jsonb_build_object('hit', false, 'refreshed_at', now())
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_analises_dashboard_filtrado(p_scope text, p_unidades text[] DEFAULT NULL::text[], p_editais text[] DEFAULT NULL::text[], p_offset integer DEFAULT 0, p_limit integer DEFAULT 1000, p_include_total boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
 SET statement_timeout TO '20s'
AS $function$
declare
  v_ve_tudo boolean := private.is_master();
  v_grupos_norm text[] := array(
    select public.analises_norm_key(a."NO_GRUPO_PLANILHA") from public."TB_AREA" a
     where a."CO_AREA" = any (private."FC_AREAS_USUARIO"())
  );
  v_scope text := lower(btrim(coalesce(p_scope, '')));
  v_unidades text[];
  v_editais text[];
  v_unidades_norm text[];
  v_editais_norm text[];
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_limit integer := least(greatest(coalesce(p_limit, 1000), 1), 1000);
  v_total bigint := null;
  v_rows jsonb := '[]'::jsonb;
  v_can_view boolean;
begin
  if not (private.pode_recurso('analises')) then raise exception 'Sem permissão para este recurso' using errcode='42501'; end if;
  select (
    private.pode_recurso('analises')
  ) into v_can_view;

  if not coalesce(v_can_view, false) then
    raise exception 'Sem permissao para visualizar painel de analises';
  end if;

  if v_scope not in ('inativo', 'todos') then
    raise exception 'Escopo invalido. Use inativo ou todos.';
  end if;

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

  if coalesce(p_include_total, true) then
    select count(*)
      into v_total
    from public."VW_ANALISES_DASHBOARD_BASE_TODOS" as base
    where (v_scope = 'todos' or base.edital_ativo is false)
      and (v_ve_tudo or public.analises_norm_key(base.grupo) = any (v_grupos_norm))
      and (
        coalesce(cardinality(v_unidades_norm), 0) = 0
        or public.analises_norm_key(base.unidade) = any(v_unidades_norm)
      )
      and (
        coalesce(cardinality(v_editais_norm), 0) = 0
        or public.analises_norm_key(base.edital) = any(v_editais_norm)
      );
  end if;

  select coalesce(jsonb_agg(to_jsonb(filtered)), '[]'::jsonb)
    into v_rows
  from (
    select base.*
    from public."VW_ANALISES_DASHBOARD_BASE_TODOS" as base
    where (v_scope = 'todos' or base.edital_ativo is false)
      and (v_ve_tudo or public.analises_norm_key(base.grupo) = any (v_grupos_norm))
      and (
        coalesce(cardinality(v_unidades_norm), 0) = 0
        or public.analises_norm_key(base.unidade) = any(v_unidades_norm)
      )
      and (
        coalesce(cardinality(v_editais_norm), 0) = 0
        or public.analises_norm_key(base.edital) = any(v_editais_norm)
      )
    order by base.unidade, base.edital, base.codigo_vaga, base.candidato, base.id
    offset v_offset
    limit v_limit
  ) as filtered;

  return jsonb_build_object(
    'scope', v_scope,
    'rows', v_rows,
    'total', v_total,
    'offset', v_offset,
    'limit', v_limit,
    'has_more', jsonb_array_length(v_rows) = v_limit,
    'filters', jsonb_build_object(
      'unidades', coalesce(to_jsonb(v_unidades), '[]'::jsonb),
      'editais', coalesce(to_jsonb(v_editais), '[]'::jsonb)
    ),
    'generated_at', now()
  );
end;
$function$;

commit;
