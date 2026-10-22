import { useState } from "react";
import {
  MOTIVO_OUTRO,
  MOTIVOS_DA_REABERTURA,
  validarReabertura,
} from "../../../lib/avaliacao-documental/motivos-da-reabertura.ts";
import { Campo } from "../../../ui/index.js";

/*
  O "Reabrir" da coordenação no rodapé da ficha concluída ou em revisão: o motivo numa
  lista fixa (motivos-da-reabertura.ts), o complemento opcional e, em
  "Outro", a descrição obrigatória. O banco confere o mesmo em reabrir_ficha
  (20261021110000).
*/

export type ResultadoDaReabertura = { ok: boolean; erro?: string };
export type LojaQueReabre = {
  reabrir: (
    motivo: string,
    complemento: string | null,
    texto: string,
  ) => Promise<ResultadoDaReabertura>;
};

export function ReabrirAFicha({ loja }: { loja: LojaQueReabre }) {
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [complemento, setComplemento] = useState("");
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  if (!aberto)
    return (
      <button
        type="button"
        className="btn secondary"
        data-tour="avd-ficha-reabrir"
        onClick={() => setAberto(true)}
      >
        Reabrir
      </button>
    );
  const validacao = validarReabertura(codigo, complemento);
  const outro = codigo === MOTIVO_OUTRO;
  // O erro do motivo só depois de tentar; o do texto assim que há texto.
  const erroDoMotivo =
    !validacao.ok && validacao.campo === "motivo" && tentou
      ? validacao.erro
      : "";
  const erroDoComplemento =
    !validacao.ok &&
    validacao.campo === "complemento" &&
    (tentou || complemento.trim())
      ? validacao.erro
      : "";

  async function confirmar() {
    setTentou(true);
    setErro("");
    if (!validacao.ok) return;
    // Um envio só: o segundo clique daria "a ficha mudou" (PT409).
    setEnviando(true);
    const r = await loja.reabrir(
      validacao.argumentos.p_motivo,
      validacao.argumentos.p_complemento,
      validacao.texto,
    );
    setEnviando(false);
    if (!r.ok) setErro(r.erro || "Não foi possível reabrir.");
  }

  return (
    <div className="avd-inline" data-acao="reabrir-motivo">
      <Campo rotulo="Motivo da reabertura" obrigatorio erro={erroDoMotivo}>
        <select
          value={codigo}
          onChange={(ev) => setCodigo(ev.target.value)}
          data-campo="motivo-da-reabertura"
        >
          <option value="">Escolha o motivo</option>
          {MOTIVOS_DA_REABERTURA.map((m) => (
            <option key={m.codigo} value={m.codigo}>
              {m.rotulo}
            </option>
          ))}
        </select>
      </Campo>
      <Campo
        rotulo={outro ? "Descreva o motivo" : "Complemento"}
        obrigatorio={outro}
        erro={erroDoComplemento || erro}
      >
        <input
          value={complemento}
          maxLength={500}
          onChange={(ev) => setComplemento(ev.target.value)}
          data-campo="complemento-da-reabertura"
        />
      </Campo>
      <button
        type="button"
        className="btn small"
        data-acao="confirmar-reabrir"
        disabled={enviando}
        onClick={confirmar}
      >
        Reabrir
      </button>
      <button
        type="button"
        className="btn small ghost"
        disabled={enviando}
        onClick={() => {
          setAberto(false);
          setTentou(false);
          setErro("");
        }}
      >
        Cancelar
      </button>
    </div>
  );
}
