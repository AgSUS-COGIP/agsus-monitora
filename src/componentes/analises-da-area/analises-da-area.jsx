import {
  StrictMode,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import {
  ESCOPOS,
  FILTROS_VAZIOS,
  alternarIndicador,
  contarIndicadores,
  evolucaoDiaria,
  filtrarAnalises,
  filtrarSemIndicador,
  gerarCsv,
  janelaDoEdital,
  nomeDoCsv,
  opcoesDosFiltros,
  porResponsavel,
  temMunicipio,
} from "../../lib/analises-da-area.js";
import { usarAreaAtual } from "../usar-area-atual.js";
import { criarEstadoDasAnalises } from "./estado.js";
import {
  GavetaDoDetalhe,
  GraficoDiario,
  GraficoPorResponsavel,
  Indicadores,
  Seletor,
  TabelaDeAnalises,
} from "./partes.jsx";

/*
  Análises por área, em React — a página `#page-analises`.

  Leitura das análises curriculares da área escolhida no menu (Projetos e
  SEDE; a Saúde Indígena continua no painel externo, `analises.html`, até o
  responsável aprovar esta tela). O legado só troca a classe `.active` da
  `<section>` e chama `render()` do controlador
  (`window.analisesDaAreaController`) ao abrir a página.

  A carga (área × situação, com cache) mora em `estado.js`; filtros,
  indicador ligado e detalhe aberto são estado deste componente.
*/

const opcoesIguais = (lista) => lista.map((valor) => [valor, valor]);

const MENSAGEM_DA_SEDE =
  "Ainda não há análises da SEDE. Elas aparecem quando a planilha da SEDE começar a enviar.";

function baixarCsv(conteudo, nome) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function AnalisesDaArea({ estado, agora = () => new Date() }) {
  const carga = useSyncExternalStore(estado.assinar, estado.obter);
  const { area, nome } = usarAreaAtual();
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [aberta, setAberta] = useState("");

  // A área do menu manda; o estado só pede quando a página estiver aberta.
  useEffect(() => {
    void estado.definirArea(area);
  }, [estado, area]);

  // Outra área: os filtros da anterior não fazem sentido aqui.
  useEffect(() => {
    setFiltros(FILTROS_VAZIOS);
    setAberta("");
  }, [area]);

  /*
    As linhas só valem se forem da área e da situação à vista; enquanto a
    carga nova não chega, a tela diz "carregando" em vez de mostrar a área
    anterior.
  */
  const emDia = carga.chave === `${area}|${carga.escopo}`;
  const carregado = emDia && carga.carregado && !carga.carregando;
  const linhas = emDia ? carga.linhas : [];

  const comMunicipio = useMemo(() => temMunicipio(linhas), [linhas]);
  const opcoes = useMemo(() => opcoesDosFiltros(linhas), [linhas]);
  const semIndicador = useMemo(
    () => filtrarSemIndicador(linhas, filtros),
    [linhas, filtros],
  );
  const filtradas = useMemo(
    () => filtrarAnalises(linhas, filtros),
    [linhas, filtros],
  );
  const contagem = useMemo(
    () => contarIndicadores(semIndicador),
    [semIndicador],
  );
  const grupos = useMemo(() => porResponsavel(filtradas, 12), [filtradas]);
  const dias = useMemo(() => evolucaoDiaria(filtradas, 30), [filtradas]);
  const linhaAberta = aberta
    ? linhas.find((linha) => linha.id === aberta)
    : null;

  const mudarFiltro = (chave, valor) =>
    setFiltros((atuais) => ({ ...atuais, [chave]: valor }));

  const filtrosLigados = Object.entries(filtros).some(([, valor]) => valor);
  const semNada = carregado && !carga.erro && linhas.length === 0;

  function exportar() {
    baixarCsv(
      gerarCsv(filtradas, { area, comMunicipio }),
      nomeDoCsv(area, agora()),
    );
  }

  return (
    <div className="aa-pagina">
      <div className="table-card card aa-topo">
        <div className="aa-topo-cabeca">
          <div>
            <h2 id="aaTitulo">Análises{nome ? ` · ${nome}` : ""}</h2>
            <p className="aa-grafico-nota" aria-live="polite">
              {carga.carregando && !carregado
                ? "Carregando análises…"
                : carregado
                  ? `${filtradas.length.toLocaleString("pt-BR")} de ${linhas.length.toLocaleString("pt-BR")} análises`
                  : ""}
            </p>
          </div>
          <div className="aa-topo-acoes">
            <button
              id="aaAtualizar"
              type="button"
              className="btn secondary"
              disabled={carga.carregando}
              onClick={() => void estado.recarregar()}
            >
              <i className="fa-solid fa-rotate" aria-hidden="true" /> Atualizar
            </button>
            <button
              id="aaExportar"
              type="button"
              className="btn secondary"
              disabled={!carregado || !filtradas.length}
              onClick={exportar}
            >
              <i className="fa-solid fa-download" aria-hidden="true" /> Exportar
              CSV
            </button>
          </div>
        </div>

        <Indicadores
          contagem={contagem}
          carregado={carregado}
          ativo={filtros.indicador}
          aoEscolher={(chave) =>
            mudarFiltro(
              "indicador",
              alternarIndicador(filtros.indicador, chave),
            )
          }
        />

        <div className="aa-filtros">
          <Seletor
            id="aaEscopo"
            rotulo="Situação"
            opcoes={ESCOPOS}
            valor={carga.escopo}
            aoMudar={(valor) => void estado.definirEscopo(valor)}
          />
          <Seletor
            id="aaUnidade"
            rotulo="Unidade"
            vazio="Todas"
            opcoes={opcoesIguais(opcoes.unidades)}
            valor={filtros.unidade}
            aoMudar={(valor) => mudarFiltro("unidade", valor)}
          />
          <Seletor
            id="aaEdital"
            rotulo="Edital"
            vazio="Todos"
            opcoes={opcoesIguais(opcoes.editais)}
            valor={filtros.edital}
            aoMudar={(valor) => mudarFiltro("edital", valor)}
          />
          <Seletor
            id="aaVaga"
            rotulo="Vaga"
            vazio="Todas"
            opcoes={opcoesIguais(opcoes.vagas)}
            valor={filtros.vaga}
            aoMudar={(valor) => mudarFiltro("vaga", valor)}
          />
          {comMunicipio ? (
            <Seletor
              id="aaMunicipio"
              rotulo="Município/UF"
              vazio="Todos"
              opcoes={opcoesIguais(opcoes.municipios)}
              valor={filtros.municipio}
              aoMudar={(valor) => mudarFiltro("municipio", valor)}
            />
          ) : null}
          <Seletor
            id="aaStatus"
            rotulo="Status"
            vazio="Todos"
            opcoes={opcoesIguais(opcoes.status)}
            valor={filtros.status}
            aoMudar={(valor) => mudarFiltro("status", valor)}
          />
          <Seletor
            id="aaResponsavel"
            rotulo="Responsável"
            vazio="Todos"
            opcoes={opcoesIguais(opcoes.responsaveis)}
            valor={filtros.responsavel}
            aoMudar={(valor) => mudarFiltro("responsavel", valor)}
          />
          <div className="aa-campo aa-campo-busca">
            <label htmlFor="aaBusca">Buscar</label>
            <input
              id="aaBusca"
              type="search"
              autoComplete="off"
              placeholder="Candidato, vaga, responsável..."
              value={filtros.busca}
              onChange={(evento) => mudarFiltro("busca", evento.target.value)}
            />
          </div>
          <button
            id="aaLimpar"
            type="button"
            className="btn secondary aa-limpar"
            disabled={!filtrosLigados}
            onClick={() => setFiltros(FILTROS_VAZIOS)}
          >
            Limpar
          </button>
        </div>
      </div>

      {carga.erro && emDia ? (
        <div className="alert warn" role="alert">
          {carga.erro}{" "}
          <button
            type="button"
            className="btn secondary"
            onClick={() => void estado.recarregar()}
          >
            Tentar de novo
          </button>
        </div>
      ) : null}

      {semNada ? (
        <div className="table-card card aa-vazio" role="status">
          <i className="fa-solid fa-folder-open" aria-hidden="true" />
          <p>
            {area === "sede"
              ? MENSAGEM_DA_SEDE
              : carga.escopo === "ativo"
                ? "Nenhuma análise ativa nesta área."
                : "Nenhuma análise nesta situação."}
          </p>
        </div>
      ) : (
        <>
          <div className="aa-graficos">
            <GraficoPorResponsavel grupos={grupos} />
            <GraficoDiario dias={dias} />
          </div>
          <div className="table-card card">
            <TabelaDeAnalises
              linhas={filtradas}
              carregado={carregado || Boolean(carga.erro && emDia)}
              comMunicipio={comMunicipio}
              aoAbrir={setAberta}
              vazio="Nenhuma análise com esses filtros."
            />
          </div>
        </>
      )}

      {linhaAberta ? (
        <GavetaDoDetalhe
          linha={linhaAberta}
          area={area}
          editalJanela={janelaDoEdital(carga.editais, linhaAberta)}
          estado={estado}
          aoFechar={() => setAberta("")}
        />
      ) : null}
    </div>
  );
}

/**
 * Monta o painel em `#page-analises` e devolve o controlador que o legado
 * chama (`window.analisesDaAreaController`): `render()` ao abrir a página,
 * `recarregar()` para ignorar o cache.
 */
export function montarAnalisesDaArea({
  secao = document.getElementById("page-analises"),
  supabase = getSupabaseClient(),
  agora,
} = {}) {
  const estado = criarEstadoDasAnalises({ supabase });
  let raiz = null;
  if (secao) {
    raiz = createRoot(secao);
    raiz.render(
      <StrictMode>
        <AnalisesDaArea estado={estado} agora={agora} />
      </StrictMode>,
    );
  }
  return {
    estado,
    raiz,
    render: () => estado.abrir(),
    recarregar: () => estado.recarregar(),
  };
}
