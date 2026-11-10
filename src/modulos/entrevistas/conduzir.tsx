import type { ClienteDaConducao } from "./tipos-do-estado-da-conducao.ts";
import type { EstadoDaConducao, EstadoDaConducaoComAcoes } from "./tipos.ts";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { obterDadosDoMonitoramento } from "../../componentes/dados-do-monitoramento.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import {
  TelaNaUrl,
  usarFiltrosNaUrl,
  usarLojaNaUrl,
} from "../../app/usar-filtros-na-url.ts";
import type { EsquemaDosFiltros } from "../../app/filtros-no-endereco.ts";
import { irParaTela } from "../../app/ir-para-tela.ts";
import { copiarTexto } from "../../lib/convite-de-acesso.ts";
import {
  bancasDaFila,
  buscarNaFila,
  contadorDoDia,
  contagemDosRecortes,
  horaEmBrasilia,
  hojeEmBrasilia,
  montarFila,
  proximaDoDia,
  RECORTES,
  recortarFila,
  recorteInicial,
  SITUACOES_NA_TELA,
  situacaoNaTela,
  vagasDaFila,
  type Recorte,
  type SituacaoNaTela,
} from "../../lib/fila-de-conducao.ts";
import { importarComRecarga } from "../../lib/importar-com-recarga";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { comemorar } from "../../app/comemoracao-sob-demanda.ts";
import {
  Aviso,
  CabecalhoDaTela,
  EstadoVazio,
  Segmentado,
} from "../../ui/index.ts";
import type { AcaoDoMenu } from "../../ui/index.ts";
import { criarEstadoDaConducao } from "./estado-da-conducao.ts";
import { FichaDoCandidato } from "./ficha.tsx";
import { FilaDoDia, MINHA_BANCA } from "./fila-do-dia.tsx";
import type { FiltrosDaFila } from "./fila-do-dia.tsx";
import { usarSeletorDoEdital } from "./seletor-do-edital.tsx";
import "./entrevistas.css";
import { CarregandoConteudo } from "../../ui/index.ts";

/*
  CONDUZIR ENTREVISTAS (view `conduzir-entrevistas`, "fazer"; secretaria e
  avaliadores), entrada própria no menu, ao lado do Painel de entrevistas
  (acompanhar) — como a Avaliação documental ao lado do Painel das análises.
  Monta na `<section id="page-conduzir-entrevistas">`; a navegação chama
  `render()` ao abrir (a rota, src/app/telas.tsx). Recurso de
  permissão: o mesmo `entrevistas` (quem acessava a antiga tela acessa as
  duas; escrever continua exigindo Editor, conferido pelo banco).

  O layout das telas da seleção: o cabeçalho (trilha, título, o edital, as
  seções Fila e Preparar e o Atualizar só com o ícone). Duas seções:
  - Fila (a primeira): abre em Hoje — a fila do dia pela agenda salva na
    Classificação › Agenda; sem entrevista hoje, Próximos; sem agenda, Todos
    —, com a faixa de situação (o contador "7 de 12 hoje" e a próxima
    entrevista embaixo), a barra (Hoje / Próximos / Todos, a busca por nome
    ou código, vaga e banca) e a tabela em ordem de horário
    (fila-do-dia.tsx). A ação da linha abre a ficha de notas em tela cheia
    (ficha.tsx), com "Salvar e abrir o próximo" na ordem da tabela. Concluir
    o dia (todas as de hoje concluídas ou com falta) solta os fogos
    (src/modulos/comemoracao/, com o liga/desliga das comemorações do app),
    uma vez, na passagem.
    Na URL (src/app/usar-filtros-na-url.ts): a seção (?aba=preparar), o
    período, a situação, a vaga e a banca; a busca, não.
  - Preparar: o resumo das regras e os passos Roteiro, Banca, Convocação e
    Agenda (preparar.tsx) — a configuração do gestor, como Regra e Equipe
    ficam na própria tela da Avaliação documental. Quem só lê vê tudo sem os
    botões.

  O edital: o campo no cabeçalho (seletor-do-edital.tsx) vale para as duas
  seções; abre sozinho o último
  aberto na área (guardado no navegador, só conveniência) ou, com um edital
  só na lista, ele. Edital de treinamento aparece com o selo (o banco manda
  a marca). Área = a atual do app; trocar de área recomeça.
*/

/* Preparar (passos, configuração, convocação e roteiros) só baixa ao abrir a visão. */
const PrepararEdital = lazy(
  importarComRecarga(() =>
    import("./preparar.tsx").then((m) => ({ default: m.PrepararEdital })),
  ),
);

const VISOES = Object.freeze([
  Object.freeze({ valor: "fila", rotulo: "Fila" }),
  Object.freeze({ valor: "preparar", rotulo: "Preparar" }),
]);
/* A seção na URL (?aba=preparar); trocar é entrada nova no histórico. */
const ESQUEMA_DA_SECAO: EsquemaDosFiltros<"aba"> = Object.freeze({
  aba: {
    padrao: "fila",
    aceita: (aba: string) => aba === "fila" || aba === "preparar",
    empilha: true,
  },
});
/* Os filtros da Fila na URL; a busca (nome, código) fica fora dela. */
const FILTROS_DA_FILA: EsquemaDosFiltros<
  "periodo" | "situacao" | "vaga" | "banca" | "busca"
> = Object.freeze({
  periodo: {
    padrao: "",
    aceita: (valor: string) => RECORTES.some((r) => r.valor === valor),
  },
  situacao: {
    padrao: "",
    aceita: (valor: string) => valor in SITUACOES_NA_TELA,
  },
  vaga: { padrao: "" },
  banca: { padrao: "" },
  busca: { padrao: "", naUrl: false },
});
const chaveDaFila = (edital: string) =>
  edital ? `monitora:entrevistas:fila:${edital}` : "";
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

function TelaDeConducao({
  conducao,
  visoes,
  comemoracoesLigadas,
  aoComemorar,
  doPainel,
  hojeDe,
  horaDe,
  avisar,
}: {
  conducao: EstadoDaConducaoComAcoes;
  visoes: EstadoDaVisao;
  comemoracoesLigadas: () => boolean;
  aoComemorar: Comemorar;
  doPainel: () => unknown[];
  hojeDe: () => string;
  horaDe: () => string;
  avisar: (mensagem: string, tom?: string) => void;
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
  const contador = useMemo(() => contadorDoDia(fila, hoje), [fila, hoje]);
  const editalId = dados?.edital?.id || "";
  const { nome: nomeDaArea } = usarAreaAtual();
  const seletor = usarSeletorDoEdital({ conducao, e, doPainel: doPainel() });
  // A seção na URL; o controlador também a muda (links antigos).
  const mudarSecao = usarLojaNaUrl(
    ESQUEMA_DA_SECAO,
    { aba: visao },
    ({ aba }) => {
      if (aba) visoes.definir(aba);
    },
  );
  // Os filtros da Fila: na URL e guardados na sessão da aba, por edital.
  const [valores, mudarValores] = usarFiltrosNaUrl(FILTROS_DA_FILA, {
    sessao: chaveDaFila(editalId),
  });
  const filtros: FiltrosDaFila = {
    busca: valores.busca,
    vaga: valores.vaga,
    banca: valores.banca,
    situacao: (valores.situacao || "") as SituacaoNaTela | "",
  };
  const recorte = (valores.periodo || recorteInicial(fila, hoje)) as Recorte;
  // A hora de agora (a linha "Agora" e a próxima), a cada minuto.
  const [agora, setAgora] = useState(horaDe);
  useEffect(() => {
    const relogio = setInterval(() => setAgora(horaDe()), 60_000);
    return () => clearInterval(relogio);
  }, [horaDe]);
  // As bancas de quem está na tela: o perfil entre os avaliadores do edital.
  const minhasBancas = useMemo(() => {
    const perfil = dados?.meu_perfil;
    if (!perfil) return [];
    return [
      ...new Set(
        (dados?.avaliadores || [])
          .filter((a) => a.perfil === perfil && a.ativo !== false)
          .map((a) => Number(a.banca))
          .filter((b) => Number.isFinite(b)),
      ),
    ];
  }, [dados]);
  // A fila com a busca, a vaga e a banca (o período e a situação vêm depois).
  const base = useMemo(() => {
    const bancas =
      filtros.banca === MINHA_BANCA
        ? new Set(minhasBancas)
        : filtros.banca
          ? new Set([Number(filtros.banca)])
          : null;
    return buscarNaFila(fila, filtros.busca).filter(
      (i) =>
        (!filtros.vaga || i.vaga === filtros.vaga) &&
        (!bancas || (i.banca !== null && bancas.has(i.banca))),
    );
  }, [fila, filtros.busca, filtros.vaga, filtros.banca, minhasBancas]);
  const contagem = useMemo(() => contagemDosRecortes(base, hoje), [base, hoje]);
  const doRecorte = useMemo(
    () => recortarFila(base, { recorte, hoje }),
    [base, recorte, hoje],
  );
  // A lista na tela (a ordem do "próximo"): "Sem nota" é de qualquer dia.
  const naTela = useMemo(() => {
    const s = filtros.situacao;
    if (s === "sem_nota")
      return base.filter((i) => situacaoNaTela(i, hoje) === "sem_nota");
    return s
      ? doRecorte.filter((i) => situacaoNaTela(i, hoje) === s)
      : doRecorte;
  }, [base, doRecorte, filtros.situacao, hoje]);
  const proxima = useMemo(
    () => proximaDoDia(fila, hoje, agora),
    [fila, hoje, agora],
  );
  const vagas = useMemo(() => {
    const cargo = new Map(fila.map((i) => [i.vaga, i.convocado.cargo || ""]));
    return vagasDaFila(fila).map((codigo) => ({
      codigo,
      cargo: cargo.get(codigo) || "",
    }));
  }, [fila]);
  const bancas = useMemo(() => bancasDaFila(fila), [fila]);
  const irParaAgenda = () =>
    irParaTela({
      view: "classificacao",
      ...(editalId
        ? {
            edital: {
              id: editalId,
              titulo: dados?.edital?.edital || "",
            },
          }
        : {}),
    });
  const acoesDaTela: AcaoDoMenu[] = [
    {
      id: "agenda",
      rotulo: "Agenda na Classificação",
      icone: "fa-calendar-days",
      dados: { "data-acao": "ir-para-agenda" },
      aoEscolher: irParaAgenda,
    },
    {
      id: "preparar",
      rotulo: "Preparar a entrevista",
      icone: "fa-sliders",
      dados: { "data-acao": "ir-para-preparar" },
      aoEscolher: () => mudarSecao({ aba: "preparar" }),
    },
  ];

  /*
    A ordem do "próximo" é a da fila na tela no momento em que a ficha abriu.
    Fica guardada enquanto a ficha está aberta: com a fila filtrada (busca ou
    situação), salvar as notas tira o candidato do filtro, e a ordem não pode
    mudar por baixo (antes, caía na ordem do edital inteiro).
  */
  const [ordemDaFicha, setOrdemDaFicha] = useState<string[] | null>(null);
  if (!e.fichaAberta) {
    if (ordemDaFicha) setOrdemDaFicha(null);
  } else if (!ordemDaFicha?.includes(e.fichaAberta)) {
    const ids = naTela.map((i) => i.convocado.id);
    const nova = ids.includes(e.fichaAberta) ? ids : null;
    if (nova || ordemDaFicha) setOrdemDaFicha(nova);
  }

  /* Trocou a área com a tela aberta: recomeça na nova. */
  useEffect(() => {
    if (e.area && areaDoApp && e.area !== areaDoApp) {
      conducao.trocarArea(areaDoApp);
      void conducao.carregarEditais(areaDoApp, doPainel());
    }
  }, [conducao, e.area, areaDoApp, doPainel]);

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
    // A ordem do "próximo": a da fila quando a ficha abriu (sem ela, a do edital).
    const porId = new Map(dados.convocados.map((c) => [c.id, c]));
    const daFila = (ordemDaFicha || [])
      .map((id) => porId.get(id))
      .filter((c) => c !== undefined);
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
            aoSalvar={(p) => conducao.lancarNotas(convocado.id, p)}
            aoAbrir={(id: string) => conducao.abrirFicha(id)}
            aoFechar={() => conducao.abrirFicha(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="ui-tela entrevistas-tela entrevistas-conduzir ui-tela-da-selecao"
      data-tour="conduzir-tela"
    >
      <CabecalhoDaTela
        trilha={[nomeDaArea, "Seleção"].filter(Boolean).join(" / ")}
        titulo="Entrevistas"
        tour="conduzir-cabecalho"
        edital={seletor.campo}
        secoes={
          <Segmentado
            tour="conduzir-visoes"
            rotulo="Seções"
            className="entrevistas-visoes"
            opcoes={VISOES}
            valor={visao}
            aoMudar={(aba) => mudarSecao({ aba })}
          />
        }
        aoAtualizar={() => {
          void conducao.carregarEditais(e.area, doPainel());
          if (e.editalId) void conducao.recarregarEdital();
          if (visao === "preparar") void conducao.carregarRoteiros(e.area);
        }}
        atualizarDesativado={!e.area || e.carregandoEdital}
      />
      {seletor.avisos}

      {visao === "fila" &&
      dados &&
      !dados.configuracao &&
      !e.carregandoEdital ? (
        <Aviso tom="info">
          A entrevista deste edital ainda não foi preparada (roteiro e banca).{" "}
          <button
            type="button"
            className="btn secondary small"
            onClick={() => mudarSecao({ aba: "preparar" })}
          >
            Preparar
          </button>
        </Aviso>
      ) : null}
      {e.carregandoEdital && !dados ? (
        <CarregandoConteudo
          rotulo="Carregando o edital…"
          className="entrevistas-carregando"
          linhas={3}
        />
      ) : null}
      {visao === "fila" ? (
        !e.editalId && e.editais.lista.length ? (
          <EstadoVazio className="ui-card entrevistas-sem-edital">
            Escolha o edital para ver a fila.
          </EstadoVazio>
        ) : dados && !e.carregandoEdital ? (
          <FilaDoDia
            base={base}
            doRecorte={doRecorte}
            naTela={naTela}
            hoje={hoje}
            agora={agora}
            recorte={recorte}
            contagem={contagem}
            aoMudarRecorte={(r) => mudarValores({ periodo: r, situacao: "" })}
            filtros={filtros}
            aoMudarFiltros={(parte) => mudarValores(parte)}
            vagas={vagas}
            bancas={bancas}
            minhasBancas={minhasBancas}
            contador={contador}
            proxima={proxima}
            aoAbrir={(id) => conducao.abrirFicha(id)}
            aoRemarcar={irParaAgenda}
            aoCopiar={(codigo) =>
              void copiarTexto(codigo).then((ok) =>
                ok
                  ? avisar(`Código ${codigo} copiado.`, "success")
                  : avisar("Não foi possível copiar o código.", "error"),
              )
            }
            acoesDaTela={acoesDaTela}
          />
        ) : null
      ) : !e.editalId && e.editais.lista.length ? (
        <EstadoVazio className="ui-card entrevistas-sem-edital">
          Escolha o edital para preparar a entrevista.
        </EstadoVazio>
      ) : (
        <Suspense
          fallback={
            <CarregandoConteudo
              rotulo="Carregando…"
              className="entrevistas-carregando"
            />
          }
        >
          <PrepararEdital conducao={conducao} e={e} />
        </Suspense>
      )}
    </div>
  );
}

/**
 * Cria a tela (rota `conduzir-entrevistas`, src/app/telas.tsx): o conteúdo
 * React e o controlador — `render()` a cada abertura (a área atual, os
 * editais e o edital aberto), `abrirVisao` (links antigos: "conduzir",
 * "roteiros") e `abrirEdital` (o edital do endereço).
 */
export function criarConducaoDeEntrevistas({
  supabase = getSupabaseClient(),
  toast,
  comemoracoesLigadas = () => false,
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
  aoMudarResultados = () => {},
  doPainel = () => [],
  aoComemorar = comemorar,
  hojeDe = () => hojeEmBrasilia(),
  horaDe = () => horaEmBrasilia(),
  armazenamento = () => globalThis.localStorage,
}: {
  supabase?: ClienteDaConducao | null;
  toast?: (mensagem: string, tom?: string) => void;
  comemoracoesLigadas?: () => boolean;
  areaAtual?: () => string | null | undefined;
  aoMudarResultados?: () => void;
  doPainel?: () => unknown[];
  aoComemorar?: Comemorar;
  hojeDe?: () => string;
  horaDe?: () => string;
  armazenamento?: () => Pick<Storage, "getItem" | "setItem"> | undefined;
} = {}) {
  const conducao = criarEstadoDaConducao({
    supabase,
    toast,
    aoMudarResultados,
  });
  const visoes = criarVisao();

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
    nome: "a tela de conduzir entrevistas",
    conteudo: (
      <TelaNaUrl.Provider value="conduzir-entrevistas">
        <TelaDeConducao
          conducao={conducao}
          visoes={visoes}
          comemoracoesLigadas={comemoracoesLigadas}
          aoComemorar={aoComemorar}
          doPainel={doPainel}
          hojeDe={hojeDe}
          horaDe={horaDe}
          avisar={(mensagem, tom) => toast?.(mensagem, tom)}
        />
      </TelaNaUrl.Provider>
    ),
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
