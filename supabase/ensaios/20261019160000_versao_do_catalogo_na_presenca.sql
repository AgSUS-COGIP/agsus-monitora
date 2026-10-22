/*
  Ensaio de 20261019160000_versao_do_catalogo_na_presenca.sql (sempre desfeito: begin … rollback).

  Uso (Git Bash), no banco novo:
    source qn.sh
    qn "begin;
    $(sed -E '/^\s*(begin|commit|rollback)\s*;\s*$/Id' supabase/migrations/20261019160000_versao_do_catalogo_na_presenca.sql)
    $(cat supabase/ensaios/20261019160000_versao_do_catalogo_na_presenca.sql)
    rollback;"

  Como o primeiro perfil ativo (authenticated), bate a presença duas vezes,
  desliga uma aba numa área (só dentro da transação) e bate de novo. Nada é
  gravado.

  Espera-se:
    - status OK nas três batidas, com versao_do_catalogo (32 hex);
    - a mesma versão nas duas primeiras; outra depois do update;
    - o tempo da função de versão em poucos ms (tabelas de dezenas de linhas);
    - authenticated sem execute em private."FC_VERSAO_DO_CATALOGO_DE_ABAS".
*/
create temporary table ensaio_saida (passo text, resultado text) on commit drop;
grant all on ensaio_saida to authenticated;

select set_config('request.jwt.claims', json_build_object(
  'sub', p.user_id, 'email', p.email, 'role', 'authenticated')::text, true)
  from public."TB_PERFIL_USUARIO" p
 where p.ativo is true and p.user_id is not null
 order by p.email limit 1;

set local role authenticated;
insert into ensaio_saida select '1ª batida', public.registrar_presenca_monitora('Ensaio')::text;
insert into ensaio_saida select '2ª batida', public.registrar_presenca_monitora('Ensaio')::text;
insert into ensaio_saida select 'authenticated executa a versão?',
  has_function_privilege('authenticated', 'private."FC_VERSAO_DO_CATALOGO_DE_ABAS"()', 'execute')::text;
reset role;

update public."RL_ABA_AREA" set "ST_ATIVO" = case "ST_ATIVO" when 'S' then 'N' else 'S' end
 where ("CO_ABA", "CO_AREA") = (select "CO_ABA", "CO_AREA" from public."RL_ABA_AREA" order by 1, 2 limit 1);

set local role authenticated;
insert into ensaio_saida select '3ª batida (aba trocada)', public.registrar_presenca_monitora('Ensaio')::text;
reset role;

do $$
declare t timestamptz := clock_timestamp(); i int;
begin
  for i in 1..100 loop perform private."FC_VERSAO_DO_CATALOGO_DE_ABAS"(); end loop;
  insert into ensaio_saida values ('100 versões', round(extract(epoch from clock_timestamp() - t) * 1000) || ' ms');
end $$;

select * from ensaio_saida;
