/*
  ENSAIO da migration 20261103182000_sem_conferencia_ler_classificacao.sql
  — begin … rollback. NÃO É MIGRATION; nada fica gravado.

  Montagem: 20261103181500 e esta, depois o DEPOIS daqui:
    { echo 'begin;'; echo "set local statement_timeout = '20s';";
      sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/migrations/20261103181500_conferencias_e_pendencias_leves.sql;
      sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/migrations/20261103182000_sem_conferencia_ler_classificacao.sql;
      sed -n '/^-- == DEPOIS ==/,/^-- == VOLTA ==/p' supabase/ensaios/20261103182000_sem_conferencia_ler_classificacao.sql;
      sed -e '/^begin;$/d' -e '/^commit;$/d' supabase/rollback/20261103182000_sem_conferencia_ler_classificacao.sql;
      sed -n '/^-- == CONFERE A VOLTA ==/,$p' supabase/ensaios/20261103182000_sem_conferencia_ler_classificacao.sql;
    } > /tmp/ensaio.sql
  Confere que a RPC saiu, que a nova e as funções do quadro ficaram, e que o rollback a recria
  igual (mesmo md5 do código) com a mesma permissão.
*/
-- == DEPOIS ==
do $$
begin
  if to_regprocedure('public.conferencia_ler_classificacao()') is not null
     or to_regprocedure('public.conferencia_ler_listas_e_quadros()') is null
     or to_regprocedure('private."FC_QUADRO_DA_VAGA"(uuid, text)') is null
     or to_regprocedure('private."FC_TOKENS_VAGA"(text)') is null then
    raise exception 'Ensaio reprovado: funções erradas depois da migration.';
  end if;
end;
$$;
-- == VOLTA ==
-- == CONFERE A VOLTA ==
do $$
begin
  if (select md5(replace(p.prosrc, E'\r', '')) from pg_catalog.pg_proc p
       where p.oid = to_regprocedure('public.conferencia_ler_classificacao()')) is distinct from '3e3aba5c69264e33840c28af2db28d54'
     or not has_function_privilege('service_role', 'public.conferencia_ler_classificacao()', 'execute')
     or has_function_privilege('authenticated', 'public.conferencia_ler_classificacao()', 'execute') then
    raise exception 'Ensaio reprovado: o rollback não recria a RPC igual.';
  end if;
end;
$$;
select 'ensaio aprovado' as resultado;
rollback;
