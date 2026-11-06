-- Volta FC_TOKENS_VAGA sem separar a UF colada nem descartar o parêntese que não fecha
-- (versão de 20260930235950_quadro_ignora_parenteses.sql). Volte junto a cópia em Python
-- (python/monitora/classificacao/quadro_da_vaga.py) e os casos de tests/fixtures/quadro-da-vaga/.
begin;
create or replace function private."FC_TOKENS_VAGA"(p_texto text)
returns text[]
language sql
immutable
set search_path to ''
as $function$
  select coalesce(array_agg(distinct t), '{}')
    from regexp_split_to_table(
           regexp_replace(
             translate(lower(regexp_replace(regexp_replace(coalesce(p_texto, ''), '\s+em\s+excel.*$', '', 'i'),
                                            '\([^)]*\)', ' ', 'g')),
                       'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
             '[^a-z0-9]+', ' ', 'g'),
           ' ') t
   where t <> '' and t not in ('a', 'as', 'o', 'os', 'e', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'para');
$function$;
comment on function private."FC_TOKENS_VAGA"(text) is 'Palavras de um nome de cargo/lotação para comparar a vaga da análise com o quadro do edital: minúsculas, sem acento, sem "em Excel (questionário…", sem o que está entre parênteses e sem artigos/preposições.';
select private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"();
commit;
