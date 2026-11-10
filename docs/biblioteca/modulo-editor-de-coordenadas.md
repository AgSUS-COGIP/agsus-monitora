---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Editor de coordenadas

Peça (não é tela) em `src/modulos/editor-de-coordenadas/`: o editor React e TypeScript comum aos
mapas de Projetos e da Saúde Indígena. Tem fila com busca e gravidade, sugestões, pin de prévia,
confirmação de correção e conferência, histórico com desfazer e modo de edição
(`modo-de-edicao.tsx`) com painel recolhível e Escape. Só o administrador global e o Gestor o abrem.

## Contratos

- Interface e fontes: `tipos.ts`. Regras puras: `src/lib/tipos-do-editor-de-coordenadas.ts`.
- Cada fonte fornece as RPCs, a identidade do ponto, as regras da fila, as sugestões e os
  argumentos de gravação. O tipo genérico preserva os campos próprios do ponto em toda a
  integração.
- `src/lib/editor-de-coordenadas.ts` reúne as regras comuns: validação, ordenação, distância,
  sugestões repetidas, histórico e folga do enquadramento (`folgaDoEnquadramento`).
- As regras específicas dos dois mapas e seus adaptadores também estão em TypeScript: cada mapa
  liga o editor comum no seu `editor-de-coordenadas.tsx` (ver [[modulo-mapa-saude-indigena]] e
  [[modulo-mapa-de-projetos]]).
- Os alvos da Saúde Indígena declaram fonte, tipo, DSEI, índice, código e nome; a leitura de
  dados externos preserva os índices originais usados pelo banco.

## Fronteira dos dados

- As respostas das RPCs entram como dados externos: pendências precisam ser listas de
  registros; candidatos precisam de fonte e posições escalares; textos da tela não aceitam
  objetos.
- Histórico com entrada sem identidade ou ação, ou com flag de desfazer de tipo inválido, é
  rejeitado inteiro, para não tornar uma alteração antiga a última disponível para desfazer.
- Coordenada anterior inválida impede desfazer na interface.
- A gravação precisa devolver um registro com os campos escalares de posição e conferência nos
  tipos esperados.
- O conteúdo geográfico de `lmap` e `rede_cnes` continua a cargo do adaptador do mapa.
- `leaflet-do-editor.ts` verifica a presença dos métodos necessários na integração JavaScript.
  Os contratos estruturais cobrem só a API usada pelo editor; não validam os retornos internos do
  Leaflet nem substituem os contratos completos.
- Permissão e validação definitiva da gravação ficam no banco.

## Verificação

- `npm run typecheck:frontend`.
- Testes dos dois editores, do modo de edição e dos mapas em `tests/modulos/`
  (`editor-de-coordenadas.test.js`, `modo-de-edicao.test.js`).
- Regras em `tests/coordenadas-*.test.js`; respostas externas em
  `tests/respostas-do-editor-de-coordenadas.test.js`; contratos em
  `tests/tipos/editor-de-coordenadas.tsx`.
- Os testes usam RPCs simuladas e não acessam dados de produção.

## Relacionadas

- [[modulo-mapa-saude-indigena]] — usa o editor com os pontos do `lmap`/`rede_cnes`
- [[modulo-mapa-de-projetos]] — usa o editor com os lugares das vagas
- [[coordenadas]] — de onde vêm as coordenadas e como foram auditadas
- [[mapas-e-leaflet]] — fábrica do Leaflet e guardas
