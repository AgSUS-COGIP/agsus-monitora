import type { EstadoDaAcao } from "../../../ui/botao-de-acao.tsx";
import type {
  FormatoDaExportacao,
  PedidoDaExportacao,
} from "../../../lib/exportacao-da-lista-de-aprovados.ts";
import { useEffect, useRef, useState } from "react";
import { BotaoDeAcao, Modal, Segmentado } from "../../../ui/index.ts";
import {
  contarRegistros,
  FORMATOS_DA_EXPORTACAO,
} from "../../../lib/exportacao-da-lista-de-aprovados.ts";
import { OPCOES_DO_FILTRO_DE_STATUS } from "../../../lib/lista-aprovados-rules.ts";
import { formatNumberBR } from "../../../lib/formatters";
import { plural } from "../partes.tsx";

/*
  O modal do botão "Exportar" da aba Aprovados: o que vai sair (registros,
  editais e filtros da tela), o formato (XLSX, CSV ou PDF) e "Exportar", que
  registra no banco, gera o arquivo e baixa. Durante a geração o botão mostra
  o progresso; fechar o modal antes do fim descarta o arquivo. A aba Resumo
  por cargo usa o mesmo modal com `titulo` e `aoExportar` próprios (o mesmo
  recorte e o mesmo registro, outro conteúdo).
*/

export interface EstadoDaExportacao extends EstadoDaAcao {
  exportarLista: (
    pedido: PedidoDaExportacao,
    formato: FormatoDaExportacao,
    seguir?: () => boolean,
  ) => Promise<boolean>;
}

const ROTULO_DA_SITUACAO = new Map(
  OPCOES_DO_FILTRO_DE_STATUS.map((o) => [o.value, o.label]),
);

function Filtro({
  rotulo,
  valores,
}: {
  rotulo: string;
  valores: readonly string[];
}) {
  if (!valores.length) return null;
  return (
    <li>
      <strong>{rotulo}:</strong> {valores.join("; ")}
    </li>
  );
}

export function ModalDaExportacao({
  estado,
  pedido,
  aoFechar,
  titulo = "Exportar a lista de aprovados",
  aoExportar,
}: {
  estado: EstadoDaExportacao;
  pedido: PedidoDaExportacao;
  aoFechar: () => void;
  titulo?: string;
  aoExportar?: (
    pedido: PedidoDaExportacao,
    formato: FormatoDaExportacao,
    seguir: () => boolean,
  ) => Promise<boolean>;
}) {
  const [formato, setFormato] = useState<FormatoDaExportacao>("XLSX");
  const aberto = useRef(true);
  useEffect(() => {
    aberto.current = true;
    return () => {
      aberto.current = false;
    };
  }, []);
  const registros = contarRegistros(pedido.candidatos);
  const semEdital = pedido.editais.length === 0;

  async function exportar() {
    const ok = await (aoExportar ?? estado.exportarLista)(
      pedido,
      formato,
      () => aberto.current,
    );
    if (ok && aberto.current) aoFechar();
  }

  return (
    <Modal
      id="approvedExportModal"
      className="approved-modal"
      cartaoClassName="approved-modal-card"
      rotuloId="approvedExportTitle"
      aoFechar={aoFechar}
      tamanho="medio"
    >
      <div className="modal-head">
        <div>
          <h3 id="approvedExportTitle">{titulo}</h3>
          <p className="approved-modal-subtitle" id="approvedExportResumo">
            {plural(registros, "registro", "registros")}
            {registros !== pedido.totalDoRecorte
              ? ` de ${formatNumberBR(pedido.totalDoRecorte)} na lista vigente`
              : ""}{" "}
            · {pedido.rotuloDaArea}
          </p>
        </div>
        <button className="btn secondary" type="button" onClick={aoFechar}>
          Fechar
        </button>
      </div>
      <div className="modal-body">
        <ul className="approved-export-filtros" data-export-filtros>
          <li>
            <strong>
              {pedido.editais.length === 1 ? "Edital" : "Editais"}:
            </strong>{" "}
            {semEdital
              ? "nenhum com candidatos"
              : pedido.todosOsEditais
                ? `todos os da área (${pedido.editais.length})`
                : pedido.editais.map((e) => e.rotulo).join("; ")}
          </li>
          <Filtro rotulo="Cargo" valores={pedido.cargos} />
          <Filtro rotulo="Modalidade" valores={pedido.modalidades} />
          <Filtro
            rotulo="Situação"
            valores={pedido.situacoes.map(
              (s) => ROTULO_DA_SITUACAO.get(s) ?? s,
            )}
          />
          {pedido.recorteDoAviso ? (
            <li>
              <strong>Recorte:</strong> só as vagas da pessoa do aviso
            </li>
          ) : null}
        </ul>
        <Segmentado
          rotulo="Formato do arquivo"
          opcoes={FORMATOS_DA_EXPORTACAO}
          valor={formato}
          aoMudar={setFormato}
        />
        <div className="approved-modal-actions">
          <button className="btn secondary" type="button" onClick={aoFechar}>
            Cancelar
          </button>
          <BotaoDeAcao
            estado={estado}
            acao="exportar"
            id="approvedExportConfirmar"
            className="btn green"
            disabled={semEdital}
            data-foco-inicial
            onClick={() => void exportar()}
          >
            <i className="fa-solid fa-download" aria-hidden="true" /> Exportar
          </BotaoDeAcao>
        </div>
      </div>
    </Modal>
  );
}
