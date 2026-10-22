begin;

-- O botão "Atualizar" dos dashboards de Seleção e Entrevistas saiu; a Seleção passou a
-- sincronizar de hora em hora, o dia todo, pelo GitHub Actions. Sem uso, a RPC sai.
drop function if exists public.pode_atualizar_dashboard(text);

commit;
