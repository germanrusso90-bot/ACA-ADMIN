// Historial importado del Excel de una estación (v4.3.13): copia de consulta,
// de solo lectura. Se guarda en economic:versions:historial:<año>, dentro del
// espacio de condiciones: solo el administrador lo escribe y la estación lo lee.
// No se recalcula ni se suma a las cargas.
const HISTORIAL_MAX_BYTES=2000000;
const HISTORIAL_AVISO='Copia de consulta del Excel de la estación. No se recalcula ni se suma a las cargas.';
function historialKey(anio){return 'economic:versions:historial:'+anio;}
function checkHistorial(h,cr){
 const fail=msg=>{throw Error('Historial inválido: '+msg);};
 const str=(v,max,name,min=0)=>{if(v===undefined||v===null)v='';if(typeof v!=='string'||v.length<min||v.length>max)fail(name+(min?' debe tener entre '+min+' y ':' admite hasta ')+max+' caracteres.');return v;};
 const num=(v,name)=>{if(v===undefined||v===null)return null;if(typeof v!=='number'||!Number.isFinite(v))fail(name+' debe ser un número o vacío.');return v;};
 if(!h||typeof h!=='object'||Array.isArray(h))fail('el archivo no es un objeto JSON.');
 if(h.schema!==1||h.tipo!=='historial-importado')fail('falta schema 1 o tipo «historial-importado».');
 if(typeof h.cr!=='string'||!/^\d{4}$/.test(h.cr))fail('CR inválido.');
 if(h.cr!==String(cr))fail('corresponde al CR '+h.cr+' y no a la estación seleccionada (CR '+cr+').');
 if(!Number.isInteger(h.anio)||h.anio<2000||h.anio>2100)fail('año inválido.');
 const o=h.origen;if(!o||typeof o!=='object')fail('falta el origen.');
 const archivo=str(o.archivo,200,'El nombre del archivo de origen',1);
 if(typeof o.sha256!=='string'||!/^[0-9a-f]{64}$/.test(o.sha256))fail('la huella SHA-256 del origen debe tener 64 caracteres hexadecimales.');
 if(typeof o.importado!=='string'||!isoDateOk(o.importado))fail('la fecha de importación debe ser AAAA-MM-DD.');
 const nota=str(h.nota,500,'La nota');
 if(!Array.isArray(h.filas)||!h.filas.length||h.filas.length>3000)fail('debe tener entre 1 y 3000 filas.');
 const ids=new Set();
 const filas=h.filas.map((r,i)=>{
  const at='fila '+(i+1)+': ';
  if(!r||typeof r!=='object'||Array.isArray(r))fail(at+'no es un objeto.');
  const id=str(r.id,20,at+'el id',1);if(ids.has(id))fail(at+'id repetido ('+id+').');ids.add(id);
  if(typeof r.periodo!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.periodo)||Number(r.periodo.slice(0,4))!==h.anio)fail(at+'el período debe ser AAAA-MM del año '+h.anio+'.');
  const fecha=r.fecha===undefined||r.fecha===null?'':r.fecha;if(fecha!==''&&(typeof fecha!=='string'||!isoDateOk(fecha)))fail(at+'la fecha debe ser AAAA-MM-DD o vacía.');
  const marcas=r.marcas===undefined||r.marcas===null?[]:r.marcas;
  if(!Array.isArray(marcas)||marcas.length>10)fail(at+'las marcas deben ser una lista de hasta 10.');
  if(r.noRecupera!==undefined&&typeof r.noRecupera!=='boolean')fail(at+'noRecupera debe ser verdadero o falso.');
  const out={id,concepto:str(r.concepto,120,at+'el concepto',1),hoja:str(r.hoja,60,at+'la hoja'),periodo:r.periodo,nro:str(r.nro,120,at+'el comprobante'),fecha,
   total:num(r.total,at+'total'),iva:num(r.iva,at+'IVA'),percepciones:num(r.percepciones,at+'percepciones'),recupero:num(r.recupero,at+'recupero'),
   detalle:str(r.detalle,500,at+'el detalle'),marcas:marcas.map(m=>str(m,300,at+'cada marca'))};
  if(r.fechaTexto!==undefined&&r.fechaTexto!==null)out.fechaTexto=str(r.fechaTexto,60,at+'el texto de la fecha');
  if(r.noRecupera)out.noRecupera=true;
  return out;
 });
 return {schema:1,tipo:'historial-importado',cr:h.cr,anio:h.anio,origen:{archivo,sha256:o.sha256,importado:o.importado},nota,filas};
}
function historialSummary(h){
 const conceptos=new Set(h.filas.map(r=>r.concepto)),periodos=new Set(h.filas.map(r=>r.periodo));
 return {anio:h.anio,filas:h.filas.length,conceptos:conceptos.size,periodos:periodos.size,conMarcas:h.filas.filter(r=>r.marcas.length).length};
}
// Años a consultar: el del período, el anterior y el actual (cada lectura queda en caché).
async function historialYears(period){
 const y=Number(String(period).slice(0,4)),now=new Date().getFullYear();
 const years=[...new Set([y,y-1,now].filter(n=>n>=2000&&n<=2100))].sort((a,b)=>b-a),found=[];
 for(const anio of years){try{if(await sGet(historialKey(anio)))found.push(anio);}catch(e){console.warn('No se pudo consultar el historial',anio,e.message);}}
 return found;
}
function historialButtons(years){return years.length?'<p>'+years.map(y=>`<button type="button" data-historial="${y}">Historial ${y} (Excel)</button>`).join('')+'</p>':'';}
function attachHistorialButtons(el,area){el.querySelectorAll('[data-historial]').forEach(b=>b.onclick=()=>renderHistorial(Number(b.dataset.historial),area));}
async function loadHistorial(anio){
 const raw=await sGet(historialKey(anio));if(!raw)return null;
 try{return checkHistorial(JSON.parse(raw),CURRENT_CR);}catch(e){throw Error('El historial '+anio+' guardado no se puede mostrar. '+e.message);}
}
function historialFiltrar(h,f){
 const q=String(f.q||'').trim().toLocaleLowerCase('es-AR');
 return h.filas.filter(r=>(!f.concepto||r.concepto===f.concepto)&&(!f.periodo||r.periodo===f.periodo)&&(!q||[r.concepto,r.hoja,r.nro,r.detalle,r.fechaTexto||'',...r.marcas].join(' ').toLocaleLowerCase('es-AR').includes(q)))
  .map((r,i)=>[r,i]).sort((a,b)=>a[0].periodo.localeCompare(b[0].periodo)||a[1]-b[1]).map(x=>x[0]);
}
function historialRecupero(rows){return Math.round(rows.reduce((n,r)=>n+(r.noRecupera||r.recupero===null?0:Math.round(r.recupero*100)),0))/100;}
function historialRow(r){
 const marcas=r.marcas.map(m=>'⚠ '+esc(m));if(r.noRecupera)marcas.unshift('<strong>No se recupera</strong>');const extra=marcas.map(m=>`<small class="hs-sub">${m}</small>`).join('');
 return `<tr${r.noRecupera?' class="hs-no"':''}><td>${esc(periodLabel(r.periodo))}</td><td>${esc(r.concepto)}${r.hoja?`<br><small>${esc(r.hoja)}</small>`:''}</td><td>${esc(r.nro)}</td><td>${esc(r.fecha?fmtFechaIso(r.fecha):(r.fechaTexto||''))}</td><td class="amt">${fmtM(r.total)}</td><td class="amt">${fmtM(r.iva)}</td><td class="amt">${fmtM(r.recupero)}</td><td>${esc(r.detalle)}${extra}</td></tr>`;
}
async function renderHistorial(anio,area){
 const el=document.getElementById('tab-content'),cr=CURRENT_CR;let h;
 try{h=await loadHistorial(anio);}catch(e){el.textContent=e.message;return;}
 if(CURRENT_CR!==cr)return;
 if(!h){el.textContent='No hay historial '+anio+' para esta estación.';return;}
 const conceptos=[...new Set(h.filas.map(r=>r.concepto))].sort((a,b)=>a.localeCompare(b,'es')),periodos=[...new Set(h.filas.map(r=>r.periodo))].sort();
 el.innerHTML=econStyle+`<div class="econ"><h2>Historial ${esc(anio)} (Excel) · CR ${esc(cr)}</h2><p class="note">${HISTORIAL_AVISO}</p><p>Archivo de origen: ${esc(h.origen.archivo)} · importado el ${esc(fmtFechaIso(h.origen.importado))}</p>${h.nota&&h.nota.trim().toLowerCase()!==HISTORIAL_AVISO.toLowerCase()?`<p>${esc(h.nota.trim())}</p>`:''}<button type="button" id="hs-back">Volver a Recuperos</button><button type="button" id="hs-xlsx">Descargar Excel</button><div class="econ-grid"><label class="hs-f">Concepto<select id="hs-concepto"><option value="">Todos</option>${conceptos.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label><label class="hs-f">Período<select id="hs-periodo"><option value="">Todos</option>${periodos.map(p=>`<option value="${esc(p)}">${esc(periodLabel(p))}</option>`).join('')}</select></label><label class="hs-f">Buscar<input type="search" id="hs-q" placeholder="Comprobante, detalle o marca"></label></div><p id="hs-resumen" role="status" aria-live="polite"></p><div class="scroll" role="region" tabindex="0" aria-label="Tabla del historial ${esc(anio)}"><table><caption class="sr-only">Historial ${esc(anio)} importado del Excel</caption><thead><tr><th scope="col">Período</th><th scope="col">Concepto</th><th scope="col">Comprobante</th><th scope="col">Fecha</th><th scope="col">Total</th><th scope="col">IVA</th><th scope="col">Recupero</th><th scope="col">Detalle y marcas</th></tr></thead><tbody id="hs-body"></tbody><tfoot><tr><th scope="row" colspan="6" id="hs-filas"></th><td id="hs-total" class="amt"></td><td></td></tr></tfoot></table></div><p id="hs-status" role="status"></p></div>`;
 let visible=[];
 const paint=()=>{
  visible=historialFiltrar(h,{concepto:el.querySelector('#hs-concepto').value,periodo:el.querySelector('#hs-periodo').value,q:el.querySelector('#hs-q').value});
  const sum=historialRecupero(visible);
  el.querySelector('#hs-body').innerHTML=visible.map(historialRow).join('')||'<tr><td colspan="8">No hay filas con esos filtros.</td></tr>';
  el.querySelector('#hs-filas').textContent=visible.length+(visible.length===1?' fila':' filas');
  el.querySelector('#hs-total').textContent=fmtM(sum);
  el.querySelector('#hs-resumen').textContent=visible.length+(visible.length===1?' fila':' filas')+' · Recupero: '+fmtM(sum)+' (sin las filas que no se recuperan)';
 };
 ['#hs-concepto','#hs-periodo'].forEach(s=>el.querySelector(s).onchange=paint);el.querySelector('#hs-q').oninput=paint;
 el.querySelector('#hs-back').onclick=()=>renderEconomicEntry(area);
 el.querySelector('#hs-xlsx').onclick=async()=>{
  try{
   const X=await loadXLSX();
   const rows=[['Período','Hoja','Concepto','Comprobante','Fecha','Total','IVA','Percepciones','Recupero','Se recupera','Detalle','Marcas']];
   visible.forEach(r=>rows.push([r.periodo,r.hoja,r.concepto,r.nro,r.fecha?fmtFechaIso(r.fecha):(r.fechaTexto||''),r.total,r.iva,r.percepciones,r.recupero,r.noRecupera?'No':'Sí',r.detalle,r.marcas.join(' | ')]));
   const ws=X.utils.aoa_to_sheet(rows);ws['!cols']=[{wch:9},{wch:16},{wch:28},{wch:18},{wch:12},{wch:14},{wch:14},{wch:14},{wch:14},{wch:11},{wch:40},{wch:40}];
   const wb=X.utils.book_new();X.utils.book_append_sheet(wb,ws,'Historial '+anio);X.writeFile(wb,'Historial_CR'+cr+'_'+anio+'.xlsx');
  }catch(e){el.querySelector('#hs-status').textContent=e.message;}
 };
 paint();
}
