import express from 'express';
import { fileURLToPath } from 'node:url';
import { getMenu, getToppings } from './database.js';
import { createAuthRouter } from './auth.js';
import { createOrderRouter } from './orders.js';
import { createEmployeeRouter, getEmployee } from './employees.js';

export function createApp(database, { trustProxy = false } = {}) {
  const app = express();
  if (trustProxy) app.set('trust proxy', trustProxy);
  app.disable('x-powered-by');
  app.use((_request, response, next) => {
    response.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    });
    next();
  });
  app.use('/api', (_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.get('/healthz', (_request, response) => {
    database.prepare('SELECT 1').get();
    response
      .set('Cache-Control', 'no-store')
      .json({ status: 'ok', service: 'luigis-pizzeria' });
  });
  app.use('/api', (request, response, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const expectedOrigin =
        process.env.APP_ORIGIN ||
        `${request.protocol}://${request.get('host')}`;
      if (
        request.get('origin') !== expectedOrigin ||
        !request.is('application/json')
      ) {
        return response.status(403).json({
          error: 'Please submit this request from the restaurant website.',
        });
      }
    }
    next();
  });
  app.use('/api/employee', createEmployeeRouter(database));
  app.use('/api/auth', createAuthRouter(database));
  app.use('/api/orders', createOrderRouter(database));
  app.get('/api/menu', (_request, response) =>
    response.json(getMenu(database)),
  );
  app.get('/api/toppings', (_request, response) =>
    response.json(getToppings(database)),
  );
  app.use('/api', (_request, response) =>
    response.status(404).json({ error: 'Page not found.' }),
  );
  // Serve only public pages and assets; never expose source, SQL, or database files.
  const rootPath = fileURLToPath(new URL('../Frontend/', import.meta.url));
  app.get('/employee.html', (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (!getEmployee(database, request))
      return response.redirect('./employee-login.html');
    response.sendFile('employee.html', { root: rootPath });
  });
  app.use('/assets', express.static(`${rootPath}/assets`));
  app.use('/js', express.static(`${rootPath}/js`));
  app.get(
    [
      '/',
      '/index.html',
      '/menu.html',
      '/about.html',
      '/login.html',
      '/employee-login.html',
      '/visit.html',
      '/order.html',
    ],
    (request, response) => {
      response.sendFile(
        request.path === '/' ? 'index.html' : request.path.slice(1),
        { root: rootPath },
      );
    },
  );
  app.use((error, _request, response, _next) => {
    const status =
      error.status >= 400 && error.status < 500 ? error.status : 500;
    response.status(status).json({
      error:
        status === 500
          ? 'Something went wrong. Please try again.'
          : 'Invalid request.',
    });
  });
  return app;
}
