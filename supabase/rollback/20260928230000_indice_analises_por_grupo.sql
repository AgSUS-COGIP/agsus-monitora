-- Remove o índice do recorte por área do painel de análises.
begin;
drop index if exists public."IN_ANALISECURRICULAR_GRUPONORM";
commit;
