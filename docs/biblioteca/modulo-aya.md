---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Aya (painel da assistente)

A arara flutuante e o painel de conversa (cartão no canto inferior direito; tela cheia até 600px),
em `src/modulos/aya/`, desenhados pela casca em `#ayaApp` (`src/app/casca/pecas.tsx`, `React.lazy`
quando o app abre). Substitui os antigos `arara-guide.js`, `arara-speaking-effects.js` e
`nina-panel-drag.js`. A base de conhecimento e a busca estão em [[aya-base-de-conhecimento]].

## Arquivos

- `aya.tsx` — `<Aya>`: arara arrastável (fechada, só o rosto; solta numa borda, se esconde
  espiando; setas como alternativa ao arraste), painel (a arara inteira, 88px), sugestões,
  conversa, "Isso ajudou?", cartão "Abrir chamado", foco preso e Esc.
- `estado.ts` — store sem React: view e título (o legado chama `definirPaginaDaAya` em
  `setPageTitle`), área atual e seção de Configurações aberta.
- `contexto.ts` — o que a tela já mostra: dados do mapa e da tabela, e `estadoDaTela()` (a aba
  marcada e o número do edital escolhido; nunca nome). Lê só dados já visíveis.
- `fontes.ts` — dados ao vivo das perguntas com número: o estado já carregado das telas ou as
  RPCs de leitura que elas já usam (guardadas por 1 min).
- `aya.css` — só tokens; camada 10042 (acima do cabeçalho, abaixo do parabéns).
- `mascote/` — `desenho.tsx` (a arara-azul em SVG, em camadas; abaixo de 40px, versão chapada),
  `contornos.ts` (só dados, traçados da ilustração `arara-azul-monitora.png`, no histórico do
  git), `mascote.tsx` (`<Mascote>`: enquadramento "corpo" ou "rosto"; estados parada, atenta,
  falando, pensando, comemorando, dormindo e acenando; piscar e arrepio sorteados com Web
  Animations, olho que segue o ponteiro, sono por inatividade, pausa com a aba oculta),
  `estado.ts` (o pedido global, evento `aya:estado`, com expiração) e `mascote.css` (só
  transform/opacity; com movimento reduzido, só pisca e troca sem transição).
- `tour/` — `tour.tsx` (`<Tour>`: véu com recorte no elemento da vez, balão Pular/Anterior/
  Próximo, "Passo 2 de 6", Esc, setas, foco preso, anúncio ao leitor de tela; pula elemento
  ausente; o recorte acompanha rolagem, redimensionamento e um ResizeObserver, nada de
  MutationObserver), `aprender.tsx` (seção "Aprender" e oferta de "Primeiros passos" na primeira
  entrada), `progresso.ts` (passos, conclusão, oferta e convites no localStorage, com try/catch) e
  `tour.css` (só tokens; camada 10044).

## Regras em `src/lib/`

- Tours e trilhas ("Me mostra esta tela"): `aya-tours.ts`; os `data-tour="…"` das telas (e a
  prop `tour` de `src/ui/`) existem só para eles.
- Perguntas com número: intenções e entidades em `intencoes-da-aya.ts`; contas e resposta em
  `dados-da-aya.ts` (permissão conferida antes; só contagens e datas). O "Abrir" deixa o filtro em
  `src/app/pedido-de-filtro.ts`; Recursos, Entrevistas e Seleção aplicam com `filtro-da-aya.ts`.
- "Não aparece o botão": `permissoes-da-aya.ts`, pelo perfil.
- "Não ajudou" e "não entendi" guardam a pergunta sem dado pessoal (`perguntas-sem-resposta.ts`);
  o administrador global copia a lista pelo painel.
- O que a Aya diz em cada página: `aya-paginas.ts`. Chamado ao suporte (Gmail, com alternativa
  `mailto:`): `chamado-da-aya.ts`. Respostas: `busca-da-aya.ts`.
- Borda (qual vale ao soltar, setas, posição guardada): `borda-da-aya.ts`; o deslocamento de quem
  está escondida fica em `aya.css`.
- Estados da mascote (prioridade, movimento reduzido, comemorações desligadas, tempos sorteados):
  `estado-da-aya.ts`. Qualquer tela pede `definirEstadoDaAya("comemorando", 3000)` ou o evento
  `aya:estado` (`{ detail: { estado, duracaoMs } }`); os fogos (`src/modulos/comemoracao/`) já
  pedem "comemorando". Prévia em Configurações › Marca › Mascote (`cartao-da-mascote.tsx`).

## TypeScript e limites

Módulo e regras em TypeScript, sem JS/JSX; a base gerada (`src/modules/aya-conhecimento-gerado.js`)
continua em JavaScript, e o compilador importa `aya-paginas.ts` e `termos-da-aya.ts` direto no
Node. O que vem do navegador (conversa, progresso, convites, perguntas sem resposta) e das RPCs
chega como `unknown` e passa pelas leituras que já existiam; o resultado de cada fonte em
`dados-da-aya.ts` é convertido no ponto de uso, sem validação nova. `cargasQuePedemAtencao` usa o
`atencao` de `visaoSimples`, a mesma lista que o Status das atualizações destaca.

## Testes

`tests/modulos/aya.test.js`, `tests/aya-paginas.test.js`, `tests/aya-respostas-chave.test.js`,
`tests/busca-da-aya.test.js`, `tests/termos-da-aya.test.js`, `tests/conversa-da-aya.test.js`,
`tests/chamado-da-aya.test.js`, `tests/aya-tours.test.js`, `tests/modulos/aya-tour.test.js`,
`tests/modulos/aya-trilhas.test.js`, `tests/modulos/mascote.test.js`,
`tests/estado-da-aya.test.js` e `tests/borda-da-aya.test.js`.

## Relacionadas

- [[aya-base-de-conhecimento]] — base de conhecimento, busca e chamado
- [[textos-da-interface]] — explicação é com a Aya, não na tela
- [[modulo-status-das-atualizacoes]] — a mesma lista de cargas em atenção
- [[modulo-configuracoes]] — prévia da mascote
- [[acessibilidade]] — foco preso, Esc, leitor de tela e movimento reduzido
