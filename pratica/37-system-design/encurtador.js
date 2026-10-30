// P2 · O núcleo de um encurtador de URLs (o exercício de system design mais clássico).

// Os 62 símbolos, nesta ordem: 0-9, a-z, A-Z.
export const ALFABETO = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

// codificar(n) → o número em base 62 (codificar(0) = "0", codificar(61) = "Z", codificar(62) = "10").
// Só aceita inteiros >= 0 (senão, Error).
export function codificar(n) {
  throw new Error('Por fazer: P2');
}

// descodificar(texto) → o número. Um carácter fora do alfabeto (ou texto vazio) é um Error.
export function descodificar(texto) {
  throw new Error('Por fazer: P2');
}

// new Encurtador({ proximoId }) — proximoId() devolve um inteiro novo de cada vez (num sistema real,
// uma sequência da BD ou um serviço de ids; aqui é injetado, para os testes o controlarem).
//   encurtar(url, { alias } = {}) → o código curto
//     - só aceita URLs http:// ou https:// (senão, Error com "URL")
//     - o MESMO url devolve SEMPRE o mesmo código (não gasta ids novos)
//     - com alias: usa esse código, se estiver livre (letras, dígitos e "-", 3 a 30 caracteres);
//       se já estiver em uso por OUTRO url, Error com "alias"
//   expandir(codigo) → o url original, e conta mais um clique; null se o código não existir
//   cliques(codigo) → quantas vezes foi expandido (0 se nunca)
export class Encurtador {
  constructor({ proximoId }) {
    throw new Error('Por fazer: P2');
  }
}
