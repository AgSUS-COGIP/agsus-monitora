# Regras dos Editais

A tela Editais (view `nucleo`): cadastro do edital, cronograma, status calculado, anexos em PDF e
quadro de vagas. Fontes: `src/modulos/editais/`, `src/lib/cronograma-do-edital.js`,
`src/lib/editais-do-nucleo.js`, `src/lib/anexos-do-edital.js`, `api/anexos-do-edital.py` e as
migrations `20260928120000_edital_novo_sem_motivo.sql`, `20260928220000_edital_na_area_certa.sql`,
`20260930233000_quadro_de_vagas_do_edital.sql` e `20260930235950_quadro_ignora_parenteses.sql`.

## Tela de Editais

**perguntas:** tela de editais | tela editais | aba editais | para que serve editais | para que serve a tela de editais | equipe nucleo
**resposta:** Em Editais ficam os editais da área atual: a tabela, os alertas de cronograma e o formulário de cada edital, com cronograma, status, anexos em PDF, quadro de vagas e histórico. Os indicadores do painel (Editais ativos, Em andamento, Sem cronograma, Incompletos, Próximos 7 dias e Excepcionais) filtram a fila ao clicar. Cadastra e edita quem tem nível Editor em Editais ou em Cronograma.
**fonte:** src/modulos/editais/; src/lib/editais-do-nucleo.js; src/lib/access-roles.js
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
**resposta:** Nas Entrevistas, as vagas imediatas de cada vaga seguem esta ordem: primeiro o número digitado na configuração da entrevista (manual), depois o quadro de vagas do edital ("do quadro do edital") e, por último, a lista de vagas imediatas da convocação. Só é gravado como manual o número que a pessoa digitou ou alterou; o que veio do quadro ou da lista continua seguindo a fonte. Na Lista de aprovados, as vagas imediatas são informadas por vaga no modelo de convocação, e zero vira cadastro reserva.
**fonte:** supabase/migrations/20260930233000_quadro_de_vagas_do_edital.sql (obter_entrevistas_do_edital); src/lib/conducao-de-entrevista.js

## Mover edital de área

**perguntas:** como mover um edital de area | mover edital de area | trocar a area do edital | edital na area errada
**resposta:** Só o administrador global move um edital para outra área, com motivo obrigatório e confirmação; o banco confere de novo e registra a mudança no histórico. O edital leva junto a lista de aprovados, o cronograma e a convocação. O botão só fica ativo depois de salvar ou descartar as alterações do formulário. Edital novo nasce na área do menu, e unidade de outra área é recusada.
**fonte:** src/modulos/editais/estado.js; supabase/migrations/20260928220000_edital_na_area_certa.sql; src/lib/access-roles.js

## Campos calculados do edital

**perguntas:** campos calculados do edital | por que nao consigo editar inscritos | indicadores do edital no formulario
**resposta:** No formulário do edital, Inscritos, Aptos análise, Cancelados, Eliminados nota, Reprovados análise, Total eliminados, Aprovados análise, Aprovados prova, Entrevistados, Contratados e Vagas ociosas aparecem só para conferência: vêm das cargas do sistema e não se editam ali. A UF é preenchida pela unidade escolhida, e unidade nova digitada fica registrada na área do edital ao salvar.
**fonte:** src/modulos/editais/modal-do-edital.jsx
