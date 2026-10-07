let AUTH_PERSON=null, IS_ACCESS_ADMIN=false;
async function googleLogin(){
 const button=document.getElementById('google-login');if(button)button.disabled=true;
 try{
  const {initializeApp,getApps}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const auth=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const app=getApps()[0]||initializeApp(firebaseConfig);window.acaAuth=auth.getAuth(app);
  window.acaSignOut=()=>auth.signOut(window.acaAuth);
  const provider=new auth.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
  const result=await auth.signInWithPopup(window.acaAuth,provider);AUTH_PERSON=result.user;
  if(!AUTH_PERSON.emailVerified)throw Error('Google debe verificar el correo antes de solicitar acceso.');
  await resolveAccess();
 }catch(e){showLoad(false);CU=null;render();document.getElementById('le').textContent=authError(e);}
 finally{const b=document.getElementById('google-login');if(b)b.disabled=false;}
}
function authError(e){return e.code==='auth/operation-not-allowed'?'Falta habilitar Google en Firebase Authentication.':e.code==='auth/unauthorized-domain'?'Falta autorizar el dominio de esta aplicación en Firebase.':e.code==='permission-denied'?'No se pudo verificar el permiso. Revisá la configuración de acceso de Firebase con el administrador.':e.message;}
async function resolveAccess(preferStation=false){
 const db=await getDB();const uid=AUTH_PERSON.uid;
 const admin=await db.getDoc(db.doc(db.fs,'admins',uid));IS_ACCESS_ADMIN=admin.exists()&&admin.data().enabled===true;
 if(IS_ACCESS_ADMIN&&!preferStation){CU={uid,username:AUTH_PERSON.email,role:'access-admin',name:'Administración de accesos'};render();return;}
 const snap=await db.getDoc(db.doc(db.fs,'access',uid));const access=snap.exists()?snap.data():null;
 if(!access||access.enabled!==true){await renderAccessRequest();return;}
 const dep=DEPENDENCIAS.find(d=>d.cr===access.cr&&d.role!=='divisional');
 if(!dep)throw Error('La estación asignada no es válida. Contactá al administrador.');
 CURRENT_CR=dep.cr;_cache={};_syncQueue={};_syncErrors={};_syncWriting={};_syncLocalOk=true;_syncInit=false;clearTimeout(stimer);stimer=null;_draftSave=null;
 CU={uid,username:AUTH_PERSON.email,name:dep.nombre,depNombre:dep.nombre,cr:dep.cr,role:'empleado'};
 showLoad(true);
 try{await loadEconomic();syncLoad();const raw=await sGet('periodos');APS=raw?JSON.parse(raw):[];await loadPeriod(CP);await loadYER();AT='us';usView=null;render();}finally{showLoad(false);}
}
async function renderAccessRequest(){
 CU=null;const db=await getDB();const ref=db.doc(db.fs,'accessRequests',AUTH_PERSON.uid);const snap=await db.getDoc(ref);const request=snap.exists()?snap.data():null;
 const status=request?.status;const depOptions=DEPENDENCIAS.filter(d=>d.role!=='divisional').map(d=>`<option value="${d.cr}">${esc(d.nombre)} · CR ${d.cr}</option>`).join('');
 document.getElementById('app').innerHTML=econStyle+`<section class="econ" style="max-width:620px"><h2>${status==='pending'?'Solicitud pendiente de autorización':status==='rejected'?'Solicitud rechazada':status==='approved'?'Acceso no habilitado':'Solicitar acceso a una estación'}</h2><p>${esc(AUTH_PERSON.email)}</p>${request?`<p>Estación solicitada: ${esc(request.cr)}. ${status==='pending'?'El administrador debe aprobar tu solicitud antes de que puedas ver datos o archivos.':'Contactá al administrador para revisar tu acceso.'}</p>`:`<form id="request-access"><label>Estación<select id="request-cr" required><option value="">Seleccioná tu estación</option>${depOptions}</select></label><button>Enviar solicitud</button></form>`}<p id="request-status" role="status"></p><button id="request-refresh">Consultar estado</button><button id="request-logout">Salir</button><details><summary>Identificador de cuenta</summary><p>${esc(AUTH_PERSON.uid)}</p></details></section>`;
 document.getElementById('request-logout').onclick=logoutSafe;
 document.getElementById('request-refresh').onclick=()=>resolveAccess().catch(e=>document.getElementById('request-status').textContent=authError(e));
 document.getElementById('request-access')?.addEventListener('submit',async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{const cr=document.getElementById('request-cr').value;if(!DEPENDENCIAS.some(d=>d.cr===cr&&d.role!=='divisional'))throw Error('Elegí una estación.');await db.setDoc(ref,{uid:AUTH_PERSON.uid,email:AUTH_PERSON.email,cr,status:'pending',createdAt:Date.now()});await renderAccessRequest();}catch(e){document.getElementById('request-status').textContent=authError(e);b.disabled=false;}});
}
async function logoutSafe(){
 await flushSaveD();
 if(syncPend()&&!await sincronizar(true))return;
 clearTimeout(stimer);stimer=null;_draftSave=null;await window.acaSignOut?.();AUTH_PERSON=null;IS_ACCESS_ADMIN=false;CU=null;PD=null;_cache={};_syncQueue={};_syncErrors={};_syncWriting={};_syncLocalOk=true;_syncInit=false;_db=null;
 document.getElementById('sync-badge')?.remove();document.getElementById('aviso-guardado')?.remove();render();
}
async function renderAccessAdmin(){
 const root=document.getElementById('app');root.innerHTML=econStyle+'<section class="econ"><h2>Accesos y condiciones económicas</h2><p>Cargando solicitudes…</p></section>';
 try{
 const db=await getDB();const [requests,users]=await Promise.all([db.getDocs(db.collection(db.fs,'accessRequests')),db.getDocs(db.collection(db.fs,'access'))]);
 const reqs=requests.docs.map(d=>({id:d.id,...d.data()}));const accounts=users.docs.map(d=>({id:d.id,...d.data()}));
 const options=DEPENDENCIAS.filter(d=>d.role!=='divisional').map(d=>`<option value="${d.cr}">${esc(d.nombre)} · ${d.cr}</option>`).join('');
 root.innerHTML=econStyle+`<section class="econ"><h2>Accesos y condiciones económicas</h2><p>${esc(CU.username)} · Administrador</p><button id="adm-my-station">Mi estación</button><button id="adm-refresh">Actualizar</button><button id="adm-logout">Salir</button><h3>Solicitudes</h3>${reqs.length?'':'<p>Todavía no hay solicitudes.</p>'}<div style="overflow:auto"><table><thead><tr><th>Gmail</th><th>Estación solicitada</th><th>Estado</th><th>Decisión</th></tr></thead><tbody>${reqs.map(r=>`<tr><td>${esc(r.email)}</td><td>${esc(r.cr)}</td><td>${esc(({pending:'Pendiente',approved:'Aprobada',rejected:'Rechazada'})[r.status]||r.status)}</td><td>${r.status!=='approved'?`<button data-approve="${esc(r.id)}">Aprobar</button>`:''}${r.status==='pending'?`<button data-reject="${esc(r.id)}">Rechazar</button>`:''}</td></tr>`).join('')}</tbody></table></div><h3>Cuentas autorizadas</h3><div style="overflow:auto"><table><thead><tr><th>Gmail</th><th>CR</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${accounts.map(u=>`<tr><td>${esc(u.email)}</td><td>${esc(u.cr)}</td><td>${u.enabled?'Habilitada':'Revocada'}</td><td><button data-toggle="${esc(u.id)}">${u.enabled?'Revocar':'Habilitar'}</button></td></tr>`).join('')}</tbody></table></div><h3>Cargar condiciones</h3><p>Elegí la estación para importar su formulario. Esta sección no abre sus operaciones.</p><select id="adm-cr">${options}</select><button id="adm-conditions">Abrir condiciones</button><p id="adm-status" role="status"></p><div id="adm-economic"></div></section>`;
 root.querySelector('#adm-my-station').onclick=()=>resolveAccess(true).catch(e=>root.querySelector('#adm-status').textContent=e.message);root.querySelector('#adm-refresh').onclick=renderAccessAdmin;root.querySelector('#adm-logout').onclick=logoutSafe;
 async function action(fn){try{await fn();await renderAccessAdmin();}catch(e){root.querySelector('#adm-status').textContent=e.message;}}
 root.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>action(async()=>{const r=reqs.find(x=>x.id===b.dataset.approve);if(!confirm('¿Autorizar '+r.email+' para CR '+r.cr+'?'))return;const batch=db.writeBatch(db.fs);batch.set(db.doc(db.fs,'access',r.id),{email:r.email,cr:r.cr,enabled:true,approvedBy:CU.uid,updatedAt:Date.now()});batch.update(db.doc(db.fs,'accessRequests',r.id),{status:'approved',reviewedBy:CU.uid,reviewedAt:Date.now()});await batch.commit();}));
 root.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>action(async()=>{const r=reqs.find(x=>x.id===b.dataset.reject);if(!confirm('¿Rechazar la solicitud de '+r.email+'?'))return;const {id,...data}=r;await db.setDoc(db.doc(db.fs,'accessRequests',id),{...data,status:'rejected',reviewedBy:CU.uid,reviewedAt:Date.now()});}));
 root.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>action(async()=>{const u=accounts.find(x=>x.id===b.dataset.toggle);if(!confirm((u.enabled?'¿Revocar':'¿Habilitar')+' acceso de '+u.email+'?'))return;const {id,...data}=u;await db.setDoc(db.doc(db.fs,'access',id),{...data,enabled:!u.enabled,updatedAt:Date.now(),approvedBy:CU.uid});}));
 root.querySelector('#adm-conditions').onclick=async()=>{try{if(syncPend()&&!await sincronizar(true))return;CURRENT_CR=root.querySelector('#adm-cr').value;_cache={};_syncQueue={};_syncErrors={};_syncWriting={};_syncLocalOk=true;await loadEconomic();const original=economicFor(CP)||blankEconomic(CURRENT_CR);mountEconomic(root.querySelector('#adm-economic'),original,saveEconomicConfiguration);}catch(e){root.querySelector('#adm-status').textContent=e.message;}};
 }catch(e){root.innerHTML=econStyle+`<section class="econ"><h2>No se pudo cargar la administración</h2><p>${esc(authError(e))}</p><button onclick="renderAccessAdmin()">Reintentar</button><button onclick="logoutSafe()">Salir</button></section>`;}
}
async function saveEconomicConfiguration(c){
 if(!IS_ACCESS_ADMIN)throw Error('Solo el administrador puede cargar condiciones.');
 if(c.cr!==CURRENT_CR)throw Error('El CR del formulario no corresponde a la estación seleccionada.');
 if(ECON.some(x=>x.vigencia===c.vigencia))throw Error('Ya existe una versión para ese mes. Usá una nueva vigencia para preservar el acuerdo anterior.');
 const next=[...ECON,structuredClone(c)];if(!await sSet('economic:versions',JSON.stringify(next)))throw Error('Condiciones pendientes de sincronización. No están confirmadas en la nube.');ECON=next;
}

async function openAdminPanel(){if(!IS_ACCESS_ADMIN)return;if(syncPend()&&!await sincronizar(true))return;CU={uid:AUTH_PERSON.uid,username:AUTH_PERSON.email,role:"access-admin",name:"Administración de accesos"};render();}
