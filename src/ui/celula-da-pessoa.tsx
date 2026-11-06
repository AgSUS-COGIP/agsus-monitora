/*
  A célula "Pessoa" das listas da seleção (`.ui-pessoa`): o nome em
  destaque e, embaixo, "código · modalidade" em cinza. Sem círculo de
  iniciais.
*/

/** O nome e, embaixo, "código · modalidade" (a mesma célula nas três telas). */
export function CelulaDaPessoa({
  nome,
  codigo,
  modalidade,
}: {
  nome?: string | null;
  codigo?: string | number | null;
  modalidade?: string | null;
}) {
  return (
    <span className="ui-pessoa">
      <strong>{nome || "—"}</strong>
      <span>{[codigo, modalidade].filter(Boolean).join(" · ")}</span>
    </span>
  );
}
