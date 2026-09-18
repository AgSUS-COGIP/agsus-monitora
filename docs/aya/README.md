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

| Campo        | Para que serve                                                                |
| ------------ | ----------------------------------------------------------------------------- |
| `perguntas`  | termos que disparam o verbete, separados por `\|`                              |
| `resposta`   | texto devolvido **sem passar pela IA**, quando a pergunta pede uma definição   |
| `fato`       | frase curta que entra no prompt, para a IA usar ao redigir outras respostas    |
| `fonte`      | de onde veio; obrigatório quando não for a própria interface                   |

## As duas camadas, e por que elas são diferentes

**`resposta` é determinística.** Sai em 1 ou 2 milissegundos, com o texto exato
que você escreveu. A IA não participa, então não há como inventar. É onde deve
morar tudo que não pode sair errado: siglas, definições, números oficiais.

**`fato` entra no prompt.** A IA lê e usa para redigir. Ajuda, mas não garante:
o modelo local é pequeno e já se contradisse tendo o fato correto à frente.
Nunca ponha em `fato` algo que precise estar certo — ponha em `resposta`.

## Regra de desempenho que não pode ser quebrada

Os `fato` entram todos juntos, sempre iguais, no começo do prompt. Isso é
deliberado: o llama.cpp reaproveita a avaliação de um prompt pelo prefixo comum
com o anterior, e um prefixo estável custa 1,4s em vez de 22s por pergunta.

Se algum dia alguém decidir montar o prompt escolhendo fatos conforme a
pergunta, o prefixo muda a cada vez, o cache deixa de valer e **toda** pergunta
volta a custar mais de 20 segundos nesta máquina. Medido, não estimado.

Por isso: acrescentar verbete é barato; tornar o prompt variável é caro.

## Quando o verbete precisa de fonte

Se o conteúdo é sobre a interface do MONITORA, basta `fonte: interface do
MONITORA` — a tela é a fonte. Para qualquer afirmação institucional, legal ou
numérica, use um endereço oficial. A Aya erra menos que o modelo local porque o
que ela afirma foi conferido; abrir mão disso é trocar a alucinação da máquina
pela nossa.

## Depois de editar

```sh
npm run aya:conhecimento   # regenera o módulo que o código lê
npm test                   # confere que a base continua íntegra
```

O CI reprova se o módulo gerado estiver fora de sincronia com os `.md`.
