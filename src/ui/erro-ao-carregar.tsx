import { erroParaATela } from "../lib/erro-na-tela.ts";
import { Aviso } from "./aviso.tsx";

/*
  A primeira carga de uma tela (ou de um bloco) falhou: o que não veio, a
  mensagem curta e "Tentar novamente". Aviso `danger` com `role="alert"`;
  `className` acrescenta o espaçamento de quem usa; `id` e `idDoBotao`, o
  contrato de teste/DOM.
*/
export interface PropriedadesDoErroAoCarregar {
  oQue: string;
  mensagem?: string;
  aoTentar?: () => void;
  id?: string;
  idDoBotao?: string;
  className?: string;
}

export function ErroAoCarregar({
  id,
  idDoBotao,
  oQue,
  mensagem,
  aoTentar,
  className,
}: PropriedadesDoErroAoCarregar) {
  return (
    <Aviso tom="danger" papel="alert" className={className}>
      <span id={id} className="ui-erro-ao-carregar">
        <span>
          Não foi possível carregar {oQue}
          {/* O texto técnico vira frase que diz o que fazer (erro-na-tela.ts). */}
          {mensagem ? `: ${erroParaATela(mensagem)}` : "."}
        </span>
        {aoTentar ? (
          <button
            id={idDoBotao}
            type="button"
            className="btn secondary small"
            data-acao="tentar-novamente"
            onClick={aoTentar}
          >
            <i className="fa-solid fa-rotate-right" aria-hidden="true" /> Tentar
            novamente
          </button>
        ) : null}
      </span>
    </Aviso>
  );
}
