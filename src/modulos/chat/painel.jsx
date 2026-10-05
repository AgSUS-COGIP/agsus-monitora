import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  filtrarConversas,
  previaDaUltima,
  quandoNaLista,
  temAlguemOnline,
  tituloDaConversa,
} from "../../lib/chat.js";
import { EstadoVazio, Segmentado } from "../../ui/index.js";
import { Avatar } from "./avatar.jsx";
import { Conversa } from "./conversa.jsx";

/*
  O painel lateral "Mensagens" (carregado sob demanda por chat.jsx): a lista de
  conversas (busca, Nova conversa, preferências de aviso), a conversa aberta
  (conversa.jsx) e a escolha de pessoas (nova conversa direta ou grupo e
  incluir no grupo). Não é modal: dá para seguir usando a tela ao lado.
*/

function avatarDaConversa(conversa, eu) {
  if (conversa.tipo === "DIRETA") {
    const outra = (conversa.participantes || []).find(
      (p) => String(p.id) !== String(eu),
    );
    return <Avatar pessoa={outra} online={Boolean(outra?.online)} />;
  }
  if (conversa.tipo === "EDITAL")
    return (
      <span className="chat-avatar chat-avatar--edital" aria-hidden="true">
        <i className="fa-solid fa-file-lines" />
        {temAlguemOnline(conversa, eu) ? (
          <i className="chat-avatar__online" />
        ) : null}
      </span>
    );
  return <Avatar grupo online={temAlguemOnline(conversa, eu)} />;
}

function ItemDaConversa({ conversa, eu, aoAbrir }) {
  const titulo = tituloDaConversa(conversa, eu);
  const naoLidas = Number(conversa.nao_lidas) || 0;
  return (
    <li>
      <button
        type="button"
        className={`chat-item${naoLidas ? " tem-nao-lidas" : ""}`}
        data-conversa={conversa.id}
        onClick={() => aoAbrir(conversa.id)}
        aria-label={`${titulo}${naoLidas ? `, ${naoLidas} não ${naoLidas === 1 ? "lida" : "lidas"}` : ""}`}
      >
        {avatarDaConversa(conversa, eu)}
        <span className="chat-item__corpo">
          <span className="chat-item__linha">
            <strong>{titulo}</strong>
            <small>
              {quandoNaLista(
                conversa.ultima?.criada_em || conversa.atualizada_em,
              )}
            </small>
          </span>
          <span className="chat-item__linha">
            <span className="chat-item__previa">
              {previaDaUltima(conversa, eu)}
            </span>
            {conversa.silenciada ? (
              <i
                className="fa-solid fa-bell-slash chat-item__silenciada"
                title="Silenciada"
                aria-hidden="true"
              />
            ) : null}
            {conversa.mencoes ? (
              <span
                className="chat-item__mencao"
                title="Menção a você"
                aria-hidden="true"
              >
                @
              </span>
            ) : null}
            {naoLidas ? (
              <span className="chat-item__contador" aria-hidden="true">
                {naoLidas > 99 ? "99+" : naoLidas}
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}

function ListaDeConversas({ estado, e }) {
  const [busca, setBusca] = useState("");
  const idDaBusca = useId();
  const conversas = filtrarConversas(e.conversas, busca, e.eu);
  return (
    <div className="chat-lista">
      <div className="chat-lista__topo">
        <label className="sr-only" htmlFor={idDaBusca}>
          Buscar conversa
        </label>
        <input
          id={idDaBusca}
          type="search"
          className="chat-busca"
          placeholder="Buscar conversa"
          value={busca}
          onChange={(ev) => setBusca(ev.target.value)}
        />
        <button
          type="button"
          className="btn small"
          onClick={() => estado.mostrar("nova")}
        >
          <i className="fa-solid fa-pen-to-square" aria-hidden="true" /> Nova
          conversa
        </button>
      </div>
      {e.erro ? (
        <p className="chat-erro" role="alert">
          {e.erro}{" "}
          <button
            type="button"
            className="btn secondary small"
            onClick={() => void estado.carregarConversas()}
          >
            Tentar novamente
          </button>
        </p>
      ) : null}
      {!e.carregado && e.carregandoConversas ? (
        <div className="chat-lista__esqueleto" aria-busy="true">
          <div className="ui-esqueleto-linha" />
          <div className="ui-esqueleto-linha" />
          <div className="ui-esqueleto-linha" />
        </div>
      ) : conversas.length ? (
        <ul className="chat-itens">
          {conversas.map((c) => (
            <ItemDaConversa
              key={c.id}
              conversa={c}
              eu={e.eu}
              aoAbrir={(id) => void estado.abrirConversa(id)}
            />
          ))}
        </ul>
      ) : e.carregado ? (
        <EstadoVazio>
          {busca ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda."}
        </EstadoVazio>
      ) : null}
      <fieldset className="chat-preferencias">
        <legend>Avisos</legend>
        <label>
          <input
            type="checkbox"
            checked={e.preferencias.som}
            onChange={(ev) =>
              void estado.definirPreferencia("som", ev.target.checked)
            }
          />{" "}
          Som
        </label>
        <label>
          <input
            type="checkbox"
            checked={e.preferencias.notificacoes}
            onChange={(ev) =>
              void estado.definirPreferencia("notificacoes", ev.target.checked)
            }
          />{" "}
          Notificações do navegador
        </label>
      </fieldset>
    </div>
  );
}

const MODOS = [
  { valor: "direta", rotulo: "Conversa direta" },
  { valor: "grupo", rotulo: "Grupo" },
];

/* Escolher pessoas: nova conversa (direta ou grupo) ou incluir no grupo aberto. */
function EscolhaDePessoas({ estado, e, incluir = false }) {
  const [modo, setModo] = useState(incluir ? "grupo" : "direta");
  const [busca, setBusca] = useState("");
  const [nome, setNome] = useState("");
  const [escolhidas, setEscolhidas] = useState([]);
  const idDaBusca = useId();
  const idDoNome = useId();
  const jaNoGrupo = new Set(
    incluir ? (e.conversa?.participantes || []).map((p) => String(p.id)) : [],
  );

  useEffect(() => {
    const espera = setTimeout(
      () => void estado.buscarPessoas(busca),
      busca ? 250 : 0,
    );
    return () => clearTimeout(espera);
  }, [estado, busca]);

  const pessoas = e.pessoas.filter((p) => !jaNoGrupo.has(String(p.id)));
  const alternar = (pessoa) =>
    setEscolhidas((atual) =>
      atual.some((p) => p.id === pessoa.id)
        ? atual.filter((p) => p.id !== pessoa.id)
        : [...atual, pessoa],
    );
  const ocupado = Boolean(e.acao);
  const podeCriar =
    escolhidas.length > 0 && (incluir || nome.trim().length > 0);

  return (
    <div className="chat-escolha">
      {incluir ? null : (
        <Segmentado
          rotulo="Tipo de conversa"
          opcoes={MODOS}
          valor={modo}
          aoMudar={setModo}
        />
      )}
      {modo === "grupo" && !incluir ? (
        <div className="chat-campo">
          <label htmlFor={idDoNome}>Nome do grupo</label>
          <input
            id={idDoNome}
            type="text"
            maxLength={120}
            value={nome}
            onChange={(ev) => setNome(ev.target.value)}
          />
        </div>
      ) : null}
      <div className="chat-campo">
        <label htmlFor={idDaBusca}>Pessoa</label>
        <input
          id={idDaBusca}
          type="search"
          placeholder="Nome ou e-mail"
          value={busca}
          onChange={(ev) => setBusca(ev.target.value)}
        />
      </div>
      {escolhidas.length ? (
        <ul className="chat-escolhidas" aria-label="Escolhidas">
          {escolhidas.map((p) => (
            <li key={p.id}>
              {p.nome}
              <button
                type="button"
                aria-label={`Tirar ${p.nome}`}
                onClick={() => alternar(p)}
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <ul
        className="chat-pessoas"
        aria-busy={e.buscandoPessoas ? "true" : "false"}
      >
        {pessoas.map((p) => {
          const marcada = escolhidas.some((x) => x.id === p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`chat-pessoa${marcada ? " is-marcada" : ""}`}
                aria-pressed={
                  modo === "grupo" ? (marcada ? "true" : "false") : undefined
                }
                disabled={ocupado}
                onClick={() =>
                  modo === "direta"
                    ? void estado.abrirConversaDireta(p.id)
                    : alternar(p)
                }
              >
                <Avatar pessoa={p} online={Boolean(p.online)} />
                <span className="chat-pessoa__nome">
                  <strong>{p.nome}</strong>
                  <small>{p.email}</small>
                </span>
                {modo === "grupo" ? (
                  <i
                    className={`fa-solid ${marcada ? "fa-square-check" : "fa-square"}`}
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {!e.buscandoPessoas && !pessoas.length ? (
        <EstadoVazio>Ninguém encontrado.</EstadoVazio>
      ) : null}
      {modo === "grupo" ? (
        <div className="ui-acoes chat-escolha__acoes">
          <button
            type="button"
            className="btn"
            disabled={!podeCriar || ocupado}
            onClick={() =>
              void (incluir
                ? estado.adicionarParticipantes(escolhidas.map((p) => p.id))
                : estado.criarGrupo(
                    nome.trim(),
                    escolhidas.map((p) => p.id),
                  ))
            }
          >
            {e.acao?.rotulo || (incluir ? "Adicionar" : "Criar grupo")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function tituloDoTopo(e) {
  if (e.visao === "nova") return "Nova conversa";
  if (e.visao === "adicionar") return "Adicionar pessoas";
  if (e.visao === "conversa")
    return tituloDaConversa(e.conversa, e.eu) || "Conversa";
  return "Mensagens";
}

export default function PainelDoChat({ estado, id }) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const idDoTitulo = useId();
  const painel = useRef(null);

  useEffect(() => {
    const aoTeclar = (ev) => {
      if (ev.key !== "Escape") return;
      if (!painel.current?.contains(document.activeElement)) return;
      if (e.visao === "lista") estado.fechar();
      else if (e.visao === "adicionar") estado.mostrar("conversa");
      else estado.voltarParaLista();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [estado, e.visao]);

  const voltar =
    e.visao === "adicionar"
      ? () => estado.mostrar("conversa")
      : () => estado.voltarParaLista();

  return (
    <aside
      id={id}
      ref={painel}
      className="chat-painel"
      aria-labelledby={idDoTitulo}
    >
      <header className="chat-painel__topo">
        {e.visao !== "lista" ? (
          <button
            type="button"
            className="chat-icone"
            aria-label="Voltar"
            onClick={voltar}
          >
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
          </button>
        ) : null}
        <h2 id={idDoTitulo}>{tituloDoTopo(e)}</h2>
        {e.reconectando ? (
          <span className="chat-painel__reconectando" role="status">
            Reconectando…
          </span>
        ) : null}
        <button
          type="button"
          className="chat-icone"
          aria-label="Fechar mensagens"
          onClick={() => estado.fechar()}
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </header>
      {e.visao === "conversa" ? (
        <Conversa estado={estado} e={e} />
      ) : e.visao === "nova" ? (
        <EscolhaDePessoas key="nova" estado={estado} e={e} />
      ) : e.visao === "adicionar" ? (
        <EscolhaDePessoas key="adicionar" estado={estado} e={e} incluir />
      ) : (
        <ListaDeConversas estado={estado} e={e} />
      )}
    </aside>
  );
}
