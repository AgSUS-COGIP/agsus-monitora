# Regras das Configurações

<!-- Fontes: src/componentes/configuracoes/, src/lib/publicacao-de-configuracoes.js, src/lib/paineis-externos-das-configuracoes.js, src/modules/config-secoes.js e src/lib/access-roles.js. -->

Regras de negócio das seções Página inicial, Tela de acesso e Aparência de
Configurações. A tela mostra só rótulos curtos; a explicação de cada campo
mora aqui, com a Aya. Tudo o que muda nestas seções (menos a arte de fundo)
fica pendente até "Salvar alterações", que pede um motivo e registra a
publicação no histórico de Operação, de onde uma versão pode ser restaurada.

## Página inicial nas Configurações

**perguntas:** configuracao da pagina inicial | o que a secao pagina inicial define | para que serve pagina inicial | para que serve a secao pagina inicial | configurar pagina inicial | titulo da pagina inicial | subtitulo da pagina inicial
**resposta:** Em Configurações, a seção Página inicial define o título e o subtítulo que abrem a página inicial, o aviso global, os textos do painel de filtros e o rótulo de cada um dos seis indicadores do topo. O título é obrigatório. A prévia ao lado mostra a página como ela vai ficar; os números da prévia são só marcadores.
**fonte:** interface do MONITORA

## Aviso global

**perguntas:** aviso global | como funciona o aviso global | aviso no topo | faixa de aviso | mensagem global | tipo do aviso
**resposta:** O aviso global é a faixa no topo do sistema, vista por todas as pessoas. O tipo escolhe a cor: Informação (azul), Alerta (amarelo) ou Crítico (vermelho). Com a mensagem em branco, a faixa não aparece. Ele é definido em Configurações › Página inicial e só vale depois de salvo.
**fonte:** interface do MONITORA

## Textos dos filtros e rótulos dos indicadores

**perguntas:** texto do botao de filtros | mostrar filtros | ocultar filtros | rotulo dos indicadores | rotulos dos kpis
**resposta:** Em Configurações › Página inicial, o grupo Filtros define o título e o subtítulo do painel de filtros do mapa e da tabela, e o texto do botão que abre os filtros (Mostrar) e que os fecha (Ocultar). O grupo Indicadores define o rótulo de cada número do topo da página inicial, na mesma ordem em que aparecem: Processos, Vagas, Contratações, Ociosas, Críticos e Inscritos.
**fonte:** interface do MONITORA

## Tela de acesso nas Configurações

**perguntas:** configurar tela de acesso | o que a secao tela de acesso define | para que serve tela de acesso | para que serve a secao tela de acesso | configurar tela de login | saudacao do login | saudacao da tela de acesso | slogan do login
**resposta:** Em Configurações, a seção Tela de acesso define a saudação (o título grande do cartão de entrada) e o botão Entrar com Google: se ele aparece, o texto dele e o domínio sugerido. Também define quais domínios de e-mail podem entrar. O slogan "Monitoramento de Processos Seletivos" é fixo. A arte de fundo, o logo e a cor do cartão ficam na seção Aparência. A prévia ao lado mostra a tela como ela vai ficar.
**fonte:** interface do MONITORA

## Login com Google desligado

**perguntas:** desligar login google | o que acontece se desligar o login google | login google inativo | desativar google | botao do google sumiu
**resposta:** Com o Login Google em Inativo, o botão Entrar com Google some da tela de entrada. Como esse é o acesso institucional principal, as pessoas podem ficar sem conseguir entrar; por isso, ao salvar a desativação, o sistema pede confirmação antes de publicar.
**fonte:** interface do MONITORA

## Domínio sugerido no login Google

**perguntas:** dominio sugerido | dica de dominio | dominio do google
**resposta:** O domínio sugerido é passado à tela do Google para quem tem mais de uma conta conectada, para que a conta institucional apareça primeiro. Deve ser escrito no formato agenciasus.org.br, sem https://, @ ou barras; fora desse formato, a publicação é recusada.
**fonte:** interface do MONITORA

## Domínios permitidos

**perguntas:** dominios permitidos | quais dominios podem entrar | dominios institucionais | quem pode entrar | email de outro dominio
**resposta:** Só e-mails dos domínios permitidos passam da tela de entrada; quem entra com e-mail de outro domínio não chega ao sistema. Separe mais de um domínio por vírgula, como em agenciasus.org.br,agsus.org.br. Em branco, valem os domínios institucionais padrão (agenciasus.org.br e agsus.org.br).
**fonte:** interface do MONITORA

## Arte de fundo da tela de acesso

**perguntas:** arte de fundo | como trocar a arte de fundo da tela de acesso | como trocar a arte de fundo | imagem de fundo do acesso | fundo da tela de login | artes enviadas
**resposta:** A arte de fundo da tela de acesso é escolhida em Configurações › Aparência. Use uma arte 16:9, em JPG, PNG ou WEBP, de até 6 MB. Diferente dos outros campos, a arte é aplicada na hora, sem passar por "Salvar alterações". Toda imagem enviada fica guardada em Artes enviadas para ser reutilizada. A arte em uso não pode ser apagada: para apagá-la, escolha outra ou restaure o padrão antes. Restaurar padrão volta para a arte institucional.
**fonte:** interface do MONITORA

## Logo da tela de acesso

**perguntas:** logo no acesso | logo da tela de login | logo da agsus no acesso
**resposta:** O logo da tela de acesso aceita um caminho do próprio site, como /assets/agsus-logo.webp, ou um endereço HTTPS da identidade institucional. Endereço em outro formato é recusado na publicação.
**fonte:** interface do MONITORA

## Cor do painel e texto sobre o painel

**perguntas:** cor do painel de acesso | texto sobre o painel | contraste do painel | o que significa o contraste da cor do painel | sempre claro | sempre escuro
**resposta:** A cor do painel pinta o cartão da tela de acesso. Em Texto sobre o painel, Automático escolhe texto claro ou escuro pelo contraste com a cor; Sempre claro e Sempre escuro impõem o texto, por decisão de identidade visual, mesmo quando isso reprova a WCAG. Abaixo da cor aparece a razão de contraste: abaixo de 4,5, quem tem baixa visão pode não conseguir ler, e uma cor mais escura ou mais clara resolve sem mudar o tom.
**fonte:** interface do MONITORA

## Logo e cor da barra lateral

**perguntas:** logo da barra lateral | como trocar a logo da barra lateral | cor da barra lateral | logos enviadas | trocar logo do menu
**resposta:** A logo e a cor da barra lateral são escolhidas em Configurações › Aparência. A logo aceita JPG, PNG ou WEBP de até 6 MB; enviar guarda o arquivo em Logos enviadas, mas a escolha só vale depois de "Salvar alterações". Enquanto a escolha está pendente, a barra lateral já mostra a logo e a cor escolhidas; descartada a alteração, ela volta ao que está publicado. Os textos e ícones da barra mudam sozinhos para claro ou escuro conforme a cor. A logo selecionada não pode ser apagada: escolha outra ou restaure o padrão antes.
**fonte:** interface do MONITORA

## Quem abre as Configurações

**perguntas:** para que serve configuracoes | tela de configuracoes | quem pode ver as configuracoes | secoes das configuracoes | administracao
**resposta:** Configurações fica em Administração, no menu, com uma seção por item: Marca, Página inicial, Tela de acesso, Aparência, Painéis externos, Operação, Acessos, Módulos e abas e Status das atualizações. As seis primeiras abrem para quem tem Editor em Configurações; Acessos, para quem gerencia acessos; Módulos e abas e Status das atualizações, só para o administrador global. Cada pessoa vê só as seções que pode abrir.
**fonte:** src/lib/access-roles.js; src/modules/config-secoes.js

## Publicar uma alteração

**perguntas:** como publicar uma alteracao nas configuracoes | publicar alteracao | salvar alteracoes | motivo da alteracao | nada a publicar
**resposta:** Nas seções Marca, Página inicial, Tela de acesso, Aparência, Painéis externos e Operação, o que muda fica pendente até "Salvar alterações" (na barra fixa, ou Ctrl+S): o sistema valida, compara com o que está publicado e abre a revisão; sem diferença, não há nada a publicar. A publicação pede o motivo da alteração, grava tudo numa transação só e cria uma nova entrada no histórico, sem apagar nada. Acessos e Módulos e abas salvam pela própria tela, também com motivo. Sair com alteração pendente pergunta antes.
**fonte:** src/componentes/configuracoes/estado.js; src/componentes/configuracoes/configuracoes.jsx

## Restaurar uma versão publicada

**perguntas:** como restaurar uma versao publicada | restaurar versao | historico de configuracoes | historico de publicacoes | desfazer publicacao
**resposta:** Em Configurações › Operação fica o histórico de configurações, com as 30 últimas publicações. Cada item tem "Restaurar", que pede o motivo da restauração e publica de novo aqueles valores; o histórico não perde nada.
**fonte:** src/componentes/configuracoes/estado.js; src/componentes/configuracoes/configuracoes.jsx
**abrir:** config:operacao

## Seção Marca

**perguntas:** o que a secao marca define | secao marca | para que serve marca | para que serve a secao marca | nome da equipe | logo da equipe | texto do rodape
**resposta:** Em Configurações › Marca ficam o nome da equipe, a função ou área, o texto institucional e o logo da equipe (endereço https:// ou /caminho de PNG, JPG, WEBP ou SVG), que aparecem no pé da barra lateral, o texto do rodapé e, em "Documentos oficiais", o cabeçalho da agência (uma linha por linha do timbrado: nome, endereço e site) usado no Word e na prévia "Como fica no SEI" da Classificação. A prévia mostra a barra lateral; a cor e o logo da barra ficam em Aparência. Vale depois de "Salvar alterações".
**fonte:** src/componentes/configuracoes/marca.jsx; src/lib/publicacao-de-configuracoes.js
**abrir:** config:marca

## Seção Aparência

**perguntas:** secao aparencia | para que serve aparencia | para que serve a secao aparencia | o que a secao aparencia define
**resposta:** Em Configurações › Aparência ficam a arte de fundo e o logo da tela de acesso, a cor do painel de acesso e do texto sobre ele, e a logo e a cor da barra lateral. Cada cor mostra a razão de contraste. A arte de fundo vale na hora; o resto, depois de "Salvar alterações".
**fonte:** src/componentes/configuracoes/aparencia.jsx; src/lib/publicacao-de-configuracoes.js
**abrir:** config:aparencia

## Painéis externos

**perguntas:** o que sao os paineis externos | paineis externos | para que serve paineis externos | para que serve a secao paineis externos | como por um painel em manutencao | painel externo
**resposta:** Painéis externos são páginas de fora do MONITORA abertas pelo grupo Painéis do menu. Análises, Recursos, Entrevistas e Seleção viraram abas do próprio sistema e seus painéis externos foram arquivados; sem painel ativo, o grupo Painéis some do menu. Em Configurações › Painéis externos só se editam os painéis que já existem: título, endereço (https:// ou http://; painel ativo precisa de endereço), ativo e em manutenção. Ver um painel exige a marcação dele para a pessoa em Acessos.
**fonte:** src/lib/paineis-externos-das-configuracoes.js; src/componentes/configuracoes/paineis-externos.jsx; supabase/migrations/20260930235500_arquiva_painel_externo_selecao.sql
**abrir:** config:recursos

## Seção Operação

**perguntas:** secao operacao | para que serve operacao | para que serve a secao operacao | versao do sistema | realtime do monitoramento | heartbeat de auditoria | email do suporte
**resposta:** Em Configurações › Operação ficam a versão do sistema e a versão publicada, o Realtime do monitoramento (ativo ou inativo), o heartbeat de auditoria (1 a 60 minutos), o e-mail do suporte (para onde a Aya abre chamados) e o histórico de publicações, com Restaurar.
**fonte:** src/componentes/configuracoes/operacao.jsx; src/lib/publicacao-de-configuracoes.js
**abrir:** config:operacao
