/*
  COORDENADAS DO MAPA DE PROJETOS (EDITOR, FILA E HISTÓRICO)

  O mapa da Visão geral de Projetos desenha um ponto por lugar das vagas
  (listar_municipios_das_vagas_da_area: TB_LOCAL_VAGA_EDITAL + "UBS móvel" do
  nome da vaga). Até aqui a coordenada de cada lugar vinha de uma tabela fixa
  no front (src/lib/coordenadas-dos-municipios.js: sede municipal do IBGE, ou a
  média das sedes da UF quando o edital só diz o estado) — sem como corrigir,
  conferir ou saber quem mudou. Esta migration leva a coordenada para o banco,
  no mesmo padrão do editor da Saúde Indígena (20261002143323 e 20261002160000):

  1. public."TB_COORDENADA_LOCAL_VAGA": a coordenada de cada lugar, pela mesma
     chave da RPC do mapa ('uf:PA' ou município sem acento/UF, 'seropedica/RJ'),
     com a origem (SEDE_IBGE, CENTRO_UF ou MANUAL). Sem acesso direto: RLS sem
     policy; só as RPCs leem e gravam. A carga inicial (as sedes do IBGE e os
     centros das UFs que o front usava) e as pendências estão em
     supabase/correcoes/20261002-pendencias-das-coordenadas-dos-projetos.sql.
  2. private."TB_PENDENCIA_COORDENADA_LOCAL": os lugares duvidosos (sem
     coordenada, só pela sede do município, só a UF, município/UF que não
     batem, fora do Brasil, lugar repetido com coordenadas diferentes), com as
     posições candidatas e a conferência do administrador.
  3. private."TH_COORDENADA_LOCAL_VAGA": histórico privado (CORRECAO,
     CONFERENCIA, DESFAZER), com autoria, motivo e posição anterior.

     Por que tabelas irmãs, e não o histórico e as pendências da Saúde Indígena
     generalizados com uma coluna de origem: a identidade é outra (aqui, a chave
     do lugar; lá, fonte/tipo/DSEI/índice/código dentro do JSON do lmap e do
     rede_cnes), o lugar onde a posição mora é outro (uma linha de tabela; lá,
     um caminho no payload) e as constraints, as RPCs, o ensaio e o rollback de
     20261002160000 ficam intactos — misturar faria
     desfazer_coordenada_mapa_saude_indigena aceitar um histórico de Projetos.
     O que é comum aos dois mapas está no front (src/lib/editor-de-coordenadas.js
     e src/modulos/editor-de-coordenadas/); as tabelas repetem as mesmas colunas
     e regras, com nomes do assunto.

  4. private."FC_LUGARES_VAGA_PROJETO"(): os lugares das vagas de Projetos hoje
     (mesma chave e mesmo recorte da RPC do mapa), usado pela gravação e pela
     carga das pendências.
  5. private."FC_APLICAR_COORDENADA_LOCAL": corpo único de gravação (admin
     global, limites do Brasil, motivo de 10 a 1000 caracteres, lugar existente,
     concorrência pela posição anterior — com tolerância de 1e-9 grau, porque a
     coordenada que o front devolve passou por JSON — e trava por lugar),
     usado por salvar_coordenada_mapa_projetos e desfazer_coordenada_mapa_projetos.
  6. listar_historico_coordenada_mapa_projetos e
     listar_pendencias_coordenada_mapa_projetos: leitura só para admin global.
  7. listar_municipios_das_vagas_da_area: nova versão, igual à de 20261001180000
     com lugar, latitude, longitude e coordenada_origem de cada linha (nulos
     enquanto o lugar não tem coordenada no banco) e com as análises da área
     escolhidas também pela coluna "CO_AREA" (a área canônica da análise), não
     só pelo grupo da planilha — o mapa mostrava 0 candidato em todo lugar.
     Candidato por lugar continua dependendo de o nome da vaga citar o lugar
     ("UBS móvel <Município>/<UF>" ou o município de um local do mesmo
     edital); o front só mostra candidatos quando o lugar casou com alguma vaga.

  Ensaio (begin … rollback): supabase/ensaios/20261002170000_coordenadas_mapa_projetos.sql.
  Rollback: supabase/rollback/20261002170000_coordenadas_mapa_projetos.sql.
*/
begin;

-- 0. Pré-requisitos --------------------------------------------------------------------
do $$
begin
  if to_regclass('public."TB_LOCAL_VAGA_EDITAL"') is null
     or to_regprocedure('public.listar_municipios_das_vagas_da_area(text)') is null
     or to_regprocedure('private."FC_TEXTO_BUSCA_RECURSO"(text)') is null
     or to_regprocedure('private."FC_NUMERO_EDITAL"(text)') is null then
    raise exception 'Aplique antes 20261001180000_locais_das_vagas_dos_projetos.sql.';
  end if;
end;
$$;

-- 1. Coordenada de cada lugar ----------------------------------------------------------
create table public."TB_COORDENADA_LOCAL_VAGA" (
  "CO_SEQ_COORDENADA_LOCAL" bigint generated always as identity,
  "DS_CHAVE_LUGAR" varchar(160) not null,
  "CO_MUNICIPIO_IBGE" integer,
  "NO_MUNICIPIO" varchar(100),
  "SG_UF" varchar(2) not null,
  "CG_LATITUDE" double precision not null,
  "CG_LONGITUDE" double precision not null,
  "TP_ORIGEM" varchar(9) not null,
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "CO_USUARIO_ATUALIZACAO" uuid,
  constraint "PK_TB_COORDENADA_LOCAL_VAGA" primary key ("CO_SEQ_COORDENADA_LOCAL"),
  constraint "UK_COORDLOCAL_LUGAR" unique ("DS_CHAVE_LUGAR"),
  -- A chave é a da RPC do mapa: 'uf:<UF>' ou '<município sem acento>/<UF>'.
  constraint "CK_COORDLOCAL_LUGAR" check (
    ("DS_CHAVE_LUGAR" ~ '^uf:[A-Z]{2}$' and "DS_CHAVE_LUGAR" = 'uf:' || "SG_UF" and "CO_MUNICIPIO_IBGE" is null)
    or ("DS_CHAVE_LUGAR" ~ '^[^/A-Z]+/[A-Z]{2}$' and right("DS_CHAVE_LUGAR", 2) = "SG_UF")),
  constraint "CK_COORDLOCAL_MUNICIPIO" check ("CO_MUNICIPIO_IBGE" between 1100000 and 5399999),
  constraint "CK_COORDLOCAL_UF" check ("SG_UF" in (
    'RO', 'AC', 'AM', 'RR', 'PA', 'AP', 'TO', 'MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA',
    'MG', 'ES', 'RJ', 'SP', 'PR', 'SC', 'RS', 'MS', 'MT', 'GO', 'DF')),
  constraint "CK_COORDLOCAL_POSICAO" check ("CG_LATITUDE" between -90 and 90 and "CG_LONGITUDE" between -180 and 180),
  constraint "CK_COORDLOCAL_ORIGEM" check ("TP_ORIGEM" in ('SEDE_IBGE', 'CENTRO_UF', 'MANUAL')),
  constraint "CK_COORDLOCAL_MANUAL" check (("TP_ORIGEM" = 'MANUAL') = ("CO_USUARIO_ATUALIZACAO" is not null))
);
alter table public."TB_COORDENADA_LOCAL_VAGA" enable row level security;
revoke all on public."TB_COORDENADA_LOCAL_VAGA" from public, anon, authenticated;
grant all on public."TB_COORDENADA_LOCAL_VAGA" to service_role;
comment on table public."TB_COORDENADA_LOCAL_VAGA" is 'Coordenada de cada lugar das vagas de Projetos (um ponto do mapa da Visão geral de Projetos), pela chave da RPC listar_municipios_das_vagas_da_area. Sem acesso direto: só as RPCs do mapa e do editor.';
comment on column public."TB_COORDENADA_LOCAL_VAGA"."CO_SEQ_COORDENADA_LOCAL" is 'Identificador sequencial (identity).';
comment on column public."TB_COORDENADA_LOCAL_VAGA"."DS_CHAVE_LUGAR" is 'Chave do lugar como a RPC do mapa a calcula: uf:<UF> quando o edital só diz o estado; senão o município sem acento, minúsculo, / UF (seropedica/RJ).';
comment on column public."TB_COORDENADA_LOCAL_VAGA"."CO_MUNICIPIO_IBGE" is 'Código do município no IBGE (7 dígitos), quando conhecido; nulo para lugar só com UF.';
comment on column public."TB_COORDENADA_LOCAL_VAGA"."NO_MUNICIPIO" is 'Nome do município (como no IBGE ou como veio no nome da vaga); nulo para lugar só com UF.';
comment on column public."TB_COORDENADA_LOCAL_VAGA"."SG_UF" is 'Sigla da UF do lugar.';
comment on column public."TB_COORDENADA_LOCAL_VAGA"."CG_LATITUDE" is 'Latitude do ponto no mapa (graus decimais, WGS84).';
comment on column public."TB_COORDENADA_LOCAL_VAGA"."CG_LONGITUDE" is 'Longitude do ponto no mapa (graus decimais, WGS84).';
comment on column public."TB_COORDENADA_LOCAL_VAGA"."TP_ORIGEM" is 'De onde veio a posição: SEDE_IBGE (sede municipal do IBGE), CENTRO_UF (média das sedes municipais da UF) ou MANUAL (gravada por um administrador global no editor).';
comment on column public."TB_COORDENADA_LOCAL_VAGA"."DT_ATUALIZACAO" is 'Quando a posição foi gravada pela última vez.';
comment on column public."TB_COORDENADA_LOCAL_VAGA"."CO_USUARIO_ATUALIZACAO" is 'Quem gravou a posição no editor (auth.users.id); nulo na carga inicial.';

-- 2. Pendências ------------------------------------------------------------------------
create table private."TB_PENDENCIA_COORDENADA_LOCAL" (
  "CO_SEQ_PENDENCIA" bigint generated always as identity,
  "DS_CHAVE_LUGAR" varchar(160) not null,
  "NO_LUGAR" varchar(160) not null,
  "CO_MUNICIPIO_IBGE" integer,
  "SG_UF" varchar(2) not null,
  "TP_MOTIVO" varchar(20) not null,
  "DS_MOTIVO" text not null,
  "DS_CANDIDATO" jsonb not null default '[]'::jsonb,
  "ST_CONFERIDO" varchar(1) not null default 'N',
  "DT_CONFERENCIA" timestamptz,
  "CO_USUARIO_CONFERENCIA" uuid,
  "DT_CRIACAO" timestamptz not null default now(),
  constraint "PK_PENDENCIA_COORDENADA_LOCAL" primary key ("CO_SEQ_PENDENCIA"),
  constraint "UK_PENDLOCAL_LUGAR" unique ("DS_CHAVE_LUGAR"),
  constraint "CK_PENDLOCAL_MOTIVO" check ("TP_MOTIVO" in (
    'SEM_COORDENADA', 'MUNICIPIO_DIVERGE', 'LUGAR_DIVERGE', 'FORA_DO_BRASIL',
    'ESCRITORIO_SO_UF', 'SO_UF', 'SEDE_MUNICIPAL', 'OUTRO')),
  constraint "CK_PENDLOCAL_CANDIDATO" check (jsonb_typeof("DS_CANDIDATO") = 'array'),
  constraint "CK_PENDLOCAL_CONFERIDO" check ("ST_CONFERIDO" in ('S', 'N')),
  constraint "CK_PENDLOCAL_CONFERENCIA" check (
    ("ST_CONFERIDO" = 'S') = ("DT_CONFERENCIA" is not null)
    and ("ST_CONFERIDO" = 'S') = ("CO_USUARIO_CONFERENCIA" is not null))
);
alter table private."TB_PENDENCIA_COORDENADA_LOCAL" enable row level security;
revoke all on private."TB_PENDENCIA_COORDENADA_LOCAL" from public, anon, authenticated;
comment on table private."TB_PENDENCIA_COORDENADA_LOCAL" is 'Lugares do mapa de Projetos com coordenada duvidosa, com posições candidatas e a conferência do administrador global. Sem acesso direto: só as RPCs do editor.';
comment on column private."TB_PENDENCIA_COORDENADA_LOCAL"."CO_SEQ_PENDENCIA" is 'Identificador sequencial da pendência (identity).';
comment on column private."TB_PENDENCIA_COORDENADA_LOCAL"."DS_CHAVE_LUGAR" is 'Chave do lugar (a mesma de TB_COORDENADA_LOCAL_VAGA e da RPC do mapa).';
comment on column private."TB_PENDENCIA_COORDENADA_LOCAL"."NO_LUGAR" is 'Nome do lugar na data da carga (Seropédica/RJ, ou a UF quando o edital só diz o estado).';
comment on column private."TB_PENDENCIA_COORDENADA_LOCAL"."CO_MUNICIPIO_IBGE" is 'Código IBGE do município, quando conhecido.';
comment on column private."TB_PENDENCIA_COORDENADA_LOCAL"."SG_UF" is 'Sigla da UF do lugar.';
comment on column private."TB_PENDENCIA_COORDENADA_LOCAL"."TP_MOTIVO" is 'Por que a posição é duvidosa: SEM_COORDENADA (município não encontrado), MUNICIPIO_DIVERGE (nome, código ou UF não batem), LUGAR_DIVERGE (mesmo município com coordenadas diferentes), FORA_DO_BRASIL, ESCRITORIO_SO_UF (escritório com endereço, edital só diz a UF), SO_UF (centro da UF), SEDE_MUNICIPAL (só a sede do município) ou OUTRO.';
comment on column private."TB_PENDENCIA_COORDENADA_LOCAL"."DS_MOTIVO" is 'Explicação da pendência, para o editor.';
comment on column private."TB_PENDENCIA_COORDENADA_LOCAL"."DS_CANDIDATO" is 'Posições candidatas (JSON array de {f: MUNICIPIO/UF/DSEI/LUGAR, n: nome, lat, lon}). A distância é calculada na tela.';
comment on column private."TB_PENDENCIA_COORDENADA_LOCAL"."ST_CONFERIDO" is 'S quando um administrador global conferiu a posição (com ou sem mudar); N enquanto pendente.';
comment on column private."TB_PENDENCIA_COORDENADA_LOCAL"."DT_CONFERENCIA" is 'Data e hora da conferência (nula enquanto pendente).';
comment on column private."TB_PENDENCIA_COORDENADA_LOCAL"."CO_USUARIO_CONFERENCIA" is 'Quem conferiu (auth.users.id); nulo enquanto pendente.';
comment on column private."TB_PENDENCIA_COORDENADA_LOCAL"."DT_CRIACAO" is 'Data e hora da carga da pendência.';

-- 3. Histórico -------------------------------------------------------------------------
create table private."TH_COORDENADA_LOCAL_VAGA" (
  "CO_SEQ_HISTORICO" bigint generated always as identity,
  "CO_USUARIO" uuid not null,
  "DT_ALTERACAO" timestamptz not null default clock_timestamp(),
  "DS_CHAVE_LUGAR" varchar(160) not null,
  "CG_LATITUDE_ANTERIOR" double precision,
  "CG_LONGITUDE_ANTERIOR" double precision,
  "CG_LATITUDE" double precision not null,
  "CG_LONGITUDE" double precision not null,
  "DS_MOTIVO" text not null,
  "TP_ACAO" varchar(11) not null,
  "ST_CONFERIDO_ANTERIOR" varchar(1),
  "ST_CONFERIDO" varchar(1),
  "CO_HISTORICO_DESFEITO" bigint,
  constraint "PK_TH_COORDENADA_LOCAL_VAGA" primary key ("CO_SEQ_HISTORICO"),
  constraint "CK_THCOORDLOCAL_ACAO" check ("TP_ACAO" in ('CORRECAO', 'CONFERENCIA', 'DESFAZER')),
  constraint "CK_THCOORDLOCAL_CONFERIDO" check (
    coalesce("ST_CONFERIDO", 'S') in ('S', 'N') and coalesce("ST_CONFERIDO_ANTERIOR", 'S') in ('S', 'N')),
  constraint "CK_THCOORDLOCAL_DESFEITO" check (("TP_ACAO" = 'DESFAZER') = ("CO_HISTORICO_DESFEITO" is not null)),
  constraint "CK_THCOORDLOCAL_ANTERIOR" check (("CG_LATITUDE_ANTERIOR" is null) = ("CG_LONGITUDE_ANTERIOR" is null)),
  constraint "FK_THCOORDLOCAL_DESFEITO" foreign key ("CO_HISTORICO_DESFEITO")
    references private."TH_COORDENADA_LOCAL_VAGA" ("CO_SEQ_HISTORICO"),
  constraint "UK_THCOORDLOCAL_DESFEITO" unique ("CO_HISTORICO_DESFEITO")
);
create index "IN_THCOORDLOCAL_LUGAR" on private."TH_COORDENADA_LOCAL_VAGA" ("DS_CHAVE_LUGAR", "CO_SEQ_HISTORICO" desc);
alter table private."TH_COORDENADA_LOCAL_VAGA" enable row level security;
revoke all on private."TH_COORDENADA_LOCAL_VAGA" from public, anon, authenticated;
comment on table private."TH_COORDENADA_LOCAL_VAGA" is 'Histórico privado das alterações de coordenada dos lugares do mapa de Projetos (correção, conferência, desfazer), com autoria, motivo e posição anterior. Nada é apagado.';
comment on column private."TH_COORDENADA_LOCAL_VAGA"."CO_SEQ_HISTORICO" is 'Identificador sequencial da alteração (identity).';
comment on column private."TH_COORDENADA_LOCAL_VAGA"."CO_USUARIO" is 'Quem alterou (auth.users.id), sempre administrador global.';
comment on column private."TH_COORDENADA_LOCAL_VAGA"."DT_ALTERACAO" is 'Data e hora da alteração.';
comment on column private."TH_COORDENADA_LOCAL_VAGA"."DS_CHAVE_LUGAR" is 'Chave do lugar alterado (a de TB_COORDENADA_LOCAL_VAGA).';
comment on column private."TH_COORDENADA_LOCAL_VAGA"."CG_LATITUDE_ANTERIOR" is 'Latitude antes da alteração (nula se o lugar não tinha coordenada).';
comment on column private."TH_COORDENADA_LOCAL_VAGA"."CG_LONGITUDE_ANTERIOR" is 'Longitude antes da alteração (nula se o lugar não tinha coordenada).';
comment on column private."TH_COORDENADA_LOCAL_VAGA"."CG_LATITUDE" is 'Latitude depois da alteração (igual à anterior numa conferência sem mudança de posição).';
comment on column private."TH_COORDENADA_LOCAL_VAGA"."CG_LONGITUDE" is 'Longitude depois da alteração (igual à anterior numa conferência sem mudança de posição).';
comment on column private."TH_COORDENADA_LOCAL_VAGA"."DS_MOTIVO" is 'Motivo e fonte da alteração (10 a 1000 caracteres).';
comment on column private."TH_COORDENADA_LOCAL_VAGA"."TP_ACAO" is 'CORRECAO (mudou a posição), CONFERENCIA (marcou o lugar pendente como conferido, com ou sem mudar a posição) ou DESFAZER (voltou a última alteração).';
comment on column private."TH_COORDENADA_LOCAL_VAGA"."ST_CONFERIDO_ANTERIOR" is 'Conferido (S/N) antes da alteração; nulo se o lugar não tem pendência.';
comment on column private."TH_COORDENADA_LOCAL_VAGA"."ST_CONFERIDO" is 'Conferido (S/N) depois da alteração; nulo se o lugar não tem pendência.';
comment on column private."TH_COORDENADA_LOCAL_VAGA"."CO_HISTORICO_DESFEITO" is 'Alteração que este DESFAZER voltou (cada uma só pode ser desfeita uma vez).';

-- 4. Os lugares das vagas de Projetos hoje ---------------------------------------------
create function private."FC_LUGARES_VAGA_PROJETO"()
returns table (
  lugar text,
  ibge integer,
  municipio text,
  uf text,
  so_uf boolean,
  ibges integer[],
  lotacoes text[],
  projetos text[],
  origens text[]
)
language sql
stable
set search_path = ''
as $$
  with
  tabela as (
    select case when l."CO_MUNICIPIO_IBGE" is null then 'uf:' || l."SG_UF"
                else private."FC_TEXTO_BUSCA_RECURSO"(l."NO_MUNICIPIO") || '/' || l."SG_UF" end as lugar,
           l."CO_MUNICIPIO_IBGE" as ibge, l."NO_MUNICIPIO"::text as municipio, l."SG_UF"::text as uf,
           l."NO_LOTACAO"::text as lotacao, m.unidade::text as projeto, 'TABELA'::text as origem
      from public."TB_LOCAL_VAGA_EDITAL" l
      join public."TB_MONITORAMENTO_INDIGENA" m on m.id = l."CO_MONITORAMENTO"
     where l."ST_REGISTRO_ATIVO" = 'S' and m."CO_AREA" = 'projetos' and m.ativo is not false
  ),
  nome_da_vaga as (
    select private."FC_TEXTO_BUSCA_RECURSO"(btrim(mu.partes[1])) || '/' || mu.partes[2] as lugar,
           null::integer as ibge, btrim(mu.partes[1]) as municipio, mu.partes[2] as uf,
           'UBS móvel ' || btrim(mu.partes[1]) || '/' || mu.partes[2] as lotacao,
           ac.unidade::text as projeto, 'NOME_VAGA'::text as origem
      from public."TB_ANALISE_CURRICULAR" ac
      left join public."TB_EDITAL_ANALISE" e
        on e.grupo_norm = ac.grupo_norm and e.unidade_norm = ac.unidade_norm and e.edital_norm = ac.edital_norm
     cross join lateral regexp_match(ac.nome_vaga, 'UBS m[óo]vel ([^/]+)/([A-Z]{2})') as mu(partes)
     where ac.ativo is true
       and coalesce(e.ativo, true) is true
       and (ac."CO_AREA" = 'projetos'
            or ac.grupo_norm = (select public.analises_norm_key(a."NO_GRUPO_PLANILHA")
                                  from public."TB_AREA" a where a."CO_AREA" = 'projetos'))
       and btrim(mu.partes[1]) <> ''
  ),
  todos as (
    select * from tabela
    union all
    select * from nome_da_vaga
  )
  select t.lugar,
         min(t.ibge),
         min(t.municipio),
         min(t.uf),
         bool_and(t.lugar like 'uf:%'),
         coalesce(array_agg(distinct t.ibge) filter (where t.ibge is not null), '{}'),
         coalesce(array_agg(distinct t.lotacao) filter (where t.lotacao is not null), '{}'),
         coalesce(array_agg(distinct t.projeto) filter (where t.projeto is not null), '{}'),
         array_agg(distinct t.origem)
    from todos t
   group by t.lugar;
$$;
revoke all on function private."FC_LUGARES_VAGA_PROJETO"() from public, anon, authenticated;
comment on function private."FC_LUGARES_VAGA_PROJETO"() is 'Lugares das vagas de Projetos hoje (TB_LOCAL_VAGA_EDITAL ativa + UBS móvel no nome da vaga), com a chave da RPC do mapa, códigos IBGE, lotações, projetos e origens. Usada pelo editor de coordenadas e pela carga das pendências.';

-- 5. Corpo único de gravação -----------------------------------------------------------
create function private."FC_APLICAR_COORDENADA_LOCAL"(
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
revoke all on function private."FC_APLICAR_COORDENADA_LOCAL"(text, double precision, double precision, double precision, double precision, text, text, text, bigint) from public, anon, authenticated;
comment on function private."FC_APLICAR_COORDENADA_LOCAL"(text, double precision, double precision, double precision, double precision, text, text, text, bigint) is 'Grava uma alteração de coordenada de um lugar do mapa de Projetos (correção, conferência ou desfazer): admin global, limites do Brasil, motivo, lugar existente e posição anterior (tolerância 1e-9); atualiza a pendência e registra o histórico. Só chamada pelas RPCs do editor.';

-- 6. RPCs -----------------------------------------------------------------------------
create function public.salvar_coordenada_mapa_projetos(
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
revoke all on function public.salvar_coordenada_mapa_projetos(text, double precision, double precision, double precision, double precision, text, boolean) from public, anon;
grant execute on function public.salvar_coordenada_mapa_projetos(text, double precision, double precision, double precision, double precision, text, boolean) to authenticated;
comment on function public.salvar_coordenada_mapa_projetos(text, double precision, double precision, double precision, double precision, text, boolean) is 'Corrige a coordenada de um lugar do mapa de Projetos (cria a linha se o lugar ainda não tinha) e/ou, com p_conferido, marca o lugar pendente como conferido (a posição pode ficar igual). Só administrador global; confere a posição anterior e registra o histórico privado.';

create function public.desfazer_coordenada_mapa_projetos(p_historico bigint, p_motivo text)
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
revoke all on function public.desfazer_coordenada_mapa_projetos(bigint, text) from public, anon;
grant execute on function public.desfazer_coordenada_mapa_projetos(bigint, text) to authenticated;
comment on function public.desfazer_coordenada_mapa_projetos(bigint, text) is 'Volta a última alteração de um lugar do mapa de Projetos (posição e conferência) como uma alteração nova, com motivo; nada do histórico é apagado. Só administrador global.';

create function public.listar_historico_coordenada_mapa_projetos(p_lugar text, p_limite integer default 5)
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
revoke all on function public.listar_historico_coordenada_mapa_projetos(text, integer) from public, anon;
grant execute on function public.listar_historico_coordenada_mapa_projetos(text, integer) to authenticated;
comment on function public.listar_historico_coordenada_mapa_projetos(text, integer) is 'Últimas alterações de um lugar do mapa de Projetos (quem, quando, de/para, motivo, ação, se foi desfeita). Só administrador global.';

create function public.listar_pendencias_coordenada_mapa_projetos()
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
revoke all on function public.listar_pendencias_coordenada_mapa_projetos() from public, anon;
grant execute on function public.listar_pendencias_coordenada_mapa_projetos() to authenticated;
comment on function public.listar_pendencias_coordenada_mapa_projetos() is 'Pendências de localização dos lugares do mapa de Projetos, com candidatos e situação. Só administrador global.';

-- 7. RPC do mapa com a coordenada do banco ---------------------------------------------
create or replace function public.listar_municipios_das_vagas_da_area(p_area text)
returns json
language plpgsql
stable
security definer
set search_path to 'public', 'private', 'pg_temp'
set statement_timeout to '5s'
as $function$
declare
  v_grupos_norm text[];
  v_area text := lower(btrim(coalesce(p_area, '')));
begin
  if not private.pode_recurso('dashboard') then
    raise exception 'Sem permissão para este recurso' using errcode = '42501';
  end if;

  -- Valida a área e confere se ela é do usuário (ou se ele é admin).
  v_grupos_norm := private."FC_GRUPOS_ANALISES_DA_AREA"(p_area);

  return coalesce((
    with
    -- Os locais publicados nos editais da área.
    loc as (
      select l."CO_MONITORAMENTO" as id,
             m.edital,
             m.unidade as projeto,
             private."FC_NUMERO_EDITAL"(m.edital) as numero,
             l."CO_MUNICIPIO_IBGE" as ibge,
             l."NO_MUNICIPIO" as municipio,
             l."SG_UF" as uf,
             case when l."CO_MUNICIPIO_IBGE" is null then 'uf:' || l."SG_UF"
                  else private."FC_TEXTO_BUSCA_RECURSO"(l."NO_MUNICIPIO") || '/' || l."SG_UF" end as chave,
             l."QT_VAGA" as qt,
             l."ST_CADASTRO_RESERVA" = 'S' as cr,
             l."NO_LOTACAO" as lotacao,
             l."TP_ORIGEM" as origem
        from public."TB_LOCAL_VAGA_EDITAL" l
        join public."TB_MONITORAMENTO_INDIGENA" m on m.id = l."CO_MONITORAMENTO"
       where l."ST_REGISTRO_ATIVO" = 'S'
         and m."CO_AREA" = v_area
         and m.ativo is not false
    ),
    -- Um edital da área por número (o ativo primeiro), para dar nome às análises.
    edital_da_area as (
      select distinct on (private."FC_NUMERO_EDITAL"(m.edital))
             m.id, m.edital, m.unidade, private."FC_NUMERO_EDITAL"(m.edital) as numero
        from public."TB_MONITORAMENTO_INDIGENA" m
       where m."CO_AREA" = v_area
         and private."FC_NUMERO_EDITAL"(m.edital) is not null
       order by private."FC_NUMERO_EDITAL"(m.edital), m.ativo desc nulls last, m.id
    ),
    -- Análises da área no recorte "ativo" do painel: pela área da análise
    -- (CO_AREA, a fonte canônica) ou pelo grupo da planilha, como antes.
    analise as (
      select ac.id, ac.codigo_vaga, ac.nome_vaga, ac.status_consolidado, ac.unidade, ac.edital,
             private."FC_NUMERO_EDITAL"(ac.edital) as numero
        from public."TB_ANALISE_CURRICULAR" ac
        left join public."TB_EDITAL_ANALISE" e
          on e.grupo_norm = ac.grupo_norm
         and e.unidade_norm = ac.unidade_norm
         and e.edital_norm = ac.edital_norm
       where (ac."CO_AREA" = v_area or ac.grupo_norm = any (v_grupos_norm))
         and ac.ativo is true
         and coalesce(e.ativo, true) is true
    ),
    -- Cada análise no seu município: "UBS móvel <Município>/<UF>" no nome da
    -- vaga, ou o nome de um município de local do mesmo edital (palavra inteira).
    casada as (
      select a.id, a.codigo_vaga, a.status_consolidado, a.numero, a.unidade, a.edital,
             private."FC_TEXTO_BUSCA_RECURSO"(btrim(mu.partes[1])) || '/' || mu.partes[2] as chave,
             btrim(mu.partes[1]) as municipio, mu.partes[2] as uf
        from analise a
       cross join lateral regexp_match(a.nome_vaga, 'UBS m[óo]vel ([^/]+)/([A-Z]{2})') as mu(partes)
       where btrim(mu.partes[1]) <> ''
      union
      select a.id, a.codigo_vaga, a.status_consolidado, a.numero, a.unidade, a.edital,
             l.chave, l.municipio, l.uf
        from analise a
        join (select distinct numero, chave, municipio, uf from loc where ibge is not null) l
          on l.numero = a.numero
         and private."FC_TEXTO_BUSCA_RECURSO"(a.nome_vaga)
             ~ ('(^|[^a-z0-9])' || private."FC_TEXTO_BUSCA_RECURSO"(l.municipio) || '($|[^a-z0-9])')
    ),
    estatistica as (
      select chave,
             min(municipio) as municipio,
             min(uf) as uf,
             count(distinct codigo_vaga) as vagas,
             count(distinct id) as candidatos,
             count(distinct id) filter (where status_consolidado ilike 'aprovad%') as aprovados,
             count(distinct id) filter (where status_consolidado ilike 'reprovad%') as reprovados
        from casada
       group by chave
    ),
    -- Os editais de cada lugar: o que veio da tabela e o que veio das análises.
    edital_do_local as (
      select chave, numero, id, edital, projeto, qt, cr, lotacao, origem from loc
      union all
      select c.chave, c.numero, e.id, coalesce(e.edital, c.edital), coalesce(e.unidade, c.unidade),
             null::integer, false, null::varchar, 'NOME_VAGA'
        from (select chave, numero, min(unidade) as unidade, min(edital) as edital
                from casada group by chave, numero) c
        left join edital_da_area e on e.numero = c.numero
    ),
    por_edital as (
      select chave, numero,
             coalesce((array_agg(id) filter (where origem <> 'NOME_VAGA' and id is not null))[1],
                      (array_agg(id) filter (where id is not null))[1]) as id,
             coalesce(min(edital) filter (where origem <> 'NOME_VAGA'), min(edital)) as edital,
             coalesce(min(projeto) filter (where origem <> 'NOME_VAGA'), min(projeto)) as projeto,
             sum(qt) as vagas,
             coalesce(bool_or(cr), false) as cr,
             array_agg(distinct origem order by origem) as origens,
             coalesce(array_agg(distinct lotacao order by lotacao) filter (where lotacao is not null), '{}') as lotacoes
        from edital_do_local
       group by chave, numero
    ),
    lugar as (
      select chave, min(ibge) as ibge, min(municipio) as municipio, min(uf) as uf
        from loc
       group by chave
    ),
    chaves as (
      select chave from loc
      union
      select chave from casada
    ),
    linha as (
      select k.chave,
             k.chave like 'uf:%' as so_uf,
             coalesce(l.municipio, s.municipio) as municipio,
             coalesce(l.uf, s.uf) as uf,
             l.ibge,
             s.vagas, s.candidatos, s.aprovados, s.reprovados,
             c."CG_LATITUDE" as latitude,
             c."CG_LONGITUDE" as longitude,
             c."TP_ORIGEM" as coordenada_origem
        from chaves k
        left join lugar l on l.chave = k.chave
        left join estatistica s on s.chave = k.chave
        left join public."TB_COORDENADA_LOCAL_VAGA" c on c."DS_CHAVE_LUGAR" = k.chave
    )
    select json_agg(json_build_object(
      'lugar', r.chave,
      'municipio_uf', case when r.so_uf then null else r.municipio || '/' || r.uf end,
      'municipio', case when r.so_uf then null else r.municipio end,
      'uf', r.uf,
      'codigo_ibge', r.ibge,
      'nivel', case when r.so_uf then 'uf' else 'municipio' end,
      'latitude', r.latitude,
      'longitude', r.longitude,
      'coordenada_origem', r.coordenada_origem,
      'vagas', coalesce(r.vagas, 0),
      'candidatos', coalesce(r.candidatos, 0),
      'aprovados', coalesce(r.aprovados, 0),
      'reprovados', coalesce(r.reprovados, 0),
      'vagas_edital', (select sum(p.vagas) from por_edital p where p.chave = r.chave),
      'cadastro_reserva', coalesce((select bool_or(p.cr) from por_edital p where p.chave = r.chave), false),
      'projetos', coalesce((select json_agg(distinct p.projeto) from por_edital p
                             where p.chave = r.chave and p.projeto is not null), '[]'::json),
      'editais', coalesce((select json_agg(json_build_object(
                             'id', p.id,
                             'edital', p.edital,
                             'projeto', p.projeto,
                             'vagas', p.vagas,
                             'cadastro_reserva', p.cr,
                             'origens', p.origens,
                             'lotacoes', p.lotacoes) order by p.projeto, p.numero)
                             from por_edital p where p.chave = r.chave), '[]'::json)
    ) order by r.uf, r.so_uf desc, r.municipio)
    from linha r
  ), '[]'::json);
end;
$function$;

comment on function public.listar_municipios_das_vagas_da_area(text) is
  'Lugares das vagas da área (TB_LOCAL_VAGA_EDITAL + UBS móvel no nome da vaga): chave do lugar, município ou UF, coordenada do banco (TB_COORDENADA_LOCAL_VAGA; nula se o lugar ainda não tem), projetos e editais de cada um, vagas publicadas, vagas nas análises, candidatos, aprovados e reprovados. Mapa da Visão geral de Projetos.';

revoke all on function public.listar_municipios_das_vagas_da_area(text) from public, anon;
grant execute on function public.listar_municipios_das_vagas_da_area(text) to authenticated, service_role;

commit;
