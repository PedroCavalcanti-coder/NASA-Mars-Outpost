// Teste ponta a ponta contra o servidor em http://localhost:3001 (rode `npm run dev:server` antes).
// Cria usuários descartáveis "zt_*" no banco e os apaga no fim. Uso: npm run smoke
import { neon } from '@neondatabase/serverless';
import { io } from 'socket.io-client';

const BASE = 'http://localhost:3001';
const ORIGIN = 'http://localhost:5173';
const tag = Math.random().toString(36).slice(2, 7);
let pass = 0;
let fail = 0;
const ok = (cond, name, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? '  ✔' : '  ✘'} ${name}${cond ? '' : ` ${extra}`}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Client {
  jar = new Map();
  async req(method, path, body, headers = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        Origin: ORIGIN,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Cookie: [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv, ...attrs] = c.split(';');
      const [k, ...v] = kv.split('=');
      const val = v.join('=');
      if (!val || attrs.some((a) => /max-age=0|expires=thu, 01 jan 1970/i.test(a)))
        this.jar.delete(k);
      else this.jar.set(k, val);
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
  }
  async socket() {
    const t = await this.req('POST', '/api/auth/socket-ticket');
    const s = io(BASE, { transports: ['websocket'], auth: { ticket: t.body.ticket } });
    s.events = [];
    for (const e of [
      'friend:request',
      'friend:accepted',
      'friend:removed',
      'presence:update',
      'presence:list',
      'dm:message',
      'dm:read',
      'session:revoked',
    ])
      s.on(e, (p) => s.events.push([e, p]));
    await new Promise((res, rej) => {
      s.on('connect', res);
      s.on('connect_error', rej);
    });
    return s;
  }
}
const got = (s, name) => s.events.find(([e]) => e === name)?.[1];
const emit = (s, ev, payload) => new Promise((r) => s.emit(ev, payload, r));

const A = new Client();
const B = new Client();
const C = new Client();
const users = {
  A: {
    name: 'Teste A',
    username: `zt_a_${tag}`,
    email: `zt_a_${tag}@example.test`,
    password: 'senha-forte-de-teste-1',
  },
  B: {
    name: 'Teste B',
    username: `zt_b_${tag}`,
    email: `zt_b_${tag}@example.test`,
    password: 'senha-forte-de-teste-2',
  },
  C: {
    name: 'Teste C',
    username: `zt_c_${tag}`,
    email: `zt_c_${tag}@example.test`,
    password: 'senha-forte-de-teste-3',
  },
};

try {
  console.log('Cadastro e sessão');
  let r = await A.req('POST', '/api/auth/register', users.A);
  ok(
    r.status === 201 && r.body.username === users.A.username,
    'cadastra A',
    JSON.stringify(r.body),
  );
  ok(!('passwordHash' in r.body) && !('password' in r.body), 'resposta não vaza senha/hash');
  ok(A.jar.has('mo_at') && A.jar.has('mo_rt'), 'cookies de acesso e refresh definidos');
  r = await B.req('POST', '/api/auth/register', users.B);
  ok(r.status === 201, 'cadastra B');
  r = await C.req('POST', '/api/auth/register', users.C);
  ok(r.status === 201, 'cadastra C');
  r = await new Client().req('POST', '/api/auth/register', users.A);
  ok(r.status === 409, 'duplicado -> 409', JSON.stringify(r.body));
  r = await new Client().req('POST', '/api/auth/register', {
    ...users.A,
    email: 'outro@example.test',
  });
  ok(r.status === 409 && r.body.fields?.username, 'apelido repetido -> 409 com campo');
  r = await new Client().req('POST', '/api/auth/register', {
    ...users.A,
    username: 'admin',
    email: 'x@example.test',
  });
  ok(r.status === 409, 'apelido reservado bloqueado');
  r = await new Client().req('POST', '/api/auth/register', { ...users.A, password: 'curta' });
  ok(r.status === 400 && r.body.fields?.password, 'senha curta -> 400');
  r = await A.req('GET', '/api/auth/me');
  ok(r.status === 200 && r.body.email === users.A.email, '/me autenticado');
  r = await new Client().req('GET', '/api/auth/me');
  ok(r.status === 401, '/me anônimo -> 401');
  r = await A.req('POST', '/api/auth/login', users.A, { Origin: 'https://evil.example' });
  ok(r.status === 403, 'Origin estranha -> 403 (CSRF)');
  r = await new Client().req('POST', '/api/auth/login', {
    email: users.A.email,
    password: 'errada-errada',
  });
  ok(r.status === 401 && r.body.error === 'E-mail ou senha incorretos', 'senha errada -> 401');
  r = await new Client().req('POST', '/api/auth/login', {
    email: 'ninguem@example.test',
    password: 'errada-errada',
  });
  ok(
    r.status === 401 && r.body.error === 'E-mail ou senha incorretos',
    'e-mail inexistente -> mesma mensagem',
  );

  console.log('Bloqueio por tentativas');
  const bad = new Client();
  for (let i = 0; i < 5; i++)
    r = await bad.req('POST', '/api/auth/login', {
      email: users.C.email,
      password: 'errada-errada',
    });
  r = await bad.req('POST', '/api/auth/login', users.C);
  ok(
    r.status === 429,
    'conta bloqueada depois de 5 erros (mesmo com senha certa)',
    String(r.status),
  );

  console.log('Amigos + tempo real');
  const sA = await A.socket();
  const sB = await B.socket();
  await sleep(300);
  ok(Array.isArray(got(sA, 'presence:list')), 'A recebe presence:list');
  r = await A.req('GET', `/api/users/search?q=${users.B.username.slice(0, 6)}`);
  ok(
    r.body?.some((u) => u.username === users.B.username && u.relation === 'none') &&
      !r.body.some((u) => 'email' in u),
    'busca acha B sem expor e-mail',
    JSON.stringify(r.body),
  );
  r = await A.req('POST', '/api/friends', { username: users.B.username });
  ok(r.status === 200 && r.body.status === 'pending', 'A pede amizade a B');
  const friendshipId = r.body.id;
  await sleep(400);
  ok(
    got(sB, 'friend:request')?.user.username === users.A.username,
    'B recebe friend:request em tempo real',
  );
  r = await A.req('POST', '/api/friends', { username: users.B.username });
  ok(r.status === 409, 'pedido repetido -> 409');
  r = await B.req('GET', '/api/friends');
  ok(r.body.incoming.length === 1, 'B vê pedido recebido');
  r = await A.req('POST', `/api/friends/${friendshipId}/accept`);
  ok(r.status === 404, 'solicitante não pode aceitar o próprio pedido');
  r = await B.req('POST', `/api/friends/${friendshipId}/accept`);
  ok(r.status === 200, 'B aceita');
  await sleep(400);
  ok(got(sA, 'friend:accepted')?.user.username === users.B.username, 'A recebe friend:accepted');
  r = await A.req('GET', '/api/friends');
  ok(r.body.friends.length === 1 && r.body.friends[0].online === true, 'A vê B online na lista');

  console.log('Mensagens diretas');
  let ack = await emit(sA, 'dm:send', {
    to: (await B.req('GET', '/api/auth/me')).body.id,
    text: 'Olá, Marte! 🚀',
  });
  ok(ack.ok && ack.message.text === 'Olá, Marte! 🚀', 'A envia DM (ack)');
  await sleep(300);
  const idA = (await A.req('GET', '/api/auth/me')).body.id;
  const idB = (await B.req('GET', '/api/auth/me')).body.id;
  ok(got(sB, 'dm:message')?.text === 'Olá, Marte! 🚀', 'B recebe DM em tempo real');
  r = await B.req('GET', '/api/messages/unread');
  ok(r.body[idA] === 1, 'B tem 1 não lida de A');
  ack = await emit(sB, 'dm:read', { from: idA });
  await sleep(300);
  ok(got(sA, 'dm:read')?.by === idB, 'A é avisado da leitura');
  r = await B.req('GET', `/api/messages/${idA}`);
  ok(r.body.length === 1 && r.body[0].readAt, 'histórico traz a mensagem lida');
  ack = await emit(sA, 'dm:send', {
    to: (await C.req('GET', '/api/auth/me')).body?.id ?? idB.replace(/.$/, '0'),
    text: 'oi',
  });
  ok(!ack.ok, 'DM para quem não é amigo é recusada', JSON.stringify(ack));
  ack = await emit(sA, 'dm:send', { to: idB, text: 'x'.repeat(501) });
  ok(!ack.ok, 'mensagem acima do limite recusada');
  r = await C.req('GET', `/api/messages/${idA}`);
  ok(r.status === 401 || r.status === 403, 'não-amigo não lê histórico', String(r.status));

  console.log('Tokens: refresh, rotação e reutilização');
  const oldRefresh = A.jar.get('mo_rt');
  const oldAccess = A.jar.get('mo_at');
  r = await A.req('POST', '/api/auth/refresh');
  ok(r.status === 200 && A.jar.get('mo_rt') !== oldRefresh, 'refresh gira o refresh token');
  ok(A.jar.get('mo_at') !== oldAccess, 'refresh emite novo token de acesso');
  const stolen = new Client();
  stolen.jar.set('mo_rt', oldRefresh);
  r = await stolen.req('POST', '/api/auth/refresh');
  ok(
    r.status === 200 && !r.headers.getSetCookie().some((c) => c.startsWith('mo_rt=')),
    'reuso dentro da janela (2 abas): só novo acesso, sem novo refresh',
  );
  console.log('  … aguardando a janela de tolerância (16 s)');
  await sleep(16000);
  const thief = new Client();
  thief.jar.set('mo_rt', oldRefresh);
  r = await thief.req('POST', '/api/auth/refresh');
  ok(r.status === 401, 'reuso fora da janela -> 401');
  await sleep(500);
  r = await A.req('GET', '/api/auth/me');
  ok(r.status === 401, 'sessão inteira revogada após reuso (ladrão e dono)');
  ok(
    sA.events.some(([e]) => e === 'session:revoked'),
    'socket de A recebeu session:revoked',
  );
  ok(!sA.connected, 'socket de A foi desconectado');

  console.log('Senha e sessões');
  r = await A.req('POST', '/api/auth/login', users.A);
  ok(r.status === 200, 'A entra de novo');
  const A2 = new Client();
  await A2.req('POST', '/api/auth/login', users.A);
  r = await A.req('GET', '/api/auth/sessions');
  ok(
    r.body.length === 2 && r.body.filter((s) => s.current).length === 1,
    'lista 2 sessões, uma atual',
  );
  const s2 = await A2.socket();
  r = await A.req('POST', '/api/auth/change-password', {
    current: 'errada-errada-1',
    next: 'nova-senha-forte-9',
  });
  ok(r.status === 401, 'trocar senha exige a atual');
  r = await A.req('POST', '/api/auth/change-password', {
    current: users.A.password,
    next: 'nova-senha-forte-9',
  });
  ok(r.status === 200, 'troca de senha');
  await sleep(400);
  r = await A2.req('GET', '/api/auth/me');
  ok(r.status === 401, 'outro dispositivo foi deslogado');
  ok(
    !s2.connected && s2.events.some(([e]) => e === 'session:revoked'),
    'socket do outro dispositivo foi derrubado',
  );
  r = await A.req('GET', '/api/auth/me');
  ok(r.status === 200, 'dispositivo atual continua logado');
  r = await new Client().req('POST', '/api/auth/login', users.A);
  ok(r.status === 401, 'senha antiga não funciona mais');
  r = await new Client().req('POST', '/api/auth/login', {
    ...users.A,
    password: 'nova-senha-forte-9',
  });
  ok(r.status === 200, 'senha nova funciona');

  console.log('Redefinição de senha');
  r = await new Client().req('POST', '/api/auth/forgot-password', {
    email: 'ninguem@example.test',
  });
  ok(r.status === 200 && r.body.ok, 'e-mail inexistente também responde 200');
  r = await new Client().req('POST', '/api/auth/reset-password', {
    token: 'x'.repeat(43),
    password: 'qualquer-senha-12',
  });
  ok(r.status === 400, 'token inválido -> 400');

  console.log('Remoção e logout');
  r = await B.req('DELETE', `/api/friends/${friendshipId}`);
  ok(r.status === 200, 'B desfaz a amizade');
  r = await A.req('POST', '/api/auth/logout');
  ok(r.status === 200 && !A.jar.has('mo_at'), 'logout limpa cookies');
  r = await A.req('GET', '/api/auth/me');
  ok(r.status === 401, 'após logout -> 401');
  sB.close();

  console.log('Cabeçalhos');
  const h = await fetch(`${BASE}/api/health`);
  ok(
    h.headers.get('x-content-type-options') === 'nosniff' &&
      !!h.headers.get('content-security-policy'),
    'helmet ativo (nosniff + CSP)',
  );
  ok(h.headers.get('x-powered-by') === null, 'sem X-Powered-By');
} catch (e) {
  fail++;
  console.error('ERRO INESPERADO', e);
} finally {
  const sql = neon(process.env.DATABASE_URL);
  const del =
    await sql`delete from outpost.users where username like ${`zt\\_%\\_${tag}`} returning id`;
  console.log(`\nLimpeza: ${del.length} usuários de teste removidos.`);
  console.log(`\n${pass} ok, ${fail} falhas`);
  process.exit(fail ? 1 : 0);
}
