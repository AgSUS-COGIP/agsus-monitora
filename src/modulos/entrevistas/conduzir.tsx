import type { EstadoDaConducao, EstadoDaConducaoComAcoes } from "./tipos.ts";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import {
  contadorDoDia,
  contagemDosRecortes,
  hojeEmBrasilia,
  montarFila,
  recortarFila,
  recorteInicial,
  vagasDaFila,
  type Recorte,
  type Situacao,
} from "../../lib/fila-de-conducao.ts";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { comemorar } from "../../modules/comemoracao.js";
import {
  Aviso,
  EstadoVazio,
  Segmentado,
  TopoDoPainel,
} from "../../ui/index.js";
import { PrepararEdital, SeletorDoEdital } from "./conducao.jsx";
import { criarEstadoDaConducao } from "./estado-da-conducao.js";
import { FichaDoCandidato } from "./ficha.jsx";
import { FilaDoDia } from "./fila-do-dia.tsx";
import { VisaoDeRoteiros } from "./roteiros.jsx";

/*
  CONDUZIR ENTREVISTAS (view `conduzir-entrevistas`, "fazer"; secretaria e
  avaliadores), entrada própria no menu, ao lado do Painel de entrevistas
  (acompanhar) — como a Avaliação documental ao lado do Painel das análises.
  Monta na `<section id="page-conduzir-entrevistas">`; a navegação chama
  `render()` ao abrir (TELAS_REACT de src/app/navegacao.js). Recurso de
  permissão: o mesmo `entrevistas` (quem acessava a antiga tela acessa as
  duas; escrever continua exigindo Editor, conferido pelo banco).

  Duas visões no topo:
  - Fila (a primeira): abre em Hoje — a fila do dia pela agenda salva na
    Classificação › Agenda; sem entrevista hoje, Próximos; sem agenda, Todos
    —, com Hoje / Próximos / Todos, a vaga e as situações (fila-do-dia.tsx).
    O contador "7 de 12 hoje" fica no topo; clicar no cartão abre a ficha de
    notas em tela cheia (ficha.jsx), com "Salvar e abrir o próximo" na ordem
    da fila visível. Concluir o dia (todas as de hoje concluídas ou com
    falta) solta os fogos (src/modules/comemoracao.js, com o liga/desliga das
    comemorações do app), uma vez, na passagem.
  - Preparar: a configuração e a convocação do edital (conducao.jsx) e os
    roteiros de entrevista da área (roteiros.jsx) — a configuração do gestor,
    como Regra e Equipe ficam na própria tela da Avaliação documental. Quem
    só lê vê tudo sem os botões.

  O edital: o seletor vale para as duas visões; abre sozinho o último
  aberto na área (guardado no navegador, só conveniência) ou, com um edital
  só na lista, ele. Edital de treinamento aparece com o selo (o banco manda
  a marca). Área = a atual do app; trocar de área recomeça.
*/

const VISOES = Object.freeze([
  Object.freeze({ valor: "fila", rotulo: "Fila", icone: "fa-list-check" }),
  Object.freeze({ valor: "preparar", rotulo: "Preparar", icone: "fa-sliders" }),
]);
export type Visao = "fila" | "preparar";
const CHAVE_DO_EDITAL = "agsus:conduzir-entrevistas:edital";

/* A visão escolhida, fora do React: o controlador abre a pedida (links antigos). */
function criarVisao() {
  let visao: Visao = "fila";
  const ouvintes = new Set<() => void>();
  return {
    obter: () => visao,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => void ouvintes.delete(ouvinte);
    },
    definir(nova: string) {
      const valida: Visao = nova === "preparar" ? "preparar" : "fila";
      if (valida === visao) return;
      visao = valida;
      for (const ouvinte of ouvintes) ouvinte();
    },
  };
}
type EstadoDaVisao = ReturnType<typeof criarVisao>;

type Comemorar = (opcoes: {
  texto: string;
  confete: string;
  forma: string;
}) => unknown;

function textoDoStatus(e: EstadoDaConducao) {
  if (e.carregandoEdital) return "Carregando o edital…";
  if (e.editais.carregando && !e.editais.carregado)
    return "Carregando editais…";
  const edital = e.edital?.edital;
  return edital ? `Edital ${edital.edital || ""}`.trim() : "";
}

function TelaDeConducao({
  conducao,
  visoes,
  comemoracoesLigadas,
  aoComemorar,
  doPainel,
  hojeDe,
}: {
  conducao: EstadoDaConducaoComAcoes;
  visoes: EstadoDaVisao;
  comemoracoesLigadas: () => boolean;
  aoComemorar: Comemorar;
  doPainel: () => unknown[];
  hojeDe: () => string;
}) {
  const e = useSyncExternalStore(conducao.assinar, conducao.obter);
  const visao = useSyncExternalStore(visoes.assinar, visoes.obter);
  const { area: areaDoApp } = usarAreaAtual();
  const hoje = hojeDe();
  const dados = e.edital;
  const fila = useMemo(
    () => (dados ? montarFila(dados, e.agenda) : []),
    [dados, e.agenda],
  );
  const contagem = useMemo(() => contagemDosRecortes(fila, hoje), [fila, hoje]);
  const contador = useMemo(() => contadorDoDia(fila, hoje), [fila, hoje]);
  const vagas = useMemo(() => vagasDaFila(fila), [fila]);
  const editalId = dados?.edital?.id || "";
  const [escolha, setEscolha] = useState<{
    edital: string;
    recorte: Recorte;
  } | null>(null);
  const [vaga, setVaga] = useState("");
  // O "Editar" de "Como a nota é calculada" (Preparar) abre o roteiro do edital no editor.
  const [pedidoDeRoteiro, setPedidoDeRoteiro] = useState<{
    roteiro: unknown;
    vez: number;
  } | null>(null);
  const [situacao, setSituacao] = useState<Situacao | "">("");
  // O recorte vale para o edital em que foi escolhido; outro edital abre no inicial.
  const recorte =
    escolha && escolha.edital === editalId
      ? escolha.recorte
      : recorteInicial(fila, hoje);
  const itens = useMemo(
    () => recortarFila(fila, { recorte, vaga, hoje }),
    [fila, recorte, vaga, hoje],
  );
  const visiveis = situacao
    ? itens.filter((i) => i.situacao === situacao)
    : itens;

  /* Trocou a área com a tela aberta: recomeça na nova. */
  useEffect(() => {
    if (e.area && areaDoApp && e.area !== areaDoApp) {
      conducao.trocarArea(areaDoApp);
      void conducao.carregarEditais(areaDoApp, doPainel());
    }
  }, [conducao, e.area, areaDoApp, doPainel]);

  /* Outro edital: vaga e situação recomeçam. */
  useEffect(() => {
    setVaga("");
    setSituacao("");
  }, [editalId]);

  /* Preparar usa os roteiros (configuração do edital e a lista da área). */
  useEffect(() => {
    if (visao !== "preparar") return;
    const { carregado, carregando } = conducao.obter().roteiros;
    if (!carregado && !carregando) void conducao.carregarRoteiros(e.area);
  }, [conducao, visao, e.area]);

  /* Concluir o dia: comemora na passagem (não ao abrir um dia já concluído). */
  const anterior = useRef<{ chave: string; completo: boolean } | null>(null);
  useEffect(() => {
    if (!editalId || !contador.total) return;
    const chave = `${editalId}:${hoje}`;
    const antes = anterior.current;
    anterior.current = { chave, completo: contador.completo };
    if (
      antes?.chave === chave &&
      !antes.completo &&
      contador.completo &&
      comemoracoesLigadas()
    )
      aoComemorar({
        texto: `Entrevistas de hoje concluídas: ${contador.feitas} de ${contador.total}!`,
        confete: "fogos",
        forma: "check",
      });
  }, [editalId, hoje, contador, comemoracoesLigadas, aoComemorar]);

  const convocado = e.fichaAberta
    ? dados?.convocados.find((c) => c.id === e.fichaAberta) || null
    : null;
  if (dados && convocado) {
    // A ordem do "próximo" é a da fila visível (sem ela, a do edital).
    const daFila = visiveis.map((i) => i.convocado);
    const lista = daFila.some((c) => c.id === convocado.id)
      ? daFila
      : dados.convocados;
    return (
      <div
        className="ui-tela entrevistas-tela entrevistas-conduzir"
        data-modo="analise"
      >
        <div
          className="entrevistas-visao entrevistas-conducao"
          data-modo="analise"
        >
          <FichaDoCandidato
            key={convocado.id}
            dados={dados}
            convocado={convocado}
            convocados={lista}
            salvando={e.acao?.tipo === "notas"}
            aoSalvar={(p: unknown) => conducao.lancarNotas(convocado.id, p)}
            aoAbrir={(id: string) => conducao.abrirFicha(id)}
            aoFechar={() => conducao.abrirFicha(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="ui-tela entrevistas-tela entrevistas-conduzir"
      data-tour="conduzir-tela"
    >
      <TopoDoPainel
        visoes={
          <Segmentado
            tour="conduzir-visoes"
            rotulo="Visão da tela"
            className="entrevistas-visoes"
            opcoes={VISOES}
            valor={visao}
            aoMudar={visoes.definir}
          />
        }
        status={textoDoStatus(e)}
        aoAtualizar={() => {
          void conducao.carregarEditais(e.area, doPainel());
          if (e.editalId) void conducao.recarregarEdital();
          if (visao === "preparar") void conducao.carregarRoteiros(e.area);
        }}
        atualizarDesativado={!e.area || e.carregandoEdital}
      >
        {contador.total ? (
          <span
            className="entrevistas-contador-do-dia"
            data-completo={contador.completo ? "sim" : undefined}
            data-tour="conduzir-contador"
            role="status"
          >
            <strong>
              {contador.feitas} de {contador.total}
            </strong>{" "}
            hoje
            <span className="entrevistas-contador-barra" aria-hidden="true">
              <span
                style={{
                  width: `${(contador.feitas / contador.total) * 100}%`,
                }}
              />
            </span>
          </span>
        ) : null}
      </TopoDoPainel>

      <SeletorDoEdital
        conducao={conducao}
        e={e}
        area={e.area}
        doPainel={doPainel()}
      />

      {visao === "fila" ? (
        !e.editalId && e.editais.lista.length ? (
          <EstadoVazio className="ui-card entrevistas-sem-edital">
            Escolha o edital para ver a fila.
          </EstadoVazio>
        ) : dados && !e.carregandoEdital ? (
          <FilaDoDia
            itens={itens}
            hoje={hoje}
            recorte={recorte}
            contagem={contagem}
            aoMudarRecorte={(r) => {
              setEscolha({ edital: editalId, recorte: r });
              setSituacao("");
            }}
            vagas={vagas}
            vaga={vaga}
            aoMudarVaga={setVaga}
            situacao={situacao}
            aoMudarSituacao={setSituacao}
            aoAbrir={(id) => conducao.abrirFicha(id)}
          />
        ) : null
      ) : (
        <>
          <PrepararEdital
            conducao={conducao}
            e={e}
            aoEditarRoteiro={(roteiro: unknown) =>
              setPedidoDeRoteiro((p) => ({ roteiro, vez: (p?.vez ?? 0) + 1 }))
            }
          />
          <VisaoDeRoteiros
            conducao={conducao}
            area={e.area}
            pedido={pedidoDeRoteiro}
          />
        </>
      )}
      {visao === "fila" &&
      dados &&
      !dados.configuracao &&
      !e.carregandoEdital ? (
        <Aviso tom="info">
          A entrevista deste edital ainda não foi configurada.{" "}
          <button
            type="button"
            className="btn secondary small"
            onClick={() => visoes.definir("preparar")}
          >
            Preparar
          </button>
        </Aviso>
      ) : null}
    </div>
  );
}

/**
 * Monta a tela na `<section id="page-conduzir-entrevistas">` e devolve o
 * controlador: `render()` a cada abertura (a área atual, os editais e o
 * edital aberto), `abrirVisao` (links antigos: "conduzir", "roteiros"),
 * `abrirEdital` (links com o edital), o estado e a raiz do React.
 */
export function montarConducaoDeEntrevistas({
  secao = document.getElementById("page-conduzir-entrevistas"),
  supabase = getSupabaseClient(),
  toast,
  comemoracoesLigadas = () => false,
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
  aoMudarResultados = () => {},
  doPainel = () => [],
  aoComemorar = comemorar as unknown as Comemorar,
  hojeDe = () => hojeEmBrasilia(),
  armazenamento = () => globalThis.localStorage,
}: {
  secao?: HTMLElement | null;
  supabase?: unknown;
  toast?: (mensagem: string, tom?: string) => void;
  comemoracoesLigadas?: () => boolean;
  areaAtual?: () => string | null | undefined;
  aoMudarResultados?: () => void;
  doPainel?: () => unknown[];
  aoComemorar?: Comemorar;
  hojeDe?: () => string;
  armazenamento?: () => Pick<Storage, "getItem" | "setItem"> | undefined;
} = {}) {
  const conducao = criarEstadoDaConducao({
    supabase,
    toast,
    aoMudarResultados,
  } as Parameters<
    typeof criarEstadoDaConducao
  >[0]) as unknown as EstadoDaConducaoComAcoes;
  const visoes = criarVisao();
  const raiz = secao
    ? montarModulo(
        secao,
        <TelaDeConducao
          conducao={conducao}
          visoes={visoes}
          comemoracoesLigadas={comemoracoesLigadas}
          aoComemorar={aoComemorar}
          doPainel={doPainel}
          hojeDe={hojeDe}
        />,
        { nome: "a tela de conduzir entrevistas" },
      ).raiz
    : null;

  /* O último edital aberto na área fica no navegador (só conveniência). */
  const chaveDoEdital = (area: string) => `${CHAVE_DO_EDITAL}:${area}`;
  function lembrar(area: string, id: string) {
    try {
      if (area && id) armazenamento()?.setItem(chaveDoEdital(area), id);
    } catch {
      // Sem armazenamento (aba privada): abre pela lista.
    }
  }
  function lembrado(area: string) {
    try {
      return armazenamento()?.getItem(chaveDoEdital(area)) || "";
    } catch {
      return "";
    }
  }
  conducao.assinar(() => {
    const { area, editalId } = conducao.obter();
    lembrar(area, editalId);
  });

  async function render() {
    const area = String(areaAtual() ?? "").trim();
    conducao.trocarArea(area);
    if (!area) return false;
    const lista = await conducao.carregarEditais(area, doPainel());
    const { editalId } = conducao.obter();
    if (editalId) return conducao.recarregarEdital();
    const guardado = lista.find((m) => m.id === lembrado(area));
    const escolhido = guardado || (lista.length === 1 ? lista[0] : null);
    return escolhido ? conducao.abrirEdital(escolhido.id) : true;
  }

  return {
    conducao,
    raiz,
    render,
    abrirVisao: (visao: string) =>
      visoes.definir(visao === "roteiros" ? "preparar" : visao),
    async abrirEdital(id: string) {
      visoes.definir("fila");
      conducao.abrirFicha(null);
      if (conducao.obter().editalId !== id) await conducao.abrirEdital(id);
    },
  };
}
