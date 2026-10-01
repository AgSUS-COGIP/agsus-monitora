import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { rotuloDaAreaDoPainel } from "../../lib/area-do-painel-de-analises.js";
import {
  dadosDoRoteiroParaSalvar,
  errosDoRoteiro,
  ESCALAS,
  LIMITE_DE_COMPETENCIAS,
  lerNumero,
  minimoEmPontos,
  moverItem,
  novaCompetencia,
  novoNivel,
  rascunhoDoRoteiro,
  resumoDoRoteiro,
  rotuloDaEscala,
  rotuloDoPeso,
  textoDaPontuacao,
  TIPOS_DE_AVALIACAO,
  TIPOS_DE_MINIMO,
} from "../../lib/roteiro-de-entrevista.js";
import {
  Aviso,
  Campo,
  Carregando,
  EstadoVazio,
  Gaveta,
} from "../../ui/index.js";
import {
  BotaoDeLinha,
  ComposicaoDaBanca,
  numeroBR,
  RegraDeConvocacao,
  Segmentado,
  trocarNaLista,
} from "./partes.jsx";

/*
  Visão "Roteiros" do painel de entrevistas: os roteiros ativos da área (e os
  de qualquer área), em cartões compactos, e o formulário na gaveta.

  Editar grava a versão seguinte (a anterior continua valendo para os editais
  que já a usam); "Duplicar" cria um roteiro novo a partir de outro. Quem não
  edita as entrevistas vê o roteiro na gaveta, só leitura. A lista não diz se
  a pessoa edita: vale o `pode_editar` do último edital aberto e, sem ele, o
  banco decide (42501 vira aviso).
*/

function CartaoDoRoteiro({ roteiro, podeEditar, aoAbrir }) {
  const r = resumoDoRoteiro(roteiro);
  return (
    <article className="panel entrevistas-cartao" data-roteiro={roteiro.id}>
      <div className="entrevistas-cartao-topo">
        <div>
          <span className="eyebrow">
            {roteiro.etapa || "Entrevista"} ·{" "}
            {roteiro.area
              ? rotuloDaAreaDoPainel(roteiro.area)
              : "Qualquer área"}
          </span>
          <h3>{roteiro.nome}</h3>
        </div>
        <span className="badge neutro" title="Versão do roteiro">
          v{r.versao}
        </span>
      </div>
      <p className="entrevistas-cartao-linha">
        {r.competencias} {r.competencias === 1 ? "competência" : "competências"}{" "}
        · {r.escala} · máx. {numeroBR(r.maxima)}
        {r.minimo !== null ? ` · mín. ${numeroBR(r.minimo)}` : ""}
        {r.grupo ? " · com avaliação em grupo" : ""}
      </p>
      <p className="entrevistas-cartao-linha">
        <i className="fa-solid fa-folder-open" aria-hidden="true" />{" "}
        {r.emUso
          ? `Usado em ${r.emUso} ${r.emUso === 1 ? "edital" : "editais"}`
          : "Ainda sem edital"}
      </p>
      <div className="entrevistas-cartao-acoes">
        {podeEditar === false ? (
          <button
            type="button"
            className="btn secondary small"
            onClick={() => aoAbrir(roteiro, "ver")}
          >
            <i className="fa-solid fa-eye" aria-hidden="true" /> Ver
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => aoAbrir(roteiro, "editar")}
            >
              <i className="fa-solid fa-pen" aria-hidden="true" /> Editar (cria
              versão {r.versao + 1})
            </button>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => aoAbrir(roteiro, "duplicar")}
            >
              <i className="fa-solid fa-copy" aria-hidden="true" /> Duplicar
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export function VisaoDeRoteiros({ conducao, area }) {
  const e = useSyncExternalStore(conducao.assinar, conducao.obter);
  const [aberto, setAberto] = useState(null);
  const { roteiros, podeEditar } = e;

  useEffect(() => {
    const { carregado, carregando } = conducao.obter().roteiros;
    if (!carregado && !carregando) void conducao.carregarRoteiros(area);
  }, [conducao, area]);

  return (
    <section
      className="panel table-card entrevistas-visao"
      aria-labelledby="entrevistasRoteirosTitulo"
    >
      <div className="table-head">
        <div>
          <h2 className="title" id="entrevistasRoteirosTitulo">
            Roteiros de entrevista
          </h2>
        </div>
        <div className="table-tools">
          <button
            type="button"
            className="btn secondary"
            disabled={roteiros.carregando}
            onClick={() => void conducao.carregarRoteiros(area)}
          >
            <i className="fa-solid fa-rotate" aria-hidden="true" /> Recarregar
          </button>
          {podeEditar === false ? null : (
            <button
              type="button"
              className="btn"
              id="entrevistasNovoRoteiro"
              onClick={() => setAberto({ roteiro: null, modo: "novo" })}
            >
              <i className="fa-solid fa-plus" aria-hidden="true" /> Novo roteiro
            </button>
          )}
        </div>
      </div>
      {roteiros.erro ? (
        <Aviso tom="danger" papel="alert">
          Não foi possível carregar os roteiros: {roteiros.erro}
        </Aviso>
      ) : null}
      <div className="entrevistas-cartoes" aria-busy={roteiros.carregando}>
        {!roteiros.carregado && roteiros.carregando ? (
          <Carregando>Carregando roteiros…</Carregando>
        ) : roteiros.lista.length ? (
          roteiros.lista.map((r) => (
            <CartaoDoRoteiro
              key={r.id}
              roteiro={r}
              podeEditar={podeEditar}
              aoAbrir={(roteiro, modo) => setAberto({ roteiro, modo })}
            />
          ))
        ) : roteiros.carregado ? (
          <EstadoVazio>Nenhum roteiro ativo para esta área.</EstadoVazio>
        ) : null}
      </div>
      {aberto ? (
        <EditorDeRoteiro
          roteiro={aberto.roteiro}
          modo={aberto.modo}
          area={area}
          somenteLeitura={aberto.modo === "ver"}
          salvando={Boolean(e.acao)}
          aoSalvar={async (dados) => {
            const resultado = await conducao.salvarRoteiro(dados);
            if (resultado?.ok) setAberto(null);
            return resultado;
          }}
          aoFechar={() => setAberto(null)}
        />
      ) : null}
    </section>
  );
}

/* ── Formulário ─────────────────────────────────────────────────────── */

function EscalaDoRoteiro({ r, mudar, erros, somenteLeitura }) {
  return (
    <>
      <Segmentado
        rotulo="Escala das notas"
        opcoes={ESCALAS}
        valor={r.escala}
        desabilitado={somenteLeitura}
        aoMudar={(escala) => mudar({ escala })}
      />
      {r.escala === "FAIXA" ? (
        <div className="entrevistas-grade">
          <Campo rotulo="Passo das notas" erro={erros.passo}>
            <input
              type="number"
              min="0.01"
              max="5"
              step="0.01"
              value={r.passo}
              disabled={somenteLeitura}
              onChange={(e) => mudar({ passo: e.target.value })}
            />
          </Campo>
        </div>
      ) : null}
      {r.escala === "LISTA" ? (
        <Campo
          rotulo="Notas permitidas"
          dica="Ex.: 0; 1; 2,5; 5"
          erro={erros.notas_permitidas}
          largo
        >
          <input
            type="text"
            value={r.notas_permitidas}
            disabled={somenteLeitura}
            onChange={(e) => mudar({ notas_permitidas: e.target.value })}
          />
        </Campo>
      ) : null}
      {r.escala === "NIVEIS" ? (
        <div className="entrevistas-sublista" aria-label="Níveis da escala">
          {erros.niveis ? (
            <small className="entrevistas-erro-campo" role="alert">
              {erros.niveis}
            </small>
          ) : null}
          <ul className="entrevistas-linhas">
            {r.niveis.map((n, indice) => (
              <li key={n.chave} className="entrevistas-linha-nivel">
                <Campo rotulo="Nota" erro={erros[`nivel.${n.chave}.nota`]}>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={n.nota}
                    disabled={somenteLeitura}
                    onChange={(e) =>
                      mudar({
                        niveis: trocarNaLista(
                          r.niveis,
                          n.chave,
                          "nota",
                          e.target.value,
                        ),
                      })
                    }
                  />
                </Campo>
                <Campo rotulo="Nome" erro={erros[`nivel.${n.chave}.nome`]}>
                  <input
                    type="text"
                    value={n.nome}
                    placeholder="Ex.: Satisfatório"
                    disabled={somenteLeitura}
                    onChange={(e) =>
                      mudar({
                        niveis: trocarNaLista(
                          r.niveis,
                          n.chave,
                          "nome",
                          e.target.value,
                        ),
                      })
                    }
                  />
                </Campo>
                <Campo
                  rotulo="O que se observa"
                  erro={erros[`nivel.${n.chave}.descricao`]}
                >
                  <input
                    type="text"
                    value={n.descricao}
                    disabled={somenteLeitura}
                    onChange={(e) =>
                      mudar({
                        niveis: trocarNaLista(
                          r.niveis,
                          n.chave,
                          "descricao",
                          e.target.value,
                        ),
                      })
                    }
                  />
                </Campo>
                {somenteLeitura ? null : (
                  <BotaoDeLinha
                    icone="fa-trash"
                    rotulo={`Remover o nível ${indice + 1}`}
                    aoClicar={() =>
                      mudar({
                        niveis: r.niveis.filter((x) => x.chave !== n.chave),
                      })
                    }
                  />
                )}
              </li>
            ))}
          </ul>
          {somenteLeitura ? null : (
            <button
              type="button"
              className="btn secondary small"
              onClick={() => {
                const notas = r.niveis
                  .map((n) => lerNumero(n.nota))
                  .filter(Number.isFinite);
                const proxima = notas.length ? Math.max(...notas) + 1 : 0;
                mudar({ niveis: [...r.niveis, novoNivel(proxima)] });
              }}
            >
              <i className="fa-solid fa-plus" aria-hidden="true" /> Nível
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}

function Competencia({
  c,
  indice,
  total,
  mudar,
  mover,
  remover,
  erros,
  somenteLeitura,
}) {
  const p = `competencia.${c.chave}`;
  const peso = rotuloDoPeso(c.peso);
  const minimo = minimoEmPontos(c);
  return (
    <li className="entrevistas-competencia" data-competencia={indice + 1}>
      <div className="entrevistas-competencia-topo">
        <strong>Competência {indice + 1}</strong>
        {somenteLeitura ? null : (
          <span className="entrevistas-competencia-acoes">
            <BotaoDeLinha
              icone="fa-chevron-up"
              rotulo={`Subir a competência ${indice + 1}`}
              desabilitado={indice === 0}
              aoClicar={() => mover(-1)}
            />
            <BotaoDeLinha
              icone="fa-chevron-down"
              rotulo={`Descer a competência ${indice + 1}`}
              desabilitado={indice === total - 1}
              aoClicar={() => mover(1)}
            />
            <BotaoDeLinha
              icone="fa-trash"
              rotulo={`Remover a competência ${indice + 1}`}
              desabilitado={total === 1}
              aoClicar={remover}
            />
          </span>
        )}
      </div>
      <div className="entrevistas-grade">
        <Campo rotulo="Nome" obrigatorio erro={erros[`${p}.nome`]} largo>
          <input
            type="text"
            value={c.nome}
            disabled={somenteLeitura}
            onChange={(e) => mudar("nome", e.target.value)}
          />
        </Campo>
        <Campo rotulo="O que se avalia" erro={erros[`${p}.descricao`]} largo>
          <textarea
            rows={2}
            value={c.descricao}
            disabled={somenteLeitura}
            onChange={(e) => mudar("descricao", e.target.value)}
          />
        </Campo>
        <Campo
          rotulo="Nota máxima por avaliador"
          obrigatorio
          erro={erros[`${p}.nota_maxima`]}
        >
          <input
            type="number"
            min="0.5"
            max="100"
            step="0.5"
            value={c.nota_maxima}
            disabled={somenteLeitura}
            onChange={(e) => mudar("nota_maxima", e.target.value)}
          />
        </Campo>
        <Campo
          rotulo="Peso"
          dica={
            peso ? `${peso} sobre a média da banca` : "1 = normal; 1,5 = +50%"
          }
          erro={erros[`${p}.peso`]}
        >
          <input
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={c.peso}
            disabled={somenteLeitura}
            onChange={(e) => mudar("peso", e.target.value)}
          />
        </Campo>
        <Campo
          rotulo="Mínimo para ser apto"
          dica={
            minimo !== null && c.tipo_minimo === "PERCENTUAL"
              ? `= ${numeroBR(minimo)} pontos`
              : "Vazio = sem mínimo"
          }
          erro={erros[`${p}.minimo`]}
        >
          <input
            type="number"
            min="0"
            step="0.5"
            value={c.minimo}
            disabled={somenteLeitura}
            onChange={(e) => mudar("minimo", e.target.value)}
          />
        </Campo>
        <Campo rotulo="Mínimo em">
          <select
            value={c.tipo_minimo}
            disabled={somenteLeitura}
            onChange={(e) => mudar("tipo_minimo", e.target.value)}
          >
            {TIPOS_DE_MINIMO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Avaliação">
          <select
            value={c.avaliacao}
            disabled={somenteLeitura}
            onChange={(e) => mudar("avaliacao", e.target.value)}
          >
            {TIPOS_DE_AVALIACAO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </Campo>
      </div>
    </li>
  );
}

function NotasEliminatorias({ valor, aoMudar, somenteLeitura }) {
  const [texto, setTexto] = useState("");
  const acrescentar = () => {
    const n = lerNumero(texto);
    if (!Number.isFinite(n) || n < 0) return;
    if (!valor.includes(n)) aoMudar([...valor, n].sort((a, b) => a - b));
    setTexto("");
  };
  return (
    <div className="field">
      <label htmlFor="entrevistasEliminatoria">Médias eliminatórias</label>
      <div className="chips" aria-label="Médias que eliminam">
        {valor.length ? (
          valor.map((n) => (
            <button
              key={n}
              type="button"
              className="chip-filter"
              disabled={somenteLeitura}
              title={somenteLeitura ? undefined : `Tirar a nota ${numeroBR(n)}`}
              onClick={() => aoMudar(valor.filter((x) => x !== n))}
            >
              <b>{numeroBR(n)}</b>
              {somenteLeitura ? null : (
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              )}
            </button>
          ))
        ) : (
          <small className="entrevistas-dica">Nenhuma.</small>
        )}
      </div>
      {somenteLeitura ? null : (
        <div className="entrevistas-em-linha">
          <input
            id="entrevistasEliminatoria"
            type="number"
            min="0"
            step="0.5"
            value={texto}
            placeholder="Ex.: 1"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                acrescentar();
              }
            }}
          />
          <button
            type="button"
            className="btn secondary small"
            onClick={acrescentar}
          >
            <i className="fa-solid fa-plus" aria-hidden="true" /> Nota
          </button>
        </div>
      )}
      <small className="entrevistas-dica">Média nestes níveis = inapto.</small>
    </div>
  );
}

function Desempate({ valor, aoMudar, erros, somenteLeitura }) {
  return (
    <div className="entrevistas-sublista" aria-label="Critérios de desempate">
      {valor.length ? (
        <ol className="entrevistas-linhas entrevistas-desempate">
          {valor.map((criterio, indice) => (
            // O critério é texto livre e pode repetir: a posição é a chave.
            <li key={indice}>
              <span className="entrevistas-ordem">{indice + 1}º</span>
              <Campo
                rotulo={`Critério ${indice + 1}`}
                erro={erros[`desempate.${indice}`]}
              >
                <input
                  type="text"
                  value={criterio}
                  disabled={somenteLeitura}
                  onChange={(e) =>
                    aoMudar(
                      valor.map((x, i) => (i === indice ? e.target.value : x)),
                    )
                  }
                />
              </Campo>
              {somenteLeitura ? null : (
                <span className="entrevistas-competencia-acoes">
                  <BotaoDeLinha
                    icone="fa-chevron-up"
                    rotulo={`Subir o critério ${indice + 1}`}
                    desabilitado={indice === 0}
                    aoClicar={() => aoMudar(moverItem(valor, indice, -1))}
                  />
                  <BotaoDeLinha
                    icone="fa-chevron-down"
                    rotulo={`Descer o critério ${indice + 1}`}
                    desabilitado={indice === valor.length - 1}
                    aoClicar={() => aoMudar(moverItem(valor, indice, 1))}
                  />
                  <BotaoDeLinha
                    icone="fa-trash"
                    rotulo={`Remover o critério ${indice + 1}`}
                    aoClicar={() =>
                      aoMudar(valor.filter((_, i) => i !== indice))
                    }
                  />
                </span>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="entrevistas-vazio-linha">Sem critérios de desempate.</p>
      )}
      {somenteLeitura ? null : (
        <button
          type="button"
          className="btn secondary small"
          onClick={() => aoMudar([...valor, ""])}
        >
          <i className="fa-solid fa-plus" aria-hidden="true" /> Critério
        </button>
      )}
    </div>
  );
}

function SecaoDoFormulario({ titulo, icone, children }) {
  return (
    <section
      className="analises-detail-section entrevistas-secao"
      aria-label={titulo}
    >
      <div className="analises-detail-section-head">
        <i className={`fa-solid ${icone}`} aria-hidden="true" />
        <span>{titulo}</span>
      </div>
      <div className="entrevistas-secao-corpo">{children}</div>
    </section>
  );
}

export function EditorDeRoteiro({
  roteiro,
  modo,
  area,
  somenteLeitura = false,
  salvando = false,
  aoSalvar,
  aoFechar,
}) {
  const [r, setR] = useState(() =>
    rascunhoDoRoteiro(roteiro, {
      modo: modo === "novo" ? "editar" : modo,
      area,
    }),
  );
  const [tentou, setTentou] = useState(false);
  const [erroDoBanco, setErroDoBanco] = useState("");
  const erros = useMemo(() => errosDoRoteiro(r), [r]);
  const errosVisiveis = tentou ? erros : {};
  const quantosErros = Object.keys(erros).length;
  const mudar = (mudancas) => setR((atual) => ({ ...atual, ...mudancas }));

  const titulo =
    modo === "novo"
      ? "Novo roteiro"
      : modo === "duplicar"
        ? "Duplicar roteiro"
        : roteiro?.nome || "Roteiro";
  const sobretitulo =
    modo === "editar"
      ? `Roteiro · versão ${r.versao} → salvar grava a versão ${r.versao + 1}`
      : modo === "ver"
        ? `Roteiro · versão ${roteiro?.versao ?? 1}`
        : "Roteiro de entrevista";
  const opcoesDeArea = [...new Set([area, roteiro?.area].filter(Boolean))].map(
    (valor) => ({ valor, rotulo: rotuloDaAreaDoPainel(valor) }),
  );

  async function salvar(evento) {
    evento.preventDefault();
    if (somenteLeitura) return;
    setTentou(true);
    if (quantosErros) return;
    setErroDoBanco("");
    const resultado = await aoSalvar(dadosDoRoteiroParaSalvar(r));
    if (resultado?.erro) setErroDoBanco(resultado.erro);
  }

  return (
    <Gaveta
      id="entrevistasEditorDeRoteiro"
      tituloId="entrevistasEditorDeRoteiroTitulo"
      aoFechar={aoFechar}
      fecharAoClicarFora={somenteLeitura}
      className="entrevistas-gaveta"
      cartaoClassName="entrevistas-gaveta-larga"
      sobretitulo={sobretitulo}
      titulo={titulo}
      rotuloDoFechar="Fechar o roteiro"
      resumo={
        <span className="status" id="entrevistasPreviaDoRoteiro">
          <i className="fa-solid fa-chart-simple" aria-hidden="true" />
          {textoDaPontuacao(r)}
        </span>
      }
    >
      <form className="entrevistas-formulario" onSubmit={salvar} noValidate>
        <div id="analisesDrawerBody">
          <div className="detail-shell">
            {modo === "editar" && roteiro?.editais_em_uso ? (
              <Aviso tom="info">
                {roteiro.editais_em_uso === 1
                  ? "1 edital usa esta versão e continua nela."
                  : `${roteiro.editais_em_uso} editais usam esta versão e continuam nela.`}
              </Aviso>
            ) : null}
            <SecaoDoFormulario titulo="Identificação" icone="fa-file-lines">
              <div className="entrevistas-grade">
                <Campo
                  rotulo="Nome"
                  obrigatorio
                  erro={errosVisiveis.nome}
                  largo
                >
                  <input
                    type="text"
                    value={r.nome}
                    disabled={somenteLeitura}
                    data-foco-inicial
                    onChange={(e) => mudar({ nome: e.target.value })}
                  />
                </Campo>
                <Campo rotulo="Etapa no edital" erro={errosVisiveis.etapa}>
                  <input
                    type="text"
                    value={r.etapa}
                    placeholder="Entrevista"
                    disabled={somenteLeitura}
                    onChange={(e) => mudar({ etapa: e.target.value })}
                  />
                </Campo>
                <Campo rotulo="Área">
                  <select
                    value={r.area}
                    disabled={somenteLeitura}
                    onChange={(e) => mudar({ area: e.target.value })}
                  >
                    {opcoesDeArea.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.rotulo}
                      </option>
                    ))}
                    <option value="">Qualquer área</option>
                  </select>
                </Campo>
                <Campo rotulo="Descrição" erro={errosVisiveis.descricao} largo>
                  <textarea
                    rows={2}
                    value={r.descricao}
                    disabled={somenteLeitura}
                    placeholder="Referência ao edital, observações"
                    onChange={(e) => mudar({ descricao: e.target.value })}
                  />
                </Campo>
              </div>
            </SecaoDoFormulario>

            <SecaoDoFormulario titulo="Escala das notas" icone="fa-sliders">
              <EscalaDoRoteiro
                r={r}
                mudar={mudar}
                erros={errosVisiveis}
                somenteLeitura={somenteLeitura}
              />
            </SecaoDoFormulario>

            <SecaoDoFormulario titulo="Competências" icone="fa-list-check">
              {errosVisiveis.competencias ? (
                <small className="entrevistas-erro-campo" role="alert">
                  {errosVisiveis.competencias}
                </small>
              ) : null}
              <ol className="entrevistas-competencias">
                {r.competencias.map((c, indice) => (
                  <Competencia
                    key={c.chave}
                    c={c}
                    indice={indice}
                    total={r.competencias.length}
                    erros={errosVisiveis}
                    somenteLeitura={somenteLeitura}
                    mudar={(campo, valor) =>
                      mudar({
                        competencias: trocarNaLista(
                          r.competencias,
                          c.chave,
                          campo,
                          valor,
                        ),
                      })
                    }
                    mover={(passo) =>
                      mudar({
                        competencias: moverItem(r.competencias, indice, passo),
                      })
                    }
                    remover={() =>
                      mudar({
                        competencias: r.competencias.filter(
                          (x) => x.chave !== c.chave,
                        ),
                      })
                    }
                  />
                ))}
              </ol>
              {somenteLeitura ? null : (
                <button
                  type="button"
                  className="btn secondary small"
                  disabled={r.competencias.length >= LIMITE_DE_COMPETENCIAS}
                  onClick={() =>
                    mudar({
                      competencias: [...r.competencias, novaCompetencia()],
                    })
                  }
                >
                  <i className="fa-solid fa-plus" aria-hidden="true" />{" "}
                  Competência
                </button>
              )}
            </SecaoDoFormulario>

            <SecaoDoFormulario titulo="Aprovação" icone="fa-user-check">
              <div className="entrevistas-grade">
                <Campo
                  rotulo="Nota mínima total"
                  dica="Vazio = sem mínimo total"
                  erro={errosVisiveis.nota_minima_total}
                >
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={r.nota_minima_total}
                    disabled={somenteLeitura}
                    onChange={(e) =>
                      mudar({ nota_minima_total: e.target.value })
                    }
                  />
                </Campo>
                <NotasEliminatorias
                  valor={r.notas_eliminatorias}
                  somenteLeitura={somenteLeitura}
                  aoMudar={(notas_eliminatorias) =>
                    mudar({ notas_eliminatorias })
                  }
                />
              </div>
              <label className="entrevistas-marcar">
                <input
                  type="checkbox"
                  checked={r.ausencia_elimina}
                  disabled={somenteLeitura}
                  onChange={(e) =>
                    mudar({ ausencia_elimina: e.target.checked })
                  }
                />
                <span>Faltar à entrevista elimina o candidato</span>
              </label>
            </SecaoDoFormulario>

            <SecaoDoFormulario
              titulo="Resultado e desempate"
              icone="fa-ranking-star"
            >
              <label className="entrevistas-marcar">
                <input
                  type="checkbox"
                  checked={r.soma_analise}
                  disabled={somenteLeitura}
                  onChange={(e) => mudar({ soma_analise: e.target.checked })}
                />
                <span>Nota final = análise curricular + entrevista</span>
              </label>
              <Desempate
                valor={r.desempate}
                erros={errosVisiveis}
                somenteLeitura={somenteLeitura}
                aoMudar={(desempate) => mudar({ desempate })}
              />
            </SecaoDoFormulario>

            <SecaoDoFormulario titulo="Convocação padrão" icone="fa-bullhorn">
              <RegraDeConvocacao
                valor={r.convocacao}
                erros={errosVisiveis}
                somenteLeitura={somenteLeitura}
                aoMudar={(convocacao) => mudar({ convocacao })}
              />
            </SecaoDoFormulario>

            <SecaoDoFormulario titulo="Banca padrão" icone="fa-users">
              <ComposicaoDaBanca
                valor={r.banca}
                erros={errosVisiveis}
                somenteLeitura={somenteLeitura}
                aoMudar={(banca) => mudar({ banca })}
              />
            </SecaoDoFormulario>

            {tentou && quantosErros ? (
              <Aviso tom="danger" papel="alert">
                Confira{" "}
                {quantosErros === 1
                  ? "o campo marcado"
                  : `os ${quantosErros} campos marcados`}{" "}
                antes de salvar.
              </Aviso>
            ) : null}
            {erroDoBanco ? (
              <Aviso tom="danger" papel="alert">
                {erroDoBanco}
              </Aviso>
            ) : null}
          </div>
        </div>
        <div className="entrevistas-gaveta-rodape">
          <span className="entrevistas-rodape-resumo">
            {rotuloDaEscala(r.escala)} · {r.competencias.length}{" "}
            {r.competencias.length === 1 ? "competência" : "competências"}
          </span>
          <button type="button" className="btn secondary" onClick={aoFechar}>
            {somenteLeitura ? "Fechar" : "Cancelar"}
          </button>
          {somenteLeitura ? null : (
            <button type="submit" className="btn" disabled={salvando}>
              <i className="fa-solid fa-floppy-disk" aria-hidden="true" />{" "}
              {salvando
                ? "Salvando…"
                : modo === "editar"
                  ? `Salvar versão ${r.versao + 1}`
                  : "Criar roteiro"}
            </button>
          )}
        </div>
      </form>
    </Gaveta>
  );
}
