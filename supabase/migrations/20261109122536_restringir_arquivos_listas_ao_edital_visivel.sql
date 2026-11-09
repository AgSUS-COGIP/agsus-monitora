set local statement_timeout = '20s';
set local lock_timeout = '3s';

-- Camada restritiva: nao substitui as permissoes de cada operacao.
-- O primeiro segmento do caminho e o UUID do edital, como no upload atual.
-- A consulta ao monitoramento usa a RLS do proprio usuario (area e coordenacao).
-- Orfaos permanecem recuperaveis pelo administrador global; nada e removido.
do $guardas$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'TB_MONITORAMENTO_INDIGENA' and policyname = 'PL_MONITORAMENTO_INDIGENA_AREA' and permissive = 'RESTRICTIVE') then
    raise exception 'Politica restritiva do monitoramento ausente';
  end if;
  if exists (
    select 1 from storage.objects o
    join public."TB_LISTA_APROVADO" l on l.arquivo_path = o.name
    where o.bucket_id = 'listas-aprovados'
      and l.edital_id <> pg_catalog.split_part(o.name, '/', 1)
  ) then
    raise exception 'Vinculo da lista diverge do edital no caminho: revisar antes de aplicar';
  end if;
end $guardas$;

create policy "PL_STORAGE_LISTAS_ESCOPO_EDITAL"
on storage.objects as restrictive for all to authenticated
using (
  bucket_id <> 'listas-aprovados'
  or (select private.is_master())
  or exists (
    select 1 from public."TB_MONITORAMENTO_INDIGENA" m
    where m.id::text = pg_catalog.split_part(storage.objects.name, '/', 1)
  )
)
with check (
  bucket_id <> 'listas-aprovados'
  or (select private.is_master())
  or exists (
    select 1 from public."TB_MONITORAMENTO_INDIGENA" m
    where m.id::text = pg_catalog.split_part(storage.objects.name, '/', 1)
  )
);
comment on policy "PL_STORAGE_LISTAS_ESCOPO_EDITAL" on storage.objects is
  'Restringe leitura, envio e exclusao das listas ao edital visivel no primeiro segmento do caminho. Complementa as permissoes de operacao; preserva outros buckets e a recuperacao de orfaos pelo administrador global.';
