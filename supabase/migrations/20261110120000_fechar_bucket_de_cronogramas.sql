-- Fechar o bucket cronogramas-editais a quem não é administrador global.
--
-- Motivo: auditoria de 09/11/2026 (SEG-01). As políticas de envio, troca e
-- exclusão do bucket só exigem edição em Núcleo ou Calendário, sem recorte por
-- edital, área ou coordenação: quem edita numa área grava ou apaga arquivo de
-- outra. O bucket não tem mais uso no app: só o Núcleo antigo
-- (src/modules/nucleo-cronograma.js) o usou, e a referência saiu no #52
-- (22/07/2026). O cronograma hoje vem do PDF lido em api/anexos-do-edital.py,
-- sem Storage.
--
-- Efeito: camada restritiva, como a das listas (20261109122536). Para
-- authenticated, qualquer operação no bucket passa a exigir administrador
-- global; os outros buckets não mudam. Nenhum arquivo é apagado; o
-- administrador global e a service_role continuam podendo ler e recuperar.
--
-- Dependentes: nenhum código do app. Rollback:
-- supabase/rollback/20261110120000_fechar_bucket_de_cronogramas.sql.
-- Ensaio: supabase/ensaios/20261110120000_fechar_bucket_de_cronogramas.sql.

begin;
set local statement_timeout = '20s';
set local lock_timeout = '3s';

drop policy if exists "PL_STORAGE_CRONOGRAMAS_SO_ADMIN" on storage.objects;
create policy "PL_STORAGE_CRONOGRAMAS_SO_ADMIN"
on storage.objects as restrictive for all to authenticated
using (
  bucket_id <> 'cronogramas-editais'
  or (select private.is_master())
)
with check (
  bucket_id <> 'cronogramas-editais'
  or (select private.is_master())
);
comment on policy "PL_STORAGE_CRONOGRAMAS_SO_ADMIN" on storage.objects is
  'Bucket sem uso no app: leitura, envio, troca e exclusao so pelo administrador global. Preserva os arquivos e os outros buckets.';

commit;
