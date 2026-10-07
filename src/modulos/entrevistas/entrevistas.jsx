import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usarPedidoDeFiltro } from "../../app/pedido-de-filtro.js";
import { filtrosDeEntrevistas } from "../../lib/filtro-da-aya.js";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { usarTemaEscuro } from "../../app/tema.js";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.js";
import { usarAreaAtual } from "../../componentes/usar-area-atual.js";
import {
  calcularIndicadores,
  dataHoraBR,
  FILTROS_VAZIOS,
  filtrarAprovadosSemEntrevista,
  filtrarEntrevistas,
  opcoesDosFiltros,
  pendenciasDasEntrevistas,
} from "../../lib/entrevistas-do-painel.js";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { Aviso } from "../../ui/index.js";
import { textoDaConferencia } from "../../lib/texto-da-conferencia.js";
import { VisaoDeConducao } from "./conducao.jsx";
import { criarEstadoDaConducao } from "./estado-da-conducao.js";
import { criarEstadoDasEntrevistas, MENSAGEM_SEM_ACESSO } from "./estado.js";
import { GavetaDaEntrevista, GavetaDosSemEntrevista } from "./gaveta.jsx";
import {
  Filtros,
  filtrosAtivos,
  Graficos,
  Indicadores,
  Recorte,
  Topo,
} from "./paineis.jsx";
import { VisaoDeRoteiros } from "./roteiros.jsx";
import { MENSAGEM_SEM_ENTREVISTAS, TabelaDeEntrevistas } from "./tabela.jsx";
import { SeloDeAvisos } from "../conferencias/avisos-de-conferencia.tsx";

/*
  A tela de Entrevistas (view `entrevistas`), um módulo do app: monta direto
  na `<section id="page-entrevistas">` do index.html, como Recursos. A navegação
  é dona da classe `.active` da seção e chama `render()` do
  controlador ao navegar (tabela `TELAS_REACT` de src/app/navegacao.js).

  Três visões, no controle segmentado do topo da tela:
  - "Resultados" (a primeira, só leitura): os dados da planilha de
    entrevistas, carregada no banco pela sincronização
    (`sincronizar_entrevistas`), e os das entrevistas conduzidas no sistema
    (a mesma TB_ENTREVISTA); a última carga, os KPIs, os gráficos, as
    pendências (aprovados sem entrevista, entrevistas sem análise, sem edital
    e com nota divergente), a tabela e a gaveta com o caminho do candidato.
  - "Conduzir entrevistas" (conducao.jsx): configurar, convocar e lançar as
    notas de um edital. Cada gravação que muda o resultado relê "Resultados".
  - "Roteiros" (roteiros.jsx): os modelos de entrevista, com versões.
  Quem não edita as entrevistas não vê os controles de edição.

  - Área: a área atual do app (menu lateral → dados-do-monitoramento.js). Cada
    abertura carrega a área de agora; trocar de área com a tela aberta
    recarrega (filtros, busca, gaveta e o edital aberto recomeçam; a visão
    escolhida fica).
  - Sessão: o cliente Supabase único do app. Tema: o do app
    (`html[data-theme="dark"]`); os gráficos acompanham. Tela cheia: a do app.
  - Aviso (toast): o do app (`window.monitoraToast`, passado por src/main.js).
  - Comemorações: o liga/desliga do app, relido a cada abertura (marco "vaga
    pronta", marcos.js).

  Sem tela de carregamento: antes da primeira carga, os KPIs, os gráficos, as
  pendências e a tabela são o skeleton deles; falha na primeira carga vira um
  aviso com "Tentar novamente". Sem permissão no banco (42501), "Sem acesso
  às Entrevistas".
*/

const NUMEROS_ZERADOS = calcularIndicadores([]);

export const VISOES = Object.freeze([
  Object.freeze({
    valor: "resultados",
    rotulo: "Resultados",
    icone: "fa-chart-column",
  }),
  Object.freeze({
    valor: "conduzir",
    rotulo: "Conduzir entrevistas",
    icone: "fa-file-circle-check",
  }),
  Object.freeze({
    valor: "roteiros",
    rotulo: "Roteiros",
    icone: "fa-list-check",
  }),
]);

function textoDoStatus(e) {
  if (e.semSessao) return "Sessão não localizada";
  if (e.semAcesso) return "Sem acesso";
  if (e.erroAoCarregar && !e.carregado) return "Sem dados";
  if (!e.carregado) return "Carregando dados...";
  if (e.atualizando) return "Atualizando...";
  return (
    textoDaConferencia({ conferidoEm: e.dados?.ultimaCarga?.em }) ||
    `Atualizado em ${dataHoraBR(e.carregadoEm)}`
  );
}

/*
  A tela de uma área. Monta de novo quando a área muda (`key`): filtros e a
  busca da tabela recomeçam, como recomeçavam no antigo quadro.
*/
function TelaDaArea({ estado, conducao, e, visao, aoTrocarVisao }) {
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const escuro = usarTemaEscuro();
  const { carregado, dados, area } = e;

  const entrevistas = dados?.entrevistas || [];
  const criterios = dados?.criterios || [];
  const aprovados = dados?.aprovadosSemEntrevista || [];
  const filtradas = useMemo(
    () => filtrarEntrevistas(entrevistas, filtros),
    [entrevistas, filtros],
  );
  const aprovadosFiltrados = useMemo(
    () => filtrarAprovadosSemEntrevista(aprovados, filtros),
    [aprovados, filtros],
  );
  const opcoes = useMemo(() => opcoesDosFiltros(entrevistas), [entrevistas]);
  const indicadores = useMemo(
    () =>
      carregado
        ? calcularIndicadores(filtradas, aprovadosFiltrados)
        : NUMEROS_ZERADOS,
    [carregado, filtradas, aprovadosFiltrados],
  );
  const pendencias = useMemo(
    () => pendenciasDasEntrevistas(filtradas, aprovadosFiltrados),
    [filtradas, aprovadosFiltrados],
  );
  const ativos = filtrosAtivos(filtros, opcoes);
  const aberta = e.gaveta ? entrevistas.find((x) => x.id === e.gaveta) : null;
  const vazio = carregado && !entrevistas.length;
  const bloqueado = e.semAcesso || e.semSessao;
  const comVisoes = Boolean(area) && !bloqueado;
  // Modo de análise: a ficha de notas aberta ocupa a tela (some o topo).
  const sc = useSyncExternalStore(conducao.assinar, conducao.obter);
  const emAnalise =
    comVisoes && visao === "conduzir" && Boolean(sc.fichaAberta && sc.edital);

  // KPI, pendência e fatia de gráfico: clicar de novo tira o filtro.
  const alternarFiltro = (campo, valor) =>
    setFiltros((atuais) => ({
      ...atuais,
      [campo]: atuais[campo] === valor ? "" : valor,
    }));
  const trocarFiltro = (campo, valor) =>
    setFiltros((atuais) => ({ ...atuais, [campo]: valor }));
  const recarregar = () => void estado.carregar(area);
  // "Abrir" numa resposta com número da Aya ou num caso de aviso de
  // conferência: Resultados, já recortado (e a entrevista do caso aberta).
  usarPedidoDeFiltro("entrevistas", carregado, (pedido) => {
    aoTrocarVisao?.("resultados");
    setFiltros((atuais) => filtrosDeEntrevistas(atuais, pedido, opcoes));
    if (
      pedido?.entrevista &&
      entrevistas.some((x) => x.id === pedido.entrevista)
    )
      estado.abrirGaveta(pedido.entrevista);
  });

  /* Atualizar relê "Resultados" e, na visão aberta, o que ela mostra. */
  function atualizar() {
    recarregar();
    if (visao === "conduzir") {
      void conducao.carregarEditais(area, entrevistas);
      if (conducao.obter().editalId) void conducao.recarregarEdital();
    }
    if (visao === "roteiros") void conducao.carregarRoteiros(area);
  }

  return (
    <div
      className="ui-tela entrevistas-tela"
      data-tour="entrevistas-tela"
      data-modo={emAnalise ? "analise" : undefined}
    >
      {emAnalise ? null : (
        <Topo
          status={textoDoStatus(e)}
          aoAtualizar={atualizar}
          atualizarDesativado={!area || e.atualizando || e.semSessao}
          aoExportar={() => estado.exportarCsv(filtradas)}
          exportarDesativado={!carregado || !filtradas.length}
          visoes={comVisoes ? VISOES : null}
          visao={visao}
          aoTrocarVisao={aoTrocarVisao}
        >
          <SeloDeAvisos modulo="entrevistas" />
        </Topo>
      )}

      {e.semSessao ? (
        <Aviso tom="warning" papel="alert">
          {e.erroAoCarregar}
        </Aviso>
      ) : null}
      {e.semAcesso ? (
        <Aviso tom="warning" papel="alert" className="entrevistas-sem-acesso">
          <strong>{MENSAGEM_SEM_ACESSO}</strong>
          <span>
            {e.erroAoCarregar} Peça a liberação do módulo Entrevistas a quem
            administra os acessos da sua coordenação.
          </span>
        </Aviso>
      ) : null}

      {comVisoes && visao === "conduzir" ? (
        <VisaoDeConducao
          conducao={conducao}
          area={area}
          entrevistasDoPainel={entrevistas}
        />
      ) : null}
      {comVisoes && visao === "roteiros" ? (
        <VisaoDeRoteiros conducao={conducao} area={area} />
      ) : null}

      {bloqueado || visao !== "resultados" ? null : (
        <>
          {e.erroAoCarregar && !carregado ? (
            <Aviso tom="danger" papel="alert">
              Não foi possível carregar as entrevistas: {e.erroAoCarregar}{" "}
              <button
                type="button"
                className="btn secondary small"
                onClick={recarregar}
              >
                Tentar novamente
              </button>
            </Aviso>
          ) : null}
          {vazio ? (
            <Aviso tom="info" papel="status">
              {MENSAGEM_SEM_ENTREVISTAS}
            </Aviso>
          ) : null}
          <Filtros
            filtros={filtros}
            opcoes={opcoes}
            carregado={carregado && !vazio}
            aoMudar={trocarFiltro}
            aoLimpar={() => setFiltros(FILTROS_VAZIOS)}
          />
          <Indicadores
            indicadores={indicadores}
            carregado={carregado}
            filtros={filtros}
            aoFiltrar={alternarFiltro}
            aoAbrirSemEntrevista={estado.abrirSemEntrevista}
          />
          <Recorte ativos={ativos} />
          <Graficos
            entrevistas={filtradas}
            criterios={criterios}
            pendencias={pendencias}
            carregado={carregado}
            filtros={filtros}
            aoFiltrar={alternarFiltro}
            aoAbrirSemEntrevista={estado.abrirSemEntrevista}
            escuro={escuro}
          />
          <TabelaDeEntrevistas
            entrevistas={filtradas}
            total={entrevistas.length}
            carregado={carregado}
            aoAbrir={estado.abrirGaveta}
          />
        </>
      )}

      {aberta ? (
        <GavetaDaEntrevista
          entrevista={aberta}
          aoFechar={estado.fecharGaveta}
        />
      ) : null}
      {e.semEntrevistaAberta ? (
        <GavetaDosSemEntrevista
          aprovados={aprovadosFiltrados}
          aoFechar={estado.fecharSemEntrevista}
        />
      ) : null}
    </div>
  );
}

export function TelaDeEntrevistas({ estado, conducao }) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const { area: areaDoApp } = usarAreaAtual();
  const [visao, setVisao] = useState("resultados");

  /*
    A área do app mudou com a tela já aberta (o menu corrige a área, ou outra
    aba): recarrega com a nova. Quem abre a tela é o `render()` do controlador
    — antes dele (`e.area` vazio), nada é pedido.
  */
  useEffect(() => {
    const { area } = estado.obter();
    if (area && areaDoApp && area !== areaDoApp) {
      conducao.trocarArea(areaDoApp);
      void estado.carregar(areaDoApp);
    }
  }, [estado, conducao, areaDoApp]);

  return (
    <TelaDaArea
      key={e.area || "sem-area"}
      estado={estado}
      conducao={conducao}
      e={e}
      visao={visao}
      aoTrocarVisao={setVisao}
    />
  );
}

/**
 * Monta a tela na `<section id="page-entrevistas">` e devolve o controlador
 * do legado: `render()` a cada abertura (carrega a área atual do app e relê
 * as comemorações), mais os dois estados e a raiz do React (os testes
 * desmontam por ela).
 */
export function montarEntrevistas({
  secao = document.getElementById("page-entrevistas"),
  supabase = getSupabaseClient(),
  toast,
  comemoracoesLigadas = () => false,
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
  baixar,
  armazenamento,
} = {}) {
  const estado = criarEstadoDasEntrevistas({
    supabase,
    toast,
    baixar,
    armazenamento,
  });
  const conducao = criarEstadoDaConducao({
    supabase,
    toast,
    // Notas, convocação e desconvocação mudam o que "Resultados" mostra.
    aoMudarResultados: () => void estado.carregar(),
  });
  const raiz = secao
    ? montarModulo(
        secao,
        <TelaDeEntrevistas estado={estado} conducao={conducao} />,
        { nome: "a tela de entrevistas" },
      ).raiz
    : null;
  return {
    estado,
    conducao,
    raiz,
    render() {
      estado.definirComemoracoes(comemoracoesLigadas());
      const area = String(areaAtual() ?? "").trim();
      conducao.trocarArea(area);
      return estado.carregar(area);
    },
  };
}
