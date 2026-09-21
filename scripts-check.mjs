import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
for(const f of ['public/index.html','public/admin/index.html','public/admin/admin.js','server/seed.json'])readFileSync(f);
const html=readFileSync('public/index.html','utf8');
for(const [,code] of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new Script(code);
new Script(readFileSync('public/admin/admin.js','utf8'));
console.log('Forest: archivos y JavaScript verificados.');
