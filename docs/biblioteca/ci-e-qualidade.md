---
tipo: referencia
area: testes
atualizado: 2026-11-10
---

# CI e qualidade

Todo Pull Request para `main` roda `.github/workflows/build-and-smoke.yml` ("AgSUS Monitora Quality
Gate"). A `main` é protegida: só entra com o check **"Arquitetura, qualidade, build e smoke"** verde.

## O que roda em todo PR

- **Arquitetura, qualidade, build e smoke** (obrigatório): auth, contrato de RPC, sem
  `MutationObserver` novo, sem camadas de remendo, legado só encolhe, timestamps das migrations;
  lint e formatação dos arquivos alterados; Vitest com cobertura (inclui o teste da biblioteca de
  documentação); `npm run build` (inclui `typecheck`, segurança do HTML e orçamento de bundles);
  todos os testes do Playwright sobre o `dist/` desse build, inclusive o app com sessão e o Supabase
  simulados; o smoke e a sessão simulada de novo no servidor TypeScript, e o smoke na imagem Docker.
  Na falha, o relatório e os traces ficam no artefato `relatorio-do-playwright`.
- **Python:** Ruff (lint e formatação) e pytest.
- **Contrato de RPC contra o banco de desenvolvimento** (ver abaixo).

## Validação do banco no CI

O Quality Gate distingue as verificações estáticas, os testes com dados simulados e o contrato de
RPC contra o catálogo real.

- **Em pull request**, o job de banco real fica **skipped** e o resumo informa **NÃO EXECUTADO**.
  Nenhuma credencial de banco é entregue ao código de um PR.
- **Execução real:** rodar manualmente o workflow na `main`, depois da revisão, com
  `SUPABASE_DB_URL_DEV` nos segredos do GitHub (conexão só de desenvolvimento; nunca produção; não
  enviar a credencial em mensagem, commit ou log). Sem o segredo, o job falha antes de instalar e
  consultar (não existe `exit 0` que transforme a falta do banco em aprovação); o resumo só registra
  sucesso depois de `check:rpc-contract:db` terminar com código zero.
- Isso não cria banco de desenvolvimento nem substitui ensaios de RLS, Storage, gravação, rollback
  ou testes de ponta a ponta; migrations continuam exigindo ensaio e registro manual.

## Comandos locais

```bash
npm run typecheck                        # tsc do front, do servidor e dos testes
npm run lint && npm run format:check     # ESLint e Prettier só nos arquivos alterados
npm run check:architecture               # auth + rpc + MutationObserver + remendos + legado + docs
npm run check:docs                       # links e notas órfãs da biblioteca
npm test                                 # Vitest (rede bloqueada)
python -m pip install -r python/requirements-dev.txt -r scripts/robo-empregare/requirements.txt
python -m pytest && python -m ruff check . && python -m ruff format --check .
```

## Limitações conhecidas

Os testes de banco são, na maioria, estáticos; a exceção é o PGlite de `tests/apoio/`. A cobertura
mínima configurada é baixa e não comprova cobertura dos fluxos críticos.

## Relacionadas

- [[scripts-e-checagens]] — cada checagem e o script dela
- [[testes]] e [[testes-de-navegador]] — o que os testes cobrem
- [[fluxo-git-e-prs]] — o PR até o merge
