import { zipSync } from 'fflate';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { repositoryPath } from '../server/config.js';

export function buildDemoArchive(
  outputDirectory = join(repositoryPath, 'demo-dist'),
) {
  const files = {};
  const allowedExtension =
    /\.(html|js|json|sql|md|png|jpg|svg|css|sh|cmd|service|conf)$/i;
  function includeFile(relativePath) {
    let bytes = readFileSync(join(repositoryPath, relativePath));
    if (/\.(sh|service|conf)$/i.test(relativePath))
      bytes = Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'));
    files[relativePath.replaceAll('\\', '/')] = bytes;
  }
  function includeDirectory(relativePath) {
    for (const entry of readdirSync(join(repositoryPath, relativePath), {
      withFileTypes: true,
    })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.isSymbolicLink())
        throw new Error(
          `Cannot package symlink: ${relativePath}/${entry.name}`,
        );
      const path = join(relativePath, entry.name);
      if (entry.isDirectory()) includeDirectory(path);
      else if (allowedExtension.test(entry.name)) includeFile(path);
    }
  }
  for (const path of [
    'server.js',
    'package.json',
    'package-lock.json',
    '.env.example',
    '.gitignore',
    '.gitattributes',
    '.prettierrc.json',
    'README.md',
    'DEMO.md',
    'verification.md',
    'start-demo.cmd',
    'start-demo.sh',
    'eslint.config.js',
    'playwright.config.js',
    'Database/schema.sql',
    'Database/seed.sql',
  ])
    includeFile(path);
  for (const path of [
    'server',
    'Frontend',
    'scripts',
    'deploy',
    'test',
    'browser-tests',
    'Database/migrations',
  ])
    includeDirectory(path);
  if (
    !files['Frontend/js/runtime-config.js']
      .toString()
      .includes('STATIC_PREVIEW = false')
  ) {
    throw new Error(
      'The demo must use the full Node backend, not the static Pages preview.',
    );
  }
  const gitOptions = {
    cwd: repositoryPath,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  };
  let sourceCommit = 'unversioned';
  let includesUncommittedChanges = true;
  try {
    sourceCommit = execFileSync(
      'git',
      ['rev-parse', 'HEAD'],
      gitOptions,
    ).trim();
    includesUncommittedChanges = Boolean(
      execFileSync('git', ['status', '--porcelain'], gitOptions).trim(),
    );
  } catch {
    // An extracted source archive still packages, but cannot claim Git provenance.
  }
  files['demo-manifest.json'] = Buffer.from(
    JSON.stringify(
      {
        sourceCommit,
        includesUncommittedChanges,
        builtAt: new Date().toISOString(),
        runtime: 'Node.js 24.19+ within 24 LTS',
        fileHashes: Object.fromEntries(
          Object.entries(files).map(([path, bytes]) => [
            path,
            createHash('sha256').update(bytes).digest('hex'),
          ]),
        ),
      },
      null,
      2,
    ),
  );
  const archive = zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, bytes]) => [
        `luigis-demo/${path}`,
        bytes,
      ]),
    ),
    { level: 6 },
  );
  mkdirSync(outputDirectory, { recursive: true });
  const archivePath = join(outputDirectory, 'luigis-demo.zip');
  writeFileSync(archivePath, archive);
  writeFileSync(
    `${archivePath}.sha256`,
    `${createHash('sha256').update(archive).digest('hex')}  luigis-demo.zip\n`,
  );
  return {
    archivePath,
    fileCount: Object.keys(files).length,
    sizeBytes: archive.length,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  console.log(JSON.stringify(buildDemoArchive(), null, 2));
}
