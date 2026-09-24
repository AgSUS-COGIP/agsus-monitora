import { useMemo, useState } from "react";
import { canImportApprovedList } from "../../lib/access-roles.js";
import {
  categoriasDeReserva,
  modeloDeReferencia,
  modeloEmBranco,
} from "../../lib/modelo-de-convocacao.js";
import { totalDoQuadro } from "../../lib/lista-convocacao-rules.js";
import {
  copiaDoModelo,
  lerInteiro,
  modeloPorId,
  quadroDaVaga,
  rascunhoDoFormulario,
  resumirQuadro,
  resumoDoModelo,
} from "../../lib/configuracao-de-convocacao.js";
import { EditorDeModelo } from "./editor-de-modelo.jsx";
import { CampoEditavel, classes, plural } from "./partes.jsx";

/*
  A aba "Lista de convocação" do modal de listas do edital: o MODELO de regras
  e quantas vagas imediatas cada vaga tem. O rascunho mora aqui, criado do que
  está no banco a cada abertura do modal, e só vai para o banco em "Salvar
  convocação". O que se guarda é a entrada (percentual no modelo, total na
  vaga); o quadro por categoria é derivado na hora.
*/

/* Abre já no formato mais comum — sete dos dezasseis editais lidos usam este. */
const BASE_DE_MODELO_NOVO = "lei-15142-2025";

function QuadroDaVaga({ vaga, modelo, editavel, aoMudarCota }) {
  if (vaga.manual)
    return modelo.categorias.map((categoria) => (
      <label key={categoria.id} className="convocacao-quadro-campo">
        <span>{categoria.sigla}</span>
        <CampoEditavel
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          valor={vaga.quadro[categoria.id] ?? 0}
          ler={lerInteiro}
          data-convocacao-vaga-cota={categoria.id}
          aria-label={`${categoria.rotulo} da vaga ${vaga.codigo}`}
          disabled={!editavel}
          aoMudar={(valor) => aoMudarCota(categoria.id, valor)}
        />
      </label>
    ));
  const resumo = resumirQuadro(quadroDaVaga(vaga, modelo), modelo);
  return resumo ? (
    <span className="convocacao-quadro-derivado">{resumo}</span>
  ) : (
    <span className="convocacao-quadro-derivado vazio">
      Cadastro de reserva
    </span>
  );
}

export function FormularioDeConvocacao({
  ativa,
  estado,
  perfil,
  editalId,
  candidatos,
  configs,
  modelos,
}) {
  const [formulario, setFormulario] = useState(() =>
    rascunhoDoFormulario(candidatos, configs, editalId),
  );
  /* O modelo em edição, ou `null`: { novo, modelo, editais, abertura }. */
  const [editor, setEditor] = useState(null);

  const editavel = canImportApprovedList(perfil);
  const escolhido = modeloPorId(modelos, formulario.modeloId);
  const modelo = useMemo(() => escolhido || modeloEmBranco(), [escolhido]);
  /*
    Sem modelo escolhido o quadro tem uma coluna só — a ampla —, e oferecer a
    sobrescrita manual daria um único campo "AC" que não distribui nada. A
    caixa fica desligada, dizendo o que falta fazer antes.
  */
  const semReservas = categoriasDeReserva(modelo).length === 0;
  const modelosEmOrdem = useMemo(
    () =>
      [...modelos.values()].sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR"),
      ),
    [modelos],
  );
  /*
    As vagas só entram em cena depois de haver regra: o quadro de cada uma é
    DERIVADO do modelo, e pedir números antes disso mostra um resultado que vai
    mudar assim que o modelo for escolhido. Enquanto o editor está aberto elas
    também saem da frente — é uma tarefa de cada vez, e o quadro desenhado a
    partir de um modelo ainda por salvar seria mentira.
  */
  const bloqueado = Boolean(editor) || !escolhido;

  const mudar = (mudancas) =>
    setFormulario((atual) => ({ ...atual, ...mudancas }));
  const mudarVaga = (codigo, transformar) =>
    setFormulario((atual) => ({
      ...atual,
      vagas: atual.vagas.map((vaga) =>
        vaga.codigo === codigo ? { ...vaga, ...transformar(vaga) } : vaga,
      ),
    }));

  function abrirEditor(base, { novo = false } = {}) {
    const copia = copiaDoModelo(base);
    if (novo) copia.id = "";
    setEditor((anterior) => ({
      novo,
      modelo: copia,
      editais: novo ? 0 : (modeloPorId(modelos, base.id)?.editais ?? 0),
      abertura: (anterior?.abertura ?? 0) + 1,
    }));
  }

  function aplicarPadrao() {
    setFormulario((atual) => ({
      ...atual,
      vagas: atual.vagas.map((vaga) => ({
        ...vaga,
        imediatas: atual.padraoImediata,
      })),
    }));
    estado.toast("Total aplicado a todas as vagas. Falta salvar.");
  }

  /*
    Ao ligar a sobrescrita manual, o quadro derivado é copiado para os campos:
    começar do zero faria a vaga perder as vagas que já tinha.
  */
  function alternarManual(codigo, ligando) {
    mudarVaga(codigo, (vaga) => ({
      manual: ligando,
      quadro:
        ligando && totalDoQuadro(vaga.quadro) === 0
          ? quadroDaVaga(vaga, modelo)
          : vaga.quadro,
    }));
  }

  async function salvarModelo() {
    const novoId = await estado.salvarModelo(editor.modelo);
    if (novoId === null) return;
    mudar({ modeloId: novoId });
    setEditor(null);
  }

  async function removerModelo() {
    const removido = editor.modelo.id;
    if (!(await estado.removerModelo(editor.modelo, editor.editais))) return;
    setFormulario((atual) =>
      atual.modeloId === removido ? { ...atual, modeloId: "" } : atual,
    );
    setEditor(null);
  }

  return (
    <div
      id="approvedImportPanelConvocacao"
      className={classes("approved-tabpanel", !ativa && "hidden")}
      role="tabpanel"
      aria-labelledby="approvedImportTabConvocacao"
    >
      <fieldset className="convocacao-tipo">
        <legend>Tipo de convocação</legend>
        <label className="convocacao-tipo-card">
          <input
            type="radio"
            name="convocacaoTipo"
            value="com"
            checked={formulario.proporcionalidade}
            disabled={!editavel}
            onChange={() => mudar({ proporcionalidade: true })}
          />
          <span className="convocacao-tipo-copy">
            <strong>Com proporcionalidade</strong>
            <small>
              As vagas de cota entram intercaladas às de ampla ao longo da
              convocação.
            </small>
          </span>
        </label>
        <label className="convocacao-tipo-card">
          <input
            type="radio"
            name="convocacaoTipo"
            value="sem"
            checked={!formulario.proporcionalidade}
            disabled={!editavel}
            onChange={() => mudar({ proporcionalidade: false })}
          />
          <span className="convocacao-tipo-copy">
            <strong>Sem proporcionalidade</strong>
            <small>
              A convocação segue a lista de aprovados, pela classificação.
            </small>
          </span>
        </label>
      </fieldset>

      {/* Sem proporcionalidade não há reserva a distribuir; o quadro sai da frente. */}
      <div
        id="convocacaoQuadro"
        className={classes(
          "convocacao-quadro",
          !formulario.proporcionalidade && "hidden",
        )}
      >
        <div className="convocacao-bloco-head">
          <div>
            <strong>Modelo de regras</strong>
            <small>
              As regras de reserva deste edital: categorias, percentuais,
              arredondamento e cascata.
            </small>
          </div>
          <div className="convocacao-bloco-acoes">
            <select
              id="convocacaoModelo"
              className="convocacao-modelo-select"
              aria-label="Modelo de regras"
              value={formulario.modeloId}
              disabled={!editavel}
              onChange={(evento) => {
                mudar({ modeloId: evento.target.value });
                setEditor(null);
              }}
            >
              <option value="">— sem modelo —</option>
              {modelosEmOrdem.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
            {editavel ? (
              <button
                id="convocacaoEditarModelo"
                className="btn outline"
                type="button"
                disabled={!escolhido}
                onClick={() => abrirEditor(escolhido)}
              >
                <i className="fa-solid fa-sliders" aria-hidden="true" /> Editar
              </button>
            ) : null}
            {editavel ? (
              <button
                id="convocacaoNovoModelo"
                className="btn outline"
                type="button"
                onClick={() =>
                  abrirEditor(modeloDeReferencia(BASE_DE_MODELO_NOVO), {
                    novo: true,
                  })
                }
              >
                <i className="fa-solid fa-plus" aria-hidden="true" /> Novo
              </button>
            ) : null}
          </div>
        </div>
        <p
          id="convocacaoModeloResumo"
          className={classes(
            "convocacao-modelo-resumo",
            escolhido?.editais > 1 && "compartilhado",
          )}
        >
          {resumoDoModelo(escolhido)}
        </p>
        <div
          id="convocacaoEditorModelo"
          className={classes("convocacao-editor", !editor && "hidden")}
        >
          {editor ? (
            <EditorDeModelo
              key={editor.abertura}
              editor={editor}
              aoAlterar={(transformar) =>
                setEditor((atual) => ({
                  ...atual,
                  modelo: transformar(atual.modelo),
                }))
              }
              aoEscolherBase={(id) => {
                const partida = id ? modeloDeReferencia(id) : modeloEmBranco();
                // O nome já digitado sobrevive à troca de base: é do edital, não da regra.
                abrirEditor(
                  { ...partida, id: "", nome: editor.modelo.nome },
                  { novo: true },
                );
              }}
              aoDuplicar={() => {
                abrirEditor(
                  {
                    ...editor.modelo,
                    id: "",
                    nome: `${editor.modelo.nome} (cópia)`,
                  },
                  { novo: true },
                );
                estado.toast("Cópia aberta. Salve para criar o modelo novo.");
              }}
              aoRemover={() => void removerModelo()}
              aoCancelar={() => setEditor(null)}
              aoSalvar={() => void salvarModelo()}
            />
          ) : null}
        </div>
        <p
          id="convocacaoVagasBloqueadas"
          className={classes(
            "convocacao-vagas-bloqueadas",
            !bloqueado && "hidden",
          )}
        >
          {editor
            ? "Termine o modelo primeiro: salve ou cancele, e as vagas do edital voltam."
            : bloqueado
              ? "Escolha um modelo de regras acima, ou crie um, para informar as vagas de cada uma."
              : ""}
        </p>
        <div
          id="convocacaoVagasBloco"
          className={bloqueado ? "hidden" : undefined}
        >
          <div className="convocacao-bloco-head">
            <div>
              <strong>Vagas do edital</strong>
              <small>
                Informe quantas vagas imediatas cada uma tem. Zero vira cadastro
                de reserva.
              </small>
            </div>
            <div className="convocacao-bloco-acoes">
              <label
                className="convocacao-padrao-campo"
                htmlFor="convocacaoPadraoImediata"
              >
                Padrão
                <CampoEditavel
                  id="convocacaoPadraoImediata"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  valor={formulario.padraoImediata}
                  ler={lerInteiro}
                  disabled={!editavel}
                  aoMudar={(padraoImediata) => mudar({ padraoImediata })}
                />
              </label>
              {editavel ? (
                <button
                  id="convocacaoAplicarPadrao"
                  className="btn outline"
                  type="button"
                  onClick={aplicarPadrao}
                >
                  <i
                    className="fa-solid fa-arrow-down-1-9"
                    aria-hidden="true"
                  />{" "}
                  Aplicar a todas
                </button>
              ) : null}
              <span id="convocacaoVagasResumo" className="chip blue">
                {plural(formulario.vagas.length, "vaga", "vagas")}
              </span>
            </div>
          </div>
          <div className="table-wrap convocacao-vagas-wrap">
            <table className="approved-table convocacao-vagas-table">
              <thead id="convocacaoVagasHead">
                <tr>
                  <th>Vaga</th>
                  <th className="num">Imediatas</th>
                  <th>Quadro de vagas</th>
                  <th className="num">Manual</th>
                </tr>
              </thead>
              <tbody id="convocacaoVagasRows">
                {formulario.vagas.length ? (
                  formulario.vagas.map((vaga) => (
                    <tr key={vaga.codigo} data-convocacao-vaga={vaga.codigo}>
                      <td>
                        <div className="approved-name">
                          <strong>{vaga.codigo}</strong>
                          <small>
                            {vaga.cargo || "Cargo não identificado"}
                            {vaga.na_lista
                              ? ` · ${plural(vaga.total, "candidato", "candidatos")}`
                              : " · fora da lista atual"}
                          </small>
                        </div>
                      </td>
                      <td className="num">
                        <CampoEditavel
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          valor={vaga.imediatas ?? 0}
                          ler={lerInteiro}
                          data-convocacao-imediatas=""
                          aria-label={`Vagas imediatas da vaga ${vaga.codigo}`}
                          disabled={!editavel}
                          aoMudar={(imediatas) =>
                            mudarVaga(vaga.codigo, () => ({ imediatas }))
                          }
                        />
                      </td>
                      <td className="convocacao-quadro-celula">
                        <QuadroDaVaga
                          vaga={vaga}
                          modelo={modelo}
                          editavel={editavel}
                          aoMudarCota={(categoria, valor) =>
                            mudarVaga(vaga.codigo, (atual) => ({
                              quadro: { ...atual.quadro, [categoria]: valor },
                            }))
                          }
                        />
                      </td>
                      <td className="num">
                        <input
                          type="checkbox"
                          data-convocacao-manual=""
                          checked={vaga.manual}
                          disabled={semReservas || !editavel}
                          title={
                            semReservas
                              ? "Escolha um modelo de regras para poder distribuir as vagas por cota."
                              : "Editar à mão o quadro desta vaga"
                          }
                          aria-label={`Editar à mão o quadro da vaga ${vaga.codigo}`}
                          onChange={(evento) =>
                            alternarManual(vaga.codigo, evento.target.checked)
                          }
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="approved-empty">
                      Importe a lista de aprovados para que as vagas apareçam
                      aqui.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p id="convocacaoPermissionNote" className="modal-note">
        {editavel
          ? "O modelo e as vagas valem para o edital e sobrevivem à substituição do XLSX."
          : "Sem permissão para configurar a convocação deste edital."}
      </p>
      <div className="approved-modal-actions approved-import-actions">
        <span className="approved-action-spacer" />
        {editavel ? (
          <button
            id="convocacaoSalvar"
            className="btn green"
            type="button"
            onClick={() => void estado.salvarConfiguracao(formulario)}
          >
            <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Salvar
            convocação
          </button>
        ) : null}
      </div>
    </div>
  );
}
