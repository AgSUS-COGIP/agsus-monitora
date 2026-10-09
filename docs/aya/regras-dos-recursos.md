# Regras dos Recursos

Duas entradas do menu: o Painel de recursos (view `recursos`, acompanhar, só leitura) e Analisar
recursos (view `analisar-recursos`, fazer: registrar, enviar ao parecer, decidir, responder e
ajustar a pontuação), separadas em 09/10/2026
(`20261009230000_analisar_recursos_no_menu.sql`).

As telas de Recursos mostram só rótulos, números e botões; o porquê das regras
fica aqui, para a Aya explicar. Textos que saíram da tela em 01/10/2026
(subtítulos das pendências, a dica "Aprovar exige a decisão" e os KPIs que
viraram filtro) estão registrados nestes verbetes. Fontes:
`src/modulos/recursos/`, `src/lib/recursos-dos-candidatos.ts`,
`src/lib/prazo-do-recurso.ts` e as migrations `20260929120000_recursos.sql`,
`20260929230000_recursos_modelos_anexos_respostas.sql`,
`20260929190200_recorte_por_coordenacao_nos_recursos.sql` e
`20261001170000_recursos_parecer_juridico.sql` e
`20261005130000_recurso_ajusta_pontuacao.sql` (ajuste da pontuação).

## Painel de recursos

**perguntas:** painel de recursos | tela de recursos | tela recursos | aba recursos | para que serve recursos | para que serve a tela de recursos | para que serve o painel de recursos | recursos dos candidatos | acompanhar os recursos
**resposta:** O Painel de recursos é para acompanhar os recursos dos candidatos da área atual, do registro à resposta enviada: os filtros, os quatro indicadores, o recorte, os gráficos, as pendências prioritárias, a fila e a exportação em CSV. Só leitura: clicar num recurso abre o detalhe para ler (dados, parecer, ajuste, etapas, resposta, anexos e histórico), sem nenhum botão de ação. Fazer é em Analisar recursos, outra entrada do menu: quem pode analisar tem no topo "Analisar", que abre Analisar recursos com os mesmos filtros, e, no detalhe, "Analisar este recurso", que abre o mesmo recurso lá. Quem tem Leitor em Recursos vê só o painel. Quem está numa coordenação vê só os recursos dos editais dela.
**fato:** O Painel de recursos acompanha (só leitura); Analisar recursos faz (registrar, enviar ao parecer, decidir, responder, ajustar a pontuação). As duas usam o recurso Recursos.
**fonte:** src/modulos/recursos/recursos.tsx; supabase/migrations/20261009230000_analisar_recursos_no_menu.sql; supabase/migrations/20260929190200_recorte_por_coordenacao_nos_recursos.sql
**abrir:** recursos

## Analisar recursos

**perguntas:** analisar recursos | analisar um recurso | onde analiso o recurso | onde decido o recurso | onde fica a fila de recursos para analisar | painel ou analisar recursos | diferença entre painel de recursos e analisar recursos | nao vejo analisar recursos
**resposta:** Analisar recursos é a tela de fazer, com entrada própria no menu (selo BETA). Tem no topo Atualizar, "Ver no painel" (volta ao Painel de recursos com os mesmos filtros), Modelos de resposta (para o Administrador de Recursos) e Novo recurso (para quem tem Editor em Recursos); embaixo, os filtros e a fila. "Abrir" (ou clicar na linha) abre a gaveta do recurso com as ações: editar e excluir, marcar as etapas, enviar para o parecer jurídico, decidir (deferir, deferir parcialmente, indeferir, devolver, reabrir), o ajuste da pontuação, a resposta ao candidato e os anexos. Vê a entrada quem tem Editor em Recursos ou a permissão "Parecer jurídico (Recursos)"; quem só tem Leitor fica com o Painel de recursos. O banco confere cada ação. As origens ativas são análise curricular, entrevista e resultado final; um segundo recurso sem decisão para o mesmo candidato, edital e origem gera um aviso e só é gravado com confirmação.
**fato:** Analisar recursos aparece para quem tem Editor em Recursos ou o Parecer jurídico; o Painel de recursos, para todo mundo que vê Recursos.
**fonte:** src/modulos/recursos/recursos.tsx; src/lib/access-roles.js (canAnalisarRecursos); supabase/migrations/20261009230000_analisar_recursos_no_menu.sql; supabase/migrations/20261001170000_recursos_parecer_juridico.sql
**abrir:** analisar-recursos

## Fluxo do parecer jurídico

**perguntas:** parecer juridico | fluxo do recurso | como funciona o fluxo do parecer juridico | fluxo do parecer juridico | em analise juridica | enviar para parecer | situacoes do recurso
**resposta:** No MONITORA, o recurso nasce Registrado: quem edita Recursos cadastra os dados, anexa documentos e escreve o rascunho da resposta, e então o envia para parecer jurídico (Em análise jurídica). Só quem tem a permissão "Parecer jurídico (Recursos)" decide: defere, defere parcialmente ou indefere, sempre com o texto do parecer (10 a 20.000 caracteres), ou devolve para ajuste com um comentário. Quem decidiu, quando e o parecer ficam gravados, e cada passo vai para o histórico do recurso.
**fato:** No MONITORA, o recurso vai de Registrado a Em análise jurídica e só quem tem a permissão Parecer jurídico decide (Deferido, Deferido parcialmente ou Indeferido); o nível Administrador de Recursos não decide.
**fonte:** supabase/migrations/20261001170000_recursos_parecer_juridico.sql; src/lib/recursos-dos-candidatos.ts

## Quem pode decidir um recurso

**perguntas:** quem pode decidir um recurso | quem pode decidir o recurso | quem decide o recurso | quem decide um recurso | quem defere o recurso | quem pode deferir | quem pode indeferir | grupo juridico | permissao parecer juridico
**resposta:** Decide o recurso (deferir, deferir parcialmente ou indeferir), devolve para ajuste e reabre a decisão só quem tem a permissão "Parecer jurídico (Recursos)", que tem dois níveis: Sem acesso ou Editor. Ela é dada por grupo ou individualmente em Configurações › Acessos. O grupo Jurídico já vem com ela (e com Editor em Recursos), e o grupo do administrador global também; os outros grupos não. O nível Administrador em Recursos não decide: serve para manter os modelos de resposta. O banco recusa qualquer mudança de situação ou parecer feita sem a permissão.
**fonte:** supabase/migrations/20261001170000_recursos_parecer_juridico.sql; src/lib/permissoes-recursos.js
**abrir:** config:acessos

## Aguardando parecer

**perguntas:** aguardando parecer | o que é aguardando parecer | kpi aguardando parecer
**resposta:** No MONITORA, "Aguardando parecer" conta os recursos Em análise jurídica: já enviados ao jurídico e ainda sem decisão. Clicar no indicador filtra a tela por eles. No detalhe, quem não tem o parecer jurídico (e todos no Painel de recursos) vê "Aguardando parecer jurídico" no lugar dos botões de decisão.
**fonte:** src/modulos/recursos/paineis.tsx; src/lib/recursos-dos-candidatos.ts

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
**fonte:** src/lib/prazo-do-recurso.ts; src/lib/recursos-dos-candidatos.ts

## Indicadores do Painel de recursos

**perguntas:** indicadores dos recursos | quais sao os indicadores dos recursos | kpis dos recursos | onde está o total de recursos | taxa de conclusão dos recursos | sem processo sei
**resposta:** No MONITORA, o Painel de recursos tem quatro indicadores: Aguardando parecer, Prazo vencido, Deferidos (com os parcialmente) e Indeferidos; cada um filtra a tela. O total está na contagem da fila; a taxa de decisão, no recorte ("% decididos"); sem processo SEI, sem resposta, respostas em revisão, aprovadas ou devolvidas, mudança de nota, prazo vencendo e registrados sem envio estão nas Pendências prioritárias e nos gráficos.
**fonte:** src/modulos/recursos/paineis.tsx; src/lib/recursos-dos-candidatos.ts

## Pendências do Painel de recursos

**perguntas:** pendências dos recursos | prazo não encontrado no cronograma | candidato fora das análises | mudança de nota ou classificação | nota mudou
**resposta:** No MONITORA, "Prazo não encontrado no cronograma" quer dizer que o cronograma do edital não traz o prazo de recurso daquela origem; "Candidato fora das análises" é o recurso cadastrado com os dados digitados, que vale conferir; "Mudança de nota ou classificação" junta a nota mudou (a nota atual da análise difere da guardada no cadastro do recurso) e a classificação mudada pelo ajuste da pontuação aprovado, para conferir no resultado final; "Prazo vence em até 2 dias" é o recurso sem resposta cujo prazo vence hoje ou nos próximos dois dias; "Devolvidos pelo jurídico" são os que voltaram para ajuste.
**fonte:** src/lib/recursos-dos-candidatos.ts; supabase/migrations/20260929120000_recursos.sql

## Anexos e modelos de resposta

**perguntas:** anexos do recurso | arquivar anexo | modelos de resposta | versao do modelo de resposta | fundamentacao
**resposta:** Os anexos do recurso (pdf, docx, doc, jpg, png ou odt, até 20 MB) não se apagam: arquivar exige motivo (3 a 500 caracteres) e o arquivo continua guardado; todo download fica registrado. Os modelos de resposta são mantidos por quem tem Administrador em Recursos: editar grava uma versão nova, e cada resposta guarda a versão usada. O texto da fundamentação entra no lugar marcado {fundamentacao}, e campo sem valor aparece como "[não informado: …]".
**fonte:** supabase/migrations/20260929230000_recursos_modelos_anexos_respostas.sql

## Ajuste da pontuação no recurso

**perguntas:** ajuste da pontuacao | ajustar a pontuacao do candidato | mudar a pontuacao no recurso | mudar a nota no recurso | em recurso posso mudar a classificacao | como mudar a classificacao pelo recurso | alterar a nota do candidato no recurso | corrigir a nota do candidato
**resposta:** Sim. Em Analisar recursos, no recurso deferido (total ou parcialmente), a seção "Ajuste da pontuação" da gaveta mostra os componentes da nota que a regra de classificação do edital tem — pertencimento étnico, formação, cursos, experiência, nota documental, entrevista ou cada competência, ART — com o valor atual (da análise ou da entrevista) e um campo para o novo valor e a justificativa; a nota documental (e a da entrevista, quando há competências) é a soma das diferenças. Escreva a justificativa geral ou a de cada componente alterado. Antes de confirmar, a prévia mostra a nova nota, a nova posição do candidato e quem muda de lugar por causa dele, calculadas pelo motor da Classificação na lista da etapa do recurso (documental, entrevista ou resultado final). Propor é de quem decide o recurso (Parecer jurídico); pode-se propor já em análise jurídica. A nota da planilha nunca é sobrescrita: cada proposta é uma versão guardada com quem propôs, quando e os valores antes e depois.
**fato:** No MONITORA, o ajuste da pontuação do recurso deferido fica em tabela própria, em versões (proposto, aprovado, cancelado); a nota da análise curricular nunca é sobrescrita e só o ajuste aprovado vale na Classificação.
**fonte:** src/modulos/recursos/ajuste.jsx; src/lib/classificacao/ajustes.js; supabase/migrations/20261005130000_recurso_ajusta_pontuacao.sql
**abrir:** analisar-recursos

## Aprovar ou cancelar o ajuste da pontuação

**perguntas:** aprovar o ajuste da pontuacao | quem aprova o ajuste | ajuste proposto | ajuste aprovado | cancelar o ajuste da pontuacao | previa do ajuste | reabrir cancela o ajuste
**resposta:** No MONITORA, o ajuste proposto ainda não vale. Aprova quem aprova a resposta hoje (Parecer jurídico) e só com o recurso deferido, total ou parcialmente: ao aprovar, a prévia é recalculada com os dados de agora e gravada junto, e o ajuste passa a valer na Classificação (o aprovado anterior do mesmo recurso, se houver, fica como versão cancelada). Cancelar pede motivo. Reabrir a decisão, indeferir, devolver para ajuste ou excluir o recurso cancela o ajuste proposto e o aprovado automaticamente, e tudo fica no histórico do recurso.
**fonte:** supabase/migrations/20261005130000_recurso_ajusta_pontuacao.sql
**abrir:** analisar-recursos

## O recurso mudou a classificação

**perguntas:** o recurso mudou a classificacao | caixa mudou a classificacao | classificacao mudou | marcar que mudou a classificacao
**resposta:** No MONITORA, "O recurso mudou a classificação" deixou de ser uma caixa marcada à mão: é marcada automaticamente quando o ajuste da pontuação aprovado muda a posição ou a situação do candidato (pela prévia calculada na aprovação) e desmarcada quando esse ajuste é cancelado. Os recursos marcados à mão antes dessa mudança continuam como estavam. A marca alimenta a pendência "Mudança de nota ou classificação", o filtro e o CSV.
**fonte:** supabase/migrations/20261005130000_recurso_ajusta_pontuacao.sql; src/lib/recursos-dos-candidatos.ts
**abrir:** recursos

## Registrar um recurso

**perguntas:** como registrar um recurso | novo recurso | cadastrar recurso | lancar recurso | registrar recurso do candidato | candidato nao encontrado no recurso
**resposta:** Em Analisar recursos, "Novo recurso" (para quem tem Editor em Recursos) abre o cadastro: escolha o edital (só os da área atual), a origem e o candidato, buscado nas análises curriculares daquele edital; cargo, vaga, código, nota atual e resultado vêm sozinhos, e o analista vem preenchido com o responsável pela análise. "Não encontrei o candidato" permite digitar o nome, e o recurso fica marcado como fora das análises. O recurso nasce Registrado; depois, anexe os documentos, escreva a resposta e envie para o parecer jurídico. Na edição, edital e candidato não mudam: para isso, exclua e cadastre de novo.
**fonte:** src/modulos/recursos/formulario.tsx; supabase/migrations/20261001170000_recursos_parecer_juridico.sql
**abrir:** analisar-recursos

## Ajuste da pontuação que não aparece

**perguntas:** ajuste da pontuacao nao aparece | por que nao vejo o ajuste da pontuacao | nao consigo ajustar a nota no recurso | sumiu o ajuste da pontuacao
**resposta:** A seção "Ajuste da pontuação" da gaveta (em Analisar recursos; no Painel de recursos, só para ler) só aparece quando o recurso é de um candidato das análises (recurso "fora das análises" não tem) e o edital tem regra de classificação salva. Propor é de quem tem a permissão "Parecer jurídico (Recursos)", com o recurso em análise jurídica ou já deferido (total ou parcialmente); quem não pode propor só vê a seção se já houver versões do ajuste. Indeferir, devolver, reabrir ou excluir o recurso cancela o ajuste.
**fonte:** src/modulos/recursos/ajuste.jsx; supabase/migrations/20261005130000_recurso_ajusta_pontuacao.sql
**abrir:** analisar-recursos
