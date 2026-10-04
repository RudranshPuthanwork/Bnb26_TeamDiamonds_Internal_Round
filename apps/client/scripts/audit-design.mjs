import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

function getAllFiles(dir, extensions = ['.ts', '.tsx', '.css', '.html', '.js', '.jsx']) {
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

// 1. Forbidden design words
const FORBIDDEN_WORDS = [
  { name: 'gradient', regex: /\bgradient\b/i },
  { name: 'box-shadow', regex: /\bbox-shadow\b/i },
  { name: 'backdrop-filter', regex: /\bbackdrop-filter\b/i },
  { name: 'filter: blur', regex: /filter\s*:\s*[^;}]*blur/i },
  { name: 'accent token', regex: /accent/i },
  { name: 'border-style trick (dashed/double/groove/ridge)', regex: /border[a-z-]*\s*:[^;]*\b(dashed|double|groove|ridge|inset|outset)\b/i },
];

// 6. Icon libraries
const ICON_LIBRARIES = [
  'lucide-react',
  'react-icons',
  '@heroicons',
  'feather-icons',
  '@tabler/icons',
  '@fortawesome',
  'ionicons',
];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(rootDir, file);
  const isTokensCss = path.basename(file) === 'tokens.css';
  const isQrCodeComponent = path.basename(file) === 'QrCode.tsx';

  const lines = content.split('\n');
  const base = path.basename(file);
  const monoOk = ['tokens.css', 'Accession.module.css'].includes(base);
  const isRestrictionCss = base === 'RestrictionLine.module.css';
  let selector = '';

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    if (/\{\s*$/.test(line)) selector = line;

    // Check 7: Azeret Mono only on .mono/.hash/.timestamp and Accession
    const usesMono = /font-?family\s*:[^;]*(--font-mono|Azeret)/i.test(line);
    if (usesMono && !monoOk) {
      const okSelector = base === 'global.css' && /^\s*\.mono\b[^{]*\{/.test(selector);
      if (!okSelector) {
        console.error(`[FAIL] Azeret Mono outside .mono/Accession/Hash/Timestamp in ${relPath}:${lineNum}`);
        console.error(`       > ${line.trim()}`);
        hasErrors = true;
      }
    }

    // Check 8: font-size above 3.8rem outside RestrictionLine.module.css
    const fs8 = line.match(/font-?size\s*:\s*([^;}]+)/i);
    if (fs8 && !isRestrictionCss) {
      const big = [...fs8[1].matchAll(/(\d*\.?\d+)\s*(rem|em|px)/g)].some(([, n, u]) =>
        (u === 'px' ? n / 16 : Number(n)) > 3.8
      );
      if (big) {
        console.error(`[FAIL] font-size above 3.8rem outside RestrictionLine.module.css in ${relPath}:${lineNum}`);
        console.error(`       > ${line.trim()}`);
        hasErrors = true;
      }
    }

    // Check 1: Forbidden design words
    for (const rule of FORBIDDEN_WORDS) {
      if (rule.regex.test(line)) {
        console.error(
          `[FAIL] Forbidden style construct "${rule.name}" in ${relPath}:${lineNum}`
        );
        console.error(`       > ${line.trim()}`);
        hasErrors = true;
      }
    }

    // Check 2: border-radius other than var(--radius)
    const borderRadiusMatch = line.match(/border-radius\s*:\s*([^;!}]+)/i);
    if (borderRadiusMatch) {
      const val = borderRadiusMatch[1].trim();
      if (val !== 'var(--radius)') {
        console.error(
          `[FAIL] Invalid border-radius "${val}" in ${relPath}:${lineNum}. Only var(--radius) allowed.`
        );
        console.error(`       > ${line.trim()}`);
        hasErrors = true;
      }
    }

    // Check 3: Hex color outside tokens.css
    if (!isTokensCss) {
      const hexMatch = line.match(/#([0-9a-fA-F]{3,8})\b/);
      if (hexMatch) {
        console.error(
          `[FAIL] Hex color "${hexMatch[0]}" found outside tokens.css in ${relPath}:${lineNum}`
        );
        console.error(`       > ${line.trim()}`);
        hasErrors = true;
      }
    }

    // Check 4: font-family other than the three
    const fontFamilyMatch = line.match(/font-family\s*:\s*([^;!}]+)/i);
    if (fontFamilyMatch) {
      const val = fontFamilyMatch[1].trim();
      // Allowed font families
      const allowedPatterns = [
        /^var\(--font-(display|body|mono)\)$/,
        /^'Gloock',\s*serif$/,
        /^'Source Serif 4',\s*serif$/,
        /^'Azeret Mono',\s*monospace$/,
        /^inherit$/,
      ];
      const isAllowed = allowedPatterns.some((pattern) => pattern.test(val));
      if (!isAllowed) {
        console.error(
          `[FAIL] Forbidden font-family "${val}" in ${relPath}:${lineNum}`
        );
        console.error(`       > ${line.trim()}`);
        hasErrors = true;
      }
    }

    // Check 5: <svg> tag outside QrCode component
    if (!isQrCodeComponent && /<\s*svg\b/i.test(line)) {
      console.error(
        `[FAIL] <svg> tag outside QrCode component in ${relPath}:${lineNum}`
      );
      console.error(`       > ${line.trim()}`);
      hasErrors = true;
    }

    // Check 6: Import of icon library
    for (const lib of ICON_LIBRARIES) {
      if (line.includes(`'${lib}`) || line.includes(`"${lib}`)) {
        console.error(
          `[FAIL] Forbidden icon library import "${lib}" in ${relPath}:${lineNum}`
        );
        console.error(`       > ${line.trim()}`);
        hasErrors = true;
      }
    }
  });
}

if (hasErrors) {
  console.error('\nDesign audit failed: design system violations found.');
  process.exit(1);
} else {
  console.log(`[PASS] Design audit clean across ${files.length} files.`);
  process.exit(0);
}
