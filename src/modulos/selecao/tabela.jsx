import { formatNumberBR } from "../../lib/formatters.js";
import {
  FILTROS_VAZIOS,
  filtrarVagas,
  formatarQuantidade,
  rotuloDaUnidade,
} from "../../lib/selecao-do-painel.js";
import { TabelaInfinita } from "../../ui/index.js";

/*
  "Base operacional consolidada": a tabela do painel antigo (DSEI, edital,
  cargo, vaga, inscritos, aptos, triados, aprovados, contratados e
  observação), na tabela de carregamento contínuo das telas (TabelaInfinita,
  src/ui/). A busca do cabeçalho vale só para a tabela.
*/

export const MENSAGEM_SEM_VAGAS =
  "Nenhuma vaga carregada para esta área ainda.";

const colunas = (area) => [
  {
    rotulo: rotuloDaUnidade(area) === "Nome DSEI" ? "DSEI" : "Unidade",
    largura: "15%",
  },
  { rotulo: "Edital", largura: "9%" },
  { rotulo: "Cargo", largura: "20%" },
  { rotulo: "Vaga", largura: "7%" },
  { rotulo: "Inscritos", largura: "7%", numero: true },
  { rotulo: "Aptos", largura: "7%", numero: true },
  { rotulo: "Triados", largura: "7%", numero: true },
  { rotulo: "Aprovados", largura: "7%", numero: true },
  { rotulo: "Contratados", largura: "7%", numero: true },
  { rotulo: "Observação", largura: "14%" },
];

const pelaBusca = (vagas, busca) => filtrarVagas(vagas, FILTROS_VAZIOS, busca);

function LinhaDaVaga({ vaga: v }) {
  const n = formatarQuantidade;
  return (
    <tr className="selecao-linha" data-tour="selecao-vaga">
      <td>
        <span className="ui-texto-principal">{v.unidade || "—"}</span>
      </td>
      <td>{v.edital}</td>
      <td>
        <span className="ui-texto-principal">{v.cargo || "—"}</span>
      </td>
      <td>{v.vaga || "—"}</td>
      <td className="num">{n(v.inscritos)}</td>
      <td className="num">{n(v.aptos)}</td>
      <td className="num">{n(v.triados)}</td>
      <td className="num">{n(v.aprovados)}</td>
      <td className="num">{n(v.contratados)}</td>
      <td>
        {v.observacao ? (
          <span className="ui-texto-secundario">{v.observacao}</span>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}

export function TabelaDeVagas({ vagas, total, carregado, area }) {
  const daUnidade = rotuloDaUnidade(area) === "Nome DSEI" ? "DSEI" : "unidade";
  return (
    <TabelaInfinita
      tour="selecao-tabela"
      idDoTitulo="selecaoTabelaTitulo"
      titulo="Base operacional consolidada"
      busca={{
        placeholder: `Buscar ${daUnidade}, edital, cargo ou observação`,
        rotulo: "Buscar somente na tabela",
      }}
      carregado={carregado}
      itens={vagas}
      filtrarPelaBusca={pelaBusca}
      colunas={colunas(area)}
      classeDaTabela="selecao-tabela"
      linha={(v) => <LinhaDaVaga key={v.id} vaga={v} />}
      total={total}
      vazio={MENSAGEM_SEM_VAGAS}
      informacao={(quantos) =>
        quantos === null
          ? "Carregando…"
          : quantos === total
            ? `${formatNumberBR(total)} ${total === 1 ? "vaga" : "vagas"}`
            : `${formatNumberBR(quantos)} de ${formatNumberBR(total)}`
      }
    />
  );
}
