begin;

-- ---------------------------------------------------------------------------
-- Identidade visual da tela de acesso, visivel antes de autenticar.
--
-- POR QUE
-- A identidade da tela de login e informacao publica por natureza: o visitante
-- precisa ve-la justamente antes de se autenticar. Sem uma via propria, o
-- primeiro acesso numa maquina nova, aba anonima ou apos limpar o navegador
-- abre sem identidade nenhuma.
--
-- `anon` ja tem `select` em `public.configuracoes`, limitado pela policy
-- `config_select_anon_safe` a dez chaves inocuas (versao, rodape, dados da
-- equipe COGIP e tres chaves do botao do Google). Nenhuma delas e a arte, o
-- logotipo, a cor do painel, a saudacao ou a instrucao. Esta migration nao
-- alarga essa policy: leva as cinco chaves que faltam por uma funcao propria.
--
-- O QUE ESTA FUNCAO FAZ, E SO ISSO
-- Devolve, de `public.configuracoes`, exclusivamente as seis chaves da lista
-- abaixo. A lista esta no `where`, nao num `select *` filtrado depois: chave
-- fora dela nao chega a ser lida. Nenhum perfil, permissao, usuario ou
-- configuracao administrativa passa por aqui.
--
-- COMO E SEGURA
--   - `security definer` para ler as cinco chaves que a policy de `anon` nao
--     alcanca, sem alterar essa policy nem os grants da tabela;
--   - `search_path = ''` fixo, com todos os nomes qualificados, para que a
--     funcao nao possa ser desviada por um search_path hostil;
--   - `stable`, sem escrita de especie alguma;
--   - `statement_timeout` curto: e chamada no arranque de toda visita;
--   - `revoke all from public` antes dos grants explicitos.
--
-- O QUE ESTA MIGRATION NAO FAZ
-- Nao altera grant de tabela, nao altera RLS, nao amplia `config_select_anon_safe`
-- nem qualquer outra policy, e nao toca em grants globais, indices, tabelas ou
-- outras funcoes. O acesso que `anon` ja tinha continua exatamente o mesmo.
--
-- DEPENDENTES
--   - tabela `public.configuracoes`, colunas `chave` e `valor`
--   - frontend: `src/lib/access-branding-publico.js`
--   - contrato: `obter_branding_acesso_publico` em `src/lib/rpc-contrato.js`
--
-- ROLLBACK
--   begin;
--     drop function if exists public.obter_branding_acesso_publico();
--   commit;
--   O frontend volta a depender apenas do cache local: quem ja visitou continua
--   a ver a identidade correta; o primeiro acesso volta a abrir neutro.
-- ---------------------------------------------------------------------------

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
    'auth_google_button_text'
  );
$$;

revoke all on function public.obter_branding_acesso_publico() from public;
grant execute on function public.obter_branding_acesso_publico() to anon;
grant execute on function public.obter_branding_acesso_publico() to authenticated;

comment on function public.obter_branding_acesso_publico() is
  'Identidade visual da tela de acesso, apenas as seis chaves publicas de branding. Leitura. Nao concede acesso a public.configuracoes.';

commit;
