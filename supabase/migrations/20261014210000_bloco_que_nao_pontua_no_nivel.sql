/*
  AVALIAÇÃO DOCUMENTAL: BLOCO QUE NÃO PONTUA NO NÍVEL DA VAGA

  Por quê (teste da ficha do 114/2026, 14/10/2026): no Motorista D (nível
  médio) a ficha pedia a conferência do item "Titulação acadêmica" e a
  lateral mostrava "Formação Acadêmica 0 / 10 (prévia)". Pela regra do
  114/2026 a titulação só pontua no nível superior (FORMACAO com
  pontos_por_nivel só de superior): no médio e no técnico o item não tem o
  que conferir — o questionário nem pergunta a titulação — e não muda nada.
  FC_PENDENCIAS_FICHA pedia "Titulação acadêmica (a maior): marque a
  situação" mesmo assim.

  O QUE MUDA
    - FC_BLOCO_NAO_PONTUA_NO_NIVEL(bloco, nível): o bloco TITULOS, CURSOS ou
      VINCULOS com teto 0 no nível (FC_TETO_DO_BLOCO) ou, nos títulos por
      nível, sem tabela para o nível — e só quando o bloco não tem como mudar
      o resultado: sem efeito (além de SO_REGISTRO) na situação nem nos
      motivos, sem requisito do cargo, sem linha extra (no bloco ou no nível)
      e sem experiência mínima. Sem nível, pontua.
    - FC_BLOCO_SE_APLICA: o bloco que não pontua no nível não vale (como o
      nao_se_aplica do cargo, 20261014150000). Daí, sem mudar as RPCs: as
      pendências não pedem a situação dele (FC_PENDENCIAS_FICHA) e o
      lançamento aceita NAO_SE_APLICA nele (FC_VALIDAR_LANCAMENTO_FICHA).
      FC_VALIDAR_RESULTADO_FICHA só olha o bloco eliminatório, e este não
      elimina.
  A conta não muda: o bloco dá 0 ponto no nível e não tem efeito, com ou sem
  situação (pontuacao.js/.py). A ficha mostra "Não pontua neste nível" e o
  bloco sai da composição da nota (blocoNaoPontuaNoNivel em ficha.js, o
  espelho deste predicado).

  Dados: conferido em 14/10/2026, uma única ficha lançada (114/2026, médio,
  rascunho, sem situação na titulação) cai no caso; nenhuma concluída.
  Assinaturas iguais; nada de dado muda.

  Ensaio: supabase/ensaios/20261014210000_bloco_que_nao_pontua_no_nivel.sql
  Rollback: supabase/rollback/20261014210000_bloco_que_nao_pontua_no_nivel.sql
*/
begin;

set local lock_timeout = '10s';

CREATE OR REPLACE FUNCTION private."FC_BLOCO_NAO_PONTUA_NO_NIVEL"(p_bloco jsonb, p_nivel text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(
         coalesce(p_nivel, '') <> ''
     and coalesce(p_bloco ->> 'tipo', '') in ('TITULOS', 'CURSOS', 'VINCULOS')
     -- Sem efeito que mude o resultado, na situação ou nos motivos.
     and not exists (select 1 from jsonb_each(case when jsonb_typeof(p_bloco -> 'efeitos') = 'object'
                                                   then p_bloco -> 'efeitos' else '{}'::jsonb end) e
                      where jsonb_typeof(e.value) = 'string' and e.value #>> '{}' not in ('', 'SO_REGISTRO'))
     and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(p_bloco -> 'motivos') = 'array'
                                                             then p_bloco -> 'motivos' else '[]'::jsonb end) m
                      where jsonb_typeof(m -> 'efeito') = 'string' and m ->> 'efeito' not in ('', 'SO_REGISTRO'))
     -- Sem requisito do cargo, sem linha extra e sem experiência mínima.
     and coalesce(jsonb_array_length(case when jsonb_typeof(p_bloco -> 'requisitos') = 'array' then p_bloco -> 'requisitos' end), 0) = 0
     and coalesce(jsonb_array_length(case when jsonb_typeof(p_bloco -> 'extras') = 'array' then p_bloco -> 'extras' end), 0) = 0
     and coalesce(jsonb_array_length(case when jsonb_typeof(p_bloco #> array['por_nivel', p_nivel, 'extras']) = 'array'
                                          then p_bloco #> array['por_nivel', p_nivel, 'extras'] end), 0) = 0
     and not coalesce(jsonb_typeof(p_bloco -> 'minimo_meses') = 'number' and (p_bloco ->> 'minimo_meses')::numeric > 0, false)
     -- Teto 0 no nível ou, nos títulos por nível, sem tabela para o nível.
     and (coalesce(private."FC_TETO_DO_BLOCO"(p_bloco, p_nivel) = 0, false)
          or (p_bloco ->> 'tipo' = 'TITULOS'
              and jsonb_typeof(p_bloco -> 'pontos_por_nivel') = 'object'
              and exists (select 1 from jsonb_object_keys(p_bloco -> 'pontos_por_nivel'))
              and coalesce(jsonb_array_length(case when jsonb_typeof(p_bloco #> array['pontos_por_nivel', p_nivel]) = 'array'
                                                   then p_bloco #> array['pontos_por_nivel', p_nivel] end), 0) = 0)),
         false);
$function$;
comment on function private."FC_BLOCO_NAO_PONTUA_NO_NIVEL"(jsonb, text) is
  'O bloco de títulos, cursos ou experiência não pontua no nível da vaga (teto 0 no nível ou, nos títulos por nível, sem tabela para ele) e não tem como mudar o resultado (sem efeito além de SO_REGISTRO, requisito, extra nem experiência mínima). Sem nível, pontua. Igual a blocoNaoPontuaNoNivel (ficha.js). 20261014210000.';
revoke all on function private."FC_BLOCO_NAO_PONTUA_NO_NIVEL"(jsonb, text) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private."FC_BLOCO_SE_APLICA"(p_bloco jsonb, p_lancamento jsonb)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select case
           when p_bloco -> 'nao_se_aplica' = 'true'::jsonb then false
           when private."FC_BLOCO_NAO_PONTUA_NO_NIVEL"(p_bloco, p_lancamento ->> 'nivel') then false
           when coalesce(p_bloco ->> 'condicao', case when p_bloco ->> 'tipo' = 'PONTUACAO' then 'INDIGENA' end) is null then true
           when coalesce(p_bloco ->> 'condicao', 'INDIGENA') = 'INDIGENA' then coalesce((p_lancamento ->> 'indigena')::boolean, false)
           else upper(coalesce(p_lancamento ->> 'modalidade', '')) = upper(split_part(p_bloco ->> 'condicao', '=', 2))
         end;
$function$;
comment on function private."FC_BLOCO_SE_APLICA"(jsonb, jsonb) is
  'O bloco vale para o candidato (condição INDIGENA ou MODALIDADE=…; o critério étnico só para quem se declarou indígena; o bloco marcado nao_se_aplica pela diferença do cargo, FC_BLOCO_DO_CARGO, não vale; nem o que não pontua no nível da vaga, FC_BLOCO_NAO_PONTUA_NO_NIVEL, 20261014210000), como blocoSeAplica (ficha.js).';
revoke all on function private."FC_BLOCO_SE_APLICA"(jsonb, jsonb) from public, anon, authenticated, service_role;

commit;
