-- ROLLBACK de supabase/migrations/20261024110000_calculo_pelo_python_exige_as_duas_chaves.sql
-- Volta ao corpo de 20261023200000: FC_CALCULO_PELO_PYTHON só olha a chave classificacao_calculo
-- (com ela ligada e "Classificação em Python" desligada, o "Gerar" volta a ficar sem saída).
begin;

set local lock_timeout = '5s';

create or replace function private."FC_CALCULO_PELO_PYTHON"()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (select 1 from public."TB_CHAVE_AUTOMACAO" c
                  where c."CO_CHAVE" = 'classificacao_calculo' and c."ST_LIGADA" = 'S');
$function$;
comment on function private."FC_CALCULO_PELO_PYTHON"() is
  'A chave "Gerar listas pelo Python" (classificacao_calculo, 20261023200000) está ligada? Sem a linha na tabela, desligada (o padrão é o cálculo da tela). Só o dono (as RPCs da Classificação).';
revoke all on function private."FC_CALCULO_PELO_PYTHON"() from public, anon, authenticated, service_role;

commit;
