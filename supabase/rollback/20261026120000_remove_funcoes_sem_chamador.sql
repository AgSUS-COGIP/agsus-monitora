/*
  Rollback de 20261026120000_remove_funcoes_sem_chamador.sql.
  Recria as oito funções como estavam no catálogo em 26/10/2026, com comentário
  e privilégios, e devolve o EXECUTE de PUBLIC (e com ele o de anon) a
  analises_norm_key e analises_make_chave_natural.
*/
begin;

set local check_function_bodies = off;

-- public.diagnostico_agsus_monitora()
CREATE OR REPLACE FUNCTION public.diagnostico_agsus_monitora()
 RETURNS TABLE(objeto text, quantidade bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
  select '"TB_PERFIL_USUARIO"', count(*) from public."TB_PERFIL_USUARIO"
  union all select '"TB_CONFIGURACAO"', count(*) from public."TB_CONFIGURACAO"
  union all select '"TB_PAINEL_EXTERNO"', count(*) from public."TB_PAINEL_EXTERNO"
  union all select '"TD_UNIDADE"', count(*) from public."TD_UNIDADE"
  union all select '"TB_MONITORAMENTO_INDIGENA"', count(*) from public."TB_MONITORAMENTO_INDIGENA"
  union all select '"TB_EDITAL_ANALISE"', count(*) from public."TB_EDITAL_ANALISE"
  union all select '"TB_ANALISE_CURRICULAR"', count(*) from public."TB_ANALISE_CURRICULAR"
  union all select '"TL_EVENTO_ACESSO"', count(*) from public."TL_EVENTO_ACESSO"
  union all select '"TL_SYNC_ANALISE"', count(*) from public."TL_SYNC_ANALISE";
$function$;
revoke all on function public.diagnostico_agsus_monitora() from public, anon, authenticated, service_role;

-- public.limpar_eventos_acesso_antigos(integer)
CREATE OR REPLACE FUNCTION public.limpar_eventos_acesso_antigos(p_dias integer DEFAULT 30)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
AS $function$
declare
  v_count integer;
begin
  if not (private.has_perm('config') or private.has_perm('admin')) then
    raise exception 'Sem permissao para limpar auditoria';
  end if;

  delete from public."TL_EVENTO_ACESSO"
  where created_at < now() - make_interval(days => greatest(coalesce(p_dias, 30), 1));

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;
revoke all on function public.limpar_eventos_acesso_antigos(integer) from public, anon, authenticated, service_role;

-- public.limpar_logs_operacionais(integer)
CREATE OR REPLACE FUNCTION public.limpar_logs_operacionais(p_dias integer DEFAULT 30)
 RETURNS TABLE(objeto text, removidos integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth', 'pg_temp'
 SET statement_timeout TO '10s'
 SET lock_timeout TO '2s'
AS $function$
declare
  v_dias integer := greatest(coalesce(p_dias, 30), 1);
  v_count integer;
  r record;
begin
  if not (private.has_perm('config') or private.has_perm('admin')) then
    raise exception 'Sem permissao para limpar logs operacionais';
  end if;

  for r in select * from public.limpar_eventos_acesso_retencao(30, 365) loop
    objeto := r.objeto || ':' || r.criterio;
    removidos := r.removidos;
    return next;
  end loop;

  delete from public."TL_SYNC_ANALISE"
  where created_at < now() - make_interval(days => v_dias);
  get diagnostics v_count = row_count;
  objeto := '"TL_SYNC_ANALISE"';
  removidos := v_count;
  return next;
end;
$function$;
revoke all on function public.limpar_logs_operacionais(integer) from public, anon, authenticated, service_role;
grant execute on function public.limpar_logs_operacionais(integer) to service_role, authenticated;

-- public.limpar_staging_monitoramento_indigena(integer)
CREATE OR REPLACE FUNCTION public.limpar_staging_monitoramento_indigena(p_dias integer DEFAULT 7)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_count integer;
begin
  delete from public."TM_DASHBOARD_MONIT_INDIG"
  where created_at < now() - make_interval(days => greatest(p_dias, 1))
  returning 1 into v_count;
  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$function$;
revoke all on function public.limpar_staging_monitoramento_indigena(integer) from public, anon, authenticated, service_role;
grant execute on function public.limpar_staging_monitoramento_indigena(integer) to service_role;

-- public.obter_candidatos_empregare(text)
CREATE OR REPLACE FUNCTION public.obter_candidatos_empregare(p_vaga text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_vaga public."TB_EMPREGARE_VAGA";
  v_area text;
  v_editais uuid[];
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária' using errcode = '42501';
  end if;
  if p_vaga is null or p_vaga !~ '^[0-9]{1,20}$' then
    raise exception 'Código de vaga inválido' using errcode = '22023';
  end if;
  if not private.pode_recurso('selecao', 2) then
    raise exception 'Sem permissão para os candidatos da Empregare' using errcode = '42501';
  end if;
  select * into v_vaga from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga;
  if v_vaga."CO_VAGA" is null then
    return null;
  end if;
  if v_vaga."CO_MONITORAMENTO" is null then
    if not private.is_master() then
      raise exception 'Vaga sem edital: só o administrador global vê' using errcode = '42501';
    end if;
  else
    select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_vaga."CO_MONITORAMENTO";
    if v_area is null or not private."FC_PODE_AREA"(v_area) then
      raise exception 'Sem acesso a esta área' using errcode = '42501';
    end if;
    v_editais := (select private."FC_EDITAIS_VISIVEIS"())::uuid[];
    if v_editais is not null and not (v_vaga."CO_MONITORAMENTO" = any (v_editais)) then
      raise exception 'Sem acesso a este edital' using errcode = '42501';
    end if;
  end if;

  return json_build_object(
    'schema_version', 1,
    'vaga', v_vaga."CO_VAGA",
    'edital_id', v_vaga."CO_MONITORAMENTO",
    'situacao', v_vaga."TP_SITUACAO",
    'ultima_carga', v_vaga."DT_ULTIMA_CARGA",
    'colunas', v_vaga."DS_COLUNA",
    'candidatos', (
      select coalesce(json_agg(json_build_object(
          'id', c."CO_EMPREGARE_CANDIDATO",
          'codigo', c."CO_CANDIDATO_EMPREGARE",
          'nome', c."NO_CANDIDATO",
          'email', c."DS_EMAIL",
          'cpf', c."NU_CPF",
          'telefone', c."NU_TELEFONE",
          'nascimento', c."DT_NASCIMENTO",
          'situacao', c."DS_SITUACAO_EMPREGARE",
          'candidatura', c."DT_CANDIDATURA",
          'colunas', c."DS_COLUNA_ORIGINAL",
          'atualizado_em', c."DT_ATUALIZACAO"
        ) order by c."NO_CANDIDATO", c."DS_CHAVE_CANDIDATO"), '[]'::json)
        from public."TB_EMPREGARE_CANDIDATO" c
       where c."CO_VAGA" = p_vaga and c."ST_REGISTRO_ATIVO" = 'S'
    )
  );
end;
$function$;
comment on function public.obter_candidatos_empregare(text) is 'Candidatos ativos de uma vaga da Empregare (json): colunas conhecidas e todas as colunas originais, com a ordem das colunas do último Excel. Exige selecao >= editor, a área e o recorte do edital; vaga sem edital, só o administrador global. Nulo se a vaga nunca foi carregada.';
revoke all on function public.obter_candidatos_empregare(text) from public, anon, authenticated, service_role;
grant execute on function public.obter_candidatos_empregare(text) to authenticated, service_role;

-- private."FC_LOTE_REFEITO_EM"(text)
CREATE OR REPLACE FUNCTION private."FC_LOTE_REFEITO_EM"(p_execucao text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select to_char(t."DT_INICIO" at time zone 'America/Sao_Paulo', 'DD/MM')
    from public."TL_PRE_CLASSIFICACAO" t
   where t."CO_EXECUCAO" = p_execucao and t."ST_REFAZER_LOTE" = 'S';
$function$;
comment on function private."FC_LOTE_REFEITO_EM"(text) is 'O dia (dd/mm, horário de Brasília) da execução da pré-classificação que refez o lote do zero, ou nulo quando a execução não refez. Motivo das fichas do lote refeito (20261013110000).';
revoke all on function private."FC_LOTE_REFEITO_EM"(text) from public, anon, authenticated, service_role;

-- private."FC_PCD_PUBLICADA"(text)
CREATE OR REPLACE FUNCTION private."FC_PCD_PUBLICADA"(p_codigo text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case when upper(btrim(coalesce(p_codigo, ''))) = 'PCD' then 'SIM' else 'NÃO' end;
$function$;
comment on function private."FC_PCD_PUBLICADA"(text) is 'A coluna pcd da planilha de análises pelo código de modalidade da pré-classificação: SIM só para PCD.';
revoke all on function private."FC_PCD_PUBLICADA"(text) from public, anon, authenticated, service_role;

-- private.nivel_padrao_recurso(text,text)
CREATE OR REPLACE FUNCTION private.nivel_padrao_recurso(p_perfil text, p_recurso text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
    when p_perfil not in ('usuario','edital_gestor','contratador','admin') then 'sem_acesso'
    when p_recurso like 'painel:%' then 'leitor'
    when p_recurso not in ('dashboard','analises','nucleo','calendario','aprovados','recursos','importacao','paineis','configuracoes') then 'sem_acesso'
    when p_perfil='admin' then 'admin'
    when p_recurso='configuracoes' then 'sem_acesso'
    when p_recurso='importacao' then case when p_perfil in ('edital_gestor','contratador') then 'editor' else 'sem_acesso' end
    when p_recurso in ('nucleo','calendario') and p_perfil in ('edital_gestor','contratador') then 'editor'
    when p_recurso='aprovados' and p_perfil='contratador' then 'editor'
    when p_recurso='recursos' and p_perfil='edital_gestor' then 'editor'
    else 'leitor' end;
$function$;
revoke all on function private.nivel_padrao_recurso(text,text) from public, anon, authenticated, service_role;



-- analises_*: volta ao privilégio padrão (EXECUTE para PUBLIC).

revoke execute on function public.analises_norm_key(text) from authenticated, service_role;

grant execute on function public.analises_norm_key(text) to public;

revoke execute on function public.analises_make_chave_natural(text,text,text,text,text,text) from authenticated, service_role;

grant execute on function public.analises_make_chave_natural(text,text,text,text,text,text) to public;

commit;
