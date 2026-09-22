import { evaluate } from './adapter-eslint.mjs';
console.log(JSON.stringify(await evaluate(process.argv[2]), null, 2));
