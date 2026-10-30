// P1 · Testes baseados em propriedades (fast-check): em vez de exemplos, regras que valem para
// QUALQUER entrada, e o fast-check gera centenas de entradas à procura de uma que as parta.
// Aqui escreves as propriedades; os testes verificam que passam com uma implementação certa e
// que apanham implementações com bugs (se uma propriedade deixa passar um bug, é fraca).
import fc from 'fast-check';

// propriedadesRepartir(repartir) → lista de propriedades (fc.property) sobre
//   repartir(centimos, partes), a função do módulo 54 que reparte um valor em partes quase iguais.
//   Gera centimos inteiros de 0 a 10 000 000 e partes de 1 a 50. Tem de cobrir:
//   - devolve exatamente `partes` elementos
//   - a soma dos elementos é `centimos`
//   - o maior e o menor diferem no máximo 1
//   - a lista nunca cresce (os cêntimos a mais vão para as primeiras partes)
export function propriedadesRepartir(repartir) {
  throw new Error('Por fazer: P1');
}

// propriedadesCodificador(codificar, descodificar) → lista de propriedades sobre um codificador
//   de texto para base64url (para pôr texto num URL). Gera textos Unicode quaisquer
//   (fc.string({ unit: 'grapheme' }): acentos, emojis...). Tem de cobrir:
//   - ida e volta: descodificar(codificar(t)) === t
//   - o resultado só tem os caracteres de base64url: letras, algarismos, '-' e '_' (sem '=')
export function propriedadesCodificador(codificar, descodificar) {
  throw new Error('Por fazer: P1');
}
