/*
  CORREÇÃO DE DADOS — o modelo PROJ26-CURRICULAR com as perguntas da Empregare
  ligadas aos blocos e a nota declarada de titulação e cursos (fase F4 do
  plano: docs/analises-no-monitora/plano-de-construcao.md).

  Por quê: a ficha (F4) mostra em cada bloco o que o candidato DECLAROU na
  Empregare (a resposta das perguntas ligadas ao bloco) e compara os pontos
  declarados com os apurados; nota diferente da declarada pede justificativa.
  No 93/2026 a regra v4 ainda não liga as perguntas aos blocos e não tem a
  nota declarada: a ficha mostra os blocos sem o declarado.

  As perguntas são casadas pelo COMEÇO DO ENUNCIADO, sem o número (que muda de
  vaga para vaga), sem acento e sem caixa (20261007-perguntas-pelo-texto.sql):
    IDENTIDADE         "Anexe o documento de identificação" / "Anexe um documento de identificação"
    ESCOLARIDADE       "Você possui Graduação na área da vaga" / "Você possui Ensino Médio completo e Curso Técnico"
                       / "Anexe a comprovação de Nível" / "Anexe a comprovação de conclusão do Ensino Médio"
    REGISTRO_CONSELHO  "Você possui registro profissional ativo" / "Anexe o comprovante do seu registro profissional"
    COTA_PP            "Candidatos às vagas destinadas a Pretos ou Pardos" / "Candidatos concorrendo às vagas destinadas a Pretos ou Pardos"
    COTA_PCD           "Os candidatos que concorrem às vagas destinadas a PcD"
    COTA_PI            "Para candidatos que se declaram indígenas"
    COTA_PQ            "Para candidatos que se declaram quilombolas"
    FORMACAO           "Qual seu Nível de Titulação Acadêmica" / "Anexe seu comprovante de Titulação Acadêmica"
    CURSOS             "Selecione a pontuação relativa à carga horária de Cursos" / "Anexe os seus Certificados de Conclusão dos Cursos"
    EXPERIENCIA        "Experiência Profissional em atividades" / "Anexe o comprovante de Experiência Profissional"
  Nota declarada (opção → pontos, como o questionário do 93/2026):
    FORMACAO  Especialização 5, Mestrado 8, Doutorado 10, Não possuo 0;
    CURSOS    "N ponto(s)" vale N (o questionário já pergunta a pontuação), Não possuo 0.
  A experiência fica SEM nota declarada: a mesma faixa ("1 ano") vale 5 no
  nível superior e 4 no técnico, e a nota declarada não varia por nível. A
  ficha mostra a resposta ("4 anos ou mais") e a ART total segue como a
  conferência; a coordenação pode mapear a experiência na aba Regra se quiser.

  Rode DEPOIS de 20261007110000_conteudo_da_ficha.sql, no SQL Editor (papel
  postgres). É idempotente. Muda só o MODELO: a regra do 93/2026 não muda
  sozinha — a coordenação carrega o modelo no formulário da aba Regra (ou liga
  as perguntas bloco a bloco), salva uma versão nova com o motivo e confere.
  As fichas pendentes e em análise passam a seguir a versão nova (AM-2.3).
*/
begin;

update public."TB_REGRA_ANALISE_MODELO"
   set "DS_CONFIGURACAO" = jsonb_set(jsonb_set("DS_CONFIGURACAO", '{blocos}', (
         select jsonb_agg(case b ->> 'codigo'
                  when 'IDENTIDADE' then jsonb_set(b, '{perguntas}',
                    '["Anexe o documento de identificação", "Anexe um documento de identificação"]')
                  when 'ESCOLARIDADE' then jsonb_set(b, '{perguntas}',
                    '["Você possui Graduação na área da vaga", "Você possui Ensino Médio completo e Curso Técnico", "Anexe a comprovação de Nível", "Anexe a comprovação de conclusão do Ensino Médio"]')
                  when 'REGISTRO_CONSELHO' then jsonb_set(b, '{perguntas}',
                    '["Você possui registro profissional ativo", "Anexe o comprovante do seu registro profissional"]')
                  when 'COTA_PP' then jsonb_set(b, '{perguntas}',
                    '["Candidatos às vagas destinadas a Pretos ou Pardos", "Candidatos concorrendo às vagas destinadas a Pretos ou Pardos"]')
                  when 'COTA_PCD' then jsonb_set(b, '{perguntas}', '["Os candidatos que concorrem às vagas destinadas a PcD"]')
                  when 'COTA_PI' then jsonb_set(b, '{perguntas}', '["Para candidatos que se declaram indígenas"]')
                  when 'COTA_PQ' then jsonb_set(b, '{perguntas}', '["Para candidatos que se declaram quilombolas"]')
                  when 'FORMACAO' then jsonb_set(b, '{perguntas}',
                    '["Qual seu Nível de Titulação Acadêmica", "Anexe seu comprovante de Titulação Acadêmica"]')
                  when 'CURSOS' then jsonb_set(b, '{perguntas}',
                    '["Selecione a pontuação relativa à carga horária de Cursos", "Anexe os seus Certificados de Conclusão dos Cursos"]')
                  when 'EXPERIENCIA' then jsonb_set(b, '{perguntas}',
                    '["Experiência Profissional em atividades", "Anexe o comprovante de Experiência Profissional"]')
                  else b end order by o)
           from jsonb_array_elements("DS_CONFIGURACAO" -> 'blocos') with ordinality t(b, o))),
       '{provisoria,nota_declarada}', $n$[
         {"parcial": "FORMACAO", "pergunta": "Qual seu Nível de Titulação Acadêmica", "tipo": "OPCAO",
          "pontos": {"Especialização": 5, "Mestrado": 8, "Doutorado": 10, "Não possuo": 0}},
         {"parcial": "CURSOS", "pergunta": "Selecione a pontuação relativa à carga horária de Cursos", "tipo": "OPCAO",
          "pontos": {"Não possuo": 0, "1 ponto": 1, "2 pontos": 2, "3 pontos": 3, "4 pontos": 4, "5 pontos": 5,
                     "6 pontos": 6, "7 pontos": 7, "8 pontos": 8, "9 pontos": 9, "10 pontos": 10}}]$n$),
       "DT_ATUALIZACAO" = now()
 where "CO_MODELO" = 'PROJ26-CURRICULAR';

-- O modelo continua válido (a mesma conferência de toda versão de regra).
select private."FC_VALIDAR_REGRA_ANALISE"("DS_CONFIGURACAO")
  from public."TB_REGRA_ANALISE_MODELO" where "CO_MODELO" = 'PROJ26-CURRICULAR';

commit;
