# Base de conhecimento da Aya

Os arquivos desta pasta alimentam a Aya. Editar um `.md` aqui muda o que ela
sabe, sem mexer em código.

## Como usar

Escreva um verbete por assunto, no formato abaixo. A ordem dos campos não
importa; o que falta é simplesmente omitido.

```markdown
## Vaga ociosa

**perguntas:** vaga ociosa | vagas ociosas | ociosidade
**resposta:** No MONITORA, vaga ociosa é a parcela das vagas previstas que permanece sem contratação.
**fato:** No MONITORA, Ociosas é a parcela das vagas que permanece sem contratação.
**fonte:** interface do MONITORA
```

| Campo       | Para que serve                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `perguntas` | termos que disparam o verbete, separados por `\|`                                                                       |
| `resposta`  | texto devolvido pela busca da Aya, sem gerar conteúdo                                            |
| `fato`      | referência complementar; a busca responde apenas com o campo `resposta`                                             |
| `fonte`     | de onde veio; obrigatório quando não for a própria interface                                                            |
| `abrir`     | opcional: botão que leva à tela citada (`recursos`, `config:acessos`… — ver `ACOES_DA_AYA` em `src/lib/aya-paginas.js`) |

## Busca no navegador

A Aya usa apenas respostas escritas na base. Sinônimos, acentos e pequenos erros
de digitação são normalizados pela busca; o documento de origem permite preferir
a tela atual. Quando há ambiguidade, ela oferece até três perguntas em botões e
um chamado pelo Gmail. Não há modelo local, prompt em execução, bridge ou túnel.

## Quando o verbete precisa de fonte

Se o conteúdo é sobre a interface do MONITORA, basta `fonte: interface do
MONITORA` — a tela é a fonte. Para qualquer afirmação institucional, legal ou
numérica, use um endereço oficial. As respostas são previamente conferidas; mantenha a fonte junto de cada verbete.

## Depois de editar

```sh
npm run aya:conhecimento   # regenera o módulo que o código lê
npm test                   # confere que a base continua íntegra
```

O CI reprova se o módulo gerado estiver fora de sincronia com os `.md`.
