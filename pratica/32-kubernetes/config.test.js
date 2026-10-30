import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contentor, lerManifests, obter } from './ajuda.js';

const objetos = () => lerManifests('config.yaml');

describe('P2 · config.yaml', () => {
  it('cria o Namespace "workshop" e põe lá tudo o resto', () => {
    const lista = objetos();
    obter(lista, 'Namespace', 'workshop');
    for (const o of lista.filter((x) => x.kind !== 'Namespace')) {
      assert.equal(o.metadata?.namespace, 'workshop', `${o.kind}/${o.metadata?.name} não está no namespace "workshop"`);
    }
  });

  it('ConfigMap com LOG_LEVEL e CACHE_TTL_SECONDS, ambos como strings', () => {
    const cm = obter(objetos(), 'ConfigMap', 'notas-config');
    assert.deepEqual(cm.data, { LOG_LEVEL: 'info', CACHE_TTL_SECONDS: '60' }, 'num ConfigMap, 60 sem aspas é um número e o kubectl recusa-o');
  });

  it('Secret escrito em claro com stringData (o Kubernetes codifica em base64 sozinho)', () => {
    const s = obter(objetos(), 'Secret', 'notas-secrets');
    assert.equal(s.type ?? 'Opaque', 'Opaque');
    assert.deepEqual(s.stringData, { DATABASE_URL: 'postgres://notas:notas@postgres:5432/notas' });
    assert.equal(s.data, undefined, 'usa stringData, não data (data exigia o valor já em base64)');
  });

  it('o worker recebe o ConfigMap inteiro com envFrom', () => {
    const dep = obter(objetos(), 'Deployment', 'notas-worker');
    assert.equal(dep.spec?.replicas, 1);
    const c = contentor(dep.spec?.template?.spec);
    assert.equal(c.image, 'workshop/notas-worker:1.0.0');
    assert.deepEqual(c.envFrom, [{ configMapRef: { name: 'notas-config' } }]);
  });

  it('e só a DATABASE_URL do Secret, com secretKeyRef', () => {
    const c = contentor(obter(objetos(), 'Deployment', 'notas-worker').spec?.template?.spec);
    const db = c.env?.find((e) => e.name === 'DATABASE_URL');
    assert.ok(db, 'falta a variável DATABASE_URL em env');
    assert.deepEqual(db.valueFrom, { secretKeyRef: { name: 'notas-secrets', key: 'DATABASE_URL' } });
    assert.equal(db.value, undefined, 'o valor vem do Secret, nunca escrito aqui');
  });

  it('o selector do worker coincide com as labels dos seus pods', () => {
    const dep = obter(objetos(), 'Deployment', 'notas-worker');
    assert.deepEqual(dep.spec?.template?.metadata?.labels, { app: 'notas-worker' });
    assert.deepEqual(dep.spec?.selector?.matchLabels, { app: 'notas-worker' });
  });
});
