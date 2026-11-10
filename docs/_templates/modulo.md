---
tipo: modulo
area: modulo
atualizado: AAAA-MM-DD
---

# Módulo: Nome da tela

O que a tela faz, a rota (`/<área>/<caminho>`) e a pasta (`src/modulos/<nome>/`).

## Arquivos

```
<nome>.tsx      componente e criar<Nome>() → { conteudo, nome, render() }
estado.ts       store sem React (obter, assinar, ações por RPC)
<nome>.css      só o que é desta tela; o resto vem de src/ui/
```

Regras puras em `src/lib/<nome>.ts`. RPCs no contrato (`src/lib/rpc-contrato.ts`).

## Regras e contratos

- O que a tela garante, os limites e de onde vem cada dado.

## Testes

`tests/modulos/<nome>.test.ts` e `tests/<regra>.test.ts`.

## Relacionadas

- [[nova-tela-react]] — como a tela entra no app
- [[permissoes-e-perfis]] — quem vê
