import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const reactPdfRequire = createRequire(require.resolve('react-pdf'));

test('React-PDF and the bundled PDF worker use the same PDF.js version', () => {
  assert.equal(
    require('pdfjs-dist/package.json').version,
    reactPdfRequire('pdfjs-dist/package.json').version,
    'PdfReader imports the root worker, which must match React-PDF\'s PDF.js API',
  );
});

test('the bundled worker can open and read the sample issue', async () => {
  // The legacy entry supplies DOM polyfills for Node; use the same worker as PdfReader.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs')).href;
  const data = new Uint8Array(await readFile(new URL('../../sample/KHPT_2-11.pdf', import.meta.url)));
  const task = pdfjs.getDocument({data});
  try {
    const document = await task.promise;
    assert.ok(document.numPages > 0);
    const page = await document.getPage(1);
    assert.ok(page.getViewport({scale: 1}).width > 0);
    const text = await page.getTextContent();
    assert.ok(Array.isArray(text.items));
  } finally {
    await task.destroy();
  }
});
