# `scripts/` — ferramentas Node (`*.mjs`)

Cada script documenta o próprio uso no comentário do topo: leia só as primeiras ~30 linhas
(`sed -n '1,30p'`) antes de rodar. Prefira o `npm run` equivalente quando houver.

| Grupo | Scripts | Observação |
|---|---|---|
| **Checagens do build** | `check-rpc-contract.mjs`, `check-supabase-auth-architecture.mjs`, `check-no-new-mutation-observer.mjs`, `check-dist-html-security.mjs`, `check-bundle-size.mjs`, `check-workflow-uniqueness.mjs`, `check-changed-lint.mjs`, `check-changed-format.mjs` | rodam no `npm run build`/CI; falha aqui = regra de arquitetura violada, corrija o código e não o script |
| **Banco** | `check-rpc-contract-db.mjs`, `capturar-baseline-rpcs.mjs`, `estado-das-migrations*.mjs`, `validar-migration-branding.mjs`, `validar-migration-recusar.mjs` | precisam de credencial de banco (`pg`) |
| **Pipeline geográfico** | `validar-localizacoes.mjs` (usa `ler-planilha-xlsx.mjs`, `malhas-das-ufs.mjs`, `decidir-localizacao.mjs`, `veredito-para-o-mapa.mjs`); `recompilar-vereditos.mjs`; `validar-localizacoes-sem-par.mjs`; `auditar-coordenadas.mjs`; `relatorio-reconciliacao.mjs`; `malhas-dos-municipios.mjs`; `compilar-terras-indigenas.mjs` | geram `public/data/*.json` e `src/lib/localizacoes-validadas-gerado.js`; a validação completa fala com CNES/IBGE e é lenta |
| **AYA** | `compilar-conhecimento-aya.mjs` (`npm run aya:conhecimento`), `aya-local-bridge.mjs`, `aya-servico.mjs`, `endereco-do-tunel.mjs`, `aya-instalar-servico.ps1`, `aya-servico-oculto.vbs` | o compilador gera `src/modules/aya-conhecimento-gerado.js` a partir de `docs/aya/` |
| **Servidor** | `dev.mjs` (`npm run dev`: build em watch + servidor), `test-servidor-smoke.mjs` | |
| **Diversos** | `medir-cronograma.mjs` (`npm run medir:cronograma`) | |

Regras:
- **Arquivo gerado se regenera com o script, nunca se edita à mão.** Se `recompilar-vereditos.mjs`
  resolve (só mudou o formato), não rode `validar-localizacoes.mjs` (refaz a auditoria inteira na rede).
- Script novo: nome em português, verbo no infinitivo (`validar-…`, `compilar-…`), comentário de
  topo dizendo por que existe e como rodar, teste em `tests/` quando tiver lógica.
- Não rodar script de banco contra produção sem pedido explícito.
