import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword } from './passwords.js';
import { readOrderItems } from './orders.js';
import { createKitchenRouter } from './kitchen.js';

const COOKIE_NAME = 'luigiEmployeeSession';
const SESSION_DURATION = 8 * 60 * 60 * 1000;

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

export async function createEmployee(
  database,
  { username, displayName, password, role = 'employee' },
  { adminId } = {},
) {
  if (
    typeof username !== 'string' ||
    !/^[a-zA-Z0-9._-]{3,32}$/.test(username.trim()) ||
    typeof displayName !== 'string' ||
    !displayName.trim() ||
    displayName.trim().length > 80 ||
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 128 ||
    !['employee', 'admin'].includes(role)
  ) {
    throw new Error(
      'Use a 3–32 character username, a display name (1–80 characters), an 8–128 character password, and an employee or admin role.',
      { cause: 'validation' },
    );
  }
  const passwordHash = await hashPassword(password);
  // Password hashing yields; recheck privileges before the synchronous insert.
  if (
    adminId !== undefined &&
    !database
      .prepare(
        "SELECT employee_id FROM employees WHERE employee_id = ? AND role = 'admin' AND is_active = 1",
      )
      .get(adminId)
  ) {
    throw Object.assign(new Error('An active admin account is required.'), {
      status: 403,
    });
  }
  try {
    const result = database
      .prepare(
        'INSERT INTO employees (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)',
      )
      .run(
        username.trim().toLowerCase(),
        displayName.trim(),
        passwordHash,
        role,
      );
    return Number(result.lastInsertRowid);
  } catch (error) {
    if (error.message.includes('UNIQUE'))
      throw Object.assign(
        new Error('That employee username already exists.', {
          cause: error,
        }),
        { status: 409 },
      );
    throw error;
  }
}

export function getEmployee(database, request) {
  return database
    .prepare(
      `SELECT e.employee_id AS employeeId, e.username, e.display_name AS displayName, e.role
    FROM employee_sessions s JOIN employees e ON e.employee_id = s.employee_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND e.is_active = 1`,
    )
    .get(hashToken(getToken(request)), Date.now());
}

function requireEmployee(database) {
  return (request, response, next) => {
    request.employee = getEmployee(database, request);
    if (!request.employee)
      return response
        .status(401)
        .json({ error: 'Please log in with an active employee account.' });
    next();
  };
}

export function createEmployeeRouter(database) {
  const router = Router();
  const attempts = new Map();
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.SECURE_COOKIES === 'true',
    path: '/',
  };
  router.get('/auth/session', (request, response) => {
    response.json({ employee: getEmployee(database, request) || null });
  });
  router.post(
    '/accounts',
    requireEmployee(database),
    async (request, response, next) => {
      if (request.employee.role !== 'admin') {
        return response
          .status(403)
          .json({ error: 'Only admins can create staff accounts.' });
      }
      try {
        const employeeId = await createEmployee(database, request.body || {}, {
          adminId: request.employee.employeeId,
        });
        const employee = database
          .prepare(
            'SELECT employee_id AS employeeId, username, display_name AS displayName, role FROM employees WHERE employee_id = ?',
          )
          .get(employeeId);
        response.status(201).json({ employee });
      } catch (error) {
        const status = error.cause === 'validation' ? 400 : error.status;
        if ([400, 403, 409].includes(status))
          return response.status(status).json({ error: error.message });
        next(error);
      }
    },
  );
  router.post('/auth/login', async (request, response) => {
    const now = Date.now();
    for (const [key, attempt] of attempts) {
      if (attempt.resetAt <= now) attempts.delete(key);
    }
    const attempt = attempts.get(request.ip) || {
      count: 0,
      resetAt: now + 15 * 60 * 1000,
    };
    attempt.count += 1;
    attempts.set(request.ip, attempt);
    if (attempt.count > 20) {
      response.set(
        'Retry-After',
        String(Math.ceil((attempt.resetAt - now) / 1000)),
      );
      return response
        .status(429)
        .json({ error: 'Too many attempts. Try again in 15 minutes.' });
    }
    const username =
      typeof request.body?.username === 'string'
        ? request.body.username.trim().toLowerCase()
        : '';
    const password = request.body?.password;
    if (
      !/^[a-z0-9._-]{3,32}$/.test(username) ||
      typeof password !== 'string' ||
      password.length < 8 ||
      password.length > 128
    ) {
      return response
        .status(401)
        .json({ error: 'Employee username or password is incorrect.' });
    }
    const employee = database
      .prepare(
        'SELECT employee_id AS employeeId, password_hash AS passwordHash, is_active AS isActive FROM employees WHERE username = ?',
      )
      .get(username);
    const passwordValid = await verifyPassword(
      password,
      employee?.passwordHash,
    );
    if (!employee || !employee.isActive || !passwordValid) {
      return response
        .status(401)
        .json({ error: 'Employee username or password is incorrect.' });
    }
    // Recheck active status after password derivation, which yields to other requests.
    if (
      !database
        .prepare(
          'SELECT employee_id FROM employees WHERE employee_id = ? AND is_active = 1',
        )
        .get(employee.employeeId)
    ) {
      return response
        .status(401)
        .json({ error: 'Employee username or password is incorrect.' });
    }
    database
      .prepare(
        'DELETE FROM employee_sessions WHERE token_hash = ? OR expires_at <= ?',
      )
      .run(hashToken(getToken(request)), now);
    const token = randomBytes(32).toString('hex');
    database
      .prepare(
        'INSERT INTO employee_sessions (token_hash, employee_id, expires_at) VALUES (?, ?, ?)',
      )
      .run(
        hashToken(token),
        employee.employeeId,
        Date.now() + SESSION_DURATION,
      );
    response.cookie(COOKIE_NAME, token, {
      ...cookieOptions,
      maxAge: SESSION_DURATION,
    });
    response.json({ message: 'Employee logged in.' });
  });
  router.post('/auth/logout', (request, response) => {
    database
      .prepare('DELETE FROM employee_sessions WHERE token_hash = ?')
      .run(hashToken(getToken(request)));
    response.clearCookie(COOKIE_NAME, cookieOptions);
    response.json({ message: 'Employee logged out.' });
  });
  router.get('/orders', requireEmployee(database), (_request, response) => {
    const orders = database
      .prepare(
        `SELECT o.orderID AS orderId, o.customerName, o.phoneNumber,
      o.orderDate, o.totalCents, o.orderStatus, d.service_type AS serviceType
      FROM Orders o LEFT JOIN order_details d ON d.order_id = o.orderID
      WHERE o.orderStatus = 'Pending' ORDER BY o.orderID ASC LIMIT 50`,
      )
      .all();
    response.json(
      orders.map((order) => ({
        ...order,
        items: readOrderItems(database, order.orderId),
      })),
    );
  });
  router.use(['/kitchen', '/orders'], requireEmployee(database));
  router.use(createKitchenRouter(database));
  return router;
}
