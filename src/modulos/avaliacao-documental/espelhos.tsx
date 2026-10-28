import { useEffect, useState, useSyncExternalStore } from "react";
import { lerCodigos } from "../../lib/avaliacao-documental/espelhos-em-massa.ts";
import { Aviso, Campo } from "../../ui/index.ts";
import { espelhoDaEliminacaoPreAnalise } from "../../lib/avaliacao-documental/espelho-da-pre-classificacao.ts";
import type { DadosDaPreClassificacao } from "./tipos-da-pre-classificacao.ts";
import {
  EspelhosEmMassa,
  lerFichasDosEspelhos,
  montarEspelhosLidos,
} from "./espelhos-em-massa.tsx";
import { textosParaOEspelho } from "./modelo-do-espelho-no-banco.ts";
import { ModeloDoEspelhoDeNota } from "./modelo-do-espelho.tsx";
import { baixarEspelhoProntoEmPdf } from "./ficha/espelho-de-nota.ts";
import type { LojaDaFila } from "./estado-da-fila.ts";

/* A emissão individual e em massa compartilham a RPC e o modelo existente.
   Somente a coordenação do edital chega a esta visão; o banco valida de novo. */
export function EspelhosDaAvaliacao({
  editalId,
  fila,
  rotuloEdital = "",
  unidade = "",
}: {
  editalId: string;
  fila: LojaDaFila;
  rotuloEdital?: string;
  unidade?: string;
}) {
  const st = useSyncExternalStore(fila.assinar, fila.obter);
  const [codigo, setCodigo] = useState("");
  const [codigoEliminado, setCodigoEliminado] = useState("");
  const [vagaEliminada, setVagaEliminada] = useState("");
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
    return (
      <Aviso tom="warning">
        Somente a coordenação do edital pode emitir espelhos em massa.
      </Aviso>
    );

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
      setErro(
        e instanceof Error ? e.message : "Não foi possível emitir o espelho.",
      );
    } finally {
      setGerando(false);
    }
  }

  async function emitirComunicado() {
    const codigos = lerCodigos(codigoEliminado);
    if (codigos.length !== 1) {
      setErro("Informe apenas um código de inscrição.");
      return;
    }
    setErro("");
    setAviso("");
    setGerando(true);
    try {
      const pre = (await fila.rpc("obter_pre_classificacao", {
        p_edital: editalId,
      })) as DadosDaPreClassificacao | null;
      if (!pre || String(pre.edital?.id ?? "") !== editalId)
        throw new Error("Não foi possível confirmar a pré-classificação do edital.");
      if (!pre.pode_coordenar)
        throw new Error("A emissão exige permissão de coordenação.");
      const encontrados = (pre.candidatos || []).filter(
        (c) =>
          String(c.codigo) === codigos[0] &&
          (!vagaEliminada || String(c.vaga) === vagaEliminada),
      );
      if (encontrados.length !== 1)
        throw new Error(
          encontrados.length
            ? "Inscrição em mais de uma vaga. Selecione a vaga."
            : "Inscrição não encontrada na pré-classificação deste edital.",
        );
      const candidato = encontrados[0]!;
      if (candidato.situacao !== "ELIMINADO")
        throw new Error("A inscrição não está eliminada antes da análise documental.");
      const cargo = pre.vagas.find((v) => String(v.codigo) === candidato.vaga)?.cargo;
      const documento = espelhoDaEliminacaoPreAnalise({
        codigo: candidato.codigo,
        nome: candidato.nome,
        vaga: candidato.vaga,
        cargo,
        edital: rotuloEdital || String(pre.edital?.edital ?? ""),
        unidade,
        modalidade: candidato.modalidade,
        situacao: candidato.situacao,
        motivo: candidato.motivo,
        motivo_codigo: candidato.motivo_codigo,
        art: candidato.art,
        declarada: candidato.declarada,
        nota: candidato.nota,
        origem_nota: candidato.origem_nota,
      });
      const arquivo = await baixarEspelhoProntoEmPdf(documento);
      setAviso(`Comunicado preparado: ${arquivo}`);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível emitir o comunicado.",
      );
    } finally {
      setGerando(false);
    }
  }

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
        Carregando espelhos do edital…
      </div>
    );

  return (
    <section
      className="ui-card avd-espelhos"
      aria-label="Emissão dos espelhos de nota"
    >
      <h3 className="ui-titulo">Documentos do edital</h3>
      <p className="ui-texto-secundario">
        Espelhos de avaliações concluídas e comunicados de eliminação anterior à análise documental são documentos diferentes.
      </p>
      <h4>Espelhos das avaliações concluídas</h4>
      <div className="avd-espelhos-individual">
        <Campo rotulo="Código de inscrição para PDF individual">
          <input
            type="search"
            value={codigo}
            placeholder="Código da Empregare"
            onChange={(ev) => {
              setCodigo(ev.target.value);
              setErro("");
              setAviso("");
            }}
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
      <div className="avd-espelhos-comunicados">
        <h4>Eliminados antes da análise documental</h4>
        <p className="ui-texto-secundario">
          Comunicado individual com o motivo registrado na pré-classificação.
          Não informa nota da comissão, pois não houve avaliação documental.
          Não substitui a publicação oficial.
        </p>
        <div className="avd-espelhos-individual">
          <Campo rotulo="Código da inscrição eliminada">
            <input
              type="search"
              value={codigoEliminado}
              onChange={(ev) => setCodigoEliminado(ev.target.value)}
              disabled={gerando}
              data-acao="comunicado-eliminado-codigo"
              placeholder="Código da Empregare"
            />
          </Campo>
          <Campo rotulo="Vaga (se necessário)">
            <select
              value={vagaEliminada}
              onChange={(ev) => setVagaEliminada(ev.target.value)}
              disabled={gerando}
            >
              <option value="">Identificar pelo código</option>
              {(dados.vagas || []).map((v) => (
                <option key={String(v.codigo)} value={String(v.codigo)}>
                  {v.codigo}{v.cargo ? ` · ${v.cargo}` : ""}
                </option>
              ))}
            </select>
          </Campo>
          <button
            type="button"
            className="btn primary"
            data-acao="baixar-comunicado-eliminacao"
            disabled={gerando || !codigoEliminado.trim()}
            onClick={() => void emitirComunicado()}
          >
            {gerando ? "Preparando…" : "Baixar comunicado"}
          </button>
        </div>
      </div>
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}
      {aviso ? (
        <Aviso tom="info" papel="status">
          {aviso}
        </Aviso>
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
