// Existing kv identifiers remain unchanged. Chunks are immutable; only a
// complete, hash-verified value is published. Concurrent edits fail closed.
// From v4.3.9 new writes are packed: values from 64 KB are stored gzip-compressed
// as Bytes, and file contents go to per-station blobs named by their SHA-256, so
// the same file is stored once. Documents written before keep their format.
function wrapDB(native){
 const expected=new Map(),writers=new Map(),owned=new Set();
 const CHUNK_CONCURRENCY=4,PACK_MIN=65536,PART_BYTES=900000;
 const canPack=()=>Boolean(native.Bytes)&&typeof CompressionStream==='function'&&typeof DecompressionStream==='function';
 const stationOf=id=>(id.match(/^(cr\d{4})--/)||[])[1]||null;
 // Conditions belong to the administrator, who cannot write station blobs.
 const configId=id=>/^cr\d{4}--economic--versions/.test(id);
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
  if(ArrayBuffer.isView(value)||typeof value.toUint8Array==='function')return {$bytes:bytesToBase64(toU8(value))};
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
 // A file record is the JSON the app stores for attachments: {fileName,type,dataUrl}.
 const fileRecord=text=>{
  if(!text.startsWith('{"fileName":')||!text.includes('"dataUrl":"data:'))return null;
  try{const {dataUrl,...rest}=JSON.parse(text);return typeof dataUrl==='string'?{dataUrl,rest}:null;}catch{return null;}
 };
 async function putBlob(station,text){
  const raw=new TextEncoder().encode(text),sha=await sha256(raw),id=station+'--blob--'+sha,ref={id};
  // Same content, same name: an existing blob is reused and an interrupted upload
  // is completed by rewriting identical parts, so nothing is left orphaned.
  if((await native.getDoc(native.doc(native.fs,'kv',id))).exists())return sha;
  const zipped=await gzipBytes(raw),enc=zipped.length<raw.length?'gzip':'none',body=enc==='gzip'?zipped:raw;
  const count=Math.max(1,Math.ceil(body.length/PART_BYTES)),k=station+':blob:'+sha;
  if(count>200)throw Error('El archivo es demasiado grande para guardarlo.');
  await mapChunks(count,i=>native.setDoc(native.doc(native.fs,'kv',id+'--part--'+i),{k,index:i,data:native.Bytes.fromUint8Array(body.slice(i*PART_BYTES,(i+1)*PART_BYTES))}),(current,total)=>storageProgress(ref,'write',current,total));
  await native.setDoc(native.doc(native.fs,'kv',id),{k,enc,bytes:raw.length,stored:body.length,count,partSize:PART_BYTES,sha256:sha});
  return sha;
 }
 async function getBlob(ref,station,sha){
  const id=station+'--blob--'+sha,head=await native.getDoc(native.doc(native.fs,'kv',id));
  if(!head.exists())throw Error('Archivo incompleto: falta su contenido. No se modificó el original.');
  const meta=head.data();if(!Number.isInteger(meta.count)||meta.count<1||meta.count>200||!['gzip','none'].includes(meta.enc))throw Error('Índice de archivo inválido.');
  const parts=await mapChunks(meta.count,async i=>{const p=await native.getDoc(native.doc(native.fs,'kv',id+'--part--'+i));if(!p.exists())throw Error('Archivo incompleto: falta una parte. No se modificó el original.');const d=p.data();if(d.index!==i)throw Error('Parte de archivo inválida.');return toU8(d.data);},(current,total)=>storageProgress(ref,'read',current,total));
  const body=joinBytes(parts),raw=meta.enc==='gzip'?await gunzipBytes(body):body;
  if(raw.length!==meta.bytes||await sha256(raw)!==sha)throw Error('El archivo no pasó la verificación de integridad.');
  return new TextDecoder().decode(raw);
 }
 async function pack(ref,data){
  const out={...data,fmt:2};
  if(typeof data.v!=='string'||data.v.length<PACK_MIN)return out;
  const station=stationOf(ref.id),file=fileRecord(data.v);
  if(file&&station&&!configId(ref.id)){
   const sha=await putBlob(station,file.dataUrl);
   return {...out,v:JSON.stringify(file.rest),blob:sha,bytes:file.dataUrl.length};
  }
  const raw=new TextEncoder().encode(data.v),zipped=await gzipBytes(raw);
  if(zipped.length<=PART_BYTES)return {...out,v:null,enc:'gzip',z:native.Bytes.fromUint8Array(zipped),bytes:raw.length,sha256:await sha256(raw)};
  if(!station||configId(ref.id))return null;
  return {...out,v:null,blob:await putBlob(station,data.v),bytes:raw.length};
 }
 async function unpack(ref,meta){
  if(meta.z){
   const raw=await gunzipBytes(toU8(meta.z));
   if(meta.enc!=='gzip'||raw.length!==meta.bytes||await sha256(raw)!==meta.sha256)throw Error('El dato no pasó la verificación de integridad.');
   return new TextDecoder().decode(raw);
  }
  const station=stationOf(ref.id);if(!station||!/^[0-9a-f]{64}$/.test(meta.blob))throw Error('Referencia de archivo inválida.');
  const text=await getBlob(ref,station,meta.blob);
  if(meta.v==null)return text;
  const file=JSON.parse(meta.v);file.dataUrl=text;return JSON.stringify(file);
 }
 const wrapped={...native};
 wrapped.getDoc=async ref=>{
  const snap=await native.getDoc(ref);
  if(ref.parent.id==='kv'&&!expected.has(ref.id))expected.set(ref.id,signature(snap));
  if(!snap.exists())return snap;
  const meta=snap.data();
  if(ref.parent.id==='kv'&&(meta.z||meta.blob)){const v=await unpack(ref,meta);return {exists:()=>true,data:()=>({...meta,v}),id:snap.id,ref:snap.ref};}
  if(!meta.chunked)return snap;
  if(meta.chunked!==1||!Number.isInteger(meta.count)||meta.count<1||meta.count>200)throw Error('Índice de archivo inválido.');
  const parts=await mapChunks(meta.count,async i=>{const p=await native.getDoc(native.doc(native.fs,'kv',ref.id+'--chunk--'+meta.revision+'--'+i));if(!p.exists())throw Error('Archivo incompleto: falta una parte. No se modificó el original.');const d=p.data();if(d.revision!==meta.revision||d.index!==i)throw Error('Parte de archivo inválida.');return Uint8Array.from(atob(d.chunk),c=>c.charCodeAt(0));},(current,total)=>storageProgress(ref,'read',current,total));
  const bytes=joinBytes(parts);
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
  let stored=canPack()?await pack(ref,data):null;
  if(!stored)stored=data;
  if(stored===data&&typeof data.v==='string'&&new TextEncoder().encode(data.v).length>=700000){
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
   // One previous version per document and day: the first change of the day keeps
   // how it was left before. Attachments and file references are always kept.
   if(before.exists()&&keepPreviousCopy(before.data()))tx.set(native.doc(native.fs,'kv',ref.id+'--backup--'+crypto.randomUUID()),{...before.data(),backupOf:ref.id});
   tx.set(ref,stored,...args);
  });
  expected.set(ref.id,stableJSON(stored));
  owned.add(ref.id);
 }
 // Physical deletes are disabled. Existing callers may remove references only.
 wrapped.deleteDoc=async()=>{throw Error('Borrado físico deshabilitado: los documentos y adjuntos se conservan.');};
 return wrapped;
}
function keepPreviousCopy(previous,now=Date.now()){
 // Las condiciones y el historial importado (del administrador) siempre conservan copia.
 if(previous.blob||previous.chunked||/(^|:)file:/.test(previous.k||'')||/^cr\d{4}:economic:versions(:|$)/.test(previous.k||'')||!Number.isFinite(previous.updatedAt))return true;
 return new Date(previous.updatedAt).toDateString()!==new Date(now).toDateString();
}
async function sha256(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
function toU8(value){return ArrayBuffer.isView(value)?new Uint8Array(value.buffer,value.byteOffset,value.byteLength):value.toUint8Array();}
function joinBytes(parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let pos=0;parts.forEach(p=>{out.set(p,pos);pos+=p.length;});return out;}
function bytesToBase64(bytes){let str='';for(let i=0;i<bytes.length;i+=8000)str+=String.fromCharCode(...bytes.subarray(i,i+8000));return btoa(str);}
async function transformBytes(bytes,stream){
 const writer=stream.writable.getWriter(),reader=stream.readable.getReader(),parts=[];
 const reading=(async()=>{for(let r=await reader.read();!r.done;r=await reader.read())parts.push(r.value);})();
 await Promise.all([writer.write(bytes).then(()=>writer.close()),reading]);
 return joinBytes(parts);
}
const gzipBytes=bytes=>transformBytes(bytes,new CompressionStream('gzip'));
const gunzipBytes=bytes=>transformBytes(bytes,new DecompressionStream('gzip'));
