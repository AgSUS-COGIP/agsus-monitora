-- Desliga a aba Avaliação documental no catálogo (a view some do menu; regras e equipes ficam).
begin;
update public."TB_ABA" set "ST_ATIVO" = 'N', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'avaliacao-documental';
commit;
