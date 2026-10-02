# Regras do mapa da Saúde Indígena

O mapa da Visão geral (Saúde Indígena) mostra só rótulos, números e controles;
o porquê fica aqui, para a Aya explicar. Textos que saíram da tela com o mapa
em React (01/10/2026): a dica "Escolha um DSEI no mapa para ver polos e
unidades", o "clique para abrir o território" das bolhas, o aviso "Visão do
Brasil. Os filtros continuam valendo" e os textos longos das listas vazias. O
modo Calor saiu em 02/10/2026.

## Como usar o mapa da Saúde Indígena

**perguntas:** como usar o mapa | como abrir um dsei no mapa | ver polos e unidades | abrir o territorio | mapa detalhado do dsei
**resposta:** No MONITORA, a visão nacional do mapa mostra uma bolha por DSEI e, ao lado, a lista "Territórios por vagas". Clicar numa bolha ou numa linha da lista abre o mapa daquele DSEI, com os polos base, CASAIs, UBSIs e demais unidades, e recorta a página inteira (indicadores e tabela) por ele. "← Voltar ao Brasil", no topo do mapa do DSEI, volta à visão nacional sem apagar os outros filtros.
**fonte:** interface do MONITORA

## Bolhas dos DSEIs no mapa

**perguntas:** bolha do mapa | tamanho da bolha | cor da bolha | bolha verde | bolha azul | dsei com processo ativo
**resposta:** No MONITORA, cada bolha da visão nacional fica na sede do DSEI. O tamanho segue a população indígena atendida (a área da bolha é proporcional à população). Verde com borda amarela é DSEI com edital no recorte atual; azul, sem edital. Com algum filtro ativo, só aparecem os DSEIs que têm edital no resultado. A dica da bolha traz população, quantos polos base o distrito tem, quantos pontos o mapa desenha, as UFs administrativas, os processos seletivos e as vagas ociosas.
**fonte:** interface do MONITORA

## Mapa de calor

**perguntas:** botao calor | modo calor | mapa de calor | mapa sem calor
**resposta:** No MONITORA, o mapa da Saúde Indígena não tem modo de calor: a bolha só diz se o DSEI tem edital no recorte (verde) ou não (azul). As vagas ociosas de cada DSEI aparecem na dica da bolha e, como preenchimento, na barra de "Territórios por vagas"; a taxa de ociosidade de cada edital fica na tabela da Visão geral.
**fonte:** interface do MONITORA

## Territórios por vagas

**perguntas:** territorios por vagas | lista ao lado do mapa | ranking dos dseis | barra de preenchidas | porcentagem preenchidas
**resposta:** No MONITORA, "Territórios por vagas" lista os mesmos DSEIs que o mapa desenha, do que tem mais vagas para o que tem menos (empate decidido pela população). A barra é o preenchimento: vagas menos ociosas, divididas pelas vagas. Acima de 80% preenchidas fica verde, de 41% a 80% amarela e até 40% vermelha. Clicar na linha abre o DSEI, como clicar na bolha.
**fonte:** interface do MONITORA

## Duas bolhas no mesmo lugar do mapa

**perguntas:** bolhas sobrepostas | leque no mapa | traco ate o ponto | yanomami e leste de roraima no mapa
**resposta:** No MONITORA, quando duas sedes caem no mesmo ponto da tela (Yanomami e Leste de Roraima, ambas em Boa Vista), as bolhas abrem num pequeno leque em volta do ponto real, com um traço até ele. A coordenada não muda; ao aproximar o zoom, cada bolha volta ao seu lugar. No mapa do DSEI vale o mesmo para unidades a menos de 14 pixels uma da outra.
**fonte:** interface do MONITORA

## CASAI Nacional no mapa

**perguntas:** casai nacional no mapa | losango roxo | clicar na casai nacional
**resposta:** No MONITORA, o losango roxo marca as CASAIs de referência nacional (Brasília e São Paulo), desenhadas a partir do cadastro do CNES. Clicar nele filtra a página pela busca "CASAI" mais o nome da cidade. Com filtro ativo, a CASAI só aparece se tiver edital no resultado.
**fonte:** interface do MONITORA

## Formas dos marcadores no mapa do DSEI

**perguntas:** estrela no mapa | formas do mapa | legenda do mapa do dsei | circulo laranja | cruz roxa | casa vermelha
**resposta:** No MONITORA, o mapa do DSEI usa forma além de cor, para quem não distingue as cores: estrela grafite é a sede do DSEI, círculo laranja é polo base, casa vermelha é CASAI, cruz violeta é UBSI e losango verde-azulado é outra unidade de saúde. Os botões acima da lista de unidades escondem ou mostram cada tipo, na lista e no mapa.
**fonte:** interface do MONITORA

## Vínculo fora da área do DSEI

**perguntas:** vinculo fora da area | linha pontilhada no mapa | mostrar vinculos externos | unidade fora da area do dsei
**resposta:** No MONITORA, a UF de cada unidade vem do CNES; quando ela não está entre as UFs de abrangência do DSEI, a unidade fica no lugar verdadeiro com um anel tracejado e uma linha pontilhada até a sede. A linha é vínculo administrativo, não trajeto. O mapa abre enquadrando só o território; "Mostrar vínculos externos" amplia para incluir essas unidades. Unidade sem UF no CNES não é tratada como externa.
**fonte:** interface do MONITORA

## Polos base e pontos no mapa

**perguntas:** polos base e pontos no mapa | por que o numero de polos diverge | no mapa pontos | contagem da dica do dsei
**resposta:** No MONITORA, a dica do DSEI responde a duas perguntas: "Polos base" é quantos polos o distrito tem no cadastro do mapa no banco (lmap); "No mapa" é quantos pontos o mapa desenha (polos, unidades e CASAIs). Os números podem divergir porque o mesmo polo pode estar no lmap e no CNES com nomes ou posições diferentes; quando a reconciliação não tem certeza de que são o mesmo, os dois continuam desenhados. Quando são o mesmo, o ponto fica na posição do lmap.
**fonte:** interface do MONITORA

## O que o popup de uma unidade mostra

**perguntas:** popup da unidade | o que o popup mostra | localizacao validada | fontes discordam | localizacao em validacao | coordenada confirmada | ponto do polo esta certo
**resposta:** No MONITORA, o popup de cada ponto do mapa do DSEI traz só o que a unidade é: tipo, nome, município e UF e o código CNES (quando há). Não há mais frases como "Localização em validação", "Fontes discordam" ou "validada": elas vinham de uma validação de 22/09/2026 anterior à auditoria oficial e foram retiradas em 02/10/2026. Toda coordenada vem do banco (lmap para polos e sedes, rede_cnes para os estabelecimentos), auditada em 01 e 02/10/2026 contra fontes oficiais (CNES, IBGE, Funai, PDSI e OpenStreetMap); os pontos que a auditoria não confirmou (92 polos e 156 UBSI/postos) ficam numa fila de conferência que só o administrador global e o Gestor veem, no editor de coordenadas; o popup não mostra essa situação. Se um ponto parecer errado, a correção é feita pelo editor, que grava no banco.
**fonte:** docs/auditoria-oficial-das-coordenadas-2026-10-01.md; src/lib/mapa-saude-indigena/mapa-do-dsei.js

## Terras Indígenas no mapa

**perguntas:** terras indigenas no mapa | fases das terras | homologada no mapa | em estudo no mapa | lista de terras e povos | povo nao declarado
**resposta:** No MONITORA, as Terras Indígenas vêm da Funai e aparecem em três fases, cada uma um interruptor na legenda: homologada ou regularizada (limite contínuo), em processo (tracejado) e em estudo (círculo tracejado, sem limite publicado). No mapa do DSEI, a lista "Terras Indígenas e povos" traz as terras que caem na área do distrito; clicar leva o mapa até a terra. Quando a Funai não declara o povo, a lista diz isso em vez de inventar.
**fonte:** interface do MONITORA

## Voltar ao Brasil

**perguntas:** voltar ao brasil | sair do dsei | voltar para a visao geral do mapa | voltar ao mapa nacional | esc no mapa | fechar o dsei
**resposta:** No MONITORA, com um DSEI aberto, o botão "← Voltar ao Brasil" no topo do mapa (ou a tecla Esc, com o foco no mapa) fecha o distrito: o mapa se afasta devagar até o Brasil inteiro, o filtro de DSEI sai da página e os outros filtros continuam. O foco volta à linha do DSEI em "Territórios por vagas". O chip "DSEI" dos filtros faz a mesma volta. Em tela cheia, o primeiro Esc volta ao Brasil e o segundo sai da tela cheia. Quem pediu menos movimento ao sistema vê o mapa voltar sem animação.
**fonte:** interface do MONITORA

## Tela cheia e mapa no celular

**perguntas:** mapa em tela cheia | expandir o mapa | mapa no celular | legenda fechada no celular
**resposta:** No MONITORA, "Tela cheia" faz o mapa ocupar a janela; "Sair da tela cheia" ou a tecla Esc voltam (com um DSEI aberto, o primeiro Esc volta ao Brasil e o segundo sai da tela cheia). Os controles continuam no topo. No celular, a lista fica abaixo do mapa. A legenda do mapa nacional abre pelo botão "Legenda". Sem internet, o fundo do mapa não carrega, mas a lista de territórios continua.
**fonte:** interface do MONITORA

## Corrigir coordenadas de um ponto

**perguntas:** corrigir coordenadas | editar latitude e longitude | arrastar o pin | mover ponto no mapa | alterar localizacao da unidade | como usar o editor de coordenadas
**resposta:** O administrador global e o Gestor podem usar "Coordenadas" no mapa da Saúde Indígena, no Brasil ou dentro de um DSEI. A lista do editor substitui a lista lateral: busque pelo nome, CNES, município ou DSEI e clique no ponto — o mapa centraliza nele e aparece um pin de prévia. Para ajustar a posição, digite latitude e longitude ou arraste o pin de prévia; a posição atual só muda depois de confirmar. Confira a posição atual e a prévia, informe o motivo e a fonte da correção, clique em "Salvar coordenada" e depois em "Confirmar correção". "Desfazer prévia" volta à posição atual sem salvar. Se outra pessoa já mudou o ponto, atualize o mapa antes de tentar novamente. Essa opção não aparece para os demais perfis.
**fonte:** src/modulos/mapa-saude-indigena/editor-de-coordenadas.jsx; supabase/migrations/20261002160000_conferir_coordenadas_mapa.sql

## Pontos pendentes de conferência

**perguntas:** pontos pendentes | filtro so pendentes | provavel erro | gravidade das pendencias | so confirmar | fila de coordenadas | conferir coordenada | marcar como conferido | botao conferido | 248 pendencias | 249 pendencias | 93 polos e 156 ubsi | ponto em validacao
**resposta:** A auditoria das coordenadas de 01 e 02/10/2026 não conseguiu confirmar 248 pontos com duas fontes independentes: 92 polos base e 156 UBSI/postos (a auditoria conta 93 + 156 = 249 porque o posto Aldeia Linha 10, de Porto Velho, entrou nas duas rodadas). No editor de coordenadas, "Só pendentes" vem ligado e mostra só esses pontos, ordenados por DSEI, com a contagem ("N pendentes"). Para cada um, confira a posição com o DSEI ou com as fontes sugeridas e clique em "Conferido" — a posição pode continuar a mesma (às vezes já está certa) ou ser ajustada antes. É preciso informar o motivo e confirmar. Depois de conferido, o ponto sai de "Só pendentes"; desligando o filtro, ele aparece com o selo "Conferido". O mapa público não mostra "em validação": a situação só aparece no editor. A fila separa as pendências por gravidade, com a contagem de cada uma e o provável erro primeiro: Provável erro (o ponto está na sede do município, num ponto coletor, na posição do nome do município ou numa aldeia de mesmo nome fora do DSEI, ou a aldeia sugerida mais perto está a mais de 10 km), Revisar (aldeia sugerida entre 2 e 10 km, ou só o CNES), Sem sugestão (nenhuma posição candidata: buscar a aldeia à mão) e Só confirmar (há aldeia sugerida a até 2 km: a posição bate e falta só o Conferido). O CNES não serve de régua porque quase sempre é a própria posição atual. Ao escolher um ponto, as sugestões aparecem no mapa (aldeias em laranja, CNES em azul) e a mais provável fica ligada à posição atual por uma linha tracejada; clicar numa sugestão do mapa ou em Usar esta preenche a prévia.
**fonte:** src/lib/coordenadas-do-mapa.js; supabase/migrations/20261002160000_conferir_coordenadas_mapa.sql; supabase/correcoes/20261002-pendencias-das-coordenadas-do-mapa.sql

## Sugestões de posição de um ponto pendente

**perguntas:** sugestoes de posicao | usar esta | candidatos da coordenada | posicao do cnes | aldeia do ibge | aldeia da funai | distancia da posicao atual
**resposta:** Ao escolher um ponto pendente, o editor mostra por que a auditoria não o confirmou e as posições candidatas: primeiro a do cadastro CNES (DATASUS), depois aldeias e lugares com o mesmo nome (IBGE, Funai, OpenStreetMap, PDSI) e, quando conhecida, a sede do município, cada uma com a distância até a posição atual. "Usar esta" só leva a posição para a prévia (o pin se move); nada é gravado até "Salvar coordenada" ou "Conferido" serem confirmados. Candidato não é prova: confira com o DSEI quando as fontes divergirem.
**fonte:** src/lib/coordenadas-do-mapa.js; src/modulos/editor-de-coordenadas/sugestoes-do-ponto.jsx

## Histórico e desfazer de uma correção

**perguntas:** historico da coordenada | quem mudou o ponto | desfazer correcao | desfazer conferencia | voltar posicao anterior
**resposta:** Abaixo do formulário, o editor mostra as últimas alterações do ponto: o tipo (Correção, Conferido ou Desfeito), quem fez, quando, a posição de antes e a de depois e o motivo. "Desfazer última alteração" volta a mais recente — a posição e, se for o caso, a conferência —, pede um motivo e grava isso como uma alteração nova: o histórico nunca é apagado. Só a última alteração de cada ponto pode ser desfeita, uma vez só; um desfazer não se desfaz (corrija a posição de novo).
**fonte:** src/modulos/editor-de-coordenadas/historico-do-ponto.jsx; supabase/migrations/20261002160000_conferir_coordenadas_mapa.sql
