// Existing kv identifiers remain unchanged. Chunks are immutable; only a
// complete, hash-verified value is published. Concurrent edits fail closed.
function wrapDB(native){
 const expected=new Map(),writers=new Map(),owned=new Set();
 const CHUNK_CONCURRENCY=4;
 const storageProgress=(ref,phase,current,total)=>{
  if(typeof window==='undefined'||typeof window.dispatchEvent!=='function'||typeof window.CustomEvent!=='function')return;
  window.dispatchEvent(new window.CustomEvent('aca-storage-progress',{detail:{key:ref.id,phase,current,total}}));
 };
 const mapChunks=async(count,worker,onProgress)=>{
  const results=new Array(count);let completed=0;
  for(let start=0;start<count;start+=CHUNK_CONCURRENCY){
   const indexes=Array.from({length:Math.min(CHUNK_CONCURRENCY,count-start)},(_,offset)=>start+offset);
   const settled=await Promise.allSettled(indexes.map(async index=>{
    const value=await worker(index);results[index]=value;completed++;if(onProgress)onProgress(completed,count);
   }));
   const failed=settled.find(item=>item.status==='rejected');
   if(failed)throw failed.reason;
  }
  return results;
 };
 const stableValue=value=>{
  if(value===null||typeof value!=='object')return value;
  if(Array.isArray(value))return value.map(stableValue);
  if(typeof value.toJSON==='function')return stableValue(value.toJSON());
  return Object.keys(value).sort().reduce((out,key)=>{out[key]=stableValue(value[key]);return out;},{});
 };
 const stableJSON=value=>JSON.stringify(stableValue(value));
 const normalizeSignature=value=>{
  if(value===null||value===undefined)return value;
  try{return stableJSON(JSON.parse(value));}catch{return value;}
 };
 const signature=s=>s.exists()?stableJSON(s.data()):null;
 const conflict=()=>{const error=Error('Otro usuario o sesión cambió este registro. Se conservaron ambos datos: exportá el respaldo local y recargá antes de conciliar.');error.code='aca/conflict';return error;};
 const wrapped={...native};
 wrapped.getDoc=async ref=>{
  const snap=await native.getDoc(ref);
  if(ref.parent.id==='kv'&&!expected.has(ref.id))expected.set(ref.id,signature(snap));
  if(!snap.exists()||!snap.data().chunked)return snap;
  const meta=snap.data();if(meta.chunked!==1||!Number.isInteger(meta.count)||meta.count<1||meta.count>200)throw Error('Índice de archivo inválido.');
  const parts=await mapChunks(meta.count,async i=>{const p=await native.getDoc(native.doc(native.fs,'kv',ref.id+'--chunk--'+meta.revision+'--'+i));if(!p.exists())throw Error('Archivo incompleto: falta una parte. No se modificó el original.');const d=p.data();if(d.revision!==meta.revision||d.index!==i)throw Error('Parte de archivo inválida.');return Uint8Array.from(atob(d.chunk),c=>c.charCodeAt(0));},(current,total)=>storageProgress(ref,'read',current,total));
  const bytes=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let pos=0;parts.forEach(p=>{bytes.set(p,pos);pos+=p.length;});
  const hash=await sha256(bytes);if(hash!==meta.sha256||bytes.length!==meta.bytes)throw Error('El archivo no pasó la verificación de integridad.');
  return {exists:()=>true,data:()=>({...meta,v:new TextDecoder().decode(bytes)}),id:snap.id,ref:snap.ref};
 };
 wrapped.ensureExpected=async ref=>{
  if(ref.parent.id!=='kv')return null;
  if(!expected.has(ref.id)){
   const snap=await native.getDoc(ref);
   expected.set(ref.id,signature(snap));
  }
  return expected.get(ref.id);
 };
 wrapped.refreshExpected=async ref=>{
  if(ref.parent.id!=='kv')return null;
  const snap=await native.getDoc(ref),value=signature(snap);
  expected.set(ref.id,value);
  owned.delete(ref.id);
  return value;
 };
 wrapped.setQueuedDoc=(ref,data,base,...args)=>{
  if(ref.parent.id!=='kv')return native.setDoc(ref,data,...args);
  if(base===undefined){const error=Error('Este cambio pendiente fue creado por una versión anterior y no puede sobrescribir la nube automáticamente. Descargá Respaldo local para conciliarlo.');error.code='aca/legacy-queue';return Promise.reject(error);}
  const immutable=structuredClone(data);
  const job=(writers.get(ref.id)||Promise.resolve()).catch(()=>{}).then(()=>write(ref,immutable,args,{known:true,value:base}));
  writers.set(ref.id,job);return job;
 };
 wrapped.setDoc=(ref,data,...args)=>{
  if(ref.parent.id!=='kv')return native.setDoc(ref,data,...args);
  // Same-browser writes are serialized, including retries.
  const immutable=structuredClone(data);
  const job=(writers.get(ref.id)||Promise.resolve()).catch(()=>{}).then(()=>write(ref,immutable,args,{known:false}));
  writers.set(ref.id,job);return job;
 };
 async function write(ref,data,args,queuedBase){
  let stored=data;
  if(typeof data.v==='string'&&new TextEncoder().encode(data.v).length>=700000){
   const bytes=new TextEncoder().encode(data.v),revision=crypto.randomUUID(),count=Math.ceil(bytes.length/480000);
   await mapChunks(count,async i=>{
    const block=bytes.subarray(i*480000,(i+1)*480000);let str='';for(let j=0;j<block.length;j+=8000)str+=String.fromCharCode(...block.subarray(j,j+8000));
    await native.setDoc(native.doc(native.fs,'kv',ref.id+'--chunk--'+revision+'--'+i),{k:data.k,chunk:btoa(str),revision,index:i});
   },(current,total)=>storageProgress(ref,'write',current,total));
   stored={...data,v:null,chunked:1,revision,count,bytes:bytes.length,sha256:await sha256(bytes)};
  }
  await native.runTransaction(native.fs,async tx=>{
   const before=await tx.get(ref),actual=signature(before);
   let baseline;
   if(queuedBase.known){
    const queuedValue=normalizeSignature(queuedBase.value);
    if(expected.has(ref.id)&&expected.get(ref.id)!==queuedValue&&!owned.has(ref.id))throw conflict();
    baseline=owned.has(ref.id)?expected.get(ref.id):queuedValue;
   }else baseline=expected.has(ref.id)?expected.get(ref.id):null;
   if(actual!==baseline)throw conflict();
   // Retain previous contents, including file manifests, before replacing.
   if(before.exists())tx.set(native.doc(native.fs,'kv',ref.id+'--backup--'+crypto.randomUUID()),{...before.data(),backupOf:ref.id});
   tx.set(ref,stored,...args);
  });
  expected.set(ref.id,stableJSON(stored));
  owned.add(ref.id);
 }
 // Physical deletes are disabled. Existing callers may remove references only.
 wrapped.deleteDoc=async()=>{throw Error('Borrado físico deshabilitado: los documentos y adjuntos se conservan.');};
 return wrapped;
}
async function sha256(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
