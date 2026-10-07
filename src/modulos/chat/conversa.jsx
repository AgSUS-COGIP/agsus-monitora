import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  agruparPorDia,
  cartaoDoLink,
  extrairMencoes,
  horaCurta,
  inserirMencao,
  inserirNoCursor,
  LIMITE_DO_TEXTO,
  mencaoEmDigitacao,
  mencionaMe,
  outrasPessoas,
  partesDoTexto,
  presencaDe,
  REACOES_RAPIDAS,
  resumoDasReacoes,
  rotuloDaPresenca,
  sugestoesDeMencao,
  textoDaCitacao,
  vistoPor,
} from "../../lib/chat.js";
import {
  ACEITA_NO_SELETOR_DO_CHAT,
  ehImagem,
  iconeDoAnexo,
  imagensColadas,
  juntarAnexos,
  nomeDoPrint,
  rotuloDoAnexo,
} from "../../lib/anexos-do-chat.js";
import { safeHttpUrl } from "../../lib/sanitize.js";
import { irParaLink, linkDaTelaAtual } from "./ponte.js";
import { SeletorDeEmoji } from "./seletor-de-emoji.jsx";

/*
  A conversa aberta no painel: mensagens agrupadas por dia (Hoje, Ontem,
  02/10), menções destacadas (e a mensagem que menciona você), cartões dos
  links internos (tela, edital, ficha da avaliação documental: título e
  "Abrir" para quem tem a página), anexos (miniatura da imagem; arquivo por
  URL assinada curta), citação (clicar rola até a original), "Encaminhada",
  Visto (✓ enviada, ✓✓ vista; no grupo, quem viu no título), reações rápidas,
  o menu "⋯" de cada mensagem (reagir, responder, encaminhar, copiar; na
  própria, editar e apagar — sempre à vista, para funcionar no toque),
  "digitando…", "↓ Novas mensagens" e o campo de escrita (Enter envia,
  Shift+Enter quebra linha, @ sugere pessoas, emojis, anexar, colar print
  com Ctrl+V, arrastar arquivo, Compartilhar esta tela). No menu da conversa:
  fixar, marcar como não lida, silenciar, limpar (para mim).
*/

const AVISO_DO_LIMITE = LIMITE_DO_TEXTO - 500;
const DESTAQUE_MS = 2500;

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
  if (!mensagem.texto) return null;
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

/* Cartão do link interno: título, detalhe e "Abrir" (só para quem tem a página). */
export function CartaoDoLink({ link, paginas }) {
  const cartao = cartaoDoLink(link, paginas);
  if (!cartao) return null;
  return (
    <div className="chat-cartao" data-tipo={cartao.tipo}>
      <i
        className={`fa-solid ${cartao.icone} chat-cartao__icone`}
        aria-hidden="true"
      />
      <span className="chat-cartao__corpo">
        <strong>{cartao.titulo}</strong>
        {cartao.detalhe ? <small>{cartao.detalhe}</small> : null}
      </span>
      {cartao.podeAbrir ? (
        <button
          type="button"
          className="btn secondary small"
          onClick={() => irParaLink(cartao.link)}
        >
          Abrir
        </button>
      ) : (
        <small className="chat-cartao__sem-acesso">Sem acesso</small>
      )}
    </div>
  );
}

/* Miniatura da imagem: a prévia local (enviando) ou a URL assinada curta. */
function MiniaturaDoAnexo({ estado, anexo, aoAbrir }) {
  const local =
    typeof anexo.previa === "string" && anexo.previa.startsWith("blob:")
      ? anexo.previa
      : "";
  const [url, setUrl] = useState(local);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    if (local || !anexo.caminho) return undefined;
    let vivo = true;
    estado
      .urlDoAnexo(anexo)
      .then((u) => vivo && setUrl(safeHttpUrl(u || "")))
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, [estado, anexo.caminho, local]);
  return (
    <button
      type="button"
      className="chat-anexo chat-anexo--imagem"
      onClick={aoAbrir}
      title={rotuloDoAnexo(anexo)}
      aria-label={`Baixar ${anexo.nome}`}
      disabled={!aoAbrir}
    >
      {url && !falhou ? (
        <img src={url} alt="" loading="lazy" onError={() => setFalhou(true)} />
      ) : (
        <i className="fa-solid fa-file-image" aria-hidden="true" />
      )}
    </button>
  );
}

function AnexosDaMensagem({ estado, mensagem }) {
  const anexos = mensagem.anexos || [];
  if (!anexos.length) return null;
  const enviando = Boolean(mensagem.pendente || mensagem.falhou);
  return (
    <ul className="chat-anexos" aria-label="Anexos">
      {anexos.map((a) => (
        <li key={a.id}>
          {ehImagem(a.mime) ? (
            <MiniaturaDoAnexo
              estado={estado}
              anexo={a}
              aoAbrir={enviando ? null : () => void estado.baixarAnexo(a)}
            />
          ) : (
            <button
              type="button"
              className="chat-anexo"
              disabled={enviando}
              onClick={() => void estado.baixarAnexo(a)}
              aria-label={`Baixar ${a.nome}`}
            >
              <i
                className={`fa-solid ${iconeDoAnexo(a.mime)}`}
                aria-hidden="true"
              />
              <span>{rotuloDoAnexo(a)}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/* A citação na mensagem (Responder): clicar rola até a original. */
function CitacaoDaMensagem({ estado, e, resposta }) {
  if (!resposta?.id) return null;
  return (
    <button
      type="button"
      className="chat-citacao"
      onClick={() => void estado.irParaMensagem(e.conversaId, resposta.id)}
      title="Ir para a mensagem"
    >
      <strong>
        {String(resposta.autor) === String(e.eu)
          ? "Você"
          : nomeDe(e.conversa, resposta.autor)}
      </strong>
      <span>{textoDaCitacao(resposta)}</span>
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

/* ✓ enviada, ✓✓ vista (direta) ou vista por todos (grupo); quem viu no título. */
function Visto({ mensagem, conversa, eu }) {
  const visto = vistoPor(mensagem, conversa, eu);
  if (!visto) return null;
  const direta = conversa?.tipo === "DIRETA";
  const rotulo = direta
    ? visto.todos
      ? "Vista"
      : "Enviada"
    : visto.viram.length
      ? `Visto por: ${visto.viram.join(", ")}`
      : "Ninguém viu ainda";
  return (
    <span
      className={`chat-visto${visto.todos ? " is-vista" : ""}`}
      title={rotulo}
      aria-label={rotulo}
      data-visto={visto.viram.length}
    >
      {visto.todos || (!direta && visto.viram.length) ? "✓✓" : "✓"}
    </span>
  );
}

/* O "⋯" de cada mensagem: reagir, responder, encaminhar, copiar e, na própria, editar e apagar. */
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
            onClick={fazer(() => estado.responder(mensagem.id))}
          >
            <i className="fa-solid fa-reply" aria-hidden="true" /> Responder
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={fazer(() => estado.pedirEncaminhamento(mensagem.id))}
          >
            <i className="fa-solid fa-share" aria-hidden="true" /> Encaminhar
          </button>
          {mensagem.texto ? (
            <button
              type="button"
              role="menuitem"
              onClick={fazer(() => void copiarTexto(estado, mensagem.texto))}
            >
              <i className="fa-solid fa-copy" aria-hidden="true" /> Copiar texto
            </button>
          ) : null}
          {minha ? (
            <>
              {mensagem.texto ? (
                <button type="button" role="menuitem" onClick={fazer(aoEditar)}>
                  <i className="fa-solid fa-pen" aria-hidden="true" /> Editar
                </button>
              ) : null}
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
  const mencionada = !minha && mencionaMe(mensagem, e.eu);

  return (
    <li
      className={`chat-msg${minha ? " is-minha" : ""}${mensagem.falhou ? " is-falhou" : ""}${temMenu ? " tem-menu" : ""}${mencionada ? " is-mencionada" : ""}`}
      data-mensagem={mensagem.id}
    >
      {mostrarAutor && !minha ? (
        <strong className="chat-msg__autor">
          {nomeDe(e.conversa, mensagem.autor)}
        </strong>
      ) : null}
      {mensagem.encaminhada ? (
        <small className="chat-msg__encaminhada">
          <i className="fa-solid fa-share" aria-hidden="true" /> Encaminhada
        </small>
      ) : null}
      <CitacaoDaMensagem estado={estado} e={e} resposta={mensagem.resposta} />
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
          {mensagem.link ? (
            <CartaoDoLink link={mensagem.link} paginas={e.paginas} />
          ) : null}
        </>
      )}
      <AnexosDaMensagem estado={estado} mensagem={mensagem} />
      <ReacoesDaMensagem estado={estado} e={e} mensagem={mensagem} />
      <small className="chat-msg__hora" aria-live="polite">
        {mensagem.pendente
          ? "Enviando…"
          : mensagem.falhou
            ? "Não enviada"
            : `${horaCurta(mensagem.criada_em)}${mensagem.editada_em ? " · editada" : ""}`}
        <Visto mensagem={mensagem} conversa={e.conversa} eu={e.eu} />
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

/* Um anexo escolhido no campo: miniatura (imagem) ou ícone, nome e tirar. */
function ChipDoAnexo({ anexo, aoTirar }) {
  const [previa, setPrevia] = useState("");
  useEffect(() => {
    if (anexo.familia !== "imagem") return undefined;
    let url = "";
    try {
      url = globalThis.URL?.createObjectURL?.(anexo.arquivo) || "";
    } catch {
      url = "";
    }
    setPrevia(url);
    return () => {
      if (url) globalThis.URL?.revokeObjectURL?.(url);
    };
  }, [anexo]);
  const nome = anexo.arquivo?.name || "arquivo";
  return (
    <li className="chat-escrita__anexo">
      {previa ? (
        <img src={previa} alt="" />
      ) : (
        <i
          className={`fa-solid ${iconeDoAnexo(anexo.mime)}`}
          aria-hidden="true"
        />
      )}
      <span title={nome}>{nome}</span>
      <button
        type="button"
        className="chat-icone"
        aria-label={`Tirar ${nome}`}
        onClick={aoTirar}
      >
        <i className="fa-solid fa-xmark" aria-hidden="true" />
      </button>
    </li>
  );
}

/* Print colado sem nome útil ("image.png"): ganha o nome com a data e a hora. */
function comNomeDePrint(arquivo, agora) {
  const ext = String(arquivo.type || "image/png").split("/")[1] || "png";
  const nome = nomeDoPrint(agora, ext === "jpeg" ? "jpg" : ext);
  try {
    return new File([arquivo], nome, { type: arquivo.type || "image/png" });
  } catch {
    return arquivo;
  }
}

function CampoDeEscrita({ estado, e }) {
  const [texto, setTexto] = useState("");
  // "Compartilhar esta ficha": o cartão escolhido fora do painel espera aqui.
  const [link, setLink] = useState(() =>
    e.linkPendente?.conversa === e.conversaId ? e.linkPendente.link : null,
  );
  const [anexos, setAnexos] = useState([]);
  const [cursor, setCursor] = useState(0);
  const [indice, setIndice] = useState(0);
  const [comEmojis, setComEmojis] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const campo = useRef(null);
  const seletorDeArquivo = useRef(null);
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
  const podeMandar =
    (texto.trim() || anexos.length || link) && texto.length <= LIMITE_DO_TEXTO;

  useEffect(() => {
    campo.current?.focus();
    if (e.linkPendente?.conversa === e.conversaId)
      estado.consumirLinkPendente(e.conversaId);
  }, [e.conversaId]);
  // Responder: o foco volta para o campo.
  useEffect(() => {
    if (e.resposta) campo.current?.focus();
  }, [e.resposta]);

  function juntar(arquivos) {
    const { anexos: lista, recusados } = juntarAnexos(anexos, arquivos);
    setAnexos(lista);
    for (const r of recusados) estado.avisar(`${r.nome}: ${r.erro}`);
  }

  async function enviar() {
    if (!podeMandar) return;
    const mencoes = extrairMencoes(texto, pessoas);
    const enviado = texto;
    const comAnexos = anexos;
    setTexto("");
    setLink(null);
    setAnexos([]);
    setCursor(0);
    setComEmojis(false);
    // Falhou: a mensagem fica na conversa como "Não enviada", com Tentar de novo.
    await estado.enviar(enviado, {
      link,
      mencoes,
      anexos: comAnexos,
      resposta: e.resposta,
    });
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

  /* Ctrl+V com imagem (print): vira anexo; texto colado segue normal. */
  function aoColar(ev) {
    const imagens = imagensColadas(ev.clipboardData);
    if (!imagens.length) return;
    ev.preventDefault();
    const agora = new Date();
    juntar(
      imagens.map((img) =>
        !img.name || /^image\.[a-z]+$/i.test(img.name)
          ? comNomeDePrint(img, agora)
          : img,
      ),
    );
  }

  const compartilhar = () => {
    const atual = linkDaTelaAtual();
    if (atual) setLink(atual);
    else estado.avisar("Esta tela não tem link para compartilhar.");
  };

  const cartao = link ? cartaoDoLink(link, e.paginas) : null;

  return (
    <form
      className={`chat-escrita${arrastando ? " is-arrastando" : ""}`}
      data-tour="chat-escrita"
      onSubmit={(ev) => {
        ev.preventDefault();
        void enviar();
      }}
      onKeyDown={comEmojis ? escapeFecha(fecharEmojis) : undefined}
      onDragOver={(ev) => {
        if (!Array.from(ev.dataTransfer?.types || []).includes("Files")) return;
        ev.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(ev) => {
        if (!ev.dataTransfer?.files?.length) return;
        ev.preventDefault();
        setArrastando(false);
        juntar(ev.dataTransfer.files);
      }}
    >
      {e.resposta ? (
        <div className="chat-escrita__resposta" data-tour="chat-resposta">
          <i className="fa-solid fa-reply" aria-hidden="true" />
          <span>
            <strong>
              {String(e.resposta.autor) === String(e.eu)
                ? "Você"
                : nomeDe(e.conversa, e.resposta.autor)}
            </strong>
            {textoDaCitacao(e.resposta)}
          </span>
          <button
            type="button"
            className="chat-icone"
            aria-label="Não responder"
            onClick={() => estado.cancelarResposta()}
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {cartao ? (
        <div className="chat-escrita__link">
          <i className={`fa-solid ${cartao.icone}`} aria-hidden="true" />
          <span>{cartao.link.rotulo}</span>
          <button
            type="button"
            className="chat-icone"
            aria-label="Tirar o cartão"
            onClick={() => setLink(null)}
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {anexos.length ? (
        <ul className="chat-escrita__anexos" aria-label="Anexos">
          {anexos.map((a, i) => (
            <ChipDoAnexo
              key={`${a.arquivo?.name}-${i}`}
              anexo={a}
              aoTirar={() => setAnexos((atual) => atual.filter((x) => x !== a))}
            />
          ))}
        </ul>
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
        onPaste={aoColar}
      />
      <input
        ref={seletorDeArquivo}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        multiple
        accept={ACEITA_NO_SELETOR_DO_CHAT}
        onChange={(ev) => {
          juntar(ev.target.files);
          ev.target.value = "";
        }}
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
          className="chat-icone chat-escrita__anexar"
          aria-label="Anexar arquivo"
          title="Anexar arquivo"
          data-tour="chat-anexar"
          onClick={() => seletorDeArquivo.current?.click()}
        >
          <i className="fa-solid fa-paperclip" aria-hidden="true" />
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
        <button type="submit" className="btn small" disabled={!podeMandar}>
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
  const participa = c.participa !== false;
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
        data-tour="chat-opcoes-da-conversa"
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
          {participa ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  fechar();
                  void estado.fixar(c.id, !c.fixada_em);
                }}
              >
                {c.fixada_em ? "Soltar do topo" : "Fixar no topo"}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  fechar();
                  void estado.marcarNaoLida(c.id);
                }}
              >
                Marcar como não lida
              </button>
            </>
          ) : null}
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
  /* Altura, rolagem e quantidade ao pedir as anteriores: { altura, topo, quantas }. */
  const antesDasAnteriores = useRef(null);
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
    antesDasAnteriores.current = null;
    setNovas(0);
  }, [e.conversaId]);

  /*
    Ao abrir, rola para a última. Mensagem nova: rola se a pessoa já estava no
    fim (ou se foi ela quem enviou); lendo acima, conta em "↓ Novas mensagens".
    Carregar anteriores (a última não muda) mantém na tela a mensagem que a
    pessoa via: soma à rolagem a altura que entrou acima.
  */
  useLayoutEffect(() => {
    const el = lista.current;
    const antes = ultimaVista.current;
    ultimaVista.current = ultimaId ?? null;
    if (!el) return;
    if (ultimaId === antes || ultimaId == null) {
      const anteriores = antesDasAnteriores.current;
      if (anteriores && quantas > anteriores.quantas) {
        antesDasAnteriores.current = null;
        el.scrollTop = anteriores.topo + (el.scrollHeight - anteriores.altura);
      } else if (noFim.current) el.scrollTop = el.scrollHeight;
      return;
    }
    const minha = String(ultima?.autor) === String(e.eu);
    if (antes == null || noFim.current || minha) irParaOFim();
    else setNovas((n) => n + 1);
  }, [ultimaId, quantas]);

  // Busca ou citação: rola até a mensagem e destaca por um instante.
  useEffect(() => {
    const id = e.destaque?.id;
    if (!id || !lista.current) return undefined;
    const alvo = lista.current.querySelector(
      `[data-mensagem="${globalThis.CSS?.escape ? CSS.escape(id) : id}"]`,
    );
    if (!alvo) return undefined;
    noFim.current = false;
    alvo.scrollIntoView?.({ block: "center" });
    alvo.classList.add("is-destaque");
    const fim = setTimeout(
      () => alvo.classList.remove("is-destaque"),
      DESTAQUE_MS,
    );
    return () => {
      clearTimeout(fim);
      alvo.classList.remove("is-destaque");
    };
  }, [e.destaque]);

  const participantes = outrasPessoas(e.conversa, e.eu);
  const online = participantes.filter((p) => p.online).length;

  return (
    <div className="chat-conversa">
      <div className="chat-conversa__topo">
        <small data-presenca={presencaDe(participantes[0])}>
          {e.conversa?.fixada_em ? (
            <i
              className="fa-solid fa-thumbtack chat-conversa__fixada"
              title="Fixada no topo"
              aria-label="Fixada no topo"
            />
          ) : null}
          {e.conversa?.tipo === "DIRETA"
            ? rotuloDaPresenca(participantes[0])
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
                const el = lista.current;
                if (el)
                  antesDasAnteriores.current = {
                    altura: el.scrollHeight,
                    topo: el.scrollTop,
                    quantas,
                  };
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
