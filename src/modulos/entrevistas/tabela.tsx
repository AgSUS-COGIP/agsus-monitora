import type {
  EntrevistaDoPainel,
  AnaliseDaEntrevista,
} from "./tipos-do-painel.ts";
import { formatNumberBR } from "../../lib/formatters.js";
import {
  badgeDoParecer,
  FILTROS_VAZIOS,
  filtrarEntrevistas,
  formatarNota,
  rotuloDoComparecimento,
  rotuloDoParecer,
} from "../../lib/entrevistas-do-painel.ts";
import { Selo, TabelaInfinita } from "../../ui/index.js";

/*
  "Entrevistas": a tabela do Painel de entrevistas, na tabela de carregamento
  contínuo das telas (TabelaInfinita, src/ui/). A busca do cabeçalho vale só
  para a tabela. Clique na linha (ou Enter/Espaço) abre a gaveta. Quem empata
  na nota da entrevista (mesmo edital e vaga) leva o selo "Empate": o
  desempate é feito na Classificação (`empates`: id → quantos empatam).
*/

const COLUNAS = [
  { rotulo: "Candidato", largura: "19%" },
  { rotulo: "Unidade / Edital", largura: "16%" },
  { rotulo: "Vaga / Cargo", largura: "16%" },
  { rotulo: "Modalidade", largura: "10%" },
  { rotulo: "Nota entrevista", largura: "9%" },
  { rotulo: "Parecer", largura: "9%" },
  { rotulo: "Compareceu", largura: "8%" },
  { rotulo: "Análise", largura: "13%" },
];

export const MENSAGEM_SEM_ENTREVISTAS =
  "Nenhuma entrevista carregada para esta área ainda.";

export function SeloDoParecer({ parecer }: { parecer: string }) {
  return <Selo tom={badgeDoParecer(parecer)}>{rotuloDoParecer(parecer)}</Selo>;
}

export function ResumoDaAnalise({
  analise,
}: {
  analise: AnaliseDaEntrevista | null;
}) {
  if (!analise) return <Selo>Sem análise</Selo>;
  return (
    <div>
      <div className="ui-texto-principal">{formatarNota(analise.nota)}</div>
      <span className="ui-texto-secundario">{analise.resultado || "—"}</span>
    </div>
  );
}

const pelaBusca = (entrevistas: readonly EntrevistaDoPainel[], busca: string) =>
  filtrarEntrevistas(entrevistas, { ...FILTROS_VAZIOS, busca });

function LinhaDaEntrevista({
  entrevista: e,
  empatados,
  aoAbrir,
}: {
  entrevista: EntrevistaDoPainel;
  empatados: number;
  aoAbrir(id: string): void;
}) {
  return (
    <tr
      className="entrevistas-linha"
      tabIndex={0}
      onClick={() => aoAbrir(e.id)}
      onKeyDown={(evento) => {
        if (
          evento.target === evento.currentTarget &&
          (evento.key === "Enter" || evento.key === " ")
        ) {
          evento.preventDefault();
          aoAbrir(e.id);
        }
      }}
      aria-label={`Entrevista de ${e.candidato}`}
    >
      <td>
        <div className="ui-texto-principal">{e.candidato}</div>
        <span className="ui-texto-secundario">
          {e.codigo ? `Cód. ${e.codigo}` : "Sem código"}
        </span>
      </td>
      <td>
        <div className="ui-texto-principal">{e.unidade || "—"}</div>
        <span className="ui-texto-secundario">{e.edital}</span>
        {e.semEdital ? <Selo tom="pendente">Sem edital</Selo> : null}
      </td>
      <td>
        <div className="ui-texto-principal">{e.vaga || "—"}</div>
        <span className="ui-texto-secundario">{e.cargo}</span>
      </td>
      <td>{e.modalidade || "—"}</td>
      <td>
        <div className="ui-texto-principal">{formatarNota(e.nota)}</div>
        {e.divergente ? (
          <Selo
            tom="revisar"
            titulo={`Soma dos critérios: ${formatarNota(e.somaDasNotas)}`}
          >
            Divergente
          </Selo>
        ) : null}
        {empatados ? (
          <Selo
            tom="pendente"
            className="entrevistas-selo-empate"
            titulo={`Empate com ${empatados - 1} ${empatados === 2 ? "candidato" : "candidatos"} na mesma vaga: o desempate é feito na Classificação`}
          >
            Empate
          </Selo>
        ) : null}
      </td>
      <td>
        <SeloDoParecer parecer={e.parecer} />
      </td>
      <td>{rotuloDoComparecimento(e.compareceu)}</td>
      <td>
        <ResumoDaAnalise analise={e.analise} />
      </td>
    </tr>
  );
}

export function TabelaDeEntrevistas({
  entrevistas,
  total,
  carregado,
  empates = null,
  aoAbrir,
}: {
  entrevistas: readonly EntrevistaDoPainel[];
  total: number;
  carregado: boolean;
  empates?: ReadonlyMap<string, number> | null;
  aoAbrir(id: string): void;
}) {
  return (
    <TabelaInfinita
      tour="entrevistas-tabela"
      idDoTitulo="entrevistasTabelaTitulo"
      titulo="Entrevistas"
      busca={{
        placeholder: "Buscar somente na tabela",
        rotulo: "Buscar somente na tabela de entrevistas",
      }}
      carregado={carregado}
      itens={entrevistas}
      filtrarPelaBusca={pelaBusca}
      colunas={COLUNAS}
      linha={(e) => (
        <LinhaDaEntrevista
          key={e.id}
          entrevista={e}
          empatados={empates?.get(e.id) || 0}
          aoAbrir={aoAbrir}
        />
      )}
      total={total}
      vazio={MENSAGEM_SEM_ENTREVISTAS}
      informacao={(quantos) => (
        <span
          className="entrevistas-contagem"
          data-tour="entrevistas-tabela-contagem"
        >
          {quantos === null
            ? "Carregando…"
            : quantos === total
              ? `${formatNumberBR(total)} ${total === 1 ? "entrevista" : "entrevistas"}`
              : `${formatNumberBR(quantos)} de ${formatNumberBR(total)}`}
        </span>
      )}
    />
  );
}
