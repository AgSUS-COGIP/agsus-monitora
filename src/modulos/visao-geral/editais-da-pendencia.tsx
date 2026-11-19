import {
  ACAO_DA_PENDENCIA,
  editaisDaPendencia,
  PENDENCIAS_POS_RESULTADO,
} from "../../lib/visao-geral/visao-geral.ts";
import { Gaveta } from "../../ui/index.ts";
import type { LinhaDaVisaoGeral, Pendencia } from "./tipos.ts";

/*
  "Pede ação" › uma pendência do pós-resultado (paineis.tsx): os editais dela,
  do mesmo recorte da página, cada um com a ação que a resolve ("Importar
  lista" ou "Atualizar status"). A ação é da tela (visao-geral.tsx): sai pela
  linha (a volta à Visão geral a destaca) e vai à tela já no edital. Quem não
  pode agir vê só a lista. "Mostrar só esses na página" é o filtro de antes.
*/

export interface PropsDosEditaisDaPendencia {
  codigo: Pendencia;
  /** As linhas do recorte da página (`e.filtradas`). */
  linhas: readonly LinhaDaVisaoGeral[];
  podeAgir: boolean;
  aoAgir: (linha: LinhaDaVisaoGeral) => void;
  /** O atalho da pendência está filtrando a página. */
  filtrando: boolean;
  aoFiltrar: () => void;
  aoFechar: () => void;
}

export function EditaisDaPendencia({
  codigo,
  linhas,
  podeAgir,
  aoAgir,
  filtrando,
  aoFiltrar,
  aoFechar,
}: PropsDosEditaisDaPendencia) {
  const editais = editaisDaPendencia(linhas, codigo);
  const titulo =
    PENDENCIAS_POS_RESULTADO.find((p) => p.codigo === codigo)?.rotulo || "";
  const acao = ACAO_DA_PENDENCIA[codigo];
  return (
    <Gaveta
      id="visaoGeralEditaisDaPendencia"
      tituloId="visaoGeralEditaisDaPendenciaTitulo"
      sobretitulo="Pede ação"
      titulo={titulo}
      resumo={`${editais.length} ${editais.length === 1 ? "edital" : "editais"}`}
      aoFechar={aoFechar}
      className="visao-geral-pendencia-gaveta"
    >
      <ul className="visao-geral-pendencia-editais" data-pendencia={codigo}>
        {editais.map((linha) => (
          <li key={String(linha.id)} data-edital={String(linha.id)}>
            <span className="visao-geral-pendencia-edital">
              <strong>{linha.edital || "Edital"}</strong>
              {linha.unidade ? (
                <span className="ui-texto-secundario">{linha.unidade}</span>
              ) : null}
            </span>
            {podeAgir ? (
              <button
                type="button"
                className="btn contorno small"
                data-acao={
                  codigo === "sem_lista" ? "importar-lista" : "atualizar-status"
                }
                onClick={() => aoAgir(linha)}
              >
                {acao.rotulo}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="ui-acoes">
        <button
          type="button"
          className="btn ghost small"
          aria-pressed={filtrando}
          onClick={aoFiltrar}
        >
          Mostrar só esses na página
        </button>
      </div>
    </Gaveta>
  );
}
