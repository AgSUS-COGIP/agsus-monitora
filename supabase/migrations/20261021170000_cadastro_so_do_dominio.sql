/*
  Cadastro só do domínio institucional (verificação de segurança de 21/10/2026).

  Até aqui o domínio institucional só era exigido NO NAVEGADOR: src/app/sessao.js
  lê auth_google_allowed_domains de TB_CONFIGURACAO e barra quem não é do
  domínio. Quem chamar o OAuth do Supabase direto (sem passar pela tela) com
  qualquer conta Google vira usuário authenticated, ainda que sem perfil. Hoje
  são 41 contas, nenhuma fora do domínio; o login por e-mail já foi desligado.

  1. public."FC_HOOK_ANTES_CRIAR_USUARIO"(event jsonb): função para o hook
     "Before User Created" do Supabase Auth. O Auth a chama ANTES de gravar a
     conta nova (qualquer provedor, convite ou criação pelo painel) com
     { metadata, user }; o e-mail vem em event->'user'->>'email'. Devolve '{}'
     para permitir ou { error: { http_code: 403, message } } para recusar — a
     mensagem volta para a tela de login. A regra é a do front
     (normalizeAllowedDomains / isAllowedInstitutionalEmail em
     src/lib/platform-context.js): domínio = o que vem depois do ÚLTIMO @, em
     minúsculas; a lista de auth_google_allowed_domains é separada por vírgula
     (aqui também por espaço ou ponto e vírgula), sem o @ inicial, sem
     repetidos. Chave ausente ou vazia usa 'agenciasus.org.br,agsus.org.br'
     (nunca libera tudo). E-mail ausente (telefone, anônimo) ou malformado é
     recusado. Contas que já existem não passam pelo hook.

     Permissões, na forma que a documentação do Supabase recomenda para hooks
     em Postgres: a função NÃO é SECURITY DEFINER (a documentação desaconselha
     o security definer em hooks) — roda como supabase_auth_admin, que recebe
     só o necessário: USAGE no schema public, EXECUTE na função (tirado de
     public, anon e authenticated, para ninguém chamá-la pela API), SELECT em
     TB_CONFIGURACAO e uma policy de RLS que deixa esse papel ler SÓ a linha
     auth_google_allowed_domains. search_path vazio, como nas demais funções.

     A migration NÃO liga o hook: isso se faz em Auth → Hooks → Before User
     Created, apontando para public."FC_HOOK_ANTES_CRIAR_USUARIO", depois de
     aplicada. Para desligar: desligar o hook (e, se quiser, o rollback).

  2. TB_PLANILHA_ANALISE: a policy "PL_PLANILHA_ANALISE_LEITURA" (SELECT,
     authenticated, using true) mostrava os IDs das planilhas do Drive a
     qualquer authenticated — inclusive a quem entrou com Google e não tem
     perfil. Nenhuma tela lê a tabela direto (src não a cita) e todas as
     funções do banco que a leem são SECURITY DEFINER do postgres
     (FC_EDITAL_ANALISE_NO_MONITORA, FC_VALIDAR_GRUPO_STAGING_ANALISE,
     get_saude_das_cargas, processar_sync_analises_lote,
     FC_PREPARAR_EDITAL_TREINAMENTO, FC_PUBLICAR_FICHA_ANALISE), que não passam
     pela RLS; api/ e scripts/ usam service_role. A leitura direta passa a
     exigir o recurso 'configuracoes' (leitor), o mesmo da tela de
     configurações, onde as planilhas são cadastradas.
*/
begin;

-- 1. Hook "Before User Created" ---------------------------------------------
create or replace function public."FC_HOOK_ANTES_CRIAR_USUARIO"(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_email    text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
  v_dominio  text;
  v_dominios text[];
  v_lista    text;
  v_n        integer;
begin
  -- Lista de domínios: auth_google_allowed_domains, como normalizeAllowedDomains do front.
  select array_agg(t.dominio order by t.ordem)
    into v_dominios
    from (
      select x.dominio, min(x.ordem) as ordem
        from (
          select ltrim(lower(btrim(p.parte)), '@') as dominio, p.ordem
            from public."TB_CONFIGURACAO" c
           cross join lateral regexp_split_to_table(coalesce(c.valor, ''), '[,;[:space:]]+')
                 with ordinality as p(parte, ordem)
           where c.chave = 'auth_google_allowed_domains'
        ) x
       where x.dominio <> ''
       group by x.dominio
    ) t;

  if coalesce(cardinality(v_dominios), 0) = 0 then
    v_dominios := array['agenciasus.org.br', 'agsus.org.br'];
  end if;

  -- O domínio é o que vem depois do último @ (com algo antes dele).
  if v_email ~ '^[^@].*@[^@]+$' then
    v_dominio := substring(v_email from '@([^@]+)$');
  end if;

  if v_dominio is not null and v_dominio = any (v_dominios) then
    return '{}'::jsonb;
  end if;

  v_n := cardinality(v_dominios);
  v_lista := case
    when v_n = 1 then '@' || v_dominios[1]
    else (select string_agg('@' || d.dominio, ', ' order by d.ordem)
            from unnest(v_dominios[1:v_n - 1]) with ordinality as d(dominio, ordem))
         || ' ou @' || v_dominios[v_n]
  end;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Use uma conta institucional (' || v_lista || ').'
    )
  );
end;
$function$;

comment on function public."FC_HOOK_ANTES_CRIAR_USUARIO"(jsonb) is
  'Hook Before User Created do Supabase Auth: só deixa criar conta com e-mail de domínio de auth_google_allowed_domains (TB_CONFIGURACAO; padrão agenciasus.org.br,agsus.org.br). Devolve {} ou {error:{http_code:403,message}}. Executada só por supabase_auth_admin.';

grant usage on schema public to supabase_auth_admin;
revoke execute on function public."FC_HOOK_ANTES_CRIAR_USUARIO"(jsonb) from public, anon, authenticated;
grant execute on function public."FC_HOOK_ANTES_CRIAR_USUARIO"(jsonb) to supabase_auth_admin;

-- O Auth lê a lista de domínios: SELECT na tabela e RLS só para a linha da lista.
grant select on table public."TB_CONFIGURACAO" to supabase_auth_admin;

drop policy if exists "PL_CONFIGURACAO_LEITURA_HOOK_AUTH" on public."TB_CONFIGURACAO";
create policy "PL_CONFIGURACAO_LEITURA_HOOK_AUTH" on public."TB_CONFIGURACAO"
  for select to supabase_auth_admin
  using (chave = 'auth_google_allowed_domains');

comment on policy "PL_CONFIGURACAO_LEITURA_HOOK_AUTH" on public."TB_CONFIGURACAO" is
  'O Supabase Auth (supabase_auth_admin) lê só a lista de domínios institucionais, para o hook FC_HOOK_ANTES_CRIAR_USUARIO.';

-- 2. TB_PLANILHA_ANALISE: leitura direta só para quem vê configurações --------
alter policy "PL_PLANILHA_ANALISE_LEITURA" on public."TB_PLANILHA_ANALISE"
  using ((select private.pode_recurso('configuracoes', 1)));

comment on policy "PL_PLANILHA_ANALISE_LEITURA" on public."TB_PLANILHA_ANALISE" is
  'Leitura direta das planilhas (IDs do Drive) só com o recurso configuracoes (leitor). As funções do sync e do painel são SECURITY DEFINER e não dependem desta policy.';

commit;
