import { Component, Fragment } from "react";

/*
  Isola um módulo (uma tela, uma ilha React): erro de render num filho mostra
  um aviso curto no lugar dele, sem derrubar o resto da página. "Tentar de
  novo" remonta os filhos do zero (a `key` muda), e o erro vai para o console.

  Não pega erro de evento nem de promessa — esses continuam com quem os trata
  (toast, aviso do estado). Montado por `montarModulo` (montar-modulo.jsx).
*/
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null, tentativa: 0 };
    this.tentarDeNovo = this.tentarDeNovo.bind(this);
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error(
      `[MONITORA] Erro ao desenhar ${this.props.nome || "o módulo"}:`,
      erro,
      info?.componentStack || "",
    );
  }

  tentarDeNovo() {
    this.setState((atual) => ({ erro: null, tentativa: atual.tentativa + 1 }));
  }

  render() {
    if (this.state.erro)
      return (
        <div className="ui-erro-do-modulo" role="alert">
          <p>Não foi possível mostrar esta parte da tela.</p>
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
