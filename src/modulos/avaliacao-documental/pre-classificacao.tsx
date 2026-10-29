import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode, RefObject } from "react";
import { formatNumberBR } from "../../lib/formatters";
import type { RecorteDaPre } from "../../lib/avaliacao-documental/paginas-da-pre-classificacao.ts";
import { ordinal } from "../../lib/classificacao/numeros.ts";
import {
  contadoresDaPreClassificacao,
  declaradasCongeladas,
  DICA_DA_ART,
  DICA_DA_NOTA_DO_LOTE,
  DICA_DA_RECALCULADA,
  loteDaVaga,
  lotesAPublicar,
  nota,
  podeIncluirPorDecisao,
  regraComTamanhos,
  ROTULO_DA_ART,
  ROTULOS_DA_SITUACAO,
  SITUACOES_DO_EDITAL,
  tamanhoDefinido,
  tamanhoSugerido,
  textoDoAviso,
  textoDoLote,
} from "../../lib/avaliacao-documental/tela-da-pre-classificacao.ts";
import { rotuloDaVersaoNaLista } from "../../lib/nome-da-versao.ts";
import type { ConfiguracaoDaTriagem } from "../../lib/triagem/regra-da-triagem.ts";
import { ResumoDaRegraDaTriagem } from "../triagem/resumo-da-regra.tsx";
import {
  abrirRegrasDoEdital,
  usarRegraDaTriagem,
} from "../triagem/usar-regra-da-triagem.ts";
import { ESPERA_DO_PEDIDO_MIN } from "../../lib/robos-de-carga.ts";
import {
  Abas,
  Aviso,
  CaixaDeMarcarTodos,
  estadoDaMarcacao,
  GradeDeKpis,
  Kpi,
  MenuDeAcoes,
  Selo,
  TabelaInfinita,
  usarListaNoServidor,
} from "../../ui/index.ts";
import type {
  AbaDaLista,
  AcaoDoMenu,
  BuscarPagina,
  ColunaDaTabela,
  EstadoDaMarcacao,
} from "../../ui/index.ts";
import { lerTrava } from "../../lib/avaliacao-documental/trava-das-inscricoes.ts";
import { EliminadosDaTriagem } from "./eliminados-da-triagem.tsx";
import "./triagem-em-abas.css";
import {
  IncluirPorDecisao,
  RevogarDecisao,
  SeloDaDecisao,
} from "./decisao-do-lote.tsx";
import {
  chaveDaPessoa,
  pessoaEliminada,
} from "../../lib/avaliacao-documental/documentos-em-lote.ts";
import type { PessoaDoDocumento } from "../../lib/avaliacao-documental/documentos-em-lote.ts";
import { chaveDaLista } from "./estado-da-pre-classificacao.ts";
import { baixarComunicadoDoEliminado } from "./comunicado-do-eliminado.ts";
import { InscricoesDoEdital } from "./inscricoes-do-edital.tsx";
import { TravaDasInscricoes } from "./trava-das-inscricoes.tsx";
import type { EstadoDaAvaliacao, LojaDaAvaliacao } from "./estado.ts";
import type {
  DadosDaPreClassificacao,
  EstadoDaPreClassificacao,
  ListaRegistradaDaPre,
  RegistroDaPre,
  SituacaoDoInscrito,
  SnapshotDaPreClassificacao,
  TipoDaListaDaPre,
  VagaDaPre as VagaDoResumo,
  InscritoDaPre,
} from "./tipos-da-pre-classificacao.ts";

/*
  Aba Triagem (fase F2): a Lista Geral de Classificação Provisória
  por ART e o lote de convocação de cada vaga, como o job Python gravou
  (scripts/pre_classificacao/). A tela só lê; "Recalcular" (coordenação) pede
  o job; os tamanhos do lote por vaga viram versão nova da regra; as listas
  PROVISORIA e LOTE são registradas no banco e exportadas pelo gerador da
  Classificação. A coordenação inclui no lote por decisão (ex.: "Critério
  CORES") quem a regra deixa fora, e revoga (decisao-do-lote.tsx); o lote
  mostra "N pela regra + M por decisão". Explicações:
  docs/aya/regras-da-avaliacao-documental.md.

  Desempenho (114/2026: 7.726 inscritos, 29 vagas): a aba abre só com o
  resumo (obter_resumo_pre_classificacao); as vagas e as listas oficiais são
  partes lidas quando aparecem (pre.garantirParte); as listas de cada vaga vêm
  do banco 50 por vez (TabelaInfinita com rolagem contínua), só quando o
  cartão chega perto da tela; os eliminados, só ao abrir; a busca de
  eliminados é feita no banco; os comunicados conferem só os marcados.
*/

const SITUACAO_DA_EXECUCAO: Record<string, string> = {
  EM_ANDAMENTO: "rodando",
  CONCLUIDA: "concluída",
  PARCIAL: "parcial",
  FALHOU: "falhou",
};
const TOM_DA_SITUACAO: Record<SituacaoDoInscrito, string> = {
  NO_LOTE: "aprovado",
  ANALISADO: "revisar",
  RANQUEADO: "neutro",
  ELIMINADO: "reprovado",
};
/* Os avisos por situação gravada do edital (pode vir uma que não está aqui). */
type AvisosDaSituacao = Readonly<Record<string, string | undefined>>;

const quando = (valor: string | null | undefined) =>
  valor
    ? new Date(valor).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";

function cabecalhoDaVaga(v: VagaDoResumo) {
  const vagas =
    v.vagas_imediatas === null || v.vagas_imediatas === undefined
      ? ""
      : `${v.vagas_imediatas} ${v.vagas_imediatas === 1 ? "vaga" : "vagas"}${v.cadastro_reserva ? " + CR" : ""}`;
  return [`VAGA ${v.codigo}`, v.cargo, v.lotacao, vagas]
    .filter(Boolean)
    .join(" - ");
}

interface LinhaDoInscritoProps {
  c: InscritoDaPre;
  /** Sem ele (fora do lote), a linha não oferece "Revogar decisão". */
  podeCoordenar?: boolean;
  pre?: EstadoDaPreClassificacao;
}

function LinhaDoInscrito({ c, podeCoordenar, pre }: LinhaDoInscritoProps) {
  return (
    <tr data-candidato={c.codigo} data-situacao={c.situacao}>
      <td>{c.posicao ? ordinal(c.posicao) : "—"}</td>
      <td>{c.codigo}</td>
      <td>{c.nome}</td>
      <td>{c.modalidade}</td>
      <td>
        {c.origem_nota === "ART" ? (
          <strong title={DICA_DA_NOTA_DO_LOTE}>{nota(c.art)}</strong>
        ) : (
          nota(c.art)
        )}
      </td>
      <td>
        {c.origem_nota === "DECLARADA" ? (
          <strong title={DICA_DA_NOTA_DO_LOTE}>{nota(c.declarada)}</strong>
        ) : (
          nota(c.declarada)
        )}
        {c.declarada_congelada !== null &&
        c.declarada_congelada !== undefined ? (
          <span
            className="avd-congelada"
            title={`Congelada em ${quando(c.congelada_em)}`}
          >
            {" "}
            <i className="fa-solid fa-lock" aria-hidden="true" />
            <span className="sr-only">congelada</span>
          </span>
        ) : null}
        {c.divergente ? (
          <span
            className="avd-diverge"
            title="ART diferente da nota declarada recalculada, além da tolerância da regra"
          >
            {" "}
            <i
              className="fa-solid fa-triangle-exclamation"
              aria-hidden="true"
            />{" "}
            diverge
          </span>
        ) : null}
      </td>
      <td>
        <Selo
          tom={TOM_DA_SITUACAO[c.situacao]}
          titulo={c.motivo_entrada || undefined}
        >
          {ROTULOS_DA_SITUACAO[c.situacao]}
          {c.lote ? ` · lote ${c.lote}` : ""}
        </Selo>{" "}
        <SeloDaDecisao c={c} />
        {podeCoordenar ? (
          <RevogarDecisao
            c={c}
            aoRevogar={(motivo) => pre!.revogarDecisao([c], motivo)}
          />
        ) : null}
      </td>
    </tr>
  );
}

interface VagaDaPreProps {
  v: VagaDoResumo;
  configuracao: RegistroDaPre;
  podeCoordenar: boolean;
  /** O tamanho digitado e ainda não salvo ("" tira o definido). */
  tamanho: string | undefined;
  aoMudarTamanho: (codigo: string, valor: string) => void;
  pre: EstadoDaPreClassificacao;
  editalId: string;
  rotuloEdital: string;
  unidade: string;
  /** A leitura do resumo: muda a cada releitura e recomeça as listas. */
  leitura: string;
  /** A busca de eliminados (já sem acento e aparada) e quantos ela achou nesta vaga. */
  buscaEliminado?: string;
  achadosNaBusca?: number;
  /** As chaves (vaga|código) dos eliminados marcados para comunicado em lote. */
  marcados?: ReadonlySet<string>;
  aoMarcar?: (pessoa: PessoaDoDocumento, sim: boolean) => void;
  /** A caixa do cabeçalho: marca (ou desmarca) várias de uma vez. */
  aoMarcarVarias?: (pessoas: PessoaDoDocumento[], sim: boolean) => void;
}

/* As listas vêm do banco já recortadas: a tabela não filtra de novo. */
const semFiltro = <T,>(itens: readonly T[]) => itens;
const numeroOuZero = (v: unknown) =>
  Number.isFinite(Number(v)) ? Number(v) : 0;
const noLote = (c: InscritoDaPre | undefined) =>
  c?.situacao === "NO_LOTE" || c?.situacao === "ANALISADO";

const COLUNAS_DOS_CLASSIFICADOS: ColunaDaTabela[] = [
  { rotulo: "Classificação" },
  { rotulo: "Código" },
  { rotulo: "Nome" },
  { rotulo: "Modalidade" },
  { rotulo: ROTULO_DA_ART, dica: DICA_DA_ART },
  { rotulo: "Recalculada", dica: DICA_DA_RECALCULADA },
  { rotulo: "Situação" },
];
const COLUNAS_DOS_ELIMINADOS: ColunaDaTabela[] = [
  { rotulo: "Código" },
  { rotulo: "Nome" },
  { rotulo: "Motivo" },
  { rotulo: "Documento" },
];

/*
  O cartão já está perto da tela? As listas da vaga só pedem a primeira página
  quando ele chega a ~1 tela de distância (29 vagas no 114/2026: abrir a aba
  não pede as 29). Sem IntersectionObserver (testes, navegador antigo): já.
*/
function usarPertoDaTela(ref: RefObject<HTMLElement | null>): boolean {
  const [perto, setPerto] = useState(
    () => typeof IntersectionObserver === "undefined",
  );
  useEffect(() => {
    const alvo = ref.current;
    if (perto || !alvo || typeof IntersectionObserver === "undefined")
      return undefined;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) setPerto(true);
      },
      { rootMargin: "800px 0px" },
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [ref, perto]);
  return perto;
}

/* A página de uma lista da vaga, no formato da tabela. */
function buscarDaVaga(
  pre: EstadoDaPreClassificacao,
  recorte: RecorteDaPre,
): BuscarPagina<InscritoDaPre> {
  return async (apos, limite) => {
    const r = await pre.listar(recorte, apos, limite);
    return { linhas: r.linhas, proximo: r.proximo, total: r.total };
  };
}

function VagaDaPre({
  v,
  configuracao,
  podeCoordenar,
  tamanho,
  aoMudarTamanho,
  pre,
  editalId,
  rotuloEdital,
  unidade,
  leitura,
  buscaEliminado = "",
  achadosNaBusca = 0,
  marcados,
  aoMarcar,
  aoMarcarVarias,
}: VagaDaPreProps) {
  const [incluindo, setIncluindo] = useState(false);
  const [foraDoLote, setForaDoLote] = useState<InscritoDaPre[]>([]);
  const [lendoForaDoLote, setLendoForaDoLote] = useState(false);
  const [erroDoForaDoLote, setErroDoForaDoLote] = useState("");
  const [emitindo, setEmitindo] = useState("");
  const [erroDoEspelho, setErroDoEspelho] = useState("");
  const [eliminadosAbertos, setEliminadosAbertos] = useState(false);
  // Todos os eliminados do recorte (vaga + busca), lidos ao usar a caixa do cabeçalho.
  const [todosDoRecorte, setTodosDoRecorte] = useState<{
    recorte: string;
    pessoas: PessoaDoDocumento[];
  } | null>(null);
  const [marcandoTodos, setMarcandoTodos] = useState(false);
  const cartao = useRef<HTMLElement>(null);
  const perto = usarPertoDaTela(cartao);

  const lote = loteDaVaga(v);
  const foraDaVaga = numeroOuZero(v.fora_do_lote);
  const eliminadosDaVaga = numeroOuZero(v.eliminados);
  const processada = v.inscritos !== null && v.inscritos !== undefined;
  // Banco antigo (sem fora_do_lote no resumo): a lista pergunta ao banco.
  const temClassificados =
    v.fora_do_lote === undefined ||
    lote.pelaRegra + lote.porDecisao + foraDaVaga > 0;

  const classificados = usarListaNoServidor(
    useMemo(
      () => buscarDaVaga(pre, { vaga: v.codigo, grupo: "CLASSIFICADOS" }),
      [pre, v.codigo],
    ),
    `${leitura}:${v.codigo}:classificados`,
    { ativo: perto && !buscaEliminado && processada && temClassificados },
  );
  const mostrarEliminados = eliminadosAbertos || Boolean(buscaEliminado);
  const eliminados = usarListaNoServidor(
    useMemo(
      () =>
        buscarDaVaga(pre, {
          vaga: v.codigo,
          grupo: "ELIMINADOS",
          busca: buscaEliminado,
        }),
      [pre, v.codigo, buscaEliminado],
    ),
    `${leitura}:${v.codigo}:eliminados:${buscaEliminado}`,
    { ativo: mostrarEliminados },
  );

  /*
    A caixa "marcar todos" do cabeçalho dos eliminados vale para o recorte
    inteiro (vaga + busca), não só as 50 já vindas do banco. Sabe-se o
    recorte inteiro quando a caixa já o leu ou quando todas as páginas vieram.
  */
  const recorteDosEliminados = `${leitura}:${v.codigo}:${buscaEliminado}`;
  const chavesDoRecorte =
    todosDoRecorte?.recorte === recorteDosEliminados
      ? todosDoRecorte.pessoas.map((x) => x.chave)
      : eliminados.carregado && !eliminados.temMais
        ? eliminados.itens.map((c) => chaveDaPessoa(c.vaga, c.codigo))
        : null;
  let estadoDosEliminados: EstadoDaMarcacao;
  if (chavesDoRecorte)
    estadoDosEliminados = estadoDaMarcacao(
      chavesDoRecorte.filter((chave) => marcados?.has(chave)).length,
      chavesDoRecorte.length,
    );
  else
    estadoDosEliminados = eliminados.itens.some((c) =>
      marcados?.has(chaveDaPessoa(c.vaga, c.codigo)),
    )
      ? "parte"
      : "nenhuma";

  async function marcarTodosDaVaga(sim: boolean) {
    if (!aoMarcarVarias) return;
    if (!sim) {
      const pessoas =
        todosDoRecorte?.recorte === recorteDosEliminados
          ? todosDoRecorte.pessoas
          : eliminados.itens.map(pessoaEliminada);
      aoMarcarVarias(pessoas, false);
      return;
    }
    setErroDoEspelho("");
    setMarcandoTodos(true);
    try {
      const linhas = await pre.listarTudo({
        vaga: v.codigo,
        grupo: "ELIMINADOS",
        busca: buscaEliminado,
      });
      const pessoas = linhas.map(pessoaEliminada);
      setTodosDoRecorte({ recorte: recorteDosEliminados, pessoas });
      aoMarcarVarias(pessoas, true);
    } catch (erro) {
      setErroDoEspelho(
        erro instanceof Error
          ? `Não foi possível marcar todos: ${erro.message}`
          : "Não foi possível marcar todos.",
      );
    } finally {
      setMarcandoTodos(false);
    }
  }
  const colunaDeMarcar: ColunaDaTabela = {
    rotulo: "Marcar",
    chave: "marcar",
    largura: "2.75rem",
    cabecalho: (
      <CaixaDeMarcarTodos
        rotulo={
          buscaEliminado
            ? `Marcar todos os eliminados da busca na vaga ${v.codigo}`
            : `Marcar todos os eliminados da vaga ${v.codigo}`
        }
        estado={estadoDosEliminados}
        desabilitada={marcandoTodos || !aoMarcarVarias || !eliminados.carregado}
        acao="marcar-todos-eliminados"
        aoMudar={(sim) => void marcarTodosDaVaga(sim)}
      />
    ),
  };

  // A linha de corte vai antes do primeiro de fora do lote que vem depois do lote.
  const depoisDoCorte = useMemo(() => {
    const ids = new Set<string>();
    classificados.itens.forEach((c, i) => {
      if (
        c.situacao === "RANQUEADO" &&
        i > 0 &&
        noLote(classificados.itens[i - 1])
      )
        ids.add(String(c.id));
    });
    return ids;
  }, [classificados.itens]);

  async function emitirEspelho(c: InscritoDaPre) {
    if (emitindo || !editalId || c.situacao !== "ELIMINADO") return;
    setErroDoEspelho("");
    setEmitindo(c.codigo);
    try {
      // A situação de agora só desta pessoa (não a triagem inteira).
      await baixarComunicadoDoEliminado(pre, c, {
        cargo: v.cargo,
        edital: rotuloEdital,
        unidade,
      });
    } catch (erro) {
      setErroDoEspelho(
        erro instanceof Error ? erro.message : "Não foi possível gerar o PDF.",
      );
    } finally {
      setEmitindo("");
    }
  }

  /* "Incluir por decisão": quem pode entrar (fora do lote e eliminados da vaga), lido ao abrir. */
  async function abrirInclusao() {
    setErroDoForaDoLote("");
    setLendoForaDoLote(true);
    try {
      const linhas = await pre.listarTudo({
        vaga: v.codigo,
        grupo: "PODE_INCLUIR",
      });
      setForaDoLote(linhas.map((c) => ({ ...c, nota: c.nota ?? c.art })));
      setIncluindo(true);
    } catch (erro) {
      setErroDoForaDoLote(
        erro instanceof Error ? erro.message : "Não foi possível ler a lista.",
      );
    } finally {
      setLendoForaDoLote(false);
    }
  }

  const linhaDoClassificado = (c: InscritoDaPre) => (
    <Fragment key={c.id}>
      {depoisDoCorte.has(String(c.id)) ? (
        <tr className="avd-linha-de-corte">
          <td colSpan={COLUNAS_DOS_CLASSIFICADOS.length}>Linha de corte</td>
        </tr>
      ) : null}
      <LinhaDoInscrito
        c={c}
        podeCoordenar={podeCoordenar && noLote(c)}
        pre={pre}
      />
    </Fragment>
  );
  const linhaDoEliminado = (c: InscritoDaPre) => (
    <tr key={c.id} data-candidato={c.codigo} data-situacao="ELIMINADO">
      {aoMarcar ? (
        <td>
          <input
            type="checkbox"
            aria-label={`Marcar ${c.codigo} para o lote`}
            data-acao="marcar-comunicado"
            checked={marcados?.has(chaveDaPessoa(c.vaga, c.codigo)) ?? false}
            onChange={(ev) => aoMarcar(pessoaEliminada(c), ev.target.checked)}
          />
        </td>
      ) : null}
      <td>{c.codigo}</td>
      <td>{c.nome}</td>
      <td>{c.motivo}</td>
      <td>
        <button
          type="button"
          className="btn secondary small"
          data-acao="espelho-eliminado-pre"
          disabled={Boolean(emitindo) || !c.motivo}
          onClick={() => void emitirEspelho(c)}
        >
          {emitindo === c.codigo ? "Gerando PDF…" : "Baixar comunicado PDF"}
        </button>
      </td>
    </tr>
  );

  const definido = tamanhoDefinido(configuracao, v.codigo);
  const sugerido = tamanhoSugerido(configuracao, v);
  const quantosEliminados = buscaEliminado ? achadosNaBusca : eliminadosDaVaga;
  return (
    <article ref={cartao} className="ui-card avd-vaga" data-vaga={v.codigo}>
      <h3 className="ui-titulo">{cabecalhoDaVaga(v)}</h3>
      <div className="avd-inline ui-texto-secundario">
        {processada ? (
          <span data-lote-da-vaga>
            {textoDoLote(lote.pelaRegra, lote.porDecisao, v.tamanho)}
            {v.descricao ? ` (${v.descricao})` : ""}
            {v.art_corte !== null && v.art_corte !== undefined
              ? ` · linha de corte ${nota(v.art_corte)}`
              : ""}
          </span>
        ) : (
          <span>
            {v.candidatos_empregare ?? 0} inscritos na Empregare, ainda sem
            triagem
          </span>
        )}
        {podeCoordenar ? (
          <label className="avd-caixa">
            Tamanho do lote
            <input
              type="number"
              min="1"
              step="1"
              value={tamanho ?? definido ?? ""}
              placeholder={sugerido.tamanho ? String(sugerido.tamanho) : ""}
              aria-label={`Tamanho do lote da vaga ${v.codigo}`}
              onChange={(ev) => aoMudarTamanho(v.codigo, ev.target.value)}
            />
            <span title={sugerido.descricao || undefined}>
              {sugerido.tamanho
                ? `sugerido ${sugerido.descricao}`
                : sugerido.descricao || "sem quadro de vagas"}
            </span>
          </label>
        ) : null}
        {podeCoordenar && processada ? (
          <button
            type="button"
            className="btn secondary small"
            data-acao="incluir-por-decisao"
            disabled={
              lendoForaDoLote ||
              (v.fora_do_lote !== undefined && !(foraDaVaga + eliminadosDaVaga))
            }
            onClick={() => void abrirInclusao()}
          >
            {lendoForaDoLote
              ? "Lendo a lista…"
              : "Incluir por decisão da coordenação"}
          </button>
        ) : null}
      </div>
      {erroDoForaDoLote ? (
        <Aviso tom="danger" papel="alert">
          {erroDoForaDoLote}
        </Aviso>
      ) : null}
      {incluindo ? (
        <IncluirPorDecisao
          candidatos={foraDoLote}
          aoIncluir={(escolhidos, motivo) =>
            pre.incluirPorDecisao(escolhidos, motivo)
          }
          aoFechar={() => setIncluindo(false)}
        />
      ) : null}
      {(v.avisos || []).length ? (
        <ul className="avd-lista-simples" aria-label="Avisos da vaga">
          {v.avisos!.map((a) => (
            <li key={a}>{textoDoAviso(a)}</li>
          ))}
        </ul>
      ) : null}
      {!buscaEliminado && processada && temClassificados && !perto ? (
        // Longe da tela: nem a tabela é desenhada (29 vagas no 114/2026).
        <p className="ui-texto-secundario" data-lista-adiada>
          A lista da vaga aparece ao rolar até aqui.
        </p>
      ) : !buscaEliminado && processada && temClassificados ? (
        classificados.erro ? (
          <Aviso tom="danger" papel="alert">
            Não foi possível ler a lista da vaga: {classificados.erro}{" "}
            <button
              type="button"
              className="btn secondary small"
              onClick={classificados.recarregar}
            >
              Tentar novamente
            </button>
          </Aviso>
        ) : (
          <TabelaInfinita
            idDoTitulo={`avdPreClassificados${v.codigo}`}
            titulo="Classificação"
            className="avd-pre-lista"
            classeDaTabela="avd-tabela"
            colunas={COLUNAS_DOS_CLASSIFICADOS}
            carregado={classificados.carregado}
            itens={classificados.itens}
            filtrarPelaBusca={semFiltro}
            linha={linhaDoClassificado}
            total={classificados.total}
            informacao={(quantos) =>
              quantos === null
                ? ""
                : `${formatNumberBR(quantos)} ${quantos === 1 ? "classificado" : "classificados"}`
            }
            vazio="Nenhum classificado nesta vaga."
            servidor={classificados}
          />
        )
      ) : null}
      {quantosEliminados ? (
        <details
          key={buscaEliminado || "todos"}
          className="avd-eliminados"
          open={buscaEliminado ? true : undefined}
          onToggle={(ev) => setEliminadosAbertos(ev.currentTarget.open)}
        >
          <summary>Eliminados ({formatNumberBR(quantosEliminados)})</summary>
          {mostrarEliminados ? (
            eliminados.erro ? (
              <Aviso tom="danger" papel="alert">
                Não foi possível ler os eliminados: {eliminados.erro}{" "}
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={eliminados.recarregar}
                >
                  Tentar novamente
                </button>
              </Aviso>
            ) : (
              <TabelaInfinita
                idDoTitulo={`avdPreEliminados${v.codigo}`}
                titulo="Eliminados"
                className="avd-pre-lista"
                classeDaTabela="avd-tabela"
                colunas={
                  aoMarcar
                    ? [colunaDeMarcar, ...COLUNAS_DOS_ELIMINADOS]
                    : COLUNAS_DOS_ELIMINADOS
                }
                carregado={eliminados.carregado}
                itens={eliminados.itens}
                filtrarPelaBusca={semFiltro}
                linha={linhaDoEliminado}
                total={eliminados.total}
                informacao={(quantos) =>
                  quantos === null
                    ? ""
                    : `${formatNumberBR(quantos)} ${quantos === 1 ? "eliminado" : "eliminados"}`
                }
                vazio="Nenhum eliminado."
                servidor={eliminados}
              />
            )
          ) : null}
          {erroDoEspelho ? (
            <Aviso tom="danger" papel="alert">
              {erroDoEspelho}
            </Aviso>
          ) : null}
        </details>
      ) : null}
    </article>
  );
}

interface ExportarListaProps {
  registrado: ListaRegistradaDaPre | undefined;
  pre: EstadoDaPreClassificacao;
  comEliminados?: boolean;
}

function ExportarLista({ registrado, pre, comEliminados }: ExportarListaProps) {
  if (!registrado) return null;
  return (
    <span className="ui-acoes">
      <button
        type="button"
        className="btn secondary small"
        onClick={() => void pre.copiarParaSei(registrado)}
      >
        Copiar para o SEI
      </button>
      <button
        type="button"
        className="btn secondary small"
        onClick={() => void pre.exportar(registrado, "docx")}
      >
        Baixar DOCX
      </button>
      {comEliminados ? (
        <>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => void pre.copiarParaSei(registrado, "eliminados")}
          >
            Eliminados: copiar para o SEI
          </button>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => void pre.exportar(registrado, "docx", "eliminados")}
          >
            Eliminados: DOCX
          </button>
        </>
      ) : null}
    </span>
  );
}

interface ListasOficiaisProps {
  d: DadosDaPreClassificacao;
  p: SnapshotDaPreClassificacao;
  pre: EstadoDaPreClassificacao;
}

function ListasOficiais({ d, p, pre }: ListasOficiaisProps) {
  const lotes = lotesAPublicar(d);
  const semRegraDeClassificacao = !d.regra_classificacao;
  const registrar = (tipo: TipoDaListaDaPre, lote: number | null = null) =>
    void pre.registrarLista(tipo, lote);
  return (
    <section className="ui-card avd-listas" aria-labelledby="avdListasPre">
      <h2 className="ui-titulo" id="avdListasPre">
        Listas oficiais
      </h2>
      {semRegraDeClassificacao && d.pode_registrar_lista ? (
        <Aviso tom="warning">
          Cadastre a regra de classificação do edital para registrar as listas.
        </Aviso>
      ) : null}
      <div className="avd-inline">
        <strong>Lista Geral de Classificação Provisória (ART)</strong>
        {d.pode_registrar_lista ? (
          <button
            type="button"
            className="btn primary small"
            disabled={Boolean(p.registrando) || semRegraDeClassificacao}
            onClick={() => registrar("PROVISORIA")}
          >
            {p.registrando === "PROVISORIA" ? "Registrando…" : "Registrar"}
          </button>
        ) : null}
        <ExportarLista
          registrado={p.registradas.PROVISORIA}
          pre={pre}
          comEliminados
        />
      </div>
      <div className="avd-inline">
        <strong>Lote de convocação</strong>
        {d.pode_registrar_lista
          ? lotes.map(({ lote, quantidade }) => (
              <button
                key={lote}
                type="button"
                className="btn primary small"
                data-lote={lote}
                disabled={Boolean(p.registrando) || semRegraDeClassificacao}
                onClick={() => registrar("LOTE", lote)}
              >
                {p.registrando === chaveDaLista("LOTE", lote)
                  ? "Registrando…"
                  : `Registrar ${lote === 1 ? "o lote inicial" : `a reposição ${lote}`} (${quantidade})`}
              </button>
            ))
          : null}
        {Object.entries(p.registradas)
          .filter(([chave]) => chave.startsWith("LOTE"))
          .map(([chave, registrado]) => (
            <span key={chave} className="avd-inline">
              <span className="ui-texto-secundario">
                Lote {registrado.retrato?.lote ?? "completo"}:
              </span>
              <ExportarLista registrado={registrado} pre={pre} />
            </span>
          ))}
      </div>
      {(d.listas || []).length ? (
        <div className="ui-tabela-rolagem">
          <table className="avd-tabela">
            <caption>Registradas</caption>
            <thead>
              <tr>
                <th scope="col">Lista</th>
                <th scope="col">Gerada em</th>
                <th scope="col">Por</th>
                <th scope="col">Publicada</th>
              </tr>
            </thead>
            <tbody>
              {d.listas.map(({ meta, lote }) => (
                <tr key={meta?.id} data-lista={meta?.id}>
                  <td>
                    {meta?.tipo === "LOTE"
                      ? `Lote de convocação${lote ? ` ${lote}` : ""}`
                      : "Provisória (ART)"}
                  </td>
                  <td>{quando(meta?.gerada_em)}</td>
                  <td>{meta?.por || ""}</td>
                  <td>
                    {meta?.publicada ? (
                      quando(meta.publicada_em) || "Sim"
                    ) : d.pode_publicar_lista ? (
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => void pre.publicarLista(meta!.id)}
                      >
                        Marcar como publicada
                      </button>
                    ) : (
                      "Não"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export interface PreClassificacaoProps {
  e: EstadoDaAvaliacao;
  estado: LojaDaAvaliacao;
  pre: EstadoDaPreClassificacao;
}

/* As abas da tela; cada uma lê a sua parte só ao abrir. */
type AbaDaTriagem = "resumo" | "vagas" | "eliminados" | "listas";
const PARTE_DA_ABA: Partial<Record<AbaDaTriagem, "vagas" | "listas">> = {
  vagas: "vagas",
  eliminados: "vagas",
  listas: "listas",
};
/* A ação do menu "Ações" que espera confirmação. */
type AcaoAConfirmar = "recalcular" | "descongelar" | null;

/* Uma vaga na aba Por vaga: os números à vista; aberta, a vaga carrega as listas. */
function VagaRecolhida({
  v,
  children,
}: {
  v: VagaDoResumo;
  children: (aberta: boolean) => ReactNode;
}) {
  const [aberta, setAberta] = useState(false);
  const lote = loteDaVaga(v);
  const processada = v.inscritos !== null && v.inscritos !== undefined;
  return (
    <details
      className="ui-card avd-vaga-recolhida"
      data-vaga-recolhida={v.codigo}
      onToggle={(ev) => setAberta(ev.currentTarget.open)}
    >
      <summary>
        <span className="avd-vaga-recolhida__titulo">{cabecalhoDaVaga(v)}</span>
        <span className="avd-vaga-recolhida__numeros ui-texto-secundario">
          {processada
            ? [
                `${formatNumberBR(numeroOuZero(v.inscritos))} inscritos`,
                `${formatNumberBR(numeroOuZero(v.eliminados))} eliminados`,
                textoDoLote(lote.pelaRegra, lote.porDecisao, v.tamanho),
              ].join(" · ")
            : `${formatNumberBR(numeroOuZero(v.candidatos_empregare))} inscritos na Empregare, ainda sem triagem`}
        </span>
      </summary>
      {aberta ? children(aberta) : null}
    </details>
  );
}

export function PreClassificacao({ e, estado, pre }: PreClassificacaoProps) {
  // A regra própria da Triagem (20261029160000): resumo, conferência e lote por vaga.
  const triagem = usarRegraDaTriagem(pre.rpc, e.editalId);
  const regraDaTriagem = triagem.resposta;
  const aoSalvarRegraDaTriagem = triagem.salvar;
  const p = useSyncExternalStore(pre.assinar, pre.obter);
  const [aba, setAba] = useState<AbaDaTriagem>("resumo");
  const [tamanhos, setTamanhos] = useState<Record<string, string>>({});
  // Os eliminados marcados para comunicado em lote (chave vaga|código → pessoa).
  const [marcadas, setMarcadas] = useState<
    ReadonlyMap<string, PessoaDoDocumento>
  >(() => new Map());
  const marcados = useMemo(() => new Set(marcadas.keys()), [marcadas]);
  const aoMarcarVarias = useCallback(
    (pessoas: readonly PessoaDoDocumento[], sim: boolean) =>
      setMarcadas((atual) => {
        const nova = new Map(atual);
        for (const pessoa of pessoas) {
          if (sim) nova.set(pessoa.chave, pessoa);
          else nova.delete(pessoa.chave);
        }
        return nova;
      }),
    [],
  );
  const aoMarcar = useCallback(
    (pessoa: PessoaDoDocumento, sim: boolean) => aoMarcarVarias([pessoa], sim),
    [aoMarcarVarias],
  );
  const [motivo, setMotivo] = useState("");
  const [erroAoSalvar, setErroAoSalvar] = useState("");
  const [confirmando, setConfirmando] = useState<AcaoAConfirmar>(null);
  const [motivoDescongelar, setMotivoDescongelar] = useState("");
  const [descongelando, setDescongelando] = useState(false);
  const [pedidoDaTrava, setPedidoDaTrava] = useState(0);
  const versaoDaRegra = e.dados?.regra?.versao ?? 0;
  useEffect(() => {
    // A tela abre só com o resumo; cada aba pede a sua parte ao abrir.
    void pre.garantirCarregado(e.editalId, String(versaoDaRegra));
  }, [pre, e.editalId, versaoDaRegra]);
  const resumoLido = p.editalId === e.editalId && Boolean(p.dados);
  useEffect(() => {
    const parte = PARTE_DA_ABA[aba];
    if (resumoLido && parte) void pre.garantirParte(parte);
  }, [pre, aba, resumoLido, e.editalId]);

  if (p.erro)
    return (
      <Aviso tom="danger" papel="alert">
        Não foi possível ler a triagem: {p.erro}{" "}
        <button
          type="button"
          className="btn secondary small"
          onClick={() => void pre.carregar()}
        >
          Tentar novamente
        </button>
      </Aviso>
    );
  const d = p.editalId === e.editalId ? p.dados : null;
  if (!d)
    return (
      <div className="ui-card" aria-busy="true">
        <div className="ui-esqueleto-linha" />
        <div className="ui-esqueleto-linha" />
      </div>
    );

  const cont = contadoresDaPreClassificacao(d);
  const vagas = d.vagas ?? [];
  const leitura = String(d.gerado_em ?? "");
  const rotuloEdital = String(d.edital?.edital || d.edital?.rotulo || "");
  const unidade = String(d.edital?.unidade || "");
  const ultima = d.ultima_execucao;
  const situacaoDoEdital = ultima?.edital?.situacao;
  const regraDaTela = regraDaTriagem?.regra ?? null;
  const conferida = regraDaTela?.situacao === "CONFERIDA";
  const pedidoRecente =
    p.pedidoEm instanceof Date &&
    (Date.now() - p.pedidoEm.getTime()) / 60000 < ESPERA_DO_PEDIDO_MIN;
  const configuracao: ConfiguracaoDaTriagem = regraDaTela?.configuracao || {
    formato: 1,
  };
  const mudou = Object.keys(tamanhos).length > 0;
  const congeladas = declaradasCongeladas(d);
  const trava = p.congelamento ? lerTrava(p.congelamento) : null;
  const vagasProntas = Boolean(p.partes?.vagas) || vagas.length > 0;

  async function descongelar() {
    setDescongelando(true);
    const ok = await pre.descongelar(motivoDescongelar.trim());
    setDescongelando(false);
    if (ok) {
      setConfirmando(null);
      setMotivoDescongelar("");
    }
  }

  async function salvarTamanhos() {
    setErroAoSalvar("");
    const r = await aoSalvarRegraDaTriagem(
      regraComTamanhos(
        configuracao,
        tamanhos,
      ) as unknown as ConfiguracaoDaTriagem,
      motivo.trim(),
    );
    if (r.ok) {
      setTamanhos({});
      setMotivo("");
    } else setErroAoSalvar(r.erro);
  }

  // O menu "Ações": cada ação pede confirmação (o banco confere a permissão de novo).
  const acoes: AcaoDoMenu[] = [
    ...(d.pode_coordenar
      ? [
          {
            id: "recalcular",
            rotulo: d.em_andamento
              ? "Recalcular (rodando…)"
              : pedidoRecente
                ? "Recalcular (pedido enviado)"
                : "Recalcular",
            icone: "fa-rotate",
            desabilitado: !conferida || d.em_andamento || pedidoRecente,
            dados: { "data-acao": "recalcular" },
            aoEscolher: () => {
              setAba("resumo");
              setConfirmando("recalcular");
            },
          },
        ]
      : []),
    ...(d.pode_coordenar && congeladas.quantidade
      ? [
          {
            id: "descongelar",
            rotulo: "Descongelar notas declaradas",
            icone: "fa-lock-open",
            desabilitado: !conferida || d.em_andamento,
            dados: { "data-acao": "abrir-descongelar" },
            aoEscolher: () => {
              setAba("resumo");
              setConfirmando("descongelar");
            },
          },
        ]
      : []),
    ...(trava?.podeAlterar
      ? [
          {
            id: "trava",
            rotulo: trava.congelado
              ? "Liberar inscrições"
              : "Congelar inscrições",
            icone: trava.congelado ? "fa-lock-open" : "fa-lock",
            dados: {
              "data-acao": trava.congelado ? "abrir-liberar" : "abrir-congelar",
            },
            aoEscolher: () => {
              setAba("resumo");
              setPedidoDaTrava((n) => n + 1);
            },
          },
        ]
      : []),
  ];

  const abas: AbaDaLista[] = [
    { id: "resumo", rotulo: "Resumo" },
    {
      id: "vagas",
      rotulo: "Por vaga",
      contagem: vagas.length || undefined,
    },
    {
      id: "eliminados",
      rotulo: "Eliminados",
      contagem: cont.eliminados || undefined,
    },
    {
      id: "listas",
      rotulo: "Listas oficiais",
    },
  ];

  return (
    <div className="avd-pre" data-aba-aberta={aba}>
      <div className="avd-pre-topo">
        <Abas
          rotulo="Partes da Triagem"
          abas={abas}
          ativa={aba}
          aoEscolher={(id) => setAba(id as AbaDaTriagem)}
          tour="triagem-abas"
        />
        {acoes.length ? (
          <MenuDeAcoes rotulo="Ações" acoes={acoes} tour="triagem-acoes" />
        ) : null}
      </div>

      {p.aviso ? (
        <Aviso
          tom={p.aviso.tom === "info" ? undefined : p.aviso.tom}
          papel={p.aviso.tom === "danger" ? "alert" : "status"}
        >
          {p.aviso.texto}
        </Aviso>
      ) : null}

      {aba === "resumo" ? (
        <div className="avd-pre-resumo" data-aba-da-triagem="resumo">
          {confirmando === "recalcular" ? (
            <section
              className="ui-card avd-confirmar"
              role="alertdialog"
              aria-label="Confirmar o recálculo"
            >
              <p>
                Recalcular a triagem de <strong>{rotuloEdital}</strong>? O job
                relê os inscritos da Empregare, aplica a regra da Triagem
                {regraDaTela ? ` (versão ${regraDaTela.versao})` : ""} e
                atualiza a lista e o lote; quem já foi analisado não sai.
              </p>
              <div className="ui-acoes">
                <button
                  type="button"
                  className="btn primary small"
                  data-acao="confirmar-recalcular"
                  disabled={!conferida || d.em_andamento || pedidoRecente}
                  onClick={() => {
                    setConfirmando(null);
                    void pre.recalcular();
                  }}
                >
                  Recalcular agora
                </button>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => setConfirmando(null)}
                >
                  Cancelar
                </button>
              </div>
            </section>
          ) : null}
          {confirmando === "descongelar" && d.pode_coordenar ? (
            <section
              className="ui-card avd-inline"
              role="alertdialog"
              aria-label="Descongelar as notas declaradas"
            >
              <label className="ui-campo ui-campo-largo">
                <span>Motivo para descongelar</span>
                <input
                  type="text"
                  maxLength={250}
                  value={motivoDescongelar}
                  onChange={(ev) => setMotivoDescongelar(ev.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn primary small"
                data-acao="descongelar"
                disabled={
                  descongelando ||
                  !conferida ||
                  d.em_andamento ||
                  motivoDescongelar.trim().length < 10
                }
                onClick={() => void descongelar()}
              >
                {descongelando ? "Descongelando…" : "Descongelar e recalcular"}
              </button>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => {
                  setConfirmando(null);
                  setMotivoDescongelar("");
                }}
              >
                Cancelar
              </button>
            </section>
          ) : null}

          <GradeDeKpis rotulo="Triagem">
            <Kpi
              tom="info"
              icone="fa-users"
              rotulo="Inscritos"
              valor={cont.inscritos}
            />
            <Kpi
              tom="perigo"
              icone="fa-user-xmark"
              rotulo="Eliminados"
              valor={cont.eliminados}
              aoClicar={() => setAba("eliminados")}
            />
            <Kpi
              tom="neutro"
              icone="fa-list-ol"
              rotulo="Ranqueados"
              valor={cont.ranqueados}
            />
            <Kpi
              tom="sucesso"
              icone="fa-user-check"
              rotulo="Lote (aptos para análise)"
              valor={
                cont.noLotePorDecisao
                  ? textoDoLote(
                      cont.noLotePelaRegra,
                      cont.noLotePorDecisao,
                      cont.tamanho,
                    ).replace(/^Lote: /, "")
                  : cont.tamanho === null
                    ? cont.noLote
                    : `${cont.noLote} de ${cont.tamanho}`
              }
            />
          </GradeDeKpis>

          <section
            className="ui-card avd-faixa"
            aria-label="Situação da triagem"
            data-tour="triagem-situacao"
          >
            <span data-execucao={ultima?.situacao || "nenhuma"}>
              <strong>Último cálculo:</strong>{" "}
              {ultima
                ? `${quando(ultima.fim || ultima.inicio)} · ${SITUACAO_DA_EXECUCAO[ultima.situacao] || ultima.situacao}`
                : "ainda sem triagem"}
            </span>
            <span>
              <strong>Regra:</strong>{" "}
              {regraDaTela
                ? `${rotuloDaVersaoNaLista(regraDaTela.versoes, regraDaTela.versao)} · ${conferida ? "conferida" : "a conferir"}`
                : "sem regra da Triagem"}
            </span>
            {trava ? (
              <span data-trava={trava.congelado ? "congelada" : "liberada"}>
                <strong>Inscrições:</strong>{" "}
                {trava.congelado ? "congeladas" : "abertas para o robô"}
              </span>
            ) : null}
            <span data-congeladas={congeladas.quantidade ? "" : undefined}>
              <strong>Notas declaradas:</strong>{" "}
              {congeladas.quantidade
                ? `congeladas em ${quando(congeladas.em)}`
                : "não congeladas"}
            </span>
            {cont.divergencias ? (
              <button
                type="button"
                className="btn ghost small"
                data-acao="ver-divergencias"
                title="ART diferente da nota declarada recalculada, além da tolerância da regra"
                onClick={() => setAba("vagas")}
              >
                {formatNumberBR(cont.divergencias)} com ART × recalculada
                divergente · ver os casos
              </button>
            ) : null}
          </section>

          {d.pode_coordenar && !conferida ? (
            <Aviso tom="warning">
              {regraDaTela
                ? "Confira a regra da Triagem (Editais › Regras da Triagem) para recalcular."
                : "Crie a regra da Triagem (Editais › Regras da Triagem) para recalcular."}
            </Aviso>
          ) : null}
          {situacaoDoEdital &&
          (SITUACOES_DO_EDITAL as AvisosDaSituacao)[situacaoDoEdital] ? (
            <Aviso tom="warning">
              {(SITUACOES_DO_EDITAL as AvisosDaSituacao)[situacaoDoEdital]}
              {ultima?.edital?.mensagem ? ` ${ultima.edital.mensagem}` : ""}
            </Aviso>
          ) : null}

          <ResumoDaRegraDaTriagem
            resposta={regraDaTriagem}
            erro={triagem.erro}
            aoEditar={() => abrirRegrasDoEdital(e.editalId)}
          />
          <TravaDasInscricoes
            editalId={e.editalId}
            rpc={pre.rpc}
            inicial={p.congelamento}
            aberturaPedida={pedidoDaTrava}
          />
          <InscricoesDoEdital dados={p.inscricoes} />
        </div>
      ) : null}

      {aba === "vagas" ? (
        <div className="avd-pre-vagas" data-aba-da-triagem="vagas">
          {!vagasProntas ? (
            <div className="ui-card" aria-busy="true">
              <div className="ui-esqueleto-linha" />
            </div>
          ) : vagas.length ? (
            vagas.map((v) => (
              <VagaRecolhida key={v.codigo} v={v}>
                {() => (
                  <VagaDaPre
                    v={v}
                    configuracao={configuracao as unknown as RegistroDaPre}
                    podeCoordenar={d.pode_coordenar}
                    tamanho={tamanhos[v.codigo]}
                    pre={pre}
                    editalId={e.editalId}
                    rotuloEdital={rotuloEdital}
                    unidade={unidade}
                    leitura={leitura}
                    marcados={marcados}
                    aoMarcar={aoMarcar}
                    aoMarcarVarias={aoMarcarVarias}
                    aoMudarTamanho={(codigo, valor) =>
                      setTamanhos((t) => ({ ...t, [codigo]: valor }))
                    }
                  />
                )}
              </VagaRecolhida>
            ))
          ) : (
            <p className="ui-texto-secundario">
              Nenhuma vaga da Empregare neste edital.
            </p>
          )}

          {d.pode_coordenar && mudou ? (
            <section
              className="ui-card avd-inline"
              aria-label="Salvar os tamanhos do lote"
            >
              <label className="ui-campo ui-campo-largo">
                <span>Motivo da mudança</span>
                <input
                  type="text"
                  maxLength={2000}
                  value={motivo}
                  onChange={(ev) => setMotivo(ev.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn primary small"
                data-acao="salvar-tamanhos"
                disabled={e.salvando || motivo.trim().length < 10}
                onClick={() => void salvarTamanhos()}
              >
                Salvar tamanhos
              </button>
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setTamanhos({})}
              >
                Desfazer
              </button>
              {erroAoSalvar ? (
                <Aviso tom="danger" papel="alert">
                  {erroAoSalvar}
                </Aviso>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}

      {aba === "eliminados" ? (
        <EliminadosDaTriagem
          pre={pre}
          vagas={vagas}
          leitura={leitura}
          rotuloEdital={rotuloEdital}
          unidade={unidade}
          totalDeEliminados={cont.eliminados}
          marcadas={marcadas}
          aoMarcar={aoMarcarVarias}
          aoLimpar={() => setMarcadas(new Map())}
        />
      ) : null}

      {aba === "listas" ? (
        <div data-aba-da-triagem="listas">
          <ListasOficiais d={d} p={p} pre={pre} />
        </div>
      ) : null}
    </div>
  );
}
