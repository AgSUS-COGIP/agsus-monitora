/*
  Os bancos de teste (PGlite) abertos. Cada PGlite segura centenas de MB fora
  da heap do Node; antes do #887 o processo de cada arquivo terminava e
  devolvia tudo, mas com poucos arquivos grandes os bancos de todos os blocos se
  somavam no mesmo processo (editais-cargas-e-paineis chegava a 8,5 GB) e
  derrubavam a máquina do GitHub sem log ("The runner has received a shutdown
  signal").

  Os ajudantes de tests/apoio/ registram o banco que criam, e o bloco
  (bloco.ts) fecha: o criado dentro de um teste (no `beforeEach` ou no próprio
  teste) ao fim daquele teste; o criado fora (no `beforeAll`, usado por vários
  testes) ao fim do bloco. O molde de um arquivo (molde-de-banco.ts) não entra:
  ele serve aos blocos seguintes.
*/
type Fechavel = { close(): Promise<void>; closed?: boolean };

const doTeste = new Set<Fechavel>();
const doBloco = new Set<Fechavel>();
/*
  Marcado pelo bloco: liga no `beforeEach` (o do bloco roda antes dos de dentro)
  e desliga no `afterEach` (o do bloco roda depois dos de dentro). O nome do
  teste em expect.getState() não serve: fica o do teste anterior durante o
  `beforeAll` seguinte.
*/
let dentroDeUmTeste = false;

/** Registra o banco para ser fechado no fim do teste ou do bloco e o devolve. */
export function lembrarBanco<T extends Fechavel>(banco: T): T {
  (dentroDeUmTeste ? doTeste : doBloco).add(banco);
  return banco;
}

/** O teste começou (o `beforeEach` do bloco). */
export function comecarTeste(): void {
  dentroDeUmTeste = true;
}

/** Tira o banco do registro (o molde, que vive o arquivo inteiro). */
export function esquecerBanco(banco: Fechavel): void {
  doTeste.delete(banco);
  doBloco.delete(banco);
}

async function fechar(conjunto: Set<Fechavel>): Promise<void> {
  const lista = [...conjunto];
  conjunto.clear();
  // Um que falhe ao fechar não segura os outros.
  await Promise.allSettled(
    lista.filter((banco) => !banco.closed).map((banco) => banco.close()),
  );
}

/** O teste acabou: fecha os bancos criados nele (o `afterEach` do bloco). */
export function fecharBancosDoTeste(): Promise<void> {
  dentroDeUmTeste = false;
  return fechar(doTeste);
}

/** Fecha todos os bancos ainda abertos (fim do bloco). */
export async function fecharBancosDoBloco(): Promise<void> {
  await fechar(doTeste);
  await fechar(doBloco);
}
