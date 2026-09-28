import {
  StrictMode,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { editaisComEtapaNosProximosDias } from "../../lib/boas-vindas.js";
import { indicadoresDoMonitoramento } from "../../lib/indicadores-do-monitoramento.js";
import {
  contarEncerrados,
  editaisDaTabela,
  temMapaDeMunicipios,
} from "../../lib/visao-geral-da-area.js";
import {
  abrirCronogramaDaArea,
  boasVindasFechadaHoje,
  lembrarBoasVindasFechada,
} from "../../modules/boas-vindas.js";
import { usarAreaAtual } from "../usar-area-atual.js";
import { criarEstadoDaVisaoGeral } from "./estado.js";
import { MapaDosMunicipios } from "./mapa-dos-municipios.jsx";
import {
  BoasVindas,
  FaixaDeIndicadores,
  ProximasEtapas,
  TabelaDeEditais,
  Vazio,
} from "./partes.jsx";

/*
  Visão geral da SEDE e de Projetos, em React — a página \`#page-visao-area\`.

  A Saúde Indígena tem a própria (\`#page-dashboard\`, o mapa dos DSEIs, no
  legado); esta é a das outras áreas, com a mesma cara: boas-vindas, a faixa
  dos seis indicadores (a mesma conta, \`indicadores-do-monitoramento.js\`), as
  próximas etapas e os editais da área. Projetos ganha o mapa dos municípios
  das vagas; a SEDE não tem mapa — a equipe dela fica em Brasília.

  Os editais são os que o legado já carregou (\`dados-do-monitoramento.js\`),
  recortados pela área atual; só o mapa pede algo ao banco (\`estado.js\`). O
  legado só troca a classe \`.active\` da \`<section>\` e chama \`render()\` do
  controlador (\`window.visaoGeralDaAreaController\`) ao abrir a página.
*/

const DIAS_DAS_PROXIMAS_ETAPAS = 7;

export function VisaoGeralDaArea({
  estado,
  agora = () => new Date(),
  obterPerfil = () => null,
}) {
  const { area, nome, linhas, carregado } = usarAreaAtual();
  useSyncExternalStore(estado.assinar, estado.obter);
  const mapa = estado.mapaDaArea(area);
  const comMapa = temMapaDeMunicipios(area);

  const [soCriticos, setSoCriticos] = useState(false);
  const [mostrarEncerrados, setMostrarEncerrados] = useState(false);
  const [boasVindasFechada, setBoasVindasFechada] = useState(
    boasVindasFechadaHoje,
  );

  // Trocar de área volta a tabela ao padrão: o filtro era da outra área.
  useEffect(() => {
    setSoCriticos(false);
    setMostrarEncerrados(false);
  }, [area]);

  useEffect(() => {
    if (comMapa) void estado.carregarMunicipios(area);
  }, [estado, area, comMapa]);

  const hoje = agora();
  const indicadores = useMemo(
    () => indicadoresDoMonitoramento(linhas),
    [linhas],
  );
  const proximas = useMemo(
    () =>
      editaisComEtapaNosProximosDias(linhas, hoje, DIAS_DAS_PROXIMAS_ETAPAS),
    // `hoje` muda a cada desenho; as linhas é que decidem.
    [linhas],
  );
  const editais = useMemo(
    () => editaisDaTabela(linhas, { mostrarEncerrados, soCriticos }),
    [linhas, mostrarEncerrados, soCriticos],
  );
  const perfil = obterPerfil();

  if (!carregado) {
    return (
      <div className="visao-da-area" data-area={area}>
        <Vazio icone="fa-spinner" titulo="Carregando os editais da área" />
      </div>
    );
  }

  if (!linhas.length) {
    return (
      <div className="visao-da-area" data-area={area}>
        <Vazio icone="fa-folder-open" titulo={`${nome}: nenhum edital ainda`}>
          Quando a área tiver editais cadastrados em Editais,{" "}
          {comMapa
            ? "os indicadores, as próximas etapas e o mapa"
            : "os indicadores e as próximas etapas"}{" "}
          aparecem aqui.
        </Vazio>
      </div>
    );
  }

  return (
    <div className="visao-da-area" data-area={area}>
      {perfil && !boasVindasFechada && (
        <BoasVindas
          perfil={perfil}
          quantidade={proximas.length}
          agora={hoje}
          aoAbrirCronograma={() => abrirCronogramaDaArea(area)}
          aoFechar={() => {
            lembrarBoasVindasFechada();
            setBoasVindasFechada(true);
          }}
        />
      )}
      <div className="section-label section-label-primary">
        Processos seletivos
      </div>
      <FaixaDeIndicadores
        indicadores={indicadores}
        soCriticos={soCriticos}
        aoFiltrar={() => setSoCriticos((atual) => !atual)}
      />
      {comMapa && (
        <MapaDosMunicipios
          mapa={mapa}
          aoTentarDeNovo={() => estado.carregarMunicipios(area, true)}
        />
      )}
      <div className="visao-da-area__grade">
        <ProximasEtapas editais={proximas} agora={hoje} />
        <TabelaDeEditais
          editais={editais}
          encerrados={contarEncerrados(linhas)}
          mostrarEncerrados={mostrarEncerrados || soCriticos}
          soCriticos={soCriticos}
          aoAlternarEncerrados={() => setMostrarEncerrados((atual) => !atual)}
          aoLimparCriticos={() => setSoCriticos(false)}
        />
      </div>
    </div>
  );
}

/**
 * Monta a Visão geral em `#page-visao-area` e devolve o controlador que o
 * legado chama (`window.visaoGeralDaAreaController`): `render()` ao abrir a
 * página — relê o perfil e, em Projetos, carrega os municípios (com cache).
 */
export function montarVisaoGeralDaArea({
  secao = document.getElementById("page-visao-area"),
  supabase = getSupabaseClient(),
  obterPerfil = () => window.getMonitoraProfile?.(),
  agora,
} = {}) {
  const estado = criarEstadoDaVisaoGeral({ supabase });
  let raiz = null;
  const desenhar = () =>
    raiz?.render(
      <StrictMode>
        <VisaoGeralDaArea
          estado={estado}
          agora={agora}
          obterPerfil={obterPerfil}
        />
      </StrictMode>,
    );
  if (secao) {
    raiz = createRoot(secao);
    desenhar();
  }
  return {
    estado,
    raiz,
    // O perfil muda sem aviso do legado: redesenhar relê.
    render: desenhar,
  };
}
