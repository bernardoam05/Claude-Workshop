import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { test } from 'node:test';
import { createAuthService } from '../src/services/authService.js';

// Repositório falso em memória. Imita o comportamento do Postgres para emails duplicados (código 23505).
function fakeUserRepository() {
  const users = [];
  return {
    users,
    create: async (email, passwordHash) => {
      if (users.some((u) => u.email === email)) {
        throw Object.assign(new Error('duplicate key'), { code: '23505' });
      }
      const user = { id: users.length + 1, email, passwordHash };
      users.push(user);
      return { id: user.id, email: user.email };
    },
    findByEmail: async (email) => users.find((u) => u.email === email) ?? null,
  };
}

const SECRET = 'segredo-de-teste';
const makeService = (repo = fakeUserRepository()) =>
  createAuthService({ userRepository: repo, jwtSecret: SECRET, bcryptRounds: 4 });

test('register guarda o hash da password, nunca a password', async () => {
  const repo = fakeUserRepository();
  await makeService(repo).register('ana@exemplo.pt', 'password-segura');

  const stored = repo.users[0].passwordHash;
  assert.notEqual(stored, 'password-segura');
  assert.equal(await bcrypt.compare('password-segura', stored), true);
});

test('register devolve um token que o verifyToken aceita', async () => {
  const service = makeService();
  const { token, user } = await service.register('ana@exemplo.pt', 'password-segura');

  assert.equal(user.email, 'ana@exemplo.pt');
  assert.equal((await service.verifyToken(token)).userId, user.id);
});

test('register com email repetido devolve 409', async () => {
  const service = makeService();
  await service.register('ana@exemplo.pt', 'password-segura');

  await assert.rejects(service.register('ana@exemplo.pt', 'outra-password'), { status: 409 });
});

test('login com password errada devolve 401 (sem dizer qual dos campos falhou)', async () => {
  const service = makeService();
  await service.register('ana@exemplo.pt', 'password-segura');

  await assert.rejects(service.login('ana@exemplo.pt', 'errada-mesmo'), { status: 401 });
  await assert.rejects(service.login('nao-existe@exemplo.pt', 'password-segura'), { status: 401 });
});

test('login correto devolve token', async () => {
  const service = makeService();
  await service.register('ana@exemplo.pt', 'password-segura');

  const { token } = await service.login('ana@exemplo.pt', 'password-segura');
  assert.equal(typeof token, 'string');
});

test('verifyToken rejeita token assinado com outro segredo', async () => {
  const service = makeService();
  const { token } = await service.register('ana@exemplo.pt', 'password-segura');

  const outro = createAuthService({ userRepository: fakeUserRepository(), jwtSecret: 'outro-segredo' });
  await assert.rejects(outro.verifyToken(token));
});

// --- Modo Keycloak (OIDC). O verificador é falso: testamos a NOSSA lógica, não a criptografia do jose.

function fakeRepoWithExternal() {
  const repo = fakeUserRepository();
  repo.findOrCreateExternal = async (externalId, email) => {
    const existing = repo.users.find((u) => u.externalId === externalId);
    if (existing) return { id: existing.id, email: existing.email };
    if (repo.users.some((u) => u.email === email)) {
      throw Object.assign(new Error('duplicate key'), { code: '23505' });
    }
    const user = { id: repo.users.length + 1, email, externalId };
    repo.users.push(user);
    return { id: user.id, email };
  };
  return repo;
}

const fakeOidc = async (token) => {
  if (token === 'token-keycloak-alice') return { sub: 'kc-uuid-alice', email: 'alice@workshop.local' };
  throw new Error('assinatura inválida');
};

test('token do Keycloak cria o utilizador local na primeira vez e reutiliza-o depois', async () => {
  const repo = fakeRepoWithExternal();
  const service = createAuthService({ userRepository: repo, jwtSecret: SECRET, oidcVerify: fakeOidc });

  const first = await service.verifyToken('token-keycloak-alice');
  const second = await service.verifyToken('token-keycloak-alice');

  assert.equal(first.provider, 'keycloak');
  assert.equal(first.userId, second.userId);
  assert.equal(repo.users.length, 1);
});

test('token inválido para ambos os modos é rejeitado', async () => {
  const service = createAuthService({ userRepository: fakeRepoWithExternal(), jwtSecret: SECRET, oidcVerify: fakeOidc });

  await assert.rejects(service.verifyToken('lixo'));
});

test('Keycloak com email de uma conta local NÃO liga as contas (409, evita account takeover)', async () => {
  const repo = fakeRepoWithExternal();
  const service = createAuthService({ userRepository: repo, jwtSecret: SECRET, bcryptRounds: 4, oidcVerify: fakeOidc });
  await service.register('alice@workshop.local', 'password-local');

  await assert.rejects(service.verifyToken('token-keycloak-alice'), { status: 409 });
});

test('utilizador externo (sem password local) não consegue fazer login manual', async () => {
  const repo = fakeRepoWithExternal();
  const service = createAuthService({ userRepository: repo, jwtSecret: SECRET, oidcVerify: fakeOidc });
  await service.verifyToken('token-keycloak-alice');

  await assert.rejects(service.login('alice@workshop.local', 'qualquer-coisa'), { status: 401 });
});
