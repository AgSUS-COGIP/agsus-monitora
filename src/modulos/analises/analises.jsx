import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usarPedidoDeFiltro } from "../../app/pedido-de-filtro.js";
import { filtrosDasAnalises } from "../../lib/filtro-da-aya.js";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { usarTemaEscuro } from "../../app/tema.js";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.js";
import { usarAreaAtual } from "../../componentes/usar-area-atual.js";
import {
  apararSelecao,
  calcularKpis,
  descricaoDoRecorte,
  ESCOPO_PADRAO,
  filtrarLinhas,
  filtrarPorPeriodo,
  FILTROS_VAZIOS,
  formatarDataHora,
  marcasDoRecorte,
  opcoesDosFiltros,
  pendenciasPrioritarias,
  PERIODO_VAZIO,
  periodoDoClique,
  quantosFiltros,
  recorteVisual,
  rotuloDoPeriodo,
  temMunicipio,
  temPeriodo,
  ultimaAtualizacao,
} from "../../lib/analises-curriculares.js";
import { getLoadingStage } from "../../lib/loading-copy.js";
import { textoDaConferencia } from "../../lib/texto-da-conferencia.js";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { haLinhasSemParecer } from "../../lib/textos-do-painel-de-analises.js";
import {
  Aviso,
  ChipDeFiltro,
  ChipsDeFiltro,
  LinhaDoRecorte,
  MarcasDoRecorte,
  TopoDoPainel,
} from "../../ui/index.js";
import { criarEstadoDasAnalises } from "./estado.js";
import { GavetaDaAnalise } from "./gaveta.jsx";
import { chipsDosFiltros, Filtros, Graficos, Indicadores } from "./paineis.jsx";
import { TabelaDeAnalises } from "./tabela.jsx";

/*
  A tela de Análises curriculares (view `analises`), um módulo do app: monta
  direto na `<section id="page-analises">` do index.html, como Recursos. O
  legado continua dono da classe `.active` da seção e chama `render()` do
  controlador ao navegar (tabela `TELAS_REACT` do `navigate`).

  - Área: a atual do app (menu lateral → dados-do-monitoramento.js); trocar de
    área com a tela aberta recarrega, e filtros, busca e gaveta recomeçam.
  - Sessão: o cliente Supabase único do app. Tema: o do app (os gráficos
    acompanham). Tela cheia: a do app. Aviso (toast): o do app.
  - Permissão: o porteiro do banco (`usuario_pode_ler_analises`) a cada carga.
  - Sem tela de carregamento: o skeleton dos KPIs, gráficos, pendências e
    fila; demora vira aviso discreto (12 s) e depois "Tentar novamente" (25 s).

  O que é só da tela — filtros, busca, KPI, responsável e data escolhidos nos
  gráficos — é estado do componente; os dados e as ações moram em estado.js.

  A data (o dia clicado em "Análises por data", ou o período dos campos de
  "Mais opções") recorta KPIs, carga por responsável, pendências e fila; o
  próprio gráfico de datas continua com todos os dias, para trocar de dia.
*/

const ESPERA_DA_BUSCA_MS = 180;
const MARCOS_DE_DEMORA_MS = [12_000, 25_000];
const KPIS_ZERADOS = calcularKpis([]);

function textoDoStatus(e) {
  if (e.semSessao) return "Sessão não localizada";
  if (e.semAcesso) return "Sem acesso";
  if (e.erroAoCarregar && !e.carregado) return "Sem dados";
  if (!e.carregado) return "Carregando dados...";
  if (e.atualizando) return "Atualizando...";
  const ultima = ultimaAtualizacao(e.linhas, e.payload);
  return (
    textoDaConferencia({ conferidoEm: e.conferidoEm, mudancaEm: ultima }) ||
    (ultima ? `Atualizado em ${formatarDataHora(ultima)}` : "Base carregada")
  );
}

/* Quanto tempo a primeira carga está levando: `null`, ou a etapa de demora. */
function usarDemora(carregando) {
  const [etapa, setEtapa] = useState(null);
  useEffect(() => {
    setEtapa(null);
    if (!carregando) return undefined;
    const temporizadores = MARCOS_DE_DEMORA_MS.map((ms) =>
      setTimeout(() => setEtapa(getLoadingStage({ elapsedMs: ms })), ms),
    );
    return () => temporizadores.forEach(clearTimeout);
  }, [carregando]);
  return etapa;
}

/* O valor depois de `ms` sem mudar (a busca geral não filtra a cada tecla). */
function usarComEspera(valor, ms) {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const espera = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(espera);
  }, [valor, ms]);
  return atrasado;
}

function AvisoDaTela({ e, demora, aoTentarDeNovo }) {
  if (e.semSessao || e.semAcesso)
    return (
      <Aviso tom="warning" papel="alert">
        {e.erroAoCarregar}
      </Aviso>
    );
  if (e.erroAoCarregar && !e.carregado)
    return (
      <Aviso tom="danger" papel="alert">
        Não foi possível carregar as análises: {e.erroAoCarregar}{" "}
        <button
          type="button"
          className="btn secondary small"
          onClick={aoTentarDeNovo}
        >
          Tentar novamente
        </button>
      </Aviso>
    );
  if (demora && !e.carregado)
    return (
      <Aviso tom="info" papel="status">
        {demora.delayMessage}{" "}
        {demora.canRetry ? (
          <button
            type="button"
            className="btn secondary small"
            onClick={aoTentarDeNovo}
          >
            Tentar novamente
          </button>
        ) : null}
      </Aviso>
    );
  return null;
}

/* Liga/desliga um único valor num filtro de seleção múltipla (o atalho das pendências). */
const soEsse = (selecao, valor) =>
  selecao.length === 1 && selecao[0] === valor ? [] : [valor];
const soEsseAtivo = (selecao, valor) =>
  selecao.length === 1 && selecao[0] === valor;

/*
  A tela de uma área. Monta de novo quando a área muda (`key`): filtros,
  busca, KPI e o responsável do gráfico recomeçam.
*/
function TelaDaArea({ estado, e }) {
  const escuro = usarTemaEscuro();
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [buscaDigitada, setBuscaDigitada] = useState("");
  const [buscaDaFila, setBuscaDaFila] = useState("");
  const [kpi, setKpi] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [periodo, setPeriodo] = useState(PERIODO_VAZIO);
  const busca = usarComEspera(buscaDigitada, ESPERA_DA_BUSCA_MS);
  const { carregado, linhas, area, escopo } = e;

  const demora = usarDemora(
    Boolean(area) &&
      !carregado &&
      !e.erroAoCarregar &&
      !e.semSessao &&
      !e.semAcesso,
  );

  // A busca digitada entra no filtro depois do respiro.
  useEffect(() => {
    setFiltros((atuais) =>
      atuais.busca === busca ? atuais : { ...atuais, busca },
    );
  }, [busca]);

  // Carga nova (outro escopo, versão nova): a seleção fica com o que existe.
  useEffect(() => {
    if (carregado) setFiltros((atuais) => apararSelecao(atuais, linhas));
  }, [carregado, linhas]);

  // "Abrir" numa resposta com número da Aya: a tela abre já recortada.
  usarPedidoDeFiltro("analises", carregado, (pedido) => {
    const proximo = filtrosDasAnalises(filtros, pedido, linhas, kpi);
    setFiltros(proximo.filtros);
    setKpi(proximo.kpi);
  });

  // Buscar (geral ou na fila) inclui o parecer: traz os pareceres em lote.
  const buscando = Boolean(filtros.busca.trim() || buscaDaFila.trim());
  useEffect(() => {
    if (buscando && carregado && haLinhasSemParecer(linhas))
      void estado.garantirTextos();
  }, [buscando, carregado, linhas, estado]);

  const filtradas = useMemo(
    () => filtrarLinhas(linhas, filtros),
    [linhas, filtros],
  );
  const opcoes = useMemo(
    () => opcoesDosFiltros(linhas, filtros),
    [linhas, filtros],
  );
  // O gráfico de datas vê o recorte sem a data; o resto, com ela.
  const recorteSemData = useMemo(
    () => recorteVisual(filtradas, { kpi, responsavel }),
    [filtradas, kpi, responsavel],
  );
  const recorte = useMemo(
    () => filtrarPorPeriodo(recorteSemData, periodo),
    [recorteSemData, periodo],
  );
  const comData = temPeriodo(periodo);
  const clicarNoDia = (dia, opcoes) =>
    setPeriodo((atual) => periodoDoClique(atual, dia, opcoes));
  const tirarData = () => setPeriodo(PERIODO_VAZIO);
  const kpis = useMemo(
    () => (carregado ? calcularKpis(recorte) : KPIS_ZERADOS),
    [carregado, recorte],
  );
  const marcas = useMemo(() => marcasDoRecorte(recorte), [recorte]);

  const mudarFiltro = (campo, valores) =>
    setFiltros((atuais) => ({ ...atuais, [campo]: valores }));
  const buscar = (texto) => {
    setBuscaDigitada(texto);
    if (!texto) setFiltros((atuais) => ({ ...atuais, busca: "" }));
  };

  function aplicarAtalho({ tipo, valor }) {
    if (tipo === "kpi") setKpi((atual) => (atual === valor ? "" : valor));
    if (tipo === "validacao")
      setFiltros((atuais) => ({
        ...atuais,
        validacao: soEsse(atuais.validacao, valor),
      }));
    if (tipo === "responsavel")
      setFiltros((atuais) => ({
        ...atuais,
        responsavel: soEsse(atuais.responsavel, valor),
      }));
  }
  const atalhoAtivo = ({ tipo, valor }) =>
    (tipo === "kpi" && kpi === valor) ||
    (tipo === "validacao" && soEsseAtivo(filtros.validacao, valor)) ||
    (tipo === "responsavel" && soEsseAtivo(filtros.responsavel, valor));
  const pendencias = pendenciasPrioritarias(recorte).map((p) => ({
    ...p,
    ativo: atalhoAtivo(p.atalho),
    aoClicar: () => aplicarAtalho(p.atalho),
  }));

  function limparTudo() {
    setFiltros(FILTROS_VAZIOS);
    setBuscaDigitada("");
    setBuscaDaFila("");
    setKpi("");
    setResponsavel("");
    setPeriodo(PERIODO_VAZIO);
    if (escopo !== ESCOPO_PADRAO) void estado.trocarEscopo(ESCOPO_PADRAO);
  }
  const podeLimpar = Boolean(
    quantosFiltros(filtros) ||
    buscaDigitada ||
    buscaDaFila ||
    kpi ||
    responsavel ||
    comData ||
    escopo !== ESCOPO_PADRAO,
  );

  const chips = chipsDosFiltros({
    escopo,
    filtros,
    kpi,
    responsavel,
    periodo,
    aoTirarEscopo: () => void estado.trocarEscopo(ESCOPO_PADRAO),
    aoMudar: mudarFiltro,
    aoBuscar: buscar,
    aoKpi: setKpi,
    aoResponsavel: setResponsavel,
    aoTirarData: tirarData,
  });

  // O CSV refaz o recorte com as linhas completas (com os pareceres).
  const exportar = () =>
    void estado.exportarCsv((todas) =>
      filtrarPorPeriodo(
        recorteVisual(filtrarLinhas(todas, filtros), { kpi, responsavel }),
        periodo,
      ),
    );
  const recarregar = () => void estado.carregar(area);
  const aberto = e.gaveta ? linhas.find((l) => l.__chave === e.gaveta) : null;

  return (
    <div className="ui-tela analises-tela">
      <TopoDoPainel
        tour="analises-topo"
        status={textoDoStatus(e)}
        aoAtualizar={() => void estado.atualizar()}
        atualizarDesativado={
          !area || e.atualizando || e.semSessao || e.semAcesso
        }
        aoExportar={exportar}
        exportarDesativado={!carregado || !recorte.length}
      />

      <AvisoDaTela e={e} demora={demora} aoTentarDeNovo={recarregar} />

      <Filtros
        escopo={escopo}
        aoEscopo={(valor) => void estado.trocarEscopo(valor)}
        filtros={filtros}
        opcoes={opcoes}
        busca={buscaDigitada}
        aoBuscar={buscar}
        aoMudar={mudarFiltro}
        aoLimpar={limparTudo}
        podeLimpar={podeLimpar}
        carregado={carregado}
        comMunicipio={temMunicipio(linhas, area)}
        periodo={periodo}
        aoPeriodo={setPeriodo}
        chips={chips}
      />
      <Indicadores kpis={kpis} carregado={carregado} kpi={kpi} aoKpi={setKpi} />
      <LinhaDoRecorte
        texto={descricaoDoRecorte({
          escopo,
          filtros,
          kpi,
          responsavel,
          periodo,
        })}
      >
        {comData ? (
          <ChipsDeFiltro>
            <ChipDeFiltro rotulo="Data" aoTirar={tirarData}>
              {rotuloDoPeriodo(periodo)}
            </ChipDeFiltro>
          </ChipsDeFiltro>
        ) : null}
        {carregado ? <MarcasDoRecorte marcas={marcas} /> : null}
      </LinhaDoRecorte>
      <Graficos
        linhas={recorte}
        linhasPorData={recorteSemData}
        pendencias={pendencias}
        carregado={carregado}
        responsavel={responsavel}
        aoResponsavel={setResponsavel}
        periodo={periodo}
        aoClicarNoDia={clicarNoDia}
        escuro={escuro}
      />
      <TabelaDeAnalises
        linhas={recorte}
        total={linhas.length}
        carregado={carregado}
        area={area}
        busca={buscaDaFila}
        aoBuscar={setBuscaDaFila}
        aoAbrir={estado.abrirDetalhe}
      />

      {aberto ? (
        <GavetaDaAnalise
          linha={aberto}
          detalhe={e.detalhes.get(aberto.__chave)}
          area={area}
          aoFechar={estado.fecharDetalhe}
          aoTentarDeNovo={() => void estado.abrirDetalhe(aberto.__chave)}
        />
      ) : null}
    </div>
  );
}

export function TelaDeAnalises({ estado }) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const { area: areaDoApp } = usarAreaAtual();

  /*
    A área do app mudou com a tela já aberta: recarrega com a nova. Quem abre
    a tela é o `render()` do controlador — antes dele, nada é pedido.
  */
  useEffect(() => {
    const { area } = estado.obter();
    if (area && areaDoApp && area !== areaDoApp)
      void estado.carregar(areaDoApp);
  }, [estado, areaDoApp]);

  return <TelaDaArea key={e.area || "sem-area"} estado={estado} e={e} />;
}

/**
 * Monta a tela na `<section id="page-analises">` e devolve o controlador do
 * legado: `render()` a cada abertura (a área atual do app), mais o estado e a
 * raiz do React (os testes desmontam por ela).
 */
export function montarAnalises({
  secao = document.getElementById("page-analises"),
  supabase = getSupabaseClient(),
  toast,
  comemoracoesLigadas = () => false,
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
  baixar,
  consultas,
} = {}) {
  const estado = criarEstadoDasAnalises({
    supabase,
    ...(toast ? { toast } : {}),
    ...(baixar ? { baixar } : {}),
    ...(consultas ? { consultas } : {}),
    comemoracoesLigadas,
  });
  const raiz = secao
    ? montarModulo(secao, <TelaDeAnalises estado={estado} />, {
        nome: "a tela de análises curriculares",
      }).raiz
    : null;
  return {
    estado,
    raiz,
    render: () => estado.abrir(String(areaAtual() ?? "").trim()),
  };
}
