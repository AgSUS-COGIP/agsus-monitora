import { useId, useState, type ReactNode } from "react";
import {
  perguntaDoTexto,
  textoDaPergunta,
} from "../../lib/avaliacao-documental/regra.ts";
import type { Pergunta } from "../../lib/avaliacao-documental/tipos-da-regra.ts";
import { Campo } from "../../ui/index.ts";

/*
  Peças de formulário da regra da avaliação documental (só desenho; o formato
  e a validação são de src/lib/avaliacao-documental/regra.ts).
*/

/**
 * O que um campo de número devolve: o número, null (vazio) ou, se o digitado
 * não é número, o próprio texto (a validação da regra recusa).
 */
export type NumeroDigitado = number | string | null;

/** Um caminho dentro do objeto: chaves e índices de lista. */
export type Caminho = ReadonlyArray<string | number>;

const numeroOuTexto = (texto: string): NumeroDigitado => {
  const t = String(texto ?? "")
    .trim()
    .replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : texto;
};
const textoDoNumero = (valor: unknown): string =>
  valor === null || valor === undefined ? "" : String(valor).replace(".", ",");

/** Separa "a; b; c" em lista (a regra guarda listas; a tela mostra com ";"). */
export const listaDoTexto = (texto: string | null | undefined): string[] =>
  String(texto ?? "")
    .split(/[;\n]/)
    .map((t) => t.trim())
    .filter(Boolean);

/*
  Muda um valor dentro do objeto pelo caminho, sem mexer no original. O valor
  não é conferido aqui: a cópia sai com o tipo do original, e quem confere a
  regra é validarRegraAnalise.
*/
export function comValor<T>(objeto: T, caminho: Caminho, valor: unknown): T {
  const copia = structuredClone(objeto);
  let alvo = copia as Record<string | number, unknown>;
  caminho.slice(0, -1).forEach((chave, i) => {
    if (alvo[chave] === undefined || alvo[chave] === null)
      alvo[chave] = typeof caminho[i + 1] === "number" ? [] : {};
    alvo = alvo[chave] as Record<string | number, unknown>;
  });
  alvo[caminho.at(-1) as string | number] = valor;
  return copia;
}

export interface CampoNumeroProps {
  rotulo: ReactNode;
  valor: unknown;
  aoMudar: (valor: NumeroDigitado) => void;
  dica?: ReactNode;
  largo?: boolean;
}

export function CampoNumero({
  rotulo,
  valor,
  aoMudar,
  dica,
  largo,
}: CampoNumeroProps) {
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

export interface CampoTextoProps {
  rotulo: ReactNode;
  valor: string | null | undefined;
  aoMudar: (valor: string) => void;
  maximo?: number;
  largo?: boolean;
}

export function CampoTexto({
  rotulo,
  valor,
  aoMudar,
  maximo = 200,
  largo,
}: CampoTextoProps) {
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

export interface CampoPerguntaProps {
  rotulo: ReactNode;
  valor: Pergunta | null | undefined;
  aoMudar: (valor: Pergunta) => void;
  largo?: boolean;
}

/**
 * A pergunta da regra: o começo do enunciado ou alternativas separadas por
 * ";" (vira lista). Guarda o que foi digitado para não comer os espaços.
 */
export function CampoPergunta({
  rotulo,
  valor,
  aoMudar,
  largo,
}: CampoPerguntaProps) {
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

export interface CampoListaProps {
  rotulo: ReactNode;
  valor: ReadonlyArray<string> | null | undefined;
  aoMudar: (valor: string[]) => void;
  largo?: boolean;
}

export function CampoLista({ rotulo, valor, aoMudar, largo }: CampoListaProps) {
  return (
    <Campo rotulo={rotulo} largo={largo}>
      <input
        value={(valor ?? []).join("; ")}
        onChange={(ev) => aoMudar(listaDoTexto(ev.target.value))}
      />
    </Campo>
  );
}

export interface EscolhaProps {
  rotulo: ReactNode;
  valor: string | null | undefined;
  /** Pares [valor, rótulo] (as listas de catalogo.ts). */
  opcoes: ReadonlyArray<readonly [string, string]>;
  /** null quando escolhe a opção vazia. */
  aoMudar: (valor: string | null) => void;
  /** O rótulo da opção vazia (sem ele, não há opção vazia). */
  vazio?: string;
}

export function Escolha({
  rotulo,
  valor,
  opcoes,
  aoMudar,
  vazio,
}: EscolhaProps) {
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

export interface CaixaProps {
  rotulo: ReactNode;
  marcado: boolean | undefined;
  aoMudar: (marcado: boolean) => void;
}

export function Caixa({ rotulo, marcado, aoMudar }: CaixaProps) {
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

export interface BotaoTirarProps {
  /** O nome acessível e a dica do botão (só tem o ícone). */
  rotulo: string;
  aoClicar: () => void;
}

export function BotaoTirar({ rotulo, aoClicar }: BotaoTirarProps) {
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

export interface BotaoMaisProps {
  children?: ReactNode;
  aoClicar: () => void;
}

export function BotaoMais({ children, aoClicar }: BotaoMaisProps) {
  return (
    <button type="button" className="btn secondary small" onClick={aoClicar}>
      <i className="fa-solid fa-plus" aria-hidden="true" /> {children}
    </button>
  );
}
