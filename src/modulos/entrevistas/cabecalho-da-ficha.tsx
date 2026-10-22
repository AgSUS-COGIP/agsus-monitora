import { rotuloDaVersao } from "../../lib/nome-da-versao.ts";
import { Popover } from "../../ui/popover.tsx";
import { Segmentado } from "../../ui/index.js";
import { numeroBR } from "./resultado-da-ficha.tsx";

/*
  O cabeçalho enxuto da ficha de notas, no desenho da ficha da Avaliação
  documental: voltar, o nome e o código grandes, a vaga numa linha discreta,
  chips (nota da análise, modalidade, roteiro), os detalhes (lançamento,
  gravado, nome do roteiro) num "i"; à direita o comparecimento num controle
  segmentado compacto, a banca (quando há mais de uma) e Anterior / "1 de
  15" / Próximo. Preso no alto ao rolar.
*/

export type Comparecimento = "S" | "N" | null;

export type PropriedadesDoCabecalho = {
  candidato: string;
  codigo?: string | null;
  vaga?: string | null;
  cargo?: string;
  modalidade?: string | null;
  notaDaAnalise?: number | null;
  roteiro: {
    nome?: string;
    versao?: number;
    /** Nome da versão do roteiro (20261008180000). */
    nome_versao?: string | null;
  } | null;
  aspectos: number;
  lancamento: string;
  gravado: { nota: number | null; parecer: string };
  compareceu: Comparecimento;
  podeEditar: boolean;
  salvando: boolean;
  aoMudarComparecimento: (valor: "S" | "N") => void;
  bancas: number[];
  banca: number | null;
  mostrarBanca: boolean;
  aoMudarBanca: (banca: number | null) => void;
  posicao: number;
  total: number;
  anterior: { candidato?: string | null } | null;
  proximo: { candidato?: string | null } | null;
  aoAnterior: () => void;
  aoProximo: () => void;
  aoVoltar: () => void;
};

const COMPARECIMENTO: ReadonlyArray<{
  valor: "S" | "N" | "";
  rotulo: string;
  icone: string;
}> = [
  { valor: "S", rotulo: "Compareceu", icone: "fa-user-check" },
  { valor: "N", rotulo: "Faltou", icone: "fa-user-xmark" },
];

const PARECER: Record<string, string> = {
  APTO: "Apto",
  INAPTO: "Inapto",
  SEM_PARECER: "Sem parecer",
};

export function CabecalhoDaFicha(p: PropriedadesDoCabecalho) {
  const chips = [
    p.notaDaAnalise !== null && p.notaDaAnalise !== undefined
      ? {
          chave: "analise",
          rotulo: "Análise",
          valor: numeroBR(p.notaDaAnalise),
        }
      : null,
    p.modalidade
      ? { chave: "modalidade", rotulo: "", valor: p.modalidade }
      : null,
    p.roteiro
      ? {
          chave: "roteiro",
          rotulo: "Roteiro",
          valor: `${rotuloDaVersao({ versao: p.roteiro.versao, nome: p.roteiro.nome_versao }) || "—"}${p.aspectos ? ` · ${p.aspectos} aspectos` : ""}`,
        }
      : null,
  ].filter((c): c is { chave: string; rotulo: string; valor: string } =>
    Boolean(c),
  );
  const vaga = [p.vaga && `Vaga ${p.vaga}`, p.cargo]
    .filter(Boolean)
    .join(" · ");

  return (
    <header
      className="entrevistas-analise-topo"
      data-tour="entrevistas-ficha-topo"
    >
      <button
        type="button"
        className="entrevistas-voltar"
        data-acao="voltar-a-lista"
        aria-label="Voltar à lista"
        title="Voltar à lista (Esc)"
        onClick={p.aoVoltar}
      >
        <i className="fa-solid fa-arrow-left" aria-hidden="true" />
      </button>
      <div className="entrevistas-analise-identidade">
        <h2 id="entrevistasFichaTitulo">
          {p.candidato}
          {p.codigo ? <span> · {p.codigo}</span> : null}
        </h2>
        {vaga ? <p className="entrevistas-analise-vaga">{vaga}</p> : null}
        <div className="entrevistas-chips">
          {chips.map((c) => (
            <span
              key={c.chave}
              className="entrevistas-chip"
              data-chip={c.chave}
            >
              {c.rotulo ? `${c.rotulo} ` : null}
              <strong>{c.valor}</strong>
            </span>
          ))}
          <Popover
            rotulo="Detalhes da ficha"
            gatilho={<span className="entrevistas-popover-i">i</span>}
            lado="esquerda"
            acao="detalhes-da-ficha"
          >
            <dl className="entrevistas-detalhes">
              <div>
                <dt>Lançamento</dt>
                <dd>{p.lancamento}</dd>
              </div>
              <div>
                <dt>Gravado</dt>
                <dd>
                  {numeroBR(p.gravado.nota)} ·{" "}
                  {PARECER[p.gravado.parecer] || PARECER.SEM_PARECER}
                </dd>
              </div>
              {p.roteiro?.nome ? (
                <div>
                  <dt>Roteiro</dt>
                  <dd>{p.roteiro.nome}</dd>
                </div>
              ) : null}
            </dl>
          </Popover>
        </div>
      </div>
      <div className="entrevistas-analise-controles">
        <Segmentado
          rotulo="Comparecimento"
          className="entrevistas-comparecimento"
          tour="entrevistas-ficha-comparecimento"
          opcoes={COMPARECIMENTO}
          valor={p.compareceu ?? ""}
          desabilitado={!p.podeEditar || p.salvando}
          aoMudar={(valor: "S" | "N" | "") => {
            if (valor) p.aoMudarComparecimento(valor);
          }}
        />
        {p.mostrarBanca ? (
          <label className="entrevistas-ficha-banca">
            <span className="sr-only">Banca</span>
            <select
              id="entrevistasFichaBanca"
              value={p.banca ?? ""}
              disabled={!p.podeEditar || p.salvando}
              onChange={(e) =>
                p.aoMudarBanca(
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
            >
              <option value="">Todas as bancas</option>
              {p.bancas.map((b) => (
                <option key={b} value={b}>
                  Banca {b}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <nav className="entrevistas-analise-navegacao" aria-label="Convocados">
          <button
            type="button"
            className="entrevistas-navegar"
            data-acao="ficha-anterior"
            aria-label="Anterior"
            disabled={!p.anterior || p.salvando}
            title={
              p.anterior?.candidato
                ? `Anterior: ${p.anterior.candidato}`
                : undefined
            }
            onClick={p.aoAnterior}
          >
            <i className="fa-solid fa-chevron-left" aria-hidden="true" />
          </button>
          {p.posicao >= 0 ? (
            <span className="entrevistas-analise-posicao">
              {p.posicao + 1} de {p.total}
            </span>
          ) : null}
          <button
            type="button"
            className="entrevistas-navegar"
            data-acao="ficha-proxima"
            aria-label="Próximo"
            disabled={!p.proximo || p.salvando}
            title={
              p.proximo?.candidato
                ? `Próximo: ${p.proximo.candidato}`
                : undefined
            }
            onClick={p.aoProximo}
          >
            <i className="fa-solid fa-chevron-right" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </header>
  );
}
