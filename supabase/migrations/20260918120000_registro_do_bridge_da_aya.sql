begin;

-- ---------------------------------------------------------------------------
-- Registro do endereco publico do bridge da Aya.
--
-- POR QUE
-- A IA da Aya roda no computador do responsavel pelo MONITORA, exposto por um
-- tunel HTTPS. Sem dominio proprio, esse tunel e um quick tunnel da Cloudflare,
-- que sorteia um hostname novo a cada execucao. O endereco vivia na variavel
-- `AYA_LOCAL_BRIDGE_URL` da Vercel, entao todo reinicio da maquina exigia
-- reconfigurar a variavel e redeployar a mao. Entre o reinicio e essa correcao
-- manual, a Aya ficava sem IA.
--
-- Aqui o proprio bridge passa a anunciar seu endereco atual. A funcao
-- `/api/aya` le daqui. Nao ha mais passo manual nem redeploy.
--
-- POR QUE UMA TABELA PROPRIA, E NAO `public.configuracoes`
-- `configuracoes` e legivel por `authenticated`. O endereco do tunel e a marca
-- temporal de presenca da maquina nao devem ficar a vista de todo usuario
-- logado. Esta tabela tem RLS ligada e NENHUMA policy: nem `anon` nem
-- `authenticated` alcancam uma linha por acesso direto. Todo acesso passa pelas
-- duas funcoes abaixo, que controlam exatamente o que entra e o que sai.
--
-- COMO A ESCRITA E AUTENTICADA
-- O bridge ja compartilha um segredo com a Vercel, o `AYA_LOCAL_BRIDGE_KEY`,
-- usado no cabecalho `X-Aya-Bridge-Key`. A escrita reaproveita esse segredo.
-- O segredo NAO e gravado aqui: guarda-se apenas o sha256 dele, e a comparacao
-- acontece dentro da funcao. Nem a migration nem o repositorio contem o valor.
--
-- O hash e definido uma unica vez, fora do versionamento, por quem opera:
--
--   select public.definir_segredo_bridge_aya('<a mesma chave do bridge>');
--
-- Enquanto o hash nao for definido, `registrar_bridge_aya` recusa toda escrita
-- e `/api/aya` continua usando `AYA_LOCAL_BRIDGE_URL`. A mudanca e, portanto,
-- inerte ate alguem decidir ativa-la.
--
-- COMO E SEGURA
--   - tabela com RLS ligada e sem policies; `revoke all` para `anon` e
--     `authenticated`, entao o acesso direto nao existe;
--   - `security definer` com `search_path = ''` e nomes qualificados, para nao
--     ser desviada por search_path hostil;
--   - `registrar_bridge_aya` exige o segredo e so aceita URL `https://`;
--   - `obter_bridge_aya` e concedida apenas a `authenticated`, e a `/api/aya`
--     so a chama depois de validar a sessao do usuario;
--   - `obter_bridge_aya` devolve a idade do registro, para que quem le possa
--     distinguir maquina presente de registro velho;
--   - `statement_timeout` curto nas duas.
--
-- O QUE ESTA MIGRATION NAO FAZ
-- Nao altera `public.configuracoes`, nao mexe em policy existente, nao concede
-- nada a `anon` alem da funcao de escrita protegida por segredo, e nao toca em
-- nenhuma outra tabela, funcao ou grant.
--
-- DEPENDENTES
--   - `scripts/aya-local-bridge.mjs` chama `registrar_bridge_aya`
--   - `api/aya.js` chama `obter_bridge_aya`
--
-- ROLLBACK
--   begin;
--     drop function if exists public.obter_bridge_aya();
--     drop function if exists public.registrar_bridge_aya(text, text);
--     drop function if exists public.definir_segredo_bridge_aya(text);
--     drop table if exists public.aya_bridge;
--   commit;
--   `/api/aya` volta a usar `AYA_LOCAL_BRIDGE_URL`, que continua sendo lida como
--   alternativa e nunca deixou de funcionar.
-- ---------------------------------------------------------------------------

-- `digest` vem do pgcrypto. No Supabase ele costuma ja estar no schema
-- `extensions`, mas declarar a dependencia evita uma migration que falha em
-- projeto novo.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.aya_bridge (
  id boolean primary key default true,
  url text,
  atualizado_em timestamptz,
  chave_sha256 text,
  constraint aya_bridge_linha_unica check (id)
);

alter table public.aya_bridge enable row level security;
revoke all on table public.aya_bridge from anon;
revoke all on table public.aya_bridge from authenticated;

insert into public.aya_bridge (id) values (true)
on conflict (id) do nothing;

comment on table public.aya_bridge is
  'Endereco publico atual do bridge da Aya. RLS ligada e sem policies: so as funcoes security definer deste modulo acessam.';

-- ---------------------------------------------------------------------------
-- Define o segredo de escrita. Executada uma unica vez por quem opera, fora do
-- versionamento. Recusa a troca silenciosa: para trocar o segredo e preciso
-- limpar `chave_sha256` deliberadamente.
-- ---------------------------------------------------------------------------
create or replace function public.definir_segredo_bridge_aya(p_chave text)
returns text
language plpgsql
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
declare
  v_existente text;
begin
  if p_chave is null or length(btrim(p_chave)) < 24 then
    return 'recusado: a chave precisa de ao menos 24 caracteres';
  end if;

  select b.chave_sha256 into v_existente from public.aya_bridge as b where b.id;

  if v_existente is not null then
    return 'recusado: o segredo ja esta definido';
  end if;

  update public.aya_bridge
     set chave_sha256 = encode(extensions.digest(p_chave, 'sha256'), 'hex')
   where id;

  return 'definido';
end;
$$;

revoke all on function public.definir_segredo_bridge_aya(text) from public;

comment on function public.definir_segredo_bridge_aya(text) is
  'Define, uma unica vez, o sha256 do segredo de escrita do bridge da Aya. Sem grants: roda no editor SQL do projeto.';

-- ---------------------------------------------------------------------------
-- Escrita: o bridge anuncia o endereco publico em que esta acessivel.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_bridge_aya(p_chave text, p_url text)
returns text
language plpgsql
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
declare
  v_hash text;
  v_url text := btrim(coalesce(p_url, ''));
begin
  select b.chave_sha256 into v_hash from public.aya_bridge as b where b.id;

  if v_hash is null then
    return 'segredo_nao_definido';
  end if;

  if p_chave is null
     or encode(extensions.digest(p_chave, 'sha256'), 'hex') is distinct from v_hash then
    return 'chave_invalida';
  end if;

  -- Endereco de tunel é sempre HTTPS. Recusar o resto evita que um registro
  -- errado faca `/api/aya` falar em texto claro com um destino qualquer.
  if v_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/.*)?$' then
    return 'url_invalida';
  end if;

  update public.aya_bridge
     set url = rtrim(v_url, '/'),
         atualizado_em = now()
   where id;

  return 'ok';
end;
$$;

revoke all on function public.registrar_bridge_aya(text, text) from public;
grant execute on function public.registrar_bridge_aya(text, text) to anon;
grant execute on function public.registrar_bridge_aya(text, text) to authenticated;

comment on function public.registrar_bridge_aya(text, text) is
  'O bridge da Aya anuncia seu endereco publico atual. Exige o segredo compartilhado; aceita apenas https.';

-- ---------------------------------------------------------------------------
-- Leitura: usada por `/api/aya` depois de validar a sessao do usuario.
-- ---------------------------------------------------------------------------
create or replace function public.obter_bridge_aya()
returns jsonb
language sql
stable
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
  select jsonb_build_object(
    'url', b.url,
    'atualizado_em', b.atualizado_em,
    'idade_segundos',
      case
        when b.atualizado_em is null then null
        else floor(extract(epoch from (now() - b.atualizado_em)))
      end
  )
  from public.aya_bridge as b
  where b.id;
$$;

revoke all on function public.obter_bridge_aya() from public;
grant execute on function public.obter_bridge_aya() to authenticated;

comment on function public.obter_bridge_aya() is
  'Endereco publico atual do bridge da Aya e a idade do registro. Leitura, apenas para sessao autenticada.';

commit;
