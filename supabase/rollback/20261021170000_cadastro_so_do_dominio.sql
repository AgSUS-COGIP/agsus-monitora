/*
  Rollback de 20261021170000_cadastro_so_do_dominio.sql.

  ANTES de rodar, DESLIGUE o hook em Auth → Hooks → Before User Created: com o
  hook ligado apontando para uma função que não existe, o Auth falha ao criar
  qualquer conta nova (inclusive institucional). Só desligar o hook já devolve
  o cadastro ao que era (domínio exigido só no navegador); este rollback tira
  também a função, a leitura de TB_CONFIGURACAO pelo supabase_auth_admin e
  volta a policy de TB_PLANILHA_ANALISE para using (true).

  O USAGE de supabase_auth_admin no schema public fica: ele já existia antes
  da migration.
*/
begin;

drop function if exists public."FC_HOOK_ANTES_CRIAR_USUARIO"(jsonb);

drop policy if exists "PL_CONFIGURACAO_LEITURA_HOOK_AUTH" on public."TB_CONFIGURACAO";
revoke select on table public."TB_CONFIGURACAO" from supabase_auth_admin;

alter policy "PL_PLANILHA_ANALISE_LEITURA" on public."TB_PLANILHA_ANALISE"
  using (true);
comment on policy "PL_PLANILHA_ANALISE_LEITURA" on public."TB_PLANILHA_ANALISE" is null;

commit;
