import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { RESOURCES, niveisDoRecurso } from "../../lib/permissoes-recursos.js";
import {
  grupoParaSalvar,
  grupoVazio,
  lerGrupo,
  validarGrupo,
} from "../../lib/grupos-e-coordenacoes.js";
import {
  Aviso,
  BlocosEsqueleto,
  BotaoDeAcao,
  Campo,
  Segmentado,
} from "../../ui/index.ts";
import { CampoMotivo, ListaMestre, motivoValido } from "./partes.jsx";

/*
  Grupos de permissões (só admin global), no padrão lista + detalhe: a lista
  à esquerda; ao entrar num grupo, o nível de cada módulo à direita. Quem
  segue o grupo muda junto; permissões individuais continuam na aba Usuários.
  O grupo de administrador global é do sistema e não se edita.
*/

const NOVO = "__novo__";
const pessoas = (total) =>
  `${total || 0} ${total === 1 ? "pessoa" : "pessoas"}`;
const mesmo = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/*
  Excluir pede o motivo no próprio rodapé (no lugar do antigo window.prompt).
  Fica dentro do formulário do grupo: não é outro <form>, e Enter no campo
  confirma a exclusão, não o "Salvar grupo".
*/
function ConfirmarExclusao({ estado, grupo, aoExcluir, aoVoltar }) {
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  async function confirmar() {
    setTentou(true);
    if (!motivoValido(motivo)) return;
    if (await estado.removerGrupo(grupo, motivo.trim())) aoExcluir();
  }
  return (
    <div
      className="acessos-mover"
      role="group"
      aria-label={`Excluir o grupo ${grupo.nome}`}
      onKeyDown={(evento) => {
        if (evento.key !== "Enter") return;
        evento.preventDefault();
        void confirmar();
      }}
    >
      <CampoMotivo
        id="acessosExcluirGrupoMotivo"
        rotulo="Motivo da exclusão"
        valor={motivo}
        aoMudar={setMotivo}
        erro={tentou && !motivoValido(motivo)}
      />
      <div className="ui-acoes">
        <button type="button" className="btn ghost" onClick={aoVoltar}>
          Voltar
        </button>
        <BotaoDeAcao
          estado={estado}
          acao="remover-grupo"
          className="btn outline perigo"
          disabled={!motivoValido(motivo)}
          onClick={() => void confirmar()}
        >
          Excluir grupo
        </BotaoDeAcao>
      </div>
    </div>
  );
}

function Editor({
  estado,
  grupo,
  existentes,
  aoSalvar,
  aoVerPessoas,
  aoAlterar,
}) {
  const inicial = grupo ? lerGrupo(grupo) : grupoVazio();
  const [rascunho, setRascunho] = useState(inicial);
  /* O grupo como estava quando a edição começou (ou na última revisão vista). */
  const [origem, setOrigem] = useState(inicial);
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const erros = validarGrupo(rascunho, { existentes });
  const novo = rascunho.revisao === null;
  const somenteLeitura = Boolean(grupo?.admin_global);
  const alterado = !mesmo(rascunho, origem);
  /*
    Revisão nova do grupo (salvou aqui, ou outra pessoa salvou e a matriz
    recarregou): sem edição pendente, o rascunho acompanha; com edição, ela
    fica — e o Salvar acusa o conflito, em vez de a edição sumir.
  */
  if (grupo && inicial.revisao !== origem.revisao) {
    setOrigem(inicial);
    if (!alterado) setRascunho(inicial);
  }
  useEffect(() => {
    aoAlterar(alterado);
  }, [alterado, aoAlterar]);

  async function salvar(evento) {
    evento.preventDefault();
    setTentou(true);
    if (Object.keys(erros).length || !motivoValido(motivo)) return;
    const resposta = await estado.salvarGrupo(
      grupoParaSalvar(rascunho),
      motivo.trim(),
    );
    if (resposta) aoSalvar(resposta.codigo || grupoParaSalvar(rascunho).codigo);
  }

  return (
    <form
      className="acessos-detalhe"
      data-tour="acessos-grupo-editor"
      onSubmit={salvar}
      noValidate
      aria-label={novo ? "Novo grupo" : `Grupo ${grupo.nome}`}
    >
      <header className="acessos-detalhe-cabecalho">
        <Campo
          rotulo="Nome do grupo"
          erro={tentou && erros.nome ? erros.nome : undefined}
        >
          <input
            id="acessosGrupoNome"
            value={rascunho.nome}
            maxLength={80}
            disabled={somenteLeitura}
            onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
          />
        </Campo>
        <Campo
          rotulo={
            <>
              Para que serve{" "}
              <span className="acessos-secundario">(opcional)</span>
            </>
          }
        >
          <input
            id="acessosGrupoDescricao"
            value={rascunho.descricao}
            maxLength={200}
            disabled={somenteLeitura}
            onChange={(e) =>
              setRascunho({ ...rascunho, descricao: e.target.value })
            }
          />
        </Campo>
        {!novo ? (
          <p className="acessos-secundario">
            {pessoas(grupo.usuarios)} neste grupo.{" "}
            {grupo.usuarios ? (
              <button
                type="button"
                className="acessos-link"
                onClick={() => aoVerPessoas(grupo.codigo)}
              >
                Ver pessoas
              </button>
            ) : null}
          </p>
        ) : null}
      </header>

      {somenteLeitura ? (
        <Aviso como="p">Grupo do sistema (não editável).</Aviso>
      ) : null}

      <h4>Permissões</h4>
      <ul className="acessos-modulos" data-tour="acessos-grupo-permissoes">
        {RESOURCES.map(([recurso, rotulo]) => (
          <li key={recurso}>
            <div>
              <strong id={`acessosModulo-${recurso}`}>{rotulo}</strong>
            </div>
            <Segmentado
              rotulo={`${rotulo}: nível no grupo`}
              valor={somenteLeitura ? "admin" : rascunho.niveis[recurso]}
              desabilitado={somenteLeitura}
              opcoes={niveisDoRecurso(recurso).map(([valor, texto]) => ({
                valor,
                rotulo: texto,
              }))}
              aoMudar={(valor) =>
                setRascunho({
                  ...rascunho,
                  niveis: { ...rascunho.niveis, [recurso]: valor },
                })
              }
            />
          </li>
        ))}
      </ul>

      {!somenteLeitura ? (
        <footer className="acessos-detalhe-rodape">
          {excluindo ? (
            <ConfirmarExclusao
              estado={estado}
              grupo={grupo}
              aoExcluir={() => aoSalvar(null)}
              aoVoltar={() => setExcluindo(false)}
            />
          ) : null}
          {(alterado || novo) && !excluindo ? (
            <CampoMotivo
              id="acessosGrupoMotivo"
              valor={motivo}
              aoMudar={setMotivo}
              erro={tentou && !motivoValido(motivo)}
            />
          ) : null}
          <div className="ui-acoes" hidden={excluindo}>
            {!novo && !grupo.sistema ? (
              <button
                type="button"
                className="btn ghost perigo"
                disabled={Boolean(grupo.usuarios)}
                title={
                  grupo.usuarios
                    ? "Há pessoas neste grupo: troque o grupo delas antes de excluir."
                    : undefined
                }
                onClick={() => setExcluindo(true)}
              >
                Excluir grupo
              </button>
            ) : null}
            <span className="acessos-espaco" />
            {alterado ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() => (setRascunho(origem), setTentou(false))}
              >
                Descartar
              </button>
            ) : null}
            <BotaoDeAcao
              estado={estado}
              acao="grupo"
              type="submit"
              data-tour="acessos-grupo-salvar"
              className="btn primary"
              disabled={!alterado && !novo}
            >
              {novo ? "Criar grupo" : "Salvar grupo"}
            </BotaoDeAcao>
          </div>
        </footer>
      ) : null}
    </form>
  );
}

export function AbaGrupos({ estado, aoVerPessoas }) {
  const atual = useSyncExternalStore(estado.assinar, estado.obter);
  const grupos = atual.matriz?.grupos || [];
  const [selecionado, setSelecionado] = useState(null);
  const alterado = useRef(false);
  const aoAlterar = useRef((valor) => (alterado.current = valor)).current;
  // Trocar de grupo com edição não salva pergunta antes.
  const escolher = (codigo) => {
    if (
      alterado.current &&
      !estado.confirmar("Descartar as alterações deste grupo?")
    )
      return;
    alterado.current = false;
    setSelecionado(codigo);
  };
  const escolhido =
    selecionado ??
    grupos.find((g) => !g.admin_global)?.codigo ??
    grupos[0]?.codigo;
  const grupo = grupos.find((g) => g.codigo === escolhido) || null;

  // Grupo excluído some da lista: volta ao primeiro.
  useEffect(() => {
    if (
      selecionado &&
      selecionado !== NOVO &&
      grupos.length &&
      !grupos.some((g) => g.codigo === selecionado)
    )
      setSelecionado(null);
  }, [grupos, selecionado]);

  if (!atual.matriz)
    return (
      <div className="acessos-carregando" aria-busy="true">
        <BlocosEsqueleto quantos={3} className="acessos-esqueleto" />
      </div>
    );

  return (
    <section
      className="acessos-mestre-detalhe"
      aria-label="Grupos de permissões"
      data-tour="acessos-grupos"
    >
      <ListaMestre
        rotulo="Grupos"
        rotuloCriar="Novo grupo"
        aoCriar={() => escolher(NOVO)}
        selecionado={escolhido}
        aoEscolher={escolher}
        itens={grupos.map((g) => ({
          id: g.codigo,
          titulo: g.nome,
          detalhe: g.admin_global
            ? `${pessoas(g.usuarios)} · Sistema`
            : pessoas(g.usuarios),
        }))}
      />
      <Editor
        key={escolhido}
        estado={estado}
        grupo={escolhido === NOVO ? null : grupo}
        existentes={grupos}
        aoSalvar={(codigo) => (
          (alterado.current = false),
          setSelecionado(codigo)
        )}
        aoVerPessoas={aoVerPessoas}
        aoAlterar={aoAlterar}
      />
    </section>
  );
}
