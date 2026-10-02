# A assistente Aya

O que a Aya faz, o que ela não faz e como abrir um chamado ao suporte. Fontes:
`src/modulos/aya/`, `src/lib/aya-paginas.js`, `src/lib/chamado-da-aya.js` e
`src/lib/busca-da-aya.js`; tours e trilhas em `src/modulos/aya/tour/` e `src/lib/aya-tours.js`.

## O que a Aya faz

**perguntas:** o que voce consegue fazer | o que voce faz | o que a aya faz | como a aya ajuda | para que serve a aya
**resposta:** Eu explico cada tela do MONITORA e as regras de cada etapa do processo seletivo, sempre na página e na área em que você está, e leio o que já está carregado na tela. Uso a base de conhecimento, sem IA local, máquina ou túnel. Reconheço sinônimos, perguntas sem acento e pequenos erros de digitação. Quando não tenho certeza, ofereço até três perguntas parecidas e a opção de abrir chamado; perguntas fora do MONITORA recebem sugestões do que posso explicar. Quando a resposta depende de um dado que não está carregado, eu digo isso em vez de inventar. Posso oferecer um botão para abrir a tela certa, mas não altero nada por você.
**fato:** A interface do MONITORA não tem textos explicativos: quem explica as telas e as regras é a Aya, no contexto da página e da área atuais.
**fonte:** comportamento da Aya

## Dados e privacidade da Aya

**perguntas:** voce consulta meus dados | a aya ve meus dados | privacidade da aya | a conversa fica guardada
**resposta:** Eu uso só o que já está disponível para você no MONITORA e não amplio seu acesso. A conversa fica guardada só nesta aba do navegador e some quando ela fecha; "Limpar conversa" apaga antes. A avaliação "Isso ajudou?" fica só no seu navegador.
**fonte:** src/modules/aya-memoria.js; src/modulos/aya/

## Alterações pela Aya

**perguntas:** voce pode alterar algo por mim | a aya pode salvar | a aya pode editar
**resposta:** Não. Eu oriento o caminho e posso abrir a tela certa, mas a confirmação e qualquer alteração continuam com você.
**fonte:** comportamento da Aya

## Abrir chamado ao suporte

**perguntas:** como abrir um chamado | abrir chamado | falar com o suporte | contato do suporte | chamado ao suporte
**resposta:** Use também o ícone de envelope (Feedback e suporte), no alto do painel da Aya, para enviar uma dúvida ou sugestão. Quando uma resposta não ajudar (marque "não ajudou") ou quando você pedir para falar com o suporte, eu mostro o cartão "Abrir chamado". O botão abre o Gmail no navegador, em uma nova aba, já preenchido para o suporte, com a pergunta, a minha resposta, a página, a área e a data; nada é enviado sem você. Descreva o problema e anexe prints no próprio e-mail, se quiser. O endereço do suporte é configurado em Configurações › Operação.
**fonte:** src/lib/chamado-da-aya.js; src/modulos/aya/

## Tour guiado da tela

**perguntas:** me mostra esta tela | tour guiado | tour da tela | como funciona o tour | mostrar a tela | me mostra a tela
**resposta:** Em Editais, Cronograma, Análises curriculares, Recursos, Entrevistas, Lista de aprovados, Seleção, Visão geral e Configurações › Acessos, toque em "Me mostra esta tela" (a sugestão do painel ou o ícone de bússola no topo dele). Eu escureço a página e destaco uma parte por vez, com uma explicação curta. Use Próximo e Voltar (ou as setas do teclado), Pular ou Esc para sair. O que o seu perfil não vê, ou o que a tela ainda não tem, eu pulo. O tour só mostra: não altera nada.
**fato:** A Aya tem um tour guiado ("Me mostra esta tela") que destaca as partes da página atual, uma por vez.
**fonte:** src/modulos/aya/tour/; src/lib/aya-tours.js

## Trilhas da Aya

**perguntas:** trilhas | trilha | aprender | curso do monitora | como aprender a usar o monitora | primeiros passos | do edital ao aprovado
**resposta:** Na seção "Aprender" do meu painel ficam as trilhas: tours que atravessam várias telas na ordem do trabalho. São elas: Primeiros passos; Do edital ao aprovado; Conduzir uma entrevista; Registrar e decidir um recurso; e Dar acesso a alguém. Eu mostro só as que o seu perfil pode fazer. O progresso ("3 de 7", "Concluída") fica guardado só neste navegador: sair no meio e voltar depois retoma de onde parou, e uma trilha concluída pode ser refeita. Na primeira entrada eu ofereço "Primeiros passos" uma única vez, sem obrigar.
**fato:** As trilhas da Aya (seção Aprender) são Primeiros passos, Do edital ao aprovado, Conduzir uma entrevista, Registrar e decidir um recurso e Dar acesso a alguém; aparecem conforme as permissões do perfil.
**fonte:** src/modulos/aya/tour/; src/lib/aya-tours.js
