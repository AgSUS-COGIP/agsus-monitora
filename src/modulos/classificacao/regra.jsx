import { useId, useMemo, useState } from "react";
import {
  CATALOGO_DE_CRITERIOS,
  COMPONENTES_DA_NOTA,
  CRITERIO_POR_CODIGO,
  DIRECOES,
  EMPATE_NAS_LISTAS,
  METODOS_DE_EMPATE_FINAL,
  NIVEIS,
  NUMERACOES,
  PARCIAIS_DA_DOCUMENTAL,
} from "../../lib/classificacao/catalogo.js";
import { dataBR, ARREDONDAMENTOS } from "../../lib/classificacao/numeros.js";
import {
  ACUMULOS,
  ARREDONDAMENTOS_DE_COTA,
  normalizarRegra,
  REGRA_VAZIA,
  validarRegra,
} from "../../lib/classificacao/regra.js";
import {
  erroDoNomeDaVersao,
  nomeParaGravar,
  sugerirNomeDaVersao,
} from "../../lib/nome-da-versao.ts";
import {
  Aviso,
  Campo,
  CampoNomeDaVersao,
  NomeDaVersao,
  nomeDoCampo,
  RenomearVersao,
  Segmentado,
} from "../../ui/index.js";

/*
  A aba "Regra" da Classificação: o formulário da regra do edital, decidida
  pelo gestor do edital (nada fixo no código). Os critérios de desempate vêm
  do catálogo e se ordenam arrastando (ou pelas setas, no teclado). Salvar
  cria uma versão nova; o histórico fica embaixo, e uma versão anterior pode
  voltar ao formulário (e ser salva como nova). Quem só lê vê a regra sem os
  controles de edição.

  Gancho da fase 2: "Importar do PDF do edital" (estado.importarRegraDoEdital)
  — sem botão enquanto não existe.
*/

const numeroOuNulo = (texto) => {
  const t = String(texto ?? "")
    .trim()
    .replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : texto;
};
const lista = (texto) =>
  String(texto ?? "")
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
const textoDaLista = (valores) => (valores || []).join(", ");
const listaEmMaiusculas = (texto) => lista(String(texto ?? "").toUpperCase());
const textoDoNumero = (valor) =>
  valor === null || valor === undefined ? "" : String(valor).replace(".", ",");
const niveisPorCargo = (texto) =>
  String(texto ?? "")
    .split(";")
    .map((par) => par.split("=").map((t) => t.trim()))
    .filter(([termo, nivel]) => termo && nivel)
    .map(([termo, nivel]) => ({ termo, nivel }));
const textoDosNiveisPorCargo = (niveis) =>
  niveis.map((n) => `${n.termo}=${n.nivel}`).join("; ");

/*
  Entrada de um valor convertido (número, lista): enquanto a pessoa digita,
  o campo mostra o texto como ela escreveu ("7," ou "PP, ") e a regra
  recebe o valor convertido a cada tecla (Enter já salva o que está escrito);
  ao sair do campo, volta a mostrar o valor formatado. Converter e formatar
  a cada tecla comia a vírgula e o espaço do que estava a meio caminho.
*/
function EntradaConvertida({ valor, formatar, converter, aoMudar, ...props }) {
  const [digitado, setDigitado] = useState(null);
  return (
    <input
      {...props}
      value={digitado ?? formatar(valor)}
      onChange={(e) => {
        setDigitado(e.target.value);
        aoMudar(converter(e.target.value));
      }}
      onBlur={() => setDigitado(null)}
    />
  );
}

function CampoNumero({
  rotulo,
  valor,
  aoMudar,
  desabilitado,
  passo = "0.1",
  dica,
}) {
  const id = useId();
  return (
    <Campo rotulo={rotulo} dica={dica} idDoControle={id}>
      <EntradaConvertida
        id={id}
        inputMode="decimal"
        valor={valor}
        formatar={textoDoNumero}
        converter={numeroOuNulo}
        aoMudar={aoMudar}
        disabled={desabilitado}
        data-passo={passo}
      />
    </Campo>
  );
}

function CampoLista({ rotulo, valor, aoMudar, desabilitado }) {
  const id = useId();
  return (
    <Campo rotulo={rotulo} idDoControle={id}>
      <EntradaConvertida
        id={id}
        valor={valor}
        formatar={textoDaLista}
        converter={lista}
        aoMudar={aoMudar}
        disabled={desabilitado}
      />
    </Campo>
  );
}

function Caixa({ rotulo, marcado, aoMudar, desabilitado }) {
  return (
    <label className="classificacao-caixa">
      <input
        type="checkbox"
        checked={Boolean(marcado)}
        disabled={desabilitado}
        onChange={(e) => aoMudar(e.target.checked)}
      />{" "}
      {rotulo}
    </label>
  );
}

function Escolha({ rotulo, valor, opcoes, aoMudar, desabilitado }) {
  const id = useId();
  return (
    <Campo rotulo={rotulo}>
      <select
        id={id}
        value={valor ?? ""}
        disabled={desabilitado}
        onChange={(e) => aoMudar(e.target.value || null)}
      >
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
    </Campo>
  );
}

/* Os critérios de desempate escolhidos, na ordem: arrastar, setas, direção e remover. */
function CriteriosDeDesempate({ desempate, aoMudar, desabilitado }) {
  const [arrastando, setArrastando] = useState(null);
  const idNovo = useId();
  const usados = new Set(desempate.map((d) => d.criterio));
  const disponiveis = CATALOGO_DE_CRITERIOS.filter(
    (c) => !usados.has(c.codigo),
  );
  const mover = (de, para) => {
    if (de === para || para < 0 || para >= desempate.length) return;
    const nova = [...desempate];
    const [item] = nova.splice(de, 1);
    nova.splice(para, 0, item);
    aoMudar(nova);
  };
  return (
    <div className="classificacao-criterios">
      {desempate.length ? (
        <ol
          className="classificacao-lista-ordenavel"
          aria-label="Critérios de desempate, na ordem"
        >
          {desempate.map((d, i) => {
            const c = CRITERIO_POR_CODIGO[d.criterio];
            return (
              <li
                key={d.criterio}
                data-criterio={d.criterio}
                draggable={!desabilitado}
                className={arrastando === i ? "is-arrastando" : undefined}
                onDragStart={(e) => {
                  setArrastando(i);
                  e.dataTransfer?.setData?.("text/plain", String(i));
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (arrastando !== null) mover(arrastando, i);
                  setArrastando(null);
                }}
                onDragEnd={() => setArrastando(null)}
              >
                <span className="classificacao-alca" aria-hidden="true">
                  <i className="fa-solid fa-bars" />
                </span>
                <span className="classificacao-criterio-nome">
                  {i + 1}. {c?.nome || d.criterio}
                </span>
                <select
                  aria-label={`Direção de ${c?.nome || d.criterio}`}
                  value={d.direcao}
                  disabled={desabilitado}
                  onChange={(e) =>
                    aoMudar(
                      desempate.map((x, j) =>
                        j === i ? { ...x, direcao: e.target.value } : x,
                      ),
                    )
                  }
                >
                  {DIRECOES.filter(([v]) =>
                    c?.tipo === "booleano"
                      ? v.endsWith("_PRIMEIRO") && !v.startsWith("M")
                      : v.startsWith("M"),
                  ).map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
                {desabilitado ? null : (
                  <>
                    <button
                      type="button"
                      className="btn secondary small"
                      aria-label={`Subir ${c?.nome}`}
                      disabled={i === 0}
                      onClick={() => mover(i, i - 1)}
                    >
                      <i className="fa-solid fa-arrow-up" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn secondary small"
                      aria-label={`Descer ${c?.nome}`}
                      disabled={i === desempate.length - 1}
                      onClick={() => mover(i, i + 1)}
                    >
                      <i
                        className="fa-solid fa-arrow-down"
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      className="btn danger small"
                      aria-label={`Tirar ${c?.nome}`}
                      onClick={() =>
                        aoMudar(desempate.filter((_, j) => j !== i))
                      }
                    >
                      <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="ui-texto-secundario">Sem critérios de desempate.</p>
      )}
      {desabilitado || !disponiveis.length ? null : (
        <Campo rotulo="Adicionar critério">
          <select
            id={idNovo}
            value=""
            data-acao="adicionar-criterio"
            onChange={(e) => {
              const c = CRITERIO_POR_CODIGO[e.target.value];
              if (c)
                aoMudar([
                  ...desempate,
                  { criterio: c.codigo, direcao: c.direcao },
                ]);
            }}
          >
            <option value="">Escolher do catálogo…</option>
            {disponiveis.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nome}
              </option>
            ))}
          </select>
        </Campo>
      )}
    </div>
  );
}

function Modalidades({ modalidades, aoMudar, desabilitado }) {
  const mudar = (i, campos) =>
    aoMudar(modalidades.map((m, j) => (j === i ? { ...m, ...campos } : m)));
  return (
    <div className="ui-tabela-rolagem classificacao-modalidades">
      <table>
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Nome</th>
            <th scope="col">%</th>
            <th scope="col">Arredondamento</th>
            <th scope="col">Lista própria</th>
            <th scope="col">Recomeça a posição</th>
            <th scope="col">Também na geral</th>
            <th scope="col">Vaga sem candidato vai para</th>
            <th scope="col">Reúne (reserva conjunta)</th>
            {desabilitado ? null : <th scope="col" aria-label="Ações" />}
          </tr>
        </thead>
        <tbody>
          {modalidades.map((m, i) => (
            <tr key={i} data-modalidade={m.codigo}>
              <td>
                <input
                  aria-label="Código"
                  value={m.codigo}
                  maxLength={8}
                  size={5}
                  disabled={desabilitado || m.codigo === "AC"}
                  onChange={(e) =>
                    mudar(i, { codigo: e.target.value.toUpperCase() })
                  }
                />
              </td>
              <td>
                <input
                  aria-label="Nome"
                  value={m.nome}
                  disabled={desabilitado}
                  onChange={(e) => mudar(i, { nome: e.target.value })}
                />
              </td>
              <td>
                <EntradaConvertida
                  aria-label="Percentual"
                  inputMode="decimal"
                  size={4}
                  valor={m.percentual}
                  formatar={textoDoNumero}
                  converter={numeroOuNulo}
                  disabled={desabilitado || m.codigo === "AC"}
                  aoMudar={(percentual) => mudar(i, { percentual })}
                />
              </td>
              <td>
                <select
                  aria-label="Arredondamento da reserva"
                  value={m.arredondamento}
                  disabled={desabilitado || m.codigo === "AC"}
                  onChange={(e) => mudar(i, { arredondamento: e.target.value })}
                >
                  {ARREDONDAMENTOS_DE_COTA.map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="checkbox"
                  aria-label="Lista própria"
                  checked={m.lista_propria}
                  disabled={desabilitado}
                  onChange={(e) =>
                    mudar(i, { lista_propria: e.target.checked })
                  }
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  aria-label="Recomeça a posição"
                  checked={m.recomeca_posicao}
                  disabled={desabilitado}
                  onChange={(e) =>
                    mudar(i, { recomeca_posicao: e.target.checked })
                  }
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  aria-label="Também na geral"
                  checked={m.aparece_na_geral}
                  disabled={desabilitado || m.codigo === "AC"}
                  onChange={(e) =>
                    mudar(i, { aparece_na_geral: e.target.checked })
                  }
                />
              </td>
              <td>
                <EntradaConvertida
                  aria-label="Remanejar para"
                  valor={m.remanejar_para}
                  formatar={textoDaLista}
                  converter={listaEmMaiusculas}
                  disabled={desabilitado || m.codigo === "AC"}
                  placeholder="AC"
                  aoMudar={(remanejar_para) => mudar(i, { remanejar_para })}
                />
              </td>
              <td>
                <EntradaConvertida
                  aria-label="Reúne as modalidades"
                  valor={m.agrupa}
                  formatar={textoDaLista}
                  converter={listaEmMaiusculas}
                  disabled={desabilitado || m.codigo === "AC"}
                  placeholder="PP, PI, PQ"
                  aoMudar={(agrupa) => mudar(i, { agrupa })}
                />
              </td>
              {desabilitado ? null : (
                <td>
                  {m.codigo === "AC" ? null : (
                    <button
                      type="button"
                      className="btn danger small"
                      aria-label={`Tirar ${m.nome}`}
                      onClick={() =>
                        aoMudar(modalidades.filter((_, j) => j !== i))
                      }
                    >
                      <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {desabilitado ? null : (
        <button
          type="button"
          className="btn secondary small"
          onClick={() =>
            aoMudar([
              ...modalidades,
              {
                codigo: "",
                nome: "",
                percentual: null,
                arredondamento: "MEIO_PARA_CIMA",
                lista_propria: true,
                recomeca_posicao: true,
                aparece_na_geral: true,
                remanejar_para: ["AC"],
                agrupa: [],
              },
            ])
          }
        >
          <i className="fa-solid fa-plus" aria-hidden="true" /> Modalidade
        </button>
      )}
    </div>
  );
}

function Versoes({ regra, podeEditar, aoUsar, aoRenomear }) {
  const versoes = regra?.versoes || [];
  if (!versoes.length) return null;
  return (
    <section
      className="ui-card classificacao-versoes"
      aria-labelledby="classificacaoVersoesTitulo"
      data-tour="classificacao-regra-versoes"
    >
      <h2 className="ui-titulo" id="classificacaoVersoesTitulo">
        Versões da regra
      </h2>
      <ol reversed className="classificacao-versoes-lista">
        {versoes.map((v) => (
          <li key={v.versao} data-versao={v.versao}>
            <NomeDaVersao
              versao={v.versao}
              nome={v.nome}
              trocas={v.renomeacoes}
            />{" "}
            ·{" "}
            {new Date(v.em).toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              dateStyle: "short",
              timeStyle: "short",
            })}
            {v.por ? ` · ${v.por}` : ""}
            {v.motivo ? ` · ${v.motivo}` : ""}
            {podeEditar && v.versao !== regra.versao ? (
              <button
                type="button"
                className="btn secondary small"
                onClick={() => aoUsar(v.configuracao)}
              >
                Usar no formulário
              </button>
            ) : null}
            {podeEditar && aoRenomear ? (
              <RenomearVersao
                versao={v.versao}
                nome={v.nome}
                aoRenomear={(nome, motivo) =>
                  aoRenomear(v.versao, nome, motivo)
                }
              />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Regra({ estado, e, dataDeCorte }) {
  const dados = e.dados;
  const regraSalva = dados?.regra || null;
  const inicial = useMemo(
    () => normalizarRegra(regraSalva?.configuracao || REGRA_VAZIA),
    [regraSalva],
  );
  const [rascunho, setRascunho] = useState(inicial);
  const [motivo, setMotivo] = useState("");
  const [nome, setNome] = useState(null);
  const [tentou, setTentou] = useState(false);
  const ids = {
    motivo: useId(),
    rodape: useId(),
    corte: useId(),
    termos: useId(),
  };
  const leitura = !e.podeEditar;
  const erros = validarRegra(rascunho);
  const mudou =
    JSON.stringify(normalizarRegra(rascunho)) !== JSON.stringify(inicial);
  const exigeMotivo = Boolean(regraSalva);
  const sugestao = sugerirNomeDaVersao({
    tipo: "classificacao",
    edital: dados?.edital?.numero,
    motivo,
  });
  const nomeEscolhido = nomeDoCampo(nome, sugestao);
  const nomeRuim = Boolean(erroDoNomeDaVersao(nomeEscolhido));

  const mudar = (caminho, valor) =>
    setRascunho((atual) => {
      const novo = structuredClone(atual);
      let alvo = novo;
      for (const p of caminho.slice(0, -1)) alvo = alvo[p];
      alvo[caminho.at(-1)] = valor;
      return novo;
    });

  async function salvar(evento) {
    evento.preventDefault();
    setTentou(true);
    if (erros.length || (exigeMotivo && motivo.trim().length < 3) || nomeRuim)
      return;
    if (
      await estado.salvarRegra(
        rascunho,
        motivo.trim(),
        nomeParaGravar(nomeEscolhido),
      )
    ) {
      setMotivo("");
      setNome(null);
      setTentou(false);
    }
  }

  const r = rascunho;
  return (
    <form
      className="classificacao-regra"
      onSubmit={salvar}
      noValidate
      data-tour="classificacao-regra"
    >
      {!regraSalva ? (
        <Aviso tom="warning" papel="status">
          Este edital ainda não tem regra de classificação.
        </Aviso>
      ) : null}

      <section
        className="ui-card"
        aria-labelledby="regraEtapas"
        data-tour="classificacao-regra-etapas"
      >
        <h2 className="ui-titulo" id="regraEtapas">
          Etapas e nota
        </h2>
        <div className="classificacao-caixas">
          <Caixa
            rotulo="Avaliação documental"
            marcado={r.etapas.documental}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["etapas", "documental"], v)}
          />
          <Caixa
            rotulo="Entrevista"
            marcado={r.etapas.entrevista}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["etapas", "entrevista"], v)}
          />
        </div>
        <div className="ui-grade-de-campos">
          {COMPONENTES_DA_NOTA.map(([codigo, rotulo]) => {
            const i = r.composicao.componentes.findIndex(
              (c) => c.codigo === codigo,
            );
            return (
              <div key={codigo} className="classificacao-componente">
                <Caixa
                  rotulo={rotulo}
                  marcado={i >= 0}
                  desabilitado={leitura}
                  aoMudar={(sim) =>
                    mudar(
                      ["composicao", "componentes"],
                      sim
                        ? [...r.composicao.componentes, { codigo, peso: 1 }]
                        : r.composicao.componentes.filter(
                            (c) => c.codigo !== codigo,
                          ),
                    )
                  }
                />
                {i >= 0 ? (
                  <CampoNumero
                    rotulo="Peso"
                    valor={r.composicao.componentes[i].peso}
                    desabilitado={leitura}
                    aoMudar={(v) =>
                      mudar(
                        ["composicao", "componentes"],
                        r.composicao.componentes.map((c, j) =>
                          j === i ? { ...c, peso: v } : c,
                        ),
                      )
                    }
                  />
                ) : null}
              </div>
            );
          })}
          <CampoNumero
            rotulo="Casas decimais"
            passo="1"
            valor={r.composicao.casas}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["composicao", "casas"], v)}
          />
          <Escolha
            rotulo="Arredondamento"
            valor={r.composicao.arredondamento}
            opcoes={ARREDONDAMENTOS}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["composicao", "arredondamento"], v)}
          />
          <Campo
            rotulo="Data de corte da idade"
            dica={
              dataDeCorte ? `Cronograma: ${dataBR(dataDeCorte)}` : undefined
            }
          >
            <input
              id={ids.corte}
              type="date"
              value={r.data_corte || ""}
              disabled={leitura}
              onChange={(ev) => mudar(["data_corte"], ev.target.value || null)}
            />
          </Campo>
        </div>
      </section>

      <section
        className="ui-card"
        aria-labelledby="regraMinimos"
        data-tour="classificacao-regra-minimos"
      >
        <h2 className="ui-titulo" id="regraMinimos">
          Notas mínimas e eliminatórias
        </h2>
        <div className="ui-grade-de-campos">
          <CampoLista
            rotulo="Situações aptas na análise"
            valor={r.documental.situacoes_aptas}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["documental", "situacoes_aptas"], v)}
          />
          <CampoNumero
            rotulo="Mínimo documental"
            valor={r.documental.nota_minima}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["documental", "nota_minima"], v)}
          />
          {NIVEIS.map(([nivel, rotulo]) => (
            <CampoNumero
              key={nivel}
              rotulo={`Mínimo documental — ${rotulo}`}
              valor={r.documental.nota_minima_por_nivel[nivel] ?? null}
              desabilitado={leitura}
              aoMudar={(v) => {
                const porNivel = { ...r.documental.nota_minima_por_nivel };
                if (v === null) delete porNivel[nivel];
                else porNivel[nivel] = v;
                mudar(["documental", "nota_minima_por_nivel"], porNivel);
              }}
            />
          ))}
          <Escolha
            rotulo="Nível padrão da vaga"
            valor={r.documental.nivel_padrao || ""}
            opcoes={[["", "Nenhum"], ...NIVEIS]}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["documental", "nivel_padrao"], v || null)}
          />
          <Campo
            rotulo="Nível pelo início do cargo"
            largo
            idDoControle={ids.termos}
          >
            <EntradaConvertida
              id={ids.termos}
              valor={r.documental.niveis_por_cargo}
              formatar={textoDosNiveisPorCargo}
              converter={niveisPorCargo}
              disabled={leitura}
              placeholder="Técnico=tecnico; Agente=fundamental"
              aoMudar={(v) => mudar(["documental", "niveis_por_cargo"], v)}
            />
          </Campo>
          <fieldset className="classificacao-parciais" data-campo="parciais">
            <legend className="ui-texto-secundario">
              Parciais publicadas na avaliação documental
            </legend>
            {PARCIAIS_DA_DOCUMENTAL.map(([codigo, rotulo]) => (
              <Caixa
                key={codigo}
                rotulo={rotulo}
                marcado={r.documental.parciais.includes(codigo)}
                desabilitado={leitura}
                aoMudar={(marcado) =>
                  mudar(
                    ["documental", "parciais"],
                    PARCIAIS_DA_DOCUMENTAL.map(([c]) => c).filter((c) =>
                      c === codigo
                        ? marcado
                        : r.documental.parciais.includes(c),
                    ),
                  )
                }
              />
            ))}
          </fieldset>
          <CampoNumero
            rotulo="Mínimo na entrevista"
            valor={r.entrevista.nota_minima}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["entrevista", "nota_minima"], v)}
          />
          <CampoNumero
            rotulo="Mínimo por competência"
            valor={r.entrevista.nota_minima_competencia}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["entrevista", "nota_minima_competencia"], v)}
          />
          <CampoNumero
            rotulo="Elimina com nota até"
            valor={r.entrevista.nota_eliminatoria_ate}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["entrevista", "nota_eliminatoria_ate"], v)}
          />
        </div>
        <div className="classificacao-caixas">
          <Caixa
            rotulo="Ausente na entrevista é eliminado"
            marcado={r.entrevista.exige_comparecimento}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["entrevista", "exige_comparecimento"], v)}
          />
          <Caixa
            rotulo="Parecer inapto elimina"
            marcado={r.entrevista.inapto_elimina}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["entrevista", "inapto_elimina"], v)}
          />
          <Caixa
            rotulo="Entrevista só com parecer (apto/inapto, sem nota)"
            marcado={r.entrevista.so_parecer}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["entrevista", "so_parecer"], v)}
          />
        </div>
        {r.entrevista.competencias.length ? (
          <div className="ui-grade-de-campos">
            {r.entrevista.competencias.map((c, i) => (
              <CampoNumero
                key={c.ordem}
                rotulo={`Mínimo — ${c.nome || `Competência ${c.ordem}`}`}
                valor={c.minimo}
                desabilitado={leitura}
                aoMudar={(v) =>
                  mudar(
                    ["entrevista", "competencias"],
                    r.entrevista.competencias.map((x, j) =>
                      j === i ? { ...x, minimo: v } : x,
                    ),
                  )
                }
              />
            ))}
          </div>
        ) : null}
      </section>

      <section
        className="ui-card"
        aria-labelledby="regraDesempate"
        data-tour="classificacao-regra-desempate"
      >
        <h2 className="ui-titulo" id="regraDesempate">
          Desempate
        </h2>
        <CriteriosDeDesempate
          desempate={r.desempate}
          desabilitado={leitura}
          aoMudar={(v) => mudar(["desempate"], v)}
        />
        <div className="ui-grade-de-campos">
          <Escolha
            rotulo="Empate na preliminar"
            valor={r.listas.PRELIMINAR.empate}
            opcoes={EMPATE_NAS_LISTAS}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["listas", "PRELIMINAR", "empate"], v)}
          />
          <Escolha
            rotulo="Empate no resultado da entrevista"
            valor={r.listas.ENTREVISTA.empate}
            opcoes={EMPATE_NAS_LISTAS}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["listas", "ENTREVISTA", "empate"], v)}
          />
          <Escolha
            rotulo="Empate no resultado final"
            valor={r.listas.FINAL.empate}
            opcoes={EMPATE_NAS_LISTAS}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["listas", "FINAL", "empate"], v)}
          />
          <Escolha
            rotulo="Numeração dos empatados"
            valor={r.empate_final.numeracao}
            opcoes={NUMERACOES}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["empate_final", "numeracao"], v)}
          />
        </div>
        <div className="classificacao-empate-final">
          <span className="ui-texto-secundario">
            Empate depois de todos os critérios
          </span>
          <Segmentado
            rotulo="Empate final"
            opcoes={METODOS_DE_EMPATE_FINAL.map(([valor, rotulo]) => ({
              valor,
              rotulo,
            }))}
            valor={r.empate_final.metodo}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["empate_final", "metodo"], v)}
          />
        </div>
      </section>

      <section
        className="ui-card"
        aria-labelledby="regraModalidades"
        data-tour="classificacao-regra-modalidades"
      >
        <h2 className="ui-titulo" id="regraModalidades">
          Modalidades
        </h2>
        <Modalidades
          modalidades={r.modalidades}
          desabilitado={leitura}
          aoMudar={(v) => mudar(["modalidades"], v)}
        />
        <div className="ui-grade-de-campos">
          <CampoNumero
            rotulo="Reserva só com vagas a partir de"
            passo="1"
            valor={r.cotas.minimo_vagas_reserva}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["cotas", "minimo_vagas_reserva"], v ?? 0)}
          />
          <Escolha
            rotulo="Mais de uma cota (no resultado final)"
            valor={r.cotas.acumulo}
            opcoes={ACUMULOS}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["cotas", "acumulo"], v)}
          />
        </div>
      </section>

      <section
        className="ui-card"
        aria-labelledby="regraConvocacao"
        data-tour="classificacao-regra-convocacao"
      >
        <h2 className="ui-titulo" id="regraConvocacao">
          Convocação para entrevista
        </h2>
        <div className="ui-grade-de-campos">
          <CampoNumero
            rotulo="Vezes as vagas imediatas"
            valor={r.convocacao.multiplo_vagas}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["convocacao", "multiplo_vagas"], v)}
          />
          <CampoNumero
            rotulo="Só cadastro reserva: até a posição"
            passo="1"
            valor={r.convocacao.posicao_max_cr}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["convocacao", "posicao_max_cr"], v)}
          />
        </div>
        <div className="classificacao-caixas">
          <Caixa
            rotulo="Incluir os empatados no limite"
            marcado={r.convocacao.incluir_empatados}
            desabilitado={leitura}
            aoMudar={(v) => mudar(["convocacao", "incluir_empatados"], v)}
          />
        </div>
        {r.convocacao.excecoes.map((x, i) => (
          <div key={i} className="ui-grade-de-campos classificacao-excecao">
            <CampoLista
              rotulo="Cargos (exceção)"
              valor={x.termos}
              desabilitado={leitura}
              aoMudar={(termos) =>
                mudar(
                  ["convocacao", "excecoes"],
                  r.convocacao.excecoes.map((y, j) =>
                    j === i ? { ...y, termos } : y,
                  ),
                )
              }
            />

            <CampoNumero
              rotulo="Vezes as vagas"
              valor={x.multiplo_vagas}
              desabilitado={leitura}
              aoMudar={(v) =>
                mudar(
                  ["convocacao", "excecoes"],
                  r.convocacao.excecoes.map((y, j) =>
                    j === i ? { ...y, multiplo_vagas: v } : y,
                  ),
                )
              }
            />
            <CampoNumero
              rotulo="Até a posição"
              passo="1"
              valor={x.posicao_max_cr}
              desabilitado={leitura}
              aoMudar={(v) =>
                mudar(
                  ["convocacao", "excecoes"],
                  r.convocacao.excecoes.map((y, j) =>
                    j === i ? { ...y, posicao_max_cr: v } : y,
                  ),
                )
              }
            />
            {leitura ? null : (
              <button
                type="button"
                className="btn danger small"
                aria-label="Tirar a exceção"
                onClick={() =>
                  mudar(
                    ["convocacao", "excecoes"],
                    r.convocacao.excecoes.filter((_, j) => j !== i),
                  )
                }
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        {leitura ? null : (
          <button
            type="button"
            className="btn secondary small"
            onClick={() =>
              mudar(
                ["convocacao", "excecoes"],
                [
                  ...r.convocacao.excecoes,
                  { termos: [], multiplo_vagas: null, posicao_max_cr: null },
                ],
              )
            }
          >
            <i className="fa-solid fa-plus" aria-hidden="true" /> Exceção por
            cargo
          </button>
        )}
      </section>

      <section className="ui-card" aria-labelledby="regraRodape">
        <h2 className="ui-titulo" id="regraRodape">
          Publicação
        </h2>
        <Campo rotulo="Rodapé das listas" largo>
          <textarea
            id={ids.rodape}
            rows={2}
            maxLength={1000}
            value={r.rodape}
            disabled={leitura}
            onChange={(ev) => mudar(["rodape"], ev.target.value)}
          />
        </Campo>
      </section>

      {leitura ? null : (
        <section
          className="ui-card classificacao-salvar"
          aria-label="Salvar a regra"
          data-tour="classificacao-regra-salvar"
        >
          {tentou && erros.length ? (
            <Aviso tom="danger" papel="alert">
              <ul>
                {erros.map((erro, i) => (
                  <li key={i}>{erro.mensagem}</li>
                ))}
              </ul>
            </Aviso>
          ) : null}
          {exigeMotivo ? (
            <Campo
              rotulo="Motivo da alteração"
              obrigatorio
              erro={
                tentou && motivo.trim().length < 3
                  ? "Informe o motivo."
                  : undefined
              }
            >
              <input
                id={ids.motivo}
                value={motivo}
                maxLength={500}
                onChange={(ev) => setMotivo(ev.target.value)}
              />
            </Campo>
          ) : null}
          <CampoNomeDaVersao
            valor={nome}
            sugestao={sugestao}
            aoMudar={setNome}
            mostrarErro={tentou}
          />
          <div className="ui-acoes">
            <button
              type="button"
              className="btn secondary"
              disabled={!mudou}
              onClick={() => setRascunho(inicial)}
            >
              Descartar
            </button>
            <button
              type="submit"
              className="btn"
              data-acao="salvar-regra"
              data-tour="classificacao-regra-botao-salvar"
              disabled={e.salvando || (!mudou && Boolean(regraSalva))}
            >
              {regraSalva
                ? `Salvar como versão ${regraSalva.versao + 1}`
                : "Salvar a regra"}
            </button>
          </div>
        </section>
      )}

      <Versoes
        regra={regraSalva}
        podeEditar={!leitura}
        aoUsar={(config) => setRascunho(normalizarRegra(config))}
        aoRenomear={estado.renomearVersao}
      />
    </form>
  );
}
