---
tipo: guia
area: front
atualizado: 2026-11-10
---

# Carga da entrada

O que acontece entre o login e a primeira tela: as consultas em paralelo, a cópia da sessão no
navegador e o carregamento sem tela de carregamento (skeleton).

## Carga

- `src/app/carga.ts` — `loadInitialData` (consultas em paralelo) e `atualizarCopiaDaSessao`.
- `src/app/inicio-da-sessao.ts` — configuração, painéis, abas, situação e unidades numa chamada só
  (RPC `obter_inicio_da_sessao`).
- **Linhas do monitoramento sob demanda:** só as páginas de `src/lib/telas-com-linhas.ts` (via
  `src/app/pagina-aberta.ts`) ou `usarLinhasDoMonitoramento` fazem a carga lê-las; o legado as
  publica em `src/componentes/dados-do-monitoramento.ts` ([[legado-fala-com-react]]).

## Cópia da sessão no navegador

- `src/lib/copia-da-sessao.ts` (regras) decide quando a cópia guardada pode abrir a tela: mesmo
  usuário, mesmo acesso, mesma versão publicada, dentro da validade; e o que mudou desde ela.
  **Afrouxar uma regra daqui expõe dado a quem perdeu acesso** ([[seguranca]]).
- `src/modules/copia-da-sessao-indexeddb.ts` guarda no IndexedDB.

## Carregamento sem tela de carregamento

- `src/app/carregamento.ts` — o skeleton da entrada e a barra do "Atualizar dados"; a antiga tela
  `#loader` ficou só para salvamentos.
- `src/lib/esqueleto-da-entrada.ts` — o formato do skeleton.
- `src/styles/carregamento.css` — o bloco `.esqueleto` e a barra; pulsa só com `opacity`, e só
  enquanto está ligado.
- No `index.html`: a marcação `.esqueleto-da-entrada` e o script `marcarSessaoGuardada`.
- Painel externo que avisa quando carregou: [docs/painel-externo-avisa-que-carregou.md](../painel-externo-avisa-que-carregou.md)
  ([[modulo-paineis-externos]]).
- Regra visual: carregando não é zero; enquanto não chega, skeleton ([[textos-da-interface]]).

## Versão nova com a página aberta

A tela sob demanda usa `importarComRecarga`: versão nova publicada com a página aberta recarrega
uma vez. Quem está com o sistema aberto vê a faixa "Há uma versão nova" ([[deploy-e-vercel]]).

## Relacionadas

- [[sessao-e-auth]] — o login antes da carga
- [[arquitetura-do-front]] — a raiz e as rotas
- [[permissoes-e-perfis]] — o que a pessoa pode ver
