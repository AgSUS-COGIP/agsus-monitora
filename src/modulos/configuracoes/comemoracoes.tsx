import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  CATALOGO_DE_MARCOS,
  CHAVE_DAS_COMEMORACOES,
  comemoracoesPessoaisLigadas,
  duracaoMsDasOpcoes,
  errosDaConfiguracao,
  guardarPreferenciaPessoal,
  LIMITE_DE_PERSONALIZADOS,
  META_MAXIMA,
  mensagemDoPersonalizado,
  normalizarConfiguracao,
  normalizarDuracaoS,
  normalizarMeta,
  novoPersonalizado,
  PUBLICOS,
  PUBLICOS_DISPONIVEIS,
  serializarConfiguracao,
  TAMANHO_DA_MENSAGEM,
  TIPOS_PERSONALIZADOS,
  type ConfiguracaoDasComemoracoes,
  type Efeito,
  type FormaDoMarco,
  type Intensidade,
  type MarcoDoCatalogo,
  type MarcoPersonalizado,
  type OpcoesDoMarco,
  type Publico,
  type TipoPersonalizado,
} from "../../lib/catalogo-de-comemoracoes.ts";
import { EFEITOS, ROTULOS_DOS_EFEITOS } from "../../lib/motor-de-efeitos.js";
import { comemorar, semMovimento } from "../../modules/comemoracao.js";
import { Aviso, Campo, Segmentado } from "../../ui/index.js";
import { Icone } from "../../componentes/icone.jsx";
import {
  ICONES_DOS_EFEITOS,
  OPCOES_DE_INTENSIDADE,
  PalcoDeTestes,
  type PedidoDeTeste,
  type Testar,
} from "./palco-de-testes.tsx";

/*
  Configurações › Comemorações, compacta: o Palco de testes no topo; os
  marcos em linhas agrupadas por módulo (interruptor, nome, chip do efeito,
  intensidade, Testar e "Detalhes", que abre inline duração, mensagem, som e
  quem vê — um por vez); os marcos personalizados na mesma forma, criados
  por um mini-assistente. A preferência pessoal ("Para mim") é um
  interruptor na linha do título da seção (InterruptorPessoal, posto pela
  moldura em configuracoes.jsx).

  O valor vai para o rascunho de `estado.js` como o JSON da chave
  `comemoracoes_marcos` e só vale depois de "Salvar alterações" (motivo e
  histórico, como as outras seções). "Testar" e o palco nunca gravam: soltam
  a comemoração com `teste: true`. Regras em
  src/lib/catalogo-de-comemoracoes.ts; o desenho, em src/modules/comemoracao.js.
*/

interface EstadoDasConfiguracoes {
  assinar: (ouvinte: () => void) => () => void;
  obter: () => unknown;
  valor: (chave: string) => string;
  mudarCampo: (chave: string, valor: string) => void;
}

function testarPadrao(janela: Window | undefined) {
  return (pedido: PedidoDeTeste) => {
    comemorar({ ...pedido, teste: true, janela });
  };
}

function armazenamentoDa(janela: Window | undefined): Storage | null {
  try {
    return janela?.localStorage ?? null;
  } catch {
    return null;
  }
}

// ── Preferência pessoal (na linha do título) ───────────────────────────────

export function InterruptorPessoal({
  janela = globalThis.window,
}: {
  janela?: Window;
}) {
  const armazenamento = armazenamentoDa(janela);
  const [ligadas, setLigadas] = useState(() =>
    comemoracoesPessoaisLigadas(armazenamento),
  );
  return (
    <label className="comemoracoes-pessoal">
      <input
        id="comemoracoesParaMim"
        type="checkbox"
        role="switch"
        checked={ligadas}
        onChange={(evento) => {
          guardarPreferenciaPessoal(armazenamento, evento.target.checked);
          setLigadas(evento.target.checked);
        }}
      />
      Para mim
    </label>
  );
}

// ── Uma linha de marco ─────────────────────────────────────────────────────

function pedidoDoMarco(
  opcoes: OpcoesDoMarco,
  texto: string,
  forma: FormaDoMarco = null,
): PedidoDeTeste {
  return {
    texto: opcoes.mensagem || texto,
    efeito: opcoes.efeito,
    intensidade: opcoes.intensidade,
    duracaoMs: duracaoMsDasOpcoes(opcoes),
    som: opcoes.som,
    forma,
  };
}

function LinhaDoMarco({
  id,
  prefixo,
  nome,
  modulo,
  opcoes,
  mensagemPadrao,
  aberto,
  aoAlternar,
  aoMudar,
  aoTestar,
  extras = null,
}: {
  id: string;
  prefixo: string;
  nome: string;
  modulo: string;
  opcoes: OpcoesDoMarco;
  mensagemPadrao: string;
  aberto: boolean;
  aoAlternar: () => void;
  aoMudar: (mudancas: Partial<OpcoesDoMarco>) => void;
  aoTestar: () => void;
  extras?: ReactNode;
}) {
  const idDosDetalhes = `${prefixo}-detalhes`;
  return (
    <li
      className="comemoracoes-marco"
      data-marco={id}
      data-ligado={opcoes.ligado}
      data-aberto={aberto}
    >
      <div className="comemoracoes-marco__linha">
        <label className="comemoracoes-chave">
          <input
            id={`${prefixo}-ligado`}
            type="checkbox"
            role="switch"
            checked={opcoes.ligado}
            onChange={(evento) => aoMudar({ ligado: evento.target.checked })}
          />
          <span>
            <strong>{nome}</strong>
            {modulo ? <small>{modulo}</small> : null}
          </span>
        </label>
        <label className="comemoracoes-chip" title="Efeito">
          <Icone nome={ICONES_DOS_EFEITOS[opcoes.efeito]} tamanho={14} />
          <select
            id={`${prefixo}-efeito`}
            aria-label={`Efeito: ${nome}`}
            value={opcoes.efeito}
            disabled={!opcoes.ligado}
            onChange={(evento) =>
              aoMudar({ efeito: evento.target.value as Efeito })
            }
          >
            {(EFEITOS as Efeito[]).map((efeito) => (
              <option key={efeito} value={efeito}>
                {ROTULOS_DOS_EFEITOS[efeito]}
              </option>
            ))}
          </select>
        </label>
        <Segmentado
          rotulo={`Intensidade: ${nome}`}
          className="comemoracoes-intensidade"
          opcoes={OPCOES_DE_INTENSIDADE}
          valor={opcoes.intensidade}
          desabilitado={!opcoes.ligado}
          aoMudar={(intensidade: Intensidade) => aoMudar({ intensidade })}
        />
        <div className="comemoracoes-marco__acoes">
          <button
            type="button"
            className="btn secondary small comemoracoes-testar"
            aria-label={`Testar: ${nome}`}
            onClick={aoTestar}
          >
            <Icone nome="play" tamanho={14} />
            <span className="comemoracoes-testar__texto">Testar</span>
          </button>
          <button
            type="button"
            className="btn ghost comemoracoes-detalhes"
            aria-label={`Detalhes: ${nome}`}
            aria-expanded={aberto}
            aria-controls={idDosDetalhes}
            title="Detalhes"
            onClick={aoAlternar}
          >
            <Icone nome="ellipsis" tamanho={16} />
          </button>
        </div>
      </div>
      {aberto ? (
        <div
          id={idDosDetalhes}
          className="comemoracoes-marco__detalhes ui-grade-de-campos"
        >
          {extras}
          <Campo rotulo="Duração (s)">
            <input
              id={`${prefixo}-duracao`}
              type="number"
              min={2}
              max={15}
              step={0.5}
              placeholder="Automática"
              value={opcoes.duracaoS ?? ""}
              onChange={(evento) =>
                aoMudar({ duracaoS: normalizarDuracaoS(evento.target.value) })
              }
            />
          </Campo>
          <Campo rotulo="Quem vê">
            <select
              id={`${prefixo}-publico`}
              value={opcoes.publico}
              onChange={(evento) =>
                aoMudar({ publico: evento.target.value as Publico })
              }
            >
              {PUBLICOS.map(([valor, rotulo]) => (
                <option
                  key={valor}
                  value={valor}
                  disabled={!PUBLICOS_DISPONIVEIS.includes(valor)}
                >
                  {rotulo}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Mensagem" largo>
            <input
              id={`${prefixo}-mensagem`}
              type="text"
              maxLength={TAMANHO_DA_MENSAGEM}
              placeholder={mensagemPadrao}
              value={opcoes.mensagem}
              onChange={(evento) => aoMudar({ mensagem: evento.target.value })}
            />
          </Campo>
          <label className="comemoracoes-caixa">
            <input
              id={`${prefixo}-som`}
              type="checkbox"
              checked={opcoes.som}
              onChange={(evento) => aoMudar({ som: evento.target.checked })}
            />
            Som
          </label>
        </div>
      ) : null}
    </li>
  );
}

// ── Personalizados: campos próprios e o mini-assistente ────────────────────

function CamposDoPersonalizado({
  prefixo,
  marco,
  aoMudar,
  aoRemover,
}: {
  prefixo: string;
  marco: MarcoPersonalizado;
  aoMudar: (mudancas: Partial<MarcoPersonalizado>) => void;
  aoRemover: () => void;
}) {
  return (
    <>
      <Campo rotulo="Nome" obrigatorio>
        <input
          id={`${prefixo}-nome`}
          type="text"
          maxLength={80}
          value={marco.nome}
          onChange={(evento) => aoMudar({ nome: evento.target.value })}
        />
      </Campo>
      {marco.tipo === "edital-contratados" ? (
        <Campo rotulo="Edital" obrigatorio>
          <input
            id={`${prefixo}-edital`}
            type="text"
            maxLength={60}
            placeholder="Ex.: 012/2026"
            value={marco.edital}
            onChange={(evento) => aoMudar({ edital: evento.target.value })}
          />
        </Campo>
      ) : null}
      <Campo rotulo="Meta (N)" obrigatorio>
        <input
          id={`${prefixo}-meta`}
          type="number"
          min={1}
          max={META_MAXIMA}
          step={1}
          value={marco.meta || ""}
          onChange={(evento) =>
            aoMudar({ meta: normalizarMeta(evento.target.value) })
          }
        />
      </Campo>
      <div className="comemoracoes-remover">
        <button
          type="button"
          className="btn ghost perigo"
          aria-label={`Remover ${marco.nome || "marco personalizado"}`}
          onClick={aoRemover}
        >
          <Icone nome="trash-2" tamanho={14} /> Remover
        </button>
      </div>
    </>
  );
}

interface Rascunho {
  passo: 1 | 2;
  tipo: TipoPersonalizado;
  nome: string;
  edital: string;
  meta: number;
}

function Assistente({
  aoCriar,
  aoCancelar,
}: {
  aoCriar: (r: Rascunho) => void;
  aoCancelar: () => void;
}) {
  const [r, setR] = useState<Rascunho>({
    passo: 1,
    tipo: "edital-contratados",
    nome: "",
    edital: "",
    meta: 10,
  });
  const mudar = (m: Partial<Rascunho>) => setR((atual) => ({ ...atual, ...m }));
  const pronto =
    Boolean(r.nome.trim()) &&
    r.meta > 0 &&
    (r.tipo !== "edital-contratados" || Boolean(r.edital.trim()));
  return (
    <div
      className="comemoracoes-assistente"
      role="group"
      aria-label="Novo marco"
    >
      {r.passo === 1 ? (
        <>
          <strong className="comemoracoes-assistente__titulo">
            Comemorar quando…
          </strong>
          <div className="comemoracoes-assistente__tipos">
            {TIPOS_PERSONALIZADOS.map(([tipo, rotulo]) => (
              <button
                key={tipo}
                type="button"
                className="comemoracoes-efeito"
                data-tipo={tipo}
                onClick={() =>
                  mudar({
                    passo: 2,
                    tipo,
                    meta: tipo === "analises-no-dia" ? 50 : 10,
                    nome: tipo === "analises-no-dia" ? "Dia produtivo" : "",
                  })
                }
              >
                <Icone
                  nome={tipo === "analises-no-dia" ? "list-ordered" : "users"}
                  tamanho={22}
                />
                <span>{rotulo}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="ui-grade-de-campos">
          <Campo rotulo="Nome" obrigatorio>
            <input
              id="comemoracoesNovo-nome"
              type="text"
              maxLength={80}
              value={r.nome}
              onChange={(evento) => mudar({ nome: evento.target.value })}
            />
          </Campo>
          {r.tipo === "edital-contratados" ? (
            <Campo rotulo="Edital" obrigatorio>
              <input
                id="comemoracoesNovo-edital"
                type="text"
                maxLength={60}
                placeholder="Ex.: 012/2026"
                value={r.edital}
                onChange={(evento) => mudar({ edital: evento.target.value })}
              />
            </Campo>
          ) : null}
          <Campo
            rotulo={
              r.tipo === "edital-contratados"
                ? "Contratados (N)"
                : "Análises no dia (N)"
            }
            obrigatorio
          >
            <input
              id="comemoracoesNovo-meta"
              type="number"
              min={1}
              max={META_MAXIMA}
              value={r.meta || ""}
              onChange={(evento) =>
                mudar({ meta: normalizarMeta(evento.target.value) })
              }
            />
          </Campo>
        </div>
      )}
      <div className="ui-acoes">
        <button type="button" className="btn secondary" onClick={aoCancelar}>
          Cancelar
        </button>
        {r.passo === 2 ? (
          <button
            type="button"
            className="btn green comemoracoes-assistente__criar"
            disabled={!pronto}
            onClick={() => aoCriar(r)}
          >
            Criar marco
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Seção ──────────────────────────────────────────────────────────────────

/* O catálogo agrupado por módulo, na ordem em que aparece. */
const GRUPOS: readonly (readonly [string, MarcoDoCatalogo[]])[] = (() => {
  const mapa = new Map<string, MarcoDoCatalogo[]>();
  for (const m of CATALOGO_DE_MARCOS)
    mapa.set(m.grupo, [...(mapa.get(m.grupo) ?? []), m]);
  return [...mapa.entries()];
})();

export function SecaoComemoracoes({
  estado,
  testar,
  janela = globalThis.window,
  previa = true,
}: {
  estado: EstadoDasConfiguracoes;
  testar?: Testar;
  janela?: Window;
  previa?: boolean;
}) {
  useSyncExternalStore(estado.assinar, estado.obter);
  const config = normalizarConfiguracao(estado.valor(CHAVE_DAS_COMEMORACOES));
  const soltar = testar ?? testarPadrao(janela);
  const [aberto, setAberto] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const reduzido = semMovimento(janela);
  const erros = errosDaConfiguracao(config);
  const alternar = (id: string) =>
    setAberto((atual) => (atual === id ? null : id));

  const mudar = (nova: ConfiguracaoDasComemoracoes) =>
    estado.mudarCampo(CHAVE_DAS_COMEMORACOES, serializarConfiguracao(nova));

  const mudarMarco = (id: string, mudancas: Partial<OpcoesDoMarco>) => {
    const atual = config.marcos[id];
    if (!atual) return;
    mudar({
      ...config,
      marcos: { ...config.marcos, [id]: { ...atual, ...mudancas } },
    });
  };

  const mudarPersonalizado = (
    id: string,
    mudancas: Partial<MarcoPersonalizado>,
  ) =>
    mudar({
      ...config,
      personalizados: config.personalizados.map((p) =>
        p.id === id ? { ...p, ...mudancas } : p,
      ),
    });

  const criar = (r: Rascunho) => {
    const novo = {
      ...novoPersonalizado(config.personalizados, r.tipo),
      nome: r.nome.trim(),
      edital: r.tipo === "edital-contratados" ? r.edital.trim() : "",
      meta: r.meta,
    };
    mudar({ ...config, personalizados: [...config.personalizados, novo] });
    setCriando(false);
  };

  return (
    <div
      className="config-secao-react comemoracoes"
      data-tour="config-comemoracoes"
    >
      <div className="config-secao-react__campos comemoracoes__corpo">
        {reduzido ? (
          <Aviso tom="info" como="p">
            Movimento reduzido ligado neste aparelho: aqui as comemorações
            mostram só o aviso.
          </Aviso>
        ) : null}
        <PalcoDeTestes testar={soltar} previa={previa && !reduzido} />

        <section
          className="comemoracoes-bloco"
          aria-labelledby="comemoracoesMarcosTitulo"
        >
          <h3
            id="comemoracoesMarcosTitulo"
            className="comemoracoes-bloco__titulo"
          >
            Marcos
          </h3>
          {GRUPOS.map(([grupo, marcos]) => (
            <div className="comemoracoes-grupo" key={grupo}>
              <h4 className="comemoracoes-grupo__titulo">{grupo}</h4>
              <ul className="comemoracoes-lista">
                {marcos.map((m) => {
                  const opcoes = config.marcos[m.id] ?? m.padrao;
                  return (
                    <LinhaDoMarco
                      key={m.id}
                      id={m.id}
                      prefixo={`comemoracoesMarco-${m.id}`}
                      nome={m.rotulo}
                      modulo=""
                      opcoes={opcoes}
                      mensagemPadrao="A frase do marco"
                      aberto={aberto === m.id}
                      aoAlternar={() => alternar(m.id)}
                      aoMudar={(mudancas) => mudarMarco(m.id, mudancas)}
                      aoTestar={() =>
                        soltar(pedidoDoMarco(opcoes, m.rotulo, m.forma))
                      }
                    />
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        <section
          className="comemoracoes-bloco"
          aria-labelledby="comemoracoesPessoaisTitulo"
        >
          <h3
            id="comemoracoesPessoaisTitulo"
            className="comemoracoes-bloco__titulo"
          >
            Marcos personalizados
          </h3>
          {erros.length ? (
            <Aviso tom="warning" papel="alert">
              <ul>
                {erros.map((erro) => (
                  <li key={erro}>{erro}</li>
                ))}
              </ul>
            </Aviso>
          ) : null}
          {config.personalizados.length ? (
            <ul className="comemoracoes-lista">
              {config.personalizados.map((p, indice) => {
                const nome = p.nome || `Marco personalizado ${indice + 1}`;
                const prefixo = `comemoracoesPessoal-${p.id}`;
                return (
                  <LinhaDoMarco
                    key={p.id}
                    id={p.id}
                    prefixo={prefixo}
                    nome={nome}
                    modulo={
                      p.tipo === "edital-contratados"
                        ? `Edital ${p.edital || "?"} · ${p.meta || "?"} contratados`
                        : `${p.meta || "?"} análises no dia`
                    }
                    opcoes={p}
                    mensagemPadrao={mensagemDoPersonalizado(p)}
                    aberto={aberto === p.id}
                    aoAlternar={() => alternar(p.id)}
                    aoMudar={(mudancas) => mudarPersonalizado(p.id, mudancas)}
                    aoTestar={() =>
                      soltar(pedidoDoMarco(p, mensagemDoPersonalizado(p)))
                    }
                    extras={
                      <CamposDoPersonalizado
                        prefixo={prefixo}
                        marco={p}
                        aoMudar={(mudancas) =>
                          mudarPersonalizado(p.id, mudancas)
                        }
                        aoRemover={() =>
                          mudar({
                            ...config,
                            personalizados: config.personalizados.filter(
                              (outro) => outro.id !== p.id,
                            ),
                          })
                        }
                      />
                    }
                  />
                );
              })}
            </ul>
          ) : null}
          {criando ? (
            <Assistente aoCriar={criar} aoCancelar={() => setCriando(false)} />
          ) : (
            <div className="ui-acoes">
              <button
                type="button"
                className="btn secondary comemoracoes-adicionar"
                disabled={
                  config.personalizados.length >= LIMITE_DE_PERSONALIZADOS
                }
                onClick={() => setCriando(true)}
              >
                <Icone nome="plus" tamanho={16} /> Adicionar marco
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
