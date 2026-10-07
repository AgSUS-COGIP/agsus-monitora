# Regras das Mensagens (chat)

O chat do MONITORA: o ícone Mensagens no cabeçalho e o painel lateral. Fontes:
`src/modulos/chat/`, `src/lib/chat.js`, `src/lib/emojis-do-chat.js`, `src/lib/access-roles.js`
(`podeUsarChat`), `supabase/migrations/20261002210000_chat.sql` e
`supabase/migrations/20261005100000_chat_limpar_e_reacoes.sql` e, para a retenção,
`src/modulos/configuracoes/mensagens-do-chat.jsx`, `src/lib/retencao-do-chat.js` e
`supabase/migrations/20261005190000_chat_retencao_das_mensagens.sql`. Da versão 2 (anexos,
responder, encaminhar, busca, visto, cartões, fixar, não lida e status): `src/lib/anexos-do-chat.js`
e `supabase/migrations/20261007210000_chat_v2.sql`.

## O que é o chat

**perguntas:** o que e o chat | chat do monitora | como mandar mensagem | onde ficam as mensagens | icone de mensagens | painel de mensagens
**resposta:** O ícone Mensagens (balões de conversa) fica no cabeçalho, ao lado de Pessoas online, com o número de mensagens não lidas. Ele abre um painel à direita, que não bloqueia a tela: dá para continuar trabalhando com ele aberto. O painel lista as conversas — as fixadas no topo, depois da mais recente para a mais antiga — com a última mensagem, a hora, as não lidas, um "@" quando alguém mencionou você e o ponto de presença (verde, vermelho ou âmbar). A busca do topo procura no nome da conversa, nas pessoas e na unidade do edital e, a partir de 2 letras, também dentro das mensagens. Embaixo ficam "Meu status" e os Avisos.
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
**resposta:** Enter envia e Shift+Enter quebra a linha. A mensagem tem até 4.000 caracteres; perto do limite aparece a contagem. Com anexo ou cartão, o texto pode ficar vazio. Digite @ e o começo do nome para mencionar alguém da conversa: escolha a pessoa na lista (setas e Enter, ou clique). A pessoa mencionada vê o "@" na lista, a menção destacada e a mensagem com uma borda azul, e recebe o aviso mesmo que tenha silenciado a conversa. Se a rede falhar, a mensagem fica como "Não enviada", com "Tentar de novo"; reenviar não duplica (nem sobe o arquivo de novo).
**fonte:** src/modulos/chat/conversa.jsx; src/lib/chat.js

## Compartilhar esta tela

**perguntas:** compartilhar esta tela | mandar link da tela | link no chat | abrir tela pelo chat
**resposta:** "Compartilhar esta tela", embaixo do campo da mensagem, anexa à mensagem o lugar onde você está: a página, a área e, na Classificação, o edital escolhido (em Configurações, a seção). A mensagem mostra um cartão com o nome da tela e o botão "Abrir", que leva à mesma tela dentro do MONITORA. Quem não tem a página vê "Sem acesso" no lugar do botão. Não é um endereço da internet: o chat não abre sites externos.
**fonte:** src/modulos/chat/ponte.js; src/lib/chat.js

## Editar e apagar mensagem

**perguntas:** editar mensagem | apagar mensagem | mensagem apagada | corrigir mensagem enviada | excluir mensagem do chat | copiar texto da mensagem | menu da mensagem | tres pontinhos da mensagem
**resposta:** Cada mensagem tem o botão "⋯" (três pontinhos) no canto, sempre à vista — também no celular, com um toque. Ele abre as reações rápidas, Responder, Encaminhar e "Copiar texto"; na sua mensagem, também Editar e Apagar (só quem escreveu edita ou apaga). A mensagem editada mostra "editada" ao lado da hora. Apagar pede confirmação e deixa no lugar "Mensagem apagada" para todos: o texto, as reações e os anexos somem (ninguém mais baixa o arquivo), mas o registro de que houve uma mensagem fica.
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

## Anexar arquivo

**perguntas:** anexar arquivo no chat | mandar pdf no chat | enviar planilha no chat | enviar imagem no chat | clipe no chat | tipos de arquivo do chat | tamanho maximo do anexo | arrastar arquivo para o chat
**resposta:** O clipe, ao lado da carinha, embaixo do campo, escolhe o arquivo; também dá para arrastar o arquivo para o campo. Valem PDF, imagem (PNG, JPG, WEBP, GIF) e planilha (XLSX, XLS, ODS, CSV), de até 10 MB cada, até 5 por mensagem. Os escolhidos aparecem acima do campo (a imagem com miniatura), com um X para tirar; a mensagem pode ir só com o anexo. Na conversa, a imagem aparece em miniatura e o arquivo com o nome e o tamanho: clique para baixar. O arquivo fica guardado de forma privada: só quem participa da conversa baixa, por um link que vale 1 minuto.
**fonte:** src/modulos/chat/conversa.jsx; src/lib/anexos-do-chat.js; supabase/migrations/20261007210000_chat_v2.sql

## Colar print no chat

**perguntas:** colar print no chat | ctrl v imagem no chat | colar captura de tela | mandar print | print screen no chat
**resposta:** Copie a imagem (a tecla Print Screen, a Ferramenta de Captura ou "Copiar imagem") e cole no campo da mensagem com Ctrl+V: ela vira anexo, com um nome de print com a data e a hora (por exemplo, print-2026-10-07-14h05m09.png). Texto colado continua indo para o campo normalmente.
**fonte:** src/modulos/chat/conversa.jsx; src/lib/anexos-do-chat.js

## Responder mensagem

**perguntas:** responder mensagem | citar mensagem | responder uma mensagem especifica | resposta no chat | ir para a mensagem citada
**resposta:** No "⋯" da mensagem, "Responder" mostra acima do campo "Respondendo a…" com o começo da mensagem (o X desiste). A resposta vai com a citação; clicar na citação rola a conversa até a mensagem original e a destaca por um instante (se ela for antiga, o chat busca as páginas anteriores). Se a original for apagada pela retenção, a citação some.
**fonte:** src/modulos/chat/conversa.jsx; src/modulos/chat/estado.js; supabase/migrations/20261007210000_chat_v2.sql

## Encaminhar mensagem

**perguntas:** encaminhar mensagem | repassar mensagem | mandar a mensagem para outra conversa | encaminhada no chat
**resposta:** No "⋯" da mensagem, "Encaminhar" abre a lista das suas conversas: escolha a de destino e a mensagem vai para lá com o texto, o cartão e os anexos, marcada como "Encaminhada" — sem as menções e sem dizer de que conversa veio. Mensagem apagada não se encaminha.
**fonte:** src/modulos/chat/painel.jsx; supabase/migrations/20261007210000_chat_v2.sql

## Buscar nas mensagens

**perguntas:** buscar mensagem | procurar texto nas conversas | pesquisar no chat | achar mensagem antiga | buscar arquivo no chat
**resposta:** Na busca do topo da lista, a partir de 2 letras, aparece "Nas mensagens", com os resultados das suas conversas: a conversa, quem escreveu, quando e o trecho com o termo destacado (também acha pelo nome do anexo). Maiúsculas e acentos não importam. Clique no resultado para abrir a conversa já na mensagem. A busca só olha conversas que você acompanha e o que você não limpou; mensagens apagadas não aparecem.
**fonte:** src/modulos/chat/painel.jsx; supabase/migrations/20261007210000_chat_v2.sql

## Visto (lido)

**perguntas:** visto no chat | mensagem lida | dois tracinhos | quem viu a mensagem | confirmacao de leitura | sabe se a pessoa leu
**resposta:** Nas suas mensagens, ao lado da hora: ✓ quer dizer enviada e ✓✓ azul, vista. Na conversa direta, ✓✓ quando a outra pessoa abriu a conversa depois do envio. No grupo, passe o mouse sobre os tracinhos para ver "Visto por" com os nomes; ✓✓ azul quando todos viram. Só quem participa da conversa vê a leitura dos outros: na conversa do edital, quem só tem acesso ao edital e não a acompanha não vê.
**fonte:** src/modulos/chat/conversa.jsx; src/lib/chat.js; supabase/migrations/20261007210000_chat_v2.sql

## Cartões e Compartilhar esta ficha

**perguntas:** cartao no chat | compartilhar esta ficha | mandar ficha da avaliacao documental | link da ficha no chat | botao abrir no chat | sem acesso no cartao
**resposta:** Links internos viram cartão na mensagem: a tela, o edital ou a ficha da Avaliação documental (pelo código do candidato), com o botão "Abrir". Na ficha aberta no modo de análise, a lateral tem "Compartilhar esta ficha": o painel de Mensagens abre para você escolher a conversa e o cartão fica pronto no campo — é só escrever (ou não) e enviar. Quem recebe clica em "Abrir" e vai para a Fila do edital com a ficha aberta, se tiver acesso à Avaliação documental e ao edital; sem a página, o cartão mostra "Sem acesso", e o banco confere de novo ao abrir.
**fonte:** src/modulos/chat/ponte.js; src/modulos/avaliacao-documental/ficha/ficha.jsx; src/lib/chat.js

## Fixar e marcar como não lida

**perguntas:** fixar conversa | conversa no topo | alfinete no chat | marcar como nao lida | deixar conversa como nao lida | soltar do topo
**resposta:** No menu da conversa (os três pontinhos ao lado do nome), "Fixar no topo" deixa a conversa sempre no alto da lista, com um alfinete (a fixada por último fica primeiro); "Soltar do topo" desfaz. "Marcar como não lida" volta para a lista com a conversa contando 1 não lida, para você lembrar dela; abrir a conversa desmarca. Valem só para você.
**fonte:** src/modulos/chat/conversa.jsx; supabase/migrations/20261007210000_chat_v2.sql

## Meu status

**perguntas:** status no chat | ocupado no chat | ausente no chat | disponivel | ponto vermelho | ponto amarelo no chat | mudar meu status
**resposta:** No fim da lista de conversas, "Meu status" tem Disponível, Ocupado e Ausente. Os outros veem o ponto no seu avatar enquanto você está com o MONITORA aberto: verde (Disponível), vermelho (Ocupado) ou âmbar (Ausente); na conversa direta, aparece também escrito. Fora do MONITORA, não há ponto. O status fica guardado até você mudar.
**fonte:** src/modulos/chat/painel.jsx; src/modulos/chat/avatar.jsx; supabase/migrations/20261007210000_chat_v2.sql

## Não lidas e avisos

**perguntas:** mensagens nao lidas | contador de mensagens | numero no titulo da aba | som do chat | notificacao do chat | silenciar conversa | avisos do chat
**resposta:** O número no ícone Mensagens e na frente do nome da aba, como "(3) MONITORA", soma as mensagens não lidas de todas as conversas; das silenciadas, só conta as menções a você. Abrir a conversa marca como lida. No fim da lista, em Avisos, você liga o Som e as Notificações do navegador; os dois começam desligados, e a notificação pede a permissão do navegador. "Silenciar", no menu da conversa, tira a conversa do contador e dos avisos — menos quando alguém menciona você com @.
**fonte:** src/modulos/chat/estado.js; src/modulos/chat/painel.jsx; src/lib/identidade-da-aba.js

## Aviso de mensagem nova

**perguntas:** aviso de mensagem nova | popup do chat | notificacao quando chega mensagem | nao aparece aviso de mensagem | aviso no canto da tela | ativar notificacao do navegador | aviso some sozinho
**resposta:** Quando chega mensagem de outra pessoa e você não está com aquela conversa aberta na tela, aparece um aviso no canto inferior direito com quem mandou e o começo do texto; clique nele para abrir a conversa, ou no X para dispensar. Ele some sozinho em alguns segundos (fica enquanto o mouse está em cima) e aparecem no máximo três, um por conversa. Com o MONITORA em outra aba ou minimizado, o aviso vem como notificação do navegador, se você ligou "Notificações do navegador" em Avisos, no fim da lista de conversas: o navegador pede a permissão nesse clique. Suas mensagens e as apagadas não geram aviso; as de conversas silenciadas também não, a não ser que mencionem você.
**fonte:** src/modulos/chat/avisos.jsx; src/modulos/chat/estado.js; src/lib/avisos-do-chat.js

## Tempo real e online

**perguntas:** chat em tempo real | mensagem demora a chegar | digitando no chat | ponto verde no chat | quem esta online no chat | reconectando | novas mensagens | botao seta para baixo no chat
**resposta:** As mensagens chegam na hora, sem recarregar a página, e aparece "está digitando…" quando alguém escreve na conversa aberta. A conversa abre na última mensagem; se você estiver lendo mensagens antigas quando chegar uma nova, aparece o botão "↓ Nova mensagem", que leva ao fim. Se a conexão cair, o painel mostra "Reconectando…" e, ao voltar, busca o que chegou; ao voltar para a aba do navegador, a lista também é relida. O ponto no avatar indica quem esteve com o MONITORA aberto nos últimos 2 minutos (verde, vermelho ou âmbar conforme o status da pessoa).
**fonte:** src/modulos/chat/estado.js; supabase/migrations/20261002210000_chat.sql

## Quem pode usar as Mensagens

**perguntas:** quem pode usar o chat | nao vejo o icone de mensagens | permissao do chat | desligar o chat de um grupo
**resposta:** Mensagens é um recurso da matriz de acessos (Configurações › Acessos), com dois níveis: Sem acesso ou Usar. Em teste, só os grupos Administrador global e Gestor estão com Usar (05/10/2026); o administrador liga ou desliga por grupo ou por pessoa. Pessoas online, de onde sai o botão Mensagem, também é só do administrador global e do Gestor. Sem o recurso, o ícone não aparece e o botão "Conversa" some de Editais e da Classificação. Em Pessoas online, cada pessoa tem o botão "Mensagem", que abre a conversa direta com ela.
**fonte:** src/lib/permissoes-recursos.js; src/lib/access-roles.js; supabase/migrations/20261002210000_chat.sql

## Seção Mensagens (chat) das Configurações

**perguntas:** para que serve mensagens (chat) | para que serve a secao mensagens (chat) | configuracoes mensagens chat | retencao do chat | quem configura o chat | secao mensagens das configuracoes
**resposta:** Em Configurações › Mensagens (chat), só o administrador global define por quanto tempo o chat guarda as mensagens, zera as mensagens e vê o histórico das limpezas. No topo aparecem quantas mensagens, reações e conversas existem e a data da mensagem mais antiga.
**fonte:** src/modulos/configuracoes/mensagens-do-chat.jsx; supabase/migrations/20261005190000_chat_retencao_das_mensagens.sql
**abrir:** config:mensagens

## Prazo de retenção das mensagens

**perguntas:** prazo de retencao das mensagens | como funciona o prazo de retencao das mensagens | por quanto tempo o chat guarda as mensagens | mensagens antigas somem | apagar mensagens antigas do chat | lgpd chat | guardar para sempre
**resposta:** O padrão é "Guardar para sempre". O administrador global pode escolher 30, 90, 180 ou 365 dias, ou outro prazo de 7 a 3.650 dias, e informa o motivo. A tela mostra quantas mensagens o prazo escolhido apagaria; se apagar alguma, pede confirmação ("Isto apaga X mensagens com mais de N dias; não dá para desfazer"). Ao salvar, as mensagens mais antigas que o prazo, as reações e os anexos delas são apagados de fato, na hora (dado que passou do prazo deixa de existir, como pede a LGPD); as conversas continuam, sem essas mensagens. Depois, uma limpeza automática roda todo dia às 3h15 de Brasília e aparece em Status das atualizações como "Retenção das mensagens do chat". Quem está com o chat aberto vê as mensagens sumirem sozinhas. Os arquivos dos anexos apagados saem do armazenamento sozinhos, todo dia às 6h30 de Brasília (o "Expurgo dos anexos do chat" em Status das atualizações), e também quando o administrador global abre esta seção; o que não sair num dia fica para o seguinte. Enquanto espera, o arquivo já não abre para ninguém. O arquivo encaminhado só sai quando a última cópia sai.
**fonte:** src/lib/retencao-do-chat.js; supabase/migrations/20261005190000_chat_retencao_das_mensagens.sql; supabase/migrations/20261007250000_expurgo_diario_dos_anexos_do_chat.sql; .github/workflows/expurgo-anexos-chat.yml
**abrir:** config:mensagens

## Zerar mensagens

**perguntas:** o que o zerar mensagens apaga | zerar mensagens | apagar todas as mensagens do chat | limpar o chat de todo mundo | apagar conversas sem participante
**resposta:** "Zerar mensagens" apaga TODAS as mensagens, reações e anexos do chat, de todas as pessoas, sem volta. Antes, a tela mostra quanto vai ser apagado. Marcando "Apagar também as conversas sem participante ativo", saem ainda os grupos e as conversas de edital que todos deixaram; conversas diretas e as que ainda têm alguém continuam, vazias. Para confirmar, é preciso digitar ZERAR (em maiúsculas) e informar o motivo (de 3 a 500 caracteres). É diferente de "Limpar conversa", que só esconde o histórico para você.
**fonte:** src/modulos/configuracoes/mensagens-do-chat.jsx; supabase/migrations/20261005190000_chat_retencao_das_mensagens.sql
**abrir:** config:mensagens

## Histórico das limpezas do chat

**perguntas:** historico das limpezas | quem apagou as mensagens do chat | quando as mensagens foram apagadas | auditoria do chat
**resposta:** Em Configurações › Mensagens (chat), o histórico mostra cada limpeza: o tipo (prazo salvo, limpeza diária ou zerar), quando, quem pediu (ou "Tarefa diária"), quantas mensagens, reações, anexos e conversas saíram e o motivo. O histórico nunca guarda o conteúdo das mensagens apagadas, nem o nome dos arquivos.
**fonte:** supabase/migrations/20261005190000_chat_retencao_das_mensagens.sql
**abrir:** config:mensagens
