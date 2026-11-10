---
tipo: regra
area: seguranca
atualizado: 2026-11-10
---

# Segurança

O repositório é público e o sistema guarda dados de candidatos. As regras abaixo valem para front,
banco, funções e robôs.

## Acesso e dados

- **Acesso só por convite:** login com Google em conta do domínio institucional; conta nova entra
  por convite ou solicitação aprovada por um administrador ([[sessao-e-auth]]).
- **RLS ligada em todas as tabelas**; o navegador só chama RPCs `SECURITY DEFINER` com
  `search_path` fixado ([[rpc-e-contrato]]). Não desligar RLS para "resolver" permissão.
- A cópia da sessão no navegador só abre a tela para o mesmo usuário, mesmo acesso e mesma versão
  (`src/lib/copia-da-sessao.ts`): afrouxar expõe dado a quem perdeu acesso ([[carga-da-entrada]]).

## Segredos

- **Nenhum segredo no repositório** (`.env*` no `.gitignore`; não commitar `.env`/`.env.local`).
  Secret scanning com push protection, CodeQL e Dependabot estão ligados.
- **Tudo que começa com `VITE_` vai para o navegador:** nunca coloque ali a chave `service_role`. Na
  Vercel, só as variáveis `VITE_*` públicas e as das funções.
- A `service_role` e as credenciais dos robôs ficam nos segredos do GitHub Actions; o token que
  dispara os robôs fica no **Vault** do Supabase ([[robos-e-agenda]]).
- Não expor chave ou URL interna na resposta de função; segredo vem de variável de ambiente
  ([[funcoes-da-vercel]]).
- Credencial de banco nunca vai para código de PR: o job de banco real só roda manualmente na
  `main`, com segredo só de desenvolvimento; nunca apontar esse segredo para produção.

## Fronteiras no código (não afrouxar)

- HTML dinâmico passa por `src/lib/sanitize.ts` / `html-security.ts`; CSV exportado por
  `csv-security.ts`. Nunca `innerHTML` cru nem `dangerouslySetInnerHTML`.
- Os proxies da FUNAI validam a origem com `src/lib/origem-da-requisicao.ts`
  (`origemDeTerceiro`): sem isso o endpoint vira proxy aberto.
- A API para outro sistema confere a chave em tempo constante (`api/_rota-com-chave.ts`).
- Cabeçalhos de segurança (HSTS, CSP etc.) no `vercel.json`, usados também pelo servidor
  TypeScript ([[servidor-web]]). `npm run check:dist-security` confere o HTML do build.
- `tests/setup/rede-bloqueada.ts` bloqueia a rede em todo teste unitário (um teste já chamou o
  Supabase de produção via `.env.local`).
- O servidor e o `dist/` não servem `CLAUDE.md`, `.env` nem arquivo com ponto
  (`tests/servidor.test.js`).

## Processo

- `main` protegida: só entra por PR com o check "Arquitetura, qualidade, build e smoke" verde
  ([[fluxo-git-e-prs]]).
- **Correções de dados em massa:** antes de limpar ou corrigir, exporte o que vai mudar.
- Não rodar script de banco contra produção sem pedido explícito.

## Relacionadas

- [[dados-pessoais]] — o que não sai em log, tela ou arquivo
- [[permissoes-e-perfis]] — quem pode o quê
- [[banco-e-migrations]] — RLS e RPCs no banco
