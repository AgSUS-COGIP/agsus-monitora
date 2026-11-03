import { useMemo } from "react";
import { irParaTela } from "../../app/ir-para-tela.ts";
import {
  ETAPAS_DAS_REGRAS,
  type EtapaDasRegras,
} from "../../lib/regras-do-edital.ts";
import type { ClienteDaRegra } from "../../lib/triagem/regra-da-triagem.ts";
import { Segmentado } from "../../ui/index.ts";
import { EditorDaRegraDaTriagem } from "../triagem/editor-da-regra.tsx";
import type { Avisar } from "../avaliacao-documental/tipos-do-estado.ts";
import type { EstadoDosAprovados } from "../aprovados/tipos-do-estado.ts";
import {
  EtapaDaAvaliacao,
  EtapaDaChamada,
  EtapaDaClassificacao,
  EtapaDaEntrevista,
} from "./etapas.tsx";
import { lojasDasRegras } from "./lojas.ts";
import "../aprovados/convocacao.css";
import "../avaliacao-documental/avaliacao-documental.css";
import "../avaliacao-documental/ficha/ficha.css";
import "../classificacao/classificacao.css";
import "../entrevistas/entrevistas.css";
import "./regras-do-edital.css";

/*
  Regras do edital (Editais › Regras do edital): numa página só, por edital,
  todas as regras do processo, na ordem das etapas — 1 Triagem, 2 Avaliação
  documental, 3 Entrevista, 4 Classificação e 5 Chamada para contratação.

  Cada etapa usa o editor (e as RPCs) que já existia, e todas editam aqui,
  com a permissão de sempre (o banco decide: coordenação do edital, gestor
  da classificação, quem configura a entrevista ou a convocação, ou o
  administrador global); quem não pode vê a regra travada. A Entrevista edita
  o roteiro e a banca (editor-da-configuracao.tsx, loja de condução) e a
  Chamada para contratação, a configuração de convocação
  (chamada-para-contratacao.tsx, loja da Lista de aprovados). Salvar não
  recalcula nada (o 114/2026 segue congelado).

  As telas de cada etapa mostram a regra resumida com "Editar nas Regras do
  edital", que abre esta página na etapa certa (abrir.ts). Carrega sob
  demanda: o pacote dos editores só baixa quando a página abre.
*/

/** O mínimo do cliente do banco que as etapas usam. */
export type ClienteDasRegras = ClienteDaRegra & { auth?: unknown };

export interface PropriedadesDasRegras {
  editalId: string;
  titulo: string;
  etapa: EtapaDasRegras;
  supabase: ClienteDasRegras | null;
  toast?: Avisar;
  aoMudarEtapa: (etapa: EtapaDasRegras) => void;
  aoVoltar: () => void;
  /** A loja da Lista de aprovados do app (para a Chamada para contratação). */
  aprovados: () => Promise<EstadoDosAprovados | null | undefined>;
}

export default function RegrasDoEdital({
  editalId,
  titulo,
  etapa,
  supabase,
  toast,
  aoMudarEtapa,
  aoVoltar,
  aprovados,
}: PropriedadesDasRegras) {
  const lojas = useMemo(
    () => (supabase ? lojasDasRegras(supabase, toast) : null),
    [supabase, toast],
  );
  return (
    <div
      className="ui-tela regras-do-edital"
      data-tour="regras-do-edital"
      data-etapa={etapa}
    >
      <header className="ui-card regras-do-edital__topo">
        <button
          type="button"
          className="btn outline small"
          data-acao="voltar-aos-editais"
          onClick={aoVoltar}
        >
          <i className="fa-solid fa-arrow-left" aria-hidden="true" /> Editais
        </button>
        <h2 className="ui-titulo" id="regrasDoEditalTitulo">
          Regras do edital{titulo ? ` ${titulo}` : ""}
        </h2>
        <Segmentado
          rotulo="Etapa"
          className="regras-do-edital__etapas"
          opcoes={ETAPAS_DAS_REGRAS}
          valor={etapa}
          aoMudar={aoMudarEtapa}
          tour="regras-do-edital-etapas"
        />
      </header>

      {!supabase || !lojas ? null : etapa === "triagem" ? (
        <EditorDaRegraDaTriagem
          key={editalId}
          edital={editalId}
          cliente={supabase}
        />
      ) : etapa === "avaliacao" ? (
        <EtapaDaAvaliacao lojas={lojas} editalId={editalId} />
      ) : etapa === "entrevista" ? (
        <EtapaDaEntrevista
          lojas={lojas}
          editalId={editalId}
          aoIrParaClassificacao={() => aoMudarEtapa("classificacao")}
          aoIrParaPreparar={() =>
            void irParaTela({
              view: "conduzir-entrevistas",
              edital: { id: editalId, titulo },
            })
          }
        />
      ) : etapa === "classificacao" ? (
        <EtapaDaClassificacao lojas={lojas} editalId={editalId} />
      ) : (
        <EtapaDaChamada aprovados={aprovados} editalId={editalId} />
      )}
    </div>
  );
}
