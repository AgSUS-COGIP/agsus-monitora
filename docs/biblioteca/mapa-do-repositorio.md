---
tipo: referencia
area: front
atualizado: 2026-11-10
---

# Mapa do repositório

Onde fica cada coisa. Não rode `find`/`ls`/`tree` para descobrir a estrutura: ela está aqui, e
cada pasta com regra própria tem um `CLAUDE.md` curto.

## Pastas

```
index.html              entrada principal: <head>, tela de acesso, skeleton (a casca do app é src/app/casca/)
analises.html           entrada do painel de análises
auth/callback.html      callback OAuth (JS em src/auth/callback.ts)
DESIGN.md               guia de interface: tokens, componentes, contraste, plano de migração
api/                    funções serverless da Vercel (proxy FUNAI, anexos do edital, API para outro sistema)
src/app/                raiz React única (raiz.tsx), rotas (telas.tsx), navegação, sessão, carga, casca
src/ui/                 design system: Topo, Filtros, Kpi, Gráfico, Tabela, Gaveta, Modal… (ui.css)
src/modulos/            as telas em React, uma pasta por tela
src/componentes/        moldura React: barra lateral, busca global, Status das atualizações, dados compartilhados
src/lib/                lógica pura e testável (regras, contratos, formatos)
src/modules/            LEGADO: só encolhe, nada novo
src/styles/             CSS do app principal (ordem de import em main.ts)
src/main.ts             bootstrap: importa CSS e instala módulos, em ordem
python/monitora/        cálculo em lote (Python) executado no GitHub Actions
scripts/                checagens do CI, robôs, geradores e utilitários de banco
supabase/               migrations/, rollback/, ensaios/, tests/ e o retrato esquema-atual.sql
apps-script/            código das planilhas de análises (colado no Google; apps-script/LEIA-ME.md)
public/                 copiado para o site: assets/ e data/ (JSON GERADO por scripts/)
tests/                  Vitest (*.test.ts, ainda *.test.js), Playwright e pytest
server/servidor.ts      servidor web (TypeScript, Node 24, sem dependências)
prototipos/             protótipos estáticos (ex.: parecer em blocos)
docs/                   biblioteca, documentos longos de referência e base de conhecimento da AYA
.github/workflows/      CI e robôs
```

**Nada em `public/` que não deva ser publicado**: tudo ali vai para o site (e para a Vercel).
`dist/` é saída do build: não editar.

## Não ler por inteiro (grep -n → sed -n 'A,Bp')

| Arquivo                                       | Tamanho    | Observação                                   |
| --------------------------------------------- | ---------- | -------------------------------------------- |
| `public/data/*.json`                          | até 2,3 MB | gerados                                      |
| `supabase/esquema-atual.sql`                  | 3,6 MB     | retrato do schema: `grep -n 'FUNCTION private."FC_X"'` |
| `src/styles/app.css`                          | 110 KB     | CSS base                                     |
| `index.html`                                  | 24 KB      | `<head>` e entrada                           |
| `src/modules/indigenous-territories-layer.ts` | 41 KB      | partes puras em `src/lib/terras-indigenas/`  |
| `src/modules/aya-conhecimento-gerado.js`      | 27 KB      | gerado de `docs/aya/`                        |
| `docs/banco-de-dados.md`, `docs/design-system-agsus.md` | longos | leia a seção do assunto              |
| `package-lock.json`, `dist/`, `node_modules/` |            | nunca                                        |

## Relacionadas

- [[arquitetura-do-front]] — como as pastas do front se encaixam
- [[codigo-legado]] — o que é legado e como sai
- [[logica-em-src-lib]] — os arquivos de `src/lib/` que exigem cuidado
- [[comandos-e-ambiente]] — rodar o mínimo
- [[documentacao]] — onde fica a documentação
