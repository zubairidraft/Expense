const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(file => {
    let full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) results.push(...walk(full));
    else if (full.endsWith('.jsx')) results.push(full);
  });
  return results;
}

const files = walk('src/components');
let foundAny = false;
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  let returnLine = -1;
  lines.forEach((l, idx) => {
    if (/if\s*\(\s*!isOpen\s*\)\s*return/.test(l)) returnLine = idx;
  });
  if (returnLine !== -1) {
    const after = lines.slice(returnLine + 1);
    after.forEach((l, idx) => {
      if (/\b(use[A-Z]\w+)\s*\(/.test(l)) {
        console.log(`FOUND HOOK AFTER EARLY RETURN in ${f} at line ${returnLine + 2 + idx}: ${l.trim()}`);
        foundAny = true;
      }
    });
  }
});

if (!foundAny) {
  console.log('No hooks found after early return in any component!');
}
