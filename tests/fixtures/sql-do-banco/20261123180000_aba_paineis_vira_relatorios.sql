/*
  ABA "PAINÉIS" VIRA "RELATÓRIOS" (23/11/2026)

  POR QUE
  A página do bloco Dados passa a ser o catálogo dos relatórios de acompanhamento e gestão,
  que cruzam editais (Resumo dos editais, Editais por cargo, Aprovados e, depois, os que hoje
  estão espalhados pela Visão geral, Lista de aprovados e Análises). O nome "Painéis"
  confundia com os painéis externos (`panel:<código>`).

  O QUE MUDA
    Só o nome da aba no catálogo do menu (TB_ABA."NO_ABA"): "Painéis" → "Relatórios".
    Ficam iguais o código e a view (`paineis-de-dados`), o recurso (`paineis_dados`), o
    ícone, a ordem e as áreas (RL_ABA_AREA): permissões, links e tours seguem valendo. O
    espelho no código é `ABAS_DO_MENU` (src/lib/navegacao/menu-lateral.ts); a versão do
    catálogo muda com o nome, e o menu aberto se atualiza sozinho.
    Antes de aplicar, o front já funciona: o menu mostra o nome que vier do banco.

  IDEMPOTENTE: rodar de novo não muda nada.
  DESFAZER: supabase/rollback/20261123180000_aba_paineis_vira_relatorios.sql.
  ENSAIO:   supabase/ensaios/20261123180000_aba_paineis_vira_relatorios.sql.
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'paineis-de-dados') then
    raise exception 'A aba paineis-de-dados não existe; confira o banco antes de aplicar.';
  end if;
end;
$$;

-- O nome no menu. Código, view, recurso, ícone e ordem não mudam.
update public."TB_ABA"
   set "NO_ABA" = 'Relatórios',
       "DT_ATUALIZACAO" = now()
 where "CO_ABA" = 'paineis-de-dados'
   and "NO_ABA" is distinct from 'Relatórios';

commit;
