-- Desfaz 20261001180000 (devolve o EXECUTE a PUBLIC e anon, como antes).
begin;
grant execute on function public.registrar_evento_acesso(text, text, text, jsonb, text, text, text) to public, anon;
notify pgrst, 'reload schema';
commit;
