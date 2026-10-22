/*
  Apagar o anexo de recurso que ficou órfão no Storage.

  O front envia o arquivo ao bucket recursos-anexos e só depois o registra
  (registrar_anexo_recurso, que confere no Storage o objeto enviado). Se o
  registro falha (rede, recusa do banco) ou a tela troca de área/sessão no
  meio, o arquivo ficava no bucket sem linha em TB_ANEXO_RECURSO: o bucket não
  tem política de delete, e nada o apagava.

  Esta migration deixa quem enviou apagar o PRÓPRIO arquivo, só nos primeiros
  10 minutos depois do envio (a mesma janela da leitura do próprio envio em
  recursos_anexos_storage_select) e só enquanto ele não foi registrado.
  Arquivo registrado continua sem delete pela API: arquivar não apaga.

  Depende de: 20260929230000_recursos_modelos_anexos_respostas (bucket,
  TB_ANEXO_RECURSO e as políticas de select/insert).
  Front: src/modulos/recursos/estado.ts (enviarERegistrar).
  Rollback: supabase/rollback/20261022180000_apagar_anexo_orfao_do_recurso.sql.
  Ensaio: supabase/ensaios/20261022180000_apagar_anexo_orfao_do_recurso.sql.
*/
begin;

set local lock_timeout = '5s';

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

commit;
