import { classes } from "./classes.ts";
import { Selo } from "./selo.tsx";
import {
  ROTULO_DA_FAIXA,
  situacaoDoPrazo,
  textoDosDiasRestantes,
} from "../lib/base/prazos.ts";
import type { FaixaDoPrazo } from "../lib/base/prazos.ts";

/*
  Selo de prazo: quanto falta para `data` ("Vence em 12 dias", "Venceu há 3
  dias") com o tom da faixa (src/lib/base/prazos.ts): vencido em perigo,
  menos de 30 dias em alerta, menos de 90 em info, o resto neutro. A cor só
  complementa: o texto diz a situação e o `title` diz a faixa e o dia.
  Sem data, nada. `hoje` é "aaaa-mm-dd" (o dia de Brasília de quem usa).

  Marcação: `.ui-selo.ui-selo-de-prazo[data-tom][data-faixa]`.
*/
const TOM_DA_FAIXA: Readonly<Record<FaixaDoPrazo, string>> = Object.freeze({
  vencido: "reprovado",
  "ate-30": "pendente",
  "ate-90": "revisar",
  "ate-180": "neutro",
  depois: "neutro",
});

export interface PropriedadesDoSeloDePrazo {
  data: string | null | undefined;
  hoje: string;
  /** O dia como a tela o mostra ("12/11/2026"), para o `title`. */
  diaFormatado?: string;
  className?: string;
}

export function SeloDePrazo({
  data,
  hoje,
  diaFormatado,
  className,
}: PropriedadesDoSeloDePrazo) {
  const situacao = situacaoDoPrazo(data, hoje);
  if (!situacao) return null;
  const titulo = [ROTULO_DA_FAIXA[situacao.faixa], diaFormatado]
    .filter(Boolean)
    .join(" · ");
  return (
    <Selo
      tom={TOM_DA_FAIXA[situacao.faixa]}
      titulo={titulo}
      className={classes("ui-selo-de-prazo", className)}
      dados={{ faixa: situacao.faixa }}
    >
      {textoDosDiasRestantes(situacao.dias)}
    </Selo>
  );
}
