import { useId } from "react";
import { Segmentado } from "../../ui/index.js";

/*
  As competências que um membro da banca avalia, na configuração do edital
  (conducao.tsx): "Todas" (o padrão; grava nulo) ou "Só estas" com uma caixa
  por competência do roteiro escolhido. Ex.: o colaborador do DSEI que avalia
  só "Trabalho em equipe". A regra (ao menos uma marcada; cada competência
  com alguém na banca) é de src/lib/conducao-de-entrevista.ts e do banco.
*/

export type CompetenciaDoMembro = { id: string; nome: string };

const OPCOES = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "algumas", rotulo: "Só estas" },
];

export function CompetenciasDoMembro({
  nome,
  competencias,
  valor,
  erro,
  aoMudar,
}: {
  /** O nome do membro (rótulos acessíveis). */
  nome: string;
  competencias: CompetenciaDoMembro[];
  /** null = todas; lista = só estas. */
  valor: string[] | null;
  erro?: string;
  aoMudar: (valor: string[] | null) => void;
}) {
  const id = useId();
  const algumas = Array.isArray(valor);
  const marcadas = new Set(valor || []);
  const quem = nome.trim() || "o membro";
  return (
    <fieldset
      className="entrevistas-competencias-do-membro"
      aria-describedby={erro ? `${id}-erro` : undefined}
    >
      <legend>Competências que avalia</legend>
      <Segmentado
        rotulo={`Competências que ${quem} avalia`}
        className="entrevistas-competencias-modo"
        opcoes={OPCOES}
        valor={algumas ? "algumas" : "todas"}
        aoMudar={(modo: string) =>
          aoMudar(modo === "todas" ? null : [...marcadas])
        }
      />
      {algumas ? (
        <div className="entrevistas-competencias-caixas">
          {competencias.map((c) => (
            <label key={c.id} className="entrevistas-competencia-caixa">
              <input
                type="checkbox"
                checked={marcadas.has(c.id)}
                onChange={(e) => {
                  const nova = new Set(marcadas);
                  if (e.target.checked) nova.add(c.id);
                  else nova.delete(c.id);
                  // Na ordem do roteiro.
                  aoMudar(
                    competencias.map((x) => x.id).filter((x) => nova.has(x)),
                  );
                }}
              />{" "}
              {c.nome}
            </label>
          ))}
        </div>
      ) : null}
      {erro ? (
        <small className="ui-campo-erro" id={`${id}-erro`} role="alert">
          {erro}
        </small>
      ) : null}
    </fieldset>
  );
}
