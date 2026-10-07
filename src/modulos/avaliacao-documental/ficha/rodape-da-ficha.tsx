import type { ReactNode } from "react";

/*
  O rodapé fixo da ficha, mínimo: "Salvo às 10:43" (ou o aviso rápido de
  "Código copiado"), Anterior / Próximo item e o botão primário do momento —
  "Próximo pendente", "Revisar e concluir" ou, na Conclusão, "Concluir e
  próxima" com "Salvar rascunho". Na ficha só de leitura, o estado e o
  Reabrir (coordenação).
*/

export type AcaoDoRodape = {
  rotulo: string;
  acao: string;
  aoClicar: () => void;
  desabilitado?: boolean;
  dica?: string;
};

export type PropriedadesDoRodape = {
  estado: string;
  aviso?: string;
  erro?: string;
  anterior?: AcaoDoRodape | null;
  proximo?: AcaoDoRodape | null;
  secundaria?: AcaoDoRodape | null;
  primaria?: AcaoDoRodape | null;
  /** O "Reabrir" da coordenação (ficha concluída). */
  children?: ReactNode;
};

function Botao({
  a,
  className,
  icone,
  depois,
}: {
  a: AcaoDoRodape;
  className: string;
  icone?: string;
  depois?: boolean;
}) {
  const i = icone ? (
    <i className={`fa-solid ${icone}`} aria-hidden="true" />
  ) : null;
  return (
    <button
      type="button"
      className={className}
      data-acao={a.acao}
      disabled={a.desabilitado}
      title={a.dica}
      onClick={a.aoClicar}
    >
      {depois ? null : i}
      <span>{a.rotulo}</span>
      {depois ? i : null}
    </button>
  );
}

export function RodapeDaFicha({
  estado,
  aviso,
  erro,
  anterior,
  proximo,
  secundaria,
  primaria,
  children,
}: PropriedadesDoRodape) {
  return (
    <div
      className="ui-gaveta-rodape avd-ficha-barra"
      data-tour="avd-ficha-barra"
    >
      <div className="avd-ficha-andamento">
        <span className="avd-ficha-salvo" role="status">
          {estado}
        </span>
        {aviso ? (
          <span className="avd-ficha-aviso-rapido" role="status">
            {aviso}
          </span>
        ) : null}
        {erro ? (
          <span className="avd-ficha-erro" role="alert">
            {erro}
          </span>
        ) : null}
      </div>
      {children}
      <div className="avd-ficha-barra-acoes">
        {anterior || proximo ? (
          <span className="avd-ficha-passo-a-passo">
            {anterior ? (
              <Botao
                a={anterior}
                className="btn ghost avd-ficha-seta"
                icone="fa-chevron-left"
              />
            ) : null}
            {proximo ? (
              <Botao
                a={proximo}
                className="btn ghost avd-ficha-seta"
                icone="fa-chevron-right"
                depois
              />
            ) : null}
          </span>
        ) : null}
        {secundaria ? <Botao a={secundaria} className="btn secondary" /> : null}
        {primaria ? (
          <Botao a={primaria} className="btn avd-ficha-primaria" />
        ) : null}
      </div>
    </div>
  );
}
