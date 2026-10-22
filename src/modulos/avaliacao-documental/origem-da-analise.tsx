import { useState } from "react";
import { Aviso, Campo, Modal } from "../../ui/index.js";

/*
  O dono da avaliação documental do edital, ao lado do seletor: "Avaliação:
  Planilha" ou "Avaliação: MONITORA". A coordenação da avaliação do edital (e o
  administrador global) troca o dono com confirmação e motivo (RPC
  definir_origem_analise, migration 20261009200000): no MONITORA, as fichas
  alimentam o Painel das análises e a Classificação, e a planilha deixa de
  mexer no edital. A explicação longa fica com a AYA ("análise no MONITORA").
*/

export const ORIGENS_DA_ANALISE: Readonly<Record<string, string>> =
  Object.freeze({
    PLANILHA: "Planilha",
    COMPARACAO: "Comparação",
    MONITORA: "MONITORA",
  });

export type RespostaDaTroca = { ok: boolean; erro?: string };

/** Para onde o botão leva: MONITORA a partir da planilha (ou da comparação); a planilha a partir do MONITORA. */
export function destinoDaTroca(origem: string) {
  return origem === "MONITORA" ? "PLANILHA" : "MONITORA";
}

const ROTULO_DO_BOTAO: Readonly<Record<string, string>> = Object.freeze({
  MONITORA: "Analisar no MONITORA",
  PLANILHA: "Voltar para a planilha",
});

const AVISO_DA_TROCA: Readonly<Record<string, string>> = Object.freeze({
  MONITORA:
    "As fichas deste edital passam a alimentar o Painel das análises e a Classificação. A planilha deixa de alterar o edital.",
  PLANILHA:
    "As análises publicadas pelas fichas voltam para a planilha: a próxima sincronização pode alterá-las ou inativá-las.",
});

export function OrigemDaAnalise({
  origem,
  rotuloDoPapel = "",
  podeTrocar = false,
  aoTrocar,
}: {
  origem: string;
  rotuloDoPapel?: string;
  podeTrocar?: boolean;
  aoTrocar: (origem: string, motivo: string) => Promise<RespostaDaTroca>;
}) {
  const [aberta, setAberta] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [gravando, setGravando] = useState(false);
  const destino = destinoDaTroca(origem);
  const motivoOk = motivo.trim().length >= 10;

  function fechar() {
    if (gravando) return;
    setAberta(false);
    setMotivo("");
    setErro("");
  }

  async function confirmar() {
    setErro("");
    setGravando(true);
    const r = await aoTrocar(destino, motivo.trim());
    setGravando(false);
    if (r.ok) {
      setAberta(false);
      setMotivo("");
    } else setErro(r.erro || "Não foi possível trocar.");
  }

  return (
    <span className="ui-texto-secundario" data-origem={origem}>
      Avaliação: {ORIGENS_DA_ANALISE[origem] ?? origem}
      {rotuloDoPapel ? ` · ${rotuloDoPapel}` : ""}
      {podeTrocar ? (
        <>
          {" "}
          <button
            type="button"
            className="btn secondary small"
            data-acao="trocar-origem-da-analise"
            onClick={() => setAberta(true)}
          >
            {ROTULO_DO_BOTAO[destino]}
          </button>
        </>
      ) : null}
      {aberta ? (
        <Modal
          rotuloId="avdOrigemTitulo"
          aoFechar={fechar}
          fecharAoClicarFora={false}
        >
          <h2 id="avdOrigemTitulo">{ROTULO_DO_BOTAO[destino]}</h2>
          <Aviso tom="warning">{AVISO_DA_TROCA[destino]}</Aviso>
          <Campo
            rotulo="Motivo"
            obrigatorio
            erro={motivo && !motivoOk ? "De 10 a 2.000 caracteres." : undefined}
          >
            <textarea
              rows={3}
              maxLength={2000}
              value={motivo}
              data-foco-inicial
              onChange={(ev) => setMotivo(ev.target.value)}
            />
          </Campo>
          {erro ? (
            <Aviso tom="danger" papel="alert">
              {erro}
            </Aviso>
          ) : null}
          <div className="ui-acoes">
            <button
              type="button"
              className="btn secondary"
              onClick={fechar}
              disabled={gravando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn"
              data-acao="confirmar-origem-da-analise"
              disabled={!motivoOk || gravando}
              onClick={() => void confirmar()}
            >
              {gravando ? "Gravando…" : "Confirmar"}
            </button>
          </div>
        </Modal>
      ) : null}
    </span>
  );
}
