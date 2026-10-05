# Regras da Lista de aprovados

A tela Lista de aprovados (view `approved`): status dos candidatos, importação, convocação, sub
judice e anexos. Fontes: `src/modulos/aprovados/`, `src/lib/lista-aprovados-rules.js`,
`src/lib/aprovados-import.js`, `src/lib/lista-convocacao-rules.js`,
`src/lib/modelo-de-convocacao.js`, `src/lib/anexos-do-candidato.js`, `src/lib/carta-de-convocacao.js`, `src/lib/access-roles.js` e as
migrations `20260928235000_anexos_so_admin.sql`, `20260930200000_aprovados_por_grupo_edital_gestor_edita.sql`,
`20261001150000_sub_judice_alteracao.sql`, `20261005160000_lista_de_aprovados_da_classificacao.sql` (lista
publicada do resultado final da Classificação; `src/lib/publicacao-de-aprovados.js`) e
`20261005180000_convocado_e_carta_de_convocacao.sql` (status Convocado e carta de convocação).

## Tela da Lista de aprovados

**perguntas:** tela da lista de aprovados | lista de aprovados | aba lista de aprovados | para que serve lista de aprovados | para que serve a lista de aprovados | status do candidato
**resposta:** A Lista de aprovados mostra a lista vigente de cada edital da área atual. Os status do candidato são Convocado, Contratado, Desistente, Migração e Documentação Rejeitada; Contratado e Migração exigem matrícula e Convocado leva a data da convocação. Status já definido só quem tem Administrador em Aprovados altera (os demais veem um cadeado), exceto do Convocado para o status seguinte. Clicar no nome abre a gaveta do candidato, com os dados e as cartas de convocação emitidas. Quem tem Editor em Aprovados muda status; o grupo Gestor edita a lista desde que tenha a área e o edital. Quem importou ou substituiu a lista fica registrado.
**fonte:** src/lib/lista-aprovados-rules.js; src/modulos/aprovados/; supabase/migrations/20260930200000_aprovados_por_grupo_edital_gestor_edita.sql
**abrir:** approved

## Lista inativa

**perguntas:** o que acontece com uma lista inativa | lista inativa | listas inativas | ativar lista | inativar lista
**resposta:** Listas inativas continuam consultáveis, mas seus candidatos não podem ser alterados, nem receber anexos. Ativar ou inativar a lista é de quem pode importar (Editor em Importação, como o grupo Gestor); substituir ou remover o XLSX de uma lista existente é do Administrador em Importação.
**fonte:** src/lib/lista-aprovados-rules.js; src/lib/access-roles.js

## Importar a lista

**perguntas:** importar lista de aprovados | importacao do xlsx | colunas do xlsx | substituir lista
**resposta:** A importação aceita só .xlsx e usa a primeira aba, com as colunas obrigatórias codigo_vaga, cargo, classificacao, nota, nome e modalidade (classificação inteira maior que 0; nota numérica, 0 ou mais); mostra até 12 erros por vez. Importa quem tem Editor em Importação (ou o grupo Gestor); substituir uma lista existente é do Administrador. A importação liga os candidatos ao edital pelo ID do edital.
**fonte:** src/lib/aprovados-import.js; src/lib/access-roles.js

## Modelo de convocação

**perguntas:** como funciona o modelo de convocacao | modelo de convocacao | cotas intercaladas | ordem da convocacao | sem modelo de convocacao
**resposta:** O modelo de convocação são as regras de reserva do edital: categorias, percentuais, arredondamento e cascata. As vagas de cota entram intercaladas às de ampla (proporcional, como AC, PP, AC, AC, PP, AC, ou nas posições fixas que o edital publica) e a convocação segue a classificação. Quem concorre a cota concorre também à ampla, e ser chamado pela ampla não gasta a vaga da cota; cota sem candidato desce a cascata e, no fim, volta para a ampla. Desistente e Documentação Rejeitada não ocupam vaga; Convocado, Contratado e Migração continuam na posição e não são chamados de novo. As vagas imediatas são informadas por vaga (zero vira cadastro reserva). Sem modelo, tudo sai como ampla concorrência. O modelo é compartilhado entre editais: a tela avisa quantos serão afetados e oferece "Duplicar". Modelo e vagas valem para o edital e sobrevivem à troca do XLSX.
**fonte:** src/lib/lista-convocacao-rules.js; src/lib/modelo-de-convocacao.js; src/lib/configuracao-de-convocacao.js

## Candidato sub judice

**perguntas:** como funciona o candidato sub judice | sub judice | decisao judicial | incluir sub judice
**resposta:** Quem tem Editor em Aprovados inclui um candidato sub judice, que fica vinculado à lista vigente do edital; remover vale só para quem foi incluído assim. Alterar nota ou modalidade por decisão judicial, e desfazer, é só do Administrador em Aprovados: a classificação é refeita e o número do processo judicial é opcional.
**fonte:** src/lib/access-roles.js; src/lib/lista-aprovados-rules.js; supabase/migrations/20261001150000_sub_judice_alteracao.sql

## Anexos do candidato

**perguntas:** quem pode anexar documentos ao candidato | anexos do candidato | anexar pdf ao candidato | documentos do candidato
**resposta:** Só quem tem Administrador em Aprovados inclui e remove anexos do candidato, e só em lista ativa: PDF de até 2 MB, no máximo 5 por candidato. Ver e baixar os anexos é para quem lê a lista.
**fonte:** src/lib/anexos-do-candidato.js; src/lib/lista-aprovados-rules.js; supabase/migrations/20260928235000_anexos_so_admin.sql

## Origem da lista de aprovados

**perguntas:** origem da lista de aprovados | de onde vem a lista de aprovados | lista manual planilha | publicada da classificacao | lista publicada da classificacao | o que e lista manual
**resposta:** No MONITORA, a lista de aprovados de cada edital tem uma de duas origens, mostrada na tela e no modal "Listas do edital": "Publicada da Classificação em DD/MM" — o resultado final da aba Classificação, com posição, nota, modalidade, vaga e situação (dentro das vagas ou cadastro reserva) calculados pela regra do edital, sem digitação — ou "Lista manual (planilha)", importada por XLSX com posição e nota digitadas. Edital com análise no sistema publica da Classificação; a planilha fica para editais sem análise no sistema. Cada troca de lista fica no histórico das publicações do edital.
**fato:** No MONITORA, a lista de aprovados vem do resultado final da Classificação; a planilha XLSX fica para editais sem análise no sistema.
**fonte:** src/lib/publicacao-de-aprovados.js; src/modulos/aprovados/modal-listas-do-edital.jsx; supabase/migrations/20261005160000_lista_de_aprovados_da_classificacao.sql
**abrir:** approved

## Publicar a lista de aprovados da Classificação

**perguntas:** publicar lista de aprovados da classificacao | como publicar a lista de aprovados | publicar da classificacao | lista de aprovados pela classificacao
**resposta:** Na Classificação, abra o edital, vá ao "Resultado final", gere a lista e clique em "Publicar como lista de aprovados" (Editor de Classificação, na área do edital; lista com empate pendente não publica, e só o resultado final mais recente). A confirmação compara com a lista vigente: quantos entram, saem, mudam de posição, quantos têm status ou sub judice preservados e quantos sub judice são mantidos. Publicar cria a nova lista vigente do edital; a anterior fica inativa no histórico, sem apagar nada. Pelo modal "Listas do edital" da Lista de aprovados, "Publicar da Classificação" leva à Classificação no edital.
**fonte:** src/modulos/classificacao/publicar-aprovados.jsx; supabase/migrations/20261005160000_lista_de_aprovados_da_classificacao.sql
**abrir:** classificacao

## O que a publicação preserva

**perguntas:** status preservado na publicacao | contratado continua contratado | publicar perde status | sub judice na publicacao | casamento dos candidatos | quem nao casou na publicacao | revisar candidatos da publicacao
**resposta:** Quem já estava na lista vigente leva para a lista nova o status (Contratado, Desistente…), a matrícula, o processo SEI, o sub judice e os anexos. A pessoa é reconhecida pela análise (lista já publicada da Classificação) ou, nas listas de planilha — que não trazem CPF nem código do candidato —, pelo nome sem acento e sem diferença de maiúsculas no mesmo edital, desempatando pela vaga. Quem tinha nota ou modalidade alterada por decisão judicial continua com a da decisão (a da Classificação vira a original, para desfazer) e é recolocado pela nota; quem foi incluído sub judice e não está no resultado continua na lista como sub judice. Homônimo que não se resolve e quem sai com status ou matrícula aparecem em "Revisar" na confirmação, para dizer quem é na lista nova ou que não está; quem sai continua na lista anterior, com tudo, e fica registrado na publicação. Sub judice segue editável na Lista de aprovados.
**fonte:** src/lib/publicacao-de-aprovados.js; supabase/migrations/20261005160000_lista_de_aprovados_da_classificacao.sql
**abrir:** approved

## Trocar pela planilha uma lista da Classificação

**perguntas:** importar xlsx sobre lista da classificacao | motivo para trocar pela planilha | substituir lista publicada da classificacao | planilha depois da classificacao
**resposta:** Se a lista vigente foi publicada da Classificação, o administrador de Importação ainda pode trocá-la por um XLSX, mas precisa informar o motivo (de 3 a 500 caracteres), que fica no histórico das publicações junto com quem e quando. Editais sem análise no sistema continuam importando a planilha como antes, sem motivo.
**fonte:** src/modulos/aprovados/modal-listas-do-edital.jsx; supabase/migrations/20261005160000_lista_de_aprovados_da_classificacao.sql
**abrir:** approved

## Histórico das publicações da lista

**perguntas:** historico das publicacoes da lista de aprovados | quem publicou a lista de aprovados | auditoria da lista de aprovados | versao da regra da lista de aprovados
**resposta:** Cada lista que entra em vigor num edital fica registrada: publicada da Classificação (quem, quando, a lista de classificação, a versão da regra, o hash, quantos entraram, saíram, mudaram de posição, preservados e sub judice mantidos, os vínculos aplicados e quem ficou para revisão) ou importada por planilha (quem, quando e o motivo, quando trocou uma lista da Classificação). O modal "Listas do edital" mostra as últimas publicações.
**fonte:** supabase/migrations/20261005160000_lista_de_aprovados_da_classificacao.sql (TH_PUBLICACAO_APROVADO)
**abrir:** approved

## Status Convocado

**perguntas:** status convocado | o que e convocado | convocado | data da convocacao | marcar como convocado | convocado para contratacao
**resposta:** Convocado é o candidato chamado para a contratação que ainda vai se apresentar e entregar os documentos; o status leva a data da convocação (hoje, por padrão, nunca futura). O caminho seguinte é Contratado, Desistente ou Documentação Rejeitada: quem tem Editor em Aprovados faz essa passagem sem o cadeado, mas voltar a "Sem status" é só do Administrador em Aprovados. A data continua registrada depois que o status muda e some se o status for apagado. Convocado não conta como contratado na Seleção nem nos indicadores de contratados (que somam Contratado e Migração). O status "Fim de Fila" deixou de existir.
**fonte:** src/lib/lista-aprovados-rules.js; supabase/migrations/20261005180000_convocado_e_carta_de_convocacao.sql
**abrir:** approved

## A convocar na ordem de chamada

**perguntas:** a convocar | quem chamar agora | proximos a convocar | quem ainda nao foi chamado | ordem de chamada convocado
**resposta:** Na aba Convocação, "A convocar" são as vagas imediatas cujo candidato ainda não foi chamado (sem status). Convocado, Contratado e Migração continuam na posição que a ordem lhes deu e não são chamados de novo; Desistente e Documentação Rejeitada saem da fila e o próximo toma a vaga. "Escolher os a convocar" marca de uma vez esses candidatos para a carta. "Exportar CSV" baixa a ordem com a situação na chamada, o status e a data da convocação.
**fonte:** src/lib/lista-convocacao-rules.js; src/modulos/aprovados/aba-convocacao.jsx
**abrir:** approved

## Carta de convocação

**perguntas:** carta de convocacao | emitir carta de convocacao | como emitir a carta de convocacao | carta para contratacao | convocar por carta
**resposta:** Na aba Convocação, marque os candidatos e clique em "Carta de convocação" (ou use o envelope na linha ou na gaveta do candidato). Escolha o modelo (os do edital aparecem primeiro), confira a data limite, o local, os documentos e o contato desta emissão, e se sai um documento com todas ou uma carta por candidato. A prévia mostra como fica no SEI. As saídas são Copiar para o SEI, DOCX (com uma carta por candidato, vem um .zip) e PDF. A primeira saída registra a emissão: quem, quando, o modelo e a versão e os candidatos. Emitir é de quem tem Editor em Aprovados.
**fonte:** src/modulos/aprovados/carta-de-convocacao/; src/lib/carta-de-convocacao.js; src/lib/carta-de-convocacao-documento.js
**abrir:** approved

## Marcar convocados depois da carta

**perguntas:** marcar convocados depois da carta | marcar candidatos como convocado | convocado depois da carta | carta registrada
**resposta:** Depois que a carta é registrada, a tela oferece marcar como Convocado, com a data escolhida, os candidatos da carta que estão sem status ou já convocados; quem já tem outro status fica de fora e a tela diz o motivo. A marcação fica ligada à carta no histórico do status.
**fonte:** supabase/migrations/20261005180000_convocado_e_carta_de_convocacao.sql (marcar_candidatos_convocados)
**abrir:** approved

## Modelos da carta de convocação

**perguntas:** modelo da carta de convocacao | modelos da carta | editar carta de convocacao | campos da carta | versao do modelo da carta
**resposta:** Os modelos da carta são da área e, se preciso, de um edital, e ficam em "Modelos da carta", na aba Convocação. O texto tem um parágrafo por linha, **negrito** e campos entre chaves: {NOME}, {CPF}, {CARGO}, {VAGA}, {LOTACAO}, {UNIDADE}, {EDITAL}, {POSICAO}, {MODALIDADE}, {DATA_LIMITE}, {LOCAL}, {DOCUMENTOS}, {CONTATO} e {DATA}; a linha que é só {DOCUMENTOS} vira a lista dos documentos. O modelo guarda os valores padrão de local, documentos, contato e prazo em dias. Cada alteração é uma versão nova e, a partir da segunda, pede o motivo; modelo não se apaga, inativa-se com motivo. Quem tem Editor em Aprovados cria e altera; os demais só consultam.
**fonte:** src/lib/carta-de-convocacao.js; src/modulos/aprovados/carta-de-convocacao/modelos-da-carta.jsx
**abrir:** approved

## CPF na carta de convocação

**perguntas:** cpf na carta de convocacao | carta com cpf | cpf mascarado
**resposta:** A lista de aprovados não guarda CPF. Se o modelo usa {CPF}, a carta sai com o espaço em branco e a emissão avisa quem ficou sem; quando houver CPF, ele aparece sempre mascarado (***.456.789-**).
**fonte:** src/lib/carta-de-convocacao.js

## Cartas emitidas na gaveta do candidato

**perguntas:** historico de cartas do candidato | cartas emitidas | gaveta do candidato | ver cartas de convocacao do candidato
**resposta:** Clique no nome do candidato, em qualquer aba, para abrir a gaveta: os dados da lista, o status com a data da convocação e as cartas de convocação emitidas para ele (também nas listas anteriores do edital), com quando, quem, modelo e versão, como saiu, o prazo e se a convocação foi marcada pela carta.
**fonte:** src/modulos/aprovados/gaveta-do-candidato.jsx; supabase/migrations/20261005180000_convocado_e_carta_de_convocacao.sql (listar_cartas_do_candidato)
**abrir:** approved
