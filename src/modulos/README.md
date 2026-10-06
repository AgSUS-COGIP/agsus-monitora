# `src/modulos/` — uma pasta por tela

Cada tela do MONITORA, quando migra, mora aqui: `<nome>/<nome>.jsx` (componente e
`montar<Nome>()`, que usa `montarModulo` de `src/app/`), `estado.js` (store sem React, lido com
`useSyncExternalStore`), as consultas RPC e, se precisar, um CSS só da tela. O visual vem de
`src/ui/`; as regras puras, de `src/lib/`.

Já aqui: `recursos/` (Recursos dos candidatos, o modelo de tela de página inteira),
`entrevistas/` (Entrevistas: resultados, condução e roteiros, com as visões no topo),
`avaliacao-documental/` (Avaliação documental: regra, equipe, pré-classificação e fila), `analises/`
(Análises curriculares), `selecao/` (Seleção: funil por vaga, só leitura), `classificacao/`
(Classificação: regra por edital, listas, sorteio e exportação), `aprovados/` (Lista de
aprovados: aprovados, convocação e carta de convocação) e `aya/` (o painel da
assistente Aya). As outras mudam uma a uma, na etapa de cada uma. `mapa-saude-indigena/` é uma
peça, não uma tela: o mapa da Visão geral da Saúde Indígena, ligado em `visao-geral/`;
`mapa-de-projetos/` também, o de Projetos, com as mesmas regras e as peças comuns do primeiro.
`editor-de-coordenadas/` também é peça: o editor de coordenadas (fila, sugestões, histórico e
desfazer) comum aos mapas da Saúde Indígena e de Projetos. `chat/` (Mensagens) também não é
tela: o ícone do cabeçalho e o painel lateral de conversas.
Guia completo, com o mapa de hoje → alvo: `docs/arquitetura-react.md`.
