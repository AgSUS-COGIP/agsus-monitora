# Regras dos Editais

A tela Editais (view `nucleo`): cadastro do edital, cronograma, status calculado, anexos em PDF e
quadro de vagas. Fontes: `src/modulos/editais/`, `src/lib/cronograma-do-edital.js`,
`src/lib/editais-do-nucleo.js`, `src/lib/anexos-do-edital.js`, `api/anexos-do-edital.py` e as
migrations `20260928120000_edital_novo_sem_motivo.sql`, `20260928220000_edital_na_area_certa.sql`,
`20260930233000_quadro_de_vagas_do_edital.sql` e `20260930235950_quadro_ignora_parenteses.sql`.

## Tela de Editais

**perguntas:** tela de editais | tela editais | aba editais | para que serve editais | para que serve a tela de editais | equipe nucleo
**resposta:** Em Editais ficam os editais da área atual: a tabela, os alertas de cronograma e o formulário de cada edital, com cronograma, status, anexos em PDF, quadro de vagas e histórico. Os indicadores do painel (Total de editais, Editais ativos, Editais inativos, Em andamento, Sem cronograma, Incompletos, Próximos 7 dias e Excepcionais) filtram a fila ao clicar; clicar de novo no mesmo indicador tira o filtro. Cadastra e edita quem tem nível Editor em Editais ou em Cronograma.
**fonte:** src/modulos/editais/; src/lib/editais-do-nucleo.js; src/lib/access-roles.js
**abrir:** nucleo

## Editais ativos e inativos

**perguntas:** editais ativos | editais inativos | edital inativo | edital ativo | o que e edital inativo | o que e edital ativo | quantos editais ativos | total de editais
**resposta:** Em Editais, edital inativo é o que teve o processo encerrado: status Concluído ou Cancelado — o mesmo sentido do Inativo da Situação do processo nas Análises curriculares. Os demais (Planejado, Em andamento, Suspenso, Paralisado ou sem status) são ativos. Total de editais é a soma dos dois, só da área atual. Clicar em Editais ativos ou Editais inativos mostra só esses na tabela, com o chip Situação; clicar de novo, ou no x do chip, volta a mostrar todos. Edital desligado no banco não aparece na tela.
**fonte:** src/lib/editais-do-nucleo.js; src/modulos/editais/painel-operacional.jsx; docs/historias-de-usuario/editais.md
**abrir:** nucleo

## Status e etapa calculados pelo cronograma

**perguntas:** como o status do edital e calculado | status do edital | status calculado | etapa calculada | cronograma pendente | como a etapa do edital e calculada
**resposta:** Com o cálculo automático ligado, o status e a etapa do edital saem das datas do cronograma: antes da primeira etapa, "Planejado" e "Aguardando: …"; durante, "Em andamento" e o nome da etapa atual; depois da última, "Concluído". Sem etapas válidas (ou com o automático desligado), aparece "Cronograma pendente". Ao salvar, vale o calculado; o status excepcional (Suspenso, Cancelado ou Paralisado) é a única forma de contrariar o cálculo, e pede motivo e data da decisão.
**fonte:** src/lib/cronograma-do-edital.js; src/lib/editais-do-nucleo.js

## Status excepcional

**perguntas:** status excepcional | suspenso | paralisado | edital cancelado | como suspender um edital
**resposta:** Status excepcional (Suspenso, Cancelado ou Paralisado) é para quando o cronograma não reflete a situação real do edital. Ele passa por cima do status calculado, exige motivo e data da decisão, e o motivo vai para o histórico do edital.
**fonte:** src/lib/cronograma-do-edital.js

## Validações do cronograma

**perguntas:** validacoes do cronograma | por que o cronograma nao salva | erro no cronograma | etapas sobrepostas
**resposta:** O cronograma não salva com etapa sem atividade ou sem datas, data final antes da inicial, ano fora de 2015 a 2100 ou atividade repetida. Só geram aviso: data fora do ano do edital, falta de etapa de resultado final e etapas sobrepostas. Em edital já cadastrado, mexer no cronograma pede o motivo da alteração, que vai para o histórico; edital novo não pede justificativa (o histórico registra "Cadastro do edital").
**fonte:** src/lib/cronograma-do-edital.js; src/modulos/editais/modal-do-edital.jsx; supabase/migrations/20260928120000_edital_novo_sem_motivo.sql

## Copiar cronograma e preencher em lote

**perguntas:** copiar cronograma | preenchimento em lote | preencher em lote | colar datas do cronograma | modelo padrao do cronograma
**resposta:** "Copiar cronograma" lista os outros editais que já têm etapas e copia só atividades, datas e observações. O preenchimento em lote aceita uma data ou intervalo por linha, na ordem das atividades do modelo padrão (12 etapas, que precisa ser criado antes), nos formatos 17/06/2026, 18/06/2026 a 20/06/2026 ou 18 a 20/06/2026.
**fonte:** src/lib/editais-do-nucleo.js; src/lib/cronograma-do-edital.js

## Anexos do edital em PDF

**perguntas:** anexos do edital | como importar o cronograma e o quadro de vagas do pdf | importar pdf do edital | anexo i | anexo ii | usar no cronograma | salvar quadro de vagas
**resposta:** No formulário do edital, os anexos em PDF (só PDF, até 4 MB, pode escolher mais de um quando cada anexo vem separado) são lidos no servidor sem gravar nada: o Anexo I vira as etapas do cronograma e o Anexo II, o quadro de vagas (em Projetos o quadro vem no Anexo I, sem modalidades). "Usar no cronograma" troca as etapas (pede confirmação se já houver). "Salvar quadro de vagas" grava na hora em edital já cadastrado (confirma antes de substituir o atual); em edital novo, o quadro vai junto no salvar do edital. As datas do PDF vêm sem ano: o ano começa no do edital e avança quando a data volta de dezembro para janeiro.
**fonte:** src/modulos/editais/importar-anexos.jsx; api/anexos-do-edital.py; src/lib/anexos-do-edital.js
**abrir:** nucleo

## Quadro de vagas do edital

**perguntas:** quadro de vagas | quadro de vagas do edital | o que e o quadro de vagas | cadastro reserva no quadro
**resposta:** O quadro de vagas do edital tem uma linha por cargo e lotação, com as vagas por modalidade e o total de vagas imediatas (zero quer dizer só cadastro reserva), vindo do PDF ou digitado. Salvar de novo desativa o quadro anterior. Para ligar uma vaga ao quadro, todas as palavras do cargo precisam estar no nome da vaga (vale o cargo mais específico, a lotação desempata e o texto entre parênteses é ignorado); sem ligação única, a vaga não liga.
**fonte:** supabase/migrations/20260930233000_quadro_de_vagas_do_edital.sql; supabase/migrations/20260930235950_quadro_ignora_parenteses.sql

## Vagas imediatas

**perguntas:** vagas imediatas | de onde vem as vagas imediatas | origem das vagas imediatas | vaga imediata
**resposta:** No MONITORA, as vagas imediatas não se digitam mais à mão (manual) nas Entrevistas: o número digitado lá antes ficou no banco, sem uso. Valem, nesta ordem: o quadro de vagas do edital, cadastrado em Editais; sem ele, a configuração de convocação do edital, em Lista de aprovados › Convocação (o total de vagas imediatas informado por vaga e dividido pelo modelo de cotas; zero quer dizer só cadastro reserva). Quando o quadro só traz o total, a divisão por modalidade sai dessa configuração ou dos percentuais da regra de classificação. A Classificação, a convocação das Entrevistas e a ordem de chamada da lista de aprovados usam essa mesma conta.
**fonte:** src/lib/classificacao/vagas.js; src/lib/classificacao/convocacao-do-edital.js; src/lib/configuracao-de-convocacao.js; supabase/migrations/20261005150000_convocacao_unica_da_entrevista.sql
**abrir:** nucleo

## Mover edital de área

**perguntas:** como mover um edital de area | mover edital de area | trocar a area do edital | edital na area errada
**resposta:** Só o administrador global move um edital para outra área, com motivo obrigatório e confirmação; o banco confere de novo e registra a mudança no histórico. O edital leva junto a lista de aprovados, o cronograma e a convocação. O botão só fica ativo depois de salvar ou descartar as alterações do formulário. Edital novo nasce na área do menu, e unidade de outra área é recusada.
**fonte:** src/modulos/editais/estado.js; supabase/migrations/20260928220000_edital_na_area_certa.sql; src/lib/access-roles.js

## Campos calculados do edital

**perguntas:** campos calculados do edital | por que nao consigo editar inscritos | indicadores do edital no formulario
**resposta:** No formulário do edital, Inscritos, Aptos análise, Cancelados, Eliminados nota, Reprovados análise, Total eliminados, Aprovados análise, Aprovados prova, Entrevistados, Contratados e Vagas ociosas aparecem só para conferência: vêm das cargas do sistema e não se editam ali. A UF é preenchida pela unidade escolhida, e unidade nova digitada fica registrada na área do edital ao salvar.
**fonte:** src/modulos/editais/modal-do-edital.jsx

## Quem pode cadastrar e editar editais

**perguntas:** quem pode editar edital | quem pode cadastrar edital | botao novo edital nao aparece | nao consigo editar o edital | sumiu o lapis do edital | permissao editais
**resposta:** Cadastrar ("Novo edital") e editar (o lápis da linha) é de quem tem nível Editor em Editais ou em Cronograma, em Configurações › Acessos. Com Leitor, a tela mostra a tabela, os indicadores e o "Ver cronograma", sem esses botões. Na linha, o ícone da Lista de aprovados aparece para quem tem Editor em Importação e convocação, e o botão "Conversa" para quem usa as Mensagens. Mover o edital de área é só do administrador global.
**fonte:** src/modulos/editais/nucleo.jsx; src/lib/access-roles.js (canManageEditais, canImportApprovedList, canMoveEditalBetweenAreas)
**abrir:** config:acessos

## Edital que não aparece em Editais

**perguntas:** por que o edital nao aparece em editais | edital sumiu de editais | nao acho o edital | edital nao aparece na tabela de editais
**resposta:** Editais mostra só os editais da área escolhida no menu e, se você está numa coordenação, só os do recorte dela; quem não é administrador global nem recebe do banco editais de outras áreas. Confira também os filtros e o indicador clicado: Editais ativos ou Editais inativos deixam só aquela situação (chip Situação), e clicar de novo no indicador ou no x do chip volta a mostrar todos. Edital desligado no banco não aparece. Se o edital é de outra área, troque a área no menu ou peça a liberação a quem administra os acessos.
**fonte:** src/lib/editais-do-nucleo.js; src/modulos/editais/painel-operacional.jsx; supabase/migrations/20260925181000_recorta_dados_por_area.sql
**abrir:** nucleo
