# Regras da Seleção

Como a tela de Seleção (funil por vaga) calcula os números. Estas explicações ficavam em dicas e
textos da própria tela; saíram da interface quando a Seleção virou módulo do app (Etapa 2) e
ficam aqui, com a Aya. Fontes: `src/modulos/selecao/`, `src/lib/selecao-do-painel.js`,
`src/lib/selecao-da-planilha.js`, `.github/workflows/sincronizar-selecao.yml` e as migrations
`20261001090000_selecao.sql`, `20261001100000_selecao_area_pelos_editais.sql` e
`20261001130000_selecao_aprovados_outras_bancas.sql`.

## Tela de Seleção

**perguntas:** tela de selecao | aba selecao | funil por vaga | painel de selecao | como funciona a tela de selecao | para que serve selecao | para que serve a tela de selecao
**resposta:** A tela de Seleção do MONITORA mostra o funil de cada vaga, a partir da planilha Auditoria carregada todo dia no banco. Os sete indicadores são inscritos, aptos, triados, convocados, aprovados, contratados e a taxa de contratação. Ela é só de consulta e mostra a área escolhida no menu. Os quatro filtros (DSEI ou unidade, edital, cargo e vaga) aceitam vários valores, e as opções de cada um seguem os outros já escolhidos. Clicar numa barra do ranking de unidades filtra a tela por aquela unidade; clicar de novo tira o filtro. A busca da tabela vale só para a tabela.
**fonte:** src/modulos/selecao/; src/lib/selecao-do-painel.js
**abrir:** selecao

## Atualização da Seleção

**perguntas:** quando a selecao e atualizada | carga da selecao | planilha auditoria | atualizacao da selecao
**resposta:** A Seleção é carregada todo dia às 9h de Brasília pelo GitHub Actions, a partir da aba Resultado da planilha Auditoria (também pode ser disparada à mão). Uma carga com menos da metade das vagas ativas é recusada e nada é desativado. A vaga que sai da planilha fica inativa, guardada para histórico. Na Saúde Indígena só entram as vagas de DSEI e CASAI; as de outras unidades vão para SEDE ou Projetos pelo edital achado.
**fonte:** .github/workflows/sincronizar-selecao.yml; supabase/migrations/20261001090000_selecao.sql; supabase/migrations/20261001100000_selecao_area_pelos_editais.sql

## Convocados para entrevista

**perguntas:** convocados entrevista | convocados para entrevista | origem dos convocados | de onde vem os convocados para entrevista
**resposta:** Na Seleção, os convocados para entrevista vêm das entrevistas registradas no MONITORA quando o edital as tem (a vaga sem nenhuma entrevista fica com 0); quando o edital não tem, vêm da planilha Auditoria, que é o dado antigo. O CSV exportado traz a origem de cada vaga na coluna "Origem dos convocados".
**fonte:** supabase/migrations/20261001130000_selecao_aprovados_outras_bancas.sql; src/lib/selecao-do-painel.js

## Aprovados e contratados na Seleção

**perguntas:** aprovados na selecao | contratados na selecao | nao contratados
**resposta:** Na Seleção, os aprovados vêm da lista de aprovados vigente de cada edital. Os contratados são os candidatos dessa lista com a situação Contratado ou Migração, e os não contratados são aprovados menos contratados. Sem lista de aprovados, a vaga não soma aprovados nem contratados. Nas vagas de outras bancas (sem código da vaga), a ligação com a lista é pelo nome do cargo, sem diferenciar acento, maiúsculas ou pontuação.
**fonte:** supabase/migrations/20261001090000_selecao.sql; supabase/migrations/20261001130000_selecao_aprovados_outras_bancas.sql

## Taxa de contratação

**perguntas:** taxa de contratacao | taxa contratacao | percentual de contratados | como e calculada a taxa de contratacao
**resposta:** Na Seleção, a taxa de contratação é o número de contratados dividido pelo número de aprovados, em porcentagem. Sem aprovados no recorte, a taxa aparece como 0%. O medidor "Contratados" mostra a mesma conta, com quantos foram contratados de quantos aprovados.
**fonte:** src/lib/selecao-do-painel.js

## Eliminados antes da análise

**perguntas:** eliminados antes da analise | questionario nao finalizado | eliminados por nota
**resposta:** Na Seleção, os eliminados antes da análise são a soma de três grupos: os cancelados, os reprovados por não finalizar o questionário e os eliminados por nota. O gráfico "Aptos na análise e eliminados" compara os aptos para análise com o total de eliminados, e "Triados e reprovados na análise" mostra o resultado da análise curricular.
**fonte:** src/lib/selecao-do-painel.js

## Alertas da coluna Observação

**perguntas:** alertas identificados no recorte | observacao da selecao | alertas da selecao
**resposta:** Na Seleção, os alertas identificados no recorte são as observações da coluna Observação da planilha Auditoria. Cada observação aparece uma vez, sem diferenciar maiúsculas, com quantas vagas a têm e em quais unidades e editais.
**fonte:** src/lib/selecao-do-painel.js
