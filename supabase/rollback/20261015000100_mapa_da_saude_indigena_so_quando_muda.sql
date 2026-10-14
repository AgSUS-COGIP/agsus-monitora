-- Desfaz 20261015000100: o front precisa voltar ao select em TB_CONFIG_MAPA_SAUDE_INDIG
-- (src/app/carga.js) ANTES deste rollback; a tabela e as políticas não mudaram.
begin;
drop function if exists public.listar_mapa_da_saude_indigena(text);
notify pgrst, 'reload schema';
commit;
