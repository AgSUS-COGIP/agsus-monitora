# Aya pela base de conhecimento

A Aya responde no navegador usando os verbetes de `docs/aya/` e os dados já visíveis
na tela. A decisão substitui a IA local: não depende de Ollama, GPU, bridge, túnel,
sessão adicional ou endpoint `/api/aya`.

`src/lib/busca-da-aya.js` responde só com textos da base, sem geração de conteúdo:

- termos (`src/lib/termos-da-aya.js`): sem acento e sem stopwords, no singular,
  com 18 grupos de sinônimos do domínio (também de várias palavras: "processo
  seletivo" = edital, "casa de apoio" = CASAI) e radical simples ("convocação",
  "convocar" e "convocados" juntos);
- digitação: palavra desconhecida é corrigida para a mais próxima da base ou dos
  sinônimos, contando letras trocadas como um erro só ("entrevsita");
- pontuação: raridade do termo (IDF) × campo (perguntas 3, título 2, resposta 1),
  quanto da frase mais parecida a pergunta cobre e bônus multiplicativo da página
  aberta (15%) e da área Saúde Indígena (10%); pergunta igual a uma frase das
  `perguntas` vale a resposta daquele verbete;
- decisão: responde a partir de 0,6, sem empate com o segundo; entre 0,3 e 0,6, ou
  abaixo com termo do domínio, "Você quis dizer…?" com até três perguntas e
  chamado; abaixo de 0,3 sem termo do domínio, ou com metade ou mais das palavras
  desconhecidas ("me conta uma piada"), a mensagem de fora do escopo com sugestões
  da tela.

Antes da base vêm a conversa (`src/lib/conversa-da-aya.js`: saudação, ajuda,
agradecimento, despedida; "bom dia, como dar acesso?" responde a pergunta com
"Bom dia!" na frente) e os dados da tela. Contagens só são respondidas quando
disponíveis no contexto, com o recorte indicado. A única resposta fora da busca é a
composta do DSEI Alagoas e Sergipe (`curatedAnswerForQuestion` em
`src/modules/aya-knowledge.js`), para duas perguntas num enunciado só.

O chamado abre `https://mail.google.com/mail/` em outra aba, com destinatário,
assunto e corpo codificados. O usuário revisa e envia. A opção permanente
"Feedback e suporte" também abre o Gmail, mesmo antes da primeira pergunta.
As regras existentes de omissão de CPF/e-mail
e limite do corpo continuam valendo.

Foram removidos endpoint, scripts de bridge, serviço e instalação do túnel, comandos
npm associados e configuração da função na Vercel. Migrations históricas do bridge
continuam no histórico; esta mudança não acessa nem altera o banco. Serviços já
instalados fora do repositório e variáveis antigas não são usados pela Aya; sua
remoção do ambiente pode ser feita separadamente.

Para atualizar a base: editar os `.md` e executar `npm run aya:conhecimento`.
O compilador inclui o nome do documento nos verbetes para priorizar a página e
acusa verbete sem `perguntas` e frase repetida entre verbetes.
