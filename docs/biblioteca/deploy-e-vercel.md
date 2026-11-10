---
tipo: guia
area: operacao
atualizado: 2026-11-10
---

# Deploy e Vercel

O front é estático (`dist/` do Vite) e fica na Vercel, com as funções serverless de `api/`
([[funcoes-da-vercel]]). Há também um servidor opcional em container ([[servidor-web]]).

## Publicar

- **O merge em `main` publica em produção na Vercel.** As outras branches não geram prévia
  (`ignoreCommand` no `vercel.json`); o que depende de `/api` só é testado depois do merge.
- Migrations são aplicadas **antes** do merge quando o front novo depende delas, e **depois** da
  publicação quando removem algo que o front atual ainda usa ([[banco-e-migrations]]).
- `vercel.json` guarda os cabeçalhos de segurança (também lidos pelo servidor), os `rewrites` que
  entregam o `index.html` nas rotas das telas e a configuração de cada função (`maxDuration`,
  `includeFiles`/`excludeFiles`).
- Na Vercel, só as variáveis `VITE_*` públicas e as das funções (`EDITAIS_API_CHAVE`,
  `SUPABASE_SERVICE_ROLE_KEY`, que nunca vão para o front). A antiga `GITHUB_DISPATCH_TOKEN` pode ser
  apagada: o disparo dos robôs passou para o banco ([[robos-e-agenda]]).

## Versão nova e novidades

- Cada build publica `/versao.json`. Quem está com o sistema aberto vê a faixa "Há uma versão nova
  do MONITORA" (`src/app/aviso-de-versao.ts`, componente `src/componentes/aviso-de-versao/`).
- **Mudança visível para quem usa entra no topo de `NOVIDADES` em `src/lib/novidades.ts`, no mesmo
  PR.** Entrada nova: `id` único (data + assunto), `data` (AAAA-MM-DD), `texto` curto, sem ponto
  final, em minúscula ("motivo padronizado na reabertura"), e `visivel: true` só quando a mudança
  importa para quem usa (correção interna fica `false`).
- O build copia as novidades com `visivel: true` para o `versao.json` (`vite.config.js`), e a
  página antiga lê de lá; o aviso mostra a mais recente que a versão aberta ainda não tem (sem
  nenhuma, só "Há uma versão nova").
- `src/lib/versao-do-sistema.ts` lê o `versao.json`, escolhe a novidade e dá o sinal de "tela
  antiga" (PGRST202 / "recarregue a página"). Tela sob demanda baixada com a versão velha recarrega
  uma vez (`importarComRecarga`).

## Checklist de publicação

CI verde; migrations ensaiadas, aplicadas na ordem certa e registradas; login e solicitação de
acesso funcionando; telas afetadas conferidas na versão publicada; nenhum segredo no diff; novidade
registrada quando muda algo para quem usa.

## Operação depois de publicar

- **Configurações → Status das atualizações** mostra a última execução e o atraso de cada carga e
  robô ([[modulo-status-das-atualizacoes]]); as **Conferências** geram avisos diários
  ([[modulo-conferencias]]); disparos sem resposta do GitHub são sinalizados pelo banco.
- Os logs operacionais têm rotinas de limpeza para não estourar a cota; a última execução de cada
  carga é preservada.

## Relacionadas

- [[fluxo-git-e-prs]] — do PR ao merge
- [[comandos-e-ambiente]] — conferir o build de produção na máquina
