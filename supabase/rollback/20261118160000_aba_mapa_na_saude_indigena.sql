/*
  DESFAZ 20261118160000_aba_mapa_na_saude_indigena.sql

  Tira a aba "mapa" do catálogo (e da Saúde Indígena) e devolve as outras abas à ordem de
  antes (sobem uma posição). O mapa volta a ser só o da Visão geral quando o front de antes for
  publicado de novo: desfaça o banco junto com o front.
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'mapa' and "NU_ORDEM" = 2) then
    raise exception 'A aba mapa não está no catálogo na ordem 2: nada a desfazer.';
  end if;
end;
$$;

delete from public."RL_ABA_AREA" where "CO_ABA" = 'mapa';
delete from public."TB_ABA" where "CO_ABA" = 'mapa';

update public."TB_ABA"
   set "NU_ORDEM" = "NU_ORDEM" - 1,
       "DT_ATUALIZACAO" = now()
 where "NU_ORDEM" >= 3;

update public."RL_ABA_AREA"
   set "NU_ORDEM" = "NU_ORDEM" - 1,
       "DT_ATUALIZACAO" = now()
 where "NU_ORDEM" >= 3;

commit;
