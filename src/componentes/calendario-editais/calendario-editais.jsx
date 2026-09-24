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
  FILTROS_VAZIOS,
  TIPOS_DA_LEGENDA,
  chaveDoDia,
  contarEtapasNoMes,
  editaisComDatasARevisar,
  editaisDoFiltro,
  editalDaLinhaDoTempo,
  etapasDoEdital,
  filtrarEtapas,
  montarGradeDoMes,
  primeiroDoMes,
  proximasEtapas,
  rotuloDaContagem,
  rotuloDoEdital,
  rotuloDoMes,
  somarMeses,
  unidadesDasEtapas,
} from "../../lib/calendario-editais.js";
import { criarEstadoDoCalendario } from "./estado.js";
import {
  AvisoDeDatasARevisar,
  DiaDoCalendario,
  GradeDoMes,
  LinhaDoTempo,
  ProximasEtapas,
  Seletor,
} from "./partes.jsx";

/*
  Calendário de Editais, em React — a página `#page-calendario`.

  Leitura, em calendário, dos cronogramas que a Equipe Núcleo cadastra: esta
  tela não escreve nada. O React é dono de tudo dentro da `<section>`; o legado
  só troca a classe `.active` dela e chama `render()` do controlador
  (`window.calendarioEditaisController`) ao abrir a página.

  As etapas carregadas vivem em `estado.js`; o que é da tela — mês à vista,
  filtros, dia aberto, edital da linha do tempo — é estado deste componente, e
  sobrevive a sair e voltar à página.
*/

const EVENTO_CRONOGRAMA_SALVO = "agsus:nucleo-cronograma-saved";
const TIPOS_DO_FILTRO = TIPOS_DA_LEGENDA.map((tipo) => [tipo.id, tipo.rotulo]);

export function CalendarioEditais({ estado, agora = () => new Date() }) {
  const { etapas, editais, carregando, carregado, erro } = useSyncExternalStore(
    estado.assinar,
    estado.obter,
  );
  const [mes, setMes] = useState(() => primeiroDoMes(agora()));
  const [diaAberto, setDiaAberto] = useState("");
  const [editalEscolhido, setEditalEscolhido] = useState("");
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  /*
    Concluídas escondidas à partida. São a maior fatia das ~800 etapas e o que
    já passou raramente é o que se vem ver. Continua a um clique de distância,
    pela caixa na barra de filtros — não é uma regra, é um padrão.
  */
  const [ocultarConcluidas, setOcultarConcluidas] = useState(true);

  // O cronograma mudou noutra tela: o cache aqui ficou velho.
  useEffect(() => {
    document.addEventListener(EVENTO_CRONOGRAMA_SALVO, estado.invalidar);
    return () =>
      document.removeEventListener(EVENTO_CRONOGRAMA_SALVO, estado.invalidar);
  }, [estado]);

  const hoje = agora();
  const hojeChave = chaveDoDia(hoje);

  const filtradas = useMemo(
    () => filtrarEtapas(etapas, filtros, { ocultarConcluidas, hoje }),
    // `hoje` entra pela chave do dia: o objeto Date muda a cada desenho.
    [etapas, filtros, ocultarConcluidas, hojeChave],
  );
  const celulas = useMemo(
    () => montarGradeDoMes(mes, filtradas, { hoje }),
    [mes, filtradas, hojeChave],
  );
  const unidades = useMemo(() => unidadesDasEtapas(etapas), [etapas]);
  const editaisVisiveis = useMemo(
    () => editaisDoFiltro(editais, filtradas),
    [editais, filtradas],
  );
  const editalDaLinha = editalDaLinhaDoTempo(editalEscolhido, editaisVisiveis);
  const etapasDaLinha = useMemo(
    () => etapasDoEdital(etapas, editalDaLinha),
    [etapas, editalDaLinha],
  );

  const mudarFiltro = (chave, valor) =>
    setFiltros((atuais) => ({ ...atuais, [chave]: valor }));

  function moverMes(passo) {
    setMes((atual) => somarMeses(atual, passo));
    // O dia aberto era do mês anterior; deixá-lo aberto confundiria.
    setDiaAberto("");
  }

  function irParaHoje() {
    // Volta ao mês corrente sem abrir o popup: "Hoje" é navegação, não consulta.
    setMes(primeiroDoMes(agora()));
    setDiaAberto("");
  }

  function limparFiltros() {
    setFiltros(FILTROS_VAZIOS);
    setOcultarConcluidas(false);
  }

  const opcoesDeEdital = (lista) =>
    lista.map((edital) => [edital.id, rotuloDoEdital(edital)]);

  return (
    <>
      <div className="table-card card cal-card">
        <div className="cal-barra">
          <span className="cal-nav">
            <button
              id="calMesAnterior"
              type="button"
              aria-label="Mês anterior"
              title="Mês anterior"
              onClick={() => moverMes(-1)}
            >
              <i className="fa-solid fa-chevron-left" aria-hidden="true" />
            </button>
            <button
              id="calMesSeguinte"
              type="button"
              aria-label="Próximo mês"
              title="Próximo mês"
              onClick={() => moverMes(1)}
            >
              <i className="fa-solid fa-chevron-right" aria-hidden="true" />
            </button>
          </span>
          <h3 id="calMesTitulo" aria-live="polite">
            {rotuloDoMes(mes)}
          </h3>
          <button
            id="calHoje"
            className="btn secondary"
            type="button"
            onClick={irParaHoje}
          >
            Hoje
          </button>
          <span id="calContador" className="chip blue">
            {/* Carregando não é zero (DESIGN.md, seção 4). */}
            {carregando && !carregado
              ? "Carregando…"
              : rotuloDaContagem(contarEtapasNoMes(filtradas, mes))}
          </span>

          <div className="cal-filtros">
            <label className="sr-only" htmlFor="calBusca">
              Pesquisar etapa, edital ou unidade
            </label>
            <input
              id="calBusca"
              className="cal-busca"
              type="search"
              autoComplete="off"
              placeholder="Pesquisar etapa, edital ou unidade..."
              title="Pesquisar etapa, edital ou unidade"
              value={filtros.busca}
              onChange={(evento) => mudarFiltro("busca", evento.target.value)}
            />
            <label className="sr-only" htmlFor="calUnidade">
              Unidade
            </label>
            <Seletor
              id="calUnidade"
              title="Unidade"
              vazio="Todas as unidades"
              opcoes={unidades.map((unidade) => [unidade, unidade])}
              valor={filtros.unidade}
              aoMudar={(valor) => mudarFiltro("unidade", valor)}
            />
            <label className="sr-only" htmlFor="calEdital">
              Edital
            </label>
            <Seletor
              id="calEdital"
              title="Edital"
              vazio="Todos os editais"
              opcoes={opcoesDeEdital(editais)}
              valor={filtros.edital}
              aoMudar={(valor) => mudarFiltro("edital", valor)}
            />
            <label className="sr-only" htmlFor="calTipo">
              Tipo de etapa
            </label>
            <Seletor
              id="calTipo"
              title="Tipo de etapa"
              vazio="Todos os tipos"
              opcoes={TIPOS_DO_FILTRO}
              valor={filtros.tipo}
              aoMudar={(valor) => mudarFiltro("tipo", valor)}
            />
            <label className="cal-caixa">
              <input
                id="calOcultarConcluidas"
                type="checkbox"
                checked={ocultarConcluidas}
                onChange={(evento) =>
                  setOcultarConcluidas(evento.target.checked)
                }
              />
              Ocultar concluídas
            </label>
            <button
              id="calLimparFiltros"
              className="btn secondary"
              type="button"
              onClick={limparFiltros}
            >
              Limpar
            </button>
          </div>
        </div>

        <div id="calLegenda" className="cal-legenda">
          {TIPOS_DA_LEGENDA.map((tipo) => (
            <span key={tipo.id} className="cal-legenda-item">
              <i data-cor={tipo.cor} />
              {tipo.rotulo}
            </span>
          ))}
        </div>
        <div id="calGrade">
          {erro ? (
            <div className="alert warn">{erro}</div>
          ) : (
            <GradeDoMes
              celulas={celulas}
              selecionado={diaAberto}
              aoEscolherDia={setDiaAberto}
            />
          )}
        </div>
      </div>

      <div className="cal-inferior">
        <div className="table-card card">
          <div className="table-head">
            <h3>
              <i className="fa-solid fa-list-check" aria-hidden="true" />{" "}
              Próximas etapas
            </h3>
          </div>
          <div id="calProximas">
            <AvisoDeDatasARevisar editais={editaisComDatasARevisar(etapas)} />
            <ProximasEtapas
              etapas={proximasEtapas(filtradas, hoje)}
              hoje={hoje}
              aoEscolher={setEditalEscolhido}
            />
          </div>
        </div>

        <div className="table-card card">
          <div className="table-head">
            <h3>
              <i className="fa-solid fa-diagram-project" aria-hidden="true" />{" "}
              Linha do tempo do edital
            </h3>
            <label className="sr-only" htmlFor="calTimelineEdital">
              Edital da linha do tempo
            </label>
            <Seletor
              id="calTimelineEdital"
              vazio="Selecione um edital"
              opcoes={opcoesDeEdital(editaisVisiveis)}
              valor={editalDaLinha}
              aoMudar={setEditalEscolhido}
            />
          </div>
          <ol id="calTimeline" className="cal-timeline">
            <LinhaDoTempo
              editalId={editalDaLinha}
              etapas={etapasDaLinha}
              hoje={hoje}
            />
          </ol>
        </div>
      </div>

      {diaAberto ? (
        <DiaDoCalendario
          chave={diaAberto}
          etapas={filtradas}
          aoFechar={() => setDiaAberto("")}
          aoEscolherEdital={setEditalEscolhido}
        />
      ) : null}
    </>
  );
}

/**
 * Monta o calendário em `#page-calendario` e devolve o controlador que o
 * legado chama (`window.calendarioEditaisController`): `render()` ao abrir a
 * página, `recarregar()` para ignorar o cache.
 */
export function montarCalendarioEditais({
  secao = document.getElementById("page-calendario"),
  supabase = getSupabaseClient(),
  toast,
  agora,
} = {}) {
  const estado = criarEstadoDoCalendario({ supabase, toast });
  let raiz = null;
  if (secao) {
    raiz = createRoot(secao);
    raiz.render(
      <StrictMode>
        <CalendarioEditais estado={estado} agora={agora} />
      </StrictMode>,
    );
  }
  return {
    estado,
    raiz,
    /*
      Sem o carregamento de tela cheia: ele travava a navegação inteira. A
      grade já mostra "Carregando…" enquanto a primeira carga não chega
      (`carregando && !carregado`, no contador do mês); nas seguintes, o cache
      de `estado.js` desenha na hora.
    */
    render: () => estado.carregar(),
    recarregar: () => estado.carregar(true),
  };
}
