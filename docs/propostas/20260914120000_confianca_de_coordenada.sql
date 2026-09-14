-- PROPOSTA — NÃO APLICAR AINDA.
--
-- Esta migration acompanha `docs/auditoria-geografica.md` e existe para ser
-- lida e discutida, não para correr. Ela não altera nem apaga nada do que está
-- em produção: cria estrutura nova, vazia, ao lado da que existe.
--
-- POR QUE ELA EXISTE
--
-- Hoje as coordenadas do mapa vivem em duas linhas de
-- `mapa_saude_indigena_config`, como payload JSON, sob as chaves `lmap` e
-- `rede_cnes`. Não há coluna, tipo, restrição nem histórico. A consequência
-- medida na auditoria: não é possível dizer de onde veio a coordenada de um
-- polo base, quem a pôs lá, quando, nem com que fonte — e um polo que recebeu
-- a coordenada emprestada de outro estabelecimento fica gravado como
-- `coord_oficial: true`.
--
-- O que segue separa três coisas que hoje estão confundidas: a coordenada, a
-- sua procedência, e o afastamento aplicado para desenhar. A terceira não
-- aparece aqui de propósito — afastamento é estado de render e não se
-- armazena.
--
-- ORDEM DE ADOÇÃO SUGERIDA
--
--   1. aplicar esta migration num Supabase de desenvolvimento;
--   2. carregar a tabela a partir do auditor (`scripts/auditar-coordenadas.mjs`),
--      que já classifica cada registo;
--   3. revisar à mão os registos em `inferida` e `pendente_validacao`;
--   4. só então ligar a leitura do mapa a esta tabela.

begin;

-- ---------------------------------------------------------------------------
-- Vocabulário de confiança. Enum, e não texto livre, para que um nível novo
-- seja uma decisão explícita e não um erro de digitação que ninguém vê.
-- ---------------------------------------------------------------------------
create type public.confianca_coordenada as enum (
  'oficial_estabelecimento', -- coordenada do registo CNES deste estabelecimento
  'oficial_cnes',            -- do CNES, mas de outro registo ligado por nome forte
  'aproximada_municipio',    -- é a sede do município, não o estabelecimento
  'inferida',                -- deduzida por semelhança de nome ou município
  'pendente_validacao'       -- origem desconhecida, conflituosa ou quebrada
);

create type public.tipo_unidade_saude_indigena as enum (
  'dsei_sede',
  'polo_base',
  'casai',
  'casai_nacional',
  'ubsi',
  'posto_saude_indigena',
  'unidade_apoio',
  'outra'
);

-- ---------------------------------------------------------------------------
-- A tabela. Uma linha por ponto desenhado no mapa.
-- ---------------------------------------------------------------------------
create table public.unidade_geo (
  id               bigint generated always as identity primary key,

  dsei_chave       text not null,
  tipo             public.tipo_unidade_saude_indigena not null,
  nome             text not null,

  -- Código CNES. Único quando existe; nulo é permitido porque polo base e sede
  -- de DSEI podem legitimamente não ter estabelecimento próprio no CNES.
  cnes             text,

  municipio        text,
  municipio_ibge   integer,
  uf               char(2),

  -- A COORDENADA REAL. Nunca recebe afastamento de visualização.
  lat              double precision not null,
  lon              double precision not null,

  confianca        public.confianca_coordenada not null,

  -- Procedência desta coordenada, em texto livre mas obrigatório:
  -- 'CNES/DATASUS 2026-09', 'IBGE sede municipal', 'SESAI ofício 123/2026'.
  fonte            text not null,
  fonte_data       date not null,

  -- Quando a coordenada foi emprestada de outro registo, é aqui que se diz de
  -- qual. Sem isto, `oficial_cnes` e `inferida` seriam afirmações sem lastro.
  cnes_referencia  text,
  observacao       text,

  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),

  -- O Brasil inteiro cabe neste retângulo, medido no contorno real do país
  -- (ver src/lib/brasil-bounds.js). Barra o engano mais comum e mais silencioso:
  -- latitude e longitude trocadas entre si.
  constraint unidade_geo_dentro_do_brasil check (
    lat between -33.75 and 5.27 and lon between -73.99 and -32.42
  ),

  -- Coordenada emprestada tem de dizer de quem. Coordenada própria não empresta.
  constraint unidade_geo_referencia_coerente check (
    (confianca in ('oficial_cnes', 'inferida') and cnes_referencia is not null)
    or (confianca not in ('oficial_cnes', 'inferida') and cnes_referencia is null)
  )
);

create unique index unidade_geo_cnes_unico
  on public.unidade_geo (cnes)
  where cnes is not null;

create index unidade_geo_por_dsei on public.unidade_geo (dsei_chave, tipo);
create index unidade_geo_por_confianca on public.unidade_geo (confianca);

-- Coordenadas repetidas entre estabelecimentos diferentes não são proibidas:
-- duas unidades podem partilhar um endereço. Mas ficam visíveis, para serem
-- revistas em vez de descobertas por acaso no mapa.
create index unidade_geo_por_coordenada on public.unidade_geo (lat, lon);

comment on table public.unidade_geo is
  'Pontos do mapa da saúde indígena com procedência declarada. lat/lon são a '
  'coordenada real e nunca recebem afastamento de visualização — desempilhar '
  'marcadores é responsabilidade do render.';

comment on column public.unidade_geo.cnes_referencia is
  'CNES do estabelecimento de onde esta coordenada foi tomada, quando ela não '
  'é do próprio registo. Obrigatório em oficial_cnes e inferida.';

-- ---------------------------------------------------------------------------
-- Histórico. Sem ele, uma correção apaga a anterior e ninguém consegue dizer
-- o que mudou, quando, nem por quê — que é exactamente a situação de hoje.
-- ---------------------------------------------------------------------------
create table public.unidade_geo_historico (
  id               bigint generated always as identity primary key,
  unidade_geo_id   bigint not null references public.unidade_geo(id) on delete cascade,
  lat_anterior     double precision,
  lon_anterior     double precision,
  confianca_anterior public.confianca_coordenada,
  fonte_anterior   text,
  alterado_por     uuid,
  alterado_em      timestamptz not null default now(),
  motivo           text not null
);

create index unidade_geo_historico_por_unidade
  on public.unidade_geo_historico (unidade_geo_id, alterado_em desc);

-- ---------------------------------------------------------------------------
-- RLS. A tabela nasce fechada; leitura para quem está autenticado, escrita só
-- por quem administra o mapa. As políticas de escrita ficam por definir junto
-- com a equipa — deliberadamente não inventadas aqui.
-- ---------------------------------------------------------------------------
alter table public.unidade_geo enable row level security;
alter table public.unidade_geo_historico enable row level security;

create policy unidade_geo_leitura_autenticada
  on public.unidade_geo for select
  to authenticated
  using (true);

create policy unidade_geo_historico_leitura_autenticada
  on public.unidade_geo_historico for select
  to authenticated
  using (true);

commit;

-- ---------------------------------------------------------------------------
-- REVERSÃO
--
--   begin;
--   drop table if exists public.unidade_geo_historico;
--   drop table if exists public.unidade_geo;
--   drop type  if exists public.tipo_unidade_saude_indigena;
--   drop type  if exists public.confianca_coordenada;
--   commit;
--
-- Como nada existente é tocado, reverter devolve o banco ao estado anterior
-- sem perda: `mapa_saude_indigena_config` continua a ser a fonte do mapa até
-- que o passo 4 da ordem de adoção seja dado.
-- ---------------------------------------------------------------------------
