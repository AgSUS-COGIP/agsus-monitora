/*
  ENSAIO de 20261002160000_conferir_coordenadas_mapa.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres) e
  execute. Ele abre uma transação, aplica o corpo da migration (copiado sem
  mudança, sem o begin/commit dela), confere catálogo (nomes MAD, constraints,
  RLS, SECURITY DEFINER com search_path vazio, grants), cria duas pessoas
  sintéticas (admin global e leitor) e pendências sintéticas para um polo e uma
  UBSI reais, percorre correção, conferência (com e sem mudar a posição),
  concorrência, limites, motivo, histórico e desfazer, e termina em ROLLBACK:
  nada fica gravado.

  Resultado esperado: "ok E1" … "ok E6", "ENSAIO OK" e o resumo por ação.
  Qualquer "FALHOU …" interrompe e desfaz tudo; copie a mensagem.

  Mantenha em sincronia: tests/conferir-coordenadas-migration.test.js confere
  que o corpo da migration aqui é idêntico ao do arquivo da migration.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══

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

-- ═══ CORPO DA MIGRATION (fim) ═══

-- E1. Catálogo: nomes MAD, constraints, RLS, funções e permissões.
do $$
declare
  v_falta text;
begin
  select string_agg(c, ', ') into v_falta
    from unnest(array['CO_SEQ_HISTORICO', 'CO_USUARIO', 'DT_ALTERACAO', 'DS_ALVO', 'CG_LATITUDE_ANTERIOR',
                      'CG_LONGITUDE_ANTERIOR', 'CG_LATITUDE', 'CG_LONGITUDE', 'DS_MOTIVO', 'TP_ACAO',
                      'ST_CONFERIDO_ANTERIOR', 'ST_CONFERIDO', 'CO_HISTORICO_DESFEITO']) c
   where not exists (select 1 from information_schema.columns i
                      where i.table_schema = 'private' and i.table_name = 'TH_COORDENADA_MAPA_SAUDE_INDIG'
                        and i.column_name = c);
  if v_falta is not null then raise exception 'FALHOU E1: colunas do histórico ausentes: %', v_falta; end if;
  if exists (select 1 from information_schema.columns i
              where i.table_schema = 'private' and i.table_name = 'TH_COORDENADA_MAPA_SAUDE_INDIG'
                and i.column_name in ('ID_HISTORICO', 'ID_USUARIO', 'DH_ALTERACAO', 'JS_ALVO', 'NU_LATITUDE')) then
    raise exception 'FALHOU E1: nome antigo no histórico';
  end if;
  select string_agg(k, ', ') into v_falta
    from unnest(array['PK_TH_COORD_MAPA_SAUDE_INDIG', 'CK_THCOORD_ACAO', 'CK_THCOORD_CONFERIDO', 'CK_THCOORD_DESFEITO',
                      'CK_THCOORD_ALVO', 'FK_THCOORD_DESFEITO', 'UK_THCOORD_DESFEITO',
                      'PK_PENDENCIA_COORDENADA_MAPA', 'UK_PENDCOORD_PONTO', 'CK_PENDCOORD_PONTO', 'CK_PENDCOORD_MOTIVO',
                      'CK_PENDCOORD_CANDIDATO', 'CK_PENDCOORD_CONFERIDO', 'CK_PENDCOORD_CONFERENCIA']) k
   where not exists (select 1 from pg_constraint c where c.conname = k);
  if v_falta is not null then raise exception 'FALHOU E1: constraints ausentes: %', v_falta; end if;
  if not (select c.relrowsecurity from pg_class c where c.oid = 'private."TB_PENDENCIA_COORDENADA_MAPA"'::regclass)
     or obj_description('private."TB_PENDENCIA_COORDENADA_MAPA"'::regclass, 'pg_class') is null then
    raise exception 'FALHOU E1: pendências sem RLS ou sem COMMENT';
  end if;
  if has_table_privilege('authenticated', 'private."TB_PENDENCIA_COORDENADA_MAPA"', 'select')
     or has_table_privilege('authenticated', 'private."TH_COORDENADA_MAPA_SAUDE_INDIG"', 'select') then
    raise exception 'FALHOU E1: authenticated lê tabela privada';
  end if;
  if to_regprocedure('public.salvar_coordenada_mapa_saude_indigena(jsonb,double precision,double precision,double precision,double precision,text)') is not null then
    raise exception 'FALHOU E1: assinatura antiga de salvar_coordenada_mapa_saude_indigena ficou';
  end if;
  select string_agg(f, ', ') into v_falta
    from unnest(array[
      'public.salvar_coordenada_mapa_saude_indigena(jsonb,double precision,double precision,double precision,double precision,text,boolean)',
      'public.desfazer_coordenada_mapa_saude_indigena(bigint,text)',
      'public.listar_historico_coordenada_mapa_saude_indigena(jsonb,integer)',
      'public.listar_pendencias_coordenada_mapa_saude_indigena()']) f
   where not exists (select 1 from pg_proc p
                      where p.oid = to_regprocedure(f) and p.prosecdef
                        and p.proconfig @> array['search_path=""'])
      or has_function_privilege('anon', to_regprocedure(f), 'execute')
      or not has_function_privilege('authenticated', to_regprocedure(f), 'execute');
  if v_falta is not null then raise exception 'FALHOU E1: RPC sem SECURITY DEFINER/search_path vazio ou com grant errado: %', v_falta; end if;
  if has_function_privilege('authenticated',
       'private."FC_APLICAR_COORDENADA_MAPA"(jsonb,double precision,double precision,double precision,double precision,text,text,text,bigint)',
       'execute') then
    raise exception 'FALHOU E1: authenticated chama o corpo privado direto';
  end if;
  raise notice 'ok E1: nomes MAD, constraints, RLS, RPCs SECURITY DEFINER e permissões';
end;
$$;

-- E2. Atores sintéticos e pontos reais (um polo, uma UBSI e uma sede) com pendência sintética.
do $$
declare
  v_admin_grupo text;
  v_leitor_grupo text;
  v_dsei_indice integer;
  v_polo_indice integer;
  v_dsei jsonb;
  v_polo jsonb;
  v_rede_dsei text;
  v_u_indice integer;
  v_u jsonb;
begin
  select a."CO_GRUPO_ACESSO" into v_admin_grupo from public."TB_GRUPO_ACESSO" a where a."ST_ADMIN_GLOBAL" limit 1;
  select a."CO_GRUPO_ACESSO" into v_leitor_grupo from public."TB_GRUPO_ACESSO" a
   where not a."ST_ADMIN_GLOBAL" order by (a."CO_GRUPO_ACESSO" = 'usuario') desc limit 1;
  if v_admin_grupo is null or v_leitor_grupo is null then raise exception 'ENSAIO: grupos de acesso não encontrados'; end if;
  insert into auth.users (id, instance_id, aud, role, email) values
    ('00000000-0000-4000-a000-00000000d101', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.admin@ensaio.invalid'),
    ('00000000-0000-4000-a000-00000000d102', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ensaio.leitor@ensaio.invalid');
  insert into public."TB_PERFIL_USUARIO" (user_id, email, nome, perfil, ativo) values
    ('00000000-0000-4000-a000-00000000d101', 'ensaio.admin@ensaio.invalid', 'Ensaio Admin', v_admin_grupo, true),
    ('00000000-0000-4000-a000-00000000d102', 'ensaio.leitor@ensaio.invalid', 'Ensaio Leitor', v_leitor_grupo, true);

  select (d.ordinality - 1)::integer, (p.ordinality - 1)::integer, d.value, p.value
    into v_dsei_indice, v_polo_indice, v_dsei, v_polo
    from public."TB_CONFIG_MAPA_SAUDE_INDIG" c,
         jsonb_array_elements(c.payload -> 'dsei') with ordinality d,
         jsonb_array_elements(coalesce(d.value -> 'polos', '[]'::jsonb)) with ordinality p
   where c.chave = 'lmap' and p.value ->> 'cod' is not null
     and jsonb_typeof(p.value -> 'lat') = 'number' and jsonb_typeof(p.value -> 'lon') = 'number'
     and (p.value ->> 'lat')::double precision between -34 and 5
     and jsonb_typeof(d.value -> 'lat') = 'number' and jsonb_typeof(d.value -> 'lon') = 'number'
   limit 1;
  select r.key, (u.ordinality - 1)::integer, u.value into v_rede_dsei, v_u_indice, v_u
    from public."TB_CONFIG_MAPA_SAUDE_INDIG" c,
         jsonb_each(c.payload -> 'rede') r,
         jsonb_array_elements(coalesce(r.value -> 'u', '[]'::jsonb)) with ordinality u
   where c.chave = 'rede_cnes' and u.value ->> 1 is not null
     and jsonb_typeof(u.value -> 2) = 'number' and jsonb_typeof(u.value -> 3) = 'number'
     and (u.value ->> 2)::double precision between -34 and 5
   limit 1;
  if v_polo is null or v_u is null then raise exception 'ENSAIO: sem polo ou UBSI com coordenada'; end if;

  perform set_config('ensaio.polo', jsonb_build_object(
    'alvo', jsonb_build_object('fonte', 'lmap', 'tipo', 'polo', 'dsei', v_dsei ->> 'k', 'indice', v_polo_indice,
                               'codigo', v_polo ->> 'cod', 'nome', v_polo ->> 'n'),
    'dsei_indice', v_dsei_indice, 'lat', v_polo -> 'lat', 'lon', v_polo -> 'lon')::text, true);
  perform set_config('ensaio.u', jsonb_build_object(
    'alvo', jsonb_build_object('fonte', 'rede_cnes', 'tipo', 'u', 'dsei', v_rede_dsei, 'indice', v_u_indice,
                               'codigo', v_u ->> 1, 'nome', v_u ->> 0),
    'lat', v_u -> 2, 'lon', v_u -> 3)::text, true);
  perform set_config('ensaio.sede', jsonb_build_object(
    'alvo', jsonb_build_object('fonte', 'lmap', 'tipo', 'sede', 'dsei', v_dsei ->> 'k', 'indice', v_dsei_indice,
                               'codigo', null, 'nome', v_dsei ->> 'n'),
    'lat', v_dsei -> 'lat', 'lon', v_dsei -> 'lon')::text, true);

  insert into private."TB_PENDENCIA_COORDENADA_MAPA"
    ("TP_FONTE", "TP_PONTO", "NO_DSEI", "CO_PONTO", "NO_PONTO", "TP_MOTIVO", "DS_MOTIVO", "DS_CANDIDATO")
  values
    ('lmap', 'polo', v_dsei ->> 'k', v_polo ->> 'cod', v_polo ->> 'n', 'OUTRO', 'Ensaio',
     jsonb_build_array(jsonb_build_object('f', 'IBGE', 'n', 'Aldeia de ensaio', 'lat', -10, 'lon', -50))),
    ('rede_cnes', 'u', v_rede_dsei, v_u ->> 1, v_u ->> 0, 'OUTRO', 'Ensaio', '[]'::jsonb)
  on conflict on constraint "UK_PENDCOORD_PONTO" do update
    set "ST_CONFERIDO" = 'N', "DT_CONFERENCIA" = null, "CO_USUARIO_CONFERENCIA" = null;
  raise notice 'ok E2: atores; polo %, UBSI %, sede %', v_polo ->> 'n', v_u ->> 0, v_dsei ->> 'n';
end;
$$;

-- E3. Quem não é admin global não lê nem grava.
set local role authenticated;
do $$
declare
  v_polo jsonb := current_setting('ensaio.polo')::jsonb;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-a000-00000000d102","role":"authenticated","email":"ensaio.leitor@ensaio.invalid"}', true);
  begin
    perform public.listar_pendencias_coordenada_mapa_saude_indigena();
    raise exception 'FALHOU E3: leitor listou pendências';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.listar_historico_coordenada_mapa_saude_indigena(v_polo -> 'alvo', 5);
    raise exception 'FALHOU E3: leitor leu histórico';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.salvar_coordenada_mapa_saude_indigena(v_polo -> 'alvo', (v_polo ->> 'lat')::float8,
      (v_polo ->> 'lon')::float8, (v_polo ->> 'lat')::float8, (v_polo ->> 'lon')::float8, 'Ensaio sem permissão', true);
    raise exception 'FALHOU E3: leitor conferiu';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.desfazer_coordenada_mapa_saude_indigena(1, 'Ensaio sem permissão');
    raise exception 'FALHOU E3: leitor desfez';
  exception when sqlstate '42501' then null;
  end;
  raise notice 'ok E3: leitor recebe 42501 nas quatro RPCs';
end;
$$;

-- E4. Admin no polo: corrigir, validar, desfazer, conferir sem e com mudança.
do $$
declare
  v_polo jsonb := current_setting('ensaio.polo')::jsonb;
  v_alvo jsonb := v_polo -> 'alvo';
  v_lat float8 := (v_polo ->> 'lat')::float8;
  v_lon float8 := (v_polo ->> 'lon')::float8;
  v_caminho text[] := array['dsei', v_polo ->> 'dsei_indice', 'polos', v_alvo ->> 'indice'];
  v jsonb;
  v_h1 bigint;
  v_h2 bigint;
  v_h3 bigint;
  v_hist jsonb;
  v_pend jsonb;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-0000-4000-a000-00000000d101","role":"authenticated","email":"ensaio.admin@ensaio.invalid"}', true);
  select p into v_pend from jsonb_array_elements(public.listar_pendencias_coordenada_mapa_saude_indigena()) p
   where p ->> 'fonte' = 'lmap' and p ->> 'dsei' = v_alvo ->> 'dsei' and p ->> 'codigo' = v_alvo ->> 'codigo';
  if v_pend is null or (v_pend ->> 'conferido')::boolean or jsonb_array_length(v_pend -> 'candidatos') < 1 then
    raise exception 'FALHOU E4: pendência do polo não listada';
  end if;

  v := public.salvar_coordenada_mapa_saude_indigena(v_alvo, (v_lat::numeric + 0.001)::float8, v_lon, v_lat, v_lon, 'Ensaio: correção de teste');
  v_h1 := (v ->> 'historico')::bigint;
  if ((v -> 'lmap' #> v_caminho) ->> 'lat')::float8 <> (v_lat::numeric + 0.001)::float8 or (v ->> 'conferido')::boolean then
    raise exception 'FALHOU E4: correção não gravou ou conferiu sem pedir';
  end if;
  begin
    perform public.salvar_coordenada_mapa_saude_indigena(v_alvo, (v_lat::numeric + 0.001)::float8, v_lon, (v_lat::numeric + 0.001)::float8, v_lon, 'Ensaio: mesma posição');
    raise exception 'FALHOU E4: aceitou posição igual sem conferir';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.salvar_coordenada_mapa_saude_indigena(v_alvo, (v_lat::numeric + 0.003)::float8, v_lon, v_lat, v_lon, 'Ensaio: anterior velha');
    raise exception 'FALHOU E4: aceitou posição anterior desatualizada';
  exception when sqlstate '40001' then null;
  end;
  begin
    perform public.salvar_coordenada_mapa_saude_indigena(v_alvo, (v_lat::numeric + 0.003)::float8, v_lon, (v_lat::numeric + 0.001)::float8, v_lon, 'curto');
    raise exception 'FALHOU E4: aceitou motivo curto';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.salvar_coordenada_mapa_saude_indigena(v_alvo, 10, v_lon, (v_lat::numeric + 0.001)::float8, v_lon, 'Ensaio: fora do Brasil');
    raise exception 'FALHOU E4: aceitou fora do Brasil';
  exception when sqlstate '22023' then null;
  end;
  v_hist := public.listar_historico_coordenada_mapa_saude_indigena(v_alvo, 5);
  if (v_hist -> 0 ->> 'id')::bigint <> v_h1 or v_hist -> 0 ->> 'acao' <> 'CORRECAO'
     or v_hist -> 0 ->> 'por' <> 'Ensaio Admin' or (v_hist -> 0 ->> 'latitude_anterior')::float8 <> v_lat then
    raise exception 'FALHOU E4: histórico da correção: %', v_hist -> 0;
  end if;

  v := public.desfazer_coordenada_mapa_saude_indigena(v_h1, 'Ensaio: desfaz a correção');
  v_h2 := (v ->> 'historico')::bigint;
  if ((v -> 'lmap' #> v_caminho) ->> 'lat')::float8 <> v_lat then
    raise exception 'FALHOU E4: desfazer não voltou a posição';
  end if;
  begin
    perform public.desfazer_coordenada_mapa_saude_indigena(v_h1, 'Ensaio: desfaz de novo');
    raise exception 'FALHOU E4: desfez correção que não é a última';
  exception when sqlstate '40001' then null;
  end;
  begin
    perform public.desfazer_coordenada_mapa_saude_indigena(v_h2, 'Ensaio: desfaz o desfazer');
    raise exception 'FALHOU E4: desfez um desfazer';
  exception when sqlstate '22023' then null;
  end;
  v_hist := public.listar_historico_coordenada_mapa_saude_indigena(v_alvo, 5);
  if v_hist -> 0 ->> 'acao' <> 'DESFAZER' or (v_hist -> 0 ->> 'desfaz')::bigint <> v_h1
     or not (v_hist -> 1 ->> 'desfeito')::boolean then
    raise exception 'FALHOU E4: histórico do desfazer: %', v_hist;
  end if;

  v := public.salvar_coordenada_mapa_saude_indigena(v_alvo, v_lat, v_lon, v_lat, v_lon, 'Ensaio: posição conferida', true);
  v_h3 := (v ->> 'historico')::bigint;
  if not (v ->> 'conferido')::boolean or ((v -> 'lmap' #> v_caminho) ->> 'lat')::float8 <> v_lat then
    raise exception 'FALHOU E4: conferência sem mudar a posição';
  end if;
  begin
    perform public.salvar_coordenada_mapa_saude_indigena(v_alvo, v_lat, v_lon, v_lat, v_lon, 'Ensaio: conferir de novo', true);
    raise exception 'FALHOU E4: conferiu duas vezes';
  exception when sqlstate '22023' then null;
  end;
  select p into v_pend from jsonb_array_elements(public.listar_pendencias_coordenada_mapa_saude_indigena()) p
   where p ->> 'fonte' = 'lmap' and p ->> 'dsei' = v_alvo ->> 'dsei' and p ->> 'codigo' = v_alvo ->> 'codigo';
  if not (v_pend ->> 'conferido')::boolean or v_pend ->> 'conferido_em' is null then
    raise exception 'FALHOU E4: pendência não ficou conferida';
  end if;

  v := public.desfazer_coordenada_mapa_saude_indigena(v_h3, 'Ensaio: volta a pendente');
  if (v ->> 'conferido')::boolean then raise exception 'FALHOU E4: desfazer não voltou a pendente'; end if;

  v := public.salvar_coordenada_mapa_saude_indigena(v_alvo, (v_lat::numeric + 0.002)::float8, v_lon, v_lat, v_lon, 'Ensaio: conferida em outra posição', true);
  if not (v ->> 'conferido')::boolean or ((v -> 'lmap' #> v_caminho) ->> 'lat')::float8 <> (v_lat::numeric + 0.002)::float8 then
    raise exception 'FALHOU E4: conferência com mudança de posição';
  end if;
  raise notice 'ok E4: polo corrigido, validado (22023/40001), desfeito, conferido sem e com mudança';
end;
$$;

-- E5. Admin na UBSI (tupla do rede_cnes) e na sede (sem pendência).
do $$
declare
  v_u jsonb := current_setting('ensaio.u')::jsonb;
  v_sede jsonb := current_setting('ensaio.sede')::jsonb;
  v_alvo jsonb := v_u -> 'alvo';
  v_lat float8 := (v_u ->> 'lat')::float8;
  v_lon float8 := (v_u ->> 'lon')::float8;
  v_caminho text[] := array['rede', v_alvo ->> 'dsei', 'u', v_alvo ->> 'indice'];
  v jsonb;
begin
  v := public.salvar_coordenada_mapa_saude_indigena(v_alvo, (v_lat::numeric - 0.001)::float8, v_lon, v_lat, v_lon, 'Ensaio: UBSI conferida com ajuste', true);
  if not (v ->> 'conferido')::boolean or ((v -> 'rede_cnes' #> v_caminho) ->> 2)::float8 <> (v_lat::numeric - 0.001)::float8
     or (v -> 'rede_cnes' #> v_caminho) ->> 0 <> v_alvo ->> 'nome' then
    raise exception 'FALHOU E5: UBSI conferida com ajuste';
  end if;
  v := public.desfazer_coordenada_mapa_saude_indigena((v ->> 'historico')::bigint, 'Ensaio: desfaz a UBSI');
  if (v ->> 'conferido')::boolean or ((v -> 'rede_cnes' #> v_caminho) ->> 2)::float8 <> v_lat then
    raise exception 'FALHOU E5: desfazer da UBSI';
  end if;
  begin
    perform public.salvar_coordenada_mapa_saude_indigena(v_sede -> 'alvo', (v_sede ->> 'lat')::float8, (v_sede ->> 'lon')::float8,
      (v_sede ->> 'lat')::float8, (v_sede ->> 'lon')::float8, 'Ensaio: sede sem pendência', true);
    raise exception 'FALHOU E5: conferiu ponto sem pendência';
  exception when sqlstate '22023' then null;
  end;
  raise notice 'ok E5: UBSI conferida e desfeita na tupla; sede sem pendência recusada';
end;
$$;

reset role;

-- E6. O histórico guardou tudo; cada alteração só se desfaz uma vez.
do $$
declare
  v_admin constant uuid := '00000000-0000-4000-a000-00000000d101';
begin
  if (select count(*) from private."TH_COORDENADA_MAPA_SAUDE_INDIG" where "CO_USUARIO" = v_admin and "TP_ACAO" = 'CORRECAO') <> 1
     or (select count(*) from private."TH_COORDENADA_MAPA_SAUDE_INDIG" where "CO_USUARIO" = v_admin and "TP_ACAO" = 'CONFERENCIA') <> 3
     or (select count(*) from private."TH_COORDENADA_MAPA_SAUDE_INDIG" where "CO_USUARIO" = v_admin and "TP_ACAO" = 'DESFAZER') <> 3 then
    raise exception 'FALHOU E6: contagem do histórico por ação';
  end if;
  begin
    insert into private."TH_COORDENADA_MAPA_SAUDE_INDIG"
      ("CO_USUARIO", "DS_ALVO", "CG_LATITUDE", "CG_LONGITUDE", "DS_MOTIVO", "TP_ACAO", "CO_HISTORICO_DESFEITO")
    select v_admin, h."DS_ALVO", h."CG_LATITUDE", h."CG_LONGITUDE", 'Ensaio: duplicado', 'DESFAZER', h."CO_HISTORICO_DESFEITO"
      from private."TH_COORDENADA_MAPA_SAUDE_INDIG" h
     where h."CO_USUARIO" = v_admin and h."TP_ACAO" = 'DESFAZER' limit 1;
    raise exception 'FALHOU E6: a mesma alteração foi desfeita duas vezes';
  exception when unique_violation then null;
  end;
  raise notice 'ok E6: 1 correção, 3 conferências e 3 desfazer no histórico; UK do desfazer';
  raise notice 'ENSAIO OK';
end;
$$;

select h."TP_ACAO" as acao, count(*) as alteracoes,
       count(*) filter (where h."ST_CONFERIDO" = 'S') as deixaram_conferido,
       (select count(*) from private."TB_PENDENCIA_COORDENADA_MAPA") as pendencias_na_tabela
  from private."TH_COORDENADA_MAPA_SAUDE_INDIG" h
 where h."CO_USUARIO" = '00000000-0000-4000-a000-00000000d101'
 group by h."TP_ACAO"
 order by h."TP_ACAO";

rollback;
