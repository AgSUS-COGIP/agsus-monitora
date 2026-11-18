/*
  ABA "MAPA" NA SAÚDE INDÍGENA (18/11/2026)

  POR QUE
  O mapa dos DSEIs sai da Visão geral para uma página própria, com endereço
  (`/saude-indigena/mapa`, e `/saude-indigena/mapa/<dsei>` com um DSEI aberto). A Visão geral
  fica com um cartão pequeno e "Abrir no mapa". A página nova entra no menu pelo catálogo de
  abas, como as outras.

  O QUE MUDA
    1. As abas com ordem 2 ou mais descem uma posição (no catálogo e onde uma área troca a
       ordem): o Mapa entra logo depois da Visão geral, no bloco Acompanhar.
    2. A aba "mapa" (Mapa, ícone globe, ordem 2, view mapa) no catálogo (TB_ABA), ligada
       só na Saúde Indígena (RL_ABA_AREA). O recurso é o da Visão geral (`dashboard`): quem
       abre a Visão geral abre o Mapa. Sem selo BETA.
    O espelho no código é `ABAS_DO_MENU` (src/lib/navegacao/menu-lateral.ts).

  DESFAZER: supabase/rollback/20261118160000_aba_mapa_na_saude_indigena.sql.
  ENSAIO:   supabase/ensaios/20261118160000_aba_mapa_na_saude_indigena.sql.
*/
begin;

set local lock_timeout = '5s';

do $$
begin
  if exists (select 1 from public."TB_ABA" where "CO_ABA" = 'mapa') then
    raise exception 'A aba mapa já existe.';
  end if;
  if not exists (select 1 from public."TB_AREA" where "CO_AREA" = 'saude-indigena') then
    raise exception 'A área saude-indigena não existe.';
  end if;
  if not exists (select 1 from public."TB_ABA" where "CO_ABA" = 'visao-geral' and "NU_ORDEM" = 1) then
    raise exception 'A Visão geral não está na ordem 1.';
  end if;
end;
$$;

-- 1. As abas depois da Visão geral descem uma posição --------------------------------------------
update public."TB_ABA"
   set "NU_ORDEM" = "NU_ORDEM" + 1,
       "DT_ATUALIZACAO" = now()
 where "NU_ORDEM" >= 2;

update public."RL_ABA_AREA"
   set "NU_ORDEM" = "NU_ORDEM" + 1,
       "DT_ATUALIZACAO" = now()
 where "NU_ORDEM" >= 2;

-- 2. A aba "Mapa", só na Saúde Indígena ----------------------------------------------------------
insert into public."TB_ABA" ("CO_ABA", "NO_ABA", "DS_ICONE", "NU_ORDEM", "CO_VIEW", "CO_RECURSO", "TP_ABA", "ST_ATIVO", "ST_BETA")
values ('mapa', 'Mapa', 'globe', 2, 'mapa', 'dashboard', 'nativa', 'S', 'N');

insert into public."RL_ABA_AREA" ("CO_ABA", "CO_AREA", "ST_ATIVO")
values ('mapa', 'saude-indigena', 'S');

commit;
