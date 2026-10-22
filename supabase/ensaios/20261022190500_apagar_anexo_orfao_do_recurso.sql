/*
  ENSAIO de 20261022190500_apagar_anexo_orfao_do_recurso.sql — begin … rollback.

  Cole no SQL Editor do Supabase (papel postgres). Aplica a migration dentro
  da transação e confere:
    1. a função e a política existem; só authenticated (e o dono) executa a
       função — anon e public não;
    2. a política é de delete, para authenticated, no bucket recursos-anexos,
       e exige dono, a janela de 10 minutos e o caminho não registrado;
    3. FC_ANEXO_RECURSO_ORFAO: caminho inventado é órfão; o caminho de um
       anexo registrado (se houver algum) não é.
  Termina em rollback: nada fica gravado.
*/
begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function private."FC_ANEXO_RECURSO_ORFAO"(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select not exists (
    select 1
    from public."TB_ANEXO_RECURSO" a
    where a."DS_CAMINHO" = p_caminho
  );
$function$;
comment on function private."FC_ANEXO_RECURSO_ORFAO"(text) is
  'Política de delete do bucket recursos-anexos: o caminho ainda não foi registrado em TB_ANEXO_RECURSO (SECURITY DEFINER: a RLS da tabela não esconde a linha de quem pede).';

-- As políticas do Storage rodam como authenticated.
revoke all on function private."FC_ANEXO_RECURSO_ORFAO"(text) from public, anon;
grant execute on function private."FC_ANEXO_RECURSO_ORFAO"(text) to authenticated;

drop policy if exists "PL_ANEXO_RECURSO_STORAGE_APAGAR_ORFAO" on storage.objects;
create policy "PL_ANEXO_RECURSO_STORAGE_APAGAR_ORFAO" on storage.objects
for delete to authenticated
using (
  bucket_id = 'recursos-anexos'
  and owner_id = (select auth.uid())::text
  and created_at > now() - interval '10 minutes'
  and private."FC_ANEXO_RECURSO_ORFAO"(name)
);
comment on policy "PL_ANEXO_RECURSO_STORAGE_APAGAR_ORFAO" on storage.objects is
  'Anexos de recurso: quem enviou apaga o próprio arquivo nos primeiros 10 minutos, enquanto ele não foi registrado (o registro falhou ou a tela mudou no meio). Registrado, não se apaga pela API.';

do $ensaio$
declare
  v_politica record;
  v_caminho text;
begin
  -- 1. Função e privilégios.
  if to_regprocedure('private."FC_ANEXO_RECURSO_ORFAO"(text)') is null then
    raise exception 'FC_ANEXO_RECURSO_ORFAO não foi criada';
  end if;
  if not has_function_privilege('authenticated', 'private."FC_ANEXO_RECURSO_ORFAO"(text)', 'execute') then
    raise exception 'authenticated precisa executar FC_ANEXO_RECURSO_ORFAO (a política roda como ele)';
  end if;
  if has_function_privilege('anon', 'private."FC_ANEXO_RECURSO_ORFAO"(text)', 'execute') then
    raise exception 'anon não pode executar FC_ANEXO_RECURSO_ORFAO';
  end if;

  -- 2. A política.
  select * into v_politica
    from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'PL_ANEXO_RECURSO_STORAGE_APAGAR_ORFAO';
  if not found then
    raise exception 'política PL_ANEXO_RECURSO_STORAGE_APAGAR_ORFAO não existe';
  end if;
  if v_politica.cmd <> 'DELETE' or v_politica.roles <> array['authenticated']::name[] then
    raise exception 'a política deve ser de DELETE para authenticated (veio % para %)', v_politica.cmd, v_politica.roles;
  end if;
  if v_politica.qual not like '%recursos-anexos%'
     or v_politica.qual not like '%owner_id%'
     or v_politica.qual not like '%00:10:00%'
     or v_politica.qual not like '%FC_ANEXO_RECURSO_ORFAO%' then
    raise exception 'a política perdeu uma das travas: %', v_politica.qual;
  end if;
  if exists (
    select 1 from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and cmd in ('DELETE', 'ALL', 'UPDATE')
       and qual like '%recursos-anexos%'
       and policyname <> 'PL_ANEXO_RECURSO_STORAGE_APAGAR_ORFAO'
  ) then
    raise exception 'há outra política de delete/update no bucket recursos-anexos';
  end if;

  -- 3. Órfão × registrado.
  if not private."FC_ANEXO_RECURSO_ORFAO"('saude-indigena/00000000-0000-0000-0000-000000000000/inventado.pdf') then
    raise exception 'caminho inventado deveria ser órfão';
  end if;
  select a."DS_CAMINHO" into v_caminho from public."TB_ANEXO_RECURSO" a limit 1;
  if v_caminho is not null and private."FC_ANEXO_RECURSO_ORFAO"(v_caminho) then
    raise exception 'anexo registrado (%) não pode ser órfão', v_caminho;
  end if;

  raise notice 'ENSAIO OK: política de delete do anexo órfão (registrado de exemplo: %)', coalesce(v_caminho, 'nenhum');
end
$ensaio$;

rollback;
