import { useMemo, useState } from "react";
import { Abas, EstadoVazio, Selo } from "../../ui/index.ts";
import {
  filaDoQuadro,
  linhasParaEscolher,
  origemDoVinculo,
  pendentesDaFila,
  rotuloDaLinha,
  semLinhaConfirmado,
  separarFila,
  TEXTO_DAS_VAGAS_DO_EDITAL,
} from "../../lib/editais/vinculos-do-quadro.ts";
import type {
  LinhaDoQuadro,
  VinculoDaVaga,
} from "../../lib/editais/vinculos-do-quadro.ts";

type Acao = "CONFIRMAR" | "SEM_LINHA" | "AUTOMATICO";

/** O que a fila usa do estado da página (`estado.ts`). */
export interface EstadoDosVinculos {
  confirmar(mensagem: string): boolean;
  gravarVinculoDoQuadro?(
    id: string,
    vaga: string,
    acao: Acao,
    quadro?: string | null,
  ): Promise<unknown>;
  atualizarVinculosDoQuadro?(id: string): Promise<unknown>;
}

export interface PropriedadesDosVinculos {
  estado: EstadoDosVinculos;
  idEdital: string;
  /** O payload de `obter_quadro_de_vagas`. */
  dados: unknown;
  /** O quadro devolvido depois de gravar (o mesmo payload). */
  aoMudar: (dados: unknown) => void;
}

/*
  A fila do vínculo de cada vaga com a linha do quadro de vagas, no quadro salvo do edital
  (migration 20261118120000). Três situações: ambíguas (mais de uma linha possível),
  ausentes (nenhuma linha; a linha escolhida que saiu do quadro vem primeiro) e confirmadas.
  A equipe confirma uma linha, marca "sem linha" ou devolve à regra; quem não edita só vê.
  Regras puras em `src/lib/editais/vinculos-do-quadro.ts`.
*/

type Aba = "ambiguas" | "ausentes" | "confirmadas";

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

function SituacaoDaVaga({ v }: { v: VinculoDaVaga }) {
  if (v.situacao === "CONFIRMADO")
    return (
      <>
        {rotuloDaLinha({ cargo: v.cargoDoQuadro, lotacao: v.lotacaoDoQuadro })}
        <div className="ui-texto-secundario">{origemDoVinculo(v)}</div>
      </>
    );
  if (semLinhaConfirmado(v))
    return (
      <>
        <Selo tom="neutro">Sem linha</Selo>
        <div className="ui-texto-secundario">
          Pela equipe{v.confirmadoPor ? `: ${v.confirmadoPor}` : ""}
        </div>
      </>
    );
  if (v.pendencia)
    return <span className="vinculos-pendencia">{v.pendencia}</span>;
  if (v.situacao === "AMBIGUO")
    return (
      <Selo tom="pendente">
        {plural(v.candidatas.length, "linha possível", "linhas possíveis")}
      </Selo>
    );
  return <Selo tom="reprovado">Nenhuma linha</Selo>;
}

function LinhaDaFila({
  v,
  linhas,
  podeEditar,
  ocupado,
  aoGravar,
}: {
  v: VinculoDaVaga;
  linhas: readonly LinhaDoQuadro[];
  podeEditar: boolean;
  ocupado: boolean;
  aoGravar: (v: VinculoDaVaga, acao: Acao, quadro?: string | null) => void;
}) {
  const opcoes = useMemo(() => linhasParaEscolher(v, linhas), [v, linhas]);
  const [escolhida, setEscolhida] = useState(v.quadro ?? opcoes[0]?.id ?? "");
  const mudou = escolhida !== (v.quadro ?? "") || v.origem !== "MANUAL";
  return (
    <tr data-vaga={v.vaga} data-situacao={v.situacao}>
      <td className="anexos-num">{v.vaga}</td>
      <td>{v.nome || "—"}</td>
      <td>
        <SituacaoDaVaga v={v} />
      </td>
      {podeEditar && (
        <td>
          <div className="vinculos-acoes">
            <select
              aria-label={`Linha do quadro da vaga ${v.vaga}`}
              value={escolhida}
              disabled={ocupado}
              onChange={(e) => setEscolhida(e.target.value)}
            >
              {opcoes.map((l) => (
                <option key={l.id} value={l.id}>
                  {v.candidatas.some((c) => c.id === l.id) ? "★ " : ""}
                  {rotuloDaLinha(l)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn small green"
              disabled={ocupado || !escolhida || !mudou}
              onClick={() => aoGravar(v, "CONFIRMAR", escolhida)}
            >
              Confirmar
            </button>
            {!semLinhaConfirmado(v) && (
              <button
                type="button"
                className="btn small secondary"
                disabled={ocupado}
                onClick={() => aoGravar(v, "SEM_LINHA")}
              >
                Sem linha
              </button>
            )}
            {v.origem === "MANUAL" && (
              <button
                type="button"
                className="btn small ghost"
                disabled={ocupado}
                onClick={() => aoGravar(v, "AUTOMATICO")}
              >
                Voltar à regra
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

export function VinculosDoQuadro({
  estado,
  idEdital,
  dados,
  aoMudar,
}: PropriedadesDosVinculos) {
  const fila = useMemo(() => filaDoQuadro(dados), [dados]);
  const separada = useMemo(() => separarFila(fila.vinculos), [fila]);
  const pendentes = pendentesDaFila(separada);
  const [aberta, setAberta] = useState(false);
  const [aba, setAba] = useState<Aba>(
    separada.ambiguas.length
      ? "ambiguas"
      : pendentes
        ? "ausentes"
        : "confirmadas",
  );
  const [ocupado, setOcupado] = useState(false);
  const [retorno, setRetorno] = useState<{
    tom: "success" | "error";
    texto: string;
  } | null>(null);
  const podeEditar = fila.podeEditar && Boolean(estado.gravarVinculoDoQuadro);

  async function executar(
    acao: () => Promise<unknown> | undefined,
    sucesso: string,
  ) {
    setOcupado(true);
    setRetorno(null);
    try {
      const novo = await acao();
      if (novo) aoMudar(novo);
      setRetorno({ tom: "success", texto: sucesso });
    } catch (e) {
      setRetorno({
        tom: "error",
        texto: `Não foi gravado: ${(e as Error | null)?.message || e}`,
      });
    } finally {
      setOcupado(false);
    }
  }

  function gravar(v: VinculoDaVaga, acao: Acao, quadro: string | null = null) {
    if (
      acao === "SEM_LINHA" &&
      !estado.confirmar(`A vaga ${v.vaga} não tem linha no quadro de vagas?`)
    )
      return;
    const texto =
      acao === "CONFIRMAR"
        ? `Vaga ${v.vaga} ligada à linha escolhida.`
        : acao === "SEM_LINHA"
          ? `Vaga ${v.vaga} marcada sem linha.`
          : `Vaga ${v.vaga} de volta à regra.`;
    void executar(
      () => estado.gravarVinculoDoQuadro?.(idEdital, v.vaga, acao, quadro),
      texto,
    );
  }

  if (fila.vagasDoEdital === null) return null;
  if (fila.vagasDoEdital !== "COM_CODIGO")
    return (
      <div className="anexos-linha" data-tour="editais-vinculos-do-quadro">
        <div>
          <strong>Vagas ligadas ao quadro</strong>{" "}
          {TEXTO_DAS_VAGAS_DO_EDITAL[fila.vagasDoEdital]}
        </div>
      </div>
    );

  const daAba =
    aba === "ambiguas"
      ? separada.ambiguas
      : aba === "ausentes"
        ? separada.ausentes
        : separada.confirmadas;

  return (
    <>
      <div className="anexos-linha" data-tour="editais-vinculos-do-quadro">
        <div>
          <strong>Vagas ligadas ao quadro</strong>{" "}
          {[
            plural(separada.confirmadas.length, "confirmada", "confirmadas"),
            plural(separada.ambiguas.length, "ambígua", "ambíguas"),
            plural(separada.ausentes.length, "ausente", "ausentes"),
          ].join(" · ")}
        </div>
        <div className="vinculos-acoes">
          {podeEditar && estado.atualizarVinculosDoQuadro && (
            <button
              id="vinculosAtualizar"
              type="button"
              className="btn secondary"
              disabled={ocupado}
              onClick={() =>
                void executar(
                  () => estado.atualizarVinculosDoQuadro?.(idEdital),
                  "Vínculos atualizados.",
                )
              }
            >
              Atualizar
            </button>
          )}
          <button
            id="vinculosVer"
            type="button"
            className={pendentes ? "btn green" : "btn secondary"}
            onClick={() => setAberta((a) => !a)}
          >
            {aberta
              ? "Esconder"
              : pendentes
                ? `Revisar ${plural(pendentes, "vaga", "vagas")}`
                : "Ver vagas"}
          </button>
        </div>
      </div>
      {retorno && (
        <p
          className={`cronograma-copy-feedback is-${retorno.tom}`}
          role={retorno.tom === "error" ? "alert" : "status"}
        >
          {retorno.texto}
        </p>
      )}
      {aberta && (
        <div className="vinculos-do-quadro">
          <Abas
            rotulo="Vínculos das vagas com o quadro"
            compactas
            ativa={aba}
            aoEscolher={(id) => setAba(id as Aba)}
            abas={[
              {
                id: "ambiguas",
                rotulo: "Ambíguas",
                contagem: separada.ambiguas.length,
              },
              {
                id: "ausentes",
                rotulo: "Ausentes",
                contagem: separada.ausentes.length,
              },
              {
                id: "confirmadas",
                rotulo: "Confirmadas",
                contagem: separada.confirmadas.length,
              },
            ]}
          />
          {daAba.length ? (
            <div className="anexos-quadro">
              <table className="anexos-tabela">
                <thead>
                  <tr>
                    <th className="anexos-num">Vaga</th>
                    <th>Nome da vaga</th>
                    <th>Linha do quadro</th>
                    {podeEditar && <th>Decidir</th>}
                  </tr>
                </thead>
                <tbody>
                  {daAba.map((v) => (
                    <LinhaDaFila
                      key={`${v.vaga}|${v.quadro}|${v.origem}|${v.situacao}`}
                      v={v}
                      linhas={fila.linhas}
                      podeEditar={podeEditar}
                      ocupado={ocupado}
                      aoGravar={gravar}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EstadoVazio>Nenhuma vaga nesta situação.</EstadoVazio>
          )}
        </div>
      )}
    </>
  );
}
