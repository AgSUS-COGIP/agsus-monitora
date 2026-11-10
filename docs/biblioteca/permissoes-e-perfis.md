---
tipo: regra
area: seguranca
atualizado: 2026-11-10
---

# Permissões e perfis

Cada pessoa vê só as áreas e os módulos que o seu grupo de acesso libera. A permissão é decidida
no banco (RLS e RPCs `SECURITY DEFINER`); o front só esconde o que a pessoa não pode usar.

## Onde fica

- `src/lib/access-roles.ts` — o que cada perfil pode e a **regra única de páginas e seções
  liberadas** (`paginasPermitidas`, `secaoDeConfiguracaoPermitida`), usada pela barra lateral e
  pelo "Ver como".
- `src/lib/permissoes-recursos.ts` — módulos (recursos de permissão) e níveis.
- Mudar a matriz costuma exigir migration junto ([[banco-e-migrations]]).
- Configurações › Acessos (grupos de permissões, permissões individuais, coordenações, teto do
  coordenador, "como a pessoa vê", pedidos de acesso): `src/modulos/acessos/` com
  `src/lib/matriz-de-acessos.ts` (rascunho; grupo × individual), `teto-de-acessos.ts`,
  `grupos-e-coordenacoes.ts`, `ver-como.ts` e `solicitacao-de-acesso.ts` (pedido por área: listas,
  situação, validação, recusa). Ver [[modulo-acessos]].
- O menu por permissão e por área: `src/lib/menu-lateral.ts` ([[modulo-barra-lateral]]).

## Regras

- **O perfil é relido a cada `render()`**: as permissões mudam sem aviso do legado.
- Quem só lê não vê os controles de edição (sem selo "Somente consulta";
  [[textos-da-interface]]).
- RLS ligada por padrão; não desligar para "resolver" permissão ([[banco-e-migrations]]).
- Módulos e abas podem ser desligados ou postos em manutenção em **Configurações → Módulos e
  abas**, sem deploy ([[modulo-modulos-e-abas]]).
- Quem pode o quê em cada tela está explicado para a Aya em `docs/aya/regras-dos-acessos.md`.

## Relacionadas

- [[sessao-e-auth]] — o login
- [[areas-do-sistema]] — a área como dimensão da permissão
- [[seguranca]] — RLS e RPCs
