/*
  CATÁLOGO DE ABAS (etapa 1 do "tudo vira aba")

  Cada área do sistema (TB_AREA: saude-indigena, sede, projetos) tem as suas
  abas no menu lateral. Até aqui elas estavam só no front
  (`PAGINAS_DO_MENU` em src/lib/menu-lateral.js). Esta migration leva o
  catálogo para o banco, sem mudar nada do que o usuário vê: o seed é
  exatamente o menu de hoje, e o front continua com a mesma lista como
  reserva (`ABAS_DO_MENU`) enquanto a função não existir ou falhar.

  O QUE ENTRA
    - public."TB_ABA": o catálogo das abas (código, rótulo, ícone, ordem, a
      view do front que a desenha e o recurso de permissão que ela usa hoje).
    - public."RL_ABA_AREA": em que área cada aba aparece. Pode trocar, só
      naquela área, a ordem, a view e o ícone: a Visão geral é a mesma aba nas
      três áreas, mas na Saúde Indígena é o mapa dos DSEIs (view `dashboard`,
      ícone `map`) e na SEDE e em Projetos é a tela React (`visao-area`).
    - public.listar_abas_do_menu(): o catálogo ativo, já resolvido por área.

  O QUE NÃO ENTRA (próximas etapas)
    - Permissão por perfil × aba: a permissão continua a de hoje
      (TB_PERMISSAO_RECURSO por recurso; `can()`/`buildNav` no front).
      "CO_RECURSO" só registra qual recurso cada aba usa, para a etapa de
      permissões partir dele.
    - Manutenção (sistema/área/aba/aba-na-área): sem RPC de escrita. As
      tabelas só aceitam leitura; a escrita virá por RPC de administração,
      que preencherá "DT_ATUALIZACAO" e "CO_USUARIO_ATUALIZACAO".
    - Painéis externos (Seleção, Entrevistas, Recursos): continuam em
      TB_PAINEL_EXTERNO e no grupo "Painéis" do menu. Quando virarem aba,
      entram aqui com "TP_ABA" = 'externa' (e uma referência ao painel).

  SEGURANÇA
    Só metadados do menu, sem dado de ninguém: `authenticated` lê tudo (RLS
    `using (true)`), `anon` não lê nada. A função é SECURITY INVOKER de
    propósito: não precisa de privilégio a mais, então a RLS e os grants das
    tabelas valem para ela também.

  DEPENDENTES
    Nenhum obrigatório: o front novo usa a função quando ela existe e o
    catálogo do próprio código quando não existe (mesmo menu). O teste
    tests/catalogo-de-abas.test.js confere que o seed abaixo é o catálogo do
    front.

  Rollback: supabase/rollback/20260929110000_catalogo_de_abas.sql
*/
begin;

-- Catálogo -------------------------------------------------------------------
create table public."TB_ABA" (
  "CO_ABA" text not null,
  "NO_ABA" text not null,
  "DS_ICONE" text not null,
  "NU_ORDEM" smallint not null,
  "CO_VIEW" text not null,
  "CO_RECURSO" text not null,
  "TP_ABA" text not null default 'nativa',
  "ST_ATIVO" varchar(1) not null default 'S',
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "CO_USUARIO_ATUALIZACAO" uuid,
  constraint "PK_TB_ABA" primary key ("CO_ABA"),
  constraint "CK_ABA_COABA" check ("CO_ABA" ~ '^[a-z]+(-[a-z]+)*$'),
  constraint "CK_ABA_COVIEW" check ("CO_VIEW" ~ '^[a-z]+(-[a-z]+)*$'),
  constraint "CK_ABA_TPABA" check ("TP_ABA" in ('nativa', 'externa')),
  constraint "CK_ABA_STATIVO" check ("ST_ATIVO" in ('S', 'N'))
);
comment on table public."TB_ABA" is
  'Catálogo das abas do MONITORA (menu lateral). Em que área cada uma aparece fica em RL_ABA_AREA.';
comment on column public."TB_ABA"."CO_ABA" is 'Código da aba (visao-geral, editais, cronograma, aprovados, analises).';
comment on column public."TB_ABA"."NO_ABA" is 'Rótulo da aba no menu.';
comment on column public."TB_ABA"."DS_ICONE" is 'Nome do ícone Lucide (registro em src/modules/icones.js). RL_ABA_AREA pode trocar por área.';
comment on column public."TB_ABA"."NU_ORDEM" is 'Ordem da aba dentro da área. RL_ABA_AREA pode trocar por área.';
comment on column public."TB_ABA"."CO_VIEW" is 'Tela do front que desenha a aba (data-view: dashboard, visao-area, nucleo, calendario, approved, analises). RL_ABA_AREA pode trocar por área.';
comment on column public."TB_ABA"."CO_RECURSO" is 'Recurso de permissão que a aba usa hoje (TB_PERMISSAO_RECURSO.recurso). Ponto de partida da permissão perfil × aba.';
comment on column public."TB_ABA"."TP_ABA" is 'nativa (tela do MONITORA) ou externa (painel externo que virou aba; nenhuma ainda).';
comment on column public."TB_ABA"."ST_ATIVO" is 'S: aparece no menu; N: fora do menu em todas as áreas.';
comment on column public."TB_ABA"."DT_CRIACAO" is 'Quando a aba entrou no catálogo.';
comment on column public."TB_ABA"."DT_ATUALIZACAO" is 'Última alteração (preenchida pela futura RPC de manutenção).';
comment on column public."TB_ABA"."CO_USUARIO_ATUALIZACAO" is 'Usuário (auth.users.id) da última alteração; nulo no seed da migration.';

-- Aba × área -----------------------------------------------------------------
create table public."RL_ABA_AREA" (
  "CO_ABA" text not null,
  "CO_AREA" text not null,
  "NU_ORDEM" smallint,
  "CO_VIEW" text,
  "DS_ICONE" text,
  "ST_ATIVO" varchar(1) not null default 'S',
  "DT_CRIACAO" timestamptz not null default now(),
  "DT_ATUALIZACAO" timestamptz not null default now(),
  "CO_USUARIO_ATUALIZACAO" uuid,
  constraint "PK_RL_ABA_AREA" primary key ("CO_ABA", "CO_AREA"),
  constraint "FK_ABA_ABA_AREA" foreign key ("CO_ABA") references public."TB_ABA" ("CO_ABA"),
  constraint "FK_AREA_ABA_AREA" foreign key ("CO_AREA") references public."TB_AREA" ("CO_AREA"),
  constraint "CK_ABAAREA_COVIEW" check ("CO_VIEW" ~ '^[a-z]+(-[a-z]+)*$'),
  constraint "CK_ABAAREA_STATIVO" check ("ST_ATIVO" in ('S', 'N'))
);
comment on table public."RL_ABA_AREA" is
  'Abas de cada área. Sem linha (ou com ST_ATIVO = N), a aba não aparece na área. Colunas nulas herdam de TB_ABA.';
comment on column public."RL_ABA_AREA"."CO_ABA" is 'Aba (TB_ABA).';
comment on column public."RL_ABA_AREA"."CO_AREA" is 'Área (TB_AREA).';
comment on column public."RL_ABA_AREA"."NU_ORDEM" is 'Ordem da aba nesta área; nulo = TB_ABA.NU_ORDEM.';
comment on column public."RL_ABA_AREA"."CO_VIEW" is 'Tela do front nesta área; nulo = TB_ABA.CO_VIEW (a Visão geral da Saúde Indígena é dashboard).';
comment on column public."RL_ABA_AREA"."DS_ICONE" is 'Ícone Lucide nesta área; nulo = TB_ABA.DS_ICONE.';
comment on column public."RL_ABA_AREA"."ST_ATIVO" is 'S: a aba aparece nesta área; N: não aparece.';
comment on column public."RL_ABA_AREA"."DT_CRIACAO" is 'Quando a aba entrou na área.';
comment on column public."RL_ABA_AREA"."DT_ATUALIZACAO" is 'Última alteração (preenchida pela futura RPC de manutenção).';
comment on column public."RL_ABA_AREA"."CO_USUARIO_ATUALIZACAO" is 'Usuário (auth.users.id) da última alteração; nulo no seed da migration.';

create index "IN_FKABAAREA_COAREA" on public."RL_ABA_AREA" ("CO_AREA");
comment on index public."IN_FKABAAREA_COAREA" is 'Chave estrangeira para TB_AREA (a PK começa por CO_ABA).';

-- Seed: o menu de hoje (espelho de ABAS_DO_MENU em src/lib/menu-lateral.js) --
insert into public."TB_ABA" ("CO_ABA", "NO_ABA", "DS_ICONE", "NU_ORDEM", "CO_VIEW", "CO_RECURSO", "TP_ABA") values
  ('visao-geral', 'Visão geral', 'layout-dashboard', 1, 'visao-area', 'dashboard', 'nativa'),
  ('editais', 'Editais', 'file-text', 2, 'nucleo', 'nucleo', 'nativa'),
  ('cronograma', 'Cronograma', 'calendar-days', 3, 'calendario', 'calendario', 'nativa'),
  ('aprovados', 'Lista de aprovados', 'user-round-check', 4, 'approved', 'aprovados', 'nativa'),
  ('analises', 'Análises curriculares', 'file-search', 5, 'analises', 'analises', 'nativa');

insert into public."RL_ABA_AREA" ("CO_ABA", "CO_AREA", "CO_VIEW", "DS_ICONE") values
  ('visao-geral', 'saude-indigena', 'dashboard', 'map'),
  ('visao-geral', 'sede', null, null),
  ('visao-geral', 'projetos', null, null),
  ('editais', 'saude-indigena', null, null),
  ('editais', 'sede', null, null),
  ('editais', 'projetos', null, null),
  ('cronograma', 'saude-indigena', null, null),
  ('cronograma', 'sede', null, null),
  ('cronograma', 'projetos', null, null),
  ('aprovados', 'saude-indigena', null, null),
  ('aprovados', 'sede', null, null),
  ('aprovados', 'projetos', null, null),
  ('analises', 'saude-indigena', null, null),
  ('analises', 'sede', null, null),
  ('analises', 'projetos', null, null);

-- Acesso: só leitura, só autenticado -------------------------------------------
alter table public."TB_ABA" enable row level security;
alter table public."RL_ABA_AREA" enable row level security;
create policy "PL_ABA_LEITURA" on public."TB_ABA" for select to authenticated using (true);
create policy "PL_ABA_AREA_LEITURA" on public."RL_ABA_AREA" for select to authenticated using (true);
comment on policy "PL_ABA_LEITURA" on public."TB_ABA" is 'Catálogo do menu: todo autenticado lê. Escrita só pela futura RPC de manutenção.';
comment on policy "PL_ABA_AREA_LEITURA" on public."RL_ABA_AREA" is 'Abas por área: todo autenticado lê. Escrita só pela futura RPC de manutenção.';
revoke all on public."TB_ABA", public."RL_ABA_AREA" from public, anon, authenticated;
grant select on public."TB_ABA", public."RL_ABA_AREA" to authenticated;

-- Leitura do menu ------------------------------------------------------------------
create function public.listar_abas_do_menu()
returns json
language sql
stable
security invoker
set search_path to ''
as $function$
  select coalesce(json_agg(json_build_object(
      'co_aba', a."CO_ABA",
      'no_aba', a."NO_ABA",
      'ds_icone', a."DS_ICONE",
      'nu_ordem', a."NU_ORDEM",
      'co_view', a."CO_VIEW",
      'co_recurso', a."CO_RECURSO",
      'tp_aba', a."TP_ABA",
      'areas', coalesce((
        select json_agg(json_build_object(
            'co_area', r."CO_AREA",
            'nu_ordem', coalesce(r."NU_ORDEM", a."NU_ORDEM"),
            'co_view', coalesce(r."CO_VIEW", a."CO_VIEW"),
            'ds_icone', coalesce(r."DS_ICONE", a."DS_ICONE")
          ) order by ar."NU_ORDEM", r."CO_AREA")
        from public."RL_ABA_AREA" r
        join public."TB_AREA" ar on ar."CO_AREA" = r."CO_AREA"
        where r."CO_ABA" = a."CO_ABA"
          and r."ST_ATIVO" = 'S'
      ), '[]'::json)
    ) order by a."NU_ORDEM", a."CO_ABA"), '[]'::json)
  from public."TB_ABA" a
  where a."ST_ATIVO" = 'S';
$function$;

comment on function public.listar_abas_do_menu() is
  'Catálogo ativo do menu lateral: abas com rótulo, ícone, ordem, view e recurso, e as áreas em que aparecem (ordem, view e ícone já resolvidos por área). Sem permissão por perfil: quem filtra é o front, como antes.';

revoke all on function public.listar_abas_do_menu() from public, anon;
grant execute on function public.listar_abas_do_menu() to authenticated, service_role;

commit;
