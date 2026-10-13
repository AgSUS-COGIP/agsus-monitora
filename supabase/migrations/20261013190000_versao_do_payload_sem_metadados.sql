/*
  Corrige a versão de 20261013160000 sem reescrever a migration já aplicada.
  Análises usa generated_at/cache.refreshed_at; Entrevistas também informa
  cache.gerado_em. Esses horários e cache.hit descrevem a geração/leitura,
  não uma mudança nos dados, e não devem provocar outro download completo.

  Só o hash ignora os metadados. O payload completo continua preservando
  todos os campos; atualizado_em e os demais dados continuam na versão.
  Uma versão anterior à correção recebe o payload completo uma vez.
*/
begin;

create or replace function private."FC_SE_MUDOU"(p_payload jsonb, p_versao text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
           when p_payload is null then null
           when p_versao is not null and p_versao = x.versao
             then jsonb_build_object('inalterado', true, 'versao', x.versao)
           else p_payload || jsonb_build_object('versao', x.versao)
         end
    from (
      select md5((p_payload - array['gerado_em', 'generated_at', 'cache']::text[])::text) as versao
    ) x;
$$;

comment on function private."FC_SE_MUDOU"(jsonb, text) is
  'Payload com versão dos dados (md5 sem gerado_em, generated_at e cache), ou só { inalterado, versao } quando a versão é atual (20261013190000). Metadados preservados na resposta completa.';

revoke all on function private."FC_SE_MUDOU"(jsonb, text) from public, anon;
grant execute on function private."FC_SE_MUDOU"(jsonb, text) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
