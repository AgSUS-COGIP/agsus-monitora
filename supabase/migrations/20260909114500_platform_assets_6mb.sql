begin;

-- O frontend aceita imagens de branding de até 6 MB desde o PR #157.
-- O bucket ainda estava limitado a 2 MB, fazendo uploads entre 2 e 6 MB
-- falharem no Storage com erro de tamanho apesar de passarem na validação local.
update storage.buckets
set file_size_limit = 6 * 1024 * 1024
where id = 'platform-assets'
  and file_size_limit is distinct from 6 * 1024 * 1024;

commit;
