-- Desfaz 20261002200000_gestor_coordenadas_e_ultimo_acesso.sql:
--   1. o grupo edital_gestor volta a se chamar "Edital gestor" (se ainda estiver "Gestor") e as
--      descrições voltam às da semente (se ainda estiverem as desta migration);
--   2. as RPCs e as funções de gravação das coordenadas voltam a exigir administrador global
--      (corpos de 20261002160000 e 20261002190000) e FC_PODE_EDITAR_COORDENADA sai;
--   3. obter_matriz_acessos e listar_contas_desativadas voltam ao último login
--      (auth.users.last_sign_in_at; corpos de 20260930130000 e 20260930180000), FC_ULTIMO_ACESSO
--      sai e o índice "IN_TLEVENTOACESSO_USUARIO_DATA" também (se esta migration o criou).
-- O histórico das coordenadas gravadas por gestores fica (nada é apagado).
begin;

update public."TB_GRUPO_ACESSO" a
   set "NO_GRUPO_ACESSO" = 'Edital gestor',
       "DS_GRUPO_ACESSO" = case when a."DS_GRUPO_ACESSO" = 'Cadastra editais e cronogramas, importa listas e corrige as coordenadas dos mapas.'
                                then 'Cadastra editais e cronogramas e importa listas.'
                                else a."DS_GRUPO_ACESSO" end,
       "NU_REVISAO" = a."NU_REVISAO" + 1,
       "DT_ATUALIZACAO" = now()
 where a."CO_GRUPO_ACESSO" = 'edital_gestor'
   and a."NO_GRUPO_ACESSO" = 'Gestor';

update public."TB_GRUPO_ACESSO" a
   set "DS_GRUPO_ACESSO" = 'Edital gestor que também muda o status dos candidatos.',
       "NU_REVISAO" = a."NU_REVISAO" + 1,
       "DT_ATUALIZACAO" = now()
 where a."CO_GRUPO_ACESSO" = 'contratador'
   and a."DS_GRUPO_ACESSO" = 'Gestor que também muda o status dos candidatos.';

-- Coordenadas: só administrador global de novo.
-- private."FC_APLICAR_COORDENADA_MAPA" como em 20261002160000.
create or replace function private."FC_APLICAR_COORDENADA_MAPA"(
  p_alvo jsonb,
  p_latitude double precision,
  p_longitude double precision,
  p_latitude_anterior double precision,
  p_longitude_anterior double precision,
  p_motivo text,
  p_acao text,
  p_conferido text,
  p_historico_desfeito bigint
) returns jsonb
language plpgsql
set search_path = ''
as $$
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
  if auth.uid() is null or not private.is_master() then
    raise exception using errcode = '42501', message = 'Somente administrador pode corrigir coordenadas.';
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
      raise exception using errcode = '40001', message = 'O ponto mudou. Atualize o mapa e tente novamente.';
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
     or v_lat is distinct from p_latitude_anterior
     or v_lon is distinct from p_longitude_anterior then
    raise exception using errcode = '40001', message = 'O ponto mudou. Atualize o mapa e tente novamente.';
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
  v_mudou := v_lat is distinct from p_latitude or v_lon is distinct from p_longitude;
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
$$;

-- public.salvar_coordenada_mapa_saude_indigena como em 20261002160000.
create or replace function public.salvar_coordenada_mapa_saude_indigena(
  p_alvo jsonb,
  p_latitude double precision,
  p_longitude double precision,
  p_latitude_anterior double precision,
  p_longitude_anterior double precision,
  p_motivo text,
  p_conferido boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_master() then
    raise exception using errcode = '42501', message = 'Somente administrador pode corrigir coordenadas.';
  end if;
  return private."FC_APLICAR_COORDENADA_MAPA"(
    p_alvo, p_latitude, p_longitude, p_latitude_anterior, p_longitude_anterior, p_motivo,
    case when coalesce(p_conferido, false) then 'CONFERENCIA' else 'CORRECAO' end,
    case when coalesce(p_conferido, false) then 'S' end,
    null);
end;
$$;

-- public.desfazer_coordenada_mapa_saude_indigena como em 20261002160000.
create or replace function public.desfazer_coordenada_mapa_saude_indigena(p_historico bigint, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v private."TH_COORDENADA_MAPA_SAUDE_INDIG"%rowtype;
begin
  if auth.uid() is null or not private.is_master() then
    raise exception using errcode = '42501', message = 'Somente administrador pode corrigir coordenadas.';
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
    raise exception using errcode = '40001', message = 'Só a última correção do ponto pode ser desfeita. Atualize o mapa.';
  end if;
  if v."CG_LATITUDE_ANTERIOR" is null or v."CG_LONGITUDE_ANTERIOR" is null then
    raise exception using errcode = '22023', message = 'O ponto não tinha coordenada antes; corrija a posição.';
  end if;
  return private."FC_APLICAR_COORDENADA_MAPA"(
    v."DS_ALVO", v."CG_LATITUDE_ANTERIOR", v."CG_LONGITUDE_ANTERIOR", v."CG_LATITUDE", v."CG_LONGITUDE",
    p_motivo, 'DESFAZER', v."ST_CONFERIDO_ANTERIOR", v."CO_SEQ_HISTORICO");
end;
$$;

-- public.listar_historico_coordenada_mapa_saude_indigena como em 20261002160000.
create or replace function public.listar_historico_coordenada_mapa_saude_indigena(p_alvo jsonb, p_limite integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_master() then
    raise exception using errcode = '42501', message = 'Somente administrador pode ver o histórico das coordenadas.';
  end if;
  if jsonb_typeof(p_alvo) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Ponto do mapa inválido.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', h."CO_SEQ_HISTORICO",
             'em', h."DT_ALTERACAO",
             'por', coalesce(u.nome, u.email),
             'acao', h."TP_ACAO",
             'latitude_anterior', h."CG_LATITUDE_ANTERIOR",
             'longitude_anterior', h."CG_LONGITUDE_ANTERIOR",
             'latitude', h."CG_LATITUDE",
             'longitude', h."CG_LONGITUDE",
             'motivo', h."DS_MOTIVO",
             'conferido', case h."ST_CONFERIDO" when 'S' then true when 'N' then false end,
             'desfaz', h."CO_HISTORICO_DESFEITO",
             'desfeito', exists (select 1 from private."TH_COORDENADA_MAPA_SAUDE_INDIG" d
                                  where d."CO_HISTORICO_DESFEITO" = h."CO_SEQ_HISTORICO"))
           order by h."CO_SEQ_HISTORICO" desc)
      from (select t.* from private."TH_COORDENADA_MAPA_SAUDE_INDIG" t
             where private."FC_CHAVE_ALVO_COORDENADA"(t."DS_ALVO") = private."FC_CHAVE_ALVO_COORDENADA"(p_alvo)
             order by t."CO_SEQ_HISTORICO" desc
             limit least(greatest(coalesce(p_limite, 5), 1), 50)) h
      left join public."TB_PERFIL_USUARIO" u on u.user_id = h."CO_USUARIO"), '[]'::jsonb);
end;
$$;

-- public.listar_pendencias_coordenada_mapa_saude_indigena como em 20261002160000.
create or replace function public.listar_pendencias_coordenada_mapa_saude_indigena()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_master() then
    raise exception using errcode = '42501', message = 'Somente administrador pode ver as pendências das coordenadas.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'fonte', p."TP_FONTE", 'tipo', p."TP_PONTO", 'dsei', p."NO_DSEI", 'codigo', p."CO_PONTO",
             'nome', p."NO_PONTO", 'municipio', p."NO_MUNICIPIO",
             'motivo_tipo', p."TP_MOTIVO", 'motivo', p."DS_MOTIVO",
             'conferido', p."ST_CONFERIDO" = 'S', 'conferido_em', p."DT_CONFERENCIA",
             'candidatos', p."DS_CANDIDATO")
           order by p."NO_DSEI", p."NO_PONTO")
      from private."TB_PENDENCIA_COORDENADA_MAPA" p), '[]'::jsonb);
end;
$$;

-- private."FC_APLICAR_COORDENADA_LOCAL" como em 20261002190000.
create or replace function private."FC_APLICAR_COORDENADA_LOCAL"(
  p_lugar text,
  p_latitude double precision,
  p_longitude double precision,
  p_latitude_anterior double precision,
  p_longitude_anterior double precision,
  p_motivo text,
  p_acao text,
  p_conferido text,
  p_historico_desfeito bigint
) returns jsonb
language plpgsql
set search_path = ''
as $$
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
  if auth.uid() is null or not private.is_master() then
    raise exception using errcode = '42501', message = 'Somente administrador pode corrigir coordenadas.';
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
    raise exception using errcode = '40001', message = 'O lugar mudou. Atualize o mapa e tente novamente.';
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
$$;

-- public.salvar_coordenada_mapa_projetos como em 20261002190000.
create or replace function public.salvar_coordenada_mapa_projetos(
  p_lugar text,
  p_latitude double precision,
  p_longitude double precision,
  p_latitude_anterior double precision,
  p_longitude_anterior double precision,
  p_motivo text,
  p_conferido boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_master() then
    raise exception using errcode = '42501', message = 'Somente administrador pode corrigir coordenadas.';
  end if;
  return private."FC_APLICAR_COORDENADA_LOCAL"(
    p_lugar, p_latitude, p_longitude, p_latitude_anterior, p_longitude_anterior, p_motivo,
    case when coalesce(p_conferido, false) then 'CONFERENCIA' else 'CORRECAO' end,
    case when coalesce(p_conferido, false) then 'S' end,
    null);
end;
$$;

-- public.desfazer_coordenada_mapa_projetos como em 20261002190000.
create or replace function public.desfazer_coordenada_mapa_projetos(p_historico bigint, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v private."TH_COORDENADA_LOCAL_VAGA"%rowtype;
begin
  if auth.uid() is null or not private.is_master() then
    raise exception using errcode = '42501', message = 'Somente administrador pode corrigir coordenadas.';
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
    raise exception using errcode = '40001', message = 'Só a última correção do lugar pode ser desfeita. Atualize o mapa.';
  end if;
  if v."CG_LATITUDE_ANTERIOR" is null or v."CG_LONGITUDE_ANTERIOR" is null then
    raise exception using errcode = '22023', message = 'O lugar não tinha coordenada antes; corrija a posição.';
  end if;
  return private."FC_APLICAR_COORDENADA_LOCAL"(
    v."DS_CHAVE_LUGAR", v."CG_LATITUDE_ANTERIOR", v."CG_LONGITUDE_ANTERIOR", v."CG_LATITUDE", v."CG_LONGITUDE",
    p_motivo, 'DESFAZER', v."ST_CONFERIDO_ANTERIOR", v."CO_SEQ_HISTORICO");
end;
$$;

-- public.listar_historico_coordenada_mapa_projetos como em 20261002190000.
create or replace function public.listar_historico_coordenada_mapa_projetos(p_lugar text, p_limite integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_master() then
    raise exception using errcode = '42501', message = 'Somente administrador pode ver o histórico das coordenadas.';
  end if;
  if nullif(btrim(p_lugar), '') is null then
    raise exception using errcode = '22023', message = 'Lugar do mapa inválido.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', h."CO_SEQ_HISTORICO",
             'em', h."DT_ALTERACAO",
             'por', coalesce(u.nome, u.email),
             'acao', h."TP_ACAO",
             'latitude_anterior', h."CG_LATITUDE_ANTERIOR",
             'longitude_anterior', h."CG_LONGITUDE_ANTERIOR",
             'latitude', h."CG_LATITUDE",
             'longitude', h."CG_LONGITUDE",
             'motivo', h."DS_MOTIVO",
             'conferido', case h."ST_CONFERIDO" when 'S' then true when 'N' then false end,
             'desfaz', h."CO_HISTORICO_DESFEITO",
             'desfeito', exists (select 1 from private."TH_COORDENADA_LOCAL_VAGA" d
                                  where d."CO_HISTORICO_DESFEITO" = h."CO_SEQ_HISTORICO"))
           order by h."CO_SEQ_HISTORICO" desc)
      from (select t.* from private."TH_COORDENADA_LOCAL_VAGA" t
             where t."DS_CHAVE_LUGAR" = p_lugar
             order by t."CO_SEQ_HISTORICO" desc
             limit least(greatest(coalesce(p_limite, 5), 1), 50)) h
      left join public."TB_PERFIL_USUARIO" u on u.user_id = h."CO_USUARIO"), '[]'::jsonb);
end;
$$;

-- public.listar_pendencias_coordenada_mapa_projetos como em 20261002190000.
create or replace function public.listar_pendencias_coordenada_mapa_projetos()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_master() then
    raise exception using errcode = '42501', message = 'Somente administrador pode ver as pendências das coordenadas.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'lugar', p."DS_CHAVE_LUGAR", 'nome', p."NO_LUGAR", 'uf', p."SG_UF", 'codigo_ibge', p."CO_MUNICIPIO_IBGE",
             'motivo_tipo', p."TP_MOTIVO", 'motivo', p."DS_MOTIVO",
             'conferido', p."ST_CONFERIDO" = 'S', 'conferido_em', p."DT_CONFERENCIA",
             'candidatos', p."DS_CANDIDATO")
           order by p."SG_UF", p."NO_LUGAR")
      from private."TB_PENDENCIA_COORDENADA_LOCAL" p), '[]'::jsonb);
end;
$$;

comment on function private."FC_APLICAR_COORDENADA_MAPA"(jsonb, double precision, double precision, double precision, double precision, text, text, text, bigint) is 'Grava uma alteração de coordenada do mapa (correção, conferência ou desfazer): admin global, limites do Brasil, motivo, identidade e posição anterior; atualiza a pendência e registra o histórico. Só chamada pelas RPCs do editor.';
comment on function public.salvar_coordenada_mapa_saude_indigena(jsonb, double precision, double precision, double precision, double precision, text, boolean) is 'Corrige um ponto existente do mapa e/ou, com p_conferido, marca o ponto pendente como conferido (a posição pode ficar igual). Só administrador global; confere identidade e posição anterior e registra o histórico privado.';
comment on function public.desfazer_coordenada_mapa_saude_indigena(bigint, text) is 'Volta a última alteração de um ponto do mapa (posição e conferência) como uma alteração nova, com motivo; nada do histórico é apagado. Só administrador global.';
comment on function public.listar_historico_coordenada_mapa_saude_indigena(jsonb, integer) is 'Últimas alterações de um ponto do mapa (quem, quando, de/para, motivo, ação, se foi desfeita). Só administrador global.';
comment on function public.listar_pendencias_coordenada_mapa_saude_indigena() is 'Pendências de localização do mapa (pontos não confirmados pela auditoria), com candidatos e situação. Só administrador global.';
comment on function private."FC_APLICAR_COORDENADA_LOCAL"(text, double precision, double precision, double precision, double precision, text, text, text, bigint) is 'Grava uma alteração de coordenada de um lugar do mapa de Projetos (correção, conferência ou desfazer): admin global, limites do Brasil, motivo, lugar existente e posição anterior (tolerância 1e-9); atualiza a pendência e registra o histórico. Só chamada pelas RPCs do editor.';
comment on function public.salvar_coordenada_mapa_projetos(text, double precision, double precision, double precision, double precision, text, boolean) is 'Corrige a coordenada de um lugar do mapa de Projetos (cria a linha se o lugar ainda não tinha) e/ou, com p_conferido, marca o lugar pendente como conferido (a posição pode ficar igual). Só administrador global; confere a posição anterior e registra o histórico privado.';
comment on function public.desfazer_coordenada_mapa_projetos(bigint, text) is 'Volta a última alteração de um lugar do mapa de Projetos (posição e conferência) como uma alteração nova, com motivo; nada do histórico é apagado. Só administrador global.';
comment on function public.listar_historico_coordenada_mapa_projetos(text, integer) is 'Últimas alterações de um lugar do mapa de Projetos (quem, quando, de/para, motivo, ação, se foi desfeita). Só administrador global.';
comment on function public.listar_pendencias_coordenada_mapa_projetos() is 'Pendências de localização dos lugares do mapa de Projetos, com candidatos e situação. Só administrador global.';
comment on column private."TH_COORDENADA_MAPA_SAUDE_INDIG"."CO_USUARIO" is 'Quem alterou (auth.users.id), sempre administrador global.';
comment on column private."TB_PENDENCIA_COORDENADA_MAPA"."ST_CONFERIDO" is 'S quando um administrador global conferiu a posição (com ou sem mudar); N enquanto pendente.';
comment on column public."TB_COORDENADA_LOCAL_VAGA"."TP_ORIGEM" is 'De onde veio a posição: SEDE_IBGE (sede municipal do IBGE), CENTRO_UF (média das sedes municipais da UF) ou MANUAL (gravada por um administrador global no editor).';
comment on column private."TB_PENDENCIA_COORDENADA_LOCAL"."ST_CONFERIDO" is 'S quando um administrador global conferiu a posição (com ou sem mudar); N enquanto pendente.';
comment on column private."TH_COORDENADA_LOCAL_VAGA"."CO_USUARIO" is 'Quem alterou (auth.users.id), sempre administrador global.';

drop function if exists private."FC_PODE_EDITAR_COORDENADA"();

-- Último acesso volta ao último login (corpos de 20260930130000 e 20260930180000).
CREATE OR REPLACE FUNCTION public.obter_matriz_acessos(p_busca text DEFAULT ''::text, p_offset integer DEFAULT 0, p_coordenacao text DEFAULT ''::text, p_grupo text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_gestor text := private."FC_EXIGIR_GESTOR_DE_ACESSOS"();
  v_busca text := left(coalesce(p_busca, ''), 100);
  v_filtro text := coalesce(p_coordenacao, '');
  v_eu public."TB_PERFIL_USUARIO" := private.current_profile();
  resultado jsonb;
begin
  -- Coordenador vê só a própria coordenação, qualquer que seja o filtro pedido.
  if v_gestor = 'coordenador' then v_filtro := private."FC_COORDENACAO_USUARIO"(); end if;

  with filtrados as (
    select u.* from public."TB_PERFIL_USUARIO" u
     where u.ativo
       and (coalesce(u.nome, '') ilike '%' || v_busca || '%' or u.email ilike '%' || v_busca || '%')
       and (v_filtro = '' or (v_filtro = '__sem__' and u."CO_COORDENACAO" is null) or u."CO_COORDENACAO" = v_filtro)
       and (coalesce(p_grupo, '') = '' or u.perfil = p_grupo)
  ), usuarios as (
    select f.* from filtrados f order by lower(f.email), f.id limit 30 offset greatest(p_offset, 0)
  ), recursos as (
    select m recurso from unnest(private."FC_RECURSOS_MODULO"()) m
    union all select 'painel:' || id from public."TB_PAINEL_EXTERNO" where ativo
    union all select 'area:' || a."CO_AREA" from public."TB_AREA" a
  )
  select jsonb_build_object(
    'usuarios', coalesce((select jsonb_agg(jsonb_build_object(
        'id', u.id, 'user_id', u.user_id, 'email', u.email, 'nome', u.nome, 'grupo', u.perfil, 'ativo', u.ativo,
        'coordenacao', u."CO_COORDENACAO",
        'revisao_conta', u.updated_at::text,
        'cadastrado_em', u.created_at,
        'ultimo_acesso', (select max(au.last_sign_in_at) from auth.users au
                           where au.id = u.user_id or lower(au.email) = lower(u.email)),
        'convite_pendente', not exists (select 1 from auth.users au
                                         where (au.id = u.user_id or lower(au.email) = lower(u.email))
                                           and au.last_sign_in_at is not null),
        'admin_global', coalesce((select a."ST_ADMIN_GLOBAL" from public."TB_GRUPO_ACESSO" a where a."CO_GRUPO_ACESSO" = u.perfil), false),
        'areas_efetivas', to_jsonb(private."FC_AREAS_DO_PERFIL"(u.id)),
        'permissoes', (select jsonb_object_agg(r.recurso,
            case when r.recurso like 'area:%' then jsonb_build_object(
                'nivel', case when exists (select 1 from public."RL_PERFIL_USUARIO_AREA" x
                                            where x."CO_PERFIL_USUARIO" = u.id and 'area:' || x."CO_AREA" = r.recurso)
                              then 'leitor' else 'sem_acesso' end,
                'origem', 'excecao', 'nivel_grupo', 'sem_acesso', 'revisao', 0)
            else jsonb_build_object(
                'nivel', coalesce(g.nivel, private."FC_NIVEL_DO_GRUPO"(u.perfil, r.recurso)),
                'origem', case when g.nivel is null then 'grupo' else 'excecao' end,
                'nivel_grupo', private."FC_NIVEL_DO_GRUPO"(u.perfil, r.recurso),
                'revisao', coalesce(g.revisao, 0))
            end)
          from recursos r
          left join public."TB_PERMISSAO_RECURSO" g on g.perfil_usuario_id = u.id and g.recurso = r.recurso)
      ) order by lower(u.email), u.id) from usuarios u), '[]'::jsonb),
    'total', (select count(*) from filtrados),
    'areas', coalesce((select jsonb_agg(jsonb_build_object('id', a."CO_AREA", 'titulo', a."NO_AREA") order by a."NU_ORDEM") from public."TB_AREA" a), '[]'::jsonb),
    'paineis', coalesce((select jsonb_agg(to_jsonb(e) order by e.ordem, e.titulo) from public."TB_PAINEL_EXTERNO" e where e.ativo), '[]'::jsonb),
    'grupos', coalesce((select jsonb_agg(private."FC_GRUPO_ACESSO_JSON"(a."CO_GRUPO_ACESSO") order by a."NU_ORDEM", a."NO_GRUPO_ACESSO")
                          from public."TB_GRUPO_ACESSO" a), '[]'::jsonb),
    'coordenacoes', coalesce((select jsonb_agg(private."FC_COORDENACAO_JSON"(c."CO_COORDENACAO") order by c."NO_COORDENACAO")
                                from public."TB_COORDENACAO" c
                               where v_gestor = 'admin' or c."CO_COORDENACAO" = private."FC_COORDENACAO_USUARIO"()), '[]'::jsonb),
    'teto', jsonb_build_object(
        'admin_global', v_gestor = 'admin',
        'usuario_id', v_eu.id,
        'coordenacao', private."FC_COORDENACAO_USUARIO"(),
        'niveis', (select jsonb_object_agg(m, private."FC_TETO_DO_GESTOR"(m)) from unnest(private."FC_RECURSOS_MODULO"()) m),
        'paineis', coalesce((select jsonb_agg(e.id::text) from public."TB_PAINEL_EXTERNO" e
                              where e.ativo and (v_gestor = 'admin' or private.pode_recurso('painel:' || e.id))), '[]'::jsonb)),
    'historico', coalesce((select jsonb_agg(to_jsonb(h)) from (
        select h.*, u.email, autor.email autor
          from public."TH_PERMISSAO_RECURSO" h
          left join public."TB_PERFIL_USUARIO" u on u.id = h.perfil_usuario_id
          left join lateral (select a.email from public."TB_PERFIL_USUARIO" a where a.user_id = h.alterado_por order by a.updated_at desc limit 1) autor on true
         where v_gestor = 'admin' or u."CO_COORDENACAO" = private."FC_COORDENACAO_USUARIO"()
         order by h.alterado_em desc, h.id desc limit 50) h), '[]'::jsonb)
  ) into resultado;
  return resultado;
end;
$function$;
comment on function public.obter_matriz_acessos(text, integer, text, text) is null;

create or replace function public.listar_contas_desativadas(p_busca text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_busca text := left(coalesce(p_busca, ''), 100);
begin
  if not private.is_master() then
    raise exception 'Somente o administrador global vê as contas desativadas' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'contas', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', u.id, 'email', u.email, 'nome', u.nome,
          'grupo', u.perfil,
          'grupo_nome', (select g."NO_GRUPO_ACESSO" from public."TB_GRUPO_ACESSO" g where g."CO_GRUPO_ACESSO" = u.perfil),
          'coordenacao', u."CO_COORDENACAO",
          'areas', coalesce((select jsonb_agg(r."CO_AREA" order by r."CO_AREA")
                               from public."RL_PERFIL_USUARIO_AREA" r where r."CO_PERFIL_USUARIO" = u.id), '[]'::jsonb),
          'desativada_em', coalesce(h.alterado_em, u.updated_at),
          'desativada_por', h.autor,
          'motivo', h.motivo,
          'pedido_pendente', exists (
            select 1 from public."TB_SOLICITACAO_ACESSO" s
             where s.status = 'pendente'
               and ((u.user_id is not null and s.user_id = u.user_id) or lower(s.email) = lower(u.email))),
          'ultimo_acesso', (select max(au.last_sign_in_at) from auth.users au
                             where au.id = u.user_id or lower(au.email) = lower(u.email))
        ) order by coalesce(h.alterado_em, u.updated_at) desc)
        from public."TB_PERFIL_USUARIO" u
        left join lateral (
          select t.alterado_em, t.motivo,
                 (select a.email from public."TB_PERFIL_USUARIO" a where a.user_id = t.alterado_por limit 1) autor
            from public."TH_PERMISSAO_RECURSO" t
           where t.perfil_usuario_id = u.id and t.recurso = '#conta'
           order by t.alterado_em desc limit 1) h on true
       where not u.ativo
         and (coalesce(u.nome, '') ilike '%' || v_busca || '%' or u.email ilike '%' || v_busca || '%')
    ), '[]'::jsonb)
  );
end;
$function$;
comment on function public.listar_contas_desativadas(text) is
  'Aba Desativadas de Acessos (só administrador global): quando, por quem e por que cada conta foi desativada, grupo/coordenação/áreas de antes e se há pedido de reativação pendente.';

drop function if exists private."FC_ULTIMO_ACESSO"(uuid, text);
drop index if exists public."IN_TLEVENTOACESSO_USUARIO_DATA";

commit;
