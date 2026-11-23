import { avisar } from "../../app/avisos.ts";
import { carregarTela } from "../../app/registro-das-telas.ts";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  usarEstadoDaNavegacao,
  usarNavegacao,
} from "../../app/contexto-do-app.ts";
import { getSupabaseClient } from "../../lib/sessao/supabaseClient";
import { safeHttpUrl } from "../../lib/seguranca/sanitize";
import {
  canImportApprovedList,
  canManageEditais,
  isAdminGlobal,
} from "../../lib/acessos/access-roles.ts";
import {
  ehEditalDeTreinamento,
  semTreinamento,
} from "../../lib/editais/edital-de-treinamento.ts";
import { SeloDeTreinamento } from "../../componentes/selo-de-treinamento.tsx";
import { formatarDataHora } from "../../lib/cronograma/cronograma-do-edital.ts";
import {
  alertaDoTipo,
  filtrarEditais,
  formatarNumero,
  indexarResumo,
  passaNoFiltroOperacional,
  resumoDasLinhas,
  resumoDoEdital,
  tomDoRisco,
  tomDoStatusDoEdital,
} from "../../lib/editais/editais-do-nucleo.ts";
import { formatNumberBR } from "../../lib/base/formatters";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { abrirPaginaDoEdital } from "../pagina-do-edital/abrir.ts";
import {
  AcoesDaLinha,
  AtivosEHistorico,
  Selo,
  TabelaInfinita,
  TopoDoPainel,
  usarAtivosEHistorico,
} from "../../ui/index.ts";
import {
  editalDoHistorico,
  situacaoDoEdital,
  tomDaSituacaoDoEdital,
} from "../../lib/editais/editais-ativos.ts";
import type { VistaDaLista } from "../../lib/base/ativos-e-historico.ts";
import { avisoDaListaDoEdital } from "../../lib/editais/aprovados-por-edital.ts";
import {
  ORDEM_PADRAO_DOS_EDITAIS,
  ordenarEditais,
  proximaOrdemDosEditais,
} from "../../lib/editais/ordem-dos-editais.ts";
import type {
  ChaveDaOrdemDosEditais,
  OrdemDosEditais,
} from "../../lib/editais/ordem-dos-editais.ts";
import { criarEstadoDoNucleo, EVENTO_CRONOGRAMA_SALVO } from "./estado.ts";
import { PainelOperacional } from "./painel-operacional.tsx";
import { ModalLinhaDoTempo } from "./modal-linha-do-tempo.tsx";
import type { ItemDoResumo } from "../../lib/editais/editais-do-nucleo.ts";
import type { LinhaDoMonitoramento } from "../../componentes/tipos-do-monitoramento.ts";
import type {
  EstadoDoNucleo,
  ModalDoNucleo,
  OpcoesDoEstadoDoNucleo,
} from "./estado.ts";
import { importarComRecarga } from "../../lib/carga/importar-com-recarga.ts";
import { BlocosEsqueleto } from "../../ui/index.ts";
import { etapaDasRegras } from "../../lib/regras-do-edital/regras-do-edital.ts";
import type { EtapaDasRegras } from "../../lib/regras-do-edital/regras-do-edital.ts";
import type { ClienteDasRegras } from "../regras-do-edital/regras-do-edital.tsx";
import type { EstadoDosAprovados } from "../aprovados/tipos-do-estado.ts";

/*
  Regras do edital: os editores de todas as etapas baixam só quando a página
  abre (fora do pacote principal, onde Editais monta).
*/
// O selo dos avisos do edital (cronograma encerrado, 20261118150000), sob demanda: a tela de
// Editais está no pacote de entrada, e o módulo das conferências não cabe no orçamento dele.
const SeloDeAvisos = lazy(
  importarComRecarga(() =>
    import("../conferencias/avisos-de-conferencia.tsx").then((modulo) => ({
      default: modulo.SeloDeAvisos,
    })),
  ),
);
// "Cronograma encerrado (N)": a lista e a confirmação em lote (20261119120000), sob demanda.
const EncerradosDoCronograma = lazy(
  importarComRecarga(() =>
    import("./encerrados-do-cronograma.tsx").then((modulo) => ({
      default: modulo.EncerradosDoCronograma,
    })),
  ),
);
const RegrasDoEdital = lazy(
  importarComRecarga(() => import("../regras-do-edital/regras-do-edital.tsx")),
);
/*
  "Lista de aprovados" de um edital: o modal é da tela da Lista de aprovados
  (src/modulos/aprovados/), que baixa na primeira vez e monta escondida.
*/
function abrirListasDoEdital(id: string, rotulo: string) {
  void carregarTela("approved")
    .then((aprovados) => aprovados.openImportModal(id, rotulo))
    .catch((erro: unknown) => {
      console.warn("Não foi possível abrir a Lista de aprovados:", erro);
      avisar(
        "Não foi possível abrir a Lista de aprovados. Tente de novo.",
        "error",
      );
    });
}

/*
  A loja da Lista de aprovados do app, para a Chamada para contratação das
  Regras do edital: a mesma da tela (pelo registro das telas), baixada e
  criada na primeira vez, como no botão "Lista de aprovados" da linha.
*/
async function lojaDosAprovados(): Promise<EstadoDosAprovados | null> {
  const aprovados = await carregarTela("approved").catch(() => null);
  return aprovados?.estado ?? null;
}

/** O estado da página (`criarEstadoDoNucleo`). */
export type EstadoDaPaginaDoNucleo = ReturnType<typeof criarEstadoDoNucleo>;

/** Uma linha da tabela: a do monitoramento e o item do resumo dela (se houver). */
interface ItemDaTabela {
  linha: LinhaDoMonitoramento;
  item: ItemDoResumo | null;
}

export interface PropriedadesDoNucleo {
  estado: EstadoDaPaginaDoNucleo;
  agora?: () => Date;
}

export interface OpcoesDaPaginaDoNucleo extends OpcoesDoEstadoDoNucleo {
  agora?: () => Date;
}

/*
  Editais (view `nucleo`), módulo do app — a página `#page-nucleo` e os seus
  modais: o formulário do edital com o cronograma e a linha do tempo.

  O React é dono de tudo dentro da `<section>`; a rota (src/app/telas.tsx)
  chama `render()` do controlador ao abrir a página. As linhas são as mesmas do
  mapa, carregadas pelo legado e publicadas em `dados-do-monitoramento.ts`.

  Padrão das telas de src/modulos/: topo com a data do resumo, Atualizar e
  "Novo edital"; os indicadores (KPIs que filtram); a tabela de carregamento
  contínuo (TabelaInfinita) com a busca. Antes da primeira carga, KPIs e
  linhas são skeleton.

  O corpo da tabela mantém o id `nucleoRows`: a AYA lê as linhas dali para
  saber o que está na tela.
*/

/* As cores de antes (`.chip.<tom>`, editais-do-nucleo.ts) no tom do Selo. */
const SELO: Partial<Record<string, string>> = {
  green: "aprovado",
  red: "reprovado",
  yellow: "pendente",
  blue: "revisar",
  cyan: "revisar",
};

/* As colunas; com `ordem`, o cabeçalho ordena por ela (src/lib/editais/ordem-dos-editais.ts). */
const COLUNAS: readonly {
  rotulo: string;
  largura: string;
  numero?: boolean;
  ordem?: ChaveDaOrdemDosEditais;
}[] = [
  { rotulo: "Unidade", largura: "16%", ordem: "unidade" },
  { rotulo: "Edital", largura: "12%", ordem: "edital" },
  { rotulo: "Status", largura: "11%", ordem: "status" },
  { rotulo: "Etapa", largura: "19%", ordem: "etapa" },
  { rotulo: "Vagas", largura: "7%", numero: true, ordem: "vagas" },
  {
    rotulo: "Contratados",
    largura: "8%",
    numero: true,
    ordem: "contratados",
  },
  { rotulo: "Ociosas", largura: "7%", numero: true, ordem: "ociosas" },
  { rotulo: "Risco", largura: "8%", ordem: "risco" },
  { rotulo: "Ações", largura: "12%" },
];

/* A busca da tabela: edital, unidade, status, etapa, risco ou processo. */
function pelaBusca(
  itens: readonly ItemDaTabela[],
  busca: string,
): readonly ItemDaTabela[] {
  if (!String(busca ?? "").trim()) return itens;
  const achadas = new Set(
    filtrarEditais(
      itens.map(({ linha }) => linha),
      busca,
    ),
  );
  return itens.filter(({ linha }) => achadas.has(linha));
}

function textoDoStatus(nucleo: EstadoDoNucleo, carregado: boolean) {
  if (!nucleo.carregadoEm)
    return carregado && nucleo.statusDoResumo === "error"
      ? "Alertas indisponíveis"
      : "Carregando dados…";
  if (nucleo.atualizandoResumo) return "Atualizando…";
  return `Atualizado em ${formatarDataHora(nucleo.carregadoEm)}`;
}

function LinhaDoEdital({
  linha,
  item,
  perfil,
  estado,
  linhasDaArea,
}: ItemDaTabela & {
  perfil: unknown;
  estado: EstadoDaPaginaDoNucleo;
  /** As linhas da área: o endereço da página usa o número só se ele não se repete. */
  linhasDaArea: readonly ItemDaTabela["linha"][];
}) {
  const url = safeHttpUrl(linha.link_edital);
  const nome = linha.edital || linha.unidade;
  const podeEditar = canManageEditais(perfil);
  const podeListas = canImportApprovedList(perfil);
  const podeReiniciar = isAdminGlobal(perfil) && ehEditalDeTreinamento(linha);
  const navegacao = usarNavegacao();
  const [confirmando, setConfirmando] = useState(false);
  const salvando = useSyncExternalStore(
    estado.assinar,
    () => estado.obter().salvando,
  );
  const aprovados = useSyncExternalStore(
    estado.assinar,
    () => estado.obter().aprovados,
  );
  // Cancelado/suspenso (vermelho) ou concluído sem aprovados (amarelo).
  const aviso = podeListas
    ? avisoDaListaDoEdital(aprovados, linha.id, linha.status)
    : null;
  const rotulo = [linha.edital, linha.unidade].filter(Boolean).join(" · ");
  // Cancelado/suspenso só avisa; concluído sem aprovados (amarelo) abre as
  // listas como os outros, para importar a lista.
  const abrirListas = () =>
    aviso?.tom === "perigo"
      ? estado.toast(aviso.texto, "error")
      : abrirListasDoEdital(String(linha.id), rotulo);
  const alerta =
    item && item.alerta_tipo !== "ok" ? alertaDoTipo(item.alerta_tipo) : null;

  return (
    <tr
      data-record-id={linha.id}
      data-monitoramento-id={item?.id ?? undefined}
      data-alert-type={item?.alerta_tipo ?? undefined}
    >
      <td>
        <span className="ui-texto-principal">{linha.unidade}</span>
      </td>
      <td>
        {url ? (
          <a className="link" href={url} target="_blank" rel="noopener">
            {linha.edital || "-"}
          </a>
        ) : (
          linha.edital || "-"
        )}{" "}
        <SeloDeTreinamento edital={linha} />
      </td>
      <td>
        <Selo tom={SELO[tomDoStatusDoEdital(linha.status)]}>
          {linha.status || "-"}
        </Selo>
      </td>
      <td>
        {linha.etapa}
        {alerta ? (
          <div
            className={`nucleo-row-alert tone-${alerta.tone}`}
            data-tour="editais-alerta-da-linha"
          >
            <i className={`fa-solid ${alerta.icon}`} aria-hidden="true" />
            <span>{alerta.label}</span>
          </div>
        ) : null}
      </td>
      <td className="num">{formatarNumero(linha.vagas_total)}</td>
      <td className="num editais-contratados">
        {formatarNumero(linha.contratados)}
      </td>
      <td className="num editais-ociosas">
        {formatarNumero(linha.vagas_ociosas)}
      </td>
      <td>
        <Selo tom={SELO[tomDoRisco(linha.risco)]}>{linha.risco || "-"}</Selo>
      </td>
      <td>
        {/*
          Ações (23/11/2026): "Abrir" (a página do edital) à vista e o resto
          no "⋯" (AcoesDaLinha). Os seis ícones lado a lado não cabiam a
          1280px. A Lista de aprovados com aviso (amarelo ou vermelho) fica à
          vista, porque pede atenção; sem aviso, vai para o "⋯".
        */}
        <div className="nucleo-row-actions" data-tour="editais-acoes-da-linha">
          {podeListas && aviso ? (
            <button
              className={`btn icon outline nucleo-listas nucleo-listas-${aviso.tom}`}
              type="button"
              title={aviso.texto}
              aria-label={`${aviso.texto}: ${nome}`}
              onClick={abrirListas}
            >
              <i className="fa-solid fa-file-arrow-up" aria-hidden="true" />
            </button>
          ) : null}
          {confirmando ? (
            <div
              className="nucleo-confirma-reinicio"
              role="group"
              aria-label={`Reiniciar o treinamento ${nome || ""}?`}
            >
              <span>Reiniciar {nome}? Os dados dele voltam ao início.</span>
              <button
                type="button"
                className="btn danger small"
                disabled={salvando}
                onClick={async () => {
                  if (await estado.reiniciarTreinamento(linha))
                    setConfirmando(false);
                }}
              >
                Reiniciar
              </button>
              <button
                type="button"
                className="btn secondary small"
                disabled={salvando}
                onClick={() => setConfirmando(false)}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <AcoesDaLinha
              pessoa={nome || "este edital"}
              principal={{
                rotulo: "Abrir",
                acao: "pagina-do-edital",
                titulo: "Abrir página do edital",
                dados: {
                  "aria-label": `Abrir página do edital ${nome || ""}`.trim(),
                },
                aoClicar: () => abrirPaginaDoEdital(linha, linhasDaArea),
              }}
              outras={[
                ...(podeEditar
                  ? [
                      {
                        id: "editar",
                        rotulo: "Editar",
                        icone: "fa-pen-to-square",
                        dados: { "data-acao": "editar" },
                        aoEscolher: () => estado.abrirEdital(linha.id),
                      },
                    ]
                  : []),
                ...(podeListas && !aviso
                  ? [
                      {
                        id: "listas",
                        rotulo: "Lista de aprovados",
                        icone: "fa-file-arrow-up",
                        dados: { "data-acao": "listas" },
                        aoEscolher: abrirListas,
                      },
                    ]
                  : []),
                ...(item
                  ? [
                      {
                        id: "regras",
                        rotulo: "Regras do edital",
                        icone: "fa-list-check",
                        dados: { "data-acao": "regras" },
                        aoEscolher: () =>
                          navegacao.abrirRegrasDoEdital(String(item.id)),
                      },
                      {
                        id: "cronograma",
                        rotulo: "Ver cronograma",
                        icone: "fa-timeline",
                        dados: { "data-acao": "cronograma" },
                        aoEscolher: () => estado.abrirLinhaDoTempo(item.id),
                      },
                    ]
                  : []),
                ...(podeReiniciar
                  ? [
                      {
                        id: "reiniciar",
                        rotulo: "Reiniciar treinamento",
                        icone: "fa-rotate",
                        desabilitado: salvando,
                        dados: { "data-acao": "reiniciar-treinamento" },
                        aoEscolher: () => setConfirmando(true),
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </div>
      </td>
    </tr>
  );
}

/*
  O formulário do edital (com o editor de cronograma) só baixa no clique em
  Novo/Editar. Versão nova publicada com a página aberta: recarrega em vez de
  quebrar.
*/
const ModalDoEdital = lazy(
  importarComRecarga(() =>
    import("./modal-do-edital.tsx").then((modulo) => ({
      default: modulo.ModalDoEdital,
    })),
  ),
);

function ModalAberto({
  estado,
  modal,
  agora,
}: PropriedadesDoNucleo & { modal: ModalDoNucleo | null }) {
  if (modal?.tipo === "edital")
    return (
      <Suspense fallback={null}>
        <ModalDoEdital
          key={modal.abertura}
          estado={estado}
          id={modal.id}
          agora={agora}
        />
      </Suspense>
    );
  if (modal?.tipo === "linha-do-tempo")
    return (
      <ModalLinhaDoTempo
        key={modal.abertura}
        estado={estado}
        id={modal.id}
        agora={agora}
      />
    );
  return null;
}

export function Nucleo({ estado, agora }: PropriedadesDoNucleo) {
  // Só os editais da área escolhida no menu; os indicadores contam os mesmos.
  const { linhas, carregado, erro, area } = usarAreaAtual();
  const doResumo = useSyncExternalStore(estado.assinar, estado.obter);
  const resumoDaArea = useMemo(
    // O edital de treinamento aparece na tabela, mas não nos indicadores.
    () => resumoDasLinhas(doResumo.resumo, semTreinamento(linhas)),
    [doResumo.resumo, linhas],
  );
  const nucleo = useMemo(
    () => ({ ...doResumo, resumo: resumoDaArea }),
    [doResumo, resumoDaArea],
  );

  const indice = useMemo(() => indexarResumo(nucleo.resumo), [nucleo.resumo]);
  // A ordem é a da tabela (abaixo); a busca recorta depois.
  const todosOsEditais = useMemo(() => filtrarEditais(linhas, ""), [linhas]);
  // Ativos (vigentes) na lista de trabalho; concluídos e cancelados no Histórico.
  const { visiveis: editais, controle: ativosEHistorico } =
    usarAtivosEHistorico(todosOsEditais, {
      chave: `yeende:editais:vista:${area}`,
      ehHistorico: editalDoHistorico,
      situacao: situacaoDoEdital,
    });
  /*
    Os cartões "Editais ativos" e "Editais inativos" do painel levam à vista
    deles; trocar a vista tira o filtro de situação que a contradiz.
  */
  const { aoMudar: mudarVista } = ativosEHistorico;
  useEffect(() => {
    if (nucleo.filtro === "inativos") mudarVista("historico");
    else if (nucleo.filtro === "ativos") mudarVista("ativos");
  }, [nucleo.filtro, mudarVista]);
  const aoMudarVista = (vista: VistaDaLista) => {
    if (
      (vista === "ativos" && nucleo.filtro === "inativos") ||
      (vista === "historico" && nucleo.filtro === "ativos")
    )
      estado.filtrarPor("todos");
    mudarVista(vista);
  };
  /*
    A ordem da tabela: cronológica (mais recente primeiro) por padrão; o
    cabeçalho de cada coluna ordena por ela, alternando o sentido.
  */
  const [ordem, setOrdem] = useState<OrdemDosEditais>(ORDEM_PADRAO_DOS_EDITAIS);
  const noFiltro = useMemo(
    () =>
      ordenarEditais(
        editais
          .map((linha) => ({ linha, item: resumoDoEdital(indice, linha) }))
          .filter(({ item }) => passaNoFiltroOperacional(item, nucleo.filtro)),
        ordem,
        ({ linha }) => linha,
      ),
    [editais, indice, nucleo.filtro, ordem],
  );
  const colunas = useMemo(
    () =>
      COLUNAS.map(({ ordem: chave, ...coluna }) =>
        chave
          ? {
              ...coluna,
              ordem: ordem.chave === chave ? ordem.sentido : "",
              aoOrdenar: () =>
                setOrdem((atual) => proximaOrdemDosEditais(atual, chave)),
            }
          : coluna,
      ),
    [ordem],
  );
  const podeEditar = canManageEditais(nucleo.perfil);
  // Cada "Atualizar" relê a lista do cronograma encerrado.
  const [versaoDosEncerrados, setVersaoDosEncerrados] = useState(0);

  /*
    Regras do edital: tomam o lugar da tabela, com o edital e a etapa no
    endereço (`/<área>/editais/<edital>/regras/<etapa>`, src/app/navegacao.ts).
    O título sai do resumo, se o edital estiver nele.
  */
  const navegacao = usarNavegacao();
  const { regras } = usarEstadoDaNavegacao();
  const fecharModal = estado.fecharModal;
  useEffect(() => {
    if (regras) fecharModal();
  }, [regras, fecharModal]);

  if (regras) {
    const { edital: id } = regras;
    const etapa = etapaDasRegras(regras.etapa);
    const linha = linhas.find((l) => String(l.id) === id);
    const noResumo = doResumo.resumo.find((r) => String(r.id ?? "") === id);
    const titulo =
      String(noResumo?.edital ?? "").trim() ||
      [linha?.edital, linha?.unidade].filter(Boolean).join(" · ");
    return (
      <Suspense fallback={<BlocosEsqueleto quantos={3} />}>
        <RegrasDoEdital
          key={id}
          editalId={id}
          titulo={titulo}
          etapa={etapa}
          supabase={estado.clienteDasRegras() as ClienteDasRegras | null}
          toast={estado.toast}
          aoMudarEtapa={(nova: EtapaDasRegras) =>
            navegacao.abrirRegrasDoEdital(id, nova)
          }
          aoVoltar={navegacao.fecharRegrasDoEdital}
          aprovados={lojaDosAprovados}
        />
      </Suspense>
    );
  }

  return (
    <div className="ui-tela editais-tela">
      <TopoDoPainel
        tour="editais-topo"
        status={textoDoStatus(nucleo, carregado)}
        aoAtualizar={() => {
          setVersaoDosEncerrados((n) => n + 1);
          void estado
            .carregarResumo({ force: true })
            .catch(() => {})
            .then(() => estado.carregarAprovados());
        }}
        idDaAtualizacao="nucleoOperationalRefresh"
        atualizarDesativado={nucleo.atualizandoResumo}
        principal={
          podeEditar ? (
            <button
              id="newEditalBtn"
              data-tour="editais-novo"
              className="btn green"
              type="button"
              onClick={() => estado.abrirEdital()}
            >
              <i className="fa-solid fa-plus" aria-hidden="true" /> Novo edital
            </button>
          ) : null
        }
      >
        <Suspense fallback={null}>
          <SeloDeAvisos modulo="editais" />
        </Suspense>
        {podeEditar ? (
          <Suspense fallback={null}>
            <EncerradosDoCronograma
              versao={versaoDosEncerrados}
              toast={estado.toast}
              aoConcluir={() => {
                // O status mudou: o resumo, o Cronograma e as linhas da tabela releem.
                document.dispatchEvent(
                  new CustomEvent(EVENTO_CRONOGRAMA_SALVO),
                );
                void window.refreshData?.();
                void estado.carregarResumo({ force: true }).catch(() => {});
              }}
            />
          </Suspense>
        ) : null}
      </TopoDoPainel>

      <PainelOperacional estado={estado} nucleo={nucleo} />

      <TabelaInfinita
        tour="editais-tabela"
        idDoTitulo="editaisTabelaTitulo"
        titulo="Controle de editais"
        className="nucleo-page-card"
        idDoCorpo="nucleoRows"
        busca={{
          id: "nucleoSearch",
          placeholder: "Pesquisar edital, unidade, status…",
          rotulo: "Pesquisar edital, unidade, status, etapa ou risco",
        }}
        carregado={carregado}
        erro={
          erro
            ? {
                mensagem: erro,
                oQue: "os editais",
                tentarDeNovo: () => void window.refreshData?.(),
              }
            : null
        }
        itens={noFiltro}
        filtrarPelaBusca={pelaBusca}
        ferramentas={
          <AtivosEHistorico
            {...ativosEHistorico}
            aoMudar={aoMudarVista}
            rotulo="Editais"
            tomDaSituacao={tomDaSituacaoDoEdital}
            tour="editais-ativos-e-historico"
          />
        }
        colunas={colunas}
        classeDaTabela="editais-tabela"
        linha={({ linha, item }) => (
          <LinhaDoEdital
            key={linha.id}
            linha={linha}
            item={item}
            perfil={nucleo.perfil}
            estado={estado}
            linhasDaArea={linhas}
          />
        )}
        total={noFiltro.length}
        // Sem edital algum, a faixa de cima já diz "Nenhum edital nesta área.": a tabela não repete.
        vazio={
          editais.length
            ? "Nenhum resultado para os filtros aplicados."
            : todosOsEditais.length
              ? ativosEHistorico.vista === "historico"
                ? "Nenhum edital no histórico."
                : "Nenhum edital ativo."
              : null
        }
        informacao={(quantos) =>
          quantos === null
            ? "Carregando…"
            : `${formatNumberBR(quantos)} ${quantos === 1 ? "edital" : "editais"}`
        }
      />

      <ModalAberto estado={estado} modal={nucleo.modal} agora={agora} />
    </div>
  );
}

/**
 * Cria Editais (rota `nucleo`, src/app/telas.tsx, no pacote principal): o
 * conteúdo React e o controlador — `render()` ao abrir a página.
 */
export function criarNucleo({
  supabase = getSupabaseClient(),
  toast,
  loader,
  getProfile,
  confirmar,
  aoSalvar,
  agora,
}: OpcoesDaPaginaDoNucleo = {}) {
  const estado = criarEstadoDoNucleo({
    supabase,
    toast,
    loader,
    getProfile,
    confirmar,
    aoSalvar,
  });
  return {
    estado,
    nome: "a tela de editais",
    conteudo: <Nucleo estado={estado} agora={agora} />,
    /* Ao abrir a página: relê o perfil e pede o resumo (com cache curto). */
    render() {
      estado.sincronizarPerfil();
      // As listas mudam fora daqui (importação, Classificação): relê a cada
      // abertura, depois do resumo (que é o que a tela mostra primeiro).
      return estado
        .carregarResumo()
        .catch(() => {})
        .then(() => estado.carregarAprovados());
    },
    abrirEdital: estado.abrirEdital,
  };
}
