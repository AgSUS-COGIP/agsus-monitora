import { Component, Fragment } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { referenciaCurta } from "../lib/seguranca/registro-de-erros.ts";
import { registrarErro } from "./registro-de-erros.ts";

/*
  Isola um módulo (uma tela, uma parte da casca): erro de render num filho mostra
  um aviso curto no lugar dele, sem derrubar o resto da página. "Tentar de
  novo" remonta os filhos do zero (a `key` muda), e o erro vai para o console
  e para o registro dos erros (src/app/registro-de-erros.ts): o aviso mostra o
  código curto ("Código do erro: 3F2A9C1B") que a pessoa passa ao suporte.

  Não pega erro de evento nem de promessa — esses continuam com quem os trata
  (toast, aviso do estado). Cada tela do app tem o seu (src/app/telas.tsx), e
  cada parte da casca e cada portal avulso também (src/app/casca/pecas.tsx,
  src/app/portais-avulsos.tsx).

  `mensagem` troca o texto do aviso e `aoTentarDeNovo` roda antes de remontar
  (a tela sob demanda que não baixou refaz o `lazy`: src/app/telas.tsx).
*/
type PropsDoErrorBoundary = {
  nome?: string | undefined;
  mensagem?: string | undefined;
  aoTentarDeNovo?: (() => void) | undefined;
  children?: ReactNode;
};

type EstadoDoErrorBoundary = {
  erro: unknown;
  tentativa: number;
  /** A referência do registro do erro (null até o componentDidCatch). */
  referencia: string | null;
};

export class ErrorBoundary extends Component<
  PropsDoErrorBoundary,
  EstadoDoErrorBoundary
> {
  constructor(props: PropsDoErrorBoundary) {
    super(props);
    this.state = { erro: null, tentativa: 0, referencia: null };
    this.tentarDeNovo = this.tentarDeNovo.bind(this);
  }

  static getDerivedStateFromError(erro: unknown) {
    return { erro };
  }

  componentDidCatch(erro: unknown, info: ErrorInfo) {
    console.error(
      `[Yeendé] Erro ao desenhar ${this.props.nome || "o módulo"}:`,
      erro,
      info?.componentStack || "",
    );
    const referencia = registrarErro({
      erro,
      origem: "tela",
      parte: this.props.nome || "módulo",
    });
    this.setState({ referencia });
  }

  tentarDeNovo() {
    this.props.aoTentarDeNovo?.();
    this.setState((atual) => ({
      erro: null,
      tentativa: atual.tentativa + 1,
      referencia: null,
    }));
  }

  render() {
    if (this.state.erro)
      return (
        <div className="ui-erro-do-modulo" role="alert">
          <p>
            {this.props.mensagem ||
              "Não foi possível mostrar esta parte da tela."}
          </p>
          {this.state.referencia ? (
            <p className="ui-erro-do-modulo__codigo">
              Código do erro: {referenciaCurta(this.state.referencia)}
            </p>
          ) : null}
          <button
            type="button"
            className="btn secondary"
            onClick={this.tentarDeNovo}
          >
            Tentar de novo
          </button>
        </div>
      );
    return (
      <Fragment key={this.state.tentativa}>{this.props.children}</Fragment>
    );
  }
}
