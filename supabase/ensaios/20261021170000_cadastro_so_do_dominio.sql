/*
  ENSAIO de 20261021170000_cadastro_so_do_dominio.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Aplica a migration dentro
  da transação e confere:
    1. public."FC_HOOK_ANTES_CRIAR_USUARIO" com o evento do hook Before User
       Created: @agenciasus.org.br e @agsus.org.br permitidos ({}); @gmail.com
       recusado (403 com a mensagem montada da lista); maiúsculas e espaços
       aceitos; domínio antes do @, subdomínio de fora, e-mail sem @, e-mail
       ausente e evento sem user recusados;
    2. auth_google_allowed_domains vazia, nula ou ausente usa o padrão
       (agenciasus.org.br, agsus.org.br) — nunca libera tudo; lista com @,
       espaço e ponto e vírgula é normalizada e a mensagem acompanha a lista;
    3. permissões: só supabase_auth_admin executa a função (anon e
       authenticated não), ela não é SECURITY DEFINER, supabase_auth_admin lê
       TB_CONFIGURACAO e a policy dele só mostra a linha da lista;
    4. TB_PLANILHA_ANALISE: um authenticated sem perfil não lê nenhuma linha;
       um administrador global lê.
  O papel postgres não é membro de supabase_auth_admin, então o item 3 confere
  os privilégios pelo catálogo em vez de trocar de papel.
  Termina em rollback: nada fica gravado.
*/
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';


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

-- Quem faz o ensaio da policy: um administrador global (só o id) e um id sem perfil.
select set_config('ensaio.admin', json_build_object('sub', u.user_id, 'role', 'authenticated')::text, true)
  from public."TB_PERFIL_USUARIO" u join public."TB_GRUPO_ACESSO" g on g."CO_GRUPO_ACESSO" = u.perfil
 where u.ativo and g."ST_ADMIN_GLOBAL" and u.user_id is not null
 order by u.updated_at desc limit 1;
select set_config('ensaio.sem_perfil', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);

do $ensaio$
declare
  v_msg_padrao constant text := 'Use uma conta institucional (@agenciasus.org.br ou @agsus.org.br).';
  v_r jsonb;
begin
  -- 1. A função com a lista atual.
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"(jsonb_build_object(
           'metadata', jsonb_build_object('name', 'before-user-created'),
           'user', jsonb_build_object('email', 'fulana.tal@agenciasus.org.br',
                                      'app_metadata', jsonb_build_object('provider', 'google'))));
  assert v_r = '{}'::jsonb, '@agenciasus.org.br recusado: ' || v_r::text;
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":"fulano@agsus.org.br"}}');
  assert v_r = '{}'::jsonb, '@agsus.org.br recusado: ' || v_r::text;
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":"  Fulano.Tal@AgenciaSUS.Org.BR "}}');
  assert v_r = '{}'::jsonb, 'maiúsculas recusadas: ' || v_r::text;

  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":"alguem@gmail.com"}}');
  assert (v_r -> 'error' ->> 'http_code')::int = 403, '@gmail.com sem 403: ' || coalesce(v_r::text, '<nulo>');
  assert v_r -> 'error' ->> 'message' = v_msg_padrao, 'mensagem: ' || v_r::text;
  assert (select count(*) from jsonb_object_keys(v_r)) = 1, 'resposta com chaves a mais: ' || v_r::text;

  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":"agsus.org.br@gmail.com"}}');
  assert v_r ? 'error', 'domínio antes do @ passou';
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":"x@agsus.org.br.gmail.com"}}');
  assert v_r ? 'error', 'subdomínio de fora passou';
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":"@agsus.org.br"}}');
  assert v_r ? 'error', 'e-mail sem nome passou';
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":"agsus.org.br"}}');
  assert v_r ? 'error', 'e-mail sem @ passou';
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"phone":"5561999999999"}}');
  assert (v_r -> 'error' ->> 'http_code')::int = 403, 'e-mail ausente passou: ' || v_r::text;
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":null}}');
  assert v_r ? 'error', 'e-mail nulo passou';
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"metadata":{}}');
  assert v_r ? 'error', 'evento sem user passou';
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"(null);
  assert v_r ? 'error', 'evento nulo passou';

  -- 2. Chave vazia, nula, ausente e lista "suja".
  update public."TB_CONFIGURACAO" set valor = '  ' where chave = 'auth_google_allowed_domains';
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":"fulano@agsus.org.br"}}');
  assert v_r = '{}'::jsonb, 'chave vazia: padrão não aplicado';
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":"alguem@gmail.com"}}');
  assert v_r -> 'error' ->> 'message' = v_msg_padrao, 'chave vazia liberou: ' || v_r::text;

  update public."TB_CONFIGURACAO" set valor = null where chave = 'auth_google_allowed_domains';
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":"alguem@gmail.com"}}');
  assert v_r ? 'error', 'chave nula liberou';

  delete from public."TB_CONFIGURACAO" where chave = 'auth_google_allowed_domains';
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":"fulana@agenciasus.org.br"}}');
  assert v_r = '{}'::jsonb, 'chave ausente: padrão não aplicado';
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":"alguem@gmail.com"}}');
  assert v_r -> 'error' ->> 'message' = v_msg_padrao, 'chave ausente liberou: ' || v_r::text;

  insert into public."TB_CONFIGURACAO" (chave, valor)
  values ('auth_google_allowed_domains', ' @AgSUS.org.br ; exemplo.gov.br,, agsus.org.br  saude.gov.br ');
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":"a@exemplo.gov.br"}}');
  assert v_r = '{}'::jsonb, 'lista suja: exemplo.gov.br recusado';
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":"a@agenciasus.org.br"}}');
  assert v_r ? 'error', 'lista própria: o padrão continuou valendo';
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":"alguem@gmail.com"}}');
  assert v_r -> 'error' ->> 'message'
         = 'Use uma conta institucional (@agsus.org.br, @exemplo.gov.br ou @saude.gov.br).',
         'mensagem da lista: ' || v_r::text;

  update public."TB_CONFIGURACAO" set valor = 'agsus.org.br' where chave = 'auth_google_allowed_domains';
  v_r := public."FC_HOOK_ANTES_CRIAR_USUARIO"('{"user":{"email":"alguem@gmail.com"}}');
  assert v_r -> 'error' ->> 'message' = 'Use uma conta institucional (@agsus.org.br).',
         'mensagem com um domínio: ' || v_r::text;

  -- 3. Permissões.
  assert has_function_privilege('supabase_auth_admin', 'public."FC_HOOK_ANTES_CRIAR_USUARIO"(jsonb)', 'EXECUTE'),
         'supabase_auth_admin sem EXECUTE';
  assert not has_function_privilege('authenticated', 'public."FC_HOOK_ANTES_CRIAR_USUARIO"(jsonb)', 'EXECUTE'),
         'authenticated executa o hook';
  assert not has_function_privilege('anon', 'public."FC_HOOK_ANTES_CRIAR_USUARIO"(jsonb)', 'EXECUTE'),
         'anon executa o hook';
  assert not (select p.prosecdef from pg_proc p where p.oid = 'public."FC_HOOK_ANTES_CRIAR_USUARIO"(jsonb)'::regprocedure),
         'o hook ficou SECURITY DEFINER';
  assert has_schema_privilege('supabase_auth_admin', 'public', 'USAGE'), 'supabase_auth_admin sem USAGE em public';
  assert has_table_privilege('supabase_auth_admin', 'public."TB_CONFIGURACAO"', 'SELECT'),
         'supabase_auth_admin sem SELECT em TB_CONFIGURACAO';
  assert not has_table_privilege('supabase_auth_admin', 'public."TB_CONFIGURACAO"', 'UPDATE'),
         'supabase_auth_admin pode alterar TB_CONFIGURACAO';
  assert exists (select 1 from pg_policies p
                  where p.schemaname = 'public' and p.tablename = 'TB_CONFIGURACAO'
                    and p.policyname = 'PL_CONFIGURACAO_LEITURA_HOOK_AUTH' and p.cmd = 'SELECT'
                    and p.roles = '{supabase_auth_admin}'
                    and p.qual = '(chave = ''auth_google_allowed_domains''::text)'),
         'policy do supabase_auth_admin ausente ou diferente';
  assert (select c.relrowsecurity from pg_class c where c.oid = 'public."TB_CONFIGURACAO"'::regclass),
         'TB_CONFIGURACAO sem RLS';
  assert exists (select 1 from pg_policies p
                  where p.schemaname = 'public' and p.tablename = 'TB_PLANILHA_ANALISE'
                    and p.policyname = 'PL_PLANILHA_ANALISE_LEITURA'
                    and p.qual like '%pode_recurso(''configuracoes''::text, 1)%'),
         'policy de TB_PLANILHA_ANALISE não trocada';
end;
$ensaio$;

-- 4. TB_PLANILHA_ANALISE pela RLS, como authenticated.
set local role authenticated;

do $ensaio_policy$
declare
  v_n integer;
begin
  perform set_config('request.jwt.claims', current_setting('ensaio.sem_perfil'), true);
  select count(*) into v_n from public."TB_PLANILHA_ANALISE";
  assert v_n = 0, 'authenticated sem perfil leu ' || v_n || ' planilha(s)';

  perform set_config('request.jwt.claims', current_setting('ensaio.admin'), true);
  select count(*) into v_n from public."TB_PLANILHA_ANALISE";
  assert v_n > 0, 'administrador global não leu as planilhas';
end;
$ensaio_policy$;

reset role;

select 'ensaio ok' as resultado;

rollback;
