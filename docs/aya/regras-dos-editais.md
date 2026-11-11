# Regras dos Editais

A tela Editais (view `nucleo`): cadastro do edital, cronograma, status calculado, anexos em PDF e
quadro de vagas. Fontes: `src/modulos/editais/`, `src/lib/cronograma-do-edital.ts`,
`src/lib/editais-do-nucleo.ts`, `src/lib/anexos-do-edital.ts`, `api/anexos-do-edital.py` e as
migrations `20260928120000_edital_novo_sem_motivo.sql`, `20260928220000_edital_na_area_certa.sql`,
`20260930233000_quadro_de_vagas_do_edital.sql` e `20260930235950_quadro_ignora_parenteses.sql`.

## Tela de Editais

**perguntas:** tela de editais | tela editais | aba editais | para que serve editais | para que serve a tela de editais | equipe nucleo
**resposta:** Em Editais ficam os editais da área atual: a tabela, os alertas de cronograma e o formulário de cada edital, com cronograma, status, anexos em PDF, quadro de vagas e histórico. Os indicadores do painel (Total de editais, Editais ativos, Editais inativos, Em andamento, Sem cronograma, Incompletos, Próximos 7 dias e Excepcionais) filtram a fila ao clicar; clicar de novo no mesmo indicador tira o filtro. Cadastra e edita quem tem nível Editor em Editais ou em Cronograma.
**fonte:** src/modulos/editais/; src/lib/editais-do-nucleo.ts; src/lib/access-roles.ts
**abrir:** nucleo

## Editais ativos e inativos

**perguntas:** editais ativos | editais inativos | edital inativo | edital ativo | o que e edital inativo | o que e edital ativo | quantos editais ativos | total de editais
**resposta:** Em Editais, edital inativo é o que teve o processo encerrado: status Concluído ou Cancelado — o mesmo sentido do Inativo da Situação do processo nas Análises curriculares. Os demais (Planejado, Em andamento, Suspenso, Paralisado ou sem status) são ativos. Total de editais é a soma dos dois, só da área atual. Clicar em Editais ativos ou Editais inativos mostra só esses na tabela, com o chip Situação; clicar de novo, ou no x do chip, volta a mostrar todos. Edital desligado no banco não aparece na tela.
**fonte:** src/lib/editais-do-nucleo.ts; src/modulos/editais/painel-operacional.tsx; docs/historias-de-usuario/editais.md
**abrir:** nucleo

## Alertas de cronograma na tabela de Editais

**perguntas:** alertas dos editais | etiqueta do edital | cronograma incompleto | proxima etapa em ate 3 dias | proxima etapa em ate 7 dias | situacao excepcional | cronograma regular | indicadores de editais sem numero | nao foi possivel carregar os alertas dos editais
**resposta:** Em Editais, cada linha da tabela leva a etiqueta do seu alerta: Sem cronograma (nenhuma etapa cadastrada), Cronograma incompleto (faltam etapas), Próxima etapa em até 3 dias, Próxima etapa em até 7 dias ou Situação excepcional (registrada à mão). Cronograma regular não leva etiqueta. O indicador Próximos 7 dias soma os de até 3 e até 7 dias. Enquanto o resumo não chega, os indicadores aparecem como cartões cinzas, nunca zerados: zero é sempre um número apurado. "Nenhum edital ativo nesta área" quer dizer que não há edital cadastrado, não que houve falha; "Não foi possível carregar os alertas dos editais" é falha, e o botão "Tentar novamente" pede de novo.
**fonte:** src/lib/editais-do-nucleo.ts; src/modulos/editais/painel-operacional.tsx
**abrir:** nucleo

## Status e etapa calculados pelo cronograma

**perguntas:** como o status do edital e calculado | status do edital | status calculado | etapa calculada | cronograma pendente | como a etapa do edital e calculada
**resposta:** Com o cálculo automático ligado, o status e a etapa do edital saem das datas do cronograma: antes da primeira etapa, "Planejado" e "Aguardando: …"; durante, "Em andamento" e o nome da etapa atual; depois da última, "Concluído". Sem etapas válidas (ou com o automático desligado), aparece "Cronograma pendente". Ao salvar, vale o calculado; o status excepcional (Suspenso, Cancelado ou Paralisado) é a única forma de contrariar o cálculo, e pede motivo e data da decisão.
**fonte:** src/lib/cronograma-do-edital.ts; src/lib/editais-do-nucleo.ts

## Status excepcional

**perguntas:** status excepcional | suspenso | paralisado | edital cancelado | como suspender um edital
**resposta:** Status excepcional (Suspenso, Cancelado ou Paralisado) é para quando o cronograma não reflete a situação real do edital. Ele passa por cima do status calculado, exige motivo e data da decisão, e o motivo vai para o histórico do edital.
**fonte:** src/lib/cronograma-do-edital.ts

## Validações do cronograma

**perguntas:** validacoes do cronograma | por que o cronograma nao salva | erro no cronograma | etapas sobrepostas
**resposta:** O cronograma não salva com etapa sem atividade ou sem datas, data final antes da inicial, ano fora de 2015 a 2100 ou atividade repetida. Só geram aviso: data fora do ano do edital, falta de etapa de resultado final e etapas sobrepostas. Em edital já cadastrado, mexer no cronograma pede o motivo da alteração, que vai para o histórico; edital novo não pede justificativa (o histórico registra "Cadastro do edital").
**fonte:** src/lib/cronograma-do-edital.ts; src/modulos/editais/modal-do-edital.tsx; supabase/migrations/20260928120000_edital_novo_sem_motivo.sql

## Copiar cronograma e preencher em lote

**perguntas:** copiar cronograma | preenchimento em lote | preencher em lote | colar datas do cronograma | modelo padrao do cronograma
**resposta:** "Copiar cronograma" lista os outros editais que já têm etapas e copia só atividades, datas e observações. O preenchimento em lote aceita uma data ou intervalo por linha, na ordem das atividades do modelo padrão (12 etapas, que precisa ser criado antes), nos formatos 17/06/2026, 18/06/2026 a 20/06/2026 ou 18 a 20/06/2026.
**fonte:** src/lib/editais-do-nucleo.ts; src/lib/cronograma-do-edital.ts

## Anexos do edital em PDF

**perguntas:** anexos do edital | como importar o cronograma e o quadro de vagas do pdf | importar pdf do edital | anexo i | anexo ii | usar no cronograma | salvar quadro de vagas
**resposta:** No formulário do edital, os anexos em PDF (só PDF, até 4 MB, pode escolher mais de um quando cada anexo vem separado) são lidos no servidor sem gravar nada: o Anexo I vira as etapas do cronograma e o Anexo II, o quadro de vagas (em Projetos o quadro vem no Anexo I, sem modalidades). "Usar no cronograma" troca as etapas (pede confirmação se já houver). "Salvar quadro de vagas" grava na hora em edital já cadastrado (confirma antes de substituir o atual); em edital novo, o quadro vai junto no salvar do edital. As datas do PDF vêm sem ano: o ano começa no do edital e avança quando a data volta de dezembro para janeiro.
**fonte:** src/modulos/editais/importar-anexos.tsx; api/anexos-do-edital.py; src/lib/anexos-do-edital.ts
**abrir:** nucleo

## Lançar retificação do cronograma (PDF)

**perguntas:** retificação do cronograma | lançar retificação | errata do cronograma | leia-se | onde se lê | retificação do anexo i | aplicar retificação | pdf da retificação
**resposta:** No editor de cronograma de um edital já cadastrado, "Lançar retificação (PDF)" lê o PDF da retificação publicada (1ª, 2ª… Retificação do Cronograma ou do Anexo I) no servidor, sem gravar nada, e compara a tabela do "Leia-se" com o cronograma gravado, etapa a etapa: igual, data muda, etapa nova ou etapa que sumiu. A etapa casada guarda o nome gravado; só as datas mudam. Dá para corrigir as datas, dizer a que etapa gravada uma etapa nova corresponde, deixar uma etapa nova de fora ou manter uma que sumiu. Os avisos da leitura aparecem na linha: duas datas soltas ("24/09 e 07/10") viram o intervalo do menor ao maior, digitação estranha ("05/ a 16/10") é corrigida e etapa sem data precisa ser preenchida. PDF de outro edital é bloqueado. "Aplicar retificação" grava o cronograma com o nome da retificação como número da errata e o SEI e a data da assinatura no motivo, e o histórico registra a errata. Com alterações não salvas no formulário, salve ou descarte antes de aplicar.
**fonte:** src/modulos/editais/lancar-retificacao.tsx; api/anexos-do-edital.py; src/lib/retificacao-do-cronograma.ts
**abrir:** nucleo

## Quadro de vagas do edital

**perguntas:** quadro de vagas | quadro de vagas do edital | o que e o quadro de vagas | cadastro reserva no quadro
**resposta:** O quadro de vagas do edital tem uma linha por cargo e lotação, com as vagas por modalidade e o total de vagas imediatas (zero quer dizer só cadastro reserva), vindo do PDF ou digitado. Salvar de novo desativa o quadro anterior. Para ligar uma vaga ao quadro, todas as palavras do cargo precisam estar no nome da vaga (vale o cargo mais específico, a lotação desempata e o texto entre parênteses é ignorado); sem ligação única, a vaga não liga.
**fonte:** supabase/migrations/20260930233000_quadro_de_vagas_do_edital.sql; supabase/migrations/20260930235950_quadro_ignora_parenteses.sql

## Vagas imediatas

**perguntas:** vagas imediatas | de onde vem as vagas imediatas | origem das vagas imediatas | vaga imediata
**resposta:** No MONITORA, as vagas imediatas não se digitam mais à mão (manual) nas Entrevistas: o número digitado lá antes ficou no banco, sem uso. Valem, nesta ordem: o quadro de vagas do edital, cadastrado em Editais; sem ele, a configuração de convocação do edital, em Lista de aprovados › Convocação (o total de vagas imediatas informado por vaga e dividido pelo modelo de cotas; zero quer dizer só cadastro reserva). Quando o quadro só traz o total, a divisão por modalidade sai dessa configuração ou dos percentuais da regra de classificação. A Classificação, a convocação das Entrevistas e a ordem de chamada da lista de aprovados usam essa mesma conta.
**fonte:** src/lib/classificacao/vagas.ts; src/lib/classificacao/convocacao-do-edital.ts; src/lib/configuracao-de-convocacao.ts; supabase/migrations/20261005150000_convocacao_unica_da_entrevista.sql
**abrir:** nucleo

## Mover edital de área

**perguntas:** como mover um edital de area | mover edital de area | trocar a area do edital | edital na area errada
**resposta:** Só o administrador global move um edital para outra área, com motivo obrigatório e confirmação; o banco confere de novo e registra a mudança no histórico. O edital leva junto a lista de aprovados, o cronograma e a convocação. O botão só fica ativo depois de salvar ou descartar as alterações do formulário. Edital novo nasce na área do menu, e unidade de outra área é recusada.
**fonte:** src/modulos/editais/estado.ts; supabase/migrations/20260928220000_edital_na_area_certa.sql; src/lib/access-roles.ts

## Campos calculados do edital

**perguntas:** campos calculados do edital | por que nao consigo editar inscritos | indicadores do edital no formulario
**resposta:** No formulário do edital, Inscritos, Aptos análise, Cancelados, Eliminados nota, Reprovados análise, Total eliminados, Aprovados análise, Aprovados prova, Entrevistados, Contratados e Vagas ociosas aparecem só para conferência: vêm das cargas do sistema e não se editam ali. A UF é preenchida pela unidade escolhida, e unidade nova digitada fica registrada na área do edital ao salvar.
**fonte:** src/modulos/editais/modal-do-edital.tsx

## Quem pode cadastrar e editar editais

**perguntas:** quem pode editar edital | quem pode cadastrar edital | botao novo edital nao aparece | nao consigo editar o edital | sumiu o lapis do edital | permissao editais
**resposta:** Cadastrar ("Novo edital") e editar (o lápis da linha) é de quem tem nível Editor em Editais ou em Cronograma, em Configurações › Acessos. Com Leitor, a tela mostra a tabela, os indicadores e o "Ver cronograma", sem esses botões. Na linha, o ícone da Lista de aprovados aparece para quem tem Editor em Importação e convocação. Mover o edital de área é só do administrador global.
**fonte:** src/modulos/editais/nucleo.tsx; src/lib/access-roles.ts (canManageEditais, canImportApprovedList, canMoveEditalBetweenAreas)
**abrir:** config:acessos

## Edital que não aparece em Editais

**perguntas:** por que o edital nao aparece em editais | edital sumiu de editais | nao acho o edital | edital nao aparece na tabela de editais
**resposta:** Editais mostra só os editais da área escolhida no menu e, se você está numa coordenação, só os do recorte dela; quem não é administrador global nem recebe do banco editais de outras áreas. Confira também os filtros e o indicador clicado: Editais ativos ou Editais inativos deixam só aquela situação (chip Situação), e clicar de novo no indicador ou no x do chip volta a mostrar todos. Edital desligado no banco não aparece. Se o edital é de outra área, troque a área no menu ou peça a liberação a quem administra os acessos.
**fonte:** src/lib/editais-do-nucleo.ts; src/modulos/editais/painel-operacional.tsx; supabase/migrations/20260925181000_recorta_dados_por_area.sql
**abrir:** nucleo

## Edital de treinamento

**perguntas:** edital de treinamento | treinamento | selo treinamento | edital de teste | como treinar | testar sem dados reais | treinar entrevistas | treinar avaliacao documental | dsei treinamento | treinamento projetos | 992/2099 | 991/2099 | treinamento entrevista projetos | treinamento avaliacao documental saude indigena | apresentar o treinamento | demonstrar o treinamento | edital teste da sede | criar edital de treinamento | onde esta o treinamento | treinamento sumiu
**resposta:** Hoje não há edital de treinamento no MONITORA. Os que existiam — "Treinamento – Saúde Indígena (991/2099)", "Treinamento – Projetos (992/2099)" e o edital "Teste" da SEDE, que tinha sido marcado como treinamento — foram apagados em 04/11/2026, com todos os dados fictícios ligados a eles. O recurso continua no sistema e pode ser usado de novo: um edital marcado como treinamento aparece com o selo Treinamento em Editais, Conduzir entrevistas, Avaliação documental e Classificação, e fica fora da Visão geral, dos indicadores, dos painéis (análises, entrevistas e aprovados), das comemorações, das conferências, dos robôs, do painel dos robôs e do Status das atualizações; documento oficial gerado dele sai com "TREINAMENTO — SEM VALOR OFICIAL" no título. A tela não cria nem marca edital de treinamento: quem cria é a equipe técnica, por uma correção de dados com ensaio, que recria o pacote pronto da Saúde Indígena ou de Projetos (só essas duas áreas: edital fictício com vagas, candidatos sem CPF e com e-mail @exemplo.invalid, a regra da avaliação documental conferida, a triagem, as fichas pendentes e a entrevista com roteiro, banca, convocados e agenda a partir do dia). Se precisar de um para treinar ou apresentar, peça ao suporte.
**fonte:** src/lib/edital-de-treinamento.ts; supabase/migrations/20261007230000_edital_de_treinamento.sql; supabase/migrations/20261009120000_treinamentos_completos.sql; docs/banco-de-dados.md
**abrir:** nucleo

## Reiniciar o edital de treinamento

**perguntas:** reiniciar treinamento | reiniciar o treinamento | reiniciar edital de treinamento | zerar treinamento | voltar o treinamento ao inicio | limpar treinamento | botao reiniciar treinamento sumiu
**resposta:** O botão Reiniciar treinamento (setas circulares) só aparece, em Editais e para o administrador global, na linha de um edital de treinamento; como hoje não há nenhum, ele não aparece. Quando houver um, da Saúde Indígena ou de Projetos: ao clicar, a própria linha pede a confirmação; em Reiniciar, tudo o que foi feito naquele treinamento (convocações, notas, listas geradas, fichas e triagem, decisões de lote, aprovados, recursos) é apagado e os dados fictícios voltam ao estado inicial, com o cronograma e a agenda recalculados a partir de hoje — reinicie no dia da apresentação para a fila "Hoje" de Conduzir entrevistas ter itens. Só edital de treinamento pode ser reiniciado: o banco recusa qualquer edital real, edital de treinamento de outra área e edital com vaga trazida pelo robô da Empregare; nesses casos nada é apagado.
**fonte:** supabase/migrations/20261009120000_treinamentos_completos.sql; src/modulos/editais/nucleo.tsx
**abrir:** nucleo

## Regras do edital

**perguntas:** pagina de regras por etapa | regras por etapa | onde mudo a regra | onde mudo a regra da classificacao | onde mudo a regra da avaliacao documental | onde ficou a provisoria | onde ficou o lote | todas as regras juntas | onde mudo o roteiro e a banca | onde mudo a convocacao do edital | onde configuro a chamada para contratacao | voltar das regras do edital
**resposta:** Em Editais, o botão Regras do edital (lista com marcas) da linha do edital abre, no lugar da tabela, uma página com todas as regras daquele edital, na ordem das etapas: 1 Triagem (requisitos e motivos de eliminação, nota da lista, desempate e formação do lote), 2 Avaliação documental (o que vale, o que elimina, como a experiência é contada e comprovada, no assistente ou no modo avançado), 3 Entrevista (o resumo de quem é chamado, como a nota sai, quem avalia e o desempate e, embaixo, "Roteiro e banca": o roteiro do edital e a banca, com "Editar roteiro e banca" e "Salvar configuração"; os roteiros da área — editar, duplicar, criar — continuam em Conduzir entrevistas › Preparar), 4 Classificação (composição da nota, notas mínimas, desempate — os critérios marcados usam o que a Avaliação documental comprovou —, cotas e convocação para entrevista) e 5 Chamada para contratação (o tipo de convocação, o modelo de regras com a prévia e as vagas imediatas de cada vaga, com "Salvar convocação"). Quem edita cada etapa é quem já editava (coordenação do edital, gestor da Classificação, quem configura a entrevista, quem importa a lista de aprovados, administrador global); os outros veem a regra travada. As telas da Triagem, da Avaliação documental (Configurações › Regras e critérios), de Conduzir entrevistas › Preparar (passos Roteiro e Banca), da Classificação (Regra) e o modal "Listas do edital" da Lista de aprovados (aba Lista de convocação) mostram a regra resumida com "Editar nas Regras do edital", que abre a página já na etapa. O "voltar" do navegador fecha a página e volta à tabela de Editais (trocar de etapa não conta como página nova). Salvar cria versão nova com motivo e não recalcula nada. A Provisória por ART e o lote saíram da regra da Avaliação documental — também do assistente: o corte por pontos mínimos, a base da nota do lote e o desempate da lista ficam só na Triagem.
**fonte:** src/modulos/regras-do-edital/; src/lib/regras-do-edital.ts; src/modulos/entrevistas/editor-da-configuracao.tsx; src/modulos/aprovados/chamada-para-contratacao.tsx
**abrir:** nucleo
