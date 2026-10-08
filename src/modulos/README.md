# `src/modulos/` — uma pasta por tela

Cada tela do MONITORA mora aqui: `<nome>/<nome>.jsx` ou `.tsx` (componente e
`montar<Nome>()`, que usa `montarModulo` de `src/app/`), `estado.js` ou `.ts` (store sem React, lido com
`useSyncExternalStore`), as consultas RPC e, se precisar, um CSS só da tela. O visual vem de
`src/ui/`; as regras puras, de `src/lib/`.

Já aqui: `recursos/` (Recursos dos candidatos, o modelo de tela de página inteira),
`entrevistas/` (Entrevistas: resultados, condução e roteiros, com as visões no topo),
`avaliacao-documental/` (Avaliação documental: regra, equipe, pré-classificação e fila), `analises/`
(Análises curriculares), `selecao/` (Seleção: funil por vaga, só leitura), `classificacao/`
(Classificação: regra por edital, listas, sorteio e exportação), `aprovados/` (Lista de
aprovados: aprovados, convocação e carta de convocação) e `aya/` (o painel da
assistente Aya). `modulos/` reúne Configurações › Módulos e abas, em TypeScript, com
estado, revisão e histórico. As outras mudam uma a uma, na etapa de cada uma. `mapa-saude-indigena/` é uma
peça, não uma tela: o mapa da Visão geral da Saúde Indígena, ligado em `visao-geral/`;
`mapa-de-projetos/` também, o de Projetos, com as mesmas regras e as peças comuns do primeiro.
`editor-de-coordenadas/` também é peça: o editor de coordenadas (fila, sugestões, histórico e
desfazer) comum aos mapas da Saúde Indígena e de Projetos. `chat/` (Mensagens) também não é
tela: o ícone do cabeçalho e o painel lateral de conversas.
Guia completo, com o mapa de hoje → alvo: `docs/arquitetura-react.md`.

`editor-de-coordenadas/` está em TypeScript: editor compartilhado pelos mapas de Projetos e
Saúde Indígena, com fila, sugestões, histórico, modo de edição e regras comuns. Contratos e
limites no README do módulo.

A base compartilhada dos mapas em `mapa-saude-indigena/` (painel, legenda, tela
cheia, retorno ao Brasil e hooks) está em TypeScript; contratos em `tipos-do-painel.ts`.
As telas principal, nacional e por DSEI da Saúde Indígena estão em TSX, com contratos
e validação da entrada geográfica. A fábrica Leaflet e as regras geográficas de
reconciliação, contagens e apresentação continuam em JavaScript.
