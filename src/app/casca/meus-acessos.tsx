import { useSyncExternalStore } from "react";
import { Gaveta, GradeDeKv, Kv, Secao, Selo } from "../../ui/index.ts";
import { usarPecasDoApp } from "../contexto-do-app.ts";
import type { Assinavel } from "../contexto-do-app.ts";
import {
  montarMeusAcessos,
  tomDoNivel,
} from "../../lib/acessos/meus-acessos.ts";
import type { MeusAcessos } from "../../lib/acessos/meus-acessos.ts";
import type { PerfilDeAcesso } from "../../lib/acessos/tipos-dos-acessos.ts";

/*
  "Meus acessos", do menu da conta: a gaveta com o grupo, as áreas, a
  coordenação e o nível de cada módulo de quem entrou. Só leitura, do perfil
  que a sessão já tem (`pecas.perfil`, de src/main.ts); a regra que monta a
  lista é src/lib/acessos/meus-acessos.ts. Quem muda o acesso é
  Configurações › Acessos, por outra pessoa.
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

/** A gaveta com o perfil de quem entrou. */
export function GavetaDosMeusAcessosDoApp({
  aoFechar,
}: {
  aoFechar: () => void;
}) {
  return (
    <GavetaDosMeusAcessos perfil={usarPerfilDoApp()} aoFechar={aoFechar} />
  );
}

export function GavetaDosMeusAcessos({
  perfil,
  aoFechar,
}: {
  perfil: PerfilDeAcesso | null;
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
