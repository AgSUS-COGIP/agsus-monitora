import { Children, cloneElement, isValidElement, useId } from "react";
import { classes } from "./classes.js";

/*
  O campo das telas (`.ui-campo`): rótulo
  em cima, controle embaixo, dica e erro embaixo. O primeiro `<input>`, `<select>` ou `<textarea>` filho ganha o id do
  rótulo (ou fica com o que já tem — contrato de teste/DOM) e `aria-invalid`
  quando há erro. `largo` ocupa a linha inteira da grade. Controle que não é
  um desses (a seleção múltipla, um botão) recebe o id de `idDoControle`.
*/

const CONTROLES = ["input", "select", "textarea"];

export function Campo({
  rotulo,
  erro,
  dica,
  obrigatorio,
  largo,
  idDoControle,
  children,
}) {
  const idGerado = useId();
  const gerado = idDoControle || idGerado;
  let id = gerado;
  let ligado = false;
  const filhos = Children.map(children, (filho) => {
    if (ligado || !isValidElement(filho) || !CONTROLES.includes(filho.type))
      return filho;
    ligado = true;
    id = filho.props.id || gerado;
    return cloneElement(filho, {
      id,
      "aria-invalid": erro ? true : undefined,
    });
  });
  return (
    <div className={classes("ui-campo", largo && "ui-campo-largo")}>
      <label htmlFor={id}>
        {rotulo}
        {obrigatorio ? <abbr title="obrigatório"> *</abbr> : null}
      </label>
      {filhos}
      {dica ? <small className="ui-campo-dica">{dica}</small> : null}
      {erro ? (
        <small className="ui-campo-erro" role="alert">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />{" "}
          {erro}
        </small>
      ) : null}
    </div>
  );
}
