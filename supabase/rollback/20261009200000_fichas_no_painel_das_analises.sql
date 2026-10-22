-- ROLLBACK de supabase/migrations/20261009200000_fichas_no_painel_das_analises.sql
-- Tira a publicação da ficha em TB_ANALISE_CURRICULAR (gatilhos e funções), a troca do dono
-- (definir_origem_analise), a janela do edital MONITORA no painel e a coluna TP_ORIGEM_REGISTRO, e
-- devolve a sincronização da planilha e FC_MONTAR_PAINEL_ANALISE às definições de antes (as que
-- estavam no banco em 09/10/2026).
-- Recusa (nada muda) se já há linha publicada pela ficha fora dos editais de treinamento: sem a
-- coluna, a próxima carga da planilha inativaria essas linhas. Devolva antes o edital à planilha
-- (definir_origem_analise(<edital>, 'PLANILHA', <motivo>)) ou decida o que fazer com elas.
-- TB_ORIGEM_ANALISE_EDITAL e TH_ORIGEM_ANALISE_EDITAL ficam como estão (são de 20261006100000).
begin;

do $$
begin
  if exists (select 1 from public."TB_ANALISE_CURRICULAR" a
              where a."TP_ORIGEM_REGISTRO" = 'MONITORA'
                and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)) then
    raise exception 'Há análises publicadas pelas fichas fora do treinamento: o rollback não tira a coluna (nada mudou).';
  end if;
end;
$$;

drop trigger if exists "TG_FICHAANALISE_PUBLICA_INS" on public."TB_FICHA_ANALISE";
drop trigger if exists "TG_FICHAANALISE_PUBLICA_UPD" on public."TB_FICHA_ANALISE";
drop function if exists private."FC_TG_PUBLICAR_FICHA_ANALISE"();
drop function if exists public.definir_origem_analise(uuid, text, text);
drop function if exists private."FC_DEFINIR_ORIGEM_ANALISE"(uuid, text, text, uuid);
drop function if exists private."FC_PUBLICAR_FICHA_ANALISE"(uuid);

CREATE OR REPLACE FUNCTION public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(p_sync_id uuid, p_planilha text, p_total_local integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_manifesto integer;
  v_ativas integer;
  v_limite integer;
  v_ausentes integer;
  v_desativadas integer := 0;
begin
  select count(*)::integer into v_manifesto from public."TM_MANIFESTO_ANALISE" where "CO_SYNC" = p_sync_id;
  if v_manifesto = 0 then
    return jsonb_build_object('desativadas', 0, 'motivo', 'sem manifesto (script incremental antigo)');
  end if;
  if v_manifesto <> coalesce(p_total_local, -1) then
    return jsonb_build_object('desativadas', 0,
      'motivo', format('manifesto incompleto: %s de %s linhas', v_manifesto, p_total_local));
  end if;

  select count(*)::integer into v_ativas
    from public."TB_ANALISE_CURRICULAR" a
   where a.ativo and a."CO_PLANILHA" = p_planilha;
  v_limite := greatest(25, ceil(v_ativas * 0.02)::integer);

  select count(*)::integer into v_ausentes
    from public."TB_ANALISE_CURRICULAR" a
   where a.ativo
     and a."CO_PLANILHA" = p_planilha
     and exists (select 1 from public."TB_EDITAL_ANALISE" e
                  where e.ativo and e."CO_PLANILHA" = p_planilha
                    and e.grupo_norm = a.grupo_norm and e.unidade_norm = a.unidade_norm
                    and e.edital_norm = a.edital_norm)
     and not exists (select 1 from public."TM_MANIFESTO_ANALISE" m
                      where m."CO_SYNC" = p_sync_id and m."DS_CHAVE_NATURAL" = a.chave_natural);

  if v_ausentes > v_limite then
    return jsonb_build_object('desativadas', 0, 'ausentes', v_ausentes,
      'motivo', format('remoção bloqueada: %s ausentes passa do limite de %s', v_ausentes, v_limite));
  end if;

  update public."TB_ANALISE_CURRICULAR" a
     set ativo = false, updated_at = now()
   where a.ativo
     and a."CO_PLANILHA" = p_planilha
     and exists (select 1 from public."TB_EDITAL_ANALISE" e
                  where e.ativo and e."CO_PLANILHA" = p_planilha
                    and e.grupo_norm = a.grupo_norm and e.unidade_norm = a.unidade_norm
                    and e.edital_norm = a.edital_norm)
     and not exists (select 1 from public."TM_MANIFESTO_ANALISE" m
                      where m."CO_SYNC" = p_sync_id and m."DS_CHAVE_NATURAL" = a.chave_natural);
  get diagnostics v_desativadas = row_count;
  return jsonb_build_object('desativadas', v_desativadas, 'ausentes', v_ausentes, 'limite', v_limite);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.processar_sync_analises_lote(p_sync_id uuid, p_limite integer DEFAULT 250)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
 SET statement_timeout TO '20s'
 SET lock_timeout TO '2s'
 SET work_mem TO '8MB'
 SET jit TO 'off'
AS $function$
declare
  v_limite integer := greatest(1, least(coalesce(p_limite,250),500));
  v_cursor integer := 0;
  v_novo_cursor integer := 0;
  v_lidas integer := 0;
  v_alteradas integer := 0;
  v_lidas_total integer := 0;
  v_alteradas_total integer := 0;
  v_planilha text;
  v_grupo_norm text;
  v_validada boolean := false;
  v_fora integer := 0;
  v_conflitos integer := 0;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha] planilha pela origem do sync; lock e checagens por planilha.
  v_planilha := public."FC_PLANILHA_DO_SYNC_ANALISE"(p_sync_id);
  if v_planilha is null then raise exception 'Sync % indisponivel para processamento em lotes.', p_sync_id; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises ja esta em andamento.';
  end if;

  select coalesce(nullif(resultado->>'lote_cursor','')::integer,0),
         coalesce((resultado->>'planilha_validada')::boolean,false)
    into v_cursor,v_validada
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id and status in ('carregado','processando')
  order by id desc limit 1;
  if not found then raise exception 'Sync % indisponivel para processamento em lotes.', p_sync_id; end if;

  -- [por-planilha] porteiro: o staging inteiro, uma vez por sync.
  if not v_validada then
    perform public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(p_sync_id, v_planilha);
  end if;

  select public.analises_norm_key(a."NO_GRUPO_PLANILHA") into v_grupo_norm
  from public."TB_PLANILHA_ANALISE" p join public."TB_AREA" a on a."CO_AREA"=p."CO_AREA"
  where p."CO_PLANILHA"=v_planilha;

  create temporary table tmp_lote on commit drop as
  select s.*
  from public."TM_ANALISE_CURRICULAR" s
  where s.sync_id=p_sync_id
    and s.entidade='FATO_ANALISES'
    and coalesce(s.linha_origem,0)>v_cursor
  order by s.linha_origem,s.id
  limit v_limite;

  select count(*)::integer, coalesce(max(linha_origem),v_cursor)::integer
    into v_lidas,v_novo_cursor
  from tmp_lote;

  if v_lidas=0 then
    return jsonb_build_object('ok',true,'sync_id',p_sync_id,'lidas',0,'alteradas',0,'cursor',v_cursor,'concluido_fato',true);
  end if;

  -- [por-planilha] o que este lote grava é do grupo da planilha e não é de outra planilha.
  select count(*)::integer into v_fora
  from tmp_lote s
  where coalesce(public.analises_norm_key(public.jsonb_text_or_null(s.payload,'grupo')),'') <> v_grupo_norm;
  if v_fora > 0 then
    raise exception 'Sync % recusado pelo porteiro: % linha(s) do lote com grupo diferente do grupo da planilha %. Nada foi gravado.', p_sync_id, v_fora, v_planilha
      using errcode = '22023';
  end if;

  select count(*)::integer into v_conflitos
  from tmp_lote s
  join public."TB_ANALISE_CURRICULAR" a
    on a.chave_natural=public.analises_make_chave_natural(
        public.jsonb_text_or_null(s.payload,'grupo'),
        coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada'),
        coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital'),
        public.jsonb_text_or_null(s.payload,'codigo_vaga'),
        public.jsonb_text_or_null(s.payload,'id'),
        public.jsonb_text_or_null(s.payload,'candidato'))
  where a."CO_PLANILHA" <> v_planilha;
  if v_conflitos > 0 then
    raise exception 'Sync % recusado: % analise(s) do lote ja pertencem a outra planilha (mesma chave_natural). Nada foi gravado.', p_sync_id, v_conflitos
      using errcode = '22023';
  end if;

  with dados as (
    select
      public.analises_make_chave_natural(
        public.jsonb_text_or_null(s.payload,'grupo'),
        coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada'),
        coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital'),
        public.jsonb_text_or_null(s.payload,'codigo_vaga'),
        public.jsonb_text_or_null(s.payload,'id'),
        public.jsonb_text_or_null(s.payload,'candidato')) as chave_natural,
      public.jsonb_text_or_null(s.payload,'grupo') as grupo,
      coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada') as unidade,
      coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital') as edital,
      public.jsonb_text_or_null(s.payload,'codigo_vaga') as codigo_vaga,
      public.jsonb_text_or_null(s.payload,'nome_vaga') as nome_vaga,
      public.jsonb_text_or_null(s.payload,'regime') as regime,
      public.jsonb_text_or_null(s.payload,'carga_horaria') as carga_horaria,
      public.jsonb_text_or_null(s.payload,'categoria') as categoria,
      public.jsonb_text_or_null(s.payload,'candidato') as candidato,
      public.jsonb_text_or_null(s.payload,'id') as id_origem,
      public.jsonb_date_or_null(s.payload,'data_nascimento') as data_nascimento,
      public.jsonb_int_or_null(s.payload,'idade') as idade,
      public.jsonb_num_or_null(s.payload,'nota_empregare') as nota_empregare,
      public.jsonb_text_or_null(s.payload,'modalidade_concorrencia') as modalidade_concorrencia,
      public.jsonb_num_or_null(s.payload,'nota_final_ajustada') as nota_final_ajustada,
      public.jsonb_num_or_null(s.payload,'somatorio') as somatorio,
      public.jsonb_num_or_null(s.payload,'pontuacao_escolaridade') as pontuacao_escolaridade,
      public.jsonb_num_or_null(s.payload,'pontuacao_cursos_aperfeicoamento') as pontuacao_cursos_aperfeicoamento,
      public.jsonb_num_or_null(s.payload,'pontuacao_experiencia_profissional') as pontuacao_experiencia_profissional,
      public.jsonb_num_or_null(s.payload,'pontuacao_criterio_etnico') as pontuacao_criterio_etnico,
      public.jsonb_num_or_null(s.payload,'experiencia_saude_indigena_total') as experiencia_saude_indigena_total,
      public.jsonb_num_or_null(s.payload,'experiencia_atencao_basica_total') as experiencia_atencao_basica_total,
      public.jsonb_int_or_null(s.payload,'experiencia_profissional_anos') as experiencia_profissional_anos,
      public.jsonb_int_or_null(s.payload,'experiencia_profissional_meses') as experiencia_profissional_meses,
      public.jsonb_int_or_null(s.payload,'experiencia_profissional_dias') as experiencia_profissional_dias,
      public.jsonb_num_or_null(s.payload,'experiencia_profissional_total') as experiencia_profissional_total,
      public.jsonb_text_or_null(s.payload,'etapa') as etapa,
      public.jsonb_date_or_null(s.payload,'data_analise') as data_analise,
      public.jsonb_text_or_null(s.payload,'analise') as analise,
      public.jsonb_text_or_null(s.payload,'pcd') as pcd,
      public.jsonb_text_or_null(s.payload,'responsavel_analise') as responsavel_analise,
      public.jsonb_text_or_null(s.payload,'coord_demandante') as coord_demandante,
      public.jsonb_text_or_null(s.payload,'email_demandante') as email_demandante,
      coalesce(public.jsonb_text_or_null(s.payload,'status_consolidado'),'Pendente') as status_consolidado,
      public.jsonb_text_or_null(s.payload,'origem_planilha') as origem_planilha,
      public.jsonb_text_or_null(s.payload,'origem_arquivo_id') as origem_arquivo_id,
      coalesce(public.jsonb_timestamptz_or_null(s.payload,'ultima_atualizacao'),now()) as ultima_atualizacao,
      public.jsonb_text_or_null(s.payload,'pdf_gerado') as pdf_gerado,
      public.jsonb_text_or_null(s.payload,'link_pdf') as link_pdf,
      public.jsonb_timestamptz_or_null(s.payload,'data_geracao_pdf') as data_geracao_pdf,
      public.jsonb_text_or_null(s.payload,'erro_pdf') as erro_pdf,
      public.jsonb_text_or_null(s.payload,'pdf_status') as pdf_status,
      public.jsonb_text_or_null(s.payload,'pdf_file_id') as pdf_file_id,
      public.jsonb_timestamptz_or_null(s.payload,'pdf_ultima_tentativa') as pdf_ultima_tentativa,
      public.jsonb_text_or_null(s.payload,'pdf_hash_origem') as pdf_hash_origem,
      s.linha_origem,
      s.hash_registro
    from tmp_lote s
  )
  insert into public."TB_ANALISE_CURRICULAR"(
    chave_natural,grupo,unidade,edital,codigo_vaga,nome_vaga,regime,carga_horaria,categoria,candidato,
    id_origem,data_nascimento,idade,nota_empregare,modalidade_concorrencia,nota_final_ajustada,somatorio,
    pontuacao_escolaridade,pontuacao_cursos_aperfeicoamento,pontuacao_experiencia_profissional,
    pontuacao_criterio_etnico,experiencia_saude_indigena_total,experiencia_atencao_basica_total,
    experiencia_profissional_anos,experiencia_profissional_meses,experiencia_profissional_dias,experiencia_profissional_total,
    etapa,data_analise,analise,pcd,responsavel_analise,coord_demandante,email_demandante,status_consolidado,
    origem_planilha,origem_arquivo_id,ultima_atualizacao,pdf_gerado,link_pdf,data_geracao_pdf,erro_pdf,pdf_status,
    pdf_file_id,pdf_ultima_tentativa,pdf_hash_origem,linha_origem,hash_registro,ativo,updated_at,"CO_PLANILHA")
  select
    d.chave_natural,d.grupo,d.unidade,d.edital,d.codigo_vaga,d.nome_vaga,d.regime,d.carga_horaria,d.categoria,d.candidato,
    d.id_origem,d.data_nascimento,d.idade,d.nota_empregare,d.modalidade_concorrencia,d.nota_final_ajustada,d.somatorio,
    d.pontuacao_escolaridade,d.pontuacao_cursos_aperfeicoamento,d.pontuacao_experiencia_profissional,
    d.pontuacao_criterio_etnico,d.experiencia_saude_indigena_total,d.experiencia_atencao_basica_total,
    d.experiencia_profissional_anos,d.experiencia_profissional_meses,d.experiencia_profissional_dias,d.experiencia_profissional_total,
    d.etapa,d.data_analise,d.analise,d.pcd,d.responsavel_analise,d.coord_demandante,d.email_demandante,d.status_consolidado,
    d.origem_planilha,d.origem_arquivo_id,d.ultima_atualizacao,
    coalesce(d.pdf_gerado,a.pdf_gerado),coalesce(d.link_pdf,a.link_pdf),coalesce(d.data_geracao_pdf,a.data_geracao_pdf),
    coalesce(d.erro_pdf,a.erro_pdf),coalesce(d.pdf_status,a.pdf_status),coalesce(d.pdf_file_id,a.pdf_file_id),
    coalesce(d.pdf_ultima_tentativa,a.pdf_ultima_tentativa),coalesce(d.pdf_hash_origem,a.pdf_hash_origem),
    d.linha_origem,d.hash_registro,true,now(),v_planilha
  from dados d
  left join public."TB_ANALISE_CURRICULAR" a on a.chave_natural=d.chave_natural
  on conflict (chave_natural) do update set
    grupo=excluded.grupo,unidade=excluded.unidade,edital=excluded.edital,codigo_vaga=excluded.codigo_vaga,
    nome_vaga=excluded.nome_vaga,regime=excluded.regime,carga_horaria=excluded.carga_horaria,categoria=excluded.categoria,
    candidato=excluded.candidato,id_origem=excluded.id_origem,data_nascimento=excluded.data_nascimento,idade=excluded.idade,
    nota_empregare=excluded.nota_empregare,modalidade_concorrencia=excluded.modalidade_concorrencia,
    nota_final_ajustada=excluded.nota_final_ajustada,somatorio=excluded.somatorio,pontuacao_escolaridade=excluded.pontuacao_escolaridade,
    pontuacao_cursos_aperfeicoamento=excluded.pontuacao_cursos_aperfeicoamento,
    pontuacao_experiencia_profissional=excluded.pontuacao_experiencia_profissional,
    pontuacao_criterio_etnico=excluded.pontuacao_criterio_etnico,experiencia_saude_indigena_total=excluded.experiencia_saude_indigena_total,
    experiencia_atencao_basica_total=excluded.experiencia_atencao_basica_total,
    experiencia_profissional_anos=excluded.experiencia_profissional_anos,experiencia_profissional_meses=excluded.experiencia_profissional_meses,
    experiencia_profissional_dias=excluded.experiencia_profissional_dias,experiencia_profissional_total=excluded.experiencia_profissional_total,
    etapa=excluded.etapa,data_analise=excluded.data_analise,
    analise=excluded.analise,pcd=excluded.pcd,responsavel_analise=excluded.responsavel_analise,
    coord_demandante=excluded.coord_demandante,email_demandante=excluded.email_demandante,status_consolidado=excluded.status_consolidado,
    origem_planilha=excluded.origem_planilha,origem_arquivo_id=excluded.origem_arquivo_id,ultima_atualizacao=excluded.ultima_atualizacao,
    pdf_gerado=excluded.pdf_gerado,link_pdf=excluded.link_pdf,data_geracao_pdf=excluded.data_geracao_pdf,erro_pdf=excluded.erro_pdf,
    pdf_status=excluded.pdf_status,pdf_file_id=excluded.pdf_file_id,pdf_ultima_tentativa=excluded.pdf_ultima_tentativa,
    pdf_hash_origem=excluded.pdf_hash_origem,linha_origem=excluded.linha_origem,hash_registro=excluded.hash_registro,ativo=true,updated_at=now()
  where "TB_ANALISE_CURRICULAR"."CO_PLANILHA"=excluded."CO_PLANILHA";

  get diagnostics v_alteradas=row_count;

  select coalesce(nullif(resultado->>'lote_lidas','')::integer,0)+v_lidas,
         coalesce(nullif(resultado->>'lote_alteradas','')::integer,0)+v_alteradas
    into v_lidas_total,v_alteradas_total
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id
  order by id desc limit 1;

  update public."TL_SYNC_ANALISE"
  set status='processando',
      resultado=coalesce(resultado,'{}'::jsonb)||jsonb_build_object(
        'modo_processamento','lotes','lote_cursor',v_novo_cursor,'lote_lidas',v_lidas_total,
        'lote_alteradas',v_alteradas_total,'ultimo_lote_lidas',v_lidas,'ultimo_lote_alteradas',v_alteradas,
        'ultimo_lote_em',now(),'planilha',v_planilha,'planilha_validada',true),
      updated_at=now()
  where sync_id=p_sync_id;

  return jsonb_build_object('ok',true,'sync_id',p_sync_id,'lidas',v_lidas,'alteradas',v_alteradas,
    'lidas_total',v_lidas_total,'alteradas_total',v_alteradas_total,'cursor',v_novo_cursor,'concluido_fato',v_lidas<v_limite);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.finalizar_sync_analises_lotes(p_sync_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
 SET statement_timeout TO '30s'
 SET lock_timeout TO '2s'
 SET work_mem TO '8MB'
 SET jit TO 'off'
AS $function$
declare
  v_cursor integer:=0;
  v_max integer:=0;
  v_total_staging integer:=0;
  v_total_fato integer:=0;
  v_total_editais integer:=0;
  v_normalizados integer:=0;
  v_inativados integer:=0;
  v_editais integer:=0;
  v_editais_inativados integer:=0;
  v_removido integer:=0;
  v_alteradas integer:=0;
  v_result jsonb;
  v_planilha text;
  v_conflitos integer:=0;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha]
  v_planilha := public."FC_PLANILHA_DO_SYNC_ANALISE"(p_sync_id);
  if v_planilha is null then raise exception 'Sync % nao esta em processamento por lotes.',p_sync_id; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises ja esta em andamento.';
  end if;

  select coalesce(nullif(resultado->>'lote_cursor','')::integer,0),
         coalesce(nullif(resultado->>'lote_alteradas','')::integer,0)
    into v_cursor,v_alteradas
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id and status='processando'
  order by id desc limit 1;
  if not found then raise exception 'Sync % nao esta em processamento por lotes.',p_sync_id; end if;

  select coalesce(max(linha_origem) filter(where entidade='FATO_ANALISES'),0),
         count(*)::integer,
         count(*) filter(where entidade='FATO_ANALISES')::integer,
         count(*) filter(where entidade='DIM_EDITAIS')::integer
    into v_max,v_total_staging,v_total_fato,v_total_editais
  from public."TM_ANALISE_CURRICULAR"
  where sync_id=p_sync_id;

  if v_cursor<v_max then
    raise exception 'Ainda existem linhas FATO pendentes: cursor %, max %.',v_cursor,v_max;
  end if;

  -- [por-planilha] porteiro antes de qualquer desativação.
  perform public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(p_sync_id, v_planilha);

  create temporary table tmp_keys on commit drop as
  select distinct public.analises_make_chave_natural(
    public.jsonb_text_or_null(s.payload,'grupo'),
    coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada'),
    coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital'),
    public.jsonb_text_or_null(s.payload,'codigo_vaga'),
    public.jsonb_text_or_null(s.payload,'id'),
    public.jsonb_text_or_null(s.payload,'candidato')) as chave_natural
  from public."TM_ANALISE_CURRICULAR" s
  where s.sync_id=p_sync_id and s.entidade='FATO_ANALISES';

  select count(*)::integer into v_normalizados from tmp_keys;
  create unique index tmp_keys_idx on tmp_keys(chave_natural);
  analyze tmp_keys;

  -- [por-planilha] só desativa análises desta planilha.
  update public."TB_ANALISE_CURRICULAR" a
  set ativo=false,updated_at=now()
  where a.ativo is true
    and a."CO_PLANILHA"=v_planilha
    and not private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)
    and not exists(select 1 from tmp_keys k where k.chave_natural=a.chave_natural);
  get diagnostics v_inativados=row_count;

  create temporary table tmp_editais on commit drop as
  with x as (
    select s.id,s.linha_origem,
      public.jsonb_text_or_null(s.payload,'grupo') as grupo,
      coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada') as unidade,
      coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital') as edital,
      coalesce(public.jsonb_bool_or_null(s.payload,'ativo'),true) as ativo,
      public.jsonb_date_or_null(s.payload,'data_inicio_analise') as data_inicio_analise,
      public.jsonb_date_or_null(s.payload,'data_fim_analise') as data_fim_analise
    from public."TM_ANALISE_CURRICULAR" s
    where s.sync_id=p_sync_id and s.entidade='DIM_EDITAIS'
  ), ranked as (
    select *,row_number() over(partition by grupo,unidade,edital order by coalesce(linha_origem,2147483647),id) rn
    from x
  )
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise
  from ranked where rn=1;

  if v_total_editais>0 then
    -- [por-planilha] edital já cadastrado por outra planilha: recusa.
    select count(*)::integer into v_conflitos
    from public."TB_EDITAL_ANALISE" e
    join tmp_editais x
      on e.grupo_norm=coalesce(public.analises_norm_key(x.grupo),'')
     and e.unidade_norm=coalesce(public.analises_norm_key(x.unidade),'')
     and e.edital_norm=coalesce(public.analises_norm_key(x.edital),'')
    where e."CO_PLANILHA"<>v_planilha;
    if v_conflitos>0 then
      raise exception 'Sync % recusado: % edital(is) do envio ja pertencem a outra planilha.',p_sync_id,v_conflitos
        using errcode = '22023';
    end if;

    insert into public."TB_EDITAL_ANALISE"(grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,"CO_PLANILHA")
    select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,v_planilha
    from tmp_editais
    on conflict(grupo,unidade,edital) do update set
      ativo=excluded.ativo,
      data_inicio_analise=excluded.data_inicio_analise,
      data_fim_analise=excluded.data_fim_analise,
      updated_at=now()
    where "TB_EDITAL_ANALISE"."CO_PLANILHA"=excluded."CO_PLANILHA";
    get diagnostics v_editais=row_count;

    -- [por-planilha] só desativa editais desta planilha.
    update public."TB_EDITAL_ANALISE" e
    set ativo=false,updated_at=now()
    where e.ativo is true
      and e."CO_PLANILHA"=v_planilha
      and not exists(select 1 from tmp_editais x
        where e.grupo is not distinct from x.grupo
          and e.unidade=x.unidade
          and e.edital=x.edital);
    get diagnostics v_editais_inativados=row_count;
  end if;

  delete from public."TM_ANALISE_CURRICULAR" where sync_id=p_sync_id;
  get diagnostics v_removido=row_count;

  v_result=jsonb_build_object(
    'ok',true,
    'sync_id',p_sync_id,
    'modo_processamento','lotes',
    'planilha',v_planilha,
    'staging',v_total_staging,
    'fato_analises_recebidas',v_total_fato,
    'fato_analises_normalizadas',v_normalizados,
    'fato_analises_upsert',v_alteradas,
    'fato_analises_inativadas',v_inativados,
    'analises_editais_recebidos',v_total_editais,
    'analises_editais_upsert',v_editais,
    'analises_editais_inativados',v_editais_inativados,
    'staging_removido',v_removido);

  update public."TL_SYNC_ANALISE"
  set status='processado',
      resultado=v_result,
      erro=null,
      total_processados=v_normalizados,
      finished_at=now(),
      updated_at=now()
  where sync_id=p_sync_id;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.finalizar_sync_analises_incremental(p_sync_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '30s'
 SET lock_timeout TO '2s'
 SET work_mem TO '8MB'
 SET jit TO 'off'
AS $function$
declare
  v_cursor integer:=0;
  v_max integer:=0;
  v_total_staging integer:=0;
  v_esperado integer:=0;
  v_total_fato integer:=0;
  v_total_editais integer:=0;
  v_editais_upsert integer:=0;
  v_editais_inativados integer:=0;
  v_removido integer:=0;
  v_total_ativos_local integer:=0;
  v_result jsonb;
  v_planilha text;
  v_conflitos integer:=0;
  v_duplicadas integer:=0;
  v_ausentes jsonb;
begin
  if p_sync_id is null then raise exception 'p_sync_id obrigatorio'; end if;
  -- [por-planilha]
  v_planilha := public."FC_PLANILHA_DO_SYNC_ANALISE"(p_sync_id);
  if v_planilha is null then raise exception 'Sync incremental nao esta pronto para finalizacao.'; end if;
  if not pg_try_advisory_xact_lock(hashtext('public.processar_sync_analises:'||v_planilha)::bigint) then
    raise exception 'Outro processamento de analises esta em andamento.';
  end if;

  select coalesce(nullif(resultado->>'lote_cursor','')::integer,0),
         coalesce(linhas_staging,0),
         coalesce(nullif(resultado->>'incremental_total_ativos_local','')::integer,0)
    into v_cursor,v_esperado,v_total_ativos_local
  from public."TL_SYNC_ANALISE"
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE' and status in ('carregado','processando')
    and coalesce((resultado->>'incremental_preparado')::boolean,false)=true
  order by id desc limit 1;
  if not found then raise exception 'Sync incremental nao esta pronto para finalizacao.'; end if;

  select coalesce(max(linha_origem) filter(where entidade='FATO_ANALISES'),0),
         count(*)::integer,
         count(*) filter(where entidade='FATO_ANALISES')::integer,
         count(*) filter(where entidade='DIM_EDITAIS')::integer
    into v_max,v_total_staging,v_total_fato,v_total_editais
  from public."TM_ANALISE_CURRICULAR"
  where sync_id=p_sync_id;

  if v_total_staging <> v_esperado then raise exception 'Staging incremental divergente: esperado %, encontrado %.',v_esperado,v_total_staging; end if;
  if v_cursor < v_max then raise exception 'Ainda existem linhas FATO incrementais pendentes: cursor %, max %.',v_cursor,v_max; end if;
  if v_total_editais < 1 then raise exception 'DIM_EDITAIS ausente no incremental.'; end if;

  -- [por-planilha] porteiro antes de gravar editais.
  perform public."FC_VALIDAR_GRUPO_STAGING_ANALISE"(p_sync_id, v_planilha);

  create temporary table tmp_editais_incremental on commit drop as
  with x as (
    select s.id,s.linha_origem,
      public.jsonb_text_or_null(s.payload,'grupo') as grupo,
      coalesce(public.jsonb_text_or_null(s.payload,'unidade'),'Nao informada') as unidade,
      coalesce(public.jsonb_text_or_null(s.payload,'edital'),'Sem edital') as edital,
      coalesce(public.jsonb_bool_or_null(s.payload,'ativo'),true) as ativo,
      public.jsonb_date_or_null(s.payload,'data_inicio_analise') as data_inicio_analise,
      public.jsonb_date_or_null(s.payload,'data_fim_analise') as data_fim_analise
    from public."TM_ANALISE_CURRICULAR" s
    where s.sync_id=p_sync_id and s.entidade='DIM_EDITAIS'
  ), ranked as (
    select *,row_number() over(partition by coalesce(public.analises_norm_key(grupo),''),coalesce(public.analises_norm_key(unidade),''),coalesce(public.analises_norm_key(edital),'') order by coalesce(linha_origem,2147483647),id) rn
    from x
  )
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise
  from ranked where rn=1;

  -- [por-planilha] edital já cadastrado por outra planilha: recusa.
  select count(*)::integer into v_conflitos
  from public."TB_EDITAL_ANALISE" e
  join tmp_editais_incremental x
    on e.grupo_norm=coalesce(public.analises_norm_key(x.grupo),'')
   and e.unidade_norm=coalesce(public.analises_norm_key(x.unidade),'')
   and e.edital_norm=coalesce(public.analises_norm_key(x.edital),'')
  where e."CO_PLANILHA"<>v_planilha;
  if v_conflitos>0 then
    raise exception 'Sync % recusado: % edital(is) do envio ja pertencem a outra planilha.',p_sync_id,v_conflitos
      using errcode = '22023';
  end if;

  insert into public."TB_EDITAL_ANALISE"(grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,"CO_PLANILHA")
  select grupo,unidade,edital,ativo,data_inicio_analise,data_fim_analise,v_planilha
  from tmp_editais_incremental
  -- Pela chave normalizada (uq_analises_editais_norm): "DSEI  Parintins" e
  -- "DSEI Parintins" são o mesmo edital; o texto passa a ser o da planilha.
  on conflict(grupo_norm,unidade_norm,edital_norm) do update set
    grupo=excluded.grupo,
    unidade=excluded.unidade,
    edital=excluded.edital,
    ativo=excluded.ativo,
    data_inicio_analise=excluded.data_inicio_analise,
    data_fim_analise=excluded.data_fim_analise,
    updated_at=now()
  where "TB_EDITAL_ANALISE"."CO_PLANILHA"=excluded."CO_PLANILHA"
    -- Só o edital que mudou (20261007220000): regravar os iguais a cada sync
    -- gerava WAL e remontava o painel de análises à toa.
    and ("TB_EDITAL_ANALISE".grupo,"TB_EDITAL_ANALISE".unidade,"TB_EDITAL_ANALISE".edital,
         "TB_EDITAL_ANALISE".ativo,"TB_EDITAL_ANALISE".data_inicio_analise,"TB_EDITAL_ANALISE".data_fim_analise)
        is distinct from
        (excluded.grupo,excluded.unidade,excluded.edital,
         excluded.ativo,excluded.data_inicio_analise,excluded.data_fim_analise);
  get diagnostics v_editais_upsert=row_count;

  -- [por-planilha] só desativa editais desta planilha.
  update public."TB_EDITAL_ANALISE" e
  set ativo=false,updated_at=now()
  where e.ativo is true
    and e."CO_PLANILHA"=v_planilha
    and not exists(select 1 from tmp_editais_incremental x
      where e.grupo_norm=coalesce(public.analises_norm_key(x.grupo),'')
        and e.unidade_norm=coalesce(public.analises_norm_key(x.unidade),'')
        and e.edital_norm=coalesce(public.analises_norm_key(x.edital),''));
  get diagnostics v_editais_inativados=row_count;

  -- [por-planilha] Mesmo candidato (id_origem) duas vezes na mesma vaga e edital:
  -- fica ativo só o registro mais recente. O incremental só envia o que mudou;
  -- quando o nome é corrigido na planilha, a chave natural muda, entra um
  -- registro novo e o antigo ficava ativo como "Pendente" (14 casos em 30/09).
  with r as (
    select a.id,
           row_number() over (partition by a.edital_norm, a.codigo_vaga, a.id_origem
                              order by a.updated_at desc, a.id desc) as rn
      from public."TB_ANALISE_CURRICULAR" a
     where a.ativo
       and a."CO_PLANILHA" = v_planilha
       and nullif(btrim(a.id_origem), '') is not null
       and nullif(btrim(a.codigo_vaga), '') is not null
  )
  update public."TB_ANALISE_CURRICULAR" a
     set ativo = false, updated_at = now()
    from r
   where a.id = r.id and r.rn > 1;
  get diagnostics v_duplicadas=row_count;

  -- Quem saiu da planilha (manifesto da comparação): ver 20261001140000.
  v_ausentes := public."FC_DESATIVAR_AUSENTES_DA_PLANILHA"(p_sync_id, v_planilha, v_total_ativos_local);
  delete from public."TM_MANIFESTO_ANALISE" where "CO_SYNC" = p_sync_id or "DT_CRIACAO" < now() - interval '2 days';

  delete from public."TM_ANALISE_CURRICULAR" where sync_id=p_sync_id;
  get diagnostics v_removido=row_count;

  v_result=jsonb_build_object(
    'ok',true,
    'sync_id',p_sync_id,
    'modo_processamento','incremental',
    'planilha',v_planilha,
    'total_ativos_local',v_total_ativos_local,
    'fato_analises_enviadas',v_total_fato,
    'analises_editais_recebidos',v_total_editais,
    'analises_editais_upsert',v_editais_upsert,
    'analises_editais_inativados',v_editais_inativados,
    'staging',v_total_staging,
    'staging_removido',v_removido,
    'historico_inativado',coalesce((v_ausentes->>'desativadas')::integer,0),
    'ausentes',v_ausentes,
    'analises_duplicadas_inativadas',v_duplicadas
  );

  update public."TL_SYNC_ANALISE"
  set status='processado',resultado=v_result,erro=null,total_processados=v_total_fato,
      finished_at=now(),updated_at=now()
  where sync_id=p_sync_id and modo='INCREMENTAL_ACTIVE';

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION private."FC_MONTAR_PAINEL_ANALISE"(p_area text, p_escopos text[], p_so_visiveis boolean DEFAULT false)
 RETURNS TABLE("TP_ESCOPO" text, "DS_LINHAS" json, "QT_LINHAS" integer, "DS_EDITAIS" json, "DT_ULTIMA_ATUALIZACAO" timestamp with time zone, "DS_CONCLUIDAS_POR_ANO" json)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'private', 'pg_temp'
 SET work_mem TO '64MB'
 SET jit TO 'off'
AS $function$
declare
  v_area text := lower(btrim(coalesce(p_area, 'saude-indigena')));
  v_grupo text;
  v_grupos_norm text[];
  v_editais json;
  v_restrito boolean;
  v_editais_norm text[];
  v_unidades_norm text[];
begin
  if p_escopos is null or cardinality(p_escopos) = 0
     or not (p_escopos <@ array['ativo', 'inativo', 'desativadas']) then
    raise exception 'Escopo invalido. Use ativo, inativo ou desativadas.';
  end if;

  select a."NO_GRUPO_PLANILHA" into v_grupo
    from public."TB_AREA" a
   where a."CO_AREA" = v_area;
  if not found then
    raise exception 'Área inválida: %', v_area using errcode = '22023';
  end if;

  -- O mesmo recorte de FC_GRUPOS_ANALISES_DA_AREA, sem a checagem de permissão.
  v_grupos_norm := array[public.analises_norm_key(v_grupo)];

  -- Recorte por coordenação só quando pedido (a RPC, para quem tem recorte);
  -- o pacote guardado é o da área inteira.
  v_restrito := coalesce(p_so_visiveis, false) and private."FC_EDITAIS_VISIVEIS"() is not null;
  if v_restrito then
    v_editais_norm := coalesce(private."FC_EDITAIS_NORM_VISIVEIS"(), '{}');
    v_unidades_norm := coalesce(private."FC_UNIDADES_NORM_VISIVEIS"(), '{}');
  end if;

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
    and (not v_restrito
      or e.edital_norm = any (v_editais_norm)
      or e.unidade_norm = any (v_unidades_norm));

  -- Colunas na ordem de `columns` de get_analises_dashboard_payload_v2. A ordem
  -- das linhas é a de sempre, com o id no fim para desempatar (a mesma análise
  -- repetida para o candidato trocava de lugar entre uma montagem e outra).
  return query
  with linhas as materialized (
    select
      case
        when v.edital_ativo is false then 'inativo'
        when v.ativo is true then 'ativo'
        else 'desativadas'
      end as escopo,
      v.id, v.unidade, v.edital, v.codigo_vaga, v.candidato,
      v.status_consolidado, v.data_analise,
      coalesce(v.updated_at, v.ultima_atualizacao) as atualizado_em,
      json_build_array(
        v.id, v.unidade, v.edital, v.codigo_vaga, v.nome_vaga, v.candidato,
        v.categoria, v.modalidade_concorrencia, v.status_consolidado, v.etapa,
        v.responsavel_analise, v.data_analise, v.nota_final_ajustada,
        v.pdf_status, nullif(btrim(v.link_pdf), '') is not null
      ) as linha
    from public."VW_ANALISES_DASHBOARD_BASE_TODOS" v
    join public."TB_ANALISE_CURRICULAR" ac on ac.id = v.id
    where ac.grupo_norm = any (v_grupos_norm)
      and (not v_restrito
        or ac.edital_norm = any (v_editais_norm)
        or ac.unidade_norm = any (v_unidades_norm))
  ),
  agregado as (
    select l.escopo,
           json_agg(l.linha order by l.unidade, l.edital, l.codigo_vaga, l.candidato, l.id) as linhas,
           count(*)::integer as total,
           max(l.atualizado_em) as atualizado_em
      from linhas l
     where l.escopo = any (p_escopos)
     group by l.escopo
  ),
  concluidas as (
    select q.escopo, json_object_agg(q.ano, q.total order by q.ano) as por_ano
      from (
        select l.escopo,
               coalesce(extract(year from l.data_analise)::integer::text, 'sem_data') as ano,
               count(*)::integer as total
          from linhas l
         where l.escopo = any (p_escopos)
           and l.status_consolidado in ('Aprovado', 'Reprovado')
         group by 1, 2
      ) q
     group by q.escopo
  )
  select pedido.escopo, coalesce(a.linhas, '[]'::json), coalesce(a.total, 0), v_editais,
         a.atualizado_em, coalesce(c.por_ano, '{}'::json)
    from unnest(p_escopos) as pedido(escopo)
    left join agregado a on a.escopo = pedido.escopo
    left join concluidas c on c.escopo = pedido.escopo;
end;
$function$
;

drop function if exists private."FC_JANELA_AVALIACAO_DOCUMENTAL"(uuid);
drop function if exists public."FC_EDITAL_ANALISE_NO_MONITORA"(text, text);

alter table public."TB_ANALISE_CURRICULAR"
  drop constraint if exists "CK_ANALISECURRIC_TPORIGEMREG",
  drop column if exists "TP_ORIGEM_REGISTRO";

-- O painel remonta a lista de editais sem os editais MONITORA.
select private."FC_MARCAR_CACHE"(array['ANALISES'], array(select a."CO_AREA" from public."TB_AREA" a), 'TB_ORIGEM_ANALISE_EDITAL');

commit;
