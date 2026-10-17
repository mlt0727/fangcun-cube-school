import {cp,mkdir,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),dist=new URL('dist/',root);
await mkdir(dist,{recursive:true});
for(const name of ['index.html','favicon.svg','src'])await cp(new URL(name,root),new URL(name,dist),{recursive:true});
await writeFile(new URL('.nojekyll',dist),'');
console.log('Static site built: dist/ (all URLs are relative, ready for GitHub Pages)');
