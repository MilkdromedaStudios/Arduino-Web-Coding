import {execFileSync} from 'node:child_process';
import {existsSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';

const repository='https://github.com/TurboWarp/scratch-gui.git';
const revision='25c11c6f246de9c6d36b29a61c505cd35f34cb8c';
const destination=resolve('dev/turbowarp-gui');
const run=(args,options={})=>execFileSync('git',args,{stdio:'inherit',...options});

if(existsSync(destination)){
 try{
  const current=execFileSync('git',['-C',destination,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(current===revision){console.log(`TurboWarp GUI is already pinned at ${revision}.`);process.exit(0)}
 }catch{}
 console.log('Replacing the existing TurboWarp checkout.');
 rmSync(destination,{recursive:true,force:true});
}

console.log(`Cloning TurboWarp GUI into ${destination}...`);
run(['clone','--filter=blob:none','--no-checkout',repository,destination]);
run(['-C',destination,'checkout','--detach',revision]);
console.log(`TurboWarp GUI is ready at ${revision}.`);
