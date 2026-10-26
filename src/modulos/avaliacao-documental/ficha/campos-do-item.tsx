import {
  itemCompleto,
  titulosDoNivel,
} from "../../../lib/avaliacao-documental/ficha.ts";
import type { Bloco, ItemLancado } from "./tipos.ts";

/*
  Os campos de uma linha de título, curso ou vínculo: o mesmo formulário na
  linha digitada à mão (item-da-ficha.tsx: Itens) e no "Corrigir" do item
  lido do arquivo (leitura-dos-arquivos.tsx). Só mostra e devolve a mudança.
*/

export type ChaveDosItens = "titulos" | "cursos" | "vinculos";

type TituloDoNivel = { codigo: string; rotulo: string; pontos: number };

export function CamposDoItem({
  chave,
  bloco,
  nivel,
  item,
  pedeCampos,
  desabilitado,
  aoAlterar,
}: {
  chave: ChaveDosItens;
  bloco: Bloco;
  nivel: string | null | undefined;
  item: ItemLancado;
  /** O campo que falta fica marcado. */
  pedeCampos: boolean;
  desabilitado: boolean;
  aoAlterar: (campos: Partial<ItemLancado>) => void;
}) {
  const categorias = bloco.categorias || [];
  const titulos =
    chave === "titulos"
      ? (titulosDoNivel(bloco, nivel) as TituloDoNivel[])
      : [];
  const falta = pedeCampos && !itemCompleto(chave, item);
  return (
    <>
      {chave === "titulos" ? (
        <select
          aria-label="Título"
          value={item.titulo}
          disabled={desabilitado}
          onChange={(ev) => aoAlterar({ titulo: ev.target.value })}
        >
          {titulos.map((t) => (
            <option key={t.codigo} value={t.codigo}>
              {t.rotulo}
              {t.pontos ? ` (${t.pontos})` : ""}
            </option>
          ))}
        </select>
      ) : null}
      {chave === "vinculos" ? (
        <input
          aria-label="Empregador ou cargo"
          placeholder="Empregador ou cargo"
          value={item.empregador || ""}
          maxLength={200}
          disabled={desabilitado}
          onChange={(ev) => aoAlterar({ empregador: ev.target.value })}
        />
      ) : (
        <input
          aria-label={chave === "cursos" ? "Curso" : "Curso ou instituição"}
          placeholder={chave === "cursos" ? "Curso" : "Curso ou instituição"}
          value={item.nome || ""}
          maxLength={200}
          disabled={desabilitado}
          onChange={(ev) => aoAlterar({ nome: ev.target.value })}
        />
      )}
      {chave === "cursos" ? (
        <input
          aria-label="Carga horária"
          className="avd-ficha-item-curto"
          type="number"
          min="0"
          max="20000"
          inputMode="numeric"
          placeholder="Horas"
          aria-invalid={falta ? true : undefined}
          value={item.horas ?? ""}
          disabled={desabilitado}
          onChange={(ev) =>
            aoAlterar({
              horas: ev.target.value === "" ? "" : Number(ev.target.value),
            })
          }
        />
      ) : null}
      {chave === "vinculos" ? (
        <>
          {categorias.length > 1 ? (
            <select
              aria-label="Categoria"
              value={item.categoria}
              disabled={desabilitado}
              onChange={(ev) => aoAlterar({ categoria: ev.target.value })}
            >
              {categorias.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.rotulo || c.codigo}
                </option>
              ))}
            </select>
          ) : null}
          {(["inicio", "fim"] as const).map((campo) => (
            <input
              key={campo}
              aria-label={campo === "inicio" ? "Início" : "Fim"}
              className="avd-ficha-item-data"
              type="date"
              // Marca o que falta; com as duas datas e o período inválido, as duas.
              aria-invalid={
                falta && (!item[campo] || (item.inicio && item.fim))
                  ? true
                  : undefined
              }
              value={item[campo] || ""}
              disabled={desabilitado}
              onChange={(ev) => aoAlterar({ [campo]: ev.target.value })}
            />
          ))}
        </>
      ) : null}
    </>
  );
}
