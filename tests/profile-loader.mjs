import {readFileSync} from 'node:fs';
import ts from 'typescript';
import path from 'node:path';
const urls=new Map();
export function moduleUrl(file){file=path.resolve(file);if(urls.has(file))return urls.get(file);let code=readFileSync(file,'utf8');if(file.endsWith('.json'))code='export default '+code;else {if(file.endsWith('.ts'))code=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;code=code.replace(/from ['"]((?:\.\.?\/|@\/)[^'"]+)['"]/g,(_,relative)=>{const base=relative.startsWith('@/')?path.resolve(relative.slice(2)):path.resolve(path.dirname(file),relative),target=base+(path.extname(relative)?'':'.ts');return 'from '+JSON.stringify(moduleUrl(target));});}const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');urls.set(file,url);return url;}

