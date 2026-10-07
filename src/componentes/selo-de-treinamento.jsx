import {
  ROTULO_DO_TREINAMENTO,
  ehEditalDeTreinamento,
} from "../lib/edital-de-treinamento.js";
import { Selo } from "../ui/index.js";

/*
  O selo "Treinamento" do edital de treinamento (src/lib/edital-de-treinamento.js):
  no seletor e no topo das telas operacionais e na tabela de Editais. Edital
  real: nada.
*/
export function SeloDeTreinamento({ edital, className }) {
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
