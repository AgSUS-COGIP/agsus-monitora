import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Aviso } from "../../ui/index.ts";
import {
  chaveDaPessoa,
  concluidosDaFila,
} from "../../lib/avaliacao-documental/documentos-em-lote.ts";
import {
  EspelhosEmMassa,
  lerFichasDosEspelhos,
  montarEspelhosLidos,
} from "./espelhos-em-massa.tsx";
import { textosParaOEspelho } from "./modelo-do-espelho-no-banco.ts";
import { ModeloDoEspelhoDeNota } from "./modelo-do-espelho.tsx";
import {
  DocumentosEmLote,
  type MontarDocumentos,
} from "./documentos-em-lote.tsx";
import type { LojaDaFila } from "./estado-da-fila.ts";

/*
  A aba Documentos: o ÚNICO lugar dos espelhos de nota do edital (lista das
  avaliações concluídas com busca por código ou nome e marcação múltipla,
  espelhos em massa por vaga e filtro, e o modelo do espelho). Somente a
  coordenação do edital chega a esta visão; o banco valida de novo.

  Os comunicados de eliminação antes da análise pertencem à Triagem
  (é ela que elimina e forma o lote): aqui fica só o atalho para lá.
*/

export function EspelhosDaAvaliacao({
  editalId,
  fila,
  rotuloEdital = "",
  aoAbrirPreClassificacao = null,
}: {
  editalId: string;
  fila: LojaDaFila;
  rotuloEdital?: string;
  /** Leva aos comunicados de eliminação, na Triagem. */
  aoAbrirPreClassificacao?: (() => void) | null;
}) {
  const st = useSyncExternalStore(fila.assinar, fila.obter);
  const [massa, setMassa] = useState(false);
  const [modelo, setModelo] = useState(false);

  useEffect(() => {
    if (fila.obter().editalId !== editalId || fila.estaDesatualizada())
      void fila.carregar(editalId);
  }, [fila, editalId]);

  const dados = st.editalId === editalId ? st.dados : null;
  const concluidos = useMemo(
    () => concluidosDaFila(dados?.candidatos),
    [dados?.candidatos],
  );
  const edital = rotuloEdital || String(dados?.edital?.rotulo ?? "");

  const montarEspelhos: MontarDocumentos = useCallback(
    async (escolhidas, cancelado) => {
      const codigos = [...new Set(escolhidas.map((p) => p.codigo))];
      const [lidas, textos] = await Promise.all([
        lerFichasDosEspelhos({
          rpc: fila.rpc,
          editalId,
          escolha: { modo: "codigos", codigos },
          cancelado,
        }),
        textosParaOEspelho(fila.rpc, editalId),
      ]);
      if (!lidas) return null;
      // O mesmo código em duas vagas: só a vaga marcada entra.
      const chaves = new Set(escolhidas.map((p) => p.chave));
      const fichas = lidas.fichas.filter((f) =>
        chaves.has(chaveDaPessoa(f.vaga, f.codigo)),
      );
      const documentos = montarEspelhosLidos(
        { ...lidas, fichas },
        codigos,
        textos,
      );
      const faltam = escolhidas.length - documentos.length;
      return {
        documentos,
        avisos: faltam
          ? [
              `${faltam} marcada(s) sem ficha concluída disponível agora (atualize a fila).`,
            ]
          : [],
      };
    },
    [fila, editalId],
  );

  if (dados && !dados.pode_coordenar)
    return (
      <Aviso tom="warning">
        Somente a coordenação do edital pode emitir documentos.
      </Aviso>
    );
  if (st.erro && !dados)
    return (
      <Aviso tom="danger" papel="alert">
        Não foi possível carregar as fichas: {st.erro}
        <button
          type="button"
          className="btn secondary small"
          onClick={() => void fila.carregar(editalId)}
        >
          Tentar novamente
        </button>
      </Aviso>
    );
  if (!dados)
    return (
      <div className="ui-card" aria-busy="true">
        Carregando documentos do edital…
      </div>
    );

  return (
    <section
      className="ui-card avd-espelhos"
      aria-label="Emissão dos espelhos de nota"
    >
      <div className="avd-espelhos-acoes">
        <h3 className="ui-titulo">Espelhos das avaliações concluídas</h3>
        <div className="ui-acoes">
          <button
            type="button"
            className="btn secondary"
            data-acao="abrir-espelhos-em-massa"
            onClick={() => setMassa(true)}
          >
            Espelhos em massa (por vaga e filtro)
          </button>
          <button
            type="button"
            className="btn secondary"
            data-acao="abrir-modelo-espelho"
            onClick={() => setModelo(true)}
          >
            Modelo e pré-visualização
          </button>
        </div>
      </div>
      <p className="ui-texto-secundario">
        Busque por código ou nome e marque uma ou várias pessoas.
      </p>
      <DocumentosEmLote
        key={editalId}
        id="espelhos-concluidos"
        pessoas={concluidos}
        vagas={dados.vagas || []}
        rotuloDoDetalhe="Resultado"
        rotuloDoDocumento="espelho"
        tituloDaImpressao="Espelhos de nota"
        prefixoDoZip="espelhos"
        edital={edital}
        montar={montarEspelhos}
      />
      {aoAbrirPreClassificacao ? (
        <p
          className="ui-texto-secundario avd-docs-atalho"
          data-acao="comunicados-na-pre"
        >
          Comunicados de eliminação antes da análise ficam na Triagem.{" "}
          <button
            type="button"
            className="btn ghost small"
            data-acao="abrir-comunicados-na-pre"
            onClick={aoAbrirPreClassificacao}
          >
            Abrir comunicados de eliminação
          </button>
        </p>
      ) : null}
      {massa ? (
        <EspelhosEmMassa
          editalId={editalId}
          vagas={dados.vagas || []}
          fila={dados.candidatos || []}
          rpc={fila.rpc}
          aoFechar={() => setMassa(false)}
          aoEditarModelo={() => {
            setMassa(false);
            setModelo(true);
          }}
        />
      ) : null}
      {modelo ? (
        <ModeloDoEspelhoDeNota
          editalId={editalId}
          rpc={fila.rpc}
          aoFechar={() => setModelo(false)}
        />
      ) : null}
    </section>
  );
}
