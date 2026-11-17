# Regras do mapa da Saúde Indígena

O mapa da Visão geral (Saúde Indígena) mostra só rótulos, números e controles;
o porquê fica aqui, para a Aya explicar. Textos que saíram da tela com o mapa
em React (01/10/2026): a dica "Escolha um DSEI no mapa para ver polos e
unidades", o "clique para abrir o território" das bolhas, o aviso "Visão do
Brasil. Os filtros continuam valendo" e os textos longos das listas vazias. O
modo Calor saiu em 02/10/2026.

## Como usar o mapa da Saúde Indígena

**perguntas:** como usar o mapa | como abrir um dsei no mapa | ver polos e unidades | abrir o territorio | mapa detalhado do dsei | como uso o mapa dos dseis | mapa dos dseis | mapa da saude indigena
**resposta:** No Yeendé, a visão nacional do mapa mostra uma bolha por DSEI e, ao lado, a lista "Territórios por vagas". Clicar numa bolha ou numa linha da lista abre o mapa daquele DSEI, com os polos base, CASAIs, UBSIs e demais unidades, e recorta a página inteira (indicadores e tabela) por ele. "← Voltar ao Brasil", no topo do mapa do DSEI, volta à visão nacional sem apagar os outros filtros.
**fonte:** interface do Yeendé

## Bolhas dos DSEIs no mapa

**perguntas:** bolha do mapa | tamanho da bolha | cor da bolha | bolha verde | bolha azul | dsei com processo ativo
**resposta:** No Yeendé, cada bolha da visão nacional fica na sede do DSEI, na posição cadastrada no SIGEPSI. O tamanho segue a população indígena atendida (a área da bolha é proporcional à população). Verde com borda amarela é DSEI com edital no recorte atual; azul, sem edital. Com algum filtro ativo, só aparecem os DSEIs que têm edital no resultado. A dica da bolha traz população, quantos polos base o distrito tem, quantos pontos o mapa desenha, as UFs administrativas, os processos seletivos e as vagas ociosas.
**fonte:** interface do Yeendé

## Mapa de calor

**perguntas:** botao calor | modo calor | mapa de calor | mapa sem calor
**resposta:** No Yeendé, o mapa da Saúde Indígena não tem modo de calor: a bolha só diz se o DSEI tem edital no recorte (verde) ou não (azul). As vagas ociosas de cada DSEI aparecem na dica da bolha e, como preenchimento, na barra de "Territórios por vagas"; a taxa de ociosidade de cada edital fica na tabela da Visão geral.
**fonte:** interface do Yeendé

## Territórios por vagas

**perguntas:** territorios por vagas | lista ao lado do mapa | ranking dos dseis | barra de preenchidas | porcentagem preenchidas | ordenar territorios | ordem alfabetica dos dseis | ordenar por numero do dsei
**resposta:** No Yeendé, "Territórios por vagas" lista os mesmos DSEIs que o mapa desenha, do que tem mais vagas para o que tem menos (empate decidido pela população). "Ordenar", no topo da lista, troca a ordem: Vagas, A–Z, Nº do DSEI (a numeração 1–34 do Mapa DSEIs), % preenchidas ou Ociosas; empates vão pelo nome, e o título da lista acompanha a ordem. Sem escolha, a lista fica por vagas no Mapa e no Satélite e pelo nº do DSEI no Mapa DSEIs; a escolha fica guardada neste navegador e vale para todos os fundos. A barra é o preenchimento: vagas menos ociosas, divididas pelas vagas. Acima de 80% preenchidas fica verde, de 41% a 80% amarela e até 40% vermelha. Clicar na linha abre o DSEI, como clicar na bolha.
**fonte:** interface do Yeendé

## Mapa DSEIs

**perguntas:** botao mapa dseis | mapa simples | numero do dsei no mapa | colorir por | dseis numerados | mapa sem fundo de ruas | sem dado no mapa | contorno dos dseis
**resposta:** No Yeendé, o botão "Mapa DSEIs" (ao lado de Mapa e Satélite, no mapa nacional da Saúde Indígena) troca o fundo de ruas por um fundo liso e pinta as áreas dos 34 DSEIs, cada uma com o seu número. É o fundo com que o mapa abre para todos; quem escolhe Mapa ou Satélite tem a escolha guardada neste navegador. A numeração é a ordem alfabética oficial: 1 Alagoas e Sergipe até 34 Yanomami; a lista "Territórios por vagas" mostra o mesmo número. "Colorir por" escolhe a cor: uma cor fixa por DSEI (padrão; a cor só identifica o DSEI, não indica situação), % preenchidas (cinco faixas de 20 pontos) ou vagas ociosas (cinco faixas pelos valores do recorte). DSEI fora do recorte ou sem vaga fica cinza, "sem dado". Passar o mouse num DSEI realça a linha da lista e vice-versa; clicar abre o DSEI. Nesse modo as sedes e as CASAIs começam ligadas ("Sedes e CASAIs" as desliga) e as Terras Indígenas, desligadas (o botão "Terras Indígenas" as liga). As áreas são as da camada de abrangência dos DSEIs publicada pela Funai (cópia de 20/04/2022): cobrem as regiões com atendimento, não o país inteiro.
**fonte:** interface do Yeendé; Funai, camada areas_dsei

## Duas bolhas no mesmo lugar do mapa

**perguntas:** bolhas sobrepostas | leque no mapa | traco ate o ponto | yanomami e leste de roraima no mapa
**resposta:** No Yeendé, quando duas sedes caem no mesmo ponto da tela (Yanomami e Leste de Roraima, ambas em Boa Vista), as bolhas abrem num pequeno leque em volta do ponto real, com um traço até ele. A coordenada não muda; ao aproximar o zoom, cada bolha volta ao seu lugar. No mapa do DSEI vale o mesmo para unidades a menos de 14 pixels uma da outra.
**fonte:** interface do Yeendé

## CASAI Nacional no mapa

**perguntas:** casai nacional no mapa | losango roxo | clicar na casai nacional
**resposta:** No Yeendé, o losango roxo marca as CASAIs de referência nacional (Brasília e São Paulo), desenhadas a partir do SIGEPSI. Clicar nele filtra a página pela busca "CASAI" mais o nome da cidade. Com filtro ativo, a CASAI só aparece se tiver edital no resultado.
**fonte:** interface do Yeendé

## Formas dos marcadores no mapa do DSEI

**perguntas:** estrela no mapa | formas do mapa | legenda do mapa do dsei | circulo laranja | cruz roxa | casa vermelha
**resposta:** No Yeendé, o mapa do DSEI usa forma além de cor, para quem não distingue as cores: estrela grafite é a sede do DSEI, círculo laranja é polo base, casa vermelha é CASAI, cruz violeta é UBSI e losango verde-azulado é outra unidade de saúde. Os botões acima da lista de unidades escondem ou mostram cada tipo, na lista e no mapa.
**fonte:** interface do Yeendé

## Vínculo fora da área do DSEI

**perguntas:** vinculo fora da area | linha pontilhada no mapa | mostrar vinculos externos | unidade fora da area do dsei
**resposta:** No Yeendé, a UF de cada unidade vem do SIGEPSI (pelo CEP do ponto); quando ela não está entre as UFs de abrangência do DSEI, a unidade fica no lugar verdadeiro com um anel tracejado e uma linha pontilhada até a sede. A linha é vínculo administrativo, não trajeto. O mapa abre enquadrando só o território; "Mostrar vínculos externos" amplia para incluir essas unidades. Unidade sem UF no SIGEPSI não é tratada como externa.
**fonte:** interface do Yeendé

## Polos base e pontos no mapa

**perguntas:** polos base e pontos no mapa | por que o numero de polos diverge | no mapa pontos | contagem da dica do dsei
**resposta:** No Yeendé, a dica do DSEI responde a duas perguntas: "Polos base" é quantos polos base o distrito tem no SIGEPSI; "No mapa" é quantos pontos o mapa desenha (polos, ROTA, unidades e CASAIs, todos do SIGEPSI). Os números podem divergir porque o mapa também desenha as CASAIs e as unidades de lotação, e a ROTA conta como polo.
**fonte:** interface do Yeendé

## O que o popup de uma unidade mostra

**perguntas:** popup da unidade | o que o popup mostra | localizacao validada | fontes discordam | localizacao em validacao | coordenada confirmada | ponto do polo esta certo
**resposta:** No Yeendé, o popup de cada ponto do mapa do DSEI traz só o que a unidade é: tipo, nome, município e UF e o código CNES (quando há). Não há frases como "Localização em validação", "Fontes discordam" ou "validada". A lista de DSEIs, a sede, os polos base, as CASAIs (todas, inclusive as nacionais) e as unidades de lotação de cada um vêm do SIGEPSI, a fonte verdadeira dos pontos, lidos a cada abertura do mapa; do banco do Yeendé vêm só o nome bem grafado, a população (o tamanho da bolha) e as UFs administrativas de cada DSEI. Se um ponto parecer errado, a correção é feita no próprio SIGEPSI: o mapa não tem editor de coordenadas.
**fonte:** src/lib/mapa-saude-indigena/localizacoes-do-sigepsi.ts; src/lib/mapa-saude-indigena/mapa-do-dsei.ts

## Terras Indígenas no mapa

**perguntas:** terras indigenas no mapa | fases das terras | homologada no mapa | em estudo no mapa | lista de terras e povos | povo nao declarado
**resposta:** No Yeendé, as Terras Indígenas vêm da Funai e aparecem em três fases, cada uma um interruptor na legenda: homologada ou regularizada (limite contínuo), em processo (tracejado) e em estudo (círculo tracejado, sem limite publicado). No mapa do DSEI, a lista "Terras Indígenas e povos" traz as terras que caem na área do distrito; clicar leva o mapa até a terra. Quando a Funai não declara o povo, a lista diz isso em vez de inventar.
**fonte:** interface do Yeendé

## Voltar ao Brasil

**perguntas:** voltar ao brasil | sair do dsei | voltar para a visao geral do mapa | voltar ao mapa nacional | esc no mapa | fechar o dsei
**resposta:** No Yeendé, com um DSEI aberto, o botão "← Voltar ao Brasil" no topo do mapa (ou a tecla Esc, com o foco no mapa) fecha o distrito: o mapa se afasta devagar até o Brasil inteiro, o filtro de DSEI sai da página e os outros filtros continuam. O foco volta à linha do DSEI em "Territórios por vagas". O chip "DSEI" dos filtros faz a mesma volta. Em tela cheia, o primeiro Esc volta ao Brasil e o segundo sai da tela cheia. Quem pediu menos movimento ao sistema vê o mapa voltar sem animação.
**fonte:** interface do Yeendé

## Tela cheia e mapa no celular

**perguntas:** mapa em tela cheia | expandir o mapa | mapa no celular | legenda fechada no celular
**resposta:** No Yeendé, "Recolher mapa" deixa só o cabeçalho do mapa na Visão geral, para as Fases e os Detalhes subirem; "Mostrar mapa" o traz de volta, e a escolha fica guardada no navegador de cada pessoa. "Tela cheia" faz o mapa ocupar a janela; "Sair da tela cheia" ou a tecla Esc voltam (com um DSEI aberto, o primeiro Esc volta ao Brasil e o segundo sai da tela cheia). Os controles continuam no topo. No celular, a lista fica abaixo do mapa. A legenda do mapa nacional abre pelo botão "Legenda". Sem internet, o fundo do mapa não carrega, mas a lista de territórios continua.
**fonte:** interface do Yeendé

## Corrigir coordenadas de um ponto

**perguntas:** corrigir coordenadas | editar latitude e longitude | arrastar o pin | mover ponto no mapa | alterar localizacao da unidade | como usar o editor de coordenadas | botao coordenadas | pontos pendentes | marcar como conferido
**resposta:** No mapa da Saúde Indígena os pontos (sede, polos base, CASAIs e unidades) vêm do SIGEPSI, e o mapa não tem editor de coordenadas nem botão "Coordenadas", fila de pendências ou "Conferido". Para corrigir um ponto, peça a correção no próprio SIGEPSI; o mapa passa a mostrar a posição nova na abertura seguinte. O editor de coordenadas existe só no mapa de Projetos (veja as regras do mapa de Projetos).
**fonte:** src/lib/mapa-saude-indigena/localizacoes-do-sigepsi.ts; src/modulos/mapa-saude-indigena/localizacoes.ts

## Quando o SIGEPSI não responde

**perguntas:** nao foi possivel carregar o mapa da saude indigena | o sigepsi nao respondeu | tentar novamente no mapa | mapa em branco | erro no mapa dos dseis | mapa carregando
**resposta:** No Yeendé, o mapa da Saúde Indígena depende do SIGEPSI para a lista de DSEIs e para todos os pontos e não tem plano B. Enquanto o SIGEPSI não responde, o mapa fica em "carregando". Se ele falhar, a Visão geral mostra "Não foi possível carregar o mapa da Saúde Indígena: o SIGEPSI não respondeu", com o botão "Tentar novamente"; o mesmo vale no servidor local, que não tem a rota do SIGEPSI. DSEI que só existe no cadastro do banco, sem aparecer no SIGEPSI, não é desenhado.
**fonte:** src/modulos/visao-geral/visao-geral.tsx; src/modulos/mapa-saude-indigena/localizacoes.ts
