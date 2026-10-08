import type { FormEvent } from "react";
import type {
  Aviso,
  Caso,
  EstadoDosAvisos,
  SnapshotDosAvisos,
  ConsultaDeCasos,
  ListaDeAvisosNormalizada,
  ClienteDosAvisos,
  AbrirCaso,
  OpcoesDeAbrirCaso,
} from "./tipos.ts";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { pedirFiltro } from "../../app/pedido-de-filtro.js";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { Icone } from "../../componentes/icone.jsx";
import {
  casosRestantes,
  contagemPorModulo,
  destinoDoCaso,
  diaDoAviso,
  erroDoMotivo,
  filtrarPorModulo,
  juntarPaginasDeCasos,
  LIMITES_DO_MOTIVO,
  linhaDoVinculo,
  MODULOS_DOS_AVISOS,
  ondeDoCaso,
  quemDoCaso,
  termoDeBusca,
  tomDoSelo,
  VIEW_DO_MODULO,
} from "../../lib/avisos-de-conferencia.ts";
import { mensagemDeFalha } from "../../lib/falha-de-rede.js";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { formatNumberBR } from "../../lib/formatters.js";
import { Gaveta, Segmentado } from "../../ui/index.js";
import { criarEstadoDosAvisos } from "./estado.ts";

declare global {
  interface Window {
    navigate?: (view: string) => unknown;
  }
}
type PropsDoEstado = { estado: EstadoDosAvisos; aoAbrirCaso?: AbrirCaso };
type PropsDoAviso = PropsDoEstado & { aviso: Aviso };
type PropsDoCartao = {
  supabase?: ClienteDosAvisos | null;
  estado?: EstadoDosAvisos;
  aoAbrirCaso?: AbrirCaso;
};
interface PaginaNaTela {
  status: "carregando" | "erro" | "pronto" | "mais";
  casos: Caso[];
  total: number;
  erro: string;
}
const erroDaConsulta = (falha: unknown): string => {
  if (
    falha &&
    typeof falha === "object" &&
    "message" in falha &&
    typeof falha.message === "string" &&
    falha.message
  )
    return falha.message;
  return mensagemDeFalha(falha);
};

/*
  Avisos de conferência (job Python scripts/conferencias/, todo dia às 6h).

    CartaoDeAvisos   Configurações › Status das atualizações (administrador
                     global): todos os módulos, com o filtro por módulo.
    SeloDeAvisos     no topo de Análises, Entrevistas, Classificação e Lista
                     de aprovados: a contagem dos avisos abertos daquele
                     módulo na área atual; some quando não há aviso. Clicar
                     abre a gaveta com a lista filtrada.

  Cada aviso: gravidade, título, onde (edital, área ou vaga), o resumo do job,
  desde quando e os casos — todos, em páginas, com busca por código ou nome e
  CSV (listar_casos_aviso_conferencia). Cada caso mostra quem é (código e
  nome), onde (edital, vaga, situação, responsável), o motivo (datas, notas)
  e, no aprovado, as vagas da pessoa; clicar leva à tela do módulo já no caso
  (análise, aprovado, entrevista; src/lib destinoDoCaso). No topo da lista, a
  busca em todos os avisos. Quem administra o módulo (ou o administrador
  global) ignora com motivo; o ignorado volta sozinho se a quantidade crescer.
  As regras puras: src/lib/avisos-de-conferencia.ts.
*/

const ESPERA_DA_BUSCA_MS = 300;

function usarEstado(estado: EstadoDosAvisos) {
  return useSyncExternalStore(estado.assinar, estado.obter);
}

function usarComEspera(valor: string, ms: number) {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}

/**
 * Leva a tela do módulo ao caso (destinoDoCaso): o Painel das análises na
 * análise, a Lista de aprovados nas vagas da pessoa, Entrevistas no candidato.
 */
export function abrirCaso(
  caso: Caso,
  {
    navegar = true,
    pedir = pedirFiltro,
    ir = (view: string) => globalThis.window?.navigate?.(view),
  }: OpcoesDeAbrirCaso = {},
) {
  const destino = destinoDoCaso(caso);
  if (!destino) return;
  pedir(destino.view, destino.filtro);
  if (navegar) ir(destino.view);
}

const TITULOS_DO_DESTINO = Object.freeze({
  analises: "Abrir no Painel das análises",
  approved: "Abrir na Lista de aprovados",
  entrevistas: "Abrir em Entrevistas",
  classificacao: "Abrir na Classificação",
});

/*
  As páginas de casos de um aviso (ou da busca em todos): a primeira quando o
  aviso ou a busca muda; "Mostrar mais" pede a seguinte. Resposta atrasada de
  uma busca antiga é descartada.
*/
function usarCasos(
  estado: EstadoDosAvisos,
  { avisoId = null, busca = "" }: ConsultaDeCasos,
) {
  const [lista, setLista] = useState<PaginaNaTela>({
    status: "carregando",
    casos: [],
    total: 0,
    erro: "",
  });
  const pedido = useRef(0);
  const termo = termoDeBusca(busca);

  useEffect(() => {
    const meu = ++pedido.current;
    setLista({ status: "carregando", casos: [], total: 0, erro: "" });
    estado
      .listarCasos({ avisoId, busca: termo })
      .then(({ casos, total }) => {
        if (meu === pedido.current)
          setLista({ status: "pronto", casos, total, erro: "" });
      })
      .catch((falha: unknown) => {
        if (meu === pedido.current)
          setLista({
            status: "erro",
            casos: [],
            total: 0,
            erro: erroDaConsulta(falha),
          });
      });
  }, [estado, avisoId, termo]);

  const carregarMais = useCallback(() => {
    const meu = pedido.current;
    setLista((atual) => ({ ...atual, status: "mais" }));
    estado
      .listarCasos({ avisoId, busca: termo, deslocamento: lista.casos.length })
      .then(({ casos, total }) => {
        if (meu === pedido.current)
          setLista((atual) => ({
            status: "pronto",
            casos: juntarPaginasDeCasos(atual.casos, casos),
            total,
            erro: "",
          }));
      })
      .catch((falha: unknown) => {
        if (meu === pedido.current)
          setLista((atual) => ({
            ...atual,
            status: "pronto",
            erro: erroDaConsulta(falha),
          }));
      });
  }, [estado, avisoId, termo, lista.casos.length]);

  return { ...lista, carregarMais };
}

function ItemDoCaso({
  caso,
  mostrarAviso,
  aoAbrir,
}: {
  caso: Caso;
  mostrarAviso?: boolean;
  aoAbrir?: AbrirCaso;
}) {
  const destino = aoAbrir ? destinoDoCaso(caso) : null;
  const onde = ondeDoCaso(caso);
  const conteudo = (
    <>
      <span className="conf-caso__quem">{quemDoCaso(caso)}</span>
      {mostrarAviso ? (
        <span className="conf-caso__aviso">{caso.titulo}</span>
      ) : null}
      {onde ? <span className="conf-caso__onde">{onde}</span> : null}
      {caso.motivo ? (
        <span className="conf-caso__motivo">{caso.motivo}</span>
      ) : null}
      {caso.analises.length ? (
        <span className="conf-caso__analises">
          {caso.analises.map((a) => (
            <span key={a.id || `${a.edital}:${a.vaga}`}>
              {[a.edital, a.vaga, a.status].filter(Boolean).join(" · ")}
            </span>
          ))}
          {caso.foraDoAcesso ? (
            <span>
              + {caso.foraDoAcesso}{" "}
              {caso.foraDoAcesso === 1 ? "análise" : "análises"} fora do seu
              acesso
            </span>
          ) : null}
        </span>
      ) : null}
      {caso.vinculos.length ? (
        <span className="conf-caso__analises">
          {caso.vinculos.map((v) => (
            <span key={v.id || linhaDoVinculo(v)}>{linhaDoVinculo(v)}</span>
          ))}
          {caso.foraDoAcesso ? (
            <span>
              + {caso.foraDoAcesso} {caso.foraDoAcesso === 1 ? "vaga" : "vagas"}{" "}
              fora do seu acesso
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );
  return (
    <li>
      {destino ? (
        <button
          type="button"
          className="conf-caso conf-caso--clicavel"
          onClick={() => aoAbrir?.(caso)}
          title={TITULOS_DO_DESTINO[destino.view]}
        >
          {conteudo}
        </button>
      ) : (
        <div className="conf-caso">{conteudo}</div>
      )}
    </li>
  );
}

/** Os casos (de um aviso ou da busca em todos), em páginas. */
function ListaDeCasos({
  estado,
  avisoId,
  busca,
  mostrarAviso,
  aoAbrirCaso,
  exemplos = [],
}: PropsDoEstado &
  ConsultaDeCasos & { mostrarAviso?: boolean; exemplos?: readonly string[] }) {
  const casos = usarCasos(estado, { avisoId, busca });
  if (casos.status === "carregando")
    return (
      <p className="conf-vazio" role="status">
        Consultando os casos…
      </p>
    );
  if (casos.status === "erro")
    return (
      <p className="conf-vazio" role="alert">
        {casos.erro}
      </p>
    );
  if (!casos.casos.length) {
    // Aviso gravado antes dos casos (job antigo): ficam os exemplos.
    if (!termoDeBusca(busca) && exemplos.length)
      return (
        <ul className="conf-aviso__exemplos" aria-label="Exemplos">
          {exemplos.map((e) => (
            <li key={e}>
              <code>{e}</code>
            </li>
          ))}
        </ul>
      );
    return (
      <p className="conf-vazio" role="status">
        {termoDeBusca(busca) ? "Nenhum caso com essa busca." : "Sem casos."}
      </p>
    );
  }
  const restam = casosRestantes(casos.casos, casos.total);
  return (
    <div className="conf-casos">
      <small className="conf-casos__total" role="status">
        {formatNumberBR(casos.casos.length)} de {formatNumberBR(casos.total)}
      </small>
      <ul className="conf-casos__lista" aria-label="Casos">
        {casos.casos.map((caso) => (
          <ItemDoCaso
            key={caso.chave}
            caso={caso}
            mostrarAviso={mostrarAviso}
            aoAbrir={aoAbrirCaso}
          />
        ))}
      </ul>
      {casos.erro ? (
        <small className="conf-ignorar__erro" role="alert">
          {casos.erro}
        </small>
      ) : null}
      {restam ? (
        <button
          type="button"
          className="btn secondary conf-botao"
          disabled={casos.status === "mais"}
          onClick={casos.carregarMais}
        >
          {casos.status === "mais"
            ? "Carregando…"
            : `Mostrar mais (${formatNumberBR(restam)})`}
        </button>
      ) : null}
    </div>
  );
}

function BotaoDeCsv({
  estado,
  aviso = null,
  busca = "",
}: PropsDoEstado & { aviso?: Aviso | null; busca?: string }) {
  const [exportando, setExportando] = useState(false);
  const [erro, setErro] = useState("");
  async function exportar() {
    setExportando(true);
    setErro("");
    try {
      if (!(await estado.exportarCasos({ aviso, busca })))
        setErro("Nenhum caso para exportar.");
    } catch (falha) {
      setErro(erroDaConsulta(falha));
    } finally {
      setExportando(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="btn secondary conf-botao"
        disabled={exportando}
        onClick={() => void exportar()}
      >
        {exportando ? "Exportando…" : "Exportar CSV"}
      </button>
      {erro ? (
        <small className="conf-ignorar__erro" role="alert">
          {erro}
        </small>
      ) : null}
    </>
  );
}

function CasosDoAviso({ aviso, estado, aoAbrirCaso }: PropsDoAviso) {
  const [digitado, setDigitado] = useState("");
  const busca = usarComEspera(digitado, ESPERA_DA_BUSCA_MS);
  const id = useId();
  return (
    <div className="conf-aviso__casos">
      <div className="conf-casos__barra">
        <label htmlFor={id} className="sr-only">
          Buscar nos casos
        </label>
        <input
          id={id}
          type="search"
          className="conf-casos__busca"
          placeholder="Código ou nome"
          value={digitado}
          maxLength={80}
          onChange={(e) => setDigitado(e.target.value)}
        />
        <BotaoDeCsv estado={estado} aviso={aviso} busca="" />
      </div>
      <ListaDeCasos
        estado={estado}
        avisoId={aviso.id}
        busca={busca}
        aoAbrirCaso={aoAbrirCaso}
        exemplos={aviso.exemplos}
      />
    </div>
  );
}

function FormularioDeIgnorar({
  aviso,
  estado,
  ignorando,
  erro,
  aoCancelar,
}: PropsDoAviso & {
  ignorando: string | null;
  erro: string;
  aoCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [tocado, setTocado] = useState(false);
  const id = useId();
  const problema = erroDoMotivo(motivo);
  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setTocado(true);
    if (problema) return;
    if (await estado.ignorar(aviso.id, motivo)) aoCancelar();
  }
  return (
    <form className="conf-ignorar" onSubmit={confirmar}>
      <label htmlFor={id}>Motivo para ignorar</label>
      <textarea
        id={id}
        rows={2}
        maxLength={LIMITES_DO_MOTIVO.maximo}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        onBlur={() => setTocado(true)}
        aria-invalid={tocado && Boolean(problema)}
      />
      {(tocado && problema) || erro ? (
        <small className="conf-ignorar__erro" role="alert">
          {(tocado && problema) || erro}
        </small>
      ) : null}
      <div className="conf-ignorar__acoes">
        <button type="button" className="btn secondary" onClick={aoCancelar}>
          Cancelar
        </button>
        <button type="submit" className="btn" disabled={ignorando === aviso.id}>
          {ignorando === aviso.id ? "Ignorando…" : "Ignorar aviso"}
        </button>
      </div>
    </form>
  );
}

function ItemDoAviso({
  aviso,
  estado,
  atual,
  mostrarModulo,
  aoAbrirCaso,
}: PropsDoAviso & { atual: SnapshotDosAvisos; mostrarModulo?: boolean }) {
  const [casos, setCasos] = useState(false);
  const [ignorar, setIgnorar] = useState(false);
  const modulo = MODULOS_DOS_AVISOS.find((m) => m.valor === aviso.modulo);
  return (
    <li
      className={`conf-aviso conf-aviso--${aviso.tom}`}
      data-conferencia={aviso.conferencia}
    >
      <div className="conf-aviso__topo">
        <span className={`conf-selo conf-selo--${aviso.tom}`}>
          {aviso.rotuloDaGravidade}
        </span>
        <strong>{aviso.titulo}</strong>
        <span className="conf-aviso__onde">
          {mostrarModulo && modulo ? `${modulo.rotulo} · ` : ""}
          {aviso.onde}
        </span>
      </div>
      <p className="conf-aviso__resumo">{aviso.resumo}</p>
      <div className="conf-aviso__rodape">
        <small>
          {aviso.situacao === "IGNORADO"
            ? `Ignorado em ${diaDoAviso(aviso.ignoradoEm)}: ${aviso.motivo}`
            : `Desde ${diaDoAviso(aviso.primeiraVez)}`}
        </small>
        <button
          type="button"
          className="btn secondary conf-botao"
          aria-expanded={casos}
          onClick={() => setCasos((v) => !v)}
        >
          <Icone nome={casos ? "chevron-up" : "chevron-down"} tamanho={14} />
          {formatNumberBR(aviso.quantidade)}{" "}
          {aviso.quantidade === 1 ? "caso" : "casos"}
        </button>
        {aviso.podeIgnorar && !ignorar ? (
          <button
            type="button"
            className="btn secondary conf-botao"
            onClick={() => setIgnorar(true)}
          >
            Ignorar
          </button>
        ) : null}
      </div>
      {casos ? (
        <CasosDoAviso aviso={aviso} estado={estado} aoAbrirCaso={aoAbrirCaso} />
      ) : null}
      {ignorar ? (
        <FormularioDeIgnorar
          aviso={aviso}
          estado={estado}
          ignorando={atual.ignorando}
          erro={atual.erroAoIgnorar}
          aoCancelar={() => setIgnorar(false)}
        />
      ) : null}
    </li>
  );
}

/** A busca em todos os avisos do recorte (código ou nome do candidato). */
function BuscaNosAvisos({
  valor,
  aoMudar,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  const id = useId();
  return (
    <div className="conf-busca">
      <label htmlFor={id} className="sr-only">
        Buscar candidato em todos os avisos
      </label>
      <Icone nome="search" tamanho={14} />
      <input
        id={id}
        type="search"
        placeholder="Buscar candidato em todos os avisos (código ou nome)"
        value={valor}
        maxLength={80}
        onChange={(e) => aoMudar(e.target.value)}
      />
    </div>
  );
}

/** A lista de avisos (abertos e, recolhidos, os ignorados), com a busca em todos. */
export function ListaDeAvisos({
  estado,
  lista,
  mostrarModulo = false,
  aoAbrirCaso = abrirCaso,
}: PropsDoEstado & {
  lista: ListaDeAvisosNormalizada | null;
  mostrarModulo?: boolean;
}) {
  const atual = usarEstado(estado);
  const [verIgnorados, setVerIgnorados] = useState(false);
  const [digitado, setDigitado] = useState("");
  const busca = termoDeBusca(usarComEspera(digitado, ESPERA_DA_BUSCA_MS));
  if (atual.status === "error")
    return (
      <p className="conf-vazio" role="alert">
        {atual.erroCodigo === "PGRST202"
          ? "O banco ainda não tem os avisos. Aplique a migration 20261005210000_conferencias_de_consistencia.sql."
          : atual.erro}
      </p>
    );
  if (!lista)
    return (
      <p className="conf-vazio" role="status">
        Consultando os avisos…
      </p>
    );
  const temAvisos = lista.abertos.length + lista.ignorados.length > 0;
  return (
    <>
      {temAvisos ? (
        <BuscaNosAvisos valor={digitado} aoMudar={setDigitado} />
      ) : null}
      {temAvisos && busca ? (
        <div className="conf-resultados">
          <div className="conf-casos__barra">
            <strong>Casos com “{busca}”</strong>
            <BotaoDeCsv estado={estado} busca={busca} />
          </div>
          <ListaDeCasos
            estado={estado}
            busca={busca}
            mostrarAviso
            aoAbrirCaso={aoAbrirCaso}
          />
        </div>
      ) : (
        <>
          {lista.abertos.length ? (
            <ul className="conf-lista">
              {lista.abertos.map((aviso) => (
                <ItemDoAviso
                  key={aviso.id}
                  aviso={aviso}
                  estado={estado}
                  atual={atual}
                  mostrarModulo={mostrarModulo}
                  aoAbrirCaso={aoAbrirCaso}
                />
              ))}
            </ul>
          ) : (
            <p className="conf-vazio" role="status">
              <Icone nome="circle-check" tamanho={16} /> Nenhum aviso aberto.
            </p>
          )}
          {lista.ignorados.length ? (
            <div className="conf-ignorados">
              <button
                type="button"
                className="btn secondary conf-botao"
                aria-expanded={verIgnorados}
                onClick={() => setVerIgnorados((v) => !v)}
              >
                <Icone
                  nome={verIgnorados ? "chevron-up" : "chevron-down"}
                  tamanho={14}
                />
                Ignorados ({lista.ignorados.length})
              </button>
              {verIgnorados ? (
                <ul className="conf-lista">
                  {lista.ignorados.map((aviso) => (
                    <ItemDoAviso
                      key={aviso.id}
                      aviso={aviso}
                      estado={estado}
                      atual={atual}
                      mostrarModulo={mostrarModulo}
                      aoAbrirCaso={aoAbrirCaso}
                    />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </>
  );
}

/** Configurações › Status das atualizações: todos os avisos, com filtro por módulo. */
export function CartaoDeAvisos({
  supabase = getSupabaseClient(),
  estado: externo,
  aoAbrirCaso,
}: PropsDoCartao) {
  const estado = useMemo(
    () => externo || criarEstadoDosAvisos({ supabase }),
    [externo, supabase],
  );
  const atual = usarEstado(estado);
  const [modulo, setModulo] = useState("todos");
  useEffect(() => {
    void estado.carregar();
  }, [estado]);
  const contagem = contagemPorModulo(atual.lista);
  const opcoes = [
    { valor: "todos", rotulo: `Todos (${atual.lista?.abertos.length ?? 0})` },
    ...MODULOS_DOS_AVISOS.map((m) => ({
      valor: m.valor,
      rotulo: `${m.rotulo} (${contagem[m.valor]})`,
    })),
  ];
  const ultima = atual.lista?.ultimaExecucao;
  return (
    <section className="conf-cartao" aria-labelledby="conf-cartao-titulo">
      <div className="conf-cartao__topo">
        <h3 id="conf-cartao-titulo">Avisos de conferência</h3>
        {ultima ? (
          <small className="status-discreto">
            Conferido em {diaDoAviso(ultima.fim || ultima.inicio)}
          </small>
        ) : null}
      </div>
      {atual.lista ? (
        <Segmentado
          rotulo="Módulo dos avisos"
          className="conf-filtro"
          opcoes={opcoes}
          valor={modulo}
          aoMudar={setModulo}
        />
      ) : null}
      <ListaDeAvisos
        estado={estado}
        lista={filtrarPorModulo(atual.lista, modulo)}
        mostrarModulo={modulo === "todos"}
        {...(aoAbrirCaso ? { aoAbrirCaso } : {})}
      />
    </section>
  );
}

const NOMES_DOS_MODULOS = Object.fromEntries(
  MODULOS_DOS_AVISOS.map((m) => [m.valor, m.rotulo]),
);

/** Selo no topo de uma tela: os avisos abertos do módulo na área atual. */
export function SeloDeAvisos({
  modulo,
  supabase = getSupabaseClient(),
  estado: externo,
  aoAbrirCaso = abrirCaso,
}: PropsDoCartao & { modulo: string }) {
  const { area } = usarAreaAtual();
  const estado = useMemo(
    () => externo || criarEstadoDosAvisos({ supabase }),
    [externo, supabase],
  );
  const atual = usarEstado(estado);
  const [aberta, setAberta] = useState(false);
  const tituloId = useId();
  useEffect(() => {
    if (area) void estado.carregar({ area, modulo });
  }, [estado, area, modulo]);
  const abertos = atual.lista?.abertos || [];
  if (!abertos.length && !aberta) return null;
  const tom = tomDoSelo(abertos) || "info";
  // Caso que leva à própria tela só recorta a tela (sem navegar).
  const abrirNoModulo = (caso: Caso) => {
    setAberta(false);
    aoAbrirCaso(caso, {
      navegar: destinoDoCaso(caso)?.view !== VIEW_DO_MODULO[modulo],
    });
  };
  return (
    <>
      <button
        type="button"
        className={`btn secondary conf-selo-do-modulo conf-selo-do-modulo--${tom}`}
        data-modulo={modulo}
        onClick={() => setAberta(true)}
      >
        <Icone nome="triangle-alert" tamanho={14} />
        {abertos.length} {abertos.length === 1 ? "aviso" : "avisos"}
      </button>
      {aberta ? (
        <Gaveta
          tituloId={tituloId}
          sobretitulo={NOMES_DOS_MODULOS[modulo]}
          titulo="Avisos de conferência"
          rotuloDoFechar="Fechar os avisos"
          aoFechar={() => setAberta(false)}
          cartaoClassName="conf-gaveta"
        >
          <div className="conf-gaveta__corpo">
            <ListaDeAvisos
              estado={estado}
              lista={atual.lista}
              aoAbrirCaso={abrirNoModulo}
            />
          </div>
        </Gaveta>
      ) : null}
    </>
  );
}
