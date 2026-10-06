import { useState } from "react";
import {
  EFEITOS,
  NIVEIS,
  rotuloDe,
  SITUACOES_DO_BLOCO,
  TIPOS_DE_BLOCO,
  TITULOS_ACADEMICOS,
} from "../../lib/avaliacao-documental/catalogo.js";
import {
  blocoNovo,
  codigoLivre,
} from "../../lib/avaliacao-documental/regra.js";
import { Campo } from "../../ui/index.js";
import {
  BotaoMais,
  BotaoTirar,
  Caixa,
  CampoLista,
  CampoNumero,
  CampoTexto,
  comValor,
  Escolha,
} from "./campos.jsx";

/*
  Os blocos da ficha na regra: um cartão por documento ou pergunta, com o item
  do edital, as perguntas da Empregare (pelo começo do enunciado), a condição,
  o efeito de cada situação, os motivos padronizados e os campos do tipo
  (pontos étnicos, títulos por nível, faixas de cursos, vínculos).
*/

const SITUACOES_COM_EFEITO = SITUACOES_DO_BLOCO.filter(
  ([s]) => s !== "NAO_SE_APLICA",
);

function Motivos({ bloco, aoMudar }) {
  const motivos = bloco.motivos ?? [];
  const mudar = (i, chave, valor) =>
    aoMudar(motivos.map((m, j) => (j === i ? { ...m, [chave]: valor } : m)));
  return (
    <div className="avd-subgrupo">
      <h4>Motivos padronizados</h4>
      {motivos.map((m, i) => (
        <div className="avd-linha" key={i} data-motivo={m.codigo}>
          <CampoTexto
            rotulo="Código"
            valor={m.codigo}
            maximo={30}
            aoMudar={(v) => mudar(i, "codigo", v.toUpperCase())}
          />
          <CampoTexto
            rotulo="Texto no parecer"
            valor={m.texto}
            maximo={1000}
            largo
            aoMudar={(v) => mudar(i, "texto", v)}
          />
          <CampoTexto
            rotulo="Item do edital"
            valor={m.item_edital}
            maximo={40}
            aoMudar={(v) => mudar(i, "item_edital", v)}
          />
          <Escolha
            rotulo="Efeito"
            valor={m.efeito}
            opcoes={EFEITOS}
            vazio="O da situação"
            aoMudar={(v) => mudar(i, "efeito", v ?? undefined)}
          />
          <BotaoTirar
            rotulo="Tirar o motivo"
            aoClicar={() => aoMudar(motivos.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <BotaoMais
        aoClicar={() =>
          aoMudar([
            ...motivos,
            {
              codigo: codigoLivre(motivos, "MOTIVO"),
              texto: "",
              item_edital: "",
            },
          ])
        }
      >
        Motivo
      </BotaoMais>
    </div>
  );
}

function Faixas({ alvo, aoMudar, rotulo }) {
  const faixas = alvo?.faixas ?? [];
  const mudar = (i, chave, valor) =>
    aoMudar({
      ...alvo,
      faixas: faixas.map((f, j) => (j === i ? { ...f, [chave]: valor } : f)),
    });
  return (
    <div className="avd-subgrupo">
      <h4>{rotulo}</h4>
      <div className="ui-grade-de-campos">
        <CampoNumero
          rotulo="Teto"
          valor={alvo?.teto}
          aoMudar={(v) => aoMudar({ ...alvo, teto: v })}
        />
      </div>
      {faixas.map((f, i) => (
        <div className="avd-linha" key={i}>
          <CampoNumero
            rotulo="De (horas)"
            valor={f.min_horas}
            aoMudar={(v) => mudar(i, "min_horas", v)}
          />
          <CampoNumero
            rotulo="Até (horas)"
            valor={f.max_horas}
            aoMudar={(v) => mudar(i, "max_horas", v)}
          />
          <CampoNumero
            rotulo="Pontos por curso"
            valor={f.pontos}
            aoMudar={(v) => mudar(i, "pontos", v)}
          />
          <BotaoTirar
            rotulo="Tirar a faixa"
            aoClicar={() =>
              aoMudar({ ...alvo, faixas: faixas.filter((_, j) => j !== i) })
            }
          />
        </div>
      ))}
      <BotaoMais
        aoClicar={() =>
          aoMudar({
            ...alvo,
            faixas: [...faixas, { min_horas: 0, max_horas: null, pontos: 0 }],
          })
        }
      >
        Faixa
      </BotaoMais>
    </div>
  );
}

/* Níveis que trocam os valores do bloco (por_nivel). */
function PorNivel({ bloco, aoMudar, novo, desenhar }) {
  const porNivel = bloco.por_nivel ?? {};
  const livres = NIVEIS.filter(([n]) => !porNivel[n]);
  return (
    <div className="avd-subgrupo">
      {Object.entries(porNivel).map(([nivel, valor]) => (
        <div key={nivel} className="avd-por-nivel" data-nivel={nivel}>
          {desenhar(nivel, valor, (v) =>
            aoMudar({ ...bloco, por_nivel: { ...porNivel, [nivel]: v } }),
          )}
          <button
            type="button"
            className="btn secondary small"
            onClick={() => {
              const resto = { ...porNivel };
              delete resto[nivel];
              aoMudar({
                ...bloco,
                por_nivel: Object.keys(resto).length ? resto : undefined,
              });
            }}
          >
            Usar os valores gerais no nível {rotuloDe(NIVEIS, nivel)}
          </button>
        </div>
      ))}
      {livres.length ? (
        <label className="avd-inline">
          Valores próprios para o nível{" "}
          <select
            value=""
            onChange={(ev) =>
              ev.target.value &&
              aoMudar({
                ...bloco,
                por_nivel: { ...porNivel, [ev.target.value]: novo() },
              })
            }
          >
            <option value="">…</option>
            {livres.map(([n, r]) => (
              <option key={n} value={n}>
                {r}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

function CamposDoTipo({ bloco, aoMudar }) {
  const mudar = (chave, valor) => aoMudar({ ...bloco, [chave]: valor });
  if (bloco.tipo === "PONTUACAO")
    return (
      <div className="ui-grade-de-campos">
        <CampoNumero
          rotulo="Pontos de indígena"
          valor={bloco.indigena}
          aoMudar={(v) => mudar("indigena", v)}
        />
        <CampoNumero
          rotulo="Pontos de aldeia"
          valor={bloco.aldeia}
          aoMudar={(v) => mudar("aldeia", v)}
        />
        <CampoNumero
          rotulo="Teto"
          valor={bloco.teto}
          aoMudar={(v) => mudar("teto", v)}
        />
        <Escolha
          rotulo="Aldeia validada"
          valor={bloco.lista_aldeias}
          opcoes={[["DSEI_DO_EDITAL", "Pela lista do DSEI do edital"]]}
          vazio="Sem lista"
          aoMudar={(v) => mudar("lista_aldeias", v)}
        />
      </div>
    );
  if (bloco.tipo === "TITULOS") {
    const tabela = bloco.pontos_por_nivel ?? {};
    return (
      <div className="avd-subgrupo">
        <Caixa
          rotulo="Títulos somam (cumulativa)"
          marcado={bloco.cumulativa}
          aoMudar={(v) => mudar("cumulativa", v)}
        />
        <div className="ui-grade-de-campos">
          <CampoNumero
            rotulo="Teto"
            valor={bloco.teto}
            aoMudar={(v) => mudar("teto", v)}
          />
        </div>
        <table className="avd-tabela">
          <caption>Pontos por título, pelo nível da vaga</caption>
          <thead>
            <tr>
              <th scope="col">Título</th>
              {NIVEIS.map(([n, r]) => (
                <th key={n} scope="col">
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TITULOS_ACADEMICOS.map(([t, rotulo]) => (
              <tr key={t}>
                <th scope="row">{rotulo}</th>
                {NIVEIS.map(([n, rotuloNivel]) => {
                  const atual = (tabela[n] ?? []).find((x) => x.titulo === t);
                  return (
                    <td key={n}>
                      <input
                        inputMode="decimal"
                        aria-label={`${rotulo} no nível ${rotuloNivel}`}
                        value={
                          atual ? String(atual.pontos).replace(".", ",") : ""
                        }
                        placeholder="—"
                        onChange={(ev) => {
                          const texto = ev.target.value
                            .trim()
                            .replace(",", ".");
                          const resto = (tabela[n] ?? []).filter(
                            (x) => x.titulo !== t,
                          );
                          const n2 = Number(texto);
                          const lista =
                            texto === ""
                              ? resto
                              : [
                                  ...resto,
                                  {
                                    titulo: t,
                                    pontos: Number.isFinite(n2) ? n2 : texto,
                                  },
                                ];
                          const nova = { ...tabela };
                          if (lista.length) nova[n] = lista;
                          else delete nova[n];
                          mudar("pontos_por_nivel", nova);
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (bloco.tipo === "CURSOS")
    return (
      <>
        <Faixas
          alvo={bloco}
          rotulo="Faixas de carga horária"
          aoMudar={(v) => aoMudar({ ...bloco, teto: v.teto, faixas: v.faixas })}
        />
        <PorNivel
          bloco={bloco}
          aoMudar={aoMudar}
          novo={() => ({
            teto: bloco.teto ?? null,
            faixas: structuredClone(bloco.faixas ?? []),
          })}
          desenhar={(nivel, valor, mudarNivel) => (
            <Faixas
              alvo={valor}
              rotulo={`Faixas no nível ${rotuloDe(NIVEIS, nivel)}`}
              aoMudar={mudarNivel}
            />
          )}
        />
      </>
    );
  if (bloco.tipo === "VINCULOS") {
    const porPeriodo = (bloco.pontuacao ?? "POR_MES") === "POR_PERIODO";
    const pontos = (valor, mudarAlvo) => (
      <div className="ui-grade-de-campos">
        {porPeriodo ? (
          <CampoNumero
            rotulo="Pontos por período"
            valor={valor.pontos_por_periodo}
            aoMudar={(v) => mudarAlvo({ ...valor, pontos_por_periodo: v })}
          />
        ) : (
          <CampoNumero
            rotulo="Pontos por mês"
            valor={valor.pontos_por_mes}
            aoMudar={(v) => mudarAlvo({ ...valor, pontos_por_mes: v })}
          />
        )}
        <CampoNumero
          rotulo="Teto"
          valor={valor.teto}
          aoMudar={(v) => mudarAlvo({ ...valor, teto: v })}
        />
      </div>
    );
    const categorias = bloco.categorias ?? [];
    const estagio = bloco.estagio_indigena ?? {};
    return (
      <div className="avd-subgrupo">
        <h4>Categorias</h4>
        {categorias.map((c, i) => (
          <div className="avd-linha" key={i}>
            <CampoTexto
              rotulo="Código"
              valor={c.codigo}
              maximo={30}
              aoMudar={(v) =>
                mudar(
                  "categorias",
                  comValor(categorias, [i, "codigo"], v.toUpperCase()),
                )
              }
            />
            <CampoTexto
              rotulo="Rótulo"
              valor={c.rotulo}
              maximo={100}
              aoMudar={(v) =>
                mudar("categorias", comValor(categorias, [i, "rotulo"], v))
              }
            />
            <Escolha
              rotulo="Desempate"
              valor={
                c.desempate === null || c.desempate === undefined
                  ? ""
                  : String(c.desempate)
              }
              opcoes={[1, 2, 3, 4, 5].map((n) => [String(n), `${n}º`])}
              vazio="Não desempata"
              aoMudar={(v) =>
                mudar(
                  "categorias",
                  comValor(categorias, [i, "desempate"], v ? Number(v) : null),
                )
              }
            />
            <Caixa
              rotulo="Pontua"
              marcado={c.pontua !== false}
              aoMudar={(v) =>
                mudar("categorias", comValor(categorias, [i, "pontua"], v))
              }
            />
            <BotaoTirar
              rotulo="Tirar a categoria"
              aoClicar={() =>
                mudar(
                  "categorias",
                  categorias.filter((_, j) => j !== i),
                )
              }
            />
          </div>
        ))}
        <BotaoMais
          aoClicar={() =>
            mudar("categorias", [
              ...categorias,
              {
                codigo: codigoLivre(categorias, "CATEGORIA"),
                rotulo: "",
                desempate: null,
                pontua: true,
              },
            ])
          }
        >
          Categoria
        </BotaoMais>
        <h4>Tempo e pontos</h4>
        <div className="ui-grade-de-campos">
          <CampoNumero
            rotulo="Mínimo exigido (meses)"
            valor={bloco.minimo_meses}
            aoMudar={(v) => mudar("minimo_meses", v)}
          />
          <Escolha
            rotulo="Abaixo do mínimo"
            valor={bloco.efeito_minimo ?? "ELIMINA"}
            opcoes={[
              ["ELIMINA", "Elimina"],
              ["SO_REGISTRO", "Só registra"],
            ]}
            aoMudar={(v) => mudar("efeito_minimo", v)}
          />
          <CampoTexto
            rotulo="Item do mínimo"
            valor={bloco.item_minimo}
            maximo={40}
            aoMudar={(v) => mudar("item_minimo", v)}
          />
          <Escolha
            rotulo="Pontuação"
            valor={bloco.pontuacao ?? "POR_MES"}
            opcoes={[
              ["POR_MES", "Por mês completo"],
              ["POR_PERIODO", "Por período completo"],
            ]}
            aoMudar={(v) => mudar("pontuacao", v)}
          />
          {porPeriodo ? (
            <CampoNumero
              rotulo="Período (meses)"
              valor={bloco.periodo_meses}
              aoMudar={(v) => mudar("periodo_meses", v)}
            />
          ) : null}
          <CampoNumero
            rotulo="Dias por mês"
            valor={bloco.dias_por_mes}
            aoMudar={(v) => mudar("dias_por_mes", v)}
          />
          <CampoNumero
            rotulo="Máximo de vínculos"
            valor={bloco.max_vinculos}
            aoMudar={(v) => mudar("max_vinculos", v)}
          />
          <Campo rotulo="Conta até (data)">
            <input
              type="date"
              value={bloco.data_limite ?? ""}
              onChange={(ev) => mudar("data_limite", ev.target.value || null)}
            />
          </Campo>
        </div>
        <div className="avd-caixas">
          <Caixa
            rotulo="Une as sobreposições"
            marcado={bloco.unir_sobreposicao !== false}
            aoMudar={(v) => mudar("unir_sobreposicao", v)}
          />
          <Caixa
            rotulo="O mínimo exigido não pontua"
            marcado={bloco.desconta_minimo}
            aoMudar={(v) => mudar("desconta_minimo", v)}
          />
          <Caixa
            rotulo="Estágio conta para o mínimo"
            marcado={bloco.minimo_conta_estagio}
            aoMudar={(v) => mudar("minimo_conta_estagio", v)}
          />
        </div>
        {pontos(bloco, (v) => aoMudar(v))}
        <PorNivel
          bloco={bloco}
          aoMudar={aoMudar}
          novo={() => ({
            pontos_por_mes: bloco.pontos_por_mes ?? 0,
            pontos_por_periodo: bloco.pontos_por_periodo ?? 0,
            teto: bloco.teto ?? null,
          })}
          desenhar={(nivel, valor, mudarNivel) => (
            <>
              <h4>Pontos no nível {rotuloDe(NIVEIS, nivel)}</h4>
              {pontos(valor, mudarNivel)}
            </>
          )}
        />
        <h4>Estágio de indígena</h4>
        <div className="avd-caixas">
          <Caixa
            rotulo="Conta o estágio"
            marcado={estagio.ativo}
            aoMudar={(v) => mudar("estagio_indigena", { ...estagio, ativo: v })}
          />
          <Caixa
            rotulo="Só sem experiência"
            marcado={estagio.so_sem_experiencia !== false}
            aoMudar={(v) =>
              mudar("estagio_indigena", { ...estagio, so_sem_experiencia: v })
            }
          />
        </div>
        {estagio.ativo ? (
          <div className="ui-grade-de-campos">
            <CampoNumero
              rotulo="Horas por dia"
              valor={estagio.horas_por_dia}
              aoMudar={(v) =>
                mudar("estagio_indigena", { ...estagio, horas_por_dia: v })
              }
            />
            <CampoNumero
              rotulo="Dias por mês"
              valor={estagio.dias_por_mes}
              aoMudar={(v) =>
                mudar("estagio_indigena", { ...estagio, dias_por_mes: v })
              }
            />
          </div>
        ) : null}
      </div>
    );
  }
  if (bloco.tipo === "REGISTRO")
    return (
      <div className="ui-grade-de-campos">
        <CampoLista
          rotulo="Alerta quando a resposta for"
          valor={bloco.alerta_quando}
          largo
          aoMudar={(v) => mudar("alerta_quando", v)}
        />
      </div>
    );
  return null;
}

function Bloco({ bloco, indice, total, aoMudar, aoMover, aoTirar }) {
  const mudar = (chave, valor) => aoMudar({ ...bloco, [chave]: valor });
  const efeitos = bloco.efeitos ?? {};
  return (
    <section
      className="ui-card avd-bloco"
      data-bloco={bloco.codigo}
      aria-label={`Bloco ${bloco.titulo || bloco.codigo}`}
    >
      <div className="avd-bloco-topo">
        <strong>
          {indice + 1}. {bloco.titulo || bloco.codigo}
        </strong>
        <span className="ui-texto-secundario">
          {rotuloDe(TIPOS_DE_BLOCO, bloco.tipo)}
        </span>
        <div className="ui-acoes">
          <button
            type="button"
            className="btn secondary small"
            aria-label="Subir o bloco"
            disabled={indice === 0}
            onClick={() => aoMover(-1)}
          >
            <i className="fa-solid fa-arrow-up" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn secondary small"
            aria-label="Descer o bloco"
            disabled={indice === total - 1}
            onClick={() => aoMover(1)}
          >
            <i className="fa-solid fa-arrow-down" aria-hidden="true" />
          </button>
          <BotaoTirar rotulo="Tirar o bloco" aoClicar={aoTirar} />
        </div>
      </div>
      <div className="ui-grade-de-campos">
        <CampoTexto
          rotulo="Código"
          valor={bloco.codigo}
          maximo={30}
          aoMudar={(v) => mudar("codigo", v.toUpperCase())}
        />
        <CampoTexto
          rotulo="Título"
          valor={bloco.titulo}
          largo
          aoMudar={(v) => mudar("titulo", v)}
        />
        <CampoTexto
          rotulo="Item do edital"
          valor={bloco.item_edital}
          maximo={40}
          aoMudar={(v) => mudar("item_edital", v)}
        />
        <CampoTexto
          rotulo="Condição"
          valor={bloco.condicao}
          maximo={30}
          aoMudar={(v) => mudar("condicao", v.trim() ? v.toUpperCase() : null)}
        />
        <CampoLista
          rotulo="Perguntas da Empregare (começo do enunciado)"
          valor={bloco.perguntas}
          largo
          aoMudar={(v) => mudar("perguntas", v)}
        />
      </div>
      <div className="ui-grade-de-campos">
        {SITUACOES_COM_EFEITO.map(([situacao, rotulo]) => (
          <Escolha
            key={situacao}
            rotulo={`Efeito: ${rotulo}`}
            valor={efeitos[situacao]}
            opcoes={EFEITOS}
            vazio={situacao === "CONFORME" ? "Nenhum" : "Só registro"}
            aoMudar={(v) => {
              const novos = { ...efeitos };
              if (v) novos[situacao] = v;
              else delete novos[situacao];
              mudar("efeitos", novos);
            }}
          />
        ))}
      </div>
      <CamposDoTipo bloco={bloco} aoMudar={aoMudar} />
      <Motivos bloco={bloco} aoMudar={(v) => mudar("motivos", v)} />
    </section>
  );
}

export function Blocos({ blocos, aoMudar }) {
  const [tipoNovo, setTipoNovo] = useState("DOCUMENTO");
  const mover = (i, passo) => {
    const nova = [...blocos];
    const [item] = nova.splice(i, 1);
    nova.splice(i + passo, 0, item);
    aoMudar(nova);
  };
  return (
    <div className="avd-blocos">
      {blocos.map((bloco, i) => (
        <Bloco
          key={`${i}:${bloco.tipo}`}
          bloco={bloco}
          indice={i}
          total={blocos.length}
          aoMudar={(v) => aoMudar(blocos.map((b, j) => (j === i ? v : b)))}
          aoMover={(passo) => mover(i, passo)}
          aoTirar={() => aoMudar(blocos.filter((_, j) => j !== i))}
        />
      ))}
      <div className="avd-inline">
        <select
          aria-label="Tipo do bloco novo"
          value={tipoNovo}
          onChange={(ev) => setTipoNovo(ev.target.value)}
        >
          {TIPOS_DE_BLOCO.map(([t, r]) => (
            <option key={t} value={t}>
              {r}
            </option>
          ))}
        </select>
        <BotaoMais
          aoClicar={() =>
            aoMudar([...blocos, blocoNovo(tipoNovo, codigoLivre(blocos))])
          }
        >
          Bloco
        </BotaoMais>
      </div>
    </div>
  );
}
