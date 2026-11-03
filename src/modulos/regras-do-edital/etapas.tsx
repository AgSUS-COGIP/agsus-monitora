import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Regra as RegraDaAvaliacao } from "../avaliacao-documental/regra.tsx";
import { Regra as RegraDaClassificacao } from "../classificacao/regra.tsx";
import { ResumoDasRegras } from "../entrevistas/resumo-das-regras.tsx";
import type { DadosDoEdital as DadosDaEntrevista } from "../entrevistas/tipos.ts";
import { dataDeCorteDoCronograma } from "../../lib/classificacao/dados.ts";
import { convocacaoDoEdital } from "../../lib/classificacao/convocacao-do-edital.ts";
import { resumoDoModelo } from "../../lib/configuracao-de-convocacao.ts";
import {
  criteriosDeDesempate,
  textoDoEmpateFinal,
} from "../../lib/convocacao-da-entrevista.ts";
import type {
  DestinoDoResumo,
  EntradaDoResumo,
} from "../../lib/resumo-da-entrevista.ts";
import { formatNumberBR } from "../../lib/formatters";
import {
  BlocosEsqueleto,
  ErroAoCarregar,
  EstadoVazio,
  GradeDeKv,
  Kv,
} from "../../ui/index.ts";
import type { LojasDasRegras } from "./lojas.ts";
import type { ClienteDasRegras } from "./regras-do-edital.tsx";

/*
  As etapas das Regras do edital que não têm editor próprio na pasta da
  Triagem: cada uma monta o editor (ou o resumo) que a tela da etapa já tinha,
  com a mesma loja e as mesmas RPCs. Nada aqui calcula ou grava por conta
  própria: salvar é o que o editor de cada etapa já fazia.
*/

const mensagem = (erro: unknown) =>
  String((erro as { message?: unknown })?.message || erro || "erro");

/* ── 2 Avaliação documental: a regra da análise (assistente e modo avançado) ── */
export function EtapaDaAvaliacao({
  lojas,
  editalId,
}: {
  lojas: LojasDasRegras;
  editalId: string;
}) {
  const estado = lojas.avaliacao;
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  useEffect(() => {
    void estado.escolherEdital(editalId);
  }, [estado, editalId]);
  if (e.erroDoEdital && e.editalId === editalId)
    return (
      <ErroAoCarregar
        oQue="a regra da Avaliação documental"
        mensagem={e.erroDoEdital}
        aoTentar={() => void estado.escolherEdital(editalId)}
      />
    );
  if (e.editalId !== editalId || !e.dados)
    return <BlocosEsqueleto quantos={3} />;
  return (
    <div className="avd-tela regras-do-edital__editor">
      <RegraDaAvaliacao
        key={`${editalId}:${e.dados.regra?.versao ?? 0}`}
        e={e}
        estado={estado}
        rascunhoGuardado={lojas.rascunhoDaAvaliacao}
      />
    </div>
  );
}

/* ── 4 Classificação: composição da nota, desempate, cotas e convocação ── */
export function EtapaDaClassificacao({
  lojas,
  editalId,
}: {
  lojas: LojasDasRegras;
  editalId: string;
}) {
  const estado = lojas.classificacao;
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  useEffect(() => {
    void estado.escolherEdital(editalId);
  }, [estado, editalId]);
  if (e.erroDoEdital && e.editalId === editalId)
    return (
      <ErroAoCarregar
        oQue="a regra da Classificação"
        mensagem={e.erroDoEdital}
        aoTentar={() => void estado.escolherEdital(editalId)}
      />
    );
  if (e.editalId !== editalId || !e.dados)
    return <BlocosEsqueleto quantos={3} />;
  return (
    <div className="classificacao-tela regras-do-edital__editor">
      <RegraDaClassificacao
        key={`${editalId}:${e.dados.regra?.versao ?? 0}`}
        estado={estado}
        e={e}
        dataDeCorte={dataDeCorteDoCronograma(e.dados.cronograma)}
        rascunhoGuardado={lojas.rascunhoDaClassificacao}
      />
    </div>
  );
}

/* Lê uma RPC só para mostrar; erro vira mensagem e "Tentar novamente". */
function usarLeitura<T>(ler: () => Promise<T>, chave: string) {
  const [estado, setEstado] = useState<{
    dados: T | null;
    erro: string;
    vez: number;
  }>({ dados: null, erro: "", vez: 0 });
  useEffect(() => {
    let vivo = true;
    setEstado((s) => ({ ...s, dados: null, erro: "" }));
    ler()
      .then((dados) => vivo && setEstado((s) => ({ ...s, dados })))
      .catch(
        (erro) => vivo && setEstado((s) => ({ ...s, erro: mensagem(erro) })),
      );
    return () => {
      vivo = false;
    };
    // `ler` muda a cada render; a chave e a vez decidem quando reler.
  }, [chave, estado.vez]);
  return {
    ...estado,
    tentar: () => setEstado((s) => ({ ...s, vez: s.vez + 1 })),
  };
}

async function rpc(
  cliente: ClienteDasRegras,
  nome: string,
  argumentos?: object,
) {
  const { data, error } = await cliente.rpc(nome, argumentos as never);
  if (error) throw error;
  return data;
}

/* ── 3 Entrevista: o resumo de Conduzir entrevistas › Preparar ── */
export function EtapaDaEntrevista({
  cliente,
  editalId,
  aoIrParaClassificacao,
  aoIrParaPreparar,
}: {
  cliente: ClienteDasRegras;
  editalId: string;
  aoIrParaClassificacao: () => void;
  aoIrParaPreparar: () => void;
}) {
  const leitura = usarLeitura(
    async () =>
      (await rpc(cliente, "obter_entrevistas_do_edital", {
        p_edital: editalId,
      })) as DadosDaEntrevista | null,
    editalId,
  );
  const dados = leitura.dados;
  const entrada = useMemo<EntradaDoResumo | null>(() => {
    if (!dados) return null;
    const regra = dados.regra_classificacao || null;
    return {
      temRegra: Boolean(regra),
      convocacao: (regra?.convocacao ?? null) as EntradaDoResumo["convocacao"],
      vagas: [],
      roteiro: (dados.configuracao?.roteiro ??
        null) as EntradaDoResumo["roteiro"],
      avaliadores: (dados.avaliadores || []) as EntradaDoResumo["avaliadores"],
      lancamento: dados.configuracao?.lancamento || null,
      desempate: criteriosDeDesempate(regra),
      empateFinal: textoDoEmpateFinal(regra),
      convocados: null,
    };
  }, [dados]);
  if (leitura.erro)
    return (
      <ErroAoCarregar
        oQue="as regras da entrevista"
        mensagem={leitura.erro}
        aoTentar={leitura.tentar}
      />
    );
  if (!entrada) return <BlocosEsqueleto quantos={2} />;
  const podeConfigurar = Boolean(dados?.pode_editar);
  const ir = (destino: DestinoDoResumo) =>
    destino === "classificacao" ? aoIrParaClassificacao() : aoIrParaPreparar();
  return (
    <div className="entrevistas-tela regras-do-edital__editor">
      <ResumoDasRegras
        entrada={entrada}
        aoIr={ir}
        podeIr={(destino) =>
          destino === "classificacao" ||
          (destino !== "convocacao" && podeConfigurar)
        }
      />
    </div>
  );
}

/* ── 5 Chamada para contratação: a configuração de convocação da Lista de aprovados ── */
export function EtapaDaChamada({
  cliente,
  editalId,
  podeEditar,
  aoEditar,
}: {
  cliente: ClienteDasRegras;
  editalId: string;
  podeEditar: boolean;
  aoEditar: () => void;
}) {
  const leitura = usarLeitura(async () => {
    const [configuracoes, modelos] = await Promise.all([
      rpc(cliente, "listar_configuracao_convocacao"),
      rpc(cliente, "listar_modelos_convocacao"),
    ]);
    return {
      convocacao: convocacaoDoEdital({ configuracoes, modelos }, editalId),
    };
  }, editalId);
  if (leitura.erro)
    return (
      <ErroAoCarregar
        oQue="a configuração da chamada"
        mensagem={leitura.erro}
        aoTentar={leitura.tentar}
      />
    );
  if (!leitura.dados) return <BlocosEsqueleto quantos={1} />;
  const convocacao = leitura.dados.convocacao;
  const config = convocacao?.configs.get(convocacao.editalId) ?? null;
  const vagas = config ? [...config.vagas.values()] : [];
  const imediatas = vagas.reduce((soma, v) => soma + (v.imediatas || 0), 0);
  const botao = podeEditar ? (
    <button
      type="button"
      className="btn secondary small"
      data-acao="editar-chamada"
      onClick={aoEditar}
    >
      <i className="fa-solid fa-pen" aria-hidden="true" /> Editar na Lista de
      aprovados
    </button>
  ) : null;
  return (
    <section
      className="ui-card regras-do-edital__chamada"
      aria-labelledby="regrasChamadaTitulo"
      data-tour="regras-do-edital-chamada"
    >
      <header className="regras-do-edital__topo-da-etapa">
        <h2 className="ui-titulo" id="regrasChamadaTitulo">
          Chamada para contratação
        </h2>
        {botao}
      </header>
      {config ? (
        <GradeDeKv rotulo="Resumo da chamada para contratação">
          <Kv rotulo="Modelo de convocação">
            {convocacao?.modeloNome || "Sem modelo"}
          </Kv>
          <Kv rotulo="Reservas">{resumoDoModelo(convocacao?.modelo)}</Kv>
          <Kv rotulo="Proporcionalidade">
            {config.proporcionalidade ? "Sim" : "Não"}
          </Kv>
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
    </section>
  );
}
