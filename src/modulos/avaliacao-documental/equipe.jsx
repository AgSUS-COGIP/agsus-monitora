import { useMemo, useState } from "react";
import { PAPEIS_DA_EQUIPE } from "../../lib/avaliacao-documental/catalogo.js";
import {
  linhaDaEquipe,
  resumoDaEquipe,
  validarEquipe,
} from "../../lib/avaliacao-documental/equipe.js";
import { rotuloDoNivel } from "../../lib/permissoes-recursos.js";
import { Aviso, Campo, EstadoVazio, Selo } from "../../ui/index.js";
import { BotaoMais, BotaoTirar } from "./campos.jsx";

/*
  Aba "Equipe": quem analisa, quem revisa e quem coordena o edital (ou uma
  vaga). O gestor do edital já coordena, sem linha. Só a coordenação muda; o
  banco confere a permissão de cada pessoa e diz qual falta.
*/

const NIVEL = ["sem_acesso", "leitor", "editor", "admin"];
const daEquipe = (r) => ({
  usuario: r.usuario,
  papel: r.papel,
  vaga: r.vaga ?? "",
  limite: r.limite ?? "",
});

export function Equipe({ e, estado }) {
  const equipe = e.equipe;
  const inicial = useMemo(() => (equipe?.equipe ?? []).map(daEquipe), [equipe]);
  const [linhas, setLinhas] = useState(inicial);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [tentou, setTentou] = useState(false);
  if (!equipe) return null;
  const coordena = Boolean(equipe.pode_coordenar);
  const gestores = equipe.gestores ?? [];
  const pessoas = new Map();
  for (const p of equipe.pessoas ?? []) pessoas.set(p.usuario, p);
  for (const r of equipe.equipe ?? [])
    if (!pessoas.has(r.usuario))
      pessoas.set(r.usuario, {
        usuario: r.usuario,
        nome: r.nome,
        nivel: r.nivel,
      });
  const erros = validarEquipe(linhas, { gestores });
  const mudou = JSON.stringify(linhas) !== JSON.stringify(inicial);
  const resumo = resumoDaEquipe(linhas, gestores);
  const saem = inicial.filter(
    (a) =>
      !linhas.some(
        (b) =>
          b.usuario === a.usuario &&
          b.papel === a.papel &&
          String(b.vaga) === String(a.vaga),
      ),
  ).length;
  const mudar = (i, chave, valor) =>
    setLinhas(linhas.map((l, j) => (j === i ? { ...l, [chave]: valor } : l)));

  async function salvar() {
    setTentou(true);
    if (erros.length || (saem && motivo.trim().length < 10)) return;
    const r = await estado.salvarEquipe(
      linhas.map(linhaDaEquipe),
      motivo.trim(),
    );
    if (r.ok) {
      setMotivo("");
      setErro("");
      setTentou(false);
    } else setErro(r.erro);
  }

  return (
    <div className="avd-equipe">
      <section className="ui-card" aria-labelledby="avdGestores">
        <h2 className="ui-titulo" id="avdGestores">
          Coordenação pelo edital
        </h2>
        {gestores.length ? (
          <ul className="avd-lista-simples">
            {gestores.map((g) => (
              <li key={g.usuario}>
                {g.nome} <Selo tom="revisar">Gestor do edital</Selo>
              </li>
            ))}
          </ul>
        ) : (
          <EstadoVazio>
            Nenhum gestor do edital com Administrador em Avaliação documental.
          </EstadoVazio>
        )}
      </section>

      <section className="ui-card" aria-labelledby="avdEquipe">
        <h2 className="ui-titulo" id="avdEquipe">
          Equipe
        </h2>
        <p className="ui-texto-secundario" data-resumo>
          {resumo.ANALISTA} analista(s) · {resumo.REVISOR} revisor(es) ·{" "}
          {resumo.COORDENADOR} na coordenação
        </p>
        {erro ? (
          <Aviso tom="danger" papel="alert">
            {erro}
          </Aviso>
        ) : null}
        {tentou && erros.length ? (
          <Aviso tom="danger" papel="alert">
            <ul>
              {erros.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </Aviso>
        ) : null}
        {!linhas.length && !coordena ? (
          <EstadoVazio>Ninguém na equipe.</EstadoVazio>
        ) : null}
        <fieldset className="avd-campos" disabled={!coordena}>
          {linhas.map((l, i) => {
            const pessoa = pessoas.get(l.usuario);
            return (
              <div className="avd-linha" key={i} data-linha-equipe={i}>
                <Campo rotulo="Pessoa">
                  <select
                    value={l.usuario}
                    onChange={(ev) => mudar(i, "usuario", ev.target.value)}
                  >
                    <option value="">Escolha</option>
                    {[...pessoas.values()].map((p) => (
                      <option key={p.usuario} value={p.usuario}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Papel">
                  <select
                    value={l.papel}
                    onChange={(ev) => mudar(i, "papel", ev.target.value)}
                  >
                    {PAPEIS_DA_EQUIPE.map(([v, r]) => (
                      <option key={v} value={v}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Vaga">
                  <select
                    value={l.vaga}
                    disabled={l.papel === "COORDENADOR"}
                    onChange={(ev) => mudar(i, "vaga", ev.target.value)}
                  >
                    <option value="">Todas</option>
                    {(equipe.vagas ?? []).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Limite de fichas">
                  <input
                    inputMode="numeric"
                    value={l.limite}
                    onChange={(ev) =>
                      mudar(i, "limite", ev.target.value.replace(/\D/g, ""))
                    }
                  />
                </Campo>
                {pessoa ? (
                  <span className="ui-texto-secundario avd-nivel">
                    {rotuloDoNivel(
                      NIVEL[pessoa.nivel] ?? "sem_acesso",
                      "avaliacao_documental",
                    )}
                  </span>
                ) : null}
                {coordena ? (
                  <BotaoTirar
                    rotulo="Tirar da equipe"
                    aoClicar={() => setLinhas(linhas.filter((_, j) => j !== i))}
                  />
                ) : null}
              </div>
            );
          })}
          {coordena ? (
            <BotaoMais
              aoClicar={() =>
                setLinhas([
                  ...linhas,
                  { usuario: "", papel: "ANALISTA", vaga: "", limite: "" },
                ])
              }
            >
              Pessoa
            </BotaoMais>
          ) : null}
        </fieldset>
        {coordena ? (
          <div className="ui-barra-de-salvar">
            {saem ? (
              <Campo
                rotulo={`Motivo para tirar ${saem} da equipe`}
                obrigatorio
                erro={
                  tentou && motivo.trim().length < 10
                    ? "De 10 a 500 caracteres."
                    : undefined
                }
              >
                <input
                  value={motivo}
                  maxLength={500}
                  onChange={(ev) => setMotivo(ev.target.value)}
                />
              </Campo>
            ) : null}
            <div className="ui-acoes">
              <button
                type="button"
                className="btn secondary"
                disabled={!mudou}
                onClick={() => setLinhas(inicial)}
              >
                Descartar
              </button>
              <button
                type="button"
                className="btn"
                data-acao="salvar-equipe"
                disabled={!mudou || e.salvando}
                onClick={salvar}
              >
                Salvar a equipe
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
