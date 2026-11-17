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
administrativas. Não há reserva: se o SIGEPSI não responde, a Visão geral mostra o erro. De
02/10 a 16/11/2026 o mapa desenhava os pontos gravados no banco (`lmap` e `rede_cnes`); a
auditoria abaixo descreve esse período. A planilha "Lotações, Meios de Acesso/Polo Base", com
erros, nunca voltou ao front.

## Os documentos

| Documento                                                                                                         | O que é                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [auditoria-oficial-das-coordenadas-2026-10-01.md](../coordenadas/auditoria-oficial-das-coordenadas-2026-10-01.md) | os 1.500 pontos conferidos contra CNES, IBGE e Funai (01–02/10/2026) e o que foi corrigido no banco                    |
| [pontos-so-na-planilha-de-lotacoes.md](../coordenadas/pontos-so-na-planilha-de-lotacoes.md)                       | o que a planilha fornecia e a decisão para cada atributo                                                               |
| [sedes-dos-dsei.md](../coordenadas/sedes-dos-dsei.md)                                                             | de onde vem cada sede de DSEI (CNES geocodificado, validado pela malha do IBGE)                                        |
| [auditoria-geografica.md](../coordenadas/auditoria-geografica.md)                                                 | o método: como a fonte é produzida, o casamento Polo Base × CNES, desempilhar e o modelo de confiança (leia por seção) |
| `docs/_arquivo/auditoria-sedes-dsei-2026-09-16.md`, `docs/_arquivo/handoff-codex-mapas.md`                        | registros anteriores (auditoria das 34 sedes e a passagem do trabalho dos mapas)                                       |

Os quatro primeiros ficam em `docs/` porque o código, os testes ou a base da Aya os citam pelo
caminho.

## Regras

- Saúde Indígena: coordenada só do SIGEPSI (`src/lib/mapa-saude-indigena/localizacoes-do-sigepsi.ts`);
  nada de reserva vinda do banco, de planilha ou de arquivo em `public/data/`. Corrigir um ponto é
  no SIGEPSI; o mapa não tem editor.
- Projetos: a coordenada dos lugares fica no banco e se corrige pelo editor de coordenadas, que grava
  com histórico ([[modulo-editor-de-coordenadas]]), ou por correção de dados com ensaio
  ([[banco-e-migrations]]).
- O histórico `private."TH_COORDENADA_MAPA_SAUDE_INDIG"` e o catálogo `TD_UNIDADE` ficam no banco
  (a linha `rede_cnes` e as pendências saíram em 17/11/2026, com cópias `*_backup_20261117_*`).
- `uf-ibge.ts` e `brasil-bounds.ts` são a referência geográfica usada pelos scripts de auditoria.
- Os scripts de geografia (`compilar-terras-indigenas.mjs`, `compilar-contornos-dos-dseis.mjs`)
  partem do banco e da Funai ([[terras-indigenas]]).
- As regras para a Aya: `docs/aya/regras-dos-mapas.md` e `docs/aya/regras-do-mapa-saude-indigena.md`.

## Relacionadas

- [[mapas-e-leaflet]] — como o mapa desenha
- [[modulo-mapa-saude-indigena]] — a tela
