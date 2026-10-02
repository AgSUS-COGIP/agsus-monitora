import {
  gruposPorProjeto,
  plural,
  resultadoDoMunicipio,
  textoDasVagas,
} from "../../lib/visao-geral-da-area.js";
import { EstadoVazio, classes } from "../../ui/index.js";

/*
  A lista "Municípios por vagas", ao lado do mapa de Projetos: o mesmo
  formato de "Territórios por vagas" da Saúde Indígena (posição, nome,
  detalhes e vagas à direita; classes `.mapa-si-territorio`), com o filtro
  por projeto e "Agrupar por projeto" no alto (só com dois ou mais projetos).
*/

const fmt = (valor) => Number(valor || 0).toLocaleString("pt-BR");

export function CorDoProjeto({ serie }) {
  return (
    <span
      className={`mapa-projeto__cor mapa-projeto__cor--${serie || 0}`}
      aria-hidden="true"
    />
  );
}

/*
  Uma linha: os detalhes começam pelos projetos do lugar (cor e nome). A
  barra é o resultado das análises — a parte aprovada entre aprovados e
  reprovados (o trilho, em vermelho claro, são os reprovados); o percentual
  escrito ao lado não deixa a leitura só na cor. Sem coordenada, sem clique.
*/
function LinhaDoLugar({ ponto, posicao, aoEscolher }) {
  const { candidatos, aprovados, reprovados } = ponto;
  const vagasPublicadas = textoDasVagas({
    vagas: ponto.vagasEdital,
    cadastroReserva: ponto.cadastroReserva,
  });
  const resultado = resultadoDoMunicipio(ponto);
  const tamanho = ponto.tamanho ?? ponto.vagas;
  const detalhe = [
    vagasPublicadas && ponto.vagasEdital === null ? vagasPublicadas : "",
    plural(candidatos, "candidato", "candidatos"),
    aprovados || reprovados
      ? `${plural(aprovados, "aprovado", "aprovados")} · ${plural(reprovados, "reprovado", "reprovados")}`
      : "",
    ponto.coordenadas ? "" : "sem coordenada no mapa",
  ]
    .filter(Boolean)
    .join(" · ");
  const rotulo = [
    ponto.rotulo,
    ponto.projetos.map((projeto) => projeto.nome).join(", "),
    vagasPublicadas ||
      (ponto.vagas ? plural(ponto.vagas, "vaga", "vagas") : ""),
    plural(candidatos, "candidato", "candidatos"),
    resultado ? `${resultado.pct}% aprovados` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <li>
      <button
        type="button"
        className={classes(
          "mapa-si-territorio",
          "mapa-projetos-lugar",
          !tamanho && "mapa-si-territorio--sem-vagas",
        )}
        disabled={!ponto.coordenadas}
        aria-label={rotulo}
        onClick={() => aoEscolher(ponto)}
      >
        <span className="mapa-si-territorio__posicao" aria-hidden="true">
          {posicao}
        </span>
        <span className="mapa-si-territorio__corpo">
          <strong>{ponto.rotulo}</strong>
          {ponto.projetos.length ? (
            <span className="mapa-projetos-lugar__projetos">
              {ponto.projetos.map((projeto) => (
                <span
                  key={projeto.nome}
                  className="mapa-projetos-lugar__projeto"
                >
                  <CorDoProjeto serie={projeto.serie} />
                  {projeto.nome}
                </span>
              ))}
            </span>
          ) : null}
          <small>{detalhe}</small>
          {resultado ? (
            <span className="mapa-si-territorio__preenchimento mapa-projetos-lugar__resultado">
              <span className="mapa-si-territorio__barra" aria-hidden="true">
                <i style={{ width: `${resultado.pct}%` }} />
              </span>
              <span>{resultado.pct}% aprovados</span>
            </span>
          ) : null}
        </span>
        <span className="mapa-si-territorio__vagas">
          {tamanho ? (
            <>
              <b>{fmt(tamanho)}</b> {tamanho === 1 ? "vaga" : "vagas"}
            </>
          ) : ponto.cadastroReserva ? (
            <b title="Cadastro reserva">CR</b>
          ) : (
            <>
              <b>0</b> vagas
            </>
          )}
        </span>
      </button>
    </li>
  );
}

function Filtros({ projetos, escolha, aoMudarEscolha }) {
  return (
    <div className="mapa-projetos__filtros">
      <label className="mapa-projetos__campo">
        <span>Projeto</span>
        <select
          className="mapa-projetos__seletor"
          name="projeto-do-mapa"
          value={escolha.projeto}
          onChange={(evento) =>
            aoMudarEscolha({ projeto: evento.target.value })
          }
        >
          <option value="">Todos os projetos</option>
          {projetos.map((projeto) => (
            <option key={projeto.nome} value={projeto.nome}>
              {`${projeto.nome} (${projeto.lugares})`}
            </option>
          ))}
        </select>
      </label>
      <label className="mapa-projetos__agrupar">
        <input
          type="checkbox"
          name="agrupar-por-projeto"
          checked={escolha.agrupar}
          onChange={(evento) =>
            aoMudarEscolha({ agrupar: evento.target.checked })
          }
        />
        <span>Agrupar por projeto</span>
      </label>
    </div>
  );
}

function Itens({ pontos, agrupar, aoEscolher }) {
  if (!agrupar) {
    return (
      <ol className="mapa-si-lista__itens">
        {pontos.map((ponto, indice) => (
          <LinhaDoLugar
            key={ponto.chave}
            ponto={ponto}
            posicao={indice + 1}
            aoEscolher={aoEscolher}
          />
        ))}
      </ol>
    );
  }
  // Lugar de dois projetos aparece nos dois grupos.
  return gruposPorProjeto(pontos).map((grupo) => (
    <section key={grupo.nome} className="mapa-projetos__grupo">
      <h4 className="mapa-projetos__grupo-titulo">
        <CorDoProjeto serie={grupo.serie} />
        <strong>{grupo.nome}</strong>
        <span>{plural(grupo.pontos.length, "lugar", "lugares")}</span>
      </h4>
      <ol className="mapa-si-lista__itens">
        {grupo.pontos.map((ponto, indice) => (
          <LinhaDoLugar
            key={ponto.chave}
            ponto={ponto}
            posicao={indice + 1}
            aoEscolher={aoEscolher}
          />
        ))}
      </ol>
    </section>
  ));
}

export function ListaDeMunicipios({
  id,
  titulo,
  carregando,
  indisponivel,
  erro,
  pontos,
  projetos,
  escolha,
  aoMudarEscolha,
  aoEscolher,
}) {
  let corpo;
  if (carregando)
    corpo = <div className="ui-esqueleto mapa-si-lista__esqueleto" />;
  else if (indisponivel)
    corpo = (
      <EstadoVazio>
        Municípios indisponíveis: falta uma atualização do banco.
      </EstadoVazio>
    );
  else if (erro)
    corpo = (
      <EstadoVazio>
        Não foi possível carregar os municípios. Tente em Atualizar dados.
      </EstadoVazio>
    );
  else if (!pontos.length)
    corpo = <EstadoVazio>Nenhum município nas vagas da área.</EstadoVazio>;
  else
    corpo = (
      <Itens
        pontos={pontos}
        agrupar={escolha.agrupar}
        aoEscolher={aoEscolher}
      />
    );

  const comFiltros =
    !carregando && !indisponivel && !erro && projetos.length > 1;

  return (
    <aside className="mapa-si-lista" aria-labelledby={id}>
      <div className="mapa-si-lista__topo">
        <span id={id}>{titulo}</span>
        <b>{carregando ? "…" : fmt(pontos.length)}</b>
      </div>
      {comFiltros ? (
        <Filtros
          projetos={projetos}
          escolha={escolha}
          aoMudarEscolha={aoMudarEscolha}
        />
      ) : null}
      {corpo}
    </aside>
  );
}
