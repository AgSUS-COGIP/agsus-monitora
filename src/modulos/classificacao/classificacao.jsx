import {
  useCallback,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from "react";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { estadoDasConfiguracoes } from "../configuracoes/estado.js";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.js";
import { CHAVE_DO_CABECALHO } from "../../lib/cabecalho-dos-documentos.js";
import { usarAreaAtual } from "../../componentes/usar-area-atual.js";
import { classificarEdital } from "../../lib/classificacao/ajustes.js";
import { dataDeCorteDoCronograma } from "../../lib/classificacao/dados.js";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { Aviso, Campo, Segmentado, TopoDoPainel } from "../../ui/index.js";
import { abrirConversaDoEdital, definirEditalDaTela } from "../chat/ponte.js";
import { usarChatLiberado } from "../chat/usar-chat-liberado.js";
import { Agenda } from "./agenda.jsx";
import { criarEstadoDaClassificacao, MENSAGEM_SEM_ACESSO } from "./estado.js";
import { criarEstadoDaAgenda } from "./estado-da-agenda.js";
import { Listas } from "./listas.jsx";
import { Regra } from "./regra.jsx";

/*
  A tela de Classificação (view `classificacao`), módulo do app: monta direto
  na `<section id="page-classificacao">` do index.html, como Seleção e
  Entrevistas. A navegação é dona da classe `.active` da seção e chama `render()`
  do controlador ao navegar (tabela `TELAS_REACT` de src/app/navegacao.js).

  - Área: a área atual do app; trocar de área com a tela aberta recarrega.
  - Edital: escolhido no topo; a regra é DESTE edital (decidida pelo gestor).
  - Visões: "Listas" (preliminar, convocação, resultado final), "Agenda"
    (regra e agenda das entrevistas dos convocados; agenda.jsx) e "Regra".
    A agenda fica aqui, junto da lista de convocação de onde saem os
    convocados e do documento que ela preenche (DATA e HORA); quem conduz vê
    a agenda do dia em Entrevistas › Conduzir entrevistas.
  - A conta é do motor puro (src/lib/classificacao/motor.js), com a data de
    corte do cronograma quando a regra não traz a sua.
  Sem tela de carregamento: KPIs e listas em skeleton até a primeira carga.
*/

const VISOES = [
  { valor: "listas", rotulo: "Listas", icone: "fa-list-ol" },
  { valor: "agenda", rotulo: "Agenda", icone: "fa-calendar-days" },
  { valor: "regra", rotulo: "Regra", icone: "fa-sliders" },
];

function textoDoStatus(e) {
  if (e.semAcesso) return "Sem acesso";
  if (!e.carregado && e.carregandoEditais) return "Carregando editais...";
  if (e.carregandoEdital) return "Carregando o edital...";
  const regra = e.dados?.regra;
  if (regra) return `Regra v${regra.versao}`;
  return e.dados ? "Sem regra" : "";
}

/*
  A classificação de um edital numa lista: o motor, com a data de corte do
  cronograma e os ajustes da pontuação aprovados em recurso por cima da nota
  da análise (src/lib/classificacao/ajustes.js — a mesma conta da prévia do
  recurso).
*/
export function calcularClassificacao(dados, tipo) {
  return classificarEdital(dados, tipo);
}

function TelaDaArea({ estado, agenda, e }) {
  const [visao, setVisao] = useState("listas");
  const idEdital = useId();
  const recarregar = () => {
    void estado.carregar(e.area);
  };
  const calcular = useCallback(
    (dados, tipo) => calcularClassificacao(dados, tipo),
    [],
  );
  const chat = usarChatLiberado();
  const editalEscolhido = e.editais.find((ed) => ed.id === e.editalId);
  const tituloDoEdital = editalEscolhido
    ? editalEscolhido.edital || editalEscolhido.unidade || ""
    : "";

  /* A agenda das entrevistas acompanha o edital escolhido (também preenche o documento). */
  useEffect(() => {
    void agenda.carregar(e.editalId);
  }, [agenda, e.editalId]);

  /* O edital escolhido vale para "Compartilhar esta tela" do chat. */
  useEffect(() => {
    definirEditalDaTela(
      e.editalId
        ? { view: "classificacao", id: e.editalId, titulo: tituloDoEdital }
        : null,
    );
    return () => definirEditalDaTela(null);
  }, [e.editalId, tituloDoEdital]);

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
          recarregar();
          if (e.editalId) {
            void estado.escolherEdital(e.editalId);
            void agenda.carregar(e.editalId);
          }
        }}
        atualizarDesativado={
          !e.area || e.carregandoEditais || e.carregandoEdital
        }
      />

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
                      : "Nenhum edital nesta área"
                    : "Carregando…"}
                </option>
                {e.editais.map((ed) => (
                  <option key={ed.id} value={ed.id}>
                    {[ed.edital, ed.unidade].filter(Boolean).join(" - ")}
                    {ed.candidatos
                      ? ` (${ed.candidatos.toLocaleString("pt-BR")})`
                      : ""}
                    {ed.versao_regra ? ` · regra v${ed.versao_regra}` : ""}
                  </option>
                ))}
              </select>
            </Campo>
            {chat && e.editalId ? (
              <button
                type="button"
                className="btn secondary classificacao-conversa"
                onClick={() =>
                  abrirConversaDoEdital({
                    id: e.editalId,
                    titulo: tituloDoEdital,
                  })
                }
              >
                <i className="fa-solid fa-comments" aria-hidden="true" />{" "}
                Conversa
              </button>
            ) : null}
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
            visao === "listas" ? (
              <Listas
                key={e.editalId}
                estado={estado}
                e={e}
                calcular={calcular}
                aoAbrirAgenda={() => setVisao("agenda")}
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
              />
            ) : (
              <div className="ui-card" aria-busy="true">
                <div className="ui-esqueleto-linha" />
                <div className="ui-esqueleto-linha" />
              </div>
            )
          ) : null}
        </>
      )}
    </div>
  );
}

export function TelaDeClassificacao({ estado, agenda }) {
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
} = {}) {
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
    ...(baixar ? { baixar } : {}),
    ...(imprimir ? { imprimir } : {}),
    ...(copiar ? { copiar } : {}),
    ...(carregarLogo ? { carregarLogo } : {}),
  });
  const raiz = secao
    ? montarModulo(
        secao,
        <TelaDeClassificacao estado={estado} agenda={agenda} />,
        {
          nome: "a tela de classificação",
        },
      ).raiz
    : null;
  return {
    estado,
    agenda,
    raiz,
    render() {
      return estado.carregar(String(areaAtual() ?? "").trim());
    },
  };
}
