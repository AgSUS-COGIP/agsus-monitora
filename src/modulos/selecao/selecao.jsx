import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { usarTemaEscuro } from "../../app/tema.js";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.js";
import { usarAreaAtual } from "../../componentes/usar-area-atual.js";
import {
  calcularIndicadores,
  dataHoraBR,
  FILTROS_VAZIOS,
  filtrarVagas,
  observacoesDoRecorte,
  opcoesDosFiltros,
} from "../../lib/selecao-do-painel.js";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { Aviso } from "../../ui/index.js";
import { textoDaConferencia } from "../../lib/texto-da-conferencia.js";
import { criarEstadoDaSelecao, MENSAGEM_SEM_ACESSO } from "./estado.js";
import {
  ativosDoRecorte,
  Filtros,
  Graficos,
  Indicadores,
  Observacoes,
  Recorte,
  Topo,
} from "./paineis.jsx";
import { MENSAGEM_SEM_VAGAS, TabelaDeVagas } from "./tabela.jsx";

/*
  A tela de Seleção (view `selecao`), um módulo do app: monta direto na
  `<section id="page-selecao">` do index.html, como Recursos e Entrevistas. O
  legado continua dono da classe `.active` da seção e chama `render()` do
  controlador ao navegar (tabela `TELAS_REACT` de legacy-app.js).

  A mesma tela do antigo painel externo "AgSUS Monitora Recrutamento e
  Seleção" (Apps Script sobre a planilha Auditoria), com os dados do banco
  (get_selecao_da_area): filtros de escolha múltipla (DSEI, edital, cargo,
  vaga), sete KPIs, o recorte, cinco gráficos (o ranking de unidades filtra
  ao clicar), os alertas da coluna Observação e a base operacional. Só leitura.

  - Área: a área atual do app (menu lateral → dados-do-monitoramento.js). Cada
    abertura carrega a área de agora; trocar de área com a tela aberta
    recarrega (filtros e a busca da tabela recomeçam).
  - Sessão: o cliente Supabase único do app. Tema: o do app
    (`html[data-theme="dark"]`); os gráficos acompanham. Tela cheia: a do app.
  - Aviso (toast): o do app (`window.monitoraToast`, passado por src/main.js).

  Sem tela de carregamento: antes da primeira carga, os KPIs, os gráficos e a
  tabela são o skeleton deles; falha na primeira carga vira um aviso com
  "Tentar novamente". Sem permissão no banco (42501), "Sem acesso à Seleção".
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

  const vagas = dados?.vagas || [];
  const filtradas = useMemo(
    () => filtrarVagas(vagas, filtros),
    [vagas, filtros],
  );
  const opcoes = useMemo(
    () => opcoesDosFiltros(vagas, filtros),
    [vagas, filtros],
  );
  const indicadores = useMemo(
    () => (carregado ? calcularIndicadores(filtradas) : NUMEROS_ZERADOS),
    [carregado, filtradas],
  );
  const observacoes = useMemo(
    () => observacoesDoRecorte(filtradas),
    [filtradas],
  );
  const vazio = carregado && !vagas.length;
  const bloqueado = e.semAcesso || e.semSessao;

  const trocarFiltro = (campo, valores) =>
    setFiltros((atuais) => ({ ...atuais, [campo]: valores }));
  // Barra do ranking: filtra a unidade; clicar de novo na mesma tira o filtro.
  const alternarUnidade = (unidade) =>
    setFiltros((atuais) => ({
      ...atuais,
      unidades:
        atuais.unidades.length === 1 && atuais.unidades[0] === unidade
          ? []
          : [unidade],
    }));
  const recarregar = () => void estado.carregar(area);

  return (
    <div className="ui-tela selecao-tela">
      <Topo
        status={textoDoStatus(e)}
        aoAtualizar={recarregar}
        atualizarDesativado={!area || e.atualizando || e.semSessao}
        aoExportar={() => estado.exportarCsv(filtradas)}
        exportarDesativado={!carregado || !filtradas.length}
      />

      {e.semSessao ? (
        <Aviso tom="warning" papel="alert">
          {e.erroAoCarregar}
        </Aviso>
      ) : null}
      {e.semAcesso ? (
        <Aviso tom="warning" papel="alert" className="selecao-sem-acesso">
          <strong>{MENSAGEM_SEM_ACESSO}</strong>
          <span>
            {e.erroAoCarregar} Peça a liberação do módulo Seleção a quem
            administra os acessos da sua coordenação.
          </span>
        </Aviso>
      ) : null}

      {bloqueado ? null : (
        <>
          {e.erroAoCarregar && !carregado ? (
            <Aviso tom="danger" papel="alert">
              Não foi possível carregar a seleção: {e.erroAoCarregar}{" "}
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
              {MENSAGEM_SEM_VAGAS}
            </Aviso>
          ) : null}
          <Filtros
            filtros={filtros}
            opcoes={opcoes}
            area={area}
            carregado={carregado && !vazio}
            aoMudar={trocarFiltro}
            aoLimpar={() => setFiltros(FILTROS_VAZIOS)}
          />
          <Indicadores indicadores={indicadores} carregado={carregado} />
          <Recorte ativos={ativosDoRecorte(filtros, area)} />
          <Graficos
            vagas={filtradas}
            indicadores={indicadores}
            area={area}
            carregado={carregado}
            escuro={escuro}
            aoFiltrarUnidade={alternarUnidade}
          />
          <Observacoes observacoes={observacoes} />
          <TabelaDeVagas
            vagas={filtradas}
            total={vagas.length}
            carregado={carregado}
            area={area}
          />
        </>
      )}
    </div>
  );
}

export function TelaDeSelecao({ estado }) {
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
 * Monta a tela na `<section id="page-selecao">` e devolve o controlador do
 * legado: `render()` a cada abertura (carrega a área atual do app), mais o
 * estado e a raiz do React (os testes desmontam por ela).
 */
export function montarSelecao({
  secao = document.getElementById("page-selecao"),
  supabase = getSupabaseClient(),
  toast,
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
  baixar,
  armazenamento,
} = {}) {
  const estado = criarEstadoDaSelecao({
    supabase,
    toast,
    baixar,
    ...(armazenamento ? { armazenamento } : {}),
  });
  const raiz = secao
    ? montarModulo(secao, <TelaDeSelecao estado={estado} />, {
        nome: "a tela de seleção",
      }).raiz
    : null;
  return {
    estado,
    raiz,
    render() {
      return estado.carregar(String(areaAtual() ?? "").trim());
    },
  };
}
