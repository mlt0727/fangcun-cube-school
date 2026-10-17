import {solve} from './solver.js';
self.onmessage=({data})=>{
  try{const result=solve(data.state,data.n,message=>self.postMessage({type:'progress',message}));self.postMessage({type:'result',result});}
  catch(error){self.postMessage({type:'error',message:error.message});}
};
