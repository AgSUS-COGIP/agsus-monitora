/*
  FECHAR A VIEW DAS ANÁLISES E O ADMINISTRADOR GLOBAL PASSANDO EM TODA PERMISSÃO

  Achados da auditoria de segurança (somente leitura, 03/11/2026):

  1. CRÍTICO — public."VW_ANALISES_DASHBOARD_BASE_TODOS" perdeu o
     security_invoker na 20261022120000_fora_do_lote_fora_do_painel (o
     CREATE OR REPLACE VIEW sem o WITH zera as opções). Dona: postgres, com
     SELECT para authenticated: a view lia TB_ANALISE_CURRICULAR e
     TB_EDITAL_ANALISE como a dona, sem RLS nem matriz de Acessos. Como
     authenticated sem perfil, a view devolvia 30.652 linhas (dados pessoais
     de todas as áreas) e a tabela, 0. A VW_ANALISES_DASHBOARD_BASE (que lê a
     _TODOS) já era security_invoker, mas herdava o vazamento.

     Quem lê a view (repositório + pg_depend/pg_rewrite + pg_proc, 03/11):
       - view public."VW_ANALISES_DASHBOARD_BASE" (ninguém a lê: nenhuma
         função, nenhum código do front);
       - private."FC_MONTAR_PAINEL_ANALISE" (SECURITY INVOKER, execução só da
         postgres), chamada por public.atualizar_cache_painel_analises,
         public.get_analises_dashboard_payload_v2 e public.paineis_ler_fontes
         (as três SECURITY DEFINER da postgres);
       - public.get_analise_detalhe_do_painel, get_analises_texto_do_painel,
         obter_marcos_da_area e paineis_ler_fontes (SECURITY DEFINER da
         postgres);
       - o Python (python/monitora/paineis/pacotes.py) não lê a view: recebe as
         linhas de public.paineis_ler_fontes como service_role;
       - o front (src/) não lê a view pelo PostgREST: só cita o nome num
         comentário de src/lib/editais-das-linhas.ts.
     Todos os leitores legítimos rodam como postgres (BYPASSRLS), então seguem
     iguais com a view security_invoker e sem o SELECT de authenticated.

     Agora: as duas views ficam security_invoker = true e sem privilégio para
     anon, authenticated e PUBLIC (o app só lê por RPC). service_role mantém o
     que tinha.

  2. ALTO — o administrador global nem sempre passava em pode_recurso.
     private.nivel_recurso → private."FC_NIVEL_EFETIVO" usava a permissão
     individual (TB_PERMISSAO_RECURSO) e depois o nível do grupo, sem atalho
     para o administrador global. No grupo admin, 'acessos' e
     'recursos_parecer' são editor (2) e 'chat' é leitor (1); e uma permissão
     individual podia rebaixar um administrador (calendario/recursos editor).
     Assim falhavam no nível 3: salvar/listar/arquivar_modelo_resposta_recurso,
     get_recursos_da_area (parte de nível 3) e a policy recurso_exclusao de
     TB_MONITORAMENTO_INDIGENA (calendario 3).

     Regra do produto: o administrador global faz tudo. A correção é na fonte:
     FC_NIVEL_EFETIVO devolve 'admin' (o maior nível: sem_acesso < leitor <
     editor < admin) quando o grupo do perfil é ST_ADMIN_GLOBAL. Pelo grupo do
     perfil, e não por private.is_master(), porque FC_NIVEL_EFETIVO também
     calcula o nível de OUTRA pessoa (obter_contexto_de_usuario, "como a pessoa
     vê", reativar_acesso_usuario, salvar_matriz_acessos); para quem lê,
     nivel_recurso já passa o perfil ativo dele (current_profile), o que dá o
     mesmo resultado de is_master() (e-mail e user_id são únicos). Custo: uma
     leitura pela chave primária de TB_GRUPO_ACESSO (7 linhas), sem nova
     varredura de TB_PERFIL_USUARIO e sem recursão.
     Nenhuma permissão individual é apagada: as dos administradores ficam
     guardadas e sem efeito enquanto a pessoa estiver no grupo admin.

  3. FC_NIVEL_EFETIVO está no fecho das leituras por versão (20261029170000):
     recalcula as fontes delas (TB_GRUPO_ACESSO já é fonte).

  Ensaio: supabase/ensaios/20261103120000_fechar_view_das_analises_e_admin_global_passa.sql
  Rollback: supabase/rollback/20261103120000_fechar_view_das_analises_e_admin_global_passa.sql
*/
begin;

set local lock_timeout = '5s';

-- 0. Guardas --------------------------------------------------------------------------------------
do $$
declare
  v_corpo text;
  v_leitor regprocedure;
begin
  if to_regclass('public."VW_ANALISES_DASHBOARD_BASE_TODOS"') is null
     or to_regclass('public."VW_ANALISES_DASHBOARD_BASE"') is null then
    raise exception 'Views das análises ausentes: aplique antes 20261022120000.';
  end if;
  if to_regprocedure('private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(boolean)') is null then
    raise exception 'Aplique antes 20261029170000_marca_barata_das_leituras_por_versao.sql.';
  end if;

  -- FC_NIVEL_EFETIVO: a de antes (20260929121000) ou esta, já aplicada.
  select btrim(regexp_replace(p.prosrc, '\s+', ' ', 'g')) into v_corpo
    from pg_catalog.pg_proc p
   where p.oid = to_regprocedure('private."FC_NIVEL_EFETIVO"(uuid, text, text)');
  if v_corpo is null then
    raise exception 'private."FC_NIVEL_EFETIVO"(uuid, text, text) ausente.';
  end if;
  if md5(v_corpo) <> '58248431dcc1ed9181f8aa54f74c094b'
     and position('ST_ADMIN_GLOBAL' in v_corpo) = 0 then
    raise exception 'private."FC_NIVEL_EFETIVO" diferente da que esta migration conhece: confira antes de aplicar.';
  end if;

  -- Os leitores da view são os conhecidos; um novo pode depender do SELECT de authenticated.
  for v_leitor in
    select p.oid::regprocedure
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and p.prosrc like '%VW_ANALISES_DASHBOARD_BASE%'
       and p.oid not in (
         to_regprocedure('private."FC_MONTAR_PAINEL_ANALISE"(text, text[], boolean)'),
         to_regprocedure('public.paineis_ler_fontes(text, text)'),
         to_regprocedure('public.get_analise_detalhe_do_painel(uuid)'),
         to_regprocedure('public.get_analises_texto_do_painel(text, text)'),
         to_regprocedure('public.obter_marcos_da_area(text)'))
  loop
    raise exception 'Leitor da view das análises que esta migration não conhece: %', v_leitor;
  end loop;

  -- O leitor SECURITY INVOKER não pode ser chamado por authenticated/anon/service_role direto.
  if has_function_privilege('authenticated', 'private."FC_MONTAR_PAINEL_ANALISE"(text, text[], boolean)', 'execute')
     or has_function_privilege('anon', 'private."FC_MONTAR_PAINEL_ANALISE"(text, text[], boolean)', 'execute') then
    raise exception 'private."FC_MONTAR_PAINEL_ANALISE" executável por authenticated/anon: revise antes.';
  end if;
  -- Os SECURITY DEFINER leem como uma dona com BYPASSRLS.
  if exists (
    select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_roles r on r.oid = p.proowner
     where p.oid in (
             to_regprocedure('public.paineis_ler_fontes(text, text)'),
             to_regprocedure('public.get_analise_detalhe_do_painel(uuid)'),
             to_regprocedure('public.get_analises_texto_do_painel(text, text)'),
             to_regprocedure('public.obter_marcos_da_area(text)'),
             to_regprocedure('public.atualizar_cache_painel_analises(text, text[])'),
             to_regprocedure('public.get_analises_dashboard_payload_v2(text, text)'))
       and not (p.prosecdef and (r.rolbypassrls or r.rolsuper))) then
    raise exception 'Leitor da view das análises que não é SECURITY DEFINER de dona com BYPASSRLS.';
  end if;
end;
$$;

-- 1. As views das análises: invoker e só por RPC ------------------------------------------------
alter view public."VW_ANALISES_DASHBOARD_BASE_TODOS" set (security_invoker = true);
alter view public."VW_ANALISES_DASHBOARD_BASE" set (security_invoker = true);

revoke all on public."VW_ANALISES_DASHBOARD_BASE_TODOS" from public, anon, authenticated;
revoke all on public."VW_ANALISES_DASHBOARD_BASE" from public, anon, authenticated;

comment on view public."VW_ANALISES_DASHBOARD_BASE_TODOS" is
  'Base do Painel das análises (todas as situações). security_invoker; sem acesso de anon/authenticated: '
  'lida só pelas RPCs SECURITY DEFINER (painel, texto, detalhe, marcos) e pelo job via paineis_ler_fontes. '
  'Ao recriar com CREATE OR REPLACE VIEW, repetir WITH (security_invoker = true).';
comment on view public."VW_ANALISES_DASHBOARD_BASE" is
  'Recorte ativo da VW_ANALISES_DASHBOARD_BASE_TODOS. security_invoker; sem acesso de anon/authenticated.';

-- 2. Nível efetivo: o administrador global é admin em todo recurso ----------------------------
create or replace function private."FC_NIVEL_EFETIVO"(p_perfil_usuario uuid, p_grupo text, p_recurso text)
 returns text
 language sql
 stable security definer
 set search_path to ''
as $function$
  -- Administrador global faz tudo: o maior nível, acima da permissão individual e do grupo.
  select case
    when exists (select 1 from public."TB_GRUPO_ACESSO" a
                  where a."CO_GRUPO_ACESSO" = p_grupo and a."ST_ADMIN_GLOBAL") then 'admin'
    else coalesce(
      (select g.nivel from public."TB_PERMISSAO_RECURSO" g
        where g.perfil_usuario_id = p_perfil_usuario and g.recurso = p_recurso),
      private."FC_NIVEL_DO_GRUPO"(p_grupo, p_recurso))
  end;
$function$;

revoke all on function private."FC_NIVEL_EFETIVO"(uuid, text, text) from public, anon, authenticated;

comment on function private."FC_NIVEL_EFETIVO"(uuid, text, text) is
  'Nível efetivo de um usuário: administrador global (grupo ST_ADMIN_GLOBAL) = admin; senão a exceção '
  '(TB_PERMISSAO_RECURSO) ?? o nível do grupo.';

-- 3. As leituras por versão (20261029170000) ----------------------------------------------------
-- FC_NIVEL_EFETIVO está no fecho das leituras: recalcula as fontes delas.
select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();

notify pgrst, 'reload schema';

commit;
