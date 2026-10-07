/*
  O edital de treinamento (migration 20261007230000): dados fictícios para
  testar Entrevistas, Avaliação documental e Classificação sem tocar em dado
  real. Fica FORA da Visão geral, dos indicadores, dos painéis e dos robôs no
  modo padrão; APARECE nas telas operacionais com o selo "Treinamento".

  Um lugar só para reconhecer o edital (o banco faz o mesmo com
  private."FC_EH_TREINAMENTO"): a linha do monitoramento traz
  "ST_TREINAMENTO" = 'S'; as RPCs das telas trazem `treinamento: true`.
*/

export const ROTULO_DO_TREINAMENTO = "Treinamento";
export const MARCA_SEM_VALOR_OFICIAL = "TREINAMENTO — SEM VALOR OFICIAL";

/** O edital (linha do monitoramento ou item de RPC) é de treinamento? */
export function ehEditalDeTreinamento(edital) {
  if (!edital || typeof edital !== "object") return false;
  if (edital.treinamento === true) return true;
  const marca = edital.ST_TREINAMENTO ?? edital.st_treinamento;
  return String(marca ?? "").toUpperCase() === "S";
}

/** As linhas sem os editais de treinamento (indicadores, mapas, painéis). */
export function semTreinamento(linhas) {
  const lista = Array.isArray(linhas) ? linhas : [];
  return lista.some(ehEditalDeTreinamento)
    ? lista.filter((linha) => !ehEditalDeTreinamento(linha))
    : lista;
}

/** O sufixo do edital no `<option>` do seletor (o `<option>` não leva selo). */
export function sufixoDeTreinamento(edital) {
  return ehEditalDeTreinamento(edital) ? ` · ${ROTULO_DO_TREINAMENTO}` : "";
}

/** O edital escolhido na lista (para o selo no topo da tela). */
export function editalEscolhido(editais, id) {
  if (!id) return null;
  return (
    (Array.isArray(editais) ? editais : []).find(
      (e) => String(e?.id) === String(id),
    ) || null
  );
}
