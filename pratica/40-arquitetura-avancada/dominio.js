// P1 · DDD: um objeto de valor e um agregado com invariantes. Ver docs/40-arquitetura-avancada.md.

// Dinheiro: um OBJETO DE VALOR. Imutável (Object.freeze), sem identidade: dois Dinheiro com os mesmos
// cêntimos e a mesma moeda são iguais.
//   new Dinheiro(centimos, moeda = "EUR"): centimos tem de ser um inteiro (nada de 0.1 + 0.2!), senão Error
//   somar(outro) e multiplicar(n inteiro) → um Dinheiro NOVO; somar moedas diferentes → Error
//   igual(outro) → boolean · toString() → "12.34 EUR"
export class Dinheiro {
  constructor(centimos, moeda = 'EUR') {
    throw new Error('Por fazer: P1');
  }
}

// Encomenda: um AGREGADO. Toda a mudança passa pelos seus métodos, que protegem as regras (invariantes).
//   new Encomenda(id, clienteId) → estado "rascunho", sem linhas
//   adicionarLinha(produtoId, quantidade, precoUnitario: Dinheiro)
//     - só em "rascunho" (senão Error com "rascunho")
//     - quantidade inteira > 0 (senão Error)
//     - o mesmo produto outra vez SOMA à quantidade da linha existente
//     - no máximo 10 linhas diferentes (senão Error com "10")
//   get linhas → uma CÓPIA das linhas [{ produtoId, quantidade, precoUnitario }] (quem está de fora não as pode mudar)
//   get total → Dinheiro (a soma de quantidade × preço; 0 EUR se não houver linhas)
//   confirmar() → só em "rascunho" e com pelo menos uma linha; estado passa a "confirmada" e regista o
//     evento de domínio { tipo: "EncomendaConfirmada", encomendaId, clienteId, total: <toString do total> }
//   cancelar() → em "rascunho" ou "confirmada" passa a "cancelada" e regista { tipo: "EncomendaCancelada", encomendaId };
//     noutros estados, Error
//   retirarEventos() → os eventos registados desde a última vez, e esvazia a lista
export class Encomenda {
  constructor(id, clienteId) {
    throw new Error('Por fazer: P1');
  }
}
