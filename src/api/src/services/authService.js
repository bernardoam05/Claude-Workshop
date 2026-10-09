import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { HttpError } from '../middleware/errorHandler.js';

// Hash de um valor qualquer, calculado uma vez. Usado no login quando o email não existe (ver abaixo).
const DUMMY_HASH = bcrypt.hashSync('password-inexistente', 10);

// Regras de autenticação. Suporta DOIS modos, lado a lado, para os poderes comparar:
// 1) Manual: registo/login nesta API, JWT HS256 assinado por nós.
// 2) Keycloak (OIDC): o login acontece no Keycloak; a API só verifica o token (RS256) via oidcVerify.
export function createAuthService({
  userRepository,
  jwtSecret,
  jwtExpiresIn = '1h',
  bcryptRounds = 10,
  oidcVerify = null, // opcional: sem Keycloak configurado, só o modo manual funciona
}) {
  const issueToken = (userId) =>
    jwt.sign({ sub: String(userId) }, jwtSecret, { algorithm: 'HS256', expiresIn: jwtExpiresIn });

  // "algorithms" é obrigatório: sem ele, um token com alg "none" poderia ser aceite.
  const verifyLocal = (token) => {
    const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    return { userId: Number(payload.sub), provider: 'local' };
  };

  async function verifyExternal(token) {
    const claims = await oidcVerify(token);
    if (!claims.email) throw new Error('token sem email');
    try {
      const user = await userRepository.findOrCreateExternal(claims.sub, claims.email);
      return { userId: user.id, provider: 'keycloak' };
    } catch (err) {
      // O email já pertence a uma conta local. NÃO ligamos as contas automaticamente:
      // isso permitiria a quem controla um email no IdP apoderar-se de uma conta local (account takeover).
      if (err.code === '23505') throw new HttpError(409, 'Este email já tem uma conta local');
      throw err;
    }
  }

  return {
    async register(email, password) {
      // bcrypt faz o salt automaticamente e é deliberadamente lento: torna ataques de força bruta caros.
      const passwordHash = await bcrypt.hash(password, bcryptRounds);
      let user;
      try {
        user = await userRepository.create(email, passwordHash);
      } catch (err) {
        // 23505 = unique_violation no Postgres. Traduzimos o erro da BD para um erro de domínio.
        if (err.code === '23505') throw new HttpError(409, 'Email já registado');
        throw err;
      }
      return { user, token: issueToken(user.id) };
    },

    async login(email, password) {
      const user = await userRepository.findByEmail(email);
      // Fazemos sempre a comparação, mesmo que o utilizador não exista (ou seja externo, sem hash).
      // Sem isto, a resposta demorava mais quando o email existia, e um atacante descobria emails registados.
      const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
      if (!user?.passwordHash || !ok) throw new HttpError(401, 'Credenciais inválidas');

      return { user: { id: user.id, email: user.email }, token: issueToken(user.id) };
    },

    // Aceita um token de qualquer um dos dois modos. Lança erro se for inválido, adulterado ou expirado.
    async verifyToken(token) {
      try {
        return verifyLocal(token);
      } catch (localErr) {
        if (!oidcVerify) throw localErr;
        return verifyExternal(token);
      }
    },
  };
}
