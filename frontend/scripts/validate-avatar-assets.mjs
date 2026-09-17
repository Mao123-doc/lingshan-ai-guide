import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const EXPECTED_MOTIONS = [
  'idle_a', 'idle_b', 'greeting_wave', 'listening_focus', 'thinking', 'explain_a',
  'explain_b', 'point_left', 'point_right', 'affirm_nod', 'warning', 'apology', 'farewell',
];
const EXPECTED_EXPRESSIONS = ['neutral', 'smile', 'focused', 'thinking', 'serious', 'sorry'];
const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelDir = path.join(frontendDir, 'public', 'models', 'lingxiaochan');

function fail(filePath, message) {
  throw new Error(`${path.relative(frontendDir, filePath) || filePath}: ${message}`);
}

async function readJson(filePath) {
  let source;
  try {
    source = await readFile(filePath, 'utf8');
  } catch (error) {
    fail(filePath, error.code === 'ENOENT' ? 'file is missing' : error.message);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(filePath, `invalid JSON (${error.message})`);
  }
}

async function assertFile(filePath) {
  let details;
  try {
    details = await stat(filePath);
  } catch (error) {
    fail(filePath, error.code === 'ENOENT' ? 'referenced file is missing' : error.message);
  }
  if (!details.isFile()) fail(filePath, 'expected a file');
  if (details.size > MAX_FILE_SIZE) fail(filePath, `file exceeds 100MB (${details.size} bytes)`);
  return details.size;
}

function assertManifestKeys(manifest, field, expected) {
  const values = manifest[field];
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    fail(path.join(modelDir, 'manifest.json'), `${field} must be an object`);
  }
  const actual = Object.keys(values);
  const missing = expected.filter((key) => !actual.includes(key));
  const extra = actual.filter((key) => !expected.includes(key));
  if (missing.length || extra.length) {
    fail(
      path.join(modelDir, 'manifest.json'),
      `${field} keys mismatch (missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'})`,
    );
  }
}

function referencedModelFiles(model) {
  const references = model.FileReferences;
  if (!references || typeof references !== 'object') return [];
  const files = [];
  for (const [key, value] of Object.entries(references)) {
    if (typeof value === 'string') files.push(value);
    else if (key === 'Textures' && Array.isArray(value)) files.push(...value);
    else collectNamedFileReferences(value, files);
  }
  return files;
}

function collectNamedFileReferences(value, files) {
  if (Array.isArray(value)) {
    for (const item of value) collectNamedFileReferences(item, files);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if ((key === 'File' || key === 'Sound') && typeof item === 'string') files.push(item);
      else if (item && typeof item === 'object') collectNamedFileReferences(item, files);
    }
  }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  }));
  return nested.flat();
}

async function main() {
  const manifestPath = path.join(modelDir, 'manifest.json');
  const modelPath = path.join(modelDir, 'lingxiaochan.model3.json');
  const licensePath = path.join(modelDir, 'LICENSE.md');
  const manifest = await readJson(manifestPath);
  const model = await readJson(modelPath);

  if (manifest.id !== 'lingxiaochan-v1') fail(manifestPath, 'id must be lingxiaochan-v1');
  assertManifestKeys(manifest, 'motions', EXPECTED_MOTIONS);
  assertManifestKeys(manifest, 'expressions', EXPECTED_EXPRESSIONS);

  for (const reference of referencedModelFiles(model)) {
    const referencedPath = path.resolve(modelDir, reference);
    if (referencedPath !== modelDir && !referencedPath.startsWith(`${modelDir}${path.sep}`)) {
      fail(modelPath, `referenced path escapes model directory: ${reference}`);
    }
    await assertFile(referencedPath);
  }

  const licenseSize = await assertFile(licensePath);
  if (!(await readFile(licensePath, 'utf8')).trim() || licenseSize === 0) {
    fail(licensePath, 'license must not be empty');
  }

  const files = await listFiles(modelDir);
  let maximumSize = 0;
  for (const file of files) maximumSize = Math.max(maximumSize, await assertFile(file));

  console.log(
    `Validated ${manifest.id}: ${EXPECTED_MOTIONS.length} motions, ` +
      `${EXPECTED_EXPRESSIONS.length} expressions, maximum file size ${maximumSize} bytes`,
  );
}

main().catch((error) => {
  console.error(`Avatar asset validation failed: ${error.message}`);
  process.exitCode = 1;
});
