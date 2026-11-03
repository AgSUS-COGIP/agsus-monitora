import type {
  EditalDoCalendario,
  EstadoDoCalendario,
  FiltrosDoCalendario,
  OpcoesDaTelaDoCalendario,
  SnapshotDoCalendario,
} from "./tipos.ts";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { montarModulo } from "../../app/montar-modulo.tsx";
import { getSupabaseClient } from "../../lib/supabaseClient";
import type { VisaoDoCalendario } from "../../lib/calendario-editais.ts";
import {
  CHAVE_DA_VISAO,
  FILTROS_VAZIOS,
  TIPOS_DA_LEGENDA,
  chaveDoDia,
  chavesDaSemana,
  contarEtapasNoIntervalo,
  contarEtapasNoMes,
  editaisComDatasARevisar,
  editaisDoFiltro,
  editalDaLinhaDoTempo,
  etapasDoEdital,
  filtrarEtapas,
  inicioDaSemana,
  intervaloDoMes,
  montarGradeDoMes,
  primeiroDoMes,
  proximasEtapas,
  rotuloDaContagem,
  rotuloDaContagemDaSemana,
  rotuloDaSemana,
  rotuloDoEdital,
  rotuloDoMes,
  somarDias,
  somarMeses,
  unidadesDasEtapas,
  visaoInicial,
  visaoValida,
} from "../../lib/calendario-editais.ts";
import { formatarDataHora } from "../../lib/cronograma-do-edital.ts";
import { soDosEditais } from "../../componentes/dados-do-monitoramento.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import {
  BlocosEsqueleto,
  Campo,
  classes,
  ErroAoCarregar,
  PainelDeFiltros,
  Segmentado,
  TopoDoPainel,
} from "../../ui/index.ts";
import { criarEstadoDoCalendario } from "./estado.ts";
import {
  AvisoDeDatasARevisar,
  DiaDoCalendario,
  GradeDoMes,
  GradeEsqueleto,
  LinhaDoTempo,
  ProximasEtapas,
  Seletor,
} from "./partes.tsx";
import { VistaDaLista, VistaDaSemana } from "./vistas.tsx";

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

  As etapas carregadas vivem em `estado.ts`; o que é da tela — mês à vista,
  filtros, dia aberto, edital da linha do tempo — é estado deste componente, e
  sobrevive a sair e voltar à página.
*/

const EVENTO_CRONOGRAMA_SALVO = "agsus:nucleo-cronograma-saved";

const TIPOS_DO_FILTRO: readonly (readonly [string, string])[] =
  TIPOS_DA_LEGENDA.map((tipo) => [tipo.id, tipo.rotulo]);

const OPCOES_DE_VISAO = [
  { valor: "mes", rotulo: "Mês" },
  { valor: "semana", rotulo: "Semana" },
  { valor: "lista", rotulo: "Lista" },
] as const;

/*
  A vista escolhida fica neste navegador (localStorage), por pessoa. Aba
  privada ou armazenamento bloqueado: vale só nesta visita.
*/
function visaoGuardada(): unknown {
  try {
    return globalThis.localStorage?.getItem(CHAVE_DA_VISAO);
  } catch {
    return null;
  }
}
function guardarVisao(visao: VisaoDoCalendario) {
  try {
    globalThis.localStorage?.setItem(CHAVE_DA_VISAO, visao);
  } catch {
    // Sem localStorage: a próxima visita abre na vista padrão.
  }
}
function ehCelular() {
  try {
    return Boolean(globalThis.matchMedia?.("(max-width: 640px)").matches);
  } catch {
    return false;
  }
}

function textoDoStatus({
  carregando,
  carregado,
  erro,
  carregadoEm,
}: SnapshotDoCalendario) {
  if (erro && !carregado) return "Sem dados";
  if (!carregado) return "Carregando dados...";
  if (carregando) return "Atualizando...";
  return carregadoEm
    ? `Atualizado em ${formatarDataHora(carregadoEm)}`
    : "Base carregada";
}

export function CalendarioEditais({
  estado,
  agora = () => new Date(),
}: {
  estado: EstadoDoCalendario;
  agora?: () => Date;
}) {
  const carga = useSyncExternalStore(estado.assinar, estado.obter);
  const { carregando, carregado, erro } = carga;
  /*
    As etapas chegam de todos os editais; a tela mostra só as dos editais da
    área escolhida no menu. O cache de `estado.ts` continua um só: trocar de
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
  const [semana, setSemana] = useState(() => inicioDaSemana(agora()));
  const [visao, setVisao] = useState<VisaoDoCalendario>(() =>
    visaoInicial(visaoGuardada(), ehCelular()),
  );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `hoje` entra pela chave do dia: o objeto Date muda a cada desenho.
    [etapas, filtros, ocultarConcluidas, hojeChave],
  );
  const celulas = useMemo(
    () => montarGradeDoMes(mes, filtradas, { hoje }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `hoje` entra pela chave do dia (ver acima).
    [mes, filtradas, hojeChave],
  );
  const chavesDaSemanaAberta = useMemo(() => chavesDaSemana(semana), [semana]);
  const doMes = intervaloDoMes(mes);
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
  const linhaDoTempo = useRef<HTMLOListElement>(null);
  const primeiraCarga = !carregado && !erro;

  // A linha do tempo é vertical e rola dentro do cartão: ao trocar de edital,
  // a etapa em andamento (ou a próxima) aparece sem a pessoa procurar.
  useEffect(() => {
    const lista = linhaDoTempo.current;
    if (!lista) return;
    const alvo =
      lista.querySelector<HTMLElement>('[data-situacao="em-andamento"]') ||
      lista.querySelector('[data-situacao="futura"]');
    lista.scrollTop = alvo
      ? Math.max(0, alvo.offsetTop - lista.offsetTop - 8)
      : 0;
  }, [editalDaLinha, etapasDaLinha]);

  const mudarFiltro = (chave: keyof FiltrosDoCalendario, valor: string) =>
    setFiltros((atuais) => ({ ...atuais, [chave]: valor }));

  function moverMes(passo: number) {
    // O dia aberto era do mês (ou da semana) anterior; deixá-lo aberto confundiria.
    setDiaAberto("");
    if (visao === "semana") {
      const nova = somarDias(semana, 7 * passo);
      setSemana(nova);
      // O mês acompanha a semana (pela quarta-feira): voltar ao Mês cai nela.
      setMes(primeiroDoMes(somarDias(nova, 3)));
      return;
    }
    setMes((atual) => somarMeses(atual, passo));
  }

  function irParaHoje() {
    // Volta ao mês corrente sem abrir o popup: "Hoje" é navegação, não consulta.
    setMes(primeiroDoMes(agora()));
    setSemana(inicioDaSemana(agora()));
    setDiaAberto("");
  }

  function mudarVisao(nova: VisaoDoCalendario) {
    if (!visaoValida(nova)) return;
    setVisao(nova);
    guardarVisao(nova);
    setDiaAberto("");
    // A Semana abre na semana de hoje, se o mês à vista é o de hoje; senão na do dia 1.
    if (nova === "semana" && visao !== "semana") {
      const hojeAgora = agora();
      const mesmoMes =
        primeiroDoMes(hojeAgora).getTime() === primeiroDoMes(mes).getTime();
      setSemana(inicioDaSemana(mesmoMes ? hojeAgora : mes));
    }
  }

  // "Ver todas na Lista": a Lista do mês de hoje, que já começa hoje.
  function verTodasNaLista() {
    irParaHoje();
    mudarVisao("lista");
  }

  const naSemana = visao === "semana";
  const passoAnterior = naSemana ? "Semana anterior" : "Mês anterior";
  const passoSeguinte = naSemana ? "Próxima semana" : "Próximo mês";

  function limparFiltros() {
    setFiltros(FILTROS_VAZIOS);
    setOcultarConcluidas(false);
  }

  const opcoesDeEdital = (
    lista: readonly EditalDoCalendario[],
  ): [string, string][] =>
    lista.map((edital) => [edital.id, rotuloDoEdital(edital)]);
  const quantos = Object.values(filtros).filter((valor) =>
    String(valor ?? "").trim(),
  ).length;
  const recarregar = () => void estado.carregar(true);

  return (
    <div className="ui-tela cronograma-tela">
      <TopoDoPainel
        tour="cronograma-topo"
        status={textoDoStatus(carga)}
        aoAtualizar={recarregar}
        atualizarDesativado={carregando}
      />

      <PainelDeFiltros
        tour="cronograma-filtros"
        idDoTitulo="calFiltrosTitulo"
        className="cal-filtros"
        quantos={quantos}
        escopo={ocultarConcluidas ? "Sem as concluídas" : "Todas as etapas"}
        podeLimpar={quantos > 0 || ocultarConcluidas}
        aoLimpar={limparFiltros}
      >
        <div
          className="ui-grade-de-campos"
          data-tour="cronograma-filtros-campos"
        >
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
          <label
            className="cal-caixa"
            data-tour="cronograma-ocultar-concluidas"
          >
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
        <div className="cal-barra" data-tour="cronograma-barra-do-mes">
          <span className="cal-nav">
            <button
              id="calMesAnterior"
              data-tour="cronograma-mes-anterior"
              className="btn secondary small"
              type="button"
              aria-label={passoAnterior}
              title={passoAnterior}
              onClick={() => moverMes(-1)}
            >
              <i className="fa-solid fa-chevron-left" aria-hidden="true" />
            </button>
            <button
              id="calMesSeguinte"
              data-tour="cronograma-mes-seguinte"
              className="btn secondary small"
              type="button"
              aria-label={passoSeguinte}
              title={passoSeguinte}
              onClick={() => moverMes(1)}
            >
              <i className="fa-solid fa-chevron-right" aria-hidden="true" />
            </button>
          </span>
          <h2 id="calMesTitulo" className="ui-titulo" aria-live="polite">
            {naSemana ? rotuloDaSemana(semana) : rotuloDoMes(mes)}
          </h2>
          <button
            id="calHoje"
            data-tour="cronograma-hoje"
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
            ) : naSemana ? (
              rotuloDaContagemDaSemana(
                contarEtapasNoIntervalo(
                  filtradas,
                  chavesDaSemanaAberta[0] ?? "",
                  chavesDaSemanaAberta[6] ?? "",
                ),
              )
            ) : (
              rotuloDaContagem(contarEtapasNoMes(filtradas, mes))
            )}
          </span>
          <Segmentado
            rotulo="Vista do calendário"
            className="cal-visoes"
            tour="cronograma-visoes"
            opcoes={OPCOES_DE_VISAO}
            valor={visao}
            aoMudar={mudarVisao}
          />
        </div>

        {/* Na Lista e na Semana o tipo vem escrito em cada linha. */}
        {visao === "mes" ? (
          <div
            id="calLegenda"
            className="cal-legenda"
            data-tour="cronograma-legenda"
          >
            {TIPOS_DA_LEGENDA.map((tipo) => (
              <span key={tipo.id} className="cal-legenda-item">
                <i data-cor={tipo.cor} aria-hidden="true" />
                {tipo.rotulo}
              </span>
            ))}
          </div>
        ) : null}
        <div
          id="calGrade"
          data-tour="cronograma-grade"
          data-visao={visao}
          aria-busy={primeiraCarga || undefined}
        >
          {erro ? (
            <ErroAoCarregar
              oQue="os cronogramas"
              mensagem={erro}
              aoTentar={recarregar}
            />
          ) : primeiraCarga ? (
            <GradeEsqueleto />
          ) : visao === "lista" ? (
            <VistaDaLista
              key={doMes.inicio}
              etapas={filtradas}
              inicio={doMes.inicio}
              fim={doMes.fim}
              hojeChave={hojeChave}
              aoAbrirDia={setDiaAberto}
            />
          ) : visao === "semana" ? (
            <VistaDaSemana
              etapas={filtradas}
              chaves={chavesDaSemanaAberta}
              hojeChave={hojeChave}
              aoAbrirDia={setDiaAberto}
            />
          ) : (
            <GradeDoMes
              celulas={celulas}
              etapas={filtradas}
              selecionado={diaAberto}
              aoEscolherDia={setDiaAberto}
            />
          )}
        </div>
      </section>

      <div
        className={classes(
          "ui-linha-de-cards cal-inferior",
          visao !== "mes" && "so-linha-do-tempo",
        )}
      >
        {/*
          Só no Mês: na Lista e na Semana as mesmas etapas já estão no card de
          cima, e repetir a lista aqui embaixo era informação em dobro.
        */}
        {visao === "mes" ? (
          <section
            className="ui-card ui-pilha"
            data-tour="cronograma-proximas"
            aria-labelledby="calProximasTitulo"
          >
            <div className="cal-cabecalho">
              <h2 className="ui-titulo" id="calProximasTitulo">
                Próximas etapas
              </h2>
              <button
                id="calVerNaLista"
                type="button"
                className="btn secondary small"
                onClick={verTodasNaLista}
              >
                Ver todas na Lista
              </button>
            </div>
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
        ) : null}

        <section
          className="ui-card ui-pilha"
          data-tour="cronograma-linha-do-tempo"
          aria-labelledby="calTimelineTitulo"
        >
          <div
            className="cal-cabecalho"
            data-tour="cronograma-edital-da-linha-do-tempo"
          >
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
}: OpcoesDaTelaDoCalendario = {}) {
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
      seguintes, o cache de `estado.ts` desenha na hora.
    */
    render: () => estado.carregar(),
    recarregar: () => estado.carregar(true),
  };
}
