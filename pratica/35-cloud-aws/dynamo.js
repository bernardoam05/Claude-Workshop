// P3 · DynamoDB: uma tabela, chaves pensadas para as consultas, e escritas condicionais.
//
// A tabela "Notas" já existe (os testes criam-na) com uma chave composta:
//   PK (partition key, string) e SK (sort key, string)
// Desenho ("single-table"): todas as notas de um utilizador ficam na mesma partição.
//   PK = "USER#<utilizador>"     SK = "NOTA#<id>"
// e cada item tem ainda: titulo, feita (booleano) e versao (número).
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'; // eslint-disable-line no-unused-vars

export const TABELA = 'Notas';

// criarNota(ddb, { utilizador, id, titulo }): feita = false, versao = 1.
// Se já existir uma nota com essa PK+SK, lança um Error com "existe" (ConditionExpression
// "attribute_not_exists(PK)"; o erro do SDK tem name "ConditionalCheckFailedException").
export async function criarNota(ddb, { utilizador, id, titulo }) {
  throw new Error('Por fazer: P3');
}

// notasDe(ddb, utilizador) → [{ id, titulo, feita, versao }], ordenadas pelo id.
// Uma Query (NUNCA um Scan) à partição do utilizador, com begins_with(SK, "NOTA#").
export async function notasDe(ddb, utilizador) {
  throw new Error('Por fazer: P3');
}

// marcarFeita(ddb, utilizador, id, versaoEsperada) → a nota atualizada ({ id, titulo, feita, versao })
// Põe feita = true e soma 1 à versao, MAS SÓ SE a versão atual for a esperada (bloqueio otimista):
// se alguém a alterou entretanto (ou se não existir), lança um Error com "conflito".
// (UpdateCommand com ConditionExpression "versao = :esperada" e ReturnValues: "ALL_NEW")
export async function marcarFeita(ddb, utilizador, id, versaoEsperada) {
  throw new Error('Por fazer: P3');
}
