import type {
  EstadoDaClassificacao,
  EstadoDaAgenda,
  SnapshotDaClassificacao,
  RegistroDaClassificacao,
  OpcoesDaTela,
} from "./tipos-do-estado.ts";
import {
  useCallback,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from "react";
import { montarModulo } from "../../app/montar-modulo.tsx";
import {
  criarRascunhoDaRegra,
  type RascunhoDaRegra,
} from "../../app/rascunho-da-regra.ts";
import { estadoDasConfiguracoes } from "../configuracoes/estado.ts";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.ts";
import { CHAVE_DO_CABECALHO } from "../../lib/cabecalho-dos-documentos.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { SeloDeTreinamento } from "../../componentes/selo-de-treinamento.tsx";
import { sufixoDeTreinamento } from "../../lib/edital-de-treinamento.ts";
import { classificarEdital } from "../../lib/classificacao/ajustes.ts";
import { dataDeCorteDoCronograma } from "../../lib/classificacao/dados.ts";
import { rotuloDaVersao } from "../../lib/nome-da-versao.ts";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { Aviso, Campo, Segmentado, TopoDoPainel } from "../../ui/index.ts";
import { Agenda } from "./agenda.tsx";
import { criarEstadoDaClassificacao, MENSAGEM_SEM_ACESSO } from "./estado.ts";
import { criarEstadoDaAgenda } from "./estado-da-agenda.ts";
import { Listas } from "./listas.tsx";
import { Regra } from "./regra.tsx";
import { SeloDeAvisos } from "../conferencias/avisos-de-conferencia.tsx";
import "./classificacao.css";

/*
  A tela de Classificação (view `classificacao`), módulo do app: monta direto
  na `<section id="page-classificacao">` do index.html, como Seleção e
  Entrevistas. A navegação é dona da classe `.active` da seção e chama `render()`
  do controlador ao navegar (tabela `TELAS_REACT` de src/app/navegacao.ts).

  - Área: a área atual do app; trocar de área com a tela aberta recarrega.
  - Edital: escolhido no topo; a regra é DESTE edital (decidida pelo gestor).
  - Visões: "Listas" (preliminar, convocação, resultado final), "Agenda"
    (regra e agenda das entrevistas dos convocados; agenda.tsx) e "Regra".
    A agenda fica aqui, junto da lista de convocação de onde saem os
    convocados e do documento que ela preenche (DATA e HORA); quem conduz vê
    a agenda do dia em Entrevistas › Conduzir entrevistas.
  - A conta é do motor puro (src/lib/classificacao/motor.ts), com a data de
    corte do cronograma quando a regra não traz a sua.
  Sem tela de carregamento: KPIs e listas em skeleton até a primeira carga.
*/

const VISOES = [
  { valor: "listas", rotulo: "Listas", icone: "fa-list-ol" },
  { valor: "agenda", rotulo: "Agenda", icone: "fa-calendar-days" },
  { valor: "regra", rotulo: "Regra", icone: "fa-sliders" },
];

function textoDoStatus(e: SnapshotDaClassificacao) {
  if (e.semAcesso) return "Sem acesso";
  if (!e.carregado && e.carregandoEditais) return "Carregando editais...";
  if (e.carregandoEdital) return "Carregando o edital...";
  const regra = e.dados?.regra;
  if (regra) return `Regra: ${rotuloDaVersao(regra)}`;
  return e.dados ? "Sem regra" : "";
}

/*
  A classificação de um edital numa lista: o motor, com a data de corte do
  cronograma e os ajustes da pontuação aprovados em recurso por cima da nota
  da análise (src/lib/classificacao/ajustes.ts — a mesma conta da prévia do
  recurso).
*/
export function calcularClassificacao(
  dados: RegistroDaClassificacao | null,
  tipo: string,
) {
  return classificarEdital(dados, tipo);
}

const AVISO_AO_ATUALIZAR =
  "A regra tem alterações ainda não salvas como versão (o rascunho fica guardado e volta ao abrir a regra). Atualizar agora?";

type PropsDaTela = {
  estado: EstadoDaClassificacao;
  agenda: EstadoDaAgenda;
  rascunho: RascunhoDaRegra;
  confirmar: (mensagem: string) => boolean;
};

function TelaDaArea({
  estado,
  agenda,
  rascunho,
  confirmar,
  e,
}: PropsDaTela & { e: SnapshotDaClassificacao }) {
  const [visao, setVisao] = useState("listas");
  const idEdital = useId();
  const recarregar = () => {
    void estado.carregar(e.area);
  };
  const calcular = useCallback(
    (dados: RegistroDaClassificacao, tipo: string) =>
      calcularClassificacao(dados, tipo),
    [],
  );
  const editalEscolhido = e.editais.find((ed) => ed.id === e.editalId);

  /* A agenda das entrevistas acompanha o edital escolhido (também preenche o documento). */
  useEffect(() => {
    void agenda.carregar(e.editalId);
  }, [agenda, e.editalId]);

  const dataDeCorte = e.dados
    ? dataDeCorteDoCronograma(e.dados.cronograma)
    : null;

  return (
    <div className="ui-tela classificacao-tela" data-tour="classificacao-tela">
      <TopoDoPainel
        visoes={
          <Segmentado
            tour="classificacao-abas"
            rotulo="Visão"
            opcoes={VISOES}
            valor={visao}
            aoMudar={setVisao}
          />
        }
        status={textoDoStatus(e)}
        aoAtualizar={() => {
          if (rascunho.comAlteracoes() && !confirmar(AVISO_AO_ATUALIZAR))
            return;
          // Os editais e o escolhido (uma leitura só) e a configuração de convocação.
          void estado.carregar(e.area, { releitura: true });
          if (e.editalId) void agenda.carregar(e.editalId);
        }}
        atualizarDesativado={
          !e.area || e.carregandoEditais || e.carregandoEdital
        }
      >
        <SeloDeTreinamento edital={editalEscolhido} className="" />
        <SeloDeAvisos modulo="classificacao" />
      </TopoDoPainel>

      {e.semAcesso ? (
        <Aviso tom="warning" papel="alert">
          <strong>{MENSAGEM_SEM_ACESSO}</strong> <span>{e.erroAoCarregar}</span>
        </Aviso>
      ) : null}
      {e.erroAoCarregar && !e.semAcesso ? (
        <Aviso tom="danger" papel="alert">
          Não foi possível carregar os editais: {e.erroAoCarregar}{" "}
          <button
            type="button"
            className="btn secondary small"
            onClick={recarregar}
          >
            Tentar novamente
          </button>
        </Aviso>
      ) : null}

      {e.semAcesso ? null : (
        <>
          <section
            className="ui-card classificacao-edital"
            aria-label="Edital"
            data-tour="classificacao-edital"
          >
            <Campo rotulo="Edital">
              <select
                id={idEdital}
                data-tour="classificacao-seletor-edital"
                value={e.editalId}
                disabled={!e.carregado}
                onChange={(ev) => void estado.escolherEdital(ev.target.value)}
              >
                <option value="">
                  {e.carregado
                    ? e.editais.length
                      ? "Escolha o edital"
                      : "Nenhum edital com análises nesta área"
                    : "Carregando…"}
                </option>
                {e.editais.map((ed) => (
                  <option key={ed.id} value={ed.id}>
                    {[ed.edital, ed.unidade].filter(Boolean).join(" - ")}
                    {ed.candidatos
                      ? ` (${ed.candidatos.toLocaleString("pt-BR")})`
                      : ""}
                    {ed.versao_regra
                      ? ` · ${rotuloDaVersao({ versao: ed.versao_regra, nome: ed.nome_regra })}`
                      : ""}
                    {sufixoDeTreinamento(ed)}
                  </option>
                ))}
              </select>
            </Campo>
            <SeloDeTreinamento edital={editalEscolhido} className="" />
          </section>

          {e.erroDoEdital ? (
            <Aviso tom="danger" papel="alert">
              Não foi possível abrir o edital: {e.erroDoEdital}{" "}
              <button
                type="button"
                className="btn secondary small"
                onClick={() => void estado.escolherEdital(e.editalId)}
              >
                Tentar novamente
              </button>
            </Aviso>
          ) : null}

          {e.editalId ? (
            visao === "listas" && (e.dados || e.carregandoEdital) ? (
              <Listas
                key={e.editalId}
                estado={estado}
                e={e}
                calcular={calcular}
                aoAbrirAgenda={() => setVisao("agenda")}
                confirmar={confirmar}
              />
            ) : visao === "agenda" && e.dados ? (
              <Agenda
                key={e.editalId}
                estado={estado}
                agenda={agenda}
                e={e}
                calcular={calcular}
              />
            ) : visao === "regra" && e.dados ? (
              <Regra
                key={`${e.editalId}:${e.dados.regra?.versao ?? 0}`}
                estado={estado}
                e={e}
                dataDeCorte={dataDeCorte}
                rascunhoGuardado={rascunho}
              />
            ) : e.carregandoEdital ? (
              <div className="ui-card" aria-busy="true">
                <div className="ui-esqueleto-linha" />
                <div className="ui-esqueleto-linha" />
              </div>
            ) : null
          ) : null}
        </>
      )}
    </div>
  );
}

export function TelaDeClassificacao({
  estado,
  agenda,
  rascunho,
  confirmar = (mensagem) => globalThis.confirm?.(mensagem) ?? true,
}: Omit<PropsDaTela, "confirmar"> & {
  confirmar?: PropsDaTela["confirmar"];
}) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const { area: areaDoApp } = usarAreaAtual();

  /* A área do app mudou com a tela aberta: recarrega com a nova. */
  useEffect(() => {
    const { area } = estado.obter();
    if (area && areaDoApp && area !== areaDoApp)
      void estado.carregar(areaDoApp);
  }, [estado, areaDoApp]);

  return (
    <TelaDaArea
      key={e.area || "sem-area"}
      estado={estado}
      agenda={agenda}
      rascunho={rascunho}
      confirmar={confirmar}
      e={e}
    />
  );
}

/**
 * Monta a tela na `<section id="page-classificacao">` e devolve o
 * controlador do legado: `render()` a cada abertura (carrega a área atual).
 */
export function montarClassificacao({
  secao = document.getElementById("page-classificacao"),
  supabase = getSupabaseClient(),
  toast,
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
  baixar,
  imprimir,
  copiar,
  carregarLogo,
  cabecalho = () =>
    estadoDasConfiguracoes.obter().valores?.get?.(CHAVE_DO_CABECALHO) || "",
  rascunho = criarRascunhoDaRegra({ tipo: "CLASSIFICACAO", supabase }),
  confirmar,
}: OpcoesDaTela = {}) {
  const agenda = criarEstadoDaAgenda({
    supabase,
    toast,
    ...(baixar ? { baixar } : {}),
  });
  const estado = criarEstadoDaClassificacao({
    supabase,
    toast,
    cabecalho,
    agendaDoEdital: (editalId) => agenda.agendaDoDocumento(editalId),
    // Versão nova salva: o rascunho guardado acaba antes de a aba Regra remontar.
    aoGravarVersao: (editalId) => void rascunho.esquecer(editalId),
    ...(baixar ? { baixar } : {}),
    ...(imprimir ? { imprimir } : {}),
    ...(copiar ? { copiar } : {}),
    ...(carregarLogo ? { carregarLogo } : {}),
  });
  const raiz = secao
    ? montarModulo(
        secao,
        <TelaDeClassificacao
          estado={estado}
          agenda={agenda}
          rascunho={rascunho}
          {...(confirmar ? { confirmar } : {})}
        />,
        {
          nome: "a tela de classificação",
        },
      ).raiz
    : null;
  return {
    estado,
    agenda,
    rascunho,
    raiz,
    render() {
      return estado.carregar(String(areaAtual() ?? "").trim());
    },
  };
}
