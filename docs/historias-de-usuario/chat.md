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
