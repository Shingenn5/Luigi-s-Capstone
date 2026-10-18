export async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`./api/${path}`, {
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
  if (!response.ok)
    throw new Error(data.error || 'Unable to complete this request.');
  return data;
}
