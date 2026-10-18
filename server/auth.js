import { Router } from 'express';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const deriveKey = promisify(scrypt);
const SESSION_DURATION = 1000 * 60 * 60 * 12;
const COOKIE_NAME = 'luigiSession';

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function getToken(request) {
  return (
    (request.headers.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_NAME}=`))
      ?.slice(COOKIE_NAME.length + 1) || ''
  );
}

export function getCustomer(database, request) {
  return database
    .prepare(
      `SELECT c.customerID AS customerId, c.firstName, c.lastName, c.email
    FROM customer_sessions s JOIN Customer c ON c.customerID = s.customer_id
    WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hashToken(getToken(request)), Date.now());
}

export function requireCustomer(database) {
  return (request, response, next) => {
    request.customer = getCustomer(database, request);
    if (!request.customer) {
      return response.status(401).json({ error: 'Please log in to continue.' });
    }
    next();
  };
}

export function createAuthRouter(database) {
  const router = Router();
  const attempts = new Map();
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.SECURE_COOKIES === 'true',
    path: '/',
  };

  function startSession(request, response, customerId) {
    database
      .prepare(
        'DELETE FROM customer_sessions WHERE token_hash = ? OR expires_at <= ?',
      )
      .run(hashToken(getToken(request)), Date.now());
    const token = randomBytes(32).toString('hex');
    database
      .prepare(
        'INSERT INTO customer_sessions (token_hash, customer_id, expires_at) VALUES (?, ?, ?)',
      )
      .run(hashToken(token), customerId, Date.now() + SESSION_DURATION);
    response.cookie(COOKIE_NAME, token, {
      ...cookieOptions,
      maxAge: SESSION_DURATION,
    });
  }

  router.get('/session', (request, response) => {
    response.json({ customer: getCustomer(database, request) || null });
  });

  router.use(['/login', '/register'], (request, response, next) => {
    const now = Date.now();
    for (const [key, attempt] of attempts) {
      if (attempt.resetAt <= now) attempts.delete(key);
    }
    const key = request.ip;
    const attempt = attempts.get(key) || {
      count: 0,
      resetAt: now + 15 * 60 * 1000,
    };
    attempt.count += 1;
    attempts.set(key, attempt);
    if (attempt.count > 20) {
      response.set(
        'Retry-After',
        String(Math.ceil((attempt.resetAt - now) / 1000)),
      );
      return response
        .status(429)
        .json({ error: 'Too many attempts. Try again in 15 minutes.' });
    }
    next();
  });

  router.post('/register', async (request, response) => {
    const { firstName, lastName, password } = request.body || {};
    const email =
      typeof request.body?.email === 'string'
        ? request.body.email.trim().toLowerCase()
        : '';
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      ![firstName, lastName].every(
        (name) =>
          typeof name === 'string' &&
          name.trim().length > 0 &&
          name.trim().length <= 60,
      ) ||
      typeof password !== 'string' ||
      password.length < 8 ||
      password.length > 128
    ) {
      return response.status(400).json({
        error:
          'Enter your name, a valid email, and a password with 8–128 characters.',
      });
    }
    const salt = randomBytes(16).toString('hex');
    const key = await deriveKey(password, salt, 64);
    try {
      const result = database
        .prepare(
          'INSERT INTO Customer (firstName, lastName, email, passwordHash) VALUES (?, ?, ?, ?)',
        )
        .run(
          firstName.trim(),
          lastName.trim(),
          email,
          `${salt}:${key.toString('hex')}`,
        );
      startSession(request, response, Number(result.lastInsertRowid));
      response.status(201).json({
        customer: getCustomer(database, {
          headers: {
            cookie: response.getHeader('Set-Cookie')[0].split(';')[0],
          },
        }),
      });
    } catch (error) {
      if (
        error.code === 'ERR_SQLITE_ERROR' &&
        error.message.includes('UNIQUE')
      ) {
        return response.status(409).json({
          error: 'An account already uses this email. Try logging in.',
        });
      }
      throw error;
    }
  });

  router.post('/login', async (request, response) => {
    const email =
      typeof request.body?.email === 'string'
        ? request.body.email.trim().toLowerCase()
        : '';
    const password = request.body?.password;
    if (
      !email ||
      email.length > 254 ||
      typeof password !== 'string' ||
      password.length < 8 ||
      password.length > 128
    ) {
      return response
        .status(401)
        .json({ error: 'Email or password is incorrect.' });
    }
    const customer = database
      .prepare(
        'SELECT customerID AS customerId, passwordHash FROM Customer WHERE LOWER(email) = ?',
      )
      .get(email);
    const [salt, storedHash] = (
      customer?.passwordHash || `${'0'.repeat(32)}:${'0'.repeat(128)}`
    ).split(':');
    const key = await deriveKey(password, salt, 64);
    const expectedKey = Buffer.from(storedHash || '', 'hex');
    if (
      !customer ||
      expectedKey.length !== key.length ||
      !timingSafeEqual(key, expectedKey)
    ) {
      return response
        .status(401)
        .json({ error: 'Email or password is incorrect.' });
    }
    startSession(request, response, customer.customerId);
    response.json({ message: 'Logged in.' });
  });

  router.post('/logout', (request, response) => {
    database
      .prepare('DELETE FROM customer_sessions WHERE token_hash = ?')
      .run(hashToken(getToken(request)));
    response.clearCookie(COOKIE_NAME, cookieOptions);
    response.json({ message: 'Logged out.' });
  });
  return router;
}
