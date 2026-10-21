// Parse candidate source in memory, before any file or governed receipt is changed.
// No generated code is executed and no host subprocess enters the target workspace.
import { parse } from 'acorn';
import { extname } from 'node:path';
export function sourceSyntaxError(path, source) {
  const ext = extname(path).toLowerCase();
  if (!['.js', '.cjs', '.mjs'].includes(ext)) return null;
  const modes = ext === '.mjs' ? ['module'] : ext === '.cjs' ? ['script'] : ['script', 'module'];
  const errors = [];
  for (const sourceType of modes) {
    try {
      parse(String(source), { ecmaVersion: 'latest', sourceType, allowHashBang: true, allowReturnOutsideFunction: sourceType === 'script' });
      return null;
    } catch (e) { errors.push(e); }
  }
  const error = errors.sort((a,b) => (b.pos || 0) - (a.pos || 0))[0];
  return `SyntaxError: ${error.message}`;
}
