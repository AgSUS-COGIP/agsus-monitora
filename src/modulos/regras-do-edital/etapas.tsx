import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import { dataDeCorteDoCronograma } from "../../lib/classificacao/dados.ts";
import {
  criteriosDeDesempate,
  textoDoEmpateFinal,
} from "../../lib/convocacao-da-entrevista.ts";
import type {
  DestinoDoResumo,
  EntradaDoResumo,
} from "../../lib/resumo-da-entrevista.ts";
import { BlocosEsqueleto, ErroAoCarregar } from "../../ui/index.ts";
import { EditorDaChamada } from "../aprovados/chamada-para-contratacao.tsx";
import type { EstadoDosAprovados } from "../aprovados/tipos-do-estado.ts";
import { Regra as RegraDaAvaliacao } from "../avaliacao-documental/regra.tsx";
import { Regra as RegraDaClassificacao } from "../classificacao/regra.tsx";
import { EditorDaConfiguracaoDaEntrevista } from "../entrevistas/editor-da-configuracao.tsx";
import { ResumoDasRegras } from "../entrevistas/resumo-das-regras.tsx";
import type { LojasDasRegras } from "./lojas.ts";

/*
  As etapas das Regras do edital que não têm editor próprio na pasta da
  Triagem: cada uma monta o editor que a tela da etapa usava, com a mesma loja
  e as mesmas RPCs. Nada aqui calcula ou grava por conta própria: salvar é o
  que o editor de cada etapa já fazia.
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

/*
  ── 3 Entrevista: o resumo das regras da entrevista e o editor do roteiro e
  da banca (editor-da-configuracao.tsx), sobre a loja de condução de
  Conduzir entrevistas: os roteiros da área atual (listar_roteiros_entrevista)
  e o edital (obter_entrevistas_do_edital); salvar é o configurar da loja
  (configurar_entrevista_edital). Os roteiros da área (editar, duplicar,
  novo) continuam em Conduzir entrevistas › Preparar.
*/
export function EtapaDaEntrevista({
  lojas,
  editalId,
  aoIrParaClassificacao,
  aoIrParaPreparar,
}: {
  lojas: LojasDasRegras;
  editalId: string;
  aoIrParaClassificacao: () => void;
  aoIrParaPreparar: () => void;
}) {
  const conducao = lojas.entrevista;
  const e = useSyncExternalStore(conducao.assinar, conducao.obter);
  const { area } = usarAreaAtual();
  useEffect(() => {
    // A área primeiro: trocar de área recomeça a loja (e o edital aberto).
    if (area) void conducao.carregarRoteiros(area);
    void conducao.abrirEdital(editalId);
  }, [conducao, area, editalId]);
  const dados = e.edital?.edital?.id === editalId ? e.edital : null;
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
  if (e.erroDoEdital && e.editalId === editalId)
    return (
      <ErroAoCarregar
        oQue="as regras da entrevista"
        mensagem={e.erroDoEdital}
        aoTentar={() => void conducao.abrirEdital(editalId)}
      />
    );
  if (!dados || !entrada) return <BlocosEsqueleto quantos={2} />;
  const podeConfigurar = Boolean(dados.pode_editar);
  const ir = (destino: DestinoDoResumo) => {
    if (destino === "classificacao") aoIrParaClassificacao();
    else if (destino === "roteiro") aoIrParaPreparar();
    else
      document
        .getElementById("entrevistaConfiguracaoTitulo")
        ?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="entrevistas-tela regras-do-edital__editor">
      <ResumoDasRegras
        entrada={entrada}
        aoIr={ir}
        podeIr={(destino) =>
          destino === "classificacao" ||
          (destino === "roteiro" && podeConfigurar)
        }
      />
      <EditorDaConfiguracaoDaEntrevista
        key={editalId}
        dados={dados}
        roteiros={e.roteiros.lista}
        salvando={e.acao?.tipo === "configurar"}
        aoSalvar={conducao.configurar}
      />
      {podeConfigurar ? (
        <p className="ui-texto-suave regras-do-edital__nota">
          Os roteiros da área (editar, duplicar ou criar um novo) ficam em{" "}
          <button
            type="button"
            className="btn ghost small"
            data-acao="ir-para-preparar"
            onClick={aoIrParaPreparar}
          >
            Conduzir entrevistas › Preparar
          </button>
        </p>
      ) : null}
    </div>
  );
}

/*
  ── 5 Chamada para contratação: o formulário da convocação do edital
  (chamada-para-contratacao.tsx) sobre a loja da Lista de aprovados do app.
  A loja chega por `aprovados()` (baixa e monta a Lista de aprovados na
  primeira vez, como o botão "Lista de aprovados" de Editais).
*/
export function EtapaDaChamada({
  aprovados,
  editalId,
}: {
  aprovados: () => Promise<EstadoDosAprovados | null | undefined>;
  editalId: string;
}) {
  const [loja, setLoja] = useState<{
    estado: EstadoDosAprovados | null;
    erro: string;
    vez: number;
  }>({ estado: null, erro: "", vez: 0 });
  useEffect(() => {
    let vivo = true;
    aprovados()
      .then((estado) => {
        if (!vivo) return;
        setLoja((s) =>
          estado
            ? { ...s, estado, erro: "" }
            : { ...s, erro: "A Lista de aprovados não está disponível." },
        );
      })
      .catch((erro: unknown) => {
        if (vivo) setLoja((s) => ({ ...s, erro: mensagem(erro) }));
      });
    return () => {
      vivo = false;
    };
  }, [aprovados, loja.vez]);
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
      </header>
      {loja.erro ? (
        <ErroAoCarregar
          oQue="a configuração da chamada"
          mensagem={loja.erro}
          aoTentar={() => setLoja((s) => ({ ...s, erro: "", vez: s.vez + 1 }))}
        />
      ) : loja.estado ? (
        <EditorDaChamada estado={loja.estado} editalId={editalId} />
      ) : (
        <BlocosEsqueleto quantos={2} />
      )}
    </section>
  );
}
