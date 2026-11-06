/*
  Ligação vaga ↔ quadro de vagas: separa a UF colada no fim da cidade e
  descarta o parêntese que não fecha.

  Motivo: a Empregare cola a UF na cidade no nome da vaga ("Enfermeiro -
  Teófilo OtoniMG", "Cirurgião Dentista 40h - ManicoréAM - DSEI Manaus em
  Excel (questionário NÍVEL SUPERIOR"), enquanto a lotação do quadro vem
  "Teófilo Otoni/MG". FC_TOKENS_VAGA gerava "otonimg" e a lotação não casava:
  a conferência CLASSIFICACAO_VAGA_SEM_QUADRO acusava essas vagas (95/2026,
  101/2026) e a classificação não achava a linha do quadro.

  O que muda em private."FC_TOKENS_VAGA" (antes de baixar a caixa):
    1. UF colada: uma letra minúscula seguida de uma sigla de UF válida (as
       27) em maiúsculas, no fim da palavra, vira "<letra> <UF>"
       ("OtoniMG" → "Otoni MG", "MissõesMG.." → "Missões MG.."). Sigla
       sozinha ("CASAI", "DSEI", "TI"), palavra toda em maiúsculas
       ("ENFERMEIRO") ou com a sigla no meio não mudam.
    2. Ruído do questionário: além do " em Excel …" (já descartado), um
       "(" que não fecha até o fim do texto é descartado com o resto
       ("… (questionário NÍVEL TÉCNICO" sem o "em Excel").
  O resto é o de 20260930235950 (parênteses fechados, acentos, palavras
  vazias). Quem usa: FC_QUADRO_DA_VAGA (e por ela FC_DADOS_CLASSIFICACAO_EDITAL,
  FC_QUADRO_PELO_TITULO_EMPREGARE, FC_EMPREGARE_VAGAS_DO_QUADRO,
  gravar_pre_classificacao_vaga, obter_acompanhamento_inscricoes,
  obter_quadro_de_vagas, pre_classificacao_ler_candidatos). Nenhum índice,
  coluna gerada ou view materializada usa a função (conferido em 06/11/2026).

  Cópia em Python (o robô das conferências confere a vaga sem quadro lá):
  python/monitora/classificacao/quadro_da_vaga.py — muda junto, com os casos
  em tests/fixtures/quadro-da-vaga/casos-do-banco.json.

  Ensaio: supabase/ensaios/20261106170100_tokens_da_vaga_com_uf_colada.sql
  (todas as vagas das análises e os títulos da Empregare, antes × depois:
  nenhuma muda de linha nem perde a linha).
  Rollback: supabase/rollback/20261106170100_tokens_da_vaga_com_uf_colada.sql
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
             translate(lower(
               regexp_replace(
                 regexp_replace(
                   regexp_replace(regexp_replace(coalesce(p_texto, ''), '\s+em\s+excel.*$', '', 'i'),
                                  '\([^)]*$', ' '),
                   '([a-záàâãäéèêëíìîïóòôõöúùûüç])(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)(?![A-Za-zÀ-ÿ0-9])',
                   '\1 \2', 'g'),
                 '\([^)]*\)', ' ', 'g')),
               'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
             '[^a-z0-9]+', ' ', 'g'),
           ' ') t
   where t <> '' and t not in ('a', 'as', 'o', 'os', 'e', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'para');
$function$;
comment on function private."FC_TOKENS_VAGA"(text) is 'Palavras de um nome de cargo/lotação para comparar a vaga da análise com o quadro do edital: UF colada na cidade separada ("OtoniMG" → otoni mg), minúsculas, sem acento, sem "em Excel (questionário…", sem parêntese que não fecha, sem o que está entre parênteses e sem artigos/preposições. Cópia em python/monitora/classificacao/quadro_da_vaga.py.';

commit;
