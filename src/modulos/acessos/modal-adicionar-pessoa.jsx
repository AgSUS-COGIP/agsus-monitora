import { useState, useSyncExternalStore } from "react";
import { gruposAtribuiveis } from "../../lib/teto-de-acessos.js";
import { coordenacoesPorArea } from "../../lib/grupos-e-coordenacoes.js";
import { MultiSelectBusca } from "../../componentes/multi-select-busca.jsx";
import { BotaoDeAcao, Campo, Modal } from "../../ui/index.js";
import { CabecalhoDaGaveta, CampoMotivo, motivoValido } from "./partes.jsx";
import { AcoesDoConvite } from "./convite.jsx";

/*
  "Adicionar pessoa": cadastra pelo e-mail, antes de ela entrar
  (adicionar_pessoa_acesso). No primeiro login o banco liga o perfil à conta
  pelo e-mail. Admin escolhe grupo e coordenação (ou áreas); o coordenador
  adiciona na própria coordenação, com grupo dentro do teto.

  Depois de gravar, o modal vira "Convite pronto": a mensagem para mandar à
  pessoa (copiar ou abrir no e-mail).
*/

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function ModalAdicionarPessoa({ estado }) {
  const { matriz } = useSyncExternalStore(estado.assinar, estado.obter);
  const teto = matriz.teto;
  const grupos = gruposAtribuiveis(teto, matriz.grupos || []);
  const areas = matriz.areas || [];
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [grupo, setGrupo] = useState(
    grupos.find((g) => g.codigo === "usuario")?.codigo ||
      grupos[0]?.codigo ||
      "",
  );
  const [coordenacao, setCoordenacao] = useState(
    teto.admin_global ? "" : teto.coordenacao || "",
  );
  const [areasEscolhidas, setAreasEscolhidas] = useState(["saude-indigena"]);
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  /** { nome, email, reativada } depois de gravar: passo "Convite pronto". */
  const [convite, setConvite] = useState(null);
  const adminGlobal = grupos.find((g) => g.codigo === grupo)?.admin_global;
  const semCoordenacao = !coordenacao && !adminGlobal;
  const erros = {
    email: EMAIL.test(email.trim()) ? "" : "Informe um e-mail válido.",
    nome: nome.trim().length >= 2 ? "" : "Informe o nome da pessoa.",
    areas:
      semCoordenacao && !areasEscolhidas.length
        ? "Escolha ao menos uma área."
        : "",
  };
  const valido =
    !erros.email && !erros.nome && !erros.areas && motivoValido(motivo);
  const erro = (campo) => (tentou && erros[campo]) || undefined;

  async function salvar(evento) {
    evento.preventDefault();
    setTentou(true);
    if (!valido) return;
    const pronto = await estado.adicionarPessoa(
      {
        email: email.trim().toLowerCase(),
        nome: nome.trim(),
        grupo,
        coordenacao,
        areas: semCoordenacao ? areasEscolhidas : null,
      },
      motivo.trim(),
    );
    if (pronto) setConvite(pronto);
  }

  /* Uma key por passo: o Modal remonta e leva o foco ao "Concluir" (sem ela,
     o React reaproveitava o Modal do formulário e o foco caía no body). */
  if (convite)
    return (
      <Modal
        key="convite"
        id="acessosAdicionar"
        rotuloId="acessosAdicionarTitulo"
        className="acessos-modal"
        cartaoClassName="acessos-modal-cartao"
        aoFechar={estado.fecharAdicionar}
      >
        <CabecalhoDaGaveta
          tituloId="acessosAdicionarTitulo"
          titulo="Convite pronto"
          subtitulo={
            convite.reativada
              ? `O acesso de ${convite.nome} foi reativado.`
              : `${convite.nome} já pode entrar.`
          }
          aoFechar={estado.fecharAdicionar}
        />
        <div className="acessos-modal-corpo">
          <AcoesDoConvite nome={convite.nome} email={convite.email} />
          <div className="ui-acoes acessos-modal-rodape">
            <button
              type="button"
              className="btn primary"
              data-foco-inicial
              onClick={estado.fecharAdicionar}
            >
              Concluir
            </button>
          </div>
        </div>
      </Modal>
    );

  return (
    <Modal
      key="formulario"
      id="acessosAdicionar"
      rotuloId="acessosAdicionarTitulo"
      className="acessos-modal"
      cartaoClassName="acessos-modal-cartao"
      aoFechar={estado.fecharAdicionar}
      fecharAoClicarFora={false}
    >
      <CabecalhoDaGaveta
        tituloId="acessosAdicionarTitulo"
        titulo="Adicionar pessoa"
        aoFechar={estado.fecharAdicionar}
      />
      <form
        className="acessos-modal-corpo"
        data-tour="acessos-adicionar-formulario"
        onSubmit={salvar}
        noValidate
      >
        <Campo rotulo="E-mail institucional" erro={erro("email")}>
          <input
            id="acessosAdicionarEmail"
            type="email"
            data-foco-inicial
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@agenciasus.org.br"
          />
        </Campo>
        <Campo rotulo="Nome" erro={erro("nome")}>
          <input
            id="acessosAdicionarNome"
            value={nome}
            maxLength={120}
            onChange={(e) => setNome(e.target.value)}
          />
        </Campo>
        <div className="acessos-grade-campos">
          <Campo rotulo="Grupo">
            <select
              id="acessosAdicionarGrupo"
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
            >
              {grupos.map((g) => (
                <option key={g.codigo} value={g.codigo}>
                  {g.nome}
                </option>
              ))}
            </select>
          </Campo>
          {!adminGlobal ? (
            <Campo rotulo="Coordenação">
              <select
                id="acessosAdicionarCoordenacao"
                value={coordenacao}
                disabled={!teto.admin_global}
                onChange={(e) => setCoordenacao(e.target.value)}
              >
                <option value="">Sem coordenação</option>
                {coordenacoesPorArea(
                  (matriz.coordenacoes || []).filter((c) => c.ativo),
                  areas,
                ).map((g) => (
                  <optgroup key={g.area.id} label={g.area.titulo}>
                    {g.coordenacoes.map((c) => (
                      <option key={c.codigo} value={c.codigo}>
                        {c.nome}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Campo>
          ) : null}
        </div>
        {semCoordenacao ? (
          <Campo
            rotulo="Áreas que a pessoa vê"
            erro={erro("areas")}
            idDoControle="acessosAdicionarAreas"
          >
            <MultiSelectBusca
              id="acessosAdicionarAreas"
              opcoes={areas.map((a) => ({ value: a.id, label: a.titulo }))}
              selecionados={areasEscolhidas}
              placeholder="Escolha as áreas"
              aoMudar={setAreasEscolhidas}
            />
          </Campo>
        ) : null}
        <CampoMotivo
          id="acessosAdicionarMotivo"
          valor={motivo}
          aoMudar={setMotivo}
          erro={tentou && !motivoValido(motivo)}
        />
        <div className="ui-acoes acessos-modal-rodape">
          <button
            type="button"
            className="btn ghost"
            onClick={estado.fecharAdicionar}
          >
            Cancelar
          </button>
          <BotaoDeAcao
            estado={estado}
            acao="adicionar"
            type="submit"
            data-tour="acessos-adicionar-confirmar"
            className="btn primary"
          >
            Adicionar pessoa
          </BotaoDeAcao>
        </div>
      </form>
    </Modal>
  );
}
