---
tipo: modulo
area: modulo
atualizado: 2026-11-17
---

# Módulo: Comemorações (fogos e aviso)

O que aparece quando um marco acontece: o aviso no topo com a frase e, nas ocasiões com efeito, o
efeito no `<canvas>` (fogos, confete, serpentina, estrelas, corações, balões ou a Aya comemorando)
com a Aya atravessando a tela. Não é uma tela: é filha da casca, desenhada por portal no fim do
`body`, e só baixa quando alguma comemoração vai aparecer (`src/app/comemoracao-sob-demanda.ts`,
fila em `src/app/fila-de-comemoracoes.ts`). Pasta `src/modulos/comemoracao/`. A configuração (que
marco, que efeito, intensidade, duração, som, mensagem) fica em Configurações › Comemorações
([[modulo-configuracoes]]).

## Arquivos

| Arquivo            | Responsabilidade                                                                |
| ------------------ | ------------------------------------------------------------------------------- |
| `comemoracoes.tsx` | `comemorar()`, o aviso (`role="status"`, Pular, som, ×) e os fogos              |
| `plano.ts`         | o plano: efeito, intensidade, duração, som; só aviso e o limite de um por dia   |
| `desenho.ts`       | o desenho dos fogos no canvas (partículas, rastros, véu)                        |
| `desempenho.ts`    | baixa a qualidade sozinho abaixo de ~45 fps (nunca volta a subir no mesmo show) |
| `som.ts`           | o som sintetizado com WebAudio (sem arquivo), desligado por padrão              |

Lógica pura em `src/lib/`:

| Arquivo                        | O quê                                                                    |
| ------------------------------ | ------------------------------------------------------------------------ |
| `comemoracao/comemoracao.ts`               | quando comemorar (transições vistas) e as frases de cada marco           |
| `comemoracao/catalogo-de-comemoracoes.ts`  | o catálogo, a configuração publicada, `soAviso` e `reservarEfeitoDoDia`  |
| `comemoracao/exemplos-das-comemoracoes.ts` | a frase de exemplo de cada marco (Testar e campo Mensagem)               |
| `comemoracao/motor-de-efeitos.ts`          | confete, serpentina, estrelas, corações e balões                         |
| `comemoracao/fogos.ts` e `fogos-*.ts`      | física, roteiro, formas no céu (número, coração, estrela, visto), paleta |
| `comemoracao/efeitos-das-comemoracoes.ts`  | efeitos, intensidades e limites de duração                               |

## Regras

- **Só ocasiões reais.** Com efeito, só quatro: edital 100% analisado (fogos, Festa), quem fechou a
  última ficha do edital (estrelas, Suave), marco do ano da área (fogos, Normal) e acesso liberado
  (fogos, Suave). Fila zerada, vaga pronta, os marcos personalizados e o fim do dia de entrevistas
  são **só o aviso**, sem canvas (`soAviso` no catálogo; na configuração, só ligado, mensagem e
  quem vê). A meta do dia e o fim do tour ou da trilha da Aya não comemoram; configuração publicada
  antiga com esses ids é ignorada sem erro.
- **No máximo um efeito por pessoa por dia** (dia de Brasília, guardado neste navegador em
  `agsus_monitora_comemoracao_com_efeito`, com try/catch): as seguintes do mesmo dia saem só como
  aviso. O Testar e o Soltar de Configurações não contam nem são limitados.
- **Celebra o processo e a equipe, nunca uma pessoa** (não há ranking). A exceção é quem fecha a
  última ficha do edital, que ganha a própria comemoração ([[modulo-editais]]).
- **Uma vez por pessoa e navegador.** A primeira leitura é linha de base, em silêncio (também no
  marco do ano: o já alcançado não é anunciado); comemora a transição vista depois (`avaliarMarco`
  em `src/app/comemoracao-sob-demanda.ts`).
- **Frases:** dizem o fato com o número, sem emoji, sem exclamação empilhada e sem agradecimento
  ("Edital 114/2026 (Rio de Janeiro): as 1.512 fichas foram analisadas.", "Nenhuma ficha pendente
  na SEDE.", "Saúde Indígena: 7.500 análises concluídas em 2026."). O aviso já tem o ícone de festa
  (Design System, seção 14). A frase fica só no aviso: não há letreiro no meio da tela.
- **Marcos personalizados:** só o aviso; vários alcançados na mesma leitura, só o maior.
- **Respeita** `prefers-reduced-motion` (só o aviso), o liga/desliga geral (Módulos e abas ›
  Sistema inteiro) e a preferência pessoal ("Para mim").
- **Falhou o download** do desenho: a comemoração não aparece e nada mais muda.
- A Aya entra pelo evento `aya:estado` ("comemorando"), sem acoplar os módulos ([[modulo-aya]]).

## Onde nasce cada marco

| Marco                                   | Efeito          | Onde                                              |
| --------------------------------------- | --------------- | ------------------------------------------------- |
| Edital 100% analisado                   | fogos, Festa    | Análises (`src/modulos/analises/marcos.ts`)       |
| Quem fechou a última ficha              | estrelas, Suave | Encerramento do edital                            |
| Fila zerada                             | só aviso        | Análises (`src/modulos/analises/marcos.ts`)       |
| Vaga pronta para a Classificação        | só aviso        | Entrevistas (`src/modulos/entrevistas/marcos.ts`) |
| Marco do ano da área (sem card na tela) | fogos, Normal   | Visão geral (`boas-vindas.tsx`, `MarcosDoAno`)    |
| Acesso liberado ou reativado            | fogos, Suave    | Entrada (`src/modules/comemoracao-do-acesso.ts`)  |
| Entrevistas de hoje concluídas          | só aviso        | Conduzir entrevistas (`conduzir.tsx`)             |
| Personalizados                          | só aviso        | `src/app/marcos-personalizados.ts`                |

## Testes

`tests/fogos*.test.js`, `tests/aya-e-comemoracao.test.js` (bloco `motor-de-efeitos`), `tests/avaliacao-e-recursos-na-tela.test.js` (bloco `marcos-e-comemoracoes`),
`tests/avaliacao-e-recursos-na-tela.test.js` (bloco `marcos-nos-paineis`), `tests/aya-e-comemoracao.test.js` (bloco `catalogo-de-comemoracoes`),
`tests/aya-e-comemoracao-na-tela.test.js` (bloco `comemoracoes-configuradas`) e `tests/demais-regras.test.ts` (bloco `exemplos-das-comemoracoes`).

## Relacionadas

- [[modulo-configuracoes]] — onde se configura cada marco
- [[modulo-aya]] — a mascote que comemora junto
- [[textos-da-interface]] — o tom das frases
