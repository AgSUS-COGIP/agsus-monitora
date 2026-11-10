---
tipo: decisao
area: banco
atualizado: 2026-11-10
---

# Coordenadas do mapa

**Desde 02/10/2026 o mapa da Saúde Indígena desenha só o banco.** Os polos base e as sedes dos DSEIs
vêm do cadastro do mapa (`lmap`) e os estabelecimentos (UBSI, CASAI e demais) do cadastro do CNES
(`rede_cnes`), ambos em `TB_CONFIG_MAPA_SAUDE_INDIG`. A planilha "Lotações, Meios de Acesso/Polo
Base" tinha erros, não existe versão corrigida, e deixou de ser mesclada no front.

## Os documentos

| Documento                                                                                              | O que é                                                                                                |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| [auditoria-oficial-das-coordenadas-2026-10-01.md](../auditoria-oficial-das-coordenadas-2026-10-01.md) | os 1.500 pontos conferidos contra CNES, IBGE e Funai (01–02/10/2026) e o que foi corrigido no banco    |
| [pontos-so-na-planilha-de-lotacoes.md](../pontos-so-na-planilha-de-lotacoes.md)                        | o que a planilha fornecia e a decisão para cada atributo                                               |
| [sedes-dos-dsei.md](../sedes-dos-dsei.md)                                                              | de onde vem cada sede de DSEI (CNES geocodificado, validado pela malha do IBGE)                        |
| [auditoria-geografica.md](../auditoria-geografica.md)                                                  | o método: como a fonte é produzida, o casamento Polo Base × CNES, desempilhar e o modelo de confiança (leia por seção) |
| `docs/_arquivo/auditoria-sedes-dsei-2026-09-16.md`, `docs/_arquivo/handoff-codex-mapas.md`             | registros anteriores (auditoria das 34 sedes e a passagem do trabalho dos mapas)                       |

Os quatro primeiros ficam em `docs/` porque o código, os testes ou a base da Aya os citam pelo
caminho.

## Regras

- Coordenada só do banco; município vem do CNES e da sede no `lmap`. Nada de reserva vinda de
  planilha ou de arquivo em `public/data/`.
- Correção de coordenada é pelo editor de coordenadas, que grava no banco com histórico
  ([[modulo-editor-de-coordenadas]]), ou por correção de dados com ensaio
  ([[banco-e-migrations]]).
- `src/lib/reconciliacao-unidades.ts`, `uf-ibge.ts` e `brasil-bounds.ts` são a referência
  geográfica usada pelos scripts de auditoria.
- Os scripts de geografia (`compilar-terras-indigenas.mjs`, `compilar-contornos-dos-dseis.mjs`)
  partem do banco e da Funai ([[terras-indigenas]]).
- As regras para a Aya: `docs/aya/regras-dos-mapas.md` e `docs/aya/regras-do-mapa-saude-indigena.md`.

## Relacionadas

- [[mapas-e-leaflet]] — como o mapa desenha
- [[modulo-mapa-saude-indigena]] — a tela
