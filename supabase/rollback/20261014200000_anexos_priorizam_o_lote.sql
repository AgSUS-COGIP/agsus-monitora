-- Desfaz 20261014200000: sem a lista de prioridade, o robô volta a ler os anexos de todos
-- os inscritos na ordem da lista (anexos_empregare.prioridades_da_vaga trata o 404).
begin;
drop function if exists public.listar_prioridade_anexos_empregare(text);
commit;
