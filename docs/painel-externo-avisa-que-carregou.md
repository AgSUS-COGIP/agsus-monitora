# Painel externo que avisa quando carregou

Ao abrir um painel externo, o MONITORA cobre o quadro com "Carregando o painel…" e um giro
(`acompanharCarregamentoDoPainel`, em `src/modulos/paineis-externos/carregamento-do-painel.tsx`;
o nome do serviço, como "Looker Studio", sai do endereço). Aos 20 s, avisa que está demorando, com
"Abrir em nova aba" e "Tentar novamente". Sozinha, a cobertura só sabe quando a **página** do
painel chegou (o `load` do iframe), e não quando os **dados** chegaram.

Num painel feito em Google Apps Script (como o de Recursos), a página abre e só depois o script
busca os dados, mostrando o carregamento dele. Para a cobertura ficar até os dados aparecerem, o
painel avisa o MONITORA com estas mensagens:

| Mensagem                              | Quando mandar                                            | Efeito                                         |
| ------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| `{ tipo: "agsus:painel-carregando" }` | logo no início da página                                 | a cobertura não sai no `load`                  |
| `{ tipo: "agsus:painel-pronto" }`     | quando os dados estiverem desenhados (ou o erro na tela) | a cobertura sai                                |
| `{ tipo: "agsus:painel-erro" }`       | opcional: quando os dados não vieram                     | "Não foi possível carregar o painel." e saídas |

Painel que não manda nada continua como sempre: a cobertura sai no `load`. Um painel que avisou e
nunca mandou o "pronto" é descoberto depois de 45 s.

Nenhuma página do próprio MONITORA roda mais no quadro: Recursos, Entrevistas, Análises curriculares e
Seleção são módulos de `src/modulos/`, sem avisos (o carregamento é o da própria tela).

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
    avisarMonitoraQueCarregou(); // sem isto, o erro ficaria escondido sob a cobertura
  })
  .buscarDados();
```

Depois disso, a tela de carregamento do próprio script pode sair: dentro do MONITORA ela fica
escondida sob a cobertura.

## Por que assim

- `window.top`: o Apps Script roda num iframe dentro do iframe do MONITORA. O MONITORA aceita a
  mensagem de até quatro níveis abaixo do quadro do painel, e só do quadro que está carregando.
- `"*"` como destino: a mensagem não leva dado nenhum, só o `tipo`. Aberto fora do MONITORA,
  `window.top` é a própria página e a mensagem não tem efeito.
- A folga de 300 ms depois do `load` existe porque o primeiro aviso pode chegar logo depois dele.
