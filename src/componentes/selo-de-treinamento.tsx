import {
  ROTULO_DO_TREINAMENTO,
  ehEditalDeTreinamento,
} from "../lib/edital-de-treinamento.ts";
import { Selo } from "../ui/index.ts";

/*
  O selo "Treinamento" do edital de treinamento (src/lib/edital-de-treinamento.ts):
  no seletor e no topo das telas operacionais e na tabela de Editais. Edital
  real: nada.
*/
export interface PropriedadesDoSeloDeTreinamento {
  /** A linha do monitoramento ou o item de RPC do edital (pode faltar). */
  edital: unknown;
  className?: string;
}

export function SeloDeTreinamento({
  edital,
  className,
}: PropriedadesDoSeloDeTreinamento) {
  if (!ehEditalDeTreinamento(edital)) return null;
  return (
    <Selo
      tom="pendente"
      titulo="Dados fictícios, sem valor oficial"
      className={["selo-de-treinamento", className].filter(Boolean).join(" ")}
    >
      {ROTULO_DO_TREINAMENTO}
    </Selo>
  );
}
