import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  agruparPorDia,
  extrairMencoes,
  horaCurta,
  inserirMencao,
  inserirNoCursor,
  LIMITE_DO_TEXTO,
  linkDaTela,
  mencaoEmDigitacao,
  outrasPessoas,
  partesDoTexto,
  REACOES_RAPIDAS,
  resumoDasReacoes,
  sugestoesDeMencao,
} from "../../lib/chat.js";
import { irParaLink, linkDaTelaAtual } from "./ponte.js";
import { SeletorDeEmoji } from "./seletor-de-emoji.jsx";

/*
  A conversa aberta no painel: mensagens agrupadas por dia (Hoje, Ontem,
  02/10), menções destacadas, link interno da tela ("Abrir"), reações rápidas,
  o menu "⋯" de cada mensagem (reagir, copiar; na própria, editar e apagar —
  sempre à vista, para funcionar no toque), "digitando…", "↓ Novas mensagens"
  quando chega mensagem e a pessoa está lendo acima, e o campo de escrita
  (Enter envia, Shift+Enter quebra linha, @ sugere pessoas, emojis,
  Compartilhar esta tela). No menu da conversa: Limpar conversa (para mim).
*/

const AVISO_DO_LIMITE = LIMITE_DO_TEXTO - 500;

function nomeDe(conversa, id) {
  return (
    (conversa?.participantes || []).find((p) => String(p.id) === String(id))
      ?.nome || "Pessoa"
  );
}

/* Fecha um menu ou janelinha com clique (ou toque) fora e com Escape. */
function usarFecharFora(aberto, fechar, ...refs) {
  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (ev) => {
      if (refs.some((r) => r.current?.contains(ev.target))) return;
      fechar();
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("touchstart", fora);
    };
  }, [aberto, fechar]);
}

/* Escape dentro do menu fecha só o menu (não volta para a lista). */
function escapeFecha(fechar) {
  return (ev) => {
    if (ev.key !== "Escape") return;
    ev.stopPropagation();
    ev.nativeEvent?.stopImmediatePropagation?.();
    fechar();
  };
}

async function copiarTexto(estado, texto) {
  try {
    await globalThis.navigator.clipboard.writeText(texto);
    estado.informar("Texto copiado.");
  } catch {
    estado.avisar("Não foi possível copiar o texto.");
  }
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

function ReacoesDaMensagem({ estado, e, mensagem }) {
  const resumo = resumoDasReacoes(mensagem.reacoes, e.eu, (id) =>
    nomeDe(e.conversa, id),
  );
  if (!resumo.length) return null;
  return (
    <div className="chat-reacoes" role="group" aria-label="Reações">
      {resumo.map((r) => (
        <button
          key={r.emoji}
          type="button"
          className={`chat-reacao${r.minha ? " is-minha" : ""}`}
          aria-pressed={r.minha ? "true" : "false"}
          aria-label={`${r.emoji} ${r.total}: ${r.quem}`}
          title={r.quem}
          onClick={() => void estado.alternarReacao(mensagem.id, r.emoji)}
        >
          <span aria-hidden="true">{r.emoji}</span>
          <span className="chat-reacao__total">{r.total}</span>
        </button>
      ))}
    </div>
  );
}

/* O "⋯" de cada mensagem: reagir, copiar e, na própria, editar e apagar. */
function MenuDaMensagem({ estado, e, mensagem, minha, aoEditar, aoApagar }) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef(null);
  const fechar = () => setAberto(false);
  usarFecharFora(aberto, fechar, caixa);
  const minhas = new Set(
    (mensagem.reacoes || [])
      .filter((r) => (r.usuarios || []).some((u) => String(u) === String(e.eu)))
      .map((r) => r.emoji),
  );
  const fazer = (acao) => () => {
    setAberto(false);
    acao();
  };
  return (
    <div className="chat-msg__mais" ref={caixa} onKeyDown={escapeFecha(fechar)}>
      <button
        type="button"
        className="chat-icone chat-msg__botao-mais"
        aria-label="Ações da mensagem"
        title="Ações"
        aria-haspopup="menu"
        aria-expanded={aberto ? "true" : "false"}
        onClick={() => setAberto((a) => !a)}
      >
        <i className="fa-solid fa-ellipsis" aria-hidden="true" />
      </button>
      {aberto ? (
        <div className="chat-msg__menu" role="menu">
          <div className="chat-msg__reagir" role="group" aria-label="Reagir">
            {REACOES_RAPIDAS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`Reagir com ${emoji}`}
                aria-pressed={minhas.has(emoji) ? "true" : "false"}
                onClick={fazer(
                  () => void estado.alternarReacao(mensagem.id, emoji),
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={fazer(() => void copiarTexto(estado, mensagem.texto))}
          >
            <i className="fa-solid fa-copy" aria-hidden="true" /> Copiar texto
          </button>
          {minha ? (
            <>
              <button type="button" role="menuitem" onClick={fazer(aoEditar)}>
                <i className="fa-solid fa-pen" aria-hidden="true" /> Editar
              </button>
              <button
                type="button"
                role="menuitem"
                className="is-perigo"
                onClick={fazer(aoApagar)}
              >
                <i className="fa-solid fa-trash" aria-hidden="true" /> Apagar
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
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

  const temMenu =
    !mensagem.pendente && !mensagem.falhou && !editando && !confirmando;

  return (
    <li
      className={`chat-msg${minha ? " is-minha" : ""}${mensagem.falhou ? " is-falhou" : ""}${temMenu ? " tem-menu" : ""}`}
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
      <ReacoesDaMensagem estado={estado} e={e} mensagem={mensagem} />
      <small className="chat-msg__hora" aria-live="polite">
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
      {confirmando ? (
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
      ) : null}
      {temMenu ? (
        <MenuDaMensagem
          estado={estado}
          e={e}
          mensagem={mensagem}
          minha={minha}
          aoEditar={() => {
            setRascunho(mensagem.texto);
            setEditando(true);
          }}
          aoApagar={() => setConfirmando(true)}
        />
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
  const [comEmojis, setComEmojis] = useState(false);
  const campo = useRef(null);
  const caixaDeEmojis = useRef(null);
  const botaoDeEmojis = useRef(null);
  const idDoCampo = useId();
  const pessoas = outrasPessoas(e.conversa, e.eu);
  const mencao = mencaoEmDigitacao(texto, cursor);
  const sugestoes = mencao ? sugestoesDeMencao(pessoas, mencao.termo) : [];
  const meuNome = (e.conversa?.participantes || []).find(
    (p) => String(p.id) === String(e.eu),
  )?.nome;
  const fecharEmojis = () => setComEmojis(false);
  usarFecharFora(comEmojis, fecharEmojis, caixaDeEmojis, botaoDeEmojis);

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
    setComEmojis(false);
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

  /* O emoji entra no lugar do cursor (ou da seleção) do campo. */
  function inserirEmoji(emoji) {
    const el = campo.current;
    const inicio = el?.selectionStart ?? cursor;
    const fim = el?.selectionEnd ?? inicio;
    const novo = inserirNoCursor(texto, inicio, fim, emoji);
    if (novo.texto === texto) return;
    setTexto(novo.texto);
    setCursor(novo.cursor);
    requestAnimationFrame(() =>
      campo.current?.setSelectionRange(novo.cursor, novo.cursor),
    );
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
      data-tour="chat-escrita"
      onSubmit={(ev) => {
        ev.preventDefault();
        void enviar();
      }}
      onKeyDown={comEmojis ? escapeFecha(fecharEmojis) : undefined}
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
      {comEmojis ? (
        <div ref={caixaDeEmojis} className="chat-escrita__emojis">
          <SeletorDeEmoji aoEscolher={inserirEmoji} />
        </div>
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
          ref={botaoDeEmojis}
          className="chat-icone chat-escrita__emoji"
          aria-label="Emojis"
          title="Emojis"
          aria-haspopup="dialog"
          aria-expanded={comEmojis ? "true" : "false"}
          onClick={() => setComEmojis((a) => !a)}
        >
          <i className="fa-solid fa-face-smile" aria-hidden="true" />
        </button>
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
  const [limpando, setLimpando] = useState(false);
  const caixa = useRef(null);
  const fechar = () => {
    setAberto(false);
    setLimpando(false);
  };
  usarFecharFora(aberto, fechar, caixa);
  const c = e.conversa;
  if (!c) return null;
  return (
    <div
      className="chat-conversa__opcoes"
      ref={caixa}
      onKeyDown={aberto ? escapeFecha(fechar) : undefined}
    >
      <button
        type="button"
        className="chat-icone"
        aria-label="Opções da conversa"
        aria-haspopup="menu"
        aria-expanded={aberto ? "true" : "false"}
        onClick={() => (aberto ? fechar() : setAberto(true))}
      >
        <i className="fa-solid fa-ellipsis" aria-hidden="true" />
      </button>
      {aberto && limpando ? (
        <div
          className="chat-conversa__menu chat-conversa__confirmar"
          role="group"
          aria-label="Limpar conversa?"
        >
          <p>Limpar o histórico só para você?</p>
          <div className="chat-msg__acoes">
            <button
              type="button"
              className="btn danger small"
              disabled={Boolean(e.acao)}
              onClick={async () => {
                await estado.limparConversa();
                fechar();
              }}
            >
              Limpar
            </button>
            <button
              type="button"
              className="btn secondary small"
              onClick={fechar}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : aberto ? (
        <div className="chat-conversa__menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              fechar();
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
                fechar();
                estado.mostrar("adicionar");
              }}
            >
              Adicionar pessoas
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => setLimpando(true)}
          >
            Limpar conversa
          </button>
          {c.tipo !== "DIRETA" ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                fechar();
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

const DISTANCIA_DO_FIM = 40;

export function Conversa({ estado, e }) {
  const lista = useRef(null);
  const noFim = useRef(true);
  const ultimaVista = useRef(null);
  const [novas, setNovas] = useState(0);
  const grupos = agruparPorDia(e.mensagens);
  const mostrarAutor = e.conversa?.tipo !== "DIRETA";
  const quantas = e.mensagens.length;
  const ultima = e.mensagens.at(-1);
  const ultimaId = ultima?.id;

  const irParaOFim = () => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
    noFim.current = true;
    setNovas(0);
  };

  // Outra conversa: começa do fim de novo.
  useLayoutEffect(() => {
    noFim.current = true;
    ultimaVista.current = null;
    setNovas(0);
  }, [e.conversaId]);

  /*
    Ao abrir, rola para a última. Mensagem nova: rola se a pessoa já estava no
    fim (ou se foi ela quem enviou); lendo acima, conta em "↓ Novas mensagens".
    Carregar anteriores (a última não muda) não mexe na rolagem.
  */
  useLayoutEffect(() => {
    const el = lista.current;
    const antes = ultimaVista.current;
    ultimaVista.current = ultimaId ?? null;
    if (!el) return;
    if (ultimaId === antes || ultimaId == null) {
      if (noFim.current) el.scrollTop = el.scrollHeight;
      return;
    }
    const minha = String(ultima?.autor) === String(e.eu);
    if (antes == null || noFim.current || minha) irParaOFim();
    else setNovas((n) => n + 1);
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
      <div className="chat-conversa__corpo">
        <div
          className="chat-conversa__mensagens"
          ref={lista}
          onScroll={(ev) => {
            const el = ev.currentTarget;
            noFim.current =
              el.scrollHeight - el.scrollTop - el.clientHeight <
              DISTANCIA_DO_FIM;
            if (noFim.current && novas) setNovas(0);
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
                        String(grupo.mensagens[i - 1].autor) !==
                          String(m.autor))
                    }
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
        {novas ? (
          <button
            type="button"
            className="chat-conversa__novas"
            onClick={irParaOFim}
          >
            <i className="fa-solid fa-arrow-down" aria-hidden="true" />{" "}
            {novas === 1 ? "Nova mensagem" : `${novas} novas mensagens`}
          </button>
        ) : null}
      </div>
      <Digitando digitando={e.digitando} />
      <CampoDeEscrita key={e.conversaId} estado={estado} e={e} />
    </div>
  );
}
