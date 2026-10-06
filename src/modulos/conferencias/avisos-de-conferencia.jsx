import {
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { usarAreaAtual } from "../../componentes/usar-area-atual.js";
import { Icone } from "../../componentes/icone.jsx";
import {
  contagemPorModulo,
  diaDoAviso,
  erroDoMotivo,
  filtrarPorModulo,
  LIMITES_DO_MOTIVO,
  MODULOS_DOS_AVISOS,
  tomDoSelo,
} from "../../lib/avisos-de-conferencia.js";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { formatNumberBR } from "../../lib/formatters.js";
import { Gaveta, Segmentado } from "../../ui/index.js";
import { criarEstadoDosAvisos } from "./estado.js";

/*
  Avisos de conferência (job Python scripts/conferencias/, todo dia às 6h).

    CartaoDeAvisos   Configurações › Status das atualizações (administrador
                     global): todos os módulos, com o filtro por módulo.
    SeloDeAvisos     no topo de Análises, Entrevistas, Classificação e Lista
                     de aprovados: a contagem dos avisos abertos daquele
                     módulo na área atual; some quando não há aviso. Clicar
                     abre a gaveta com a lista filtrada.

  Cada aviso: gravidade, título, onde (edital, área ou vaga), o resumo do job,
  desde quando e os exemplos (só ids e códigos). Quem administra o módulo (ou
  o administrador global) ignora com motivo; o ignorado volta sozinho se a
  quantidade crescer. As regras puras: src/lib/avisos-de-conferencia.js.
*/

function usarEstado(estado) {
  return useSyncExternalStore(estado.assinar, estado.obter);
}

function FormularioDeIgnorar({ aviso, estado, ignorando, erro, aoCancelar }) {
  const [motivo, setMotivo] = useState("");
  const [tocado, setTocado] = useState(false);
  const id = useId();
  const problema = erroDoMotivo(motivo);
  async function confirmar(evento) {
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

function ItemDoAviso({ aviso, estado, atual, mostrarModulo }) {
  const [exemplos, setExemplos] = useState(false);
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
            : `Desde ${diaDoAviso(aviso.primeiraVez)} · ${formatNumberBR(aviso.quantidade)} ${aviso.quantidade === 1 ? "caso" : "casos"}`}
        </small>
        {aviso.exemplos.length ? (
          <button
            type="button"
            className="btn secondary conf-botao"
            aria-expanded={exemplos}
            onClick={() => setExemplos((v) => !v)}
          >
            <Icone
              nome={exemplos ? "chevron-up" : "chevron-down"}
              tamanho={14}
            />
            Exemplos ({aviso.exemplos.length})
          </button>
        ) : null}
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
      {exemplos ? (
        <ul className="conf-aviso__exemplos" aria-label="Exemplos">
          {aviso.exemplos.map((e) => (
            <li key={e}>
              <code>{e}</code>
            </li>
          ))}
        </ul>
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

/** A lista de avisos (abertos e, recolhidos, os ignorados). */
export function ListaDeAvisos({ estado, lista, mostrarModulo = false }) {
  const atual = usarEstado(estado);
  const [verIgnorados, setVerIgnorados] = useState(false);
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
  return (
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
                />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** Configurações › Status das atualizações: todos os avisos, com filtro por módulo. */
export function CartaoDeAvisos({
  supabase = getSupabaseClient(),
  estado: externo,
}) {
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
}) {
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
            <ListaDeAvisos estado={estado} lista={atual.lista} />
          </div>
        </Gaveta>
      ) : null}
    </>
  );
}
