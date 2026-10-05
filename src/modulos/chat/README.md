# `src/modulos/chat/` — Mensagens (chat)

O ícone "Mensagens" no cabeçalho (`#chatHost` do `index.html`, ao lado de Pessoas online) e o
painel lateral. Monta por `montarChat()` (`src/main.js`); liga pela sessão do app e pelo recurso
`chat` da matriz (`podeUsarChat` em `src/lib/access-roles.js`). Sem o recurso, nada aparece.

```
chat.jsx               <Chat> (ícone + contador) e montarChat(); o painel vem por lazy + portal
painel.jsx             painel (carregado sob demanda): lista, nova conversa, adicionar pessoas
conversa.jsx           mensagens por dia, editar/apagar, digitando…, campo de escrita
estado.js              store sem React: RPCs, Realtime, não lidas, avisos (som, notificação)
ponte.js               sem React: abrir conversa de fora (evento), link da tela atual, irParaLink
usar-chat-liberado.js  hook: a pessoa conectada pode usar (botão "Conversa" de Editais/Classificação)
chat.css               só tokens
```

- Abrir de fora: `abrirConversaDoEdital({ id, titulo })` e `abrirConversaDireta(usuario)` (ponte.js)
  disparam `EVENTO_ABRIR_CONVERSA`; o botão "Mensagem" de Pessoas online (legado) leva
  `data-chat-usuario` e o módulo escuta o clique.
- "Compartilhar esta tela": página e área do estado da Aya (`src/modulos/aya/estado.js`, só
  leitura) e o edital aberto (`definirEditalDaTela`, hoje pela Classificação). Link conferido por
  `linkDaTela` (`src/lib/chat.js`) ao sair e ao chegar; nunca URL.
- Tempo real: canal `chat-usuario:<eu>` (postgres_changes de `TB_MENSAGEM` e
  `RL_CONVERSA_PARTICIPANTE`, com a RLS) e canal privado `chat:<conversa>` (broadcast "digitando").
  Reconectou ou a aba voltou: relê a lista e a conversa aberta. Mensagens mescladas pelo id.

Regras puras: `src/lib/chat.js`. Banco: `supabase/migrations/20261002210000_chat.sql` (ensaio em
`supabase/ensaios/`, rollback em `supabase/rollback/`). Explicações: `docs/aya/regras-do-chat.md`.
Testes: `tests/chat.test.js`, `tests/modulos/chat.test.js`, `tests/chat-migration.test.js`.
Fica para a v2: anexos de arquivo.
