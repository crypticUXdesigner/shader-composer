import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, '..', 'src', 'shaders', 'nodes');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts' && f !== 'math-operations.ts');

const names = [];
for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const re = /displayName:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) names.push(m[1]);
}

const lengths = names.map((n) => n.length);
const dist = {};
lengths.forEach((l) => {
  dist[l] = (dist[l] || 0) + 1;
});
const sorted = Object.entries(dist).sort((a, b) => +a[0] - +b[0]);

console.log('Total node names:', names.length);
console.log('\nLength distribution (length -> count):');
sorted.forEach(([len, count]) => console.log('  ' + String(len).padStart(2) + ' chars: ' + count));
console.log('\nMin:', Math.min(...lengths), '| Max:', Math.max(...lengths), '| Mean:', (lengths.reduce((a, b) => a + b, 0) / lengths.length).toFixed(1));

const over20 = names.filter((n) => n.length > 20);
const over18 = names.filter((n) => n.length > 18);
const over16 = names.filter((n) => n.length > 16);
console.log('\nOver 16 chars:', over16.length, over16);
console.log('Over 18 chars:', over18.length, over18);
console.log('Over 20 chars:', over20.length, over20);
