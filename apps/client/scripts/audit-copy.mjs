import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

const BANNED_WORDS = [
  'seamless',
  'unlock',
  'supercharge',
  'elevate',
  'empower',
  'streamline',
  'leverage',
  'robust',
  'effortless',
  'next-generation',
  'next generation',
  'world-class',
  'world class',
  'lorem',
  'acme',
  'john doe',
];

function getAllFiles(dir, extensions = ['.ts', '.tsx', '.css', '.html', '.json']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, extensions));
    } else {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        results.push(filePath);
      }
    }
  }
  return results;
}

const files = getAllFiles(srcDir);
let hasErrors = false;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineLower = line.toLowerCase();
    for (const banned of BANNED_WORDS) {
      // Use regex with word boundary for whole word matching
      const regex = new RegExp(`\\b${banned.replace('-', '[- ]')}\\b`, 'i');
      if (regex.test(lineLower)) {
        console.error(
          `[FAIL] Banned word "${banned}" in ${path.relative(rootDir, file)}:${index + 1}`
        );
        console.error(`       > ${line.trim()}`);
        hasErrors = true;
      }
    }
  });
}

if (hasErrors) {
  console.error('\nCopy audit failed: banned vocabulary found.');
  process.exit(1);
} else {
  console.log(`[PASS] Copy audit clean across ${files.length} files.`);
  process.exit(0);
}
