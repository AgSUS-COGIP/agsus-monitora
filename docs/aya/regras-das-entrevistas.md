# Regras das Entrevistas

Duas entradas do menu: o Painel de entrevistas (view `entrevistas`, acompanhar) e Conduzir
entrevistas (view `conduzir-entrevistas`, fazer: fila do dia, ficha de notas e Preparar, com a
configuração, a convocação e os roteiros). Fontes: `src/modulos/entrevistas/`, `src/lib/conducao-de-entrevista.js`,
`src/lib/roteiro-de-entrevista.js`, `src/lib/entrevistas-do-painel.js`,
`src/lib/convocacao-da-entrevista.js`, `docs/sincronizacao-das-planilhas.md`,
`.github/workflows/sincronizar-entrevistas.yml` e as migrations `20260929235000_entrevistas.sql`,
`20260930220000_entrevistas_roteiros_e_notas.sql`, `20260930235000_janela_da_entrevista.sql` e
`20261005150000_convocacao_unica_da_entrevista.sql` (a convocação é a lista da Classificação); a
agenda das entrevistas, em
`src/modulos/classificacao/agenda.jsx`, `src/modulos/entrevistas/fila-do-dia.tsx`,
`src/lib/agenda-das-entrevistas.js` e `20261005120000_agenda_das_entrevistas.sql`; a separação em
duas entradas, em `src/modulos/entrevistas/conduzir.tsx`, `src/lib/fila-de-conducao.ts`,
`src/lib/painel-de-entrevistas.ts` e `20261008130000_conduzir_entrevistas_no_menu.sql`.

## Painel de entrevistas

**perguntas:** painel de entrevistas | tela de entrevistas | tela entrevistas | aba entrevistas | para que serve entrevistas | para que serve a tela de entrevistas | para que serve o painel de entrevistas | onde acompanho as entrevistas | entrevistas resultados
**resposta:** O Painel de entrevistas é para acompanhar (gestão e coordenação), como o Painel das análises ao lado da Avaliação documental; fazer é em Conduzir entrevistas, outra entrada do menu. O painel mostra, da área atual: os indicadores, o andamento por edital e por vaga em cartões (convocados, entrevistados, faltaram, aptos, inaptos e sem parecer, com a barra), a agenda dos próximos dias quando há um edital escolhido, os gráficos, as pendências (sem comparecimento, sem nota, sem parecer, aprovados sem entrevista, sem análise, sem edital e nota divergente), os empatados na nota da entrevista, a tabela e a exportação em CSV. Só leitura. O edital de treinamento não entra no painel. Quem tem Leitor em Entrevistas vê o painel e Conduzir entrevistas; escrever exige Editor.
**fato:** O Painel de entrevistas acompanha; Conduzir entrevistas faz (fila do dia, ficha de notas, Preparar e roteiros). As duas usam o recurso Entrevistas.
**fonte:** src/modulos/entrevistas/entrevistas.jsx; src/modulos/entrevistas/andamento.tsx; src/lib/painel-de-entrevistas.ts
**abrir:** entrevistas

## Conduzir entrevistas

**perguntas:** conduzir entrevistas | para que serve conduzir entrevistas | fila do dia | fila de conduzir entrevistas | como funciona a fila de conduzir entrevistas | quem entrevisto hoje | 7 de 12 hoje | contador do dia | hoje proximos todos
**resposta:** Conduzir entrevistas é a tela de fazer (secretaria e avaliadores), com entrada própria no menu. Escolha o edital (abre sozinho o último aberto na área ou, se houver um só, ele). A Fila abre em Hoje: os convocados com horário hoje na agenda salva na Classificação, em cartões com as iniciais, o horário, a banca e a situação — Aguardando (cinza), Em andamento (azul), Concluída (verde) e Faltou (amarelo), as cores da Avaliação documental. Sem entrevista hoje, abre em Próximos; sem agenda, em Todos. Dá para trocar entre Hoje, Próximos e Todos, escolher a vaga e clicar numa situação para filtrar. O topo mostra "X de Y hoje" (concluídas e faltas entre as de hoje). Clicar no cartão abre a ficha de notas em tela cheia; "Salvar e abrir o próximo" segue a ordem da fila. Ao concluir todas as de hoje, há uma comemoração (se as comemorações estiverem ligadas). Preparar, no topo, tem a configuração, a convocação e os roteiros.
**fato:** A fila de Conduzir entrevistas abre em Hoje, pela agenda salva na Classificação; concluída é quem tem parecer ou todas as notas, faltou é quem tem Faltou marcado.
**fonte:** src/modulos/entrevistas/conduzir.tsx; src/modulos/entrevistas/fila-do-dia.tsx; src/lib/fila-de-conducao.ts
**abrir:** conduzir-entrevistas

## Preparar o edital

**perguntas:** preparar | preparar edital | onde configuro a entrevista | onde convoco | configuracao da entrevista | onde ficou o passo 1 | onde ficou a convocacao
**resposta:** Em Conduzir entrevistas › Preparar ficam a configuração do edital (roteiro, modo de lançamento, composição e membros da banca, e, só para ler, a regra de convocação, o desempate e as vagas da Classificação) e a convocação (a lista de convocação da Classificação, por vaga). Abaixo, os roteiros de entrevista da área. Quem não tem Editor vê tudo, sem os botões. Edital ainda não configurado mostra o aviso na Fila, com o atalho para Preparar.
**fonte:** src/modulos/entrevistas/conducao.jsx; src/modulos/entrevistas/conduzir.tsx
**abrir:** conduzir-entrevistas

## Andamento por vaga no painel

**perguntas:** andamento por vaga | como e contado o andamento por vaga | barra de andamento | percentual feito | cartoes por vaga | andamento do edital
**resposta:** No Painel de entrevistas, cada cartão (de edital ou, com um edital escolhido, de vaga) mostra o percentual feito e uma barra: verde apto, vermelho inapto, amarelo faltou, azul em andamento (compareceu, sem parecer) e o fundo cinza é quem aguarda. Feito é apto, inapto ou faltou. Os números são convocados (todas as entrevistas do recorte), entrevistados (compareceram), faltaram, aptos, inaptos e sem parecer. Clicar num edital mostra as vagas dele; clicar numa vaga recorta o painel por ela (de novo, tira).
**fonte:** src/lib/painel-de-entrevistas.ts; src/modulos/entrevistas/andamento.tsx
**abrir:** entrevistas

## Empate na nota da entrevista

**perguntas:** empate na entrevista | quem desempata a nota da entrevista | candidatos empatados | desempate da entrevista | criterios de desempate do roteiro | onde mudo o desempate
**resposta:** Empate é quando dois ou mais candidatos do mesmo edital e da mesma vaga têm a mesma nota na entrevista. O Painel de entrevistas marca esses candidatos com o selo "Empate" e avisa: o desempate é feito na Classificação, pelos critérios da regra de classificação do edital (Classificação › Regra), com o botão que abre a Classificação no edital. O roteiro não tem mais critérios de desempate próprios: no editor do roteiro e em Preparar, os critérios aparecem só para ler, os da regra de classificação, com "Editar na Classificação". O texto antigo do roteiro continua guardado, sem uso.
**fato:** O desempate da entrevista é o da regra de classificação do edital, feito na Classificação.
**fonte:** src/lib/painel-de-entrevistas.ts; src/lib/convocacao-da-entrevista.js; supabase/migrations/20261008130000_conduzir_entrevistas_no_menu.sql
**abrir:** classificacao

## Janela da entrevista

**perguntas:** como funciona a janela da entrevista | janela da entrevista | janela do cronograma da entrevista | 7 dias antes | 15 dias depois
**resposta:** Em Conduzir entrevistas, cada edital tem uma janela: começa 7 dias antes da data de início mais antiga das etapas de entrevista do cronograma e termina 15 dias depois da data de fim mais tardia (sem data de fim, vale a de início). Conta como etapa de entrevista toda atividade cujo nome tenha "entrevista" ou "comportamental". O dia de hoje é o de Brasília, e os dois extremos contam. O edital aparece na lista se estiver na janela, se tiver uma liberação vigente ou se tiver convocado ainda sem parecer.
**fato:** Conduzir entrevistas mostra o edital de 7 dias antes a 15 dias depois das etapas de entrevista do cronograma, quando liberado pelo administrador global ou quando há convocado sem parecer.
**fonte:** supabase/migrations/20260930235000_janela_da_entrevista.sql

## Edital que não aparece em Conduzir entrevistas

**perguntas:** por que um edital nao aparece em conduzir entrevistas | por que o edital nao aparece em conduzir entrevistas | edital nao aparece em conduzir entrevistas | nenhum edital na janela da entrevista | edital sumiu de conduzir entrevistas
**resposta:** Um edital fica fora de Conduzir entrevistas quando: o cronograma não tem atividade com "entrevista" ou "comportamental" (aparece "sem etapa de entrevista no cronograma"); hoje está fora da janela (antes de 7 dias do início ou depois de 15 dias do fim das etapas de entrevista); não há liberação vigente (nunca liberado, vencida ou encerrada); e não há convocado sem parecer. Também some se o edital é de outra área, está inativo ou fica fora do recorte da sua coordenação, ou se você não tem acesso a Entrevistas ou à área. Ter entrevistas no Painel de entrevistas não faz o edital entrar. Para incluir um edital fora da janela, peça ao administrador global que o libere; ele também tem a caixa "Mostrar todos os editais da área".
**fonte:** supabase/migrations/20260930235000_janela_da_entrevista.sql; src/lib/conducao-de-entrevista.js
**abrir:** entrevistas

## Liberar edital fora da janela

**perguntas:** como liberar um edital fora da janela | liberar edital fora da janela | liberacao fora da janela | encerrar liberacao | mostrar todos os editais da area
**resposta:** Só o administrador global libera um edital fora da janela: em Conduzir entrevistas, escolhe o edital e preenche "Liberar até" (de hoje até no máximo 180 dias) e o Motivo (3 a 500 caracteres). A liberação vence sozinha depois da data e pode ser encerrada antes, também com motivo. Só existe uma liberação vigente por edital; a anterior fica guardada no histórico. A caixa "Mostrar todos os editais da área" também é só do administrador global e traz todos os editais ativos da área, ignorando a janela.
**fonte:** supabase/migrations/20260930235000_janela_da_entrevista.sql; src/modulos/entrevistas/conducao.jsx

## Roteiros e versões

**perguntas:** como funcionam as versoes dos roteiros | roteiro de entrevista | roteiros de entrevista | versao do roteiro | o que e um roteiro | onde ficam os roteiros de entrevista | onde ficou roteiros | onde edito o roteiro
**resposta:** Os roteiros ficam em Conduzir entrevistas › Preparar, na configuração do gestor (ao lado da configuração do edital, como a Regra fica na Avaliação documental). O roteiro é um modelo reutilizável da entrevista: competências (1 a 20, cada uma com nota máxima, peso e mínimo), escala, regra de aprovação e banca padrão; serve a vários editais. O desempate não é do roteiro: é o da regra de classificação do edital, mostrado só para ler. Quem é convocado sai da lista de convocação da Classificação. Editar grava uma versão nova: os editais que já usam a anterior continuam nela, e a nova vale para as próximas configurações. "Duplicar" cria um roteiro novo, na versão 1. Roteiro sem área serve para qualquer área.
**fonte:** supabase/migrations/20260930220000_entrevistas_roteiros_e_notas.sql; src/lib/roteiro-de-entrevista.js; src/modulos/entrevistas/roteiros.jsx
**abrir:** conduzir-entrevistas

## Escalas e aprovação na entrevista

**perguntas:** escala do roteiro | escala faixa | escala lista | escala niveis | notas eliminatorias | quando o candidato e apto | como o candidato fica apto
**resposta:** A escala do roteiro pode ser FAIXA (de 0 até a nota máxima, de passo em passo; passo até 5, padrão 0,5), LISTA (só as notas cadastradas) ou NIVEIS (níveis com nome e descrição). O candidato fica APTO quando compareceu, todas as competências têm nota, o total chega ao mínimo total, cada competência chega ao seu mínimo e nenhuma média é eliminatória (se a média da banca numa competência for uma das notas eliminatórias, ele fica INAPTO). Faltou e o roteiro diz que ausência elimina: INAPTO. Falta nota ou comparecimento: SEM_PARECER. A nota da competência é a média dos avaliadores vezes o peso.
**fonte:** supabase/migrations/20260930220000_entrevistas_roteiros_e_notas.sql; src/lib/roteiro-de-entrevista.js

## Aspectos da entrevista e como a nota é calculada

**perguntas:** aspectos da entrevista | conceitua propriedade profundidade | como a nota da entrevista e calculada | como e calculada a nota da entrevista com aspectos | nota do avaliador | media dos aspectos | por que deu 1,11 | arredondamento da nota da entrevista
**resposta:** O roteiro pode ter aspectos (opcionais; até 10), configurados na edição do roteiro — o botão "Conceitua · Propriedade · Profundidade" preenche o modelo da Saúde Indígena. Com aspectos, cada avaliador dá uma nota em cada aspecto, na escala do roteiro, e a nota dele na competência é a média dos aspectos, sem arredondar no meio (o avaliador só conta com todos os aspectos lançados). A nota da competência é a média dos avaliadores que lançaram, vezes o peso, com 2 casas. A nota final é a soma das competências sem arredondar, arredondada a 2 casas no fim. Exemplo: 4 avaliadores com 1, 1, 1 e 2 com 2, 1, 1 dão 1,11 na competência. Com aspectos, quem elimina é o mínimo da competência (abaixo dele, INAPTO): as notas eliminatórias exatas (0 ou 1) não se aplicam a médias. Roteiro sem aspectos continua com uma nota por avaliador. Editar o roteiro grava uma versão nova; os editais que já usam a anterior seguem nela.
**fato:** Com aspectos, a nota do avaliador é a média dos aspectos, a competência é a média dos avaliadores e o total é arredondado só no fim; elimina quem fica abaixo do mínimo da competência.
**fonte:** supabase/migrations/20261008100000_aspectos_da_entrevista.sql; src/lib/conducao-de-entrevista.js; python/monitora/entrevistas/calculo.py; tests/fixtures/entrevistas/casos-de-calculo.json
**abrir:** entrevistas

## Banca da entrevista

**perguntas:** banca da entrevista | completar banca | completar pela composicao | quem sai da banca | modo avaliador | secretaria passa a limpo
**resposta:** Na configuração do edital, escolher o roteiro preenche a composição da banca com o padrão dele. "Completar pela composição" acrescenta as linhas que faltam, com o nome vazio; "Sou eu" liga o membro ao seu perfil. Quem sai da banca deixa de avaliar, mas as notas que já deu ficam na ficha, com a marca "saiu da banca". O modo de lançamento pode ser "Secretaria passa a limpo" (padrão) ou "Cada avaliador lança a sua": nesse caso cada avaliador só edita a própria coluna (o administrador global lança por qualquer um). A troca de roteiro fica bloqueada quando já há notas lançadas com outro roteiro.
**fonte:** src/lib/conducao-de-entrevista.js; src/modulos/entrevistas/conducao.jsx; supabase/migrations/20260930220000_entrevistas_roteiros_e_notas.sql

## Convocação para a entrevista

**perguntas:** como funciona a regra de convocacao da entrevista | regra de convocacao da entrevista | convocacao da entrevista | desconvocar | convocar candidatos | quem e convocado para a entrevista | lista de convocacao na entrevista | conduzir entrevistas nao esta funcionando | ninguem convocado na entrevista
**resposta:** Há uma convocação só: a lista "Convocação para entrevista" da Classificação. Em Conduzir entrevistas › Preparar, a convocação mostra a última lista gerada na Classificação, por vaga, na mesma ordem, com os mesmos critérios e o mesmo limite da regra de classificação do edital (N vezes as vagas imediatas ou até a posição do cadastro reserva, exceções por cargo, empatados no limite); quem está só na lista de uma modalidade aparece com a marca da lista. "Convocar selecionados" leva os da lista para a ficha de notas (todos vêm marcados; dá para desmarcar). O banco recusa quem não está na lista vigente e, se a Classificação gerou outra lista depois que a tela abriu, pede para recarregar. Convocar exige a configuração salva. Quem foi convocado antes e não está na lista vigente continua na ficha, com a marca "Fora da lista vigente". Desconvocar exige motivo (3 a 500 caracteres), fica no histórico e só vale para quem ainda não tem nota; nada é apagado.
**fato:** No MONITORA, a convocação para a entrevista é a lista de convocação da Classificação; Entrevistas não tem ranking, regra nem vagas próprios.
**fonte:** src/lib/convocacao-da-entrevista.js; src/modulos/entrevistas/conducao.jsx; supabase/migrations/20261005150000_convocacao_unica_da_entrevista.sql
**abrir:** entrevistas

## Convocação sem lista gerada na Classificação

**perguntas:** lista ainda nao gerada na classificacao | gerar a lista de convocacao | convocar sem lista | por que nao consigo convocar | calculo atual da convocacao | a regra da classificacao mudou depois desta lista
**resposta:** Enquanto a Classificação não gerou a lista de convocação do edital, Conduzir entrevistas mostra o cálculo atual (a mesma conta da Classificação, com a regra e as vagas de agora) e o aviso "Lista ainda não gerada na Classificação", sem o botão de convocar: para convocar, gere a lista na Classificação (o botão "Gerar na Classificação" abre a tela já no edital, para quem é Editor de Classificação). Sem acesso à Classificação, a tela só avisa. Se a regra de classificação mudou depois da lista, aparece "A regra da Classificação mudou depois desta lista": gere a lista de novo.
**fonte:** src/lib/convocacao-da-entrevista.js; src/modulos/entrevistas/estado-da-conducao.js
**abrir:** classificacao

## Vagas imediatas e regra de convocação na entrevista

**perguntas:** vagas imediatas da entrevista | onde digitar as vagas imediatas | vagas imediatas por vaga | regra de convocacao da entrevista onde muda | multiplo das vagas imediatas | posicao do cadastro reserva na entrevista | de onde vem o numero de vagas da entrevista
**resposta:** As vagas imediatas não se digitam na entrevista. A configuração (Conduzir entrevistas › Preparar) mostra, só para ler, a regra de convocação da Classificação (versão vigente) e, por vaga, as vagas, até que posição se convoca e de onde vêm as vagas, com o botão para a tela onde se mudam: o quadro de vagas do edital (Editais), a configuração da convocação (Lista de aprovados) ou os percentuais da regra (Classificação). Vaga sem quadro aparece como "sem quadro de vagas": cadastre o quadro no edital. A regra de convocação (múltiplo, posição do cadastro reserva, exceções por cargo) muda em Classificação › Regra. O que a entrevista guardava antes (vagas digitadas e regra própria) ficou no banco, sem uso.
**fonte:** src/modulos/entrevistas/conducao.jsx; src/lib/convocacao-da-entrevista.js; src/lib/classificacao/vagas.js
**abrir:** entrevistas

## Ficha de notas

**perguntas:** ficha de notas | como lancar notas da entrevista | lancar notas | comparecimento | resultado recalculado
**resposta:** Na Fila de Conduzir entrevistas, abra um convocado: a ficha ocupa a tela inteira (modo de análise; fica só o menu lateral), com o topo preso (Voltar à fila, candidato, Anterior e Próximo), as competências à esquerda e a prévia do parecer numa lateral fixa (total, mínimo, a nota de cada competência e os motivos; muda de cor na hora: verde apto, vermelho inapto). Marque Compareceu ou Faltou nos botões grandes do topo. Em cada competência, os avaliadores ficam lado a lado; os botões da escala (0 a 5) preenchem o campo em foco e passam ao próximo, ou digite a nota. Com aspectos, cada avaliador tem um campo por aspecto e a média dele ao lado. Os níveis da escala ficam na lateral e no título de cada botão. No celular, uma competência por vez (abas numeradas). Esc volta à fila; a nota precisa estar na escala do roteiro. A cada gravação o banco recalcula o resultado, que aparece no Painel de entrevistas; toda nota lançada, corrigida ou apagada vai para o histórico. Enter passa para a próxima nota, Ctrl+Enter salva, e há "Salvar e abrir o próximo". O cartão da fila mostra as notas lançadas sobre as esperadas (competências × avaliadores da banca).
**fonte:** src/modulos/entrevistas/ficha.jsx; src/modulos/entrevistas/fila-do-dia.tsx; supabase/migrations/20260930220000_entrevistas_roteiros_e_notas.sql; src/lib/conducao-de-entrevista.js

## Resultados das entrevistas

**perguntas:** resultados das entrevistas | indicadores das entrevistas | aprovados sem entrevista | nota divergente | entrevista sem analise | pendencias das entrevistas | quais sao as pendencias das entrevistas | sem nota | sem parecer | sem comparecimento
**resposta:** Os resultados ficam no Painel de entrevistas, só de consulta (a condução é em Conduzir entrevistas). Indicadores: Vagas com entrevista, Candidatos, Compareceram, Aptos, Inaptos, Média das notas (de quem compareceu) e Aprovados na análise sem entrevista; clicar em Compareceram, Aptos ou Inaptos filtra a tela. Pendências: sem comparecimento registrado, compareceu sem nota, com nota sem parecer, aprovados sem entrevista (só nas vagas que já têm entrevista), entrevista sem análise ligada, sem edital cadastrado e nota divergente (total diferente da soma dos critérios); cada uma filtra o painel. A nota total vai de 0 a 20 e cada critério, em geral, de 0 a 5. A ligação com a análise curricular é pelo código do candidato e da vaga e, na falta, pelo nome.
**fonte:** src/modulos/entrevistas/paineis.jsx; src/lib/entrevistas-do-painel.js; supabase/migrations/20260929235000_entrevistas.sql
**abrir:** entrevistas

## Carga das entrevistas

**perguntas:** quando as entrevistas sao atualizadas | carga das entrevistas | planilha de entrevistados | atualizacao das entrevistas
**resposta:** Os dados do Painel de entrevistas vêm da planilha "[dash] entrevistados" (aba Entrevistados), carregada de hora em hora, o dia todo, pelo GitHub Actions, que também pode ser disparado à mão. Uma carga com menos da metade das linhas ativas é recusada, para não apagar tudo por uma planilha quebrada; quem some da planilha fica inativo, nada é apagado. A data da última carga aparece no topo da tela.
**fonte:** .github/workflows/sincronizar-entrevistas.yml; docs/sincronizacao-das-planilhas.md; supabase/migrations/20260929235000_entrevistas.sql

## Agenda das entrevistas

**perguntas:** agenda das entrevistas | como funciona a agenda das entrevistas | onde fica a agenda das entrevistas | gerar os horarios das entrevistas | marcar horario da entrevista
**resposta:** A agenda das entrevistas fica na Classificação, na visão Agenda (ou pelo botão "Agenda das entrevistas" da lista Convocação para entrevista), porque os convocados saem dessa lista e a agenda preenche o documento dela. Cada edital tem a sua regra da agenda, com versões, e uma agenda salva: um horário por convocado, com dia, hora de Brasília e banca. Os convocados vêm da última lista de convocação gerada; sem lista gerada, do cálculo atual, com um aviso. Quem conduz vê a fila do dia em Conduzir entrevistas. Salvar a regra e a agenda exige Editor em Entrevistas ou em Classificação; ler, Leitor em uma delas; sempre com acesso à área e ao edital.
**fonte:** src/modulos/classificacao/agenda.jsx; supabase/migrations/20261005120000_agenda_das_entrevistas.sql
**abrir:** classificacao

## Regra da agenda das entrevistas

**perguntas:** regra da agenda | como configurar a regra da agenda | bancas simultaneas | duracao de cada entrevista | intervalo entre entrevistas | pausa na agenda | reservar o primeiro horario | agrupar por cargo | ordem dos candidatos na agenda
**resposta:** A regra da agenda tem: os dias (um intervalo, com a opção "Só dias úteis", ou uma lista de dias, em dd/mm/aaaa) e os dias sem entrevista (feriados); de 1 a 6 períodos por dia (ex.: 08:00–12:00 e 14:00–18:00), no horário de Brasília; a duração de cada entrevista (5 a 240 minutos) e o intervalo entre elas (0 a 120); uma pausa opcional (ex.: almoço), em que nenhuma entrevista acontece; de 1 a 20 bancas simultâneas, com nome (os membros cadastrados na banca de Entrevistas aparecem junto); a ordem dos candidatos (classificação na convocação, vaga/cargo, alfabética ou modalidade, com a ampla primeiro); "Agrupar por cargo" (todos de um cargo antes do próximo, e cada cargo começa num horário novo); e "Reservar o primeiro horário de cada período" (fica livre para encaixe). Até 60 dias. Salvar cria uma versão nova; da segunda em diante, com motivo.
**fonte:** src/lib/agenda-das-entrevistas.js; supabase/migrations/20261005120000_agenda_das_entrevistas.sql
**abrir:** classificacao

## Como a agenda é gerada

**perguntas:** como a agenda e gerada | convocado sem horario | a agenda nao cabe | sobram horarios na agenda | distribuicao pelas bancas
**resposta:** "Gerar agenda" monta os horários de cada dia a partir de cada período: começa no início, avança de duração mais intervalo e pula a pausa. Em cada horário cabe uma entrevista por banca. Os convocados, na ordem da regra, ocupam os horários em ordem: banca 1, banca 2… no mesmo horário, depois o próximo horário e o próximo dia. Se não couber, a tela diz quantos ficaram sem horário e quanto tempo de entrevista falta; se sobrar muito (30% dos lugares ou mais), diz quantos horários sobram e quantos dias bastam. O resultado é um rascunho: só vale depois de "Salvar agenda".
**fonte:** src/lib/agenda-das-entrevistas.js
**abrir:** classificacao

## Ajuste manual da agenda

**perguntas:** ajustar a agenda | trocar o horario de um candidato | trocar dois candidatos de horario | conflito na agenda | gerar a agenda de novo
**resposta:** Na agenda, "Mudar" abre o ajuste de um convocado: escolher um horário livre (de qualquer banca, inclusive os reservados) ou "Sem horário", ou trocar de lugar com outro convocado (os dois trocam dia, hora e banca). O ajuste fica marcado como "Ajuste manual". Conflito é a mesma banca com horários que se sobrepõem no mesmo dia ou o mesmo candidato duas vezes: a tela lista os conflitos e não deixa salvar até resolver; o banco também recusa. "Gerar de novo" sobre uma agenda com ajustes manuais pergunta antes, porque a distribuição da regra substitui os ajustes. Cada gravação fica no histórico (Gravações), com quem, quando e o que mudou.
**fonte:** src/modulos/classificacao/agenda.jsx; src/lib/agenda-das-entrevistas.js; supabase/migrations/20261005120000_agenda_das_entrevistas.sql
**abrir:** classificacao

## Data e hora no documento da convocação

**perguntas:** data e hora na convocacao | preencher data e hora da convocacao | agenda no documento do sei | exportar a agenda
**resposta:** Com a agenda salva, o documento da Convocação para entrevista (Copiar para o SEI, Baixar DOCX, PDF e Como fica no SEI) sai com as colunas DATA e HORA preenchidas com o dia e a hora de início de cada convocado; quem não tem horário fica em branco, para preencher no SEI. O modelo publicado não ganha coluna de banca. O XLSX da agenda (botão XLSX na visão Agenda) traz dia, hora de início e fim, banca, nome, vaga, cargo, modalidade e se o horário foi ajustado à mão.
**fonte:** src/lib/classificacao/documento-sei.js; src/lib/agenda-das-entrevistas.js
**abrir:** classificacao

## Agenda do dia em Conduzir entrevistas

**perguntas:** agenda do dia | agenda da banca | horarios de hoje da entrevista | agenda dos proximos dias
**resposta:** A agenda é montada e ajustada na Classificação, visão Agenda. Em Conduzir entrevistas, a Fila usa a agenda salva: Hoje são os convocados com horário hoje (Brasília), Próximos os dos dias seguintes, por dia, e Todos inclui quem não tem horário. No Painel de entrevistas, com um edital escolhido, a "Agenda dos próximos dias" mostra até cinco dias com entrevista, um por coluna, com o botão Conduzir. Sem agenda salva, a Fila abre em Todos.
**fonte:** src/modulos/entrevistas/fila-do-dia.tsx; src/modulos/entrevistas/andamento.tsx; src/lib/fila-de-conducao.ts
**abrir:** conduzir-entrevistas

## Quem pode conduzir entrevistas

**perguntas:** quem pode lancar notas | quem pode conduzir entrevistas | nao aparece o botao convocar | nao consigo lancar nota | botoes sumiram em entrevistas | permissao entrevistas | nao vejo conduzir entrevistas no menu
**resposta:** O Painel de entrevistas e Conduzir entrevistas usam o mesmo recurso, Entrevistas: quem tem Leitor vê os dois (a fila, as fichas, o Preparar e os roteiros, sem os botões). Lançar notas, convocar, desconvocar, salvar a configuração do edital e editar roteiros exige Editor em Entrevistas e acesso à área e ao edital (recorte da coordenação). No modo "Cada avaliador lança a sua", cada avaliador só edita a própria coluna. "Convocar selecionados" só aparece quando a Classificação já gerou a lista de convocação do edital, e liberar edital fora da janela é só do administrador global.
**fonte:** src/modulos/entrevistas/conduzir.tsx; src/lib/access-roles.js; supabase/migrations/20260930220000_entrevistas_roteiros_e_notas.sql
**abrir:** config:acessos
