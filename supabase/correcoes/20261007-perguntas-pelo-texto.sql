/*
  CORREÇÃO DE DADOS — os modelos da regra acham as perguntas pelo começo do
  enunciado, não pelo número.

  As colunas da Empregare se chamam "Pergunta N - <enunciado>", e o número N
  da mesma pergunta muda de vaga para vaga dentro do mesmo edital (conferido
  nas vagas capturadas e nos questionários da Empregare):
    - 93/2026: "Experiência Profissional em atividades compatíveis com o
      cargo:" é a Pergunta 10 (Téc. Segurança), 11 (Médico, Engenheiro,
      Enfermeiro do Trabalho) ou 12 (Téc. Enfermagem); a Pergunta 17 é o
      sistema de concorrência ou a autodeclaração de pretos e pardos;
    - 114/2026: "Experiência Profissional na área em que concorre, conforme
      requisitos do Edital:" é a Pergunta 7, 9 ou 11, conforme o cargo.
  A regra passou a casar o texto com o começo do enunciado depois de
  "Pergunta N - " (src/lib/avaliacao-documental/nota-declarada.js e
  python/monitora/avaliacao_documental/nota_declarada.py); "Anexe o
  comprovante de Experiência Profissional…" não casa com "Experiência
  Profissional".

    PROJ26-CURRICULAR  provisoria.pergunta_experiencia "Pergunta 17 -" →
                       "Experiência Profissional" (o desempate do item 10.1
                       lia a pergunta errada);
    PROJ26-RIO-DOCE    volta o desempate do item 10.1 completo — IDOSO,
                       EXPERIENCIA_DECLARADA, MAIOR_IDADE — com a pergunta
                       "Experiência Profissional";
    SI26-100           a nota declarada pelo enunciado: ETNICO "Você é
                       indígena e mora em aldeia" (P6) e FORMACAO "Você possui
                       outras formações" (P15, nos níveis médio, técnico e
                       superior). Os blocos e a eliminação do termo continuam
                       pelo número: no padrão NERSSI a numeração é a mesma em
                       todos os níveis.
  Os modelos SI26-ALSE, SI26-MRSA, SI26-PARINTINS e SI26-INTERIOR-SUL não
  citam pergunta nenhuma. A regra de um edital que já copiou o modelo não
  muda: a coordenação carrega o modelo de novo na aba Regra.

  Rode no SQL Editor (papel postgres), depois das correções de 20261006. É
  idempotente: só mexe no que ainda está diferente e valida cada modelo com
  private."FC_VALIDAR_REGRA_ANALISE". Os JSON de
  tests/fixtures/avaliacao-documental/modelos/ são o resultado (conferido em
  tests/modelos-dos-editais-recentes.test.js).
*/
begin;

update public."TB_REGRA_ANALISE_MODELO" m
   set "DS_CONFIGURACAO" = jsonb_set(m."DS_CONFIGURACAO", '{provisoria}',
                                     coalesce(m."DS_CONFIGURACAO" -> 'provisoria', '{}'::jsonb) || p.provisoria),
       "DT_ATUALIZACAO" = now()
  from (values
    ('PROJ26-CURRICULAR', $provisoria${"pergunta_experiencia":"Experiência Profissional"}$provisoria$::jsonb),
    ('PROJ26-RIO-DOCE', $provisoria${"desempate":["IDOSO","EXPERIENCIA_DECLARADA","MAIOR_IDADE"],"pergunta_experiencia":"Experiência Profissional"}$provisoria$::jsonb),
    ('SI26-100', $provisoria${"nota_declarada":[{"parcial":"FORMACAO","pergunta":"Você possui outras formações","tipo":"OPCAO","pontos":{"Especialização na área à qual concorre":1,"Não possuo":0},"teto":null},{"parcial":"ETNICO","pergunta":"Você é indígena e mora em aldeia","tipo":"OPCOES_SOMADAS","pontos":{"Sou indígena":8,"Moro em aldeia":6},"teto":14}]}$provisoria$::jsonb)
  ) as p(codigo, provisoria)
 where m."CO_MODELO" = p.codigo
   and coalesce(m."DS_CONFIGURACAO" -> 'provisoria', '{}'::jsonb) || p.provisoria
       is distinct from m."DS_CONFIGURACAO" -> 'provisoria';

do $$
declare
  v_modelo record;
begin
  for v_modelo in
    select * from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" in ('PROJ26-CURRICULAR', 'PROJ26-RIO-DOCE', 'SI26-100')
  loop
    perform private."FC_VALIDAR_REGRA_ANALISE"(v_modelo."DS_CONFIGURACAO");
    if v_modelo."DS_CONFIGURACAO" -> 'provisoria' -> 'desempate' @> '["EXPERIENCIA_DECLARADA"]'::jsonb
       and coalesce(btrim(v_modelo."DS_CONFIGURACAO" -> 'provisoria' ->> 'pergunta_experiencia'), '') = '' then
      raise exception 'Modelo %: desempate pela experiência declarada sem a pergunta.', v_modelo."CO_MODELO";
    end if;
    if jsonb_path_exists(v_modelo."DS_CONFIGURACAO", '$.provisoria.** ? (@.type() == "string" && @ like_regex "^Pergunta [0-9]+ -" flag "i")')
       and v_modelo."CO_MODELO" <> 'SI26-100' then
      raise exception 'Modelo %: ainda acha pergunta da Provisória pelo número.', v_modelo."CO_MODELO";
    end if;
  end loop;
end;
$$;

select "CO_MODELO",
       "DS_CONFIGURACAO" -> 'provisoria' -> 'desempate' as desempate,
       "DS_CONFIGURACAO" -> 'provisoria' -> 'pergunta_experiencia' as pergunta_experiencia,
       jsonb_path_query_array("DS_CONFIGURACAO", '$.provisoria.nota_declarada[*].pergunta') as perguntas_da_nota_declarada
  from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" in ('PROJ26-CURRICULAR', 'PROJ26-RIO-DOCE', 'SI26-100') order by 1;

commit;
