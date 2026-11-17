---
tipo: modulo
area: modulo
atualizado: 2026-11-17
---

# Módulo: Configurações

Todas as seções em React: Marca, Página inicial, Tela de acesso, Aparência, Painéis externos,
Operação, Comemorações e as que têm tela própria (Acessos, Módulos e abas, Automação, Status das
atualizações). Pasta `src/modulos/configuracoes/`; rota `config`, cada seção em
`/administracao/configuracoes/<seção>`. Módulos e abas está descrita aqui; as outras de tela
própria têm nota sua ([[modulo-acessos]], [[robos-e-agenda]], [[modulo-paineis-externos]]).

## Moldura

- `configuracoes.tsx` — a moldura (rota `config`).
- `secoes.ts` — a lista das seções; cada uma é rota desenhada pela página em `src/app/telas.tsx`
  (seção com tela própria registrada como `secao:<id>`).
- `estado.ts` — estado com a publicação versionada (barra fixa de publicar, com motivo e histórico em
  `TH_CONFIGURACAO`). Detalhe no topo de cada arquivo e em
  [docs/arquitetura-react.md](../arquitetura-react.md). A barra, o Ctrl+S e o "Alterações não
  salvas" só valem nas seções da moldura, que têm campos (`SECOES_COM_BARRA_DE_SALVAR`); as de tela
  própria não mostram a barra.
- Regras puras: `src/lib/publicacao-de-configuracoes.ts` (chaves de cada seção, comparação com o
  retrato do banco, validação de URL e domínio), `apresentacao-das-configuracoes.ts` (tom da faixa de
  aviso global e endereço de imagem aceito nas prévias), `marca-da-barra-lateral.ts` (logo e cor
  publicadas e em rascunho), `paineis-externos-das-configuracoes.ts`.

## Comemorações

O desenho, os marcos e as regras de quando comemorar estão em [[modulo-comemoracao]]. Aqui fica a
seção que configura: `comemoracoes.tsx` (catálogo de marcos, personalizados, preferência pessoal) e
`palco-de-testes.tsx` (efeito, intensidade, duração e som escolhidos na hora, sem gravar), sobre
`src/lib/catalogo-de-comemoracoes.ts`.

- **Persistência.** Chave `comemoracoes_marcos` de `TB_CONFIGURACAO`, publicada pela barra fixa
  (`salvar_configuracoes_e_paineis_v2`, com motivo e `TH_CONFIGURACAO`; restaurar versão volta os
  marcos). Sem migration. Vazio = padrão; o JSON guarda só o que difere. A revisão mostra cada campo
  mudado (`alteracoesDasComemoracoes`), não o JSON.
- **Quem edita.** Quem edita configurações (`canManageSettings`, `has_perm('config')`), numa
  configuração única para o sistema (`TB_CONFIGURACAO` e a permissão são globais). Próximo passo, se
  pedido: chave por área (`comemoracoes_marcos:<area>`) e RPC que confira o gestor.
- **Quem vê.** Só quem fez (quem vê a transição no próprio navegador). "Toda a área online" fica
  desabilitado: a presença é uma batida a cada 45 s, sem canal por área. Próximo passo: canal
  Supabase Realtime por área (broadcast `comemoracao` com `{ marco, texto }`).
- **Preferência pessoal**: `agsus_monitora_comemoracoes_desligadas` = `"1"`
  (`CHAVE_COMEMORACOES_PESSOAIS` em `src/lib/preferencia-de-comemoracoes.ts`, a mesma da mascote).
  "Testar" e o palco passam `teste: true`: ignoram configuração e preferência e não gravam.
- **Marcos personalizados** (`src/app/marcos-personalizados.ts`): "Edital X chegou a N contratados"
  (soma de `contratados` das linhas do monitoramento, a cada carga/Realtime) e "a área passou de N
  análises concluídas no dia" (linhas de Análises).
- **Aya comemorando** (e o Combinado) não desenha a arara: avisa a mascote pelo evento
  `aya:estado` na janela (`EVENTO_DA_AYA`, em `src/modulos/comemoracao/comemoracoes.tsx`), com
  `detail` `{ estado: "comemorando", duracaoMs }` no começo e `{ estado: "parada" }` no fim. Sem
  mascote ouvindo, nada acontece; com "Aya comemorando", a arara dos fogos fica de fora.

## Módulos e abas

Liga, desliga, põe em manutenção ou beta os módulos e as abas, sem deploy. Pasta
`src/modulos/modulos/`, toda em React e TypeScript: `modulos.tsx` monta a tela, `estado.ts`
concentra carga, rascunho e salvamento, `tipos.ts` declara contratos de dados, alvos, campos e
ações. Regras puras em `src/lib/modulos-e-abas.ts`; leitura da resposta em
`src/lib/arvore-dos-modulos.ts`.

- **Só o administrador global** carrega a árvore.
- Alterações do sistema, áreas, abas, abas por área e painéis se acumulam no rascunho e vão em lote,
  com motivo. Revisão, histórico, manutenção, beta, comemorações (o liga/desliga geral, em Sistema
  inteiro) e confirmação de saída seguem no mesmo fluxo. Snapshot e mapas do rascunho são só
  leitura; cada alvo exige suas identificações. Manutenção e beta aparecem no menu
  ([[modulo-barra-lateral]]).
- RPCs `obter_modulos_e_abas` e `salvar_situacao_modulos`, pelo cliente Supabase compartilhado.
  Recusa do banco preserva as alterações pendentes. Resposta iniciada numa sessão anterior não
  publica dados, avisos ou confirmações na sessão seguinte.
- **Validação da resposta.** A árvore é validada antes de entrar no estado: objetos, listas,
  identificações textuais não vazias, textos opcionais e booleanos. Listas ausentes viram vazias;
  campos extras são ignorados. Releitura malformada mantém a última árvore válida e o rascunho,
  exibindo o erro. Contagem inválida ou ausente na confirmação usa o tamanho do lote enviado.
  Valores anterior e novo do histórico ficam `unknown`, convertidos em texto na apresentação;
  situações recebidas continuam textuais (compatibilidade com o banco) e as ações da interface
  aceitam só os estados existentes. O compilador não substitui a autorização do banco.

## Testes

Módulos e abas: `tests/modulos-e-abas.test.js`, `tests/modulos/modulos.test.js` e
`tests/arvore-dos-modulos.test.js` (RPCs simuladas, rede bloqueada); `tests/tipos/modulos.tsx`
confere contratos e rejeições no compilador estrito. Painéis e Operação:
`tests/modulos/configuracoes-paineis-e-operacao.test.js`. Comemorações: os testes listados em
[[modulo-comemoracao]].

## Relacionadas

- [[modulo-acessos]] — a seção Acessos, perfis e permissões
- [[robos-e-agenda]] — as seções Automação e Status das atualizações
- [[modulo-paineis-externos]] — a seção Painéis externos
- [[modulo-comemoracao]] — o que a seção Comemorações configura
- [[modulo-editais]] — o encerramento do edital usa os fogos do catálogo
- [[modulo-aya]] — a mascote que ouve `aya:estado`
- [[modulo-barra-lateral]] — logo e cor publicadas aqui; manutenção e beta no menu
- [[acessibilidade-e-mobile]] — `prefers-reduced-motion`
- [regras-das-configuracoes](../aya/regras-das-configuracoes.md) — o que a Aya responde sobre a tela (a explicação mora lá, não na interface)
- [regras-dos-modulos-e-abas](../aya/regras-dos-modulos-e-abas.md) — o que a Aya responde sobre Módulos e abas
