import { cpSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { relative, join } from 'node:path';
import { openDatabase, getMenu, getToppings } from '../server/database.js';
import { publicHostOrigin, hostedEntryHtml } from './public-host.js';

const repositoryPath = fileURLToPath(new URL('../', import.meta.url));
const outputPath = join(repositoryPath, '.pages');
const hostedOrigin = publicHostOrigin(process.env.FULL_APP_URL);
if (relative(repositoryPath, outputPath) !== '.pages')
  throw new Error('Invalid Pages output directory.');
rmSync(outputPath, { recursive: true, force: true });
cpSync(join(repositoryPath, 'Frontend'), outputPath, { recursive: true });

if (hostedOrigin) {
  for (const page of readdirSync(outputPath).filter((name) =>
    name.endsWith('.html'),
  )) {
    writeFileSync(join(outputPath, page), hostedEntryHtml(hostedOrigin, page));
  }
  writeFileSync(join(outputPath, '.nojekyll'), '');
  console.log(
    `Built GitHub Pages entry points for the full Node app at ${hostedOrigin}.`,
  );
} else {
  // Publish only the public frontend and seed menu, never local accounts or orders.
  rmSync(join(outputPath, 'employee.html'));
  mkdirSync(join(outputPath, 'api'), { recursive: true });
  const database = openDatabase(':memory:');
  try {
    writeFileSync(
      join(outputPath, 'api/menu.json'),
      JSON.stringify(getMenu(database)),
    );
    writeFileSync(
      join(outputPath, 'api/toppings.json'),
      JSON.stringify(getToppings(database)),
    );
  } finally {
    database.close();
  }
  writeFileSync(
    join(outputPath, 'js/runtime-config.js'),
    'export const STATIC_PREVIEW = true;\n',
  );
  writeFileSync(join(outputPath, '.nojekyll'), '');
  console.log('Built public website from Frontend into .pages.');
}
