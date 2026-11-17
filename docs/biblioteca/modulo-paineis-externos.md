---
tipo: modulo
area: modulo
atualizado: 2026-11-17
---

# Módulo: Painéis externos

Painéis de outro site (Apps Script, Looker Studio, Power BI…) cadastrados em `TB_PAINEL_EXTERNO`
e abertos num iframe dentro do MONITORA (`#page-external`, um iframe por painel). Os que não são
de área entram no grupo Painéis da barra lateral. Cadastro em Configurações › Painéis externos.
Nenhuma página do próprio MONITORA roda mais em iframe: Recursos, Entrevistas, Análises
curriculares e Seleção são módulos de `src/modulos/` (o carregamento é o da própria tela).

## Onde está

- `src/app/paineis-externos.ts` — a lista, os liberados para o perfil e o quadro. Quem troca de
  tela é a navegação (`src/app/navegacao.ts`), que chama `mostrar(codigo)` e põe o título.
- `src/modulos/paineis-externos/carregamento-do-painel.tsx` (+ `.css`, só tokens) — a cobertura
  enquanto o site de fora não responde (`acompanharCarregamentoDoPainel`).
- `src/lib/paineis/carregamento-do-painel.ts` — tempos, mensagens e origens a pré-conectar.
- `src/lib/paineis/endereco-do-painel.ts` — o endereço em que o painel abre.
- `src/lib/configuracoes/paineis-externos-das-configuracoes.ts` — a seção de Configurações sem DOM (a tela é
  `src/modulos/configuracoes/paineis-externos.tsx`).

## Comportamento

- O iframe nasce na primeira abertura e fica até a página fechar (ou até o "Atualizar dados",
  que descarta os abertos para recarregarem). Só a primeira abertura passa pela cobertura.
- Cobertura: "Carregando o painel do <serviço>…" (o nome, como "Looker Studio", sai do endereço)
  com o giro, até o `load` do iframe. Aos 20 s (`DEMORA_DO_PAINEL_MS`), "Está demorando mais que o
  normal", com "Abrir em nova aba" e "Tentar novamente". Erro (o iframe recusou, a conexão caiu ou
  o painel avisou): a mensagem e as mesmas duas saídas.
- Pré-conexão: o iframe não carrega antes da hora, mas o DNS e o TLS das origens do painel (e, no
  Looker Studio, das estáticas do Google) abrem antes — ao apontar ou focar o item do menu
  (`preconectarAoApontar`) e, depois da entrada, com o navegador ocioso (`preconectarNoOcioso`),
  só para os painéis em iframe que a pessoa vê.

## Protocolo: o painel avisa que carregou

Sozinha, a cobertura só sabe quando a **página** do painel chegou (o `load` do iframe), não quando
os **dados** chegaram. Num painel em Google Apps Script (como o de Recursos), a página abre e só
depois o script busca os dados. Para a cobertura ficar até os dados aparecerem, o painel manda
`postMessage` para `window.top`:

| Mensagem                              | Quando mandar                                            | Efeito                                         |
| ------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| `{ tipo: "agsus:painel-carregando" }` | logo no início da página                                 | a cobertura não sai no `load`                  |
| `{ tipo: "agsus:painel-pronto" }`     | quando os dados estiverem desenhados (ou o erro na tela) | a cobertura sai                                |
| `{ tipo: "agsus:painel-erro" }`       | opcional: quando os dados não vieram                     | "Não foi possível carregar o painel." e saídas |

- **Tempos.** Painel que não manda nada continua como sempre: a cobertura sai no `load`. Quem
  avisou "carregando" e nunca disse "pronto" é descoberto em 45 s (`ESPERA_MAXIMA_DO_PAINEL_MS`).
  Depois do `load` há uma folga de 300 ms (`FOLGA_DO_AVISO_MS`), porque o primeiro aviso pode
  chegar logo depois dele.
- **Origem.** O MONITORA aceita a mensagem de até quatro níveis abaixo do quadro do painel, e só
  do quadro que está carregando. Por isso `window.top`: o Apps Script roda num iframe dentro do
  iframe do MONITORA. O destino é `"*"` porque a mensagem não leva dado nenhum, só o `tipo`; aberto
  fora do MONITORA, `window.top` é a própria página e a mensagem não tem efeito.

No HTML do painel, o mais alto possível no `<head>`:

```html
<script>
  // Diz ao MONITORA que este painel avisa quando os dados chegam.
  window.top.postMessage({ tipo: "agsus:painel-carregando" }, "*");

  // Chame quando os dados estiverem desenhados na tela (ou o erro).
  function avisarMonitoraQueCarregou() {
    window.top.postMessage({ tipo: "agsus:painel-pronto" }, "*");
  }
</script>
```

E, onde o script recebe os dados, **nos dois caminhos** (sem o aviso na falha, o erro ficaria
escondido sob a cobertura):

```js
google.script.run
  .withSuccessHandler((dados) => {
    desenhar(dados);
    avisarMonitoraQueCarregou();
  })
  .withFailureHandler((erro) => {
    mostrarErro(erro);
    avisarMonitoraQueCarregou();
  })
  .buscarDados();
```

Depois disso, a tela de carregamento do próprio script pode sair: dentro do MONITORA ela fica
escondida sob a cobertura.

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
- [[modulo-acessos]] — quais painéis cada perfil vê
- [[planilhas]] — os painéis em Apps Script das planilhas
