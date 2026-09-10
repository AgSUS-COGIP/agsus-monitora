-- Modo do texto da tela de acesso: automático, sempre claro ou sempre escuro.
--
-- A tela de acesso é pintada antes do login, com o que
-- `obter_branding_acesso_publico()` devolve. A lista de chaves dessa função é
-- fixa, então uma configuração nova não chega lá até ser incluída aqui — é o
-- único motivo pelo qual esta migration existe.
--
-- Não há alteração destrutiva: a função é recriada com a mesma assinatura,
-- mesma volatilidade, mesmo `search_path` e mesmo timeout, acrescentando uma
-- chave à lista. Nenhuma coluna, tabela, política ou permissão muda.

create or replace function public.obter_branding_acesso_publico()
returns jsonb
language sql
stable
security definer
set search_path = ''
set statement_timeout = '3s'
as $$
  select coalesce(
    jsonb_object_agg(c.chave, c.valor)
      filter (where c.valor is not null and btrim(c.valor) <> ''),
    '{}'::jsonb
  )
  from public.configuracoes as c
  where c.chave in (
    'auth_access_background_url',
    'auth_access_logo_url',
    'auth_access_panel_color',
    'auth_access_greeting',
    'auth_access_instruction',
    'auth_google_button_text',
    'auth_access_texto_modo'
  );
$$;

comment on function public.obter_branding_acesso_publico() is
  'Identidade da tela de acesso para visitantes não autenticados. Lista de chaves fixa, sem dado de pessoa ou sessão.';
