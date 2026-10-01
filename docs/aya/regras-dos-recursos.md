# Regras da aba Recursos

A tela de Recursos mostra só rótulos, números e botões; o porquê das regras
fica aqui, para a Aya explicar. Textos que saíram da tela em 01/10/2026
(subtítulos das pendências, a dica "Aprovar exige a decisão" e os KPIs que
viraram filtro) estão registrados nestes verbetes. Fontes:
`src/modulos/recursos/`, `src/lib/recursos-dos-candidatos.js`,
`src/lib/prazo-do-recurso.js` e as migrations `20260929120000_recursos.sql`,
`20260929230000_recursos_modelos_anexos_respostas.sql`,
`20260929190200_recorte_por_coordenacao_nos_recursos.sql` e
`20261001170000_recursos_parecer_juridico.sql`.

## Tela de Recursos

**perguntas:** tela de recursos | tela recursos | aba recursos | para que serve recursos | para que serve a tela de recursos | recursos dos candidatos
**resposta:** Recursos acompanha os recursos dos candidatos da área atual, do registro à resposta enviada: indicadores, pendências prioritárias, gráficos, a fila e o detalhe de cada recurso (dados, anexos, etapas, parecer e resposta). Leitor vê; Editor registra, anexa, escreve a resposta e envia para o parecer jurídico; quem tem a permissão Parecer jurídico decide. Quem está numa coordenação vê só os recursos dos editais dela. As origens ativas são análise curricular, entrevista e resultado final, e não pode haver dois recursos sem decisão para o mesmo candidato, edital e origem.
**fonte:** src/modulos/recursos/; supabase/migrations/20260929120000_recursos.sql; supabase/migrations/20260929190200_recorte_por_coordenacao_nos_recursos.sql; supabase/migrations/20261001170000_recursos_parecer_juridico.sql
**abrir:** recursos

## Fluxo do parecer jurídico

**perguntas:** parecer juridico | fluxo do recurso | como funciona o fluxo do parecer juridico | fluxo do parecer juridico | em analise juridica | enviar para parecer | situacoes do recurso
**resposta:** No MONITORA, o recurso nasce Registrado: quem edita Recursos cadastra os dados, anexa documentos e escreve o rascunho da resposta, e então o envia para parecer jurídico (Em análise jurídica). Só quem tem a permissão "Parecer jurídico (Recursos)" decide: defere, defere parcialmente ou indefere, sempre com o texto do parecer (10 a 20.000 caracteres), ou devolve para ajuste com um comentário. Quem decidiu, quando e o parecer ficam gravados, e cada passo vai para o histórico do recurso.
**fato:** No MONITORA, o recurso vai de Registrado a Em análise jurídica e só quem tem a permissão Parecer jurídico decide (Deferido, Deferido parcialmente ou Indeferido); o nível Administrador de Recursos não decide.
**fonte:** supabase/migrations/20261001170000_recursos_parecer_juridico.sql; src/lib/recursos-dos-candidatos.js

## Quem pode decidir um recurso

**perguntas:** quem pode decidir um recurso | quem pode decidir o recurso | quem decide o recurso | quem decide um recurso | quem defere o recurso | quem pode deferir | quem pode indeferir | grupo juridico | permissao parecer juridico
**resposta:** Decide o recurso (deferir, deferir parcialmente ou indeferir), devolve para ajuste e reabre a decisão só quem tem a permissão "Parecer jurídico (Recursos)", que tem dois níveis: Sem acesso ou Editor. Ela é dada por grupo ou individualmente em Configurações › Acessos. O grupo Jurídico já vem com ela (e com Editor em Recursos), e o grupo do administrador global também; os outros grupos não. O nível Administrador em Recursos não decide: serve para manter os modelos de resposta. O banco recusa qualquer mudança de situação ou parecer feita sem a permissão.
**fonte:** supabase/migrations/20261001170000_recursos_parecer_juridico.sql; src/lib/permissoes-recursos.js
**abrir:** config:acessos

## Aguardando parecer

**perguntas:** aguardando parecer | o que é aguardando parecer | kpi aguardando parecer
**resposta:** No MONITORA, "Aguardando parecer" conta os recursos Em análise jurídica: já enviados ao jurídico e ainda sem decisão. Clicar no indicador filtra a tela por eles. Quem não tem o parecer jurídico vê "Aguardando parecer jurídico" no lugar dos botões de decisão.
**fonte:** src/modulos/recursos/paineis.jsx; src/lib/recursos-dos-candidatos.js

## Deferido parcialmente

**perguntas:** deferido parcialmente | parcialmente indeferido | deferidos inclui parcialmente
**resposta:** No MONITORA, "Deferido parcialmente" é o mesmo que "parcialmente indeferido" (o código no banco continua PARCIALMENTE_INDEFERIDO, usado pelos modelos de resposta). O indicador "Deferidos" soma os deferidos e os deferidos parcialmente.
**fonte:** supabase/migrations/20261001170000_recursos_parecer_juridico.sql

## Devolvido para ajuste

**perguntas:** devolvido para ajuste | recurso devolvido | devolvidos pelo juridico
**resposta:** No MONITORA, o jurídico pode devolver um recurso Em análise jurídica para ajuste, dizendo o que falta (3 a 2.000 caracteres). Ele volta a Registrado, com o comentário em destaque no detalhe, e aparece na pendência "Devolvidos pelo jurídico" até ser reenviado.
**fonte:** supabase/migrations/20261001170000_recursos_parecer_juridico.sql

## Reabrir a decisão

**perguntas:** reabrir decisão | desfazer decisão do recurso | mudar a decisão do recurso
**resposta:** No MONITORA, só o jurídico reabre uma decisão, com motivo, e só enquanto a resposta não foi enviada ao candidato. O recurso volta a Em análise jurídica; o parecer anterior continua no histórico.
**fonte:** supabase/migrations/20261001170000_recursos_parecer_juridico.sql

## Resposta ao candidato e parecer

**perguntas:** aprovar resposta do recurso | publicar resposta do recurso | aprovar exige a decisão | quem marca a resposta como enviada | marcar resposta enviada | resposta enviada ao candidato
**resposta:** No MONITORA, quem edita escreve o rascunho da resposta e pode enviá-lo para revisão; aprovar ou devolver o texto da resposta é do parecer jurídico, e aprovar exige o recurso decidido e um modelo da mesma situação da decisão (quem escreveu ou enviou para revisão não aprova). Marcar a resposta como enviada ao candidato é de quem edita, só com a resposta aprovada e o recurso decidido: isso marca a etapa "Resposta enviada ao candidato" com o nome de quem marcou e a hora. Depois disso a decisão não reabre.
**fonte:** supabase/migrations/20261001170000_recursos_parecer_juridico.sql (transicionar_resposta_recurso, marcar_etapa_recurso)

## Prazo do recurso

**perguntas:** de onde vem o prazo do recurso | prazo do recurso | prazo estimado | prazo vencido
**resposta:** O prazo do recurso vem do cronograma do edital: é o fim da atividade de resposta aos recursos daquela origem (análise curricular, entrevista ou resultado final); havendo mais de uma, vale a mais tardia. Sem atividade de resposta, usa o fim do prazo de abertura dos recursos (o prazo estimado, com asterisco). Sem nenhuma das duas, entra a pendência "Prazo não encontrado no cronograma". "Prazo vencido" é o recurso sem resposta enviada com o prazo já passado; "vencendo" é o que vence hoje ou nos próximos dois dias.
**fonte:** src/lib/prazo-do-recurso.js; src/lib/recursos-dos-candidatos.js

## Indicadores da aba Recursos

**perguntas:** indicadores dos recursos | quais sao os indicadores dos recursos | kpis dos recursos | onde está o total de recursos | taxa de conclusão dos recursos | sem processo sei
**resposta:** No MONITORA, a aba Recursos tem quatro indicadores: Aguardando parecer, Prazo vencido, Deferidos (com os parcialmente) e Indeferidos; cada um filtra a tela. O total está na contagem da fila; a taxa de decisão, no recorte ("% decididos"); sem processo SEI, sem resposta, respostas em revisão, aprovadas ou devolvidas, mudança de nota, prazo vencendo e registrados sem envio estão nas Pendências prioritárias e nos gráficos.
**fonte:** src/modulos/recursos/paineis.jsx; src/lib/recursos-dos-candidatos.js

## Pendências da aba Recursos

**perguntas:** pendências dos recursos | prazo não encontrado no cronograma | candidato fora das análises | mudança de nota ou classificação | nota mudou
**resposta:** No MONITORA, "Prazo não encontrado no cronograma" quer dizer que o cronograma do edital não traz o prazo de recurso daquela origem; "Candidato fora das análises" é o recurso cadastrado com os dados digitados, que vale conferir; "Mudança de nota ou classificação" junta a nota mudou (a nota atual da análise difere da guardada no cadastro do recurso) e a classificação marcada, para conferir no resultado final; "Prazo vence em até 2 dias" é o recurso sem resposta cujo prazo vence hoje ou nos próximos dois dias; "Devolvidos pelo jurídico" são os que voltaram para ajuste.
**fonte:** src/lib/recursos-dos-candidatos.js; supabase/migrations/20260929120000_recursos.sql

## Anexos e modelos de resposta

**perguntas:** anexos do recurso | arquivar anexo | modelos de resposta | versao do modelo de resposta | fundamentacao
**resposta:** Os anexos do recurso (pdf, docx, doc, jpg, png ou odt, até 20 MB) não se apagam: arquivar exige motivo (3 a 500 caracteres) e o arquivo continua guardado; todo download fica registrado. Os modelos de resposta são mantidos por quem tem Administrador em Recursos: editar grava uma versão nova, e cada resposta guarda a versão usada. O texto da fundamentação entra no lugar marcado {fundamentacao}, e campo sem valor aparece como "[não informado: …]".
**fonte:** supabase/migrations/20260929230000_recursos_modelos_anexos_respostas.sql
