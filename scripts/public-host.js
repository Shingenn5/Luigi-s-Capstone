export function publicHostOrigin(value = '') {
  if (!value.trim()) return '';
  const url = new URL(value.trim());
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    url.hostname.endsWith('.github.io') ||
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  ) {
    throw new Error(
      'FULL_APP_URL must be the public HTTPS origin of the Node app, not GitHub Pages or localhost.',
    );
  }
  return url.origin;
}

export function hostedEntryHtml(origin, page) {
  const destination = `${origin}/${page}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Open Luigi's Pizzeria</title><link rel="stylesheet" href="./assets/bootswatch-simplex.min.css" />
<script type="module" src="./js/open-hosted-app.js"></script></head>
<body><main class="container py-5"><h1>Luigi's Pizzeria</h1><p>Opening the full website for sign-in, ordering, and employee access.</p>
<a class="btn btn-primary py-3 px-4" id="hostedAppLink" href="${destination}">Open the full website</a>
<p class="mt-3">If the website does not open automatically, use the link above.</p></main></body></html>`;
}
