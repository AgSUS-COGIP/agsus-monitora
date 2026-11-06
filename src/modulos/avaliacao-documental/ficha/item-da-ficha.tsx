/*
  Um item da ficha (um bloco da regra), na ordem do trabalho do avaliador,
  de cima para baixo:
  1. o que o candidato declarou e o anexo ("Abrir na Empregare"), com o
     "Lido do arquivo" do robô ao lado de cada arquivo e, nos blocos de
     títulos, cursos e vínculos, a conferência de cada item lido (Aceitar /
     Recusar — leitura-dos-arquivos.tsx);
  2. a pergunta "O documento confere com o declarado?" com as escolhas lado
     a lado: Confere · Não confere · Editar nota (esta só nos blocos que
     pontuam; teclas 1, 2 e 3). O que cada uma grava: apurado-da-ficha.ts;
  3. Não confere: só o motivo (chips do bloco, "não enviou" e observação);
     Confere ou Editar nota: a lista de títulos, cursos ou vínculos, com a
     primeira linha já aberta;
  4. o resumo numa linha: "Pontuação: X de 5 · declarou 5" (a diferença só
     se houver; no Editar nota, o passador e "Usar o calculado");
  5. no máximo UMA mensagem: a falta mais útil (mensagemDoBloco, pelas
     pendências da ficha) ou, no Confere, o aviso de que os itens dão outra
     pontuação, com o atalho para Editar nota.
  O que o cargo da vaga muda (diferencas-do-cargo.tsx): a lista de requisitos
  do cargo antes das escolhas, as linhas extras (ex.: UMCQA) depois dos
  itens, o aviso do 8.2.7 e a área exigida da experiência.
  PELOS ITENS (o robô leu títulos, cursos ou vínculos do arquivo): o fluxo é
  conferir os itens → a pontuação sai dos aceitos → o avaliador confirma.
  A conferência (Aceitar / Corrigir / Recusar) e, embaixo, as linhas à mão
  com "Adicionar …" sempre à vista; no rodapé, "Pontuação pelos itens
  aceitos: X de 10 · declarou 10" e Confirmar (Confere se X é o declarado;
  senão Editar nota com a justificativa) · Não confere (o motivo) · "Editar
  nota" só como ajuste fino; confirmado, a "Justificativa do ajuste" (o
  resumo dos aceitos e dos não pontuados, editável: justificativa-dos-itens.ts). Mexer nos itens depois de confirmar volta a
  pedir a confirmação. As situações gravadas são as de sempre
  (apurado-da-ficha.ts).
  No modo lista, o mesmo em cartão compacto. A gravação é a do estado da
  ficha (mudar).

  O código fica em item-da-ficha/, um arquivo por parte; este arquivo só
  reexporta o que as outras telas usam (quem importa não precisa mudar).
*/

export {
  SELO_DA_SITUACAO,
  lidosDoBloco,
  contextoDaEscolha,
  decidirNoLancamento,
} from "./item-da-ficha/escolha.ts";
export type { ContextoDaEscolha } from "./item-da-ficha/escolha.ts";
export { Escolhas, Chips } from "./item-da-ficha/escolhas.tsx";
export { ItemDaFicha } from "./item-da-ficha/item.tsx";
export type { PropriedadesDoItem } from "./item-da-ficha/item.tsx";
