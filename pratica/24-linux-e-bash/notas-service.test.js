import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

// Lê uma unidade do systemd (um ficheiro INI) para { Secção: { Chave: [valores] } }.
function lerUnidade() {
  const texto = readFileSync(new URL('./notas.service', import.meta.url), 'utf8');
  const unidade = {};
  let seccao = null;
  for (const bruta of texto.split('\n')) {
    const linha = bruta.trim();
    if (!linha || linha.startsWith('#') || linha.startsWith(';')) continue;
    const s = linha.match(/^\[(.+)\]$/);
    if (s) {
      seccao = unidade[s[1]] ??= {};
      continue;
    }
    const [chave, ...resto] = linha.split('=');
    assert.ok(seccao, `"${linha}" está fora de qualquer [Secção]`);
    (seccao[chave.trim()] ??= []).push(resto.join('=').trim());
  }
  return unidade;
}

const um = (u, s, k) => u[s]?.[k]?.at(-1);
const todos = (u, s, k) => (u[s]?.[k] ?? []).flatMap((v) => v.split(/\s+/));

describe('P5 · notas.service', () => {
  it('tem as três secções', () => {
    assert.deepEqual(Object.keys(lerUnidade()).sort(), ['Install', 'Service', 'Unit']);
  });

  it('[Unit]: descrição e espera pela rede', () => {
    const u = lerUnidade();
    assert.equal(um(u, 'Unit', 'Description'), 'API de notas');
    assert.ok(todos(u, 'Unit', 'After').includes('network-online.target'));
    assert.ok(todos(u, 'Unit', 'Wants').includes('network-online.target'), 'sem Wants=, o After= não puxa o alvo');
  });

  it('[Service]: o que corre, onde, e como quem', () => {
    const u = lerUnidade();
    assert.equal(um(u, 'Service', 'ExecStart'), '/usr/bin/node /opt/notas/server.js');
    assert.equal(um(u, 'Service', 'WorkingDirectory'), '/opt/notas');
    assert.equal(um(u, 'Service', 'User'), 'notas');
    assert.equal(um(u, 'Service', 'Group'), 'notas');
  });

  it('[Service]: ambiente e segredos num ficheiro à parte', () => {
    const u = lerUnidade();
    const env = todos(u, 'Service', 'Environment');
    assert.ok(env.includes('PORT=3000') && env.includes('NODE_ENV=production'), `Environment: ${env}`);
    assert.equal(um(u, 'Service', 'EnvironmentFile'), '/etc/notas/segredos.env');
  });

  it('[Service]: reinicia quando falha, com 5 s de espera', () => {
    const u = lerUnidade();
    assert.equal(um(u, 'Service', 'Restart'), 'on-failure');
    assert.equal(um(u, 'Service', 'RestartSec'), '5');
  });

  it('[Service]: proteções', () => {
    const u = lerUnidade();
    assert.equal(um(u, 'Service', 'NoNewPrivileges'), 'true');
    assert.equal(um(u, 'Service', 'ProtectSystem'), 'strict');
    assert.equal(um(u, 'Service', 'PrivateTmp'), 'true');
    assert.equal(um(u, 'Service', 'ReadWritePaths'), '/var/lib/notas');
  });

  it('[Install]: arranca com o sistema', () => {
    assert.equal(um(lerUnidade(), 'Install', 'WantedBy'), 'multi-user.target');
  });
});
