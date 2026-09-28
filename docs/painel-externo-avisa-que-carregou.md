# Painel externo que avisa quando carregou

Ao abrir um painel externo, o MONITORA cobre o quadro com um skeleton
(`acompanharCarregamentoDoPainel`, em `src/modules/carregamento.js`). Sozinho, ele só sabe quando
a **página** do painel chegou (o `load` do iframe), e não quando os **dados** chegaram.

Num painel feito em Google Apps Script (como o de Recursos), a página abre e só depois o script
busca os dados, mostrando o carregamento dele. Para o skeleton ficar até os dados aparecerem, o
painel avisa o MONITORA com duas mensagens:

| Mensagem                              | Quando mandar                                            | Efeito                       |
| ------------------------------------- | -------------------------------------------------------- | ---------------------------- |
| `{ tipo: "agsus:painel-carregando" }` | logo no início da página                                 | o skeleton não sai no `load` |
| `{ tipo: "agsus:painel-pronto" }`     | quando os dados estiverem desenhados (ou o erro na tela) | o skeleton sai               |

Painel que não manda nada continua como sempre: o skeleton sai no `load`. Um painel que avisou e
nunca mandou o "pronto" é descoberto depois de 45 s.

O app de análises do próprio MONITORA (`analises.html`) já manda os dois avisos, em
`src/analises/analises-loading-feedback.js`: o "pronto" sai quando os dados (ou o erro) estão na
tela. Ele não é mais um painel externo: é a página Análises curriculares
(`src/modules/pagina-de-analises.js`), que usa o mesmo skeleton e os mesmos avisos.

## O que colar no Apps Script

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

E, onde o script recebe os dados, nos dois caminhos:

```js
google.script.run
  .withSuccessHandler((dados) => {
    desenhar(dados);
    avisarMonitoraQueCarregou();
  })
  .withFailureHandler((erro) => {
    mostrarErro(erro);
    avisarMonitoraQueCarregou(); // sem isto, o erro ficaria escondido sob o skeleton
  })
  .buscarDados();
```

Depois disso, a tela de carregamento do próprio script pode sair: dentro do MONITORA ela fica
escondida sob o skeleton.

## Por que assim

- `window.top`: o Apps Script roda num iframe dentro do iframe do MONITORA. O MONITORA aceita a
  mensagem de até quatro níveis abaixo do quadro do painel, e só do quadro que está carregando.
- `"*"` como destino: a mensagem não leva dado nenhum, só o `tipo`. Aberto fora do MONITORA,
  `window.top` é a própria página e a mensagem não tem efeito.
- A folga de 300 ms depois do `load` existe porque o primeiro aviso pode chegar logo depois dele.
