import { useState } from "react";
import type { ReactNode } from "react";
import { editaisDaEscolha } from "../lib/avaliacao-documental/editais.ts";
import {
  editalEscolhido,
  sufixoDeTreinamento,
} from "../lib/edital-de-treinamento.ts";
import { Campo } from "../ui/index.ts";
import { SeloDeTreinamento } from "./selo-de-treinamento.tsx";

/*
  A escolha do edital das telas da seleção (Triagem, Avaliação documental e
  Classificação), no mesmo card (`.ui-card.ui-seletor-de-edital`): o campo
  "Edital" (número e unidade, mais o `complemento` de cada tela), o selo
  "Treinamento" do escolhido e, com `soVigentes`, só os editais vigentes, com
  "Mostrar todos os editais da área" quando há algum de fora (a regra é
  src/lib/avaliacao-documental/editais.ts). `children` entra ao lado (a
  origem da avaliação, na Avaliação documental).

  `className` guarda a classe de cada tela (`avd-edital`,
  `classificacao-edital`: contrato de teste e tour); `tour` é o `data-tour`
  do campo.
*/

export interface EditalDoSeletor {
  id: string;
  edital?: string | null;
  unidade?: string | null;
  ativo?: boolean | null;
}

export interface PropriedadesDoSeletorDeEdital<E extends EditalDoSeletor> {
  editais: readonly E[];
  escolhido: string;
  aoEscolher: (id: string) => void;
  carregado: boolean;
  soVigentes?: boolean;
  /** A primeira opção sem nenhum edital na área. */
  vazio?: string;
  /** Texto depois de "número - unidade" na opção (contagem, versão da regra). */
  complemento?: (edital: E) => string;
  /** O nome acessível do card. */
  rotulo?: string;
  className?: string;
  tour?: string;
  tourDosTodos?: string;
  /** "Mostrar todos" controlado pela tela (a entrada da Avaliação usa a mesma escolha). */
  todos?: boolean;
  aoMudarTodos?: (todos: boolean) => void;
  children?: ReactNode;
}

const TEXTO_SEM_EDITAL = "Nenhum edital nesta área";

export function SeletorDeEdital<E extends EditalDoSeletor>({
  editais,
  escolhido,
  aoEscolher,
  carregado,
  soVigentes = false,
  vazio = TEXTO_SEM_EDITAL,
  complemento,
  rotulo = "Edital",
  className,
  tour,
  tourDosTodos,
  todos: todosDaTela,
  aoMudarTodos,
  children,
}: PropriedadesDoSeletorDeEdital<E>) {
  const [todosProprio, setTodosProprio] = useState(false);
  const todos = todosDaTela ?? todosProprio;
  const setTodos = (sim: boolean) => {
    if (todosDaTela === undefined) setTodosProprio(sim);
    aoMudarTodos?.(sim);
  };
  const { lista, ocultos } = soVigentes
    ? editaisDaEscolha(editais, { todos, escolhido })
    : { lista: editais, ocultos: 0 };
  const primeira = !carregado
    ? "Carregando…"
    : lista.length
      ? "Escolha o edital"
      : editais.length
        ? "Nenhum edital vigente nesta área"
        : vazio;
  return (
    <section
      className={["ui-card ui-seletor-de-edital", className]
        .filter(Boolean)
        .join(" ")}
      aria-label={rotulo}
    >
      <Campo rotulo="Edital">
        <select
          value={escolhido}
          disabled={!carregado}
          data-tour={tour}
          onChange={(ev) => aoEscolher(ev.target.value)}
        >
          <option value="">{primeira}</option>
          {lista.map((ed) => (
            <option key={ed.id} value={ed.id}>
              {[ed.edital, ed.unidade].filter(Boolean).join(" - ")}
              {complemento?.(ed) ?? ""}
              {sufixoDeTreinamento(ed)}
            </option>
          ))}
        </select>
      </Campo>
      <SeloDeTreinamento edital={editalEscolhido(editais, escolhido)} />
      {soVigentes && (ocultos || todos) ? (
        <label className="ui-seletor-todos" data-tour={tourDosTodos}>
          <input
            type="checkbox"
            checked={todos}
            onChange={(ev) => setTodos(ev.target.checked)}
          />
          Mostrar todos os editais da área
        </label>
      ) : null}
      {children}
    </section>
  );
}
