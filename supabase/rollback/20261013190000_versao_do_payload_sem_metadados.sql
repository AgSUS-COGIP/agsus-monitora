/* Restaura o hash de 20261013160000, preservando assinatura e permissões. */
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
    from (select md5((p_payload - 'gerado_em')::text) as versao) x;
$$;

comment on function private."FC_SE_MUDOU"(jsonb, text) is
  'O payload com a chave versao (md5 sem gerado_em), ou só { inalterado, versao } quando p_versao é a atual (20261013160000).';

revoke all on function private."FC_SE_MUDOU"(jsonb, text) from public, anon;
grant execute on function private."FC_SE_MUDOU"(jsonb, text) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
