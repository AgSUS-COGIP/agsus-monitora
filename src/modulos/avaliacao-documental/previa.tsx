import { lazy, Suspense, useState } from "react";
import { importarComRecarga } from "../../lib/importar-com-recarga.js";
import type { RegraAnalise } from "../../lib/avaliacao-documental/tipos-da-regra.ts";

/*
  "Testar com um candidato fictício": a conta pura de
  src/lib/avaliacao-documental/pontuacao.js sobre o rascunho da regra, na
  hora e sem gravar nada. A nota mínima é a da regra de classificação do
  edital; sem ela, vale a que for digitada aqui (só na prévia). A conta
  oficial em lote (Provisória, lote) é da base Python, na fase F2.

  Fechada por padrão: o corpo (corpo-da-previa.tsx — entradas à esquerda,
  resultado preso à direita) só carrega ao abrir, fora do pacote principal.
  O candidato fica aqui, e sobrevive a fechar e abrir.
*/

type Situacao = string;
export type Lancado = { situacao?: Situacao; motivos?: string[] };
type Titulo = { titulo: string; aceito?: boolean };
type Curso = { horas: number | string | null; aceito?: boolean };
type Vinculo = {
  categoria: string;
  inicio: string;
  fim: string;
  aceito?: boolean;
};
export type Candidato = {
  nivel: string;
  modalidade: string;
  indigena: boolean;
  mora_aldeia: boolean;
  aldeia_na_lista: boolean;
  blocos: Record<string, Lancado>;
  titulos: Titulo[];
  cursos: Curso[];
  vinculos: Vinculo[];
  estagio_horas: number | null;
  observacoes: string;
  observacoes_prontas: string[];
};
type Resultado = {
  resultado: string;
  nota_final: number;
  nota_minima: number | null;
  parciais: Record<string, number | undefined>;
  parecer: string;
};
export type NotaMinima = {
  nota_minima?: number | null;
  nota_minima_por_nivel?: Partial<Record<string, number | null>>;
} | null;

export const CANDIDATO_INICIAL: Candidato = Object.freeze({
  nivel: "superior",
  modalidade: "AC",
  indigena: false,
  mora_aldeia: false,
  aldeia_na_lista: false,
  blocos: {},
  titulos: [],
  cursos: [],
  vinculos: [],
  estagio_horas: 0,
  observacoes: "",
  observacoes_prontas: [],
}) as Candidato;

// Versão nova publicada com a página aberta: recarrega em vez de quebrar.
const CorpoDaPrevia = lazy(
  importarComRecarga(() => import("./corpo-da-previa.tsx")),
);

export function Previa({
  regra,
  notaMinima,
}: {
  regra: RegraAnalise;
  notaMinima?: NotaMinima | undefined;
}) {
  const [aberta, setAberta] = useState(false);
  const [c, setC] = useState<Candidato>(CANDIDATO_INICIAL);
  const [minimaDigitada, setMinimaDigitada] = useState<number | null>(null);
  return (
    <section className="ui-card avd-previa" aria-labelledby="avdPrevia">
      <div className="avd-bloco-topo">
        <h2 className="ui-titulo" id="avdPrevia">
          Testar com um candidato fictício
        </h2>
        <button
          type="button"
          className="btn secondary small"
          aria-expanded={aberta}
          onClick={() => setAberta(!aberta)}
        >
          <i
            className={`fa-solid ${aberta ? "fa-chevron-up" : "fa-chevron-down"}`}
            aria-hidden="true"
          />{" "}
          {aberta ? "Fechar" : "Abrir"}
        </button>
      </div>
      {aberta ? (
        <Suspense
          fallback={
            <p className="ui-texto-secundario" role="status">
              Carregando…
            </p>
          }
        >
          <CorpoDaPrevia
            regra={regra}
            notaMinima={notaMinima ?? null}
            candidato={c}
            aoMudarCandidato={setC}
            minimaDigitada={minimaDigitada}
            aoMudarMinima={setMinimaDigitada}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
