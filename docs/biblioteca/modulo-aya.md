---
tipo: modulo
area: modulo
atualizado: 2026-11-25
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
- `mascote/` — a `<Mascote>` (`mascote.tsx`), com a mesma lógica de estados (parada, atenta,
  falando, pensando, comemorando, dormindo e acenando; enquadramento "corpo" ou "rosto"; sono por
  inatividade; atenta com o ponteiro perto; pausa com a aba oculta) em duas artes:
  - **Desenho em SVG** (padrão): a arara do canto, só o rosto, e a da tela de solicitação de
    acesso. `desenho.tsx` (em camadas; abaixo de 40px, versão chapada), `contornos.ts` (só dados,
    traçados da ilustração `arara-azul-monitora.png`, no histórico do git) e `mascote.css` (só
    transform/opacity; piscar e arrepio sorteados com Web Animations, olho que segue o ponteiro;
    com movimento reduzido, só pisca e troca sem transição).
  - **Ilustrada em 3D** (`<Mascote ilustrada>`, desde 25/11/2026): as aparições grandes, que são
    o painel aberto, a arara do balão do tour, as comemorações e a prévia. `ilustrada.tsx` põe uma
    pose por estado, mais "apontando", que só o tour pede (prop `pose`; não é estado do evento).
    A troca é suave: a nova entra com fade e um pulinho, só depois de decodificada, e a antiga
    sai com fade. A parada só respira; com movimento reduzido, a pose troca sem animação. O CSS
    fica em `mascote-ilustrada.css`; no tema escuro, uma borda de luz fina com `drop-shadow`.
  - `imagens/`: `arara-<pose>.webp` (quadro a 160 px de altura) e `arara-<pose>-2x.webp` (320 px),
    com transparência, até 30 KB cada (teste no bloco `poses-da-aya`). Os originais (~200 KB)
    ficam fora do repositório. Para trocar uma pose: refazer os dois arquivos na mesma escala,
    com os pés no mesmo ponto do quadro, e atualizar a linha dela em `aya/poses-da-aya.ts`.
  - Carga: cada arte vem num pedaço próprio, só quando a primeira arara dela monta, então nada
    da ilustrada entra na entrada. Cada arara ilustrada baixa só a pose que mostra, no arquivo
    (1x ou 2x) que fica nítido no tamanho e na densidade da tela. As livres (a do painel) pedem
    as outras poses com `fetchPriority="low"` depois do `load`, no ócio do navegador.
  - `estado.ts` guarda o pedido global (evento `aya:estado`, com expiração).
- `tour/` — `tour.tsx` (`<Tour>`: véu com recorte no elemento da vez, balão Pular/Anterior/
  Próximo, "Passo 2 de 6", a arara apontando, Esc, setas, foco preso, anúncio ao leitor de tela; pula elemento
  ausente; o recorte acompanha rolagem, redimensionamento e um ResizeObserver, nada de
  MutationObserver), `aprender.tsx` (seção "Aprender" e oferta de "Primeiros passos" na primeira
  entrada), `progresso.ts` (passos, conclusão, oferta e convites no localStorage, com try/catch) e
  `tour.css` (só tokens; camada 10044).

## Regras em `src/lib/`

- Tours e trilhas ("Me mostra esta tela"): `aya/aya-tours.ts`; os `data-tour="…"` das telas (e a
  prop `tour` de `src/ui/`) existem só para eles.
- Perguntas com número: intenções e entidades em `aya/intencoes-da-aya.ts`; contas e resposta em
  `aya/dados-da-aya.ts` (permissão conferida antes; só contagens e datas). O "Abrir" deixa o filtro em
  `src/app/pedido-de-filtro.ts`; Recursos, Entrevistas e Seleção aplicam com `aya/filtro-da-aya.ts`.
- **"O que significa" de uma tela** (18/11/2026): um ⓘ deixa a pergunta em
  `src/app/pergunta-para-a-aya.ts` (`perguntarParaAAya`, validade de 15 s); a Aya a pega uma vez
  (`usarPerguntaParaAAya`), abre o painel e envia. Usado pelos indicadores da Visão geral, com as
  perguntas de `src/lib/visao-geral/o-que-significa.ts` (uma por verbete "(indicador)" de
  `docs/aya/regras-da-visao-geral.md`).
- "Não aparece o botão": `aya/permissoes-da-aya.ts`, pelo perfil.
- "Não ajudou" e "não entendi" guardam a pergunta sem dado pessoal (`aya/perguntas-sem-resposta.ts`);
  o administrador global copia a lista pelo painel.
- O que a Aya diz em cada página: `aya/aya-paginas.ts`. Chamado ao suporte (só o Gmail no cartão, desde
  02/10/2026; o `mailto:` segue montado, sem botão): `aya/chamado-da-aya.ts`. Respostas: `aya/busca-da-aya.ts`.
- Borda (qual vale ao soltar, setas, posição guardada): `aya/borda-da-aya.ts`; o deslocamento de quem
  está escondida fica em `aya.css`.
- Estados da mascote (prioridade, movimento reduzido, comemorações desligadas, tempos sorteados):
  `aya/estado-da-aya.ts`. Qualquer tela pede `definirEstadoDaAya("comemorando", 3000)` ou o evento
  `aya:estado` (`{ detail: { estado, duracaoMs } }`); os fogos (`src/modulos/comemoracao/`) já
  pedem "comemorando". Prévia em Configurações › Marca › Mascote (`cartao-da-mascote.tsx`).
- Poses da arara ilustrada (onde cada uma fica no quadro, recorte do rosto, arquivo 1x ou 2x):
  `aya/poses-da-aya.ts`. No tour, a arara do balão usa "apontando" nos passos com elemento
  (virada quando o elemento está à esquerda do meio do balão, `araraViradaNoBalao`) e "falando"
  nos passos sem elemento.

## TypeScript e limites

Módulo e regras em TypeScript, sem JS/JSX; a base gerada (`src/modules/aya-conhecimento-gerado.js`)
continua em JavaScript, e o compilador importa `aya/aya-paginas.ts` e `aya/termos-da-aya.ts` direto no
Node. O que vem do navegador (conversa, progresso, convites, perguntas sem resposta) e das RPCs
chega como `unknown` e passa pelas leituras que já existiam; o resultado de cada fonte em
`aya/dados-da-aya.ts` é convertido no ponto de uso, sem validação nova. `cargasQuePedemAtencao` usa o
`atencao` de `visaoSimples`, a mesma lista que o Status das atualizações destaca.

## Testes

`tests/aya-e-comemoracao-na-tela.test.js` (bloco `modulos/aya`), `tests/aya-e-comemoracao.test.js` (bloco `aya-paginas`), `tests/aya-e-comemoracao.test.js` (bloco `aya-respostas-chave`),
`tests/aya-e-comemoracao.test.js` (bloco `busca-da-aya`), `tests/aya-e-comemoracao.test.js` (bloco `termos-da-aya`), `tests/aya-e-comemoracao.test.js` (bloco `conversa-da-aya`),
`tests/aya-e-comemoracao.test.js` (bloco `chamado-da-aya`), `tests/aya-e-comemoracao.test.js` (bloco `aya-tours`), `tests/aya-e-comemoracao-na-tela.test.js` (bloco `modulos/aya-tour`),
`tests/aya-e-comemoracao-na-tela.test.js` (bloco `modulos/aya-trilhas`), `tests/aya-e-comemoracao-na-tela.test.js` (bloco `modulos/mascote`), `tests/aya-e-comemoracao-na-tela.test.js` (bloco `modulos/mascote-ilustrada`),
`tests/aya-e-comemoracao-na-tela.test.js` (bloco `estado-da-aya`), `tests/aya-e-comemoracao.test.js` (bloco `poses-da-aya`) e `tests/aya-e-comemoracao.test.js` (bloco `borda-da-aya`).

## Relacionadas

- [[aya-base-de-conhecimento]] — base de conhecimento, busca e chamado
- [[textos-da-interface]] — explicação é com a Aya, não na tela
- [[robos-e-agenda]] — a mesma lista de cargas em atenção
- [[modulo-configuracoes]] — prévia da mascote
- [[acessibilidade-e-mobile]] — foco preso, Esc, leitor de tela e movimento reduzido
