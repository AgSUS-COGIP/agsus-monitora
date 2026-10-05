import { useId, useState } from "react";
import {
  buscarEmojis,
  CATEGORIAS_DE_EMOJI,
  guardarRecente,
  itensDosRecentes,
  lerRecentes,
} from "../../lib/emojis-do-chat.js";

/*
  Seletor de emoji do campo de escrita (vai no chunk do painel, sem
  biblioteca): busca por nome em português, "Recentes" (guardados no
  navegador) e as categorias da lista própria (src/lib/emojis-do-chat.js).
  Escolher insere no cursor (quem decide é o campo, por `aoEscolher`) e deixa o
  seletor aberto para escolher mais; Escape e clique fora fecham (no campo).
*/

const ICONES = Object.freeze({
  recentes: "🕘",
  carinhas: "😀",
  gestos: "👍",
  trabalho: "💼",
  simbolos: "✅",
  celebracao: "🎉",
});

function armazenamentoDoNavegador() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function SeletorDeEmoji({
  aoEscolher,
  armazenamento = armazenamentoDoNavegador(),
}) {
  const [busca, setBusca] = useState("");
  const [recentes, setRecentes] = useState(() => lerRecentes(armazenamento));
  const [aba, setAba] = useState(() =>
    recentes.length ? "recentes" : CATEGORIAS_DE_EMOJI[0].id,
  );
  const idDaBusca = useId();

  const abas = [
    ...(recentes.length ? [{ id: "recentes", rotulo: "Recentes" }] : []),
    ...CATEGORIAS_DE_EMOJI,
  ];
  const buscando = busca.trim().length > 0;
  const itens = buscando
    ? buscarEmojis(busca)
    : aba === "recentes"
      ? itensDosRecentes(recentes)
      : (
          CATEGORIAS_DE_EMOJI.find((c) => c.id === aba) ||
          CATEGORIAS_DE_EMOJI[0]
        ).emojis;
  const rotuloDaGrade = buscando
    ? "Resultado da busca"
    : abas.find((a) => a.id === aba)?.rotulo || "Emojis";

  function escolher(emoji) {
    setRecentes(guardarRecente(armazenamento, emoji));
    aoEscolher(emoji);
  }

  return (
    <div className="chat-emojis" role="dialog" aria-label="Emojis">
      <label className="sr-only" htmlFor={idDaBusca}>
        Buscar emoji
      </label>
      <input
        id={idDaBusca}
        type="search"
        className="chat-emojis__busca"
        placeholder="Buscar emoji"
        value={busca}
        autoComplete="off"
        onChange={(ev) => setBusca(ev.target.value)}
        onKeyDown={(ev) => {
          // Enter escolhe o primeiro (e não envia a mensagem pelo formulário).
          if (ev.key !== "Enter") return;
          ev.preventDefault();
          if (itens[0]) escolher(itens[0].emoji);
        }}
      />
      {buscando ? null : (
        <div className="chat-emojis__abas" role="tablist" aria-label="Grupos">
          {abas.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={a.id === aba ? "true" : "false"}
              aria-label={a.rotulo}
              title={a.rotulo}
              onClick={() => setAba(a.id)}
            >
              <span aria-hidden="true">{ICONES[a.id]}</span>
            </button>
          ))}
        </div>
      )}
      {itens.length ? (
        <div
          className="chat-emojis__grade"
          role="group"
          aria-label={rotuloDaGrade}
        >
          {itens.map((item) => (
            <button
              key={item.emoji}
              type="button"
              className="chat-emojis__emoji"
              title={item.nome}
              aria-label={item.nome}
              onClick={() => escolher(item.emoji)}
            >
              {item.emoji}
            </button>
          ))}
        </div>
      ) : (
        <p className="chat-emojis__vazio">Nenhum emoji encontrado.</p>
      )}
    </div>
  );
}
