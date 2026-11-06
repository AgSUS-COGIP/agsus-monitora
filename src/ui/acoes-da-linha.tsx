import { MenuDeAcoes } from "./menu-de-acoes.tsx";
import type { AcaoDoMenu } from "./menu-de-acoes.tsx";

/*
  As ações de uma linha de tabela (`.ui-acoes-da-linha`): o botão principal
  (a ação mais comum daquela pessoa, com rótulo direto: "Abrir", "PDF",
  "Ver posição"; com `destaque`, azul, só quando há algo a fazer) e o "⋯"
  com o resto (MenuDeAcoes compacto, que abre preso
  à janela e não é cortado pela rolagem da tabela). Sem principal, só o "⋯";
  sem nada no menu, só o principal. `pessoa` entra no nome acessível do
  "⋯" ("Mais ações de 7000123"), para o leitor de tela saber de quem é.

  Confirmação fica com a tela: ação irreversível abre a confirmação (gaveta
  ou modal com motivo); as demais acontecem no clique.
*/

export interface AcaoPrincipalDaLinha {
  rotulo: string;
  icone?: string;
  aoClicar: () => void;
  desabilitado?: boolean;
  /** Texto do botão enquanto a ação roda ("Gerando PDF…"). */
  ocupado?: string | false;
  /** `data-acao` do botão (contrato de teste). */
  acao?: string;
  /** Título (dica) do botão. */
  titulo?: string;
  /** A ação que há a fazer na linha (Analisar, Incluir no lote): botão azul. */
  destaque?: boolean;
}

export interface PropriedadesDasAcoesDaLinha {
  pessoa: string;
  principal?: AcaoPrincipalDaLinha | null;
  outras?: readonly AcaoDoMenu[];
}

export function AcoesDaLinha({
  pessoa,
  principal = null,
  outras = [],
}: PropriedadesDasAcoesDaLinha) {
  if (!principal && !outras.length) return null;
  return (
    <span className="ui-acoes-da-linha">
      {principal ? (
        <button
          type="button"
          className={principal.destaque ? "btn small" : "btn contorno small"}
          data-acao={principal.acao}
          title={principal.titulo}
          disabled={principal.desabilitado || Boolean(principal.ocupado)}
          onClick={principal.aoClicar}
        >
          {principal.icone ? (
            <>
              <i
                className={`fa-solid ${principal.icone}`}
                aria-hidden="true"
              />{" "}
            </>
          ) : null}
          {principal.ocupado || principal.rotulo}
        </button>
      ) : null}
      {outras.length ? (
        <MenuDeAcoes
          compacto
          rotulo={`Mais ações de ${pessoa}`}
          acoes={outras}
        />
      ) : null}
    </span>
  );
}
