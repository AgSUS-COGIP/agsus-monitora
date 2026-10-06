/*
  CORREÇÃO DE DADOS — o modelo PROJ26-CURRICULAR com o lote, o desempate e as
  cotas PI e PQ do edital 93/2026 (fase F3 do plano: docs/analises-no-monitora/
  plano-de-construcao.md).

  Rode DEPOIS de 20261006120500_lote_por_nota_minima.sql, no SQL Editor (papel
  postgres). É idempotente: rodar de novo deixa o modelo igual. Para quem já
  rodou 20261006-modelos-da-regra-da-analise.sql (que agora traz o mesmo).

  Do PDF oficial do 93/2026:
    item 8.2.6  "Serão avaliados na etapa de análise curricular apenas os
                candidatos que obtiverem o mínimo de 15 pontos" → lote base
                NOTA_MINIMA, nota_minima 15, item_edital 8.2.6, sem publicar
                cada reposição;
    item 10.1   desempate: 60 anos ou mais (IDOSO), maior tempo de experiência
                (EXPERIENCIA_DECLARADA, pela faixa da Pergunta 17 enquanto não há
                ficha), maior idade (MAIOR_IDADE); por último o código;
    itens 5.7.5 e 5.7.6  blocos de cota COTA_PI (Anexo VI) e COTA_PQ (Anexo VII
                ou certificado da FCP): conforme fica na cota; não conforme ou
                não enviado segue na ampla. A heteroidentificação de PP não muda.
  O nome deixa de citar o 30/2026 e o 114/2026 (o 114 terá modelo próprio).
  A regra de um edital que já copiou o modelo não muda: a coordenação carrega o
  modelo no formulário da aba Regra e salva uma versão nova, com o motivo.
*/
begin;

update public."TB_REGRA_ANALISE_MODELO"
   set "NO_MODELO" = 'Projetos — análise curricular do 93/2026 (sem critério étnico)',
       "DS_CONFIGURACAO" = "DS_CONFIGURACAO"
         || jsonb_build_object(
              'lote', ("DS_CONFIGURACAO" -> 'lote')
                      || '{"base":"NOTA_MINIMA","nota_minima":15,"item_edital":"8.2.6","publica_reposicao":false}'::jsonb,
              'provisoria', ("DS_CONFIGURACAO" -> 'provisoria')
                      || '{"desempate":["IDOSO","EXPERIENCIA_DECLARADA","MAIOR_IDADE"],"pergunta_experiencia":"Pergunta 17 -"}'::jsonb,
              -- As cotas PI e PQ (itens 5.7.5 e 5.7.6) logo depois da de PcD; a de PP fica como está.
              'blocos', (select jsonb_agg(x.b order by x.ordem)
                           from (select b, o::numeric as ordem
                                   from jsonb_array_elements("DS_CONFIGURACAO" -> 'blocos') with ordinality t(b, o)
                                  where b ->> 'codigo' not in ('COTA_PI', 'COTA_PQ')
                                 union all
                                 select n.b, coalesce((select o from jsonb_array_elements("DS_CONFIGURACAO" -> 'blocos') with ordinality t(b, o)
                                                        where b ->> 'codigo' = 'COTA_PCD'), 1000) + n.o / 10.0
                                   from jsonb_array_elements($cotas$[{"codigo":"COTA_PI","titulo":"Indígenas (documento de pertencimento étnico, Anexo VI)","item_edital":"5.7.5","tipo":"COTA","condicao":"MODALIDADE=PI","perguntas":[],"efeitos":{"CONFORME":"SO_REGISTRO","NAO_CONFORME":"SEGUE_AMPLA","NAO_ENVIADO":"SEGUE_AMPLA"},"motivos":[{"codigo":"SEM_LIDERANCA","texto":"Documento de pertencimento étnico sem a assinatura da liderança local (Anexo VI).","item_edital":"5.7.5","efeito":"SEGUE_AMPLA"},{"codigo":"FORA_DO_MODELO","texto":"Documento de pertencimento étnico fora do modelo do Anexo VI.","item_edital":"5.7.5","efeito":"SEGUE_AMPLA"}]},{"codigo":"COTA_PQ","titulo":"Quilombolas (declaração de pertencimento, Anexo VII, ou certificado da FCP)","item_edital":"5.7.6","tipo":"COTA","condicao":"MODALIDADE=PQ","perguntas":[],"efeitos":{"CONFORME":"SO_REGISTRO","NAO_CONFORME":"SEGUE_AMPLA","NAO_ENVIADO":"SEGUE_AMPLA"},"motivos":[{"codigo":"SEM_LIDERANCA","texto":"Declaração de pertencimento sem a assinatura da liderança ou associação local (Anexo VII).","item_edital":"5.7.6","efeito":"SEGUE_AMPLA"},{"codigo":"FORA_DO_MODELO","texto":"Declaração fora do modelo do Anexo VII e sem certificado da Fundação Cultural Palmares.","item_edital":"5.7.6","efeito":"SEGUE_AMPLA"}]}]$cotas$::jsonb) with ordinality n(b, o)) x)),
       "DT_ATUALIZACAO" = now()
 where "CO_MODELO" = 'PROJ26-CURRICULAR';

do $$
begin
  perform private."FC_VALIDAR_REGRA_ANALISE"("DS_CONFIGURACAO")
     from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" = 'PROJ26-CURRICULAR';
end;
$$;

select "CO_MODELO", "DS_CONFIGURACAO" -> 'lote' ->> 'base' as lote, "DS_CONFIGURACAO" -> 'provisoria' -> 'desempate' as desempate
  from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" = 'PROJ26-CURRICULAR';

commit;
