import { useEffect, useId, useMemo, useState } from "react";
import { Aviso, Campo, FecharModal, Modal, Selo } from "../../ui/index.ts";
import {
  cargoDaLista,
  linhasDoQuadro,
  modalidadesDoQuadro,
  problemaDoMotivo,
  problemasDoRascunho,
  quadroRetificado,
  rascunhoDaLinha,
  resumoDaMudanca,
  TEXTO_DO_EFEITO,
  totalDoRascunho,
} from "../../lib/editais/retificar-quadro.ts";
import type {
  EfeitoNaVaga,
  LinhaVigente,
  MudancaNoQuadro,
  QuadroRetificado,
  RascunhoDaLinha,
  ResumoDaMudanca,
} from "../../lib/editais/retificar-quadro.ts";
import { textoDaModalidade } from "../../lib/editais/anexos-do-edital.ts";
import { rotuloDaLinha } from "../../lib/editais/vinculos-do-quadro.ts";

/** O que a retificação usa do estado da página (`estado.ts`). */
export interface EstadoDaRetificacaoDoQuadro {
  /** `salvar_quadro_de_vagas`: grava (ou simula) e devolve o quadro. */
  salvarQuadroDeVagas(id: string, quadro: QuadroRetificado): Promise<unknown>;
  /** `listar_cargos`: os cargos oficiais da área, para escolher no campo Cargo. */
  listarCargos?(area: string): Promise<string[]>;
}

export interface PropriedadesDoQuadroSalvo {
  estado: EstadoDaRetificacaoDoQuadro;
  idEdital: string;
  /** A área do edital: os cargos oficiais dela aparecem no campo Cargo. */
  area?: string;
  /** O payload de `obter_quadro_de_vagas`. */
  dados: unknown;
  /** O quadro devolvido depois de gravar. */
  aoMudar: (dados: unknown) => void;
}

/*
  O quadro de vagas salvo do edital, linha por linha, com Editar, Retirar e "Acrescentar vaga"
  para quem grava o quadro (Núcleo ou Calendário, editor: `pode_editar`). A mudança abre um modal:
  os campos da linha (o total sai da soma das modalidades), depois a prévia simulada no banco (a
  linha antes e depois e as vagas da seleção que seguem, ficam sem linha ou passam a ela), o
  motivo e o número da errata. Grava pela mesma RPC do PDF (`salvar_quadro_de_vagas`, migration
  20261126180000), com o quadro inteiro. Regras puras em `src/lib/editais/retificar-quadro.ts`.

  Sem o banco novo (`historico` ausente no payload), o quadro só se mostra: a RPC antiga ignoraria
  a simulação e gravaria.
*/

const TOM_DO_EFEITO: Record<EfeitoNaVaga, string> = {
  continua: "neutro",
  "sem-linha": "reprovado",
  passa: "aprovado",
  muda: "pendente",
};

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

const mensagem = (e: unknown) =>
  (e as Error | null)?.message || String(e || "Falha ao gravar.");

/** Cabeçalho e células de uma linha do quadro (a tabela e a prévia usam). */
function CelulasDaLinha({
  linha,
  modalidades,
  temLotacao,
}: {
  linha: LinhaVigente;
  modalidades: readonly string[];
  temLotacao: boolean;
}) {
  return (
    <>
      <td>
        {linha.cargo}
        {linha.origem === "MANUAL" ? (
          <>
            {" "}
            <Selo tom="revisar" className="quadro-selo-manual">
              Manual
            </Selo>
          </>
        ) : null}
      </td>
      {temLotacao && <td>{linha.lotacao || "—"}</td>}
      {modalidades.map((m) => (
        <td key={m} className="anexos-num">
          {textoDaModalidade(
            linha.modalidades[m] ?? undefined,
            linha.cadastroReserva,
          )}
        </td>
      ))}
      <td className="anexos-num">
        <b>{linha.vagasImediatas}</b>
      </td>
      <td className="anexos-num">{linha.cadastroReserva ? "Sim" : "—"}</td>
    </>
  );
}

function Cabecalho({
  modalidades,
  temLotacao,
  primeira,
  ultima,
}: {
  modalidades: readonly string[];
  temLotacao: boolean;
  primeira?: string;
  ultima?: string;
}) {
  return (
    <thead>
      <tr>
        {primeira !== undefined && <th>{primeira}</th>}
        <th>Cargo</th>
        {temLotacao && <th>Lotação</th>}
        {modalidades.map((m) => (
          <th key={m} className="anexos-num">
            {m}
          </th>
        ))}
        <th className="anexos-num">Imediatas</th>
        <th className="anexos-num">CR</th>
        {ultima !== undefined && <th>{ultima}</th>}
      </tr>
    </thead>
  );
}

export function QuadroSalvo({
  estado,
  idEdital,
  area = "",
  dados,
  aoMudar,
}: PropriedadesDoQuadroSalvo) {
  const linhas = useMemo(() => linhasDoQuadro(dados), [dados]);
  const modalidades = useMemo(() => modalidadesDoQuadro(linhas), [linhas]);
  const bruto = dados as {
    pode_editar?: unknown;
    historico?: unknown;
  } | null;
  const podeRetificar =
    bruto?.pode_editar === true && Array.isArray(bruto?.historico);
  const temLotacao = linhas.some((l) => l.lotacao);
  const [mudanca, setMudanca] = useState<MudancaNoQuadro | null>(null);
  // Os cargos oficiais da área; sem eles (outra área, falha), o campo Cargo é de texto livre.
  const [cargos, setCargos] = useState<readonly string[]>([]);
  useEffect(() => {
    if (!podeRetificar || !area || !estado.listarCargos) return undefined;
    let vivo = true;
    estado
      .listarCargos(area)
      .then((lista) => {
        if (vivo) setCargos(lista);
      })
      .catch(() => {
        if (vivo) setCargos([]);
      });
    return () => {
      vivo = false;
    };
  }, [estado, area, podeRetificar]);

  return (
    <div className="quadro-salvo" data-quadro-salvo="">
      <div className="anexos-quadro">
        <table className="anexos-tabela">
          <Cabecalho
            modalidades={modalidades}
            temLotacao={temLotacao}
            ultima={podeRetificar ? "" : undefined}
          />
          <tbody>
            {linhas.map((l) => (
              <tr key={l.id} data-linha-do-quadro={l.id}>
                <CelulasDaLinha
                  linha={l}
                  modalidades={modalidades}
                  temLotacao={temLotacao}
                />
                {podeRetificar && (
                  <td className="anexos-num">
                    <span className="quadro-acoes-da-linha">
                      <button
                        type="button"
                        className="btn secondary small"
                        data-acao="editar-linha-do-quadro"
                        aria-label={`Editar ${rotuloDaLinha(l)}`}
                        onClick={() =>
                          setMudanca({
                            tipo: "editar",
                            id: l.id,
                            linha: rascunhoDaLinha(l, modalidades),
                          })
                        }
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn ghost small"
                        data-acao="retirar-linha-do-quadro"
                        aria-label={`Retirar ${rotuloDaLinha(l)}`}
                        onClick={() =>
                          setMudanca({ tipo: "retirar", id: l.id })
                        }
                      >
                        Retirar
                      </button>
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {podeRetificar && (
        <div className="anexos-linha">
          <button
            type="button"
            className="btn secondary"
            data-acao="acrescentar-linha-do-quadro"
            onClick={() =>
              setMudanca({
                tipo: "acrescentar",
                linha: rascunhoDaLinha(null, modalidades),
              })
            }
          >
            <i className="fa-solid fa-plus" aria-hidden="true" /> Acrescentar
            vaga
          </button>
        </div>
      )}
      {mudanca && (
        <RetificarLinha
          estado={estado}
          idEdital={idEdital}
          dados={dados}
          linhas={linhas}
          modalidades={modalidades}
          cargos={cargos}
          inicial={mudanca}
          aoGravar={(novo) => {
            setMudanca(null);
            aoMudar(novo);
          }}
          aoFechar={() => setMudanca(null)}
        />
      )}
    </div>
  );
}

interface PropriedadesDeRetificarLinha {
  estado: EstadoDaRetificacaoDoQuadro;
  idEdital: string;
  dados: unknown;
  linhas: readonly LinhaVigente[];
  modalidades: readonly string[];
  cargos: readonly string[];
  inicial: MudancaNoQuadro;
  aoGravar: (dados: unknown) => void;
  aoFechar: () => void;
}

const TITULO: Record<MudancaNoQuadro["tipo"], string> = {
  editar: "Editar vaga do quadro",
  acrescentar: "Acrescentar vaga ao quadro",
  retirar: "Retirar vaga do quadro",
};

const SIMULACAO = "Simulação da retificação";
/* A opção da lista de cargos que abre o campo do nome novo. */
const OUTRO_CARGO = "__outro__";

function RetificarLinha({
  estado,
  idEdital,
  dados,
  linhas,
  modalidades,
  cargos,
  inicial,
  aoGravar,
  aoFechar,
}: PropriedadesDeRetificarLinha) {
  const tituloId = useId();
  const [rascunho, setRascunho] = useState<RascunhoDaLinha | null>(
    inicial.tipo === "retirar" ? null : inicial.linha,
  );
  // "Outro cargo" escolhido na lista: o nome se digita (cargo fora do catálogo da área).
  const [outroCargo, setOutroCargo] = useState(false);
  const [resumo, setResumo] = useState<ResumoDaMudanca | null>(null);
  const [motivo, setMotivo] = useState("");
  const [errata, setErrata] = useState("");
  const [tentou, setTentou] = useState(false);
  const [ocupado, setOcupado] = useState<"" | "simulando" | "gravando">(
    inicial.tipo === "retirar" ? "simulando" : "",
  );
  const [erro, setErro] = useState("");

  const idEditado = inicial.tipo === "editar" ? inicial.id : null;
  const mudanca: MudancaNoQuadro | null =
    inicial.tipo === "retirar"
      ? inicial
      : rascunho
        ? inicial.tipo === "editar"
          ? { tipo: "editar", id: inicial.id, linha: rascunho }
          : { tipo: "acrescentar", linha: rascunho }
        : null;
  const problemas = rascunho
    ? problemasDoRascunho(rascunho, linhas, idEditado)
    : [];
  const erroDoMotivo = problemaDoMotivo(motivo);
  const alterado =
    motivo.trim() !== "" ||
    (inicial.tipo !== "retirar" &&
      JSON.stringify(rascunho) !== JSON.stringify(inicial.linha));

  async function conferir() {
    if (!mudanca || ocupado) return;
    if (problemas.length) {
      setTentou(true);
      return;
    }
    setOcupado("simulando");
    setErro("");
    setTentou(false);
    await simular(mudanca, () => true);
  }

  /** A prévia: `salvar_quadro_de_vagas` com `simular: true` (nada fica gravado). */
  function simular(m: MudancaNoQuadro, vivo: () => boolean) {
    return estado
      .salvarQuadroDeVagas(
        idEdital,
        quadroRetificado(linhas, m, motivo.trim() || SIMULACAO, errata, true),
      )
      .then((simulado) => {
        if (vivo()) setResumo(resumoDaMudanca(dados, simulado, m));
      })
      .catch((e: unknown) => {
        if (vivo()) setErro(`Não foi possível conferir: ${mensagem(e)}`);
      })
      .finally(() => {
        if (vivo()) setOcupado("");
      });
  }

  // Retirar não tem formulário: a prévia vem logo que o modal abre.
  useEffect(() => {
    if (inicial.tipo !== "retirar") return undefined;
    let vivo = true;
    void simular(inicial, () => vivo);
    return () => {
      vivo = false;
    };
    // Só ao abrir: o retirar não tem campo que mude a simulação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function gravar() {
    if (!mudanca || ocupado) return;
    if (erroDoMotivo) {
      setTentou(true);
      return;
    }
    setOcupado("gravando");
    setErro("");
    try {
      aoGravar(
        await estado.salvarQuadroDeVagas(
          idEdital,
          quadroRetificado(linhas, mudanca, motivo, errata),
        ),
      );
    } catch (e) {
      setErro(`A retificação não foi gravada: ${mensagem(e)}`);
      setOcupado("");
    }
  }

  const mudar = (parte: Partial<RascunhoDaLinha>) => {
    setRascunho((r) => (r ? { ...r, ...parte } : r));
    setResumo(null);
  };

  /*
    O campo Cargo: com o catálogo da área, a lista dos cargos oficiais e, no fim, "Outro cargo",
    que abre o nome a digitar (o cargo que a linha já tinha e não está na lista abre assim).
    Sem catálogo, texto livre.
  */
  function campoDoCargo() {
    if (!rascunho) return null;
    const semCargo =
      tentou && !rascunho.cargo.trim() ? "Informe o cargo." : undefined;
    const digitado = (
      <input
        type="text"
        maxLength={300}
        data-foco-inicial={cargos.length ? undefined : ""}
        data-campo="cargo"
        value={rascunho.cargo}
        onChange={(e) => mudar({ cargo: e.target.value })}
      />
    );
    if (!cargos.length)
      return (
        <Campo rotulo="Cargo" obrigatorio largo erro={semCargo}>
          {digitado}
        </Campo>
      );
    const daLista = cargoDaLista(rascunho.cargo, cargos);
    const outro = outroCargo || (rascunho.cargo.trim() !== "" && !daLista);
    return (
      <>
        <Campo
          rotulo="Cargo"
          obrigatorio
          largo
          erro={outro ? undefined : semCargo}
        >
          <select
            data-foco-inicial=""
            data-campo="cargo-da-lista"
            value={outro ? OUTRO_CARGO : (daLista ?? "")}
            onChange={(e) => {
              const valor = e.target.value;
              setOutroCargo(valor === OUTRO_CARGO);
              mudar({ cargo: valor === OUTRO_CARGO ? "" : valor });
            }}
          >
            <option value="">Escolha o cargo…</option>
            {cargos.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
            <option value={OUTRO_CARGO}>Outro cargo (fora da lista)</option>
          </select>
        </Campo>
        {outro && (
          <Campo rotulo="Nome do cargo" obrigatorio largo erro={semCargo}>
            {digitado}
          </Campo>
        )}
      </>
    );
  }

  const semLinha = resumo?.vagas.filter((v) => v.efeito === "sem-linha") ?? [];
  const nomesDaPrevia = resumo
    ? modalidadesDoQuadro(
        [resumo.antes, resumo.depois].filter(
          (l): l is LinhaVigente => l !== null,
        ),
      )
    : [];
  const lotacaoNaPrevia = Boolean(
    resumo?.antes?.lotacao || resumo?.depois?.lotacao,
  );

  return (
    <Modal
      rotuloId={tituloId}
      aoFechar={() => {
        if (ocupado !== "gravando") aoFechar();
      }}
      alterado={alterado}
      tamanho="grande"
      cartaoClassName="retificar-quadro"
    >
      <h2 id={tituloId}>{TITULO[inicial.tipo]}</h2>

      {rascunho && !resumo && (
        <div className="ui-grade-de-campos" data-formulario-da-linha="">
          {campoDoCargo()}
          <Campo rotulo="Lotação" largo>
            <input
              type="text"
              maxLength={300}
              data-campo="lotacao"
              value={rascunho.lotacao}
              onChange={(e) => mudar({ lotacao: e.target.value })}
            />
          </Campo>
          {rascunho.modalidades.map((m, i) => (
            <Campo key={m.nome} rotulo={m.nome}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                data-modalidade={m.nome}
                value={m.quantidade}
                onChange={(e) =>
                  mudar({
                    modalidades: rascunho.modalidades.map((x, j) =>
                      j === i ? { ...x, quantidade: e.target.value } : x,
                    ),
                  })
                }
              />
            </Campo>
          ))}
          <Campo rotulo="Vagas imediatas">
            <output data-total-da-linha="" className="quadro-total">
              {totalDoRascunho(rascunho)}
            </output>
          </Campo>
          <label className="quadro-cr">
            <input
              type="checkbox"
              data-campo="cadastro-reserva"
              checked={rascunho.cadastroReserva}
              onChange={(e) => mudar({ cadastroReserva: e.target.checked })}
            />{" "}
            Cadastro reserva
          </label>
          {tentou && problemas.length > 0 && (
            <Aviso tom="danger" papel="alert" className="ui-campo-largo">
              {problemas.join(" ")}
            </Aviso>
          )}
        </div>
      )}

      {resumo && (
        <div className="quadro-previa" data-previa-da-retificacao="">
          <div className="anexos-quadro">
            <table className="anexos-tabela">
              <Cabecalho
                modalidades={nomesDaPrevia}
                temLotacao={lotacaoNaPrevia}
                primeira=""
              />
              <tbody>
                <tr data-previa="antes">
                  <th scope="row">Antes</th>
                  {resumo.antes ? (
                    <CelulasDaLinha
                      linha={resumo.antes}
                      modalidades={nomesDaPrevia}
                      temLotacao={lotacaoNaPrevia}
                    />
                  ) : (
                    <td
                      colSpan={
                        nomesDaPrevia.length + 3 + Number(lotacaoNaPrevia)
                      }
                    >
                      Linha nova
                    </td>
                  )}
                </tr>
                <tr data-previa="depois">
                  <th scope="row">Depois</th>
                  {resumo.depois ? (
                    <CelulasDaLinha
                      linha={resumo.depois}
                      modalidades={nomesDaPrevia}
                      temLotacao={lotacaoNaPrevia}
                    />
                  ) : (
                    <td
                      colSpan={
                        nomesDaPrevia.length + 3 + Number(lotacaoNaPrevia)
                      }
                    >
                      Retirada do quadro
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          {semLinha.length > 0 && (
            <Aviso tom="warning" papel="status">
              {semLinha.length === 1
                ? `A vaga ${semLinha[0]!.vaga} fica sem linha no quadro.`
                : `${semLinha.length} vagas ficam sem linha no quadro.`}
            </Aviso>
          )}
          {resumo.vagas.length ? (
            <div className="anexos-quadro">
              <table className="anexos-tabela" data-vagas-da-previa="">
                <thead>
                  <tr>
                    <th>Vaga da seleção</th>
                    <th>Linha antes</th>
                    <th>Linha depois</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {resumo.vagas.map((v) => (
                    <tr key={v.vaga} data-vaga={v.vaga} data-efeito={v.efeito}>
                      <td>
                        <b>{v.vaga}</b> {v.nome}
                        {v.pelaEquipe ? (
                          <div className="ui-texto-secundario">
                            Ligada pela equipe
                          </div>
                        ) : null}
                      </td>
                      <td>{v.antes || "—"}</td>
                      <td>{v.depois || "—"}</td>
                      <td>
                        <Selo tom={TOM_DO_EFEITO[v.efeito]}>
                          {TEXTO_DO_EFEITO[v.efeito]}
                        </Selo>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="ui-texto-secundario" data-sem-vagas="">
              Nenhuma vaga da seleção muda de linha.
            </p>
          )}

          <div className="ui-grade-de-campos">
            <Campo
              rotulo="Motivo"
              obrigatorio
              largo
              erro={tentou && erroDoMotivo ? erroDoMotivo : undefined}
            >
              <textarea
                rows={2}
                maxLength={500}
                data-campo="motivo"
                data-foco-inicial=""
                placeholder="Ex.: Retificação nº 2 do edital"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </Campo>
            <Campo rotulo="Número da errata">
              <input
                type="text"
                maxLength={100}
                data-campo="errata"
                value={errata}
                onChange={(e) => setErrata(e.target.value)}
              />
            </Campo>
          </div>
        </div>
      )}

      {ocupado === "simulando" && !resumo && (
        <p className="ui-texto-secundario" role="status">
          <span className="botao-girando" aria-hidden="true" /> Conferindo o que
          muda…
        </p>
      )}
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}

      <div className="ui-acoes">
        <FecharModal
          className="btn secondary"
          disabled={ocupado === "gravando"}
        >
          Cancelar
        </FecharModal>
        {resumo && inicial.tipo !== "retirar" && (
          <button
            type="button"
            className="btn secondary"
            disabled={Boolean(ocupado)}
            onClick={() => setResumo(null)}
          >
            Voltar
          </button>
        )}
        {resumo ? (
          <button
            type="button"
            className={inicial.tipo === "retirar" ? "btn danger" : "btn"}
            data-acao="gravar-retificacao-do-quadro"
            disabled={Boolean(ocupado)}
            onClick={() => void gravar()}
          >
            {ocupado === "gravando"
              ? "Gravando…"
              : inicial.tipo === "retirar"
                ? semLinha.length
                  ? `Retirar e deixar ${plural(semLinha.length, "vaga", "vagas")} sem linha`
                  : "Retirar a linha"
                : "Salvar retificação"}
          </button>
        ) : (
          rascunho && (
            <button
              type="button"
              className="btn"
              data-acao="conferir-retificacao-do-quadro"
              disabled={Boolean(ocupado)}
              onClick={() => void conferir()}
            >
              {ocupado === "simulando" ? "Conferindo…" : "Conferir o que muda"}
            </button>
          )
        )}
      </div>
    </Modal>
  );
}
