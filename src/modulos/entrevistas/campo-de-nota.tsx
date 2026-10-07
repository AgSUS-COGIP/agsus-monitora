import type { KeyboardEvent } from "react";
import { classes } from "../../ui/classes.js";

/*
  Campos da ficha de notas (ficha.jsx), compactos para caber os avaliadores
  lado a lado:

  - CampoDeNota: a nota digitada (o texto, "2" ou "2,5"); ao focar seleciona o
    que está escrito, para a próxima tecla trocar. `indice` marca a ordem do
    Enter (data-celula). Quem não lança vê só o número.
  - BotoesDeNota: as notas da escala em botões (0 a 5, com o nome do nível no
    título); escolher um preenche o campo em foco da competência e passa ao
    próximo.
*/

export type OpcaoDeNota = { valor: number; rotulo: string; descricao: string };

type PropriedadesDoCampo = {
  valor: string;
  rotulo: string;
  editavel: boolean;
  desabilitado?: boolean;
  invalida?: boolean;
  indice?: number;
  ativo?: boolean;
  titulo?: string;
  /** Chave da nota e competência (data-chave, data-competencia): o Enter e os botões acham o campo. */
  chave?: string;
  competencia?: string;
  competenciaIndice?: number;
  aoMudar: (valor: string) => void;
  aoTeclar: (evento: KeyboardEvent<HTMLInputElement>) => void;
  aoFocar?: () => void;
};

const numeroBR = (valor: string) =>
  valor === "" ? "—" : valor.replace(".", ",");

export function CampoDeNota({
  valor,
  rotulo,
  editavel,
  desabilitado = false,
  invalida = false,
  indice,
  ativo = false,
  titulo,
  chave,
  competencia,
  competenciaIndice,
  aoMudar,
  aoTeclar,
  aoFocar,
}: PropriedadesDoCampo) {
  if (!editavel)
    return (
      <span
        className="entrevistas-nota-fixa"
        aria-label={rotulo}
        title={titulo || undefined}
      >
        {numeroBR(valor)}
      </span>
    );
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      maxLength={5}
      className={classes(
        "entrevistas-nota",
        invalida && "is-invalida",
        ativo && "is-ativa",
      )}
      value={valor}
      aria-label={rotulo}
      aria-invalid={invalida || undefined}
      title={titulo || undefined}
      data-celula={indice}
      data-chave={chave}
      data-competencia={competencia}
      data-competencia-indice={competenciaIndice}
      disabled={desabilitado}
      onFocus={(e) => {
        e.currentTarget.select();
        aoFocar?.();
      }}
      onChange={(e) => aoMudar(e.target.value.replace(/[^\d.,]/g, ""))}
      onKeyDown={aoTeclar}
    />
  );
}

type PropriedadesDosBotoes = {
  opcoes: OpcaoDeNota[];
  atual: string | null;
  desabilitado?: boolean;
  rotulo: string;
  aoEscolher: (valor: number) => void;
};

export function BotoesDeNota({
  opcoes,
  atual,
  desabilitado = false,
  rotulo,
  aoEscolher,
}: PropriedadesDosBotoes) {
  return (
    <div
      className="entrevistas-botoes-de-nota"
      role="group"
      aria-label={rotulo}
    >
      {opcoes.map((o) => {
        const escolhida =
          atual !== null && Number(atual.replace(",", ".")) === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            className={classes(
              "entrevistas-botao-de-nota",
              escolhida && "is-escolhida",
            )}
            data-nota={o.valor}
            aria-pressed={escolhida}
            title={
              [o.rotulo, o.descricao].filter(Boolean).join(" — ") || undefined
            }
            disabled={desabilitado}
            // Não tira o foco do campo: o botão preenche o campo em foco.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => aoEscolher(o.valor)}
          >
            {String(o.valor).replace(".", ",")}
          </button>
        );
      })}
    </div>
  );
}
