/*
  CORREÇÃO DE DADOS — a experiência na nota declarada dos modelos de Projetos,
  com os pontos do nível da vaga.

  Por quê: a nota declarada confere a ART (a nota do questionário da
  Empregare). No 93/2026 ela tinha só a titulação e os cursos
  (20261007-perguntas-da-ficha-proj26.sql), porque a mesma faixa de
  experiência vale pontos diferentes por nível — e a pré-classificação acusou
  "109 divergências ART × declarada" (alarme falso: faltava a experiência) e a
  ficha não mostrava o declarado da experiência. Desde
  20261007140000_declarada_por_nivel.sql o item da nota declarada pode ter
  pontos_por_nivel; a conta usa o nível da vaga (nome do cargo e regra de
  classificação, como a ficha).

  O item acrescentado (pergunta "Experiência Profissional", achada pelo começo
  do enunciado; "Anexe o comprovante de Experiência Profissional…" não casa):
    PROJ26-CURRICULAR (93/2026), pontos por nível, 6 meses obrigatórios não pontuam:
      superior  +5 a cada 6 meses, máx. 35: "6 meses obrigatórios" 0, "1 ano" 5,
                "1 ano e 6 meses" 10, "2 anos" 15, "2 anos e 6 meses" 20,
                "3 anos" 25, "3 anos e 6 meses" 30, "4 anos ou mais" 35;
      técnico e médio  +4 a cada 6 meses, máx. 40: "6 meses obrigatórios" 0,
                "1 ano" 4, … "5 anos" 36, "5 anos e 6 meses ou mais" 40.
    PROJ26-RIO-DOCE (114/2026): +5 a cada 6 meses até 35 em TODOS os níveis —
      os mesmos pontos em qualquer nível, então o item usa "pontos" simples
      (não depende de achar o nível da vaga): "6 meses obrigatórios" 0 …
      "4 anos ou mais" 35.
  O questionário real do 93/2026 tem a opção "1 anos e 6 meses" (assim, com o
  erro de digitação): ela entra no mapa ao lado de "1 ano e 6 meses". Aspas,
  &nbsp; e caixa a leitura já ignora (textoDaResposta / chaveDaOpcao).

  Rode DEPOIS de 20261007140000_declarada_por_nivel.sql, no SQL Editor (papel
  postgres). É idempotente: troca o item EXPERIENCIA da nota declarada (se já
  houver) pelo daqui e valida cada modelo com private."FC_VALIDAR_REGRA_ANALISE".
  Muda só o MODELO: a regra do 93/2026 não muda sozinha — a coordenação
  carrega o modelo de novo na aba Regra (ou acrescenta a pergunta na nota
  declarada), salva uma versão com o motivo e confere; depois, "Recalcular" na
  Pré-classificação. Os JSON de tests/fixtures/avaliacao-documental/modelos/
  são o resultado (conferido em tests/modelos-dos-editais-recentes.test.js).
*/
begin;

update public."TB_REGRA_ANALISE_MODELO" m
   set "DS_CONFIGURACAO" = jsonb_set(m."DS_CONFIGURACAO", '{provisoria,nota_declarada}',
         coalesce((select jsonb_agg(d order by o)
                     from jsonb_array_elements(case when jsonb_typeof(m."DS_CONFIGURACAO" #> '{provisoria,nota_declarada}') = 'array'
                                                    then m."DS_CONFIGURACAO" #> '{provisoria,nota_declarada}' else '[]'::jsonb end)
                          with ordinality t(d, o)
                    where d ->> 'parcial' is distinct from 'EXPERIENCIA'), '[]'::jsonb) || jsonb_build_array(i.item)),
       "DT_ATUALIZACAO" = now()
  from (values
    ('PROJ26-CURRICULAR', $item${"parcial":"EXPERIENCIA","pergunta":"Experiência Profissional","tipo":"OPCAO","pontos_por_nivel":{"superior":{"6 meses obrigatórios":0,"1 ano":5,"1 ano e 6 meses":10,"1 anos e 6 meses":10,"2 anos":15,"2 anos e 6 meses":20,"3 anos":25,"3 anos e 6 meses":30,"4 anos ou mais":35},"tecnico":{"6 meses obrigatórios":0,"1 ano":4,"1 ano e 6 meses":8,"1 anos e 6 meses":8,"2 anos":12,"2 anos e 6 meses":16,"3 anos":20,"3 anos e 6 meses":24,"4 anos":28,"4 anos e 6 meses":32,"5 anos":36,"5 anos e 6 meses ou mais":40},"medio":{"6 meses obrigatórios":0,"1 ano":4,"1 ano e 6 meses":8,"1 anos e 6 meses":8,"2 anos":12,"2 anos e 6 meses":16,"3 anos":20,"3 anos e 6 meses":24,"4 anos":28,"4 anos e 6 meses":32,"5 anos":36,"5 anos e 6 meses ou mais":40}}}$item$::jsonb),
    ('PROJ26-RIO-DOCE', $item${"parcial":"EXPERIENCIA","pergunta":"Experiência Profissional","tipo":"OPCAO","pontos":{"6 meses obrigatórios":0,"1 ano":5,"1 ano e 6 meses":10,"1 anos e 6 meses":10,"2 anos":15,"2 anos e 6 meses":20,"3 anos":25,"3 anos e 6 meses":30,"4 anos ou mais":35}}$item$::jsonb)
  ) as i(codigo, item)
 where m."CO_MODELO" = i.codigo
   and not coalesce(m."DS_CONFIGURACAO" #> '{provisoria,nota_declarada}', '[]'::jsonb) @> jsonb_build_array(i.item);

do $$
declare
  v_modelo record;
begin
  for v_modelo in
    select * from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" in ('PROJ26-CURRICULAR', 'PROJ26-RIO-DOCE')
  loop
    perform private."FC_VALIDAR_REGRA_ANALISE"(v_modelo."DS_CONFIGURACAO");
    if (select count(*) from jsonb_array_elements(v_modelo."DS_CONFIGURACAO" #> '{provisoria,nota_declarada}') d
         where d ->> 'parcial' = 'EXPERIENCIA') <> 1 then
      raise exception 'Modelo %: a nota declarada deveria ter um item de experiência.', v_modelo."CO_MODELO";
    end if;
  end loop;
end;
$$;

select "CO_MODELO",
       jsonb_path_query_array("DS_CONFIGURACAO", '$.provisoria.nota_declarada[*].parcial') as parciais,
       "DS_CONFIGURACAO" #> '{provisoria,nota_declarada}' -> -1 as experiencia
  from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" in ('PROJ26-CURRICULAR', 'PROJ26-RIO-DOCE') order by 1;

commit;
