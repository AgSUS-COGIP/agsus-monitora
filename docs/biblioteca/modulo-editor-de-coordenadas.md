---
tipo: modulo
area: modulo
atualizado: 2026-11-17
---

# Módulo: Editor de coordenadas

Peça (não é tela) em `src/modulos/editor-de-coordenadas/`: o editor React e TypeScript hoje só do
mapa de Projetos (o da Saúde Indígena não tem editor: os pontos vêm do SIGEPSI e se corrigem lá). Tem fila com busca e gravidade, sugestões, pin de prévia,
confirmação de correção e conferência, histórico com desfazer e modo de edição
(`modo-de-edicao.tsx`) com painel recolhível e Escape. Só o administrador global e o Gestor o abrem.

## Contratos

- Interface e fontes: `tipos.ts`. Regras puras: `src/lib/tipos-do-editor-de-coordenadas.ts`.
- Cada fonte fornece as RPCs, a identidade do ponto, as regras da fila, as sugestões e os
  argumentos de gravação. O tipo genérico preserva os campos próprios do ponto em toda a
  integração.
- `src/lib/editor-de-coordenadas.ts` reúne as regras comuns: validação, ordenação, distância,
  sugestões repetidas, histórico e folga do enquadramento (`folgaDoEnquadramento`).
- As regras do mapa de Projetos e o adaptador também estão em TypeScript: o mapa liga o editor
  comum no seu `editor-de-coordenadas.tsx` (ver [[modulo-mapa-de-projetos]]). O adaptador e as
  regras do mapa da Saúde Indígena saíram em 17/11/2026 ([[modulo-mapa-saude-indigena]]).

## Fronteira dos dados

- As respostas das RPCs entram como dados externos: pendências precisam ser listas de
  registros; candidatos precisam de fonte e posições escalares; textos da tela não aceitam
  objetos.
- Histórico com entrada sem identidade ou ação, ou com flag de desfazer de tipo inválido, é
  rejeitado inteiro, para não tornar uma alteração antiga a última disponível para desfazer.
- Coordenada anterior inválida impede desfazer na interface.
- A gravação precisa devolver um registro com os campos escalares de posição e conferência nos
  tipos esperados.
- O conteúdo geográfico dos pontos continua a cargo do adaptador do mapa (Projetos).
- `leaflet-do-editor.ts` verifica a presença dos métodos necessários na integração JavaScript.
  Os contratos estruturais cobrem só a API usada pelo editor; não validam os retornos internos do
  Leaflet nem substituem os contratos completos.
- Permissão e validação definitiva da gravação ficam no banco.

## Verificação

- `npm run typecheck:frontend`.
- Testes do editor de Projetos (`tests/editor-de-coordenadas-projetos.test.js`), do modo de edição
  (`tests/modulos/modo-de-edicao.test.js`) e dos mapas em `tests/modulos/`.
- Regras em `tests/coordenadas-dos-projetos.test.js`; respostas externas em
  `tests/respostas-do-editor-de-coordenadas.test.js`; contratos em
  `tests/tipos/editor-de-coordenadas.tsx`.
- Os testes usam RPCs simuladas e não acessam dados de produção.

## Relacionadas

- [[modulo-mapa-saude-indigena]] — não usa mais o editor (pontos do SIGEPSI)
- [[modulo-mapa-de-projetos]] — usa o editor com os lugares das vagas
- [[coordenadas]] — de onde vêm as coordenadas e como foram auditadas
- [[mapas-e-leaflet]] — fábrica do Leaflet e guardas
