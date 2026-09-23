/*
  Corrige o status "Concluído" no painel de Saúde Indígena.

  A função get_monitoramento_cronograma_estado voltou a conter o literal
  mojibake "ConcluÃ­do". Como ela recalcula e persiste o status dos editais,
  apenas corrigir os dados atuais não seria suficiente: o erro reapareceria
  na próxima atualização do cronograma.

  Esta migration:
  1. corrige somente o literal defeituoso na definição atual da função,
     preservando todo o restante da implementação;
  2. corrige os registros já gravados com o valor quebrado;
  3. corrige eventual override com o mesmo problema.
*/

do $$
declare
  v_oid oid;
  v_def text;
begin
  select p.oid
    into v_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_monitoramento_cronograma_estado'
    and p.prokind = 'f'
    and pg_get_function_identity_arguments(p.oid) =
      'p_monitoramento_id uuid, p_data date'
  limit 1;

  if v_oid is null then
    raise exception 'Função public.get_monitoramento_cronograma_estado(uuid, date) não encontrada';
  end if;

  v_def := pg_get_functiondef(v_oid);

  if position('ConcluÃ­do' in v_def) > 0 then
    v_def := replace(v_def, 'ConcluÃ­do', 'Concluído');
    execute v_def;
  end if;
end
$$;

update public."TB_MONITORAMENTO_INDIGENA"
set status = 'Concluído',
    updated_at = now()
where status = 'ConcluÃ­do';

update public."TB_MONITORAMENTO_INDIGENA"
set status_override = 'Concluído',
    updated_at = now()
where status_override = 'ConcluÃ­do';

do $$
declare
  v_def text;
  v_restantes integer;
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_monitoramento_cronograma_estado'
    and p.prokind = 'f'
    and pg_get_function_identity_arguments(p.oid) =
      'p_monitoramento_id uuid, p_data date'
  limit 1;

  if position('ConcluÃ­do' in coalesce(v_def, '')) > 0 then
    raise exception 'A função ainda contém o status com mojibake';
  end if;

  select count(*)::integer
    into v_restantes
  from public."TB_MONITORAMENTO_INDIGENA"
  where status = 'ConcluÃ­do'
     or status_override = 'ConcluÃ­do';

  if v_restantes > 0 then
    raise exception 'Ainda existem % registro(s) com status quebrado', v_restantes;
  end if;
end
$$;
