/*
  Ligação vaga ↔ quadro de vagas: ignora o que está entre parênteses.

  Projetos publica o cargo como "ANALISTA DE GESTÃO: MÉDICO DO TRABALHO
  (Nível Superior)", e a vaga da análise vem "CARGO 1: ANALISTA DE GESTÃO:
  MÉDICO DO TRABALHO -". FC_QUADRO_DA_VAGA exige todas as palavras do cargo no
  nome da vaga, e "nível superior" derrubava a ligação dos cinco cargos do
  93/2026. O complemento entre parênteses (nível, carga horária escrita por
  extenso) passa a não contar; os editais da SI não usam parênteses no cargo.

  Rollback: supabase/rollback/20260930235950_quadro_ignora_parenteses.sql
*/
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

commit;
