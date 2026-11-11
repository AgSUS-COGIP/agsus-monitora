---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Acessos (Configurações › Acessos)

Grupos de permissões + permissões individuais, coordenações, teto do coordenador, "como a pessoa
vê" e pedidos de acesso, em React. Pasta `src/modulos/acessos/`; o legado abre por
`window.acessosController`. Explicações para quem usa: `docs/aya/regras-dos-acessos.md`.

## Abas

- **Usuários** — visão simples (uma linha por pessoa: grupo e o que ele deixa fazer, áreas,
  coordenação, situação) ou "Ver permissões por módulo (avançado)": a matriz, com grupo (tag) e um
  select por módulo ("Do grupo" segue o grupo). As duas gravam no mesmo rascunho, só com motivo.
  "Pendentes" (pedidos) e "Desativadas" (só admin global) ficam aqui.
- **Grupos** (só admin global) — lista + detalhe: o nível de cada módulo no grupo; quem segue o
  grupo muda junto. O grupo de administrador global é do sistema e não se edita.
- **Coordenações** (só admin global) — cada uma subdivide uma área. Sem responsável, unidades nem
  editais → a área inteira; só editais → só esses; com responsável e/ou unidades → os editais que
  casam a regra, mais os atribuídos. O banco calcula (`FC_EDITAIS_DA_COORDENACAO`).

O admin global vê as três; o coordenador (módulo "acessos" ≥ editor), só Usuários, recortado pela
coordenação dele (o banco recorta de novo). As abas ficam montadas e escondidas: busca, rascunho e
formulários sobrevivem à troca de aba.

## Peças

- `gaveta-do-usuario.tsx` — o modal da pessoa, o ÚNICO lugar para mudar alguém: grupo, coordenação
  e áreas à esquerda; "como a pessoa vê" à direita (com alteração pendente, "Depois de salvar");
  "Salvar" com motivo e "Desativar acesso". "Avançado": exceções por módulo, painéis externos e,
  só para o admin global, "transformar em coordenação" — DESATIVA a conta, com confirmação escrita
  (em 30/09 foi usada numa conta de pessoa por engano). Nunca aparece para a própria conta.
- `modal-adicionar-pessoa.tsx` — cadastra pelo e-mail antes do primeiro login
  (`adicionar_pessoa_acesso`; no login o banco liga o perfil pelo e-mail). Só domínios
  institucionais (`auth_google_allowed_domains`). Coordenador adiciona na própria coordenação, com
  grupo dentro do teto. Depois vira "Convite pronto" (`convite.tsx`: copiar ou abrir no e-mail; o
  link só leva à entrada, quem dá o acesso é o e-mail cadastrado).
- `solicitacoes.tsx` — pedidos pendentes: admin vê todos; coordenador, os da coordenação dele
  (`private."FC_EXIGIR_GESTOR_DE_ACESSOS"`). Quem aprova escolhe o grupo (sugerido pelo cargo,
  `grupoSugeridoDoPedido`) e a coordenação ou as áreas. Recusa com motivo da lista fixa
  (`MOTIVOS_DE_RECUSA`; "Outro" pede descrição), que a pessoa vê ao entrar de novo. Pedido de conta
  desativada é de REATIVAÇÃO.
- `contas-desativadas.tsx` — quem, quando, por quem e por quê; "Reativar" com motivo; na entrada
  seguinte, "Bem-vindo(a) de volta" (`src/modules/comemoracao-do-acesso.ts`).
- `estado.ts` — matriz, rascunho, solicitações, gaveta e ações (uma por vez); sem React. O rascunho
  mora aqui porque a guarda de saída (`navigate`) e a troca de seção perguntam (`confirmarSaida`).
- `partes.tsx` (lista mestre, campo de motivo obrigatório em toda gravação, travas da matriz),
  `tipos.ts` (regras e linhas das RPCs em `src/lib/tipos-dos-acessos.ts`), `acessos.css`.

## Regras puras e banco

`src/lib/matriz-de-acessos.ts` (rascunho; grupo × individual), `teto-de-acessos.ts` (teto do
coordenador), `grupos-e-coordenacoes.ts`, `ver-como.ts`, `solicitacao-de-acesso.ts` (pedido por
área: listas, situação, validação, recusa; ver `src/app/entrada/`). Banco nas migrations
`20260929121000`–`121300`, `190000`–`190200`, `20261021140000` e `20261022140100`; só as RPCs gravam
o pedido.

## Relacionadas

- [[permissoes-e-perfis]] — módulos, níveis e páginas liberadas
- [[sessao-e-auth]] — login e domínio institucional
- [[areas-do-sistema]] — áreas e coordenações
- [[modulo-configuracoes]] — a moldura das seções
- [regras-dos-acessos](../aya/regras-dos-acessos.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
