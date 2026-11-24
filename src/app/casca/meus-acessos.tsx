import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  Aviso,
  Campo,
  CarregandoConteudo,
  ErroAoCarregar,
  Gaveta,
  GradeDeKv,
  Kv,
  Secao,
  Segmentado,
  Selo,
  usarAlteradoNoModal,
} from "../../ui/index.ts";
import { usarPecasDoApp } from "../contexto-do-app.ts";
import type { Assinavel } from "../contexto-do-app.ts";
import {
  montarMeusAcessos,
  tomDoNivel,
} from "../../lib/acessos/meus-acessos.ts";
import type { MeusAcessos } from "../../lib/acessos/meus-acessos.ts";
import {
  PEDIDO_VAZIO,
  areasParaPedir,
  camposComModulo,
  gruposParaPedir,
  modulosParaPedir,
  niveisParaPedir,
  oQueFoiPedido,
  podePedirMaisAcesso,
  situacaoDoPedido,
  tiposParaPedir,
  validarPedidoDeMaisAcesso,
  type CamposDoPedidoDeMaisAcesso,
  type ErrosDoPedidoDeMaisAcesso,
  type Opcao,
  type TipoDoPedido,
} from "../../lib/acessos/pedido-de-mais-acesso.ts";
import { JUSTIFICATIVA_MAXIMA } from "../../lib/acessos/solicitacao-de-acesso.ts";
import type { PerfilDeAcesso } from "../../lib/acessos/tipos-dos-acessos.ts";
import {
  criarPedidoDeMaisAcesso,
  type PedidoDeMaisAcessoDoApp,
} from "./pedido-de-mais-acesso.ts";

/*
  "Meus acessos", do menu da conta: a gaveta com o grupo, as áreas, a
  coordenação e o nível de cada módulo de quem entrou, do perfil que a sessão
  já tem (`pecas.perfil`, de src/main.ts; a lista é de
  src/lib/acessos/meus-acessos.ts). Embaixo, "Pedir mais acesso": o último
  pedido (pendente, aprovado ou recusado com o motivo; o pendente se cancela)
  e o formulário curto — um módulo com um nível, outra área ou outro grupo, e
  a justificativa. O estado do pedido é de pedido-de-mais-acesso.ts; quem
  aprova é Configurações › Acessos › Pendentes, outra pessoa. O item "Pedir
  mais acesso" do menu abre a gaveta já no formulário.
*/

const SEM_PERFIL: Assinavel<PerfilDeAcesso | null> = Object.freeze({
  obter: () => null,
  assinar: () => () => {},
});

/** O perfil de quem entrou, relido a cada mudança da sessão (null fora da raiz). */
export function usarPerfilDoApp(): PerfilDeAcesso | null {
  const perfil = usarPecasDoApp()?.perfil ?? SEM_PERFIL;
  return useSyncExternalStore(perfil.assinar, perfil.obter, perfil.obter);
}

/** A gaveta com o perfil de quem entrou e o pedido lido do banco. */
export function GavetaDosMeusAcessosDoApp({
  aoFechar,
  pedir = false,
}: {
  aoFechar: () => void;
  pedir?: boolean;
}) {
  const [pedido] = useState(() => criarPedidoDeMaisAcesso());
  return (
    <GavetaDosMeusAcessos
      perfil={usarPerfilDoApp()}
      pedido={pedido}
      pedir={pedir}
      aoFechar={aoFechar}
    />
  );
}

export function GavetaDosMeusAcessos({
  perfil,
  pedido,
  pedir = false,
  aoFechar,
}: {
  perfil: PerfilDeAcesso | null;
  /** O estado do pedido de mais acesso (sem ele, a seção não aparece). */
  pedido?: PedidoDeMaisAcessoDoApp;
  /** Abre já no formulário ("Pedir mais acesso" do menu). */
  pedir?: boolean;
  aoFechar: () => void;
}) {
  const acessos = montarMeusAcessos(perfil);
  return (
    <Gaveta
      tituloId="meusAcessosTitulo"
      aoFechar={aoFechar}
      sobretitulo="Minha conta"
      titulo="Meus acessos"
    >
      {acessos ? (
        <ConteudoDosMeusAcessos acessos={acessos} />
      ) : (
        <p className="ui-secao-vazio">Os acessos não carregaram.</p>
      )}
      {pedido && podePedirMaisAcesso(perfil) ? (
        <SecaoDoPedido perfil={perfil} pedido={pedido} pedir={pedir} />
      ) : null}
    </Gaveta>
  );
}

function ConteudoDosMeusAcessos({ acessos }: { acessos: MeusAcessos }) {
  return (
    <>
      <Secao icone="fa-user-group" titulo="Grupo e áreas">
        <GradeDeKv>
          <Kv rotulo="Grupo">{acessos.grupo}</Kv>
          <Kv rotulo="Áreas">{acessos.areas.join(", ")}</Kv>
          <Kv rotulo="Coordenação">{acessos.coordenacao}</Kv>
        </GradeDeKv>
      </Secao>
      <Secao icone="fa-shield-halved" titulo="Módulos">
        {acessos.modulos.length ? (
          <GradeDeKv rotulo="Nível por módulo">
            {acessos.modulos.map((modulo) => (
              <Kv key={modulo.recurso} rotulo={modulo.rotulo}>
                <Selo tom={tomDoNivel(modulo.nivel)}>
                  {modulo.rotuloDoNivel}
                </Selo>
              </Kv>
            ))}
          </GradeDeKv>
        ) : (
          <p className="ui-secao-vazio">Os níveis por módulo não carregaram.</p>
        )}
      </Secao>
    </>
  );
}

// ── Pedir mais acesso ────────────────────────────────────────────────────────

function SecaoDoPedido({
  perfil,
  pedido,
  pedir,
}: {
  perfil: PerfilDeAcesso | null;
  pedido: PedidoDeMaisAcessoDoApp;
  pedir: boolean;
}) {
  const estado = useSyncExternalStore(pedido.assinar, pedido.obter);
  const [formulario, setFormulario] = useState(pedir);
  useEffect(() => {
    void pedido.carregar();
  }, [pedido]);

  const situacao = situacaoDoPedido(estado.pedido);
  const pendente = Boolean(situacao?.pendente);
  const algoAPedir = tiposParaPedir(perfil, estado.grupos).length > 0;
  return (
    <Secao icone="fa-paper-plane" titulo="Pedir mais acesso" secao="pedido">
      {estado.status === "erro" ? (
        <ErroAoCarregar
          oQue="o seu pedido"
          aoTentar={() => void pedido.carregar()}
        />
      ) : estado.status !== "pronto" ? (
        <CarregandoConteudo
          semMoldura
          linhas={1}
          rotulo="Carregando o seu pedido…"
        />
      ) : (
        <>
          {situacao ? (
            <div>
              <p className="ui-secao-texto">
                <Selo tom={situacao.tom}>{situacao.rotulo}</Selo>{" "}
                <strong>{oQueFoiPedido(estado.pedido)}</strong>
                {situacao.quando ? (
                  <span className="ui-texto-secundario">
                    {" "}
                    · {situacao.quando}
                  </span>
                ) : null}
              </p>
              {situacao.motivo ? (
                <p className="ui-secao-texto">Motivo: {situacao.motivo}</p>
              ) : null}
              {pendente ? (
                <div className="ui-acoes">
                  <button
                    type="button"
                    className="btn ghost perigo small"
                    disabled={estado.cancelando}
                    onClick={() => void pedido.cancelar()}
                  >
                    {estado.cancelando ? "Cancelando…" : "Cancelar pedido"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {!algoAPedir || pendente ? null : formulario ? (
            <FormularioDoPedido
              perfil={perfil}
              pedido={pedido}
              aoFechar={() => setFormulario(false)}
            />
          ) : (
            <div className="ui-acoes">
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setFormulario(true)}
              >
                Pedir mais acesso
              </button>
            </div>
          )}
          {estado.erro && !formulario ? (
            <Aviso tom="danger" papel="alert" como="p">
              {estado.erro}
            </Aviso>
          ) : null}
        </>
      )}
    </Secao>
  );
}

function SelectDoPedido({
  rotulo,
  valor,
  opcoes,
  erro,
  foco,
  aoMudar,
}: {
  rotulo: string;
  valor: string;
  opcoes: readonly Opcao[];
  erro?: string;
  foco?: boolean;
  aoMudar: (valor: string) => void;
}) {
  return (
    <Campo rotulo={rotulo} obrigatorio erro={erro}>
      <select
        value={valor}
        data-foco-inicial={foco ? "" : undefined}
        onChange={(e) => aoMudar(e.target.value)}
      >
        <option value="">Escolha</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </Campo>
  );
}

function FormularioDoPedido({
  perfil,
  pedido,
  aoFechar,
}: {
  perfil: PerfilDeAcesso | null;
  pedido: PedidoDeMaisAcessoDoApp;
  aoFechar: () => void;
}) {
  const estado = useSyncExternalStore(pedido.assinar, pedido.obter);
  const tipos = tiposParaPedir(perfil, estado.grupos);
  const [campos, setCampos] = useState<CamposDoPedidoDeMaisAcesso>(() => ({
    ...PEDIDO_VAZIO,
    tipo: tipos[0]?.valor ?? PEDIDO_VAZIO.tipo,
  }));
  const [erros, setErros] = useState<ErrosDoPedidoDeMaisAcesso>({});
  const mudou =
    Boolean(campos.recurso || campos.area || campos.grupo) ||
    Boolean(campos.justificativa.trim());
  usarAlteradoNoModal(mudou);
  const mudar = (parcial: Partial<CamposDoPedidoDeMaisAcesso>) => {
    setCampos((atual) => ({ ...atual, ...parcial }));
    setErros({});
  };

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const encontrados = validarPedidoDeMaisAcesso(
      campos,
      perfil,
      estado.grupos,
    );
    setErros(encontrados);
    if (Object.keys(encontrados).length) return;
    if (await pedido.enviar(campos)) aoFechar();
  }

  return (
    <form
      className="ui-pilha"
      aria-label="Pedir mais acesso"
      onSubmit={(e) => void enviar(e)}
      noValidate
    >
      <Segmentado<TipoDoPedido>
        rotulo="O que pedir"
        opcoes={tipos}
        valor={campos.tipo}
        aoMudar={(tipo) => mudar({ tipo })}
      />
      {campos.tipo === "MODULO" ? (
        <div className="ui-grade-de-campos">
          <SelectDoPedido
            rotulo="Módulo"
            valor={campos.recurso}
            opcoes={modulosParaPedir(perfil)}
            erro={erros.recurso}
            foco
            aoMudar={(recurso) => {
              setCampos((atual) => camposComModulo(atual, perfil, recurso));
              setErros({});
            }}
          />
          <SelectDoPedido
            rotulo="Nível"
            valor={campos.nivel}
            opcoes={
              campos.recurso ? niveisParaPedir(perfil, campos.recurso) : []
            }
            erro={erros.nivel}
            aoMudar={(nivel) => mudar({ nivel })}
          />
        </div>
      ) : campos.tipo === "AREA" ? (
        <SelectDoPedido
          rotulo="Área"
          valor={campos.area}
          opcoes={areasParaPedir(perfil)}
          erro={erros.area}
          foco
          aoMudar={(area) => mudar({ area })}
        />
      ) : (
        <SelectDoPedido
          rotulo="Grupo"
          valor={campos.grupo}
          opcoes={gruposParaPedir(perfil, estado.grupos)}
          foco
          erro={erros.grupo}
          aoMudar={(grupo) => mudar({ grupo })}
        />
      )}
      <Campo
        rotulo="Justificativa"
        obrigatorio
        erro={erros.justificativa}
        largo
      >
        <textarea
          rows={3}
          maxLength={JUSTIFICATIVA_MAXIMA}
          value={campos.justificativa}
          onChange={(e) => mudar({ justificativa: e.target.value })}
        />
      </Campo>
      {estado.erro ? (
        <Aviso tom="danger" papel="alert" como="p">
          {estado.erro}
        </Aviso>
      ) : null}
      <div className="ui-acoes">
        <button type="button" className="btn ghost small" onClick={aoFechar}>
          Cancelar
        </button>
        <button
          type="submit"
          className="btn secondary small"
          disabled={estado.enviando}
        >
          {estado.enviando ? "Enviando…" : "Enviar pedido"}
        </button>
      </div>
    </form>
  );
}
