import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  agruparPorDia,
  extrairMencoes,
  horaCurta,
  inserirMencao,
  LIMITE_DO_TEXTO,
  linkDaTela,
  mencaoEmDigitacao,
  outrasPessoas,
  partesDoTexto,
  sugestoesDeMencao,
} from "../../lib/chat.js";
import { irParaLink, linkDaTelaAtual } from "./ponte.js";

/*
  A conversa aberta no painel: mensagens agrupadas por dia (Hoje, Ontem,
  02/10), menções destacadas, link interno da tela ("Abrir"), editar e apagar
  a própria mensagem, "digitando…" e o campo de escrita (Enter envia,
  Shift+Enter quebra linha, @ sugere pessoas, Compartilhar esta tela).
*/

const AVISO_DO_LIMITE = LIMITE_DO_TEXTO - 500;

function nomeDe(conversa, id) {
  return (
    (conversa?.participantes || []).find((p) => String(p.id) === String(id))
      ?.nome || "Pessoa"
  );
}

function TextoDaMensagem({ mensagem, conversa }) {
  const mencionadas = (mensagem.mencoes || []).map((id) => ({
    id,
    nome: nomeDe(conversa, id),
  }));
  return (
    <p className="chat-msg__texto">
      {partesDoTexto(mensagem.texto, mencionadas).map((parte, i) =>
        parte.tipo === "mencao" ? (
          <mark key={i} className="chat-mencao">
            {parte.texto}
          </mark>
        ) : (
          <span key={i}>{parte.texto}</span>
        ),
      )}
    </p>
  );
}

function LinkDaMensagem({ link }) {
  const conferido = linkDaTela(link);
  if (!conferido) return null;
  return (
    <button
      type="button"
      className="chat-msg__link"
      onClick={() => irParaLink(conferido)}
      title="Abrir esta tela"
    >
      <i className="fa-solid fa-display" aria-hidden="true" />
      <span>{conferido.rotulo}</span>
    </button>
  );
}

function Mensagem({ estado, e, mensagem, mostrarAutor }) {
  const minha = String(mensagem.autor) === String(e.eu);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(mensagem.texto);
  const [confirmando, setConfirmando] = useState(false);
  const ocupado = Boolean(e.acao);

  if (mensagem.apagada)
    return (
      <li
        className={`chat-msg is-apagada${minha ? " is-minha" : ""}`}
        data-mensagem={mensagem.id}
      >
        <p className="chat-msg__texto">Mensagem apagada</p>
        <small className="chat-msg__hora">
          {horaCurta(mensagem.criada_em)}
        </small>
      </li>
    );

  return (
    <li
      className={`chat-msg${minha ? " is-minha" : ""}${mensagem.falhou ? " is-falhou" : ""}`}
      data-mensagem={mensagem.id}
    >
      {mostrarAutor && !minha ? (
        <strong className="chat-msg__autor">
          {nomeDe(e.conversa, mensagem.autor)}
        </strong>
      ) : null}
      {editando ? (
        <form
          className="chat-msg__edicao"
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (await estado.editar(mensagem.id, rascunho)) setEditando(false);
          }}
        >
          <label className="sr-only" htmlFor={`editar-${mensagem.id}`}>
            Editar mensagem
          </label>
          <textarea
            id={`editar-${mensagem.id}`}
            value={rascunho}
            maxLength={LIMITE_DO_TEXTO}
            rows={3}
            onChange={(ev) => setRascunho(ev.target.value)}
          />
          <div className="chat-msg__acoes">
            <button
              type="submit"
              className="btn small"
              disabled={ocupado || !rascunho.trim()}
            >
              Salvar
            </button>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => setEditando(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <>
          <TextoDaMensagem mensagem={mensagem} conversa={e.conversa} />
          {mensagem.link ? <LinkDaMensagem link={mensagem.link} /> : null}
        </>
      )}
      <small className="chat-msg__hora">
        {mensagem.pendente
          ? "Enviando…"
          : mensagem.falhou
            ? "Não enviada"
            : `${horaCurta(mensagem.criada_em)}${mensagem.editada_em ? " · editada" : ""}`}
      </small>
      {mensagem.falhou ? (
        <div className="chat-msg__acoes">
          <button
            type="button"
            className="btn small"
            onClick={() => void estado.reenviar(mensagem.id)}
          >
            Tentar de novo
          </button>
          <button
            type="button"
            className="btn secondary small"
            onClick={() => estado.descartar(mensagem.id)}
          >
            Descartar
          </button>
        </div>
      ) : null}
      {minha && !mensagem.pendente && !mensagem.falhou && !editando ? (
        confirmando ? (
          <div
            className="chat-msg__acoes"
            role="group"
            aria-label="Apagar esta mensagem?"
          >
            <span>Apagar esta mensagem?</span>
            <button
              type="button"
              className="btn danger small"
              disabled={ocupado}
              onClick={async () => {
                await estado.apagar(mensagem.id);
                setConfirmando(false);
              }}
            >
              Apagar
            </button>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="chat-msg__menu">
            <button
              type="button"
              className="chat-icone"
              aria-label="Editar mensagem"
              title="Editar"
              onClick={() => {
                setRascunho(mensagem.texto);
                setEditando(true);
              }}
            >
              <i className="fa-solid fa-pen" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="chat-icone"
              aria-label="Apagar mensagem"
              title="Apagar"
              onClick={() => setConfirmando(true)}
            >
              <i className="fa-solid fa-trash" aria-hidden="true" />
            </button>
          </div>
        )
      ) : null}
    </li>
  );
}

function Digitando({ digitando }) {
  const nomes = Object.values(digitando || {});
  if (!nomes.length) return <p className="chat-digitando" aria-live="polite" />;
  const quem =
    nomes.length === 1 ? nomes[0].split(/\s+/)[0] : `${nomes.length} pessoas`;
  return (
    <p className="chat-digitando" aria-live="polite">
      {quem} {nomes.length === 1 ? "está" : "estão"} digitando…
    </p>
  );
}

function CampoDeEscrita({ estado, e }) {
  const [texto, setTexto] = useState("");
  const [link, setLink] = useState(null);
  const [cursor, setCursor] = useState(0);
  const [indice, setIndice] = useState(0);
  const campo = useRef(null);
  const idDoCampo = useId();
  const pessoas = outrasPessoas(e.conversa, e.eu);
  const mencao = mencaoEmDigitacao(texto, cursor);
  const sugestoes = mencao ? sugestoesDeMencao(pessoas, mencao.termo) : [];
  const meuNome = (e.conversa?.participantes || []).find(
    (p) => String(p.id) === String(e.eu),
  )?.nome;

  useEffect(() => {
    campo.current?.focus();
  }, [e.conversaId]);

  async function enviar() {
    if (!texto.trim() || texto.length > LIMITE_DO_TEXTO) return;
    const mencoes = extrairMencoes(texto, pessoas);
    const enviado = texto;
    setTexto("");
    setLink(null);
    setCursor(0);
    // Falhou: a mensagem fica na conversa como "Não enviada", com Tentar de novo.
    await estado.enviar(enviado, { link, mencoes });
  }

  function escolher(pessoa) {
    const novo = inserirMencao(texto, cursor, mencao, pessoa);
    setTexto(novo.texto);
    setCursor(novo.cursor);
    setIndice(0);
    requestAnimationFrame(() => {
      campo.current?.focus();
      campo.current?.setSelectionRange(novo.cursor, novo.cursor);
    });
  }

  function aoTeclar(ev) {
    if (sugestoes.length) {
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        const passo = ev.key === "ArrowDown" ? 1 : -1;
        setIndice((i) => (i + passo + sugestoes.length) % sugestoes.length);
        return;
      }
      if (ev.key === "Enter" || ev.key === "Tab") {
        ev.preventDefault();
        escolher(sugestoes[Math.min(indice, sugestoes.length - 1)]);
        return;
      }
    }
    if (ev.key === "Enter" && !ev.shiftKey && !ev.nativeEvent?.isComposing) {
      ev.preventDefault();
      void enviar();
    }
  }

  const compartilhar = () => {
    const atual = linkDaTelaAtual();
    if (atual) setLink(atual);
    else estado.avisar("Esta tela não tem link para compartilhar.");
  };

  return (
    <form
      className="chat-escrita"
      onSubmit={(ev) => {
        ev.preventDefault();
        void enviar();
      }}
    >
      {link ? (
        <div className="chat-escrita__link">
          <i className="fa-solid fa-display" aria-hidden="true" />
          <span>{link.rotulo}</span>
          <button
            type="button"
            className="chat-icone"
            aria-label="Tirar a tela"
            onClick={() => setLink(null)}
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {sugestoes.length ? (
        <ul className="chat-sugestoes" role="listbox" aria-label="Mencionar">
          {sugestoes.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === indice ? "true" : "false"}
            >
              <button
                type="button"
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => escolher(p)}
              >
                {p.nome}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <label className="sr-only" htmlFor={idDoCampo}>
        Mensagem
      </label>
      <textarea
        id={idDoCampo}
        ref={campo}
        className="chat-escrita__campo"
        rows={2}
        maxLength={LIMITE_DO_TEXTO}
        placeholder="Mensagem"
        value={texto}
        onChange={(ev) => {
          setTexto(ev.target.value);
          setCursor(ev.target.selectionStart ?? ev.target.value.length);
          setIndice(0);
          if (ev.target.value) estado.avisarDigitando(meuNome);
        }}
        onSelect={(ev) => setCursor(ev.target.selectionStart ?? 0)}
        onKeyDown={aoTeclar}
      />
      <div className="chat-escrita__rodape">
        <button
          type="button"
          className="btn secondary small"
          onClick={compartilhar}
          aria-pressed={link ? "true" : "false"}
        >
          <i className="fa-solid fa-display" aria-hidden="true" /> Compartilhar
          esta tela
        </button>
        {texto.length > AVISO_DO_LIMITE ? (
          <small className="chat-escrita__contador">
            {texto.length.toLocaleString("pt-BR")}/
            {LIMITE_DO_TEXTO.toLocaleString("pt-BR")}
          </small>
        ) : null}
        <button type="submit" className="btn small" disabled={!texto.trim()}>
          <i className="fa-solid fa-paper-plane" aria-hidden="true" /> Enviar
        </button>
      </div>
    </form>
  );
}

function MenuDaConversa({ estado, e }) {
  const [aberto, setAberto] = useState(false);
  const c = e.conversa;
  if (!c) return null;
  return (
    <div className="chat-conversa__opcoes">
      <button
        type="button"
        className="chat-icone"
        aria-label="Opções da conversa"
        aria-expanded={aberto ? "true" : "false"}
        onClick={() => setAberto((a) => !a)}
      >
        <i className="fa-solid fa-ellipsis" aria-hidden="true" />
      </button>
      {aberto ? (
        <div className="chat-conversa__menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setAberto(false);
              void estado.silenciar(!c.silenciada);
            }}
          >
            {c.silenciada ? "Reativar avisos" : "Silenciar"}
          </button>
          {c.tipo === "GRUPO" ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAberto(false);
                estado.mostrar("adicionar");
              }}
            >
              Adicionar pessoas
            </button>
          ) : null}
          {c.tipo !== "DIRETA" ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAberto(false);
                void estado.sair();
              }}
            >
              {c.tipo === "GRUPO" ? "Sair do grupo" : "Deixar de acompanhar"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function Conversa({ estado, e }) {
  const lista = useRef(null);
  const noFim = useRef(true);
  const grupos = agruparPorDia(e.mensagens);
  const mostrarAutor = e.conversa?.tipo !== "DIRETA";
  const quantas = e.mensagens.length;
  const ultimaId = e.mensagens.at(-1)?.id;

  // Mensagem nova rola para o fim (se já estava no fim); carregar antigas não.
  useLayoutEffect(() => {
    const el = lista.current;
    if (el && noFim.current) el.scrollTop = el.scrollHeight;
  }, [ultimaId, quantas]);

  const participantes = outrasPessoas(e.conversa, e.eu);
  const online = participantes.filter((p) => p.online).length;

  return (
    <div className="chat-conversa">
      <div className="chat-conversa__topo">
        <small>
          {e.conversa?.tipo === "DIRETA"
            ? participantes[0]?.online
              ? "Online"
              : ""
            : `${participantes.length + 1} ${participantes.length ? "pessoas" : "pessoa"}${online ? ` · ${online} online` : ""}`}
        </small>
        <MenuDaConversa estado={estado} e={e} />
      </div>
      <div
        className="chat-conversa__mensagens"
        ref={lista}
        onScroll={(ev) => {
          const el = ev.currentTarget;
          noFim.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        aria-busy={e.carregandoMensagens ? "true" : "false"}
      >
        {e.temMais ? (
          <button
            type="button"
            className="btn secondary small chat-conversa__anteriores"
            disabled={e.carregandoMensagens}
            onClick={() => {
              noFim.current = false;
              void estado.carregarAnteriores();
            }}
          >
            Carregar anteriores
          </button>
        ) : null}
        {e.erroDaConversa ? (
          <p className="chat-erro" role="alert">
            {e.erroDaConversa}
          </p>
        ) : null}
        {!quantas && !e.carregandoMensagens && !e.erroDaConversa ? (
          <p className="ui-vazio">Nenhuma mensagem ainda.</p>
        ) : null}
        {grupos.map((grupo) => (
          <section
            key={grupo.chave}
            className="chat-dia"
            aria-label={grupo.rotulo}
          >
            <h3 className="chat-dia__rotulo">{grupo.rotulo}</h3>
            <ul className="chat-msgs">
              {grupo.mensagens.map((m, i) => (
                <Mensagem
                  key={m.id}
                  estado={estado}
                  e={e}
                  mensagem={m}
                  mostrarAutor={
                    mostrarAutor &&
                    (i === 0 ||
                      String(grupo.mensagens[i - 1].autor) !== String(m.autor))
                  }
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Digitando digitando={e.digitando} />
      <CampoDeEscrita key={e.conversaId} estado={estado} e={e} />
    </div>
  );
}
