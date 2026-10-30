import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { intervalo, ipParaNumero, naRede, numeroParaIp } from './ip.js';

describe('P1 · ip.js', () => {
  it('converte IPs em números de 32 bits e de volta', () => {
    assert.equal(ipParaNumero('192.168.1.10'), 3232235786);
    assert.equal(ipParaNumero('0.0.0.0'), 0);
    assert.equal(ipParaNumero('255.255.255.255'), 4294967295, 'sem sinal: cuidado com os operadores de bits do JS');
    assert.equal(numeroParaIp(3232235786), '192.168.1.10');
    assert.equal(numeroParaIp(4294967295), '255.255.255.255');
  });

  it('recusa IPs inválidos', () => {
    for (const ip of ['1.2.3', '1.2.3.4.5', '256.1.1.1', '1.2.3.x', '01.2.3.4', '', '1..2.3']) {
      assert.throws(() => ipParaNumero(ip), /IP/, ip);
    }
  });

  it('naRede', () => {
    assert.equal(naRede('192.168.1.77', '192.168.1.0/24'), true);
    assert.equal(naRede('192.168.2.1', '192.168.1.0/24'), false);
    assert.equal(naRede('172.31.255.255', '172.16.0.0/12'), true);
    assert.equal(naRede('172.32.0.1', '172.16.0.0/12'), false);
    assert.equal(naRede('8.8.8.8', '0.0.0.0/0'), true, '/0 é a Internet inteira');
    assert.equal(naRede('10.0.0.1', '10.0.0.1/32'), true, '/32 é um único IP');
    assert.equal(naRede('10.0.0.2', '10.0.0.1/32'), false);
  });

  it('intervalo de uma rede', () => {
    assert.deepEqual(intervalo('192.168.1.0/24'), { rede: '192.168.1.0', broadcast: '192.168.1.255', total: 256 });
    assert.deepEqual(intervalo('192.168.1.77/24'), { rede: '192.168.1.0', broadcast: '192.168.1.255', total: 256 });
    assert.deepEqual(intervalo('10.0.0.0/8'), { rede: '10.0.0.0', broadcast: '10.255.255.255', total: 16777216 });
    assert.deepEqual(intervalo('10.1.2.3/32'), { rede: '10.1.2.3', broadcast: '10.1.2.3', total: 1 });
    assert.deepEqual(intervalo('0.0.0.0/0'), { rede: '0.0.0.0', broadcast: '255.255.255.255', total: 4294967296 });
  });
});
