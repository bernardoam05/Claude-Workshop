// P4 · A política IAM (politica.json). Pedido:
//   A API de notas, em produção, precisa de:
//     - ler e escrever ficheiros SÓ debaixo de uploads/ no bucket "notas-uploads"
//     - listar esse bucket, mas SÓ com o prefixo uploads/ (uma Condition com "s3:prefix")
//     - enviar mensagens para a fila "notas-eventos" (conta 123456789012, região eu-west-1)
//     - ler, criar, atualizar e consultar (Query) itens da tabela "Notas" (mesma conta e região)
//   Nada mais: nenhum "*" nas ações nem nos recursos, nada de Scan, de apagar tabelas ou buckets.
//
// Os testes avaliam a tua política com um mini-avaliador (abaixo) que faz o essencial do que a AWS faz:
// um pedido é permitido se alguma instrução Allow tiver a ação E o recurso (com * como wildcard)
// E as condições satisfeitas; e nenhuma instrução Deny o apanhar.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const politica = () => JSON.parse(readFileSync(new URL('./politica.json', import.meta.url), 'utf8'));
const lista = (x) => (Array.isArray(x) ? x : x === undefined ? [] : [x]);
const corresponde = (padrao, valor) =>
  new RegExp(`^${padrao.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(valor);

function condicoesOk(condicao = {}, contexto = {}) {
  return Object.entries(condicao).every(([operador, chaves]) =>
    Object.entries(chaves).every(([chave, valores]) => {
      const v = contexto[chave];
      if (v === undefined) return false;
      if (operador === 'StringLike') return lista(valores).some((p) => corresponde(p, v));
      if (operador === 'StringEquals') return lista(valores).includes(v);
      throw new Error(`operador de condição não suportado neste avaliador: ${operador}`);
    }),
  );
}

function permite(acao, recurso, contexto) {
  const instrucoes = lista(politica().Statement);
  const apanha = (s) =>
    lista(s.Action).some((a) => corresponde(a, acao)) &&
    lista(s.Resource).some((r) => corresponde(r, recurso)) &&
    condicoesOk(s.Condition, contexto);
  return instrucoes.some((s) => s.Effect === 'Allow' && apanha(s)) && !instrucoes.some((s) => s.Effect === 'Deny' && apanha(s));
}

const S3 = 'arn:aws:s3:::notas-uploads';
const FILA = 'arn:aws:sqs:eu-west-1:123456789012:notas-eventos';
const TABELA = 'arn:aws:dynamodb:eu-west-1:123456789012:table/Notas';

describe('P4 · política IAM de menor privilégio', () => {
  it('é uma política válida: Version 2012-10-17 e uma lista de Statement', () => {
    const p = politica();
    assert.equal(p.Version, '2012-10-17', 'a única versão atual da linguagem de políticas (não é uma data a mudar)');
    assert.ok(Array.isArray(p.Statement) && p.Statement.length > 0);
    assert.deepEqual(Object.keys(p).sort(), ['Statement', 'Version']);
    for (const s of p.Statement) {
      assert.ok(typeof s.Sid === 'string' && /^[A-Za-z0-9]+$/.test(s.Sid), 'cada instrução tem um Sid (só letras e números) que diz para que serve');
    }
  });

  it('permite o que a API precisa', () => {
    assert.ok(permite('s3:GetObject', `${S3}/uploads/ana/nota.md`), 'ler um upload');
    assert.ok(permite('s3:PutObject', `${S3}/uploads/ana/nota.md`), 'escrever um upload');
    assert.ok(permite('s3:ListBucket', S3, { 's3:prefix': 'uploads/ana/' }), 'listar os uploads');
    assert.ok(permite('sqs:SendMessage', FILA), 'publicar eventos');
    for (const a of ['GetItem', 'PutItem', 'UpdateItem', 'Query']) assert.ok(permite(`dynamodb:${a}`, TABELA), `dynamodb:${a}`);
  });

  it('não permite mais nada', () => {
    assert.ok(permite('s3:GetObject', `${S3}/uploads/x`), 'primeiro tem de permitir o que é preciso');
    assert.ok(!permite('s3:GetObject', `${S3}/backups/bd.sql`), 'ficheiros fora de uploads/');
    assert.ok(!permite('s3:DeleteObject', `${S3}/uploads/ana/nota.md`), 'apagar ficheiros');
    assert.ok(!permite('s3:ListBucket', S3, { 's3:prefix': 'backups/' }), 'listar fora de uploads/');
    assert.ok(!permite('s3:ListBucket', S3, {}), 'listar o bucket todo');
    assert.ok(!permite('s3:GetObject', 'arn:aws:s3:::outro-bucket/uploads/x'), 'outros buckets');
    assert.ok(!permite('sqs:ReceiveMessage', FILA), 'a API publica, não consome');
    assert.ok(!permite('sqs:SendMessage', 'arn:aws:sqs:eu-west-1:123456789012:outra-fila'), 'outras filas');
    assert.ok(!permite('dynamodb:Scan', TABELA), 'Scan');
    assert.ok(!permite('dynamodb:DeleteTable', TABELA), 'apagar a tabela');
    assert.ok(!permite('dynamodb:GetItem', 'arn:aws:dynamodb:eu-west-1:123456789012:table/Faturas'), 'outras tabelas');
    assert.ok(!permite('iam:CreateUser', '*'), 'mexer no IAM');
  });

  it('sem wildcards nas ações, nem recursos "*"', () => {
    for (const s of politica().Statement) {
      for (const a of lista(s.Action)) assert.ok(!a.includes('*'), `ação com wildcard: ${a}`);
      for (const r of lista(s.Resource)) assert.notEqual(r, '*', 'Resource "*" é "todos os recursos da conta"');
    }
  });
});
