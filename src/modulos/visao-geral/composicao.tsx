import type { Composicao } from "../../lib/visao-geral/composicao-dos-numeros.ts";
import { formatNumberBR } from "../../lib/base/formatters";

/*
  As parcelas de um número (src/lib/visao-geral/composicao-dos-numeros.ts),
  no painel que abre ao clicar nele, na tabela ou na faixa das vagas: a base,
  o que soma (+) ou tira (−) e o resultado (=), em destaque. Uma lista de
  termos (`dl`): "Além das vagas imediatas: + 3", como uma conta armada.
*/
export function ComposicaoDoNumero({ passos }: { passos: Composicao }) {
  return (
    <dl className="visao-geral-composicao">
      {passos.map(({ operacao, rotulo, valor }, i) => (
        <div
          key={`${i}-${rotulo}`}
          className="visao-geral-composicao-passo"
          data-operacao={operacao || "base"}
        >
          <dt>{rotulo}</dt>
          <dd>
            {operacao ? `${operacao} ` : ""}
            {formatNumberBR(valor)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
