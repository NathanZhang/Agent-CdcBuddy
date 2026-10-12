// Local worker uses the same TypeScript application kernel; no duplicate business implementation.
const ts=require('typescript'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,parent,...rest){if(request.startsWith('@/'))request=path.join(process.cwd(),'src',request.slice(2));return resolve.call(this,request,parent,...rest);};
require.extensions['.ts']=function(mod,file){mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText,file);};
