-- ROLLBACK de supabase/migrations/20261007180000_painel_dos_robos.sql
-- Só leitura: apaga as duas funções. Nada gravado se perde; o "Rodar com opções"
-- do Status das atualizações fica sem a lista de editais, as sugestões de vagas e o
-- histórico (o disparo pelo /api/rodar-carga continua).
begin;

drop function if exists public.listar_vagas_dos_robos(uuid[], text[]);
drop function if exists public.get_painel_dos_robos();

commit;
