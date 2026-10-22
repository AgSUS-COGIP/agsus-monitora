import { useEffect, useState } from "react";
import {
  erroDoMotivo,
  lerTrava,
  mensagemDoErroDaTrava,
  mostrarTrava,
  MOTIVO_DA_TRAVA,
  RPC_ALTERAR_CONGELAMENTO,
  RPC_OBTER_CONGELAMENTO,
  textoDoEvento,
  type TravaDasInscricoes as Trava,
} from "../../lib/avaliacao-documental/trava-das-inscricoes.ts";
import { Aviso, Campo, Selo } from "../../ui/index.js";

/*
  Cartão "Inscrições congeladas" da aba Pré-classificação (migration
  20261020170000): mostra se a trava do edital está ligada (quem, quando e o
  motivo) e, para a coordenação da avaliação do edital ou o administrador
  global, Congelar / Liberar com motivo. Liberado e sem permissão, o cartão
  não aparece. Banco sem a migration: não aparece. Regras em
  src/lib/avaliacao-documental/trava-das-inscricoes.ts; explicação na Aya
  ("Inscrições congeladas", docs/aya/regras-da-avaliacao-documental.md).
*/

type Rpc = (
  nome: string,
  argumentos: Record<string, unknown>,
) => Promise<unknown>;

const diaEMes = (d: Date | null) =>
  d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "";

export function TravaDasInscricoes({
  editalId,
  rpc,
}: {
  editalId: string;
  rpc: Rpc | null | undefined;
}) {
  const [trava, setTrava] = useState<Trava | null>(null);
  const [abrir, setAbrir] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let vivo = true;
    setTrava(null);
    setAbrir(false);
    setMotivo("");
    setErro("");
    if (!rpc || !editalId) return undefined;
    rpc(RPC_OBTER_CONGELAMENTO, { p_edital: editalId })
      .then((r) => {
        if (vivo) setTrava(lerTrava(r));
      })
      .catch(() => {
        if (vivo) setTrava(null);
      });
    return () => {
      vivo = false;
    };
  }, [rpc, editalId]);

  if (!mostrarTrava(trava) || !trava) return null;
  const congelar = !trava.congelado;
  const erroDoCampo = motivo.trim() ? erroDoMotivo(motivo) : "";

  async function confirmar() {
    if (!rpc || erroDoMotivo(motivo)) return;
    setEnviando(true);
    setErro("");
    try {
      const r = await rpc(RPC_ALTERAR_CONGELAMENTO, {
        p_edital: editalId,
        p_congelar: congelar,
        p_motivo: motivo.trim(),
      });
      setTrava(lerTrava(r));
      setAbrir(false);
      setMotivo("");
    } catch (e) {
      setErro(mensagemDoErroDaTrava(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section
      className="ui-card avd-trava"
      aria-label="Inscrições congeladas"
      data-trava={trava.congelado ? "congelada" : "liberada"}
    >
      <div className="avd-inline">
        {trava.congelado ? (
          <>
            <Selo tom="reprovado" titulo={trava.motivo || undefined}>
              <i className="fa-solid fa-lock" aria-hidden="true" /> Inscrições
              congeladas
            </Selo>
            <span className="ui-texto-secundario" data-trava-desde>
              {[
                trava.em ? `desde ${diaEMes(trava.em)}` : "",
                trava.por ? `por ${trava.por}` : "",
              ]
                .filter(Boolean)
                .join(" ")}
              {trava.motivo ? ` · ${trava.motivo}` : ""}
            </span>
          </>
        ) : null}
        {trava.podeAlterar && !abrir ? (
          <button
            type="button"
            className="btn secondary small"
            data-acao={congelar ? "abrir-congelar" : "abrir-liberar"}
            onClick={() => setAbrir(true)}
          >
            <i
              className={`fa-solid ${congelar ? "fa-lock" : "fa-lock-open"}`}
              aria-hidden="true"
            />{" "}
            {congelar ? "Congelar inscrições" : "Liberar inscrições"}
          </button>
        ) : null}
      </div>

      {abrir ? (
        <div className="avd-trava-form">
          <Aviso tom="warning">
            {congelar
              ? "O robô da Empregare e a pré-classificação deixam de mexer neste edital (inscrições e lote). O Só anexos só compara, salvo com a liberação do administrador global."
              : "O robô da Empregare e a pré-classificação voltam a atualizar inscrições e lote deste edital."}
          </Aviso>
          <Campo
            rotulo={congelar ? "Motivo para congelar" : "Motivo para liberar"}
            erro={erroDoCampo}
          >
            <input
              type="text"
              maxLength={MOTIVO_DA_TRAVA.max}
              value={motivo}
              data-campo="motivo-da-trava"
              onChange={(ev) => setMotivo(ev.target.value)}
            />
          </Campo>
          <div className="avd-inline">
            <button
              type="button"
              className="btn primary small"
              data-acao={congelar ? "congelar" : "liberar"}
              disabled={enviando || Boolean(erroDoMotivo(motivo))}
              onClick={() => void confirmar()}
            >
              {enviando
                ? "Gravando…"
                : congelar
                  ? "Congelar inscrições"
                  : "Liberar inscrições"}
            </button>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => {
                setAbrir(false);
                setMotivo("");
                setErro("");
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}

      {trava.historico.length ? (
        <details className="avd-trava-historico">
          <summary>Histórico ({trava.historico.length})</summary>
          <ul>
            {trava.historico.map((h, i) => (
              <li key={`${h.tipo}-${i}`}>{textoDoEvento(h)}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
