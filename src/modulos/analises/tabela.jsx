import { mensagemDeAreaSemAnalises } from "../../lib/area-do-painel-de-analises.js";
import {
  filtrarPelaBuscaDaFila,
  tomDoStatus,
} from "../../lib/analises-curriculares.js";
import { formatNumberBR } from "../../lib/formatters.js";
import { Selo, TabelaInfinita } from "../../ui/index.js";

/*
  A fila de análises: TabelaInfinita de src/ui/ (50 por vez, mais ao rolar ou
  no "Carregar mais"), com a busca só da fila (controlada pela tela, que a
  limpa junto com os filtros e traz os pareceres quando ela é usada). O botão
  "Detalhes" abre a gaveta. A área já está no cabeçalho do app: sem coluna de
  grupo (ele aparece na gaveta).
*/

const COLUNAS = [
  { rotulo: "Unidade", largura: "16%" },
  { rotulo: "Edital", largura: "10%" },
  { rotulo: "Código", largura: "9%" },
  { rotulo: "Vaga", largura: "25%" },
  { rotulo: "Candidato", largura: "22%" },
  { rotulo: "Status", largura: "9%" },
  { rotulo: "Ações", largura: "9%" },
];

const ou = (valor, padrao = "-") => String(valor ?? "").trim() || padrao;

export function TabelaDeAnalises({
  linhas,
  total,
  carregado,
  area,
  busca,
  aoBuscar,
  aoAbrir,
}) {
  return (
    <TabelaInfinita
      idDoTitulo="analisesFilaTitulo"
      titulo="Fila de análises"
      busca={{
        placeholder: "Buscar somente na fila",
        rotulo: "Buscar somente na fila de análises",
        valor: busca,
        aoMudar: aoBuscar,
      }}
      carregado={carregado}
      itens={linhas}
      filtrarPelaBusca={filtrarPelaBuscaDaFila}
      colunas={COLUNAS}
      classeDaTabela="analises-tabela"
      informacao={(quantos) =>
        quantos === null
          ? ""
          : `Recorte atual: ${formatNumberBR(linhas.length)} de ${formatNumberBR(total)}`
      }
      total={total}
      vazio={mensagemDeAreaSemAnalises(area) || "Nenhuma análise nesta área."}
      linha={(linha) => (
        <tr key={linha.__chave}>
          <td>{ou(linha.unidade)}</td>
          <td>{ou(linha.edital)}</td>
          <td>{ou(linha.codigo_vaga)}</td>
          <td>
            <span className="ui-texto-principal">{ou(linha.nome_vaga)}</span>
          </td>
          <td>
            <span className="ui-texto-principal">{ou(linha.candidato)}</span>
            <span className="ui-texto-secundario">
              {ou(linha.responsavel_analise, "Sem responsável")}
            </span>
          </td>
          <td>
            <Selo tom={tomDoStatus(linha.status_consolidado)}>
              {ou(linha.status_consolidado, "Pendente")}
            </Selo>
          </td>
          <td>
            <button
              type="button"
              className="btn secondary small"
              data-acao="detalhes"
              aria-label={`Detalhes de ${ou(linha.candidato, "registro")}`}
              onClick={() => aoAbrir(linha.__chave)}
            >
              <i className="fa-solid fa-chevron-down" aria-hidden="true" />{" "}
              Detalhes
            </button>
          </td>
        </tr>
      )}
    />
  );
}
