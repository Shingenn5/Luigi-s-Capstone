import { STATIC_PREVIEW } from './runtime-config.js';

export async function apiRequest(path, options = {}) {
  const isRead = !options.method || options.method === 'GET';
  let requestPath = `./api/${path}`;
  if (STATIC_PREVIEW) {
    if (isRead && path === 'auth/session') return { customer: null };
    if (isRead && path === 'employee/auth/session') return { employee: null };
    if (!isRead || !['menu', 'toppings'].includes(path)) {
      throw new Error(
        'Sign-in and sending orders are unavailable in this preview. You can browse the menu and build a draft order.',
      );
    }
    requestPath = `./api/${path}.json`;
  }
  let response;
  try {
    response = await fetch(requestPath, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new Error(
      'Cannot reach the server. Check your connection and try again.',
    );
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(
      'Account and ordering features require the Node server. Run npm start.',
    );
  }
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Unable to complete this request.');
    error.status = response.status;
    throw error;
  }
  return data;
}
