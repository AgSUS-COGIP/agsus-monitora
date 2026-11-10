# Arquitetura de evolução - AgSUS Monitora

## Objetivo

Evoluir o AgSUS Monitora de uma aplicação HTML monolítica para um sistema modular, seguro e sustentável no Vercel com Supabase.

## Princípios

- `main` é produção.
- Toda mudança estrutural deve ir por branch e Pull Request.
- O preview do Vercel deve validar antes do merge.
- Mudanças no Supabase devem ficar em `supabase/migrations/`.
- Login e permissões devem falhar de forma clara, nunca com tela travada.

## Módulos desejados

### `src/lib`

Responsável por configuração e utilitários compartilhados.

- `env.js`
- futuro `supabaseClient.js`
- futuro `formatters.js`
- futuro `storage.js`

### `src/modules/auth`

Responsável por login, logout, sessão Google e solicitação de acesso.

Prioridade alta:

- remover `onclick` do HTML;
- centralizar `loginWithGoogle`;
- criar estados de tela: login, solicitacao, erro, carregando.

### `src/modules/admin`

Responsável por aprovar usuários, definir permissões e liberar painéis.

Prioridade alta:

- separar solicitação de acesso da configuração geral;
- criar filtros por status: pendente, aprovado, recusado;
- registrar auditoria de aprovação.

### `src/modules/panels`

Responsável por painéis externos.

Prioridade média:

- agrupar painéis por categoria;
- melhorar mensagens de manutenção;
- melhorar fallback quando iframe não carrega.

### `src/modules/dashboard`

Responsável pelo painel principal de monitoramento.

Prioridade média:

- separar filtros, KPIs, mapa e tabela;
- reduzir re-renderização desnecessária;
- isolar exportação CSV/PDF.

### `src/analises`

Responsável pelo painel de análises curriculares.

Prioridade média:

- migrar auth compartilhado;
- centralizar consultas;
- criar estados vazios e erros mais claros.

## Próximas entregas recomendadas

1. Estabilizar login Google e solicitação de acesso.
2. Melhorar painel de aprovação de usuários.
3. Separar cliente Supabase único.
4. Remover handlers inline gradualmente.
5. Criar testes simples de build e smoke test.

## Checklist antes de merge para `main`

- Preview da branch abre sem Vercel Authentication para quem precisa testar.
- Login Google funciona com conta autorizada.
- Conta sem perfil cai em solicitação de acesso.
- Solicitação aparece para admin.
- Admin consegue aprovar e definir painéis.
- `analises.html` abre.
- Painéis externos abrem e voltam ao sistema.
- Vercel build passa.
