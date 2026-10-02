import { useMemo, useState, useSyncExternalStore } from "react";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { estadoDasConfiguracoes } from "../../componentes/configuracoes/estado.js";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { apagarCopiaDaSessao } from "../../modules/copia-da-sessao-indexeddb.js";
import {
  temProcessosPorProjeto,
  textosDaVisaoGeral,
} from "../../lib/visao-geral.js";
import {
  MAPA_DOS_DSEIS,
  MAPA_DOS_MUNICIPIOS,
  mapaDaVisaoGeral,
} from "../../lib/visao-geral-da-area.js";
import { criarCarregadorDeMunicipios } from "../mapa-de-projetos/carregador.js";
import { MapaDeProjetos } from "../mapa-de-projetos/mapa-de-projetos.jsx";
import { MapaSaudeIndigena } from "../mapa-saude-indigena/mapa-saude-indigena.jsx";
import { BoasVindas, MarcosDoAno } from "./boas-vindas.jsx";
import {
  buscarAcompanhamentoNoSupabase,
  estadoDaVisaoGeral,
} from "./estado.js";
import { GavetaDoProcesso } from "./gaveta.jsx";
import {
  Atencao,
  Fases,
  Filtros,
  Indicadores,
  PosResultado,
  ProcessosPorProjeto,
  ProximosDias,
  Topo,
} from "./paineis.jsx";
import { TabelaDeProcessos } from "./tabela.jsx";

/*
  A Visão geral (view `dashboard`), um módulo do app: monta direto na
  `<section id="page-dashboard">` do index.html. O legado continua dono da
  navegação (classe `.active`, título do cabeçalho por área com
  `cabecalhoDaVisaoGeral`, permissão `ind`) e da carga das linhas
  (`loadData` → dados-do-monitoramento.js); a tela lê o estado
  (`estado.js`); do banco, só os marcos do ano, o mapa de Projetos e o
  acompanhamento da área (etapas do cronograma e resumo das listas, pedido
  pelo estado com o cliente da tela).

  Ordem: boas-vindas e marcos do ano, topo (hora da carga, Atualizar,
  Exportar CSV), filtros, indicadores, "Próximos 7 dias" e "Atenção",
  "Processos por projeto" (só Projetos), o MAPA DA ÁREA, "Fases" e
  "Pós-resultado" e a tabela de processos, com os detalhes numa gaveta.

  O MAPA DA ÁREA (`mapaDaVisaoGeral`):
  - Saúde Indígena: `<MapaSaudeIndigena>` (src/modulos/mapa-saude-indigena/),
    com o mesmo estado da página — linhas recortadas, DSEI aberto, busca — e
    os dados do mapa que o legado publica no estado;
  - Projetos: `<MapaDeProjetos>` (src/modulos/mapa-de-projetos/), os
    lugares das vagas de todos os projetos, pedidos pelo carregador da tela
    (um por montagem, com cache) depois da primeira carga da página
    (`carregadoEm`);
  - SEDE: sem mapa.

  Textos de Configurações › Página inicial (publicados): filtros e rótulos
  dos indicadores (`textosDaVisaoGeral`).
*/

/* O mapa da Saúde Indígena lendo e pedindo ao estado da Visão geral. */
function MapaDaSaudeIndigena({ e, estado, perfil, supabase }) {
  const { lmap, redeCnes } = e.mapa || {};
  return (
    <div className="visao-geral-mapa">
      <MapaSaudeIndigena
        perfil={perfil}
        supabase={supabase}
        aoAtualizarMapa={(configuracao) => {
          if (!configuracao?.lmap || !configuracao?.rede_cnes) return;
          estado.definirDadosDoMapa({
            lmap: configuracao.lmap,
            redeCnes: configuracao.rede_cnes,
          });
          void apagarCopiaDaSessao();
        }}
        lmap={lmap}
        redeCnes={redeCnes}
        linhas={e.filtradas}
        filtroAtivo={e.temRecorte}
        dseiSelecionado={e.dsei.chave || null}
        carregando={!lmap}
        aoEscolherDsei={(dsei) => estado.definirDsei(dsei.k, dsei.n)}
        aoSairDoDsei={estado.tirarDsei}
        aoFiltrarPorBusca={estado.definirBusca}
      />
    </div>
  );
}

function usarTextos(configuracoes) {
  const { valores } = useSyncExternalStore(
    configuracoes.assinar,
    configuracoes.obter,
  );
  return useMemo(
    () => textosDaVisaoGeral((chave) => valores?.get?.(chave)),
    [valores],
  );
}

export function TelaDaVisaoGeral({
  estado,
  configuracoes,
  carregadorDeMunicipios,
  obterPerfil,
  supabase,
  comemoracoesLigadas,
  agora,
}) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const textos = usarTextos(configuracoes);
  const mapa = mapaDaVisaoGeral(e.area);
  const [aberta, setAberta] = useState(null);
  // A linha aberta segue os dados: recarga atualiza a gaveta; se sumir, fecha.
  const abrir = (linha) => setAberta(String(linha.id));
  const linhaAberta = aberta
    ? e.linhasDaArea.find((linha) => String(linha.id) === aberta) || null
    : null;

  return (
    <div className="ui-tela visao-geral-tela">
      <BoasVindas obterPerfil={obterPerfil} agora={agora} />
      <MarcosDoAno
        obterPerfil={obterPerfil}
        supabase={supabase}
        comemoracoesLigadas={comemoracoesLigadas}
      />
      <Topo e={e} aoExportar={estado.exportarCsv} />
      <Filtros e={e} estado={estado} textos={textos} />
      <Indicadores e={e} estado={estado} textos={textos} />
      <div className="ui-linha-de-cards">
        <ProximosDias e={e} aoAbrir={abrir} />
        <Atencao e={e} aoAbrir={abrir} />
      </div>
      {temProcessosPorProjeto(e.area) ? (
        <ProcessosPorProjeto e={e} estado={estado} />
      ) : null}
      {mapa === MAPA_DOS_DSEIS ? (
        <MapaDaSaudeIndigena
          e={e}
          estado={estado}
          perfil={obterPerfil?.()}
          supabase={supabase}
        />
      ) : null}
      {mapa === MAPA_DOS_MUNICIPIOS ? (
        <div className="visao-geral-mapa">
          <MapaDeProjetos
            area={e.area}
            carregador={carregadorDeMunicipios}
            carregadoEm={e.carregadoEm}
          />
        </div>
      ) : null}
      <div className="ui-linha-de-cards">
        <Fases e={e} estado={estado} />
        <PosResultado e={e} estado={estado} />
      </div>
      <TabelaDeProcessos
        e={e}
        estado={estado}
        textos={textos}
        agora={agora}
        aoAbrir={abrir}
      />
      {linhaAberta ? (
        <GavetaDoProcesso
          linha={linhaAberta}
          aoFechar={() => setAberta(null)}
          aoVoltarALinha={() => {
            setAberta(null);
            estado.destacar(linhaAberta.id);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Monta a tela na `<section id="page-dashboard">` e devolve o controlador do
 * legado (`window.visaoGeralController`): o estado e a raiz do React (os
 * testes desmontam por ela). Desenha na hora (`flushSync`), antes de o resto
 * do app iniciar.
 */
export function montarVisaoGeral({
  secao = document.getElementById("page-dashboard"),
  estado = estadoDaVisaoGeral,
  configuracoes = estadoDasConfiguracoes,
  toast,
  obterPerfil = () => window.getMonitoraProfile?.() || null,
  supabase = getSupabaseClient(),
  comemoracoesLigadas = () => false,
  agora = () => new Date(),
  carregadorDeMunicipios = criarCarregadorDeMunicipios({
    obterSupabase: () => supabase,
  }),
} = {}) {
  estado.definirAviso(toast);
  estado.definirBuscaDoAcompanhamento(
    supabase ? buscarAcompanhamentoNoSupabase(supabase) : null,
  );
  const raiz = secao
    ? montarModulo(
        secao,
        <TelaDaVisaoGeral
          estado={estado}
          configuracoes={configuracoes}
          carregadorDeMunicipios={carregadorDeMunicipios}
          obterPerfil={obterPerfil}
          supabase={supabase}
          comemoracoesLigadas={comemoracoesLigadas}
          agora={agora}
        />,
        { nome: "a Visão geral", flushSync: true },
      ).raiz
    : null;
  return { estado, raiz };
}
