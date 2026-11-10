# `docs/`

Leia **só o documento do assunto**. Nada aqui é carregado pelo build, exceto `aya/`.

O índice de todos os documentos, por assunto, é o [`README.md`](README.md) (também a página inicial
do vault do Obsidian): procure lá o documento do assunto. Não repita o índice aqui. Outras pastas:
`_modelos/` (modelos de documento novo), `aya/` (**base de conhecimento da AYA**, fonte de
`src/modules/aya-conhecimento-gerado.js`), `propostas/` (SQL proposto, ainda não virou migration).
O guia de interface é `../DESIGN.md`, na raiz. `auditoria-geografica.md` tem 26 KB: leia por seção.

## `docs/aya/`

Os `.md` numerados (`01-saude-indigena.md` … `05-politica-e-controle-social.md`) são compilados por
`npm run aya:conhecimento`. Editou aqui, recompile: o gerado vai no bundle. O formato do verbete está
em `docs/aya/README.md`. A Aya só responde com o que está no material (não há IA gerando texto):
todo número que a AYA precisa dizer tem de estar escrito aqui.

Documento novo: nome em português, kebab-case, data no nome quando for registro pontual
(`auditoria-…-AAAA-MM-DD.md`). Comece por um modelo de `_modelos/`, mantenha as `tags` do topo
(um `tipo/…` e ao menos uma `area/…`, da lista em `README.md`) e acrescente o link no `README.md`.
Nada disso vale para `aya/`: lá todo `.md` é compilado e não leva `tags`. Documento descreve o
código; quando divergirem, corrija o documento.

A pasta é um vault do Obsidian (`.obsidian/` versiona só `app.json` e `templates.json`; `_rascunhos/`
é ignorada pelo Git). Renomear um documento exige buscar o caminho no repositório inteiro: workflows,
scripts e testes citam `docs/…`.
