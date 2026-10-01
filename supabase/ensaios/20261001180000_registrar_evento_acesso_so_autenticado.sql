/*
  ENSAIO de 20261001180000_registrar_evento_acesso_so_autenticado.sql — begin … rollback.

  Como rodar: cole o arquivo inteiro no SQL Editor do Supabase (papel postgres)
  e execute. Aplica o corpo da migration numa transação, confere os privilégios
  e termina em ROLLBACK: nada fica gravado.

  Resultado esperado: "ok anon sem execute", "ok authenticated com execute",
  "ok service_role com execute" e "ENSAIO OK". Qualquer "FALHOU …" desfaz tudo.
*/
begin;

-- ═══ CORPO DA MIGRATION (início) ═══
revoke all on function public.registrar_evento_acesso(text, text, text, jsonb, text, text, text) from public, anon;
grant execute on function public.registrar_evento_acesso(text, text, text, jsonb, text, text, text) to authenticated, service_role;
-- ═══ CORPO DA MIGRATION (fim) ═══

do $$
declare
  f constant text := 'public.registrar_evento_acesso(text, text, text, jsonb, text, text, text)';
begin
  if has_function_privilege('anon', f, 'execute') then
    raise exception 'FALHOU: anon ainda executa %', f;
  end if;
  raise notice 'ok anon sem execute';
  if not has_function_privilege('authenticated', f, 'execute') then
    raise exception 'FALHOU: authenticated perdeu execute em %', f;
  end if;
  raise notice 'ok authenticated com execute';
  if not has_function_privilege('service_role', f, 'execute') then
    raise exception 'FALHOU: service_role perdeu execute em %', f;
  end if;
  raise notice 'ok service_role com execute';
  raise notice 'ENSAIO OK';
end;
$$;

rollback;
