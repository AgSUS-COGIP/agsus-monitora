# Regras dos Acessos

Configurações › Acessos: pessoas, convites, grupos de permissões, coordenações, pedidos e contas
desativadas. O acesso ao MONITORA é só por convite. Fontes: `src/modulos/acessos/`,
`src/lib/permissoes-recursos.js`, `src/lib/teto-de-acessos.js`, `src/lib/convite-de-acesso.js`,
`src/lib/solicitacao-de-acesso.js`, `src/lib/ver-como.js`, `src/lib/access-roles.js` e as migrations
`20260929121000_grupos_de_acesso.sql`, `20260929121100_coordenacoes.sql`,
`20260929121300_gestao_de_acessos_delegada.sql`,
`20260929190100_adicionar_pessoa_e_contas_de_coordenacao.sql`,
`20260930130000_acessos_trava_de_area_e_convite.sql`,
`20260930160000_coordenador_exige_coordenacao.sql`,
`20260930180000_contas_desativadas_e_reativacao.sql` e
`20261002200000_gestor_coordenadas_e_ultimo_acesso.sql`.

## Seção Acessos

**perguntas:** secao acessos | tela de acessos | para que serve acessos | para que serve a secao acessos | quem gerencia acessos | gestao de acessos
**resposta:** Em Configurações › Acessos ficam as pessoas (Usuários, com Pendentes e Desativadas), os Grupos de permissões e as Coordenações. Gerenciam acessos o administrador global e o coordenador (Gestão de acessos como Editor e uma coordenação); Grupos, Coordenações e Desativadas aparecem só para o administrador global. Ninguém altera o próprio acesso: outra pessoa precisa fazer. Toda mudança pede motivo (3 a 500 caracteres) e fica auditada.
**fonte:** src/lib/teto-de-acessos.js; src/lib/access-roles.js; supabase/migrations/20260929121300_gestao_de_acessos_delegada.sql
**abrir:** config:acessos

## Como dar acesso

**perguntas:** como dar acesso a alguem | como dar acesso | dar acesso | adicionar pessoa | convidar pessoa | como convidar alguem | liberar acesso | acesso so por convite
**resposta:** Em Configurações › Acessos › Usuários, clique em "Adicionar pessoa" e informe o e-mail institucional, o nome, o grupo (padrão Usuário), a coordenação (ou, sem coordenação, pelo menos uma área) e o motivo. O cadastro fica pronto antes de a pessoa entrar, e a tela mostra o "Convite pronto", com a mensagem para copiar ou abrir no e-mail. O link sozinho não dá acesso: só funciona entrando com a conta Google do e-mail convidado, e aí a pessoa entra sem precisar pedir acesso. Enquanto ela não entra, a situação mostra "Convidado · ainda não entrou" e dá para reenviar o convite; cancelar o convite (só o administrador global) desativa o cadastro, com motivo. O coordenador só cadastra na própria coordenação, com grupo dentro do teto dele.
**fato:** O acesso ao MONITORA é só por convite: a pessoa é cadastrada em Configurações › Acessos e entra com a conta Google do e-mail convidado; o link sozinho não dá acesso.
**fonte:** src/modulos/acessos/modal-adicionar-pessoa.jsx; src/lib/convite-de-acesso.js; supabase/migrations/20260929190100_adicionar_pessoa_e_contas_de_coordenacao.sql
**abrir:** config:acessos

## Último acesso

**perguntas:** ultimo acesso | o que e ultimo acesso | ultimo acesso errado | ultimo acesso desatualizado | quando a pessoa usou o sistema | ultimo login
**resposta:** Em Configurações › Acessos, "Último acesso em …" é a última vez que a pessoa usou o MONITORA: o mais recente entre o último login, a última tela ou ação registrada e o último sinal de presença (enviado enquanto o sistema está aberto). Antes de 02/10/2026 era só o último login, e como a sessão se renova sozinha por semanas, a data ficava velha para quem continuava usando. "Convidado · ainda não entrou" aparece para quem nunca teve nenhum acesso. A aba "Desativadas" usa a mesma conta.
**fonte:** supabase/migrations/20261002200000_gestor_coordenadas_e_ultimo_acesso.sql; src/lib/convite-de-acesso.js
**abrir:** config:acessos

## Grupos de permissões

**perguntas:** o que sao os grupos de permissoes | grupos de permissoes | grupo de acesso | niveis de acesso | o que e editor | o que e leitor | excecao por modulo
**resposta:** O grupo define o nível de cada módulo (Visão geral, Análises, Editais, Cronograma, Aprovados, Entrevistas, Classificação, Recursos, Parecer jurídico, Seleção, Importação, Painéis, Configurações e Gestão de acessos): Sem acesso, Leitor, Editor ou Administrador. Os grupos de base são Usuário, Gestor, Contratador, Coordenador, Jurídico e Administrador global (acesso total, não editável). Mudar um grupo muda todos que o seguem; só o administrador global gerencia grupos, e grupo de sistema ou com pessoas não pode ser removido. Para casos especiais, o modal da pessoa tem "Exceções por módulo": vale só para ela e passa por cima do grupo ("Do grupo" volta a seguir o grupo). Área é Sim ou Não; painel externo é marcado por pessoa.
**fonte:** src/lib/permissoes-recursos.js; supabase/migrations/20260929121000_grupos_de_acesso.sql; supabase/migrations/20261001170000_recursos_parecer_juridico.sql; src/modulos/acessos/gaveta-do-usuario.jsx

## Coordenações

**perguntas:** o que e uma coordenacao nos acessos | coordenacao | coordenacoes | teto do coordenador | o que o coordenador pode
**resposta:** Coordenação é uma subdivisão de uma área; cada pessoa fica em no máximo uma. Ela limita o que a pessoa vê aos editais da área da coordenação: sem responsável, unidades nem editais, a área inteira; só com editais listados, só esses; com responsável ou unidades, os editais que casam a regra mais os listados. Vale para cronograma, listas, candidatos, convocação, vagas, anexos, histórico, análises e recursos. O coordenador gerencia só a própria coordenação e concede no máximo o próprio nível, nunca Gestão de acessos, sem mexer em área ou coordenação. Só o administrador global cria e muda coordenações.
**fonte:** supabase/migrations/20260929121100_coordenacoes.sql; src/lib/teto-de-acessos.js; supabase/migrations/20260929121300_gestao_de_acessos_delegada.sql

## Como a pessoa vê

**perguntas:** como a pessoa ve | ver como a pessoa | o que a pessoa vai ver
**resposta:** No modal da pessoa, a coluna "Como a pessoa vê" monta o menu dela com as mesmas regras da barra lateral; com alteração pendente, mostra o resultado com o selo "Depois de salvar". É só leitura: não é entrar como a pessoa.
**fonte:** src/lib/ver-como.js; src/modulos/acessos/gaveta-do-usuario.jsx

## Pedidos de acesso

**perguntas:** como funcionam os pedidos de acesso | pedidos de acesso | pedido de acesso | pedir acesso | solicitacao de acesso | pendentes
**resposta:** Quem entra com Google sem perfil ativo vê a tela de pedido e informa nome, setor, coordenação e justificativa (20 a 2.000 caracteres). Os pedidos ficam em Acessos › Usuários › Pendentes: o administrador global vê todos; o coordenador vê os da coordenação dele e aprova nela, com grupo dentro do teto. Quem recebeu convite não precisa pedir: basta entrar com o e-mail convidado.
**fonte:** src/lib/solicitacao-de-acesso.js; src/modulos/acessos/solicitacoes.jsx

## Contas desativadas

**perguntas:** como reativar uma conta desativada | conta desativada | contas desativadas | desativar conta | reativar conta | acesso desativado
**resposta:** Só o administrador global desativa uma conta, com motivo; ela vai para a aba "Desativadas", que mostra quando, por quem e por quê. "Reativar" pede grupo, coordenação, áreas e motivo (vêm como estavam) e resolve o pedido pendente da pessoa. Quem foi desativado vê "Seu acesso ao MONITORA foi desativado." e pode pedir reativação.
**fonte:** supabase/migrations/20260930180000_contas_desativadas_e_reativacao.sql; src/modulos/acessos/contas-desativadas.jsx; src/lib/solicitacao-de-acesso.js
**abrir:** config:acessos

## Trava de área e conta de setor

**perguntas:** trava de area | pessoa sem area | conta de setor | email compartilhado | mover para coordenacoes
**resposta:** O banco recusa salvar uma pessoa ativa sem nenhuma área (menos o administrador global, que já vê todas); o modal avisa e o salvar espera a área. Uma conta de setor (e-mail compartilhado) pode virar coordenação em "Avançado" › "Mover para Coordenações" (só o administrador global, com confirmação escrita): cria a coordenação com o nome da conta e desativa a conta, de forma reversível.
**fonte:** supabase/migrations/20260930130000_acessos_trava_de_area_e_convite.sql; supabase/migrations/20260929190100_adicionar_pessoa_e_contas_de_coordenacao.sql

## Pessoa que não consegue entrar

**perguntas:** nao consigo entrar | por que nao consigo entrar | pessoa nao consegue entrar | o convite nao funciona | erro ao entrar no monitora
**resposta:** Confira, nesta ordem: a pessoa entrou com a conta Google do e-mail convidado (o link sozinho não dá acesso e outra conta não serve); o e-mail é de um domínio permitido (Configurações › Tela de acesso); e o cadastro está ativo — conta desativada vê "Seu acesso ao MONITORA foi desativado." e pode pedir reativação. Quem entra sem convite vê a tela de pedido de acesso, que vai para Acessos › Usuários › Pendentes. Se o Login Google estiver Inativo, o botão some da tela de entrada; com o sistema inteiro em manutenção, quem não é administrador global vê a tela de manutenção.
**fonte:** src/lib/convite-de-acesso.js; src/lib/solicitacao-de-acesso.js; supabase/migrations/20260930180000_contas_desativadas_e_reativacao.sql; src/lib/situacao-dos-modulos.js
**abrir:** config:acessos
