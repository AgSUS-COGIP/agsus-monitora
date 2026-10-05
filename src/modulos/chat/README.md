# `src/modulos/chat/` — Mensagens (chat)

O ícone "Mensagens" no cabeçalho (`#chatHost` do `index.html`, ao lado de Pessoas online) e o
painel lateral. Monta por `montarChat()` (`src/main.js`); liga pela sessão do app e pelo recurso
`chat` da matriz (`podeUsarChat` em `src/lib/access-roles.js`). Sem o recurso, nada aparece.

```
chat.jsx               <Chat> (ícone + contador + avisos) e montarChat(); o painel vem por lazy + portal
avisos.jsx             avisos de mensagem nova no canto (até 3; clicar abre; somem sozinhos)
avatar.jsx             <Avatar> (foto ou iniciais, online), comum ao painel e aos avisos
painel.jsx             painel (carregado sob demanda): lista, nova conversa, adicionar pessoas
conversa.jsx           mensagens por dia, menu "⋯" (reagir, copiar, editar/apagar), reações,
                       "↓ Novas mensagens", digitando…, campo de escrita, Limpar conversa
seletor-de-emoji.jsx   seletor de emoji do campo (lista própria, busca, recentes); chunk do painel
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
- Tempo real: canal `chat-usuario:<eu>` (postgres_changes de `TB_MENSAGEM`,
  `RL_CONVERSA_PARTICIPANTE` e `RL_MENSAGEM_REACAO`, com a RLS) e canal privado `chat:<conversa>`
  (broadcast "digitando"). Reconectou ou a aba voltou: relê a lista e a conversa aberta. Mensagens
  mescladas pelo id; o que a pessoa limpou (`limpa_em`) não volta pelo Realtime.
- Mensagem nova de outra pessoa, fora da conversa à vista e não silenciada: aviso na tela (aba
  à vista) ou notificação do navegador (aba em segundo plano, só se a pessoa ativou em Avisos —
  a permissão é pedida nesse clique). Conversa nova que alguém começou: relê a lista e avisa.
  Nada no carregamento inicial. Regras: `src/lib/avisos-do-chat.js`.
- Limpar conversa (para mim): `limpar_conversa_chat` grava `DT_LIMPEZA` só na linha de quem limpou;
  as listagens filtram. Reações: `alternar_reacao_chat`, na hora na tela e desfeita se falhar.
- Retenção e "Zerar mensagens" (Configurações › Mensagens (chat), só o administrador global:
  `src/modulos/configuracoes/mensagens-do-chat.jsx`, regras em `src/lib/retencao-do-chat.js`):
  prazo em dias (padrão: guardar para sempre) aplicado na hora e todo dia pela tarefa
  `agsus_chat_retencao_diaria`; exclusão real das mensagens e reações, auditada em
  `TH_LIMPEZA_CHAT` (sem conteúdo). No painel, o DELETE do Realtime (só a chave) tira a mensagem
  (`tirarMensagens`) e a releitura da página mais nova tira o que sumiu do banco
  (`reconciliarPagina`).

Regras puras: `src/lib/chat.js`, `src/lib/avisos-do-chat.js` e `src/lib/emojis-do-chat.js`. Banco:
`supabase/migrations/20261002210000_chat.sql`, `20261005100000_chat_limpar_e_reacoes.sql` e
`20261005190000_chat_retencao_das_mensagens.sql` (ensaios
em `supabase/ensaios/`, rollbacks em `supabase/rollback/`). Explicações: `docs/aya/regras-do-chat.md`.
Testes: `tests/chat.test.js`, `tests/avisos-do-chat.test.js`, `tests/chat-limpar-e-reacoes.test.js`, `tests/emojis-do-chat.test.js`,
`tests/modulos/chat.test.js`, `tests/modulos/chat-estado-limpar-e-reacoes.test.js`,
`tests/chat-migration.test.js`, `tests/chat-limpar-e-reacoes-migration.test.js`;
retenção: `tests/retencao-do-chat.test.js`, `tests/chat-retencao-migration.test.js`,
`tests/modulos/chat-estado-retencao.test.js`, `tests/componentes/mensagens-do-chat.test.js`.
Histórias de usuário: `docs/historias-de-usuario/chat.md`.
Fica para a v2: anexos de arquivo.
