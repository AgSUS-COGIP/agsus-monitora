# `src/modulos/aya/` — Aya, a assistente

A arara flutuante e o painel de conversa (cartão no canto inferior direito; tela cheia até 600px),
montados por `montarAya()` em `#ayaApp` (`src/main.js`). Substitui `src/modules/arara-guide.js`,
`arara-speaking-effects.js` e `nina-panel-drag.js`.

```
aya.jsx     <Aya> e montarAya(): arara arrastável, painel, sugestões, conversa,
            "Isso ajudou?", cartão "Abrir chamado", foco preso e Esc
estado.js   store sem React: view e título (o legado chama definirPaginaDaAya em
            setPageTitle), área atual e seção de Configurações aberta
contexto.js o que a tela já mostra: dados do mapa e da tabela, e estadoDaTela()
            (a aba marcada e o número do edital escolhido; nunca nome)
fontes.js   dados ao vivo das perguntas com número: o estado já carregado das
            telas ou as RPCs de leitura que elas já usam (guardadas por 1 min)
aya.css     só tokens; camada 10042 (acima do cabeçalho, abaixo do parabéns)
mascote/
  desenho.tsx   a arara-azul de corpo inteiro em SVG, em camadas (cauda, asa aberta,
                corpo, pés, asa fechada, coxa, cabeça, olho com anel e pálpebra,
                boca, bico inferior e superior, poleiro com sombra); cada parte
                recorta um conjunto único de tons; abaixo de 40px, versão chapada
  contornos.ts  os contornos e as faixas de luz, traçados da ilustração de
                referência (arara-azul-monitora.png, no histórico do git): só dados
  mascote.tsx   <Mascote>: estados parada, atenta, falando, pensando, comemorando,
                dormindo e acenando; piscar e arrepio sorteados (Web Animations),
                olho que segue o ponteiro (variáveis CSS), sono por inatividade,
                pausa com a aba oculta; montarMascoteAvulsa() para os fogos
  estado.ts     o pedido global (evento `aya:estado`) fora do React, com expiração
  mascote.css   só transform/opacity por data-estado; movimento reduzido: só pisca
tour/
  tour.jsx      <Tour>: véu com recorte no elemento da vez, balão (Pular/Anterior/Próximo,
                "Passo 2 de 6"), Esc, setas, foco preso, anúncio ao leitor de tela; pula o
                elemento ausente e, na trilha, troca de tela e espera o elemento;
                o recorte acompanha rolagem, redimensionamento e um ResizeObserver
                no elemento da vez (nada de MutationObserver)
  aprender.jsx  seção "Aprender" (trilhas do perfil e progresso) e a oferta de
                "Primeiros passos" da primeira entrada (uma vez)
  progresso.js  passo e conclusão de cada trilha, a oferta e os convites de tour de
                cada tela (primeira visita), no localStorage (try/catch)
  tour.css      só tokens; camada 10044
```

Os roteiros dos tours ("Me mostra esta tela", um por tela e por aba principal) e das trilhas
ficam em `src/lib/aya-tours.js`; os atributos `data-tour="…"` das telas (e a prop `tour` dos
componentes de `src/ui/`) existem só para eles.

Perguntas com número ("quantas análises pendentes tem o 93/2026?"): o catálogo de intenções e
entidades é `src/lib/intencoes-da-aya.js`; as contas e a resposta, `src/lib/dados-da-aya.js`
(permissão conferida antes de buscar; só contagens e datas); o "Abrir" deixa o filtro em
`src/app/pedido-de-filtro.js` e Recursos, Entrevistas e Seleção aplicam com
`src/lib/filtro-da-aya.js`. "Não aparece o botão": `src/lib/permissoes-da-aya.js`, pelo perfil.
"Não ajudou" e "não entendi" guardam a pergunta sem dado pessoal
(`src/lib/perguntas-sem-resposta.js`) e o administrador global copia a lista pelo painel.

O que a Aya diz em cada página (saudação, sugestões, botões de navegação) fica em
`src/lib/aya-paginas.js`; o chamado ao suporte (Gmail, com alternativa `mailto:`), em `src/lib/chamado-da-aya.js`. As
respostas vêm de `src/lib/busca-da-aya.js`: base de `docs/aya/`, normalização, sinônimos e
busca com tolerância a erros e preferência pela tela. `contexto.js` lê apenas dados já
visíveis; não há endpoint de IA, modelo, serviço local ou túnel. Dúvidas oferecem até
três perguntas em botões e chamado pelo Gmail. Testes: `tests/modulos/aya.test.js`, `tests/aya-paginas.test.js`,
`tests/aya-respostas-chave.test.js`, `tests/busca-da-aya.test.js`, `tests/termos-da-aya.test.js`,
`tests/conversa-da-aya.test.js`, `tests/chamado-da-aya.test.js`, `tests/aya-tours.test.js`,
`tests/modulos/aya-tour.test.js`, `tests/modulos/aya-trilhas.test.js`, `tests/modulos/mascote.test.js`
e `tests/estado-da-aya.test.js`.

A mascote: a regra dos estados (prioridade, movimento reduzido, comemorações desligadas,
tempos sorteados) fica em `src/lib/estado-da-aya.ts`. Qualquer tela pede um estado com
`definirEstadoDaAya("comemorando", 3000)` ou com o evento `aya:estado`
(`{ detail: { estado, duracaoMs } }`); os fogos (`src/modules/comemoracao.js`) já pedem
"comemorando". A prévia de cada estado fica em Configurações › Marca › Mascote
(`src/modulos/configuracoes/cartao-da-mascote.tsx`).
