/*
  CONFLITO DE VERSÃO SEM REPETIÇÃO NO POSTGREST: errcode 40001 → PT409

  As funções abaixo recusam a gravação quando a versão aberta na tela já não
  é a vigente (concorrência otimista) com `errcode = '40001'`
  (serialization_failure). O PostgREST repete sozinho a transação que falha
  com 40001; como a versão continua velha, o conflito volta e a repetição não
  acaba (PostgREST/postgrest#3673). Em 16/10/2026: ~500 rollbacks/s em
  salvar_matriz_acessos e salvar_rascunho_ficha, 9 conexões presas, telas
  perto de 8 s.

  Código novo: PT409. O PostgREST responde HTTP 409 a `PTxyz` (status xyz;
  src/library/PostgREST/Error.hs, mapSQLtoHTTP; docs "Raise errors with HTTP
  Status Codes") e não repete (não é classe 40). A tela reconhece PT409 e
  40001 (src/lib/conflito-de-versao.ts, PR do front): APLICAR SÓ DEPOIS DE O
  FRONT ESTAR NO AR.

  Cada função é reaplicada com a definição vigente no banco novo
  (pg_get_functiondef em 16/10/2026), idêntica exceto o errcode; CREATE OR
  REPLACE mantém dono, grants (proacl) e comentário. Nenhuma função trata
  40001 em `exception when`. 30 funções, 39 ocorrências:
    private."FC_APLICAR_COORDENADA_LOCAL"(text,double precision,double precision,double precision,double precision,text,text,text,bigint)  1x
    private."FC_APLICAR_COORDENADA_MAPA"(jsonb,double precision,double precision,double precision,double precision,text,text,text,bigint)  2x
    private."FC_EXIGIR_GRAVAR_FICHA"("TB_FICHA_ANALISE",integer)  1x
    concluir_ficha(uuid,integer,integer,jsonb,jsonb,text)  1x
    conferir_regra_analise(uuid,integer)  1x
    convocar_para_entrevista(uuid,uuid,uuid[])  1x
    desfazer_coordenada_mapa_projetos(bigint,text)  1x
    desfazer_coordenada_mapa_saude_indigena(bigint,text)  1x
    distribuir_fichas(uuid,jsonb,text)  1x
    gravar_pre_classificacao_vaga(text,uuid,text,integer,jsonb,jsonb)  1x
    gravar_resumo_pergunta_edital(uuid,text,jsonb,integer)  1x
    mandar_fichas_revisao(uuid,jsonb,text)  1x
    publicar_lista_aprovados_da_classificacao(uuid,uuid,jsonb)  1x
    reabrir_ficha(uuid,integer,text)  1x
    registrar_desempate_classificacao(uuid,jsonb)  1x
    registrar_lista_classificacao(uuid,text,integer,jsonb)  1x
    renovar_reserva(uuid)  1x
    salvar_agenda_entrevista(uuid,jsonb)  2x
    salvar_coordenacao(jsonb,text)  2x
    salvar_grupo_acesso(jsonb,text)  2x
    salvar_matriz_acessos(jsonb,text)  3x
    salvar_modelo_carta_convocacao(uuid,text,uuid,jsonb,integer,text)  1x
    salvar_modelo_resposta_recurso(jsonb)  1x
    salvar_recurso_candidato(jsonb)  1x
    salvar_regra_agenda_entrevista(uuid,jsonb,integer,text)  2x
    salvar_regra_analise(uuid,jsonb,integer,text,text)  2x
    salvar_regra_classificacao(uuid,jsonb,integer,text,text)  2x
    salvar_resposta_recurso(jsonb)  1x
    transicionar_recurso_candidato(uuid,text,integer,text)  1x
    transicionar_resposta_recurso(uuid,text,integer,text)  1x

  Ensaio: supabase/ensaios/20261016160000_conflito_de_versao_sem_repeticao.sql
  Rollback: supabase/rollback/20261016160000_conflito_de_versao_sem_repeticao.sql (volta para 40001)
*/

-- private."FC_APLICAR_COORDENADA_LOCAL"(text,double precision,double precision,double precision,double precision,text,text,text,bigint) (1)
CREATE OR REPLACE FUNCTION private."FC_APLICAR_COORDENADA_LOCAL"(p_lugar text, p_latitude double precision, p_longitude double precision, p_latitude_anterior double precision, p_longitude_anterior double precision, p_motivo text, p_acao text, p_conferido text, p_historico_desfeito bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_tolerancia constant double precision := 1e-9;
  v_existe boolean;
  v_lat double precision;
  v_lon double precision;
  v_lugar record;
  v_pendencia bigint;
  v_conferido_anterior text;
  v_conferido text;
  v_mudou boolean;
  v_historico bigint;
  v_agora timestamptz := clock_timestamp();
begin
  if auth.uid() is null or not private."FC_PODE_EDITAR_COORDENADA"() then
    raise exception using errcode = '42501', message = 'Somente administrador ou gestor pode corrigir coordenadas.';
  end if;
  if p_acao is null or p_acao not in ('CORRECAO', 'CONFERENCIA', 'DESFAZER')
     or coalesce(p_conferido, 'S') not in ('S', 'N') then
    raise exception using errcode = '22023', message = 'Ação inválida.';
  end if;
  if p_latitude is null or p_longitude is null
     or not (p_latitude between -34.9 and 6.4)
     or not (p_longitude between -74.2 and -32) then
    raise exception using errcode = '22023', message = 'A coordenada deve ficar nos limites do Brasil.';
  end if;
  if p_motivo is null or length(btrim(p_motivo)) not between 10 and 1000 then
    raise exception using errcode = '22023', message = 'Descreva o motivo da correção (10 a 1000 caracteres).';
  end if;
  if p_lugar is null or p_lugar !~ '^(uf:[A-Z]{2}|[^/A-Z]{1,150}/[A-Z]{2})$' then
    raise exception using errcode = '22023', message = 'Lugar do mapa inválido.';
  end if;

  -- Uma gravação por lugar de cada vez (o lugar pode ainda não ter linha para travar).
  perform pg_advisory_xact_lock(hashtextextended('TB_COORDENADA_LOCAL_VAGA|' || p_lugar, 0));

  select true, c."CG_LATITUDE", c."CG_LONGITUDE" into v_existe, v_lat, v_lon
    from public."TB_COORDENADA_LOCAL_VAGA" c
   where c."DS_CHAVE_LUGAR" = p_lugar
   for update;
  v_existe := coalesce(v_existe, false);
  if not v_existe then
    select f.lugar, f.ibge, f.municipio, f.uf, f.so_uf into v_lugar
      from private."FC_LUGARES_VAGA_PROJETO"() f
     where f.lugar = p_lugar;
    if not found then
      raise exception using errcode = '22023', message = 'Lugar não encontrado nas vagas de Projetos.';
    end if;
  end if;

  -- Concorrência: a posição que a tela viu tem de ser a de agora (tolerância de JSON).
  if (v_lat is null) <> (p_latitude_anterior is null)
     or (v_lon is null) <> (p_longitude_anterior is null)
     or abs(v_lat - p_latitude_anterior) > v_tolerancia
     or abs(v_lon - p_longitude_anterior) > v_tolerancia then
    raise exception using errcode = 'PT409', message = 'O lugar mudou. Atualize o mapa e tente novamente.';
  end if;

  select p."CO_SEQ_PENDENCIA", p."ST_CONFERIDO" into v_pendencia, v_conferido_anterior
    from private."TB_PENDENCIA_COORDENADA_LOCAL" p
   where p."DS_CHAVE_LUGAR" = p_lugar
   for update;
  if p_acao = 'CONFERENCIA' then
    if v_pendencia is null then
      raise exception using errcode = '22023', message = 'Este lugar não tem pendência de localização.';
    elsif v_conferido_anterior = 'S' then
      raise exception using errcode = '22023', message = 'Este lugar já foi conferido.';
    end if;
  end if;
  v_conferido := case when v_pendencia is null then null else coalesce(p_conferido, v_conferido_anterior) end;
  v_mudou := v_lat is null
             or abs(v_lat - p_latitude) > v_tolerancia
             or abs(v_lon - p_longitude) > v_tolerancia;
  if not v_mudou and v_conferido is not distinct from v_conferido_anterior then
    raise exception using errcode = '22023', message = 'A coordenada não mudou.';
  end if;

  if v_mudou then
    if v_existe then
      update public."TB_COORDENADA_LOCAL_VAGA" c
         set "CG_LATITUDE" = p_latitude, "CG_LONGITUDE" = p_longitude, "TP_ORIGEM" = 'MANUAL',
             "DT_ATUALIZACAO" = v_agora, "CO_USUARIO_ATUALIZACAO" = auth.uid()
       where c."DS_CHAVE_LUGAR" = p_lugar;
    else
      insert into public."TB_COORDENADA_LOCAL_VAGA"
        ("DS_CHAVE_LUGAR", "CO_MUNICIPIO_IBGE", "NO_MUNICIPIO", "SG_UF", "CG_LATITUDE", "CG_LONGITUDE",
         "TP_ORIGEM", "DT_ATUALIZACAO", "CO_USUARIO_ATUALIZACAO")
      values (p_lugar, v_lugar.ibge, case when v_lugar.so_uf then null else v_lugar.municipio end, v_lugar.uf,
              p_latitude, p_longitude, 'MANUAL', v_agora, auth.uid());
    end if;
  end if;
  if v_conferido is distinct from v_conferido_anterior then
    update private."TB_PENDENCIA_COORDENADA_LOCAL" p
       set "ST_CONFERIDO" = v_conferido,
           "DT_CONFERENCIA" = case when v_conferido = 'S' then v_agora end,
           "CO_USUARIO_CONFERENCIA" = case when v_conferido = 'S' then auth.uid() end
     where p."CO_SEQ_PENDENCIA" = v_pendencia;
  end if;
  insert into private."TH_COORDENADA_LOCAL_VAGA"
    ("CO_USUARIO", "DS_CHAVE_LUGAR", "CG_LATITUDE_ANTERIOR", "CG_LONGITUDE_ANTERIOR", "CG_LATITUDE", "CG_LONGITUDE",
     "DS_MOTIVO", "TP_ACAO", "ST_CONFERIDO_ANTERIOR", "ST_CONFERIDO", "CO_HISTORICO_DESFEITO")
  values (auth.uid(), p_lugar, v_lat, v_lon, p_latitude, p_longitude,
          btrim(p_motivo), p_acao, v_conferido_anterior, v_conferido, p_historico_desfeito)
  returning "CO_SEQ_HISTORICO" into v_historico;

  return jsonb_build_object(
    'lugar', p_lugar, 'latitude', p_latitude, 'longitude', p_longitude,
    'conferido', case when v_conferido is null then null else to_jsonb(v_conferido = 'S') end,
    'historico', v_historico, 'alterado_em', v_agora);
end;
$function$;

-- private."FC_APLICAR_COORDENADA_MAPA"(jsonb,double precision,double precision,double precision,double precision,text,text,text,bigint) (2)
CREATE OR REPLACE FUNCTION private."FC_APLICAR_COORDENADA_MAPA"(p_alvo jsonb, p_latitude double precision, p_longitude double precision, p_latitude_anterior double precision, p_longitude_anterior double precision, p_motivo text, p_acao text, p_conferido text, p_historico_desfeito bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_payload jsonb;
  v_ponto jsonb;
  v_caminho text[];
  v_fonte text := p_alvo ->> 'fonte';
  v_tipo text := p_alvo ->> 'tipo';
  v_dsei text := p_alvo ->> 'dsei';
  v_indice integer;
  v_dsei_indice integer;
  v_nome text;
  v_codigo text;
  v_lat double precision;
  v_lon double precision;
  v_pendencia bigint;
  v_conferido_anterior text;
  v_conferido text;
  v_mudou boolean;
  v_historico bigint;
  v_agora timestamptz := clock_timestamp();
begin
  if auth.uid() is null or not private."FC_PODE_EDITAR_COORDENADA"() then
    raise exception using errcode = '42501', message = 'Somente administrador ou gestor pode corrigir coordenadas.';
  end if;
  if p_acao is null or p_acao not in ('CORRECAO', 'CONFERENCIA', 'DESFAZER')
     or coalesce(p_conferido, 'S') not in ('S', 'N') then
    raise exception using errcode = '22023', message = 'Ação inválida.';
  end if;
  if p_latitude is null or p_longitude is null
     or not (p_latitude between -34.9 and 6.4)
     or not (p_longitude between -74.2 and -32) then
    raise exception using errcode = '22023', message = 'A coordenada deve ficar nos limites do Brasil.';
  end if;
  if p_motivo is null or length(btrim(p_motivo)) not between 10 and 1000 then
    raise exception using errcode = '22023', message = 'Descreva o motivo da correção (10 a 1000 caracteres).';
  end if;
  if jsonb_typeof(p_alvo) is distinct from 'object'
     or v_fonte is null or v_tipo is null
     or not ((v_fonte = 'lmap' and v_tipo in ('sede', 'polo', 'casai'))
          or (v_fonte = 'rede_cnes' and v_tipo in ('u', 'c', 'nac')))
     or coalesce(p_alvo ->> 'indice', '') !~ '^[0-9]{1,6}$'
     or nullif(p_alvo ->> 'nome', '') is null then
    raise exception using errcode = '22023', message = 'Ponto do mapa inválido.';
  end if;
  v_indice := (p_alvo ->> 'indice')::integer;
  select c.payload into v_payload from public."TB_CONFIG_MAPA_SAUDE_INDIG" c
   where c.chave = v_fonte for update;
  if not found then raise exception 'Cadastro do mapa não encontrado.'; end if;
  if v_fonte = 'lmap' and v_tipo = 'sede' then
    v_caminho := array['dsei', v_indice::text];
    if (v_payload #> v_caminho) ->> 'k' is distinct from v_dsei then
      raise exception using errcode = 'PT409', message = 'O ponto mudou. Atualize o mapa e tente novamente.';
    end if;
  elsif v_fonte = 'lmap' and v_tipo = 'polo' then
    select (d.ordinality - 1)::integer into v_dsei_indice
      from jsonb_array_elements(v_payload -> 'dsei') with ordinality d
     where d.value ->> 'k' = v_dsei;
    if v_dsei_indice is null then raise exception 'DSEI não encontrado.'; end if;
    v_caminho := array['dsei', v_dsei_indice::text, 'polos', v_indice::text];
  elsif v_fonte = 'lmap' then
    v_caminho := array['casai', v_indice::text];
  elsif v_tipo = 'nac' then
    v_caminho := array['nac', v_indice::text];
  else
    if nullif(v_dsei, '') is null then raise exception 'DSEI não informado.'; end if;
    v_caminho := array['rede', v_dsei, v_tipo, v_indice::text];
  end if;
  v_ponto := v_payload #> v_caminho;
  if v_fonte = 'rede_cnes' then
    v_nome := v_ponto ->> 0;
    v_codigo := v_ponto ->> 1;
    v_lat := (v_ponto ->> 2)::double precision;
    v_lon := (v_ponto ->> 3)::double precision;
  else
    v_nome := v_ponto ->> 'n';
    v_codigo := case when v_tipo = 'polo' then v_ponto ->> 'cod' else null end;
    v_lat := (v_ponto ->> 'lat')::double precision;
    v_lon := (v_ponto ->> 'lon')::double precision;
  end if;
  if v_ponto is null or v_nome is distinct from p_alvo ->> 'nome'
     or v_codigo is distinct from p_alvo ->> 'codigo'
     -- Tolerância 1e-9 (como em Projetos): o jsonb arredonda o float gravado e o
     -- histórico guarda o valor inteiro; igualdade exata recusava o desfazer.
     or coalesce(abs(v_lat - p_latitude_anterior) > 1e-9, (v_lat is null) <> (p_latitude_anterior is null))
     or coalesce(abs(v_lon - p_longitude_anterior) > 1e-9, (v_lon is null) <> (p_longitude_anterior is null)) then
    raise exception using errcode = 'PT409', message = 'O ponto mudou. Atualize o mapa e tente novamente.';
  end if;

  select p."CO_SEQ_PENDENCIA", p."ST_CONFERIDO" into v_pendencia, v_conferido_anterior
    from private."TB_PENDENCIA_COORDENADA_MAPA" p
   where p."TP_FONTE" = v_fonte and p."TP_PONTO" = v_tipo
     and p."NO_DSEI" = v_dsei and p."CO_PONTO" = v_codigo
   for update;
  if p_acao = 'CONFERENCIA' then
    if v_pendencia is null then
      raise exception using errcode = '22023', message = 'Este ponto não tem pendência de localização.';
    elsif v_conferido_anterior = 'S' then
      raise exception using errcode = '22023', message = 'Este ponto já foi conferido.';
    end if;
  end if;
  v_conferido := case when v_pendencia is null then null else coalesce(p_conferido, v_conferido_anterior) end;
  v_mudou := coalesce(abs(v_lat - p_latitude) > 1e-9, (v_lat is null) <> (p_latitude is null))
           or coalesce(abs(v_lon - p_longitude) > 1e-9, (v_lon is null) <> (p_longitude is null));
  if not v_mudou and v_conferido is not distinct from v_conferido_anterior then
    raise exception using errcode = '22023', message = 'A coordenada não mudou.';
  end if;

  if v_mudou then
    if v_fonte = 'rede_cnes' then
      v_payload := jsonb_set(jsonb_set(v_payload, v_caminho || array['2'], to_jsonb(p_latitude), false),
        v_caminho || array['3'], to_jsonb(p_longitude), false);
    else
      v_payload := jsonb_set(jsonb_set(v_payload, v_caminho || array['lat'], to_jsonb(p_latitude), true),
        v_caminho || array['lon'], to_jsonb(p_longitude), true);
    end if;
    update public."TB_CONFIG_MAPA_SAUDE_INDIG" c set payload = v_payload, updated_at = v_agora
     where c.chave = v_fonte;
  end if;
  if v_conferido is distinct from v_conferido_anterior then
    update private."TB_PENDENCIA_COORDENADA_MAPA" p
       set "ST_CONFERIDO" = v_conferido,
           "DT_CONFERENCIA" = case when v_conferido = 'S' then v_agora end,
           "CO_USUARIO_CONFERENCIA" = case when v_conferido = 'S' then auth.uid() end
     where p."CO_SEQ_PENDENCIA" = v_pendencia;
  end if;
  insert into private."TH_COORDENADA_MAPA_SAUDE_INDIG"
    ("CO_USUARIO", "DS_ALVO", "CG_LATITUDE_ANTERIOR", "CG_LONGITUDE_ANTERIOR", "CG_LATITUDE", "CG_LONGITUDE",
     "DS_MOTIVO", "TP_ACAO", "ST_CONFERIDO_ANTERIOR", "ST_CONFERIDO", "CO_HISTORICO_DESFEITO")
  values (auth.uid(), p_alvo, v_lat, v_lon, p_latitude, p_longitude,
          btrim(p_motivo), p_acao, v_conferido_anterior, v_conferido, p_historico_desfeito)
  returning "CO_SEQ_HISTORICO" into v_historico;

  return jsonb_build_object(
    'alvo', p_alvo, 'latitude', p_latitude, 'longitude', p_longitude,
    'conferido', case when v_conferido is null then null else to_jsonb(v_conferido = 'S') end,
    'historico', v_historico, 'alterado_em', v_agora,
    'lmap', (select c.payload from public."TB_CONFIG_MAPA_SAUDE_INDIG" c where c.chave = 'lmap'),
    'rede_cnes', (select c.payload from public."TB_CONFIG_MAPA_SAUDE_INDIG" c where c.chave = 'rede_cnes'));
end;
$function$;

-- private."FC_EXIGIR_GRAVAR_FICHA"("TB_FICHA_ANALISE",integer) (1)
CREATE OR REPLACE FUNCTION private."FC_EXIGIR_GRAVAR_FICHA"(p_ficha "TB_FICHA_ANALISE", p_versao integer)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
begin
  if p_ficha."CO_FICHA_ANALISE" is null then
    raise exception 'Ficha não encontrada' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_AVALIACAO_EDITAL"(p_ficha."CO_MONITORAMENTO", 2);
  if p_ficha."TP_SITUACAO" <> 'EM_ANALISE' then
    raise exception 'A ficha não está em análise (%): só leitura.', lower(p_ficha."TP_SITUACAO") using errcode = '22023';
  end if;
  if p_ficha."CO_USUARIO_RESERVA" is distinct from v_uid or p_ficha."DT_RESERVA_EXPIRA" <= now() then
    raise exception 'A ficha não está mais com você (reserva vencida, liberada ou com outra pessoa); abra de novo.' using errcode = '55P03';
  end if;
  if not (private."FC_PODE_ANALISAR_VAGA"(p_ficha."CO_MONITORAMENTO", v_uid, p_ficha."CO_VAGA")
          or coalesce(private."FC_PAPEL_AVALIACAO"(p_ficha."CO_MONITORAMENTO"), '') = 'COORDENADOR') then
    raise exception 'Você não analisa a vaga %.', p_ficha."CO_VAGA" using errcode = '42501';
  end if;
  if p_versao is distinct from p_ficha."NU_VERSAO" then
    raise exception 'Esta ficha mudou desde que você abriu (outra aba ou outra pessoa); recarregue.' using errcode = 'PT409';
  end if;
end;
$function$;

-- concluir_ficha(uuid,integer,integer,jsonb,jsonb,text) (1)
CREATE OR REPLACE FUNCTION public.concluir_ficha(p_ficha uuid, p_versao integer, p_versao_regra integer, p_lancamento jsonb, p_resultado jsonb, p_parecer text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_regra record;
  v_alt jsonb;
  v_cargo text;
  v_conf jsonb;
  v_pend text[];
  v_parecer text := btrim(coalesce(p_parecer, ''));
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  perform private."FC_EXIGIR_GRAVAR_FICHA"(v_f, p_versao);
  select * into v_regra from private."FC_REGRA_VIGENTE_FICHA"(p_ficha);
  -- A vaga e o cargo são os da ficha (o lançamento grava os dois) e a regra é a
  -- da vaga: a diferença do cargo por cima do nível (20261013130000).
  v_cargo := (select pv."NO_CARGO" from public."TB_PRE_CLASSIF_VAGA" pv
               where pv."CO_MONITORAMENTO" = v_f."CO_MONITORAMENTO" and pv."CO_VAGA" = v_f."CO_VAGA");
  if jsonb_typeof(p_lancamento) = 'object' then
    p_lancamento := p_lancamento || jsonb_build_object('vaga', v_f."CO_VAGA", 'cargo', v_cargo);
  end if;
  v_conf := private."FC_REGRA_DA_VAGA"(v_regra.p_configuracao, v_f."CO_VAGA", v_cargo, p_lancamento ->> 'nivel');
  if p_versao_regra is distinct from v_regra.p_versao then
    raise exception 'A regra mudou (versão %): a ficha foi recalculada; confira e conclua de novo.', v_regra.p_versao using errcode = 'PT409';
  end if;
  if v_regra.p_situacao <> 'CONFERIDA' then
    raise exception 'A versão % da regra ainda não foi conferida pela coordenação: dá para salvar o rascunho, mas não concluir.', v_regra.p_versao
      using errcode = '22023';
  end if;
  perform private."FC_VALIDAR_LANCAMENTO_FICHA"(v_conf, p_lancamento);
  perform private."FC_VALIDAR_RESULTADO_FICHA"(v_conf, p_lancamento, p_resultado,
                                                private."FC_DOCUMENTAL_DO_EDITAL"(v_f."CO_MONITORAMENTO"));
  v_pend := private."FC_PENDENCIAS_FICHA"(v_conf, p_lancamento, p_resultado);
  if cardinality(v_pend) > 0 then
    raise exception 'Falta para concluir: %.', array_to_string(v_pend[1:5], '; ') using errcode = '22023';
  end if;
  if length(v_parecer) not between 1 and 8000 then
    raise exception 'O parecer é obrigatório (até 8.000 caracteres).' using errcode = '22023';
  end if;
  v_alt := private."FC_ALTERACOES_FICHA"(v_conf, v_f."DS_LANCAMENTO", v_f."DS_RESULTADO", p_lancamento, p_resultado);
  update public."TB_FICHA_ANALISE" set
    "TP_SITUACAO" = 'CONCLUIDA', "NU_VERSAO_REGRA" = v_regra.p_versao,
    "DS_LANCAMENTO" = p_lancamento, "DS_RESULTADO" = p_resultado, "DS_PARECER" = v_parecer,
    "TP_RESULTADO" = p_resultado ->> 'resultado',
    "VL_NOTA_APURADA" = (p_resultado ->> 'nota_apurada')::numeric, "VL_NOTA_FINAL" = (p_resultado ->> 'nota_final')::numeric,
    "CO_USUARIO_CONCLUSAO" = v_uid, "DT_CONCLUSAO" = now(),
    "CO_USUARIO_RASCUNHO" = v_uid, "DT_RASCUNHO" = now(),
    "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
    "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_FICHA_ANALISE" = p_ficha;
  perform private."FC_HISTORICO_CONTEUDO_FICHA"(p_ficha, 'CONCLUIR', v_f."TP_SITUACAO", null, v_uid, v_alt,
    jsonb_build_object('lancamento', p_lancamento, 'resultado', p_resultado, 'parecer', v_parecer, 'versao_regra', v_regra.p_versao));
  return json_build_object('versao', v_f."NU_VERSAO" + 1, 'resultado', p_resultado ->> 'resultado',
                           'nota_final', (p_resultado ->> 'nota_final')::numeric, 'versao_regra', v_regra.p_versao);
end;
$function$;

-- conferir_regra_analise(uuid,integer) (1)
CREATE OR REPLACE FUNCTION public.conferir_regra_analise(p_edital uuid, p_versao integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  v_regra public."TB_REGRA_ANALISE";
  v_autor uuid;
begin
  select * into v_regra from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = p_edital for update;
  if v_regra."CO_REGRA_ANALISE" is null then
    raise exception 'O edital ainda não tem regra.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_regra."NU_VERSAO_VIGENTE" then
    raise exception 'A regra mudou (versão %); confira de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = 'PT409';
  end if;
  if v_regra."TP_SITUACAO" <> 'CONFERIDA' then
    select h."CO_USUARIO" into v_autor
      from public."TH_REGRA_ANALISE" h
     where h."CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE" and h."NU_VERSAO" = v_regra."NU_VERSAO_VIGENTE";
    if v_autor = (select auth.uid()) and not private.is_master() then
      raise exception 'Dupla conferência: quem salvou a versão % não pode conferi-la. Peça a outra pessoa da coordenação do edital.', v_regra."NU_VERSAO_VIGENTE"
        using errcode = '42501';
    end if;
    update public."TB_REGRA_ANALISE"
       set "TP_SITUACAO" = 'CONFERIDA', "CO_USUARIO_CONFERENCIA" = (select auth.uid()), "DT_CONFERENCIA" = now(), "DT_ATUALIZACAO" = now()
     where "CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";
  end if;
  return json_build_object('regra', private."FC_REGRA_ANALISE_JSON"(p_edital), 'fichas_afetadas', '[]'::json);
end;
$function$;

-- convocar_para_entrevista(uuid,uuid,uuid[]) (1)
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

  return json_build_object('convocados', v_qt, 'lista', v_vigente, 'dados', public.obter_entrevistas_do_edital(p_edital));
end;
$function$;

-- desfazer_coordenada_mapa_projetos(bigint,text) (1)
CREATE OR REPLACE FUNCTION public.desfazer_coordenada_mapa_projetos(p_historico bigint, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v private."TH_COORDENADA_LOCAL_VAGA"%rowtype;
begin
  if auth.uid() is null or not private."FC_PODE_EDITAR_COORDENADA"() then
    raise exception using errcode = '42501', message = 'Somente administrador ou gestor pode corrigir coordenadas.';
  end if;
  select h.* into v from private."TH_COORDENADA_LOCAL_VAGA" h
   where h."CO_SEQ_HISTORICO" = p_historico for update;
  if not found then
    raise exception using errcode = '22023', message = 'Correção não encontrada.';
  end if;
  if v."TP_ACAO" = 'DESFAZER' then
    raise exception using errcode = '22023', message = 'Um desfazer não se desfaz; corrija a posição.';
  end if;
  if exists (select 1 from private."TH_COORDENADA_LOCAL_VAGA" h
              where h."DS_CHAVE_LUGAR" = v."DS_CHAVE_LUGAR"
                and h."CO_SEQ_HISTORICO" > v."CO_SEQ_HISTORICO") then
    raise exception using errcode = 'PT409', message = 'Só a última correção do lugar pode ser desfeita. Atualize o mapa.';
  end if;
  if v."CG_LATITUDE_ANTERIOR" is null or v."CG_LONGITUDE_ANTERIOR" is null then
    raise exception using errcode = '22023', message = 'O lugar não tinha coordenada antes; corrija a posição.';
  end if;
  return private."FC_APLICAR_COORDENADA_LOCAL"(
    v."DS_CHAVE_LUGAR", v."CG_LATITUDE_ANTERIOR", v."CG_LONGITUDE_ANTERIOR", v."CG_LATITUDE", v."CG_LONGITUDE",
    p_motivo, 'DESFAZER', v."ST_CONFERIDO_ANTERIOR", v."CO_SEQ_HISTORICO");
end;
$function$;

-- desfazer_coordenada_mapa_saude_indigena(bigint,text) (1)
CREATE OR REPLACE FUNCTION public.desfazer_coordenada_mapa_saude_indigena(p_historico bigint, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v private."TH_COORDENADA_MAPA_SAUDE_INDIG"%rowtype;
begin
  if auth.uid() is null or not private."FC_PODE_EDITAR_COORDENADA"() then
    raise exception using errcode = '42501', message = 'Somente administrador ou gestor pode corrigir coordenadas.';
  end if;
  select h.* into v from private."TH_COORDENADA_MAPA_SAUDE_INDIG" h
   where h."CO_SEQ_HISTORICO" = p_historico for update;
  if not found then
    raise exception using errcode = '22023', message = 'Correção não encontrada.';
  end if;
  if v."TP_ACAO" = 'DESFAZER' then
    raise exception using errcode = '22023', message = 'Um desfazer não se desfaz; corrija a posição.';
  end if;
  if exists (select 1 from private."TH_COORDENADA_MAPA_SAUDE_INDIG" h
              where h."CO_SEQ_HISTORICO" > v."CO_SEQ_HISTORICO"
                and private."FC_CHAVE_ALVO_COORDENADA"(h."DS_ALVO") = private."FC_CHAVE_ALVO_COORDENADA"(v."DS_ALVO")) then
    raise exception using errcode = 'PT409', message = 'Só a última correção do ponto pode ser desfeita. Atualize o mapa.';
  end if;
  if v."CG_LATITUDE_ANTERIOR" is null or v."CG_LONGITUDE_ANTERIOR" is null then
    raise exception using errcode = '22023', message = 'O ponto não tinha coordenada antes; corrija a posição.';
  end if;
  return private."FC_APLICAR_COORDENADA_MAPA"(
    v."DS_ALVO", v."CG_LATITUDE_ANTERIOR", v."CG_LONGITUDE_ANTERIOR", v."CG_LATITUDE", v."CG_LONGITUDE",
    p_motivo, 'DESFAZER', v."ST_CONFERIDO_ANTERIOR", v."CO_SEQ_HISTORICO");
end;
$function$;

-- distribuir_fichas(uuid,jsonb,text) (1)
CREATE OR REPLACE FUNCTION public.distribuir_fichas(p_edital uuid, p_atribuicoes jsonb, p_motivo text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_COORD_FICHAS"(p_edital);
  v_uid uuid := (select auth.uid());
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_item record;
  v_f public."TB_FICHA_ANALISE";
  v_acao text;
  v_qt integer;
  v_alteradas integer := 0;
  v_codigo text;
begin
  if jsonb_typeof(p_atribuicoes) is distinct from 'array' or jsonb_array_length(p_atribuicoes) not between 1 and 5000 then
    raise exception 'Escolha de 1 a 5.000 fichas.' using errcode = '22023';
  end if;
  if v_motivo is not null and length(v_motivo) > 2000 then
    raise exception 'Motivo com até 2.000 caracteres.' using errcode = '22023';
  end if;
  begin
    -- Controle otimista: alguma ficha mudou desde que a tela leu? Nada é gravado.
    select count(*) into v_qt
      from jsonb_to_recordset(p_atribuicoes) x(ficha uuid, versao integer, usuario uuid)
      left join public."TB_FICHA_ANALISE" f on f."CO_FICHA_ANALISE" = x.ficha and f."CO_MONITORAMENTO" = p_edital
     where f."CO_FICHA_ANALISE" is null or f."NU_VERSAO" is distinct from x.versao;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Atribuição com id ou versão inválida' using errcode = '22023';
  end;
  if v_qt > 0 then
    raise exception '% ficha(s) mudaram desde que você abriu a fila; atualize e confira.', v_qt using errcode = 'PT409';
  end if;

  for v_item in
    select x.ficha, x.usuario from jsonb_to_recordset(p_atribuicoes) x(ficha uuid, versao integer, usuario uuid) order by x.ficha
  loop
    select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v_item.ficha for update;
    select c."CO_CANDIDATO_EMPREGARE" into v_codigo from public."TB_EMPREGARE_CANDIDATO" c
     where c."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO";
    if v_f."TP_SITUACAO" in ('CONCLUIDA', 'FORA_LOTE') then
      raise exception 'A ficha % está %: não é redistribuída (AM-6.3).', v_codigo,
        case v_f."TP_SITUACAO" when 'CONCLUIDA' then 'concluída' else 'fora do lote' end using errcode = '22023';
    end if;
    continue when v_item.usuario is not distinct from v_f."CO_USUARIO_RESPONSAVEL"
                  and not (v_item.usuario is null and v_f."TP_SITUACAO" = 'REVISAR');
    if v_item.usuario is not null and not private."FC_PODE_ANALISAR_VAGA"(p_edital, v_item.usuario, v_f."CO_VAGA") then
      raise exception 'A pessoa escolhida para a ficha % não analisa a vaga % (equipe do edital, papel Analista, Editor).', v_codigo, v_f."CO_VAGA"
        using errcode = '22023';
    end if;
    v_acao := case when v_item.usuario is null then 'DEVOLVER_FILA'
                   when v_f."CO_USUARIO_RESPONSAVEL" is null then 'DISTRIBUIR' else 'REDISTRIBUIR' end;
    if v_acao <> 'DISTRIBUIR' and (v_motivo is null or length(v_motivo) < 10) then
      raise exception 'Informe o motivo para redistribuir ou devolver à fila (10 a 2.000 caracteres).' using errcode = '22023';
    end if;
    update public."TB_FICHA_ANALISE" set
      "CO_USUARIO_RESPONSAVEL" = v_item.usuario,
      "DT_ATRIBUICAO" = case when v_item.usuario is null then null else now() end,
      "TP_SITUACAO" = case when v_item.usuario is null then 'PENDENTE' else "TP_SITUACAO" end,
      "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_item.ficha;
    perform private."FC_HISTORICO_FICHA"(v_item.ficha, v_acao, v_f."TP_SITUACAO", v_f."CO_USUARIO_RESPONSAVEL", v_motivo, v_uid);
    v_alteradas := v_alteradas + 1;
  end loop;
  return json_build_object('alteradas', v_alteradas);
end;
$function$;

-- gravar_pre_classificacao_vaga(text,uuid,text,integer,jsonb,jsonb) (1)
CREATE OR REPLACE FUNCTION public.gravar_pre_classificacao_vaga(p_execucao text, p_edital uuid, p_vaga text, p_versao_regra integer, p_resumo jsonb, p_linhas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '30s'
AS $function$
declare
  v_exec public."TL_PRE_CLASSIFICACAO" := private."FC_EXIGIR_EXECUCAO_PRECLASSIF"(p_execucao);
  v_refazer boolean := v_exec."ST_REFAZER_LOTE" = 'S';
  v_quadro public."TB_QUADRO_VAGA_EDITAL";
  v_qt integer;
  v_erro text;
  v_mudancas integer;
  v_avisos jsonb := coalesce(p_resumo -> 'avisos', '[]'::jsonb);
  v_ant jsonb;
  v_iniciadas integer;
  v_quadro_id uuid;
begin
  -- A regra usada é a vigente e está conferida.
  if not exists (select 1 from public."TB_REGRA_ANALISE" r
                  where r."CO_MONITORAMENTO" = p_edital and r."NU_VERSAO_VIGENTE" = p_versao_regra
                    and r."TP_SITUACAO" = 'CONFERIDA') then
    raise exception 'A regra do edital mudou ou não está conferida; rode de novo' using errcode = 'PT409';
  end if;
  -- Refazer o lote do zero só com TODAS as fichas do edital intocadas: PENDENTE (ou FORA_LOTE),
  -- nunca atribuídas, reservadas, salvas nem concluídas, e no histórico só as ações do lote
  -- (FC_FICHA_INICIADA). A trava é a mesma da abertura das fichas (20261013110000).
  if v_refazer then
    perform pg_advisory_xact_lock(hashtextextended('avaliacao-documental:fichas:' || p_edital::text, 0));
    v_iniciadas := private."FC_FICHAS_INICIADAS"(p_edital);
    if v_iniciadas > 0 then
      raise exception 'Lote não refeito: o lote já está em análise: % fichas iniciadas', v_iniciadas
        using errcode = '55000';
    end if;
  end if;
  if not exists (select 1 from public."TB_EMPREGARE_VAGA" v where v."CO_VAGA" = p_vaga and v."CO_MONITORAMENTO" = p_edital) then
    raise exception 'A vaga % não é do edital', p_vaga using errcode = '22023';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) > 20000 then
    raise exception 'Linhas inválidas (lista de até 20000)' using errcode = '22023';
  end if;
  if jsonb_typeof(p_resumo) is distinct from 'object' or jsonb_typeof(v_avisos) <> 'array' or jsonb_array_length(v_avisos) > 50
     or exists (select 1 from jsonb_array_elements(v_avisos) a where jsonb_typeof(a) <> 'string' or a #>> '{}' !~ '^[A-Z][A-Z0-9_:]{1,59}$')
     or length(coalesce(p_resumo ->> 'descricao', '')) > 200
     or (p_resumo -> 'tamanho' is not null and jsonb_typeof(p_resumo -> 'tamanho') not in ('number', 'null'))
     or (p_resumo -> 'por_modalidade' is not null and jsonb_typeof(p_resumo -> 'por_modalidade') not in ('object', 'null'))
     or (p_resumo ? 'quadro' and jsonb_typeof(p_resumo -> 'quadro') not in ('string', 'null')) then
    raise exception 'Resumo da vaga inválido' using errcode = '22023';
  end if;

  -- As linhas lidas do JSON UMA vez (antes, cada conferência relia o p_linhas inteiro).
  drop table if exists pg_temp.t_linhas_vaga;
  begin
    create temporary table t_linhas_vaga on commit drop as
      select * from private."FC_LINHAS_PRE_CLASSIF"(p_linhas);
  exception when invalid_text_representation or numeric_value_out_of_range or datatype_mismatch then
    raise exception 'Linha com tipo inválido (id, nota, posição ou lote)' using errcode = '22023';
  end;
  analyze pg_temp.t_linhas_vaga;

  -- A forma do resultado (as mesmas regras das CK_, com mensagem clara).
  select case
    when exists (select 1 from pg_temp.t_linhas_vaga t where t.id is null) then 'linha sem id'
    when (select count(*) from pg_temp.t_linhas_vaga) <> (select count(distinct t.id) from pg_temp.t_linhas_vaga t) then 'inscrito repetido'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where not exists (select 1 from public."TB_EMPREGARE_CANDIDATO" c
                                     where c."CO_EMPREGARE_CANDIDATO" = t.id and c."CO_VAGA" = p_vaga)) then 'inscrito que não é da vaga'
    when exists (select 1 from public."TB_PRE_CLASSIFICACAO" a
                  where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga
                    and not exists (select 1 from pg_temp.t_linhas_vaga t where t.id = a."CO_EMPREGARE_CANDIDATO")) then 'faltam inscritos já pré-classificados'
    when exists (select 1 from pg_temp.t_linhas_vaga t where t.situacao is null or t.situacao not in ('ELIMINADO', 'RANQUEADO', 'NO_LOTE', 'ANALISADO')) then 'situação inválida'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where (t.situacao = 'ELIMINADO') <> (t.motivo_codigo is not null)
                     or (t.motivo_codigo is not null and (t.motivo_codigo !~ '^[A-Z][A-Z0-9_]{1,29}$'
                         or coalesce(length(btrim(t.motivo)), 0) not between 1 and 200))) then 'eliminado sem motivo (ou motivo fora de eliminado)'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where (t.situacao = 'ELIMINADO' and (t.posicao is not null or t.posicao_modalidade is not null))
                     or (t.situacao <> 'ELIMINADO' and (coalesce(t.posicao, 0) < 1 or coalesce(t.posicao_modalidade, 0) < 1))) then 'posição inválida'
    when (select count(*) from pg_temp.t_linhas_vaga t where t.situacao <> 'ELIMINADO')
         <> coalesce((select max(t.posicao) from pg_temp.t_linhas_vaga t where t.situacao <> 'ELIMINADO'), 0)
      or (select count(distinct t.posicao) from pg_temp.t_linhas_vaga t where t.situacao <> 'ELIMINADO')
         <> (select count(*) from pg_temp.t_linhas_vaga t where t.situacao <> 'ELIMINADO') then 'posições não vão de 1 a N sem repetir'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where case when t.situacao in ('NO_LOTE', 'ANALISADO')
                             then coalesce(t.lote, 0) not between 1 and 999
                                  or coalesce(t.lista_lote, '') !~ '^(GERAL|[A-Z]{2,10})$'
                                  or coalesce(t.entrada, '') not in ('INICIAL', 'REPOSICAO', 'AMPLIACAO', 'DECISAO')
                                  or length(coalesce(t.motivo_entrada, '')) > 300
                             else t.lote is not null or t.lista_lote is not null or t.entrada is not null end) then 'lote inválido'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where coalesce(t.origem_nota, 'ART') not in ('ART', 'DECLARADA')
                     or t.modalidade !~ '^[A-Z]{2,10}$'
                     -- As cotas optadas (20261015150000): códigos sem a ampla, a principal primeiro.
                     or jsonb_typeof(t.modalidades) is distinct from 'array'
                     or jsonb_array_length(t.modalidades) > 10
                     or exists (select 1 from jsonb_array_elements(t.modalidades) m
                                 where jsonb_typeof(m) <> 'string' or m #>> '{}' !~ '^[A-Z]{2,10}$' or m #>> '{}' = 'AC')
                     or (t.modalidade = 'AC') <> (jsonb_array_length(t.modalidades) = 0)
                     or (t.modalidade <> 'AC' and t.modalidades ->> 0 is distinct from t.modalidade)
                     or abs(coalesce(t.art, 0)) > 1000 or abs(coalesce(t.nota, 0)) > 1000 or abs(coalesce(t.declarada, 0)) > 1000
                     or t.sem_mapa not between 0 and 100) then 'nota, origem ou modalidade inválida'
    -- A declarada congelada: completa, com o total igual à declarada da linha.
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where t.declarada_congelada is not null
                    and (jsonb_typeof(t.declarada_congelada -> 'total') is distinct from 'number'
                         or (t.declarada_congelada ->> 'total')::numeric not between 0 and 1000
                         or (t.declarada_congelada ->> 'total')::numeric is distinct from t.declarada
                         or t.declarada_completa is not true
                         or jsonb_typeof(coalesce(t.declarada_congelada -> 'respostas', '[]'::jsonb)) <> 'array'
                         or jsonb_array_length(coalesce(t.declarada_congelada -> 'respostas', '[]'::jsonb)) > 20
                         or length(t.declarada_congelada::text) > 20000)) then 'declarada congelada inválida'
    else null end
    into v_erro;
  if v_erro is not null then
    raise exception 'Resultado da vaga % recusado: %', p_vaga, v_erro using errcode = '22023';
  end if;

  -- A situação de antes de cada inscrito (para as travas e o histórico).
  select coalesce(jsonb_object_agg(a."CO_EMPREGARE_CANDIDATO",
                                   jsonb_build_object('s', a."TP_SITUACAO", 'l', a."NU_LOTE", 'e', a."TP_ENTRADA_LOTE")), '{}'::jsonb)
    into v_ant
    from public."TB_PRE_CLASSIFICACAO" a
   where a."CO_MONITORAMENTO" = p_edital and a."CO_VAGA" = p_vaga;

  -- As decisões da coordenação (TB_DECISAO_LOTE): toda decisão vigente aplicada (no lote) e só
  -- entra por decisão quem tem decisão vigente, com o mesmo motivo.
  select case
    when exists (select 1 from pg_temp.t_linhas_vaga t
                   join public."TB_DECISAO_LOTE" d
                     on d."CO_MONITORAMENTO" = p_edital and d."CO_EMPREGARE_CANDIDATO" = t.id and d."ST_ATIVO" = 'S'
                  where t.situacao = 'RANQUEADO'
                     or (t.situacao = 'ELIMINADO' and t.motivo_codigo is distinct from 'SAIU_DA_EMPREGARE')) then 'decisão da coordenação não aplicada'
    when exists (select 1 from pg_temp.t_linhas_vaga t
                  where t.entrada = 'DECISAO'
                    and not exists (select 1 from public."TB_DECISAO_LOTE" d
                                     where d."CO_MONITORAMENTO" = p_edital and d."CO_EMPREGARE_CANDIDATO" = t.id and d."ST_ATIVO" = 'S'
                                       and btrim(d."DS_MOTIVO") = btrim(coalesce(t.motivo_entrada, '')))) then 'entrada por decisão sem decisão vigente'
    else null end
    into v_erro;
  if v_erro is not null then
    raise exception 'Resultado da vaga % recusado: %', p_vaga, v_erro using errcode = '22023';
  end if;

  -- A declarada congelada não muda: só a coordenação descongela (descongelar_declarada_pre_classificacao).
  if exists (select 1 from pg_temp.t_linhas_vaga t
               join public."TB_PRE_CLASSIFICACAO" a
                 on a."CO_MONITORAMENTO" = p_edital and a."CO_EMPREGARE_CANDIDATO" = t.id
              where a."VL_DECLARADA_CONGELADA" is not null and t.declarada is not null
                and t.declarada is distinct from a."VL_DECLARADA_CONGELADA") then
    raise exception 'Resultado da vaga % recusado: a nota declarada congelada não muda (descongele antes)', p_vaga using errcode = '22023';
  end if;

  -- Quem tem ficha (ANALISADO) não muda; ANALISADO só vem do banco (fase F3).
  if exists (select 1 from pg_temp.t_linhas_vaga t
               cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote) h
              where (h.ant_situacao is not distinct from 'ANALISADO') <> (t.situacao = 'ANALISADO')
                 or (h.ant_situacao = 'ANALISADO' and h.ant_lote is distinct from t.lote)) then
    raise exception 'Resultado da vaga % recusado: quem já tem ficha não muda', p_vaga using errcode = '22023';
  end if;
  -- Quem está no lote só sai eliminado (a não ser que a execução refaça o lote); quem entrou
  -- por decisão da coordenação já revogada sai.
  if not v_refazer and exists (
      select 1 from pg_temp.t_linhas_vaga t
       cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote,
                                  v_ant -> t.id::text ->> 'e' as ant_entrada) h
       where h.ant_situacao = 'NO_LOTE'
         and not (t.situacao = 'ELIMINADO' or (t.situacao = 'NO_LOTE' and t.lote = h.ant_lote))
         and not (h.ant_entrada = 'DECISAO'
                  and not exists (select 1 from public."TB_DECISAO_LOTE" d
                                   where d."CO_MONITORAMENTO" = p_edital and d."CO_EMPREGARE_CANDIDATO" = t.id and d."ST_ATIVO" = 'S'))) then
    raise exception 'Resultado da vaga % recusado: quem está no lote só sai eliminado (AM-5.5)', p_vaga using errcode = '22023';
  end if;

  -- Grava o resultado (rodar de novo atualiza a mesma linha: AM-4.2).
  insert into public."TB_PRE_CLASSIFICACAO" as a
    ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "NU_VERSAO_REGRA", "TP_SITUACAO",
     "CO_MOTIVO_ELIMINACAO", "DS_MOTIVO_ELIMINACAO", "VL_ART", "VL_NOTA_ORDEM", "TP_ORIGEM_NOTA",
     "VL_NOTA_DECLARADA", "DS_NOTA_DECLARADA", "ST_DIVERGENTE", "NO_MODALIDADE", "NU_POSICAO",
     "NU_POSICAO_MODALIDADE", "NU_LOTE", "CO_LISTA_LOTE", "TP_ENTRADA_LOTE", "DS_MOTIVO_ENTRADA",
     "DT_ENTRADA_LOTE", "CO_EXECUCAO", "VL_DECLARADA_CONGELADA", "DS_DECLARADA_CONGELADA", "DT_CONGELAMENTO_DECLARADA",
     "DS_MODALIDADES")
  select p_edital, t.id, p_vaga, p_versao_regra, t.situacao,
         t.motivo_codigo, left(btrim(t.motivo), 200), t.art, t.nota, t.origem_nota,
         t.declarada,
         case when t.declarada is null then null
              else jsonb_build_object('parciais', coalesce(t.declarada_parciais, '{}'::jsonb), 'sem_mapa', t.sem_mapa,
                                      'completa', t.declarada_completa) end,
         case when t.divergente then 'S' else 'N' end, t.modalidade, t.posicao,
         t.posicao_modalidade, t.lote, t.lista_lote, t.entrada, nullif(left(btrim(t.motivo_entrada), 300), ''),
         case when t.lote is not null then now() end, p_execucao,
         (t.declarada_congelada ->> 'total')::numeric,
         case when t.declarada_congelada is not null
              then (t.declarada_congelada - 'total') || jsonb_build_object('versao_regra', p_versao_regra) end,
         case when t.declarada_congelada is not null then now() end,
         t.modalidades
    from pg_temp.t_linhas_vaga t
  on conflict ("CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO") do update set
    "NU_VERSAO_REGRA" = excluded."NU_VERSAO_REGRA",
    "TP_SITUACAO" = excluded."TP_SITUACAO",
    "CO_MOTIVO_ELIMINACAO" = excluded."CO_MOTIVO_ELIMINACAO",
    "DS_MOTIVO_ELIMINACAO" = excluded."DS_MOTIVO_ELIMINACAO",
    "VL_ART" = excluded."VL_ART",
    "VL_NOTA_ORDEM" = excluded."VL_NOTA_ORDEM",
    "TP_ORIGEM_NOTA" = excluded."TP_ORIGEM_NOTA",
    "VL_NOTA_DECLARADA" = excluded."VL_NOTA_DECLARADA",
    "DS_NOTA_DECLARADA" = excluded."DS_NOTA_DECLARADA",
    "ST_DIVERGENTE" = excluded."ST_DIVERGENTE",
    "NO_MODALIDADE" = excluded."NO_MODALIDADE",
    "DS_MODALIDADES" = excluded."DS_MODALIDADES",
    "NU_POSICAO" = excluded."NU_POSICAO",
    "NU_POSICAO_MODALIDADE" = excluded."NU_POSICAO_MODALIDADE",
    "NU_LOTE" = excluded."NU_LOTE",
    "CO_LISTA_LOTE" = excluded."CO_LISTA_LOTE",
    "TP_ENTRADA_LOTE" = excluded."TP_ENTRADA_LOTE",
    "DS_MOTIVO_ENTRADA" = excluded."DS_MOTIVO_ENTRADA",
    -- Quem continua no mesmo lote guarda a data de entrada.
    "DT_ENTRADA_LOTE" = case when excluded."NU_LOTE" is null then null
                             when a."NU_LOTE" is not distinct from excluded."NU_LOTE" then a."DT_ENTRADA_LOTE"
                             else now() end,
    "CO_EXECUCAO" = excluded."CO_EXECUCAO",
    -- A congelada fica como estava; só entra quando ainda não há.
    "VL_DECLARADA_CONGELADA" = coalesce(a."VL_DECLARADA_CONGELADA", excluded."VL_DECLARADA_CONGELADA"),
    "DS_DECLARADA_CONGELADA" = case when a."VL_DECLARADA_CONGELADA" is not null then a."DS_DECLARADA_CONGELADA"
                                    else excluded."DS_DECLARADA_CONGELADA" end,
    "DT_CONGELAMENTO_DECLARADA" = case when a."VL_DECLARADA_CONGELADA" is not null then a."DT_CONGELAMENTO_DECLARADA"
                                       else excluded."DT_CONGELAMENTO_DECLARADA" end,
    "DT_ATUALIZACAO" = now();

  -- Histórico: entrada na lista, troca de situação ou de lote (com o motivo).
  insert into public."TH_PRE_CLASSIFICACAO"
    ("CO_EXECUCAO", "CO_MONITORAMENTO", "CO_EMPREGARE_CANDIDATO", "CO_VAGA", "TP_SITUACAO_ANTERIOR",
     "TP_SITUACAO", "NU_LOTE_ANTERIOR", "NU_LOTE", "NU_POSICAO", "DS_MOTIVO")
  select p_execucao, p_edital, t.id, p_vaga, h.ant_situacao, t.situacao, h.ant_lote, t.lote, t.posicao,
         left(case when t.situacao = 'ELIMINADO' then t.motivo
                   when t.entrada = 'DECISAO' and h.ant_entrada is distinct from 'DECISAO'
                     then 'Incluído no lote por decisão da coordenação: ' || t.motivo_entrada
                   when h.ant_entrada = 'DECISAO' and t.lote is null
                     then 'Saiu do lote: a decisão da coordenação foi revogada'
                   when t.lote is not null and t.lote is distinct from h.ant_lote then t.motivo_entrada
                   when h.ant_situacao = 'NO_LOTE' and t.situacao = 'RANQUEADO' then 'Saiu do lote: o recorte foi refeito'
                   when h.ant_situacao is null then 'Entrou na Provisória'
                   else null end, 300)
    from pg_temp.t_linhas_vaga t
   cross join lateral (select v_ant -> t.id::text ->> 's' as ant_situacao, (v_ant -> t.id::text ->> 'l')::integer as ant_lote,
                              v_ant -> t.id::text ->> 'e' as ant_entrada) h
   where h.ant_situacao is null
      or h.ant_situacao is distinct from t.situacao
      or h.ant_lote is distinct from t.lote
      or h.ant_entrada is distinct from t.entrada;
  get diagnostics v_mudancas = row_count;

  -- O resumo da vaga: contagens feitas aqui. A linha do quadro é a que o job leu nesta execução
  -- (pre_classificacao_ler_candidatos, p_resumo.quadro; nula = vaga sem quadro), conferida aqui
  -- (do edital e ativa); sem a chave, o banco acha a linha (FC_QUADRO_DA_VAGA_EMPREGARE, até 1,8 s).
  if p_resumo ? 'quadro' then
    if jsonb_typeof(p_resumo -> 'quadro') = 'string' then
      begin
        v_quadro_id := (p_resumo ->> 'quadro')::uuid;
      exception when invalid_text_representation then
        raise exception 'Resumo da vaga inválido (quadro)' using errcode = '22023';
      end;
      select * into v_quadro from public."TB_QUADRO_VAGA_EDITAL" q
       where q."CO_QUADRO_VAGA" = v_quadro_id and q."CO_MONITORAMENTO" = p_edital and q."ST_REGISTRO_ATIVO" = 'S';
      if not found then
        raise exception 'Resumo da vaga % recusado: a linha do quadro não é do edital (ou não está ativa)', p_vaga
          using errcode = '22023';
      end if;
    end if;
  else
    v_quadro := private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital, p_vaga);
  end if;
  select count(*) into v_qt from pg_temp.t_linhas_vaga;
  insert into public."TB_PRE_CLASSIF_VAGA" as pv
    ("CO_MONITORAMENTO", "CO_VAGA", "CO_EXECUCAO", "NU_VERSAO_REGRA", "CO_QUADRO_VAGA", "NO_CARGO", "NO_LOTACAO",
     "QT_VAGA_IMEDIATA", "ST_CADASTRO_RESERVA", "QT_INSCRITO", "QT_ELIMINADO", "QT_RANQUEADO", "QT_LOTE",
     "QT_TAMANHO_LOTE", "DS_TAMANHO_LOTE", "DS_TAMANHO_MODALIDADE", "VL_ART_CORTE", "QT_DIVERGENCIA", "QT_SEM_ART",
     "QT_ACIMA_CORTE", "NU_ULTIMO_LOTE", "DS_AVISO")
  select p_edital, p_vaga, p_execucao, p_versao_regra, v_quadro."CO_QUADRO_VAGA", v_quadro."NO_CARGO", v_quadro."NO_LOTACAO",
         v_quadro."QT_VAGA_IMEDIATA", coalesce(v_quadro."ST_CADASTRO_RESERVA", 'N'), v_qt,
         count(*) filter (where t.situacao = 'ELIMINADO'),
         count(*) filter (where t.situacao <> 'ELIMINADO'),
         count(*) filter (where t.situacao in ('NO_LOTE', 'ANALISADO')),
         case when jsonb_typeof(p_resumo -> 'tamanho') = 'number'
              then greatest(0, least(100000, (p_resumo ->> 'tamanho')::numeric))::integer end,
         nullif(left(btrim(coalesce(p_resumo ->> 'descricao', '')), 200), ''),
         case when jsonb_typeof(p_resumo -> 'por_modalidade') = 'object' then p_resumo -> 'por_modalidade' end,
         -- A linha de corte só com os da regra (quem entrou por decisão fica fora).
         min(t.nota) filter (where t.situacao in ('NO_LOTE', 'ANALISADO') and t.entrada is distinct from 'DECISAO'),
         count(*) filter (where t.divergente),
         count(*) filter (where t.situacao <> 'ELIMINADO' and t.art is null),
         case when jsonb_typeof(p_resumo -> 'acima_do_corte') = 'number'
              then greatest(0, least(100000, (p_resumo ->> 'acima_do_corte')::numeric))::integer else 0 end,
         coalesce(max(t.lote), 0),
         v_avisos
    from pg_temp.t_linhas_vaga t
  on conflict ("CO_MONITORAMENTO", "CO_VAGA") do update set
    "CO_EXECUCAO" = excluded."CO_EXECUCAO",
    "NU_VERSAO_REGRA" = excluded."NU_VERSAO_REGRA",
    "CO_QUADRO_VAGA" = excluded."CO_QUADRO_VAGA",
    "NO_CARGO" = excluded."NO_CARGO",
    "NO_LOTACAO" = excluded."NO_LOTACAO",
    "QT_VAGA_IMEDIATA" = excluded."QT_VAGA_IMEDIATA",
    "ST_CADASTRO_RESERVA" = excluded."ST_CADASTRO_RESERVA",
    "QT_INSCRITO" = excluded."QT_INSCRITO",
    "QT_ELIMINADO" = excluded."QT_ELIMINADO",
    "QT_RANQUEADO" = excluded."QT_RANQUEADO",
    "QT_LOTE" = excluded."QT_LOTE",
    "QT_TAMANHO_LOTE" = excluded."QT_TAMANHO_LOTE",
    "DS_TAMANHO_LOTE" = excluded."DS_TAMANHO_LOTE",
    "DS_TAMANHO_MODALIDADE" = excluded."DS_TAMANHO_MODALIDADE",
    "VL_ART_CORTE" = excluded."VL_ART_CORTE",
    "QT_DIVERGENCIA" = excluded."QT_DIVERGENCIA",
    "QT_SEM_ART" = excluded."QT_SEM_ART",
    "QT_ACIMA_CORTE" = excluded."QT_ACIMA_CORTE",
    "NU_ULTIMO_LOTE" = greatest(pv."NU_ULTIMO_LOTE", excluded."NU_ULTIMO_LOTE"),
    "DS_AVISO" = excluded."DS_AVISO",
    "DT_ATUALIZACAO" = now();

  return jsonb_build_object('vaga', p_vaga, 'inscritos', v_qt, 'mudancas', v_mudancas);
end;
$function$;

-- gravar_resumo_pergunta_edital(uuid,text,jsonb,integer) (1)
CREATE OR REPLACE FUNCTION public.gravar_resumo_pergunta_edital(p_edital uuid, p_hash text, p_perguntas jsonb, p_candidatos integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ruins integer;
begin
  if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital) then
    raise exception 'Edital não encontrado' using errcode = '22023';
  end if;
  if coalesce(p_candidatos, -1) < 0 then
    raise exception 'Contagem de candidatos inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(p_perguntas) is distinct from 'array' or jsonb_array_length(p_perguntas) > 500 then
    raise exception 'Resumo: lista de até 500 perguntas' using errcode = '22023';
  end if;

  -- O formato e a privacidade: só colunas de pergunta; até 30 respostas, cada uma com 2+ ocorrências e até 200 caracteres.
  select count(*) into v_ruins
    from jsonb_array_elements(p_perguntas) p
   where case
           when jsonb_typeof(p) <> 'object'
             or jsonb_typeof(p -> 'coluna') is distinct from 'string'
             or jsonb_typeof(p -> 'respostas') is distinct from 'array'
             or jsonb_typeof(p -> 'outras') is distinct from 'number'
             or jsonb_typeof(p -> 'distintas') is distinct from 'number' then true
           when not (p ->> 'coluna' ilike 'Pergunta %') or length(p ->> 'coluna') > 1000
             or jsonb_array_length(p -> 'respostas') > 30
             or (p ->> 'outras')::numeric < 0
             or (p ->> 'distintas')::numeric < jsonb_array_length(p -> 'respostas') + (p ->> 'outras')::numeric then true
           else exists (
             select 1 from jsonb_array_elements(p -> 'respostas') r
              where case
                      when jsonb_typeof(r) <> 'object'
                        or jsonb_typeof(r -> 'valor') is distinct from 'string'
                        or jsonb_typeof(r -> 'quantidade') is distinct from 'number' then true
                      else length(r ->> 'valor') not between 1 and 200 or (r ->> 'quantidade')::numeric < 2
                    end)
         end;
  if v_ruins > 0 then
    raise exception 'Resumo fora do formato (% pergunta(s))', v_ruins using errcode = '22023';
  end if;

  if p_hash is distinct from private."FC_HASH_VAGA_EDITAL"(p_edital) then
    raise exception 'A carga do edital mudou desde a leitura; o resumo fica para a próxima vez' using errcode = 'PT409';
  end if;

  insert into public."TB_RESUMO_PERGUNTA_EDITAL" as r
    ("CO_MONITORAMENTO", "DS_PERGUNTA", "QT_CANDIDATO", "DS_HASH_VAGA", "DT_ATUALIZACAO")
  values (p_edital, p_perguntas, p_candidatos, p_hash, now())
  on conflict ("CO_MONITORAMENTO") do update set
    "DS_PERGUNTA" = excluded."DS_PERGUNTA", "QT_CANDIDATO" = excluded."QT_CANDIDATO",
    "DS_HASH_VAGA" = excluded."DS_HASH_VAGA", "DT_ATUALIZACAO" = excluded."DT_ATUALIZACAO";
  return jsonb_build_object('edital', p_edital, 'perguntas', jsonb_array_length(p_perguntas), 'candidatos', p_candidatos);
end;
$function$;

-- mandar_fichas_revisao(uuid,jsonb,text) (1)
CREATE OR REPLACE FUNCTION public.mandar_fichas_revisao(p_edital uuid, p_fichas jsonb, p_motivo text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_COORD_FICHAS"(p_edital);
  v_uid uuid := (select auth.uid());
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_item record;
  v_f public."TB_FICHA_ANALISE";
  v_qt integer;
  v_codigo text;
begin
  if jsonb_typeof(p_fichas) is distinct from 'array' or jsonb_array_length(p_fichas) not between 1 and 5000 then
    raise exception 'Escolha de 1 a 5.000 fichas.' using errcode = '22023';
  end if;
  if v_motivo is null or length(v_motivo) not between 10 and 2000 then
    raise exception 'Informe o motivo para mandar para revisão (10 a 2.000 caracteres).' using errcode = '22023';
  end if;
  begin
    select count(*) into v_qt
      from jsonb_to_recordset(p_fichas) x(ficha uuid, versao integer)
      left join public."TB_FICHA_ANALISE" f on f."CO_FICHA_ANALISE" = x.ficha and f."CO_MONITORAMENTO" = p_edital
     where f."CO_FICHA_ANALISE" is null or f."NU_VERSAO" is distinct from x.versao;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Ficha com id ou versão inválida' using errcode = '22023';
  end;
  if v_qt > 0 then
    raise exception '% ficha(s) mudaram desde que você abriu a fila; atualize e confira.', v_qt using errcode = 'PT409';
  end if;
  for v_item in select x.ficha from jsonb_to_recordset(p_fichas) x(ficha uuid, versao integer) order by x.ficha loop
    select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = v_item.ficha for update;
    if v_f."TP_SITUACAO" not in ('PENDENTE', 'EM_ANALISE') then
      select c."CO_CANDIDATO_EMPREGARE" into v_codigo from public."TB_EMPREGARE_CANDIDATO" c
       where c."CO_EMPREGARE_CANDIDATO" = v_f."CO_EMPREGARE_CANDIDATO";
      raise exception 'A ficha % não está pendente nem em análise.', v_codigo using errcode = '22023';
    end if;
    update public."TB_FICHA_ANALISE" set
      "TP_SITUACAO" = 'REVISAR', "CO_USUARIO_RESERVA" = null, "DT_RESERVA" = null, "DT_RESERVA_EXPIRA" = null,
      "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_FICHA_ANALISE" = v_item.ficha;
    perform private."FC_HISTORICO_FICHA"(v_item.ficha, 'REVISAR', v_f."TP_SITUACAO", v_f."CO_USUARIO_RESPONSAVEL", v_motivo, v_uid);
  end loop;
  return json_build_object('alteradas', jsonb_array_length(p_fichas));
end;
$function$;

-- publicar_lista_aprovados_da_classificacao(uuid,uuid,jsonb) (1)
CREATE OR REPLACE FUNCTION public.publicar_lista_aprovados_da_classificacao(p_lista_classificacao uuid, p_lista_vigente uuid, p_vinculos jsonb DEFAULT '[]'::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_l public."TB_LISTA_CLASSIFICACAO";
  v_anterior public."TB_LISTA_APROVADO";
  v_edital text;
  v_vinculos jsonb := coalesce(p_vinculos, '[]'::jsonb);
  v_uid uuid := (select auth.uid());
  v_autor record;
  v_nova uuid;
  v_publicacao uuid;
  v_qt integer;
  v_entra integer;
  v_sai integer;
  v_muda integer;
  v_preservado integer;
  v_mantido integer;
  v_pendencias jsonb;
  v_aplicados jsonb;
  v_c record;
begin
  select * into v_l from public."TB_LISTA_CLASSIFICACAO" where "CO_LISTA_CLASSIFICACAO" = p_lista_classificacao;
  if v_l."CO_LISTA_CLASSIFICACAO" is null then
    raise exception 'Lista de classificação não encontrada' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(v_l."CO_MONITORAMENTO", 2);
  if v_l."TP_LISTA" <> 'FINAL' then
    raise exception 'Só o resultado final vira lista de aprovados.' using errcode = '22023';
  end if;
  if v_l."QT_PENDENCIA" > 0 then
    raise exception 'A lista tem empate pendente de sorteio ou decisão; resolva e gere de novo.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public."TB_LISTA_CLASSIFICACAO" o
     where o."CO_MONITORAMENTO" = v_l."CO_MONITORAMENTO" and o."TP_LISTA" = 'FINAL'
       and o."DT_GERACAO" > v_l."DT_GERACAO"
  ) then
    raise exception 'Há um resultado final gerado depois deste; publique o mais recente.' using errcode = '22023';
  end if;
  -- Os candidatos do resultado final são análises ativas deste edital (20261006070000).
  perform private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(v_l."CO_MONITORAMENTO", v_l."DS_RESULTADO");
  if jsonb_typeof(v_vinculos) is distinct from 'array' then
    raise exception 'Vínculos inválidos.' using errcode = '22023';
  end if;
  v_edital := v_l."CO_MONITORAMENTO"::text;

  select * into v_anterior from public."TB_LISTA_APROVADO"
   where edital_id = v_edital and vigente is true for update;
  if v_anterior.id is distinct from p_lista_vigente then
    raise exception 'A lista de aprovados do edital mudou desde a prévia; abra a publicação de novo.' using errcode = 'PT409';
  end if;
  if v_anterior."CO_LISTA_CLASSIFICACAO" = p_lista_classificacao then
    raise exception 'Este resultado final já é a lista de aprovados vigente.' using errcode = '22023';
  end if;

  -- Os candidatos do resultado final: um por análise (a posição da geral; quem
  -- só está na lista da modalidade, a dela; a primeira vaga em que aparece).
  create temporary table if not exists tmp_publicacao_novo (
    analise_id uuid, nome text, cargo text, codigo_vaga text, posicao integer,
    nota numeric, situacao text, modalidade text, vaga_ordem bigint
  ) on commit drop;
  truncate pg_temp.tmp_publicacao_novo;
  insert into pg_temp.tmp_publicacao_novo
  select distinct on (x.analise_id)
         x.analise_id, x.nome,
         coalesce(x.cargo_vaga, nullif(btrim(a.nome_vaga), ''), 'Sem cargo'),
         coalesce(x.codigo_vaga, nullif(btrim(a.codigo_vaga), ''), x.chave),
         x.posicao, x.nota, x.situacao,
         coalesce(nullif(btrim(a.modalidade_concorrencia), ''), x.modalidades, 'Ampla Concorrência'),
         x.vaga_ordem
    from (
      select (f.linha ->> 'analise_id')::uuid as analise_id,
             btrim(f.linha ->> 'nome') as nome,
             nullif(btrim(v.vaga ->> 'cargo'), '') as cargo_vaga,
             nullif(btrim(v.vaga ->> 'codigo'), '') as codigo_vaga,
             v.vaga ->> 'chave' as chave,
             case when jsonb_typeof(f.linha -> 'posicao') = 'number' then (f.linha ->> 'posicao')::numeric::integer end as posicao,
             case when jsonb_typeof(f.linha -> 'nota') = 'number' then (f.linha ->> 'nota')::numeric end as nota,
             case when f.linha ->> 'situacao' in ('VAGA', 'CR') then f.linha ->> 'situacao' end as situacao,
             (select string_agg(coalesce(md.valor ->> 'nome', c.codigo), '; ' order by c.ordem)
                from jsonb_array_elements_text(
                       case when jsonb_typeof(f.linha -> 'modalidades') = 'array' then f.linha -> 'modalidades' else '[]'::jsonb end
                     ) with ordinality c(codigo, ordem)
                left join jsonb_array_elements(coalesce(v_l."DS_RESULTADO" -> 'modalidades', '[]'::jsonb)) md(valor)
                  on md.valor ->> 'codigo' = c.codigo
               where c.codigo <> 'AC') as modalidades,
             v.ordem as vaga_ordem,
             f.fonte
        from jsonb_array_elements(v_l."DS_RESULTADO" -> 'vagas') with ordinality v(vaga, ordem)
        cross join lateral (
          select 0 as fonte, g.linha
            from jsonb_array_elements(coalesce(v.vaga -> 'geral', '[]'::jsonb)) g(linha)
          union all
          select 1, m.linha
            from jsonb_each(coalesce(v.vaga -> 'listas', '{}'::jsonb)) e(codigo, linhas)
            cross join lateral jsonb_array_elements(e.linhas) m(linha)
        ) f
       where f.linha ->> 'analise_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ) x
    left join public."TB_ANALISE_CURRICULAR" a on a.id = x.analise_id
   order by x.analise_id, x.vaga_ordem, x.fonte, x.posicao nulls last;

  select count(*) into v_qt from pg_temp.tmp_publicacao_novo;
  if v_qt = 0 then
    raise exception 'O resultado final não tem candidatos para publicar.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.tmp_publicacao_novo n
              where n.posicao is null or n.posicao < 1 or n.nota is null or n.nota < 0
                 or nullif(n.nome, '') is null) then
    raise exception 'O resultado final tem candidato sem posição, nota ou nome; gere de novo.' using errcode = '22023';
  end if;

  -- Os vínculos, conferidos.
  create temporary table if not exists tmp_publicacao_vinculo (
    candidato_id uuid, analise_id uuid, forma text
  ) on commit drop;
  truncate pg_temp.tmp_publicacao_vinculo;
  insert into pg_temp.tmp_publicacao_vinculo
  select (x.valor ->> 'candidato_id')::uuid, (x.valor ->> 'analise_id')::uuid,
         upper(coalesce(nullif(btrim(x.valor ->> 'forma'), ''), 'MANUAL'))
    from jsonb_array_elements(v_vinculos) x(valor);
  if exists (select 1 from pg_temp.tmp_publicacao_vinculo k
              where k.candidato_id is null or k.analise_id is null
                 or k.forma not in ('ANALISE', 'NOME', 'NOME_VAGA', 'MANUAL')) then
    raise exception 'Vínculo inválido.' using errcode = '22023';
  end if;
  if (select count(*) <> count(distinct k.candidato_id) or count(*) <> count(distinct k.analise_id)
        from pg_temp.tmp_publicacao_vinculo k) then
    raise exception 'Cada pessoa só pode ser vinculada uma vez.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.tmp_publicacao_vinculo k
              where not exists (select 1 from public."TB_CANDIDATO_APROVADO" o
                                 where o.id = k.candidato_id and o.lista_id = v_anterior.id and o.removido_em is null)) then
    raise exception 'Vínculo com candidato que não está na lista vigente.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.tmp_publicacao_vinculo k
              where not exists (select 1 from pg_temp.tmp_publicacao_novo n where n.analise_id = k.analise_id)) then
    raise exception 'Vínculo com candidato que não está no resultado final.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp.tmp_publicacao_vinculo k
               join public."TB_CANDIDATO_APROVADO" o on o.id = k.candidato_id
              where k.forma = 'ANALISE' and o."CO_ANALISE_CURRICULAR" is distinct from k.analise_id) then
    raise exception 'Vínculo pela análise com análise diferente.' using errcode = '22023';
  end if;

  -- O resumo, contra a lista vigente (a mesma conta de resumoDaPublicacao).
  select count(*) filter (where k.analise_id is null) into v_entra
    from pg_temp.tmp_publicacao_novo n
    left join pg_temp.tmp_publicacao_vinculo k on k.analise_id = n.analise_id;
  select count(*) filter (where not o.sub_judice),
         count(*) filter (where o.sub_judice),
         coalesce(jsonb_agg(jsonb_build_object(
           'candidato_id', o.id, 'nome', o.nome, 'cargo', o.cargo, 'codigo_vaga', o.codigo_vaga,
           'classificacao', o.classificacao, 'status', o.status, 'matricula', o.matricula,
           'processo_sei', o.processo_sei) order by o.cargo, o.classificacao nulls last, o.nome)
           filter (where not o.sub_judice
                     and (o.status is not null or nullif(btrim(coalesce(o.matricula, '')), '') is not null
                          or nullif(btrim(coalesce(o.processo_sei, '')), '') is not null)), '[]'::jsonb)
    into v_sai, v_mantido, v_pendencias
    from public."TB_CANDIDATO_APROVADO" o
   where o.lista_id = v_anterior.id and o.removido_em is null
     and not exists (select 1 from pg_temp.tmp_publicacao_vinculo k where k.candidato_id = o.id);
  select count(*) filter (where o.classificacao is distinct from n.posicao
                             or (nullif(btrim(coalesce(o.codigo_vaga, '')), '') is not null
                                 and lower(btrim(o.codigo_vaga)) <> lower(btrim(n.codigo_vaga)))),
         count(*) filter (where o.status is not null or o.sub_judice or o.alterado_judicialmente
                             or nullif(btrim(coalesce(o.matricula, '')), '') is not null
                             or nullif(btrim(coalesce(o.processo_sei, '')), '') is not null),
         coalesce(jsonb_agg(jsonb_build_object('anterior', o.id, 'analise_id', k.analise_id, 'forma', k.forma)
                            order by o.nome), '[]'::jsonb)
    into v_muda, v_preservado, v_aplicados
    from pg_temp.tmp_publicacao_vinculo k
    join public."TB_CANDIDATO_APROVADO" o on o.id = k.candidato_id
    join pg_temp.tmp_publicacao_novo n on n.analise_id = k.analise_id;

  -- A lista anterior sai de vigor (fica no histórico, inativa).
  select * into v_autor from private.autor_da_sessao();
  if v_anterior.id is not null then
    update public."TB_LISTA_APROVADO"
       set vigente = false, ativo = false, substituido_por = v_uid, substituido_em = now(), updated_at = now(),
           "DS_EMAIL_SUBSTITUICAO" = v_autor.email, "NO_USUARIO_SUBSTITUICAO" = v_autor.nome
     where id = v_anterior.id;
  end if;

  insert into public."TB_LISTA_APROVADO" (
    edital_id, ativo, vigente, arquivo_nome, arquivo_path, importado_por,
    "DS_EMAIL_IMPORTACAO", "NO_USUARIO_IMPORTACAO", "TP_ORIGEM", "CO_LISTA_CLASSIFICACAO"
  ) values (
    v_edital, true, true, 'Classificação — resultado final (regra v' || v_l."NU_VERSAO_REGRA" || ')', '',
    v_uid, v_autor.email, v_autor.nome, 'CLASSIFICACAO', p_lista_classificacao
  ) returning id into v_nova;

  -- Quem entra, com o que é da lista de aprovados de quem casou.
  insert into public."TB_CANDIDATO_APROVADO" (
    lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade,
    status, processo_sei, matricula, sub_judice, alterado_judicialmente,
    nota_original, modalidade_original, classificacao_original, sub_judice_original,
    "CO_ANALISE_CURRICULAR", "TP_SITUACAO_CLASSIFICACAO", "CO_CANDIDATO_ANTERIOR",
    created_by, updated_by
  )
  select v_nova, n.codigo_vaga, n.cargo, n.posicao,
         case when o.alterado_judicialmente then o.nota else n.nota end,
         n.nome,
         case when o.alterado_judicialmente then coalesce(o.modalidade, n.modalidade) else n.modalidade end,
         o.status, o.processo_sei, o.matricula,
         coalesce(o.sub_judice, false), coalesce(o.alterado_judicialmente, false),
         case when o.alterado_judicialmente then n.nota end,
         case when o.alterado_judicialmente then n.modalidade end,
         case when o.alterado_judicialmente then n.posicao end,
         case when o.alterado_judicialmente then false end,
         n.analise_id, n.situacao, o.id, v_uid, v_uid
    from pg_temp.tmp_publicacao_novo n
    left join pg_temp.tmp_publicacao_vinculo k on k.analise_id = n.analise_id
    left join public."TB_CANDIDATO_APROVADO" o on o.id = k.candidato_id
   order by n.vaga_ordem, n.posicao, n.nome;

  -- Incluídos por decisão judicial que não estão no resultado: continuam sub judice.
  insert into public."TB_CANDIDATO_APROVADO" (
    lista_id, codigo_vaga, cargo, classificacao, nota, nome, modalidade,
    status, processo_sei, matricula, sub_judice, alterado_judicialmente,
    nota_original, modalidade_original, classificacao_original, sub_judice_original,
    "CO_ANALISE_CURRICULAR", "CO_CANDIDATO_ANTERIOR", created_by, updated_by
  )
  select v_nova, o.codigo_vaga, o.cargo, null, o.nota, o.nome, o.modalidade,
         o.status, o.processo_sei, o.matricula, true, o.alterado_judicialmente,
         o.nota_original, o.modalidade_original, o.classificacao_original, o.sub_judice_original,
         o."CO_ANALISE_CURRICULAR", o.id, v_uid, v_uid
    from public."TB_CANDIDATO_APROVADO" o
   where o.lista_id = v_anterior.id and o.removido_em is null and o.sub_judice
     and not exists (select 1 from pg_temp.tmp_publicacao_vinculo k where k.candidato_id = o.id);

  -- Os anexos vão junto (cópia; os da lista anterior ficam onde estão).
  insert into public."TB_ANEXO_CANDIDATO_APROVADO" (
    "CO_CANDIDATO", "NO_ARQUIVO", "QT_TAMANHO_BYTES", "IM_ARQUIVO", "CO_USUARIO_INCLUSAO", "DT_INCLUSAO"
  )
  select c.id, x."NO_ARQUIVO", x."QT_TAMANHO_BYTES", x."IM_ARQUIVO", x."CO_USUARIO_INCLUSAO", x."DT_INCLUSAO"
    from public."TB_CANDIDATO_APROVADO" c
    join public."TB_ANEXO_CANDIDATO_APROVADO" x on x."CO_CANDIDATO" = c."CO_CANDIDATO_ANTERIOR"
   where c.lista_id = v_nova;

  -- Sub judice com nota da decisão ou incluído: recoloca pela nota, como a lista faz.
  for v_c in
    select c.id, coalesce(c.modalidade_original, c.modalidade) as modalidade_antes
      from public."TB_CANDIDATO_APROVADO" c
     where c.lista_id = v_nova
       and (c.alterado_judicialmente
            or (c."CO_CANDIDATO_ANTERIOR" is not null
                and not exists (select 1 from pg_temp.tmp_publicacao_vinculo k
                                 where k.candidato_id = c."CO_CANDIDATO_ANTERIOR")))
     order by c.nota desc, c.nome
  loop
    perform private."FC_RECOLOCAR_NA_CLASSIFICACAO"(v_c.id, v_c.modalidade_antes);
  end loop;

  select count(*) into v_qt from public."TB_CANDIDATO_APROVADO" c where c.lista_id = v_nova;

  insert into public."TH_PUBLICACAO_APROVADO" (
    "CO_MONITORAMENTO", "CO_LISTA_APROVADO", "CO_LISTA_APROVADO_ANTERIOR", "TP_ORIGEM",
    "CO_LISTA_CLASSIFICACAO", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA", "DS_HASH_CLASSIFICACAO",
    "QT_CANDIDATO", "QT_ENTRA", "QT_SAI", "QT_MUDA_POSICAO", "QT_PRESERVADO", "QT_SUB_JUDICE_MANTIDO",
    "DS_VINCULO", "DS_PENDENCIA", "CO_USUARIO", "DS_EMAIL_USUARIO", "NO_USUARIO"
  ) values (
    v_l."CO_MONITORAMENTO", v_nova, v_anterior.id, 'CLASSIFICACAO',
    p_lista_classificacao, v_l."CO_REGRA_CLASSIFICACAO", v_l."NU_VERSAO_REGRA", v_l."DS_HASH",
    v_qt, v_entra, coalesce(v_sai, 0), coalesce(v_muda, 0), coalesce(v_preservado, 0), coalesce(v_mantido, 0),
    (select coalesce(jsonb_agg(a.valor || jsonb_build_object('novo', c.id)), '[]'::jsonb)
       from jsonb_array_elements(v_aplicados) a(valor)
       join public."TB_CANDIDATO_APROVADO" c
         on c.lista_id = v_nova and c."CO_CANDIDATO_ANTERIOR" = (a.valor ->> 'anterior')::uuid),
    v_pendencias, v_uid, v_autor.email, v_autor.nome
  ) returning "CO_PUBLICACAO" into v_publicacao;

  -- O KPI de contratados do edital já com a lista nova (20261006070000).
  perform private."FC_ATUALIZAR_CONTRATADOS_DO_EDITAL"(v_l."CO_MONITORAMENTO");

  return json_build_object(
    'ok', true, 'lista_id', v_nova, 'publicacao_id', v_publicacao, 'lista_anterior', v_anterior.id,
    'candidatos', v_qt, 'entram', v_entra, 'saem', coalesce(v_sai, 0), 'mudam', coalesce(v_muda, 0),
    'preservados', coalesce(v_preservado, 0), 'sub_judice_mantidos', coalesce(v_mantido, 0),
    'pendencias', v_pendencias
  );
end;
$function$;

-- reabrir_ficha(uuid,integer,text) (1)
CREATE OR REPLACE FUNCTION public.reabrir_ficha(p_ficha uuid, p_versao integer, p_motivo text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_motivo text := btrim(coalesce(p_motivo, ''));
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  if v_f."CO_FICHA_ANALISE" is null then
    raise exception 'Ficha não encontrada' using errcode = '22023';
  end if;
  perform private."FC_EXIGIR_COORD_FICHAS"(v_f."CO_MONITORAMENTO");
  if v_f."TP_SITUACAO" <> 'CONCLUIDA' then
    raise exception 'Só a ficha concluída se reabre.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_f."NU_VERSAO" then
    raise exception 'Esta ficha mudou desde que você abriu; recarregue.' using errcode = 'PT409';
  end if;
  if length(v_motivo) not between 10 and 2000 then
    raise exception 'Informe o motivo para reabrir (10 a 2.000 caracteres).' using errcode = '22023';
  end if;
  update public."TB_FICHA_ANALISE" set
    "TP_SITUACAO" = 'EM_ANALISE',
    "CO_USUARIO_RESPONSAVEL" = coalesce("CO_USUARIO_RESPONSAVEL", "CO_USUARIO_CONCLUSAO"),
    "DT_ATRIBUICAO" = coalesce("DT_ATRIBUICAO", now()),
    "NU_VERSAO" = "NU_VERSAO" + 1, "DT_ATUALIZACAO" = now()
   where "CO_FICHA_ANALISE" = p_ficha;
  perform private."FC_HISTORICO_CONTEUDO_FICHA"(p_ficha, 'REABRIR', 'CONCLUIDA', v_motivo, v_uid, null, null);
  return json_build_object('versao', v_f."NU_VERSAO" + 1);
end;
$function$;

-- registrar_desempate_classificacao(uuid,jsonb) (1)
CREATE OR REPLACE FUNCTION public.registrar_desempate_classificacao(p_edital uuid, p_dados jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  v_tipo text := upper(coalesce(p_dados ->> 'tipo_lista', ''));
  v_vaga text := btrim(coalesce(p_dados ->> 'vaga', ''));
  v_metodo text := upper(coalesce(p_dados ->> 'metodo', ''));
  v_just text := nullif(btrim(coalesce(p_dados ->> 'justificativa', '')), '');
  v_refazer boolean := coalesce(p_dados ->> 'refazer', 'false') = 'true';
  v_numero text;
  v_ids text[];
  v_chave text;
  v_semente text;
  v_origem text;
  v_ordem jsonb;
  v_atual public."TB_DESEMPATE_CLASSIFICACAO";
  v_id uuid;
  v_uid uuid := (select auth.uid());
begin
  if v_tipo not in ('PRELIMINAR', 'FINAL') then
    raise exception 'Lista inválida (PRELIMINAR ou FINAL)' using errcode = '22023';
  end if;
  if v_metodo not in ('SORTEIO', 'MANUAL') then
    raise exception 'Método inválido (SORTEIO ou MANUAL)' using errcode = '22023';
  end if;
  if length(v_vaga) not between 1 and 60 then
    raise exception 'Vaga inválida' using errcode = '22023';
  end if;
  if jsonb_typeof(p_dados -> 'candidatos') is distinct from 'array' then
    raise exception 'Informe os candidatos empatados' using errcode = '22023';
  end if;
  select array_agg(x order by x collate "C") into v_ids
    from (select distinct jsonb_array_elements_text(p_dados -> 'candidatos') x) s;
  if coalesce(cardinality(v_ids), 0) not between 2 and 200 then
    raise exception 'O empate tem de 2 a 200 candidatos' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_ids) x where x !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'Candidato inválido' using errcode = '22023';
  end if;

  -- Os empatados são análises deste edital, desta área e desta vaga.
  select private."FC_NUMERO_EDITAL"(m.edital) into v_numero from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  if (select count(*) from public."TB_ANALISE_CURRICULAR" a
       where a.id = any (v_ids::uuid[]) and a."CO_AREA" = v_area and a.ativo
         and a.codigo_vaga = v_vaga and private."FC_NUMERO_EDITAL"(a.edital) = v_numero) <> cardinality(v_ids) then
    raise exception 'Há candidato fora deste edital ou desta vaga' using errcode = '22023';
  end if;

  v_chave := v_tipo || '|' || v_vaga || '|' || array_to_string(v_ids, ',');
  if p_dados ? 'chave' and p_dados ->> 'chave' is distinct from v_chave then
    raise exception 'O grupo de empate mudou; recarregue.' using errcode = 'PT409';
  end if;

  select * into v_atual from public."TB_DESEMPATE_CLASSIFICACAO"
   where "CO_MONITORAMENTO" = p_edital and "TP_LISTA" = v_tipo and "DS_CHAVE_GRUPO" = v_chave and "ST_ATIVO" = 'S'
   for update;

  if v_metodo = 'SORTEIO' then
    if v_atual."CO_DESEMPATE_CLASSIFICACAO" is not null and v_atual."TP_METODO" = 'SORTEIO' then
      if not v_refazer then
        raise exception 'Já há sorteio registrado para este empate.' using errcode = '23505';
      end if;
      if v_just is null or length(v_just) not between 10 and 2000 then
        raise exception 'Para refazer o sorteio, justifique (10 a 2.000 caracteres).' using errcode = '22023';
      end if;
    end if;
    v_semente := nullif(btrim(coalesce(p_dados ->> 'semente', '')), '');
    if v_semente is null then
      v_semente := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      v_origem := 'SERVIDOR';
    else
      if length(v_semente) not between 4 and 200 or v_semente ~ '[[:cntrl:]]' then
        raise exception 'Semente de 4 a 200 caracteres.' using errcode = '22023';
      end if;
      v_origem := 'INFORMADA';
    end if;
    select jsonb_agg(x order by encode(sha256(convert_to(v_semente || ':' || x, 'UTF8')), 'hex') collate "C")
      into v_ordem
      from unnest(v_ids) x;
  else
    if v_just is null or length(v_just) not between 10 and 2000 then
      raise exception 'A decisão manual exige justificativa (10 a 2.000 caracteres).' using errcode = '22023';
    end if;
    v_ordem := p_dados -> 'ordem';
    if jsonb_typeof(v_ordem) is distinct from 'array' or jsonb_array_length(v_ordem) <> cardinality(v_ids)
       or (select array_agg(x order by x collate "C") from jsonb_array_elements_text(v_ordem) x) is distinct from v_ids then
      raise exception 'A ordem tem de trazer cada empatado uma vez.' using errcode = '22023';
    end if;
  end if;

  if v_atual."CO_DESEMPATE_CLASSIFICACAO" is not null then
    update public."TB_DESEMPATE_CLASSIFICACAO"
       set "ST_ATIVO" = 'N', "DT_DESATIVACAO" = now(), "CO_USUARIO_DESATIVACAO" = v_uid
     where "CO_DESEMPATE_CLASSIFICACAO" = v_atual."CO_DESEMPATE_CLASSIFICACAO";
  end if;
  insert into public."TB_DESEMPATE_CLASSIFICACAO"
    ("CO_MONITORAMENTO", "TP_LISTA", "CO_VAGA", "DS_CHAVE_GRUPO", "TP_METODO", "DS_SEMENTE", "TP_ORIGEM_SEMENTE",
     "DS_ORDEM", "DS_JUSTIFICATIVA", "CO_USUARIO")
  values (p_edital, v_tipo, v_vaga, v_chave, v_metodo, v_semente, v_origem, v_ordem, v_just, v_uid)
  returning "CO_DESEMPATE_CLASSIFICACAO" into v_id;

  return private."FC_DESEMPATE_CLASSIFICACAO_JSON"(v_id);
end;
$function$;

-- registrar_lista_classificacao(uuid,text,integer,jsonb) (1)
CREATE OR REPLACE FUNCTION public.registrar_lista_classificacao(p_edital uuid, p_tipo text, p_versao integer, p_resultado jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_id uuid;
  v_totais jsonb := coalesce(p_resultado -> 'totais', '{}'::jsonb);
  v_qt integer[];
begin
  if p_tipo is null or p_tipo not in ('PRELIMINAR', 'CONVOCACAO', 'ENTREVISTA', 'FINAL') then
    raise exception 'Tipo de lista inválido' using errcode = '22023';
  end if;
  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    raise exception 'Salve a regra do edital antes de gerar a lista.' using errcode = '22023';
  end if;
  if p_versao is distinct from v_regra."NU_VERSAO_VIGENTE" then
    raise exception 'A regra mudou (versão %); gere de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = 'PT409';
  end if;
  if jsonb_typeof(p_resultado) is distinct from 'object' or jsonb_typeof(p_resultado -> 'vagas') is distinct from 'array'
     or p_resultado ->> 'tipo' is distinct from p_tipo then
    raise exception 'Lista inválida.' using errcode = '22023';
  end if;
  if pg_column_size(p_resultado) > 8000000 then
    raise exception 'Lista grande demais para registrar.' using errcode = '22023';
  end if;
  -- Os candidatos do retrato são análises ativas deste edital (20261006070000).
  perform private."FC_EXIGIR_CANDIDATOS_DO_EDITAL"(p_edital, p_resultado);
  select array_agg(case when jsonb_typeof(v_totais -> k) = 'number'
                        then greatest(0, least(1000000, (v_totais ->> k)::numeric))::integer else 0 end order by o)
    into v_qt
    from unnest(array['elegiveis', 'eliminados', 'avisos', 'pendencias']) with ordinality t(k, o);

  insert into public."TB_LISTA_CLASSIFICACAO"
    ("CO_MONITORAMENTO", "TP_LISTA", "CO_REGRA_CLASSIFICACAO", "NU_VERSAO_REGRA", "DS_RESULTADO", "DS_HASH",
     "QT_ELEGIVEL", "QT_ELIMINADO", "QT_AVISO", "QT_PENDENCIA", "CO_USUARIO")
  values (p_edital, p_tipo, v_regra."CO_REGRA_CLASSIFICACAO", v_regra."NU_VERSAO_VIGENTE", p_resultado,
          encode(sha256(convert_to(p_resultado::text, 'UTF8')), 'hex'),
          v_qt[1], v_qt[2], v_qt[3], v_qt[4], (select auth.uid()))
  returning "CO_LISTA_CLASSIFICACAO" into v_id;

  return private."FC_LISTA_CLASSIFICACAO_JSON"(v_id);
end;
$function$;

-- renovar_reserva(uuid) (1)
CREATE OR REPLACE FUNCTION public.renovar_reserva(p_ficha uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_f public."TB_FICHA_ANALISE";
  v_uid uuid := (select auth.uid());
  v_area text;
begin
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha;
  if v_f."CO_FICHA_ANALISE" is null then
    raise exception 'Ficha não encontrada' using errcode = '22023';
  end if;
  v_area := private."FC_EXIGIR_AVALIACAO_EDITAL"(v_f."CO_MONITORAMENTO", 2);
  select * into v_f from public."TB_FICHA_ANALISE" where "CO_FICHA_ANALISE" = p_ficha for update;
  if v_f."CO_USUARIO_RESERVA" = v_uid and v_f."DT_RESERVA_EXPIRA" > now() then
    -- Renovar não muda a versão nem vai ao histórico.
    update public."TB_FICHA_ANALISE" set "DT_RESERVA_EXPIRA" = now() + private."FC_PRAZO_RESERVA_FICHA"()
     where "CO_FICHA_ANALISE" = p_ficha;
  elsif (v_f."DT_RESERVA_EXPIRA" is null or v_f."DT_RESERVA_EXPIRA" <= now())
        and v_f."CO_USUARIO_RESPONSAVEL" = v_uid and v_f."TP_SITUACAO" in ('PENDENTE', 'EM_ANALISE')
        and private."FC_PODE_ANALISAR_VAGA"(v_f."CO_MONITORAMENTO", v_uid, v_f."CO_VAGA") then
    perform private."FC_RESERVAR_FICHA"(p_ficha, v_uid, 'RESERVAR');
  else
    raise exception 'A ficha não está mais com você (reserva liberada ou com outra pessoa); abra de novo.' using errcode = 'PT409';
  end if;
  return json_build_object('ficha', private."FC_FICHA_ANALISE_JSON"(p_ficha));
end;
$function$;

-- salvar_agenda_entrevista(uuid,jsonb) (2)
CREATE OR REPLACE FUNCTION public.salvar_agenda_entrevista(p_edital uuid, p_dados jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_AGENDA_ENTREVISTA"(p_edital, 2);
  v_acao text := upper(coalesce(p_dados ->> 'acao', ''));
  v_itens jsonb := coalesce(p_dados -> 'itens', '[]'::jsonb);
  v_motivo text := nullif(btrim(coalesce(p_dados ->> 'motivo', '')), '');
  v_lista uuid;
  v_regra public."TB_REGRA_AGENDA_ENTREVISTA";
  v_numero text;
  v_ultimo uuid;
  v_n integer;
  v_alteracoes jsonb;
  v_qt_alteracao integer;
  v_uid uuid := (select auth.uid());
  v_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_hora constant text := '^([01][0-9]|2[0-3]):[0-5][0-9]$';
begin
  if v_acao not in ('GERAR', 'AJUSTAR', 'LIMPAR') then
    raise exception 'Ação inválida (GERAR, AJUSTAR ou LIMPAR).' using errcode = '22023';
  end if;
  if jsonb_typeof(v_itens) is distinct from 'array' or jsonb_array_length(v_itens) > 3000 then
    raise exception 'Agenda inválida (até 3.000 horários).' using errcode = '22023';
  end if;
  if v_acao = 'LIMPAR' and jsonb_array_length(v_itens) > 0 then
    raise exception 'Limpar não leva horários.' using errcode = '22023';
  end if;
  if v_motivo is not null and length(v_motivo) not between 3 and 500 then
    raise exception 'Motivo entre 3 e 500 caracteres.' using errcode = '22023';
  end if;

  -- Uma gravação por vez no edital; a tela tem de estar na última.
  perform pg_advisory_xact_lock(hashtextextended('agenda_entrevista:' || p_edital::text, 0));
  select h."CO_HISTORICO_AGENDA" into v_ultimo from public."TH_AGENDA_ENTREVISTA" h
   where h."CO_MONITORAMENTO" = p_edital
   order by h."DT_REGISTRO" desc, h."CO_HISTORICO_AGENDA" limit 1;
  if nullif(p_dados ->> 'ultimo_registro', '') is distinct from v_ultimo::text then
    raise exception 'A agenda mudou desde que você abriu; recarregue.' using errcode = 'PT409';
  end if;

  select * into v_regra from public."TB_REGRA_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = p_edital;
  if v_acao <> 'LIMPAR' then
    if v_regra."CO_REGRA_AGENDA" is null then
      raise exception 'Salve a regra da agenda antes de gerar.' using errcode = '22023';
    end if;
    if (p_dados ->> 'versao_regra') is distinct from v_regra."NU_VERSAO_VIGENTE"::text then
      raise exception 'A regra da agenda mudou (versão %); gere de novo.', v_regra."NU_VERSAO_VIGENTE" using errcode = 'PT409';
    end if;
  end if;

  if nullif(p_dados ->> 'lista', '') is not null then
    if p_dados ->> 'lista' !~ v_uuid then
      raise exception 'Lista de convocação inválida.' using errcode = '22023';
    end if;
    v_lista := (p_dados ->> 'lista')::uuid;
    if not exists (select 1 from public."TB_LISTA_CLASSIFICACAO" l
                    where l."CO_LISTA_CLASSIFICACAO" = v_lista and l."CO_MONITORAMENTO" = p_edital
                      and l."TP_LISTA" = 'CONVOCACAO') then
      raise exception 'A lista não é uma convocação deste edital.' using errcode = '22023';
    end if;
  end if;

  -- Cada horário: análise, dia, início e fim (HH:MM, Brasília), banca e origem.
  if exists (select 1 from jsonb_array_elements(v_itens) e
              where case
                      when jsonb_typeof(e) <> 'object'
                        or coalesce(e ->> 'analise', '') !~ v_uuid
                        or coalesce(e ->> 'data', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
                        or coalesce(e ->> 'inicio', '') !~ v_hora
                        or coalesce(e ->> 'fim', '') !~ v_hora
                        or coalesce(e ->> 'banca', '') !~ '^[0-9]{1,2}$'
                        or coalesce(e ->> 'origem', 'GERADA') not in ('GERADA', 'MANUAL') then true
                      else (e ->> 'banca')::integer not between 1 and 20
                        or (e ->> 'inicio')::time >= (e ->> 'fim')::time
                    end) then
    raise exception 'Horário inválido: análise, dia (AAAA-MM-DD), início antes do fim (HH:MM) e banca de 1 a 20.' using errcode = '22023';
  end if;
  begin
    perform (e ->> 'data')::date from jsonb_array_elements(v_itens) e;
  exception when others then
    raise exception 'Horário com dia inválido.' using errcode = '22023';
  end;

  create temporary table "TM_AGENDA_NOVA" on commit drop as
  select (e ->> 'analise')::uuid as analise, (e ->> 'data')::date as data,
         (e ->> 'inicio')::time as inicio, (e ->> 'fim')::time as fim,
         (e ->> 'banca')::smallint as banca, coalesce(e ->> 'origem', 'GERADA') as origem
    from jsonb_array_elements(v_itens) e;

  if (select count(*) from pg_temp."TM_AGENDA_NOVA") <> (select count(distinct analise) from pg_temp."TM_AGENDA_NOVA") then
    raise exception 'Candidato repetido na agenda.' using errcode = '22023';
  end if;
  if exists (select 1 from pg_temp."TM_AGENDA_NOVA" a join pg_temp."TM_AGENDA_NOVA" b
               on a.data = b.data and a.banca = b.banca and a.analise < b.analise
              and a.inicio < b.fim and b.inicio < a.fim) then
    raise exception 'Conflito: dois candidatos na mesma banca com horários que se sobrepõem.' using errcode = '22023';
  end if;

  -- Os candidatos são análises ativas deste edital e desta área.
  select private."FC_NUMERO_EDITAL"(m.edital) into v_numero from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital;
  select count(*) into v_n
    from pg_temp."TM_AGENDA_NOVA" t
    join public."TB_ANALISE_CURRICULAR" a on a.id = t.analise
   where a."CO_AREA" = v_area and a.ativo and private."FC_NUMERO_EDITAL"(a.edital) = v_numero;
  if v_n <> (select count(*) from pg_temp."TM_AGENDA_NOVA") then
    raise exception 'Há candidato fora deste edital.' using errcode = '22023';
  end if;

  -- O que mudou: entrou, saiu ou trocou de dia, hora ou banca.
  with antes as (
    select g."CO_ANALISE_CURRICULAR" as analise, g."DT_ENTREVISTA" as data, g."HR_INICIO" as inicio,
           g."HR_FIM" as fim, g."NU_BANCA" as banca
      from public."TB_AGENDA_ENTREVISTA" g where g."CO_MONITORAMENTO" = p_edital
  ),
  mudou as (
    select coalesce(n.analise, a.analise) as analise,
           case when a.analise is null then null else json_build_object(
             'data', a.data, 'inicio', to_char(a.inicio, 'HH24:MI'), 'fim', to_char(a.fim, 'HH24:MI'), 'banca', a.banca) end as antes,
           case when n.analise is null then null else json_build_object(
             'data', n.data, 'inicio', to_char(n.inicio, 'HH24:MI'), 'fim', to_char(n.fim, 'HH24:MI'), 'banca', n.banca) end as depois
      from pg_temp."TM_AGENDA_NOVA" n
      full join antes a on a.analise = n.analise
     where a.analise is null or n.analise is null
        or (a.data, a.inicio, a.fim, a.banca) is distinct from (n.data, n.inicio, n.fim, n.banca)
  )
  select count(*)::integer,
         coalesce((select jsonb_agg(jsonb_build_object('analise', x.analise, 'nome', an.candidato,
                                                       'antes', x.antes, 'depois', x.depois))
                     from (select * from mudou order by analise limit 500) x
                     left join public."TB_ANALISE_CURRICULAR" an on an.id = x.analise), '[]'::jsonb)
    into v_qt_alteracao, v_alteracoes
    from mudou;

  delete from public."TB_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = p_edital;
  insert into public."TB_AGENDA_ENTREVISTA"
    ("CO_MONITORAMENTO", "CO_ANALISE_CURRICULAR", "DT_ENTREVISTA", "HR_INICIO", "HR_FIM", "NU_BANCA",
     "TP_ORIGEM", "NU_VERSAO_REGRA", "CO_LISTA_CLASSIFICACAO", "CO_USUARIO_ATUALIZACAO")
  select p_edital, t.analise, t.data, t.inicio, t.fim, t.banca, t.origem, v_regra."NU_VERSAO_VIGENTE", v_lista, v_uid
    from pg_temp."TM_AGENDA_NOVA" t;

  insert into public."TH_AGENDA_ENTREVISTA"
    ("CO_MONITORAMENTO", "TP_ACAO", "NU_VERSAO_REGRA", "CO_LISTA_CLASSIFICACAO", "QT_ITEM", "QT_ALTERACAO",
     "DS_ALTERACAO", "DS_MOTIVO", "CO_USUARIO")
  values (p_edital, v_acao, v_regra."NU_VERSAO_VIGENTE", v_lista, (select count(*) from pg_temp."TM_AGENDA_NOVA"),
          v_qt_alteracao, v_alteracoes, v_motivo, v_uid);

  drop table pg_temp."TM_AGENDA_NOVA";
  return private."FC_AGENDA_ENTREVISTA_JSON"(p_edital);
end;
$function$;

-- salvar_coordenacao(jsonb,text) (2)
CREATE OR REPLACE FUNCTION public.salvar_coordenacao(p_coordenacao jsonb, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_codigo text := lower(btrim(coalesce(p_coordenacao ->> 'codigo', '')));
  v_nome text := btrim(coalesce(p_coordenacao ->> 'nome', ''));
  v_area text := btrim(coalesce(p_coordenacao ->> 'area', ''));
  v_responsavel text := nullif(upper(btrim(coalesce(p_coordenacao ->> 'responsavel', ''))), '');
  v_ativo boolean := coalesce((p_coordenacao ->> 'ativo')::boolean, true);
  v_atual public."TB_COORDENACAO";
  v_antes jsonb;
  v_unidade text;
  v_edital text;
begin
  if not private.is_master() then raise exception 'Somente administradores gerenciam coordenações' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then raise exception 'Informe um motivo entre 3 e 500 caracteres'; end if;
  if v_codigo !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Código inválido: use letras minúsculas, números e hífen'; end if;
  if length(v_nome) not between 2 and 120 then raise exception 'Informe um nome entre 2 e 120 caracteres'; end if;
  if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then raise exception 'Área inválida'; end if;
  if v_responsavel is not null and v_responsavel not in ('USI', 'CORES') then raise exception 'Responsável inválido'; end if;
  if jsonb_typeof(coalesce(p_coordenacao -> 'unidades', '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_coordenacao -> 'editais', '[]'::jsonb)) <> 'array' then
    raise exception 'Unidades e editais devem ser listas';
  end if;

  perform pg_advisory_xact_lock(73923124155);
  select * into v_atual from public."TB_COORDENACAO" where "CO_COORDENACAO" = v_codigo for update;
  if v_atual."CO_COORDENACAO" is not null then
    if (p_coordenacao ->> 'revisao') is null or (p_coordenacao ->> 'revisao')::integer <> v_atual."NU_REVISAO" then
      raise exception 'Coordenação alterada por outra pessoa. Recarregue.' using errcode = 'PT409';
    end if;
    if not v_ativo and exists (select 1 from public."TB_PERFIL_USUARIO" u where u."CO_COORDENACAO" = v_codigo and u.ativo) then
      raise exception 'Há usuários nesta coordenação. Mude-os de coordenação antes de desativar.';
    end if;
    v_antes := private."FC_COORDENACAO_JSON"(v_codigo);
    update public."TB_COORDENACAO"
       set "NO_COORDENACAO" = v_nome, "CO_AREA" = v_area, "TP_RESPONSAVEL" = v_responsavel, "ST_ATIVO" = v_ativo,
           "NU_REVISAO" = "NU_REVISAO" + 1, "DT_ATUALIZACAO" = now()
     where "CO_COORDENACAO" = v_codigo;
  else
    if (p_coordenacao ->> 'revisao') is not null then raise exception 'Coordenação não encontrada. Recarregue.' using errcode = 'PT409'; end if;
    insert into public."TB_COORDENACAO" ("CO_COORDENACAO", "NO_COORDENACAO", "CO_AREA", "TP_RESPONSAVEL", "ST_ATIVO")
    values (v_codigo, v_nome, v_area, v_responsavel, v_ativo);
  end if;

  delete from public."RL_COORDENACAO_UNIDADE" where "CO_COORDENACAO" = v_codigo;
  for v_unidade in select distinct btrim(value) from jsonb_array_elements_text(coalesce(p_coordenacao -> 'unidades', '[]'::jsonb)) where btrim(value) <> '' loop
    if private."FC_AREA_DA_UNIDADE"(v_unidade) is distinct from v_area then
      raise exception 'A unidade % não é da área escolhida', v_unidade;
    end if;
    insert into public."RL_COORDENACAO_UNIDADE" ("CO_COORDENACAO", "NO_UNIDADE") values (v_codigo, v_unidade);
  end loop;

  delete from public."RL_COORDENACAO_EDITAL" where "CO_COORDENACAO" = v_codigo;
  for v_edital in select distinct value from jsonb_array_elements_text(coalesce(p_coordenacao -> 'editais', '[]'::jsonb)) loop
    if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id::text = v_edital and m."CO_AREA" = v_area) then
      raise exception 'Edital % não encontrado nesta área', v_edital;
    end if;
    insert into public."RL_COORDENACAO_EDITAL" ("CO_COORDENACAO", "CO_EDITAL") values (v_codigo, v_edital::uuid);
  end loop;

  insert into public."TH_COORDENACAO" ("CO_COORDENACAO", "JS_ANTES", "JS_DEPOIS", "CO_ALTERADO_POR", "DS_MOTIVO")
  values (v_codigo, v_antes, private."FC_COORDENACAO_JSON"(v_codigo), (select auth.uid()), btrim(p_motivo));
  return private."FC_COORDENACAO_JSON"(v_codigo);
end;
$function$;

-- salvar_grupo_acesso(jsonb,text) (2)
CREATE OR REPLACE FUNCTION public.salvar_grupo_acesso(p_grupo jsonb, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_codigo text := lower(btrim(coalesce(p_grupo ->> 'codigo', '')));
  v_nome text := btrim(coalesce(p_grupo ->> 'nome', ''));
  v_niveis jsonb := coalesce(p_grupo -> 'niveis', '{}'::jsonb);
  v_atual public."TB_GRUPO_ACESSO";
  v_antes jsonb;
  v_recurso text;
  v_nivel text;
begin
  if not private.is_master() then raise exception 'Somente administradores gerenciam grupos' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then raise exception 'Informe um motivo entre 3 e 500 caracteres'; end if;
  if v_codigo !~ '^[a-z]+(_[a-z]+)*$' then raise exception 'Código inválido: use letras minúsculas e _'; end if;
  if length(v_nome) not between 2 and 80 then raise exception 'Informe um nome entre 2 e 80 caracteres'; end if;
  if jsonb_typeof(v_niveis) <> 'object' then raise exception 'Níveis inválidos'; end if;

  perform pg_advisory_xact_lock(73923124154);
  select * into v_atual from public."TB_GRUPO_ACESSO" where "CO_GRUPO_ACESSO" = v_codigo for update;
  if v_atual."CO_GRUPO_ACESSO" is not null then
    if v_atual."ST_ADMIN_GLOBAL" then raise exception 'O grupo de administrador global não é editável'; end if;
    if (p_grupo ->> 'revisao') is null or (p_grupo ->> 'revisao')::integer <> v_atual."NU_REVISAO" then
      raise exception 'Grupo alterado por outra pessoa. Recarregue.' using errcode = 'PT409';
    end if;
    v_antes := private."FC_GRUPO_ACESSO_JSON"(v_codigo);
    update public."TB_GRUPO_ACESSO"
       set "NO_GRUPO_ACESSO" = v_nome,
           "DS_GRUPO_ACESSO" = nullif(btrim(coalesce(p_grupo ->> 'descricao', '')), ''),
           "NU_ORDEM" = coalesce((p_grupo ->> 'ordem')::smallint, "NU_ORDEM"),
           "NU_REVISAO" = "NU_REVISAO" + 1,
           "DT_ATUALIZACAO" = now()
     where "CO_GRUPO_ACESSO" = v_codigo;
  else
    if (p_grupo ->> 'revisao') is not null then raise exception 'Grupo não encontrado. Recarregue.' using errcode = 'PT409'; end if;
    insert into public."TB_GRUPO_ACESSO" ("CO_GRUPO_ACESSO", "NO_GRUPO_ACESSO", "DS_GRUPO_ACESSO", "NU_ORDEM")
    values (v_codigo, v_nome, nullif(btrim(coalesce(p_grupo ->> 'descricao', '')), ''), coalesce((p_grupo ->> 'ordem')::smallint, 100));
  end if;

  -- Todo módulo tem nível no grupo; o que não veio fica sem acesso.
  delete from public."TA_GRUPO_ACESSO_RECURSO" where "CO_GRUPO_ACESSO" = v_codigo;
  foreach v_recurso in array private."FC_RECURSOS_MODULO"() loop
    v_nivel := coalesce(v_niveis ->> v_recurso, 'sem_acesso');
    insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL") values (v_codigo, v_recurso, v_nivel);
  end loop;

  insert into public."TH_GRUPO_ACESSO" ("CO_GRUPO_ACESSO", "JS_ANTES", "JS_DEPOIS", "CO_ALTERADO_POR", "DS_MOTIVO")
  values (v_codigo, v_antes, private."FC_GRUPO_ACESSO_JSON"(v_codigo), (select auth.uid()), btrim(p_motivo));
  return private."FC_GRUPO_ACESSO_JSON"(v_codigo);
end;
$function$;

-- salvar_matriz_acessos(jsonb,text) (3)
CREATE OR REPLACE FUNCTION public.salvar_matriz_acessos(p_alteracoes jsonb, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
  item jsonb; alvo public."TB_PERFIL_USUARIO"; v_tipo text; v_sem_area text;
  anterior text; revisao_atual integer; recurso_atual text; novo text; v_nivel_grupo text;
  quantidade integer := 0;
begin
  if jsonb_typeof(p_alteracoes) is distinct from 'array' or jsonb_array_length(p_alteracoes) not between 1 and 500 then raise exception 'Alterações inválidas'; end if;
  if length(btrim(coalesce(p_motivo, ''))) not between 3 and 500 then raise exception 'Informe um motivo entre 3 e 500 caracteres'; end if;
  -- Serializa inserções de linhas ausentes e updates; a revisão evita perda de alteração.
  perform pg_advisory_xact_lock(73923124153);
  for item in select value from jsonb_array_elements(p_alteracoes) loop
    select * into alvo from public."TB_PERFIL_USUARIO" where id = (item ->> 'usuario_id')::uuid and ativo for update;
    perform private."FC_EXIGIR_GESTAO_DO_USUARIO"(alvo);
    v_tipo := coalesce(item ->> 'tipo', 'nivel');

    -- Grupo de acesso ----------------------------------------------------------
    if v_tipo = 'grupo' then
      novo := item ->> 'grupo';
      if not exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = novo) then raise exception 'Grupo inválido'; end if;
      if item ->> 'revisao' is distinct from alvo.updated_at::text and alvo.updated_at <> now() then
        raise exception 'Conta alterada por outra pessoa. Recarregue a matriz.' using errcode = 'PT409';
      end if;
      if not private."FC_GRUPO_CABE_NO_TETO"(novo) then
        raise exception 'O grupo % dá mais acesso do que você tem', novo using errcode = '42501';
      end if;
      if alvo.perfil = novo then continue; end if;
      anterior := alvo.perfil;
      update public."TB_PERFIL_USUARIO"
         set perfil = novo,
             "CO_COORDENACAO" = case when exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = novo and a."ST_ADMIN_GLOBAL")
                                     then null else "CO_COORDENACAO" end,
             p_config = exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = novo and a."ST_ADMIN_GLOBAL"),
             p_admin = exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = novo and a."ST_ADMIN_GLOBAL"),
             updated_at = now()
       where id = alvo.id;
      insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
      values (alvo.id, '#grupo', anterior, novo, (select auth.uid()), btrim(p_motivo));
      quantidade := quantidade + 1;
      continue;
    end if;

    -- Coordenação (só admin) --------------------------------------------------------
    if v_tipo = 'coordenacao' then
      if v_gestor <> 'admin' then raise exception 'Só o administrador muda a coordenação de alguém' using errcode = '42501'; end if;
      novo := nullif(btrim(coalesce(item ->> 'coordenacao', '')), '');
      if item ->> 'revisao' is distinct from alvo.updated_at::text and alvo.updated_at <> now() then
        raise exception 'Conta alterada por outra pessoa. Recarregue a matriz.' using errcode = 'PT409';
      end if;
      if novo is not null and not exists (select 1 from public."TB_COORDENACAO" c where c."CO_COORDENACAO" = novo and c."ST_ATIVO") then
        raise exception 'Coordenação inválida ou desativada';
      end if;
      if novo is not null and exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = alvo.perfil and a."ST_ADMIN_GLOBAL") then
        raise exception 'Administrador global não fica em coordenação';
      end if;
      if alvo."CO_COORDENACAO" is not distinct from novo then continue; end if;
      anterior := coalesce(alvo."CO_COORDENACAO", '(sem coordenação)');
      update public."TB_PERFIL_USUARIO" set "CO_COORDENACAO" = novo, updated_at = now() where id = alvo.id;
      insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
      values (alvo.id, '#coordenacao', anterior, coalesce(novo, '(sem coordenação)'), (select auth.uid()), btrim(p_motivo));
      quantidade := quantidade + 1;
      continue;
    end if;

    if v_tipo <> 'nivel' then raise exception 'Tipo de alteração inválido'; end if;
    recurso_atual := item ->> 'recurso';
    novo := item ->> 'nivel';

    -- Área (só admin) ---------------------------------------------------------------
    if recurso_atual like 'area:%' then
      if v_gestor <> 'admin' then raise exception 'Só o administrador muda as áreas de alguém' using errcode = '42501'; end if;
      if not exists (select 1 from public."TB_AREA" a where 'area:' || a."CO_AREA" = recurso_atual) then raise exception 'Área inválida'; end if;
      if novo is null or novo not in ('sem_acesso', 'leitor') then raise exception 'Área aceita apenas Sim ou Não'; end if;
      if exists (select 1 from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = alvo.perfil and a."ST_ADMIN_GLOBAL") then
        raise exception 'Administrador já vê todas as áreas';
      end if;
      anterior := case when exists (select 1 from public."RL_PERFIL_USUARIO_AREA" x
                                     where x."CO_PERFIL_USUARIO" = alvo.id and 'area:' || x."CO_AREA" = recurso_atual)
                       then 'leitor' else 'sem_acesso' end;
      if anterior = novo then continue; end if;
      if novo = 'leitor' then
        insert into public."RL_PERFIL_USUARIO_AREA"("CO_PERFIL_USUARIO", "CO_AREA") values (alvo.id, substr(recurso_atual, 6));
      else
        delete from public."RL_PERFIL_USUARIO_AREA" where "CO_PERFIL_USUARIO" = alvo.id and "CO_AREA" = substr(recurso_atual, 6);
      end if;
      insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
      values (alvo.id, recurso_atual, anterior, novo, (select auth.uid()), btrim(p_motivo));
      quantidade := quantidade + 1;
      continue;
    end if;

    -- Módulo ou painel ------------------------------------------------------------------
    if recurso_atual is null or (recurso_atual <> all (private."FC_RECURSOS_MODULO"())
        and not exists (select 1 from public."TB_PAINEL_EXTERNO" where 'painel:' || id = recurso_atual and ativo)) then
      raise exception 'Recurso inválido';
    end if;
    if novo is not null and novo not in ('sem_acesso', 'leitor', 'editor', 'admin') then raise exception 'Nível inválido'; end if;
    if recurso_atual = 'configuracoes' and novo = 'leitor' then raise exception 'Configurações exige Editor ou Administrador'; end if;
    if recurso_atual = 'acessos' and novo not in ('sem_acesso', 'editor') then raise exception 'Acessos aceita Sem acesso ou Editor'; end if;
    if recurso_atual like 'painel:%' and novo not in ('sem_acesso', 'leitor') then raise exception 'Painel externo permite apenas acesso de leitura no portal'; end if;

    select g.nivel, g.revisao into anterior, revisao_atual
      from public."TB_PERMISSAO_RECURSO" g where g.perfil_usuario_id = alvo.id and g.recurso = recurso_atual;
    if item ->> 'revisao' is null or coalesce(revisao_atual, 0) <> (item ->> 'revisao')::integer then
      raise exception 'Permissão alterada por outra pessoa. Recarregue a matriz.' using errcode = 'PT409';
    end if;
    v_nivel_grupo := private."FC_NIVEL_DO_GRUPO"(alvo.perfil, recurso_atual);

    -- Administrador global segue o grupo: uma exceção de módulo nele (ex.: um
    -- select que mostrou "Leitor" por engano) o rebaixaria sem ninguém perceber.
    -- Para mudar um administrador, troca-se o grupo, de forma explícita.
    if novo is not null and novo is distinct from v_nivel_grupo
       and exists (select 1 from public."TB_GRUPO_ACESSO" a
                    where a."CO_GRUPO_ACESSO" = alvo.perfil and a."ST_ADMIN_GLOBAL") then
      raise exception 'Administrador global segue o grupo: para mudar o acesso de %, troque o grupo da pessoa.', coalesce(alvo.email, 'esta pessoa')
        using errcode = '42501';
    end if;

    -- Teto do coordenador: o nível resultante (exceção ou padrão do grupo).
    if v_gestor = 'coordenador' then
      if recurso_atual = 'acessos' then raise exception 'Só o administrador concede Acessos' using errcode = '42501'; end if;
      if private."FC_RANK_NIVEL"(coalesce(novo, v_nivel_grupo)) > private."FC_RANK_NIVEL"(private."FC_TETO_DO_GESTOR"(recurso_atual)) then
        raise exception 'Você não pode conceder mais do que o seu próprio nível em %', recurso_atual using errcode = '42501';
      end if;
    end if;

    if novo is null then
      -- Voltar ao padrão do grupo: apaga a exceção.
      if anterior is null then continue; end if;
      delete from public."TB_PERMISSAO_RECURSO" where perfil_usuario_id = alvo.id and recurso = recurso_atual;
      insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
      values (alvo.id, recurso_atual, anterior, v_nivel_grupo, (select auth.uid()), btrim(p_motivo) || ' [padrão do grupo]');
      quantidade := quantidade + 1;
      continue;
    end if;

    if anterior is not distinct from novo then continue; end if;
    insert into public."TB_PERMISSAO_RECURSO" (perfil_usuario_id, recurso, nivel, updated_by) values (alvo.id, recurso_atual, novo, (select auth.uid()))
    on conflict (perfil_usuario_id, recurso) do update
      set nivel = excluded.nivel, revisao = "TB_PERMISSAO_RECURSO".revisao + 1, updated_at = now(), updated_by = excluded.updated_by;
    insert into public."TH_PERMISSAO_RECURSO"(perfil_usuario_id, recurso, nivel_anterior, nivel_novo, alterado_por, motivo)
    values (alvo.id, recurso_atual, coalesce(anterior, v_nivel_grupo), novo, (select auth.uid()), btrim(p_motivo));
    quantidade := quantidade + 1;
  end loop;

  -- Ninguém ativo termina o lote sem área: quem não é administrador global só
  -- vê as áreas marcadas (ou a da coordenação). Em 30/09 uma conta saiu de
  -- Administrador para Usuário sem área e entrou num sistema vazio.
  for v_sem_area in
    select coalesce(nullif(btrim(u.nome), ''), u.email)
      from public."TB_PERFIL_USUARIO" u
     where u.ativo
       and u.id in (select (x ->> 'usuario_id')::uuid from jsonb_array_elements(p_alteracoes) x
                     where x ->> 'usuario_id' is not null)
       and cardinality(coalesce(private."FC_AREAS_DO_PERFIL"(u.id), '{}')) = 0
  loop
    raise exception '% ficaria sem nenhuma área e não veria nada no sistema. Marque ao menos uma área (ou uma coordenação) junto com a troca de grupo.', v_sem_area
      using errcode = '23514';
  end loop;

  -- Quem gerencia acessos sem ser administrador global precisa de coordenação:
  -- o coordenador só gerencia a própria. Sem ela, o menu mostrava Acessos e o
  -- banco recusava a leitura (42501) — 30/09.
  for v_sem_area in
    select coalesce(nullif(btrim(u.nome), ''), u.email)
      from public."TB_PERFIL_USUARIO" u
      join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = u.perfil
     where u.ativo
       and not g."ST_ADMIN_GLOBAL"
       and u."CO_COORDENACAO" is null
       and u.id in (select (x ->> 'usuario_id')::uuid from jsonb_array_elements(p_alteracoes) x
                     where x ->> 'usuario_id' is not null)
       and private."FC_RANK_NIVEL"(private."FC_NIVEL_EFETIVO"(u.id, u.perfil, 'acessos')) >= private."FC_RANK_NIVEL"('editor')
  loop
    raise exception '% gerenciaria acessos sem coordenação. Escolha a coordenação dela (o coordenador gerencia só a própria) ou use outro grupo.', v_sem_area
      using errcode = '23514';
  end loop;

  return jsonb_build_object('alteradas', quantidade);
end;
$function$;

-- salvar_modelo_carta_convocacao(uuid,text,uuid,jsonb,integer,text) (1)
CREATE OR REPLACE FUNCTION public.salvar_modelo_carta_convocacao(p_modelo uuid, p_area text, p_edital uuid, p_conteudo jsonb, p_versao_atual integer DEFAULT NULL::integer, p_motivo text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_modelo public."TB_MODELO_CARTA_CONVOCACAO";
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_nome text := btrim(coalesce(p_conteudo ->> 'nome', ''));
  v_titulo text := btrim(coalesce(p_conteudo ->> 'titulo', ''));
  v_texto text := btrim(coalesce(p_conteudo ->> 'texto', ''));
  v_local text := nullif(btrim(coalesce(p_conteudo ->> 'local', '')), '');
  v_documentos text := nullif(btrim(coalesce(p_conteudo ->> 'documentos', '')), '');
  v_contato text := nullif(btrim(coalesce(p_conteudo ->> 'contato', '')), '');
  v_prazo integer;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_versao integer;
  v_autor record;
begin
  if not private.pode_recurso('aprovados', 2) then
    raise exception 'Sem permissão para editar os modelos da carta' using errcode = '42501';
  end if;
  if jsonb_typeof(p_conteudo) is distinct from 'object' then
    raise exception 'Conteúdo do modelo inválido.' using errcode = '22023';
  end if;
  if length(v_nome) not between 3 and 120 then
    raise exception 'O nome do modelo deve ter de 3 a 120 caracteres.' using errcode = '22023';
  end if;
  if length(v_titulo) not between 1 and 300 then
    raise exception 'O título deve ter de 1 a 300 caracteres.' using errcode = '22023';
  end if;
  if length(v_texto) not between 1 and 20000 then
    raise exception 'O texto da carta deve ter de 1 a 20.000 caracteres.' using errcode = '22023';
  end if;
  if length(coalesce(v_local, '')) > 500 or length(coalesce(v_contato, '')) > 500
     or length(coalesce(v_documentos, '')) > 5000 then
    raise exception 'Local e contato vão até 500 caracteres; documentos, até 5.000.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_conteudo -> 'prazo_dias') = 'number' then
    v_prazo := (p_conteudo ->> 'prazo_dias')::numeric::integer;
    if v_prazo not between 0 and 90 then
      raise exception 'O prazo padrão vai de 0 a 90 dias.' using errcode = '22023';
    end if;
  elsif p_conteudo ? 'prazo_dias' and jsonb_typeof(p_conteudo -> 'prazo_dias') <> 'null' then
    raise exception 'O prazo padrão deve ser um número de dias.' using errcode = '22023';
  end if;
  if v_motivo is not null and length(v_motivo) not between 3 and 500 then
    raise exception 'O motivo deve ter de 3 a 500 caracteres.' using errcode = '22023';
  end if;

  select * into v_autor from private.autor_da_sessao();

  if p_modelo is null then
    if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
      raise exception 'Área inválida: %', p_area using errcode = '22023';
    end if;
    if not (v_area = any ((select private."FC_AREAS_USUARIO"())::text[])) then
      raise exception 'Sem permissão para esta área' using errcode = '42501';
    end if;
    if p_edital is not null then
      if not exists (select 1 from public."TB_MONITORAMENTO_INDIGENA" m where m.id = p_edital and m."CO_AREA" = v_area) then
        raise exception 'O edital não é desta área.' using errcode = '22023';
      end if;
      perform private."FC_EXIGIR_AREA_EDITAL"(p_edital::text);
    end if;
    if exists (select 1 from public."TB_MODELO_CARTA_CONVOCACAO" t
                where t."ST_ATIVO" and t."CO_AREA" = v_area
                  and t."CO_MONITORAMENTO" is not distinct from p_edital
                  and lower(btrim(t."NO_MODELO")) = lower(v_nome)) then
      raise exception 'Já existe um modelo ativo com este nome.' using errcode = '23505';
    end if;
    insert into public."TB_MODELO_CARTA_CONVOCACAO" (
      "CO_AREA", "CO_MONITORAMENTO", "NO_MODELO", "NU_VERSAO_VIGENTE", "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO"
    ) values (v_area, p_edital, v_nome, 1, (select auth.uid()), (select auth.uid()))
    returning * into v_modelo;
    v_versao := 1;
  else
    select * into v_modelo from public."TB_MODELO_CARTA_CONVOCACAO"
     where "CO_MODELO_CARTA" = p_modelo for update;
    if v_modelo."CO_MODELO_CARTA" is null then
      raise exception 'Modelo não encontrado' using errcode = '22023';
    end if;
    if not (v_modelo."CO_AREA" = any ((select private."FC_AREAS_USUARIO"())::text[])) then
      raise exception 'Sem permissão para esta área' using errcode = '42501';
    end if;
    perform private."FC_EXIGIR_AREA_EDITAL"(v_modelo."CO_MONITORAMENTO"::text);
    if not v_modelo."ST_ATIVO" then
      raise exception 'Modelo inativo: reative antes de editar.' using errcode = '22023';
    end if;
    if p_versao_atual is distinct from v_modelo."NU_VERSAO_VIGENTE" then
      raise exception 'O modelo mudou desde que você o abriu (versão %); abra de novo.', v_modelo."NU_VERSAO_VIGENTE" using errcode = 'PT409';
    end if;
    if v_motivo is null then
      raise exception 'Informe o motivo da alteração do modelo.' using errcode = '22023';
    end if;
    if exists (select 1 from public."TB_MODELO_CARTA_CONVOCACAO" t
                where t."ST_ATIVO" and t."CO_MODELO_CARTA" <> v_modelo."CO_MODELO_CARTA"
                  and t."CO_AREA" = v_modelo."CO_AREA"
                  and t."CO_MONITORAMENTO" is not distinct from v_modelo."CO_MONITORAMENTO"
                  and lower(btrim(t."NO_MODELO")) = lower(v_nome)) then
      raise exception 'Já existe um modelo ativo com este nome.' using errcode = '23505';
    end if;
    v_versao := v_modelo."NU_VERSAO_VIGENTE" + 1;
    update public."TB_MODELO_CARTA_CONVOCACAO"
       set "NO_MODELO" = v_nome, "NU_VERSAO_VIGENTE" = v_versao,
           "CO_USUARIO_ATUALIZACAO" = (select auth.uid()), "DT_ATUALIZACAO" = now()
     where "CO_MODELO_CARTA" = v_modelo."CO_MODELO_CARTA";
  end if;

  insert into public."TH_MODELO_CARTA_CONVOCACAO" (
    "CO_MODELO_CARTA", "NU_VERSAO", "NO_MODELO", "DS_TITULO", "DS_TEXTO", "DS_LOCAL", "DS_DOCUMENTOS",
    "DS_CONTATO", "NU_PRAZO_DIAS", "DS_MOTIVO", "CO_USUARIO", "NO_USUARIO", "DS_EMAIL_USUARIO"
  ) values (
    v_modelo."CO_MODELO_CARTA", v_versao, v_nome, v_titulo, v_texto, v_local, v_documentos,
    v_contato, v_prazo, v_motivo, (select auth.uid()), v_autor.nome, v_autor.email
  );

  return json_build_object('modelo_id', v_modelo."CO_MODELO_CARTA", 'versao', v_versao);
end;
$function$;

-- salvar_modelo_resposta_recurso(jsonb) (1)
CREATE OR REPLACE FUNCTION public.salvar_modelo_resposta_recurso(p_dados jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid := nullif(p_dados->>'id', '')::uuid;
  v_area text := nullif(btrim(coalesce(p_dados->>'area', '')), '');
  v_origem text := nullif(btrim(coalesce(p_dados->>'origem', '')), '');
  v_situacao text := p_dados->>'situacao';
  v_nome text := btrim(coalesce(p_dados->>'nome', ''));
  v_corpo text := btrim(coalesce(p_dados->>'corpo', ''));
  v_atual public."TB_MODELO_RESPOSTA_RECURSO";
  v_desconhecidos text[];
begin
  if not private.pode_recurso('recursos', 3) then
    raise exception 'Só a administração de Recursos gerencia os modelos de resposta' using errcode = '42501';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  if v_area is not null then
    if not exists (select 1 from public."TB_AREA" a where a."CO_AREA" = v_area) then
      raise exception 'Área inválida' using errcode = '22023';
    end if;
    if not private."FC_PODE_AREA"(v_area) then
      raise exception 'Sem acesso a esta área' using errcode = '42501';
    end if;
  end if;
  if v_origem is not null and not exists (select 1 from public."TB_ORIGEM_RECURSO" o where o."CO_ORIGEM_RECURSO" = v_origem) then
    raise exception 'Origem inválida' using errcode = '22023';
  end if;
  if v_situacao is null or v_situacao not in ('DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
    raise exception 'Situação inválida' using errcode = '22023';
  end if;
  if length(v_nome) not between 3 and 150 then
    raise exception 'O nome do modelo deve ter de 3 a 150 caracteres' using errcode = '22023';
  end if;
  if length(v_corpo) not between 20 and 20000 then
    raise exception 'O texto do modelo deve ter de 20 a 20.000 caracteres' using errcode = '22023';
  end if;
  select array_agg(distinct m[1] order by m[1]) into v_desconhecidos
  from regexp_matches(v_corpo, '\{([a-z_]+)\}', 'g') m
  where m[1] <> all (private."FC_MARCADORES_MODELO_RESPOSTA"());
  if v_desconhecidos is not null then
    raise exception 'Marcador desconhecido no modelo: %', array_to_string(v_desconhecidos, ', ') using errcode = '22023';
  end if;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into public."TB_MODELO_RESPOSTA_RECURSO" (
      "CO_MODELO_RESPOSTA", "NU_VERSAO", "CO_AREA", "CO_ORIGEM_RECURSO", "TP_SITUACAO",
      "NO_MODELO", "DS_CORPO", "CO_USUARIO_CRIACAO"
    ) values (v_id, 1, v_area, v_origem, v_situacao, v_nome, v_corpo, v_uid);
    return json_build_object('id', v_id, 'versao', 1, 'criou_versao', true);
  end if;

  select t.* into v_atual
  from public."TB_MODELO_RESPOSTA_RECURSO" t
  where t."CO_MODELO_RESPOSTA" = v_id and t."ST_VIGENTE" = 'S'
  for update;
  if not found then
    raise exception 'Modelo não encontrado' using errcode = 'P0002';
  end if;
  if v_atual."CO_AREA" is not null and not private."FC_PODE_AREA"(v_atual."CO_AREA") then
    raise exception 'Sem acesso a esta área' using errcode = '42501';
  end if;
  if p_dados->>'versao' is null or (p_dados->>'versao')::integer <> v_atual."NU_VERSAO" then
    raise exception 'Outra pessoa alterou este modelo. Recarregue e tente de novo.' using errcode = 'PT409';
  end if;
  if v_atual."ST_ATIVO" = 'S'
     and v_atual."CO_AREA" is not distinct from v_area
     and v_atual."CO_ORIGEM_RECURSO" is not distinct from v_origem
     and v_atual."TP_SITUACAO" = v_situacao
     and v_atual."NO_MODELO" = v_nome
     and v_atual."DS_CORPO" = v_corpo then
    return json_build_object('id', v_id, 'versao', v_atual."NU_VERSAO", 'criou_versao', false);
  end if;

  update public."TB_MODELO_RESPOSTA_RECURSO" set "ST_VIGENTE" = 'N'
  where "CO_MODELO_RESPOSTA" = v_id and "NU_VERSAO" = v_atual."NU_VERSAO";
  insert into public."TB_MODELO_RESPOSTA_RECURSO" (
    "CO_MODELO_RESPOSTA", "NU_VERSAO", "CO_AREA", "CO_ORIGEM_RECURSO", "TP_SITUACAO",
    "NO_MODELO", "DS_CORPO", "CO_USUARIO_CRIACAO"
  ) values (v_id, v_atual."NU_VERSAO" + 1, v_area, v_origem, v_situacao, v_nome, v_corpo, v_uid);
  return json_build_object('id', v_id, 'versao', v_atual."NU_VERSAO" + 1, 'criou_versao', true);
end;
$function$;

-- salvar_recurso_candidato(jsonb) (1)
CREATE OR REPLACE FUNCTION public.salvar_recurso_candidato(p_dados jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_edital_id uuid;
  v_edital text;
  v_area text;
  v_origem text;
  v_fora boolean;
  v_analise_id uuid;
  v_nota numeric;
  v_resultado text;
  v_responsavel text;
  v_duplicado bigint;
  v_atual public."TB_RECURSO_CANDIDATO";
  v_novo public."TB_RECURSO_CANDIDATO";
  v_texto text;
begin
  if jsonb_typeof(p_dados) is distinct from 'object' then
    raise exception 'Dados inválidos' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  v_id := nullif(p_dados->>'id', '')::uuid;

  if v_id is null then
    -- Cadastro: nasce REGISTRADO; a situação muda só pelo fluxo do parecer.
    v_edital_id := nullif(p_dados->>'edital_id', '')::uuid;
    select m.edital, m."CO_AREA" into v_edital, v_area
    from public."TB_MONITORAMENTO_INDIGENA" m
    where m.id = v_edital_id;
    if v_area is null then
      raise exception 'Edital não encontrado' using errcode = '22023';
    end if;
    perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
    perform private."FC_EXIGIR_AREA_EDITAL"(v_edital_id::text);

    if coalesce(nullif(p_dados->>'situacao', ''), 'REGISTRADO') <> 'REGISTRADO' then
      raise exception 'O recurso nasce registrado; a decisão é do parecer jurídico' using errcode = '22023';
    end if;
    v_origem := nullif(p_dados->>'origem', '');
    if not exists (select 1 from public."TB_ORIGEM_RECURSO" o where o."CO_ORIGEM_RECURSO" = v_origem and o."ST_ATIVO" = 'S') then
      raise exception 'Origem do recurso inválida' using errcode = '22023';
    end if;
    v_fora := coalesce((p_dados->>'fora_analise')::boolean, false);

    if not v_fora then
      select a.id, a.nota_final_ajustada, a.status_consolidado, a.responsavel_analise
        into v_analise_id, v_nota, v_resultado, v_responsavel
      from public."TB_ANALISE_CURRICULAR" a
      where a.id = nullif(p_dados->>'analise_id', '')::uuid
        and private."FC_ANALISE_DO_EDITAL"(a.edital, v_edital)
        and a."CO_AREA" = v_area;
      if v_analise_id is null then
        raise exception 'Candidato não encontrado nas análises deste edital' using errcode = '22023';
      end if;
      select r."NU_RECURSO" into v_duplicado
      from public."TB_RECURSO_CANDIDATO" r
      where r."CO_ANALISE_CURRICULAR" = v_analise_id
        and r."CO_MONITORAMENTO" = v_edital_id
        and r."CO_ORIGEM_RECURSO" = v_origem
        and r."ST_ATIVO" = 'S'
        and r."TP_SITUACAO" in ('REGISTRADO', 'EM_ANALISE_JURIDICA')
      order by r."NU_RECURSO"
      limit 1;
    else
      v_texto := btrim(coalesce(p_dados->>'nome_informado', ''));
      if length(v_texto) not between 3 and 200 then
        raise exception 'Informe o nome do candidato (3 a 200 caracteres)' using errcode = '22023';
      end if;
      select r."NU_RECURSO" into v_duplicado
      from public."TB_RECURSO_CANDIDATO" r
      where r."ST_FORA_ANALISE" = 'S'
        and private."FC_TEXTO_BUSCA_RECURSO"(r."NO_CANDIDATO_INFORMADO") = private."FC_TEXTO_BUSCA_RECURSO"(v_texto)
        and r."CO_MONITORAMENTO" = v_edital_id
        and r."CO_ORIGEM_RECURSO" = v_origem
        and r."ST_ATIVO" = 'S'
        and r."TP_SITUACAO" in ('REGISTRADO', 'EM_ANALISE_JURIDICA')
      order by r."NU_RECURSO"
      limit 1;
    end if;

    if v_duplicado is not null and not coalesce((p_dados->>'permitir_duplicado')::boolean, false) then
      raise exception 'Já existe o recurso nº % sem decisão para este candidato, edital e origem', v_duplicado
        using errcode = '23505', hint = 'duplicado:' || v_duplicado;
    end if;

    insert into public."TB_RECURSO_CANDIDATO" (
      "CO_MONITORAMENTO", "CO_ORIGEM_RECURSO", "CO_ANALISE_CURRICULAR", "ST_FORA_ANALISE",
      "NO_CANDIDATO_INFORMADO", "CO_CANDIDATO_INFORMADO", "NO_CARGO_INFORMADO", "CO_VAGA_INFORMADA",
      "VL_NOTA_ANTERIOR", "DS_RESULTADO_ANTERIOR", "NO_ANALISTA", "TP_SITUACAO",
      "NU_PROCESSO_SEI", "ST_MUDOU_CLASSIFICACAO", "DS_OBSERVACAO",
      "DT_PROCESSO_SEI", "CO_USUARIO_PROCESSO_SEI",
      "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO"
    ) values (
      v_edital_id, v_origem,
      v_analise_id,
      case when v_fora then 'S' else 'N' end,
      case when v_fora then v_texto end,
      case when v_fora then nullif(btrim(p_dados->>'codigo_informado'), '') end,
      case when v_fora then nullif(btrim(p_dados->>'cargo_informado'), '') end,
      case when v_fora then nullif(btrim(p_dados->>'vaga_informada'), '') end,
      v_nota,
      v_resultado,
      coalesce(nullif(btrim(p_dados->>'analista'), ''), nullif(btrim(v_responsavel), '')),
      'REGISTRADO',
      nullif(btrim(p_dados->>'processo_sei'), ''),
      case when coalesce((p_dados->>'mudou_classificacao')::boolean, false) then 'S' else 'N' end,
      nullif(btrim(p_dados->>'observacao'), ''),
      case when nullif(btrim(p_dados->>'processo_sei'), '') is not null then now() end,
      case when nullif(btrim(p_dados->>'processo_sei'), '') is not null then v_uid end,
      v_uid, v_uid
    )
    returning * into v_novo;

    insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_VALOR_NOVO", "CO_USUARIO")
    values (v_novo."CO_RECURSO_CANDIDATO", 'criacao', v_novo."TP_SITUACAO", v_uid);

    return json_build_object('id', v_novo."CO_RECURSO_CANDIDATO", 'nu', v_novo."NU_RECURSO", 'revisao', v_novo."NU_REVISAO");
  end if;

  -- Edição -------------------------------------------------------------------
  select r.* into v_atual
  from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = v_id and r."ST_ATIVO" = 'S'
  for update;
  if not found then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  select m."CO_AREA" into v_area from public."TB_MONITORAMENTO_INDIGENA" m where m.id = v_atual."CO_MONITORAMENTO";
  perform private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 2);
  perform private."FC_EXIGIR_AREA_EDITAL"(v_atual."CO_MONITORAMENTO"::text);
  if (p_dados->>'revisao') is null or (p_dados->>'revisao')::integer <> v_atual."NU_REVISAO" then
    raise exception 'O recurso foi alterado por outra pessoa. Recarregue e tente de novo.' using errcode = 'PT409';
  end if;
  if p_dados ? 'situacao' and coalesce(nullif(p_dados->>'situacao', ''), v_atual."TP_SITUACAO") <> v_atual."TP_SITUACAO" then
    raise exception 'A situação do recurso muda só pelo fluxo do parecer jurídico' using errcode = '22023';
  end if;

  v_novo := v_atual;
  if p_dados ? 'origem' then
    v_novo."CO_ORIGEM_RECURSO" := nullif(p_dados->>'origem', '');
    if v_novo."CO_ORIGEM_RECURSO" is distinct from v_atual."CO_ORIGEM_RECURSO"
       and not exists (select 1 from public."TB_ORIGEM_RECURSO" o where o."CO_ORIGEM_RECURSO" = v_novo."CO_ORIGEM_RECURSO" and o."ST_ATIVO" = 'S') then
      raise exception 'Origem do recurso inválida' using errcode = '22023';
    end if;
  end if;
  if p_dados ? 'analista' then v_novo."NO_ANALISTA" := nullif(btrim(p_dados->>'analista'), ''); end if;
  if p_dados ? 'processo_sei' then v_novo."NU_PROCESSO_SEI" := nullif(btrim(p_dados->>'processo_sei'), ''); end if;
  if p_dados ? 'mudou_classificacao' then
    v_novo."ST_MUDOU_CLASSIFICACAO" := case when coalesce((p_dados->>'mudou_classificacao')::boolean, false) then 'S' else 'N' end;
  end if;
  if p_dados ? 'observacao' then v_novo."DS_OBSERVACAO" := nullif(btrim(p_dados->>'observacao'), ''); end if;
  if v_atual."ST_FORA_ANALISE" = 'S' then
    if p_dados ? 'nome_informado' then
      v_novo."NO_CANDIDATO_INFORMADO" := btrim(coalesce(p_dados->>'nome_informado', ''));
      if length(v_novo."NO_CANDIDATO_INFORMADO") not between 3 and 200 then
        raise exception 'Informe o nome do candidato (3 a 200 caracteres)' using errcode = '22023';
      end if;
    end if;
    if p_dados ? 'codigo_informado' then v_novo."CO_CANDIDATO_INFORMADO" := nullif(btrim(p_dados->>'codigo_informado'), ''); end if;
    if p_dados ? 'cargo_informado' then v_novo."NO_CARGO_INFORMADO" := nullif(btrim(p_dados->>'cargo_informado'), ''); end if;
    if p_dados ? 'vaga_informada' then v_novo."CO_VAGA_INFORMADA" := nullif(btrim(p_dados->>'vaga_informada'), ''); end if;
  end if;

  -- Informar o número do processo SEI marca a etapa "processo SEI criado".
  if v_novo."NU_PROCESSO_SEI" is not null and v_novo."DT_PROCESSO_SEI" is null then
    v_novo."DT_PROCESSO_SEI" := now();
    v_novo."CO_USUARIO_PROCESSO_SEI" := v_uid;
  end if;

  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
  select v_id, c.acao, c.campo, c.antes, c.depois, v_uid
  from (values
    ('edicao', 'origem', v_atual."CO_ORIGEM_RECURSO", v_novo."CO_ORIGEM_RECURSO"),
    ('edicao', 'analista', v_atual."NO_ANALISTA", v_novo."NO_ANALISTA"),
    ('edicao', 'processo_sei', v_atual."NU_PROCESSO_SEI", v_novo."NU_PROCESSO_SEI"),
    ('edicao', 'mudou_classificacao', v_atual."ST_MUDOU_CLASSIFICACAO", v_novo."ST_MUDOU_CLASSIFICACAO"),
    ('edicao', 'observacao', v_atual."DS_OBSERVACAO", v_novo."DS_OBSERVACAO"),
    ('edicao', 'nome_informado', v_atual."NO_CANDIDATO_INFORMADO", v_novo."NO_CANDIDATO_INFORMADO"),
    ('edicao', 'codigo_informado', v_atual."CO_CANDIDATO_INFORMADO", v_novo."CO_CANDIDATO_INFORMADO"),
    ('edicao', 'cargo_informado', v_atual."NO_CARGO_INFORMADO", v_novo."NO_CARGO_INFORMADO"),
    ('edicao', 'vaga_informada', v_atual."CO_VAGA_INFORMADA", v_novo."CO_VAGA_INFORMADA"),
    ('etapa', 'processo_sei', case when v_atual."DT_PROCESSO_SEI" is null then 'N' else 'S' end, case when v_novo."DT_PROCESSO_SEI" is null then 'N' else 'S' end)
  ) as c(acao, campo, antes, depois)
  where c.antes is distinct from c.depois;
  if not found then
    return json_build_object('id', v_atual."CO_RECURSO_CANDIDATO", 'nu', v_atual."NU_RECURSO", 'revisao', v_atual."NU_REVISAO");
  end if;

  update public."TB_RECURSO_CANDIDATO" set
    "CO_ORIGEM_RECURSO" = v_novo."CO_ORIGEM_RECURSO",
    "NO_ANALISTA" = v_novo."NO_ANALISTA",
    "NU_PROCESSO_SEI" = v_novo."NU_PROCESSO_SEI",
    "ST_MUDOU_CLASSIFICACAO" = v_novo."ST_MUDOU_CLASSIFICACAO",
    "DS_OBSERVACAO" = v_novo."DS_OBSERVACAO",
    "NO_CANDIDATO_INFORMADO" = v_novo."NO_CANDIDATO_INFORMADO",
    "CO_CANDIDATO_INFORMADO" = v_novo."CO_CANDIDATO_INFORMADO",
    "NO_CARGO_INFORMADO" = v_novo."NO_CARGO_INFORMADO",
    "CO_VAGA_INFORMADA" = v_novo."CO_VAGA_INFORMADA",
    "DT_PROCESSO_SEI" = v_novo."DT_PROCESSO_SEI",
    "CO_USUARIO_PROCESSO_SEI" = v_novo."CO_USUARIO_PROCESSO_SEI",
    "NU_REVISAO" = v_atual."NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RECURSO_CANDIDATO" = v_id
  returning * into v_novo;

  return json_build_object('id', v_novo."CO_RECURSO_CANDIDATO", 'nu', v_novo."NU_RECURSO", 'revisao', v_novo."NU_REVISAO");
end;
$function$;

-- salvar_regra_agenda_entrevista(uuid,jsonb,integer,text) (2)
CREATE OR REPLACE FUNCTION public.salvar_regra_agenda_entrevista(p_edital uuid, p_configuracao jsonb, p_versao_atual integer, p_motivo text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_AGENDA_ENTREVISTA"(p_edital, 2);
  v_regra public."TB_REGRA_AGENDA_ENTREVISTA";
  v_nova integer;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_uid uuid := (select auth.uid());
begin
  perform private."FC_VALIDAR_REGRA_AGENDA"(p_configuracao);
  if v_motivo is not null and length(v_motivo) not between 3 and 500 then
    raise exception 'Motivo da alteração entre 3 e 500 caracteres.' using errcode = '22023';
  end if;

  select * into v_regra from public."TB_REGRA_AGENDA_ENTREVISTA" where "CO_MONITORAMENTO" = p_edital for update;
  if v_regra."CO_REGRA_AGENDA" is null then
    if coalesce(p_versao_atual, 0) <> 0 then
      raise exception 'A regra da agenda mudou desde que você abriu; recarregue.' using errcode = 'PT409';
    end if;
    insert into public."TB_REGRA_AGENDA_ENTREVISTA" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (p_edital, 1, v_uid)
    returning * into v_regra;
    v_nova := 1;
  else
    if p_versao_atual is distinct from v_regra."NU_VERSAO_VIGENTE" then
      raise exception 'A regra da agenda mudou desde que você abriu (versão %); recarregue.', v_regra."NU_VERSAO_VIGENTE" using errcode = 'PT409';
    end if;
    if v_motivo is null then
      raise exception 'Informe o motivo da alteração.' using errcode = '22023';
    end if;
    v_nova := v_regra."NU_VERSAO_VIGENTE" + 1;
    update public."TB_REGRA_AGENDA_ENTREVISTA"
       set "NU_VERSAO_VIGENTE" = v_nova, "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_uid
     where "CO_REGRA_AGENDA" = v_regra."CO_REGRA_AGENDA";
  end if;

  insert into public."TH_REGRA_AGENDA_ENTREVISTA" ("CO_REGRA_AGENDA", "NU_VERSAO", "DS_CONFIGURACAO", "DS_MOTIVO", "CO_USUARIO")
  values (v_regra."CO_REGRA_AGENDA", v_nova, p_configuracao, v_motivo, v_uid);

  return private."FC_REGRA_AGENDA_JSON"(p_edital);
end;
$function$;

-- salvar_regra_analise(uuid,jsonb,integer,text,text) (2)
CREATE OR REPLACE FUNCTION public.salvar_regra_analise(p_edital uuid, p_configuracao jsonb, p_versao_atual integer, p_motivo text, p_nome text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_COORD_AVALIACAO"(p_edital);
  v_regra public."TB_REGRA_ANALISE";
  v_nova integer;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_nome varchar := private."FC_NOME_DA_VERSAO"(p_nome);
  v_uid uuid := (select auth.uid());
begin
  perform private."FC_VALIDAR_REGRA_ANALISE"(p_configuracao);
  if v_motivo is not null and length(v_motivo) > 2000 then
    raise exception 'Motivo com até 2.000 caracteres.' using errcode = '22023';
  end if;

  select * into v_regra from public."TB_REGRA_ANALISE" where "CO_MONITORAMENTO" = p_edital for update;
  if v_regra."CO_REGRA_ANALISE" is null then
    if coalesce(p_versao_atual, 0) <> 0 then
      raise exception 'A regra mudou desde que você abriu; recarregue.' using errcode = 'PT409';
    end if;
    insert into public."TB_REGRA_ANALISE" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (p_edital, 1, v_uid)
    returning * into v_regra;
    v_nova := 1;
  else
    if p_versao_atual is distinct from v_regra."NU_VERSAO_VIGENTE" then
      raise exception 'A regra mudou desde que você abriu (versão %); recarregue.', v_regra."NU_VERSAO_VIGENTE" using errcode = 'PT409';
    end if;
    if v_motivo is null or length(v_motivo) < 10 then
      raise exception 'Informe o motivo da alteração (10 a 2.000 caracteres).' using errcode = '22023';
    end if;
    v_nova := v_regra."NU_VERSAO_VIGENTE" + 1;
  end if;

  insert into public."TH_REGRA_ANALISE" ("CO_REGRA_ANALISE", "NU_VERSAO", "DS_CONFIGURACAO", "DS_HASH", "DS_MOTIVO", "CO_USUARIO", "NO_VERSAO")
  values (v_regra."CO_REGRA_ANALISE", v_nova, p_configuracao,
          encode(sha256(convert_to(p_configuracao::text, 'UTF8')), 'hex'), coalesce(v_motivo, 'Regra criada do zero'), v_uid, v_nome);

  update public."TB_REGRA_ANALISE"
     set "NU_VERSAO_VIGENTE" = v_nova, "TP_SITUACAO" = 'CONFERIR', "CO_USUARIO_CONFERENCIA" = null, "DT_CONFERENCIA" = null,
         "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_uid
   where "CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE";

  return json_build_object(
    'regra', private."FC_REGRA_ANALISE_JSON"(p_edital),
    'fichas_afetadas', coalesce((
      select json_agg(json_build_object('ficha', f."CO_FICHA_ANALISE", 'codigo', c."CO_CANDIDATO_EMPREGARE", 'vaga', f."CO_VAGA",
                                        'versao_regra', f."NU_VERSAO_REGRA", 'resultado', f."TP_RESULTADO", 'nota_final', f."VL_NOTA_FINAL")
                      order by f."CO_VAGA", c."CO_CANDIDATO_EMPREGARE")
        from public."TB_FICHA_ANALISE" f
        join public."TB_EMPREGARE_CANDIDATO" c on c."CO_EMPREGARE_CANDIDATO" = f."CO_EMPREGARE_CANDIDATO"
       where f."CO_REGRA_ANALISE" = v_regra."CO_REGRA_ANALISE" and f."TP_SITUACAO" = 'CONCLUIDA' and f."NU_VERSAO_REGRA" < v_nova), '[]'::json));
end;
$function$;

-- salvar_regra_classificacao(uuid,jsonb,integer,text,text) (2)
CREATE OR REPLACE FUNCTION public.salvar_regra_classificacao(p_edital uuid, p_configuracao jsonb, p_versao_atual integer, p_motivo text, p_nome text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_area text := private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2);
  v_regra public."TB_REGRA_CLASSIFICACAO";
  v_nova integer;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_nome varchar := private."FC_NOME_DA_VERSAO"(p_nome);
  v_uid uuid := (select auth.uid());
begin
  perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(p_configuracao);
  if v_motivo is not null and length(v_motivo) not between 3 and 500 then
    raise exception 'Motivo da alteração entre 3 e 500 caracteres.' using errcode = '22023';
  end if;

  select * into v_regra from public."TB_REGRA_CLASSIFICACAO" where "CO_MONITORAMENTO" = p_edital for update;
  if v_regra."CO_REGRA_CLASSIFICACAO" is null then
    if coalesce(p_versao_atual, 0) <> 0 then
      raise exception 'A regra mudou desde que você abriu; recarregue.' using errcode = 'PT409';
    end if;
    insert into public."TB_REGRA_CLASSIFICACAO" ("CO_MONITORAMENTO", "NU_VERSAO_VIGENTE", "CO_USUARIO_ATUALIZACAO")
    values (p_edital, 1, v_uid)
    returning * into v_regra;
    v_nova := 1;
  else
    if p_versao_atual is distinct from v_regra."NU_VERSAO_VIGENTE" then
      raise exception 'A regra mudou desde que você abriu (versão %); recarregue.', v_regra."NU_VERSAO_VIGENTE" using errcode = 'PT409';
    end if;
    if v_motivo is null then
      raise exception 'Informe o motivo da alteração.' using errcode = '22023';
    end if;
    v_nova := v_regra."NU_VERSAO_VIGENTE" + 1;
  end if;

  insert into public."TH_REGRA_CLASSIFICACAO"
    ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "DS_CONFIGURACAO", "TP_EMPATE_FINAL", "DS_MOTIVO", "CO_USUARIO", "NO_VERSAO")
  values (v_regra."CO_REGRA_CLASSIFICACAO", v_nova, p_configuracao, p_configuracao #>> '{empate_final,metodo}', v_motivo, v_uid, v_nome);

  insert into public."RL_REGRA_CRITERIO_DESEMPATE"
    ("CO_REGRA_CLASSIFICACAO", "NU_VERSAO", "NU_ORDEM", "CO_CRITERIO", "TP_DIRECAO")
  select v_regra."CO_REGRA_CLASSIFICACAO", v_nova, d.ordem, upper(d.valor ->> 'criterio'), d.valor ->> 'direcao'
    from jsonb_array_elements(coalesce(p_configuracao -> 'desempate', '[]'::jsonb)) with ordinality d(valor, ordem);

  update public."TB_REGRA_CLASSIFICACAO"
     set "NU_VERSAO_VIGENTE" = v_nova, "DT_ATUALIZACAO" = now(), "CO_USUARIO_ATUALIZACAO" = v_uid
   where "CO_REGRA_CLASSIFICACAO" = v_regra."CO_REGRA_CLASSIFICACAO";

  return private."FC_REGRA_CLASSIFICACAO_JSON"(p_edital);
end;
$function$;

-- salvar_resposta_recurso(jsonb) (1)
CREATE OR REPLACE FUNCTION public.salvar_resposta_recurso(p_dados jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_recurso uuid := nullif(p_dados->>'recurso_id', '')::uuid;
  v_modelo uuid := nullif(p_dados->>'modelo_id', '')::uuid;
  v_versao integer := nullif(p_dados->>'modelo_versao', '')::integer;
  v_fundamentacao text := coalesce(p_dados->>'fundamentacao', '');
  v_texto text := coalesce(p_dados->>'texto_final', '');
  v_area text;
  v_rec public."TB_RECURSO_CANDIDATO";
  v_modelo_linha public."TB_MODELO_RESPOSTA_RECURSO";
  v_atual public."TB_RESPOSTA_RECURSO";
  v_id uuid;
  v_revisao integer;
begin
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  if v_recurso is null then
    raise exception 'Informe o recurso' using errcode = '22023';
  end if;
  v_area := private."FC_EXIGIR_RECURSO_ACESSIVEL"(v_recurso, 2);
  select r.* into v_rec from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = v_recurso for update;
  if length(v_fundamentacao) > 20000 then
    raise exception 'A fundamentação passa de 20.000 caracteres' using errcode = '22023';
  end if;
  if length(btrim(v_texto)) not between 1 and 60000 then
    raise exception 'O texto da resposta deve ter de 1 a 60.000 caracteres' using errcode = '22023';
  end if;

  select s.* into v_atual from public."TB_RESPOSTA_RECURSO" s
  where s."CO_RECURSO_CANDIDATO" = v_recurso for update;

  select t.* into v_modelo_linha from public."TB_MODELO_RESPOSTA_RECURSO" t
  where t."CO_MODELO_RESPOSTA" = v_modelo and t."NU_VERSAO" = v_versao;
  if not found then
    raise exception 'Modelo de resposta não encontrado' using errcode = '22023';
  end if;
  -- Modelo novo na resposta: só a versão vigente, ativa, da área e da origem do recurso.
  if v_atual."CO_RESPOSTA_RECURSO" is null
     or v_atual."CO_MODELO_RESPOSTA" <> v_modelo
     or v_atual."NU_VERSAO_MODELO" <> v_versao then
    if v_modelo_linha."ST_VIGENTE" <> 'S' or v_modelo_linha."ST_ATIVO" <> 'S' then
      raise exception 'Este modelo foi alterado ou arquivado. Escolha de novo.' using errcode = '22023';
    end if;
    if v_modelo_linha."CO_AREA" is not null and v_modelo_linha."CO_AREA" <> v_area then
      raise exception 'O modelo é de outra área' using errcode = '22023';
    end if;
    if v_modelo_linha."CO_ORIGEM_RECURSO" is not null and v_modelo_linha."CO_ORIGEM_RECURSO" <> v_rec."CO_ORIGEM_RECURSO" then
      raise exception 'O modelo é de outra origem de recurso' using errcode = '22023';
    end if;
  end if;

  if v_atual."CO_RESPOSTA_RECURSO" is null then
    insert into public."TB_RESPOSTA_RECURSO" (
      "CO_RECURSO_CANDIDATO", "CO_MODELO_RESPOSTA", "NU_VERSAO_MODELO", "DS_FUNDAMENTACAO",
      "DS_TEXTO_FINAL", "CO_USUARIO_AUTOR", "CO_USUARIO_CRIACAO", "CO_USUARIO_ATUALIZACAO"
    ) values (v_recurso, v_modelo, v_versao, v_fundamentacao, v_texto, v_uid, v_uid, v_uid)
    returning "CO_RESPOSTA_RECURSO", "NU_REVISAO" into v_id, v_revisao;
    insert into public."TH_RESPOSTA_RECURSO" (
      "CO_RESPOSTA_RECURSO", "TP_ACAO", "TP_ESTADO_ANTERIOR", "TP_ESTADO_NOVO",
      "CO_MODELO_RESPOSTA", "NU_VERSAO_MODELO", "DS_TEXTO_FINAL", "NU_REVISAO", "CO_USUARIO"
    ) values (v_id, 'criacao', null, 'rascunho', v_modelo, v_versao, v_texto, v_revisao, v_uid);
    insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_NOVO", "CO_USUARIO")
    values (v_recurso, 'resposta', 'criacao', 'rascunho', v_uid);
    return json_build_object('id', v_id, 'revisao', v_revisao, 'estado', 'rascunho');
  end if;

  if p_dados->>'revisao' is null or (p_dados->>'revisao')::integer <> v_atual."NU_REVISAO" then
    raise exception 'Outra pessoa alterou esta resposta. Recarregue e tente de novo.' using errcode = 'PT409';
  end if;
  if v_atual."TP_ESTADO" not in ('rascunho', 'devolvida') then
    raise exception 'A resposta só pode ser editada em rascunho ou devolvida' using errcode = '22023';
  end if;
  update public."TB_RESPOSTA_RECURSO" set
    "CO_MODELO_RESPOSTA" = v_modelo,
    "NU_VERSAO_MODELO" = v_versao,
    "DS_FUNDAMENTACAO" = v_fundamentacao,
    "DS_TEXTO_FINAL" = v_texto,
    "TP_ESTADO" = 'rascunho',
    "CO_USUARIO_AUTOR" = v_uid,
    "NU_REVISAO" = "NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RESPOSTA_RECURSO" = v_atual."CO_RESPOSTA_RECURSO"
  returning "NU_REVISAO" into v_revisao;
  insert into public."TH_RESPOSTA_RECURSO" (
    "CO_RESPOSTA_RECURSO", "TP_ACAO", "TP_ESTADO_ANTERIOR", "TP_ESTADO_NOVO",
    "CO_MODELO_RESPOSTA", "NU_VERSAO_MODELO", "DS_TEXTO_FINAL", "NU_REVISAO", "CO_USUARIO"
  ) values (v_atual."CO_RESPOSTA_RECURSO", 'edicao', v_atual."TP_ESTADO", 'rascunho', v_modelo, v_versao, v_texto, v_revisao, v_uid);
  return json_build_object('id', v_atual."CO_RESPOSTA_RECURSO", 'revisao', v_revisao, 'estado', 'rascunho');
end;
$function$;

-- transicionar_recurso_candidato(uuid,text,integer,text) (1)
CREATE OR REPLACE FUNCTION public.transicionar_recurso_candidato(p_id uuid, p_acao text, p_revisao integer, p_texto text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_atual public."TB_RECURSO_CANDIDATO";
  v_texto text := nullif(btrim(coalesce(p_texto, '')), '');
  v_decisao boolean := p_acao in ('deferir', 'deferir_parcialmente', 'indeferir');
  v_novo text;
  v_revisao integer;
begin
  if p_acao is null or p_acao not in ('enviar_parecer', 'devolver', 'deferir', 'deferir_parcialmente', 'indeferir', 'reabrir') then
    raise exception 'Ação inválida' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  -- Enviar para parecer: quem edita. Devolver, decidir e reabrir: o parecer jurídico.
  perform private."FC_EXIGIR_RECURSO_ACESSIVEL"(p_id, case when p_acao = 'enviar_parecer' then 2 else 1 end);
  if p_acao <> 'enviar_parecer' then
    perform private."FC_EXIGIR_PARECER_RECURSO"();
  end if;

  select r.* into v_atual from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = p_id and r."ST_ATIVO" = 'S'
  for update;
  if not found then
    raise exception 'Recurso não encontrado' using errcode = 'P0002';
  end if;
  if p_revisao is null or p_revisao <> v_atual."NU_REVISAO" then
    raise exception 'O recurso foi alterado por outra pessoa. Recarregue e tente de novo.' using errcode = 'PT409';
  end if;

  if v_decisao then
    if length(coalesce(v_texto, '')) not between 10 and 20000 then
      raise exception 'Escreva o parecer jurídico (10 a 20.000 caracteres)' using errcode = '22023';
    end if;
  elsif p_acao in ('devolver', 'reabrir') then
    if length(coalesce(v_texto, '')) not between 3 and 2000 then
      raise exception 'Informe o motivo (3 a 2.000 caracteres)' using errcode = '22023';
    end if;
  elsif length(coalesce(v_texto, '')) > 2000 then
    raise exception 'A observação passa de 2.000 caracteres' using errcode = '22023';
  end if;

  if p_acao = 'enviar_parecer' then
    if v_atual."TP_SITUACAO" <> 'REGISTRADO' then
      raise exception 'Só recurso registrado vai para parecer jurídico' using errcode = '22023';
    end if;
    v_novo := 'EM_ANALISE_JURIDICA';
  elsif p_acao = 'reabrir' then
    if v_atual."TP_SITUACAO" not in ('DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
      raise exception 'Só recurso decidido pode ser reaberto' using errcode = '22023';
    end if;
    if v_atual."DT_RESPOSTA_CANDIDATO" is not null or exists (
      select 1 from public."TB_RESPOSTA_RECURSO" s
      where s."CO_RECURSO_CANDIDATO" = p_id and s."TP_ESTADO" = 'enviada') then
      raise exception 'A resposta já foi enviada ao candidato: a decisão não reabre' using errcode = '22023';
    end if;
    v_novo := 'EM_ANALISE_JURIDICA';
  else
    if v_atual."TP_SITUACAO" <> 'EM_ANALISE_JURIDICA' then
      raise exception 'O recurso não está em análise jurídica' using errcode = '22023';
    end if;
    v_novo := case p_acao
      when 'devolver' then 'REGISTRADO'
      when 'deferir' then 'DEFERIDO'
      when 'deferir_parcialmente' then 'PARCIALMENTE_INDEFERIDO'
      else 'INDEFERIDO' end;
  end if;

  update public."TB_RECURSO_CANDIDATO" set
    "TP_SITUACAO" = v_novo,
    "DT_DECISAO" = case when v_decisao then now() when p_acao = 'reabrir' then null else "DT_DECISAO" end,
    "CO_USUARIO_DECISAO" = case when v_decisao then v_uid when p_acao = 'reabrir' then null else "CO_USUARIO_DECISAO" end,
    "DS_PARECER_JURIDICO" = case when v_decisao then v_texto when p_acao = 'reabrir' then null else "DS_PARECER_JURIDICO" end,
    "DT_ENVIO_PARECER" = case when p_acao in ('enviar_parecer', 'reabrir') then now() when p_acao = 'devolver' then null else "DT_ENVIO_PARECER" end,
    "CO_USUARIO_ENVIO_PARECER" = case when p_acao in ('enviar_parecer', 'reabrir') then v_uid when p_acao = 'devolver' then null else "CO_USUARIO_ENVIO_PARECER" end,
    "DT_DEVOLUCAO" = case when p_acao = 'devolver' then now() when p_acao = 'enviar_parecer' then null else "DT_DEVOLUCAO" end,
    "CO_USUARIO_DEVOLUCAO" = case when p_acao = 'devolver' then v_uid when p_acao = 'enviar_parecer' then null else "CO_USUARIO_DEVOLUCAO" end,
    "DS_COMENTARIO_DEVOLUCAO" = case when p_acao = 'devolver' then v_texto when p_acao = 'enviar_parecer' then null else "DS_COMENTARIO_DEVOLUCAO" end,
    "NU_REVISAO" = "NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RECURSO_CANDIDATO" = p_id
  returning "NU_REVISAO" into v_revisao;

  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "DS_MOTIVO", "CO_USUARIO")
  values (p_id, 'parecer', p_acao, v_atual."TP_SITUACAO", v_novo, v_texto, v_uid);

  return json_build_object('id', p_id, 'situacao', v_novo, 'revisao', v_revisao);
end;
$function$;

-- transicionar_resposta_recurso(uuid,text,integer,text) (1)
CREATE OR REPLACE FUNCTION public.transicionar_resposta_recurso(p_resposta_id uuid, p_acao text, p_revisao integer, p_comentario text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
  v_atual public."TB_RESPOSTA_RECURSO";
  v_rec public."TB_RECURSO_CANDIDATO";
  v_situacao_modelo text;
  v_comentario text := nullif(btrim(coalesce(p_comentario, '')), '');
  v_novo text;
  v_revisao integer;
  v_etapa_em timestamptz;
begin
  if p_acao is null or p_acao not in ('enviar_revisao', 'aprovar', 'devolver', 'reabrir', 'marcar_enviada') then
    raise exception 'Ação inválida' using errcode = '22023';
  end if;
  if v_uid is null then
    raise exception 'Sessão inválida' using errcode = '42501';
  end if;
  if length(coalesce(v_comentario, '')) > 2000 then
    raise exception 'O comentário passa de 2.000 caracteres' using errcode = '22023';
  end if;
  select s.* into v_atual from public."TB_RESPOSTA_RECURSO" s where s."CO_RESPOSTA_RECURSO" = p_resposta_id;
  if not found then
    raise exception 'Resposta não encontrada' using errcode = 'P0002';
  end if;
  perform private."FC_EXIGIR_RECURSO_ACESSIVEL"(v_atual."CO_RECURSO_CANDIDATO", 2);
  -- Aprovar ou devolver o texto da resposta (a revisão final): o parecer jurídico.
  if p_acao in ('aprovar', 'devolver') then
    perform private."FC_EXIGIR_PARECER_RECURSO"();
  end if;
  -- Mesma ordem de trava de salvar_resposta_recurso: o recurso, depois a resposta.
  select r.* into v_rec from public."TB_RECURSO_CANDIDATO" r
  where r."CO_RECURSO_CANDIDATO" = v_atual."CO_RECURSO_CANDIDATO" for update;
  select s.* into v_atual from public."TB_RESPOSTA_RECURSO" s
  where s."CO_RESPOSTA_RECURSO" = p_resposta_id for update;
  if p_revisao is null or p_revisao <> v_atual."NU_REVISAO" then
    raise exception 'Outra pessoa alterou esta resposta. Recarregue e tente de novo.' using errcode = 'PT409';
  end if;

  if p_acao = 'enviar_revisao' then
    if v_atual."TP_ESTADO" not in ('rascunho', 'devolvida') then
      raise exception 'Só rascunho ou devolvida vai para revisão' using errcode = '22023';
    end if;
    v_novo := 'em_revisao';
  elsif p_acao = 'aprovar' then
    if v_atual."TP_ESTADO" not in ('rascunho', 'em_revisao') then
      raise exception 'Só rascunho ou resposta em revisão pode ser aprovada' using errcode = '22023';
    end if;
    if (v_atual."TP_ESTADO" = 'em_revisao' or v_atual."ST_PASSOU_REVISAO" = 'S')
       and (v_uid = v_atual."CO_USUARIO_AUTOR" or v_uid is not distinct from v_atual."CO_USUARIO_ENVIO_REVISAO") then
      raise exception 'Quem escreveu ou enviou a resposta para revisão não pode aprová-la' using errcode = '42501';
    end if;
    select t."TP_SITUACAO" into v_situacao_modelo from public."TB_MODELO_RESPOSTA_RECURSO" t
    where t."CO_MODELO_RESPOSTA" = v_atual."CO_MODELO_RESPOSTA" and t."NU_VERSAO" = v_atual."NU_VERSAO_MODELO";
    if v_rec."TP_SITUACAO" not in ('DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
      raise exception 'Registre a decisão do recurso antes de aprovar a resposta' using errcode = '22023';
    end if;
    if v_rec."TP_SITUACAO" <> v_situacao_modelo then
      raise exception 'A situação do recurso não é a do modelo usado na resposta' using errcode = '22023';
    end if;
    v_novo := 'aprovada';
  elsif p_acao = 'devolver' then
    if v_atual."TP_ESTADO" <> 'em_revisao' then
      raise exception 'Só resposta em revisão pode ser devolvida' using errcode = '22023';
    end if;
    if v_uid = v_atual."CO_USUARIO_AUTOR" then
      raise exception 'Quem escreveu a resposta não pode devolvê-la' using errcode = '42501';
    end if;
    if length(coalesce(v_comentario, '')) < 3 then
      raise exception 'Informe o que precisa ser ajustado (3 caracteres ou mais)' using errcode = '22023';
    end if;
    v_novo := 'devolvida';
  elsif p_acao = 'reabrir' then
    if v_atual."TP_ESTADO" <> 'aprovada' then
      raise exception 'Só resposta aprovada pode ser reaberta' using errcode = '22023';
    end if;
    if length(coalesce(v_comentario, '')) < 3 then
      raise exception 'Informe o motivo da reabertura (3 caracteres ou mais)' using errcode = '22023';
    end if;
    v_novo := 'rascunho';
  else
    if v_atual."TP_ESTADO" <> 'aprovada' then
      raise exception 'Só resposta aprovada pode ser marcada como enviada' using errcode = '22023';
    end if;
    -- Quem edita marca enviada, mas só com o recurso decidido (a decisão pode ter sido reaberta depois da aprovação).
    if v_rec."TP_SITUACAO" not in ('DEFERIDO', 'INDEFERIDO', 'PARCIALMENTE_INDEFERIDO') then
      raise exception 'O recurso não está decidido: a resposta não pode ser enviada' using errcode = '22023';
    end if;
    v_novo := 'enviada';
  end if;

  update public."TB_RESPOSTA_RECURSO" set
    "TP_ESTADO" = v_novo,
    "ST_PASSOU_REVISAO" = case when p_acao = 'enviar_revisao' then 'S' else "ST_PASSOU_REVISAO" end,
    "DT_ENVIO_REVISAO" = case when p_acao = 'enviar_revisao' then now() else "DT_ENVIO_REVISAO" end,
    "CO_USUARIO_ENVIO_REVISAO" = case when p_acao = 'enviar_revisao' then v_uid else "CO_USUARIO_ENVIO_REVISAO" end,
    "DT_REVISAO" = case when p_acao in ('aprovar', 'devolver') then now() else "DT_REVISAO" end,
    "CO_USUARIO_REVISOR" = case when p_acao in ('aprovar', 'devolver') then v_uid else "CO_USUARIO_REVISOR" end,
    "DS_COMENTARIO_REVISAO" = case when p_acao in ('aprovar', 'devolver', 'reabrir') then v_comentario else "DS_COMENTARIO_REVISAO" end,
    "DT_ENVIO" = case when p_acao = 'marcar_enviada' then now() else "DT_ENVIO" end,
    "CO_USUARIO_ENVIO" = case when p_acao = 'marcar_enviada' then v_uid else "CO_USUARIO_ENVIO" end,
    "NU_REVISAO" = "NU_REVISAO" + 1,
    "DT_ATUALIZACAO" = now(),
    "CO_USUARIO_ATUALIZACAO" = v_uid
  where "CO_RESPOSTA_RECURSO" = p_resposta_id
  returning "NU_REVISAO" into v_revisao;

  insert into public."TH_RESPOSTA_RECURSO" (
    "CO_RESPOSTA_RECURSO", "TP_ACAO", "TP_ESTADO_ANTERIOR", "TP_ESTADO_NOVO", "DS_COMENTARIO",
    "CO_MODELO_RESPOSTA", "NU_VERSAO_MODELO", "DS_TEXTO_FINAL", "NU_REVISAO", "CO_USUARIO"
  ) values (
    p_resposta_id, p_acao, v_atual."TP_ESTADO", v_novo, v_comentario,
    v_atual."CO_MODELO_RESPOSTA", v_atual."NU_VERSAO_MODELO", v_atual."DS_TEXTO_FINAL", v_revisao, v_uid
  );
  insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "DS_MOTIVO", "CO_USUARIO")
  values (v_rec."CO_RECURSO_CANDIDATO", 'resposta', p_acao, v_atual."TP_ESTADO", v_novo, v_comentario, v_uid);

  -- Resposta enviada: a etapa do recurso acompanha (se ainda não estava marcada).
  v_etapa_em := v_rec."DT_RESPOSTA_CANDIDATO";
  if p_acao = 'marcar_enviada' and v_rec."DT_RESPOSTA_CANDIDATO" is null then
    v_etapa_em := now();
    update public."TB_RECURSO_CANDIDATO" set
      "DT_RESPOSTA_CANDIDATO" = v_etapa_em,
      "CO_USUARIO_RESPOSTA_CANDIDATO" = v_uid,
      "NU_REVISAO" = "NU_REVISAO" + 1,
      "DT_ATUALIZACAO" = now(),
      "CO_USUARIO_ATUALIZACAO" = v_uid
    where "CO_RECURSO_CANDIDATO" = v_rec."CO_RECURSO_CANDIDATO";
    insert into public."TH_RECURSO_CANDIDATO" ("CO_RECURSO_CANDIDATO", "TP_ACAO", "DS_CAMPO", "DS_VALOR_ANTERIOR", "DS_VALOR_NOVO", "CO_USUARIO")
    values (v_rec."CO_RECURSO_CANDIDATO", 'etapa', 'resposta_candidato', 'N', 'S', v_uid);
  end if;

  return json_build_object('id', p_resposta_id, 'estado', v_novo, 'revisao', v_revisao, 'resposta_candidato_em', v_etapa_em);
end;
$function$;
