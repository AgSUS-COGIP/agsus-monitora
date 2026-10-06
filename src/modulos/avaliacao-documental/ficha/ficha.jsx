import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ACOES_DO_HISTORICO,
  BLOCOS_COM_ITENS,
  blocoSeAplica,
  divergenciaDoBloco,
  enderecoDaVagaNaEmpregare,
  enderecoDoCandidatoNaEmpregare,
  opcoesDeJustificativa,
  respostasDoBloco,
  situacaoDaTecla,
  SITUACOES_DA_FICHA,
  sugereNaoEnviado,
  textoDaAlteracao,
  textoDaNota,
  textoDoResultado,
  textoDoSalvo,
  titulosDoNivel,
  tomDoResultado,
} from "../../../lib/avaliacao-documental/ficha.js";
import {
  NIVEIS,
  PARCIAIS,
  PARCIAL_DO_TIPO,
  rotuloDe,
} from "../../../lib/avaliacao-documental/catalogo.js";
import { tetoDoBloco } from "../../../lib/avaliacao-documental/pontuacao.js";
import { Aviso, Campo, Selo } from "../../../ui/index.js";
import { criarEstadoDaFicha } from "./estado-da-ficha.js";

/*
  O conteúdo da ficha (fase F4), dentro da gaveta da aba Fila: um cartão por
  bloco da regra (o que o candidato declarou na Empregare, Conforme / Não
  conforme / Não enviado com as teclas 1, 2 e 3, o motivo em lista, os itens
  de formação, cursos e experiência e a nota com justificativa), a lateral com
  a nota ao vivo, declarada × apurada e o parecer, e a barra de ações
  (rascunho automático, Concluir e próxima, Fechar e liberar). Concluída: só
  leitura, com o histórico; a coordenação reabre com motivo. Explicações:
  docs/aya/regras-da-avaliacao-documental.md.
*/

const ehCampoDeTexto = (alvo) =>
  ["INPUT", "TEXTAREA", "SELECT"].includes(alvo?.tagName) ||
  alvo?.isContentEditable;

async function copiar(texto) {
  try {
    await globalThis.navigator?.clipboard?.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function Declarado({ linhas, sugestao }) {
  if (!linhas.length) return null;
  return (
    <dl className="avd-ficha-declarado">
      {linhas.map((l) => (
        <div key={l.coluna}>
          <dt>{l.enunciado}</dt>
          <dd>{l.texto || "Sem resposta"}</dd>
        </div>
      ))}
      {sugestao ? (
        <p className="avd-ficha-sugestao">Sugestão: Não enviado</p>
      ) : null}
    </dl>
  );
}

function BotoesDeSituacao({ valor, aoMudar, desabilitado }) {
  return (
    <div
      className="avd-ficha-situacoes"
      role="group"
      aria-label="Situação do bloco"
    >
      {SITUACOES_DA_FICHA.map(([codigo, rotulo, tecla]) => (
        <button
          key={codigo}
          type="button"
          className="avd-ficha-situacao"
          data-valor={codigo}
          aria-pressed={valor === codigo}
          disabled={desabilitado}
          onClick={() => aoMudar(valor === codigo ? null : codigo)}
        >
          <kbd aria-hidden="true">{tecla}</kbd> {rotulo}
        </button>
      ))}
    </div>
  );
}

function Caixas({ opcoes, marcados, aoMudar, desabilitado, rotulo }) {
  return (
    <fieldset className="avd-ficha-caixas" disabled={desabilitado}>
      <legend>{rotulo}</legend>
      {opcoes.map((o) => (
        <label key={o.codigo}>
          <input
            type="checkbox"
            checked={marcados.includes(o.codigo)}
            onChange={(ev) =>
              aoMudar(
                ev.target.checked
                  ? [...marcados, o.codigo]
                  : marcados.filter((c) => c !== o.codigo),
              )
            }
          />{" "}
          {o.texto}
        </label>
      ))}
    </fieldset>
  );
}

function MotivoDoItem({ bloco, valor, aoMudar, desabilitado }) {
  return (
    <select
      aria-label="Motivo da recusa"
      value={valor || ""}
      disabled={desabilitado}
      onChange={(ev) => aoMudar(ev.target.value || null)}
    >
      <option value="">Motivo da recusa…</option>
      {(bloco.motivos || []).map((m) => (
        <option key={m.codigo} value={m.codigo}>
          {m.texto}
        </option>
      ))}
    </select>
  );
}

function Itens({ bloco, lancamento, mudar, desabilitado }) {
  const chave = BLOCOS_COM_ITENS[bloco.tipo];
  const itens = lancamento[chave] || [];
  const categorias = bloco.categorias || [];
  const titulos = titulosDoNivel(bloco, lancamento.nivel);
  const alterar = (i, campos) =>
    mudar((l) => {
      l[chave] = (l[chave] || []).map((it, j) =>
        j === i ? { ...it, ...campos } : it,
      );
      return l;
    });
  const novo = () => {
    if (chave === "titulos")
      return {
        titulo: titulos[0]?.codigo || "ESPECIALIZACAO",
        nome: "",
        aceito: true,
      };
    if (chave === "cursos") return { nome: "", horas: "", aceito: true };
    return {
      empregador: "",
      categoria: categorias[0]?.codigo,
      inicio: "",
      fim: "",
      aceito: true,
    };
  };
  return (
    <div className="avd-ficha-itens" data-tour="avd-ficha-itens">
      {itens.map((it, i) => (
        <div
          key={i}
          className="avd-ficha-item"
          data-aceito={it.aceito !== false}
        >
          {chave === "titulos" ? (
            <select
              aria-label="Título"
              value={it.titulo}
              disabled={desabilitado}
              onChange={(ev) => alterar(i, { titulo: ev.target.value })}
            >
              {titulos.map((t) => (
                <option key={t.codigo} value={t.codigo}>
                  {t.rotulo}
                  {t.pontos ? ` (${t.pontos})` : ""}
                </option>
              ))}
            </select>
          ) : null}
          {chave === "vinculos" ? (
            <input
              aria-label="Empregador ou cargo"
              placeholder="Empregador ou cargo"
              value={it.empregador || ""}
              maxLength={200}
              disabled={desabilitado}
              onChange={(ev) => alterar(i, { empregador: ev.target.value })}
            />
          ) : (
            <input
              aria-label={chave === "cursos" ? "Curso" : "Curso ou instituição"}
              placeholder={
                chave === "cursos" ? "Curso" : "Curso ou instituição"
              }
              value={it.nome || ""}
              maxLength={200}
              disabled={desabilitado}
              onChange={(ev) => alterar(i, { nome: ev.target.value })}
            />
          )}
          {chave === "cursos" ? (
            <input
              aria-label="Carga horária"
              type="number"
              min="0"
              max="20000"
              inputMode="numeric"
              placeholder="Horas"
              value={it.horas ?? ""}
              disabled={desabilitado}
              onChange={(ev) =>
                alterar(i, {
                  horas: ev.target.value === "" ? "" : Number(ev.target.value),
                })
              }
            />
          ) : null}
          {chave === "vinculos" ? (
            <>
              {categorias.length > 1 ? (
                <select
                  aria-label="Categoria"
                  value={it.categoria}
                  disabled={desabilitado}
                  onChange={(ev) => alterar(i, { categoria: ev.target.value })}
                >
                  {categorias.map((c) => (
                    <option key={c.codigo} value={c.codigo}>
                      {c.rotulo || c.codigo}
                    </option>
                  ))}
                </select>
              ) : null}
              <input
                aria-label="Início"
                type="date"
                value={it.inicio || ""}
                disabled={desabilitado}
                onChange={(ev) => alterar(i, { inicio: ev.target.value })}
              />
              <input
                aria-label="Fim"
                type="date"
                value={it.fim || ""}
                disabled={desabilitado}
                onChange={(ev) => alterar(i, { fim: ev.target.value })}
              />
            </>
          ) : null}
          <label className="avd-ficha-aceito">
            <input
              type="checkbox"
              checked={it.aceito !== false}
              disabled={desabilitado}
              onChange={(ev) =>
                alterar(i, {
                  aceito: ev.target.checked,
                  motivo: ev.target.checked ? null : it.motivo,
                })
              }
            />{" "}
            Aceito
          </label>
          {it.aceito === false ? (
            <MotivoDoItem
              bloco={bloco}
              valor={it.motivo}
              desabilitado={desabilitado}
              aoMudar={(motivo) => alterar(i, { motivo })}
            />
          ) : null}
          {!desabilitado ? (
            <button
              type="button"
              className="btn secondary small"
              aria-label="Tirar o item"
              onClick={() =>
                mudar((l) => {
                  l[chave] = l[chave].filter((_, j) => j !== i);
                  return l;
                })
              }
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ))}
      {!desabilitado ? (
        <button
          type="button"
          className="btn secondary small"
          onClick={() =>
            mudar((l) => {
              l[chave] = [...(l[chave] || []), novo()];
              return l;
            })
          }
        >
          <i className="fa-solid fa-plus" aria-hidden="true" />{" "}
          {chave === "titulos"
            ? "Título"
            : chave === "cursos"
              ? "Curso"
              : "Vínculo"}
        </button>
      ) : null}
    </div>
  );
}

function NotaDoBloco({
  regra,
  bloco,
  lancado,
  lancamento,
  avaliacao,
  declarada,
  mudar,
  desabilitado,
}) {
  const parcial = PARCIAL_DO_TIPO[bloco.tipo];
  const calculado = avaliacao.calculados?.[parcial] ?? 0;
  const apurado = avaliacao.parciais?.[parcial] ?? 0;
  const decl = declarada?.parciais?.[parcial];
  const teto = tetoDoBloco(bloco, lancamento.nivel);
  const ajuste =
    typeof lancado.nota_ajustada === "number" ? lancado.nota_ajustada : null;
  const divergencia = divergenciaDoBloco(bloco, avaliacao, declarada);
  const opcoes = opcoesDeJustificativa(regra, bloco);
  const mostrarJustificativa =
    Boolean(divergencia) ||
    ajuste !== null ||
    (lancado.justificativas || []).length;
  const alterarBloco = (campos) =>
    mudar((l) => {
      l.blocos = {
        ...l.blocos,
        [bloco.codigo]: { ...(l.blocos?.[bloco.codigo] || {}), ...campos },
      };
      return l;
    });
  return (
    <div className="avd-ficha-nota" data-tour="avd-ficha-nota">
      <div className="avd-ficha-numeros">
        <span>
          Declarado{" "}
          <strong>{decl === undefined ? "—" : textoDaNota(decl)}</strong>
        </span>
        <span>
          Calculado <strong>{textoDaNota(calculado)}</strong>
        </span>
        <Campo
          rotulo={`Apurado${teto !== null ? ` (até ${textoDaNota(teto)})` : ""}`}
        >
          <input
            type="number"
            min="0"
            max={teto ?? undefined}
            step="0.5"
            inputMode="decimal"
            value={ajuste ?? apurado}
            disabled={desabilitado}
            data-divergente={divergencia ? "sim" : undefined}
            onChange={(ev) => {
              const v = ev.target.value === "" ? null : Number(ev.target.value);
              alterarBloco({
                nota_ajustada: v === null || v === calculado ? null : v,
              });
            }}
          />
        </Campo>
        {ajuste !== null && !desabilitado ? (
          <button
            type="button"
            className="btn secondary small"
            onClick={() => alterarBloco({ nota_ajustada: null })}
          >
            Usar o calculado
          </button>
        ) : null}
      </div>
      {mostrarJustificativa ? (
        <div
          className="avd-ficha-justificativa"
          data-tour="avd-ficha-justificativa"
        >
          {opcoes.length ? (
            <Caixas
              rotulo="Justificativa da nota"
              opcoes={opcoes}
              marcados={lancado.justificativas || []}
              desabilitado={desabilitado}
              aoMudar={(justificativas) => alterarBloco({ justificativas })}
            />
          ) : null}
          <Campo
            rotulo={
              opcoes.length ? "Complemento (opcional)" : "Justificativa da nota"
            }
          >
            <input
              value={lancado.justificativa_livre || ""}
              maxLength={2000}
              disabled={desabilitado}
              onChange={(ev) =>
                alterarBloco({ justificativa_livre: ev.target.value })
              }
            />
          </Campo>
        </div>
      ) : null}
    </div>
  );
}

function Etnico({ lancamento, mudar, desabilitado }) {
  const marcar = (campo) => (ev) =>
    mudar((l) => {
      l[campo] = ev.target.checked;
      return l;
    });
  return (
    <div className="avd-caixas">
      <label>
        <input
          type="checkbox"
          checked={Boolean(lancamento.indigena)}
          disabled={desabilitado}
          onChange={marcar("indigena")}
        />{" "}
        Indígena
      </label>
      <label>
        <input
          type="checkbox"
          checked={Boolean(lancamento.mora_aldeia)}
          disabled={desabilitado}
          onChange={marcar("mora_aldeia")}
        />{" "}
        Mora em aldeia
      </label>
      <label>
        <input
          type="checkbox"
          checked={Boolean(lancamento.aldeia_na_lista)}
          disabled={desabilitado}
          onChange={marcar("aldeia_na_lista")}
        />{" "}
        Aldeia na lista do DSEI
      </label>
    </div>
  );
}

function CartaoDoBloco({
  st,
  bloco,
  ativo,
  aoFocar,
  mudar,
  desabilitado,
  mostrarTodas,
}) {
  const { lancamento, avaliacao, declarada, dados, pendencias } = st;
  const regra = dados.regra.configuracao;
  const lancado = lancamento.blocos?.[bloco.codigo] || {};
  const linhas = respostasDoBloco(bloco, dados.respostas);
  const aplica = blocoSeAplica(bloco, lancamento);
  // "Marque a situação" só aparece depois de tentar concluir; o resto, na hora.
  const doBloco = pendencias.filter(
    (p) =>
      p.bloco === bloco.codigo &&
      (mostrarTodas || !p.texto.startsWith("Marque")),
  );
  const avaliado = avaliacao.blocos.find((b) => b.codigo === bloco.codigo);
  const alterarBloco = (campos) =>
    mudar((l) => {
      l.blocos = {
        ...l.blocos,
        [bloco.codigo]: { ...(l.blocos?.[bloco.codigo] || {}), ...campos },
      };
      return l;
    });
  const pedeSituacao = bloco.tipo !== "REGISTRO" && aplica;
  return (
    <section
      className="ui-card avd-ficha-bloco"
      data-bloco={bloco.codigo}
      data-situacao={aplica ? lancado.situacao || "" : "NAO_SE_APLICA"}
      data-ativo={ativo ? "sim" : undefined}
      aria-labelledby={`avdBloco-${bloco.codigo}`}
      tabIndex={-1}
      onFocus={aoFocar}
      onClick={aoFocar}
    >
      <header className="avd-ficha-bloco-topo">
        <h3 id={`avdBloco-${bloco.codigo}`}>{bloco.titulo}</h3>
        {bloco.item_edital ? <Selo>Item {bloco.item_edital}</Selo> : null}
        {!aplica ? <Selo>Não se aplica</Selo> : null}
        {avaliado?.efeito && avaliado.efeito !== "SO_REGISTRO" && aplica ? (
          <Selo tom={avaliado.efeito === "ELIMINA" ? "reprovado" : "revisar"}>
            {avaliado.efeito === "ELIMINA"
              ? "Elimina"
              : avaliado.efeito.startsWith("ENCAMINHA")
                ? "Encaminha"
                : avaliado.efeito === "SEGUE_AMPLA"
                  ? "Segue na ampla"
                  : "Sem pontos"}
          </Selo>
        ) : null}
      </header>
      {aplica ? (
        <Declarado
          linhas={linhas}
          sugestao={!lancado.situacao && sugereNaoEnviado(linhas)}
        />
      ) : null}
      {bloco.tipo === "PONTUACAO" ? (
        <Etnico
          lancamento={lancamento}
          mudar={mudar}
          desabilitado={desabilitado}
        />
      ) : null}
      {pedeSituacao ? (
        <BotoesDeSituacao
          valor={lancado.situacao}
          desabilitado={desabilitado}
          aoMudar={(situacao) =>
            alterarBloco({
              situacao,
              motivos: ["NAO_CONFORME", "NAO_ENVIADO"].includes(situacao)
                ? lancado.motivos || []
                : [],
            })
          }
        />
      ) : null}
      {pedeSituacao &&
      ["NAO_CONFORME", "NAO_ENVIADO"].includes(lancado.situacao) ? (
        (bloco.motivos || []).length ? (
          <Caixas
            rotulo="Motivo"
            opcoes={bloco.motivos}
            marcados={lancado.motivos || []}
            desabilitado={desabilitado}
            aoMudar={(motivos) => alterarBloco({ motivos })}
          />
        ) : (
          <Campo rotulo="Motivo">
            <input
              value={lancado.motivo_livre || ""}
              maxLength={2000}
              disabled={desabilitado}
              onChange={(ev) => alterarBloco({ motivo_livre: ev.target.value })}
            />
          </Campo>
        )
      ) : null}
      {aplica && BLOCOS_COM_ITENS[bloco.tipo] ? (
        <Itens
          bloco={bloco}
          lancamento={lancamento}
          mudar={mudar}
          desabilitado={desabilitado}
        />
      ) : null}
      {aplica && PARCIAL_DO_TIPO[bloco.tipo] ? (
        <NotaDoBloco
          regra={regra}
          bloco={bloco}
          lancado={lancado}
          lancamento={lancamento}
          avaliacao={avaliacao}
          declarada={declarada}
          mudar={mudar}
          desabilitado={desabilitado}
        />
      ) : null}
      {doBloco.length && !desabilitado ? (
        <ul className="avd-ficha-pendencias">
          {doBloco.map((p) => (
            <li key={p.texto}>{p.texto}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Lateral({ st, loja, ficha, mudar, desabilitado }) {
  const { avaliacao, declarada, lancamento, dados } = st;
  const regra = dados.regra.configuracao;
  const pontuam = regra.blocos.filter(
    (b) => PARCIAL_DO_TIPO[b.tipo] && blocoSeAplica(b, lancamento),
  );
  const art = dados.declarada_gravada?.art;
  // Links capturados pelo robô (obter_ficha_analise → empregare); sem eles, a lista de vagas.
  const empregare = dados.empregare || {};
  const urlDoCandidato = enderecoDoCandidatoNaEmpregare(
    empregare.link_candidato,
  );
  const urlDaVaga = enderecoDaVagaNaEmpregare(
    ficha.vaga,
    empregare.vaga_interno,
  );
  const vagaDireta = Boolean(urlDaVaga?.includes("/candidaturas/"));
  // Concluída: o que foi gravado (resultado, nota e parecer); em análise, a conta ao vivo.
  const concluida = ficha.situacao === "CONCLUIDA" && ficha.parecer;
  const gravado = concluida
    ? {
        resultado: ficha.tp_resultado,
        nota_final: ficha.nota_final,
        parecer: ficha.parecer,
      }
    : avaliacao;
  const [copiado, setCopiado] = useState("");
  return (
    <aside
      className="avd-ficha-lateral"
      aria-label="Nota e parecer"
      data-tour="avd-ficha-lateral"
    >
      <div className="ui-card avd-ficha-total">
        <Selo tom={tomDoResultado(gravado.resultado)}>
          {textoDoResultado(gravado.resultado)}
        </Selo>
        <strong className="avd-ficha-nota-total">
          {textoDaNota(gravado.nota_final)}
        </strong>
        <span>
          {avaliacao.nota_minima !== null
            ? `mínima ${textoDaNota(avaliacao.nota_minima)}`
            : ""}
          {art !== null && art !== undefined
            ? ` · ART ${textoDaNota(art)}`
            : ""}
        </span>
      </div>
      <div
        className="avd-ficha-comparacao"
        role="table"
        aria-label="Declarado × apurado"
        data-tour="avd-ficha-comparacao"
      >
        <div className="avd-ficha-linha avd-ficha-linha-topo" role="row">
          <span role="columnheader">Bloco</span>
          <span role="columnheader">Declarado</span>
          <span role="columnheader">Apurado</span>
        </div>
        {pontuam.map((b) => {
          const p = PARCIAL_DO_TIPO[b.tipo];
          const div = divergenciaDoBloco(b, avaliacao, declarada);
          const l = lancamento.blocos?.[b.codigo] || {};
          const justificativas = opcoesDeJustificativa(regra, b)
            .filter((o) => (l.justificativas || []).includes(o.codigo))
            .map((o) => o.texto);
          if (l.justificativa_livre?.trim())
            justificativas.push(l.justificativa_livre.trim());
          return (
            <div
              key={b.codigo}
              className="avd-ficha-linha"
              role="row"
              data-divergente={div ? "sim" : undefined}
            >
              <span role="rowheader">
                {rotuloDe(PARCIAIS, p)}
                {div && justificativas.length ? (
                  <small>{justificativas.join("; ")}</small>
                ) : null}
              </span>
              <span role="cell">
                {declarada?.parciais?.[p] === undefined
                  ? "—"
                  : textoDaNota(declarada.parciais[p])}
              </span>
              <span role="cell">
                {textoDaNota(avaliacao.parciais?.[p] ?? 0)}
              </span>
            </div>
          );
        })}
      </div>
      <Campo rotulo="Nível da vaga">
        <select
          value={lancamento.nivel}
          disabled={desabilitado}
          onChange={(ev) =>
            mudar((l) => {
              l.nivel = ev.target.value;
              return l;
            })
          }
        >
          {NIVEIS.map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </select>
      </Campo>
      <div className="avd-ficha-empregare" data-tour="avd-ficha-empregare">
        <button
          type="button"
          className="btn secondary small"
          onClick={async () => {
            const ok = await copiar(String(ficha.codigo ?? ""));
            setCopiado(ok ? "Código copiado" : "Não foi possível copiar");
            void loja.registrarAcesso("COPIAR_CODIGO");
          }}
        >
          <i className="fa-regular fa-copy" aria-hidden="true" /> Copiar código{" "}
          {ficha.codigo}
        </button>
        {urlDoCandidato ? (
          <a
            className="btn secondary small"
            href={urlDoCandidato}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void loja.registrarAcesso("ABRIR_EMPREGARE")}
          >
            <i
              className="fa-solid fa-arrow-up-right-from-square"
              aria-hidden="true"
            />{" "}
            Abrir candidato na Empregare
          </a>
        ) : urlDaVaga ? (
          <a
            className="btn secondary small"
            href={urlDaVaga}
            target="_blank"
            rel="noopener noreferrer"
            onClick={async () => {
              // Nas candidaturas da vaga, busca-se o candidato; na lista de vagas, a vaga.
              const texto = String(
                (vagaDireta ? ficha.codigo : ficha.vaga) ?? "",
              );
              const ok = await copiar(texto);
              setCopiado(
                !ok
                  ? "Não foi possível copiar"
                  : vagaDireta
                    ? `Código ${texto} copiado: cole na busca das candidaturas`
                    : `Código da vaga ${texto} copiado: cole na busca de Vagas Anunciadas`,
              );
              void loja.registrarAcesso("ABRIR_EMPREGARE");
            }}
          >
            <i
              className="fa-solid fa-arrow-up-right-from-square"
              aria-hidden="true"
            />{" "}
            {vagaDireta
              ? "Abrir vaga na Empregare"
              : "Abrir vagas na Empregare"}
          </a>
        ) : null}
        {copiado ? <small role="status">{copiado}</small> : null}
      </div>
      {(regra.observacoes_prontas || []).length ? (
        <Caixas
          rotulo="Observações prontas"
          opcoes={regra.observacoes_prontas.map((o) => ({
            codigo: o.codigo,
            texto: o.rotulo || o.texto,
          }))}
          marcados={lancamento.observacoes_prontas || []}
          desabilitado={desabilitado}
          aoMudar={(observacoes_prontas) =>
            mudar((l) => {
              l.observacoes_prontas = observacoes_prontas;
              return l;
            })
          }
        />
      ) : null}
      <Campo rotulo="Observação">
        <textarea
          rows={3}
          maxLength={4000}
          value={lancamento.observacoes || ""}
          disabled={desabilitado}
          onChange={(ev) =>
            mudar((l) => {
              l.observacoes = ev.target.value;
              return l;
            })
          }
        />
      </Campo>
      <div className="avd-ficha-parecer" data-tour="avd-ficha-parecer">
        <div className="avd-inline">
          <strong>Parecer</strong>
          <button
            type="button"
            className="btn secondary small"
            onClick={async () =>
              setCopiado(
                (await copiar(gravado.parecer))
                  ? "Parecer copiado"
                  : "Não foi possível copiar",
              )
            }
          >
            Copiar parecer
          </button>
        </div>
        <pre>{gravado.parecer}</pre>
      </div>
    </aside>
  );
}

function Historico({ itens }) {
  if (!itens?.length) return null;
  return (
    <details
      className="ui-card avd-ficha-historico"
      data-tour="avd-ficha-historico"
    >
      <summary>Histórico ({itens.length})</summary>
      <ol>
        {itens.map((h) => (
          <li key={`${h.versao}-${h.acao}-${h.quando}`}>
            <span>
              {new Date(h.quando).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>{" "}
            <strong>{ACOES_DO_HISTORICO[h.acao] || h.acao}</strong>
            {h.por ? ` · ${h.por}` : ""}
            {h.motivo ? ` · ${h.motivo}` : ""}
            {(h.alteracao || []).length ? (
              <ul>
                {h.alteracao.map((a, i) => (
                  <li key={i}>{textoDaAlteracao(a)}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

function Reabrir({ loja }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  if (!aberto)
    return (
      <button
        type="button"
        className="btn secondary"
        data-tour="avd-ficha-reabrir"
        onClick={() => setAberto(true)}
      >
        Reabrir
      </button>
    );
  return (
    <div className="avd-inline">
      <Campo rotulo="Motivo para reabrir" obrigatorio erro={erro}>
        <input
          value={motivo}
          maxLength={2000}
          onChange={(ev) => setMotivo(ev.target.value)}
        />
      </Campo>
      <button
        type="button"
        className="btn small"
        disabled={motivo.trim().length < 10}
        onClick={async () => {
          const r = await loja.reabrir(motivo.trim());
          if (!r.ok) setErro(r.erro);
        }}
      >
        Reabrir
      </button>
    </div>
  );
}

function textoDoEstado(st) {
  if (st.salvando) return "Salvando…";
  if (st.sujo) return "Alteração não salva";
  return textoDoSalvo(st.salvoEm);
}

/**
 * O corpo da ficha aberta. `registrarAntesDeFechar(fn)` recebe a função que a
 * gaveta chama antes de fechar (salva o que falta e confirma se não der).
 */
export function ConteudoDaFicha({
  fila,
  aberta,
  filtroVaga,
  aoFechar,
  registrarAntesDeFechar,
  criarLoja = criarEstadoDaFicha,
}) {
  const [loja] = useState(() =>
    criarLoja({ rpc: fila.rpc, toast: fila.toast }),
  );
  const st = useSyncExternalStore(loja.assinar, loja.obter);
  const [ativo, setAtivo] = useState(0);
  const [erroDeConclusao, setErroDeConclusao] = useState("");
  const [tentouConcluir, setTentouConcluir] = useState(false);
  const raiz = useRef(null);
  const fichaId = aberta.ficha.id;

  useEffect(() => {
    void loja.carregar(fichaId);
  }, [loja, fichaId]);
  useEffect(() => () => loja.descartar(), [loja]);

  useEffect(() => {
    registrarAntesDeFechar?.(async () => {
      if (!loja.temAlteracaoPendente()) return true;
      if (await loja.salvar()) return true;
      return (
        globalThis.confirm?.(
          "Há alteração que não foi salva. Fechar mesmo assim?",
        ) ?? true
      );
    });
    return () => registrarAntesDeFechar?.(null);
  }, [loja, registrarAntesDeFechar]);

  useEffect(() => {
    const avisar = (ev) => {
      if (!loja.temAlteracaoPendente()) return;
      ev.preventDefault();
      ev.returnValue = "";
    };
    globalThis.addEventListener?.("beforeunload", avisar);
    return () => globalThis.removeEventListener?.("beforeunload", avisar);
  }, [loja]);

  const regra = st.dados?.regra?.configuracao;
  const blocos = useMemo(() => regra?.blocos || [], [regra]);
  const comSituacao = useMemo(
    () =>
      blocos
        .map((b, i) => [b, i])
        .filter(
          ([b]) =>
            b.tipo !== "REGISTRO" &&
            st.lancamento &&
            blocoSeAplica(b, st.lancamento),
        ),
    [blocos, st.lancamento],
  );

  if (st.erro)
    return (
      <Aviso tom="danger" papel="alert">
        Não foi possível abrir o conteúdo da ficha: {st.erro}
      </Aviso>
    );
  if (!st.dados || !st.lancamento)
    return (
      <div className="ui-card" aria-busy="true">
        <div className="ui-esqueleto-linha" />
        <div className="ui-esqueleto-linha" />
      </div>
    );

  const ficha = { ...aberta.ficha, ...st.dados.ficha };
  const desabilitado = !st.podeEditar;
  const concluida = st.dados.ficha.situacao === "CONCLUIDA";
  const mudar = loja.mudar;

  /* Vai ao bloco (teclas J/K e depois do Conforme): foco e rolagem acompanham. */
  function irPara(indice) {
    setAtivo(indice);
    const alvo = raiz.current?.querySelector(
      `[data-bloco="${blocos[indice]?.codigo}"]`,
    );
    alvo?.focus?.({ preventScroll: true });
    alvo?.scrollIntoView?.({ block: "nearest" });
  }

  async function concluirEProxima() {
    setErroDeConclusao("");
    setTentouConcluir(true);
    const r = await loja.concluir();
    if (r.ok) {
      await fila.pegarProxima(filtroVaga || "");
      return;
    }
    if (r.pendencias?.length) {
      setErroDeConclusao(
        `Falta: ${r.pendencias.length} item(ns) marcado(s) nos blocos.`,
      );
      const primeiro = blocos.findIndex(
        (b) => b.codigo === r.pendencias[0].bloco,
      );
      if (primeiro >= 0) {
        setAtivo(primeiro);
        raiz.current
          ?.querySelector(`[data-bloco="${blocos[primeiro].codigo}"]`)
          ?.scrollIntoView?.({ block: "center" });
      }
    } else setErroDeConclusao(r.erro || "Não foi possível concluir.");
  }

  function aoTeclar(ev) {
    const ctrl = ev.ctrlKey || ev.metaKey;
    if (ctrl && ev.key.toLowerCase() === "s") {
      ev.preventDefault();
      void loja.salvar();
      return;
    }
    if (ctrl && ev.key === "Enter") {
      ev.preventDefault();
      void concluirEProxima();
      return;
    }
    if (ctrl || ev.altKey || ehCampoDeTexto(ev.target) || desabilitado) return;
    const k = ev.key.toLowerCase();
    if (k === "j" || k === "k") {
      ev.preventDefault();
      const pos = comSituacao.findIndex(([, i]) => i === ativo);
      const prox =
        comSituacao[
          Math.min(
            comSituacao.length - 1,
            Math.max(0, pos + (k === "j" ? 1 : -1)),
          )
        ];
      if (prox) irPara(prox[1]);
      return;
    }
    const situacao = situacaoDaTecla(ev.key);
    const bloco = blocos[ativo];
    if (!situacao || !bloco || !comSituacao.some(([, i]) => i === ativo))
      return;
    ev.preventDefault();
    mudar((l) => {
      const atual = l.blocos?.[bloco.codigo] || {};
      l.blocos = {
        ...l.blocos,
        [bloco.codigo]: {
          ...atual,
          situacao,
          motivos: situacao === "CONFORME" ? [] : atual.motivos || [],
        },
      };
      return l;
    });
    // Conforme passa ao próximo bloco; Não conforme e Não enviado ficam para o motivo.
    if (situacao === "CONFORME") {
      const pos = comSituacao.findIndex(([, i]) => i === ativo);
      const prox = comSituacao[pos + 1];
      if (prox) irPara(prox[1]);
    }
  }

  return (
    <div
      className="avd-ficha"
      ref={raiz}
      onKeyDown={aoTeclar}
      data-tour="avd-ficha-conteudo"
    >
      {st.aviso ? (
        <Aviso tom="warning" papel="alert">
          {st.aviso}
        </Aviso>
      ) : null}
      {st.dados.regra.versao !== st.dados.regra.vigente ? (
        <Aviso>
          Analisada pela regra v{st.dados.regra.versao}; a vigente é a v
          {st.dados.regra.vigente}.
        </Aviso>
      ) : st.dados.regra.situacao !== "CONFERIDA" && !concluida ? (
        <Aviso tom="warning">
          A regra v{st.dados.regra.versao} ainda não foi conferida: dá para
          salvar o rascunho, não para concluir.
        </Aviso>
      ) : null}
      <div className="avd-ficha-grade">
        <div className="avd-ficha-blocos" data-tour="avd-ficha-blocos">
          {blocos.map((b, i) => (
            <CartaoDoBloco
              key={b.codigo}
              st={st}
              bloco={b}
              ativo={i === ativo && !desabilitado}
              aoFocar={() => setAtivo(i)}
              mudar={mudar}
              desabilitado={desabilitado}
              mostrarTodas={tentouConcluir}
            />
          ))}
          <Historico itens={st.dados.historico} />
        </div>
        <Lateral
          st={st}
          loja={loja}
          ficha={ficha}
          mudar={mudar}
          desabilitado={desabilitado}
        />
      </div>
      <div
        className="ui-gaveta-rodape avd-ficha-barra"
        data-tour="avd-ficha-barra"
      >
        <span className="avd-ficha-salvo" role="status">
          {concluida
            ? `Concluída${st.dados.ficha.concluida_por ? ` por ${st.dados.ficha.concluida_por}` : ""}`
            : textoDoEstado(st)}
        </span>
        {erroDeConclusao ? (
          <span className="avd-ficha-erro" role="alert">
            {erroDeConclusao}
          </span>
        ) : null}
        {st.dados.pode_reabrir ? <Reabrir loja={loja} /> : null}
        {st.podeEditar ? (
          <>
            <button
              type="button"
              className="btn secondary"
              disabled={st.salvando || !st.sujo}
              onClick={() => void loja.salvar()}
            >
              Salvar rascunho
            </button>
            <button
              type="button"
              className="btn"
              data-acao="concluir-e-proxima"
              disabled={st.concluindo}
              title={
                st.pendencias.length
                  ? `Falta: ${st.pendencias.length}`
                  : undefined
              }
              onClick={() => void concluirEProxima()}
            >
              Concluir e próxima
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="btn secondary"
          data-acao="fechar-ficha"
          onClick={() => void aoFechar()}
        >
          {aberta.reservada && !concluida ? "Fechar e liberar" : "Fechar"}
        </button>
      </div>
    </div>
  );
}
