import { useState } from "react";
import {
  resumoDaImportacao,
  type PreviaDaImportacao,
  type ResumoDaImportacao,
} from "../../lib/avaliacao-documental/importacao-da-planilha.ts";
import {
  Aviso,
  Campo,
  CarregandoConteudo,
  FecharModal,
} from "../../ui/index.ts";
import { ModalInstitucional } from "../../ui/modal-institucional.tsx";

/*
  O dono da avaliação documental do edital, ao lado do seletor: "Avaliação:
  Planilha" ou "Avaliação: MONITORA". A coordenação da avaliação do edital (e o
  administrador global) troca o dono com confirmação e motivo (RPC
  definir_origem_analise, migration 20261009200000): no MONITORA, as fichas
  alimentam o Painel das análises e a Classificação, e a planilha deixa de
  mexer no edital. A explicação longa fica com a AYA ("análise no MONITORA").

  Edital que a planilha já decidiu (16/11/2026, fase F8): a janela mostra a
  prévia (previa_importacao_da_planilha) e a troca vira a importação
  (importar_avaliacao_da_planilha): as análises decididas viram fichas
  concluídas com o resultado da planilha.
*/

export const ORIGENS_DA_ANALISE: Readonly<Record<string, string>> =
  Object.freeze({
    PLANILHA: "Planilha",
    COMPARACAO: "Comparação",
    MONITORA: "Yeendé",
  });

export type RespostaDaTroca = { ok: boolean; erro?: string };
export type RespostaDaPrevia =
  { ok: true; previa: PreviaDaImportacao } | { ok: false; erro: string };

/** Para onde o botão leva: MONITORA a partir da planilha (ou da comparação); a planilha a partir do MONITORA. */
export function destinoDaTroca(origem: string) {
  return origem === "MONITORA" ? "PLANILHA" : "MONITORA";
}

const ROTULO_DO_BOTAO: Readonly<Record<string, string>> = Object.freeze({
  MONITORA: "Analisar no Yeendé",
  PLANILHA: "Voltar para a planilha",
});

const TITULO_DA_IMPORTACAO = "Importar da planilha e analisar no Yeendé";

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
  aoPrever,
  aoImportar,
}: {
  origem: string;
  rotuloDoPapel?: string;
  podeTrocar?: boolean;
  aoTrocar: (origem: string, motivo: string) => Promise<RespostaDaTroca>;
  /** A prévia da importação; sem ela, a troca é sempre a simples. */
  aoPrever?: () => Promise<RespostaDaPrevia>;
  aoImportar?: (motivo: string) => Promise<RespostaDaTroca>;
}) {
  const [aberta, setAberta] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [gravando, setGravando] = useState(false);
  // A prévia da importação: undefined = ainda lendo; null = não se aplica.
  const [resumo, setResumo] = useState<ResumoDaImportacao | null | undefined>(
    null,
  );
  const destino = destinoDaTroca(origem);
  const motivoOk = motivo.trim().length >= 10;
  const importa = Boolean(resumo?.importa && aoImportar);

  async function abrir() {
    setAberta(true);
    if (destino !== "MONITORA" || !aoPrever || !aoImportar) return;
    setResumo(undefined);
    const r = await aoPrever();
    if (r.ok) setResumo(resumoDaImportacao(r.previa));
    else {
      setResumo(null);
      setErro(r.erro);
    }
  }

  function fechar() {
    if (gravando) return;
    setAberta(false);
    setMotivo("");
    setErro("");
    setResumo(null);
  }

  async function confirmar() {
    setErro("");
    setGravando(true);
    const r =
      importa && aoImportar
        ? await aoImportar(motivo.trim())
        : await aoTrocar(destino, motivo.trim());
    setGravando(false);
    if (r.ok) {
      setAberta(false);
      setMotivo("");
      setResumo(null);
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
            onClick={() => void abrir()}
          >
            {ROTULO_DO_BOTAO[destino]}
          </button>
        </>
      ) : null}
      {aberta ? (
        <ModalInstitucional
          tituloId="avdOrigemTitulo"
          titulo={
            importa
              ? TITULO_DA_IMPORTACAO
              : (ROTULO_DO_BOTAO[destino] ?? "Alterar origem da análise")
          }
          contexto="Avaliação documental · Configuração do edital"
          descricao="Confirme a alteração da origem da análise e registre sua justificativa."
          icone="fa-shield-halved"
          aoFechar={fechar}
          alterado={motivo.trim() !== ""}
          fecharDesabilitado={gravando}
          infoRodape="A alteração é registrada no histórico do edital."
          acoes={
            <>
              <FecharModal className="btn secondary" disabled={gravando}>
                Cancelar
              </FecharModal>
              <button
                type="button"
                className="btn primary"
                data-acao="confirmar-origem-da-analise"
                disabled={
                  !motivoOk ||
                  gravando ||
                  resumo === undefined ||
                  (importa && !resumo?.pode)
                }
                onClick={() => void confirmar()}
              >
                {gravando
                  ? "Gravando…"
                  : importa
                    ? "Importar e passar para o Yeendé"
                    : "Confirmar alteração"}
              </button>
            </>
          }
        >
          {resumo === undefined ? (
            <CarregandoConteudo rotulo="Conferindo as análises da planilha…" />
          ) : importa && resumo ? (
            <>
              <Aviso tom="warning">
                A planilha já decidiu análises deste edital. Elas serão
                importadas como fichas concluídas, e a planilha deixa de alterar
                o edital.
              </Aviso>
              <ul className="avd-importacao-lista" data-importacao="previa">
                {resumo.linhas.map((linha) => (
                  <li key={linha}>{linha}</li>
                ))}
              </ul>
              {resumo.problemas.length ? (
                <Aviso tom="danger" papel="alert">
                  Antes de importar, resolva:
                  <ul className="avd-importacao-lista">
                    {resumo.problemas.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </Aviso>
              ) : null}
            </>
          ) : (
            <Aviso tom="warning">{AVISO_DA_TROCA[destino]}</Aviso>
          )}
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
        </ModalInstitucional>
      ) : null}
    </span>
  );
}
