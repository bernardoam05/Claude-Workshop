// P3 · Hashing consistente: distribuir chaves por servidores de forma que, quando entra ou sai um
// servidor, só uma pequena parte das chaves muda de sítio.
import { createHash } from 'node:crypto';

// hash32(texto) → um inteiro de 0 a 2^32 - 1: os primeiros 4 bytes do MD5 do texto (big-endian).
// (Dado: não é para segurança, só para espalhar bem os valores.)
export function hash32(texto) {
  return createHash('md5').update(texto).digest().readUInt32BE(0);
}

// A forma ingénua, para comparar: hash(chave) % número de nós.
export function porModulo(chave, nos) {
  return nos[hash32(chave) % nos.length];
}

// new Anel({ virtuais = 100 })
//   adicionar(no): põe o nó no anel em `virtuais` posições: hash32(`${no}#${i}`), i = 0..virtuais-1
//   remover(no): tira todas as posições desse nó
//   noPara(chave): o nó da PRIMEIRA posição do anel >= hash32(chave), dando a volta ao anel se for
//                  preciso (depois da última posição, vem a primeira). Error se o anel estiver vazio.
//   nos(): a lista dos nós, ordenada
// Dica: guarda as posições num array ORDENADO e procura com uma pesquisa binária.
export class Anel {
  constructor({ virtuais = 100 } = {}) {
    throw new Error('Por fazer: P3');
  }
}
