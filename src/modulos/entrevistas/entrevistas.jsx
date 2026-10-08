import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usarPedidoDeFiltro } from "../../app/pedido-de-filtro.js";
import { filtrosDeEntrevistas } from "../../lib/filtro-da-aya.js";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { usarTemaEscuro } from "../../app/tema.js";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
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
import { hojeEmBrasilia } from "../../lib/fila-de-conducao.ts";
import {
  editalDoRecorte,
  gruposEmpatados,
  mapaDeEmpates,
} from "../../lib/painel-de-entrevistas.ts";
import { irParaLink } from "../chat/ponte.js";
import { AgendaDosProximosDias, AvisoDeEmpates } from "./agenda-e-empates.tsx";
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
import { MENSAGEM_SEM_ENTREVISTAS, TabelaDeEntrevistas } from "./tabela.jsx";
import { SeloDeAvisos } from "../conferencias/avisos-de-conferencia.tsx";

/*
  O PAINEL DE ENTREVISTAS (view `entrevistas`, "acompanhar"; gestão e
  coordenação), um módulo do app: monta direto na
  `<section id="page-entrevistas">` do index.html, como Recursos. A navegação
  é dona da classe `.active` da seção e chama `render()` do controlador ao
  navegar (tabela `TELAS_REACT` de src/app/navegacao.js).

  Fazer é em outra entrada do menu: "Conduzir entrevistas" (view
  `conduzir-entrevistas`, conduzir.tsx) — a fila do dia, a ficha de notas, o
  Preparar (configuração e convocação do edital) e os roteiros. O painel
  só lê, como o Painel das análises ao lado da Avaliação documental.

  O que mostra: os dados da planilha de entrevistas, carregada no banco pela
  sincronização (`sincronizar_entrevistas`), e os das entrevistas conduzidas
  no sistema (a mesma TB_ENTREVISTA); a última carga, os filtros, os KPIs, a
  agenda dos próximos dias (com um edital), os gráficos, as pendências
  (aprovados sem entrevista, sem análise, sem edital, nota divergente, sem
  comparecimento, sem nota e sem parecer), os empatados na nota da entrevista (o desempate é
  na Classificação), a tabela, a exportação e a gaveta com o caminho do
  candidato. O edital de treinamento fica fora (o cache do painel não o lê).

  - Área: a área atual do app (menu lateral → dados-do-monitoramento.ts). Cada
    abertura carrega a área de agora; trocar de área com a tela aberta
    recarrega (filtros, busca e gaveta recomeçam).
  - Sessão: o cliente Supabase único do app. Tema: o do app
    (`html[data-theme="dark"]`); os gráficos acompanham. Tela cheia: a do app.
  - Aviso (toast): o do app (`window.monitoraToast`, passado por src/main.js).
  - Comemorações: o liga/desliga do app, relido a cada abertura (marco "vaga
    pronta", marcos.js).

  Sem tela de carregamento: antes da primeira carga, os KPIs, os gráficos, as
  pendências e a tabela são o skeleton deles; falha na primeira carga vira
  um aviso com "Tentar novamente". Sem permissão no banco (42501), "Sem
  acesso às Entrevistas".

  Links antigos para as visões "Conduzir entrevistas" e "Roteiros" desta
  tela vão para a tela nova (src/lib/navegacao.js, `destinoDaTela`).
*/

const NUMEROS_ZERADOS = calcularIndicadores([]);

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
function TelaDaArea({ estado, e }) {
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
  const grupos = useMemo(() => gruposEmpatados(filtradas), [filtradas]);
  const empates = useMemo(() => mapaDeEmpates(grupos), [grupos]);
  const doRecorte = useMemo(
    () => editalDoRecorte(filtradas, filtros.edital),
    [filtradas, filtros.edital],
  );
  const editalId = doRecorte?.editalId || "";
  const ativos = filtrosAtivos(filtros, opcoes);
  const aberta = e.gaveta ? entrevistas.find((x) => x.id === e.gaveta) : null;
  const vazio = carregado && !entrevistas.length;
  const bloqueado = e.semAcesso || e.semSessao;

  /* A agenda dos próximos dias é a do edital do recorte. */
  useEffect(() => {
    if (carregado) void estado.carregarAgenda(editalId);
  }, [estado, carregado, editalId]);
  const agenda = e.agenda?.editalId === editalId ? e.agenda.itens : null;

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
  // conferência: o painel já recortado (e a entrevista do caso aberta).
  usarPedidoDeFiltro("entrevistas", carregado, (pedido) => {
    setFiltros((atuais) => filtrosDeEntrevistas(atuais, pedido, opcoes));
    if (
      pedido?.entrevista &&
      entrevistas.some((x) => x.id === pedido.entrevista)
    )
      estado.abrirGaveta(pedido.entrevista);
  });

  /* Outra tela, já no edital do recorte (ou no `id` pedido). */
  const irCom = (view, id = editalId) =>
    irParaLink({
      view,
      ...(id ? { edital: { id, titulo: doRecorte?.edital || "" } } : {}),
    });

  return (
    <div className="ui-tela entrevistas-tela" data-tour="entrevistas-tela">
      <Topo
        status={textoDoStatus(e)}
        aoAtualizar={recarregar}
        atualizarDesativado={!area || e.atualizando || e.semSessao}
        aoExportar={() => estado.exportarCsv(filtradas)}
        exportarDesativado={!carregado || !filtradas.length}
      >
        <SeloDeAvisos modulo="entrevistas" />
      </Topo>

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

      {bloqueado ? null : (
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
          {editalId ? (
            <AgendaDosProximosDias
              itens={agenda}
              hoje={hojeEmBrasilia()}
              aoConduzir={() => irCom("conduzir-entrevistas")}
              aoAbrirAgenda={() => irCom("classificacao")}
            />
          ) : null}
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
          <AvisoDeEmpates
            grupos={grupos}
            aoAbrirClassificacao={(id) => irCom("classificacao", id || "")}
          />
          <TabelaDeEntrevistas
            entrevistas={filtradas}
            total={entrevistas.length}
            carregado={carregado}
            empates={empates}
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

export function TelaDeEntrevistas({ estado }) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const { area: areaDoApp } = usarAreaAtual();

  /*
    A área do app mudou com a tela já aberta (o menu corrige a área, ou outra
    aba): recarrega com a nova. Quem abre a tela é o `render()` do controlador
    — antes dele (`e.area` vazio), nada é pedido.
  */
  useEffect(() => {
    const { area } = estado.obter();
    if (area && areaDoApp && area !== areaDoApp)
      void estado.carregar(areaDoApp);
  }, [estado, areaDoApp]);

  return <TelaDaArea key={e.area || "sem-area"} estado={estado} e={e} />;
}

/**
 * Monta a tela na `<section id="page-entrevistas">` e devolve o controlador
 * do legado: `render()` a cada abertura (carrega a área atual do app e relê
 * as comemorações), o estado e a raiz do React (os testes desmontam por ela).
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
  const raiz = secao
    ? montarModulo(secao, <TelaDeEntrevistas estado={estado} />, {
        nome: "o painel de entrevistas",
      }).raiz
    : null;
  return {
    estado,
    raiz,
    render() {
      estado.definirComemoracoes(comemoracoesLigadas());
      const area = String(areaAtual() ?? "").trim();
      return estado.carregar(area);
    },
  };
}
