// Gera um JWT_SECRET forte (512 bits). Uso: npm run secret:jwt
// Copie a linha impressa para o seu .env (o .env nunca vai para o GitHub).
import { randomBytes } from 'node:crypto';

console.log(`JWT_SECRET=${randomBytes(64).toString('base64url')}`);
