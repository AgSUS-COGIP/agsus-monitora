---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Painéis externos

Painéis de outro site (Apps Script, Looker Studio, Power BI…) cadastrados em `TB_PAINEL_EXTERNO`
e abertos num iframe dentro do MONITORA (`#page-external`, um iframe por painel). Os que não são
de área entram no grupo Painéis da barra lateral. Cadastro em Configurações › Painéis externos.
Nenhuma página do próprio MONITORA roda mais em iframe: Recursos, Entrevistas, Análises
curriculares e Seleção são módulos de `src/modulos/`.

## Onde está

- `src/app/paineis-externos.ts` — a lista, os liberados para o perfil e o quadro. Quem troca de
  tela é a navegação (`src/app/navegacao.ts`), que chama `mostrar(codigo)` e põe o título.
- `src/modulos/paineis-externos/carregamento-do-painel.tsx` (+ `.css`, só tokens) — a cobertura
  enquanto o site de fora não responde (`acompanharCarregamentoDoPainel`).
- `src/lib/carregamento-do-painel.ts` — tempos, mensagens e origens a pré-conectar.
- `src/lib/endereco-do-painel.ts` — o endereço em que o painel abre.
- `src/lib/paineis-externos-das-configuracoes.ts` — a seção de Configurações sem DOM (a tela é
  `src/modulos/configuracoes/paineis-externos.tsx`).

## Comportamento

- O iframe nasce na primeira abertura e fica até a página fechar (ou até o "Atualizar dados",
  que descarta os abertos para recarregarem). Só a primeira abertura passa pela cobertura.
- Cobertura: "Carregando o painel do <serviço>…" (o nome sai do endereço) com o giro, até o
  `load` do iframe. Aos 20 s (`DEMORA_DO_PAINEL_MS`), "Está demorando mais que o normal", com
  "Abrir em nova aba" e "Tentar novamente". Erro (o iframe recusou, a conexão caiu ou o painel
  avisou): a mensagem e as mesmas duas saídas.
- Pré-conexão: o iframe não carrega antes da hora, mas o DNS e o TLS das origens do painel (e, no
  Looker Studio, das estáticas do Google) abrem antes — ao apontar ou focar o item do menu
  (`preconectarAoApontar`) e, depois da entrada, com o navegador ocioso (`preconectarNoOcioso`),
  só para os painéis em iframe que a pessoa vê.

## Painel que avisa que carregou

Sozinha, a cobertura só sabe quando a página chegou, não quando os dados chegaram. Um painel
(como o de Recursos, em Apps Script) pode mandar `postMessage` para `window.top`:
`agsus:painel-carregando` (no início: a cobertura não sai no `load`), `agsus:painel-pronto` (sai)
e, opcional, `agsus:painel-erro`. Quem avisou e nunca disse "pronto" é descoberto em 45 s
(`ESPERA_MAXIMA_DO_PAINEL_MS`); a folga depois do `load` é de 300 ms (`FOLGA_DO_AVISO_MS`). A
mensagem é aceita de até quatro níveis abaixo do quadro, e só do quadro que está carregando.
O que colar no Apps Script e o porquê:
[docs/painel-externo-avisa-que-carregou.md](../painel-externo-avisa-que-carregou.md).

## Segurança do quadro

- `enderecoDoPainel` aceita só http(s) absoluto e de **outra origem**: `javascript:`, texto
  inválido, caminho relativo ou endereço do próprio MONITORA viram vazio e o painel não abre. A
  mesma origem é recusada porque o quadro tem `allow-scripts` junto de `allow-same-origin`.
- Sandbox (`SANDBOX_DO_QUADRO`): `allow-scripts`, `allow-same-origin`, `allow-forms`,
  `allow-popups`, `allow-popups-to-escape-sandbox`, `allow-downloads`, `allow-modals`,
  `allow-top-navigation-by-user-activation`, `allow-storage-access-by-user-activation`. Fora:
  `allow-top-navigation` sem clique, `allow-pointer-lock`, `allow-presentation`,
  `allow-orientation-lock`. O `allow` (Permissions Policy) libera só tela cheia e copiar para a
  área de transferência, restritos à origem do quadro.
- A RPC das Configurações (`salvar_configuracoes_e_paineis_v2`, `p_paineis`) só atualiza painéis
  que já existem (por id) e só `titulo`, `url`, `ativo` e `em_manutencao`.

## Testes

`tests/endereco-do-painel.test.js`, `tests/painel-externo-shell.test.js`,
`tests/paineis-externos-das-configuracoes.test.js`, `tests/interface-acesso-e-paineis.test.js`,
`tests/modulos/carregamento-do-painel.test.js` e
`tests/modulos/configuracoes-paineis-e-operacao.test.js`.

## Relacionadas

- [[modulo-configuracoes]] — a seção Painéis externos
- [[modulo-barra-lateral]] — o grupo Painéis no menu
- [[seguranca]] — sandbox e origem do quadro
- [[permissoes-e-perfis]] — quais painéis cada perfil vê
- [[cargas-de-planilha]] — os painéis em Apps Script das planilhas
