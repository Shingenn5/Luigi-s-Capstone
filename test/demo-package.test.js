import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { unzipSync } from 'fflate';
import { createHash } from 'node:crypto';
import { buildDemoArchive } from '../scripts/package-demo.js';

test('demo ZIP includes full backend and setup files while excluding local data', () => {
  const outputDirectory = mkdtempSync(join(tmpdir(), 'luigis-package-'));
  try {
    const { archivePath } = buildDemoArchive(outputDirectory);
    const files = unzipSync(readFileSync(archivePath));
    const names = Object.keys(files);
    for (const path of [
      'server.js',
      'server/app.js',
      'Database/schema.sql',
      'package-lock.json',
      'Frontend/index.html',
      'start-demo.cmd',
      'deploy/gcp/install.sh',
    ]) {
      assert.ok(files[`luigis-demo/${path}`], path);
    }
    assert.ok(
      !names.some((name) =>
        /(^|\/)node_modules\/|(^|\/)\.git\/|\.db(?:-|$)|\/\.env$/.test(name),
      ),
    );
    for (const path of [
      'start-demo.sh',
      'deploy/gcp/install.sh',
      'deploy/gcp/luigis.service',
    ]) {
      assert.ok(!Buffer.from(files[`luigis-demo/${path}`]).includes(13), path);
    }
    assert.match(
      Buffer.from(
        files['luigis-demo/Frontend/js/runtime-config.js'],
      ).toString(),
      /STATIC_PREVIEW = false/,
    );
    const manifest = JSON.parse(
      Buffer.from(files['luigis-demo/demo-manifest.json']).toString(),
    );
    for (const [path, hash] of Object.entries(manifest.fileHashes)) {
      assert.equal(
        createHash('sha256').update(files[`luigis-demo/${path}`]).digest('hex'),
        hash,
      );
    }
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});
