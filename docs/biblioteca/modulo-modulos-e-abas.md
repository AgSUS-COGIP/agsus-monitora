---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Módulos e abas (Configurações › Módulos e abas)

Liga, desliga, põe em manutenção ou beta os módulos e as abas, sem deploy. Pasta
`src/modulos/modulos/`, toda em React e TypeScript. Explicações: `docs/aya/regras-dos-modulos-e-abas.md`.

## Arquivos

- `modulos.tsx` monta a tela; `estado.ts` concentra carga, rascunho e salvamento; `tipos.ts` declara
  contratos de dados, alvos, campos e ações. O CSS e os controles de `src/ui/` são preservados.
- Regras puras: `src/lib/modulos-e-abas.ts`; leitura da resposta: `src/lib/arvore-dos-modulos.ts`.

## Como funciona

- Só o administrador global carrega a árvore.
- Alterações do sistema, áreas, abas, abas por área e painéis se acumulam no rascunho e vão em lote,
  com motivo. Revisão, histórico, manutenção, beta, comemorações e confirmação de saída seguem no
  mesmo fluxo. Snapshot e mapas do rascunho são só leitura; cada alvo exige suas identificações.
- RPCs `obter_modulos_e_abas` e `salvar_situacao_modulos`, pelo cliente Supabase compartilhado.
  Recusa do banco preserva as alterações pendentes. Resposta iniciada numa sessão anterior não
  publica dados, avisos ou confirmações na sessão seguinte.

## Validação da resposta

A árvore é validada antes de entrar no estado: objetos, listas, identificações textuais não vazias,
textos opcionais e booleanos. Listas ausentes viram vazias; campos extras são ignorados. Releitura
malformada mantém a última árvore válida e o rascunho, exibindo o erro. Contagem inválida ou ausente
na confirmação usa o tamanho do lote enviado. Valores anterior e novo do histórico ficam `unknown`,
convertidos em texto na apresentação; situações recebidas continuam textuais (compatibilidade com o
banco) e as ações da interface aceitam só os estados existentes. O compilador não verifica os
consumidores JavaScript nem substitui a autorização do banco.

## Testes

`tests/modulos-e-abas.test.js`, `tests/modulos/modulos.test.js` e `tests/arvore-dos-modulos.test.js`
(RPCs simuladas, rede bloqueada); `tests/tipos/modulos.tsx` confere contratos e rejeições no
compilador estrito.

## Relacionadas

- [[modulo-configuracoes]] — a moldura; o liga/desliga geral das comemorações fica aqui
- [[modulo-barra-lateral]] — manutenção e beta aparecem no menu
- [[permissoes-e-perfis]] — só admin global
- [[modulo-automacao]] — outra seção de administração do sistema
