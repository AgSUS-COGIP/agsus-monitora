import { useMemo } from "react";
import {
  ARREDONDAMENTOS,
  COTAS_MULTIPLAS,
  DISTRIBUICOES,
  MODELOS_DE_REFERENCIA,
  lerTermos,
  normalizarModelo,
} from "../../lib/modelo-de-convocacao.js";
import {
  acrescentarCategoria,
  alterarCategoria,
  alternarNaCascata,
  comDistribuicao,
  destinosDaCascata,
  faltaCategoriaAcumulavel,
  lerInteiro,
  lerPosicoes,
  lerTaxa,
  removerCategoria,
  resumoDasRegrasDaCategoria,
} from "../../lib/configuracao-de-convocacao.js";
import { BotaoDeAcao, CampoEditavel, classes } from "./partes.jsx";
import { PreviaDaConvocacao } from "./previa-da-convocacao.jsx";

/*
  Editor do modelo de regras de convocação, dentro do formulário do edital.
  Edita um rascunho (`editor.modelo`, uma cópia): enquanto está aberto, o
  modelo guardado continua a valer para a tabela de vagas. Quem guarda o
  rascunho e salva é `formulario-de-convocacao.jsx`; `aoAlterar` recebe uma
  função do modelo atual para o próximo.

  O que se vê primeiro é o que muda o resultado: nome, sigla e percentual de
  cada cota, para onde vai a vaga sem candidato e a prévia da ordem de chamada.
  Arredondamento, limite, mínimo, posições e os termos que reconhecem a cota na
  planilha ficam em "Ajustar regras", com o resumo delas numa frase por fora.
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

function CampoDosTermos({ categoria, aoMudar }) {
  return (
    <label className="convocacao-editor-campo largo">
      <span>
        Como reconhecer na planilha{" "}
        <small>
          palavras da coluna modalidade, separadas por ponto e vírgula; termine
          em <code>*</code> para alcançar as flexões (preto* acha
          &quot;pretos&quot;)
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
  );
}

/* Para onde vai a vaga desta cota quando não há candidato dela. */
function CascataDaCategoria({ categoria, modelo, aoMudar }) {
  const destinos = destinosDaCascata(categoria, modelo);
  return (
    <div
      className="convocacao-categoria-cascata"
      role="group"
      aria-label="Se ficar sem candidato, tenta nesta ordem"
    >
      <span className="convocacao-categoria-cascata-titulo">
        Sem candidato, a vaga vai para
      </span>
      <span className="convocacao-cascata">
        {destinos.map((item) => {
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
                    cascata: alternarNaCascata(atual.cascata, item.id, marcar),
                  }));
                }}
              />
              {posicao >= 0 ? (
                <span className="convocacao-cascata-ordem">{posicao + 1}º</span>
              ) : null}{" "}
              {item.sigla}
            </label>
          );
        })}
        <span className="convocacao-cascata-final">
          {categoria.cascata.length ? "e por fim" : ""} ampla concorrência
        </span>
      </span>
      <small className="convocacao-editor-ajuda">
        Marque na ordem em que o edital manda tentar. A vaga não se divide: só
        passa para a seguinte se a anterior também não tiver candidato.
      </small>
    </div>
  );
}

function FichaDaCategoria({ categoria, modelo, aoMudar, aoRemover }) {
  const comPosicoes =
    modelo.distribuicao === "posicao_fixa" ||
    modelo.distribuicao === "serie_mgi";
  const arredondamento =
    ARREDONDAMENTOS.find((item) => item.id === categoria.arredondamento) ||
    ARREDONDAMENTOS[0];

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
          <span className="convocacao-categoria-tag">fica com o resto</span>
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
      {categoria.ampla ? (
        <p className="convocacao-categoria-regras">
          Recebe as vagas que sobram depois das cotas e as que ficarem sem
          candidato.
        </p>
      ) : (
        <>
          <CascataDaCategoria
            categoria={categoria}
            modelo={modelo}
            aoMudar={aoMudar}
          />
          <p
            className="convocacao-categoria-regras"
            data-convocacao-regras={categoria.id}
          >
            {resumoDasRegrasDaCategoria(categoria)}
          </p>
        </>
      )}
      <details className="convocacao-categoria-detalhes">
        <summary>
          {categoria.ampla
            ? "Como reconhecer na planilha"
            : "Ajustar regras e reconhecimento"}
        </summary>
        {categoria.ampla ? (
          <CampoDosTermos categoria={categoria} aoMudar={aoMudar} />
        ) : (
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
              <small className="convocacao-editor-ajuda">
                {arredondamento.ajuda}
              </small>
            </label>
            <label className="convocacao-editor-campo estreito">
              <span>
                Limite máximo (%) <small>0 = sem limite</small>
              </span>
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
              <small className="convocacao-editor-ajuda">
                A reserva nunca passa desta fatia das vagas. Ex.: PCD 5% com
                limite de 20% numa vaga de 2: o arredondamento daria 1 (50%) e o
                limite corta para 0.
              </small>
            </label>
            <label className="convocacao-editor-campo estreito">
              <span>
                Só vale com pelo menos <small>vagas · 0 = sempre</small>
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
              <small className="convocacao-editor-ajuda">
                Abaixo disso a cota não existe naquela vaga, e a vaga é da
                ampla. Ex.: o 91/2026 só reserva para cota racial com 2 vagas ou
                mais.
              </small>
            </label>
            {comPosicoes ? (
              <>
                <label className="convocacao-editor-campo estreito">
                  <span>
                    Posições{" "}
                    <small>
                      {modelo.distribuicao === "serie_mgi"
                        ? "vazio = pelo percentual"
                        : "as que o edital lista"}
                    </small>
                  </span>
                  <CampoEditavel
                    type="text"
                    valor={categoria.posicoes}
                    ler={lerPosicoes}
                    escrever={juntar}
                    data-convocacao-cat="posicoes"
                    placeholder="5; 21"
                    aoMudar={(posicoes) => aoMudar({ posicoes })}
                  />
                </label>
                <label className="convocacao-editor-campo estreito">
                  <span>
                    Depois, a cada <small>posições</small>
                  </span>
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
            {modelo.cotaMultipla === "acumula_com_acumulavel" ? (
              <label className="convocacao-editor-campo estreito">
                <span>
                  Soma com outra cota <small>(acumulável)</small>
                </span>
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
            <CampoDosTermos categoria={categoria} aoMudar={aoMudar} />
          </div>
        )}
      </details>
    </div>
  );
}

/*
  Modelo novo começa de um dos conjuntos de regras já lidos, e não de uma folha
  em branco: reescrever um edital à mão convida ao erro. Cada cartão diz em
  uma frase o que o modelo faz. Só aparece na criação — trocar a base de um
  modelo em uso apagaria o que já está configurado.
*/
function EscolhaDaBase({ base, aoEscolherBase }) {
  return (
    <div className="convocacao-editor-base">
      <span>Comece de um modelo pronto e ajuste o que o seu edital mudar</span>
      <div className="convocacao-editor-base-lista">
        {MODELOS_DE_REFERENCIA.map((referencia) => (
          <button
            key={referencia.id}
            className={classes(
              "convocacao-base-cartao",
              base === referencia.id && "escolhido",
            )}
            type="button"
            aria-pressed={base === referencia.id}
            data-convocacao-base={referencia.id}
            onClick={() => aoEscolherBase(referencia.id)}
          >
            <strong>{referencia.nome}</strong>
            <small>{referencia.descricao}</small>
          </button>
        ))}
        <button
          className={classes(
            "convocacao-base-cartao",
            base === "" && "escolhido",
          )}
          type="button"
          aria-pressed={base === ""}
          data-convocacao-base=""
          onClick={() => aoEscolherBase("")}
        >
          <strong>Em branco</strong>
          <small>Só a ampla concorrência; você acrescenta as cotas.</small>
        </button>
      </div>
    </div>
  );
}

export function EditorDeModelo({
  estado,
  editor,
  totalDaPrevia,
  aoAlterar,
  aoEscolherBase,
  aoDuplicar,
  aoRemover,
  aoCancelar,
  aoSalvar,
}) {
  const modelo = editor.modelo;
  const salvo = !editor.novo && Boolean(modelo.id);
  // A prévia lê o rascunho como a convocação o lerá depois de salvo.
  const normalizado = useMemo(() => normalizarModelo(modelo), [modelo]);

  return (
    <>
      <div className="convocacao-editor-head">
        {editor.novo ? (
          <EscolhaDaBase base={editor.base} aoEscolherBase={aoEscolherBase} />
        ) : null}
        <label className="convocacao-editor-campo largo">
          <span>Nome do modelo</span>
          <input
            type="text"
            value={modelo.nome}
            data-convocacao-modelo="nome"
            placeholder="Ex.: Saúde Indígena — DSEI Alagoas e Sergipe (91/2026)"
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
          rotulo="Em que posições as cotas são chamadas"
          aoMudar={(distribuicao) =>
            aoAlterar((atual) => comDistribuicao(atual, distribuicao))
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
          percentual. Em &quot;Ajustar regras&quot; da cota que pode somar-se às
          outras — nos editais da AgSUS, a de PCD —, marque &quot;Soma com outra
          cota&quot;.
        </Aviso>
      ) : null}
      <PreviaDaConvocacao
        id="convocacaoPreviaDoEditor"
        modelo={normalizado}
        totalInicial={totalDaPrevia}
      />
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
          <BotaoDeAcao
            estado={estado}
            acao="remover-modelo"
            id="convocacaoRemoverModelo"
            className="btn red"
            onClick={aoRemover}
          >
            <i className="fa-solid fa-trash" aria-hidden="true" /> Remover
          </BotaoDeAcao>
        ) : null}
        <button
          id="convocacaoCancelarModelo"
          className="btn secondary"
          type="button"
          onClick={aoCancelar}
        >
          Cancelar
        </button>
        <BotaoDeAcao
          estado={estado}
          acao="salvar-modelo"
          id="convocacaoSalvarModelo"
          className="btn green"
          onClick={aoSalvar}
        >
          <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Salvar
          modelo
        </BotaoDeAcao>
      </div>
    </>
  );
}
