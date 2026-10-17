import {cp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
await mkdir(dist,{recursive:true});
for(const name of ['index.html','favicon.svg','src'])await cp(new URL(name,root),new URL(name,dist),{recursive:true});
let html=await readFile(new URL('index.html',root),'utf8');
const names=(await readdir(new URL('src/',root))).filter(name=>name.endsWith('.js')).sort();
const scripts=await Promise.all(names.map(name=>readFile(new URL('src/'+name,root),'utf8')));
const hash=createHash('sha256');
names.forEach((name,i)=>hash.update(name+'\0').update(scripts[i]));
const scriptVersion=hash.digest('hex').slice(0,12);
// Version the whole module graph, including the Worker and its dependencies.
for(let i=0;i<names.length;i++) {
  const built=scripts[i].replace(/(['"])(\.\/[^'"]+\.js)\1/g,(_,quote,url)=>quote+url+'?v='+scriptVersion+quote);
  await writeFile(new URL('src/'+names[i],dist),built);
}
const cssVersion=createHash('sha256').update(await readFile(new URL('src/style.css',root))).digest('hex').slice(0,12);
html=html.replaceAll('./src/style.css','./src/style.css?v='+cssVersion).replaceAll('./src/app.js','./src/app.js?v='+scriptVersion);
await writeFile(new URL('index.html',dist),html);
await writeFile(new URL('.nojekyll',dist),'');
console.log('Static site built: dist/ (all URLs are relative, ready for GitHub Pages)');
