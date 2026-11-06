import { useEffect, useState, useSyncExternalStore } from "react";
import { editaisDaEscolha } from "../../lib/avaliacao-documental/editais.ts";
import { irParaTela } from "../../app/ir-para-tela.ts";
import {
  TelaNaUrl,
  usarEditalNaUrl,
  usarLojaNaUrl,
} from "../../app/usar-filtros-na-url.ts";
import type { EsquemaDosFiltros } from "../../app/filtros-no-endereco.ts";
import { abasDoMenu, catalogoDoBanco } from "../../modules/catalogo-de-abas.ts";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.ts";
import { SeletorDeEdital } from "../../componentes/seletor-de-edital.tsx";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { editalEscolhido } from "../../lib/edital-de-treinamento.ts";
import {
  PAPEIS_DA_EQUIPE,
  rotuloDe,
} from "../../lib/avaliacao-documental/catalogo.ts";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { Aviso, CabecalhoDaTela, Segmentado } from "../../ui/index.ts";
import { CHAVE_DO_CABECALHO } from "../../lib/cabecalho-dos-documentos.ts";
import { estadoDasConfiguracoes } from "../configuracoes/estado.ts";
import {
  coordenaOEdital,
  visaoNaTela,
  visoesDaPessoa,
} from "./abas-e-entrada.ts";
import { EntradaDaAvaliacao } from "./entrada-da-avaliacao.tsx";
import { Equipe } from "./equipe.tsx";
import { EspelhosDaAvaliacao } from "./espelhos.tsx";
import {
  criarEstadoDaAvaliacao,
  MENSAGEM_SEM_ACESSO,
  VISOES_DA_AVALIACAO,
} from "./estado.ts";
import type { LojaDaAvaliacao } from "./estado.ts";
import { criarEstadoDaFila, lerFichaLembrada } from "./estado-da-fila.ts";
import type { LojaDaFila } from "./estado-da-fila.ts";
import { criarEstadoDaPreClassificacao } from "./estado-da-pre-classificacao.ts";
import type {
  Avisar,
  ClienteDaAvaliacao,
  EstadoDaAvaliacao,
  FichaLembrada,
} from "./tipos-do-estado.ts";
import { Fila } from "./fila.tsx";
import { OrigemDaAnalise } from "./origem-da-analise.tsx";
import { PreClassificacao } from "./pre-classificacao.tsx";
import { normalizarRegraAnalise } from "../../lib/avaliacao-documental/regra.ts";
import { abrirRegrasDoEdital } from "../regras-do-edital/abrir.ts";
import { ResumoDaRegraDaEtapa } from "../regras-do-edital/resumo-da-regra-da-etapa.tsx";
import "./avaliacao-documental.css";
import "./ficha/ficha.css";

/*
  A tela Avaliação documental (view `avaliacao-documental`), módulo do app:
  monta direto na `<section id="page-avaliacao-documental">` do index.html. A
  navegação é dona da classe `.active` e chama `render()` ao navegar (tabela
  a rota de src/app/telas.tsx).

  Fases F1 a F3 (docs/analises-no-monitora/plano-de-construcao.md): escolha
  do edital (só os vigentes, com "Mostrar todos os editais da área"), a regra
  da avaliação resumida (editar é nas Regras do edital, em Editais, desde
  03/11/2026), a equipe, a triagem (Provisória por ART e
  lote, gravados pelo job Python; listas PROVISORIA e LOTE) e a fila (etapas,
  distribuição e reserva da ficha). O conteúdo da ficha entra na F4. O Painel
  das análises (view `analises`) continua sendo a leitura.
*/

/*
  Seções por papel (abas-e-entrada.ts): quem coordena o edital vê Fila,
  Documentos e Configurações no cabeçalho; os demais, só a Fila, sem o
  seletor. Sem edital escolhido não há seções: a entrada mostra os cartões
  dos editais.
*/
const ABAS_CONFIGURACOES = [
  { valor: "regra", rotulo: "Regras e critérios" },
  { valor: "equipe", rotulo: "Equipe e permissões" },
] as const;

/* A aba (visão) na URL (?aba=pre); trocar de aba é entrada nova no histórico. */
const FILTROS_DA_AVALIACAO: EsquemaDosFiltros<"aba"> = Object.freeze({
  aba: {
    padrao: "fila",
    aceita: (aba: string) =>
      (VISOES_DA_AVALIACAO as ReadonlyArray<string>).includes(aba),
    empilha: true,
  },
});
/* Na troca de aba, só o edital fica na URL (os filtros da Fila saem). */
const FICA_NA_TROCA_DE_ABA = Object.freeze(["edital"]);

type LojaDaPreClassificacao = ReturnType<typeof criarEstadoDaPreClassificacao>;
type OpcoesDaPreClassificacao = NonNullable<
  Parameters<typeof criarEstadoDaPreClassificacao>[0]
>;

/** O "Atualizar" da tela (criarAtualizacao): devolve se os editais carregaram. */
type Atualizar = (area?: string) => Promise<unknown>;

interface PropsDaTela {
  estado: LojaDaAvaliacao;
  pre: LojaDaPreClassificacao;
  fila: LojaDaFila;
  atualizar: Atualizar;
}

interface PropsDaTelaDaArea extends PropsDaTela {
  e: EstadoDaAvaliacao;
}

function TelaDaArea({ estado, pre, fila, atualizar, e }: PropsDaTelaDaArea) {
  const visao = visaoNaTela(e);
  const visoes = visoesDaPessoa(e);
  // O edital e a aba na URL: o link copiado abre a tela neles.
  const escolherEdital = usarEditalNaUrl({
    editalId: e.editalId,
    editais: e.editais,
    carregado: e.carregado,
    escolher: (id) => void estado.escolherEdital(id),
  });
  const mudarAba = usarLojaNaUrl(
    FILTROS_DA_AVALIACAO,
    { aba: e.visao || "fila" },
    ({ aba }) => {
      if (aba) estado.mudarVisao(aba);
    },
    {
      // A aba pedida espera o papel no edital (quem não coordena só vê a Fila).
      pronta: e.carregado && (!e.editalId || Boolean(e.dados)),
      manter: FICA_NA_TROCA_DE_ABA,
    },
  );
  const escolherAba = (aba: string) => mudarAba({ aba });
  const coordena = coordenaOEdital(e) === true;
  /*
    A Triagem começa a ler assim que o edital é escolhido (a lista
    de editais já diz se a pessoa coordena), junto com a regra, e não depois
    dela: resumo, cartão "Inscrições" e trava saem em paralelo.
  */
  useEffect(() => {
    if (!e.editalId || visao !== "pre") return;
    // A Triagem abre só com o resumo; cada aba pede a sua parte ao abrir.
    void pre.garantirCarregado(e.editalId);
  }, [pre, e.editalId, visao]);
  // A equipe (com gestores e pessoas) só quando a aba Equipe abre.
  const lerEquipe =
    Boolean(e.editalId) &&
    Boolean(e.dados?.pode_coordenar) &&
    e.visao === "equipe" &&
    !e.equipe;
  useEffect(() => {
    if (lerEquipe) void estado.carregarEquipe(e.editalId);
  }, [estado, lerEquipe, e.editalId]);
  // A mesma escolha do seletor vale para os cartões da entrada.
  const [todos, setTodos] = useState(false);
  const { lista: editais } = editaisDaEscolha(e.editais, {
    todos,
    escolhido: e.editalId,
  });
  const recarregar = () => void estado.carregar(e.area);
  const papel = e.dados?.papel;
  const escolhido = editalEscolhido(e.editais, e.editalId);
  const preIndependenteAtiva =
    Boolean(catalogoDoBanco()) &&
    abasDoMenu().some(
      (aba) =>
        aba.id === "pre-classificacao" &&
        aba.areas.some((item) => item.area === e.area),
    );
  // Modo de análise: a ficha aberta ocupa a tela; só a Fila (que a desenha) fica montada.
  const sf = useSyncExternalStore(fila.assinar, fila.obter);
  const emAnalise = visao === "fila" && Boolean(sf.aberta?.ficha || sf.abrindo);
  const { nome: nomeDaArea } = usarAreaAtual();
  return (
    <div
      className="ui-tela avd-tela ui-tela-da-selecao"
      data-modo={emAnalise ? "analise" : undefined}
    >
      {emAnalise ? null : (
        <CabecalhoDaTela
          trilha={[nomeDaArea, "Seleção"].filter(Boolean).join(" / ")}
          titulo="Avaliação documental"
          tour="avd-cabecalho"
          edital={
            e.semAcesso ? null : (
              <SeletorDeEdital
                naLinha
                className="avd-edital"
                tour="avd-seletor-edital"
                dadosDosTodos={{ "data-tour": "avd-todos-editais" }}
                editais={e.editais}
                escolhido={e.editalId}
                carregado={e.carregado}
                soVigentes
                todos={todos}
                aoMudarTodos={setTodos}
                aoEscolher={escolherEdital}
              >
                {/* Quem coordena vê a origem (e a troca) só em Configurações. */}
                {e.dados && !coordena ? (
                  <OrigemDaAnalise
                    origem={e.dados.origem}
                    rotuloDoPapel={
                      papel ? rotuloDe(PAPEIS_DA_EQUIPE, papel) : ""
                    }
                    aoTrocar={estado.definirOrigem}
                  />
                ) : null}
              </SeletorDeEdital>
            )
          }
          secoes={
            e.editalId && !e.semAcesso && visoes.length > 1 ? (
              <Segmentado
                rotulo="Seções"
                opcoes={visoes}
                valor={visao}
                aoMudar={escolherAba}
                tour="avd-visoes"
              />
            ) : null
          }
          aoAtualizar={() => void atualizar()}
          atualizarDesativado={
            !e.area || e.carregandoEditais || e.carregandoEdital
          }
        />
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

          {e.editalId &&
          e.dados &&
          !emAnalise &&
          coordena &&
          !preIndependenteAtiva &&
          visao !== "pre" ? (
            <div className="avd-atalho-pre-legado">
              <button
                type="button"
                className="btn secondary small"
                onClick={() => estado.mudarVisao("pre")}
              >
                Abrir triagem
              </button>
            </div>
          ) : null}
          {e.editalId ? (
            e.dados ? (
              visao === "fila" ? (
                <Fila key={e.editalId} e={e} fila={fila} />
              ) : visao === "espelhos" ? (
                <EspelhosDaAvaliacao
                  key={e.editalId}
                  editalId={e.editalId}
                  fila={fila}
                  rotuloEdital={String(escolhido?.edital ?? "")}
                  aoAbrirPreClassificacao={() =>
                    preIndependenteAtiva
                      ? irParaTela({
                          view: "pre-classificacao",
                          edital: {
                            id: e.editalId,
                            titulo: String(escolhido?.edital ?? ""),
                          },
                        })
                      : estado.mudarVisao("pre")
                  }
                />
              ) : visao === "configuracoes" ? (
                <section
                  className="avd-configuracoes"
                  aria-label="Configurações da avaliação documental"
                >
                  <div className="ui-card avd-origem" data-tour="avd-origem">
                    <OrigemDaAnalise
                      origem={e.dados.origem}
                      rotuloDoPapel={
                        papel ? rotuloDe(PAPEIS_DA_EQUIPE, papel) : ""
                      }
                      podeTrocar={Boolean(e.dados.pode_coordenar)}
                      aoTrocar={estado.definirOrigem}
                    />
                  </div>
                  <Segmentado
                    rotulo="Configurações"
                    opcoes={ABAS_CONFIGURACOES}
                    valor={e.visao === "equipe" ? "equipe" : "regra"}
                    aoMudar={escolherAba}
                    tour="avd-configuracoes"
                  />
                  {e.visao === "equipe" ? (
                    <Equipe
                      key={`${e.editalId}:${JSON.stringify(e.equipe?.equipe ?? [])}`}
                      e={e}
                      estado={estado}
                    />
                  ) : (
                    <ResumoDaRegraDaEtapa
                      id="avdRegraResumoTitulo"
                      tour="avd-regra-resumo"
                      titulo="Regra da Avaliação documental"
                      versao={e.dados.regra?.versao ?? null}
                      nome={e.dados.regra?.nome ?? null}
                      conferida={
                        e.dados.regra
                          ? e.dados.regra.situacao === "CONFERIDA"
                          : null
                      }
                      linhas={(resumos) =>
                        resumos.resumoDaRegraDaAvaliacao(
                          e.dados?.regra
                            ? normalizarRegraAnalise(e.dados.regra.configuracao)
                            : null,
                          e.dados?.nota_minima?.nota_minima ?? null,
                        )
                      }
                      semRegra="O edital ainda não tem regra da Avaliação documental."
                      aoEditar={() =>
                        abrirRegrasDoEdital(e.editalId, "avaliacao")
                      }
                    />
                  )}
                </section>
              ) : (
                // A Triagem antiga, dentro da Avaliação: a aba dela fica fora da URL.
                <TelaNaUrl.Provider value="">
                  <PreClassificacao
                    key={`${e.editalId}:${e.dados.regra?.versao ?? 0}`}
                    e={e}
                    estado={estado}
                    pre={pre}
                  />
                </TelaNaUrl.Provider>
              )
            ) : (
              <div className="ui-card" aria-busy="true">
                <div className="ui-esqueleto-linha" />
                <div className="ui-esqueleto-linha" />
              </div>
            )
          ) : e.carregado && !e.erroAoCarregar ? (
            <EntradaDaAvaliacao editais={editais} aoAbrir={escolherEdital} />
          ) : null}
        </>
      )}
    </div>
  );
}

export function TelaDaAvaliacaoDocumental({
  estado,
  pre,
  fila,
  atualizar,
}: PropsDaTela) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const { area: areaDoApp } = usarAreaAtual();
  useEffect(() => {
    const { area } = estado.obter();
    if (!area || !areaDoApp || area === areaDoApp) return undefined;
    let vivo = true;
    // A ficha aberta salva o que falta e libera a reserva; só então a área troca.
    void Promise.resolve(fila?.fechar?.({ reler: false })).then(() => {
      if (vivo) void estado.carregar(areaDoApp);
    });
    return () => {
      vivo = false;
    };
  }, [estado, fila, areaDoApp]);
  return (
    <TelaNaUrl.Provider value="avaliacao-documental">
      <TelaDaArea
        key={e.area || "sem-area"}
        estado={estado}
        pre={pre}
        fila={fila}
        atualizar={atualizar}
        e={e}
      />
    </TelaNaUrl.Provider>
  );
}

/**
 * "Atualizar" e reabertura da tela: os editais da área e o edital aberto
 * (regra e equipe) e, na Triagem ou na Fila, a aba aberta.
 */
export function criarAtualizacao({
  estado,
  pre,
  fila,
  fichaLembrada = lerFichaLembrada,
}: {
  estado: LojaDaAvaliacao;
  pre: Pick<LojaDaPreClassificacao, "carregar">;
  fila: Pick<LojaDaFila, "carregar">;
  fichaLembrada?: () => FichaLembrada | null;
}) {
  return async function atualizar(area = estado.obter().area) {
    const antes = estado.obter();
    const { editalId } = antes;
    const visao = visaoNaTela(antes);
    // Página recarregada no modo de análise: volta ao edital e à Fila (a fila reabre a ficha).
    const lembrada = editalId ? null : fichaLembrada();
    const pedidos: [Promise<boolean>, ...Promise<unknown>[]] = [
      estado.carregar(area, { preferido: lembrada?.edital || "" }),
    ];
    if (area && area === antes.area && editalId) {
      if (visao === "pre") pedidos.push(pre.carregar(editalId));
      if (visao === "fila") pedidos.push(fila.carregar(editalId));
    }
    const [editais] = await Promise.all(pedidos);
    if (lembrada && estado.obter().editalId === lembrada.edital)
      estado.mudarVisao("fila");
    return editais;
  };
}

/**
 * Cria a tela (rota `avaliacao-documental`, src/app/telas.tsx): o conteúdo React e o
 * controlador: `render()` a cada abertura e no "Atualizar dados"
 * do app (relê a área atual e a aba aberta).
 */
export function criarAvaliacaoDocumental({
  supabase = getSupabaseClient(),
  toast,
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
  agendar,
  getProfile = () => null,
  cabecalho = () =>
    estadoDasConfiguracoes.obter().valores?.get?.(CHAVE_DO_CABECALHO) || "",
}: {
  supabase?: ClienteDaAvaliacao | null;
  toast?: Avisar;
  areaAtual?: () => string | null | undefined;
  agendar?: OpcoesDaPreClassificacao["agendar"];
  getProfile?: () => unknown;
  cabecalho?: OpcoesDaPreClassificacao["cabecalho"];
} = {}) {
  const estado = criarEstadoDaAvaliacao({ supabase, toast });
  const pre = criarEstadoDaPreClassificacao({
    supabase,
    toast,
    cabecalho,
    ...(agendar ? { agendar } : {}),
  });
  const fila = criarEstadoDaFila({ supabase, toast, getProfile });
  const atualizar = criarAtualizacao({ estado, pre, fila });
  return {
    estado,
    pre,
    fila,
    nome: "a tela de avaliação documental",
    conteudo: (
      <TelaDaAvaliacaoDocumental
        estado={estado}
        pre={pre}
        fila={fila}
        atualizar={atualizar}
      />
    ),
    atualizar,
    render() {
      return atualizar(String(areaAtual() ?? "").trim());
    },
  };
}
