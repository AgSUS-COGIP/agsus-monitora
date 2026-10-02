# Regras do mapa da Saúde Indígena

O mapa da Visão geral (Saúde Indígena) mostra só rótulos, números e controles;
o porquê fica aqui, para a Aya explicar. Textos que saíram da tela com o mapa
em React (01/10/2026): a dica "Escolha um DSEI no mapa para ver polos e
unidades", o "clique para abrir o território" das bolhas, os avisos "Mapa de
calor: cor por % de vagas ociosas" e "Visão do Brasil. Os filtros continuam
valendo", e os textos longos das listas vazias.

## Como usar o mapa da Saúde Indígena

**perguntas:** como usar o mapa | como abrir um dsei no mapa | ver polos e unidades | abrir o territorio | mapa detalhado do dsei
**resposta:** No MONITORA, a visão nacional do mapa mostra uma bolha por DSEI e, ao lado, a lista "Territórios por vagas". Clicar numa bolha ou numa linha da lista abre o mapa daquele DSEI, com os polos base, CASAIs, UBSIs e demais unidades, e recorta a página inteira (indicadores e tabela) por ele. "Brasil", no trilho acima do mapa, volta à visão nacional sem apagar os outros filtros.
**fonte:** interface do MONITORA

## Bolhas dos DSEIs no mapa

**perguntas:** bolha do mapa | tamanho da bolha | cor da bolha | bolha verde | bolha azul | dsei com processo ativo
**resposta:** No MONITORA, cada bolha da visão nacional fica na sede do DSEI. O tamanho segue a população indígena atendida (a área da bolha é proporcional à população). Verde com borda amarela é DSEI com edital no recorte atual; azul, sem edital. Com algum filtro ativo, só aparecem os DSEIs que têm edital no resultado. A dica da bolha traz população, quantos polos base o distrito tem, quantos pontos o mapa desenha, as UFs administrativas, os processos seletivos e as vagas ociosas.
**fonte:** interface do MONITORA

## Botão Calor do mapa

**perguntas:** botao calor | modo calor | cores do mapa de calor | faixas do mapa de calor
**resposta:** No MONITORA, o botão Calor pinta cada bolha pela porcentagem de vagas ociosas do DSEI no recorte: verde abaixo de 20%, amarelo de 20% a 39%, laranja de 40% a 59% e vermelho a partir de 60%. DSEI sem edital fica cinza. Com o calor ligado, a legenda mostra as faixas.
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
**resposta:** No MONITORA, o popup de cada ponto do mapa do DSEI traz só o que a unidade é: tipo, nome, município e UF e o código CNES (quando há). Não há mais frases como "Localização em validação", "Fontes discordam" ou "validada": elas vinham de uma validação de 22/09/2026 anterior à auditoria oficial e foram retiradas em 02/10/2026. Toda coordenada vem do banco (lmap para polos e sedes, rede_cnes para os estabelecimentos), auditada em 01 e 02/10/2026 contra fontes oficiais (CNES, IBGE, Funai, PDSI e OpenStreetMap); 93 polos ainda aguardam confirmação do DSEI. Se um ponto parecer errado, a correção é feita no banco.
**fonte:** docs/auditoria-oficial-das-coordenadas-2026-10-01.md; src/lib/mapa-saude-indigena/mapa-do-dsei.js

## Terras Indígenas no mapa

**perguntas:** terras indigenas no mapa | fases das terras | homologada no mapa | em estudo no mapa | lista de terras e povos | povo nao declarado
**resposta:** No MONITORA, as Terras Indígenas vêm da Funai e aparecem em três fases, cada uma um interruptor na legenda: homologada ou regularizada (limite contínuo), em processo (tracejado) e em estudo (círculo tracejado, sem limite publicado). No mapa do DSEI, a lista "Terras Indígenas e povos" traz as terras que caem na área do distrito; clicar leva o mapa até a terra. Quando a Funai não declara o povo, a lista diz isso em vez de inventar.
**fonte:** interface do MONITORA

## Tela cheia e mapa no celular

**perguntas:** mapa em tela cheia | expandir o mapa | mapa no celular | legenda fechada no celular
**resposta:** No MONITORA, "Tela cheia" faz o mapa ocupar a janela; "Recolher" ou a tecla Esc voltam. No celular, a lista fica abaixo do mapa e a legenda começa fechada (o botão "Legenda" abre). Sem internet, o fundo do mapa não carrega, mas a lista de territórios continua.
**fonte:** interface do MONITORA

## Corrigir coordenadas de um ponto

**perguntas:** corrigir coordenadas | editar latitude e longitude | arrastar o pin | mover ponto no mapa | alterar localizacao da unidade
**resposta:** O administrador global pode usar "Coordenadas" no mapa da Saúde Indígena, no Brasil ou dentro de um DSEI. Escolha o ponto, digite latitude e longitude ou arraste o pin de prévia. Confira a posição atual e a prévia, informe o motivo e a fonte da correção, clique em "Salvar coordenada" e depois em "Confirmar correção". "Desfazer prévia" volta à posição atual sem salvar. A alteração fica no histórico. Se outra pessoa já mudou o ponto, atualize o mapa antes de tentar novamente. Essa opção não aparece para os demais perfis.
**fonte:** src/modulos/mapa-saude-indigena/editor-de-coordenadas.jsx; supabase/migrations/20261002143323_editar_coordenadas_mapa_admin.sql
