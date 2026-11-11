import { useEffect, useState } from "react";
import { formatNumberBR } from "../../lib/formatters";
import {
  conferirEntrada,
  quadroDosFundamentos,
  ROTULO_DO_PAPEL,
  RPC_CONFERIR_FUNDAMENTO,
  RPC_OBTER_FUNDAMENTOS,
  type MotivoDoQuadro,
  type QuadroDosFundamentos,
} from "../../lib/avaliacao-documental/fundamento-da-eliminacao.ts";
import { funcaoAusente } from "../../lib/avaliacao-documental/leitura-por-versao.ts";
import { Aviso, Campo, CardDaLista, Selo } from "../../ui/index.ts";
import { ModalInstitucional } from "../../ui/modal-institucional.tsx";
import { mensagemDoBanco } from "./estado.ts";
import type { EstadoDaPreClassificacao } from "./tipos-da-pre-classificacao.ts";

/*
  "Fundamento das eliminações" (aba Eliminados da Triagem, issue #593): o item
  oficial do edital de cada motivo de eliminação, que vai para o comunicado em PDF.
  Lê obter_fundamentos_da_eliminacao; quem tem a autoridade (gestor ou coordenador
  do edital, ou administrador global — o banco decide, pode_conferir) confere ou
  retifica por conferir_fundamento_da_eliminacao. Nada é preenchido sozinho: o
  item que a regra traz aparece só como referência, e o item da nota mínima do
  lote pede justificativa. Sem fundamento conferido, o comunicado sai sem item.
*/

export interface PropriedadesDosFundamentos {
  pre: Pick<EstadoDaPreClassificacao, "rpc">;
  editalId: string;
  /** Muda a cada releitura da Triagem: o quadro é lido de novo. */
  leitura: string;
}

const ROTULO_DA_ACAO: Readonly<Record<string, string>> = {
  CONFERIDO: "Retificar",
  RECONFERIR: "Reconferir",
};

const dataHora = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

function SeloDoFundamento({ motivo }: { motivo: MotivoDoQuadro }) {
  const f = motivo.fundamento;
  if (!f) return <Selo tom="neutro">Sem fundamento conferido</Selo>;
  if (f.situacao === "RECONFERIR")
    return (
      <Selo tom="pendente" ponto>
        Reconferir: item {f.item_edital} (regra v{f.versao_regra})
      </Selo>
    );
  return (
    <Selo tom="aprovado" ponto>
      Item {f.item_edital} · regra v{f.versao_regra}
    </Selo>
  );
}

export function FundamentosDaEliminacao({
  pre,
  editalId,
  leitura,
}: PropriedadesDosFundamentos) {
  const [quadro, setQuadro] = useState<QuadroDosFundamentos | null>(null);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);
  const [conferindo, setConferindo] = useState<MotivoDoQuadro | null>(null);

  useEffect(() => {
    let vivo = true;
    setErro("");
    pre
      .rpc(RPC_OBTER_FUNDAMENTOS, { p_edital: editalId })
      .then((r) => {
        if (vivo) setQuadro(quadroDosFundamentos(r));
      })
      .catch((e: unknown) => {
        if (!vivo) return;
        // Banco sem a migration 20261110215930 ou sem a coordenação do edital: sem quadro.
        if (
          funcaoAusente(e) ||
          (e as { code?: string } | null)?.code === "42501"
        )
          setQuadro(null);
        else setErro(mensagemDoBanco(e));
      });
    return () => {
      vivo = false;
    };
  }, [pre, editalId, leitura, versao]);

  if (erro)
    return (
      <Aviso tom="danger" papel="alert">
        Não foi possível ler o fundamento das eliminações: {erro}
      </Aviso>
    );
  if (!quadro || (!quadro.motivos.length && !quadro.foraDaRegra.length))
    return null;

  return (
    <CardDaLista
      rotulo="Fundamento das eliminações"
      className="avd-fundamentos"
      tour="triagem-fundamentos"
    >
      <h3 className="avd-fundamentos-titulo">Fundamento das eliminações</h3>
      {quadro.regra && quadro.regra.situacao !== "CONFERIDA" ? (
        <Aviso tom="warning">
          A regra da Triagem (versão {quadro.regra.versao}) ainda não foi
          conferida: os comunicados saem sem fundamento.
        </Aviso>
      ) : null}
      <div className="ui-tabela-rolagem">
        <table
          className="avd-tabela"
          aria-label="Fundamento de cada motivo"
          data-mobile-table="scroll"
          data-acao="fundamentos-da-eliminacao"
        >
          <thead>
            <tr>
              <th scope="col">Motivo</th>
              <th scope="col" className="num">
                Eliminados
              </th>
              <th scope="col">Fundamento no comunicado</th>
              {quadro.podeConferir ? (
                <th scope="col">
                  <span className="sr-only">Conferir</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {quadro.motivos.map((m) => (
              <tr key={m.codigo} data-motivo={m.codigo}>
                <td>
                  {m.motivo}
                  {m.administrativo ? (
                    <span className="avd-fundamentos-tipo">
                      {" "}
                      · administrativa
                    </span>
                  ) : null}
                </td>
                <td className="num">{formatNumberBR(m.eliminados)}</td>
                <td>
                  <SeloDoFundamento motivo={m} />
                </td>
                {quadro.podeConferir ? (
                  <td className="num">
                    <button
                      type="button"
                      className="btn secondary small"
                      data-acao="conferir-fundamento"
                      disabled={quadro.regra?.situacao !== "CONFERIDA"}
                      onClick={() => setConferindo(m)}
                    >
                      {ROTULO_DA_ACAO[m.fundamento?.situacao ?? ""] ??
                        "Conferir"}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
            {quadro.foraDaRegra.map((m) => (
              <tr
                key={m.codigo}
                data-motivo={m.codigo}
                data-fora-da-regra="sim"
              >
                <td>{m.motivo}</td>
                <td className="num">{formatNumberBR(m.eliminados)}</td>
                <td>
                  <Selo tom="neutro">Fora da regra da Triagem</Selo>
                </td>
                {quadro.podeConferir ? <td /> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {quadro.foraDoLotePorNota ? (
        <p className="avd-fundamentos-nota" data-acao="fora-do-lote-por-nota">
          {formatNumberBR(quadro.foraDoLotePorNota)} inscrito(s) fora do lote
          pela nota: não são eliminados e não recebem este comunicado.
        </p>
      ) : null}
      {quadro.historico.length ? (
        <details className="avd-fundamentos-historico">
          <summary>
            Conferências ({formatNumberBR(quadro.historico.length)})
          </summary>
          <ul>
            {quadro.historico.map((h) => (
              <li key={h.id}>
                <strong>
                  {h.motivoCodigo}: item {h.itemEdital}
                </strong>{" "}
                (regra v{h.versaoRegra}) · {h.por || "sem nome"},{" "}
                {ROTULO_DO_PAPEL[h.papel] ?? h.papel} · {dataHora(h.em)}
                <br />
                Fonte: {h.fonte}
                {h.justificativa ? (
                  <>
                    <br />
                    Justificativa: {h.justificativa}
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {conferindo && quadro.regra ? (
        <ConferirFundamento
          pre={pre}
          editalId={editalId}
          motivo={conferindo}
          versaoDaRegra={quadro.regra.versao}
          itemDaNota={quadro.regra.itemDaNota}
          aoFechar={(gravou) => {
            setConferindo(null);
            if (gravou) setVersao((n) => n + 1);
          }}
        />
      ) : null}
    </CardDaLista>
  );
}

function ConferirFundamento({
  pre,
  editalId,
  motivo,
  versaoDaRegra,
  itemDaNota,
  aoFechar,
}: {
  pre: Pick<EstadoDaPreClassificacao, "rpc">;
  editalId: string;
  motivo: MotivoDoQuadro;
  versaoDaRegra: number;
  itemDaNota: string | null;
  aoFechar: (gravou: boolean) => void;
}) {
  // A última conferência (conferida ou a reconferir): mudar item ou fonte é retificar.
  const anterior = motivo.fundamento;
  // Nada vem preenchido: quem confere digita o item do texto oficial.
  const [item, setItem] = useState("");
  const [fonte, setFonte] = useState(anterior?.fonte ?? "");
  const [justificativa, setJustificativa] = useState("");
  const [tentou, setTentou] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState("");
  const { erros, exigeJustificativa } = conferirEntrada(
    { item, fonte, justificativa },
    { anterior, itemDaNota },
  );
  const valido = !Object.keys(erros).length;
  const mostrar = (campo: keyof typeof erros) =>
    tentou || (campo === "justificativa" && justificativa)
      ? erros[campo]
      : undefined;

  async function gravar() {
    setTentou(true);
    if (!valido || gravando) return;
    setGravando(true);
    setErro("");
    try {
      await pre.rpc(RPC_CONFERIR_FUNDAMENTO, {
        p_edital: editalId,
        p_motivo: motivo.codigo,
        p_versao_regra: versaoDaRegra,
        p_item_edital: item.trim(),
        p_fonte: fonte.trim(),
        p_justificativa: justificativa.trim() || null,
      });
      aoFechar(true);
    } catch (e) {
      setErro(mensagemDoBanco(e));
      setGravando(false);
    }
  }

  return (
    <ModalInstitucional
      tituloId="avdFundamentoTitulo"
      titulo={`${(anterior && ROTULO_DA_ACAO[anterior.situacao]) || "Conferir"} fundamento: ${motivo.motivo}`}
      contexto="Avaliação documental · Triagem"
      descricao={`Regra da Triagem, versão ${versaoDaRegra}.`}
      icone="fa-scale-balanced"
      aoFechar={() => aoFechar(false)}
      fecharDesabilitado={gravando}
      infoRodape="A conferência fica registrada com seu nome, a data e a versão da regra."
      acoes={
        <>
          <button
            type="button"
            className="btn secondary"
            onClick={() => aoFechar(false)}
            disabled={gravando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn primary"
            data-acao="gravar-fundamento"
            disabled={gravando}
            onClick={() => void gravar()}
          >
            {gravando ? "Gravando…" : "Conferir fundamento"}
          </button>
        </>
      }
    >
      {anterior ? (
        <Aviso>
          Última conferência: item {anterior.item_edital} (regra v
          {anterior.versao_regra}). Ela continua no histórico.
        </Aviso>
      ) : null}
      {motivo.itemNaRegra ? (
        <p className="avd-fundamentos-nota">
          A regra da Triagem cita o item {motivo.itemNaRegra} para este motivo
          (só referência).
        </p>
      ) : null}
      <Campo
        rotulo="Item do edital"
        obrigatorio
        dica="Como no texto oficial, ex.: 6.4"
        erro={mostrar("item")}
      >
        <input
          inputMode="decimal"
          maxLength={30}
          value={item}
          data-foco-inicial
          data-acao="fundamento-item"
          onChange={(ev) => setItem(ev.target.value)}
        />
      </Campo>
      {exigeJustificativa.includes("ITEM_DA_NOTA") ? (
        <Aviso tom="warning" papel="status">
          O item {itemDaNota} é o da nota mínima do lote. Eliminação na triagem
          não decorre da nota.
        </Aviso>
      ) : null}
      <Campo
        rotulo="Fonte conferida"
        obrigatorio
        dica="Edital publicado ou retificação, com data"
        erro={mostrar("fonte")}
      >
        <textarea
          rows={2}
          maxLength={500}
          value={fonte}
          data-acao="fundamento-fonte"
          onChange={(ev) => setFonte(ev.target.value)}
        />
      </Campo>
      <Campo
        rotulo="Justificativa"
        obrigatorio={exigeJustificativa.length > 0}
        erro={mostrar("justificativa")}
      >
        <textarea
          rows={3}
          maxLength={500}
          value={justificativa}
          data-acao="fundamento-justificativa"
          onChange={(ev) => setJustificativa(ev.target.value)}
        />
      </Campo>
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}
    </ModalInstitucional>
  );
}
