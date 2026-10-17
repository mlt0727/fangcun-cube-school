import {cp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
await mkdir(dist,{recursive:true});
for(const name of ['index.html','favicon.svg','src'])await cp(new URL(name,root),new URL(name,dist),{recursive:true});
let html=await readFile(new URL('index.html',root),'utf8');
for(const name of ['src/style.css','src/app.js']) {
  const version=createHash('sha256').update(await readFile(new URL(name,root))).digest('hex').slice(0,12);
  html=html.replaceAll('./'+name,'./'+name+'?v='+version);
}
await writeFile(new URL('index.html',dist),html);
await writeFile(new URL('.nojekyll',dist),'');
console.log('Static site built: dist/ (all URLs are relative, ready for GitHub Pages)');
