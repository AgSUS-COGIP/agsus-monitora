import { useState, useSyncExternalStore } from "react";
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
  type MarcoPersonalizado,
  type OpcoesDoMarco,
  type Publico,
  type TipoPersonalizado,
} from "../../lib/catalogo-de-comemoracoes.ts";
import {
  EFEITOS,
  ROTULOS_DOS_EFEITOS,
  ROTULOS_DOS_NIVEIS,
} from "../../lib/motor-de-efeitos.js";
import { comemorar, semMovimento } from "../../modules/comemoracao.js";
import { Aviso, Campo } from "../../ui/index.js";
import { Icone } from "../../componentes/icone.jsx";
import { Grupo } from "./partes.jsx";
import {
  PalcoDeTestes,
  type PedidoDeTeste,
  type Testar,
} from "./palco-de-testes.tsx";

/*
  Configurações › Comemorações: o catálogo de marcos (ligado, efeito,
  intensidade, duração, som, mensagem e quem vê), os marcos personalizados
  simples, o palco de testes e a preferência pessoal deste navegador.

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

const INTENSIDADES = Object.keys(ROTULOS_DOS_NIVEIS) as Intensidade[];

function testarPadrao(janela: Window | undefined) {
  return (pedido: PedidoDeTeste) => {
    comemorar({ ...pedido, teste: true, janela });
  };
}

// ── Peças ──────────────────────────────────────────────────────────────────

function Caixa({
  rotulo,
  marcado,
  aoMudar,
}: {
  rotulo: string;
  marcado: boolean;
  aoMudar: (marcado: boolean) => void;
}) {
  return (
    <label className="comemoracoes-caixa">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(evento) => aoMudar(evento.target.checked)}
      />
      {rotulo}
    </label>
  );
}

/** Os controles comuns a um marco do catálogo e a um personalizado. */
function OpcoesDoEfeito({
  id,
  opcoes,
  mensagemPadrao,
  aoMudar,
}: {
  id: string;
  opcoes: OpcoesDoMarco;
  mensagemPadrao: string;
  aoMudar: (mudancas: Partial<OpcoesDoMarco>) => void;
}) {
  return (
    <>
      <Campo rotulo="Efeito">
        <select
          id={`${id}-efeito`}
          value={opcoes.efeito}
          onChange={(evento) =>
            aoMudar({ efeito: evento.target.value as Efeito })
          }
        >
          {EFEITOS.map((nome) => (
            <option key={nome} value={nome}>
              {ROTULOS_DOS_EFEITOS[nome as Efeito]}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Intensidade">
        <select
          id={`${id}-intensidade`}
          value={opcoes.intensidade}
          onChange={(evento) =>
            aoMudar({ intensidade: evento.target.value as Intensidade })
          }
        >
          {INTENSIDADES.map((nome) => (
            <option key={nome} value={nome}>
              {ROTULOS_DOS_NIVEIS[nome]}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Duração (s)">
        <input
          id={`${id}-duracao`}
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
          id={`${id}-publico`}
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
          id={`${id}-mensagem`}
          type="text"
          maxLength={TAMANHO_DA_MENSAGEM}
          placeholder={mensagemPadrao}
          value={opcoes.mensagem}
          onChange={(evento) => aoMudar({ mensagem: evento.target.value })}
        />
      </Campo>
      <Caixa
        rotulo="Som"
        marcado={opcoes.som}
        aoMudar={(som) => aoMudar({ som })}
      />
    </>
  );
}

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

function BotaoTestar({
  rotulo,
  aoTestar,
}: {
  rotulo: string;
  aoTestar: () => void;
}) {
  return (
    <button
      type="button"
      className="btn secondary comemoracoes-testar"
      aria-label={`Testar: ${rotulo}`}
      onClick={aoTestar}
    >
      <Icone nome="play" tamanho={14} /> Testar
    </button>
  );
}

// ── Marcos do catálogo ─────────────────────────────────────────────────────

function MarcoDoCatalogoEditavel({
  id,
  rotulo,
  grupo,
  forma,
  opcoes,
  aoMudar,
  testar,
}: {
  id: string;
  rotulo: string;
  grupo: string;
  forma: FormaDoMarco;
  opcoes: OpcoesDoMarco;
  aoMudar: (mudancas: Partial<OpcoesDoMarco>) => void;
  testar: Testar;
}) {
  const prefixo = `comemoracoesMarco-${id}`;
  return (
    <li
      className="comemoracoes-marco"
      data-marco={id}
      data-ligado={opcoes.ligado}
    >
      <div className="comemoracoes-marco__topo">
        <label className="comemoracoes-chave">
          <input
            id={`${prefixo}-ligado`}
            type="checkbox"
            role="switch"
            checked={opcoes.ligado}
            onChange={(evento) => aoMudar({ ligado: evento.target.checked })}
          />
          <span>
            <strong>{rotulo}</strong>
            <small>{grupo}</small>
          </span>
        </label>
        <BotaoTestar
          rotulo={rotulo}
          aoTestar={() => testar(pedidoDoMarco(opcoes, rotulo, forma))}
        />
      </div>
      {opcoes.ligado ? (
        <div className="comemoracoes-marco__campos ui-grade-de-campos">
          <OpcoesDoEfeito
            id={prefixo}
            opcoes={opcoes}
            mensagemPadrao="A frase do marco"
            aoMudar={aoMudar}
          />
        </div>
      ) : null}
    </li>
  );
}

// ── Marcos personalizados ──────────────────────────────────────────────────

function MarcoPersonalizadoEditavel({
  marco,
  indice,
  aoMudar,
  aoRemover,
  testar,
}: {
  marco: MarcoPersonalizado;
  indice: number;
  aoMudar: (mudancas: Partial<MarcoPersonalizado>) => void;
  aoRemover: () => void;
  testar: Testar;
}) {
  const prefixo = `comemoracoesPessoal-${marco.id}`;
  const nome = marco.nome || `Marco personalizado ${indice + 1}`;
  return (
    <li
      className="comemoracoes-marco"
      data-marco={marco.id}
      data-ligado={marco.ligado}
    >
      <div className="comemoracoes-marco__topo">
        <label className="comemoracoes-chave">
          <input
            id={`${prefixo}-ligado`}
            type="checkbox"
            role="switch"
            checked={marco.ligado}
            onChange={(evento) => aoMudar({ ligado: evento.target.checked })}
          />
          <span>
            <strong>{nome}</strong>
            <small>Personalizado</small>
          </span>
        </label>
        <div className="comemoracoes-marco__acoes">
          <BotaoTestar
            rotulo={nome}
            aoTestar={() =>
              testar(pedidoDoMarco(marco, mensagemDoPersonalizado(marco)))
            }
          />
          <button
            type="button"
            className="btn ghost perigo"
            aria-label={`Remover ${nome}`}
            onClick={aoRemover}
          >
            <Icone nome="trash-2" tamanho={14} />
          </button>
        </div>
      </div>
      <div className="comemoracoes-marco__campos ui-grade-de-campos">
        <Campo rotulo="Nome" obrigatorio>
          <input
            id={`${prefixo}-nome`}
            type="text"
            maxLength={80}
            value={marco.nome}
            onChange={(evento) => aoMudar({ nome: evento.target.value })}
          />
        </Campo>
        <Campo rotulo="Quando">
          <select
            id={`${prefixo}-tipo`}
            value={marco.tipo}
            onChange={(evento) =>
              aoMudar({ tipo: evento.target.value as TipoPersonalizado })
            }
          >
            {TIPOS_PERSONALIZADOS.map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
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
        {marco.ligado ? (
          <OpcoesDoEfeito
            id={prefixo}
            opcoes={marco}
            mensagemPadrao={mensagemDoPersonalizado(marco)}
            aoMudar={aoMudar}
          />
        ) : null}
      </div>
    </li>
  );
}

// ── Seção ──────────────────────────────────────────────────────────────────

function armazenamentoDa(janela: Window | undefined): Storage | null {
  try {
    return janela?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function SecaoComemoracoes({
  estado,
  testar,
  janela = globalThis.window,
}: {
  estado: EstadoDasConfiguracoes;
  testar?: Testar;
  janela?: Window;
}) {
  useSyncExternalStore(estado.assinar, estado.obter);
  const config = normalizarConfiguracao(estado.valor(CHAVE_DAS_COMEMORACOES));
  const soltar = testar ?? testarPadrao(janela);
  const armazenamento = armazenamentoDa(janela);
  const [pessoal, setPessoal] = useState(() =>
    comemoracoesPessoaisLigadas(armazenamento),
  );
  const reduzido = semMovimento(janela);
  const erros = errosDaConfiguracao(config);

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

  return (
    <div
      className="config-secao-react comemoracoes"
      data-tour="config-comemoracoes"
    >
      <div className="config-secao-react__campos">
        {reduzido ? (
          <Aviso tom="info" como="p">
            Movimento reduzido ligado neste aparelho: aqui as comemorações
            mostram só o aviso.
          </Aviso>
        ) : null}
        <Grupo
          secao="comemoracoes"
          id="marcos"
          titulo="Marcos"
          icone="party-popper"
          tom="azul"
        >
          <ul className="comemoracoes-lista ui-campo-largo">
            {CATALOGO_DE_MARCOS.map((m) => (
              <MarcoDoCatalogoEditavel
                key={m.id}
                id={m.id}
                rotulo={m.rotulo}
                grupo={m.grupo}
                forma={m.forma}
                opcoes={config.marcos[m.id] ?? m.padrao}
                aoMudar={(mudancas) => mudarMarco(m.id, mudancas)}
                testar={soltar}
              />
            ))}
          </ul>
        </Grupo>
        <Grupo
          secao="comemoracoes"
          id="personalizados"
          titulo="Marcos personalizados"
          icone="plus"
          tom="petroleo"
        >
          {erros.length ? (
            <Aviso tom="warning" papel="alert" className="ui-campo-largo">
              <ul>
                {erros.map((erro) => (
                  <li key={erro}>{erro}</li>
                ))}
              </ul>
            </Aviso>
          ) : null}
          {config.personalizados.length ? (
            <ul className="comemoracoes-lista ui-campo-largo">
              {config.personalizados.map((p, indice) => (
                <MarcoPersonalizadoEditavel
                  key={p.id}
                  marco={p}
                  indice={indice}
                  aoMudar={(mudancas) => mudarPersonalizado(p.id, mudancas)}
                  aoRemover={() =>
                    mudar({
                      ...config,
                      personalizados: config.personalizados.filter(
                        (outro) => outro.id !== p.id,
                      ),
                    })
                  }
                  testar={soltar}
                />
              ))}
            </ul>
          ) : null}
          <div className="ui-acoes ui-campo-largo">
            <button
              type="button"
              className="btn secondary"
              disabled={
                config.personalizados.length >= LIMITE_DE_PERSONALIZADOS
              }
              onClick={() =>
                mudar({
                  ...config,
                  personalizados: [
                    ...config.personalizados,
                    novoPersonalizado(config.personalizados),
                  ],
                })
              }
            >
              <Icone nome="plus" tamanho={16} /> Adicionar marco
            </button>
          </div>
        </Grupo>
        <Grupo
          secao="comemoracoes"
          id="palco"
          titulo="Palco de testes"
          icone="play"
          tom="sucesso"
        >
          <PalcoDeTestes testar={soltar} />
        </Grupo>
        <Grupo
          secao="comemoracoes"
          id="pessoal"
          titulo="Neste navegador"
          icone="user-round"
          tom="neutro"
        >
          <Caixa
            rotulo="Mostrar comemorações para mim"
            marcado={pessoal}
            aoMudar={(ligadas) => {
              guardarPreferenciaPessoal(armazenamento, ligadas);
              setPessoal(ligadas);
            }}
          />
        </Grupo>
      </div>
    </div>
  );
}
