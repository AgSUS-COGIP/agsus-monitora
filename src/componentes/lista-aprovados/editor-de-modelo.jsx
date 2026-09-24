import {
  ARREDONDAMENTOS,
  COTAS_MULTIPLAS,
  DISTRIBUICOES,
  MODELOS_DE_REFERENCIA,
  lerTermos,
} from "../../lib/modelo-de-convocacao.js";
import {
  acrescentarCategoria,
  alterarCategoria,
  alternarNaCascata,
  destinosDaCascata,
  faltaCategoriaAcumulavel,
  lerInteiro,
  lerPosicoes,
  lerTaxa,
  removerCategoria,
} from "../../lib/configuracao-de-convocacao.js";
import { CampoEditavel, classes } from "./partes.jsx";

/*
  Editor do modelo de regras de convocação, dentro do formulário do edital.
  Edita um rascunho (`editor.modelo`, uma cópia): enquanto está aberto, o
  modelo guardado continua a valer para a tabela de vagas. Quem guarda o
  rascunho e salva é `formulario-de-convocacao.jsx`; `aoAlterar` recebe uma
  função do modelo atual para o próximo.
*/

const juntar = (lista) => lista.join("; ");

/*
  A ajuda da opção escolhida fica VISÍVEL, e não num `title` que ninguém
  descobre: são decisões que o rótulo sozinho não explica, e o preço de errar é
  uma convocação inteira calculada de outro jeito.
*/
function CampoDeEscolha({ chave, lista, valor, rotulo, aoMudar }) {
  const escolhida = lista.find((item) => item.id === valor) || lista[0];
  return (
    <label className="convocacao-editor-campo">
      <span>{rotulo}</span>
      <select
        data-convocacao-modelo={chave}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
      >
        {lista.map((item) => (
          <option key={item.id} value={item.id}>
            {item.rotulo}
          </option>
        ))}
      </select>
      <small className="convocacao-editor-ajuda">
        {escolhida?.ajuda || ""}
      </small>
    </label>
  );
}

function Aviso({ children }) {
  return (
    <p className="convocacao-editor-aviso">
      <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />{" "}
      {children}
    </p>
  );
}

function FichaDaCategoria({ categoria, modelo, aoMudar, aoRemover }) {
  const destinos = destinosDaCascata(categoria, modelo);
  const posicaoFixa = modelo.distribuicao === "posicao_fixa";

  return (
    <div
      className="convocacao-categoria"
      data-convocacao-categoria={categoria.id}
    >
      <div className="convocacao-categoria-topo">
        <input
          className="convocacao-categoria-rotulo"
          type="text"
          value={categoria.rotulo}
          data-convocacao-cat="rotulo"
          aria-label="Nome da categoria"
          onChange={(evento) => aoMudar({ rotulo: evento.target.value })}
        />
        <input
          className="convocacao-categoria-sigla"
          type="text"
          maxLength={10}
          value={categoria.sigla}
          data-convocacao-cat="sigla"
          aria-label="Sigla"
          onChange={(evento) => aoMudar({ sigla: evento.target.value })}
        />
        {categoria.ampla ? (
          <span className="convocacao-categoria-tag">recebe o resto</span>
        ) : (
          <>
            <label className="convocacao-categoria-taxa">
              <CampoEditavel
                type="number"
                min="0"
                max="100"
                step="0.01"
                inputMode="decimal"
                valor={categoria.percentual}
                ler={lerTaxa}
                data-convocacao-cat="percentual"
                aria-label="Percentual reservado"
                aoMudar={(percentual) => aoMudar({ percentual })}
              />
              <span>%</span>
            </label>
            <button
              className="btn icon red"
              type="button"
              data-convocacao-remover-categoria=""
              title="Remover categoria"
              aria-label={`Remover a categoria ${categoria.rotulo}`}
              onClick={aoRemover}
            >
              <i className="fa-solid fa-trash" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      <label className="convocacao-editor-campo largo">
        <span>
          Reconhece por{" "}
          <small>
            termos separados por ponto e vírgula; termine em <code>*</code> para
            alcançar as flexões
          </small>
        </span>
        <CampoEditavel
          type="text"
          valor={categoria.termos}
          ler={lerTermos}
          escrever={juntar}
          data-convocacao-cat="termos"
          aoMudar={(termos) => aoMudar({ termos })}
        />
      </label>
      {categoria.ampla ? null : (
        <div className="convocacao-categoria-avancado">
          <label className="convocacao-editor-campo">
            <span>Arredondamento</span>
            <select
              data-convocacao-cat="arredondamento"
              value={categoria.arredondamento}
              onChange={(evento) =>
                aoMudar({ arredondamento: evento.target.value })
              }
            >
              {ARREDONDAMENTOS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className="convocacao-editor-campo estreito">
            <span>Teto (%)</span>
            <CampoEditavel
              type="number"
              min="0"
              max="100"
              step="0.01"
              valor={categoria.teto}
              ler={lerTaxa}
              data-convocacao-cat="teto"
              aoMudar={(teto) => aoMudar({ teto })}
            />
          </label>
          <label className="convocacao-editor-campo estreito">
            <span>
              Mín. de vagas <small>para esta reserva valer</small>
            </span>
            <CampoEditavel
              type="number"
              min="0"
              step="1"
              valor={categoria.minimo}
              ler={lerInteiro}
              data-convocacao-cat="minimo"
              aoMudar={(minimo) => aoMudar({ minimo })}
            />
          </label>
          {posicaoFixa ? (
            <>
              <label className="convocacao-editor-campo estreito">
                <span>Posições</span>
                <CampoEditavel
                  type="text"
                  valor={categoria.posicoes}
                  ler={lerPosicoes}
                  escrever={juntar}
                  data-convocacao-cat="posicoes"
                  placeholder="3; 8"
                  aoMudar={(posicoes) => aoMudar({ posicoes })}
                />
              </label>
              <label className="convocacao-editor-campo estreito">
                <span>A cada</span>
                <CampoEditavel
                  type="number"
                  min="0"
                  step="1"
                  valor={categoria.intervalo}
                  ler={lerInteiro}
                  data-convocacao-cat="intervalo"
                  aoMudar={(intervalo) => aoMudar({ intervalo })}
                />
              </label>
            </>
          ) : null}
          {/* Um grupo de caixas, e não um <label>: label dentro de label não vale. */}
          <div
            className="convocacao-editor-campo larga"
            role="group"
            aria-label="Se ficar sem candidato, tenta nesta ordem"
          >
            <span>Se ficar sem candidato, tenta nesta ordem</span>
            <span className="convocacao-cascata">
              {destinos.length ? (
                destinos.map((item) => {
                  // A posição na cascata é o que decide quem vem primeiro;
                  // mostrá-la é a única forma de a ordem ser escolhida, e
                  // não apenas o resultado da ordem em que se clicou.
                  const posicao = categoria.cascata.indexOf(item.id);
                  return (
                    <label
                      key={item.id}
                      className={classes(
                        "convocacao-cascata-item",
                        posicao >= 0 && "marcada",
                      )}
                    >
                      <input
                        type="checkbox"
                        data-convocacao-cascata={item.id}
                        checked={posicao >= 0}
                        onChange={(evento) => {
                          const marcar = evento.target.checked;
                          aoMudar((atual) => ({
                            cascata: alternarNaCascata(
                              atual.cascata,
                              item.id,
                              marcar,
                            ),
                          }));
                        }}
                      />
                      {posicao >= 0 ? (
                        <span className="convocacao-cascata-ordem">
                          {posicao + 1}º
                        </span>
                      ) : null}{" "}
                      {item.sigla}
                    </label>
                  );
                })
              ) : (
                <em className="convocacao-cascata-vazia">
                  nenhuma outra reserva
                </em>
              )}
            </span>
            <small className="convocacao-editor-ajuda">
              A vaga não se divide: tenta a 1ª; só se ela também não tiver
              candidato é que passa à 2ª. A ampla concorrência é sempre o último
              destino, e não precisa de ser marcada.
            </small>
          </div>
          {modelo.cotaMultipla === "acumula_com_acumulavel" ? (
            <label className="convocacao-editor-campo estreito">
              <span>Acumulável</span>
              <input
                type="checkbox"
                data-convocacao-cat="acumulavel"
                checked={categoria.acumulavel}
                onChange={(evento) =>
                  aoMudar({ acumulavel: evento.target.checked })
                }
              />
            </label>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function EditorDeModelo({
  editor,
  aoAlterar,
  aoEscolherBase,
  aoDuplicar,
  aoRemover,
  aoCancelar,
  aoSalvar,
}) {
  const modelo = editor.modelo;
  const salvo = !editor.novo && Boolean(modelo.id);

  return (
    <>
      <div className="convocacao-editor-head">
        {/*
          Modelo novo começa de um dos conjuntos de regras já lidos, e não de
          uma folha em branco: são quatro formatos distintos entre os dezasseis
          editais da AgSUS analisados, e reescrever um deles à mão convida ao
          erro. Só aparece na criação — trocar a base de um modelo em uso
          apagaria o que já está configurado.
        */}
        {editor.novo ? (
          <div className="convocacao-editor-base">
            <span>Começar de</span>
            {MODELOS_DE_REFERENCIA.map((referencia) => (
              <button
                key={referencia.id}
                className="btn outline"
                type="button"
                data-convocacao-base={referencia.id}
                onClick={() => aoEscolherBase(referencia.id)}
              >
                {referencia.nome}
              </button>
            ))}
            <button
              className="btn outline"
              type="button"
              data-convocacao-base=""
              onClick={() => aoEscolherBase("")}
            >
              Em branco
            </button>
          </div>
        ) : null}
        <label className="convocacao-editor-campo largo">
          <span>Nome do modelo</span>
          <input
            type="text"
            value={modelo.nome}
            data-convocacao-modelo="nome"
            placeholder="Ex.: Lei 15.142/2025 — 25/3/2 e 5% PCD"
            onChange={(evento) =>
              aoAlterar((atual) => ({ ...atual, nome: evento.target.value }))
            }
          />
        </label>
        {editor.editais > 1 ? (
          <Aviso>
            Este modelo é usado por {editor.editais} editais. Salvar muda a
            convocação de todos — use <strong>Duplicar</strong> para mudar só
            este.
          </Aviso>
        ) : null}
      </div>
      <div className="convocacao-editor-linha">
        <CampoDeEscolha
          chave="distribuicao"
          lista={DISTRIBUICOES}
          valor={modelo.distribuicao}
          rotulo="Como as vagas de cota entram na ordem"
          aoMudar={(distribuicao) =>
            aoAlterar((atual) => ({ ...atual, distribuicao }))
          }
        />
        <CampoDeEscolha
          chave="cotaMultipla"
          lista={COTAS_MULTIPLAS}
          valor={modelo.cotaMultipla}
          rotulo="Quem declarou duas cotas pode ocupar vaga das duas?"
          aoMudar={(cotaMultipla) =>
            aoAlterar((atual) => ({ ...atual, cotaMultipla }))
          }
        />
      </div>
      {faltaCategoriaAcumulavel(modelo) ? (
        <Aviso>
          Nenhuma categoria está marcada como <strong>acumulável</strong>.
          Enquanto isso, quem declarar duas cotas vai valer só a de maior
          percentual. Marque a caixa &quot;Acumulável&quot; na ficha da cota que
          pode somar-se às outras — nos editais da AgSUS, a de PCD.
        </Aviso>
      ) : null}
      <div className="convocacao-categorias">
        {modelo.categorias.map((categoria) => (
          <FichaDaCategoria
            key={categoria.id}
            categoria={categoria}
            modelo={modelo}
            aoMudar={(mudancas) =>
              aoAlterar((atual) =>
                alterarCategoria(atual, categoria.id, mudancas),
              )
            }
            aoRemover={() =>
              aoAlterar((atual) => removerCategoria(atual, categoria.id))
            }
          />
        ))}
      </div>
      <div className="convocacao-editor-acoes">
        <button
          id="convocacaoAdicionarCategoria"
          className="btn outline"
          type="button"
          onClick={() => aoAlterar(acrescentarCategoria)}
        >
          <i className="fa-solid fa-plus" aria-hidden="true" /> Categoria
        </button>
        <span className="approved-action-spacer" />
        {salvo ? (
          <button
            id="convocacaoDuplicarModelo"
            className="btn secondary"
            type="button"
            onClick={aoDuplicar}
          >
            <i className="fa-solid fa-copy" aria-hidden="true" /> Duplicar
          </button>
        ) : null}
        {salvo ? (
          <button
            id="convocacaoRemoverModelo"
            className="btn red"
            type="button"
            onClick={aoRemover}
          >
            <i className="fa-solid fa-trash" aria-hidden="true" /> Remover
          </button>
        ) : null}
        <button
          id="convocacaoCancelarModelo"
          className="btn secondary"
          type="button"
          onClick={aoCancelar}
        >
          Cancelar
        </button>
        <button
          id="convocacaoSalvarModelo"
          className="btn green"
          type="button"
          onClick={aoSalvar}
        >
          <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Salvar
          modelo
        </button>
      </div>
    </>
  );
}
