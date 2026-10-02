# `src/modulos/aya/` — Aya, a assistente

A arara flutuante e o painel de conversa (cartão no canto inferior direito; tela cheia até 600px),
montados por `montarAya()` em `#ayaApp` (`src/main.js`). Substitui `src/modules/arara-guide.js`,
`arara-speaking-effects.js` e `nina-panel-drag.js`.

```
aya.jsx     <Aya> e montarAya(): arara arrastável, painel, sugestões, conversa,
            "Isso ajudou?", cartão "Abrir chamado", foco preso e Esc
estado.js   store sem React: view e título (o legado chama definirPaginaDaAya em
            setPageTitle), área atual e seção de Configurações aberta
aya.css     só tokens; camada 10042 (acima do cabeçalho, abaixo do parabéns)
tour/
  tour.jsx      <Tour>: véu com recorte no elemento da vez, balão (Pular/Voltar/Próximo,
                "2 de 6"), Esc, setas, foco preso, anúncio ao leitor de tela; pula o
                elemento ausente e, na trilha, troca de tela e espera o elemento
  aprender.jsx  seção "Aprender" (trilhas do perfil e progresso) e a oferta de
                "Primeiros passos" da primeira entrada (uma vez)
  progresso.js  passo e conclusão de cada trilha e a oferta, no localStorage (try/catch)
  tour.css      só tokens; camada 10044
```

Os roteiros dos tours ("Me mostra esta tela") e das trilhas ficam em `src/lib/aya-tours.js`; os
seletores `data-tour="…"` das telas existem só para eles.

O que a Aya diz em cada página (saudação, sugestões, botões de navegação) fica em
`src/lib/aya-paginas.js`; o chamado ao suporte (`mailto:`), em `src/lib/chamado-da-aya.js`. As
respostas vêm de `src/modules/aya-ai-client.js` (verbetes de `docs/aya/`, contexto da tela e IA
por `/api/aya`). Testes: `tests/modulos/aya.test.js`, `tests/aya-paginas.test.js`,
`tests/aya-respostas-chave.test.js`, `tests/chamado-da-aya.test.js`, `tests/aya-tours.test.js`,
`tests/modulos/aya-tour.test.js` e `tests/modulos/aya-trilhas.test.js`.
