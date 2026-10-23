/*
  CÁLCULO DA CLASSIFICAÇÃO PELO PYTHON EXIGE AS DUAS CHAVES

  Desde 20261023200000, private."FC_CALCULO_PELO_PYTHON"() só olha a chave
  "Gerar listas pelo Python" (classificacao_calculo). Mas o pedido do cálculo
  sai pelo workflow classificacao.yml, que FC_DISPARAR_ROBO só pede com a chave
  "Classificação em Python" (classificacao, FC_CHAVE_DO_WORKFLOW) ligada. Com
  classificacao_calculo ligada e classificacao desligada, o "Gerar" gravava um
  pedido que nunca chegava ao GitHub (SEM_DISPARO) e o caminho da tela
  (registrar_lista_classificacao) recusava com 55000: ninguém gerava lista.
  Agora o cálculo pelo Python só vale com AS DUAS chaves ligadas ('S', com a
  linha na tabela); com qualquer uma desligada (ou sem a linha), o "Gerar" é o
  da tela, como antes (pedir_calculo_classificacao responde {ligada: false} sem
  gravar nada e registrar_lista_classificacao registra). Nenhuma chave muda de
  estado aqui; o tempo limite de 5 min do cálculo fica como está.
  Usam a função (sem mudança de corpo): pedir_calculo_classificacao e
  registrar_lista_classificacao.
  Rollback: supabase/rollback/20261024110000_calculo_pelo_python_exige_as_duas_chaves.sql
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if to_regprocedure('private."FC_CALCULO_PELO_PYTHON"()') is null
     or not exists (select 1 from public."TB_CHAVE_AUTOMACAO" c where c."CO_CHAVE" = 'classificacao_calculo') then
    raise exception 'Aplique antes 20261023200000_classificacao_em_python_etapa_2b.sql.';
  end if;
end;
$$;

create or replace function private."FC_CALCULO_PELO_PYTHON"()
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select count(*) = 2 from public."TB_CHAVE_AUTOMACAO" c
   where c."CO_CHAVE" in ('classificacao', 'classificacao_calculo') and c."ST_LIGADA" = 'S';
$function$;
comment on function private."FC_CALCULO_PELO_PYTHON"() is
  'As chaves "Classificação em Python" (classificacao) e "Gerar listas pelo Python" (classificacao_calculo) estão as duas ligadas (20261024110000)? Qualquer uma desligada ou sem a linha na tabela: não (o padrão é o cálculo da tela). Só o dono (as RPCs da Classificação).';
revoke all on function private."FC_CALCULO_PELO_PYTHON"() from public, anon, authenticated, service_role;

commit;
