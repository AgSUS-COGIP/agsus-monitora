---
tipo: decisao
area: front
atualizado: 2026-11-10
---

# Aya: base de conhecimento e busca

A assistente Aya responde **no navegador**, só com os verbetes de `docs/aya/` e os dados já
visíveis na tela. Não há IA gerando texto: a decisão substituiu a IA local (sem Ollama, GPU,
bridge, túnel, sessão adicional ou endpoint `/api/aya`). O painel é a nota [[modulo-aya]].

## A base (`docs/aya/`)

- Os `.md` de `docs/aya/` (os numerados `01-saude-indigena.md` … `05-politica-e-controle-social.md`
  e os `regras-*.md` de cada tela) são compilados por `npm run aya:conhecimento`
  (`scripts/compilar-conhecimento-aya.mjs`) para `src/modules/aya-conhecimento-gerado.js`, que vai
  no bundle (e roda no `npm run build`). **Editou, recompile**; o gerado não se edita à mão.
- O formato do verbete está abaixo. Resposta precisa de **fonte**; o compilador acusa verbete sem
  `perguntas` e frase repetida entre verbetes, e põe o nome do documento nos verbetes para
  priorizar a página. O CI reprova se o módulo gerado estiver fora de sincronia com os `.md`.
- **Todo número que a Aya precisa dizer tem de estar escrito lá.** É também onde mora a explicação
  das telas, que não entra como texto na interface ([[textos-da-interface]]).
- A pasta não se reorganiza nem se renomeia: os testes leem os arquivos e
  `src/lib/busca-da-aya.ts` liga cada `regras-*.md` à sua página.

## O verbete

Um verbete por assunto; a ordem dos campos não importa e o que falta é omitido.

```markdown
## Vaga ociosa

**perguntas:** vaga ociosa | vagas ociosas | ociosidade
**resposta:** No MONITORA, vaga ociosa é a parcela das vagas previstas que permanece sem contratação.
**fato:** No MONITORA, Ociosas é a parcela das vagas que permanece sem contratação.
**fonte:** interface do MONITORA
```

| Campo       | Para que serve                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `perguntas` | obrigatório: termos que disparam o verbete, separados por `\|` (o compilador acusa verbete sem perguntas)               |
| `resposta`  | texto devolvido pela busca da Aya, sem gerar conteúdo                                                                   |
| `fato`      | referência complementar; a busca responde apenas com o campo `resposta`                                                 |
| `fonte`     | de onde veio; obrigatório quando não for a própria interface                                                            |
| `abrir`     | opcional: botão que leva à tela citada (`recursos`, `config:acessos`… — ver `ACOES_DA_AYA` em `src/lib/aya-paginas.ts`) |

Duas frases que a busca lê igual ("lista de aprovados" e "as listas dos aprovados") não podem estar
em verbetes diferentes: pergunta igual a uma das `perguntas` recebe a resposta daquele verbete.

### Quando o verbete precisa de fonte

Se o conteúdo é sobre a interface do MONITORA, basta `fonte: interface do
MONITORA` — a tela é a fonte. Para qualquer afirmação institucional, legal ou
numérica, use um endereço oficial. As respostas são previamente conferidas; mantenha a fonte junto de cada verbete.

## A busca (`src/lib/busca-da-aya.ts`)

- **Termos** (`src/lib/termos-da-aya.ts`): sem acento e sem stopwords, no singular, com grupos de
  sinônimos do domínio (também de várias palavras: "processo seletivo" = edital, "casa de apoio" =
  CASAI) e radical simples ("convocação", "convocar" e "convocados" juntos).
- **Digitação:** palavra desconhecida é corrigida para a mais próxima da base ou dos sinônimos,
  contando letras trocadas como um erro só.
- **Pontuação:** raridade do termo (IDF) × campo (perguntas 3, título 2, resposta 1), quanto da
  frase mais parecida a pergunta cobre e bônus da página aberta (15%) e da área Saúde Indígena
  (10%); pergunta igual a uma frase das `perguntas` vale a resposta daquele verbete.
- **Decisão:** responde a partir de 0,6, sem empate com o segundo; entre 0,3 e 0,6, ou abaixo com
  termo do domínio, "Você quis dizer…?" com até três perguntas e chamado; abaixo de 0,3 sem termo do
  domínio, ou com metade ou mais das palavras desconhecidas, a mensagem de fora do escopo com
  sugestões da tela.
- Antes da base vêm a conversa (`src/lib/conversa-da-aya.ts`: saudação, ajuda, agradecimento,
  despedida) e os dados da tela; contagens só quando disponíveis no contexto, com o recorte
  indicado. A única resposta fora da busca é a composta do DSEI Alagoas e Sergipe
  (`curatedAnswerForQuestion` em `src/modules/aya-knowledge.ts`).
- A base de verbetes baixa ao abrir o painel (fora do pacote principal). A memória da conversa fica
  em `src/modules/aya-memoria.ts`.

## Chamado ao suporte

O chamado abre `https://mail.google.com/mail/` em outra aba, com destinatário, assunto e corpo
codificados; a pessoa revisa e envia. "Feedback e suporte" também abre o Gmail. Valem a omissão de
CPF/e-mail e o limite do corpo ([[dados-pessoais]]).

## O que saiu

Endpoint, scripts de bridge, serviço e instalação do túnel, comandos npm e a configuração da função
na Vercel. As migrations do bridge ficam no histórico; **nunca aplicar o bridge da IA local**
([[banco-e-migrations]]). Serviços já instalados fora do repositório não são usados.

## Testes

`tests/aya-*.test.js`, `tests/busca-da-aya.test.js` e `tests/aya-conhecimento-md.test.js`.

## Os arquivos da base

Conteúdo do domínio (Saúde Indígena, DSEIs, política e a própria Aya):

- [01-saude-indigena](../aya/01-saude-indigena.md)
- [02-dsei-e-rede](../aya/02-dsei-e-rede.md)
- [03-monitora](../aya/03-monitora.md)
- [04-dseis](../aya/04-dseis.md)
- [05-politica-e-controle-social](../aya/05-politica-e-controle-social.md)
- [assistente-aya](../aya/assistente-aya.md)

Regras de cada tela (cada uma ligada também à nota `modulo-*` da tela):

- [regras-da-automacao](../aya/regras-da-automacao.md)
- [regras-da-avaliacao-documental](../aya/regras-da-avaliacao-documental.md)
- [regras-da-classificacao](../aya/regras-da-classificacao.md)
- [regras-da-lista-de-aprovados](../aya/regras-da-lista-de-aprovados.md)
- [regras-da-selecao](../aya/regras-da-selecao.md)
- [regras-da-visao-geral](../aya/regras-da-visao-geral.md)
- [regras-das-analises](../aya/regras-das-analises.md)
- [regras-das-areas](../aya/regras-das-areas.md)
- [regras-das-conferencias](../aya/regras-das-conferencias.md)
- [regras-das-configuracoes](../aya/regras-das-configuracoes.md)
- [regras-das-entrevistas](../aya/regras-das-entrevistas.md)
- [regras-do-cronograma](../aya/regras-do-cronograma.md)
- [regras-do-mapa-saude-indigena](../aya/regras-do-mapa-saude-indigena.md)
- [regras-do-sistema](../aya/regras-do-sistema.md)
- [regras-do-status-das-atualizacoes](../aya/regras-do-status-das-atualizacoes.md)
- [regras-dos-acessos](../aya/regras-dos-acessos.md)
- [regras-dos-editais](../aya/regras-dos-editais.md)
- [regras-dos-mapas](../aya/regras-dos-mapas.md)
- [regras-dos-modulos-e-abas](../aya/regras-dos-modulos-e-abas.md)
- [regras-dos-recursos](../aya/regras-dos-recursos.md)

## Relacionadas

- [[modulo-aya]] — o painel, a mascote e o tour
- [[scripts-e-checagens]] — o compilador
