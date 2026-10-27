import { useEffect, useState, useSyncExternalStore } from "react";
import { lerCodigos } from "../../lib/avaliacao-documental/espelhos-em-massa.ts";
import { Aviso, Campo } from "../../ui/index.ts";
import { EspelhosEmMassa, lerFichasDosEspelhos, montarEspelhosLidos } from "./espelhos-em-massa.tsx";
import { textosParaOEspelho } from "./modelo-do-espelho-no-banco.ts";
import { ModeloDoEspelhoDeNota } from "./modelo-do-espelho.tsx";
import { baixarEspelhoProntoEmPdf } from "./ficha/espelho-de-nota.ts";
import type { LojaDaFila } from "./estado-da-fila.ts";

/* A emissão individual e em massa compartilham a RPC e o modelo existente.
   Somente a coordenação do edital chega a esta visão; o banco valida de novo. */
export function EspelhosDaAvaliacao({
  editalId,
  fila,
}: {
  editalId: string;
  fila: LojaDaFila;
}) {
  const st = useSyncExternalStore(fila.assinar, fila.obter);
  const [codigo, setCodigo] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [massa, setMassa] = useState(false);
  const [modelo, setModelo] = useState(false);

  useEffect(() => {
    if (fila.obter().editalId !== editalId || fila.estaDesatualizada())
      void fila.carregar(editalId);
  }, [fila, editalId]);

  const dados = st.editalId === editalId ? st.dados : null;
  if (dados && !dados.pode_coordenar)
    return <Aviso tom="warning">Somente a coordenação do edital pode emitir espelhos em massa.</Aviso>;

  async function emitirIndividual() {
    const codigos = lerCodigos(codigo);
    if (codigos.length !== 1) {
      setErro("Informe apenas um código de inscrição.");
      return;
    }
    setErro("");
    setAviso("");
    setGerando(true);
    try {
      const [lidas, textos] = await Promise.all([
        lerFichasDosEspelhos({
          rpc: fila.rpc,
          editalId,
          escolha: { modo: "codigos", codigos },
        }),
        textosParaOEspelho(fila.rpc, editalId),
      ]);
      if (!lidas || lidas.fichas.length !== 1)
        throw new Error(
          "Não foi localizada exatamente uma ficha concluída para esse código neste edital.",
        );
      const [espelho] = montarEspelhosLidos(lidas, codigos, textos);
      if (!espelho) throw new Error("O espelho não está disponível.");
      const arquivo = await baixarEspelhoProntoEmPdf(espelho);
      setAviso(`Arquivo preparado: ${arquivo}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível emitir o espelho.");
    } finally {
      setGerando(false);
    }
  }

  if (st.erro && !dados)
    return (
      <Aviso tom="danger" papel="alert">
        Não foi possível carregar as fichas: {st.erro}
        <button type="button" className="btn secondary small" onClick={() => void fila.carregar(editalId)}>
          Tentar novamente
        </button>
      </Aviso>
    );
  if (!dados)
    return <div className="ui-card" aria-busy="true">Carregando espelhos do edital…</div>;

  return (
    <section className="ui-card avd-espelhos" aria-label="Emissão dos espelhos de nota">
      <h3 className="ui-titulo">Espelhos de nota</h3>
      <p className="ui-texto-secundario">
        Emita uma ficha concluída pelo código ou exporte documentos em massa.
        O modelo e as notas oficiais são preservados.
      </p>
      <div className="avd-espelhos-individual">
        <Campo rotulo="Código de inscrição para PDF individual">
          <input
            type="search"
            value={codigo}
            placeholder="Código da Empregare"
            onChange={(ev) => { setCodigo(ev.target.value); setErro(""); setAviso(""); }}
            disabled={gerando}
            data-acao="espelho-individual-codigo"
          />
        </Campo>
        <button
          type="button"
          className="btn primary"
          data-acao="baixar-espelho-individual"
          disabled={gerando || !codigo.trim()}
          onClick={() => void emitirIndividual()}
        >
          {gerando ? "Gerando PDF…" : "Baixar PDF individual"}
        </button>
      </div>
      <div className="ui-acoes avd-espelhos-acoes">
        <button
          type="button"
          className="btn secondary"
          data-acao="abrir-espelhos-em-massa"
          onClick={() => setMassa(true)}
        >
          Espelhos em massa (ZIP e impressão)
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
      {erro ? <Aviso tom="danger" papel="alert">{erro}</Aviso> : null}
      {aviso ? <Aviso tom="info" papel="status">{aviso}</Aviso> : null}
      {massa ? (
        <EspelhosEmMassa
          editalId={editalId}
          vagas={dados.vagas || []}
          fila={dados.candidatos || []}
          rpc={fila.rpc}
          aoFechar={() => setMassa(false)}
          aoEditarModelo={() => { setMassa(false); setModelo(true); }}
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
