/*
  SEM conferencia_ler_classificacao (03/11/2026)

  APLICAR SÓ DEPOIS DE MESCLAR o robô das conferências que lê
  conferencia_ler_listas_e_quadros (20261103181500, scripts/conferencias/). O robô de antes ainda
  chama esta RPC: com ela apagada, o módulo Classificação dele falharia (os avisos dele ficam
  como estão, sem resolver nada) até o robô novo entrar.

  Por quê: conferencia_ler_classificacao levava de 12 a 19 s (pg_stat_statements desde 14/10:
  média 12,4 s, máximo 15,5 s; 18,8 s no ensaio de 03/11/2026), quase tudo em
  private."FC_QUADRO_DA_VAGA" para cada uma das 658 vagas distintas das análises e numa releitura
  inteira de TB_ANALISE_CURRICULAR. O robô novo tira a última atualização por edital e as vagas
  das páginas de conferencia_ler_analises que já lê e procura a linha do quadro em Python
  (python/monitora/classificacao/quadro_da_vaga.py): 64 ms. A paridade foi conferida no ensaio de
  20261103181500 (seção PARIDADE): 658 de 658 vagas com a mesma linha do quadro, as 620 vagas sem
  quadro e as 21 últimas atualizações iguais.

  FC_QUADRO_DA_VAGA e FC_TOKENS_VAGA ficam (a classificação usa). Nada no banco chama a RPC
  apagada (conferido em 03/11/2026). Rollback recria a função como estava.

  Ensaio:   supabase/ensaios/20261103182000_sem_conferencia_ler_classificacao.sql
  Rollback: supabase/rollback/20261103182000_sem_conferencia_ler_classificacao.sql
*/
begin;

set local lock_timeout = '10s';

do $guarda$
begin
  if to_regprocedure('public.conferencia_ler_listas_e_quadros()') is null then
    raise exception 'Aplique antes 20261103181500 (e mescle o robô das conferências que a lê).';
  end if;
  if exists (select 1 from pg_catalog.pg_proc p
               join pg_catalog.pg_namespace n on n.oid = p.pronamespace and n.nspname in ('public', 'private')
              where p.prosrc like '%conferencia_ler_classificacao%'
                and p.proname <> 'conferencia_ler_classificacao') then
    raise exception 'Alguma função do banco ainda chama conferencia_ler_classificacao.';
  end if;
end;
$guarda$;

drop function if exists public.conferencia_ler_classificacao();

commit;
