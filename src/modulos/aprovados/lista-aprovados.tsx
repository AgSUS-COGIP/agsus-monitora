import { rotuloDaCopia } from "../../lib/carga/rotulo-da-copia.ts";
import {
  naLocalidade,
  opcoesDeLocalidade,
} from "../../lib/aprovados/localidade-da-vaga.ts";
import type {
  EstadoDosAprovados,
  SnapshotDosAprovados,
  OpcoesDaTelaDosAprovados,
  CandidatoAprovado,
  ListaDeAprovados,
} from "./tipos-do-estado.ts";
import type { FiltrosDaTabelaDeAprovados } from "./tipos-da-aba-de-aprovados.ts";
import { useMemo, useState, useSyncExternalStore } from "react";
import { usarPedidoDeFiltro } from "../../app/pedido-de-filtro.ts";
import { filtrosDosAprovados } from "../../lib/aya/filtro-da-aya.ts";
import { getSupabaseClient } from "../../lib/sessao/supabaseClient";
import {
  canAlterarPorDecisaoJudicial,
  canChangeCandidateStatus,
  canManageSubJudice,
} from "../../lib/acessos/access-roles.ts";
import { CHAVE_DO_CABECALHO } from "../../lib/base/cabecalho-dos-documentos.ts";
import { estadoDasConfiguracoes } from "../configuracoes/estado.ts";
import {
  candidateCargosForEdital,
  candidateModalidadesForEdital,
  filterApprovedCandidates,
  manterSoAsOpcoes,
  opcoesDeEdital,
} from "../../lib/aprovados/lista-aprovados-rules.ts";
import { PLANILHAS } from "../../lib/base/planilhas.ts";
import { formatarDataHora } from "../../lib/cronograma/cronograma-do-edital.ts";
import { soDosEditais } from "../../componentes/dados-do-monitoramento.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import {
  AtivosEHistorico,
  classes,
  ContagemDaAba,
  ErroAoCarregar,
  TopoDoPainel,
  usarEstadoDaSessao,
} from "../../ui/index.ts";
import {
  separarAprovados,
  vistaDoPedido,
} from "../../lib/aprovados/ativos-e-historico-dos-aprovados.ts";
import {
  vistaDaLista,
  type VistaDaLista,
} from "../../lib/base/ativos-e-historico.ts";
import { tomDaSituacaoDoEdital } from "../../lib/editais/editais-ativos.ts";
import { FluxoDasEtapas } from "../../componentes/fluxo-das-etapas.tsx";
import { AbaAprovados } from "./aba-aprovados.tsx";
import { AbaConvocacao } from "./aba-convocacao.tsx";
import { AbaResumo } from "./aba-resumo.tsx";
import type { ResumoPorCargoEStatus } from "../../lib/aprovados/exportacao/resumo-por-cargo-e-status.ts";
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
import { contarAbertas } from "../../lib/aprovados/pendencias-do-edital.ts";
import { hojeEmBrasilia } from "../../lib/aprovados/carta-de-convocacao/carta-de-convocacao.ts";
import { montarPedidoDaExportacao } from "../../lib/aprovados/exportacao/exportacao-da-lista-de-aprovados.ts";
import { ModalDaExportacao } from "./exportacao/modal-da-exportacao.tsx";
import "./convocacao.css";
import "./carta-de-convocacao/carta.css";

/*
  Lista de aprovados (view `approved`), módulo do app — a página
  `#page-approved` e os seus modais.

  O React é dono de tudo dentro da `<section>`; a rota (src/app/telas.tsx)
  chama `render()` ao abrir a página, e Editais chama `openImportModal(id,
  rótulo)` pelo registro das telas (botão de listas da tabela).

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
  localidade: [],
  cargo: [],
  modalidade: [],
  status: [],
});

type AbaDosAprovados = "aprovados" | "resumo" | "convocacao" | "pendencias";
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
    nome: "resumo",
    id: "approvedTabResumo",
    painel: "approvedPanelResumo",
    icone: "fa-table-list",
    rotulo: "Resumo por cargo",
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
  copiaDe,
  acao,
}: SnapshotDosAprovados) {
  if (erroAoCarregar && !carregado) return "Sem dados";
  if (!carregado) return "Carregando dados…";
  if (acao) return "Atualizando…";
  if (copiaDe) return rotuloDaCopia(copiaDe);
  return carregadoEm
    ? `Atualizado em ${formatarDataHora(carregadoEm)}`
    : "Base carregada";
}

/*
  As visões: abas (tablist) com o visual do controle segmentado. A contagem
  ao lado do rótulo (ContagemDaAba): os aprovados no recorte e as pendências
  abertas (em alerta); some no zero.
*/
function Visoes({
  aba,
  aoMudar,
  aprovados = 0,
  pendencias = 0,
}: {
  aba: AbaDosAprovados;
  aoMudar: (aba: AbaDosAprovados) => void;
  /** Candidatos no recorte da aba Aprovados. */
  aprovados?: number;
  /** Pendências abertas. */
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
          {item.nome === "aprovados" ? (
            <ContagemDaAba valor={aprovados} id="approvedAprovadosContagem" />
          ) : null}
          {item.nome === "pendencias" ? (
            <ContagemDaAba
              valor={pendencias}
              tom="alerta"
              id="approvedPendenciasSelo"
            />
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
  const { ids, area, nome, linhas } = usarAreaAtual();
  // O modal do "Exportar" da aba Aprovados (o pedido sai dos filtros da tela).
  const [exportar, setExportar] = useState(false);
  // O resumo a exportar (aba Resumo por cargo): o mesmo objeto que a tabela desenha.
  const [resumoParaExportar, setResumoParaExportar] =
    useState<ResumoPorCargoEStatus | null>(null);
  const listas = useMemo(
    () => soDosEditais(dados.listas, ids),
    [dados.listas, ids],
  );
  const candidatos = useMemo(
    () => soDosEditais(dados.candidatos, ids),
    [dados.candidatos, ids],
  );
  /*
    Ativos (o padrão) e Histórico: a lista de trabalho tem só os candidatos
    de edital vigente e lista ativa; o filtro de Edital, os indicadores e a
    contagem partem da vista (src/lib/aprovados/ativos-e-historico-dos-aprovados.ts).
    A Convocação, o sub judice e os modais seguem com a área inteira.
  */
  const [vista, setVista] = usarEstadoDaSessao<VistaDaLista>(
    `yeende:aprovados:vista:${area}`,
    "ativos",
    vistaDaLista,
  );
  const separados = useMemo(
    () => separarAprovados(listas, candidatos, linhas),
    [listas, candidatos, linhas],
  );
  const listasDaVista = separados[vista].listas;
  const candidatosDaVista = separados[vista].candidatos;
  const [aba, setAba] = useState<AbaDosAprovados>("aprovados");
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  // A busca só da tabela; "Limpar filtros" e o pedido de filtro a limpam.
  const [busca, setBusca] = useState("");

  /*
    Cargo e modalidade só oferecem o que existe nos editais escolhidos, e o que
    deixou de ser opção deixa de filtrar — estaria a esconder linhas sem
    aparecer na tela.
  */
  const opcoesEditais = useMemo(
    () => opcoesDeEdital(listasDaVista),
    [listasDaVista],
  );
  // Os editais das duas vistas: o pedido de filtro e a faixa das etapas.
  const opcoesDeTodos = useMemo(() => opcoesDeEdital(listas), [listas]);
  const editais = manterSoAsOpcoes(filtros.editalId, opcoesEditais);
  const chaveDosEditais = editais.join("\u0000");
  const localidades = useMemo(
    () => opcoesDeLocalidade(candidatosDaVista, editais),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidatosDaVista, chaveDosEditais],
  );
  const localidadesEscolhidas = manterSoAsOpcoes(
    filtros.localidade,
    localidades,
  );
  const chaveDasLocalidades = localidadesEscolhidas.join("\u0000");
  /*
    Localidade (16/11/2026): sai do texto do cargo (localidade-da-vaga.ts); com
    uma escolhida, o filtro Cargo só oferece os cargos dela.
  */
  const opcoes = useMemo(
    () => ({
      editais: opcoesEditais,
      localidades,
      cargos: candidateCargosForEdital(candidatosDaVista, editais).filter(
        (cargo) => naLocalidade(cargo, localidadesEscolhidas),
      ),
      modalidades: candidateModalidadesForEdital(candidatosDaVista, editais),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      candidatosDaVista,
      opcoesEditais,
      chaveDosEditais,
      localidades,
      chaveDasLocalidades,
    ],
  );
  const efetivos = {
    candidatos: filtros.candidatos,
    editalId: editais,
    localidade: localidadesEscolhidas,
    cargo: manterSoAsOpcoes(filtros.cargo, opcoes.cargos),
    modalidade: manterSoAsOpcoes(filtros.modalidade, opcoes.modalidades),
    status: filtros.status,
  };
  /*
    O banco confere o total da exportação por edital, cargo e modalidade
    (registrar_exportacao_aprovados): a localidade vai como os cargos dela.
  */
  const filtrosParaExportar = {
    ...efetivos,
    cargo:
      efetivos.localidade.length && !efetivos.cargo.length
        ? [...opcoes.cargos]
        : efetivos.cargo,
  };
  const chaveDosFiltros = JSON.stringify(efetivos);
  const filtrados = useMemo(
    () => filterApprovedCandidates(candidatosDaVista, efetivos),
    [candidatosDaVista, chaveDosFiltros],
  );

  function mudarFiltro(
    campo: keyof FiltrosDaTabelaDeAprovados,
    valores: string[],
  ) {
    setFiltros((atuais) => {
      const proximos = { ...atuais, [campo]: valores };
      if (campo === "editalId") {
        proximos.localidade = manterSoAsOpcoes(
          atuais.localidade,
          opcoesDeLocalidade(candidatosDaVista, valores),
        );
        proximos.cargo = manterSoAsOpcoes(
          atuais.cargo,
          candidateCargosForEdital(candidatosDaVista, valores),
        );
        proximos.modalidade = manterSoAsOpcoes(
          atuais.modalidade,
          candidateModalidadesForEdital(candidatosDaVista, valores),
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

  // Trocar de vista recomeça os filtros (os editais de uma não são da outra).
  function mudarVista(nova: VistaDaLista) {
    if (nova === vista) return;
    setVista(nova);
    limparFiltros();
  }

  /*
    Avisos que viraram pendências abrem a aba Pendências no edital;
    demais avisos abrem a aba Aprovados filtrada pela pessoa; um número da
    Visão geral abre a aba Aprovados no edital, com o status do número.
  */
  usarPedidoDeFiltro("approved", carregado, (pedido) => {
    if (pedido?.pendencias) {
      setAba("pendencias");
      setEditalDaPendencia(String(pedido.edital || ""));
      return;
    }
    const ids = (pedido?.candidatos || []).map(String).filter(Boolean);
    const doEdital = ids.length
      ? null
      : filtrosDosAprovados(
          pedido,
          opcoesDeTodos.map((o) => ({ valor: o.value, rotulo: o.label })),
        );
    if (!ids.length && !doEdital) return;
    // O edital (ou a pessoa) pedido pode estar no Histórico: abre a vista dele.
    setVista(
      vistaDoPedido(
        separados,
        vista,
        { editalIds: doEdital?.editalId, candidatoIds: ids },
        (c) => String(c.candidato_id),
      ),
    );
    setAba("aprovados");
    setFiltros({ ...FILTROS_INICIAIS, ...(doEdital || { candidatos: ids }) });
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
            aprovados={filtrados.length}
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
          <button
            id="approvedExportBtn"
            data-tour="aprovados-exportar"
            className="btn secondary"
            type="button"
            disabled={!carregado || Boolean(dados.acao)}
            onClick={() => setExportar(true)}
          >
            <i className="fa-solid fa-download" aria-hidden="true" /> Exportar
          </button>
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
      {aba === "aprovados" && editais.length === 1 ? (
        <FluxoDasEtapas
          view="approved"
          edital={{
            id: editais[0],
            numero: opcoesDeTodos.find((o) => o.value === editais[0])?.label,
          }}
        />
      ) : null}
      {carregado && (aba === "aprovados" || aba === "resumo") ? (
        <AtivosEHistorico
          vista={vista}
          aoMudar={mudarVista}
          ativos={separados.ativos.editais}
          historico={separados.historico.editais}
          situacoes={separados[vista].situacoes}
          rotulo="Editais da lista de aprovados"
          tomDaSituacao={tomDaSituacaoDoEdital}
          className="aprovados-ativos-e-historico"
          tour="aprovados-ativos-e-historico"
        />
      ) : null}

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
        candidatos={candidatosDaVista}
        listas={listasDaVista}
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
      <AbaResumo
        ativa={aba === "resumo"}
        candidatos={candidatosDaVista}
        filtrados={filtrados}
        configs={dados.configs}
        modelos={dados.modelos}
        carregado={carregado}
        erroAoCarregar={erroAoCarregar}
        opcoes={opcoes}
        filtros={efetivos}
        aoMudarFiltro={mudarFiltro}
        aoLimparFiltros={limparFiltros}
        aoExportar={setResumoParaExportar}
        exportarDesativado={!carregado || Boolean(dados.acao)}
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
      {exportar ? (
        <ModalDaExportacao
          estado={estado}
          pedido={montarPedidoDaExportacao({
            area: String(area || ""),
            rotuloDaArea: nome || String(area || ""),
            candidatosDaArea: candidatosDaVista,
            filtrados,
            filtros: filtrosParaExportar,
            opcoesDeEdital: opcoesEditais,
            convocacoes: dados.convocacoes,
            dadosDe: dados.carregadoEm,
          })}
          aoFechar={() => setExportar(false)}
        />
      ) : null}
      {resumoParaExportar ? (
        <ModalDaExportacao
          estado={estado}
          titulo="Exportar o resumo por cargo e status"
          aoExportar={(pedido, formato, seguir) =>
            estado.exportarResumo(pedido, resumoParaExportar, formato, seguir)
          }
          pedido={montarPedidoDaExportacao({
            area: String(area || ""),
            rotuloDaArea: nome || String(area || ""),
            candidatosDaArea: candidatosDaVista,
            filtrados,
            filtros: filtrosParaExportar,
            opcoesDeEdital: opcoesEditais,
            dadosDe: dados.carregadoEm,
          })}
          aoFechar={() => setResumoParaExportar(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * Cria a Lista de aprovados (rota `approved`, src/app/telas.tsx): o conteúdo
 * React e o controlador (`render()`, `openImportModal`…).
 */
export function criarListaAprovados({
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
  return {
    estado,
    pendencias,
    nome: "a lista de aprovados",
    conteudo: <ListaAprovados estado={estado} pendencias={pendencias} />,
    render: () => estado.garantirCarregado(),
    openImportModal: (editalId: string, rotulo = "") =>
      estado.abrirListasDoEdital(editalId, rotulo),
    closeImportModal: estado.fecharModal,
    openStatusModal: estado.abrirStatus,
    openSubJudiceModal: estado.abrirSubJudice,
    modelUrl: PLANILHAS.modeloListaAprovados.url,
  };
}
