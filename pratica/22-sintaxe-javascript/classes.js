// P4 · Closures, classes e erros (ver docs/22-sintaxe-javascript.md, "Classes", "O padrão fábrica",
// "try / catch / finally", e "Prática").

// Uma fábrica com estado privado, à maneira do projeto (createTaskService):
// criarContador(5) → { incrementar(), decrementar(), valor() }; o número fica escondido na closure.
// incrementar/decrementar devolvem o novo valor. decrementar nunca desce abaixo de 0.
export function criarContador(inicial = 0) {
  throw new Error('Por fazer: P4');
}

// Uma conta bancária como CLASSE:
//   new Conta('Ana')            → titular 'Ana', saldo 0
//   conta.depositar(valor)      → valor tem de ser > 0, senão lança RangeError; devolve this
//   conta.levantar(valor)       → sem saldo suficiente, lança SaldoInsuficiente; devolve this
//   conta.saldo                 → getter só de leitura (o saldo guarda-se num campo privado #saldo)
//   Conta.transferir(de, para, valor) → método ESTÁTICO; se falhar, nenhuma das contas muda
// SaldoInsuficiente é uma classe de erro tua (extends Error), com a propriedade `emFalta`.
export class SaldoInsuficiente extends Error {}

export class Conta {}

// Lê um JSON de configuração com segurança: devolve { ok: true, valor } ou
// { ok: false, erro: 'JSON inválido' }, e chama aoTerminar() SEMPRE (finally), com ou sem erro.
export function lerConfig(texto, aoTerminar = () => {}) {
  throw new Error('Por fazer: P4');
}
