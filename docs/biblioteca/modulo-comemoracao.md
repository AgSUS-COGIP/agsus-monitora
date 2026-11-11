---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Comemorações (fogos, aviso e letreiro)

O que aparece quando um marco acontece: o aviso no topo com a frase, o efeito no `<canvas>`
(fogos, confete, serpentina, estrelas, corações, balões ou a Aya comemorando), a Aya atravessando
a tela e o letreiro, a frase grande no meio da tela. Não é uma tela: é filha da casca, desenhada por
portal no fim do `body`, e só baixa quando alguma comemoração vai aparecer
(`src/app/comemoracao-sob-demanda.ts`, fila em `src/app/fila-de-comemoracoes.ts`). Pasta
`src/modulos/comemoracao/`. A configuração (que marco, que efeito, intensidade, duração, som,
mensagem) fica em Configurações › Comemorações ([[modulo-configuracoes]]).

## Arquivos

| Arquivo            | Responsabilidade                                                                |
| ------------------ | ------------------------------------------------------------------------------- |
| `comemoracoes.tsx` | `comemorar()`, o aviso (`role="status"`, Pular, som, ×), os fogos e o letreiro  |
| `plano.ts`         | o plano de uma comemoração: efeito, intensidade, duração, som, forma e letreiro |
| `desenho.ts`       | o desenho dos fogos no canvas (partículas, rastros, véu)                        |
| `desempenho.ts`    | baixa a qualidade sozinho abaixo de ~45 fps (nunca volta a subir no mesmo show) |
| `letreiro.ts/.tsx` | a frase em texto de verdade numa placa escura; tempo, tamanho e contraste       |
| `som.ts`           | o som sintetizado com WebAudio (sem arquivo), desligado por padrão              |

Lógica pura em `src/lib/`:

| Arquivo                       | O quê                                                                    |
| ----------------------------- | ------------------------------------------------------------------------ |
| `comemoracao.ts`              | quando comemorar (transições vistas) e as frases de cada marco           |
| `catalogo-de-comemoracoes.ts` | o catálogo de marcos, a configuração publicada e o letreiro de cada um   |
| `motor-de-efeitos.ts`         | confete, serpentina, estrelas, corações e balões                         |
| `fogos.ts` e `fogos-*.ts`     | física, roteiro, formas no céu (número, coração, estrela, visto), paleta |
| `efeitos-das-comemoracoes.ts` | efeitos, intensidades e limites de duração                               |

## Regras

- **Celebra o processo e a equipe, nunca uma pessoa** (não há ranking). A exceção é quem fecha a
  última ficha do edital, que ganha a própria comemoração ([[modulo-encerramento-do-edital]]).
- **Uma vez por pessoa e navegador.** A primeira leitura é linha de base, em silêncio; comemora a
  transição vista depois (`avaliarMarco` em `src/app/comemoracao-sob-demanda.ts`).
- **Frases sem emoji.** O aviso já tem o ícone de festa (Design System, seção 14: nenhum emoji no lugar de
  ícone). A frase diz o que aconteceu e agradece à equipe da área (`equipeDaArea`).
- **Letreiro**: até 14 caracteres (`TAMANHO_MAXIMO_DO_LETREIRO`); o do marco no catálogo, o pedido
  pela comemoração ou, no Festa, "Parabéns!". Contraste conferido em `letreiro.ts`
  (`tests/letreiro-legivel.test.js`).
- **Respeita** `prefers-reduced-motion` (só o aviso e a frase), o liga/desliga geral (Módulos e
  abas › Sistema inteiro) e a preferência pessoal ("Para mim").
- **Falhou o download** do desenho: a comemoração não aparece e nada mais muda.
- A Aya entra pelo evento `aya:estado` ("comemorando"), sem acoplar os módulos ([[modulo-aya]]).

## Onde nasce cada marco

| Marco                                           | Onde                                              |
| ----------------------------------------------- | ------------------------------------------------- |
| Edital 100% analisado, fila zerada, meta do dia | Análises (`src/modulos/analises/marcos.ts`)       |
| Quem fechou a última ficha                      | Encerramento do edital                            |
| Vaga pronta para o resultado                    | Entrevistas (`src/modulos/entrevistas/marcos.ts`) |
| Marco do ano da área                            | Visão geral (`boas-vindas.tsx`)                   |
| Acesso liberado ou reativado                    | Entrada (`src/modules/comemoracao-do-acesso.ts`)  |
| Fim do tour ou da trilha                        | Aya (`src/modulos/aya/aya.tsx`)                   |
| Personalizados                                  | `src/app/marcos-personalizados.ts`                |

## Testes

`tests/fogos*.test.js`, `tests/letreiro-legivel.test.js`, `tests/motor-de-efeitos.test.js`,
`tests/marcos-e-comemoracoes.test.js`, `tests/marcos-nos-paineis.test.js`,
`tests/catalogo-de-comemoracoes.test.js` e `tests/comemoracoes-configuradas.test.js`.

## Relacionadas

- [[modulo-configuracoes]] — onde se configura cada marco
- [[modulo-aya]] — a mascote que comemora junto
- [[textos-da-interface]] — o tom das frases
