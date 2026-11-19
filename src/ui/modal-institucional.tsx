import type { ReactNode } from "react";
import { classes } from "./classes.ts";
import { FecharModal, Modal } from "./modal.tsx";
import "./modal-institucional.css";

/**
 * Estrutura de diálogo do Monitora alinhada à apresentação institucional
 * do AgSUS Comunica: identificação, título, orientação, conteúdo e ações.
 *
 * O Modal existente continua responsável por portal, foco, Esc, retorno
 * de foco e a pergunta de descarte (`alterado`). Nenhuma regra de negócio
 * ou de acesso é implementada aqui.
 */
export function ModalInstitucional({
  tituloId,
  titulo,
  contexto,
  descricao,
  icone = "fa-file-lines",
  aoFechar,
  alterado,
  aoDescartar,
  fecharDesabilitado = false,
  amplo = false,
  tour,
  classeDoCartao,
  classeDoConteudo,
  complemento,
  infoRodape,
  acoes,
  children,
}: {
  tituloId: string;
  titulo: string;
  contexto: string;
  descricao: string;
  icone?: string;
  aoFechar: () => void;
  alterado?: boolean;
  aoDescartar?: () => void;
  fecharDesabilitado?: boolean;
  amplo?: boolean;
  tour?: string;
  classeDoCartao?: string;
  classeDoConteudo?: string;
  complemento?: ReactNode;
  infoRodape?: ReactNode;
  acoes: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Modal
      rotuloId={tituloId}
      aoFechar={aoFechar}
      alterado={alterado}
      aoDescartar={aoDescartar}
      tour={tour}
      cartaoClassName={classes(
        "ui-modal-institucional",
        amplo && "ui-modal-institucional-amplo",
        classeDoCartao,
      )}
    >
      <header className="ui-modal-institucional-topo">
        <span className="ui-modal-institucional-icone" aria-hidden="true">
          <i className={`fa-solid ${icone}`} />
        </span>
        <div className="ui-modal-institucional-identidade">
          <span className="ui-modal-institucional-contexto">{contexto}</span>
          <h2 id={tituloId}>{titulo}</h2>
          <p>{descricao}</p>
        </div>
        <FecharModal
          className="ui-modal-institucional-fechar"
          aria-label="Fechar janela"
          title="Fechar"
          disabled={fecharDesabilitado}
        >
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </FecharModal>
      </header>
      {complemento ? (
        <div className="ui-modal-institucional-complemento">{complemento}</div>
      ) : null}
      <div
        className={classes("ui-modal-institucional-conteudo", classeDoConteudo)}
      >
        {children}
      </div>
      <footer className="ui-modal-institucional-rodape">
        <div className="ui-modal-institucional-rodape-info">{infoRodape}</div>
        <div className="ui-modal-institucional-acoes">{acoes}</div>
      </footer>
    </Modal>
  );
}
