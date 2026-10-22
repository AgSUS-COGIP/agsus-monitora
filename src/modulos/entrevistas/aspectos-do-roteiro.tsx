import {
  LIMITE_DE_ASPECTOS,
  MODELO_DE_ASPECTOS,
  moverItem,
  novoAspecto,
} from "../../lib/roteiro-de-entrevista.ts";
import { BotaoDeLinha } from "./partes.tsx";

/*
  Aspectos do roteiro (opcionais), no editor de roteiro (roteiros.tsx): cada
  avaliador dá uma nota em cada aspecto, na escala do roteiro, e a nota dele na
  competência é a média. Sem aspectos, uma nota por avaliador. O botão do
  modelo preenche os da planilha da Saúde Indígena.
*/

export type AspectoDoRascunho = { chave: string; nome: string };

type Propriedades = {
  valor: AspectoDoRascunho[];
  erros: Record<string, string | undefined>;
  somenteLeitura?: boolean;
  aoMudar: (aspectos: AspectoDoRascunho[]) => void;
};

const MODELO = MODELO_DE_ASPECTOS.join(" · ");

export function AspectosDoRoteiro({
  valor,
  erros,
  somenteLeitura = false,
  aoMudar,
}: Propriedades) {
  const trocarNome = (chave: string, nome: string) =>
    aoMudar(valor.map((a) => (a.chave === chave ? { ...a, nome } : a)));
  return (
    <div
      className="entrevistas-sublista entrevistas-aspectos-do-roteiro"
      aria-label="Aspectos de cada competência"
      data-tour="entrevistas-roteiros-aspectos"
    >
      {erros.aspectos ? (
        <small className="entrevistas-erro-campo" role="alert">
          {erros.aspectos}
        </small>
      ) : null}
      {valor.length ? (
        <ol className="entrevistas-linhas">
          {valor.map((a, indice) => {
            const erro = erros[`aspecto.${a.chave}`];
            return (
              <li key={a.chave} className="entrevistas-linha-aspecto">
                <span className="entrevistas-ordem">{indice + 1}º</span>
                <div className="ui-campo">
                  <label htmlFor={`entrevistasAspecto-${a.chave}`}>
                    Aspecto {indice + 1}
                  </label>
                  <input
                    id={`entrevistasAspecto-${a.chave}`}
                    type="text"
                    value={a.nome}
                    maxLength={60}
                    placeholder="Ex.: Conceitua"
                    disabled={somenteLeitura}
                    aria-invalid={erro ? true : undefined}
                    onChange={(e) => trocarNome(a.chave, e.target.value)}
                  />
                  {erro ? (
                    <small className="ui-campo-erro" role="alert">
                      {erro}
                    </small>
                  ) : null}
                </div>
                {somenteLeitura ? null : (
                  <span className="entrevistas-competencia-acoes">
                    <BotaoDeLinha
                      icone="fa-chevron-up"
                      rotulo={`Subir o aspecto ${indice + 1}`}
                      desabilitado={indice === 0}
                      aoClicar={() => aoMudar(moverItem(valor, indice, -1))}
                    />
                    <BotaoDeLinha
                      icone="fa-chevron-down"
                      rotulo={`Descer o aspecto ${indice + 1}`}
                      desabilitado={indice === valor.length - 1}
                      aoClicar={() => aoMudar(moverItem(valor, indice, 1))}
                    />
                    <BotaoDeLinha
                      icone="fa-trash"
                      rotulo={`Remover o aspecto ${indice + 1}`}
                      desabilitado={false}
                      aoClicar={() =>
                        aoMudar(valor.filter((x) => x.chave !== a.chave))
                      }
                    />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="entrevistas-vazio-linha">
          Sem aspectos: uma nota por avaliador.
        </p>
      )}
      {somenteLeitura ? null : (
        <div className="entrevistas-em-linha">
          <button
            type="button"
            className="btn secondary small"
            disabled={valor.length >= LIMITE_DE_ASPECTOS}
            onClick={() => aoMudar([...valor, novoAspecto()])}
          >
            <i className="fa-solid fa-plus" aria-hidden="true" /> Aspecto
          </button>
          <button
            type="button"
            className="btn secondary small"
            data-acao="modelo-de-aspectos"
            title={`Preenche: ${MODELO}`}
            onClick={() =>
              aoMudar(MODELO_DE_ASPECTOS.map((nome) => novoAspecto(nome)))
            }
          >
            <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />{" "}
            {MODELO}
          </button>
        </div>
      )}
    </div>
  );
}
