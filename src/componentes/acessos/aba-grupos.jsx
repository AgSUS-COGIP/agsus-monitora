import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DESCRICOES_DOS_MODULOS, RESOURCES, niveisDoRecurso } from "../../lib/permissoes-recursos.js";
import { grupoParaSalvar, grupoVazio, lerGrupo, validarGrupo } from "../../lib/grupos-e-coordenacoes.js";
import { Icone } from "../icone.jsx";
import { BotaoDeAcao } from "../lista-aprovados/partes.jsx";
import { CampoMotivo, ControleSegmentado, ListaMestre, motivoValido } from "./partes.jsx";

/*
  Grupos de permissões (só admin global), no padrão lista + detalhe: a lista
  à esquerda; ao entrar num grupo, o nível de cada módulo à direita. Quem
  segue o grupo muda junto; permissões individuais continuam na aba Usuários.
  O grupo de administrador global é do sistema e não se edita.
*/

const NOVO = "__novo__";
const pessoas = (total) => `${total || 0} ${total === 1 ? "pessoa" : "pessoas"}`;
const mesmo = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function Editor({ estado, grupo, existentes, aoSalvar, aoVerPessoas, aoAlterar }) {
  const inicial = grupo ? lerGrupo(grupo) : grupoVazio();
  const [rascunho, setRascunho] = useState(inicial);
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const erros = validarGrupo(rascunho, { existentes });
  const novo = rascunho.revisao === null;
  const somenteLeitura = Boolean(grupo?.admin_global);
  const alterado = !mesmo(rascunho, inicial);
  useEffect(() => {
    aoAlterar(alterado);
  }, [alterado, aoAlterar]);

  async function salvar(evento) {
    evento.preventDefault();
    setTentou(true);
    if (Object.keys(erros).length || !motivoValido(motivo)) return;
    const resposta = await estado.salvarGrupo(grupoParaSalvar(rascunho), motivo.trim());
    if (resposta) aoSalvar(resposta.codigo || grupoParaSalvar(rascunho).codigo);
  }

  async function excluir() {
    const motivoDaExclusao = window.prompt(`Excluir o grupo "${grupo.nome}"? Informe o motivo:`);
    if (motivoValido(motivoDaExclusao) && (await estado.removerGrupo(grupo, motivoDaExclusao.trim()))) aoSalvar(null);
  }

  return (
    <form className="acessos-detalhe" onSubmit={salvar} noValidate aria-label={novo ? "Novo grupo" : `Grupo ${grupo.nome}`}>
      <header className="acessos-detalhe-cabecalho">
        <div className="acessos-campo">
          <label htmlFor="acessosGrupoNome">Nome do grupo</label>
          <input
            id="acessosGrupoNome"
            value={rascunho.nome}
            maxLength={80}
            disabled={somenteLeitura}
            onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
            aria-invalid={(tentou && erros.nome) || undefined}
          />
          {tentou && erros.nome ? (
            <small className="acessos-erro">
              <Icone nome="circle-alert" tamanho={14} /> {erros.nome}
            </small>
          ) : null}
        </div>
        <div className="acessos-campo">
          <label htmlFor="acessosGrupoDescricao">
            Para que serve <span className="acessos-secundario">(opcional)</span>
          </label>
          <input
            id="acessosGrupoDescricao"
            value={rascunho.descricao}
            maxLength={200}
            disabled={somenteLeitura}
            onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })}
          />
        </div>
        {!novo ? (
          <p className="acessos-secundario">
            {pessoas(grupo.usuarios)} neste grupo.{" "}
            {grupo.usuarios ? (
              <button type="button" className="acessos-link" onClick={() => aoVerPessoas(grupo.codigo)}>
                Ver pessoas
              </button>
            ) : null}
          </p>
        ) : null}
      </header>

      {somenteLeitura ? (
        <p className="alert info">
          <Icone nome="settings" tamanho={16} /> Grupo do sistema: acesso total a todos os módulos e áreas. Não é editável.
        </p>
      ) : null}

      <h4>Permissões</h4>
      <ul className="acessos-modulos">
        {RESOURCES.map(([recurso, rotulo]) => (
          <li key={recurso}>
            <div>
              <strong id={`acessosModulo-${recurso}`}>{rotulo}</strong>
              <small>{DESCRICOES_DOS_MODULOS[recurso]}</small>
            </div>
            <ControleSegmentado
              rotulo={`${rotulo}: nível no grupo`}
              valor={somenteLeitura ? "admin" : rascunho.niveis[recurso]}
              desabilitado={somenteLeitura}
              opcoes={niveisDoRecurso(recurso).map(([valor, texto]) => ({ valor, rotulo: texto }))}
              aoMudar={(valor) => setRascunho({ ...rascunho, niveis: { ...rascunho.niveis, [recurso]: valor } })}
            />
          </li>
        ))}
      </ul>

      {!somenteLeitura ? (
        <footer className="acessos-detalhe-rodape">
          {alterado || novo ? <CampoMotivo id="acessosGrupoMotivo" valor={motivo} aoMudar={setMotivo} erro={tentou && !motivoValido(motivo)} /> : null}
          <div className="acessos-acoes">
            {!novo && !grupo.sistema ? (
              <BotaoDeAcao
                estado={estado}
                acao="remover-grupo"
                className="btn outline acessos-ghost acessos-perigo"
                disabled={Boolean(grupo.usuarios)}
                title={grupo.usuarios ? "Há pessoas neste grupo: troque o grupo delas antes de excluir." : undefined}
                onClick={() => void excluir()}
              >
                Excluir grupo
              </BotaoDeAcao>
            ) : null}
            <span className="acessos-espaco" />
            {alterado ? (
              <button type="button" className="btn outline acessos-ghost" onClick={() => (setRascunho(inicial), setTentou(false))}>
                Descartar
              </button>
            ) : null}
            <BotaoDeAcao estado={estado} acao="grupo" type="submit" className="btn primary" disabled={!alterado && !novo}>
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
    if (alterado.current && !estado.confirmar("Descartar as alterações deste grupo?")) return;
    alterado.current = false;
    setSelecionado(codigo);
  };
  const escolhido = selecionado ?? grupos.find((g) => !g.admin_global)?.codigo ?? grupos[0]?.codigo;
  const grupo = grupos.find((g) => g.codigo === escolhido) || null;

  // Grupo excluído some da lista: volta ao primeiro.
  useEffect(() => {
    if (selecionado && selecionado !== NOVO && grupos.length && !grupos.some((g) => g.codigo === selecionado))
      setSelecionado(null);
  }, [grupos, selecionado]);

  if (!atual.matriz) return <p aria-busy="true"><span className="esqueleto" /></p>;

  return (
    <section className="acessos-mestre-detalhe" aria-label="Grupos de permissões">
      <ListaMestre
        rotulo="Grupos"
        rotuloCriar="Novo grupo"
        aoCriar={() => escolher(NOVO)}
        selecionado={escolhido}
        aoEscolher={escolher}
        itens={grupos.map((g) => ({
          id: g.codigo,
          titulo: g.nome,
          detalhe: g.admin_global ? `${pessoas(g.usuarios)} · Sistema` : pessoas(g.usuarios),
        }))}
      />
      <Editor
        key={`${escolhido}-${grupo?.revisao ?? "novo"}`}
        estado={estado}
        grupo={escolhido === NOVO ? null : grupo}
        existentes={grupos}
        aoSalvar={(codigo) => ((alterado.current = false), setSelecionado(codigo))}
        aoVerPessoas={aoVerPessoas}
        aoAlterar={aoAlterar}
      />
    </section>
  );
}
