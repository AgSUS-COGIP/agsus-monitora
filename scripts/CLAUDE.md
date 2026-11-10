# `scripts/` — ferramentas Node (`*.mjs`) e jobs Python

Cada `[[nome]]` é `docs/biblioteca/<nome>.md`. A tabela dos grupos de scripts e o que cada um gera:
[[scripts-e-checagens]].

Cada script documenta o próprio uso no comentário do topo: leia só as primeiras ~30 linhas
(`sed -n '1,30p'`) antes de rodar. Prefira o `npm run` equivalente quando houver.

Regras:

- **Arquivo gerado se regenera com o script, nunca se edita à mão** (`public/data/*.json`,
  `src/modules/aya-conhecimento-gerado.js`, `src/styles/icones-lucide.css`).
- Checagem do build falhou (`check-*`, `checar-links-da-biblioteca.mjs`) = regra violada: corrija o
  código ou a nota, não o script ([[ci-e-qualidade]]).
- Script novo: nome em português, verbo no infinitivo (`validar-…`, `compilar-…`), comentário de
  topo dizendo por que existe e como rodar, teste em `tests/` quando tiver lógica.
- Scripts de banco precisam de credencial (`pg`); **não rodar contra produção sem pedido
  explícito** ([[banco-e-migrations]]).
- Jobs Python seguem [[python-e-jobs]]: banco só por RPC, nada de dado pessoal no log (o log do
  Actions é público), saída 0/2/1. Robôs e agenda: [[robos-e-agenda]]; cargas de planilha:
  [[cargas-de-planilha]].
