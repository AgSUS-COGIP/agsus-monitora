/*
  CONFERIR AS COORDENADAS DO MAPA DA SAÚDE INDÍGENA (FILA DO EDITOR)

  Evolui o editor de 20261002143323_editar_coordenadas_mapa_admin.sql, sem
  estrutura paralela: os pontos continuam só em TB_CONFIG_MAPA_SAUDE_INDIG
  (lmap / rede_cnes) e toda mudança passa pela mesma função e pelo mesmo
  histórico (private."TH_COORDENADA_MAPA_SAUDE_INDIG").

  1. Histórico no padrão MAD (colunas renomeadas: CO_SEQ_, CO_, DT_, DS_, CG_;
     PK nomeada) e três colunas novas: a ação (CORRECAO, CONFERENCIA,
     DESFAZER), a situação de conferência antes/depois e a correção desfeita.
  2. private."TB_PENDENCIA_COORDENADA_MAPA": os pontos que a auditoria de
     01–02/10/2026 não confirmou (carga em supabase/correcoes/20261002-
     pendencias-das-coordenadas-do-mapa.sql), com as posições candidatas e a
     situação (ST_CONFERIDO). Só as RPCs leem; nada de acesso direto.
  3. private."FC_APLICAR_COORDENADA_MAPA": o corpo único de gravação (admin
     global, limites do Brasil, motivo de 10 a 1000 caracteres, identidade do
     ponto e concorrência pela posição anterior), usado por:
     - salvar_coordenada_mapa_saude_indigena(…, p_conferido): corrige e/ou
       marca o ponto pendente como conferido (com ou sem mudar a posição);
     - desfazer_coordenada_mapa_saude_indigena(p_historico, p_motivo): só a
       última correção do ponto; vira uma correção nova, nada é apagado.
  4. listar_pendencias_… e listar_historico_…: leitura só para admin global.

  Rollback: supabase/rollback/20261002160000_conferir_coordenadas_mapa.sql.
  Ensaio (begin … rollback): supabase/ensaios/20261002160000_conferir_coordenadas_mapa.sql.
*/
begin;

-- 0. Pré-requisito ---------------------------------------------------------------------
do $$
begin
  if to_regclass('private."TH_COORDENADA_MAPA_SAUDE_INDIG"') is null
     or to_regprocedure('public.salvar_coordenada_mapa_saude_indigena(jsonb,double precision,double precision,double precision,double precision,text)') is null then
    raise exception 'Aplique antes 20261002143323_editar_coordenadas_mapa_admin.sql.';
  end if;
end;
$$;

-- 1. Histórico: nomes MAD, ação e situação ---------------------------------------------
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename column "ID_HISTORICO" to "CO_SEQ_HISTORICO";
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename column "ID_USUARIO" to "CO_USUARIO";
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename column "DH_ALTERACAO" to "DT_ALTERACAO";
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename column "JS_ALVO" to "DS_ALVO";
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename column "NU_LATITUDE_ANTERIOR" to "CG_LATITUDE_ANTERIOR";
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename column "NU_LONGITUDE_ANTERIOR" to "CG_LONGITUDE_ANTERIOR";
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename column "NU_LATITUDE" to "CG_LATITUDE";
alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename column "NU_LONGITUDE" to "CG_LONGITUDE";

do $$
declare
  v_pk text;
begin
  select c.conname into v_pk
    from pg_constraint c
   where c.conrelid = 'private."TH_COORDENADA_MAPA_SAUDE_INDIG"'::regclass and c.contype = 'p';
  if v_pk is distinct from 'PK_TH_COORD_MAPA_SAUDE_INDIG' then
    execute format('alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG" rename constraint %I to "PK_TH_COORD_MAPA_SAUDE_INDIG"', v_pk);
  end if;
end;
$$;

alter table private."TH_COORDENADA_MAPA_SAUDE_INDIG"
  add column "TP_ACAO" varchar(11) not null default 'CORRECAO',
  add column "ST_CONFERIDO_ANTERIOR" varchar(1),
  add column "ST_CONFERIDO" varchar(1),
  add column "CO_HISTORICO_DESFEITO" bigint,
  add constraint "CK_THCOORD_ACAO" check ("TP_ACAO" in ('CORRECAO', 'CONFERENCIA', 'DESFAZER')),
  add constraint "CK_THCOORD_CONFERIDO" check (
    coalesce("ST_CONFERIDO", 'S') in ('S', 'N') and coalesce("ST_CONFERIDO_ANTERIOR", 'S') in ('S', 'N')),
  add constraint "CK_THCOORD_DESFEITO" check (("TP_ACAO" = 'DESFAZER') = ("CO_HISTORICO_DESFEITO" is not null)),
  add constraint "CK_THCOORD_ALVO" check (jsonb_typeof("DS_ALVO") = 'object'),
  add constraint "FK_THCOORD_DESFEITO" foreign key ("CO_HISTORICO_DESFEITO")
    references private."TH_COORDENADA_MAPA_SAUDE_INDIG" ("CO_SEQ_HISTORICO"),
  add constraint "UK_THCOORD_DESFEITO" unique ("CO_HISTORICO_DESFEITO");

comment on column private."TH_COORDENADA_MAPA_SAUDE_INDIG"."CO_SEQ_HISTORICO" is 'Identificador sequencial da alteração (identity).';
comment on column private."TH_COORDENADA_MAPA_SAUDE_INDIG"."CO_USUARIO" is 'Quem alterou (auth.users.id), sempre administrador global.';
comment on column private."TH_COORDENADA_MAPA_SAUDE_INDIG"."DT_ALTERACAO" is 'Data e hora da alteração.';
comment on column private."TH_COORDENADA_MAPA_SAUDE_INDIG"."DS_ALVO" is 'Identidade do ponto (JSON: fonte, tipo, dsei, indice, codigo, nome), como o editor enviou.';
comment on column private."TH_COORDENADA_MAPA_SAUDE_INDIG"."CG_LATITUDE_ANTERIOR" is 'Latitude antes da alteração (nula se o ponto não tinha coordenada).';
comment on column private."TH_COORDENADA_MAPA_SAUDE_INDIG"."CG_LONGITUDE_ANTERIOR" is 'Longitude antes da alteração (nula se o ponto não tinha coordenada).';
comment on column private."TH_COORDENADA_MAPA_SAUDE_INDIG"."CG_LATITUDE" is 'Latitude depois da alteração (igual à anterior numa conferência sem mudança de posição).';
comment on column private."TH_COORDENADA_MAPA_SAUDE_INDIG"."CG_LONGITUDE" is 'Longitude depois da alteração (igual à anterior numa conferência sem mudança de posição).';
comment on column private."TH_COORDENADA_MAPA_SAUDE_INDIG"."DS_MOTIVO" is 'Motivo e fonte da alteração (10 a 1000 caracteres).';
comment on column private."TH_COORDENADA_MAPA_SAUDE_INDIG"."TP_ACAO" is 'CORRECAO (mudou a posição), CONFERENCIA (marcou o ponto pendente como conferido, com ou sem mudar a posição) ou DESFAZER (voltou a última alteração).';
comment on column private."TH_COORDENADA_MAPA_SAUDE_INDIG"."ST_CONFERIDO_ANTERIOR" is 'Conferido (S/N) antes da alteração; nulo se o ponto não tem pendência.';
comment on column private."TH_COORDENADA_MAPA_SAUDE_INDIG"."ST_CONFERIDO" is 'Conferido (S/N) depois da alteração; nulo se o ponto não tem pendência.';
comment on column private."TH_COORDENADA_MAPA_SAUDE_INDIG"."CO_HISTORICO_DESFEITO" is 'Alteração que este DESFAZER voltou (cada uma só pode ser desfeita uma vez).';

-- Identidade do ponto para comparar alvos do histórico (sem depender da ordem das chaves).
create function private."FC_CHAVE_ALVO_COORDENADA"(p_alvo jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'fonte', p_alvo ->> 'fonte', 'tipo', p_alvo ->> 'tipo', 'dsei', p_alvo ->> 'dsei',
    'indice', p_alvo ->> 'indice', 'codigo', p_alvo ->> 'codigo', 'nome', p_alvo ->> 'nome');
$$;
revoke all on function private."FC_CHAVE_ALVO_COORDENADA"(jsonb) from public, anon, authenticated;
comment on function private."FC_CHAVE_ALVO_COORDENADA"(jsonb) is 'Identidade normalizada de um ponto do mapa (fonte, tipo, dsei, indice, codigo, nome) para achar o histórico dele.';

-- 2. Pendências da auditoria -----------------------------------------------------------
create table private."TB_PENDENCIA_COORDENADA_MAPA" (
  "CO_SEQ_PENDENCIA" bigint generated always as identity,
  "TP_FONTE" varchar(9) not null,
  "TP_PONTO" varchar(4) not null,
  "NO_DSEI" text not null,
  "CO_PONTO" varchar(20) not null,
  "NO_PONTO" text not null,
  "NO_MUNICIPIO" text,
  "TP_MOTIVO" varchar(20) not null,
  "DS_MOTIVO" text not null,
  "DS_CANDIDATO" jsonb not null default '[]'::jsonb,
  "ST_CONFERIDO" varchar(1) not null default 'N',
  "DT_CONFERENCIA" timestamptz,
  "CO_USUARIO_CONFERENCIA" uuid,
  "DT_CRIACAO" timestamptz not null default now(),
  constraint "PK_PENDENCIA_COORDENADA_MAPA" primary key ("CO_SEQ_PENDENCIA"),
  constraint "UK_PENDCOORD_PONTO" unique ("TP_FONTE", "TP_PONTO", "NO_DSEI", "CO_PONTO"),
  constraint "CK_PENDCOORD_PONTO" check (
    ("TP_FONTE" = 'lmap' and "TP_PONTO" = 'polo') or ("TP_FONTE" = 'rede_cnes' and "TP_PONTO" in ('u', 'c'))),
  constraint "CK_PENDCOORD_MOTIVO" check ("TP_MOTIVO" in (
    'FONTES_DIVERGEM', 'HOMONIMO_FORA', 'NOME_MUNICIPIO', 'PONTO_COLETOR',
    'SEDE_MUNICIPAL', 'SEM_CANDIDATO', 'UMA_FONTE', 'CNES', 'OUTRO')),
  constraint "CK_PENDCOORD_CANDIDATO" check (jsonb_typeof("DS_CANDIDATO") = 'array'),
  constraint "CK_PENDCOORD_CONFERIDO" check ("ST_CONFERIDO" in ('S', 'N')),
  constraint "CK_PENDCOORD_CONFERENCIA" check (
    ("ST_CONFERIDO" = 'S') = ("DT_CONFERENCIA" is not null)
    and ("ST_CONFERIDO" = 'S') = ("CO_USUARIO_CONFERENCIA" is not null))
);
alter table private."TB_PENDENCIA_COORDENADA_MAPA" enable row level security;
revoke all on private."TB_PENDENCIA_COORDENADA_MAPA" from public, anon, authenticated;
comment on table private."TB_PENDENCIA_COORDENADA_MAPA" is 'Pontos do mapa da Saúde Indígena que a auditoria de 01–02/10/2026 não confirmou, com posições candidatas e a conferência do administrador. Sem acesso direto: só as RPCs do editor.';
comment on column private."TB_PENDENCIA_COORDENADA_MAPA"."CO_SEQ_PENDENCIA" is 'Identificador sequencial da pendência (identity).';
comment on column private."TB_PENDENCIA_COORDENADA_MAPA"."TP_FONTE" is 'Chave de TB_CONFIG_MAPA_SAUDE_INDIG onde o ponto está: lmap ou rede_cnes.';
comment on column private."TB_PENDENCIA_COORDENADA_MAPA"."TP_PONTO" is 'Tipo do ponto na fonte: polo (lmap.dsei[].polos), u (rede_cnes.rede[DSEI].u) ou c (CASAI).';
comment on column private."TB_PENDENCIA_COORDENADA_MAPA"."NO_DSEI" is 'Chave do DSEI na fonte (lmap.dsei[].k / chave de rede_cnes.rede).';
comment on column private."TB_PENDENCIA_COORDENADA_MAPA"."CO_PONTO" is 'Código do ponto na fonte: cod do polo (lmap) ou CNES (rede_cnes).';
comment on column private."TB_PENDENCIA_COORDENADA_MAPA"."NO_PONTO" is 'Nome do ponto na fonte, na data da carga.';
comment on column private."TB_PENDENCIA_COORDENADA_MAPA"."NO_MUNICIPIO" is 'Município/UF oficial do ponto, quando a auditoria o conhecia.';
comment on column private."TB_PENDENCIA_COORDENADA_MAPA"."TP_MOTIVO" is 'Por que a auditoria não confirmou: FONTES_DIVERGEM, HOMONIMO_FORA, NOME_MUNICIPIO, PONTO_COLETOR, SEDE_MUNICIPAL, SEM_CANDIDATO, UMA_FONTE, CNES ou OUTRO.';
comment on column private."TB_PENDENCIA_COORDENADA_MAPA"."DS_MOTIVO" is 'Explicação da auditoria para a pendência.';
comment on column private."TB_PENDENCIA_COORDENADA_MAPA"."DS_CANDIDATO" is 'Posições candidatas (JSON array de {f: fonte CNES/IBGE/FUNAI/OSM/PDSI, n: nome encontrado, lat, lon, ti: terra indígena}). A distância é calculada na tela.';
comment on column private."TB_PENDENCIA_COORDENADA_MAPA"."ST_CONFERIDO" is 'S quando um administrador global conferiu a posição (com ou sem mudar); N enquanto pendente.';
comment on column private."TB_PENDENCIA_COORDENADA_MAPA"."DT_CONFERENCIA" is 'Data e hora da conferência (nula enquanto pendente).';
comment on column private."TB_PENDENCIA_COORDENADA_MAPA"."CO_USUARIO_CONFERENCIA" is 'Quem conferiu (auth.users.id); nulo enquanto pendente.';
comment on column private."TB_PENDENCIA_COORDENADA_MAPA"."DT_CRIACAO" is 'Data e hora da carga da pendência.';

-- 3. Corpo único de gravação -----------------------------------------------------------
create function private."FC_APLICAR_COORDENADA_MAPA"(
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
revoke all on function private."FC_APLICAR_COORDENADA_MAPA"(jsonb, double precision, double precision, double precision, double precision, text, text, text, bigint) from public, anon, authenticated;
comment on function private."FC_APLICAR_COORDENADA_MAPA"(jsonb, double precision, double precision, double precision, double precision, text, text, text, bigint) is 'Grava uma alteração de coordenada do mapa (correção, conferência ou desfazer): admin global, limites do Brasil, motivo, identidade e posição anterior; atualiza a pendência e registra o histórico. Só chamada pelas RPCs do editor.';

-- 4. RPCs -----------------------------------------------------------------------------
drop function public.salvar_coordenada_mapa_saude_indigena(jsonb, double precision, double precision, double precision, double precision, text);

create function public.salvar_coordenada_mapa_saude_indigena(
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
revoke all on function public.salvar_coordenada_mapa_saude_indigena(jsonb, double precision, double precision, double precision, double precision, text, boolean) from public, anon;
grant execute on function public.salvar_coordenada_mapa_saude_indigena(jsonb, double precision, double precision, double precision, double precision, text, boolean) to authenticated;
comment on function public.salvar_coordenada_mapa_saude_indigena(jsonb, double precision, double precision, double precision, double precision, text, boolean) is 'Corrige um ponto existente do mapa e/ou, com p_conferido, marca o ponto pendente como conferido (a posição pode ficar igual). Só administrador global; confere identidade e posição anterior e registra o histórico privado.';

create function public.desfazer_coordenada_mapa_saude_indigena(p_historico bigint, p_motivo text)
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
revoke all on function public.desfazer_coordenada_mapa_saude_indigena(bigint, text) from public, anon;
grant execute on function public.desfazer_coordenada_mapa_saude_indigena(bigint, text) to authenticated;
comment on function public.desfazer_coordenada_mapa_saude_indigena(bigint, text) is 'Volta a última alteração de um ponto do mapa (posição e conferência) como uma alteração nova, com motivo; nada do histórico é apagado. Só administrador global.';

create function public.listar_historico_coordenada_mapa_saude_indigena(p_alvo jsonb, p_limite integer default 5)
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
revoke all on function public.listar_historico_coordenada_mapa_saude_indigena(jsonb, integer) from public, anon;
grant execute on function public.listar_historico_coordenada_mapa_saude_indigena(jsonb, integer) to authenticated;
comment on function public.listar_historico_coordenada_mapa_saude_indigena(jsonb, integer) is 'Últimas alterações de um ponto do mapa (quem, quando, de/para, motivo, ação, se foi desfeita). Só administrador global.';

create function public.listar_pendencias_coordenada_mapa_saude_indigena()
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
revoke all on function public.listar_pendencias_coordenada_mapa_saude_indigena() from public, anon;
grant execute on function public.listar_pendencias_coordenada_mapa_saude_indigena() to authenticated;
comment on function public.listar_pendencias_coordenada_mapa_saude_indigena() is 'Pendências de localização do mapa (pontos não confirmados pela auditoria), com candidatos e situação. Só administrador global.';

commit;
