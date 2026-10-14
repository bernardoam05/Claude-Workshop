import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from './config.js';

describe('P1 · loadConfig', () => {
  it('usa valores por omissão quando o ambiente está vazio', () => {
    assert.deepEqual(loadConfig({}), {
      port: 3000,
      nodeEnv: 'development',
      isProduction: false,
      databaseUrl: null,
    });
  });

  it('converte PORT de string para número', () => {
    assert.equal(loadConfig({ PORT: '8080' }).port, 8080);
  });

  it('rejeita PORT que não é um inteiro válido', () => {
    for (const PORT of ['abc', '3000.5', '0', '70000', '']) {
      assert.throws(() => loadConfig({ PORT }), /PORT/, `PORT="${PORT}" devia ser rejeitada`);
    }
  });

  it('em produção exige DATABASE_URL', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /DATABASE_URL/);
  });

  it('em produção com DATABASE_URL devolve tudo preenchido', () => {
    const config = loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x', PORT: '4000' });
    assert.deepEqual(config, {
      port: 4000,
      nodeEnv: 'production',
      isProduction: true,
      databaseUrl: 'postgres://x',
    });
  });

  it('não modifica o objeto que recebe', () => {
    const env = Object.freeze({ PORT: '1234' });
    assert.doesNotThrow(() => loadConfig(env));
  });
});
