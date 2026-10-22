import {
  marcouOutroMotivo,
  MINIMO_DO_MOTIVO_LIVRE,
  OUTRO_MOTIVO,
  TAMANHO_DA_OBSERVACAO,
} from "../../../lib/avaliacao-documental/ficha.js";
import type { Lancado, Mudar, Opcao } from "./tipos.ts";

/*
  Os dois textos que todo item da ficha tem do mesmo jeito:
  - "Outro motivo (descrever)": a última opção dos motivos (Não confere, Não
    enviou) e das justificativas da nota (Editar nota, Confirmar com
    diferença). Marcada, o campo obrigatório aparece e o texto (motivo_livre)
    VALE como o motivo: satisfaz a pendência e entra no parecer com o item do
    edital do bloco (pontuacao.js). Desmarcada, o texto sai.
  - "Observação do avaliador": opcional, no fim do card, em qualquer cargo e
    situação (inclusive Não se aplica). Vai para "Observações da análise"
    como o avaliador escreveu, sem o item do edital (observacoesDosItens).
*/

/** A opção "Outro motivo (descrever)", depois dos motivos da regra. */
export const OPCAO_OUTRO_MOTIVO: Opcao = {
  codigo: OUTRO_MOTIVO,
  texto: "Outro motivo (descrever)",
};

/* Uma linha só: o parecer lista uma observação por linha. */
const umaLinha = (texto: string) => texto.replace(/\s*\n\s*/g, " ");

/** Os campos do bloco para a nova lista de códigos (sem o "Outro", sem o texto). */
export function comOutroMotivo(
  campo: "motivos" | "justificativas",
  codigos: string[],
  lancado: Lancado,
): Lancado {
  return {
    [campo]: codigos,
    ...(!marcouOutroMotivo(codigos) && lancado.motivo_livre
      ? { motivo_livre: "" }
      : {}),
  };
}

/** O texto do "Outro motivo" marcado (ou o motivo do bloco sem motivos na regra). */
export function MotivoEscrito({
  codigo,
  rotulo = "Descreva o motivo",
  lancado,
  desabilitado,
  aoMudar,
}: {
  codigo: string;
  rotulo?: string;
  lancado: Lancado;
  desabilitado: boolean;
  aoMudar: (campos: Lancado) => void;
}) {
  const valor = lancado.motivo_livre || "";
  const curto = valor.trim().length < MINIMO_DO_MOTIVO_LIVRE;
  const id = `avdMotivoEscrito-${codigo}`;
  return (
    <div className="avd-ficha-campo avd-ficha-motivo-escrito">
      <label className="avd-ficha-rotulo" htmlFor={id}>
        {rotulo} ({MINIMO_DO_MOTIVO_LIVRE} caracteres ou mais)
      </label>
      <input
        id={id}
        value={valor}
        maxLength={TAMANHO_DA_OBSERVACAO}
        required
        aria-invalid={curto ? true : undefined}
        disabled={desabilitado}
        onChange={(ev) => aoMudar({ motivo_livre: umaLinha(ev.target.value) })}
      />
    </div>
  );
}

/** "Observação do avaliador" (opcional), sempre no fim do card do item. */
export function ObservacaoDoItem({
  codigo,
  lancado,
  desabilitado,
  mudar,
}: {
  codigo: string;
  lancado: Lancado;
  desabilitado: boolean;
  mudar: Mudar;
}) {
  const valor = lancado.observacao || "";
  // Só leitura e vazia: nada a mostrar.
  if (desabilitado && !valor.trim()) return null;
  const id = `avdObservacao-${codigo}`;
  return (
    <div
      className="avd-ficha-campo avd-ficha-observacao-do-item"
      data-tour="avd-ficha-observacao-do-item"
    >
      <label className="avd-ficha-rotulo" htmlFor={id}>
        Observação do avaliador (opcional)
      </label>
      <textarea
        id={id}
        rows={2}
        value={valor}
        maxLength={TAMANHO_DA_OBSERVACAO}
        disabled={desabilitado}
        onChange={(ev) => {
          const observacao = umaLinha(ev.target.value);
          mudar((l) => {
            l.blocos = {
              ...l.blocos,
              [codigo]: { ...(l.blocos?.[codigo] || {}), observacao },
            };
            return l;
          });
        }}
      />
    </div>
  );
}
