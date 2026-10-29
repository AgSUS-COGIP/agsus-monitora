import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { RefObject } from "react";
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
import { ESPERA_DO_PEDIDO_MIN } from "../../lib/robos-de-carga.ts";
import {
  Aviso,
  GradeDeKpis,
  Kpi,
  Selo,
  TabelaInfinita,
  usarListaNoServidor,
} from "../../ui/index.ts";
import type { BuscarPagina, ColunaDaTabela } from "../../ui/index.ts";
import {
  IncluirPorDecisao,
  RevogarDecisao,
  SeloDaDecisao,
} from "./decisao-do-lote.tsx";
import { espelhoDaEliminacaoPreAnalise } from "../../lib/avaliacao-documental/espelho-da-pre-classificacao.ts";
import {
  chaveDaPessoa,
  comunicadosDosEliminados,
  ordenarPessoas,
  pessoaEliminada,
} from "../../lib/avaliacao-documental/documentos-em-lote.ts";
import type { PessoaDoDocumento } from "../../lib/avaliacao-documental/documentos-em-lote.ts";
import { AcoesEmLote, type MontarDocumentos } from "./documentos-em-lote.tsx";
import { chaveDaLista } from "./estado-da-pre-classificacao.ts";
import { baixarEspelhoProntoEmPdf } from "./ficha/espelho-de-nota.ts";
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
const COLUNA_DE_MARCAR: ColunaDaTabela = {
  rotulo: "Marcar",
  chave: "marcar",
  cabecalho: <span className="sr-only">Marcar para o lote</span>,
};
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
}: VagaDaPreProps) {
  const [incluindo, setIncluindo] = useState(false);
  const [foraDoLote, setForaDoLote] = useState<InscritoDaPre[]>([]);
  const [lendoForaDoLote, setLendoForaDoLote] = useState(false);
  const [erroDoForaDoLote, setErroDoForaDoLote] = useState("");
  const [emitindo, setEmitindo] = useState("");
  const [erroDoEspelho, setErroDoEspelho] = useState("");
  const [eliminadosAbertos, setEliminadosAbertos] = useState(false);
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
      const atual = await pre.conferirEliminados([
        chaveDaPessoa(c.vaga, c.codigo),
      ]);
      const registros = atual.candidatos.filter(
        (p) => p.codigo === c.codigo && p.vaga === c.vaga,
      );
      const confirmado = registros[0];
      if (
        registros.length !== 1 ||
        !confirmado ||
        confirmado.situacao !== "ELIMINADO"
      )
        throw new Error(
          "Situação alterada ou candidatura não encontrada. Atualize a lista.",
        );
      const espelho = espelhoDaEliminacaoPreAnalise({
        codigo: confirmado.codigo,
        nome: confirmado.nome,
        vaga: confirmado.vaga,
        cargo: v.cargo,
        edital: rotuloEdital,
        unidade,
        modalidade: confirmado.modalidade,
        situacao: confirmado.situacao,
        motivo: confirmado.motivo,
        motivo_codigo: confirmado.motivo_codigo,
        art: confirmado.art,
        declarada: confirmado.declarada,
        nota: confirmado.nota,
        origem_nota: confirmado.origem_nota,
      });
      await baixarEspelhoProntoEmPdf(espelho);
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
                    ? [COLUNA_DE_MARCAR, ...COLUNAS_DOS_ELIMINADOS]
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

/*
  A busca de eliminados (cartão "Comunicados de eliminação"): no banco, no
  edital todo, 300 ms depois da última tecla. Devolve o termo buscado e quantos
  eliminados ele achou em cada vaga (as vagas sem achado somem da tela; cada
  vaga lista os seus achados em páginas).
*/
function usarBuscaDeEliminados(
  pre: EstadoDaPreClassificacao,
  digitado: string,
  dados: DadosDaPreClassificacao | null,
) {
  const [termo, setTermo] = useState("");
  const [resultado, setResultado] = useState<{
    termo: string;
    porVaga: Record<string, number>;
    erro: string;
  }>({ termo: "", porVaga: {}, erro: "" });
  useEffect(() => {
    const limpo = digitado.trim().toLocaleLowerCase("pt-BR");
    const espera = setTimeout(() => setTermo(limpo), limpo ? 300 : 0);
    return () => clearTimeout(espera);
  }, [digitado]);
  const lido = Boolean(dados);
  useEffect(() => {
    if (!termo || !lido) return undefined;
    let vivo = true;
    pre.listar({ vaga: null, grupo: "ELIMINADOS", busca: termo }, null, 1).then(
      (r) => {
        if (vivo) setResultado({ termo, porVaga: r.porVaga, erro: "" });
      },
      (erro: unknown) => {
        if (vivo)
          setResultado({
            termo,
            porVaga: {},
            erro: erro instanceof Error ? erro.message : String(erro),
          });
      },
    );
    return () => {
      vivo = false;
    };
  }, [pre, termo, lido]);
  const pronto = resultado.termo === termo;
  return {
    termo: pronto ? termo : "",
    porVaga: pronto ? resultado.porVaga : {},
    erro: pronto ? resultado.erro : "",
    buscando: Boolean(termo) && !pronto,
  };
}

export interface PreClassificacaoProps {
  e: EstadoDaAvaliacao;
  estado: LojaDaAvaliacao;
  pre: EstadoDaPreClassificacao;
}

export function PreClassificacao({ e, estado, pre }: PreClassificacaoProps) {
  const p = useSyncExternalStore(pre.assinar, pre.obter);
  const [tamanhos, setTamanhos] = useState<Record<string, string>>({});
  const [buscaDeEspelho, setBuscaDeEspelho] = useState("");
  // Os eliminados marcados para comunicado em lote (chave vaga|código → pessoa).
  const [marcadas, setMarcadas] = useState<
    ReadonlyMap<string, PessoaDoDocumento>
  >(() => new Map());
  const marcados = useMemo(() => new Set(marcadas.keys()), [marcadas]);
  const aoMarcar = useCallback(
    (pessoa: PessoaDoDocumento, sim: boolean) =>
      setMarcadas((atual) => {
        const nova = new Map(atual);
        if (sim) nova.set(pessoa.chave, pessoa);
        else nova.delete(pessoa.chave);
        return nova;
      }),
    [],
  );
  // "Marcar todos" (ou os da busca): as chaves que a última marcação em bloco trouxe.
  const [bloco, setBloco] = useState<{ termo: string; chaves: string[] }>({
    termo: "",
    chaves: [],
  });
  const [marcandoBloco, setMarcandoBloco] = useState(false);
  const dadosDoEdital = p.editalId === e.editalId ? p.dados : null;
  const busca = usarBuscaDeEliminados(pre, buscaDeEspelho, dadosDoEdital);
  // A tela de hoje mostra as vagas e as listas oficiais juntas: as duas partes já ao abrir.
  const resumoLido = Boolean(dadosDoEdital);
  useEffect(() => {
    if (!resumoLido) return;
    void pre.garantirParte("vagas");
    void pre.garantirParte("listas");
  }, [pre, resumoLido, e.editalId]);
  const [motivo, setMotivo] = useState("");
  const [erroAoSalvar, setErroAoSalvar] = useState("");
  const [abrirDescongelar, setAbrirDescongelar] = useState(false);
  const [motivoDescongelar, setMotivoDescongelar] = useState("");
  const [descongelando, setDescongelando] = useState(false);
  const versaoDaRegra = e.dados?.regra?.versao ?? 0;
  useEffect(() => {
    // As partes que esta tela mostra saem junto com o resumo (a casca já as
    // pede ao escolher o edital; aqui, para a entrada própria da aba).
    pre.pedirPartes(["vagas", "listas"]);
    void pre.garantirCarregado(e.editalId, String(versaoDaRegra));
  }, [pre, e.editalId, versaoDaRegra]);

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
  const buscaEliminado = busca.termo;
  const vagasVisiveis = buscaEliminado
    ? vagas.filter((v) => (busca.porVaga[String(v.codigo)] ?? 0) > 0)
    : vagas;
  const leitura = String(d.gerado_em ?? "");
  const noBloco = buscaEliminado
    ? Object.values(busca.porVaga).reduce((n, q) => n + q, 0)
    : cont.eliminados;
  const escolhidos = ordenarPessoas(marcadas.values());
  const todosDaBuscaMarcados =
    bloco.termo === buscaEliminado &&
    bloco.chaves.length > 0 &&
    bloco.chaves.length === noBloco &&
    bloco.chaves.every((c) => marcados.has(c));
  const rotuloEdital = String(d.edital?.edital || d.edital?.rotulo || "");
  const unidade = String(d.edital?.unidade || "");

  /* Marca (ou desmarca) todos os eliminados da busca, lidos do banco em páginas. */
  async function marcarOsDaBusca() {
    if (todosDaBuscaMarcados) {
      setMarcadas((atual) => {
        const nova = new Map(atual);
        for (const chave of bloco.chaves) nova.delete(chave);
        return nova;
      });
      setBloco({ termo: "", chaves: [] });
      return;
    }
    setMarcandoBloco(true);
    try {
      const termo = buscaEliminado;
      const linhas = await pre.listarTudo({
        vaga: null,
        grupo: "ELIMINADOS",
        busca: termo,
      });
      const pessoas = linhas.map(pessoaEliminada);
      setMarcadas((atual) => {
        const nova = new Map(atual);
        for (const pessoa of pessoas) nova.set(pessoa.chave, pessoa);
        return nova;
      });
      setBloco({ termo, chaves: pessoas.map((x) => x.chave) });
    } finally {
      setMarcandoBloco(false);
    }
  }

  // Confere só os marcados, como estão agora: quem deixou de estar eliminado sai.
  const montarComunicados: MontarDocumentos = async (escolhidas) => {
    const atual = await pre.conferirEliminados(escolhidas.map((x) => x.chave));
    const r = comunicadosDosEliminados(
      atual.candidatos as Parameters<typeof comunicadosDosEliminados>[0],
      atual.vagas,
      escolhidas,
      { edital: rotuloEdital, unidade },
    );
    return {
      documentos: r.documentos,
      avisos: [
        ...(r.foraDaSituacao.length
          ? [
              `Não estão mais eliminados (${r.foraDaSituacao.length}): ${r.foraDaSituacao.join(", ")}. Atualize a lista.`,
            ]
          : []),
        ...(r.semMotivo.length
          ? [
              `Sem justificativa registrada, verificar antes de emitir (${r.semMotivo.length}): ${r.semMotivo.join(", ")}.`,
            ]
          : []),
      ],
    };
  };
  const ultima = d.ultima_execucao;
  const situacaoDoEdital = ultima?.edital?.situacao;
  const conferida = d.regra?.situacao === "CONFERIDA";
  const pedidoRecente =
    p.pedidoEm instanceof Date &&
    (Date.now() - p.pedidoEm.getTime()) / 60000 < ESPERA_DO_PEDIDO_MIN;
  const configuracao =
    e.dados?.regra?.configuracao || d.regra?.configuracao || {};
  const mudou = Object.keys(tamanhos).length > 0;
  const congeladas = declaradasCongeladas(d);

  async function descongelar() {
    setDescongelando(true);
    const ok = await pre.descongelar(motivoDescongelar.trim());
    setDescongelando(false);
    if (ok) {
      setAbrirDescongelar(false);
      setMotivoDescongelar("");
    }
  }

  async function salvarTamanhos() {
    setErroAoSalvar("");
    const r = await estado.salvarRegra(
      regraComTamanhos(configuracao, tamanhos),
      motivo.trim(),
    );
    if (r.ok) {
      setTamanhos({});
      setMotivo("");
    } else setErroAoSalvar(r.erro);
  }

  return (
    <div className="avd-pre">
      <TravaDasInscricoes
        editalId={e.editalId}
        rpc={pre.rpc}
        inicial={p.congelamento}
      />
      <InscricoesDoEdital dados={p.inscricoes} />
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
        <Kpi
          tom="alerta"
          icone="fa-scale-balanced"
          rotulo="ART × recalculada"
          valor={cont.divergencias}
        />
      </GradeDeKpis>

      <section className="ui-card avd-inline" aria-label="Execução">
        <span
          className="ui-texto-secundario"
          data-execucao={ultima?.situacao || "nenhuma"}
        >
          {ultima
            ? `Triagem de ${quando(ultima.fim || ultima.inicio)} · ${SITUACAO_DA_EXECUCAO[ultima.situacao] || ultima.situacao}`
            : "Ainda sem triagem"}
          {d.regra
            ? ` · regra: ${rotuloDaVersaoNaLista(e.dados?.regra?.versoes, d.regra.versao)}`
            : ""}
        </span>
        {d.pode_coordenar ? (
          <button
            type="button"
            className="btn primary small"
            data-acao="recalcular"
            disabled={!conferida || d.em_andamento || pedidoRecente}
            onClick={() => void pre.recalcular()}
          >
            {d.em_andamento
              ? "Rodando…"
              : pedidoRecente
                ? "Pedido enviado"
                : "Recalcular"}
          </button>
        ) : null}
        {congeladas.quantidade ? (
          <span className="ui-texto-secundario" data-congeladas>
            <i className="fa-solid fa-lock" aria-hidden="true" /> Notas
            declaradas congeladas em {quando(congeladas.em)}
          </span>
        ) : null}
        {d.pode_coordenar && congeladas.quantidade && !abrirDescongelar ? (
          <button
            type="button"
            className="btn secondary small"
            data-acao="abrir-descongelar"
            onClick={() => setAbrirDescongelar(true)}
          >
            Descongelar
          </button>
        ) : null}
      </section>

      {d.pode_coordenar && congeladas.quantidade && abrirDescongelar ? (
        <section
          className="ui-card avd-inline"
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
              setAbrirDescongelar(false);
              setMotivoDescongelar("");
            }}
          >
            Cancelar
          </button>
        </section>
      ) : null}

      {p.aviso ? (
        <Aviso
          tom={p.aviso.tom === "info" ? undefined : p.aviso.tom}
          papel={p.aviso.tom === "danger" ? "alert" : "status"}
        >
          {p.aviso.texto}
        </Aviso>
      ) : null}
      {d.pode_coordenar && !conferida ? (
        <Aviso tom="warning">
          {d.regra
            ? "Marque a regra como conferida na aba Regra para recalcular."
            : "Crie a regra na aba Regra para recalcular."}
        </Aviso>
      ) : null}
      {situacaoDoEdital &&
      (SITUACOES_DO_EDITAL as AvisosDaSituacao)[situacaoDoEdital] ? (
        <Aviso tom="warning">
          {(SITUACOES_DO_EDITAL as AvisosDaSituacao)[situacaoDoEdital]}
          {ultima?.edital?.mensagem ? ` ${ultima.edital.mensagem}` : ""}
        </Aviso>
      ) : null}

      <section className="ui-card" aria-label="Emitir comunicado de eliminação">
        <h3 className="ui-titulo">
          Comunicados de eliminação antes da análise
        </h3>
        <p className="ui-texto-secundario">
          Busque pelo código ou nome. A vaga será exibida com o botão de PDF;
          marque várias pessoas para baixar em ZIP ou imprimir juntas.
        </p>
        <label className="ui-campo">
          <span>Buscar candidato eliminado</span>
          <input
            type="search"
            value={buscaDeEspelho}
            placeholder="Código ou nome"
            data-acao="buscar-espelho-eliminado"
            onChange={(ev) => setBuscaDeEspelho(ev.target.value)}
          />
        </label>
        {busca.erro ? (
          <Aviso tom="danger" papel="alert">
            Não foi possível buscar: {busca.erro}
          </Aviso>
        ) : busca.buscando ? (
          <p className="ui-texto-secundario" role="status">
            Buscando…
          </p>
        ) : buscaEliminado && !vagasVisiveis.length ? (
          <Aviso tom="warning">Nenhum eliminado encontrado.</Aviso>
        ) : null}
        <div className="avd-docs-lote-resumo" data-acao="comunicados-lote">
          <span>
            Marque na lista de eliminados de cada vaga para emitir vários de uma
            vez ·{" "}
            <strong data-acao="comunicados-marcados">
              {escolhidos.length.toLocaleString("pt-BR")} marcado(s)
            </strong>
          </span>
          <span className="ui-acoes">
            <button
              type="button"
              className="btn ghost small"
              data-acao="comunicados-marcar-busca"
              disabled={!noBloco || marcandoBloco || busca.buscando}
              onClick={() => void marcarOsDaBusca()}
            >
              {marcandoBloco
                ? "Marcando…"
                : todosDaBuscaMarcados
                  ? buscaEliminado
                    ? "Desmarcar os da busca"
                    : "Desmarcar todos"
                  : buscaEliminado
                    ? `Marcar os da busca (${noBloco.toLocaleString("pt-BR")})`
                    : `Marcar todos os eliminados (${noBloco.toLocaleString("pt-BR")})`}
            </button>
            {marcados.size ? (
              <button
                type="button"
                className="btn ghost small"
                onClick={() => {
                  setMarcadas(new Map());
                  setBloco({ termo: "", chaves: [] });
                }}
              >
                Limpar marcação
              </button>
            ) : null}
          </span>
        </div>
        <AcoesEmLote
          id="comunicados"
          escolhidas={escolhidos}
          rotuloDoDocumento="comunicado"
          tituloDaImpressao="Comunicados de eliminação"
          prefixoDoZip="comunicados"
          edital={rotuloEdital}
          montar={montarComunicados}
        />
      </section>
      {!buscaEliminado ? <ListasOficiais d={d} p={p} pre={pre} /> : null}

      {vagasVisiveis.length ? (
        vagasVisiveis.map((v) => (
          <VagaDaPre
            key={v.codigo}
            v={v}
            configuracao={configuracao}
            podeCoordenar={d.pode_coordenar}
            tamanho={tamanhos[v.codigo]}
            pre={pre}
            editalId={e.editalId}
            rotuloEdital={rotuloEdital}
            unidade={unidade}
            leitura={leitura}
            buscaEliminado={buscaEliminado}
            achadosNaBusca={busca.porVaga[String(v.codigo)] ?? 0}
            marcados={marcados}
            aoMarcar={aoMarcar}
            aoMudarTamanho={(codigo, valor) =>
              setTamanhos((t) => ({ ...t, [codigo]: valor }))
            }
          />
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
  );
}
