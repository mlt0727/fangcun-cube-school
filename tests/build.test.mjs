import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename,resolve,isAbsolute} from 'node:path';
import {execFileSync} from 'node:child_process';

test('静态发布为资源更新地址，避免刷新后继续使用旧的样式或脚本',async t=>{
  const root=await mkdtemp(join(tmpdir(),'fangcun-build-'));
  t.after(async()=>{
    assert.ok(isAbsolute(root)&&dirname(root)===resolve(tmpdir())&&basename(root).startsWith('fangcun-build-'));
    await rm(root,{recursive:true,force:true});
  });
  await mkdir(join(root,'scripts'));await mkdir(join(root,'src'));
  await copyFile(new URL('../scripts/build.mjs',import.meta.url),join(root,'scripts/build.mjs'));
  const html='<link rel="stylesheet" href="./src/style.css"><script type="module" src="./src/app.js"></script>';
  await writeFile(join(root,'index.html'),html);await writeFile(join(root,'favicon.svg'),'<svg/>');
  await writeFile(join(root,'src/style.css'),'.scene{user-select:none}');
  await writeFile(join(root,'src/app.js'),'console.log("first")');
  const build=async()=>{execFileSync(process.execPath,[join(root,'scripts/build.mjs')],{stdio:'pipe'});const built=await readFile(join(root,'dist/index.html'),'utf8');return {css:built.match(/href="([^"]+)"/)[1],js:built.match(/src="([^"]+)"/)[1]};};
  const first=await build();
  assert.notEqual(first.css,'./src/style.css');assert.notEqual(first.js,'./src/app.js');
  assert.deepEqual(await build(),first,'相同内容应使用稳定的资源地址');
  await writeFile(join(root,'src/style.css'),'.scene,.scene *{user-select:none}');
  const second=await build();assert.notEqual(second.css,first.css);assert.equal(second.js,first.js);
  await writeFile(join(root,'src/app.js'),'console.log("updated")');
  const third=await build();assert.notEqual(third.js,second.js);assert.equal(third.css,second.css);
  assert.equal(await readFile(join(root,'index.html'),'utf8'),html,'构建不修改源文件');
});
