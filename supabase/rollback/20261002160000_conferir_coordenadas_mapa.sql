-- Desfaz 20261002160000_conferir_coordenadas_mapa.sql: volta a RPC de 20261002143323 (sem conferência),
-- tira pendências, RPCs novas e colunas novas do histórico e devolve os nomes antigos.
-- As coordenadas gravadas no lmap/rede_cnes ficam como estão; as linhas do histórico também
-- (perdem só ação/situação). Rode antes o rollback da carga, se quiser guardar as pendências à parte.
begin;

drop function if exists public.listar_pendencias_coordenada_mapa_saude_indigena();
drop function if exists public.listar_historico_coordenada_mapa_saude_indigena(jsonb, integer);
drop function if exists public.desfazer_coordenada_mapa_saude_indigena(bigint, text);
drop function if exists public.salvar_coordenada_mapa_saude_indigena(jsonb, double precision, double precision, double precision, double precision, text, boolean);
drop function if exists private."FC_APLICAR_COORDENADA_MAPA"(jsonb, double precision, double precision, double precision, double precision, text, text, text, bigint);
drop table if exists private."TB_PENDENCIA_COORDENADA_MAPA";
drop function if exists private."FC_CHAVE_ALVO_COORDENADA"(jsonb);

alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG"
  drop constraint if exists "UK_THCOORD_DESFEITO",
  drop constraint if exists "FK_THCOORD_DESFEITO",
  drop constraint if exists "CK_THCOORD_ALVO",
  drop constraint if exists "CK_THCOORD_DESFEITO",
  drop constraint if exists "CK_THCOORD_CONFERIDO",
  drop constraint if exists "CK_THCOORD_ACAO",
  drop column if exists "CO_HISTORICO_DESFEITO",
  drop column if exists "ST_CONFERIDO",
  drop column if exists "ST_CONFERIDO_ANTERIOR",
  drop column if exists "TP_ACAO";
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename constraint "PK_TH_COORD_MAPA_SAUDE_INDIG" to "TH_COORDENADA_MAPA_SAUDE_INDIG_pkey";
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename column "CO_SEQ_HISTORICO" to "ID_HISTORICO";
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename column "CO_USUARIO" to "ID_USUARIO";
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename column "DT_ALTERACAO" to "DH_ALTERACAO";
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename column "DS_ALVO" to "JS_ALVO";
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename column "CG_LATITUDE_ANTERIOR" to "NU_LATITUDE_ANTERIOR";
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename column "CG_LONGITUDE_ANTERIOR" to "NU_LONGITUDE_ANTERIOR";
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename column "CG_LATITUDE" to "NU_LATITUDE";
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename column "CG_LONGITUDE" to "NU_LONGITUDE";

-- A função de 20261002143323, sem mudança.
create or replace function public.salvar_coordenada_mapa_saude_indigena(
  p_alvo jsonb,
  p_latitude double precision,
  p_longitude double precision,
  p_latitude_anterior double precision,
  p_longitude_anterior double precision,
  p_motivo text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_payload jsonb;
  v_ponto jsonb;
  v_caminho text[];
  v_fonte text := p_alvo->>'fonte';
  v_tipo text := p_alvo->>'tipo';
  v_dsei text := p_alvo->>'dsei';
  v_indice integer;
  v_dsei_indice integer;
  v_nome text;
  v_codigo text;
  v_lat double precision;
  v_lon double precision;
  v_agora timestamptz := clock_timestamp();
begin
  if auth.uid() is null or not private.is_master() then
    raise exception using errcode = '42501', message = 'Somente administrador pode corrigir coordenadas.';
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
     or not ((v_fonte = 'lmap' and v_tipo in ('sede','polo','casai'))
          or (v_fonte = 'rede_cnes' and v_tipo in ('u','c','nac')))
     or coalesce(p_alvo->>'indice','') !~ '^[0-9]{1,6}$'
     or nullif(p_alvo->>'nome','') is null then
    raise exception using errcode = '22023', message = 'Ponto do mapa inválido.';
  end if;
  v_indice := (p_alvo->>'indice')::integer;
  select payload into v_payload from public."TB_CONFIG_MAPA_SAUDE_INDIG"
    where chave = v_fonte for update;
  if not found then raise exception 'Cadastro do mapa não encontrado.'; end if;
  if v_fonte = 'lmap' and v_tipo = 'sede' then
    v_caminho := array['dsei',v_indice::text];
    if (v_payload #> v_caminho)->>'k' is distinct from v_dsei then
      raise exception using errcode = '40001', message = 'O ponto mudou. Atualize o mapa e tente novamente.';
    end if;
  elsif v_fonte = 'lmap' and v_tipo = 'polo' then
    select (ordinality-1)::integer into v_dsei_indice
      from jsonb_array_elements(v_payload->'dsei') with ordinality d
      where d.value->>'k' = v_dsei;
    if v_dsei_indice is null then raise exception 'DSEI não encontrado.'; end if;
    v_caminho := array['dsei',v_dsei_indice::text,'polos',v_indice::text];
  elsif v_fonte = 'lmap' then
    v_caminho := array['casai',v_indice::text];
  elsif v_tipo = 'nac' then
    v_caminho := array['nac',v_indice::text];
  else
    if nullif(v_dsei,'') is null then raise exception 'DSEI não informado.'; end if;
    v_caminho := array['rede',v_dsei,v_tipo,v_indice::text];
  end if;
  v_ponto := v_payload #> v_caminho;
  if v_fonte = 'rede_cnes' then
    v_nome := v_ponto->>0;
    v_codigo := v_ponto->>1;
    v_lat := (v_ponto->>2)::double precision;
    v_lon := (v_ponto->>3)::double precision;
  else
    v_nome := v_ponto->>'n';
    v_codigo := case when v_tipo = 'polo' then v_ponto->>'cod' else null end;
    v_lat := (v_ponto->>'lat')::double precision;
    v_lon := (v_ponto->>'lon')::double precision;
  end if;
  if v_ponto is null or v_nome is distinct from p_alvo->>'nome'
     or v_codigo is distinct from p_alvo->>'codigo'
     or v_lat is distinct from p_latitude_anterior
     or v_lon is distinct from p_longitude_anterior then
    raise exception using errcode = '40001', message = 'O ponto mudou. Atualize o mapa e tente novamente.';
  end if;
  if v_lat is not distinct from p_latitude and v_lon is not distinct from p_longitude then
    raise exception using errcode = '22023', message = 'A coordenada não mudou.';
  end if;
  if v_fonte = 'rede_cnes' then
    v_payload := jsonb_set(jsonb_set(v_payload, v_caminho || array['2'], to_jsonb(p_latitude), false),
      v_caminho || array['3'], to_jsonb(p_longitude), false);
  else
    v_payload := jsonb_set(jsonb_set(v_payload, v_caminho || array['lat'], to_jsonb(p_latitude), true),
      v_caminho || array['lon'], to_jsonb(p_longitude), true);
  end if;
  insert into private."TH_COORDENADA_MAPA_SAUDE_INDIG"
    ("ID_USUARIO","JS_ALVO","NU_LATITUDE_ANTERIOR","NU_LONGITUDE_ANTERIOR","NU_LATITUDE","NU_LONGITUDE","DS_MOTIVO")
    values (auth.uid(),p_alvo,v_lat,v_lon,p_latitude,p_longitude,btrim(p_motivo));
  update public."TB_CONFIG_MAPA_SAUDE_INDIG" set payload = v_payload, updated_at = v_agora
    where chave = v_fonte;
  return jsonb_build_object('alvo',p_alvo,'latitude',p_latitude,'longitude',p_longitude,'alterado_em',v_agora,
    'lmap',(select payload from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave='lmap'),
    'rede_cnes',(select payload from public."TB_CONFIG_MAPA_SAUDE_INDIG" where chave='rede_cnes'));
end;
$$;
revoke all on function public.salvar_coordenada_mapa_saude_indigena(jsonb,double precision,double precision,double precision,double precision,text) from public, anon;
grant execute on function public.salvar_coordenada_mapa_saude_indigena(jsonb,double precision,double precision,double precision,double precision,text) to authenticated;
comment on function public.salvar_coordenada_mapa_saude_indigena(jsonb,double precision,double precision,double precision,double precision,text) is 'Corrige um ponto existente do mapa somente como administrador global; verifica identidade, posição anterior e registra histórico privado.';

commit;
