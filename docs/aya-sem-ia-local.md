# Aya pela base de conhecimento

A Aya responde no navegador usando os verbetes de `docs/aya/` e os dados já visíveis
na tela. A decisão substitui a IA local: não depende de Ollama, GPU, bridge, túnel,
sessão adicional ou endpoint `/api/aya`.

`src/lib/busca-da-aya.js` normaliza acentos e sinônimos, compara palavras com
tolerância a pequenos erros e prefere verbetes da página atual. Respostas são textos
da base, sem geração de conteúdo. Perguntas ambíguas recebem até três perguntas em
botões e a opção de abrir chamado; temas fora do MONITORA recebem sugestões da tela.
Contagens só são respondidas quando disponíveis no contexto, com o recorte indicado.

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
O compilador inclui o nome do documento nos verbetes para priorizar a página.
