# `src/modulos/chat/` — Mensagens (chat)

O ícone "Mensagens" no cabeçalho (`#chatHost` do `index.html`, ao lado de Pessoas online) e o
painel lateral. Monta por `montarChat()` (`src/main.js`); liga pela sessão do app e pelo recurso
`chat` da matriz (`podeUsarChat` em `src/lib/access-roles.js`). Sem o recurso, nada aparece.

```
chat.jsx               <Chat> (ícone + contador + avisos) e montarChat(); o painel vem por lazy + portal
avisos.jsx             avisos de mensagem nova no canto (até 3; clicar abre; somem sozinhos)
avatar.jsx             <Avatar> (foto ou iniciais, ponto de presença), comum ao painel e aos avisos
painel.jsx             painel (carregado sob demanda): lista (fixadas, busca nas conversas e nas
                       mensagens, meu status, avisos), nova conversa, adicionar pessoas, encaminhar,
                       escolha da conversa de "Compartilhar esta ficha"
conversa.jsx           mensagens por dia, menu "⋯" (reagir, responder, encaminhar, copiar,
                       editar/apagar), citação, anexos, cartões, Visto, reações, "↓ Novas
                       mensagens", digitando…, campo de escrita (anexar, colar print, arrastar),
                       menu da conversa (fixar, não lida, silenciar, limpar)
seletor-de-emoji.jsx   seletor de emoji do campo (lista própria, busca, recentes); chunk do painel
estado.js              store sem React: RPCs, Storage (anexos), Realtime, não lidas, avisos
ponte.js               sem React: abrir conversa de fora (evento), compartilhar cartão (evento),
                       link da tela atual, irParaLink (inclusive a ficha da avaliação documental)
usar-chat-liberado.js  hook: a pessoa conectada pode usar (botões "Conversa" e "Compartilhar esta ficha")
chat.css               só tokens
```

- Abrir de fora: `abrirConversaDoEdital({ id, titulo })` e `abrirConversaDireta(usuario)` (ponte.js)
  disparam `EVENTO_ABRIR_CONVERSA`; o botão "Mensagem" de Pessoas online (legado) leva
  `data-chat-usuario` e o módulo escuta o clique.
- "Compartilhar esta tela": página e área do estado da Aya (`src/modulos/aya/estado.js`, só
  leitura) e o edital aberto (`definirEditalDaTela`, hoje pela Classificação). Link conferido por
  `linkDaTela` (`src/lib/chat.js`) ao sair e ao chegar; nunca URL. Na mensagem vira cartão
  (`cartaoDoLink`: tela, edital ou ficha) com "Abrir" só para quem tem a página
  (`paginasPermitidas`, guardada no estado por chat.jsx); o banco confere de novo ao abrir.
- "Compartilhar esta ficha" (lateral da ficha, `src/modulos/avaliacao-documental/ficha/ficha.jsx`):
  `compartilharNoChat(link)` dispara `EVENTO_COMPARTILHAR`; o painel abre a lista com "Escolha a
  conversa" e o cartão espera no campo da conversa escolhida (`linkPendente`). "Abrir" leva à Fila
  do edital e abre a ficha pelo id (ou pelo código) via `avaliacaoDocumentalController`.
- Anexos (`src/lib/anexos-do-chat.js`): PDF, imagem e planilha, até 10 MB e 5 por mensagem; o
  arquivo sobe ao bucket privado `chat-anexos` em `<conversa>/<uuid>.<extensão>` e só depois
  `enviar_mensagem_chat` registra (`p_anexos`); reenviar não sobe de novo. Miniatura e download por
  `createSignedUrl` de 60 s. Ctrl+V com imagem vira anexo com nome de print.
- Responder: `estado.resposta` (citação) vai como `p_resposta`; clicar na citação chama
  `irParaMensagem`, que busca páginas antigas até achar e destaca (`destaque`). Encaminhar:
  visão "encaminhar" → `encaminhar_mensagem_chat`.
- Busca: com 2 letras ou mais, `buscar_mensagens_chat` (só conversas de quem busca, depois da
  limpeza); o resultado abre na mensagem.
- Visto: participantes com `lida_em` (só para quem participa) → `vistoPor`; a leitura dos outros
  chega pelo Realtime de `RL_CONVERSA_PARTICIPANTE` (sem filtro; a RLS entrega a própria linha e
  as das conversas em que a pessoa participa) e passa por `aplicarLeituraDaLinha`.
- Fixar (`fixar_conversa_chat`), marcar como não lida (`marcar_nao_lida_chat`; volta para a lista)
  e status (`definir_status_chat`: Disponível, Ocupado, Ausente; `presencaDe`).
- Tempo real: canal `chat-usuario:<eu>` (postgres_changes de `TB_MENSAGEM`,
  `RL_CONVERSA_PARTICIPANTE` e `RL_MENSAGEM_REACAO`, com a RLS) e canal privado `chat:<conversa>`
  (broadcast "digitando"). Reconectou ou a aba voltou: relê a lista e a conversa aberta. Mensagens
  mescladas pelo id; o que a pessoa limpou (`limpa_em`) não volta pelo Realtime. A linha que
  anuncia anexos ou citação (`precisaCompletar`) é completada por `obter_mensagem_chat`.
- Mensagem nova de outra pessoa, fora da conversa à vista e não silenciada (ou que menciona quem
  está logado, mesmo silenciada): aviso na tela (aba à vista) ou notificação do navegador (aba em
  segundo plano, só se a pessoa ativou em Avisos — a permissão é pedida nesse clique). Conversa
  nova que alguém começou: relê a lista e avisa. Nada no carregamento inicial. Regras:
  `src/lib/avisos-do-chat.js` e `deveAvisar` (`src/lib/chat.js`).
- Limpar conversa (para mim): `limpar_conversa_chat` grava `DT_LIMPEZA` só na linha de quem limpou;
  as listagens filtram. Reações: `alternar_reacao_chat`, na hora na tela e desfeita se falhar.
- Retenção e "Zerar mensagens" (Configurações › Mensagens (chat), só o administrador global:
  `src/modulos/configuracoes/mensagens-do-chat.jsx`, regras em `src/lib/retencao-do-chat.js`):
  prazo em dias (padrão: guardar para sempre) aplicado na hora e todo dia pela tarefa
  `agsus_chat_retencao_diaria`; exclusão real das mensagens, reações e anexos, auditada em
  `TH_LIMPEZA_CHAT` (sem conteúdo). Os arquivos vão para a fila `TB_EXPURGO_ANEXO_CHAT` e saem do
  Storage pela API quando a seção é aberta (`expurgarAnexos`; o Storage não aceita DELETE pelo
  SQL). No painel, o DELETE do Realtime (só a chave) tira a mensagem (`tirarMensagens`) e a
  releitura da página mais nova tira o que sumiu do banco (`reconciliarPagina`).

Regras puras: `src/lib/chat.js`, `src/lib/anexos-do-chat.js`, `src/lib/avisos-do-chat.js` e
`src/lib/emojis-do-chat.js`. Banco: `supabase/migrations/20261002210000_chat.sql`,
`20261005100000_chat_limpar_e_reacoes.sql`, `20261005190000_chat_retencao_das_mensagens.sql` e
`20261007210000_chat_v2.sql` (ensaios em `supabase/ensaios/`, rollbacks em `supabase/rollback/`).
Explicações: `docs/aya/regras-do-chat.md`.
Testes: `tests/chat.test.js`, `tests/avisos-do-chat.test.js`, `tests/chat-limpar-e-reacoes.test.js`, `tests/emojis-do-chat.test.js`,
`tests/modulos/chat.test.js`, `tests/modulos/chat-estado-limpar-e-reacoes.test.js`,
`tests/chat-migration.test.js`, `tests/chat-limpar-e-reacoes-migration.test.js`;
retenção: `tests/retencao-do-chat.test.js`, `tests/chat-retencao-migration.test.js`,
`tests/modulos/chat-estado-retencao.test.js`, `tests/componentes/mensagens-do-chat.test.js`;
v2: `tests/anexos-do-chat.test.js`, `tests/chat-v2.test.js`, `tests/modulos/chat-v2.test.js`,
`tests/modulos/chat-expurgo-e-ficha.test.js`, `tests/chat-v2-migration.test.js`.
Histórias de usuário: `docs/historias-de-usuario/chat.md`.
