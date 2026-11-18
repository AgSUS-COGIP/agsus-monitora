---
tipo: decisao
area: banco
atualizado: 2026-11-17
---

# Coordenadas do mapa

**Desde 17/11/2026 o mapa da Saúde Indígena desenha só o SIGEPSI.** A sede (posição da bolha
nacional), os polos base, a ROTA, as CASAIs, as unidades de lotação e as CASAIs nacionais vêm da
API do SIGEPSI (`/api/dseis`), com a UF pelo CEP. Do banco (`lmap`, em
`TB_CONFIG_MAPA_SAUDE_INDIG`) o mapa lê só, de cada DSEI, o nome, a população e as UFs
administrativas. Não há reserva: se o SIGEPSI não responde, a aba Mapa mostra o erro. De
02/10 a 16/11/2026 o mapa desenhava os pontos gravados no banco (`lmap` e `rede_cnes`); as
auditorias abaixo descrevem esse período. A planilha "Lotações, Meios de Acesso/Polo Base", com
erros, nunca voltou ao front.

**O mapa de Projetos guarda a coordenada no banco** e a corrige pelo editor de coordenadas
(abaixo), que grava com histórico, ou por correção de dados com ensaio ([[banco-e-migrations]]).

## Regras

- Saúde Indígena: coordenada só do SIGEPSI (`src/lib/mapas/mapa-saude-indigena/localizacoes-do-sigepsi.ts`);
  nada de reserva vinda do banco, de planilha ou de arquivo em `public/data/`. Corrigir um ponto é
  no SIGEPSI; o mapa não tem editor.
- Projetos: coordenada no banco, corrigida pelo editor ou por correção de dados com ensaio.
- O histórico `private."TH_COORDENADA_MAPA_SAUDE_INDIG"` e o catálogo `TD_UNIDADE` ficam no banco
  (a linha `rede_cnes` e as pendências saíram em 17/11/2026, com cópias `*_backup_20261117_*`).
- `mapas/uf-ibge.ts` e `mapas/brasil-bounds.ts` são a referência geográfica usada pelos scripts de auditoria.
- Os scripts de geografia (`compilar-terras-indigenas.mjs`, `compilar-contornos-dos-dseis.mjs`)
  partem do banco e da Funai ([[mapas-e-leaflet]]).
- As regras para a Aya: `docs/aya/regras-dos-mapas.md` e `docs/aya/regras-do-mapa-saude-indigena.md`.

## O editor de coordenadas (só Projetos)

Peça (não é tela) em `src/modulos/editor-de-coordenadas/`, em React e TypeScript: fila com busca e
gravidade, sugestões, pin de prévia, confirmação de correção e conferência, histórico com desfazer
e modo de edição (`modo-de-edicao.tsx`) com painel recolhível e Escape. **Só o administrador global
e o Gestor o abrem.** O mapa de Projetos o liga no seu `editor-de-coordenadas.tsx`
([[modulo-mapa-de-projetos]]); o adaptador e as regras da Saúde Indígena saíram em 17/11/2026.

- **Contratos.** Interface e fontes em `tipos.ts`; regras puras em
  `src/lib/mapas/tipos-do-editor-de-coordenadas.ts`. Cada fonte fornece as RPCs, a identidade do ponto,
  as regras da fila, as sugestões e os argumentos de gravação; o tipo genérico preserva os campos
  próprios do ponto. `src/lib/mapas/editor-de-coordenadas.ts` reúne as regras comuns: validação,
  ordenação, distância, sugestões repetidas, histórico e folga do enquadramento
  (`folgaDoEnquadramento`).
- **Fronteira dos dados.** As respostas das RPCs entram como dados externos: pendências precisam
  ser listas de registros; candidatos precisam de fonte e posições escalares; textos da tela não
  aceitam objetos. Histórico com entrada sem identidade ou ação, ou com flag de desfazer de tipo
  inválido, é rejeitado inteiro, para não tornar uma alteração antiga a última disponível para
  desfazer. Coordenada anterior inválida impede desfazer. A gravação precisa devolver um registro
  com os campos escalares de posição e conferência nos tipos esperados. O conteúdo geográfico dos
  pontos é do adaptador do mapa.
- `leaflet-do-editor.ts` verifica a presença dos métodos necessários na integração JavaScript; os
  contratos cobrem só a API usada pelo editor, sem validar os retornos internos do Leaflet.
- **Permissão e validação definitiva da gravação ficam no banco.**
- **Testes** (RPCs simuladas, sem dados de produção): `tests/editor-de-coordenadas-projetos.test.js`,
  `tests/modulos/modo-de-edicao.test.js`, `tests/coordenadas-dos-projetos.test.js`,
  `tests/respostas-do-editor-de-coordenadas.test.js` e `tests/tipos/editor-de-coordenadas.tsx`;
  `npm run typecheck:frontend`.

## Os documentos

| Documento                                                                                                         | O que é                                                                                             |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [auditoria-oficial-das-coordenadas-2026-10-01.md](../coordenadas/auditoria-oficial-das-coordenadas-2026-10-01.md) | os 1.500 pontos conferidos contra CNES, IBGE e Funai (01–02/10/2026) e o que foi corrigido no banco |
| [pontos-so-na-planilha-de-lotacoes.md](../coordenadas/pontos-so-na-planilha-de-lotacoes.md)                       | o que a planilha fornecia e a decisão para cada atributo                                            |
| [sedes-dos-dsei.md](../coordenadas/sedes-dos-dsei.md)                                                             | de onde vem cada sede de DSEI (CNES geocodificado, validado pela malha do IBGE)                     |

Os três ficam em `docs/coordenadas/` porque o código, os testes ou a base da Aya os citam pelo
caminho. Histórico, em `docs/_arquivo/`:
[auditoria-geografica](../_arquivo/auditoria-geografica.md) (o método do período com pontos no
banco: casamento Polo Base × CNES, desempilhar, modelo de confiança),
[auditoria-sedes-dsei-2026-09-16](../_arquivo/auditoria-sedes-dsei-2026-09-16.md) (as 34 sedes) e
[handoff-codex-mapas](../_arquivo/handoff-codex-mapas.md) (a passagem do trabalho dos mapas).

## Relacionadas

- [[mapas-e-leaflet]] — como o mapa desenha
- [[modulo-mapa-saude-indigena]] — a tela que lê só o SIGEPSI
- [[modulo-mapa-de-projetos]] — a tela que usa o editor
- [[banco-e-migrations]] — correção de dados com ensaio
