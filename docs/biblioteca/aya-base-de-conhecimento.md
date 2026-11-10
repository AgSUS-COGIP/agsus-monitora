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
- O formato do verbete está em `docs/aya/README.md`. Resposta precisa de **fonte**; o compilador
  acusa verbete sem `perguntas` e frase repetida entre verbetes, e põe o nome do documento nos
  verbetes para priorizar a página.
- **Todo número que a Aya precisa dizer tem de estar escrito lá.** É também onde mora a explicação
  das telas, que não entra como texto na interface ([[textos-da-interface]]).
- A pasta não se reorganiza nem se renomeia: os testes leem os arquivos e
  `src/lib/busca-da-aya.ts` liga cada `regras-*.md` à sua página.

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

## Relacionadas

- [[modulo-aya]] — o painel, a mascote e o tour
- [[scripts-e-checagens]] — o compilador
