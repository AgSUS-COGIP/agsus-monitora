-- Ensaio de contrato sem modificar registros reais.
begin;
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'TB_CANDIDATO_APROVADO'
      and column_name = 'observacao_status'
  ) then
    raise exception 'Campo observacao_status ausente';
  end if;
  if to_regprocedure('public.ler_observacao_status_aprovado(uuid)') is null
     or to_regprocedure('public.alterar_status_aprovado_com_observacao(uuid,text,text,text,date,text)') is null then
    raise exception 'RPC de observação de aprovados ausente';
  end if;
  if has_function_privilege('anon', 'public.ler_observacao_status_aprovado(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.alterar_status_aprovado_com_observacao(uuid,text,text,text,date,text)', 'EXECUTE') then
    raise exception 'RPC acessível por anon';
  end if;
end;
$$;
rollback;
