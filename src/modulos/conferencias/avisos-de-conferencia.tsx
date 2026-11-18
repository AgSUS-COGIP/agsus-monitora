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
  EvidenciaDoAviso,
  HistoricoDoAviso,
  PessoaResponsavel,
  Tratamento,
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
import { pedirFiltro } from "../../app/pedido-de-filtro.ts";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { Icone } from "../../componentes/icone.tsx";
import {
  agruparPorEdital,
  casosRestantes,
  chaveDoCaso,
  contagemPorModulo,
  destinoDoCaso,
  diaDoAviso,
  diaDoCaso,
  erroDaEvidencia,
  erroDoMotivoDoTratamento,
  filtrarPorModulo,
  hojeEmBrasilia,
  juntarPaginasDeCasos,
  LIMITES_DO_MOTIVO,
  linhaDoVinculo,
  MODULOS_DOS_AVISOS,
  ondeDoCaso,
  opcoesDeTratamento,
  prazoVencido,
  quemDoCaso,
  termoDeBusca,
  tomDoSelo,
  TRATAMENTOS,
  VIEW_DO_MODULO,
} from "../../lib/conferencias/avisos-de-conferencia.ts";
import { mensagemDeFalha } from "../../lib/carga/falha-de-rede";
import { getSupabaseClient } from "../../lib/sessao/supabaseClient";
import { formatNumberBR } from "../../lib/base/formatters";
import {
  Campo,
  Gaveta,
  Segmentado,
  Selo,
  SeloDePrazo,
} from "../../ui/index.ts";
import { BotoesDeExportacao } from "../../ui/botoes-de-exportacao.tsx";
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
  busca em todos os avisos. A central de avisos (20261118140000): os abertos
  agrupados por edital; cada aviso com a situação da equipe (em análise,
  aguardando documento, corrigido, dispensado com justificativa; "rechecado sem
  problema" é da conferência), responsável e prazo (vencido em destaque), a
  última rechecagem, evidências (do aviso ou de um caso) e o histórico, que não
  se apaga. Quem administra o módulo (ou o administrador global) dispensa e
  atribui; o responsável também trata e junta evidência.
  As regras puras: src/lib/conferencias/avisos-de-conferencia.ts.
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
  aoJuntarEvidencia,
}: {
  caso: Caso;
  mostrarAviso?: boolean;
  aoAbrir?: AbrirCaso;
  aoJuntarEvidencia?: ((caso: Caso) => void) | undefined;
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
      {aoJuntarEvidencia && chaveDoCaso(caso) ? (
        <button
          type="button"
          className="btn secondary conf-botao conf-caso__evidencia"
          onClick={() => aoJuntarEvidencia(caso)}
        >
          Evidência
        </button>
      ) : null}
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
  aoJuntarEvidencia,
  exemplos = [],
}: PropsDoEstado &
  ConsultaDeCasos & {
    mostrarAviso?: boolean;
    exemplos?: readonly string[];
    aoJuntarEvidencia?: ((caso: Caso) => void) | undefined;
  }) {
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
            aoJuntarEvidencia={aoJuntarEvidencia}
          />
        ))}
      </ul>
      {casos.erro ? (
        <small className="conf-erro" role="alert">
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

/* "Exportar em Excel" e "Salvar em PDF" dos casos (do aviso ou da busca geral). */
function ExportarCasos({
  estado,
  aviso = null,
  busca = "",
}: PropsDoEstado & { aviso?: Aviso | null; busca?: string }) {
  const [erro, setErro] = useState("");
  async function exportar(formato: "excel" | "pdf") {
    setErro("");
    try {
      if (!(await estado.exportarCasos({ aviso, busca, formato })))
        setErro("Nenhum caso para exportar.");
    } catch (falha) {
      setErro(erroDaConsulta(falha));
    }
  }
  return (
    <>
      <BotoesDeExportacao
        pequenos
        excel={() => exportar("excel")}
        pdf={() => exportar("pdf")}
      />
      {erro ? (
        <small className="conf-erro" role="alert">
          {erro}
        </small>
      ) : null}
    </>
  );
}

function CasosDoAviso({
  aviso,
  estado,
  aoAbrirCaso,
  aoJuntarEvidencia,
}: PropsDoAviso & { aoJuntarEvidencia?: ((caso: Caso) => void) | undefined }) {
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
        <ExportarCasos estado={estado} aviso={aviso} busca="" />
      </div>
      <ListaDeCasos
        estado={estado}
        avisoId={aviso.id}
        busca={busca}
        aoAbrirCaso={aoAbrirCaso}
        aoJuntarEvidencia={aoJuntarEvidencia}
        exemplos={aviso.exemplos}
      />
    </div>
  );
}

function SeloDoTratamento({ aviso }: { aviso: Aviso }) {
  const t = TRATAMENTOS[aviso.tratamento];
  return (
    <Selo
      tom={t.tom}
      className="conf-tratamento"
      dados={{ tratamento: aviso.tratamento }}
    >
      {t.rotulo}
    </Selo>
  );
}

/**
  Responsável, prazo (vencido em destaque, e o selo de quanto falta enquanto
  o aviso está aberto), evidências e a última rechecagem.
*/
function DetalhesDoAviso({ aviso }: { aviso: Aviso }) {
  const hoje = hojeEmBrasilia();
  const vencido = prazoVencido(aviso.prazo, hoje);
  const partes = [
    aviso.situacao === "RESOLVIDO"
      ? `Resolvido em ${diaDoAviso(aviso.resolvidoEm)}`
      : `Desde ${diaDoAviso(aviso.primeiraVez)} · rechecado em ${diaDoAviso(aviso.ultimaVez)}`,
    aviso.responsavel ? `Resp. ${aviso.responsavel}` : "",
    aviso.evidencias
      ? `${aviso.evidencias} ${aviso.evidencias === 1 ? "evidência" : "evidências"}`
      : "",
  ].filter(Boolean);
  return (
    <small className="conf-aviso__detalhes">
      {partes.join(" · ")}
      {aviso.prazo ? (
        <span
          className={vencido ? "conf-prazo conf-prazo--vencido" : "conf-prazo"}
        >
          {" · "}até {diaDoCaso(aviso.prazo)}
        </span>
      ) : null}
      {aviso.prazo &&
      aviso.situacao !== "RESOLVIDO" &&
      aviso.tratamento !== "DISPENSADO" ? (
        <>
          {" "}
          <SeloDePrazo
            data={aviso.prazo}
            hoje={hoje}
            diaFormatado={diaDoCaso(aviso.prazo)}
          />
        </>
      ) : null}
    </small>
  );
}

/** Mudar a situação do aviso; o gestor também atribui responsável e prazo. */
function PainelDoTratamento({
  aviso,
  estado,
  atual,
  aoFechar,
}: PropsDoAviso & { atual: SnapshotDosAvisos; aoFechar: () => void }) {
  const opcoes = opcoesDeTratamento(aviso);
  const [tratamento, setTratamento] = useState<Tratamento>(
    opcoes.includes(aviso.tratamento)
      ? aviso.tratamento
      : (opcoes[0] ?? "EM_ANALISE"),
  );
  const [motivo, setMotivo] = useState("");
  const [tocado, setTocado] = useState(false);
  const [responsavel, setResponsavel] = useState(aviso.responsavelId || "");
  const [prazo, setPrazo] = useState(aviso.prazo || "");
  const [pessoas, setPessoas] = useState<PessoaResponsavel[] | null>(null);
  const [erroDasPessoas, setErroDasPessoas] = useState("");
  const problema = erroDoMotivoDoTratamento(tratamento, motivo);
  const agindo = atual.agindo === aviso.id;

  useEffect(() => {
    if (!aviso.podeGerir) return;
    let vivo = true;
    estado
      .responsaveis(aviso.id)
      .then((lista) => {
        if (vivo) setPessoas(lista);
      })
      .catch((falha: unknown) => {
        if (vivo) setErroDasPessoas(erroDaConsulta(falha));
      });
    return () => {
      vivo = false;
    };
  }, [estado, aviso.id, aviso.podeGerir]);

  async function salvarSituacao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setTocado(true);
    if (problema) return;
    if (await estado.tratar(aviso.id, tratamento, motivo)) aoFechar();
  }
  async function salvarResponsavel(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (await estado.atribuir(aviso.id, responsavel || null, prazo || null))
      aoFechar();
  }
  const rotuloDoMotivo =
    tratamento === "DISPENSADO"
      ? "Justificativa"
      : tratamento === "EM_ANALISE"
        ? "Observação"
        : "Motivo";
  const atualFora =
    aviso.responsavelId &&
    pessoas &&
    !pessoas.some((p) => p.id === aviso.responsavelId);
  return (
    <div className="conf-painel">
      <form className="conf-form" onSubmit={salvarSituacao}>
        <Campo rotulo="Situação">
          <select
            value={tratamento}
            onChange={(e) => {
              const escolhido = opcoes.find((t) => t === e.target.value);
              if (escolhido) setTratamento(escolhido);
            }}
          >
            {opcoes.map((t) => (
              <option key={t} value={t}>
                {TRATAMENTOS[t].rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo
          rotulo={rotuloDoMotivo}
          obrigatorio={tratamento !== "EM_ANALISE"}
          erro={tocado && problema ? problema : undefined}
        >
          <textarea
            rows={2}
            maxLength={LIMITES_DO_MOTIVO.maximo}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            onBlur={() => setTocado(true)}
          />
        </Campo>
        <div className="conf-form__acoes">
          <button type="submit" className="btn" disabled={agindo}>
            {agindo ? "Salvando…" : "Salvar situação"}
          </button>
        </div>
      </form>
      {aviso.podeGerir ? (
        <form className="conf-form" onSubmit={salvarResponsavel}>
          <Campo rotulo="Responsável" erro={erroDasPessoas || undefined}>
            <select
              value={responsavel}
              disabled={!pessoas}
              onChange={(e) => {
                setResponsavel(e.target.value);
                if (!e.target.value) setPrazo("");
              }}
            >
              <option value="">
                {pessoas ? "Sem responsável" : "Carregando…"}
              </option>
              {(pessoas || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
              {atualFora && aviso.responsavelId ? (
                <option value={aviso.responsavelId}>
                  {aviso.responsavel || "Responsável atual"}
                </option>
              ) : null}
            </select>
          </Campo>
          <Campo rotulo="Prazo">
            <input
              type="date"
              value={prazo}
              min={hojeEmBrasilia()}
              disabled={!responsavel}
              onChange={(e) => setPrazo(e.target.value)}
            />
          </Campo>
          <div className="conf-form__acoes">
            <button
              type="submit"
              className="btn secondary"
              disabled={agindo || !pessoas}
            >
              {agindo ? "Salvando…" : "Salvar responsável"}
            </button>
          </div>
        </form>
      ) : null}
      {atual.erroDaAcao && !atual.agindo ? (
        <small className="conf-erro" role="alert">
          {atual.erroDaAcao}
        </small>
      ) : null}
      <div className="conf-form__acoes">
        <button type="button" className="btn secondary" onClick={aoFechar}>
          Fechar
        </button>
      </div>
    </div>
  );
}

const ROTULOS_DA_EVIDENCIA: Readonly<Record<EvidenciaDoAviso["tipo"], string>> =
  Object.freeze({
    SEI: "Processo SEI",
    LINK: "Link",
    NOTA: "Nota",
  });
const TIPOS_DA_EVIDENCIA: readonly EvidenciaDoAviso["tipo"][] = [
  "SEI",
  "LINK",
  "NOTA",
];

/** Juntar evidência ao aviso ou a um caso dele. */
function FormularioDeEvidencia({
  aviso,
  estado,
  atual,
  caso,
  aoLimparCaso,
}: PropsDoAviso & {
  atual: SnapshotDosAvisos;
  caso: { chave: string; rotulo: string } | null;
  aoLimparCaso: () => void;
}) {
  const [tipo, setTipo] = useState<EvidenciaDoAviso["tipo"]>("SEI");
  const [descricao, setDescricao] = useState("");
  const [url, setUrl] = useState("");
  const [tocado, setTocado] = useState(false);
  const problema = erroDaEvidencia({ tipo, descricao, url });
  const agindo = atual.agindo === aviso.id;
  async function juntar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setTocado(true);
    if (problema) return;
    const ok = await estado.incluirEvidencia(aviso.id, {
      tipo,
      descricao,
      url,
      chaveDoCaso: caso?.chave ?? null,
    });
    if (ok) {
      setDescricao("");
      setUrl("");
      setTocado(false);
      aoLimparCaso();
    }
  }
  return (
    <form className="conf-form" onSubmit={juntar}>
      {caso ? (
        <p className="conf-form__caso">
          Do caso {caso.rotulo}{" "}
          <button
            type="button"
            className="btn secondary conf-botao"
            onClick={aoLimparCaso}
          >
            Do aviso todo
          </button>
        </p>
      ) : null}
      <Campo rotulo="Tipo">
        <select
          value={tipo}
          onChange={(e) => {
            const escolhido = TIPOS_DA_EVIDENCIA.find(
              (t) => t === e.target.value,
            );
            if (escolhido) setTipo(escolhido);
          }}
        >
          {TIPOS_DA_EVIDENCIA.map((t) => (
            <option key={t} value={t}>
              {ROTULOS_DA_EVIDENCIA[t]}
            </option>
          ))}
        </select>
      </Campo>
      <Campo
        rotulo={tipo === "SEI" ? "Número do processo" : "Descrição"}
        obrigatorio
        erro={tocado && problema ? problema : undefined}
      >
        <input
          type="text"
          maxLength={500}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          onBlur={() => setTocado(true)}
        />
      </Campo>
      <Campo rotulo="Link" obrigatorio={tipo === "LINK"}>
        <input
          type="url"
          maxLength={500}
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </Campo>
      <div className="conf-form__acoes">
        <button type="submit" className="btn" disabled={agindo}>
          {agindo ? "Juntando…" : "Juntar evidência"}
        </button>
      </div>
    </form>
  );
}

function ItemDaEvidencia({
  aviso,
  estado,
  atual,
  evidencia,
}: PropsDoAviso & {
  atual: SnapshotDosAvisos;
  evidencia: EvidenciaDoAviso;
}) {
  const [retirando, setRetirando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const agindo = atual.agindo === aviso.id;
  const curto = motivo.trim().length < 3;
  async function retirar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (curto) return;
    if (await estado.retirarEvidencia(aviso.id, evidencia.id, motivo))
      setRetirando(false);
  }
  return (
    <li
      className={
        evidencia.ativa
          ? "conf-evidencia"
          : "conf-evidencia conf-evidencia--retirada"
      }
    >
      <span className="conf-evidencia__tipo">
        {ROTULOS_DA_EVIDENCIA[evidencia.tipo]}
      </span>
      {evidencia.url ? (
        <a href={evidencia.url} target="_blank" rel="noopener noreferrer">
          {evidencia.descricao}
        </a>
      ) : (
        <span>{evidencia.descricao}</span>
      )}
      <small>
        {[
          evidencia.caso
            ? `caso ${evidencia.caso.split(":").slice(1).join(":")}`
            : "",
          evidencia.por,
          diaDoAviso(evidencia.em),
          evidencia.ativa
            ? ""
            : `retirada em ${diaDoAviso(evidencia.retiradaEm)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </small>
      {evidencia.ativa && aviso.podeTratar && !retirando ? (
        <button
          type="button"
          className="btn secondary conf-botao"
          onClick={() => setRetirando(true)}
        >
          Retirar
        </button>
      ) : null}
      {retirando ? (
        <form className="conf-form" onSubmit={retirar}>
          <Campo rotulo="Motivo da retirada" obrigatorio>
            <input
              type="text"
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </Campo>
          <div className="conf-form__acoes">
            <button
              type="button"
              className="btn secondary"
              onClick={() => setRetirando(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn" disabled={agindo || curto}>
              Retirar evidência
            </button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

/** O histórico do aviso (o que a conferência e a equipe fizeram) e as evidências. */
function PainelDoHistorico({
  aviso,
  estado,
  atual,
  caso,
  aoLimparCaso,
}: PropsDoAviso & {
  atual: SnapshotDosAvisos;
  caso: { chave: string; rotulo: string } | null;
  aoLimparCaso: () => void;
}) {
  const [historico, setHistorico] = useState<HistoricoDoAviso | null>(null);
  const [erro, setErro] = useState("");
  // O aviso relido (outra situação, evidência nova) traz o histórico de novo.
  const marca = [
    aviso.id,
    aviso.tratamento,
    aviso.evidencias,
    aviso.responsavelId,
    aviso.prazo,
    aviso.tratadoEm?.getTime(),
  ].join("|");
  useEffect(() => {
    let vivo = true;
    setErro("");
    estado
      .historico(aviso.id)
      .then((h) => {
        if (vivo) setHistorico(h);
      })
      .catch((falha: unknown) => {
        if (vivo) setErro(erroDaConsulta(falha));
      });
    return () => {
      vivo = false;
    };
  }, [estado, aviso.id, marca]);
  return (
    <div className="conf-painel">
      {aviso.podeTratar ? (
        <FormularioDeEvidencia
          aviso={aviso}
          estado={estado}
          atual={atual}
          caso={caso}
          aoLimparCaso={aoLimparCaso}
        />
      ) : null}
      {atual.erroDaAcao && !atual.agindo ? (
        <small className="conf-erro" role="alert">
          {atual.erroDaAcao}
        </small>
      ) : null}
      {erro ? (
        <p className="conf-vazio" role="alert">
          {erro}
        </p>
      ) : !historico ? (
        <p className="conf-vazio" role="status">
          Consultando o histórico…
        </p>
      ) : (
        <>
          {historico.evidencias.length ? (
            <ul className="conf-evidencias" aria-label="Evidências">
              {historico.evidencias.map((e) => (
                <ItemDaEvidencia
                  key={e.id}
                  aviso={aviso}
                  estado={estado}
                  atual={atual}
                  evidencia={e}
                />
              ))}
            </ul>
          ) : null}
          <ol className="conf-historico" aria-label="Histórico">
            {historico.eventos.map((e) => (
              <li key={e.id}>
                <span className="conf-historico__quando">
                  {diaDoAviso(e.em)}
                </span>
                <span>
                  <strong>{e.texto}</strong>
                  {e.por ? ` · ${e.por}` : ""}
                  {e.motivo ? (
                    <span className="conf-historico__motivo">{e.motivo}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

type Painel = "casos" | "tratar" | "historico" | null;

function ItemDoAviso({
  aviso,
  estado,
  atual,
  mostrarModulo,
  mostrarOnde = true,
  aoAbrirCaso,
}: PropsDoAviso & {
  atual: SnapshotDosAvisos;
  mostrarModulo?: boolean;
  mostrarOnde?: boolean;
}) {
  const [painel, setPainel] = useState<Painel>(null);
  const [casoDaEvidencia, setCasoDaEvidencia] = useState<{
    chave: string;
    rotulo: string;
  } | null>(null);
  const modulo = MODULOS_DOS_AVISOS.find((m) => m.valor === aviso.modulo);
  const alternar = (qual: Painel) =>
    setPainel((aberto) => (aberto === qual ? null : qual));
  const onde = [
    mostrarModulo && modulo ? modulo.rotulo : "",
    mostrarOnde ? aviso.onde : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const juntarEvidencia = aviso.podeTratar
    ? (caso: Caso) => {
        const chave = chaveDoCaso(caso);
        if (!chave) return;
        setCasoDaEvidencia({ chave, rotulo: quemDoCaso(caso) });
        setPainel("historico");
      }
    : undefined;
  return (
    <li
      className={`conf-aviso conf-aviso--${aviso.tom}`}
      data-conferencia={aviso.conferencia}
      data-tratamento={aviso.tratamento}
    >
      <div className="conf-aviso__topo">
        <span className={`conf-selo conf-selo--${aviso.tom}`}>
          {aviso.rotuloDaGravidade}
        </span>
        <strong>{aviso.titulo}</strong>
        {onde ? <span className="conf-aviso__onde">{onde}</span> : null}
        <SeloDoTratamento aviso={aviso} />
      </div>
      <p className="conf-aviso__resumo">{aviso.resumo}</p>
      {aviso.motivo && aviso.tratamento !== "PENDENTE" ? (
        <p className="conf-aviso__motivo">{aviso.motivo}</p>
      ) : null}
      <div className="conf-aviso__rodape">
        <DetalhesDoAviso aviso={aviso} />
        <button
          type="button"
          className="btn secondary conf-botao"
          aria-expanded={painel === "casos"}
          onClick={() => alternar("casos")}
        >
          <Icone
            nome={painel === "casos" ? "chevron-up" : "chevron-down"}
            tamanho={14}
          />
          {formatNumberBR(aviso.quantidade)}{" "}
          {aviso.quantidade === 1 ? "caso" : "casos"}
        </button>
        {aviso.podeTratar ? (
          <button
            type="button"
            className="btn secondary conf-botao"
            aria-expanded={painel === "tratar"}
            onClick={() => alternar("tratar")}
          >
            Tratar
          </button>
        ) : null}
        <button
          type="button"
          className="btn secondary conf-botao"
          aria-expanded={painel === "historico"}
          onClick={() => alternar("historico")}
        >
          Histórico
        </button>
      </div>
      {painel === "casos" ? (
        <CasosDoAviso
          aviso={aviso}
          estado={estado}
          aoAbrirCaso={aoAbrirCaso}
          aoJuntarEvidencia={juntarEvidencia}
        />
      ) : null}
      {painel === "tratar" ? (
        <PainelDoTratamento
          aviso={aviso}
          estado={estado}
          atual={atual}
          aoFechar={() => setPainel(null)}
        />
      ) : null}
      {painel === "historico" ? (
        <PainelDoHistorico
          aviso={aviso}
          estado={estado}
          atual={atual}
          caso={casoDaEvidencia}
          aoLimparCaso={() => setCasoDaEvidencia(null)}
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

type PropsDosItens = PropsDoEstado & {
  atual: SnapshotDosAvisos;
  mostrarModulo?: boolean;
};

/** Uma lista recolhida (dispensados, resolvidos), com o número no botão. */
function Recolhidos({
  rotulo,
  avisos,
  ...props
}: PropsDosItens & { rotulo: string; avisos: readonly Aviso[] }) {
  const [aberto, setAberto] = useState(false);
  if (!avisos.length) return null;
  return (
    <div className="conf-recolhidos">
      <button
        type="button"
        className="btn secondary conf-botao"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
      >
        <Icone nome={aberto ? "chevron-up" : "chevron-down"} tamanho={14} />
        {rotulo} ({avisos.length})
      </button>
      {aberto ? (
        <ul className="conf-lista">
          {avisos.map((aviso) => (
            <ItemDoAviso key={aviso.id} aviso={aviso} {...props} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * A lista de avisos: os abertos agrupados por edital (e, em cada um, por
 * gravidade); recolhidos, os dispensados e os resolvidos dos últimos 30 dias;
 * no topo, a busca em todos.
 */
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
  const temAvisos =
    lista.abertos.length + lista.dispensados.length + lista.resolvidos.length >
    0;
  const comuns: PropsDosItens = { estado, atual, mostrarModulo, aoAbrirCaso };
  return (
    <>
      {temAvisos ? (
        <BuscaNosAvisos valor={digitado} aoMudar={setDigitado} />
      ) : null}
      {temAvisos && busca ? (
        <div className="conf-resultados">
          <div className="conf-casos__barra">
            <strong>Casos com “{busca}”</strong>
            <ExportarCasos estado={estado} busca={busca} />
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
            agruparPorEdital(lista.abertos).map((grupo) => (
              <section
                className="conf-grupo"
                key={grupo.chave}
                aria-label={grupo.titulo}
              >
                <h4 className="conf-grupo__titulo">
                  {grupo.titulo}
                  <small>
                    {grupo.avisos.length}{" "}
                    {grupo.avisos.length === 1 ? "aviso" : "avisos"}
                  </small>
                </h4>
                <ul className="conf-lista">
                  {grupo.avisos.map((aviso) => (
                    <ItemDoAviso
                      key={aviso.id}
                      aviso={aviso}
                      mostrarOnde={false}
                      {...comuns}
                    />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <p className="conf-vazio" role="status">
              <Icone nome="circle-check" tamanho={16} /> Nenhum aviso aberto.
            </p>
          )}
          <Recolhidos
            rotulo="Dispensados"
            avisos={lista.dispensados}
            {...comuns}
          />
          <Recolhidos
            rotulo="Resolvidos nos últimos 30 dias"
            avisos={lista.resolvidos}
            {...comuns}
          />
        </>
      )}
    </>
  );
}

/**
 * Configurações › Status das atualizações: todos os avisos, com filtro por
 * módulo. `marca` (a da última conferência, marcaDasConferencias) relê quando
 * uma conferência nova começa ou termina; as releituras da tela não relêem.
 */
export function CartaoDeAvisos({
  supabase = getSupabaseClient(),
  estado: externo,
  aoAbrirCaso,
  marca = "",
}: PropsDoCartao & { marca?: string }) {
  const estado = useMemo(
    () => externo || criarEstadoDosAvisos({ supabase }),
    [externo, supabase],
  );
  const atual = usarEstado(estado);
  const [modulo, setModulo] = useState("todos");
  useEffect(() => {
    void estado.carregar();
  }, [estado, marca]);
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
