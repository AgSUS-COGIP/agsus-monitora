import type {
  EstadoDosRecursos,
  SnapshotDosRecursos,
  OpcoesDoEstadoDosRecursos,
} from "./tipos-do-estado.ts";
import type {
  RecursoDoPainel,
  CampoDoFiltroDosRecursos,
} from "../../lib/tipos-dos-recursos.ts";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usarPedidoDeFiltro } from "../../app/pedido-de-filtro.js";
import { filtrosDeRecursos } from "../../lib/filtro-da-aya.js";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { usarTemaEscuro } from "../../app/tema.js";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import {
  calcularIndicadores,
  diaEmBrasilia,
  enriquecerRecursos,
  FILTROS_VAZIOS,
  filtrarRecursos,
  opcoesDosFiltros,
  ORIGENS_PADRAO,
  pendenciasPrioritarias,
} from "../../lib/recursos-dos-candidatos.ts";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { Aviso } from "../../ui/index.js";
import { criarEstadoDosRecursos } from "./estado.ts";
import { FormularioDoRecurso } from "./formulario.tsx";
import { GavetaDoRecurso } from "./gaveta.tsx";
import { dataHora } from "./partes.ts";
import {
  Filtros,
  filtrosAtivos,
  Graficos,
  Indicadores,
  Recorte,
  Topo,
} from "./paineis.tsx";
import { PainelDeModelos } from "./modelos.jsx";
import { TabelaDeRecursos } from "./tabela.tsx";
import "./recursos.css";

/*
  A tela de Recursos dos candidatos (view `recursos`), um módulo do app:
  monta direto na `<section id="page-recursos">` do index.html, como Editais,
  Cronograma e Lista de aprovados. O legado continua dono da classe `.active`
  da seção e chama `render()` do controlador ao navegar.

  - Área: a área atual do app (menu lateral → dados-do-monitoramento.ts). Cada
    abertura carrega a área de agora; trocar de área com a tela aberta
    recarrega (e o que era da outra área sai: filtros, busca, gaveta).
  - Sessão: o cliente Supabase único do app (src/lib/supabaseClient.js).
  - Tema: o do app (`html[data-theme="dark"]`, o seletor da barra lateral);
    os gráficos acompanham. Tela cheia: a do app (menu da conta).
  - Aviso (toast): o do app (`window.monitoraToast`, passado por src/main.js).
  - Permissões: vêm do banco a cada carga (`pode_editar`, `pode_decidir` —
    o parecer jurídico — e `pode_administrar_modelos`); `render()` recarrega,
    então mudam sem recarregar a página. Quem só lê não vê os controles de
    edição; quem não decide não vê os botões de decisão.

  Sem tela de carregamento: antes da primeira carga, os KPIs, os gráficos, as
  pendências e a fila são o skeleton deles; falha na primeira carga vira um
  aviso com "Tentar novamente".
*/

const NUMEROS_ZERADOS = calcularIndicadores([]);

function textoDoStatus(
  e: SnapshotDosRecursos,
  recursos: readonly (RecursoDoPainel & { atualizado_em?: unknown })[],
) {
  if (e.semSessao) return "Sessão não localizada";
  if (e.erroAoCarregar && !e.carregado) return "Sem dados";
  if (!e.carregado) return "Carregando dados...";
  if (e.atualizando) return "Atualizando...";
  const ultima = recursos
    .map((r) =>
      typeof r.atualizado_em === "string" ? r.atualizado_em : r.criado_em,
    )
    .filter((data): data is string | number | Date => data !== undefined)
    .sort()
    .at(-1);
  return `Atualizado em ${dataHora(ultima || e.carregadoEm)}`;
}

/*
  A tela de uma área. Monta de novo quando a área muda (`key`): filtros, busca
  da fila e filtros recolhidos recomeçam, como recomeçavam no antigo quadro.
*/
function TelaDaArea({
  estado,
  e,
}: {
  estado: EstadoDosRecursos;
  e: SnapshotDosRecursos;
}) {
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const escuro = usarTemaEscuro();
  const { carregado, dados, area } = e;

  const origens = dados?.origens?.length ? dados.origens : ORIGENS_PADRAO;
  const podeEditar = Boolean(carregado && dados?.pode_editar);
  // Quem decide (recursos_parecer): o banco diz a cada carga.
  const podeDecidir = Boolean(carregado && dados?.pode_decidir);
  const podeAdministrarModelos = Boolean(
    carregado && dados?.pode_administrar_modelos,
  );
  const hoje = diaEmBrasilia();
  const recursos = useMemo(
    () => (dados ? enriquecerRecursos(dados, hoje) : []),
    [dados, hoje],
  );
  const filtrados = useMemo(
    () => filtrarRecursos(recursos, filtros),
    [recursos, filtros],
  );
  const opcoes = useMemo(
    () => opcoesDosFiltros(recursos, origens),
    [recursos, origens],
  );
  const indicadores = useMemo(
    () => (carregado ? calcularIndicadores(filtrados) : NUMEROS_ZERADOS),
    [carregado, filtrados],
  );
  const pendencias = useMemo(
    () => pendenciasPrioritarias(filtrados),
    [filtrados],
  );
  const ativos = filtrosAtivos(filtros, opcoes);
  const aberto = e.gaveta ? recursos.find((r) => r.id === e.gaveta) : null;
  const idEmEdicao = e.formulario?.id;
  const emEdicao =
    e.formulario?.modo === "edicao"
      ? recursos.find((r) => r.id === idEmEdicao)
      : null;

  // KPI, pendência e barra de gráfico: clicar de novo tira o filtro.
  const alternarFiltro = (campo: CampoDoFiltroDosRecursos, valor: string) =>
    setFiltros((atuais) => ({
      ...atuais,
      [campo]: atuais[campo] === valor ? "" : valor,
    }));
  const trocarFiltro = (campo: CampoDoFiltroDosRecursos, valor: string) =>
    setFiltros((atuais) => ({ ...atuais, [campo]: valor }));
  const recarregar = () => void estado.carregar(area);
  // "Abrir" numa resposta com número da Aya: a tela abre já recortada.
  usarPedidoDeFiltro("recursos", carregado, (pedido) =>
    setFiltros((atuais) => filtrosDeRecursos(atuais, pedido, opcoes)),
  );

  return (
    <div className="ui-tela recursos-tela">
      <Topo
        status={textoDoStatus(e, recursos)}
        aoAtualizar={recarregar}
        atualizarDesativado={!area || e.atualizando || e.semSessao}
        aoExportar={() => estado.exportarCsv(filtrados, origens)}
        exportarDesativado={!carregado || !filtrados.length}
        aoNovo={podeEditar ? estado.abrirNovo : undefined}
        novoDesativado={Boolean(e.acao)}
        aoModelos={podeAdministrarModelos ? estado.abrirModelos : undefined}
      />

      {e.semSessao ? (
        <Aviso tom="warning" papel="alert" className="recursos-aviso-da-tela">
          {e.erroAoCarregar}
        </Aviso>
      ) : e.erroAoCarregar && !carregado ? (
        <Aviso tom="danger" papel="alert" className="recursos-aviso-da-tela">
          Não foi possível carregar os recursos: {e.erroAoCarregar}{" "}
          <button
            type="button"
            className="btn secondary small"
            onClick={recarregar}
          >
            Tentar novamente
          </button>
        </Aviso>
      ) : null}

      <Filtros
        filtros={filtros}
        opcoes={opcoes}
        carregado={carregado}
        aoMudar={trocarFiltro}
        aoLimpar={() => setFiltros(FILTROS_VAZIOS)}
      />
      <Indicadores
        indicadores={indicadores}
        carregado={carregado}
        filtros={filtros}
        aoFiltrar={alternarFiltro}
      />
      <Recorte ativos={ativos} recursos={filtrados} carregado={carregado} />
      <Graficos
        recursos={filtrados}
        pendencias={pendencias}
        carregado={carregado}
        filtros={filtros}
        aoFiltrar={alternarFiltro}
        escuro={escuro}
      />
      <TabelaDeRecursos
        recursos={filtrados}
        total={recursos.length}
        origens={origens}
        carregado={carregado}
        podeEditar={podeEditar}
        aoAbrir={estado.abrirGaveta}
        aoNovo={estado.abrirNovo}
        comemoracoes={e.comemoracoes}
      />

      {/* Com o formulário aberto, a gaveta sai de cena e volta quando ele fecha. */}
      {aberto && !e.formulario && !e.modelosAbertos ? (
        <GavetaDoRecurso
          estado={estado}
          recurso={aberto}
          detalhe={e.detalhes.get(aberto.id)}
          origens={origens}
          podeEditar={podeEditar}
          podeDecidir={podeDecidir}
          modelos={dados?.modelos || []}
          area={area}
        />
      ) : null}
      {e.formulario && (e.formulario.modo === "novo" || emEdicao) ? (
        <FormularioDoRecurso
          key={e.formulario.abertura}
          estado={estado}
          recurso={emEdicao}
          detalhe={emEdicao ? e.detalhes.get(emEdicao.id) : null}
          recursos={recursos}
          editais={dados?.editais || []}
          origens={origens}
        />
      ) : null}
      {e.modelosAbertos ? <PainelDeModelos estado={estado} /> : null}
    </div>
  );
}

export function TelaDeRecursos({ estado }: { estado: EstadoDosRecursos }) {
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
 * Monta a tela na `<section id="page-recursos">` e devolve o controlador do
 * legado: `render()` a cada abertura (carrega a área atual do app e relê as
 * comemorações), mais o estado e a raiz do React (os testes desmontam por ela).
 */
export function montarRecursos({
  secao = document.getElementById("page-recursos"),
  supabase = getSupabaseClient(),
  toast,
  comemoracoesLigadas = () => false,
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
  baixar,
  baixarArquivo,
  abrirUrl,
  imprimir,
  novoId,
}: OpcoesDoEstadoDosRecursos & {
  secao?: HTMLElement | null;
  comemoracoesLigadas?: () => boolean;
  areaAtual?: () => unknown;
} = {}) {
  const estado = criarEstadoDosRecursos({
    supabase,
    ...(toast ? { toast } : {}),
    baixar,
    baixarArquivo,
    abrirUrl,
    imprimir,
    novoId,
  });
  const raiz = secao
    ? montarModulo(secao, <TelaDeRecursos estado={estado} />, {
        nome: "a tela de recursos",
      }).raiz
    : null;
  return {
    estado,
    raiz,
    render() {
      estado.definirComemoracoes(comemoracoesLigadas());
      return estado.carregar(String(areaAtual() ?? "").trim());
    },
  };
}
