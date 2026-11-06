/*
  O motor da classificação: lógica pura, sem DOM e sem banco.

  Entrada: os candidatos do edital (análise curricular), as entrevistas (ligadas
  à análise SÓ por CO_ANALISE_CURRICULAR — nunca pelo nome), o quadro de vagas,
  a regra do edital, a data de corte da idade e os desempates já registrados
  (sorteio ou decisão manual).

  Saída, por vaga: elegíveis × eliminados (com motivo padronizado), nota final,
  posição na lista geral e em cada modalidade, a situação (dentro das vagas ou
  cadastro reserva) e, para cada candidato, a EXPLICAÇÃO da posição; e, no topo,
  os avisos (entrevista sem análise, candidato convocado sem entrevista, dado
  que falta para um critério, empate que espera sorteio…).

  Quatro listas (`tipo`), as mesmas etapas das publicações da AgSUS:
    PRELIMINAR  avaliação documental e de títulos: quem passou na documental,
                pela nota documental (com as parciais), e os eliminados com o
                motivo. "Preliminar" ou "final" da etapa é a mesma lista antes
                e depois dos recursos.
    CONVOCACAO  os primeiros da preliminar até o limite da regra (N × vagas
                imediatas, ou até a k-ésima posição no cadastro reserva), com
                os empatados no limite se a regra mandar.
    ENTREVISTA  resultado da etapa de entrevista: os convocados aptos, pela
                nota da entrevista; eliminados da entrevista com o motivo. O
                empate que sobra fica na mesma posição (como nas publicações:
                o desempate do edital é do resultado final).
    FINAL       quem passou na documental e na entrevista, pela nota composta
                (pesos e arredondamento da regra), com o desempate, as vagas
                imediatas e o cadastro reserva.

  O empate: primeiro a nota (na escala das casas publicadas); depois, se a regra
  manda usar critérios naquela lista, os critérios na ordem da regra; o que
  sobrar, pelo método do empate final que o gestor escolheu (sorteio
  registrado, ordem de inscrição, mesma posição ou decisão manual).

  O código fica em src/lib/classificacao/motor/, um arquivo por etapa; este
  arquivo só reexporta a API pública (quem importa não precisa mudar).
*/

export {
  prepararCandidatos,
  ligarEntrevistas,
  aplicarAjustes,
  rotuloDoItem,
  aplicarAgrupamentos,
} from "./motor/entrada.ts";
export { aguardandoAnalise, notaComposta } from "./motor/etapas.ts";
export { compararValores } from "./motor/ordenacao.ts";
export { limiteDaConvocacao } from "./motor/vagas-e-convocacao.ts";
export { classificar } from "./motor/classificar.ts";
