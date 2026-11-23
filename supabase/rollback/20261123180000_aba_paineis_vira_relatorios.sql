/*
  ROLLBACK de 20261123180000_aba_paineis_vira_relatorios.

  Volta o nome da aba para "Painéis". Nada mais foi mudado pela migration. O front com o
  nome "Relatórios" continua funcionando com o nome antigo (o menu mostra o do banco).

  Depois, tire o registro:
    delete from public.migracoes_aplicadas
     where caminho = 'migrations/20261123180000_aba_paineis_vira_relatorios.sql';
*/
begin;

set local lock_timeout = '5s';

update public."TB_ABA"
   set "NO_ABA" = 'Painéis',
       "DT_ATUALIZACAO" = now()
 where "CO_ABA" = 'paineis-de-dados'
   and "NO_ABA" is distinct from 'Painéis';

commit;
