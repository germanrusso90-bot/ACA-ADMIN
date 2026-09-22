const fs=require('fs');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,getDoc,setDoc,updateDoc,deleteDoc,collection,getDocs,writeBatch}=require('firebase/firestore');
(async()=>{
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8087')throw Error('Solo se permite el emulador local 127.0.0.1:8087');
const env=await initializeTestEnvironment({projectId:'demo-aca-validation',firestore:{host:'127.0.0.1',port:8087,rules:fs.readFileSync('firestore.rules','utf8')}});
const results=[];const test=async(name,fn)=>{await fn();results.push(name);};
try{
await env.withSecurityRulesDisabled(async c=>{const db=c.firestore();for(const [p,v]of Object.entries({'admins/admin':{enabled:true},'access/cipo':{enabled:true,cr:'3531'},'access/colonia':{enabled:true,cr:'3611'},'access/revoked':{enabled:false,cr:'3531'},'kv/cr3531--data--2026-09':{v:'cipo'},'kv/cr3611--yer--2026-09':{v:'colonia'},'kv/data--2026-09':{v:'legacy'},'kv/cr3531--economic--versions':{v:'[]'}}))await setDoc(doc(db,p),v);});
const user=(uid,verified=true)=>env.authenticatedContext(uid,{email:uid+'@example.com',email_verified:verified}).firestore();const c=user('cipo'),b=user('colonia'),a=user('admin'),p=user('pending'),r=user('revoked'),u=env.unauthenticatedContext().firestore();
await test('Sin sesión: lectura y escritura denegadas',async()=>{await assertFails(getDoc(doc(u,'kv/cr3531--data--2026-09')));await assertFails(setDoc(doc(u,'kv/cr3531--data--new'),{v:'x'}));});
await test('Correo sin verificar: acceso denegado',()=>assertFails(getDoc(doc(user('cipo',false),'kv/cr3531--data--2026-09'))));
await test('Cuenta pendiente: no lee ni escribe operaciones',async()=>{await assertFails(getDoc(doc(p,'kv/cr3531--data--2026-09')));await assertFails(setDoc(doc(p,'kv/cr3531--data--new'),{v:'x'}));});
await test('Solicitud propia pendiente permitida',()=>assertSucceeds(setDoc(doc(p,'accessRequests/pending'),{uid:'pending',email:'pending@example.com',cr:'3611',status:'pending',createdAt:1})));
await test('No puede autoaprobarse, crear permisos ni administrador',async()=>{await assertFails(updateDoc(doc(p,'accessRequests/pending'),{status:'approved'}));await assertFails(setDoc(doc(p,'access/pending'),{enabled:true,cr:'3611'}));await assertFails(setDoc(doc(p,'admins/pending'),{enabled:true}));});
await test('No puede falsificar el correo de su solicitud',()=>assertFails(setDoc(doc(user('fake'),'accessRequests/fake'),{uid:'fake',email:'other@example.com',cr:'3611',status:'pending',createdAt:1})));
await test('Cipolletti lee y escribe sus operaciones',async()=>{await assertSucceeds(getDoc(doc(c,'kv/cr3531--data--2026-09')));await assertSucceeds(setDoc(doc(c,'kv/cr3531--data--new'),{v:'x'}));});
await test('Colonia conserva acceso YER y espacio operativo nuevo',async()=>{await assertSucceeds(getDoc(doc(b,'kv/cr3611--yer--2026-09')));await assertSucceeds(setDoc(doc(b,'kv/cr3611--operativo-v2--data--2026-10'),{v:'x'}));});
await test('Lectura y escritura cruzadas denegadas en ambas direcciones',async()=>{for(const [db,cr]of [[c,'3611'],[b,'3531']]){await assertFails(getDoc(doc(db,'kv/cr'+cr+'--data--2026-09')));await assertFails(setDoc(doc(db,'kv/cr'+cr+'--data--new'),{v:'x'}));}});
await test('Cuenta revocada no accede a sus operaciones',()=>assertFails(getDoc(doc(r,'kv/cr3531--data--2026-09'))));
await test('Listado general kv denegado incluso al administrador',async()=>{for(const db of [a,b,c])await assertFails(getDocs(collection(db,'kv')));});
await test('Datos antiguos sin CR solo legibles por Cipolletti',async()=>{await assertSucceeds(getDoc(doc(c,'kv/data--2026-09')));await assertFails(getDoc(doc(b,'kv/data--2026-09')));await assertFails(setDoc(doc(c,'kv/data--2026-09'),{v:'x'}));});
await test('Estación lee condiciones pero no puede alterarlas',async()=>{await assertSucceeds(getDoc(doc(c,'kv/cr3531--economic--versions')));await assertFails(setDoc(doc(c,'kv/cr3531--economic--versions'),{v:'x'}));});
await test('Administrador carga condiciones sin leer operaciones',async()=>{await assertSucceeds(setDoc(doc(a,'kv/cr3611--economic--versions'),{v:'[]'}));await assertFails(getDoc(doc(a,'kv/cr3531--data--2026-09')));});
await test('Fragmentos y respaldos de condiciones solo modificables por administrador',async()=>{for(const suffix of ['--part--id--0','--backup--id']){await assertSucceeds(setDoc(doc(a,'kv/cr3531--economic--versions'+suffix),{v:'x'}));await assertFails(setDoc(doc(c,'kv/cr3531--economic--versions'+suffix),{v:'x'}));}});
await test('Fragmentos y respaldos operativos quedan en la estación',async()=>{for(const suffix of ['--part--id--0','--backup--id']){const path='kv/cr3531--file--one'+suffix;await assertSucceeds(setDoc(doc(c,path),{v:'x'}));await assertFails(getDoc(doc(b,path)));}});
await test('Aprobación por administrador en lote y acceso posterior',async()=>{const batch=writeBatch(a);batch.set(doc(a,'access/pending'),{email:'pending@example.com',cr:'3611',enabled:true,approvedBy:'admin',updatedAt:2});batch.update(doc(a,'accessRequests/pending'),{status:'approved',reviewedBy:'admin',reviewedAt:2});await assertSucceeds(batch.commit());await assertSucceeds(getDoc(doc(p,'kv/cr3611--yer--2026-09')));});
await test('Revocación deniega la siguiente lectura sin borrar datos',async()=>{await assertSucceeds(updateDoc(doc(a,'access/pending'),{enabled:false,approvedBy:'admin',updatedAt:3}));await assertFails(getDoc(doc(p,'kv/cr3611--yer--2026-09')));await assertSucceeds(getDoc(doc(b,'kv/cr3611--yer--2026-09')));});
await test('Borrado físico de operaciones denegado',async()=>{await assertFails(deleteDoc(doc(c,'kv/cr3531--data--2026-09')));await assertFails(deleteDoc(doc(a,'kv/cr3531--economic--versions')));});
await test('Listado de solicitudes y cuentas reservado al administrador',async()=>{for(const col of ['accessRequests','access']){await assertSucceeds(getDocs(collection(a,col)));await assertFails(getDocs(collection(c,col)));}});
fs.writeFileSync('pruebas-reglas.json',JSON.stringify({passed:results.length,tests:results,scope:'Reglas compiladas y ejecutadas en emulador Firestore local con usuarios simulados; sin producción y sin login Google real.'},null,2));console.log(JSON.stringify({passed:results.length,tests:results},null,2));
}finally{await env.cleanup();}
})().catch(e=>{console.error(e);process.exitCode=1});
