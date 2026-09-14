# Equipe Núcleo e mapas

Guia de uso das duas áreas. Linguagem operacional: o que cada coisa mostra, o
que ela significa e o que fazer quando não aparece.

## Equipe Núcleo

### Para que serve

A Equipe Núcleo acompanha os cronogramas dos editais. O painel
**Acompanhamento operacional**, no topo da fila, resume em seis indicadores o
estado de todos os editais ativos e sinaliza quais deles exigem atenção.

### Os seis indicadores

| Indicador           | O que conta                                                               |
| ------------------- | ------------------------------------------------------------------------- |
| **Editais ativos**  | Todos os editais no resumo. É o total de referência.                      |
| **Em andamento**    | Editais com situação _Em andamento_ ou _Planejado_.                       |
| **Sem cronograma**  | Editais sem nenhuma etapa cadastrada.                                     |
| **Incompletos**     | Editais com cronograma começado, mas com etapas em falta.                 |
| **Próximos 7 dias** | Editais cuja próxima etapa vence em até 7 dias — inclui os de até 3 dias. |
| **Excepcionais**    | Editais em situação excepcional, registrada manualmente.                  |

### Filtrar a fila

Cada indicador é um botão. Clicar filtra a fila abaixo para mostrar apenas os
editais daquele grupo; clicar de novo noutro indicador troca o filtro.

Com um filtro aplicado aparece a tarja **Filtro operacional ativo**, com o
botão **Limpar** para voltar a ver tudo. O indicador aplicado fica marcado
também para leitores de tela, não só pela cor.

### Atualizar

O botão **Atualizar**, no canto do painel, relê o resumo. Enquanto o pedido
corre, o botão fica desativado e os indicadores atuais permanecem na tela — a
grade não pisca nem se esvazia.

O resumo também é relido sozinho em duas situações: ao entrar na aplicação e
depois de gravar um cronograma.

### Os alertas na fila

Cada linha da fila recebe uma etiqueta com o seu alerta:

| Etiqueta                        | Significado                                |
| ------------------------------- | ------------------------------------------ |
| **Sem cronograma**              | Nenhuma etapa cadastrada.                  |
| **Cronograma incompleto**       | Faltam etapas para o cronograma fechar.    |
| **Próxima etapa em até 3 dias** | Prazo imediato.                            |
| **Próxima etapa em até 7 dias** | Prazo próximo.                             |
| **Situação excepcional**        | Registro manual de exceção.                |
| **Cronograma regular**          | Sem pendência. Não gera etiqueta na linha. |

### Quando o painel não mostra indicadores

O painel diz em que ponto está, em vez de mostrar números que ainda não apurou:

- **Carregando os alertas da Equipe Núcleo** — o resumo foi pedido e ainda não
  chegou.
- **Nenhum edital ativo na Equipe Núcleo** — o resumo chegou e está vazio. Não
  é falha: não há edital cadastrado.
- **Não foi possível carregar os alertas** — o pedido falhou. Há o botão
  **Tentar de novo**. O detalhe técnico da falha fica no console do navegador,
  não na tela.

Zeros nos indicadores são sempre um dado apurado. Enquanto o resumo não chega,
a grade fica vazia — nunca zerada.

## Mapas

### Mapa e Satélite

No canto superior esquerdo de cada mapa há dois botões, **Mapa** e **Satélite**.

- **Mapa** é a vista cartográfica: fronteiras, nomes e estradas desenhados. Serve
  para localizar e para ler rótulos.
- **Satélite** é imagem aérea real, do World Imagery da Esri. Serve para ver o
  terreno — vegetação, rios, estradas de terra, o que existe de fato em volta de
  um polo.

A escolha fica guardada no navegador e vale para a próxima visita. Ela é uma só
para a aplicação inteira, mas aplica-se a cada mapa no momento em que ele é
criado: trocar a camada num mapa já aberto não troca a de outro que já estava na
tela — ao recarregar, ambos abrem na camada escolhida.

O botão selecionado fica marcado também para leitores de tela, e o par de botões
é anunciado como um grupo chamado "Camada de fundo do mapa".

### Significado dos marcadores

A forma é a informação principal e a cor é reforço. Quem não distingue as cores
continua a distinguir as formas.

| Forma   | Significado      | Cor           |
| ------- | ---------------- | ------------- |
| Círculo | Polo base        | laranja       |
| Casa    | CASAI            | vermelho      |
| Cruz    | UBSI             | roxo          |
| Losango | Unidade de saúde | azul-petróleo |

A legenda, no rodapé do mapa detalhado, desenha as mesmas formas dos
marcadores — não bolinhas genéricas.

### Comportamento de zoom

O enquadramento inicial é o contorno real do Brasil, calculado a partir dos
vértices do país e não de um retângulo escrito à mão.

Arrastar o mapa mostra o contexto sul-americano em volta, mas não permite sair
para o oceano aberto nem criar cópias laterais do mundo.

O zoom máximo depende da camada em uso: 18 níveis no OpenStreetMap, 19 no CARTO
e 19 no satélite.

### Fallback de camada

Há duas quedas automáticas, e elas são independentes.

**Dentro da vista de mapa.** O fornecedor principal dos ladrilhos é o
OpenStreetMap. Quando quatro ladrilhos seguidos falham, a aplicação troca para o
CARTO e continua a desenhar o mapa.

**Do satélite para o mapa.** Quando quatro ladrilhos de satélite seguidos falham,
a aplicação volta sozinha à vista de mapa e grava essa volta como preferência —
para não reabrir num satélite que não carrega. O seletor pisca uma vez para
avisar que a troca não foi pedida por quem está a usar. Um ladrilho que carregue
zera a contagem, de modo que uma falha isolada não derruba a camada.

Se o mapa ficar cinzento e não recuperar em nenhuma das camadas, o problema está
na rede ou no acesso aos domínios dos fornecedores — não nos dados da aplicação.

### Lista de unidades

Ao lado do mapa detalhado, a lista é o índice do mapa: é por ela que se
encontra um polo ou uma CASAI sem varrer o mapa a olho. Cada item traz o nome
da unidade e, abaixo, o seu tipo.

Sem território selecionado, a lista explica o que fazer em vez de aparecer
vazia.
