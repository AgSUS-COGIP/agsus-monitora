import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usarLojaNaUrl } from "../../app/usar-filtros-na-url.ts";
import type {
  EsquemaDosFiltros,
  ValoresDosFiltros,
} from "../../app/filtros-no-endereco.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { parametroDeAreaDaRpc } from "../../lib/area-do-painel-de-analises.ts";
import { ordinal } from "../../lib/classificacao/numeros.ts";
import { copiarTexto } from "../../lib/convite-de-acesso.ts";
import { formatNumberBR } from "../../lib/formatters";
import {
  aptasDaFila,
  concluidasHoje,
  ritmoDaFila,
} from "../../lib/avaliacao-documental/numeros-da-fila.ts";
import type { RitmoDaFila } from "../../lib/avaliacao-documental/numeros-da-fila.ts";
import { rotuloDaVersaoNaLista } from "../../lib/nome-da-versao.ts";
import type { VersaoComNome } from "../../lib/nome-da-versao.ts";
import {
  acoesDaFicha,
  acoesDaSelecao,
  agruparPorVaga,
  andamentoDaFila,
  COLUNAS_DA_FILA,
  colunasDaEtapa,
  ETAPAS_DA_FILA,
  fichaPeloCodigo,
  filtrarFila,
  filtrosDaFilaEmUso,
  filtroEhInicial,
  FILTRO_INICIAL,
  loteDaFila,
  ordenarFila,
  planoDeDistribuicao,
  proximaOrdem,
  reservaVigente,
  resumoDaVagaNaFila,
  SITUACOES_DA_FICHA,
  textoDaColuna,
  textoDaReserva,
  textoDaSituacaoNaFila,
} from "../../lib/avaliacao-documental/fila.ts";
import type {
  AcaoDaFicha,
  ChaveDaColuna,
  EtapaDaFila,
  FiltroDaFila,
  InscritoComFicha,
  InscritoNaFila,
  OrdemDaFila as OrdemDaTabela,
  ResumoDaVagaNaFila as ResumoDaVaga,
} from "../../lib/avaliacao-documental/fila.ts";
import { tomDoResultado } from "../../lib/avaliacao-documental/ficha.ts";
import {
  contadoresComForaDoLote,
  eliminadosNoBanco,
  juntarFila,
  modalidadesDaFila,
  precisaDoForaDoLote,
  resumoForaDoLote,
} from "../../lib/avaliacao-documental/fila-fora-do-lote.ts";
import {
  DICA_DA_ART,
  nota,
} from "../../lib/avaliacao-documental/tela-da-pre-classificacao.ts";
import {
  AcoesDaLinha,
  Aviso,
  BarraDaLista,
  Campo,
  CardDaLista,
  CelulaDaPessoa,
  FaixaDeSituacao,
  Gaveta,
  MenuDeAcoes,
  porcentagemDe,
  Selo,
  TabelaDaLista,
  usarListaNoServidor,
} from "../../ui/index.ts";
import type {
  AcaoDoMenu,
  BuscarPagina,
  ColunaDaTabela,
  ItemDaFaixa,
  TabelaNoServidor,
} from "../../ui/index.ts";
import { RevogarDecisao, SeloDaDecisao } from "./decisao-do-lote.tsx";
import { RelatorioDeMotivosDaFila } from "./relatorio-de-motivos.tsx";
import { erroDoMotivoDaFila } from "../../lib/avaliacao-documental/qualidade-do-motivo.ts";
import {
  MOTIVO_OUTRO,
  MOTIVOS_DA_REABERTURA,
  validarReabertura,
} from "../../lib/avaliacao-documental/motivos-da-reabertura.ts";
import { ConteudoDaFicha } from "./ficha/ficha.tsx";
import { AndamentoPorVaga } from "./resumo-do-andamento.tsx";
import { ReinicioDasFichas } from "./reinicio-das-fichas.tsx";
import type { LojaDaFila, SnapshotDaFila } from "./estado-da-fila.ts";
import type { FiltroSalvo } from "./tipos-do-estado.ts";
import type { AberturaDoRelatorio } from "./relatorio-de-motivos.tsx";
import { CarregandoConteudo } from "../../ui/index.ts";

/*
  Aba Fila (fase F3): o resumo do andamento (o edital e o bloco recolhível
  "Por vaga", clicável como filtro: resumo-do-andamento.tsx), as etapas com contadores (clicáveis como filtro), os filtros
  compactos numa linha com os filtros salvos, "Pegar próximo" e "Minhas
  fichas" para o analista, o menu "Ações da coordenação" (distribuir,
  redistribuir, liberar reservas, mandar para revisão e abrir fichas do lote,
  com confirmação e motivo; o relatório de motivos: relatorio-de-motivos.tsx;
  espelhos e modelo do espelho ficam só na aba Documentos: espelhos.tsx; a
  inclusão por decisão da coordenação fica só na Triagem), a tabela
  agrupada por vaga quando a vaga é "Todas", a decisão da coordenação (selo "Decisão: …" na lista e no topo da
  ficha, com "Revogar decisão": decisao-do-lote.tsx) e a ficha aberta
  com a reserva; o conteúdo da análise (F4) é ficha/ficha.tsx. Explicações:
  docs/aya/regras-da-avaliacao-documental.md.

  O layout das telas da seleção: a faixa de situação no alto (No lote,
  Pendentes, Em análise, Em revisão e Concluídas, cada número um filtro da
  etapa, com a barra da distribuição, o selo do ritmo, o feito hoje com a
  meta do dia quando o cronograma a dá, "N fora do lote" e o "Por vaga"
  recolhível); embaixo, num card só, a barra da lista (busca com "/", Vaga,
  Responsável, "Filtros" com a modalidade e os filtros salvos, o "⋯" da
  coordenação e "Pegar próxima ficha"), a barra da seleção em lote (Atribuir
  a…, Liberar, Mandar para revisão, Limpar seleção) e a tabela (50 e mais 50 ao rolar),
  com a pessoa (nome e "código · modalidade") e, em cada linha, "Analisar"
  (pendente) ou "Abrir" e o "⋯" (atribuir, liberar a reserva, mandar para
  revisão — a mesma gaveta de confirmação das ações em lote — e copiar o
  código).

  Desempenho (lista de até ~7.700 inscritos): os derivados da lista ficam em
  useMemo, as funções passadas à tabela em useCallback, a tabela e cada linha
  em React.memo. Em .tsx: as props de cada componente do arquivo são tipadas
  (interfaces abaixo), sem mudar comportamento.
*/

/* O estado da aba (estado-da-fila.ts) e o que ele publica. */
type Fila = LojaDaFila;
type DadosDaFila = NonNullable<SnapshotDaFila["dados"]>;
/* Uma linha da fila (núcleo ou fora do lote). */
type Inscrito = InscritoNaFila;

interface SituacaoProps {
  c: Inscrito;
}

function SituacaoDaLinha({ c }: SituacaoProps) {
  return (
    <>
      <SituacaoNaFila c={c} /> <SeloDaDecisao c={c} />
    </>
  );
}

function SituacaoNaFila({ c }: SituacaoProps) {
  const texto = textoDaSituacaoNaFila(c);
  if (c.ficha?.situacao === "CONCLUIDA" && c.ficha.resultado)
    return <Selo tom={tomDoResultado(c.ficha.resultado)}>{texto}</Selo>;
  if (c.ficha)
    return (
      <Selo
        tom={SITUACOES_DA_FICHA[c.ficha.situacao as string]?.tom}
        titulo={c.ficha.motivo_saida || undefined}
      >
        {texto}
      </Selo>
    );
  return (
    <Selo
      tom={c.situacao_pre === "ELIMINADO" ? "reprovado" : "neutro"}
      titulo={c.motivo_eliminacao || undefined}
    >
      {texto}
    </Selo>
  );
}

interface FiltrosSalvosProps {
  fila: Fila;
  f: FiltroDaFila;
  filtros: FiltroSalvo[];
}

function FiltrosSalvos({ fila, f, filtros }: FiltrosSalvosProps) {
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [escolhido, setEscolhido] = useState("");
  return (
    <div
      className="avd-fila-filtros-salvos"
      data-tour="avd-fila-filtros-salvos"
    >
      <Campo rotulo="Filtros salvos">
        <select
          value={escolhido}
          onChange={(ev) => {
            setEscolhido(ev.target.value);
            const salvo = filtros.find((x) => x.id === ev.target.value);
            if (salvo) fila.mudarFiltro({ ...FILTRO_INICIAL, ...salvo.filtro });
          }}
        >
          <option value="">{filtros.length ? "Escolha…" : "Nenhum"}</option>
          {filtros.map((x) => (
            <option key={x.id} value={x.id}>
              {x.nome}
            </option>
          ))}
        </select>
      </Campo>
      {escolhido ? (
        <button
          type="button"
          className="avd-link-discreto"
          onClick={async () => {
            if (await fila.excluirFiltro(escolhido)) setEscolhido("");
          }}
        >
          Excluir
        </button>
      ) : null}
      {salvando ? (
        <form
          className="avd-inline"
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (nome.trim() && (await fila.salvarFiltro(nome.trim()))) {
              setSalvando(false);
              setNome("");
            }
          }}
        >
          <Campo rotulo="Nome do filtro">
            <input
              value={nome}
              maxLength={60}
              autoFocus
              onChange={(ev) => setNome(ev.target.value)}
            />
          </Campo>
          <button type="submit" className="btn small" disabled={!nome.trim()}>
            Salvar
          </button>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => setSalvando(false)}
          >
            Cancelar
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="avd-link-discreto"
          disabled={filtroEhInicial(f)}
          onClick={() => setSalvando(true)}
        >
          Salvar filtro
        </button>
      )}
    </div>
  );
}

type TipoDaAcao = "distribuir" | "liberar" | "revisao" | "reabrir";

/* A ação em lote pedida no menu da coordenação: o tipo e as fichas. */
interface AcaoPedida {
  tipo: TipoDaAcao;
  fichas: InscritoComFicha[];
}

const TITULOS_DA_ACAO: Record<TipoDaAcao, string> = {
  distribuir: "Distribuir fichas",
  liberar: "Liberar reservas",
  revisao: "Mandar para revisão",
  reabrir: "Reabrir fichas",
};

interface AcaoEmLoteProps {
  fila: Fila;
  acao: AcaoPedida;
  dados: DadosDaFila;
  aoFechar: (feito: boolean) => void;
}

function AcaoEmLote({ fila, acao, dados, aoFechar }: AcaoEmLoteProps) {
  const [para, setPara] = useState("");
  const [motivo, setMotivo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [complemento, setComplemento] = useState("");
  const [erro, setErro] = useState("");
  const st = useSyncExternalStore(fila.assinar, fila.obter);
  // Reabrir: o motivo da lista e o complemento, a mesma regra do "Reabrir" da ficha.
  const reabertura =
    acao.tipo === "reabrir" ? validarReabertura(codigo, complemento) : null;
  const erroDaReabertura =
    reabertura && !reabertura.ok && (codigo || complemento.trim())
      ? reabertura.erro
      : "";
  const analistas = useMemo(() => dados.analistas || [], [dados.analistas]);
  const plano = useMemo(
    () =>
      acao.tipo === "distribuir"
        ? planoDeDistribuicao(acao.fichas, analistas, dados.distribuicao, para)
        : null,
    [acao, analistas, dados.distribuicao, para],
  );
  const deOutros =
    acao.tipo === "liberar" &&
    acao.fichas.some((c) => c.ficha.reserva?.usuario !== dados.eu);
  const exigeMotivo =
    acao.tipo === "revisao" ||
    deOutros ||
    (acao.tipo === "distribuir" && (plano!.redistribui || para === "fila"));
  const erroDoMotivo = exigeMotivo ? erroDoMotivoDaFila(motivo) : "";
  const motivoOk = reabertura ? reabertura.ok : !erroDoMotivo;
  const vazio =
    acao.tipo === "distribuir"
      ? !plano!.atribuicoes.length
      : !acao.fichas.length;

  async function confirmar() {
    setErro("");
    let r;
    if (acao.tipo === "distribuir")
      r = await fila.distribuir(
        plano!.atribuicoes.map(({ ficha, versao, usuario }) => ({
          ficha,
          versao,
          usuario,
        })),
        motivo.trim(),
      );
    else if (acao.tipo === "liberar")
      r = await fila.liberarReservas(
        acao.fichas.map((c) => c.ficha.id),
        motivo.trim(),
      );
    else if (acao.tipo === "reabrir") {
      if (!reabertura?.ok) return;
      r = await fila.reabrirFichas(
        acao.fichas.map((c) => ({ ficha: c.ficha.id, versao: c.ficha.versao })),
        reabertura.argumentos.p_motivo,
        reabertura.argumentos.p_complemento,
      );
    } else
      r = await fila.mandarParaRevisao(
        acao.fichas.map((c) => ({ ficha: c.ficha.id, versao: c.ficha.versao })),
        motivo.trim(),
      );
    if (r.ok) aoFechar(true);
    else setErro(r.erro);
  }

  return (
    <Gaveta
      tituloId="avdAcaoTitulo"
      titulo={TITULOS_DA_ACAO[acao.tipo]}
      resumo={`${acao.fichas.length} ficha(s)`}
      aoFechar={() => aoFechar(false)}
      fecharAoClicarFora={false}
      tour="avd-fila-confirmar"
    >
      <div className="avd-gaveta-corpo">
        {acao.tipo === "distribuir" ? (
          <>
            <Campo rotulo="Para">
              <select value={para} onChange={(ev) => setPara(ev.target.value)}>
                <option value="">
                  Entre a equipe (
                  {dados.distribuicao?.criterio === "LIMITE"
                    ? "até o limite"
                    : "partes iguais"}
                  )
                </option>
                {analistas.map((a) => (
                  <option key={a.usuario} value={a.usuario}>
                    {a.nome}
                  </option>
                ))}
                <option value="fila">Devolver à fila (sem responsável)</option>
              </select>
            </Campo>
            {plano!.resumo.length ? (
              <table className="avd-tabela" aria-label="Prévia da distribuição">
                <thead>
                  <tr>
                    <th scope="col">Analista</th>
                    <th scope="col">Recebe</th>
                    <th scope="col">Fica com</th>
                  </tr>
                </thead>
                <tbody>
                  {plano!.resumo.map((r) => (
                    <tr key={r.usuario}>
                      <td>{r.nome}</td>
                      <td>{r.novas}</td>
                      <td>{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {plano!.sobra.length ? (
              <Aviso tom="warning">
                {plano!.sobra.length} ficha(s) sem analista que possa recebê-las
                (vaga ou limite): continuam na fila.
              </Aviso>
            ) : null}
          </>
        ) : null}
        {acao.tipo === "reabrir" ? (
          <>
            <Campo rotulo="Motivo da reabertura" obrigatorio>
              <select
                value={codigo}
                data-campo="motivo-da-reabertura"
                onChange={(ev) => setCodigo(ev.target.value)}
              >
                <option value="">Escolha…</option>
                {MOTIVOS_DA_REABERTURA.map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo
              rotulo={codigo === MOTIVO_OUTRO ? "Descrição" : "Complemento"}
              obrigatorio={codigo === MOTIVO_OUTRO}
              erro={erroDaReabertura || undefined}
            >
              <textarea
                rows={3}
                maxLength={500}
                value={complemento}
                data-campo="complemento-da-reabertura"
                onChange={(ev) => setComplemento(ev.target.value)}
              />
            </Campo>
          </>
        ) : null}
        {exigeMotivo ? (
          <Campo
            rotulo="Motivo"
            obrigatorio
            erro={motivo && !motivoOk ? erroDoMotivo : undefined}
          >
            <textarea
              rows={3}
              maxLength={2000}
              value={motivo}
              onChange={(ev) => setMotivo(ev.target.value)}
            />
          </Campo>
        ) : null}
        {erro ? (
          <Aviso tom="danger" papel="alert">
            {erro}
          </Aviso>
        ) : null}
        <div className="ui-acoes">
          <button
            type="button"
            className="btn secondary"
            onClick={() => aoFechar(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            data-acao={`confirmar-${acao.tipo}`}
            disabled={vazio || !motivoOk || Boolean(st.acao)}
            onClick={confirmar}
          >
            Confirmar
          </button>
        </div>
      </div>
    </Gaveta>
  );
}

/*
  O modo de análise: a ficha aberta ocupa a área de conteúdo (a lista some;
  fica só o menu lateral). Daqui saem os dados do cabeçalho (candidato, vaga,
  chips, o "i" com situação, responsável, reserva e regra, Anterior /
  Próxima entre as fichas da lista filtrada, salvando antes), que a ficha
  desenha preso ao alto com o stepper (ficha/ficha.tsx), e os avisos logo
  abaixo dele. Esc também volta à fila.
*/
/* O que o conteúdo da ficha registra para rodar antes de sair (true: pode sair). */
type AntesDeSair = () => Promise<boolean>;

interface ModoDeAnaliseProps {
  fila: Fila;
  aberta: SnapshotDaFila["aberta"];
  abrindo: boolean;
  dados: DadosDaFila;
  inscritos: Inscrito[];
  filtroVaga: string;
  navegaveis: InscritoComFicha[];
  versoes: ReadonlyArray<VersaoComNome> | null | undefined;
}

function ModoDeAnalise({
  fila,
  aberta,
  abrindo,
  dados,
  inscritos,
  filtroVaga,
  navegaveis,
  versoes,
}: ModoDeAnaliseProps) {
  const f = aberta?.ficha;
  const raiz = useRef<HTMLElement>(null);
  // O conteúdo da ficha salva o que falta (e confirma) antes de sair dela.
  const antesDeSair = useRef<AntesDeSair | null>(null);
  const registrarAntesDeFechar = useCallback((fn: AntesDeSair | null) => {
    antesDeSair.current = fn;
  }, []);
  const podeSair = async () =>
    !antesDeSair.current || (await antesDeSair.current());
  const voltar = async () => {
    if (!(await podeSair())) return;
    await fila.fechar({ esquecer: true });
  };
  const ir = async (fichaId: string | null | undefined) => {
    if (!fichaId || !(await podeSair())) return;
    await fila.abrir(fichaId);
  };
  const voltarRef = useRef(voltar);
  voltarRef.current = voltar;

  useEffect(() => {
    // Abre no alto da tela (vinha rolada na lista).
    globalThis.scrollTo?.({ top: 0 });
  }, [f?.id]);
  useEffect(() => {
    const aoTeclar = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || ev.defaultPrevented) return;
      if (document.querySelector(".modal.show")) return;
      ev.preventDefault();
      void voltarRef.current();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);
  /*
    Recuos das partes fixas: o topo da ficha fica logo abaixo do cabeçalho do
    app (também fixo, de altura variável; só se lê a altura dele) e a lateral,
    abaixo dos dois.
  */
  useEffect(() => {
    const topo = raiz.current?.querySelector(".avd-analise-topo");
    if (!topo || typeof ResizeObserver !== "function") return undefined;
    const cabecalho = document.querySelector("#conteudoPrincipal > .top");
    // Só recua se o cabeçalho do app ficar preso no alto (sticky ou fixed).
    const preso = (el: Element | null) =>
      el && ["sticky", "fixed"].includes(getComputedStyle(el).position);
    const medir = () => {
      const altura = (el: Element | null) =>
        el ? `${Math.ceil(el.getBoundingClientRect().height)}px` : "0px";
      raiz.current?.style.setProperty(
        "--avd-recuo-do-cabecalho",
        altura(preso(cabecalho) ? cabecalho : null),
      );
      raiz.current?.style.setProperty("--avd-altura-do-topo", altura(topo));
    };
    const observador = new ResizeObserver(medir);
    observador.observe(topo);
    if (cabecalho) observador.observe(cabecalho);
    medir();
    return () => observador.disconnect();
  }, [f?.id]);

  const [liberando, setLiberando] = useState(false);
  // O pedido de liberar já saiu: o segundo clique não libera de novo. A trava
  // é síncrona (ref); o estado só desativa o botão na tela.
  const liberandoAgora = useRef(false);
  const [enviandoLiberar, setEnviandoLiberar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");

  if (!f)
    return (
      <div className="avd-analise" aria-busy={abrindo ? "true" : undefined}>
        <CarregandoConteudo rotulo="Abrindo a ficha…" />
      </div>
    );

  const situacao: { rotulo?: string; tom?: string } =
    SITUACOES_DA_FICHA[f.situacao as string] || {};
  // O inscrito da fila (entrada no lote e a decisão da coordenação).
  const inscrito = (inscritos || []).find((c) => c.ficha?.id === f.id);
  const reservaDeOutro =
    reservaVigente(f.reserva) && f.reserva!.usuario !== dados.eu;
  const posicao = navegaveis.findIndex((c) => c.ficha.id === f.id);
  const anterior = posicao > 0 ? navegaveis[posicao - 1] : null;
  const proxima =
    posicao >= 0 && posicao < navegaveis.length - 1
      ? navegaveis[posicao + 1]
      : null;
  // O cabeçalho é desenhado pela ficha (ficha/cabecalho-da-ficha.tsx), com o nível que ela calcula.
  const topo = {
    codigo: String(f.codigo ?? ""),
    nome: f.nome,
    vaga: f.vaga,
    cargo: f.cargo,
    declarada: f.art === null || f.art === undefined ? null : nota(f.art),
    dicaDaDeclarada: DICA_DA_ART,
    posicao: f.posicao ? ordinal(f.posicao) : null,
    modalidade: f.modalidade || null,
    informacoes: [
      {
        rotulo: "Situação",
        valor: <Selo tom={situacao.tom}>{situacao.rotulo || f.situacao}</Selo>,
      },
      { rotulo: "Responsável", valor: f.responsavel_nome || "—" },
      { rotulo: "Reserva", valor: textoDaReserva(f.reserva, dados.eu) || "—" },
      ...(f.versao_regra
        ? [
            {
              rotulo: "Regra",
              valor: rotuloDaVersaoNaLista(versoes, f.versao_regra),
            },
          ]
        : []),
      ...(f.motivo_saida
        ? [{ rotulo: "Saiu do lote", valor: f.motivo_saida }]
        : []),
    ],
    // A minha, em dia ou vencida: vencida, o cabeçalho pede para reabrir.
    fimDaMinhaReserva:
      aberta!.reservada && f.reserva?.usuario === dados.eu
        ? f.reserva!.expira
        : null,
    decisao: inscrito ? (
      <span className="avd-inline avd-analise-decisao">
        <SeloDaDecisao c={inscrito} />
        {dados.pode_coordenar ? (
          <RevogarDecisao
            c={inscrito}
            aoRevogar={async (motivo: string) => {
              const r = await fila.revogarDecisao([inscrito], motivo);
              // Reabrir a ficha desmonta o conteúdo: salva o que falta antes
              // (como Voltar e Ir), senão o rascunho agendado se perde.
              if (r.ok && (await podeSair())) await fila.abrir(f.id);
              return r;
            }}
          />
        ) : null}
      </span>
    ) : null,
    voltar,
    navegacao: {
      posicao,
      total: navegaveis.length,
      anterior: anterior
        ? { id: anterior.ficha.id, codigo: anterior.codigo }
        : null,
      proxima: proxima
        ? { id: proxima.ficha.id, codigo: proxima.codigo }
        : null,
      abrindo,
      ir: (id: string | undefined) => void ir(id),
    },
  };
  return (
    <section
      className="avd-analise"
      ref={raiz}
      aria-labelledby="avdFichaTitulo"
      data-tour="avd-ficha"
    >
      <ConteudoDaFicha
        key={f.id}
        fila={fila}
        aberta={aberta!}
        filtroVaga={filtroVaga}
        versoes={versoes}
        aoFechar={voltar}
        registrarAntesDeFechar={registrarAntesDeFechar}
        topo={topo}
      >
        {aberta!.somente_leitura && aberta!.motivo ? (
          <Aviso tom="warning">Só leitura: {aberta!.motivo}</Aviso>
        ) : null}
        {dados.pode_coordenar && reservaDeOutro ? (
          liberando ? (
            <div className="avd-inline">
              <Campo
                rotulo="Motivo para liberar a reserva"
                obrigatorio
                erro={motivo ? erroDoMotivoDaFila(motivo) : undefined}
              >
                <input
                  value={motivo}
                  maxLength={2000}
                  onChange={(ev) => setMotivo(ev.target.value)}
                />
              </Campo>
              <button
                type="button"
                className="btn small"
                disabled={
                  enviandoLiberar || Boolean(erroDoMotivoDaFila(motivo))
                }
                onClick={async () => {
                  if (liberandoAgora.current) return;
                  liberandoAgora.current = true;
                  setEnviandoLiberar(true);
                  try {
                    const r = await fila.liberarReservas([f.id], motivo.trim());
                    if (r.ok) await fila.abrir(f.id);
                    else setErro(r.erro);
                  } finally {
                    liberandoAgora.current = false;
                    setEnviandoLiberar(false);
                  }
                }}
              >
                Liberar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn secondary avd-analise-liberar"
              data-tour="avd-ficha-liberar"
              onClick={() => setLiberando(true)}
            >
              Liberar a reserva
            </button>
          )
        ) : null}
        {erro ? (
          <Aviso tom="danger" papel="alert">
            {erro}
          </Aviso>
        ) : null}
      </ConteudoDaFicha>
    </section>
  );
}

/* O "⋯" de uma linha: as ações da coordenação (gaveta de confirmação) e copiar. */
type AcaoDaLinhaDaFila = AcaoDaFicha | "copiar";
const ROTULOS_DA_LINHA: Record<
  AcaoDaLinhaDaFila,
  { rotulo: string; icone: string }
> = {
  distribuir: { rotulo: "Atribuir a…", icone: "fa-users" },
  liberar: { rotulo: "Liberar reserva", icone: "fa-lock-open" },
  revisao: { rotulo: "Mandar para revisão", icone: "fa-rotate-left" },
  reabrir: { rotulo: "Reabrir", icone: "fa-lock-open" },
  copiar: { rotulo: "Copiar código", icone: "fa-copy" },
};

/*
  O ritmo do dia do edital (o selo e a meta do card "Ritmo da análise" do
  Painel das análises), de obter_ritmo_da_analise: uma leitura por área a
  cada 5 minutos. Quem não pode ler o Painel das análises fica sem ele (a
  faixa mostra só as concluídas de hoje).
*/
const RPC_RITMO = "obter_ritmo_da_analise";
const VALIDADE_DO_RITMO_MS = 5 * 60 * 1000;
const ritmosLidos = new WeakMap<
  object,
  Map<string, { em: number; resposta: Promise<unknown> }>
>();
function usarRitmoDoDia(fila: Fila, editalId: string) {
  const { area } = usarAreaAtual();
  const [resposta, setResposta] = useState<unknown>(null);
  useEffect(() => {
    if (!area || !editalId) return undefined;
    let vivo = true;
    const daFila = ritmosLidos.get(fila) ?? new Map();
    ritmosLidos.set(fila, daFila);
    let lido = daFila.get(area);
    if (!lido || Date.now() - lido.em > VALIDADE_DO_RITMO_MS) {
      lido = {
        em: Date.now(),
        resposta: Promise.resolve()
          .then(() => fila.rpc(RPC_RITMO, parametroDeAreaDaRpc(area)))
          .catch(() => null),
      };
      daFila.set(area, lido);
    }
    void lido.resposta.then((r: unknown) => {
      if (vivo) setResposta(r);
    });
    return () => {
      vivo = false;
    };
  }, [fila, area, editalId]);
  return useMemo(
    () => (resposta ? ritmoDaFila(resposta, editalId) : null),
    [resposta, editalId],
  );
}

/* A busca já vem aplicada por filtrarFila (o filtro "busca" é salvo com os outros). */
const jaFiltrado = <T,>(itens: readonly T[]): readonly T[] => itens;

/* O conteúdo de cada coluna; o resto é o texto de textoDaColuna ("—" sem valor). */
/*
  As colunas da tela: código e nome viram uma coluna só, "Pessoa" (o nome e,
  embaixo, "código · modalidade"); o CSV continua com as duas.
*/
type ChaveDaTela = ChaveDaColuna | "pessoa";
function colunasDaTela(etapa: string): readonly ChaveDaTela[] {
  const chaves: ChaveDaTela[] = [];
  for (const chave of colunasDaEtapa(etapa)) {
    if (chave === "nome") continue;
    chaves.push(chave === "codigo" ? "pessoa" : chave);
  }
  return chaves;
}
const COLUNA_DA_PESSOA = { rotulo: "Pessoa", numero: false, dica: undefined };
const colunaDaTela = (chave: ChaveDaTela) =>
  chave === "pessoa"
    ? COLUNA_DA_PESSOA
    : {
        rotulo:
          COLUNAS_DA_FILA[chave].rotuloCurto ?? COLUNAS_DA_FILA[chave].rotulo,
        numero: COLUNAS_DA_FILA[chave].numero,
        dica: COLUNAS_DA_FILA[chave].dica,
      };

interface CelulaProps {
  c: Inscrito;
  chave: ChaveDaTela;
  eu: string | undefined;
}

function Celula({ c, chave, eu }: CelulaProps) {
  if (chave === "pessoa")
    return (
      <CelulaDaPessoa
        nome={c.nome}
        codigo={c.codigo}
        modalidade={c.modalidade}
      />
    );
  if (chave === "situacao" || chave === "resultado")
    return <SituacaoDaLinha c={c} />;
  if (chave === "posicao") return c.posicao ? ordinal(c.posicao) : "—";
  if (chave === "art") return nota(c.art);
  return textoDaColuna(c, chave, eu) || "—";
}

/*
  Uma linha da tabela, memorizada: só redesenha quando o próprio inscrito
  muda (a releitura parcial mantém o mesmo objeto para quem não mudou), a
  caixa dela é marcada ou desmarcada, ou muda a etapa / "abrindo". Selecionar
  uma linha não redesenha as outras 49.
*/
interface LinhaDaFilaProps {
  c: Inscrito;
  chaves: readonly ChaveDaTela[];
  comCaixa: boolean;
  comAcoes: boolean;
  marcada: boolean;
  marcar: (id: string, sim: boolean) => void;
  abrindo: boolean;
  eu: string | undefined;
  fila: Fila;
  coordena: boolean;
  aoAcao: (acao: AcaoDaLinhaDaFila, c: Inscrito) => void;
}

const LinhaDaFila = memo(function LinhaDaFila({
  c,
  chaves,
  comCaixa,
  comAcoes,
  marcada,
  marcar,
  abrindo,
  eu,
  fila,
  coordena,
  aoAcao,
}: LinhaDaFilaProps) {
  const outras: AcaoDaLinhaDaFila[] = [
    ...(coordena ? acoesDaFicha(c) : []),
    "copiar",
  ];
  const pendente = c.ficha?.situacao === "PENDENTE";
  return (
    <tr data-candidato={c.codigo} data-marcada={marcada ? "sim" : undefined}>
      {comCaixa ? (
        <td>
          {c.ficha ? (
            <input
              type="checkbox"
              aria-label={`Selecionar ${c.codigo}`}
              checked={marcada}
              onChange={(ev) => marcar(c.id, ev.target.checked)}
            />
          ) : null}
        </td>
      ) : null}
      {chaves.map((chave) => (
        <td
          key={chave}
          className={colunaDaTela(chave).numero ? "num" : undefined}
          data-coluna={chave}
        >
          <Celula c={c} chave={chave} eu={eu} />
        </td>
      ))}
      {comAcoes ? (
        <td className="avd-fila-acoes-da-linha">
          <AcoesDaLinha
            pessoa={String(c.codigo ?? "")}
            principal={
              c.ficha?.id
                ? {
                    rotulo: pendente ? "Analisar" : "Abrir",
                    acao: "abrir-ficha",
                    destaque: pendente,
                    desabilitado: abrindo,
                    aoClicar: () => void fila.abrir(c.ficha!.id!),
                  }
                : null
            }
            outras={outras.map((acao) => ({
              id: acao,
              ...ROTULOS_DA_LINHA[acao],
              dados: { "data-acao": `ficha-${acao}` },
              aoEscolher: () => aoAcao(acao, c),
            }))}
          />
        </td>
      ) : null}
    </tr>
  );
});

/*
  A tabela da aba (TabelaDaLista, src/ui/), dentro do card da lista: as
  colunas que fazem sentido na etapa (Eliminados: motivo e ART; Concluídas:
  nota, resultado, responsável e data; Pendentes e Em análise: posição, ART,
  responsável e reserva), a pessoa numa coluna só, ordem por coluna, 50 por
  vez ao rolar ("Mostrando N de M"), o grupo por vaga (código, cargo,
  lote e linha de corte; recolhível) e "Exportar CSV" da aba, na ordem da
  coluna e sem agrupar. A busca por código ou nome fica na barra da lista.

  Memorizada (React.memo): recebe só valores estáveis da Fila (listas e
  funções memorizadas, a etapa e "abrindo" em vez do estado inteiro), então
  abrir um menu, uma gaveta ou uma mensagem do estado não a redesenham.
*/
/* O grupo da tabela (por vaga), como a TabelaDaLista o recebe. */
interface GrupoDaTabela {
  chave: (c: Inscrito) => string;
  cabecalho: (vaga: string, quantos: number) => ReactNode;
  recolhidos: Set<string>;
  aoAlternar: (vaga: string) => void;
}

interface TabelaDaFilaProps {
  etapa: string;
  abrindo: boolean;
  eu: string | undefined;
  fila: Fila;
  linhas: Inscrito[];
  ordenadas: Inscrito[];
  exibidas: Inscrito[];
  ordem: OrdemDaTabela;
  setOrdem: Dispatch<SetStateAction<OrdemDaTabela>>;
  carregado: boolean;
  erroDeFora: string;
  semPreClassificacao: boolean;
  coordena: boolean;
  selecao: Set<string>;
  marcar: (id: string, sim: boolean) => void;
  grupo: GrupoDaTabela | null;
  aoAcao: (acao: AcaoDaLinhaDaFila, c: Inscrito) => void;
  /** O recorte da lista (filtros e ordem): mudou, volta às primeiras 50. */
  recorte: string;
  /** Aba Eliminados no banco: as páginas, o CSV do recorte e o "Tentar novamente". */
  servidor?: TabelaNoServidor | null;
  aoExportar?: (() => void) | null;
  aoTentarDeNovo?: (() => void) | null;
}

const TabelaDaFila = memo(function TabelaDaFila({
  etapa,
  abrindo,
  eu,
  fila,
  linhas,
  ordenadas,
  exibidas,
  ordem,
  setOrdem,
  carregado,
  erroDeFora,
  semPreClassificacao,
  coordena,
  selecao,
  marcar,
  grupo,
  aoAcao,
  recorte,
  servidor = null,
  aoExportar = null,
  aoTentarDeNovo = null,
}: TabelaDaFilaProps) {
  const chaves = useMemo(() => colunasDaTela(etapa), [etapa]);
  const comFicha = useMemo(() => linhas.filter((c) => c.ficha), [linhas]);
  const comCaixa = coordena && comFicha.length > 0;
  const comAcoes = comFicha.length > 0;
  const todasMarcadas =
    comFicha.length > 0 && comFicha.every((c) => selecao.has(c.id));
  const rotuloDaEtapa =
    ETAPAS_DA_FILA.find((e) => e.valor === etapa)?.rotulo || "Inscritos";

  const colunas = useMemo<ColunaDaTabela[]>(
    () => [
      ...(comCaixa
        ? [
            {
              chave: "selecionar",
              rotulo: "Selecionar",
              largura: "2.75rem",
              cabecalho: (
                <input
                  type="checkbox"
                  aria-label="Selecionar as fichas da lista"
                  checked={todasMarcadas}
                  onChange={(ev) => {
                    for (const c of comFicha) marcar(c.id, ev.target.checked);
                  }}
                />
              ),
            },
          ]
        : []),
      ...chaves.map((chave) => {
        // A pessoa ordena pelo nome.
        const daOrdem = chave === "pessoa" ? "nome" : chave;
        return {
          chave,
          ...colunaDaTela(chave),
          ordem: ordem.chave === daOrdem ? ordem.sentido : "",
          aoOrdenar: () => setOrdem((atual) => proximaOrdem(atual, daOrdem)),
        };
      }),
      // Sem ficha na lista (Eliminados), não há o que fazer na linha.
      ...(comAcoes
        ? [
            {
              chave: "acoes",
              rotulo: "Ações",
              numero: true,
              cabecalho: <span className="sr-only">Ações</span>,
            },
          ]
        : []),
    ],
    [
      comCaixa,
      comAcoes,
      todasMarcadas,
      comFicha,
      marcar,
      chaves,
      ordem,
      setOrdem,
    ],
  );
  const linha = useCallback(
    (c: Inscrito) => (
      <LinhaDaFila
        key={c.id}
        c={c}
        chaves={chaves}
        comCaixa={comCaixa}
        comAcoes={comAcoes}
        marcada={selecao.has(c.id)}
        marcar={marcar}
        abrindo={abrindo}
        eu={eu}
        fila={fila}
        coordena={coordena}
        aoAcao={aoAcao}
      />
    ),
    [
      chaves,
      comCaixa,
      comAcoes,
      selecao,
      marcar,
      abrindo,
      eu,
      fila,
      coordena,
      aoAcao,
    ],
  );

  if (erroDeFora)
    return (
      <Aviso tom="danger" papel="alert">
        Não foi possível carregar os inscritos de fora do lote: {erroDeFora}{" "}
        <button
          type="button"
          className="btn secondary small"
          onClick={() =>
            aoTentarDeNovo ? aoTentarDeNovo() : void fila.carregarForaDoLote()
          }
        >
          Tentar novamente
        </button>
      </Aviso>
    );

  return (
    <TabelaDaLista
      rotulo={rotuloDaEtapa}
      carregado={carregado}
      itens={exibidas}
      colunas={colunas}
      classeDaTabela="avd-fila-lista"
      vazio={
        semPreClassificacao
          ? "O edital ainda não tem triagem."
          : "Nenhuma ficha nesta situação com esses filtros."
      }
      // A tabela trata null como sem grupo (o padrão dela).
      grupo={grupo as GrupoDaTabela}
      servidor={servidor}
      chaveDoRecorte={recorte}
      aoExportar={() =>
        aoExportar ? aoExportar() : fila.exportarCsv(ordenadas, etapa)
      }
      exportarDesativado={!servidor && !ordenadas.length}
      linha={linha}
    />
  );
});

/* A chave do grupo da tabela: a vaga (função de módulo, estável). */
const vagaDoInscrito = (c: Inscrito) => String(c.vaga ?? "");

/* O cabeçalho do grupo da vaga na tabela: cargo, o lote e a linha de corte. */
function textoDoGrupo(
  cargo: string | null | undefined,
  resumo: ResumoDaVaga,
  quantos: number,
) {
  const lote = resumo.porDecisao
    ? `lote ${resumo.total} (${resumo.pelaRegra} pela regra + ${resumo.porDecisao} por decisão)`
    : `lote ${resumo.total}`;
  return [
    cargo,
    resumo.total ? lote : "",
    resumo.corte !== null ? `linha de corte ${nota(resumo.corte)}` : "",
    `${quantos} nesta lista`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/* O edital escolhido (estado.ts), no que a aba Fila usa dele. */
interface EditalDaFila {
  editalId: string;
  dados?: {
    regra?: {
      versoes?: ReadonlyArray<VersaoComNome> | null;
      configuracao?: unknown;
    } | null;
  } | null;
}

interface FilaProps {
  e: EditalDaFila;
  fila: Fila;
}

/*
  A faixa de situação da Fila (FaixaDeSituacao, src/ui/): No lote, Pendentes,
  Em análise, Em revisão e Concluídas, cada um o filtro da etapa (a mesma
  conta das abas de antes: contadoresComForaDoLote). Embaixo, a barra da
  distribuição do lote, o selo do ritmo de hoje (uma vez só), o feito hoje
  com a meta do dia (quando o cronograma a dá) e "N fora do lote" (a etapa
  dos que não estão no lote). Inscritos e Eliminados (de um filtro salvo)
  aparecem como link quando são a etapa escolhida.
*/
interface FaixaDaFilaProps {
  contadores: Record<string, number>;
  etapa: EtapaDaFila;
  lote: { pelaRegra: number; porDecisao: number };
  aptas: number;
  hoje: number;
  ritmo: RitmoDaFila | null;
  aoEscolher: (etapa: EtapaDaFila) => void;
  rodape?: ReactNode;
}

const ETAPAS_DA_FAIXA: ReadonlyArray<{ valor: EtapaDaFila; tom: string }> = [
  { valor: "lote", tom: "neutro" },
  { valor: "pendentes", tom: "alerta" },
  { valor: "em_analise", tom: "info" },
  { valor: "revisao", tom: "destaque" },
  { valor: "concluidas", tom: "sucesso" },
];
const rotuloDaEtapa = (valor: string) =>
  ETAPAS_DA_FILA.find((e) => e.valor === valor)?.rotulo ?? valor;

function FaixaDaFila({
  contadores,
  etapa,
  lote,
  aptas,
  hoje,
  ritmo,
  aoEscolher,
  rodape,
}: FaixaDaFilaProps) {
  const n = (chave: string) => contadores[chave] ?? 0;
  const noLote = n("lote");
  const contexto = (valor: EtapaDaFila): ReactNode => {
    if (valor === "lote")
      return lote.porDecisao ? (
        <span data-lote-da-fila>
          {formatNumberBR(lote.pelaRegra)} pela regra +{" "}
          {formatNumberBR(lote.porDecisao)} por decisão
        </span>
      ) : n("inscritos") ? (
        `${porcentagemDe(noLote, n("inscritos"))} dos inscritos`
      ) : null;
    const pct = porcentagemDe(n(valor), noLote);
    if (valor === "concluidas" && aptas)
      return `${pct} · ${formatNumberBR(aptas)} ${aptas === 1 ? "apta" : "aptas"}`;
    return pct;
  };
  const itens: ItemDaFaixa[] = ETAPAS_DA_FAIXA.map(({ valor, tom }) => ({
    chave: valor,
    rotulo: rotuloDaEtapa(valor),
    valor: n(valor),
    tom,
    contexto: contexto(valor),
    ativo: etapa === valor,
    titulo: `Ver ${rotuloDaEtapa(valor).toLowerCase()}`,
    aoClicar: () => aoEscolher(valor),
  }));
  const fora = n("fora");
  const extra = etapa === "inscritos" || etapa === "eliminados" ? etapa : null;
  return (
    <FaixaDeSituacao
      rotulo="Situação do lote"
      tour="avd-fila-etapas"
      className="avd-fila-faixa"
      itens={itens}
      rotuloDaDistribuicao="Distribuição do lote"
      totalDaDistribuicao={noLote}
      distribuicao={[
        {
          chave: "concluidas",
          rotulo: "Concluídas",
          valor: n("concluidas"),
          tom: "sucesso",
        },
        {
          chave: "em_analise",
          rotulo: "Em análise",
          valor: n("em_analise"),
          tom: "info",
        },
        {
          chave: "revisao",
          rotulo: "Em revisão",
          valor: n("revisao"),
          tom: "destaque",
        },
        {
          chave: "pendentes",
          rotulo: "Pendentes",
          valor: n("pendentes"),
          tom: "alerta",
        },
      ]}
      rodape={rodape}
    >
      {ritmo?.selo.rotulo ? (
        <Selo tom={ritmo.selo.tom} ponto>
          {ritmo.selo.rotulo}
        </Selo>
      ) : null}
      <span data-hoje-da-fila>
        Hoje <strong>{formatNumberBR(ritmo ? ritmo.feito : hoje)}</strong>
        {ritmo?.meta ? ` de ${formatNumberBR(ritmo.meta)}` : ""}
      </span>
      {fora ? (
        <button
          type="button"
          className="ui-faixa-link"
          data-valor="fora"
          aria-pressed={etapa === "fora"}
          onClick={() => aoEscolher("fora")}
        >
          {formatNumberBR(fora)} fora do lote
        </button>
      ) : null}
      {extra ? (
        <button
          type="button"
          className="ui-faixa-link"
          data-valor={extra}
          aria-pressed
          onClick={() => aoEscolher(extra)}
        >
          {formatNumberBR(n(extra))} {rotuloDaEtapa(extra).toLowerCase()}
        </button>
      ) : null}
    </FaixaDeSituacao>
  );
}

/*
  O filtro da Fila na URL: a etapa (aba e cards; trocar é entrada nova no
  histórico), a vaga, a modalidade e o card "Minhas" (?minhas=sim). A busca
  e o responsável escolhido na lista (outra pessoa) ficam fora dela.
*/
type CampoDaFilaNaUrl = "etapa" | "vaga" | "modalidade" | "minhas";
const FILTROS_DA_FILA: EsquemaDosFiltros<CampoDaFilaNaUrl> = Object.freeze({
  etapa: {
    padrao: FILTRO_INICIAL.etapa,
    aceita: (etapa: string) => ETAPAS_DA_FILA.some((e) => e.valor === etapa),
    empilha: true,
  },
  vaga: { padrao: "" },
  modalidade: { padrao: "" },
  minhas: { padrao: "", aceita: (valor: string) => valor === "sim" },
});

/* Na troca de etapa, o edital e a aba da tela ficam na URL. */
const FICA_NA_TROCA_DE_ETAPA = Object.freeze(["edital", "aba"]);

function filaNaUrl(f: FiltroDaFila): ValoresDosFiltros<CampoDaFilaNaUrl> {
  return {
    etapa: f.etapa,
    vaga: f.vaga,
    modalidade: f.modalidade,
    minhas: f.responsavel === "eu" ? "sim" : "",
  };
}

/** O que veio da URL, no filtro da Fila (sem "Minhas", o responsável escolhido fica). */
function filtroDaUrl(
  parte: Partial<ValoresDosFiltros<CampoDaFilaNaUrl>>,
  atual: FiltroDaFila,
): Partial<FiltroDaFila> {
  const { minhas, etapa, ...resto } = parte;
  return {
    ...resto,
    ...(etapa === undefined ? {} : { etapa: etapa as EtapaDaFila }),
    ...(minhas === undefined
      ? {}
      : {
          responsavel: minhas
            ? "eu"
            : atual.responsavel === "eu"
              ? ""
              : atual.responsavel,
        }),
  };
}

export function Fila({ e, fila }: FilaProps) {
  const st = useSyncExternalStore(fila.assinar, fila.obter);
  const mudarNaUrl = usarLojaNaUrl(
    FILTROS_DA_FILA,
    filaNaUrl(st.filtro),
    (parte) => fila.mudarFiltro(filtroDaUrl(parte, fila.obter().filtro)),
    { manter: FICA_NA_TROCA_DE_ETAPA },
  );
  // Outra etapa passa pela URL (entrada nova); o resto, a URL acompanha.
  const mudarFiltro = (mudancas: Partial<FiltroDaFila>) => {
    const { etapa: outra, ...resto } = mudancas;
    if (outra !== undefined && outra !== fila.obter().filtro.etapa)
      mudarNaUrl({ etapa: outra });
    if (Object.keys(resto).length) fila.mudarFiltro(resto);
  };
  const [selecao, setSelecao] = useState(() => new Set<string>());
  const [acao, setAcao] = useState<AcaoPedida | null>(null);
  const [reiniciando, setReiniciando] = useState(false);
  // A gaveta do relatório abre pelo próprio estado: abrir e fechar não redesenham a lista.
  const relatorio = useRef<AberturaDoRelatorio>(null);
  const [busca, setBusca] = useState(st.filtro.busca);
  const [recolhidos, setRecolhidos] = useState(() => new Set<string>());
  // A ordem da tabela fica aqui: Anterior / Próxima da ficha seguem a mesma.
  const [ordem, setOrdem] = useState<OrdemDaTabela>({ chave: "", sentido: "" });
  const etapa = st.filtro.etapa;
  useEffect(() => setOrdem({ chave: "", sentido: "" }), [etapa]);

  useEffect(() => {
    // Outro edital, ou a lista mudou enquanto a aba estava em outro lugar: relê.
    if (fila.obter().editalId !== e.editalId || fila.estaDesatualizada())
      void fila.carregar(e.editalId);
  }, [fila, e.editalId]);
  useEffect(() => {
    // Ao sair da página, a reserva é liberada mas a ficha fica lembrada (recarregar volta a ela).
    // Sem reler: a lista não está na tela (a remontagem relê se ficou desatualizada).
    const aoSairDaPagina = () => void fila.fechar({ reler: false });
    globalThis.addEventListener?.("pagehide", aoSairDaPagina);
    return () => {
      globalThis.removeEventListener?.("pagehide", aoSairDaPagina);
      void fila.fechar({ reler: false });
    };
  }, [fila]);

  const dados = st.dados;
  // O núcleo (no lote ou com ficha viva); os de fora do lote vêm sob demanda (st.fora).
  const candidatos = useMemo(() => dados?.candidatos || [], [dados]);
  const resumoDeFora = useMemo(() => resumoForaDoLote(dados), [dados]);
  const todos = useMemo(
    () => juntarFila(candidatos, st.fora.linhas),
    [candidatos, st.fora.linhas],
  );
  /*
    Aba Eliminados (5.753 no 114/2026): 50 por vez do banco, com filtros,
    busca (300 ms depois da última tecla) e ordem aplicados lá; não lê a lista
    de fora do lote inteira. Com filtro de responsável, a lista de sempre.
  */
  const noBanco = eliminadosNoBanco(st.filtro);
  const [buscaNoBanco, setBuscaNoBanco] = useState(st.filtro.busca);
  useEffect(() => {
    const espera = setTimeout(() => setBuscaNoBanco(st.filtro.busca), 300);
    return () => clearTimeout(espera);
  }, [st.filtro.busca]);
  const filtroNoBanco = useMemo(
    () => ({
      etapa,
      vaga: st.filtro.vaga,
      modalidade: st.filtro.modalidade,
      responsavel: st.filtro.responsavel,
      busca: buscaNoBanco,
    }),
    [
      etapa,
      st.filtro.vaga,
      st.filtro.modalidade,
      st.filtro.responsavel,
      buscaNoBanco,
    ],
  );
  const buscarEliminados = useMemo<BuscarPagina<Inscrito> | null>(
    () =>
      noBanco
        ? async (apos, limite) => {
            const r = await fila.listarEliminados(
              filtroNoBanco,
              ordem,
              apos,
              limite,
            );
            return { ...r, linhas: r.linhas as Inscrito[] };
          }
        : null,
    [noBanco, fila, filtroNoBanco, ordem],
  );
  const doBanco = usarListaNoServidor(
    buscarEliminados,
    JSON.stringify([e.editalId, filtroNoBanco, ordem, resumoDeFora.versao]),
    { ativo: noBanco },
  );
  const exportarDoBanco = useCallback(
    () => void fila.exportarEliminados(filtroNoBanco, ordem),
    [fila, filtroNoBanco, ordem],
  );
  const precisaDeFora =
    precisaDoForaDoLote(etapa) && !noBanco && resumoDeFora.total > 0;
  const foraPronto = !precisaDeFora || st.fora.linhas !== null;
  useEffect(() => {
    if (precisaDeFora) void fila.carregarForaDoLote();
  }, [fila, precisaDeFora, resumoDeFora.versao]);
  const contadores = useMemo(
    () => contadoresComForaDoLote(candidatos, resumoDeFora),
    [candidatos, resumoDeFora],
  );
  const andamento = useMemo(
    () => andamentoDaFila(candidatos, dados?.vagas),
    [candidatos, dados?.vagas],
  );
  const naMemoria = useMemo(
    () => (noBanco ? [] : filtrarFila(todos, st.filtro, dados?.eu)),
    [noBanco, todos, st.filtro, dados?.eu],
  );
  // No banco, as linhas já vêm filtradas e na ordem da coluna (sem agrupar: a vaga é coluna).
  const linhas = noBanco ? (doBanco.itens as Inscrito[]) : naMemoria;
  const ordenadas = useMemo(
    () => (noBanco ? linhas : ordenarFila(linhas, ordem)),
    [noBanco, linhas, ordem],
  );
  // Todas as vagas: a tabela agrupa por vaga (o CSV sai sem agrupar, na ordem da coluna).
  const agrupada = !st.filtro.vaga && !noBanco;
  const exibidas = useMemo(
    () => (agrupada ? agruparPorVaga(ordenadas, dados?.vagas) : ordenadas),
    [agrupada, ordenadas, dados?.vagas],
  );
  const navegaveis = useMemo(
    () => exibidas.filter((c) => c.ficha?.id) as InscritoComFicha[],
    [exibidas],
  );
  const modalidades = useMemo(
    () => modalidadesDaFila(candidatos, resumoDeFora),
    [candidatos, resumoDeFora],
  );
  /*
    Os derivados que percorrem a lista inteira (até ~7.700 inscritos no
    114/2026) ficam em memória e só se refazem quando a lista (ou a vaga do
    filtro) muda: selecionar, trocar outro filtro, abrir um menu ou uma
    mensagem do estado não os recontam. Os testes de contagem estão em
    tests/modulos/avaliacao-documental-fila-renders.test.js.
  */
  const posicaoNaFila = useMemo(
    () => new Map(todos.map((c, i) => [c.id, i])),
    [todos],
  );
  // Os selecionados na ordem da fila, olhando só a seleção (não a lista toda).
  const selecionados = useMemo(
    () =>
      [...selecao]
        .map((id) => posicaoNaFila.get(id))
        .filter((i): i is number => i !== undefined)
        .sort((a, b) => a - b)
        .map((i) => todos[i]!),
    [selecao, posicaoNaFila, todos],
  );
  const acoes = useMemo(() => acoesDaSelecao(selecionados), [selecionados]);
  const coordena = Boolean(dados?.pode_coordenar);
  const noLote = useMemo(
    () => candidatos.filter((c) => c.ficha && c.ficha.situacao !== "FORA_LOTE"),
    [candidatos],
  );
  const livres = useMemo(
    () =>
      candidatos.filter(
        (c): c is InscritoComFicha =>
          c.ficha?.situacao === "PENDENTE" && !c.ficha.responsavel,
      ),
    [candidatos],
  );
  const vagaDoFiltro = st.filtro.vaga;
  const lote = useMemo(
    () => loteDaFila(candidatos, vagaDoFiltro),
    [candidatos, vagaDoFiltro],
  );

  const marcar = useCallback(
    (id: string, sim: boolean) =>
      setSelecao((atual) => {
        const nova = new Set(atual);
        if (sim) nova.add(id);
        else nova.delete(id);
        return nova;
      }),
    [],
  );
  const limparSelecao = useCallback(() => setSelecao(new Set()), []);
  // O "⋯" de uma linha: a mesma gaveta das ações em lote, com uma ficha; ou copiar.
  const aoAcaoDaLinha = useCallback(
    (tipo: AcaoDaLinhaDaFila, c: Inscrito) => {
      if (tipo !== "copiar") {
        setAcao({ tipo, fichas: [c as InscritoComFicha] });
        return;
      }
      void copiarTexto(String(c.codigo ?? "")).then((ok) =>
        ok
          ? fila.toast(`Código ${c.codigo} copiado.`, "success")
          : fila.toast("Não foi possível copiar o código.", "error"),
      );
    },
    [fila],
  );
  const hoje = useMemo(() => concluidasHoje(candidatos), [candidatos]);
  const aptas = useMemo(() => aptasDaFila(candidatos), [candidatos]);
  const ritmo = usarRitmoDoDia(fila, e.editalId);
  // O recorte da tabela: mudou (filtro, busca, ordem), ela volta à primeira página.
  const recorte = useMemo(
    () => JSON.stringify([e.editalId, st.filtro, ordem]),
    [e.editalId, st.filtro, ordem],
  );
  const vagas = dados?.vagas;
  const cargoDaVaga = useMemo(
    () =>
      Object.fromEntries((vagas || []).map((v) => [String(v.codigo), v.cargo])),
    [vagas],
  );
  // O resumo de cada vaga (lote e linha de corte) é calculado uma vez por lista.
  const resumoDaVaga = useMemo(() => {
    const feitos = new Map<string, ResumoDaVaga>();
    return (vaga: string): ResumoDaVaga => {
      if (!feitos.has(vaga))
        feitos.set(vaga, resumoDaVagaNaFila(candidatos, vaga));
      return feitos.get(vaga)!;
    };
  }, [candidatos]);
  const alternarGrupo = useCallback(
    (vaga: string) =>
      setRecolhidos((atual) => {
        const novo = new Set(atual);
        if (novo.has(vaga)) novo.delete(vaga);
        else novo.add(vaga);
        return novo;
      }),
    [],
  );
  const grupo = useMemo(
    () =>
      agrupada
        ? {
            chave: vagaDoInscrito,
            cabecalho: (vaga: string, quantos: number) => (
              <>
                <strong>{vaga}</strong>
                <span className="ui-texto-secundario">
                  {textoDoGrupo(cargoDaVaga[vaga], resumoDaVaga(vaga), quantos)}
                </span>
              </>
            ),
            recolhidos,
            aoAlternar: alternarGrupo,
          }
        : null,
    [agrupada, cargoDaVaga, resumoDaVaga, recolhidos, alternarGrupo],
  );

  if (st.erro && !dados)
    return (
      <Aviso tom="danger" papel="alert">
        Não foi possível carregar a fila: {st.erro}{" "}
        <button
          type="button"
          className="btn secondary small"
          onClick={() => void fila.carregar(e.editalId)}
        >
          Tentar novamente
        </button>
      </Aviso>
    );
  if (!dados) return <CarregandoConteudo rotulo="Carregando a fila…" />;

  // As ações da coordenação num menu só (quem não coordena não vê o menu).
  const acoesDaCoordenacao: AcaoDoMenu[] = [
    {
      id: "distribuir-livres",
      rotulo: `Distribuir as livres (${livres.length})`,
      icone: "fa-user-group",
      desabilitado: !livres.length,
      aoEscolher: () => setAcao({ tipo: "distribuir", fichas: livres }),
      dados: { "data-tour": "avd-fila-distribuir-livres" },
    },
    {
      id: "relatorio-de-motivos",
      rotulo: "Relatório de motivos",
      icone: "fa-table-list",
      aoEscolher: () => relatorio.current?.abrir(),
      dados: {
        "data-acao": "relatorio-de-motivos",
        "data-tour": "avd-fila-relatorio-de-motivos",
      },
    },
    ...(fila.ehAdminGlobal?.()
      ? [
          {
            id: "reiniciar-fichas",
            rotulo: "Pedir reinício das fichas",
            icone: "fa-rotate-left",
            desabilitado: !noLote.length || Boolean(st.acao),
            aoEscolher: () => setReiniciando(true),
            dados: { "data-acao": "reiniciar-fichas" },
          },
        ]
      : []),
    ...(dados.sem_ficha
      ? [
          {
            id: "abrir-fichas",
            rotulo: `Abrir fichas do lote (${dados.sem_ficha})`,
            icone: "fa-folder-open",
            desabilitado: Boolean(st.acao),
            aoEscolher: () => void fila.abrirFichasDoLote(),
            dados: { "data-tour": "avd-fila-abrir-fichas" },
          },
        ]
      : []),
  ];

  if (st.aberta?.ficha || st.abrindo)
    return (
      <ModoDeAnalise
        key={st.aberta?.ficha?.id || "abrindo"}
        fila={fila}
        aberta={st.aberta}
        abrindo={st.abrindo}
        dados={dados}
        inscritos={todos}
        filtroVaga={st.filtro.vaga}
        navegaveis={navegaveis}
        versoes={e.dados?.regra?.versoes}
      />
    );

  return (
    <div className="avd-fila" data-tour="avd-fila">
      <ReinicioDasFichas
        editalId={st.editalId || e.editalId}
        rpc={fila.rpc}
        admin={Boolean(fila.ehAdminGlobal?.())}
        aberto={reiniciando}
        aoAbrir={() => setReiniciando(true)}
        aoFechar={() => setReiniciando(false)}
        reiniciarDireto={fila.reiniciarFichas}
        aoReiniciar={(n) => {
          fila.toast(`${n} ficha(s) de volta ao início.`, "success");
          void fila.carregar();
        }}
      />
      <FaixaDaFila
        contadores={contadores}
        etapa={etapa}
        lote={lote}
        aptas={aptas}
        hoje={hoje}
        ritmo={ritmo}
        aoEscolher={(etapa) => mudarFiltro({ etapa })}
        rodape={
          andamento.vagas.length ? (
            <AndamentoPorVaga
              andamento={andamento}
              vaga={st.filtro.vaga}
              usuario={dados?.eu}
              aoEscolherVaga={(vaga) => mudarFiltro({ vaga })}
            />
          ) : null
        }
      />

      <CardDaLista
        rotulo="Fichas da avaliação"
        tour="avd-fila-tabela"
        className="avd-fila-tabela"
      >
        <BarraDaLista
          rotulo="Filtros da fila"
          className="avd-fila-barra avd-fila-filtros"
          tour="avd-fila-filtros"
          busca={{
            valor: busca,
            aoMudar: (valor) => {
              setBusca(valor);
              mudarFiltro({ busca: valor });
            },
            placeholder: "Buscar por código ou nome",
            rotulo:
              "Buscar pelo código ou nome (Enter com o código abre a ficha)",
            tour: "avd-fila-busca",
            aoTeclar: (ev) => {
              if (ev.key !== "Enter") return;
              const achado = fichaPeloCodigo(todos, busca);
              if (achado) void fila.abrir(achado.ficha.id);
            },
          }}
          quantos={filtrosDaFilaEmUso(st.filtro)}
          aoLimpar={() => {
            setBusca("");
            mudarFiltro({
              vaga: "",
              responsavel: "",
              modalidade: "",
              busca: "",
            });
          }}
          quantosSecundarios={st.filtro.modalidade ? 1 : 0}
          secundarios={
            <>
              <Campo rotulo="Modalidade">
                <select
                  value={st.filtro.modalidade}
                  onChange={(ev) =>
                    mudarFiltro({ modalidade: ev.target.value })
                  }
                >
                  <option value="">Todas as modalidades</option>
                  {modalidades.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Campo>
              <FiltrosSalvos
                fila={fila}
                f={st.filtro}
                filtros={dados.filtros || []}
              />
            </>
          }
          acoes={
            <>
              {coordena ? (
                <MenuDeAcoes
                  compacto
                  rotulo="Ações da coordenação"
                  tour="avd-fila-acoes-coordenacao"
                  acoes={acoesDaCoordenacao}
                />
              ) : null}
              {dados.pode_pegar ? (
                <button
                  type="button"
                  className="btn"
                  data-tour="avd-fila-pegar"
                  data-acao="pegar-proximo"
                  disabled={st.abrindo}
                  onClick={() => void fila.pegarProxima(st.filtro.vaga)}
                >
                  Pegar próxima ficha{" "}
                  <i className="fa-solid fa-arrow-right" aria-hidden="true" />
                </button>
              ) : null}
            </>
          }
        >
          <select
            aria-label="Vaga"
            value={st.filtro.vaga}
            onChange={(ev) => mudarFiltro({ vaga: ev.target.value })}
          >
            <option value="">Todas as vagas</option>
            {(dados.vagas || []).map((v) => (
              <option key={v.codigo} value={v.codigo}>
                {[v.codigo, v.cargo].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
          <select
            aria-label="Responsável"
            value={st.filtro.responsavel}
            onChange={(ev) => mudarFiltro({ responsavel: ev.target.value })}
          >
            <option value="">Qualquer responsável</option>
            {dados.eu ? <option value="eu">Minhas fichas</option> : null}
            <option value="ninguem">Sem responsável</option>
            {(dados.analistas || []).map((a) => (
              <option key={a.usuario} value={a.usuario}>
                {a.nome}
              </option>
            ))}
          </select>
        </BarraDaLista>

        {coordena && selecionados.length ? (
          <div
            className="ui-lista-selecao"
            data-tour="avd-fila-acoes-lote"
            role="toolbar"
            aria-label="Ações nas fichas selecionadas"
          >
            <strong>
              {formatNumberBR(selecionados.length)}{" "}
              {selecionados.length === 1 ? "selecionada" : "selecionadas"}
            </strong>
            <button
              type="button"
              className="btn contorno small"
              data-acao="distribuir-selecionadas"
              disabled={!acoes.distribuir.length}
              onClick={() =>
                setAcao({ tipo: "distribuir", fichas: acoes.distribuir })
              }
            >
              Atribuir a…
            </button>
            <button
              type="button"
              className="btn contorno small"
              data-acao="liberar-reservas"
              disabled={!acoes.liberar.length}
              onClick={() =>
                setAcao({ tipo: "liberar", fichas: acoes.liberar })
              }
            >
              Liberar
            </button>
            <button
              type="button"
              className="btn contorno small"
              data-acao="mandar-para-revisao"
              disabled={!acoes.revisao.length}
              onClick={() =>
                setAcao({ tipo: "revisao", fichas: acoes.revisao })
              }
            >
              Mandar para revisão
            </button>
            <button
              type="button"
              className="btn contorno small"
              data-acao="reabrir-selecionadas"
              disabled={!acoes.reabrir.length}
              onClick={() =>
                setAcao({ tipo: "reabrir", fichas: acoes.reabrir })
              }
            >
              Reabrir
            </button>
            <button
              type="button"
              className="btn ghost small"
              data-acao="limpar-selecao"
              onClick={limparSelecao}
            >
              Limpar seleção
            </button>
          </div>
        ) : null}

        <TabelaDaFila
          etapa={st.filtro.etapa}
          abrindo={st.abrindo}
          eu={dados.eu}
          fila={fila}
          linhas={linhas}
          ordenadas={ordenadas}
          exibidas={exibidas}
          ordem={ordem}
          setOrdem={setOrdem}
          carregado={noBanco ? doBanco.carregado : foraPronto}
          erroDeFora={
            noBanco ? doBanco.erro : precisaDeFora ? st.fora.erro : ""
          }
          servidor={noBanco ? doBanco : null}
          aoExportar={noBanco ? exportarDoBanco : null}
          aoTentarDeNovo={noBanco ? doBanco.recarregar : null}
          semPreClassificacao={!candidatos.length && !resumoDeFora.total}
          coordena={coordena}
          selecao={selecao}
          marcar={marcar}
          recorte={recorte}
          // A tabela trata null como sem grupo (o padrão dela).
          grupo={grupo as GrupoDaTabela}
          aoAcao={aoAcaoDaLinha}
        />
      </CardDaLista>

      <RelatorioDeMotivosDaFila
        ref={relatorio}
        coordena={coordena}
        editalId={st.editalId || e.editalId}
        edital={dados.edital?.rotulo}
        regra={e.dados?.regra?.configuracao}
        vagas={dados.vagas}
        analistas={dados.analistas}
        rpc={fila.rpc}
      />
      {acao ? (
        <AcaoEmLote
          key={`${acao.tipo}:${acao.fichas.length}`}
          fila={fila}
          acao={acao}
          dados={dados}
          aoFechar={(feito: boolean) => {
            setAcao(null);
            if (feito) setSelecao(new Set());
          }}
        />
      ) : null}
    </div>
  );
}
