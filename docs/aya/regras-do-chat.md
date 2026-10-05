# Regras das Mensagens (chat)

O chat do MONITORA: o ícone Mensagens no cabeçalho e o painel lateral. Fontes:
`src/modulos/chat/`, `src/lib/chat.js`, `src/lib/emojis-do-chat.js`, `src/lib/access-roles.js`
(`podeUsarChat`), `supabase/migrations/20261002210000_chat.sql` e
`supabase/migrations/20261005100000_chat_limpar_e_reacoes.sql`.

## O que é o chat

**perguntas:** o que e o chat | chat do monitora | como mandar mensagem | onde ficam as mensagens | icone de mensagens | painel de mensagens
**resposta:** O ícone Mensagens (balões de conversa) fica no cabeçalho, ao lado de Pessoas online, com o número de mensagens não lidas. Ele abre um painel à direita, que não bloqueia a tela: dá para continuar trabalhando com ele aberto. O painel lista as conversas, da mais recente para a mais antiga, com a última mensagem, a hora, as não lidas, um "@" quando alguém mencionou você e um ponto verde em quem está online. Há busca por nome da conversa, pessoa ou unidade do edital e o botão "Nova conversa".
**fonte:** src/modulos/chat/chat.jsx; src/modulos/chat/painel.jsx

## Tipos de conversa

**perguntas:** tipos de conversa | conversa direta | conversa em grupo | criar grupo no chat | nova conversa | como criar um grupo
**resposta:** Há três tipos. Conversa direta: entre duas pessoas, uma só por par (abrir de novo leva à mesma conversa). Grupo: quem cria escolhe o nome e as pessoas; qualquer participante pode adicionar outras pessoas pelo menu da conversa (Adicionar pessoas) e cada um pode sair do grupo. Conversa do edital: uma por edital, aberta a todos que veem aquele edital. Em "Nova conversa" você escolhe Conversa direta ou Grupo e procura a pessoa por nome ou e-mail; só aparecem pessoas com acesso às Mensagens.
**fonte:** src/modulos/chat/painel.jsx; supabase/migrations/20261002210000_chat.sql

## Conversa do edital

**perguntas:** conversa do edital | botao conversa | chat do edital | quem ve a conversa do edital | conversar sobre um edital
**resposta:** O botão "Conversa" fica na linha de cada edital em Editais e ao lado da escolha do edital na Classificação. Ele abre a conversa daquele edital (criada na primeira vez). Quem vê o edital pela área e pela coordenação lê e escreve nela, mesmo sem ter aberto antes; quem perde o acesso ao edital deixa de ver a conversa. Ao abrir ou escrever, a conversa passa a aparecer na sua lista; "Deixar de acompanhar" (menu da conversa) tira da lista sem perder o acesso.
**fonte:** src/modulos/editais/nucleo.jsx; src/modulos/classificacao/classificacao.jsx; supabase/migrations/20261002210000_chat.sql

## Escrever e enviar

**perguntas:** como enviar mensagem | enter envia | quebrar linha na mensagem | tamanho maximo da mensagem | limite de caracteres do chat | mencionar alguem | arroba no chat
**resposta:** Enter envia e Shift+Enter quebra a linha. A mensagem tem até 4.000 caracteres; perto do limite aparece a contagem. Digite @ e o começo do nome para mencionar alguém da conversa: escolha a pessoa na lista (setas e Enter, ou clique). A pessoa mencionada vê o "@" na conversa e a menção destacada. Se a rede falhar, a mensagem fica como "Não enviada", com "Tentar de novo"; reenviar não duplica.
**fonte:** src/modulos/chat/conversa.jsx; src/lib/chat.js

## Compartilhar esta tela

**perguntas:** compartilhar esta tela | mandar link da tela | link no chat | abrir tela pelo chat
**resposta:** "Compartilhar esta tela", embaixo do campo da mensagem, anexa à mensagem o lugar onde você está: a página, a área e, na Classificação, o edital escolhido (em Configurações, a seção). Quem recebe clica no link e vai para a mesma tela, dentro do MONITORA; se não tiver permissão para a página, aparece o aviso de sempre. Não é um endereço da internet: o chat não abre sites externos.
**fonte:** src/modulos/chat/ponte.js; src/lib/chat.js

## Editar e apagar mensagem

**perguntas:** editar mensagem | apagar mensagem | mensagem apagada | corrigir mensagem enviada | excluir mensagem do chat | copiar texto da mensagem | menu da mensagem | tres pontinhos da mensagem
**resposta:** Cada mensagem tem o botão "⋯" (três pontinhos) no canto, sempre à vista — também no celular, com um toque. Ele abre as reações rápidas e "Copiar texto"; na sua mensagem, também Editar e Apagar (só quem escreveu edita ou apaga). A mensagem editada mostra "editada" ao lado da hora. Apagar pede confirmação e deixa no lugar "Mensagem apagada" para todos: o texto e as reações somem, mas o registro de que houve uma mensagem fica.
**fonte:** src/modulos/chat/conversa.jsx; supabase/migrations/20261002210000_chat.sql

## Reações

**perguntas:** reagir a mensagem | reacao no chat | curtir mensagem | joinha na mensagem | quem reagiu | tirar reacao
**resposta:** No "⋯" da mensagem, a primeira linha tem as reações rápidas: 👍 ✅ ❤️ 😂 👀 🙏. Escolha uma e ela aparece embaixo da mensagem, com a contagem; passe o mouse sobre a reação para ver quem reagiu. Clicar numa reação que já está na mensagem põe a sua (ou tira, se já for sua). As reações chegam na hora para todos da conversa; mensagem apagada não tem reação.
**fonte:** src/modulos/chat/conversa.jsx; src/lib/chat.js; supabase/migrations/20261005100000_chat_limpar_e_reacoes.sql

## Emojis

**perguntas:** enviar emoji | emoji no chat | carinha no chat | botao de emoji | emojis recentes | procurar emoji
**resposta:** O botão da carinha, à esquerda de "Compartilhar esta tela", abre os emojis: carinhas, gestos, trabalho (pasta, clipe, calendário, alfinete…), símbolos (✅ ❌ ⚠️…) e celebração. Dá para procurar pelo nome em português, como "joinha", "café" ou "atenção" (Enter escolhe o primeiro). O emoji entra onde está o cursor e o seletor fica aberto para escolher mais; Esc ou um clique fora fecha. Os que você usa aparecem em "Recentes", guardados só neste navegador.
**fonte:** src/modulos/chat/seletor-de-emoji.jsx; src/lib/emojis-do-chat.js

## Limpar conversa

**perguntas:** limpar conversa | limpar historico do chat | apagar conversa | esconder mensagens antigas | zerar a conversa
**resposta:** No menu da conversa (os três pontinhos ao lado do nome), "Limpar conversa" esconde para você todas as mensagens até agora, depois de confirmar. Só para você: as outras pessoas continuam vendo tudo e nada é apagado. As mensagens que chegarem depois aparecem normalmente. Não existe apagar a conversa para todos; num grupo, você pode Sair do grupo.
**fonte:** src/modulos/chat/conversa.jsx; supabase/migrations/20261005100000_chat_limpar_e_reacoes.sql

## Não lidas e avisos

**perguntas:** mensagens nao lidas | contador de mensagens | numero no titulo da aba | som do chat | notificacao do chat | silenciar conversa | avisos do chat
**resposta:** O número no ícone Mensagens e na frente do nome da aba, como "(3) MONITORA", soma as mensagens não lidas de todas as conversas, menos as silenciadas. Abrir a conversa marca como lida. No fim da lista, em Avisos, você liga o Som e as Notificações do navegador; os dois começam desligados, e a notificação pede a permissão do navegador. "Silenciar", no menu da conversa, tira a conversa do contador e dos avisos.
**fonte:** src/modulos/chat/estado.js; src/modulos/chat/painel.jsx; src/lib/identidade-da-aba.js

## Aviso de mensagem nova

**perguntas:** aviso de mensagem nova | popup do chat | notificacao quando chega mensagem | nao aparece aviso de mensagem | aviso no canto da tela | ativar notificacao do navegador | aviso some sozinho
**resposta:** Quando chega mensagem de outra pessoa e você não está com aquela conversa aberta na tela, aparece um aviso no canto inferior direito com quem mandou e o começo do texto; clique nele para abrir a conversa, ou no X para dispensar. Ele some sozinho em alguns segundos (fica enquanto o mouse está em cima) e aparecem no máximo três, um por conversa. Com o MONITORA em outra aba ou minimizado, o aviso vem como notificação do navegador, se você ligou "Notificações do navegador" em Avisos, no fim da lista de conversas: o navegador pede a permissão nesse clique. Suas mensagens, as apagadas e as de conversas silenciadas não geram aviso.
**fonte:** src/modulos/chat/avisos.jsx; src/modulos/chat/estado.js; src/lib/avisos-do-chat.js

## Tempo real e online

**perguntas:** chat em tempo real | mensagem demora a chegar | digitando no chat | ponto verde no chat | quem esta online no chat | reconectando | novas mensagens | botao seta para baixo no chat
**resposta:** As mensagens chegam na hora, sem recarregar a página, e aparece "está digitando…" quando alguém escreve na conversa aberta. A conversa abre na última mensagem; se você estiver lendo mensagens antigas quando chegar uma nova, aparece o botão "↓ Nova mensagem", que leva ao fim. Se a conexão cair, o painel mostra "Reconectando…" e, ao voltar, busca o que chegou; ao voltar para a aba do navegador, a lista também é relida. O ponto verde indica quem esteve com o MONITORA aberto nos últimos 2 minutos.
**fonte:** src/modulos/chat/estado.js; supabase/migrations/20261002210000_chat.sql

## Quem pode usar as Mensagens

**perguntas:** quem pode usar o chat | nao vejo o icone de mensagens | permissao do chat | desligar o chat de um grupo
**resposta:** Mensagens é um recurso da matriz de acessos (Configurações › Acessos), com dois níveis: Sem acesso ou Usar. Em teste, só os grupos Administrador global e Gestor estão com Usar (05/10/2026); o administrador liga ou desliga por grupo ou por pessoa. Pessoas online, de onde sai o botão Mensagem, também é só do administrador global e do Gestor. Sem o recurso, o ícone não aparece e o botão "Conversa" some de Editais e da Classificação. Em Pessoas online, cada pessoa tem o botão "Mensagem", que abre a conversa direta com ela.
**fonte:** src/lib/permissoes-recursos.js; src/lib/access-roles.js; supabase/migrations/20261002210000_chat.sql
