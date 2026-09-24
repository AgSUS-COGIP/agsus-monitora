# `docs/`

Leia **só o documento do assunto**. Nada aqui é carregado pelo build, exceto `aya/`.

| Arquivo | Assunto |
|---|---|
| `../DESIGN.md` | guia de interface (fica na raiz, não aqui) |
| `arquitetura-evolucao.md` | plano técnico de evolução |
| `banco-de-dados.md` | modelo de dados e RPCs |
| `servidor.md` | servidor web em TypeScript: contrato, rodar, implantar |
| `nucleo-e-mapas.md` | guia de uso do Núcleo e dos mapas |
| `auditoria-geografica.md` (26 KB) | método de validação de coordenadas — leia por seção |
| `auditoria-sedes-dsei-2026-09-16.md` | auditoria pontual das sedes de DSEI |
| `handoff-codex-mapas.md` | contexto de transição do trabalho de mapas |
| `padronizacao_nomenclatura_*.md` | aplicação do padrão MAD no banco e no front |
| `aya-ollama-local.md` | rodar a AYA com Ollama local |
| `aya/` | **base de conhecimento da AYA** (fonte de `src/modules/aya-conhecimento-gerado.js`) |
| `propostas/` | SQL proposto, ainda não virou migration |

## `docs/aya/`

Os `.md` numerados (`01-saude-indigena.md` … `05-politica-e-controle-social.md`) são compilados por
`npm run aya:conhecimento`. Editou aqui, recompile: o gerado vai no bundle. O formato do verbete está
em `docs/aya/README.md`. Número na resposta que não está no material é detectado como inventado
(`tests/aya-numeros-sem-lastro.test.js`): todo número que a AYA precisa dizer tem de estar escrito aqui.

Documento novo: nome em português, kebab-case, data no nome quando for registro pontual
(`auditoria-…-AAAA-MM-DD.md`). Documento descreve o código; quando divergirem, corrija o documento.
