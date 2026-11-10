---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Resumo do dia do responsável

Sininho no topo (`src/app/casca/topo.tsx`) e popup "Bom dia, {nome} — seus editais hoje", para
quem é responsável por algum edital (`RL_RESPONSAVEL_EDITAL`) ou demanda interna
(`RL_DEMANDA_INTERNA_RESPONSAVEL`). Pasta `src/modulos/resumo-do-dia/`; migration
`20261104130000_resumo_do_dia_do_responsavel`.

## Arquivos

| Arquivo             | Responsabilidade                                                    |
| ------------------- | ------------------------------------------------------------------- |
| `estado.ts`         | Store (`resumoDoDia`): leitura, abrir/fechar, concluir, preferência |
| `resumo-do-dia.tsx` | Sininho com o número de pendências e o popup (Modal)                |
| `resumo-do-dia.css` | Estilos; a cor de cada linha é a do tipo no Cronograma (`data-cor`) |

Regras puras em `src/lib/resumo-do-dia.ts`.

## Regras

- **Uma chamada** (`obter_meu_resumo_do_dia`) ao entrar (`src/app/sistema.ts`) e outra a cada
  clique no sininho; sem polling.
- **Abre sozinho** só ao entrar, se:
  - há o que mostrar;
  - "Mostrar ao entrar" está ligado (`TB_PREFERENCIA_USUARIO`);
  - não foi fechado hoje neste navegador (`localStorage`
    `agsus:resumo-do-dia:visto:<perfil>:<dia>`);
  - a tela está livre (nenhum modal aberto nem campo em digitação).

  Senão, fica só o sininho.
- **Blocos**: Hoje, Próximos 7 dias e Atrasadas (demandas vencidas em aberto); até cinco por
  bloco e "e mais N".
- **Concluir** (demanda atrasada, se `pode_concluir`) usa `concluir_demanda_interna` e avisa o
  Cronograma (`agsus:nucleo-cronograma-saved`).
- **Ver no cronograma** vai a `/<área>/cronograma?visao=meus`: o Cronograma (`abrirVisao`) mostra
  só os editais e demandas da pessoa, até "Ver todos".

## Relacionadas

- [[modulo-cronograma]] — o destino do "Ver no cronograma" e a cor de cada tipo
- [[modulo-editais]] — onde se define o responsável do edital
- [[componentes-padrao]] — o `Modal` usado pelo popup
