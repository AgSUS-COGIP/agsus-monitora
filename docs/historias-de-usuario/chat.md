# Histórias de usuário — Mensagens (chat): retenção e zerar

Seção `Configurações › Mensagens (chat)` (`src/modulos/configuracoes/mensagens-do-chat.jsx`), só
para o administrador global; regras em `src/lib/retencao-do-chat.js`; banco em
`supabase/migrations/20261005190000_chat_retencao_das_mensagens.sql`. Pedido do usuário:
"Colocar em Configuração para o Administrador definir [o prazo de retenção] ou zerar as mensagens".
Cada critério tem o mesmo código (`CR-n.m`) num teste: `tests/retencao-do-chat.test.js` (regra),
`tests/componentes/mensagens-do-chat.test.js` (tela), `tests/modulos/chat-estado-retencao.test.js`
(chat aberto) ou o ensaio `supabase/ensaios/20261005190000_chat_retencao_das_mensagens.sql` (banco).

## CR-1 — Definir o prazo de retenção

**Como** administrador global, **quero** definir por quanto tempo o chat guarda as mensagens,
**para** que as conversas antigas deixem de existir quando não forem mais necessárias (LGPD) em vez
de ficarem guardadas para sempre.

### Critérios de aceite

- **CR-1.1** — **Dado** que ninguém mudou o prazo, **quando** abro a seção, **então** o prazo em
  vigor é "Guardar para sempre" e posso escolher 30, 90, 180, 365 dias ou "Outro prazo".
- **CR-1.2** — **Dado** que escolhi "Outro prazo", **quando** informo menos de 7 ou mais de 3.650
  dias (ou um valor que não é inteiro), **então** aparece "O prazo vai de 7 a 3.650 dias." e nada é
  salvo; o banco recusa o mesmo (22023).
- **CR-1.3** — **Dado** mensagens com idades variadas, **quando** escolho um prazo, **então** a tela
  mostra quantas mensagens serão apagadas ao salvar (as mais antigas que o prazo).
- **CR-1.4** — **Dado** que o prazo apaga mensagens existentes, **quando** clico em "Salvar prazo"
  com o motivo preenchido, **então** a tela pergunta antes: "Isto apaga X mensagens com mais de N
  dias; não dá para desfazer." e só salva em "Apagar e salvar"; sem nada a apagar, salva direto.
- **CR-1.5** — **Dado** que salvei um prazo de N dias, **quando** o banco grava, **então** as
  mensagens enviadas antes de agora − N dias e as reações delas são apagadas de fato, as conversas
  continuam e o histórico registra quem, quando, o prazo, quantas saíram e o motivo.
- **CR-1.6** — **Dado** um prazo em vigor, **quando** a tarefa diária `agsus_chat_retencao_diaria`
  roda (03h15 de Brasília), **então** ela apaga o que passou do prazo, registra no histórico só se
  apagou algo e aparece em Status das atualizações como "Retenção das mensagens do chat".
- **CR-1.7** — **Dado** que não sou administrador global, **quando** chamo qualquer RPC da retenção,
  **então** recebo 42501 e a seção não aparece no meu menu.

## CR-2 — Zerar as mensagens

**Como** administrador global, **quero** apagar todas as mensagens do chat de uma vez, **para**
recomeçar do zero (fim de um piloto, por exemplo), com uma confirmação forte que evite engano.

### Critérios de aceite

- **CR-2.1** — **Dado** que abro "Zerar mensagens…", **quando** o diálogo aparece, **então** ele
  mostra antes o que vai ser apagado: quantas mensagens, reações e, se marquei "Apagar também as
  conversas sem participante ativo", quantas conversas.
- **CR-2.2** — **Dado** o diálogo aberto, **quando** não digito exatamente ZERAR (maiúsculas, sem
  espaço) ou o motivo tem menos de 3 caracteres, **então** o botão fica desabilitado; o banco recusa
  o mesmo (22023).
- **CR-2.3** — **Dado** ZERAR e o motivo, **quando** confirmo, **então** todas as mensagens e
  reações são apagadas de fato; com a opção marcada, saem também as conversas sem mensagem e sem
  participante ativo (as diretas e as que têm alguém ficam); o histórico registra a ação.
- **CR-2.4** — **Dado** que o banco recusou, **quando** a resposta chega, **então** o diálogo mostra
  "Nada foi apagado." e o motivo da recusa.

## CR-3 — Ver o histórico das limpezas

**Como** administrador global, **quero** ver quem limpou as mensagens, quando e por quê, **para**
prestar contas da exclusão sem guardar o que foi apagado.

### Critérios de aceite

- **CR-3.1** — **Dado** limpezas feitas, **quando** abro a seção, **então** vejo as últimas 50, da
  mais nova para a mais antiga, com o tipo ("Prazo de 30 dias", "Prazo de 30 dias (limpeza
  diária)", "Prazo: guardar para sempre" ou "Zerar mensagens"), data, quem pediu (ou "Tarefa
  diária"), contagens e motivo.
- **CR-3.2** — **Dado** qualquer limpeza, **quando** ela é registrada, **então** o histórico guarda
  só contagens, corte, motivo e responsável — nunca o texto, o link ou a chave das mensagens.

## CR-4 — O chat aberto acompanha a limpeza

**Como** pessoa com o chat aberto, **quero** que as mensagens apagadas pela retenção ou pelo zerar
sumam da minha tela, **para** não continuar vendo o que já não existe.

### Critérios de aceite

- **CR-4.1** — **Dado** uma conversa aberta, **quando** o banco apaga uma mensagem dela, **então** o
  Realtime avisa (só com a chave) e a mensagem sai da tela e dos avisos; a lista de conversas é
  relida.
- **CR-4.2** — **Dado** que a conexão caiu ou a aba ficou em segundo plano durante a limpeza,
  **quando** volto, **então** a releitura da página mais nova tira da tela o que sumiu do banco,
  sem perder a mensagem que eu estava enviando nem as que chegaram durante a leitura.

---

# Histórias de usuário — Mensagens (chat) v2

Painel Mensagens (`src/modulos/chat/`), regras em `src/lib/chat.js` e `src/lib/anexos-do-chat.js`,
banco em `supabase/migrations/20261007210000_chat_v2.sql`. Pedido do usuário: "melhore o chat,
vamos evoluir". Cada critério tem o mesmo código (`CV-n.m`) num teste:
`tests/anexos-do-chat.test.js` e `tests/chat-v2.test.js` (regras), `tests/modulos/chat-v2.test.js`
(tela), `tests/modulos/chat-expurgo-e-ficha.test.js` (expurgo e ficha), `tests/chat-v2-migration.test.js`
ou o ensaio `supabase/ensaios/20261007210000_chat_v2.sql` (banco, E1–E13).

## CV-1 — Anexos

**Como** pessoa que usa as Mensagens, **quero** mandar PDF, imagem e planilha e colar um print,
**para** não precisar sair do MONITORA para trocar documentos.

- **CV-1.1** — **Dado** um arquivo, **quando** escolho, **então** valem PDF, PNG, JPG, WEBP, GIF,
  XLSX, XLS, ODS e CSV de até 10 MB; outro tipo, vazio ou maior é recusado com o motivo (a tela,
  o bucket e a RPC conferem o mesmo).
- **CV-1.2** — **Dado** vários arquivos, **quando** passo de 5, **então** os excedentes são
  recusados ("No máximo 5 anexos por mensagem.").
- **CV-1.3** — **Dado** o envio, **quando** o arquivo sobe, **então** o caminho é
  `<conversa>/<uuid>.<extensão>` no bucket privado `chat-anexos` — o nome original fica só no banco.
- **CV-1.4** — **Dado** um print copiado, **quando** colo com Ctrl+V no campo, **então** ele vira
  anexo com o nome `print-AAAA-MM-DD-HHhMMmSS.png`; texto colado segue normal.
- **CV-1.5** — **Dado** só anexo ou só cartão, **quando** envio sem texto, **então** a mensagem vai.
- **CV-1.6** — **Dado** que chega pelo Realtime uma mensagem com anexo ou citação, **quando** a
  linha chega, **então** a tela pede `obter_mensagem_chat` e mostra os anexos e a citação.
- **CV-1.7** — **Dado** um arquivo escolhido, **quando** envio, **então** ele sobe ao bucket e a RPC
  recebe `p_anexos` com caminho e nome; a RPC lê tipo, tamanho e dono do Storage.
- **CV-1.8** — **Dado** um tipo não aceito, **quando** escolho, **então** aparece o aviso e nada
  entra.
- **CV-1.9** — **Dado** uma mensagem com anexos, **quando** abro a conversa, **então** a imagem
  aparece em miniatura e o arquivo baixa por URL assinada de 60 segundos; só quem lê a conversa
  recebe a URL (política do bucket).
- **CV-1.10** — **Dado** que a retenção ou o "Zerar" apagaram mensagens com anexo, **quando** o
  administrador global abre Configurações › Mensagens (chat), **então** os arquivos sem nenhuma
  cópia saem do Storage pela API e a fila confirma; o histórico conta os anexos, sem nome nem
  caminho.

## CV-2 — Responder e encaminhar

- **CV-2.1** — **Dado** uma mensagem, **quando** escolho Responder, **então** o campo mostra
  "Respondendo a…" e a resposta vai com a citação (`p_resposta`, mesma conversa).
- **CV-2.2** — **Dado** uma citação, **quando** clico nela, **então** a conversa rola até a
  original e a destaca (buscando páginas antigas, se preciso).
- **CV-2.3** — **Dado** uma mensagem, **quando** escolho Encaminhar e a conversa de destino,
  **então** a cópia vai com texto, cartão e anexos, marcada "Encaminhada", sem menções nem origem.

## CV-3 — Menções

- **CV-3.1** — **Dado** que silenciei uma conversa, **quando** alguém me menciona com @, **então**
  recebo o aviso e a menção conta no ícone; sem menção, a silenciada continua quieta.

## CV-4 — Busca

- **CV-4.1** — **Dado** 2 letras ou mais na busca da lista, **quando** paro de digitar, **então**
  aparecem os resultados das minhas conversas (texto e nome de anexo, sem diferenciar acentos),
  com o trecho destacado; clicar abre a conversa na mensagem.

## CV-5 — Visto

- **CV-5.1** — **Dado** minha mensagem, **quando** a outra pessoa lê, **então** o ✓ vira ✓✓ azul
  (no grupo, o título diz quem viu), também quando a leitura chega pelo Realtime.
- **CV-5.2** — **Dado** a conversa do edital, **quando** alguém só tem acesso ao edital e não a
  acompanha, **então** não vê a leitura dos outros (nem pelo Realtime nem pelas RPCs).

## CV-6 — Cartões

- **CV-6.1** — **Dado** um cartão de tela, edital ou ficha, **quando** não tenho a página,
  **então** aparece "Sem acesso"; com a página, "Abrir" navega dentro do app.
- **CV-6.2** — **Dado** "Compartilhar esta ficha" na lateral da ficha, **quando** escolho a
  conversa, **então** o cartão fica no campo e vai no envio.
- **CV-6.3** — **Dado** o cartão da ficha, **quando** clico em Abrir, **então** o app vai à Fila do
  edital e abre a ficha (pelo id ou pelo código); o banco confere a permissão.

## CV-7 — Fixar e não lida

- **CV-7.1** — **Dado** uma conversa, **quando** fixo, **então** ela fica no topo da lista; quando
  marco como não lida, volto à lista com ela contando 1, e abrir desmarca.

## CV-8 — Status

- **CV-8.1** — **Dado** "Meu status", **quando** escolho Disponível, Ocupado ou Ausente, **então** os
  outros veem o ponto verde, vermelho ou âmbar enquanto estou no MONITORA.
