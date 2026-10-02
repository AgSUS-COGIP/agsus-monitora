# Regras das Mensagens (chat)

O chat do MONITORA: o ícone Mensagens no cabeçalho e o painel lateral. Fontes:
`src/modulos/chat/`, `src/lib/chat.js`, `src/lib/access-roles.js` (`podeUsarChat`) e
`supabase/migrations/20261002210000_chat.sql`.

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

**perguntas:** editar mensagem | apagar mensagem | mensagem apagada | corrigir mensagem enviada | excluir mensagem do chat
**resposta:** Passe o mouse (ou o foco) na sua mensagem para ver Editar e Apagar; só quem escreveu edita ou apaga. A mensagem editada mostra "editada" ao lado da hora. Apagar pede confirmação e deixa no lugar "Mensagem apagada" para todos: o texto some, mas o registro de que houve uma mensagem fica.
**fonte:** src/modulos/chat/conversa.jsx; supabase/migrations/20261002210000_chat.sql

## Não lidas e avisos

**perguntas:** mensagens nao lidas | contador de mensagens | numero no titulo da aba | som do chat | notificacao do chat | silenciar conversa | avisos do chat
**resposta:** O número no ícone Mensagens e na frente do nome da aba, como "(3) MONITORA", soma as mensagens não lidas de todas as conversas, menos as silenciadas. Abrir a conversa marca como lida. No fim da lista, em Avisos, você liga o Som e as Notificações do navegador; os dois começam desligados, e a notificação pede a permissão do navegador. "Silenciar", no menu da conversa, tira a conversa do contador e dos avisos.
**fonte:** src/modulos/chat/estado.js; src/modulos/chat/painel.jsx; src/lib/identidade-da-aba.js

## Tempo real e online

**perguntas:** chat em tempo real | mensagem demora a chegar | digitando no chat | ponto verde no chat | quem esta online no chat | reconectando
**resposta:** As mensagens chegam na hora, sem recarregar a página, e aparece "está digitando…" quando alguém escreve na conversa aberta. Se a conexão cair, o painel mostra "Reconectando…" e, ao voltar, busca o que chegou; ao voltar para a aba do navegador, a lista também é relida. O ponto verde indica quem esteve com o MONITORA aberto nos últimos 2 minutos.
**fonte:** src/modulos/chat/estado.js; supabase/migrations/20261002210000_chat.sql

## Quem pode usar as Mensagens

**perguntas:** quem pode usar o chat | nao vejo o icone de mensagens | permissao do chat | desligar o chat de um grupo
**resposta:** Mensagens é um recurso da matriz de acessos (Configurações › Acessos), com dois níveis: Sem acesso ou Usar. Todos os grupos começam com Usar; o administrador pode desligar por grupo ou por pessoa. Sem o recurso, o ícone não aparece e o botão "Conversa" some de Editais e da Classificação. Em Pessoas online, cada pessoa tem o botão "Mensagem", que abre a conversa direta com ela.
**fonte:** src/lib/permissoes-recursos.js; src/lib/access-roles.js; supabase/migrations/20261002210000_chat.sql
