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
import { getSupabaseClient } from "../../lib/supabaseClient";
import { safeHttpUrl } from "../../lib/sanitize";
import {
  canImportApprovedList,
  canManageEditais,
  isAdminGlobal,
} from "../../lib/access-roles.ts";
import {
  ehEditalDeTreinamento,
  semTreinamento,
} from "../../lib/edital-de-treinamento.ts";
import { SeloDeTreinamento } from "../../componentes/selo-de-treinamento.tsx";
import { formatarDataHora } from "../../lib/cronograma-do-edital.ts";
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
} from "../../lib/editais-do-nucleo.ts";
import { formatNumberBR } from "../../lib/formatters";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { Selo, TabelaInfinita, TopoDoPainel } from "../../ui/index.ts";
import { criarEstadoDoNucleo } from "./estado.ts";
import { PainelOperacional } from "./painel-operacional.tsx";
import { ModalLinhaDoTempo } from "./modal-linha-do-tempo.tsx";
import type { ItemDoResumo } from "../../lib/editais-do-nucleo.ts";
import type { LinhaDoMonitoramento } from "../../componentes/tipos-do-monitoramento.ts";
import type {
  EstadoDoNucleo,
  ModalDoNucleo,
  OpcoesDoEstadoDoNucleo,
} from "./estado.ts";
import { importarComRecarga } from "../../lib/importar-com-recarga.ts";
import { BlocosEsqueleto } from "../../ui/index.ts";
import { etapaDasRegras } from "../../lib/regras-do-edital.ts";
import type { EtapaDasRegras } from "../../lib/regras-do-edital.ts";
import type { ClienteDasRegras } from "../regras-do-edital/regras-do-edital.tsx";
import type { EstadoDosAprovados } from "../aprovados/tipos-do-estado.ts";

/*
  Regras do edital: os editores de todas as etapas baixam só quando a página
  abre (fora do pacote principal, onde Editais monta).
*/
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

const COLUNAS = [
  { rotulo: "Unidade", largura: "16%" },
  { rotulo: "Edital", largura: "12%" },
  { rotulo: "Status", largura: "11%" },
  { rotulo: "Etapa", largura: "19%" },
  { rotulo: "Vagas", largura: "7%", numero: true },
  { rotulo: "Contratados", largura: "8%", numero: true },
  { rotulo: "Ociosas", largura: "7%", numero: true },
  { rotulo: "Risco", largura: "8%" },
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
}: ItemDaTabela & { perfil: unknown; estado: EstadoDaPaginaDoNucleo }) {
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
        <div className="nucleo-row-actions" data-tour="editais-acoes-da-linha">
          {podeEditar ? (
            <button
              className="btn icon outline"
              type="button"
              title="Editar registro"
              data-tour="editais-editar"
              aria-label={`Editar ${nome}`}
              onClick={() => estado.abrirEdital(linha.id)}
            >
              <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
            </button>
          ) : null}
          {podeListas ? (
            <button
              className="btn icon outline"
              type="button"
              title="Lista de aprovados"
              aria-label={`Lista de aprovados de ${nome}`}
              onClick={() =>
                abrirListasDoEdital(
                  String(linha.id),
                  [linha.edital, linha.unidade].filter(Boolean).join(" · "),
                )
              }
            >
              <i className="fa-solid fa-file-arrow-up" aria-hidden="true" />
            </button>
          ) : null}
          {item ? (
            <button
              type="button"
              className="btn icon outline"
              title="Regras do edital"
              data-tour="editais-regras-do-edital"
              aria-label={`Regras do edital ${item.edital || ""}`}
              onClick={() => navegacao.abrirRegrasDoEdital(String(item.id))}
            >
              <i className="fa-solid fa-list-check" aria-hidden="true" />
            </button>
          ) : null}
          {item ? (
            <button
              type="button"
              className="btn icon outline nucleo-view-timeline"
              title="Ver cronograma"
              data-tour="editais-linha-do-tempo"
              aria-label={`Ver cronograma ${item.edital || ""}`}
              onClick={() => estado.abrirLinhaDoTempo(item.id)}
            >
              <i className="fa-solid fa-timeline" aria-hidden="true" />
            </button>
          ) : null}
          {podeReiniciar && !confirmando ? (
            <button
              type="button"
              className="btn icon outline nucleo-reiniciar-treinamento"
              title="Reiniciar treinamento"
              aria-label={`Reiniciar treinamento ${nome || ""}`}
              disabled={salvando}
              onClick={() => setConfirmando(true)}
            >
              <i className="fa-solid fa-rotate" aria-hidden="true" />
            </button>
          ) : null}
          {podeReiniciar && confirmando ? (
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
          ) : null}
          {!podeEditar && !podeListas && !item && !podeReiniciar ? (
            <span className="approved-no-action">—</span>
          ) : null}
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
  const { linhas, carregado } = usarAreaAtual();
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
  // A ordem é a de sempre (filtrarEditais ordena); a busca recorta depois.
  const editais = useMemo(() => filtrarEditais(linhas, ""), [linhas]);
  const noFiltro = useMemo(
    () =>
      editais
        .map((linha) => ({ linha, item: resumoDoEdital(indice, linha) }))
        .filter(({ item }) => passaNoFiltroOperacional(item, nucleo.filtro)),
    [editais, indice, nucleo.filtro],
  );
  const podeEditar = canManageEditais(nucleo.perfil);

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
        aoAtualizar={() =>
          void estado.carregarResumo({ force: true }).catch(() => {})
        }
        idDaAtualizacao="nucleoOperationalRefresh"
        atualizarDesativado={nucleo.atualizandoResumo}
      >
        {podeEditar ? (
          <button
            id="newEditalBtn"
            data-tour="editais-novo"
            className="btn green"
            type="button"
            onClick={() => estado.abrirEdital()}
          >
            <i className="fa-solid fa-plus" aria-hidden="true" /> Novo edital
          </button>
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
        itens={noFiltro}
        filtrarPelaBusca={pelaBusca}
        colunas={COLUNAS}
        classeDaTabela="editais-tabela"
        linha={({ linha, item }) => (
          <LinhaDoEdital
            key={linha.id}
            linha={linha}
            item={item}
            perfil={nucleo.perfil}
            estado={estado}
          />
        )}
        total={noFiltro.length}
        vazio="Nenhum registro encontrado."
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
      return estado.carregarResumo().catch(() => {});
    },
    abrirEdital: estado.abrirEdital,
  };
}
