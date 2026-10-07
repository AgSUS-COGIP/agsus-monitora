import { useId, useState } from "react";
import {
  perguntaDoTexto,
  textoDaPergunta,
} from "../../lib/avaliacao-documental/regra.js";
import { Campo } from "../../ui/index.js";

/*
  Peças de formulário da regra da avaliação documental (só desenho; o formato
  e a validação são de src/lib/avaliacao-documental/regra.js).
*/

const numeroOuTexto = (texto) => {
  const t = String(texto ?? "")
    .trim()
    .replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : texto;
};
const textoDoNumero = (valor) =>
  valor === null || valor === undefined ? "" : String(valor).replace(".", ",");

/** Separa "a; b; c" em lista (a regra guarda listas; a tela mostra com ";"). */
export const listaDoTexto = (texto) =>
  String(texto ?? "")
    .split(/[;\n]/)
    .map((t) => t.trim())
    .filter(Boolean);

/* Muda um valor dentro do objeto pelo caminho, sem mexer no original. */
export function comValor(objeto, caminho, valor) {
  const copia = structuredClone(objeto);
  let alvo = copia;
  caminho.slice(0, -1).forEach((chave, i) => {
    if (alvo[chave] === undefined || alvo[chave] === null)
      alvo[chave] = typeof caminho[i + 1] === "number" ? [] : {};
    alvo = alvo[chave];
  });
  alvo[caminho.at(-1)] = valor;
  return copia;
}

/**
 * @param {object} p
 * @param {import("react").ReactNode} p.rotulo
 * @param {unknown} p.valor
 * @param {(valor: number | string | null) => void} p.aoMudar
 * @param {import("react").ReactNode} [p.dica]
 * @param {boolean} [p.largo]
 */
export function CampoNumero({ rotulo, valor, aoMudar, dica, largo }) {
  return (
    <Campo rotulo={rotulo} dica={dica} largo={largo}>
      <input
        inputMode="decimal"
        value={textoDoNumero(valor)}
        onChange={(ev) => aoMudar(numeroOuTexto(ev.target.value))}
      />
    </Campo>
  );
}

/**
 * @param {object} p
 * @param {import("react").ReactNode} p.rotulo
 * @param {string | null | undefined} p.valor
 * @param {(valor: string) => void} p.aoMudar
 * @param {number} [p.maximo]
 * @param {boolean} [p.largo]
 */
export function CampoTexto({ rotulo, valor, aoMudar, maximo = 200, largo }) {
  return (
    <Campo rotulo={rotulo} largo={largo}>
      <input
        value={valor ?? ""}
        maxLength={maximo}
        onChange={(ev) => aoMudar(ev.target.value)}
      />
    </Campo>
  );
}

/**
 * A pergunta da regra: o começo do enunciado ou alternativas separadas por
 * ";" (vira lista). Guarda o que foi digitado para não comer os espaços.
 */
/**
 * @param {object} p
 * @param {import("react").ReactNode} p.rotulo
 * @param {string | string[] | null | undefined} p.valor
 * @param {(valor: string | string[]) => void} p.aoMudar
 * @param {boolean} [p.largo]
 */
export function CampoPergunta({ rotulo, valor, aoMudar, largo }) {
  const [digitado, setDigitado] = useState(() => textoDaPergunta(valor));
  const mesmo =
    JSON.stringify(perguntaDoTexto(digitado)) ===
    JSON.stringify(perguntaDoTexto(textoDaPergunta(valor)));
  return (
    <Campo rotulo={rotulo} largo={largo}>
      <input
        value={mesmo ? digitado : textoDaPergunta(valor)}
        onChange={(ev) => {
          setDigitado(ev.target.value);
          aoMudar(perguntaDoTexto(ev.target.value));
        }}
      />
    </Campo>
  );
}

export function CampoLista({ rotulo, valor, aoMudar, largo }) {
  return (
    <Campo rotulo={rotulo} largo={largo}>
      <input
        value={(valor ?? []).join("; ")}
        onChange={(ev) => aoMudar(listaDoTexto(ev.target.value))}
      />
    </Campo>
  );
}

/**
 * @param {object} p
 * @param {import("react").ReactNode} p.rotulo
 * @param {string | null | undefined} p.valor
 * @param {ReadonlyArray<readonly [string, string]>} p.opcoes
 * @param {(valor: string | null) => void} p.aoMudar
 * @param {string} [p.vazio]
 */
export function Escolha({ rotulo, valor, opcoes, aoMudar, vazio }) {
  return (
    <Campo rotulo={rotulo}>
      <select
        value={valor ?? ""}
        onChange={(ev) => aoMudar(ev.target.value || null)}
      >
        {vazio !== undefined ? <option value="">{vazio}</option> : null}
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
    </Campo>
  );
}

/**
 * @param {object} p
 * @param {import("react").ReactNode} p.rotulo
 * @param {boolean | undefined} p.marcado
 * @param {(marcado: boolean) => void} p.aoMudar
 */
export function Caixa({ rotulo, marcado, aoMudar }) {
  const id = useId();
  return (
    <label className="avd-caixa" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={Boolean(marcado)}
        onChange={(ev) => aoMudar(ev.target.checked)}
      />{" "}
      {rotulo}
    </label>
  );
}

/** @param {{ rotulo: string, aoClicar: () => void }} p */
export function BotaoTirar({ rotulo, aoClicar }) {
  return (
    <button
      type="button"
      className="btn danger small"
      aria-label={rotulo}
      title={rotulo}
      onClick={aoClicar}
    >
      <i className="fa-solid fa-xmark" aria-hidden="true" />
    </button>
  );
}

/** @param {{ children?: import("react").ReactNode, aoClicar: () => void }} p */
export function BotaoMais({ children, aoClicar }) {
  return (
    <button type="button" className="btn secondary small" onClick={aoClicar}>
      <i className="fa-solid fa-plus" aria-hidden="true" /> {children}
    </button>
  );
}
