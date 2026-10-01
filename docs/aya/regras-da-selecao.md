# Regras da Seleção

Como a tela de Seleção (funil por vaga) calcula os números. Estas explicações ficavam em dicas e
textos da própria tela; saíram da interface quando a Seleção virou módulo do app (Etapa 2) e
ficam aqui, com a Aya.

## Tela de Seleção

**perguntas:** tela de selecao | aba selecao | funil por vaga | painel de selecao
**resposta:** A tela de Seleção do MONITORA mostra o funil de cada vaga, a partir da planilha Auditoria carregada todo dia no banco: inscritos, aptos para análise, eliminados, triados, convocados para entrevista, aprovados e contratados. Ela é só de consulta e mostra a área escolhida no menu. Os quatro filtros (DSEI ou unidade, edital, cargo e vaga) aceitam vários valores, e as opções de cada um seguem os outros já escolhidos. Clicar numa barra do ranking de unidades filtra a tela por aquela unidade; clicar de novo tira o filtro. A busca da tabela vale só para a tabela.
**fonte:** interface do MONITORA

## Convocados para entrevista

**perguntas:** convocados entrevista | convocados para entrevista | origem dos convocados
**resposta:** Na Seleção, os convocados para entrevista vêm das entrevistas registradas no MONITORA quando o edital as tem; quando não tem, vêm da planilha Auditoria, que é o dado antigo. O CSV exportado traz a origem de cada vaga na coluna "Origem dos convocados".
**fonte:** interface do MONITORA

## Aprovados e contratados na Seleção

**perguntas:** aprovados na selecao | contratados na selecao | nao contratados
**resposta:** Na Seleção, os aprovados vêm da lista de aprovados vigente de cada edital. Os contratados são os candidatos dessa lista com a situação Contratado ou Migração. Sem lista de aprovados, a vaga não soma aprovados nem contratados.
**fonte:** interface do MONITORA

## Taxa de contratação

**perguntas:** taxa de contratacao | taxa contratacao | percentual de contratados
**resposta:** Na Seleção, a taxa de contratação é o número de contratados dividido pelo número de aprovados, em porcentagem. Sem aprovados no recorte, a taxa aparece como 0%. O medidor "Contratados" mostra a mesma conta, com quantos foram contratados de quantos aprovados.
**fonte:** interface do MONITORA

## Eliminados antes da análise

**perguntas:** eliminados antes da analise | questionario nao finalizado | eliminados por nota
**resposta:** Na Seleção, os eliminados antes da análise são a soma de três grupos: os cancelados, os reprovados por não finalizar o questionário e os eliminados por nota. O gráfico "Aptos na análise e eliminados" compara os aptos para análise com o total de eliminados, e "Triados e reprovados na análise" mostra o resultado da análise curricular.
**fonte:** interface do MONITORA

## Alertas da coluna Observação

**perguntas:** alertas identificados no recorte | observacao da selecao | alertas da selecao
**resposta:** Na Seleção, os alertas identificados no recorte são as observações da coluna Observação da planilha Auditoria. Cada observação aparece uma vez, sem diferenciar maiúsculas, com quantas vagas a têm e em quais unidades e editais.
**fonte:** interface do MONITORA
