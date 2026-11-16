/*
  PAINÉIS NO BLOCO "DADOS" DO MENU (13/11/2026)

  POR QUE
  Cada área (Saúde Indígena, SEDE, Projetos) ganha o módulo "Painéis", num bloco novo do menu
  lateral, "Dados", abaixo de "Processo seletivo". Os painéis de dados da área entram nessa página.

  O QUE MUDA
    1. O recurso novo "paineis_dados" (Painéis (Dados)) na matriz de acessos: FC_RECURSOS_MODULO
       estendida (espelho de RESOURCES em src/lib/permissoes-recursos.ts). Valor inicial dos grupos:
       administrador global Administrador, os outros Sem acesso — o administrador global libera na
       tela de Acessos.
    2. A aba "paineis-de-dados" (Painéis, ícone layout-dashboard, ordem 14, selo BETA) no catálogo
       (TB_ABA), ligada nas três áreas (RL_ABA_AREA). O bloco Dados é do front
       (`blocoDaAba`, src/lib/menu-lateral.ts); o banco só guarda a aba.

  DESFAZER: supabase/rollback/20261113200000_paineis_no_bloco_dados.sql.
  ENSAIO:   supabase/ensaios/20261113200000_paineis_no_bloco_dados.sql.
*/
begin;

do $$
begin
  -- A lista que esta migration estende é a de 20261026190000 (aprovados_pendencias).
  if not ('aprovados_pendencias' = any (private."FC_RECURSOS_MODULO"())) then
    raise exception 'FC_RECURSOS_MODULO não é a esperada (falta aprovados_pendencias).';
  end if;
  if 'paineis_dados' = any (private."FC_RECURSOS_MODULO"()) then
    raise exception 'O recurso paineis_dados já existe.';
  end if;
  if exists (select 1 from public."TB_ABA" where "CO_ABA" = 'paineis-de-dados') then
    raise exception 'A aba paineis-de-dados já existe.';
  end if;
end;
$$;

-- 1. O recurso "paineis_dados" na matriz de acessos ----------------------------------------------
create or replace function private."FC_RECURSOS_MODULO"()
 returns text[]
 language sql
 immutable
 set search_path to ''
as $function$
  select array['dashboard','analises','nucleo','calendario','aprovados','importacao','paineis','configuracoes','acessos','recursos','entrevistas','selecao','recursos_parecer','classificacao','chat','avaliacao_documental','aprovados_pendencias','paineis_dados']::text[];
$function$;

-- Todo módulo tem nível em todo grupo; o administrador global muda na tela de Acessos.
insert into public."TA_GRUPO_ACESSO_RECURSO" ("CO_GRUPO_ACESSO", "NO_RECURSO", "TP_NIVEL")
select g."CO_GRUPO_ACESSO", 'paineis_dados',
       case when g."ST_ADMIN_GLOBAL" then 'admin' else 'sem_acesso' end
  from public."TB_GRUPO_ACESSO" g
on conflict ("CO_GRUPO_ACESSO", "NO_RECURSO") do nothing;

-- 2. A aba "Painéis" nas três áreas --------------------------------------------------------------
insert into public."TB_ABA" ("CO_ABA", "NO_ABA", "DS_ICONE", "NU_ORDEM", "CO_VIEW", "CO_RECURSO", "TP_ABA", "ST_ATIVO", "ST_BETA")
values ('paineis-de-dados', 'Painéis', 'layout-dashboard', 14, 'paineis-de-dados', 'paineis_dados', 'nativa', 'S', 'S');

insert into public."RL_ABA_AREA" ("CO_ABA", "CO_AREA", "ST_ATIVO")
select 'paineis-de-dados', a.codigo, 'S'
  from (values ('saude-indigena'), ('sede'), ('projetos')) as a (codigo)
on conflict do nothing;

commit;
