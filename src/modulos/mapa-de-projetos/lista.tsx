import type { PontoDoMunicipio, PropsDaLista } from "./tipos.ts";
import {
  gruposPorProjeto,
  plural,
  resultadoDoMunicipio,
  temCandidatosPorLugar,
  textoDasVagas,
} from "../../lib/visao-geral-da-area.ts";
import { Campo, EstadoVazio, classes } from "../../ui/index.js";
import { ListaDoMapa } from "../mapa-saude-indigena/painel-do-mapa.jsx";

/*
  A lista "Municípios por vagas", ao lado do mapa de Projetos: o mesmo
  formato de "Territórios por vagas" da Saúde Indígena (posição, nome,
  detalhes e vagas à direita; classes `.mapa-si-territorio`), com o filtro
  por projeto e "Agrupar por projeto" no alto (só com dois ou mais projetos).
*/

const fmt = (valor: number) => Number(valor || 0).toLocaleString("pt-BR");

export function CorDoProjeto({ serie }: { serie: number }) {
  return (
    <span
      className={`mapa-projeto__cor mapa-projeto__cor--${serie || 0}`}
      aria-hidden="true"
    />
  );
}

/*
  Uma linha, compacta: o nome do lugar e as vagas na primeira linha; na
  segunda, os projetos como selos pequenos (só quando a lista mistura
  projetos: com o filtro de um projeto ou agrupada, eles seriam iguais em
  todas) e o detalhe curto. Candidatos só quando o lugar casou com alguma
  vaga das análises (`temCandidatosPorLugar`): sem isso o número seria um
  zero falso. A barra é o resultado das análises — a parte aprovada entre
  aprovados e reprovados (o trilho, em vermelho claro, são os reprovados); o
  percentual escrito ao lado não deixa a leitura só na cor. Sem coordenada,
  sem clique.
*/
function LinhaDoLugar({
  ponto,
  posicao,
  aoEscolher,
  mostrarProjetos = true,
}: {
  ponto: PontoDoMunicipio;
  posicao: number;
  aoEscolher: PropsDaLista["aoEscolher"];
  mostrarProjetos?: boolean;
}) {
  const { candidatos, aprovados, reprovados } = ponto;
  const comCandidatos = temCandidatosPorLugar(ponto);
  const vagasPublicadas = textoDasVagas({
    vagas: ponto.vagasEdital,
    cadastroReserva: ponto.cadastroReserva,
  });
  const resultado = resultadoDoMunicipio(ponto);
  const tamanho = ponto.tamanho ?? ponto.vagas;
  const detalhe = [
    vagasPublicadas && ponto.vagasEdital === null ? vagasPublicadas : "",
    comCandidatos ? plural(candidatos, "candidato", "candidatos") : "",
    comCandidatos && (aprovados || reprovados)
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
    comCandidatos ? plural(candidatos, "candidato", "candidatos") : "",
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
          {(mostrarProjetos && ponto.projetos.length) || detalhe ? (
            <span className="mapa-projetos-lugar__segunda">
              {mostrarProjetos
                ? ponto.projetos.map((projeto) => (
                    <span
                      key={projeto.nome}
                      className="mapa-projetos-lugar__projeto"
                    >
                      <CorDoProjeto serie={projeto.serie} />
                      {projeto.nome}
                    </span>
                  ))
                : null}
              {detalhe ? <small>{detalhe}</small> : null}
            </span>
          ) : null}
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

function Filtros({
  projetos,
  escolha,
  aoMudarEscolha,
}: Pick<PropsDaLista, "projetos" | "escolha" | "aoMudarEscolha">) {
  return (
    <div className="mapa-projetos__filtros">
      <Campo rotulo="Projeto">
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
      </Campo>
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

function Itens({
  pontos,
  agrupar,
  filtrado,
  aoEscolher,
}: Pick<PropsDaLista, "pontos" | "aoEscolher"> & {
  agrupar: boolean;
  filtrado: boolean;
}) {
  if (!agrupar) {
    return (
      <ol className="mapa-si-lista__itens">
        {pontos.map((ponto, indice) => (
          <LinhaDoLugar
            key={ponto.chave}
            ponto={ponto}
            posicao={indice + 1}
            aoEscolher={aoEscolher}
            mostrarProjetos={!filtrado}
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
            mostrarProjetos={false}
          />
        ))}
      </ol>
    </section>
  ));
}

/*
  A lista lateral comum aos mapas nacionais (`ListaDoMapa`: topo com o total,
  esqueleto enquanto carrega, vazio em uma linha), com os filtros de Projetos
  entre o topo e os itens. `id` é o do painel (o "Coordenadas" o controla) e
  `idDoTitulo` nomeia a lista, como em "Territórios por vagas". Com recorte da
  Visão geral (`noRecorte`), o vazio diz "no recorte", como o da Saúde
  Indígena.
*/
export function ListaDeMunicipios({
  id,
  idDoTitulo,
  titulo,
  carregando,
  indisponivel,
  erro,
  noRecorte = false,
  pontos,
  projetos,
  escolha,
  aoMudarEscolha,
  aoEscolher,
}: PropsDaLista) {
  let corpo = null;
  if (indisponivel)
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
  else if (pontos.length)
    corpo = (
      <Itens
        pontos={pontos}
        agrupar={escolha.agrupar}
        filtrado={Boolean(escolha.projeto)}
        aoEscolher={aoEscolher}
      />
    );

  const comFiltros = !indisponivel && !erro && projetos.length > 1;

  return (
    <ListaDoMapa
      id={id}
      idDoTitulo={idDoTitulo}
      titulo={titulo}
      total={pontos.length}
      carregando={carregando}
      vazio={
        noRecorte
          ? "Nenhum município no recorte."
          : "Nenhum município nas vagas da área."
      }
      antes={
        comFiltros ? (
          <Filtros
            projetos={projetos}
            escolha={escolha}
            aoMudarEscolha={aoMudarEscolha}
          />
        ) : null
      }
    >
      {corpo}
    </ListaDoMapa>
  );
}
