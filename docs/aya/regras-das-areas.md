# Regras das áreas e do menu

As três áreas do sistema (Saúde Indígena, SEDE e Projetos), a área atual e a ordem do menu. Fontes:
`src/lib/menu-lateral.js`, `src/componentes/dados-do-monitoramento.js`,
`src/componentes/barra-lateral/menu-de-areas.jsx` e as migrations
`20260925170000_areas_do_sistema.sql`, `20260925180000_areas_do_usuario.sql`,
`20260925181000_recorta_dados_por_area.sql` e `20261001160000_ordem_do_menu_por_etapa.sql`.

## Áreas do sistema

**perguntas:** areas do sistema | area do sistema | o que muda entre as areas do sistema | quais sao as areas | quais areas existem | o que e area atual | area atual
**resposta:** O MONITORA tem três áreas: Saúde Indígena, SEDE e Projetos. Cada área repete as mesmas páginas (Visão geral, Editais, Cronograma, Análises curriculares, Recursos, Entrevistas, Classificação, Lista de aprovados e Seleção), e cada página mostra só os registros da área atual, a escolhida no menu. O que muda é o bloco do mapa da Visão geral: DSEIs e CASAIs na Saúde Indígena, os locais das vagas dos projetos em Projetos, e nenhum mapa na SEDE. A área do edital é calculada pelo banco a partir da unidade e do responsável: SEDE, Escritório Distrital e Regional e CCE ficam na SEDE; Caminhoneiros, Saúde nas Fronteiras, MFC e Rio Doce, em Projetos; as demais, na Saúde Indígena.
**fato:** O MONITORA tem três áreas (Saúde Indígena, SEDE e Projetos); cada página mostra só a área atual escolhida no menu, e só a Visão geral da Saúde Indígena fala de DSEIs e CASAIs.
**fonte:** src/lib/menu-lateral.js; supabase/migrations/20260925170000_areas_do_sistema.sql

## Trocar de área

**perguntas:** trocar de area | como mudo de area | como trocar de area | seletor de area | mudar de area | nao vejo a area
**resposta:** Quem tem mais de uma área vê o seletor "Área" no topo da barra lateral; abaixo dele ficam só as páginas da área escolhida. Trocar de área abre a mesma página na área nova (ou a primeira página dela, se não tiver essa). Com a barra recolhida, o seletor vira o ícone da área atual. A área escolhida fica guardada na aba do navegador: recarregar volta a ela, e uma aba nova começa na primeira área da pessoa. Quem tem uma área só não vê seletor. O administrador global vê todas as áreas; os demais veem as áreas liberadas para eles em Configurações › Acessos (com coordenação, só a área dela).
**fonte:** src/componentes/barra-lateral/menu-de-areas.jsx; src/componentes/dados-do-monitoramento.js; supabase/migrations/20260925180000_areas_do_usuario.sql

## Ordem do menu

**perguntas:** ordem do menu | qual e a ordem do menu | ordem das abas | paginas do menu | menu lateral
**resposta:** O menu de cada área segue as etapas do processo seletivo: Visão geral, Editais, Cronograma, Análises curriculares, Recursos, Entrevistas, Classificação, Lista de aprovados e Seleção. Abaixo das áreas fica Administração (as seções de Configurações). O grupo Painéis só aparece quando há painel externo ativo liberado para a pessoa. O selo BETA ao lado do nome marca a aba ainda em teste.
**fato:** O menu segue as etapas do processo seletivo: Visão geral, Editais, Cronograma, Análises curriculares, Recursos, Entrevistas, Classificação, Lista de aprovados e Seleção.
**fonte:** supabase/migrations/20261001160000_ordem_do_menu_por_etapa.sql; src/lib/menu-lateral.js

## Recorte por área no banco

**perguntas:** recorte por area | por que nao vejo editais de outra area | dados de outra area | editais de outra area
**resposta:** Quem não é administrador global só recebe do banco os dados das suas áreas: editais, cronogramas, listas de aprovados, candidatos, convocação, vagas e análises. A gravação também confere a área: ninguém cria edital nem move edital para uma área que não é sua. Para ver outra área, peça a liberação a quem administra os acessos.
**fonte:** supabase/migrations/20260925181000_recorta_dados_por_area.sql; supabase/migrations/20260925190000_gravacao_e_matriz_por_area.sql
