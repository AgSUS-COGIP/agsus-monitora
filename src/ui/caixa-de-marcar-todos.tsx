import { useEffect, useRef } from "react";

/*
  A caixa "marcar todos" do cabeçalho das tabelas com seleção (vai em
  `cabecalho` da coluna de marcar da TabelaInfinita). Marca TODOS do recorte
  (busca e filtros), não só as linhas já desenhadas: quem a usa resolve o
  recorte inteiro em `aoMudar`.

  `estado`: "todas" (marcada), "parte" (indeterminada: parte do recorte está
  marcada; clicar marca o resto) ou "nenhuma". `estadoDaMarcacao(marcadas,
  total)` calcula pelo número de marcadas no recorte.
*/

export type EstadoDaMarcacao = "todas" | "parte" | "nenhuma";

export function estadoDaMarcacao(
  marcadas: number,
  total: number,
): EstadoDaMarcacao {
  if (!total || !marcadas) return "nenhuma";
  return marcadas >= total ? "todas" : "parte";
}

export interface PropriedadesDaCaixaDeMarcarTodos {
  /** O aria-label (ex.: "Marcar todos os da busca"). */
  rotulo: string;
  estado: EstadoDaMarcacao;
  /** true marca todos do recorte; false desmarca. */
  aoMudar: (marcar: boolean) => void;
  desabilitada?: boolean;
  /** O data-acao da caixa. */
  acao?: string;
}

export function CaixaDeMarcarTodos({
  rotulo,
  estado,
  aoMudar,
  desabilitada = false,
  acao,
}: PropriedadesDaCaixaDeMarcarTodos) {
  const caixa = useRef<HTMLInputElement>(null);
  const parte = estado === "parte";
  // "indeterminate" só existe como propriedade do elemento, não como atributo.
  useEffect(() => {
    if (caixa.current) caixa.current.indeterminate = parte;
  }, [parte]);
  return (
    <input
      ref={caixa}
      type="checkbox"
      className="ui-marcar-todos"
      aria-label={rotulo}
      aria-checked={parte ? "mixed" : estado === "todas"}
      checked={estado === "todas"}
      disabled={desabilitada}
      data-acao={acao}
      data-estado={estado}
      onChange={() => aoMudar(estado !== "todas")}
    />
  );
}
