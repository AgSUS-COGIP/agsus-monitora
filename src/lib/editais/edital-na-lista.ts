/*
  O edital aberto numa tela da seleção e a lista de editais dela. O edital pode
  chegar por fora da escolha (o endereço, a faixa das etapas, a página do
  edital) antes de a lista carregar, ou não estar nela (a Classificação só
  lista os editais com análise curricular ou lista gerada). A tela nunca
  mostra o id: enquanto a lista carrega, "Carregando…"; fora dela, "Edital
  fora desta lista" (com Trocar). Usado pelo cabeçalho da Classificação, pelo
  seletor de edital (Triagem, Avaliação documental) e pelo das Entrevistas.
*/

export const EDITAL_FORA_DA_LISTA = "Edital fora desta lista";
export const CARREGANDO_O_EDITAL = "Carregando…";

export interface EditalDaLista {
  id?: unknown;
  edital?: string | null;
  unidade?: string | null;
}

export type SituacaoDoEscolhido = "nenhum" | "carregando" | "na-lista" | "fora";

const texto = (valor: unknown) => String(valor ?? "").trim();

/** O edital aberto está na lista da tela? (Sem lista carregada, "carregando".) */
export function situacaoDoEscolhido(
  editais: readonly EditalDaLista[] | null | undefined,
  id: unknown,
  carregado: boolean,
): SituacaoDoEscolhido {
  const escolhido = texto(id);
  if (!escolhido) return "nenhum";
  if ((editais || []).some((ed) => texto(ed?.id) === escolhido))
    return "na-lista";
  return carregado ? "fora" : "carregando";
}

/** "03/2025 · DSEI Alto Rio Solimões", "Carregando…", "Edital fora desta lista" ou "". */
export function rotuloDoEscolhido(
  editais: readonly EditalDaLista[] | null | undefined,
  id: unknown,
  carregado: boolean,
): string {
  const situacao = situacaoDoEscolhido(editais, id, carregado);
  if (situacao === "nenhum") return "";
  if (situacao === "carregando") return CARREGANDO_O_EDITAL;
  if (situacao === "fora") return EDITAL_FORA_DA_LISTA;
  const ed = (editais || []).find((item) => texto(item?.id) === texto(id));
  return (
    [texto(ed?.edital), texto(ed?.unidade)].filter(Boolean).join(" · ") ||
    "Edital"
  );
}
