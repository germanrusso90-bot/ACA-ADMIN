function yerRate(key){
 if(!key)return {mode:'porcentaje',value:0};
 const rate=YER.rates?.[key];
 if(rate){if(!['porcentaje','pesos_litro'].includes(rate.mode)||typeof rate.value!=='number'||!Number.isFinite(rate.value)||rate.value<0||(rate.mode==='porcentaje'&&rate.value>100))throw Error('Comisión inválida para '+key);return rate;}
 // Legacy periods contain only percentage values. Preserve their meaning.
 if(CURRENT_CR!=='3531'&&!economicFor(prevMonth(CP))&&!Object.values(YER.pcts||{}).some(v=>v>0))throw Error('Faltan las condiciones YER de esta estación.');
 const value=Number(YER.pcts?.[key]??0);if(!Number.isFinite(value)||value<0||value>100)throw Error('Porcentaje inválido para '+key);
 return {mode:'porcentaje',value};
}
async function viewYERSource(field){try{const meta=YER[field];if(!meta?.fileKey)throw Error('Este registro histórico no contiene el Excel original.');const raw=await sGet(meta.fileKey);if(!raw)throw Error('Archivo no encontrado.');openExcelViewer(JSON.parse(raw));}catch(e){alert(e.message);}}
function exportLocalBackup(){
 if(!CU?.cr)throw Error('Entrá a tu estación antes de exportar.');
 const values={};Object.keys(localStorage).filter(k=>k.startsWith('_ttl:cr'+CU.cr+':')||(k==='_sync:cr'+CU.cr||k==='_sync:v4:cr'+CU.cr)||k.startsWith('cr'+CU.cr+':')).forEach(k=>values[k]=localStorage.getItem(k));
 econDownload('respaldo-local-'+CU.cr+'-'+Date.now()+'.json',{cr:CU.cr,createdAt:new Date().toISOString(),scope:'Solo datos presentes en este navegador; no equivale a respaldo completo de Firebase.',values});
}

function hotelPeriodFromInputId(id){const m=String(id).match(/-(\d{4}-(?:0[1-9]|1[0-2]))$/);return m?m[1]:null;}
function yerStoragePeriod(month){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Período YER inválido.');const [y,m]=month.split('-').map(Number);return m===12?(y+1)+'-01':y+'-'+String(m+1).padStart(2,'0');}
