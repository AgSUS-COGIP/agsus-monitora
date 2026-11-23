# Regras do mapa da Saúde Indígena

O mapa da Saúde Indígena (a página Mapa) mostra só rótulos, números e
controles; o porquê fica aqui, para a Aya explicar. Até 18/11/2026 ele ficava
na Visão geral; agora ela tem só o cartão do mapa. Textos que saíram da tela com o mapa
em React (01/10/2026): a dica "Escolha um DSEI no mapa para ver polos e
unidades", o "clique para abrir o território" das bolhas, o aviso "Visão do
Brasil. Os filtros continuam valendo" e os textos longos das listas vazias. O
modo Calor saiu em 02/10/2026.

## Página Mapa

**perguntas:** mapa | pagina mapa | para que serve mapa | para que serve a pagina mapa | onde fica o mapa | onde esta o mapa | mapa saiu da visao geral | aba mapa | endereco do dsei | link do dsei no mapa
**resposta:** No Yeendé, a página Mapa, no bloco Acompanhar do menu da Saúde Indígena, é o mapa dos DSEIs com a página toda para ele: as bolhas dos 34 distritos, as CASAIs nacionais, a lista "Territórios por vagas", as Terras Indígenas, o satélite e a tela cheia. Clicar num DSEI abre o mapa dele, e o endereço muda para o do distrito (por exemplo, /saude-indigena/mapa/yanomami): o link copiado abre o mapa já nele, e o voltar do navegador volta ao Brasil. O mapa conta todos os editais da área, sem os filtros da Visão geral, com as mesmas contas dos indicadores. Quem abre a Visão geral abre o Mapa. A Visão geral ficou com um cartão pequeno: quantos DSEIs têm edital, o que tem mais vagas ociosas e o menos preenchido; o nome do DSEI abre o Mapa nele, e "Abrir no mapa", no Brasil.
**fonte:** src/modulos/mapa/; src/modulos/visao-geral/cartao-do-mapa.tsx
**abrir:** mapa

## Como usar o mapa da Saúde Indígena

**perguntas:** como usar o mapa | como abrir um dsei no mapa | ver polos e unidades | abrir o territorio | mapa detalhado do dsei | como uso o mapa dos dseis | mapa dos dseis | mapa da saude indigena
**resposta:** No Yeendé, a visão nacional do mapa mostra uma bolha por DSEI e, ao lado, a lista "Territórios por vagas". Clicar numa bolha ou numa linha da lista abre o mapa daquele DSEI, com os polos base, CASAIs, UBSIs e demais unidades, e o endereço da página passa a ser o do DSEI. O mapa desce do Brasil até o distrito, em menos de um segundo, para quem abre não perder onde está. "← Voltar ao Brasil", no topo do mapa do DSEI ou no canto de baixo à esquerda do próprio mapa, volta à visão nacional (a tecla Esc faz o mesmo). Pelo teclado, Tab chega às bolhas; o foco abre o cartão do DSEI e Enter abre o distrito.
**fonte:** interface do Yeendé

## Bolhas dos DSEIs no mapa

**perguntas:** bolha do mapa | tamanho da bolha | cor da bolha | bolha verde | bolha azul | dsei com processo ativo
**resposta:** No Yeendé, cada bolha da visão nacional fica na sede do DSEI, na posição cadastrada no SIGEPSI. O tamanho segue a população indígena atendida (a área da bolha é proporcional à população). Verde com borda amarela é DSEI com edital; azul, sem edital. O mapa mostra todos os DSEIs, com os editais da área inteira. Passar o mouse (ou chegar pelo teclado) na bolha abre o cartão do DSEI: população, quantos polos base o distrito tem, quantos pontos o mapa desenha, as UFs administrativas e os números do recorte (editais, vagas, contratadas, ociosas e % preenchidas, com a barra na cor de "Territórios por vagas"). O losango da CASAI nacional mostra o mesmo cartão, com os números dela. São as mesmas contas da lista e dos indicadores do topo.
**fonte:** interface do Yeendé

## Mapa de calor

**perguntas:** botao calor | modo calor | mapa de calor | mapa sem calor
**resposta:** No Yeendé, o mapa da Saúde Indígena não tem modo de calor: a bolha só diz se o DSEI tem edital (verde) ou não (azul). As vagas ociosas de cada DSEI aparecem na dica da bolha e, como preenchimento, na barra de "Territórios por vagas"; a taxa de ociosidade de cada edital fica na tabela da Visão geral.
**fonte:** interface do Yeendé

## Territórios por vagas

**perguntas:** territorios por vagas | lista ao lado do mapa | ranking dos dseis | barra de preenchidas | porcentagem preenchidas | ordenar territorios | ordem alfabetica dos dseis | ordenar por numero do dsei
**resposta:** No Yeendé, "Territórios por vagas" lista os mesmos DSEIs que o mapa desenha, do que tem mais vagas para o que tem menos (empate decidido pela população). "Ordenar", no topo da lista, troca a ordem: Vagas, A–Z, Nº do DSEI (a numeração 1–34 do Mapa DSEIs), % preenchidas ou Ociosas; empates vão pelo nome, e o título da lista acompanha a ordem. Sem escolha, a lista fica por vagas no Mapa e no Satélite e pelo nº do DSEI no Mapa DSEIs; a escolha fica guardada neste navegador e vale para todos os fundos. A barra é o preenchimento: vagas menos ociosas, divididas pelas vagas. Acima de 80% preenchidas fica verde, de 41% a 80% amarela e até 40% vermelha. Clicar na linha abre o DSEI, como clicar na bolha.
**fonte:** interface do Yeendé

## Mapa DSEIs

**perguntas:** botao mapa dseis | mapa simples | numero do dsei no mapa | colorir por | dseis numerados | mapa sem fundo de ruas | sem dado no mapa | contorno dos dseis
**resposta:** No Yeendé, o botão "Mapa DSEIs" (ao lado de Mapa e Satélite, no mapa nacional da Saúde Indígena) troca o fundo de ruas por um fundo liso e pinta as áreas dos 34 DSEIs, cada uma com o seu número. É o fundo com que o mapa abre para todos; quem escolhe Mapa ou Satélite tem a escolha guardada neste navegador. A numeração é a ordem alfabética oficial: 1 Alagoas e Sergipe até 34 Yanomami; a lista "Territórios por vagas" mostra o mesmo número. "Colorir por" escolhe a cor: uma cor fixa por DSEI (padrão; a cor só identifica o DSEI, não indica situação), % preenchidas (cinco faixas de 20 pontos) ou vagas ociosas (cinco faixas pelos valores do recorte). DSEI fora do recorte ou sem vaga fica cinza, "sem dado". Passar o mouse num DSEI realça a linha da lista e vice-versa; clicar abre o DSEI. Nesse modo as sedes e as CASAIs começam ligadas ("Sedes e CASAIs" as desliga) e as Terras Indígenas, desligadas (o botão "Terras Indígenas" as liga). As áreas são as da camada de abrangência dos DSEIs publicada pela Funai (cópia de 20/04/2022): cobrem as regiões com atendimento, não o país inteiro.
**fonte:** interface do Yeendé; Funai, camada areas_dsei

## Destacar no mapa

**perguntas:** destacar no mapa | pontos de interesse | chips do mapa | dseis com vagas ociosas no mapa | menos de 40% preenchidas | acesso so aereo ou fluvial | acender dseis no mapa | dsei remoto no mapa
**resposta:** No Yeendé, os botões acima do mapa nacional acendem os DSEIs que atendem a um critério e apagam os outros, no mapa e na lista "Territórios por vagas". "Com vagas ociosas" acende quem tem vaga ociosa; "Menos de 40% preenchidas", quem tem vaga e preencheu menos de 40% dela (DSEI sem vaga não entra); "Acesso só aéreo ou fluvial", quem tem ao menos uma unidade que, no SIGEPSI, só se alcança por avião ou barco. O número ao lado é quantos DSEIs acendem. Um destaque por vez; clicar de novo apaga. O de acesso só aparece quando o SIGEPSI traz o meio de acesso das unidades. No fundo "Mapa DSEIs" os botões saem, porque lá a cor vem de "Colorir por". As contas são as mesmas da lista e dos indicadores, nada é recontado.
**fonte:** src/lib/mapas/mapa-saude-indigena/pontos-de-interesse.ts

## Duas bolhas no mesmo lugar do mapa

**perguntas:** bolhas sobrepostas | leque no mapa | traco ate o ponto | yanomami e leste de roraima no mapa
**resposta:** No Yeendé, quando duas sedes caem no mesmo ponto da tela (Yanomami e Leste de Roraima, ambas em Boa Vista), as bolhas abrem num pequeno leque em volta do ponto real, com um traço até ele. A coordenada não muda; ao aproximar o zoom, cada bolha volta ao seu lugar. No mapa do DSEI vale o mesmo para unidades a menos de 14 pixels uma da outra.
**fonte:** interface do Yeendé

## CASAI Nacional no mapa

**perguntas:** casai nacional no mapa | losango roxo | clicar na casai nacional | casai no seletor | escolher casai df | casai sao paulo no mapa | dsei / casai
**resposta:** No Yeendé, o losango roxo marca as CASAIs de referência nacional (CASAI DF, em Brasília, e CASAI São Paulo), desenhadas a partir do SIGEPSI. Clicar nele abre a Visão geral filtrada pela busca "CASAI" mais o nome da cidade. No seletor "DSEI / CASAI" da página Mapa as duas ficam no grupo "CASAIs nacionais": escolher uma leva o mapa voando até ela e mostra o município, a UF e os processos seletivos dela (os editais "CASAI Brasília" e "CASAI São Paulo", contados pelo nome ou pela cidade), com "Abrir na Visão geral". O endereço passa a ser o da CASAI (por exemplo, /saude-indigena/mapa/casai-df). As CASAIs nacionais não têm unidades próprias no mapa.
**fonte:** interface do Yeendé

## Formas dos marcadores no mapa do DSEI

**perguntas:** estrela no mapa | formas do mapa | legenda do mapa do dsei | circulo laranja | cruz roxa | casa vermelha
**resposta:** No Yeendé, o mapa do DSEI usa forma além de cor, para quem não distingue as cores: estrela grafite é a sede do DSEI, círculo laranja é polo base, casa vermelha é CASAI, cruz violeta é UBSI e losango verde-azulado é outra unidade de saúde. Os botões acima da lista de unidades escondem ou mostram cada tipo, na lista e no mapa.
**fonte:** interface do Yeendé

## Vínculo fora da área do DSEI

**perguntas:** vinculo fora da area | linha pontilhada no mapa | mostrar vinculos externos | unidade fora da area do dsei
**resposta:** No Yeendé, a UF de cada unidade vem do SIGEPSI (pelo CEP do ponto); quando ela não está entre as UFs de abrangência do DSEI, a unidade fica no lugar verdadeiro com um anel tracejado e uma linha pontilhada até a sede. A linha é vínculo administrativo, não trajeto. O mapa abre enquadrando só o território; "Mostrar vínculos externos" amplia para incluir essas unidades. Unidade sem UF no SIGEPSI (sem CEP) não é tratada como externa nem herda a UF da sede: a dica avisa que o vínculo não foi classificado.
**fonte:** interface do Yeendé

## Polos base e pontos no mapa

**perguntas:** polos base e pontos no mapa | por que o numero de polos diverge | no mapa pontos | contagem da dica do dsei
**resposta:** No Yeendé, a dica do DSEI responde a duas perguntas: "Polos base" é quantos polos base o distrito tem no SIGEPSI; "No mapa" é quantos pontos o mapa desenha (polos, ROTA, unidades e CASAIs, todos do SIGEPSI). Os números podem divergir porque o mapa também desenha as CASAIs e as unidades de lotação, e a ROTA conta como polo.
**fonte:** interface do Yeendé

## O que o popup de uma unidade mostra

**perguntas:** popup da unidade | o que o popup mostra | localizacao validada | fontes discordam | localizacao em validacao | coordenada confirmada | ponto do polo esta certo
**resposta:** No Yeendé, o popup de cada ponto do mapa do DSEI traz só o que a unidade é: tipo, nome, município e UF e o código CNES (quando há). Não há frases como "Localização em validação", "Fontes discordam" ou "validada". A lista de DSEIs, a sede, os polos base, as CASAIs (todas, inclusive as nacionais) e as unidades de lotação de cada um vêm do SIGEPSI, a fonte verdadeira dos pontos, lidos a cada abertura do mapa; do banco do Yeendé vêm só o nome bem grafado, a população (o tamanho da bolha) e as UFs administrativas de cada DSEI. Se um ponto parecer errado, a correção é feita no próprio SIGEPSI: o mapa não tem editor de coordenadas.
**fonte:** src/lib/mapas/mapa-saude-indigena/localizacoes-do-sigepsi.ts; src/lib/mapas/mapa-saude-indigena/mapa-do-dsei.ts

## Terras Indígenas no mapa

**perguntas:** terras indigenas no mapa | fases das terras | homologada no mapa | em estudo no mapa | lista de terras e povos | povo nao declarado
**resposta:** No Yeendé, as Terras Indígenas vêm da Funai e aparecem em três fases, cada uma um interruptor na legenda: homologada ou regularizada (limite contínuo), em processo (tracejado) e em estudo (círculo tracejado, sem limite publicado). No mapa do DSEI, a lista "Terras Indígenas e povos" traz as terras que caem na área do distrito; clicar leva o mapa até a terra. Quando a Funai não declara o povo, a lista diz isso em vez de inventar.
**fonte:** interface do Yeendé

## Voltar ao Brasil

**perguntas:** voltar ao brasil | sair do dsei | voltar para a visao geral do mapa | voltar ao mapa nacional | esc no mapa | fechar o dsei
**resposta:** No Yeendé, com um DSEI aberto, o botão "← Voltar ao Brasil" no topo do mapa ou o fixo no canto de baixo à esquerda do próprio mapa (ou a tecla Esc, com o foco no mapa; o botão do canto mostra o atalho) fecha o distrito: o mapa se afasta devagar até o Brasil inteiro e o endereço volta a ser o da página Mapa. O botão "Brasil" do mapa nacional também volta voando ao país inteiro. O foco volta à linha do DSEI em "Territórios por vagas". O voltar do navegador faz a mesma volta. Em tela cheia, o primeiro Esc volta ao Brasil e o segundo sai da tela cheia. Quem pediu menos movimento ao sistema vê o mapa ir e voltar sem animação (abrir um DSEI, escolher uma CASAI, voltar ao Brasil).
**fonte:** interface do Yeendé

## Tela cheia e mapa no celular

**perguntas:** mapa em tela cheia | expandir o mapa | mapa no celular | legenda fechada no celular
**resposta:** No Yeendé, o mapa da Saúde Indígena ocupa a página Mapa e não se recolhe. "Tela cheia" faz o mapa ocupar a janela; "Sair da tela cheia" ou a tecla Esc voltam (com um DSEI aberto, o primeiro Esc volta ao Brasil e o segundo sai da tela cheia). Os controles continuam no topo. No celular, a lista fica abaixo do mapa. A legenda do mapa nacional abre pelo botão "Legenda". Sem internet, o fundo do mapa não carrega, mas a lista de territórios continua.
**fonte:** interface do Yeendé

## Corrigir coordenadas de um ponto

**perguntas:** corrigir coordenadas | editar latitude e longitude | arrastar o pin | mover ponto no mapa | alterar localizacao da unidade | como usar o editor de coordenadas | botao coordenadas | pontos pendentes | marcar como conferido
**resposta:** No mapa da Saúde Indígena os pontos (sede, polos base, CASAIs e unidades) vêm do SIGEPSI, e o mapa não tem editor de coordenadas nem botão "Coordenadas", fila de pendências ou "Conferido". Para corrigir um ponto, peça a correção no próprio SIGEPSI; o mapa passa a mostrar a posição nova na abertura seguinte. O editor de coordenadas existe só no mapa de Projetos (veja as regras do mapa de Projetos).
**fonte:** src/lib/mapas/mapa-saude-indigena/localizacoes-do-sigepsi.ts; src/modulos/mapa-saude-indigena/localizacoes.ts

## Processos seletivos do DSEI no mapa

**perguntas:** processos seletivos do dsei | cartao processos seletivos | editais abertos do dsei | vagas do dsei no mapa | aguardando chamada no mapa | abrir na visao geral pelo mapa
**resposta:** No Yeendé, com um DSEI aberto na página Mapa, o cartão "Processos seletivos" mostra os editais abertos (nem concluídos nem cancelados), as vagas, as contratadas, as em seleção, as ociosas e as pessoas aguardando chamada daquele DSEI, pelas mesmas contas da Visão geral. Em seleção e Ociosas aparecem como "—" quando nenhum edital do DSEI está naquela situação; Aguardando chamada fica "—" quando nenhum edital tem lista de aprovados. "Abrir na Visão geral" abre a Visão geral com o filtro Unidade nas unidades do DSEI. O cartão vem dos editais do Yeendé e não depende do SIGEPSI.
**fonte:** src/lib/mapas/mapa-saude-indigena/processos-do-dsei.ts; src/modulos/mapa-saude-indigena/processos-do-dsei.tsx
**abrir:** mapa

## Território do DSEI no mapa

**perguntas:** territorio do dsei | populacao indigena do dsei | aldeias no cartao territorio | terras indigenas do dsei | quantas aldeias | quantas terras indigenas
**resposta:** No Yeendé, com um DSEI aberto na página Mapa, o cartão "Território" mostra a população indígena, as aldeias e as terras indígenas do distrito, lidas do SIGEPSI (dados do SIASI). As terras contam uma vez cada, pelo código: a terra que atravessa dois DSEIs aparece nos dois, mas não conta em dobro num total. Enquanto o SIGEPSI não libera esse dado para o Yeendé (em novembro de 2026 ainda não liberava), o cartão diz "Dado do SIGEPSI indisponível", nunca zero.
**fonte:** src/lib/mapas/mapa-saude-indigena/territorio-do-sigepsi.ts; api/territorio-dos-dseis.ts
**abrir:** mapa

## Meio de acesso, floresta e CNES das unidades

**perguntas:** meio de acesso | acesso fluvial | acesso aereo | acesso terrestre | area de floresta | unidade em floresta | cnes da unidade | tabela de unidades do dsei | exportar unidades do dsei | acesso e vagas ociosas | dado do sigepsi indisponivel
**resposta:** No Yeendé, as unidades do DSEI aberto na página Mapa trazem do SIGEPSI o meio de acesso (Terrestre, Fluvial, Aéreo; uma unidade pode ter mais de um), a acessibilidade geográfica (de Muito acessível a Muito remoto), se é urbana ou rural, se fica em área de floresta e o CNES. O CNES casa com a unidade pelo nome, porque o SIGEPSI não liga os dois por código; sem casamento seguro, fica "—". A tabela "Unidades" tem os filtros Meio de acesso e Área de floresta e sai em "Exportar em Excel" e "Salvar em PDF". No Brasil, "Acesso e vagas ociosas" lista os DSEIs com alguma unidade no filtro, com as vagas e as vagas ociosas de cada um; o nome abre o DSEI. O meio de acesso, a acessibilidade, urbano/rural e floresta vêm do mesmo cadastro de localizações que desenha os pontos. O CNES depende de o SIGEPSI liberar a rota da rede para o Yeendé; enquanto não libera, a coluna dá lugar a "CNES: Dado do SIGEPSI indisponível" e o resto continua.
**fonte:** src/lib/mapas/mapa-saude-indigena/territorio-na-tela.ts; src/modulos/mapa-saude-indigena/territorio-do-dsei.tsx
**abrir:** mapa

## Quando o SIGEPSI não responde

**perguntas:** nao foi possivel carregar o mapa da saude indigena | o sigepsi nao respondeu | tentar novamente no mapa | mapa em branco | erro no mapa dos dseis | mapa carregando
**resposta:** No Yeendé, o mapa da Saúde Indígena depende do SIGEPSI para a lista de DSEIs e para todos os pontos e não tem plano B. Enquanto o SIGEPSI não responde, o mapa fica em "carregando". Se ele falhar, a página Mapa mostra "Não foi possível carregar o mapa da Saúde Indígena: o SIGEPSI não respondeu", com o botão "Tentar novamente"; o mesmo vale no servidor local, que não tem a rota do SIGEPSI. DSEI que só existe no cadastro do banco, sem aparecer no SIGEPSI, não é desenhado.
**fonte:** src/modulos/mapa/mapa.tsx; src/modulos/mapa-saude-indigena/localizacoes.ts
