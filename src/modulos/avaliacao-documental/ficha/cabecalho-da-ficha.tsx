import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Popover } from "../../../ui/index.js";

/*
  O cabeçalho do modo de análise: "← Voltar à fila", o nome do candidato
  grande com o código, uma linha discreta com a vaga (código · cargo · nível)
  e chips só com o essencial (nota declarada, posição, modalidade). Situação,
  responsável, reserva e regra ficam no "i"; a reserva só aparece quando faltam
  menos de 5 minutos. À direita, Anterior / Próxima entre as fichas da lista.
  Os filhos (o stepper) ficam embaixo, no mesmo bloco preso ao alto.
*/

export type FichaVizinha = { id: string; codigo: string } | null;

export type PropriedadesDoCabecalho = {
  codigo: string;
  nome?: string | null;
  vaga: string;
  cargo?: string | null;
  /** O rótulo do nível da vaga ("Superior"), quando a ficha já carregou. */
  nivel?: string | null;
  /** Nota declarada (ART) já formatada; null sem nota. */
  declarada?: string | null;
  dicaDaDeclarada?: string;
  posicao?: string | null;
  modalidade?: string | null;
  /** O que fica no "i": [rótulo, valor]. */
  informacoes: { rotulo: string; valor: ReactNode }[];
  /** Fim da reserva de quem está com a ficha (para o aviso dos 5 minutos). */
  fimDaMinhaReserva?: string | null;
  /** O selo da decisão da coordenação (e o "Revogar"), se houver. */
  decisao?: ReactNode;
  voltar: () => void;
  navegacao: {
    posicao: number;
    total: number;
    anterior: FichaVizinha;
    proxima: FichaVizinha;
    abrindo: boolean;
    ir: (id: string | undefined) => void;
  };
  children?: ReactNode;
};

const CINCO_MINUTOS = 5 * 60 * 1000;

/* Minutos que faltam na reserva, quando faltam menos de 5 (senão null). Relê a cada 20 s. */
function usarReservaAcabando(fim: string | null | undefined): number | null {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!fim) return undefined;
    const id = setInterval(() => setAgora(Date.now()), 20000);
    return () => clearInterval(id);
  }, [fim]);
  if (!fim) return null;
  const resta = new Date(fim).getTime() - agora;
  if (!Number.isFinite(resta) || resta <= 0 || resta >= CINCO_MINUTOS)
    return null;
  return Math.max(1, Math.ceil(resta / 60000));
}

export function CabecalhoDaFicha({
  codigo,
  nome,
  vaga,
  cargo,
  nivel,
  declarada,
  dicaDaDeclarada,
  posicao,
  modalidade,
  informacoes,
  fimDaMinhaReserva,
  decisao,
  voltar,
  navegacao,
  children,
}: PropriedadesDoCabecalho) {
  const minutos = usarReservaAcabando(fimDaMinhaReserva);
  const { anterior, proxima, abrindo, ir } = navegacao;
  return (
    <header className="avd-analise-topo" data-tour="avd-ficha-topo">
      <div className="avd-analise-linha">
        <button
          type="button"
          className="avd-analise-voltar"
          data-acao="voltar-a-fila"
          title="Voltar à fila (Esc)"
          onClick={() => void voltar()}
        >
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
          <span>Voltar à fila</span>
        </button>
        <div className="avd-analise-identidade">
          <h2 id="avdFichaTitulo">
            <span className="avd-analise-nome">
              {nome || `Candidato ${codigo}`}
            </span>
            <span className="avd-analise-codigo">Código {codigo}</span>
          </h2>
          <div className="avd-analise-subtitulo">
            <span
              className="avd-analise-vaga"
              title={[vaga, cargo, nivel].filter(Boolean).join(" · ")}
            >
              {[vaga, cargo, nivel].filter(Boolean).join(" · ")}
            </span>
            <span className="avd-analise-dados" aria-label="Cabeçalho da ficha">
              {declarada ? (
                <span className="avd-chip" title={dicaDaDeclarada}>
                  Declarada <strong>{declarada}</strong>
                </span>
              ) : null}
              {posicao ? (
                <span className="avd-chip" title="Posição na Provisória">
                  {posicao}
                </span>
              ) : null}
              {modalidade ? (
                <span className="avd-chip" title="Modalidade">
                  {modalidade}
                </span>
              ) : null}
              {minutos !== null ? (
                <span className="avd-chip avd-chip-alerta" role="status">
                  <i className="fa-solid fa-clock" aria-hidden="true" /> Reserva
                  acaba em {minutos} min
                </span>
              ) : null}
              <Popover
                rotulo="Informações da ficha"
                gatilho={
                  <i className="fa-solid fa-circle-info" aria-hidden="true" />
                }
                lado="esquerda"
                acao="informacoes-da-ficha"
                tour="avd-ficha-informacoes"
              >
                <dl className="avd-analise-informacoes">
                  {informacoes.map((i) => (
                    <div key={i.rotulo}>
                      <dt>{i.rotulo}</dt>
                      <dd>{i.valor}</dd>
                    </div>
                  ))}
                </dl>
              </Popover>
            </span>
            {decisao}
          </div>
        </div>
        <nav className="avd-analise-navegacao" aria-label="Fichas da lista">
          <button
            type="button"
            className="avd-analise-seta"
            data-acao="ficha-anterior"
            aria-label="Ficha anterior"
            disabled={!anterior || abrindo}
            title={
              anterior
                ? `Ficha anterior: candidato ${anterior.codigo}`
                : undefined
            }
            onClick={() => void ir(anterior?.id)}
          >
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          </button>
          {navegacao.posicao >= 0 ? (
            <span className="avd-analise-contador">
              {navegacao.posicao + 1} de {navegacao.total}
            </span>
          ) : null}
          <button
            type="button"
            className="avd-analise-seta"
            data-acao="ficha-proxima"
            aria-label="Próxima ficha"
            disabled={!proxima || abrindo}
            title={
              proxima ? `Próxima ficha: candidato ${proxima.codigo}` : undefined
            }
            onClick={() => void ir(proxima?.id)}
          >
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </button>
        </nav>
      </div>
      {children}
    </header>
  );
}
