-- Desfaz 20261015000000: o front precisa voltar a chamar listar_avisos_conferencia
-- (src/modulos/conferencias/estado.ts) ANTES deste rollback; a função de sempre não mudou.
begin;
drop function if exists public.listar_avisos_conferencia_se_mudou(text, text, text);
notify pgrst, 'reload schema';
commit;
