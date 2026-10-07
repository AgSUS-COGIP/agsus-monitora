/* Casos de contrato, compilados por typecheck:frontend; não executam React. */
import { Aviso } from "../../src/ui/aviso.tsx";
import { BotaoDeAcao } from "../../src/ui/botao-de-acao.tsx";
import type { EstadoDaAcao } from "../../src/ui/botao-de-acao.tsx";

const estado: EstadoDaAcao<"salvar" | "apagar"> = {
  assinar: () => () => {},
  obter: () => ({ acao: { tipo: "salvar", rotulo: "Salvando…" } }),
};

<Aviso tom="danger" papel="alert" como="p">
  Falhou
</Aviso>;
<BotaoDeAcao
  estado={estado}
  acao="salvar"
  onClick={(evento) => evento.currentTarget.focus()}
>
  Salvar
</BotaoDeAcao>;
<BotaoDeAcao estado={estado} acao="apagar" soIcone aria-label="Apagar" />;

// @ts-expect-error — não deve aceitar uma ação que não existe neste store.
<BotaoDeAcao estado={estado} acao="publicar" />;
const acaoSemRotulo: EstadoDaAcao = {
  assinar: () => () => {},
  // @ts-expect-error — o rótulo exibido durante a ação é obrigatório.
  obter: () => ({ acao: { tipo: "salvar" } }),
};
// @ts-expect-error — disabled segue o contrato do botão HTML.
<BotaoDeAcao estado={estado} acao="salvar" disabled="sim" />;
// @ts-expect-error — os tons correspondem aos estilos existentes.
<Aviso tom="success" />;
// @ts-expect-error — o aviso tem semântica de bloco ou parágrafo.
<Aviso como="button" />;
