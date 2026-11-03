import type {
  EstadoDosAprovados,
  SnapshotDosAprovados,
  OpcoesDaTelaDosAprovados,
  CandidatoAprovado,
  ListaDeAprovados,
} from "./tipos-do-estado.ts";
import type { FiltrosDaTabelaDeAprovados } from "./tipos-da-aba-de-aprovados.ts";
import { useMemo, useState, useSyncExternalStore } from "react";
import { montarModulo } from "../../app/montar-modulo.tsx";
import { usarPedidoDeFiltro } from "../../app/pedido-de-filtro.ts";
import { getSupabaseClient } from "../../lib/supabaseClient";
import {
  canAlterarPorDecisaoJudicial,
  canChangeCandidateStatus,
  canManageSubJudice,
} from "../../lib/access-roles.ts";
import { CHAVE_DO_CABECALHO } from "../../lib/cabecalho-dos-documentos.ts";
import { estadoDasConfiguracoes } from "../configuracoes/estado.ts";
import {
  candidateCargosForEdital,
  candidateModalidadesForEdital,
  filterApprovedCandidates,
  manterSoAsOpcoes,
  opcoesDeEdital,
} from "../../lib/lista-aprovados-rules.ts";
import { PLANILHAS } from "../../lib/planilhas.ts";
import { formatarDataHora } from "../../lib/cronograma-do-edital.ts";
import { soDosEditais } from "../../componentes/dados-do-monitoramento.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { classes, ErroAoCarregar, TopoDoPainel } from "../../ui/index.ts";
import { AbaAprovados } from "./aba-aprovados.tsx";
import { AbaConvocacao } from "./aba-convocacao.tsx";
import { criarEstadoDaListaDeAprovados } from "./estado.js";
import { ModalDeAnexos, ModalDeStatus, ModalSubJudice } from "./modais.tsx";
import { ModalListasDoEdital } from "./modal-listas-do-edital.tsx";
import { GavetaDoCandidato } from "./gaveta-do-candidato.tsx";
import { ModalDaCarta } from "./carta-de-convocacao/modal-da-carta.tsx";
import { ModelosDaCarta } from "./carta-de-convocacao/modelos-da-carta.tsx";
import { plural } from "./partes.tsx";
import { SeloDeAvisos } from "../conferencias/avisos-de-conferencia.tsx";
import { AbaPendencias, usarPendencias } from "./pendencias/aba-pendencias.tsx";
import {
  criarEstadoDasPendencias,
  type EstadoDasPendencias,
} from "./pendencias/estado-das-pendencias.ts";
import { contarAbertas } from "../../lib/pendencias-do-edital.ts";
import { hojeEmBrasilia } from "../../lib/carta-de-convocacao.ts";
import "./convocacao.css";
import "./carta-de-convocacao/carta.css";

/*
  Lista de aprovados (view `approved`), módulo do app — a página
  `#page-approved` e os seus modais.

  O React é dono de tudo dentro da `<section>`; o legado só troca a classe
  `.active` dela e fala com o controlador (`window.aprovadosController`):
  `render()` ao abrir a página e `openImportModal(id, rótulo)` pelo botão de
  listas da tabela de Editais.

  Padrão das telas de src/modulos/: topo com as duas visões (abas com o visual
  do controle segmentado), a data da carga e Atualizar; KPIs compactos;
  filtros recolhíveis; skeleton antes da primeira carga e, se ela falha, um
  aviso com "Tentar novamente".

  Os dados (candidatos, listas, configuração de convocação) e as ações vivem em
  `estado.ts`; as duas abas leem os mesmos candidatos, então mudar o status de
  alguém numa redesenha a outra. Os modais são portais no fim do `body`.
*/

const FILTROS_INICIAIS: FiltrosDaTabelaDeAprovados = Object.freeze({
  candidatos: [],
  editalId: [],
  cargo: [],
  modalidade: [],
  status: [],
});

type AbaDosAprovados = "aprovados" | "convocacao" | "pendencias";
const ABAS: {
  nome: AbaDosAprovados;
  id: string;
  painel: string;
  icone: string;
  rotulo: string;
}[] = [
  {
    nome: "aprovados",
    id: "approvedTabAprovados",
    painel: "approvedPanelAprovados",
    icone: "fa-user-check",
    rotulo: "Aprovados",
  },
  {
    nome: "convocacao",
    id: "approvedTabConvocacao",
    painel: "approvedPanelConvocacao",
    icone: "fa-bullhorn",
    rotulo: "Convocação",
  },
  {
    nome: "pendencias",
    id: "approvedTabPendencias",
    painel: "approvedPanelPendencias",
    icone: "fa-list-check",
    rotulo: "Pendências",
  },
];

function textoDoStatus({
  carregado,
  erroAoCarregar,
  carregadoEm,
  acao,
}: SnapshotDosAprovados) {
  if (erroAoCarregar && !carregado) return "Sem dados";
  if (!carregado) return "Carregando dados...";
  if (acao) return "Atualizando...";
  return carregadoEm
    ? `Atualizado em ${formatarDataHora(carregadoEm)}`
    : "Base carregada";
}

/* As duas visões: abas (tablist) com o visual do controle segmentado. */
function Visoes({
  aba,
  aoMudar,
  pendencias = 0,
}: {
  aba: AbaDosAprovados;
  aoMudar: (aba: AbaDosAprovados) => void;
  /** Pendências abertas: o selo da aba (some no zero). */
  pendencias?: number;
}) {
  return (
    <div
      className="ui-segmentado approved-visoes"
      data-tour="aprovados-visoes"
      role="tablist"
      aria-label="Visões da lista do edital"
    >
      {ABAS.map((item) => (
        <button
          key={item.nome}
          id={item.id}
          className={classes(
            "ui-segmentado-opcao",
            aba === item.nome && "is-ativo",
          )}
          type="button"
          role="tab"
          aria-selected={aba === item.nome}
          aria-controls={item.painel}
          data-approved-tab={item.nome}
          data-tour={`aprovados-aba-${item.nome}`}
          onClick={() => aoMudar(item.nome)}
        >
          <i className={`fa-solid ${item.icone}`} aria-hidden="true" />
          {item.rotulo}
          {item.nome === "pendencias" && pendencias > 0 ? (
            <span
              className="approved-selo-da-aba"
              id="approvedPendenciasSelo"
              aria-label={`${pendencias} abertas`}
            >
              {pendencias}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function ModalAberto({
  estado,
  dados,
  daArea,
}: {
  estado: EstadoDosAprovados;
  dados: SnapshotDosAprovados;
  daArea: { candidatos: CandidatoAprovado[]; listas: ListaDeAprovados[] };
}) {
  const { modal } = dados;
  if (!modal) return null;
  const candidato = dados.candidatos.find(
    (row) =>
      String(row.candidato_id) ===
      ("candidatoId" in modal ? modal.candidatoId : undefined),
  );
  const anexos =
    dados.anexos.get(
      String("candidatoId" in modal ? modal.candidatoId : undefined),
    ) || [];
  if (modal.tipo === "status")
    return candidato ? (
      <ModalDeStatus
        key={modal.abertura}
        estado={estado}
        perfil={dados.perfil}
        candidato={candidato}
        candidatos={dados.candidatos}
        jaAnexados={anexos.length}
        dataConvocacao={
          dados.convocacoes.get(String(candidato.candidato_id))?.data
        }
      />
    ) : null;
  if (modal.tipo === "candidato")
    return candidato ? (
      <GavetaDoCandidato
        key={modal.abertura}
        estado={estado}
        perfil={dados.perfil}
        candidato={candidato}
        convocacao={dados.convocacoes.get(String(candidato.candidato_id))}
      />
    ) : null;
  if (modal.tipo === "carta")
    return (
      <ModalDaCarta
        key={modal.abertura}
        estado={estado}
        candidatos={modal.candidatoIds
          .map((id) =>
            dados.candidatos.find((row) => String(row.candidato_id) === id),
          )
          .filter((c): c is CandidatoAprovado => c !== undefined)}
        podeEditarModelos={canChangeCandidateStatus(dados.perfil)}
      />
    );
  if (modal.tipo === "modelos-carta")
    return (
      <ModelosDaCarta
        key={modal.abertura}
        estado={estado}
        listas={daArea.listas}
        candidatos={daArea.candidatos}
      />
    );
  if (modal.tipo === "anexos")
    return candidato ? (
      <ModalDeAnexos
        key={modal.abertura}
        estado={estado}
        perfil={dados.perfil}
        candidato={candidato}
        anexos={anexos}
      />
    ) : null;
  if (modal.tipo === "sub-judice")
    return (
      <ModalSubJudice
        key={modal.abertura}
        estado={estado}
        perfil={dados.perfil}
        aba={modal.aba}
        candidatoId={modal.candidatoId}
        listas={daArea.listas}
        candidatos={daArea.candidatos}
      />
    );
  if (modal.tipo === "listas")
    return (
      <ModalListasDoEdital
        key={modal.abertura}
        estado={estado}
        dados={dados}
        editalId={modal.editalId}
        rotulo={modal.rotulo}
      />
    );
  return null;
}

/* Sem a peça das pendências (testes antigos, uso avulso): uma vazia, sem banco. */
const PENDENCIAS_SEM_BANCO = criarEstadoDasPendencias();

export function ListaAprovados({
  estado,
  pendencias = PENDENCIAS_SEM_BANCO,
  hoje = hojeEmBrasilia,
}: {
  estado: EstadoDosAprovados;
  pendencias?: EstadoDasPendencias;
  hoje?: () => string;
}) {
  const dados = useSyncExternalStore(estado.assinar, estado.obter);
  const dadosDasPendencias = usarPendencias(pendencias);
  const [editalDaPendencia, setEditalDaPendencia] = useState("");
  const { carregado, erroAoCarregar, perfil } = dados;
  /*
    Só as listas e os candidatos dos editais da área escolhida no menu — o
    seletor de edital, os filtros, as duas abas e o sub judice partem daqui.
    Os candidatos já chegam só da área (o banco recorta); o recorte aqui é o
    mesmo, pelos editais que a tela conhece. O modal de listas aberto pelo
    Núcleo é de um edital certo e vê tudo o que foi carregado — a área atual,
    a mesma do Núcleo.
  */
  const { ids, area } = usarAreaAtual();
  const listas = useMemo(
    () => soDosEditais(dados.listas, ids),
    [dados.listas, ids],
  );
  const candidatos = useMemo(
    () => soDosEditais(dados.candidatos, ids),
    [dados.candidatos, ids],
  );
  const [aba, setAba] = useState<AbaDosAprovados>("aprovados");
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  // A busca só da tabela; "Limpar filtros" e o pedido de filtro a limpam.
  const [busca, setBusca] = useState("");

  /*
    Cargo e modalidade só oferecem o que existe nos editais escolhidos, e o que
    deixou de ser opção deixa de filtrar — estaria a esconder linhas sem
    aparecer na tela.
  */
  const opcoesEditais = useMemo(() => opcoesDeEdital(listas), [listas]);
  const editais = manterSoAsOpcoes(filtros.editalId, opcoesEditais);
  const chaveDosEditais = editais.join("\u0000");
  const opcoes = useMemo(
    () => ({
      editais: opcoesEditais,
      cargos: candidateCargosForEdital(candidatos, editais),
      modalidades: candidateModalidadesForEdital(candidatos, editais),
    }),
    [candidatos, opcoesEditais, chaveDosEditais],
  );
  const efetivos = {
    candidatos: filtros.candidatos,
    editalId: editais,
    cargo: manterSoAsOpcoes(filtros.cargo, opcoes.cargos),
    modalidade: manterSoAsOpcoes(filtros.modalidade, opcoes.modalidades),
    status: filtros.status,
  };
  const chaveDosFiltros = JSON.stringify(efetivos);
  const filtrados = useMemo(
    () => filterApprovedCandidates(candidatos, efetivos),
    [candidatos, chaveDosFiltros],
  );

  function mudarFiltro(
    campo: keyof FiltrosDaTabelaDeAprovados,
    valores: string[],
  ) {
    setFiltros((atuais) => {
      const proximos = { ...atuais, [campo]: valores };
      if (campo === "editalId") {
        proximos.cargo = manterSoAsOpcoes(
          atuais.cargo,
          candidateCargosForEdital(candidatos, valores),
        );
        proximos.modalidade = manterSoAsOpcoes(
          atuais.modalidade,
          candidateModalidadesForEdital(candidatos, valores),
        );
      }
      return proximos;
    });
  }

  const podeSubJudice =
    canManageSubJudice(perfil) || canAlterarPorDecisaoJudicial(perfil);
  const temListaAtiva = listas.some((item) => item.ativo);

  function limparFiltros() {
    setFiltros(FILTROS_INICIAIS);
    setBusca("");
  }

  /*
    Avisos que viraram pendências abrem a aba Pendências no edital;
    demais avisos abrem a aba Aprovados filtrada pela pessoa.
  */
  usarPedidoDeFiltro("approved", carregado, (pedido) => {
    if (pedido?.pendencias) {
      setAba("pendencias");
      setEditalDaPendencia(String(pedido.edital || ""));
      return;
    }
    const ids = (pedido?.candidatos || []).map(String).filter(Boolean);
    if (!ids.length) return;
    setAba("aprovados");
    setFiltros({ ...FILTROS_INICIAIS, candidatos: ids });
    setBusca("");
  });

  return (
    <div className="ui-tela aprovados-tela">
      <TopoDoPainel
        tour="aprovados-topo"
        visoes={
          <Visoes
            aba={aba}
            aoMudar={setAba}
            pendencias={contarAbertas(dadosDasPendencias.pendencias).total}
          />
        }
        status={textoDoStatus(dados)}
        aoAtualizar={() => void estado.carregar()}
        atualizarDesativado={
          Boolean(dados.acao) || (!carregado && !erroAoCarregar)
        }
      >
        <SeloDeAvisos modulo="aprovados" />
        {/*
          O contador e o botão de sub judice falam da lista de aprovados.
          Deixá-los visíveis na outra aba prometeria uma ação que não
          pertence àquela tabela.
        */}
        <div
          className={classes(
            "approved-head-actions",
            aba !== "aprovados" && "hidden",
          )}
          id="approvedHeadActions"
        >
          <span id="approvedCount" className="approved-contagem">
            {carregado
              ? plural(filtrados.length, "candidato", "candidatos")
              : erroAoCarregar
                ? "Sem dados"
                : "Carregando…"}
          </span>
          {podeSubJudice ? (
            <button
              id="approvedAddSubJudiceBtn"
              data-tour="aprovados-sub-judice"
              className="btn green"
              type="button"
              disabled={!temListaAtiva}
              title={
                temListaAtiva
                  ? "Incluir candidato sub judice ou registrar decisão sobre candidato já aprovado"
                  : "É necessário ter uma lista ativa"
              }
              onClick={estado.abrirSubJudice}
            >
              <i className="fa-solid fa-gavel" aria-hidden="true" /> Sub judice
            </button>
          ) : null}
        </div>
      </TopoDoPainel>

      {erroAoCarregar && !carregado ? (
        <ErroAoCarregar
          id="approvedErro"
          oQue="a lista de aprovados"
          mensagem={erroAoCarregar}
          aoTentar={() => void estado.carregar()}
        />
      ) : null}

      <AbaAprovados
        ativa={aba === "aprovados"}
        estado={estado}
        perfil={perfil}
        candidatos={candidatos}
        listas={listas}
        anexos={dados.anexos}
        convocacoes={dados.convocacoes}
        carregado={carregado}
        erroAoCarregar={erroAoCarregar}
        opcoes={opcoes}
        filtros={efetivos}
        aoMudarFiltro={mudarFiltro}
        aoLimparFiltros={limparFiltros}
        linhas={filtrados}
        busca={busca}
        aoBuscar={setBusca}
      />
      <AbaConvocacao
        ativa={aba === "convocacao"}
        estado={estado}
        perfil={perfil}
        candidatos={candidatos}
        listas={listas}
        configs={dados.configs}
        modelos={dados.modelos}
        convocacoes={dados.convocacoes}
        carregado={carregado}
        erroAoCarregar={erroAoCarregar}
      />
      <AbaPendencias
        ativa={aba === "pendencias"}
        estado={pendencias}
        area={String(area || "")}
        editalPedido={editalDaPendencia}
        hoje={hoje()}
      />
      <ModalAberto
        estado={estado}
        dados={dados}
        daArea={{ listas, candidatos }}
      />
    </div>
  );
}

/**
 * Monta a página em `#page-approved` e devolve o controlador que o legado
 * chama (`window.aprovadosController`).
 */
export function montarListaAprovados({
  secao = document.getElementById("page-approved"),
  supabase = getSupabaseClient(),
  toast,
  getProfile,
  confirmar,
  lerPlanilha,
  novaAba,
  armazenamento,
  areaAtual,
  copiar,
  imprimir,
  carregarLogo,
  baixar,
  hoje,
  esperar,
  cabecalho = () =>
    estadoDasConfiguracoes.obter().valores?.get?.(CHAVE_DO_CABECALHO) || "",
}: OpcoesDaTelaDosAprovados = {}) {
  // Decidir uma pendência muda status, posição ou remove linha: a lista recarrega.
  const pendencias = criarEstadoDasPendencias({
    supabase,
    ...(toast ? { toast } : {}),
    ...(hoje ? { hoje } : {}),
    // `estado` é criado logo abaixo; a decisão só chega depois da montagem.
    aoDecidir: () => void estado.carregar({ emSegundoPlano: true }),
  });
  const estado = criarEstadoDaListaDeAprovados({
    pendencias: () => pendencias,
    supabase,
    toast,
    getProfile,
    confirmar,
    lerPlanilha,
    novaAba,
    armazenamento,
    areaAtual,
    cabecalho,
    ...(copiar ? { copiar } : {}),
    ...(imprimir ? { imprimir } : {}),
    ...(carregarLogo ? { carregarLogo } : {}),
    ...(baixar ? { baixar } : {}),
    ...(hoje ? { hoje } : {}),
    ...(esperar ? { esperar } : {}),
  });
  const raiz = secao
    ? montarModulo(
        secao,
        <ListaAprovados estado={estado} pendencias={pendencias} />,
        {
          nome: "a lista de aprovados",
        },
      ).raiz
    : null;
  return {
    estado,
    pendencias,
    raiz,
    render: () => estado.garantirCarregado(),
    openImportModal: (editalId: string, rotulo = "") =>
      estado.abrirListasDoEdital(editalId, rotulo),
    closeImportModal: estado.fecharModal,
    openStatusModal: estado.abrirStatus,
    openSubJudiceModal: estado.abrirSubJudice,
    modelUrl: PLANILHAS.modeloListaAprovados.url,
  };
}
