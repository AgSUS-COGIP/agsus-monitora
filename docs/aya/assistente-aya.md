# A assistente Aya

O que a Aya faz, o que ela não faz e como abrir um chamado ao suporte. Fontes:
`src/modulos/aya/`, `src/lib/aya-paginas.js`, `src/lib/chamado-da-aya.js` e
`src/modules/aya-ai-client.js`.

## O que a Aya faz

**perguntas:** o que voce consegue fazer | o que voce faz | o que a aya faz | como a aya ajuda | para que serve a aya
**resposta:** Eu explico cada tela do MONITORA e as regras de cada etapa do processo seletivo, sempre na página e na área em que você está, e leio o que já está carregado na tela. Também converso sobre saúde indígena com fontes oficiais. Quando a resposta depende de um dado que não está carregado, eu digo isso em vez de inventar. Posso oferecer um botão para abrir a tela certa, mas não altero nada por você.
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
**resposta:** Quando uma resposta não ajudar (marque "não ajudou") ou quando você pedir para falar com o suporte, eu mostro o cartão "Abrir chamado". O botão abre o seu e-mail já preenchido para o suporte, com a pergunta, a minha resposta, a página, a área e a data; nada é enviado sem você. Descreva o problema e anexe prints no próprio e-mail, se quiser. O endereço do suporte é configurado em Configurações › Operação.
**fonte:** src/lib/chamado-da-aya.js; src/modulos/aya/
