import type { ReactNode } from "react";
import type {
  IdDaSecao,
  PendenciaDoRoteiro,
} from "../../lib/pendencias-do-roteiro.ts";

/*
  Peças do editor do roteiro (roteiros.tsx): a seção recolhível (título,
  uma linha do que está nela e o selo de erros) e a lista do que falta perto
  do Salvar — clicar num item abre a seção dele. As regras ficam em
  src/lib/pendencias-do-roteiro.ts.
*/

export function SecaoRecolhivel({
  id,
  titulo,
  icone,
  resumo,
  erros = 0,
  aberta,
  aoAlternar,
  children,
}: {
  id: IdDaSecao;
  titulo: string;
  icone: string;
  resumo?: ReactNode;
  erros?: number;
  aberta: boolean;
  aoAlternar: (id: IdDaSecao, aberta: boolean) => void;
  children: ReactNode;
}) {
  return (
    <details
      className="entrevistas-secao-do-roteiro"
      data-secao={id}
      data-com-erro={erros ? "sim" : undefined}
      open={aberta}
      onToggle={(ev) => {
        const agora = (ev.currentTarget as HTMLDetailsElement).open;
        if (agora !== aberta) aoAlternar(id, agora);
      }}
    >
      <summary>
        <i className={`fa-solid ${icone}`} aria-hidden="true" />
        <span className="entrevistas-secao-do-roteiro-titulo">{titulo}</span>
        {erros ? (
          <span className="entrevistas-secao-do-roteiro-erros">
            {erros === 1 ? "1 ponto" : `${erros} pontos`}
          </span>
        ) : null}
        {resumo ? (
          <span className="entrevistas-secao-do-roteiro-resumo">{resumo}</span>
        ) : null}
      </summary>
      <div className="entrevistas-secao-corpo">{children}</div>
    </details>
  );
}

export function PendenciasDoRoteiro({
  pendencias,
  destacar,
  aoIr,
}: {
  pendencias: PendenciaDoRoteiro[];
  /** Depois de tentar salvar: em vermelho e anunciado. */
  destacar: boolean;
  aoIr: (secao: IdDaSecao) => void;
}) {
  if (!pendencias.length)
    return (
      <p className="entrevistas-pronto-para-salvar" role="status">
        <i className="fa-solid fa-circle-check" aria-hidden="true" /> Tudo certo
        para salvar.
      </p>
    );
  const mostrar = pendencias.slice(0, 4);
  const resto = pendencias.length - mostrar.length;
  return (
    <div
      className="entrevistas-pendencias entrevistas-pendencias-do-roteiro"
      role={destacar ? "alert" : "status"}
      data-destaque={destacar ? "sim" : undefined}
      data-tour="entrevistas-roteiros-pendencias"
    >
      <strong>
        <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />{" "}
        {pendencias.length === 1
          ? "Falta 1 ponto para salvar"
          : `Faltam ${pendencias.length} pontos para salvar`}
      </strong>
      <ul>
        {mostrar.map((p) => (
          <li key={p.chave}>
            <button
              type="button"
              className="entrevistas-link"
              onClick={() => aoIr(p.secao)}
            >
              {p.texto}
            </button>
          </li>
        ))}
        {resto > 0 ? (
          <li className="entrevistas-pendencias-mais">
            e mais {resto === 1 ? "1 ponto" : `${resto} pontos`}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
