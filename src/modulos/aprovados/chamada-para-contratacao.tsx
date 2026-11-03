import type { ReactNode } from "react";
import { useEffect, useSyncExternalStore } from "react";
import { resumoDoModelo } from "../../lib/configuracao-de-convocacao.ts";
import { formatNumberBR } from "../../lib/formatters";
import type {
  ConfiguracoesDaConvocacao,
  ModelosDaConvocacao,
} from "../../lib/tipos-da-configuracao-de-convocacao.ts";
import {
  BlocosEsqueleto,
  ErroAoCarregar,
  EstadoVazio,
  GradeDeKv,
  Kv,
} from "../../ui/index.ts";
import { FormularioDeConvocacao } from "./formulario-de-convocacao.tsx";
import type { EstadoDosAprovados } from "./tipos-do-estado.ts";

/*
  A Chamada para contratação de um edital (a configuração de convocação: tipo,
  modelo de regras e vagas imediatas), para ler e para editar:

  - `ResumoDaChamada`: só leitura. É a aba "Lista de convocação" do modal
    "Listas do edital", com "Editar nas Regras do edital".
  - `EditorDaChamada`: o formulário (formulario-de-convocacao.tsx, com o
    rascunho próprio) ligado à loja da Lista de aprovados — a MESMA do app
    (`window.aprovadosController.estado`): as mesmas RPCs
    (salvar_configuracao_convocacao, salvar/remover_modelo_convocacao) e,
    salvo, a Lista de aprovados já vê a convocação nova. Está nas Regras do
    edital, etapa Chamada para contratação.

  Quem configura: quem importa a lista de aprovados ou o administrador global
  (canConfigureCallList; o banco confere de novo); os outros veem o
  formulário travado.
*/

export function ResumoDaChamada({
  configs,
  modelos,
  editalId,
  acao,
}: {
  configs: ConfiguracoesDaConvocacao;
  modelos: ModelosDaConvocacao;
  editalId: string;
  /** O botão de editar (ou nada), no canto do resumo. */
  acao?: ReactNode;
}) {
  const config = configs.get(String(editalId)) ?? null;
  const modelo = config ? (modelos.get(config.modeloId) ?? null) : null;
  const vagas = config ? [...config.vagas.values()] : [];
  const imediatas = vagas.reduce((soma, v) => soma + (v.imediatas || 0), 0);
  return (
    <div className="resumo-da-chamada" data-tour="aprovados-resumo-da-chamada">
      {acao ? <div className="resumo-da-chamada__acao">{acao}</div> : null}
      {config ? (
        <GradeDeKv rotulo="Resumo da chamada para contratação">
          <Kv rotulo="Tipo de convocação">
            {config.proporcionalidade
              ? "Com reserva de vagas"
              : "Só pela classificação"}
          </Kv>
          <Kv rotulo="Modelo de regras">{modelo?.nome || "Sem modelo"}</Kv>
          <Kv rotulo="Reservas">{resumoDoModelo(modelo)}</Kv>
          <Kv rotulo="Vagas imediatas">
            {vagas.length
              ? `${formatNumberBR(imediatas)} em ${formatNumberBR(vagas.length)} ${vagas.length === 1 ? "vaga" : "vagas"}`
              : config.padraoImediata
                ? `${formatNumberBR(config.padraoImediata)} por vaga (padrão)`
                : "—"}
          </Kv>
        </GradeDeKv>
      ) : (
        <EstadoVazio>
          O edital ainda não tem configuração de convocação.
        </EstadoVazio>
      )}
    </div>
  );
}

/**
 * O editor da chamada do edital sobre a loja da Lista de aprovados. Pede a
 * carga ao montar (garantirCarregado: só relê se a área mudou) e cria o
 * rascunho quando os dados chegam; trocar de edital recomeça o rascunho.
 */
export function EditorDaChamada({
  estado,
  editalId,
}: {
  estado: EstadoDosAprovados;
  editalId: string;
}) {
  const dados = useSyncExternalStore(estado.assinar, estado.obter);
  useEffect(() => {
    void estado.garantirCarregado();
  }, [estado]);
  if (!dados.carregado && dados.erroAoCarregar)
    return (
      <ErroAoCarregar
        oQue="a configuração da chamada"
        mensagem={dados.erroAoCarregar}
        aoTentar={() => void estado.carregar()}
      />
    );
  if (!dados.carregado) return <BlocosEsqueleto quantos={2} />;
  return (
    <FormularioDeConvocacao
      key={editalId}
      estado={estado}
      perfil={dados.perfil}
      editalId={editalId}
      candidatos={dados.candidatos}
      configs={dados.configs}
      modelos={dados.modelos}
    />
  );
}
