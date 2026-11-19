import {
  ehEditalDeTreinamento,
  ROTULO_DO_TREINAMENTO,
} from "../../lib/editais/edital-de-treinamento.ts";
import { rotuloDaVersao } from "../../lib/base/nome-da-versao.ts";
import { formatNumberBR } from "../../lib/base/formatters";
import {
  editalDoHistorico,
  situacaoDoEdital,
  tomDaSituacaoDoEdital,
} from "../../lib/editais/editais-ativos.ts";
import {
  AtivosEHistorico,
  Selo,
  usarAtivosEHistorico,
} from "../../ui/index.ts";
import type { EditalDaLista } from "./abas-e-entrada.ts";

/*
  A entrada da Avaliação documental: sem edital escolhido (vários editais
  vigentes na área e nenhum lembrado), em vez da página em branco, um cartão
  compacto por edital, os ativos (vigentes) separados do Histórico
  (concluídos, cancelados e desativados), com a contagem por situação — número e unidade, a versão da regra e a situação, o
  papel de quem está na tela e, quando o banco manda as contagens, o
  andamento das fichas (e, para quem analisa, as fichas dela em análise).
  Clicar abre o edital. Só os dados da lista (listar_editais_avaliacao).
*/

const PAPEIS: Readonly<Record<string, string>> = Object.freeze({
  COORDENADOR: "Coordenação",
  REVISOR: "Revisão",
  ANALISTA: "Análise",
});

const n = (valor: unknown) => formatNumberBR(Number(valor) || 0);

function Andamento({ edital }: { edital: EditalDaLista }) {
  const f = edital.fichas;
  if (!f) return null;
  const partes = [
    f.concluidas !== null && f.concluidas !== undefined
      ? `${n(f.concluidas)} concluídas`
      : "",
    f.pendentes !== null && f.pendentes !== undefined
      ? `${n(f.pendentes)} pendentes`
      : "",
  ].filter(Boolean);
  const minhas =
    edital.papel && edital.papel !== "COORDENADOR"
      ? Number(f.minhas_em_analise) || 0
      : 0;
  return (
    <>
      {partes.length ? (
        <span className="avd-entrada-andamento">{partes.join(" · ")}</span>
      ) : null}
      {minhas ? (
        <span className="avd-entrada-minhas">
          Suas fichas: {n(minhas)} em análise
        </span>
      ) : null}
    </>
  );
}

export function EntradaDaAvaliacao({
  editais: todos,
  area,
  aoAbrir,
}: {
  editais: ReadonlyArray<EditalDaLista>;
  area: string;
  aoAbrir: (editalId: string) => void;
}) {
  const { visiveis: editais, controle } = usarAtivosEHistorico(todos, {
    chave: `yeende:avaliacao-documental:vista:${area}`,
    ehHistorico: editalDoHistorico,
    situacao: situacaoDoEdital,
  });
  if (!todos.length) return null;
  return (
    <section
      className="avd-entrada"
      aria-labelledby="avdEntradaTitulo"
      data-tour="avd-entrada"
    >
      <h2 id="avdEntradaTitulo" className="avd-entrada-titulo">
        Editais da área
      </h2>
      <AtivosEHistorico
        {...controle}
        rotulo="Editais da área"
        tomDaSituacao={tomDaSituacaoDoEdital}
        tour="avd-ativos-e-historico"
      />
      {editais.length ? null : (
        <p className="ui-texto-secundario" role="status">
          {controle.vista === "historico"
            ? "Nenhum edital no histórico."
            : "Nenhum edital ativo."}
        </p>
      )}
      <ul className="avd-entrada-lista">
        {editais.map((ed) => {
          const papel = ed.papel ? PAPEIS[ed.papel] : "";
          const conferida = ed.situacao_regra === "CONFERIDA";
          return (
            <li key={ed.id}>
              <button
                type="button"
                className="ui-card avd-entrada-cartao"
                data-edital={ed.id}
                onClick={() => aoAbrir(ed.id)}
              >
                <span className="avd-entrada-topo">
                  <strong>{ed.edital || "Edital"}</strong>
                  {papel ? <Selo tom="neutro">{papel}</Selo> : null}
                  {ehEditalDeTreinamento(ed) ? (
                    <Selo tom="pendente">{ROTULO_DO_TREINAMENTO}</Selo>
                  ) : null}
                </span>
                {ed.unidade ? (
                  <span className="avd-entrada-unidade">{ed.unidade}</span>
                ) : null}
                <span className="avd-entrada-regra">
                  {ed.versao_regra ? (
                    <>
                      {rotuloDaVersao({
                        versao: ed.versao_regra,
                        nome: ed.nome_regra,
                      })}{" "}
                      <Selo tom={conferida ? "aprovado" : "pendente"}>
                        {conferida ? "Conferida" : "A conferir"}
                      </Selo>
                    </>
                  ) : (
                    "Sem regra"
                  )}
                </span>
                <Andamento edital={ed} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
