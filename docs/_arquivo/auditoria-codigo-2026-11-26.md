---
tipo: referencia
area: front
atualizado: 2026-11-26
---

# Auditoria do código — 26/11/2026

Leitura do código do front (`src/`, na `main` em `42282944`) em busca de bugs que travam ou quebram
a tela. Esta auditoria não corrigiu nada. Ela cobre as mudanças das duas últimas semanas: cabeçalho e
título no cabeçalho, Relatórios com gráficos, Reativar edital, Meus acessos e Pedir mais acesso,
entrada automática, Convocações, marca nova e Aya ilustrada. Também cobre a casca (`src/app/`), a
sessão (`src/lib/sessao/`), `src/ui/`, `src/componentes/` e todas as telas de `src/modulos/`.

**Critério:** só entra o que foi confirmado lendo o caminho inteiro: quem chama, se há `catch`
antes e se há guarda. O que pareceu bug e não se confirmou está em "Descartado".

## Resumo

- **Nada deixa a tela branca nem prende spinner.** As telas sob demanda passam por
  `importarComRecarga`, que recarrega a página só uma vez, e cada tela fica no próprio
  `ErrorBoundary`. As ações de gravação têm `finally`, e as cargas principais descartam resposta
  velha com contador de pedido ou geração.
- **Um achado alto:** a Central de convocações mostra dados da área anterior.
- **Cinco achados médios:** duas corridas de resposta (triagem e Aya), uma confirmação errada no
  Pedir mais acesso, uma exportação que falha sem aviso e o editor de coordenadas, que some até
  recarregar.
- **A entrada automática não entra em laço:** ela tenta uma vez por aba (`sessionStorage`). Sem
  `sessionStorage`, não tenta. Falha no retorno vira `?auth_error=` e mensagem.
- **Lint e TypeScript:** nenhum erro. Os 8 avisos não escondem bug.
- **CI:** nos últimos 30 runs do Quality Gate não houve teste instável. Nos 300 anteriores houve 1,
  que já foi corrigido.

## Achados

| #   | Arquivo:linha                                                                                                     | O que acontece para quem usa                                                                                                                                                                                                                                                                 | Como reproduzir                                                                                                                                                                                               | Gravidade | Correção sugerida                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/modulos/aprovados/central-de-convocacoes.tsx:50-72`                                                          | Em Lista de aprovados › Convocação › "Para entrevistas", depois de trocar de área, o edital da entrevista, a lista de convocação e a agenda continuam sendo da área anterior. A lista de aprovados abaixo já mostra a área nova.                                                             | Numa sessão em que Conduzir entrevistas ainda não foi aberta, abrir "Para entrevistas" na área A. Trocar para a área B pelo menu e voltar à Lista de aprovados. Conduzir precisa estar ligada nas duas áreas. | **Alta**  | Ler a área do app no hook e pô-la nas dependências do efeito, para `controlador.render()` (que chama `trocarArea`) rodar de novo. |
| 2   | `src/modulos/triagem/usar-regra-da-triagem.ts:55-67` (usado em `avaliacao-documental/pre-classificacao.tsx:1010`) | Ao salvar a regra da triagem (lote por vaga) e trocar de edital antes da resposta, a regra do edital anterior entra no resumo e na versão do edital novo. A troca de edital não remonta o componente.                                                                                        | Rede lenta: salvar a regra e trocar de edital logo em seguida.                                                                                                                                                | Média     | Guardar o edital vigente num `useRef` e só chamar `setResposta` se ele for o do pedido.                                           |
| 3   | `src/modulos/aya/aya.tsx:1185-1219`                                                                               | A resposta da Aya que chega depois de "Limpar conversa" ou de sair do sistema entra na conversa limpa e é gravada na aba (`salvarConversa`, `:1065`). Quem entrar em seguida na mesma aba a vê.                                                                                              | Fazer uma pergunta com dados e sair (ou limpar a conversa) antes da resposta.                                                                                                                                 | Média     | Guardar `local.conversa` (ou um contador que "Limpar" incremente) antes do `await` e descartar a resposta se tiver mudado.        |
| 4   | `src/app/casca/pedido-de-mais-acesso.ts:104` e `:124`                                                             | O pedido foi gravado, mas a releitura logo depois falha e a tela diz "Não foi possível enviar o pedido", com o formulário aberto. A pessoa envia de novo. No cancelamento, o pedido cancelado continua como pendente.                                                                        | Derrubar a rede entre `registrar_solicitacao_acesso` e `obter_minha_solicitacao_acesso`.                                                                                                                      | Média     | Pôr `lerPedido` num `try` próprio. Se ele falhar depois do envio, tratar como sucesso e chamar `carregar()`.                      |
| 5   | `src/ui/botoes-de-exportacao.tsx:56-60`, com `src/modulos/visao-geral/estado.ts:691-705`                          | Exportar Excel ou PDF na Visão geral mostra "Gerando…" e volta sem arquivo e sem mensagem. O botão só tem `try/finally`, e `exportar` lança de propósito (`erroDeVersaoNova`). O erro vira rejeição solta, que só vai para o registro de erros.                                              | Publicar uma versão nova com a aba aberta (o chunk `tabela-para-exportar` some) e clicar em Exportar.                                                                                                         | Média     | `exportar` da Visão geral avisa a falha num `catch` interno, como já fazem Relatórios, Conferências e a Avaliação documental.     |
| 6   | `src/modulos/editor-de-coordenadas/editor-sob-demanda.ts:17`                                                      | Se o download do editor de coordenadas falha uma vez (rede ou versão nova), a promessa rejeitada fica guardada. O modo de edição liga, mas o painel não aparece (`mapa-de-projetos/editor-de-coordenadas.tsx:89` devolve `null`), sem mensagem, até recarregar.                              | Bloquear o chunk `editor-de-coordenadas` e ligar a edição do mapa.                                                                                                                                            | Média     | No `catch`, zerar `pedido` e mostrar o erro com "Tentar de novo", como em `comemoracao-sob-demanda.ts`.                           |
| 7   | `src/modulos/paineis-de-dados/estado.ts:536-545`                                                                  | Em Relatórios › Fontes dos dados, um salvamento que termina depois de a gaveta ser fechada e reaberta em outro relatório grava as fontes (ou o erro) do relatório anterior na gaveta nova. A gaveta nova também chega com `salvando: null`, o que permite um segundo salvamento em paralelo. | Rede lenta: salvar uma fonte, fechar, abrir as fontes de outro relatório.                                                                                                                                     | Baixa     | Guardar área, relatório ou um número de abertura antes do `await` e ignorar a resposta se mudou, como `abrirFontes` já faz.       |
| 8   | `src/modulos/pagina-do-edital/pagina-do-edital.tsx:110`, `src/modulos/editais/modal-linha-do-tempo.tsx:68`        | Se o chunk `sequencia-do-cronograma` falhar, os avisos de sequência do cronograma somem sem aviso e sobra uma rejeição não tratada. O resto da tela funciona.                                                                                                                                | Versão nova publicada com a aba aberta; abrir a página do edital.                                                                                                                                             | Baixa     | `.catch(() => {})` ou um fallback, como em `editais/estado.ts`.                                                                   |
| 9   | `src/modulos/aya/mascote/mascote.tsx:73` e `:98`, `src/modulos/mapa-saude-indigena/leaflet.ts:394`                | Mesmo padrão do item 6: o `import()` rejeitado fica guardado (`??=`). A arara fica vazia e os contornos do Brasil e das UFs não voltam até recarregar.                                                                                                                                       | Falha de rede no primeiro download do pedaço.                                                                                                                                                                 | Baixa     | Zerar a promessa guardada quando ela rejeitar.                                                                                    |
| 10  | `src/ui/modal.tsx:275` com `src/modulos/mapa-saude-indigena/tela-cheia.tsx:39-47`                                 | Com o mapa em tela cheia e um modal aberto por cima (por exemplo a busca, Ctrl+K), o Esc sai da tela cheia em vez de fechar o modal. O ouvinte da tela cheia foi registrado antes e chama `preventDefault`, e o modal ignora Esc com `defaultPrevented`.                                     | Mapa em tela cheia, Ctrl+K, Esc.                                                                                                                                                                              | Baixa     | Modal ouvir `keydown` em captura, ou a tela cheia ignorar o Esc com modal aberto.                                                 |
| 11  | `src/componentes/busca-global/busca-global.tsx:196-203`                                                           | A busca global grava `body.style.overflow = ""` ao fechar, sem contar as travas. Com o mapa em tela cheia, fechar a busca libera a rolagem da página por trás do mapa.                                                                                                                       | Mapa em tela cheia, abrir e fechar a busca, rolar.                                                                                                                                                            | Baixa     | Usar `travarRolagemDaPagina()` de `tela-cheia.tsx`, que conta as travas.                                                          |
| 12  | `src/modulos/paineis-de-dados/paineis-de-dados.tsx:203-209`                                                       | Ao arrastar a largura de uma coluna em Relatórios no toque, o navegador manda `pointercancel` quando assume a rolagem, não `pointerup`. A coluna continua mudando de largura até o próximo toque, e se a tabela desmontar o ouvinte fica em `window`.                                        | Celular: arrastar a alça e deslizar na vertical.                                                                                                                                                              | Baixa     | Ouvir também `pointercancel` com o mesmo `soltar`, ou usar `setPointerCapture`.                                                   |

## Testes instáveis no CI

Foram lidos os logs das 59 falhas do Quality Gate entre 11/11 e 23/11 (300 runs). Cada commit que
falhou foi comparado com o próximo commit da mesma branch que passou (`gh api compare`). Nos
últimos 30 runs não há falha que tenha voltado a passar sem mudança.

- **Um teste instável, já corrigido.** O caso é "cada mudança é guardada; F5 pede confirmação;
  salvar a versão apaga o rascunho", do bloco `modulos/avaliacao-documental-rascunho` em
  `tests/casca-sessao-e-interface-na-tela.test.js` (hoje na linha 6613).
  - Falhou nos runs 44351691535 e 44357908620 com `chamadas is not iterable` e passou de novo sem
    mudança no teste.
  - **Causa: tempo.** A gravação do rascunho vai para um `setTimeout(…, 0)` real
    (`src/app/rascunho-da-regra.ts:131` e `:238-241`), seguido de RPC. O teste esperava duas
    rodadas de promessas (`esperar()`), o que não garante o timer numa máquina lenta.
  - O commit `7c01afda` trocou essa espera por `vi.waitFor`.
- **Falsa instabilidade (infraestrutura):** em 18/11, 8 runs caíram com "runner has received a
  shutdown signal". A causa era a memória dos bancos PGlite que nenhum teste fechava, corrigida em
  `e36e7842` (`tests/apoio/bancos-abertos.ts`).
- **Todas as outras falhas foram reais**, corrigidas no commit seguinte da branch: bundle acima do
  orçamento, lint, formatação, timestamp de migration repetido, contrato de RPC e testes
  acompanhando mudança de comportamento.

## Lint e TypeScript

- `npm run typecheck` (servidor, front e testes): sem erro.
- `npm run lint` só olha os arquivos alterados em relação à `origin/main`. Rodando o ESLint em todo
  o `src/`, sobram 8 avisos, todos `react-hooks/exhaustive-deps`:
  - `aprovados/aba-aprovados.tsx:332` e `aprovados/aba-convocacao.tsx:424`, `:442`, `:446`, `:447`:
    dependência por conteúdo (`JSON.stringify`/`join`) de propósito. O resultado é correto.
  - `entrevistas/roteiros.tsx:205`: o efeito roda "só a cada pedido novo" (`pedido.vez`), de
    propósito.
  - `entrevistas/preparar.tsx:266`: falta `dados`, mas `ativos` (derivado de `dados`) é novo a cada
    desenho, então o `useMemo` recalcula sempre. O resultado é correto, e o memo não economiza
    nada.

## Conferido e sem problema

- **Entrada automática** (`src/lib/sessao/entrada-direta.ts`, `src/app/sessao.ts`):
  - Tenta uma vez por aba. Sem `sessionStorage`, não tenta. Depois de "Sair", não tenta. Com
    mensagem na tela, não tenta.
  - O retorno do Google (`src/auth/callback.ts`) sempre volta com `?auth=google`,
    `?auth_error=…` ou mensagem ao popup.
  - `estadoDaSessao` nunca rejeita. Uma falha ao abrir a sessão cai em `falharNaEntrada` com
    "Tentar de novo".
  - "Sair" só neste navegador não faz outra aba entrar sozinha.
- **Casca:**
  - `carregarTela` recarrega uma vez e, na falha, apaga o `lazy` guardado (`telas.tsx:459`).
  - `abrirNaTela` trata a falha do `render()`.
  - Presença, aviso de versão e moldura limpam timers e ouvintes.
  - A carga da entrada (`app/carga.ts`) cai no `catch` de `entrar()`.
- **Meus acessos e Pedir mais acesso:**
  - O pedido tem `finally` nos botões e estado de erro com "Tentar de novo".
  - O `StrictMode` só lê duas vezes; nada grava duas vezes.
  - A data dos pendentes usa o fuso de São Paulo.
- **Reativar edital e Editais:** as gravações têm `finally`, os modais são remontados por
  `key={modal.abertura}` e `amanha()` faz a conta certa.
- **Relatórios e Visão geral:**
  - Contador de pedido por relatório e por área.
  - As porcentagens testam o denominador (`graficos-do-relatorio.ts:142`).
  - O Chart.js é destruído ao desmontar.
- **Convocações, aprovados, classificação, recursos, entrevistas, análises, seleção e fila
  documental:** as cargas têm contador de geração ou de pedido, e as ações passam por `executar`
  com `finally` ou por funções com `try/catch` interno.
- **Datas:**
  - Não há `new Date("AAAA-MM-DD")` exibido nem `toISOString().slice(0, 10)` como "hoje".
  - "Hoje" vem de `hojeEmBrasilia`.
  - As datas sem hora são formatadas pelo texto, sem conversão de fuso.
- **Lojas:** todo `assinar` devolve a função que remove o ouvinte. Os caches são limitados por
  área ou limpos por `esquecer()`.

## Descartado (parecia bug, não se confirmou)

- **Laço de recarga em `importarComRecarga`** quando falta `sessionStorage`. Com o armazenamento
  bloqueado não há sessão guardada, então a tela sob demanda nunca chega a carregar.
- **`signInWithOAuth` fora de `try` no login por popup** (`src/app/sessao.ts:1044`). Não se
  confirmou que essa chamada possa lançar: o armazenamento da sessão tem `try` próprio.
- **Não seguido até o fim:** `avaliacao-documental/estado-da-fila.ts:419-440`
  (`carregarForaDoLote`). Uma troca de versão no meio da primeira leitura talvez deixe
  `fora.carregando` ligado. Fica para uma próxima leitura.
