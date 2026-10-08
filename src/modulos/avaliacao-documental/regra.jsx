import { useMemo, useState } from "react";
import {
  BASES_DA_NOTA_DO_LOTE,
  BASES_DO_LOTE,
  CRITERIOS_DA_DISTRIBUICAO,
  DESEMPATES_DA_PROVISORIA,
  DESTINO_DOS_NOVOS,
  MODOS_DE_DISTRIBUICAO,
  NIVEIS,
  PARCIAIS,
  rotuloDe,
  SINAIS_DA_REVISAO,
  SITUACOES_DA_REGRA,
  TIPOS_DA_NOTA_DECLARADA,
} from "../../lib/avaliacao-documental/catalogo.js";
import {
  codigoLivre,
  normalizarRegraAnalise,
  regrasIguais,
  validarRegraAnalise,
} from "../../lib/avaliacao-documental/regra.js";
import { comecoDoEnunciado } from "../../lib/avaliacao-documental/nota-declarada.js";
import {
  erroDoNomeDaVersao,
  nomeParaGravar,
  sugerirNomeDaVersao,
} from "../../lib/nome-da-versao.ts";
import {
  Aviso,
  Campo,
  CampoNomeDaVersao,
  EstadoVazio,
  Modal,
  NomeDaVersao,
  nomeDoCampo,
  RenomearVersao,
  Segmentado,
  Selo,
} from "../../ui/index.js";
import { AssistenteDaRegra } from "./assistente/assistente.tsx";
import { ComparacaoDeVersoes, ResumoDaRegra } from "./assistente/conferir.tsx";
import { Blocos } from "./blocos.jsx";
import {
  BotaoMais,
  BotaoTirar,
  Caixa,
  CampoLista,
  CampoNumero,
  CampoPergunta,
  CampoTexto,
  comValor,
  Escolha,
} from "./campos.jsx";
import { Previa } from "./previa.jsx";

/*
  Aba "Regra" da Avaliação documental: a regra da avaliação do edital, que a
  coordenação (gestor do edital ou coordenação na equipe) cria e muda em
  versões com motivo. Dois jeitos sobre o MESMO rascunho: o assistente
  (assistente/, o padrão) e o modo avançado (o formulário inteiro, abaixo).
  "Conferida" é dupla conferência: quem salvou a versão não a confere (o
  banco recusa; o administrador global pode). Quem só lê vê o formulário
  travado, o resumo e a comparação de versões. A prévia "Testar com um
  candidato fictício" usa o rascunho e não grava.
*/

const CHAVE_DO_MODO = "avd-regra-modo";
const MODOS = [
  {
    valor: "assistente",
    rotulo: "Assistente",
    icone: "fa-wand-magic-sparkles",
  },
  { valor: "avancado", rotulo: "Modo avançado", icone: "fa-sliders" },
];
function lerModo() {
  try {
    return globalThis.localStorage?.getItem(CHAVE_DO_MODO) === "avancado"
      ? "avancado"
      : "assistente";
  } catch {
    return "assistente";
  }
}
function guardarModo(modo) {
  try {
    globalThis.localStorage?.setItem(CHAVE_DO_MODO, modo);
  } catch {
    // Sem armazenamento (modo privado): vale só nesta abertura.
  }
}

const dataHora = (iso) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";

function SemRegra({ e, estado }) {
  const modelos = e.dados?.modelos ?? [];
  const [modelo, setModelo] = useState(modelos[0]?.codigo ?? "");
  const [erro, setErro] = useState("");
  if (!e.dados?.pode_coordenar)
    return (
      <EstadoVazio>Este edital ainda não tem regra da avaliação.</EstadoVazio>
    );
  return (
    <section className="ui-card" aria-labelledby="avdSemRegra">
      <h2 className="ui-titulo" id="avdSemRegra">
        Criar a regra do edital
      </h2>
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}
      <div className="avd-inline">
        <Campo rotulo="Modelo">
          <select value={modelo} onChange={(ev) => setModelo(ev.target.value)}>
            {modelos.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nome}
              </option>
            ))}
          </select>
        </Campo>
        <button
          type="button"
          className="btn"
          data-acao="copiar-modelo"
          disabled={!modelo || e.salvando}
          onClick={async () => {
            const r = await estado.copiarModelo(modelo);
            setErro(r.ok ? "" : r.erro);
          }}
        >
          Criar a partir do modelo
        </button>
      </div>
    </section>
  );
}

function Perguntas({ perguntas, regra, aoMudar }) {
  const [blocoAlvo, setBlocoAlvo] = useState("");
  if (!perguntas?.length) return null;
  const ligar = (coluna) => {
    const prefixo = comecoDoEnunciado(coluna);
    aoMudar(
      comValor(
        regra,
        ["blocos"],
        regra.blocos.map((b) =>
          b.codigo === blocoAlvo && !(b.perguntas ?? []).includes(prefixo)
            ? { ...b, perguntas: [...(b.perguntas ?? []), prefixo] }
            : b,
        ),
      ),
    );
  };
  const paraNotaDeclarada = (p) =>
    aoMudar(
      comValor(
        regra,
        ["provisoria", "nota_declarada"],
        [
          ...regra.provisoria.nota_declarada,
          {
            parcial: "FORMACAO",
            pergunta: comecoDoEnunciado(p.coluna),
            tipo: "OPCAO",
            pontos: Object.fromEntries(p.respostas.map((r) => [r.valor, 0])),
            teto: null,
          },
        ],
      ),
    );
  const usadas = new Set(regra.blocos.flatMap((b) => b.perguntas ?? []));
  return (
    <section className="ui-card" aria-labelledby="avdPerguntas">
      <h2 className="ui-titulo" id="avdPerguntas">
        Perguntas da última carga da Empregare
      </h2>
      <label className="avd-inline">
        Ligar ao bloco{" "}
        <select
          value={blocoAlvo}
          onChange={(ev) => setBlocoAlvo(ev.target.value)}
        >
          <option value="">…</option>
          {regra.blocos.map((b) => (
            <option key={b.codigo} value={b.codigo}>
              {b.titulo || b.codigo}
            </option>
          ))}
        </select>
      </label>
      <ul className="avd-perguntas">
        {perguntas.map((p) => (
          <li key={p.coluna} data-pergunta={p.coluna}>
            <div className="avd-pergunta-topo">
              <strong>{p.coluna}</strong>
              {usadas.has(comecoDoEnunciado(p.coluna)) ? (
                <Selo tom="aprovado">Ligada</Selo>
              ) : null}
              <button
                type="button"
                className="btn secondary small"
                disabled={!blocoAlvo}
                onClick={() => ligar(p.coluna)}
              >
                Ligar
              </button>
              <button
                type="button"
                className="btn secondary small"
                disabled={!p.respostas.length}
                onClick={() => paraNotaDeclarada(p)}
              >
                Pontuar na nota declarada
              </button>
            </div>
            <span className="ui-texto-secundario">
              {p.respostas
                .map((r) => `${r.valor} (${r.quantidade})`)
                .join(" · ")}
              {p.outras
                ? `${p.respostas.length ? " · " : ""}${p.outras} resposta(s) única(s)`
                : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* Os níveis que um item por nível mostra: os do mapa, na ordem do catálogo. */
const NIVEIS_DA_DECLARADA = ["superior", "tecnico", "medio"];
const niveisDoItem = (item) =>
  NIVEIS.map(([n]) => n).filter((n) => item.pontos_por_nivel?.[n]);

/* Liga ou desliga os pontos por nível (uma coluna por nível, as mesmas respostas). */
function comPontosPorNivel(item, ligar) {
  const novo = { ...item };
  if (ligar) {
    const base = item.pontos ?? {};
    novo.pontos_por_nivel = Object.fromEntries(
      NIVEIS_DA_DECLARADA.map((n) => [n, { ...base }]),
    );
    delete novo.pontos;
  } else {
    const primeiro = niveisDoItem(item)[0];
    novo.pontos = { ...(item.pontos_por_nivel?.[primeiro] ?? {}) };
    delete novo.pontos_por_nivel;
  }
  return novo;
}

/* As respostas de um item por nível: a união das respostas de todos os níveis. */
const respostasPorNivel = (item) => [
  ...new Set(
    niveisDoItem(item).flatMap((n) => Object.keys(item.pontos_por_nivel[n])),
  ),
];

function RespostasPorNivel({ item, aoMudar }) {
  const niveis = niveisDoItem(item);
  const comMapa = (transformar) =>
    aoMudar({
      ...item,
      pontos_por_nivel: Object.fromEntries(
        niveis.map((n) => [n, transformar(n, item.pontos_por_nivel[n])]),
      ),
    });
  return (
    <>
      {respostasPorNivel(item).map((resposta) => (
        <div className="avd-linha avd-recuo" key={resposta}>
          <span className="avd-resposta">{resposta}</span>
          {niveis.map((n) => (
            <CampoNumero
              key={n}
              rotulo={rotuloDe(NIVEIS, n)}
              valor={item.pontos_por_nivel[n][resposta]}
              aoMudar={(v) =>
                comMapa((nivel, mapa) =>
                  nivel === n ? { ...mapa, [resposta]: v } : mapa,
                )
              }
            />
          ))}
          <BotaoTirar
            rotulo="Tirar a resposta"
            aoClicar={() =>
              comMapa((_, mapa) => {
                const resto = { ...mapa };
                delete resto[resposta];
                return resto;
              })
            }
          />
        </div>
      ))}
      <label className="avd-inline avd-recuo">
        Resposta{" "}
        <input
          placeholder="Texto exato da resposta"
          onKeyDown={(ev) => {
            if (ev.key !== "Enter") return;
            ev.preventDefault();
            const texto = ev.currentTarget.value.trim();
            if (texto) comMapa((_, mapa) => ({ ...mapa, [texto]: 0 }));
            ev.currentTarget.value = "";
          }}
        />
      </label>
    </>
  );
}

function NotaDeclarada({ regra, aoMudar }) {
  const itens = regra.provisoria.nota_declarada;
  const mudar = (i, item) =>
    aoMudar(comValor(regra, ["provisoria", "nota_declarada", i], item));
  return (
    <div className="avd-subgrupo">
      <h3>Nota recalculada (confere a nota declarada, ART)</h3>
      {itens.map((item, i) => {
        const chave = item.tipo === "FAIXA_EM_MESES" ? "meses" : "pontos";
        const mapa = item[chave] ?? {};
        const porNivel =
          item.tipo !== "FAIXA_EM_MESES" &&
          item.pontos_por_nivel !== null &&
          typeof item.pontos_por_nivel === "object";
        return (
          <div key={i} className="avd-declarada">
            <div className="avd-linha">
              <Escolha
                rotulo="Parcial"
                valor={item.parcial}
                opcoes={PARCIAIS}
                aoMudar={(v) => mudar(i, { ...item, parcial: v })}
              />
              <CampoPergunta
                rotulo="Pergunta (começo do enunciado)"
                valor={item.pergunta}
                aoMudar={(v) => mudar(i, { ...item, pergunta: v })}
              />
              <Escolha
                rotulo="Como pontua"
                valor={item.tipo}
                opcoes={TIPOS_DA_NOTA_DECLARADA}
                aoMudar={(v) => {
                  const novo = {
                    ...(v === "FAIXA_EM_MESES" && porNivel
                      ? comPontosPorNivel(item, false)
                      : item),
                    tipo: v,
                  };
                  if (v === "FAIXA_EM_MESES") {
                    novo.meses = novo.meses ?? novo.pontos ?? {};
                    delete novo.pontos;
                    novo.pontos_por_mes = item.pontos_por_mes ?? 0;
                  } else if (!porNivel) {
                    novo.pontos = item.pontos ?? item.meses ?? {};
                    delete novo.meses;
                    delete novo.pontos_por_mes;
                  }
                  mudar(i, novo);
                }}
              />
              {item.tipo === "FAIXA_EM_MESES" ? (
                <CampoNumero
                  rotulo="Pontos por mês"
                  valor={item.pontos_por_mes}
                  aoMudar={(v) => mudar(i, { ...item, pontos_por_mes: v })}
                />
              ) : null}
              <CampoNumero
                rotulo="Teto"
                valor={item.teto}
                aoMudar={(v) => mudar(i, { ...item, teto: v })}
              />
              {item.tipo !== "FAIXA_EM_MESES" ? (
                <Caixa
                  rotulo="Pontos por nível"
                  marcado={porNivel}
                  aoMudar={(v) => mudar(i, comPontosPorNivel(item, v))}
                />
              ) : null}
              <BotaoTirar
                rotulo="Tirar a pergunta"
                aoClicar={() =>
                  aoMudar(
                    comValor(
                      regra,
                      ["provisoria", "nota_declarada"],
                      itens.filter((_, j) => j !== i),
                    ),
                  )
                }
              />
            </div>
            {porNivel ? (
              <RespostasPorNivel item={item} aoMudar={(v) => mudar(i, v)} />
            ) : null}
            {(porNivel ? [] : Object.entries(mapa)).map(([resposta, valor]) => (
              <div className="avd-linha avd-recuo" key={resposta}>
                <span className="avd-resposta">{resposta}</span>
                <CampoNumero
                  rotulo={chave === "meses" ? "Meses" : "Pontos"}
                  valor={valor}
                  aoMudar={(v) =>
                    mudar(i, { ...item, [chave]: { ...mapa, [resposta]: v } })
                  }
                />
                <BotaoTirar
                  rotulo="Tirar a resposta"
                  aoClicar={() => {
                    const resto = { ...mapa };
                    delete resto[resposta];
                    mudar(i, { ...item, [chave]: resto });
                  }}
                />
              </div>
            ))}
            {porNivel ? null : (
              <label className="avd-inline avd-recuo">
                Resposta{" "}
                <input
                  placeholder="Texto exato da resposta"
                  onKeyDown={(ev) => {
                    if (ev.key !== "Enter") return;
                    ev.preventDefault();
                    const texto = ev.currentTarget.value.trim();
                    if (texto)
                      mudar(i, { ...item, [chave]: { ...mapa, [texto]: 0 } });
                    ev.currentTarget.value = "";
                  }}
                />
              </label>
            )}
          </div>
        );
      })}
      <BotaoMais
        aoClicar={() =>
          aoMudar(
            comValor(
              regra,
              ["provisoria", "nota_declarada"],
              [
                ...itens,
                {
                  parcial: "FORMACAO",
                  pergunta: "",
                  tipo: "OPCAO",
                  pontos: {},
                  teto: null,
                },
              ],
            ),
          )
        }
      >
        Pergunta pontuada
      </BotaoMais>
    </div>
  );
}

function EliminacaoAutomatica({ regra, aoMudar }) {
  const itens = regra.provisoria.eliminacao_automatica;
  const mudar = (i, item) =>
    aoMudar(comValor(regra, ["provisoria", "eliminacao_automatica", i], item));
  const fonteDe = (item) =>
    ["coluna", "coluna_prefixo", "pergunta"].find(
      (k) => item[k] !== undefined,
    ) ?? "coluna";
  return (
    <div className="avd-subgrupo">
      <h3>Eliminação automática</h3>
      {itens.map((item, i) => {
        const fonte = fonteDe(item);
        return (
          <div className="avd-linha" key={i}>
            <CampoTexto
              rotulo="Código"
              valor={item.codigo}
              maximo={30}
              aoMudar={(v) => mudar(i, { ...item, codigo: v.toUpperCase() })}
            />
            <Escolha
              rotulo="Onde olhar"
              valor={fonte}
              opcoes={[
                ["coluna", "Coluna"],
                ["coluna_prefixo", "Colunas que começam com"],
                ["pergunta", "Pergunta"],
              ]}
              aoMudar={(v) => {
                const novo = { ...item, [v]: item[fonte] ?? "" };
                if (v !== fonte) delete novo[fonte];
                mudar(i, novo);
              }}
            />
            <CampoTexto
              rotulo="Nome"
              valor={item[fonte]}
              aoMudar={(v) => mudar(i, { ...item, [fonte]: v })}
            />
            <CampoLista
              rotulo="Elimina quando"
              valor={item.quando}
              aoMudar={(v) => mudar(i, { ...item, quando: v })}
            />
            <CampoLista
              rotulo="Passa só com"
              valor={item.exceto}
              aoMudar={(v) => mudar(i, { ...item, exceto: v })}
            />
            <CampoTexto
              rotulo="Motivo"
              valor={item.motivo}
              aoMudar={(v) => mudar(i, { ...item, motivo: v })}
            />
            <BotaoTirar
              rotulo="Tirar a eliminação"
              aoClicar={() =>
                aoMudar(
                  comValor(
                    regra,
                    ["provisoria", "eliminacao_automatica"],
                    itens.filter((_, j) => j !== i),
                  ),
                )
              }
            />
          </div>
        );
      })}
      <BotaoMais
        aoClicar={() =>
          aoMudar(
            comValor(
              regra,
              ["provisoria", "eliminacao_automatica"],
              [
                ...itens,
                {
                  codigo: codigoLivre(itens, "ELIMINA"),
                  coluna: "",
                  quando: [],
                  motivo: "",
                },
              ],
            ),
          )
        }
      >
        Eliminação
      </BotaoMais>
    </div>
  );
}

function ObservacoesProntas({ regra, aoMudar }) {
  const itens = regra.observacoes_prontas;
  const mudar = (i, chave, valor) =>
    aoMudar(comValor(regra, ["observacoes_prontas", i, chave], valor));
  return (
    <div className="avd-subgrupo">
      <h3>Observações prontas</h3>
      {itens.map((o, i) => (
        <div className="avd-linha" key={i}>
          <CampoTexto
            rotulo="Código"
            valor={o.codigo}
            maximo={30}
            aoMudar={(v) => mudar(i, "codigo", v.toUpperCase())}
          />
          <CampoTexto
            rotulo="Rótulo"
            valor={o.rotulo}
            maximo={100}
            aoMudar={(v) => mudar(i, "rotulo", v)}
          />
          <CampoTexto
            rotulo="Item"
            valor={o.item_edital}
            maximo={40}
            aoMudar={(v) => mudar(i, "item_edital", v)}
          />
          <Campo rotulo="Texto" largo>
            <textarea
              rows={2}
              maxLength={1000}
              value={o.texto ?? ""}
              onChange={(ev) => mudar(i, "texto", ev.target.value)}
            />
          </Campo>
          <BotaoTirar
            rotulo="Tirar a observação"
            aoClicar={() =>
              aoMudar(
                comValor(
                  regra,
                  ["observacoes_prontas"],
                  itens.filter((_, j) => j !== i),
                ),
              )
            }
          />
        </div>
      ))}
      <BotaoMais
        aoClicar={() =>
          aoMudar(
            comValor(
              regra,
              ["observacoes_prontas"],
              [
                ...itens,
                {
                  codigo: codigoLivre(itens, "OBS"),
                  rotulo: "",
                  texto: "",
                  item_edital: "",
                },
              ],
            ),
          )
        }
      >
        Observação pronta
      </BotaoMais>
    </div>
  );
}

function Versoes({ regra, podeUsar, aoUsar, aoRenomear }) {
  if (!regra?.versoes?.length) return null;
  return (
    <section className="ui-card" aria-labelledby="avdVersoes">
      <h2 className="ui-titulo" id="avdVersoes">
        Versões
      </h2>
      <ol className="avd-versoes" reversed>
        {regra.versoes.map((v) => (
          <li key={v.versao} data-versao={v.versao}>
            <NomeDaVersao
              versao={v.versao}
              nome={v.nome}
              trocas={v.renomeacoes}
            />{" "}
            · {dataHora(v.em)} · {v.por || "—"}
            {v.motivo ? (
              <span className="ui-texto-secundario"> — {v.motivo}</span>
            ) : null}
            {podeUsar && v.versao !== regra.versao ? (
              <button
                type="button"
                className="btn secondary small"
                onClick={() => aoUsar(v.configuracao)}
              >
                Levar ao formulário
              </button>
            ) : null}
            {aoRenomear ? (
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

function CarregarAldeias({ e, estado, aoFechar }) {
  const [texto, setTexto] = useState("");
  const [fonte, setFonte] = useState("");
  const [erro, setErro] = useState("");
  const unidade = e.dados?.edital?.id_unidade;
  return (
    <Modal rotulo="Lista de aldeias do DSEI" aoFechar={aoFechar}>
      <h2 className="ui-titulo">Lista de aldeias do DSEI</h2>
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}
      <Campo rotulo="Aldeias (uma por linha; NOME-(polo))" largo>
        <textarea
          rows={10}
          value={texto}
          onChange={(ev) => setTexto(ev.target.value)}
        />
      </Campo>
      <Campo rotulo="Fonte" largo>
        <input
          value={fonte}
          maxLength={300}
          onChange={(ev) => setFonte(ev.target.value)}
        />
      </Campo>
      <div className="ui-acoes">
        <button type="button" className="btn secondary" onClick={aoFechar}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn"
          disabled={e.salvando || !unidade}
          onClick={async () => {
            const aldeias = texto
              .split("\n")
              .map((t) => t.trim())
              .filter(Boolean);
            const r = await estado.salvarAldeias(
              unidade,
              aldeias,
              fonte.trim(),
            );
            if (r.ok) aoFechar();
            else setErro(r.erro);
          }}
        >
          Salvar a lista
        </button>
      </div>
    </Modal>
  );
}

function CabecalhoDaRegra({ regraSalva, leitura, mudou, e, estado, aoErro }) {
  const outraPessoa = Boolean(regraSalva.conferir_pede_outra_pessoa);
  return (
    <section
      className="ui-card avd-resumo-da-regra"
      aria-label="Situação da regra"
    >
      <NomeDaVersao versao={regraSalva.versao} nome={regraSalva.nome} />
      <Selo tom={regraSalva.situacao === "CONFERIDA" ? "aprovado" : "pendente"}>
        {rotuloDe(SITUACOES_DA_REGRA, regraSalva.situacao)}
      </Selo>
      <span className="ui-texto-secundario">
        {regraSalva.por} · {dataHora(regraSalva.atualizado_em)}
        {regraSalva.modelo_origem
          ? ` · modelo ${regraSalva.modelo_origem}`
          : ""}
        {regraSalva.situacao === "CONFERIDA" && regraSalva.conferida_por
          ? ` · conferida por ${regraSalva.conferida_por}`
          : ""}
      </span>
      {leitura || !estado.renomearVersao ? null : (
        <RenomearVersao
          versao={regraSalva.versao}
          nome={regraSalva.nome}
          desabilitado={e.salvando}
          aoRenomear={(nome, motivo) =>
            estado.renomearVersao(regraSalva.versao, nome, motivo)
          }
        />
      )}
      {!leitura && regraSalva.situacao !== "CONFERIDA" ? (
        <>
          <button
            type="button"
            className="btn secondary small"
            data-acao="conferir-regra"
            data-tour="avd-regra-conferir"
            disabled={mudou || e.salvando || outraPessoa}
            title={
              outraPessoa
                ? "Dupla conferência: outra pessoa da coordenação confere"
                : undefined
            }
            onClick={async () => {
              const r = await estado.conferirRegra();
              aoErro(r.ok ? "" : r.erro);
            }}
          >
            Marcar como conferida
          </button>
          {outraPessoa ? (
            <span className="avd-dupla-conferencia" data-dupla-conferencia="">
              <i className="fa-solid fa-user-check" aria-hidden="true" /> Você
              salvou esta versão: outra pessoa da coordenação confere.
            </span>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function Regra({ e, estado }) {
  const dados = e.dados;
  const regraSalva = dados?.regra ?? null;
  const leitura = !dados?.pode_coordenar;
  const inicial = useMemo(
    () => (regraSalva ? normalizarRegraAnalise(regraSalva.configuracao) : null),
    [regraSalva],
  );
  const [rascunho, setRascunho] = useState(inicial);
  const [motivo, setMotivo] = useState("");
  const [nome, setNome] = useState(null);
  const [tentou, setTentou] = useState(false);
  const [erroDoBanco, setErroDoBanco] = useState("");
  const [aldeiasAbertas, setAldeiasAbertas] = useState(false);
  const [modo, setModo] = useState(lerModo);
  const mudarModo = (novo) => {
    setModo(novo);
    guardarModo(novo);
  };
  const seletorDeModo = leitura ? null : (
    <div className="avd-modo-da-regra">
      <Segmentado
        rotulo="Como editar a regra"
        opcoes={MODOS}
        valor={modo}
        aoMudar={mudarModo}
        tour="avd-regra-modo"
      />
    </div>
  );
  const assistente = (
    <AssistenteDaRegra
      e={e}
      estado={estado}
      rascunho={rascunho}
      inicial={inicial}
      aoMudarRascunho={setRascunho}
    />
  );

  if (!regraSalva) {
    if (leitura) return <SemRegra e={e} estado={estado} />;
    return (
      <div className="avd-regra">
        {seletorDeModo}
        {modo === "assistente" ? (
          assistente
        ) : (
          <SemRegra e={e} estado={estado} />
        )}
      </div>
    );
  }
  if (!rascunho) return <SemRegra e={e} estado={estado} />;
  const cabecalho = (
    <CabecalhoDaRegra
      regraSalva={regraSalva}
      leitura={leitura}
      mudou={!regrasIguais(rascunho, inicial)}
      e={e}
      estado={estado}
      aoErro={setErroDoBanco}
    />
  );
  const avisoDoBanco = erroDoBanco ? (
    <Aviso tom="danger" papel="alert">
      {erroDoBanco}
    </Aviso>
  ) : null;
  if (!leitura && modo === "assistente")
    return (
      <div className="avd-regra">
        {cabecalho}
        {avisoDoBanco}
        {seletorDeModo}
        {assistente}
        <Versoes
          regra={regraSalva}
          podeUsar
          aoUsar={(config) => setRascunho(normalizarRegraAnalise(config))}
          aoRenomear={estado.renomearVersao}
        />
      </div>
    );

  const erros = validarRegraAnalise(rascunho);
  const mudou = !regrasIguais(rascunho, inicial);
  const motivoCurto = motivo.trim().length < 10;
  const sugestao = sugerirNomeDaVersao({
    tipo: "regra",
    edital: dados.edital?.numero,
    motivo,
  });
  const nomeEscolhido = nomeDoCampo(nome, sugestao);
  const nomeRuim = Boolean(erroDoNomeDaVersao(nomeEscolhido));
  const mudar = (caminho, valor) =>
    setRascunho(comValor(rascunho, caminho, valor));
  const temEtnico = rascunho.blocos.some((b) => b.tipo === "PONTUACAO");
  const aldeias = dados.aldeias ?? {};

  async function salvar(ev) {
    ev.preventDefault();
    setTentou(true);
    if (erros.length || motivoCurto || nomeRuim) return;
    const r = await estado.salvarRegra(
      rascunho,
      motivo.trim(),
      nomeParaGravar(nomeEscolhido),
    );
    if (r.ok) {
      setMotivo("");
      setNome(null);
      setTentou(false);
      setErroDoBanco("");
    } else setErroDoBanco(r.erro);
  }

  return (
    <form className="avd-regra" onSubmit={salvar} noValidate>
      {cabecalho}
      {avisoDoBanco}
      {seletorDeModo}

      <fieldset className="avd-campos" disabled={leitura}>
        <section className="ui-card" aria-labelledby="avdGeral">
          <h2 className="ui-titulo" id="avdGeral">
            Geral
          </h2>
          <div className="ui-grade-de-campos">
            <CampoTexto
              rotulo="Título da etapa"
              valor={rascunho.titulo_etapa}
              aoMudar={(v) => mudar(["titulo_etapa"], v)}
            />
            <CampoTexto
              rotulo="Edital no parecer"
              valor={rascunho.edital_rotulo}
              maximo={120}
              aoMudar={(v) => mudar(["edital_rotulo"], v)}
            />
            <CampoNumero
              rotulo="Casas decimais do parecer"
              valor={rascunho.casas_parecer}
              aoMudar={(v) => mudar(["casas_parecer"], v)}
            />
            <CampoTexto
              rotulo="Item da nota mínima"
              valor={rascunho.corte.item_edital}
              maximo={40}
              aoMudar={(v) => mudar(["corte", "item_edital"], v)}
            />
            {leitura ? null : (
              <Campo rotulo="Carregar um modelo no formulário">
                <select
                  value=""
                  onChange={(ev) => {
                    const m = dados.modelos.find(
                      (x) => x.codigo === ev.target.value,
                    );
                    if (m)
                      setRascunho(
                        normalizarRegraAnalise({
                          ...m.configuracao,
                          modelo: m.codigo,
                          edital_rotulo:
                            rascunho.edital_rotulo ||
                            m.configuracao.edital_rotulo,
                        }),
                      );
                  }}
                >
                  <option value="">…</option>
                  {dados.modelos.map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>
          {temEtnico ? (
            <p className="avd-aldeias" data-aldeias={aldeias.quantidade ?? 0}>
              Aldeias do DSEI do edital:{" "}
              <strong>{aldeias.quantidade ?? 0}</strong>
              {aldeias.fonte ? (
                <span className="ui-texto-secundario"> · {aldeias.fonte}</span>
              ) : null}{" "}
              {dados.pode_carregar_aldeias && dados.edital?.id_unidade ? (
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => setAldeiasAbertas(true)}
                >
                  Atualizar a lista
                </button>
              ) : null}
            </p>
          ) : null}
        </section>

        <section className="ui-card" aria-labelledby="avdBlocos">
          <h2 className="ui-titulo" id="avdBlocos">
            Blocos da ficha
          </h2>
          <Blocos
            blocos={rascunho.blocos}
            aoMudar={(v) => mudar(["blocos"], v)}
          />
        </section>

        {leitura ? null : (
          <Perguntas
            perguntas={dados.perguntas}
            regra={rascunho}
            aoMudar={setRascunho}
          />
        )}

        <section className="ui-card" aria-labelledby="avdProvisoria">
          <h2 className="ui-titulo" id="avdProvisoria">
            Provisória por ART
          </h2>
          <EliminacaoAutomatica regra={rascunho} aoMudar={setRascunho} />
          <NotaDeclarada regra={rascunho} aoMudar={setRascunho} />
          <div
            className="ui-grade-de-campos"
            data-tour="avd-regra-base-da-nota"
          >
            <Escolha
              rotulo="Nota do corte e da ordem do lote"
              valor={rascunho.provisoria.base_da_nota}
              opcoes={BASES_DA_NOTA_DO_LOTE}
              aoMudar={(v) => mudar(["provisoria", "base_da_nota"], v)}
            />
            <CampoNumero
              rotulo="Tolerância da divergência (pontos)"
              valor={rascunho.provisoria.divergencia_tolerancia}
              aoMudar={(v) =>
                mudar(["provisoria", "divergencia_tolerancia"], v)
              }
            />
          </div>
          <div className="ui-grade-de-campos" data-tour="avd-regra-desempate">
            {DESEMPATES_DA_PROVISORIA.map((_d, i) => {
              const desempate = rascunho.provisoria.desempate ?? [];
              return (
                <Escolha
                  key={i}
                  rotulo={`${i + 1}º desempate`}
                  valor={desempate[i] ?? null}
                  vazio="—"
                  opcoes={DESEMPATES_DA_PROVISORIA.filter(
                    ([v]) => v === desempate[i] || !desempate.includes(v),
                  )}
                  aoMudar={(v) => {
                    const novo = [...desempate];
                    if (v) novo[i] = v;
                    else novo.splice(i);
                    mudar(["provisoria", "desempate"], novo.filter(Boolean));
                  }}
                />
              );
            })}
            {(rascunho.provisoria.desempate ?? []).includes(
              "EXPERIENCIA_DECLARADA",
            ) ? (
              <CampoPergunta
                rotulo="Pergunta da experiência (início do enunciado)"
                valor={rascunho.provisoria.pergunta_experiencia}
                aoMudar={(v) =>
                  mudar(["provisoria", "pergunta_experiencia"], v || null)
                }
              />
            ) : null}
          </div>
        </section>

        <section className="ui-card" aria-labelledby="avdLote">
          <h2 className="ui-titulo" id="avdLote">
            Lote e linha de corte
          </h2>
          <div className="ui-grade-de-campos">
            <Escolha
              rotulo="Tamanho do lote"
              valor={rascunho.lote.base}
              opcoes={BASES_DO_LOTE}
              aoMudar={(v) => {
                const minima = dados.nota_minima?.nota_minima;
                const comBase = comValor(rascunho, ["lote", "base"], v);
                setRascunho(
                  v === "NOTA_MINIMA" &&
                    rascunho.lote.nota_minima == null &&
                    typeof minima === "number"
                    ? comValor(comBase, ["lote", "nota_minima"], minima)
                    : comBase,
                );
              }}
            />
            {rascunho.lote.base === "FIXO" ? (
              <CampoNumero
                rotulo="Candidatos por vaga"
                valor={rascunho.lote.fixo}
                aoMudar={(v) => mudar(["lote", "fixo"], v)}
              />
            ) : rascunho.lote.base === "NOTA_MINIMA" ? (
              <>
                <CampoNumero
                  rotulo="Nota mínima (nota declarada, ART)"
                  valor={rascunho.lote.nota_minima}
                  aoMudar={(v) => mudar(["lote", "nota_minima"], v)}
                />
                <CampoTexto
                  rotulo="Item do edital"
                  maximo={40}
                  valor={rascunho.lote.item_edital}
                  aoMudar={(v) => mudar(["lote", "item_edital"], v || null)}
                />
              </>
            ) : (
              <CampoNumero
                rotulo="Vezes as vagas imediatas"
                valor={rascunho.lote.multiplo}
                aoMudar={(v) => mudar(["lote", "multiplo"], v)}
              />
            )}
          </div>
          <div className="avd-caixas">
            <Caixa
              rotulo="Soma o cadastro reserva"
              marcado={rascunho.lote.inclui_cr}
              aoMudar={(v) => mudar(["lote", "inclui_cr"], v)}
            />
            <Caixa
              rotulo="Por modalidade"
              marcado={rascunho.lote.por_modalidade}
              aoMudar={(v) => mudar(["lote", "por_modalidade"], v)}
            />
            <Caixa
              rotulo="Inclui os empatados na linha"
              marcado={rascunho.lote.inclui_empatados}
              aoMudar={(v) => mudar(["lote", "inclui_empatados"], v)}
            />
            <Caixa
              rotulo="A linha anda (repõe o lote)"
              marcado={rascunho.lote.linha_anda}
              aoMudar={(v) => mudar(["lote", "linha_anda"], v)}
            />
            <Caixa
              rotulo="Publica cada reposição"
              marcado={rascunho.lote.publica_reposicao}
              aoMudar={(v) => mudar(["lote", "publica_reposicao"], v)}
            />
          </div>
        </section>

        <section className="ui-card" aria-labelledby="avdDistribuicao">
          <h2 className="ui-titulo" id="avdDistribuicao">
            Distribuição e revisão
          </h2>
          <div className="ui-grade-de-campos">
            <Escolha
              rotulo="Distribuição"
              valor={rascunho.distribuicao.modo}
              opcoes={MODOS_DE_DISTRIBUICAO}
              aoMudar={(v) => mudar(["distribuicao", "modo"], v)}
            />
            {rascunho.distribuicao.modo === "DISTRIBUICAO_INICIAL" ? (
              <>
                <Escolha
                  rotulo="Como reparte"
                  valor={rascunho.distribuicao.criterio}
                  opcoes={CRITERIOS_DA_DISTRIBUICAO}
                  aoMudar={(v) => mudar(["distribuicao", "criterio"], v)}
                />
                <CampoNumero
                  rotulo="Limite por analista"
                  valor={rascunho.distribuicao.limite_por_analista}
                  aoMudar={(v) =>
                    mudar(["distribuicao", "limite_por_analista"], v)
                  }
                />
                <Escolha
                  rotulo="Quem entra depois"
                  valor={rascunho.distribuicao.novos}
                  opcoes={DESTINO_DOS_NOVOS}
                  aoMudar={(v) => mudar(["distribuicao", "novos"], v)}
                />
              </>
            ) : null}
            <CampoNumero
              rotulo="Parada vira pendência (dias úteis)"
              valor={rascunho.distribuicao.dias_parada}
              aoMudar={(v) => mudar(["distribuicao", "dias_parada"], v)}
            />
            <CampoNumero
              rotulo="Amostra para revisão (%)"
              valor={rascunho.revisao.amostra_percentual}
              aoMudar={(v) => mudar(["revisao", "amostra_percentual"], v)}
            />
            <CampoNumero
              rotulo="Mínimo por analista"
              valor={rascunho.revisao.minimo_por_analista}
              aoMudar={(v) => mudar(["revisao", "minimo_por_analista"], v)}
            />
            <CampoNumero
              rotulo="Divergência acima de (pontos)"
              valor={rascunho.revisao.divergencia_pontos}
              aoMudar={(v) => mudar(["revisao", "divergencia_pontos"], v)}
            />
          </div>
          <div className="avd-caixas">
            <Caixa
              rotulo="Revisa todas"
              marcado={rascunho.revisao.todas}
              aoMudar={(v) => mudar(["revisao", "todas"], v)}
            />
            <Caixa
              rotulo="Inaptos por requisito"
              marcado={rascunho.revisao.inaptos_requisito}
              aoMudar={(v) => mudar(["revisao", "inaptos_requisito"], v)}
            />
            <Caixa
              rotulo="Inaptos por nota"
              marcado={rascunho.revisao.inaptos_nota}
              aoMudar={(v) => mudar(["revisao", "inaptos_nota"], v)}
            />
            <Caixa
              rotulo="Os que entraram pela linha"
              marcado={rascunho.revisao.entrou_pela_linha}
              aoMudar={(v) => mudar(["revisao", "entrou_pela_linha"], v)}
            />
            <Caixa
              rotulo="Duplo-cego"
              marcado={rascunho.revisao.duplo_cego}
              aoMudar={(v) => mudar(["revisao", "duplo_cego"], v)}
            />
            {SINAIS_DA_REVISAO.map(([sinal, rotulo]) => (
              <Caixa
                key={sinal}
                rotulo={`Com sinal: ${rotulo}`}
                marcado={rascunho.revisao.sinais.includes(sinal)}
                aoMudar={(v) =>
                  mudar(
                    ["revisao", "sinais"],
                    v
                      ? [...rascunho.revisao.sinais, sinal]
                      : rascunho.revisao.sinais.filter((s) => s !== sinal),
                  )
                }
              />
            ))}
          </div>
        </section>

        <section className="ui-card" aria-labelledby="avdParecer">
          <h2 className="ui-titulo" id="avdParecer">
            Parecer
          </h2>
          {[
            ["APTO", "Apto"],
            ["INAPTO_REQUISITO", "Inapto (requisito)"],
            ["INAPTO_NOTA", "Inapto (nota mínima)"],
            ["observacoes", "Observações"],
          ].map(([chave, rotulo]) => (
            <Campo key={chave} rotulo={`Modelo: ${rotulo}`} largo>
              <textarea
                rows={3}
                maxLength={4000}
                value={rascunho.parecer[chave] ?? ""}
                onChange={(ev) => mudar(["parecer", chave], ev.target.value)}
              />
            </Campo>
          ))}
          <ObservacoesProntas regra={rascunho} aoMudar={setRascunho} />
        </section>
      </fieldset>

      {leitura ? null : (
        <section
          className="ui-card ui-barra-de-salvar"
          aria-label="Salvar a regra"
        >
          {tentou && erros.length ? (
            <Aviso tom="danger" papel="alert">
              <ul>
                {erros.slice(0, 12).map((erro) => (
                  <li key={erro}>{erro}</li>
                ))}
              </ul>
            </Aviso>
          ) : null}
          <Campo
            rotulo="Motivo da alteração"
            obrigatorio
            erro={
              tentou && motivoCurto ? "De 10 a 2.000 caracteres." : undefined
            }
          >
            <input
              value={motivo}
              maxLength={2000}
              onChange={(ev) => setMotivo(ev.target.value)}
            />
          </Campo>
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
              disabled={e.salvando || !mudou}
            >
              Salvar como versão {regraSalva.versao + 1}
            </button>
          </div>
        </section>
      )}

      <Previa regra={rascunho} notaMinima={dados.nota_minima} />

      {leitura ? (
        <ResumoDaRegra
          regra={rascunho}
          contexto={{
            versao: regraSalva.versao,
            nome: regraSalva.nome ?? null,
            notaMinima: dados.nota_minima?.nota_minima ?? null,
            notaMinimaPorNivel: dados.nota_minima?.nota_minima_por_nivel ?? {},
          }}
        />
      ) : null}
      <ComparacaoDeVersoes
        regraSalva={regraSalva}
        rascunho={leitura ? null : rascunho}
      />

      <Versoes
        regra={regraSalva}
        podeUsar={!leitura}
        aoUsar={(config) => setRascunho(normalizarRegraAnalise(config))}
        aoRenomear={leitura ? null : estado.renomearVersao}
      />
      {aldeiasAbertas ? (
        <CarregarAldeias
          e={e}
          estado={estado}
          aoFechar={() => setAldeiasAbertas(false)}
        />
      ) : null}
    </form>
  );
}
