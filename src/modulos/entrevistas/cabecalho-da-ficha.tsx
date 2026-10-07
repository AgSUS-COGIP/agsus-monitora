import { Segmentado } from "../../ui/index.js";
import { PopoverDaFicha } from "./popover-da-ficha.tsx";
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
  roteiro: { nome?: string; versao?: number } | null;
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

const COMPARECIMENTO = [
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
      ? { chave: "analise", texto: `Análise ${numeroBR(p.notaDaAnalise)}` }
      : null,
    p.modalidade ? { chave: "modalidade", texto: p.modalidade } : null,
    p.roteiro
      ? {
          chave: "roteiro",
          texto: `Roteiro v${p.roteiro.versao ?? "—"}${p.aspectos ? ` · ${p.aspectos} aspectos` : ""}`,
        }
      : null,
  ].filter((c): c is { chave: string; texto: string } => Boolean(c));
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
              {c.texto}
            </span>
          ))}
          <PopoverDaFicha
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
          </PopoverDaFicha>
        </div>
      </div>
      <div className="entrevistas-analise-controles">
        <Segmentado
          rotulo="Comparecimento"
          className="entrevistas-comparecimento"
          tour="entrevistas-ficha-comparecimento"
          opcoes={COMPARECIMENTO}
          valor={p.compareceu}
          desabilitado={!p.podeEditar || p.salvando}
          aoMudar={(valor: "S" | "N") => p.aoMudarComparecimento(valor)}
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
