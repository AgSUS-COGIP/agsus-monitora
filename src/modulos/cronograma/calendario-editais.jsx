import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { montarModulo } from "../../app/montar-modulo.jsx";
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
import { formatarDataHora } from "../../lib/cronograma-do-edital.js";
import { soDosEditais } from "../../componentes/dados-do-monitoramento.js";
import { usarAreaAtual } from "../../componentes/usar-area-atual.js";
import {
  BlocosEsqueleto,
  Campo,
  ErroAoCarregar,
  PainelDeFiltros,
  TopoDoPainel,
} from "../../ui/index.js";
import { criarEstadoDoCalendario } from "./estado.js";
import {
  AvisoDeDatasARevisar,
  DiaDoCalendario,
  GradeDoMes,
  GradeEsqueleto,
  LinhaDoTempo,
  ProximasEtapas,
  Seletor,
} from "./partes.jsx";

/*
  Cronograma (view `calendario`), módulo do app — a página `#page-calendario`.

  Leitura, em calendário, dos cronogramas que se cadastram em Editais: esta
  tela não escreve nada. O React é dono de tudo dentro da `<section>`; o
  legado só troca a classe `.active` dela e chama `render()` do controlador
  (`window.calendarioEditaisController`) ao abrir a página.

  Padrão das telas de src/modulos/: topo com a data da carga e Atualizar;
  filtros recolhíveis (nascem recolhidos); o mês, as próximas etapas e a linha
  do tempo em cards. Antes da primeira carga, a grade e as listas são
  skeleton; se ela falha, o aviso com "Tentar novamente" fica no lugar da
  grade.

  As etapas carregadas vivem em `estado.js`; o que é da tela — mês à vista,
  filtros, dia aberto, edital da linha do tempo — é estado deste componente, e
  sobrevive a sair e voltar à página.
*/

const EVENTO_CRONOGRAMA_SALVO = "agsus:nucleo-cronograma-saved";
const TIPOS_DO_FILTRO = TIPOS_DA_LEGENDA.map((tipo) => [tipo.id, tipo.rotulo]);

function textoDoStatus({ carregando, carregado, erro, carregadoEm }) {
  if (erro && !carregado) return "Sem dados";
  if (!carregado) return "Carregando dados...";
  if (carregando) return "Atualizando...";
  return carregadoEm
    ? `Atualizado em ${formatarDataHora(carregadoEm)}`
    : "Base carregada";
}

export function CalendarioEditais({ estado, agora = () => new Date() }) {
  const carga = useSyncExternalStore(estado.assinar, estado.obter);
  const { carregando, carregado, erro } = carga;
  /*
    As etapas chegam de todos os editais; a tela mostra só as dos editais da
    área escolhida no menu. O cache de `estado.js` continua um só: trocar de
    área não repete os pedidos.
  */
  const { ids } = usarAreaAtual();
  const etapas = useMemo(
    () => soDosEditais(carga.etapas, ids, "editalId"),
    [carga.etapas, ids],
  );
  const editais = useMemo(
    () => soDosEditais(carga.editais, ids, "id"),
    [carga.editais, ids],
  );
  const [mes, setMes] = useState(() => primeiroDoMes(agora()));
  const [diaAberto, setDiaAberto] = useState("");
  const [editalEscolhido, setEditalEscolhido] = useState("");
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  /*
    Concluídas escondidas à partida. São a maior fatia das ~800 etapas e o que
    já passou raramente é o que se vem ver. Continua a um clique de distância,
    pela caixa nos filtros — não é uma regra, é um padrão.
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
  const linhaDoTempo = useRef(null);
  const primeiraCarga = !carregado && !erro;

  // A linha do tempo é vertical e rola dentro do cartão: ao trocar de edital,
  // a etapa em andamento (ou a próxima) aparece sem a pessoa procurar.
  useEffect(() => {
    const lista = linhaDoTempo.current;
    if (!lista) return;
    const alvo =
      lista.querySelector('[data-situacao="em-andamento"]') ||
      lista.querySelector('[data-situacao="futura"]');
    lista.scrollTop = alvo
      ? Math.max(0, alvo.offsetTop - lista.offsetTop - 8)
      : 0;
  }, [editalDaLinha, etapasDaLinha]);

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
  const quantos = Object.values(filtros).filter((valor) =>
    String(valor ?? "").trim(),
  ).length;
  const recarregar = () => void estado.carregar(true);

  return (
    <div className="ui-tela cronograma-tela">
      <TopoDoPainel
        status={textoDoStatus(carga)}
        aoAtualizar={recarregar}
        atualizarDesativado={carregando}
      />

      <PainelDeFiltros
        idDoTitulo="calFiltrosTitulo"
        className="cal-filtros"
        quantos={quantos}
        escopo={ocultarConcluidas ? "Sem as concluídas" : "Todas as etapas"}
        podeLimpar={quantos > 0 || ocultarConcluidas}
        aoLimpar={limparFiltros}
      >
        <div className="ui-grade-de-campos">
          <Campo rotulo="Pesquisar">
            <input
              id="calBusca"
              type="search"
              autoComplete="off"
              placeholder="Etapa, edital ou unidade"
              value={filtros.busca}
              onChange={(evento) => mudarFiltro("busca", evento.target.value)}
            />
          </Campo>
          <Campo rotulo="Unidade" idDoControle="calUnidade">
            <Seletor
              id="calUnidade"
              vazio="Todas as unidades"
              opcoes={unidades.map((unidade) => [unidade, unidade])}
              valor={filtros.unidade}
              aoMudar={(valor) => mudarFiltro("unidade", valor)}
            />
          </Campo>
          <Campo rotulo="Edital" idDoControle="calEdital">
            <Seletor
              id="calEdital"
              vazio="Todos os editais"
              opcoes={opcoesDeEdital(editais)}
              valor={filtros.edital}
              aoMudar={(valor) => mudarFiltro("edital", valor)}
            />
          </Campo>
          <Campo rotulo="Tipo de etapa" idDoControle="calTipo">
            <Seletor
              id="calTipo"
              vazio="Todos os tipos"
              opcoes={TIPOS_DO_FILTRO}
              valor={filtros.tipo}
              aoMudar={(valor) => mudarFiltro("tipo", valor)}
            />
          </Campo>
          <label className="cal-caixa">
            <input
              id="calOcultarConcluidas"
              type="checkbox"
              checked={ocultarConcluidas}
              onChange={(evento) => setOcultarConcluidas(evento.target.checked)}
            />
            Ocultar concluídas
          </label>
        </div>
      </PainelDeFiltros>

      <section className="ui-card cal-card" aria-labelledby="calMesTitulo">
        <div className="cal-barra">
          <span className="cal-nav">
            <button
              id="calMesAnterior"
              className="btn secondary small"
              type="button"
              aria-label="Mês anterior"
              title="Mês anterior"
              onClick={() => moverMes(-1)}
            >
              <i className="fa-solid fa-chevron-left" aria-hidden="true" />
            </button>
            <button
              id="calMesSeguinte"
              className="btn secondary small"
              type="button"
              aria-label="Próximo mês"
              title="Próximo mês"
              onClick={() => moverMes(1)}
            >
              <i className="fa-solid fa-chevron-right" aria-hidden="true" />
            </button>
          </span>
          <h2 id="calMesTitulo" className="ui-titulo" aria-live="polite">
            {rotuloDoMes(mes)}
          </h2>
          <button
            id="calHoje"
            className="btn secondary small"
            type="button"
            onClick={irParaHoje}
          >
            Hoje
          </button>
          <span id="calContador" className="cal-contador">
            {/* Carregando não é zero (DESIGN.md, seção 4). */}
            {primeiraCarga ? (
              <span
                className="ui-esqueleto ui-esqueleto-linha cal-contador-esqueleto"
                aria-hidden="true"
              />
            ) : (
              rotuloDaContagem(contarEtapasNoMes(filtradas, mes))
            )}
          </span>
        </div>

        <div id="calLegenda" className="cal-legenda">
          {TIPOS_DA_LEGENDA.map((tipo) => (
            <span key={tipo.id} className="cal-legenda-item">
              <i data-cor={tipo.cor} />
              {tipo.rotulo}
            </span>
          ))}
        </div>
        <div id="calGrade" aria-busy={primeiraCarga || undefined}>
          {erro ? (
            <ErroAoCarregar
              oQue="os cronogramas"
              mensagem={erro}
              aoTentar={recarregar}
            />
          ) : primeiraCarga ? (
            <GradeEsqueleto />
          ) : (
            <GradeDoMes
              celulas={celulas}
              selecionado={diaAberto}
              aoEscolherDia={setDiaAberto}
            />
          )}
        </div>
      </section>

      <div className="ui-linha-de-cards cal-inferior">
        <section
          className="ui-card ui-pilha"
          aria-labelledby="calProximasTitulo"
        >
          <h2 className="ui-titulo" id="calProximasTitulo">
            Próximas etapas
          </h2>
          <div id="calProximas" aria-busy={primeiraCarga || undefined}>
            {primeiraCarga ? (
              <BlocosEsqueleto quantos={4} className="cal-item-esqueleto" />
            ) : (
              <>
                <AvisoDeDatasARevisar
                  editais={editaisComDatasARevisar(etapas)}
                />
                <ProximasEtapas
                  etapas={proximasEtapas(filtradas, hoje)}
                  hoje={hoje}
                  aoEscolher={setEditalEscolhido}
                />
              </>
            )}
          </div>
        </section>

        <section
          className="ui-card ui-pilha"
          aria-labelledby="calTimelineTitulo"
        >
          <div className="cal-cabecalho">
            <h2 className="ui-titulo" id="calTimelineTitulo">
              Linha do tempo do edital
            </h2>
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
          <ol
            id="calTimeline"
            className="cal-timeline"
            ref={linhaDoTempo}
            aria-busy={primeiraCarga || undefined}
          >
            {primeiraCarga ? (
              <BlocosEsqueleto
                quantos={4}
                como="li"
                className="cal-item-esqueleto"
              />
            ) : (
              <LinhaDoTempo
                editalId={editalDaLinha}
                etapas={etapasDaLinha}
                hoje={hoje}
              />
            )}
          </ol>
        </section>
      </div>

      {diaAberto ? (
        <DiaDoCalendario
          chave={diaAberto}
          etapas={filtradas}
          aoFechar={() => setDiaAberto("")}
          aoEscolherEdital={setEditalEscolhido}
        />
      ) : null}
    </div>
  );
}

/**
 * Monta o Cronograma em `#page-calendario` e devolve o controlador que o
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
  const raiz = secao
    ? montarModulo(secao, <CalendarioEditais estado={estado} agora={agora} />, {
        nome: "a tela de cronograma",
      }).raiz
    : null;
  return {
    estado,
    raiz,
    /*
      Sem o carregamento de tela cheia: ele travava a navegação inteira. A
      grade e as listas são skeleton enquanto a primeira carga não chega; nas
      seguintes, o cache de `estado.js` desenha na hora.
    */
    render: () => estado.carregar(),
    recarregar: () => estado.carregar(true),
  };
}
