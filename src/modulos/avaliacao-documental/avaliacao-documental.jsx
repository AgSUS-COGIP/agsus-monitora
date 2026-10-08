import { useEffect, useState, useSyncExternalStore } from "react";
import { editaisDaEscolha } from "../../lib/avaliacao-documental/editais.js";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.js";
import { SeloDeTreinamento } from "../../componentes/selo-de-treinamento.jsx";
import { usarAreaAtual } from "../../componentes/usar-area-atual.js";
import {
  editalEscolhido,
  sufixoDeTreinamento,
} from "../../lib/edital-de-treinamento.js";
import {
  PAPEIS_DA_EQUIPE,
  rotuloDe,
  SITUACOES_DA_REGRA,
} from "../../lib/avaliacao-documental/catalogo.js";
import { rotuloDaVersao } from "../../lib/nome-da-versao.ts";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { Aviso, Campo, Segmentado, TopoDoPainel } from "../../ui/index.js";
import { CHAVE_DO_CABECALHO } from "../../lib/cabecalho-dos-documentos.js";
import { estadoDasConfiguracoes } from "../configuracoes/estado.js";
import { Equipe } from "./equipe.jsx";
import { criarEstadoDaAvaliacao, MENSAGEM_SEM_ACESSO } from "./estado.js";
import { criarEstadoDaFila, lerFichaLembrada } from "./estado-da-fila.js";
import { criarEstadoDaPreClassificacao } from "./estado-da-pre-classificacao.js";
import { Fila } from "./fila.jsx";
import { PreClassificacao } from "./pre-classificacao.jsx";
import { Regra } from "./regra.jsx";

/*
  A tela Avaliação documental (view `avaliacao-documental`), módulo do app:
  monta direto na `<section id="page-avaliacao-documental">` do index.html. A
  navegação é dona da classe `.active` e chama `render()` ao navegar (tabela
  `TELAS_REACT` de src/app/navegacao.js).

  Fases F1 a F3 (docs/analises-no-monitora/plano-de-construcao.md): escolha
  do edital (só os vigentes, com "Mostrar todos os editais da área"), a regra
  da avaliação (modelo, versões com motivo, perguntas da Empregare, prévia com
  candidato fictício), a equipe, a pré-classificação (Provisória por ART e
  lote, gravados pelo job Python; listas PROVISORIA e LOTE) e a fila (etapas,
  distribuição e reserva da ficha). O conteúdo da ficha entra na F4. O Painel
  das análises (view `analises`) continua sendo a leitura.
*/

const VISOES = [
  { valor: "regra", rotulo: "Regra", icone: "fa-sliders" },
  { valor: "equipe", rotulo: "Equipe", icone: "fa-users" },
  { valor: "pre", rotulo: "Pré-classificação", icone: "fa-ranking-star" },
  { valor: "fila", rotulo: "Fila", icone: "fa-list-check" },
];
const ORIGENS = {
  PLANILHA: "Planilha",
  COMPARACAO: "Comparação",
  MONITORA: "MONITORA",
};

function textoDoStatus(e) {
  if (e.semAcesso) return "Sem acesso";
  if (!e.carregado && e.carregandoEditais) return "Carregando editais...";
  if (e.carregandoEdital) return "Carregando o edital...";
  const regra = e.dados?.regra;
  if (regra)
    return `${rotuloDaVersao(regra)} · ${rotuloDe(SITUACOES_DA_REGRA, regra.situacao)}`;
  return e.dados ? "Sem regra" : "";
}

function TelaDaArea({ estado, pre, fila, atualizar, e }) {
  const visao = e.visao;
  const [todos, setTodos] = useState(false);
  const { lista: editais, ocultos } = editaisDaEscolha(e.editais, {
    todos,
    escolhido: e.editalId,
  });
  const recarregar = () => void estado.carregar(e.area);
  const papel = e.dados?.papel;
  const escolhido = editalEscolhido(e.editais, e.editalId);
  // Modo de análise: a ficha aberta ocupa a tela; só a Fila (que a desenha) fica montada.
  const sf = useSyncExternalStore(fila.assinar, fila.obter);
  const emAnalise = visao === "fila" && Boolean(sf.aberta?.ficha || sf.abrindo);
  return (
    <div
      className="ui-tela avd-tela"
      data-modo={emAnalise ? "analise" : undefined}
    >
      {emAnalise ? null : (
        <TopoDoPainel
          visoes={
            <Segmentado
              rotulo="Visão"
              opcoes={VISOES}
              valor={visao}
              aoMudar={estado.mudarVisao}
              tour="avd-visoes"
            />
          }
          status={textoDoStatus(e)}
          aoAtualizar={() => void atualizar()}
          atualizarDesativado={
            !e.area || e.carregandoEditais || e.carregandoEdital
          }
        >
          <SeloDeTreinamento edital={escolhido} />
        </TopoDoPainel>
      )}

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
          {emAnalise ? null : (
            <section className="ui-card avd-edital" aria-label="Edital">
              <Campo rotulo="Edital">
                <select
                  value={e.editalId}
                  data-tour="avd-seletor-edital"
                  disabled={!e.carregado}
                  onChange={(ev) => void estado.escolherEdital(ev.target.value)}
                >
                  <option value="">
                    {e.carregado
                      ? editais.length
                        ? "Escolha o edital"
                        : e.editais.length
                          ? "Nenhum edital vigente nesta área"
                          : "Nenhum edital nesta área"
                      : "Carregando…"}
                  </option>
                  {editais.map((ed) => (
                    <option key={ed.id} value={ed.id}>
                      {[ed.edital, ed.unidade].filter(Boolean).join(" - ")}
                      {ed.versao_regra
                        ? ` · ${rotuloDaVersao({ versao: ed.versao_regra, nome: ed.nome_regra })}`
                        : ""}
                      {sufixoDeTreinamento(ed)}
                    </option>
                  ))}
                </select>
              </Campo>
              <SeloDeTreinamento edital={escolhido} />
              {ocultos || todos ? (
                <label className="avd-caixa" data-tour="avd-todos-editais">
                  <input
                    type="checkbox"
                    checked={todos}
                    onChange={(ev) => setTodos(ev.target.checked)}
                  />
                  Mostrar todos os editais da área
                </label>
              ) : null}
              {e.dados ? (
                <span
                  className="ui-texto-secundario"
                  data-origem={e.dados.origem}
                >
                  Avaliação: {ORIGENS[e.dados.origem] ?? e.dados.origem}
                  {papel ? ` · ${rotuloDe(PAPEIS_DA_EQUIPE, papel)}` : ""}
                </span>
              ) : null}
            </section>
          )}

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
            e.dados ? (
              visao === "regra" ? (
                <Regra
                  key={`${e.editalId}:${e.dados.regra?.versao ?? 0}`}
                  e={e}
                  estado={estado}
                />
              ) : visao === "fila" ? (
                <Fila key={e.editalId} e={e} fila={fila} />
              ) : visao === "pre" ? (
                <PreClassificacao
                  key={`${e.editalId}:${e.dados.regra?.versao ?? 0}`}
                  e={e}
                  estado={estado}
                  pre={pre}
                />
              ) : (
                <Equipe
                  key={`${e.editalId}:${JSON.stringify(e.equipe?.equipe ?? [])}`}
                  e={e}
                  estado={estado}
                />
              )
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

export function TelaDaAvaliacaoDocumental({ estado, pre, fila, atualizar }) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const { area: areaDoApp } = usarAreaAtual();
  useEffect(() => {
    const { area } = estado.obter();
    if (area && areaDoApp && area !== areaDoApp)
      void estado.carregar(areaDoApp);
  }, [estado, areaDoApp]);
  return (
    <TelaDaArea
      key={e.area || "sem-area"}
      estado={estado}
      pre={pre}
      fila={fila}
      atualizar={atualizar}
      e={e}
    />
  );
}

/**
 * "Atualizar" e reabertura da tela: os editais da área e o edital aberto
 * (regra e equipe) e, na Pré-classificação ou na Fila, a aba aberta.
 */
export function criarAtualizacao({
  estado,
  pre,
  fila,
  fichaLembrada = lerFichaLembrada,
}) {
  return async function atualizar(area = estado.obter().area) {
    const { area: antes, editalId, visao } = estado.obter();
    const pedidos = [estado.carregar(area)];
    if (area && area === antes && editalId) {
      if (visao === "pre") pedidos.push(pre.carregar(editalId));
      if (visao === "fila") pedidos.push(fila.carregar(editalId));
    }
    const [editais] = await Promise.all(pedidos);
    // Página recarregada no modo de análise: volta ao edital e à Fila (a fila reabre a ficha).
    const lembrada = fichaLembrada();
    const agora = estado.obter();
    if (
      lembrada &&
      !agora.editalId &&
      agora.editais.some((ed) => ed.id === lembrada.edital)
    ) {
      estado.mudarVisao("fila");
      await estado.escolherEdital(lembrada.edital);
    }
    return editais;
  };
}

/**
 * Monta a tela na `<section id="page-avaliacao-documental">` e devolve o
 * controlador do legado: `render()` a cada abertura e no "Atualizar dados"
 * do app (relê a área atual e a aba aberta).
 */
export function montarAvaliacaoDocumental({
  secao = document.getElementById("page-avaliacao-documental"),
  supabase = getSupabaseClient(),
  toast,
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
  agendar,
  cabecalho = () =>
    estadoDasConfiguracoes.obter().valores?.get?.(CHAVE_DO_CABECALHO) || "",
} = {}) {
  const estado = criarEstadoDaAvaliacao({ supabase, toast });
  const pre = criarEstadoDaPreClassificacao({
    supabase,
    toast,
    cabecalho,
    ...(agendar ? { agendar } : {}),
  });
  const fila = criarEstadoDaFila({ supabase, toast });
  const atualizar = criarAtualizacao({ estado, pre, fila });
  const raiz = secao
    ? montarModulo(
        secao,
        <TelaDaAvaliacaoDocumental
          estado={estado}
          pre={pre}
          fila={fila}
          atualizar={atualizar}
        />,
        { nome: "a tela de avaliação documental" },
      ).raiz
    : null;
  return {
    estado,
    pre,
    fila,
    raiz,
    atualizar,
    render() {
      return atualizar(String(areaAtual() ?? "").trim());
    },
  };
}
