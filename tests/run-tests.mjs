import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const directory = path.dirname(fileURLToPath(import.meta.url));
const requested = process.argv.slice(2);
const files = requested.length
  ? requested.map(file => path.resolve(file))
  : (await readdir(directory))
      .filter(file => file.endsWith('-test.html'))
      .sort()
      .map(file => path.join(directory, file));

let failed = false;
for (const file of files) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(String(error?.stack || error)));
  virtualConsole.on('error', error => errors.push(String(error)));

  const dom = await JSDOM.fromFile(file, {
    resources: 'usable',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole
  });
  const deadline = Date.now() + 10000;
  let output = '';
  while (Date.now() < deadline) {
    output = dom.window.document.querySelector('#out')?.textContent || '';
    if (output) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }

  let result = null;
  try { result = JSON.parse(output); } catch (_) {}
  const passed = Boolean(result && result.failures === false && errors.length === 0);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${path.basename(file)}`);
  if (!passed) {
    console.error(JSON.stringify({ output: result || output, errors }, null, 2));
    failed = true;
  }
  dom.window.close();
}

process.exitCode = failed ? 1 : 0;
