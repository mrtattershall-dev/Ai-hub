import { readFileSync } from 'fs';
import * as acorn from 'acorn';
const G = new Set(['globalThis','undefined','NaN','Infinity','arguments','this','Object','Array','String','Number','Boolean','Math','JSON','Date','RegExp','Error','Map','Set','WeakMap','WeakSet','Promise','Symbol','parseInt','parseFloat','isNaN','isFinite','window','document','console','navigator','location','setTimeout','setInterval','clearTimeout','clearInterval','requestAnimationFrame','cancelAnimationFrame','localStorage','sessionStorage','fetch','Image','Audio','AudioContext','webkitAudioContext','performance','alert','confirm','prompt','requestIdleCallback','structuredClone','Path2D','OffscreenCanvas','TextEncoder','TextDecoder','URL','Blob','crypto','screen','history','CustomEvent','Event','DOMParser','matchMedia','getComputedStyle','module','exports','require','process']);
const kids=(n,fn)=>{for(const k in n){if(['type','start','end','loc','range'].includes(k))continue;const v=n[k];if(Array.isArray(v))v.forEach(c=>c&&typeof c.type==='string'&&fn(c));else if(v&&typeof v.type==='string')fn(v);}};
const txt=readFileSync(process.argv[2],'utf8');
const js=[...txt.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].filter(m=>!/\bsrc=/i.test(m[0])).map(m=>m[1]).join('\n;\n');
let ast;for(const sourceType of ['script','module']){try{ast=acorn.parse(js,{ecmaVersion:'latest',sourceType,allowReturnOutsideFunction:true,allowAwaitOutsideFunction:true});break;}catch(e){ast=null;}}
if(!ast){console.log('PARSE FAIL');process.exit(0);}
const decl=new Set(),refCount=new Map(),skip=new WeakSet();
const bind=(n)=>{if(!n)return;if(n.type==='Identifier'){decl.add(n.name);skip.add(n);}else if(n.type==='ObjectPattern')n.properties.forEach(p=>bind(p.type==='RestElement'?p.argument:p.value));else if(n.type==='ArrayPattern')n.elements.forEach(e=>e&&bind(e));else if(n.type==='AssignmentPattern')bind(n.left);else if(n.type==='RestElement')bind(n.argument);};
const dp=(n)=>{switch(n.type){case'FunctionDeclaration':case'FunctionExpression':case'ArrowFunctionExpression':if(n.id){decl.add(n.id.name);skip.add(n.id);}n.params.forEach(bind);break;case'ClassDeclaration':case'ClassExpression':if(n.id){decl.add(n.id.name);skip.add(n.id);}break;case'VariableDeclarator':bind(n.id);break;case'CatchClause':if(n.param)bind(n.param);break;case'MemberExpression':if(!n.computed&&n.property?.type==='Identifier')skip.add(n.property);break;case'Property':if(!n.computed&&n.key?.type==='Identifier')skip.add(n.key);break;case'MethodDefinition':case'PropertyDefinition':if(!n.computed&&n.key?.type==='Identifier')skip.add(n.key);break;}kids(n,dp);};
const rp=(n)=>{if(n.type==='Identifier'&&!skip.has(n)&&!decl.has(n)&&!G.has(n))refCount.set(n.name,(refCount.get(n.name)||0)+1);kids(n,rp);};
dp(ast);rp(ast);
const free=[...refCount.entries()].filter(([n])=>!decl.has(n)).sort((a,b)=>b[1]-a[1]);
console.log(`${process.argv[2].split(/[\\/]/).pop()} — ${free.length} free identifiers`);
console.log(free.slice(0,25).map(([n,c])=>`${String(c).padStart(4)} ${n}`).join('\n'));
