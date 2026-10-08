# Editor de coordenadas

Editor React e TypeScript compartilhado pelos mapas de Projetos e Saúde Indígena.
Inclui fila com busca e gravidade, sugestões, pin de prévia, confirmação de correção
e conferência, histórico com desfazer e modo de edição com painel recolhível e Escape.

Os contratos da interface e das fontes estão em `tipos.ts`; os contratos das regras
puras estão em `src/lib/tipos-do-editor-de-coordenadas.ts`. Cada fonte fornece as
RPCs, identidade do ponto, regras da fila, sugestões e argumentos de gravação.
O tipo genérico preserva os campos próprios do ponto em toda a integração.

`src/lib/editor-de-coordenadas.ts` reúne as regras comuns de validação, ordenação,
distância, sugestões repetidas, histórico e folga do enquadramento. As regras
específicas de cada mapa permanecem em JavaScript, com contratos JSDoc na
integração de Projetos. O adaptador da Saúde Indígena também permanece JSX.

As respostas das RPCs entram como dados externos: pendências precisam ser listas
de registros, candidatos precisam de fonte e posições escalares, e textos da tela
não aceitam objetos. Histórico com entrada sem identidade ou ação, ou com flag de
desfazer em tipo inválido, é rejeitado
inteiro, para não tornar uma alteração antiga a última disponível para desfazer.
Coordenada anterior inválida impede desfazer na interface. Gravação precisa devolver
um registro com os campos escalares de posição e conferência nos tipos esperados.
O conteúdo geográfico de `lmap` e `rede_cnes` continua a cargo do adaptador do mapa.

`leaflet-do-editor.ts` verifica a presença dos métodos necessários na integração
JavaScript. Os contratos estruturais cobrem apenas a API utilizada pelo editor;
não validam os retornos internos do Leaflet nem substituem seus contratos completos.
Permissão e validação definitiva da gravação continuam no banco; os testes usam
RPCs simuladas e não acessam dados de produção.

Verificação: `npm run typecheck:frontend`, testes de ambos os editores, modo de
edição e mapas em `tests/modulos/`, regras em `tests/coordenadas-*.test.js`, respostas
externas em `tests/respostas-do-editor-de-coordenadas.test.js` e contratos em
`tests/tipos/editor-de-coordenadas.tsx`.
