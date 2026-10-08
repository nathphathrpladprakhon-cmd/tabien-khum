'use strict';
const $=s=>document.querySelector(s);let data={records:[],categories:[]},activityTypes=[],page=1,editing=null,openedFromExpiryDialog=false;const size=20,STORAGE_KEY='tabien-khum-v1';
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CATEGORY_TYPES=[
  'กิจการที่เกี่ยวกับสัตว์เลี้ยง',
  'กิจการที่เกี่ยวกับสัตว์และผลิตภัณฑ์',
  'กิจการที่เกี่ยวกับอาหาร เครื่องดื่ม น้ำดื่ม ยกเว้นในสถานที่จำหน่ายอาหาร การเร่ขาย การขายในตลาด และการผลิตเพื่อบริโภคในครัวเรือน',
  'กิจการที่เกี่ยวกับยา เวชภัณฑ์ อุปกรณ์การแพทย์ เครื่องสำอาง และผลิตภัณฑ์ทำความสะอาด',
  'กิจการที่เกี่ยวกับการเกษตร',
  'กิจการที่เกี่ยวกับโลหะหรือแร่',
  'กิจการที่เกี่ยวกับยานยนต์ เครื่องจักรหรือเครื่องกล',
  'กิจการที่เกี่ยวกับไม้หรือกระดาษ',
  'กิจการที่เกี่ยวกับการบริการ',
  'กิจการที่เกี่ยวกับสิ่งทอ',
  'กิจการที่เกี่ยวกับหิน ดิน ทราย ซีเมนต์ หรือวัตถุที่คล้ายคลึง',
  'กิจการที่เกี่ยวกับปิโตรเลียม ปิโตรเคมี ถ่านหิน ถ่านโค้ก และสารเคมีต่าง ๆ',
  'กิจการอื่น ๆ'
];
const THAI_MONTHS=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const categoryNo=value=>Number(String(value||'').match(/หมวด\s*(\d+)/)?.[1]||0);
const categoryLabels=()=>Array.isArray(activityTypes)&&activityTypes.length?activityTypes.map(x=>x.name):CATEGORY_TYPES;
function getDetailSuffix(d){
  if(!d)return '';
  const mFull=String(d.name||'').match(/^(\d+(?:\.\d+)?)\s*[^—]*—\s*([ก-ฮ])\./);
  if(mFull)return mFull[1]+mFull[2];
  const mLetter=String(d.name||'').match(/([ก-ฮ])\./);
  if(mLetter)return mLetter[1];
  const mNum=String(d.name||'').match(/^(\d+(?:\.\d+)?)/);
  if(mNum)return mNum[1];
  return String(d.number||'');
}
const activityCode=value=>{
  const match=String(value||'').replace(/\s/g,'').match(/^(\d+)\((\d+)\)(?:[-_]?([ก-ฮ0-9.]+))?/);
  return match?{category:Number(match[1]),subcategory:Number(match[2]),detailSuffix:match[3]||''}:{category:0,subcategory:0,detailSuffix:''};
};
const activityGroup=number=>Array.isArray(activityTypes)?activityTypes.find(group=>Number(group.number)===Number(number)):null;
const activityItem=(category,subcategory)=>activityGroup(category)?.items.find(item=>Number(item.number)===Number(subcategory));
const activityDetail=(category,subcategory,detailVal)=>{
  const it=activityItem(category,subcategory);
  if(!it||!it.details)return null;
  const s=String(detailVal||'').trim();
  if(!s)return null;
  return it.details.find(d=>getDetailSuffix(d)===s)||it.details.find(d=>String(d.number)===s)||null;
};
function populateFormSubcategories(category,preserve=''){const select=$('#formSubcategory'),group=activityGroup(category);if(!group){select.innerHTML='<option value="">เลือกประเภทกิจการก่อน</option>';select.disabled=true;return;}select.disabled=false;select.innerHTML='<option value="">เลือกกิจการย่อย</option>'+group.items.map(item=>`<option value="${item.number}">${category}(${item.number}) ${escapeHTML(item.name)}</option>`).join('');select.value=String(preserve||'');}
function populateFormDetails(category,subcategory,preserve=''){
  const select=$('#formDetail'),details=activityItem(category,subcategory)?.details||[];
  if(!details.length){select.innerHTML='<option value="">ไม่มีรายละเอียดระดับย่อยเพิ่มเติม</option>';select.disabled=true;return;}
  select.disabled=false;
  select.innerHTML='<option value="">เลือกรายละเอียดกิจการย่อย</option>'+details.map(item=>{
    const suf=getDetailSuffix(item);
    return `<option value="${escapeHTML(suf)}" data-number="${item.number}" data-fee="${escapeHTML(item.fee||'')}">${escapeHTML(item.name)}${item.fee?` — ${escapeHTML(item.fee)} บาท`:''}</option>`;
  }).join('');
  const sPreserve=String(preserve||'').trim();
  const matchedOpt=Array.from(select.options).find(opt=>opt.value===sPreserve||opt.dataset.number===sPreserve);
  select.value=matchedOpt?matchedOpt.value:'';
}
function syncFormCode(){
  const main=$('#formCategory').value,sub=$('#formSubcategory').value,detailSuffix=$('#formDetail').value,input=$('#form').elements.code;
  if(!main||!sub)return;
  input.value=`${main}(${sub})${detailSuffix||''}`;
}
function notice(message,error=false){$('#notice').textContent=message;$('#notice').className=error?'error':'';}
function normalizeThaiDate(str){
  if(!str)return'';
  const s=String(str).trim();
  const m=s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,5})$/);
  if(!m)return s;
  let p1=parseInt(m[1],10),p2=parseInt(m[2],10),yr=parseInt(m[3],10);
  if(yr>25000)yr=parseInt(String(yr).slice(0,4),10);
  if(yr>=500&&yr<600)yr+=2000;
  const shortYr=yr%100;
  if(p1>12&&p2<=12)return `${p1}/${p2}/${shortYr}`;
  if(p2>12&&p1<=12)return `${p2}/${p1}/${shortYr}`;
  return `${p1}/${p2}/${shortYr}`;
}
function cleanRecord(record){
  if(!record||typeof record!=='object'||!String(record.name||'').trim())throw Error('กรุณาระบุชื่อผู้ประกอบการ');
  const copy={...record};
  delete copy.id;
  if(!Array.isArray(copy.history))copy.history=[];
  else copy.history=copy.history.map(h=>({...h,renewed:normalizeThaiDate(h.renewed),expires:normalizeThaiDate(h.expires)}));
  return copy;
}
function save(){
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
  }catch(e){
    console.warn('LocalStorage save error:',e);
  }
}
const CLOUD_API_KEY='tabien_khum_cloud_api';
const DEFAULT_CLOUD_API='https://tabien-khum-api.nathphathrpladprakhon.workers.dev';
function getCloudApiUrl(){
  const saved=localStorage.getItem(CLOUD_API_KEY);
  if(saved==='none'||saved==='')return '';
  if(saved===null||saved===undefined)return DEFAULT_CLOUD_API;
  return saved.trim().replace(/\/+$/,'');
}
async function api(path,options={}){
  const cloudUrl=getCloudApiUrl(),method=options.method||'GET';
  if(cloudUrl){
    try{
      const controller=new AbortController();
      const timeoutId=setTimeout(()=>controller.abort(),3500);
      const res=await fetch(cloudUrl+path,{...options,signal:controller.signal,headers:{'Content-Type':'application/json',...(options.headers||{})}});
      clearTimeout(timeoutId);
      if(res.ok){
        const jsonResult=await res.json();
        if(path==='/api/records'&&method==='GET'&&Array.isArray(jsonResult?.records)&&jsonResult.records.length>0){
          data=jsonResult;save();
        }
        return jsonResult;
      }
    }catch(err){console.warn('Cloud API unavailable or timed out, using local data:',err);}
  }
  if(path==='/api/records'&&method==='GET')return JSON.parse(JSON.stringify(data));
  if(path==='/api/records'&&method==='POST'){const record=cleanRecord(JSON.parse(options.body));const id=Math.max(0,...data.records.map(r=>Number(r.id)||0))+1;data.records.unshift({...record,id});save();return{id};}
  const match=path.match(/^\/api\/records\/(\d+)$/);
  if(match){const id=Number(match[1]),index=data.records.findIndex(r=>Number(r.id)===id);if(index<0)throw Error('ไม่พบรายการ');if(method==='DELETE')data.records.splice(index,1);else if(method==='PUT')data.records[index]={...cleanRecord(JSON.parse(options.body)),id};else throw Error('ไม่รองรับคำสั่ง');save();return{ok:true};}
  if(path==='/api/restore'&&method==='POST'){const payload=JSON.parse(options.body);if(!Array.isArray(payload.records)||!Array.isArray(payload.categories))throw Error('ไฟล์สำรองไม่ถูกต้อง');data={records:payload.records.map((r,i)=>({...cleanRecord(r),id:Number(r.id)||i+1})),categories:payload.categories};save();return{count:data.records.length};}
  throw Error('ไม่พบเส้นทางข้อมูล');
}
function renderAll(){
  if(!data||!Array.isArray(data.records)||data.records.length===0){
    if(typeof window!=='undefined'&&window.SEED_DATA&&Array.isArray(window.SEED_DATA.records)&&window.SEED_DATA.records.length>0){
      data=JSON.parse(JSON.stringify(window.SEED_DATA));
      data.records=data.records.map((r,i)=>({...r,id:r.id||i+1}));
      save();
    }
  }
  if(!data||!Array.isArray(data.records))return;
  const current=$('#category').value,currentSub=$('#subcategory').value,labels=categoryLabels();
  const categoryOptions=labels.map((label,i)=>`<option value="${i+1}">${i+1}. ${escapeHTML(label)}</option>`).join('');
  $('#category').innerHTML='<option value="">ทุกประเภทกิจการ (13 ประเภท)</option>'+categoryOptions;
  $('#category').value=current;
  updateSubcategories(currentSub);
  $('#formCategory').innerHTML='<option value="">เลือกประเภทกิจการ</option>'+categoryOptions;

  const curBE=String(new Date().getFullYear()+543);
  const years=[...new Set([...(data.records||[]).flatMap(r=>(r.history||[]).map(h=>String(h.year||'').trim())).filter(y=>y&&/^\d{4}$/.test(y)),curBE])].sort((a,b)=>Number(b)-Number(a));
  const yr=$('#year').value;
  $('#year').innerHTML=years.map(y=>`<option value="${escapeHTML(y)}">${escapeHTML(y)}</option>`).join('');
  $('#year').value=(yr&&years.includes(yr))?yr:(years[0]||curBE);

  $('#total').textContent=(data.records||[]).length.toLocaleString('th-TH');
  $('#catCount').textContent='13';
  renderCategoryCards();
  render();
  updateExpiryBadgeAndCard();
}
async function initialize(){
  if(typeof window!=='undefined'&&window.ACTIVITY_TYPES&&Array.isArray(window.ACTIVITY_TYPES)){
    activityTypes=window.ACTIVITY_TYPES;
  }else{
    try{
      const types=await fetch('activity-types.json');
      if(types.ok)activityTypes=await types.json();
    }catch(e){}
  }

  let initialData=(typeof window!=='undefined'&&window.SEED_DATA)||null;
  if(!initialData){
    try{
      const res=await fetch('initial.json');
      if(res.ok) initialData=await res.json();
    }catch(e){console.warn('Failed to load initial.json:',e);}
  }

  const DATA_VER='20261008_dmy_v2';
  const isMigrated=localStorage.getItem('tabien_khum_data_ver')===DATA_VER;

  const stored=localStorage.getItem(STORAGE_KEY);
  let hasValidStored=false;
  if(stored&&isMigrated){
    try{
      const parsed=JSON.parse(stored);
      if(parsed&&Array.isArray(parsed.records)&&parsed.records.length>0){
        data=parsed;
        hasValidStored=true;
      }
    }catch(e){console.warn('Invalid stored data:',e);}
  }

  if(!hasValidStored&&initialData&&Array.isArray(initialData.records)&&initialData.records.length>0){
    const pinMap=new Map();
    if(stored){
      try{
        const p=JSON.parse(stored);
        (p.records||[]).forEach(r=>{
          if(r.latitude&&r.longitude)pinMap.set(Number(r.id),{lat:r.latitude,lng:r.longitude,src:r.mapSource});
        });
      }catch(_){}
    }
    data=JSON.parse(JSON.stringify(initialData));
    data.records=data.records.map((r,i)=>{
      const pin=pinMap.get(r.id||i+1);
      return {
        ...r,
        id:r.id||i+1,
        latitude:pin?pin.lat:(r.latitude||null),
        longitude:pin?pin.lng:(r.longitude||null),
        mapSource:pin?pin.src:(r.mapSource||null)
      };
    });
    save();
    localStorage.setItem('tabien_khum_data_ver',DATA_VER);
  }else if(hasValidStored&&initialData&&Array.isArray(initialData.records)){
    const initialMap=new Map();
    initialData.records.forEach(r=>{
      if(r.latitude&&r.longitude){
        if(r.id) initialMap.set(Number(r.id),r);
        if(r.name) initialMap.set(String(r.name).trim(),r);
      }
    });
    let merged=0;
    data.records.forEach((r,idx)=>{
      if(!r.id) r.id=idx+1;
      if(!r.latitude||!r.longitude){
        const m=initialMap.get(Number(r.id))||initialMap.get(String(r.name||'').trim());
        if(m&&m.latitude&&m.longitude){
          r.latitude=m.latitude;
          r.longitude=m.longitude;
          r.mapSource=m.mapSource||'auto-free';
          merged++;
        }
      }
    });
    if(merged>0) save();
  }

  // Render local data immediately (0ms) so user never sees blank table or empty dash
  renderAll();
}
function updateSubcategories(preserve=''){const cat=Number($('#category')?.value||0),select=$('#subcategory');if(!select)return;const group=Array.isArray(activityTypes)?activityTypes.find(x=>x.number===cat):null;if(!group||!Array.isArray(group.items)){select.innerHTML='<option value="">ทุกกิจการย่อย</option>';select.value='';select.hidden=true;select.disabled=true;return;}select.hidden=false;select.disabled=false;select.innerHTML='<option value="">ทุกกิจการย่อยในประเภทนี้</option>'+group.items.map(item=>{const prefix=`${cat}(${item.number})`,count=(data.records||[]).filter(r=>String(r.code||'').replace(/\s/g,'').startsWith(prefix)).length;return `<option value="${item.number}">${prefix} ${escapeHTML(item.name)} (${count.toLocaleString('th-TH')} รายการ)</option>`;}).join('');select.value=preserve;}
function renderCategoryCards(){const labels=categoryLabels(),counts=Array.from({length:13},(_,i)=>data.records.filter(r=>categoryNo(r.category)===i+1).length);$('#categoryCards').innerHTML=labels.map((label,i)=>`<button type="button" class="category-card" data-category="${i+1}"><span class="category-number">${i+1}</span><span class="category-copy"><b>${escapeHTML(label)}</b><em>${counts[i].toLocaleString('th-TH')} รายการ</em></span></button>`).join('');}
async function load(){
  try{
    if(data.records&&data.records.length>0){
      renderAll();
    }
    const remoteData=await api('/api/records');
    if(remoteData&&Array.isArray(remoteData.records)&&remoteData.records.length>0){
      const coordMap=new Map();
      (data.records||[]).forEach(r=>{
        if(r.latitude&&r.longitude){
          const k=String(r.name||'').replace(/[\s\r\n]+/g,' ').trim().toLowerCase();
          if(k)coordMap.set(k,{latitude:r.latitude,longitude:r.longitude,mapSource:r.mapSource});
        }
      });
      remoteData.records.forEach(r=>{
        if(!r.latitude||!r.longitude){
          const k=String(r.name||'').replace(/[\s\r\n]+/g,' ').trim().toLowerCase();
          const c=coordMap.get(k);
          if(c){r.latitude=c.latitude;r.longitude=c.longitude;r.mapSource=c.mapSource;}
        }
      });
      data=remoteData;
      save();
    }else if(!data.records||data.records.length===0){
      if(typeof window!=='undefined'&&window.SEED_DATA&&Array.isArray(window.SEED_DATA.records)&&window.SEED_DATA.records.length>0){
        data=JSON.parse(JSON.stringify(window.SEED_DATA));
        save();
      }else{
        const res=await fetch('initial.json');
        if(res.ok){
          data=await res.json();
          data.records=data.records.map((r,i)=>({...r,id:r.id||i+1}));
          save();
        }
      }
    }
    renderAll();
  }catch(e){
    console.error('Load error:',e);
    if(!data.records||data.records.length===0){
      if(typeof window!=='undefined'&&window.SEED_DATA&&Array.isArray(window.SEED_DATA.records)&&window.SEED_DATA.records.length>0){
        data=JSON.parse(JSON.stringify(window.SEED_DATA));
        save();
        renderAll();
      }
    }
    notice(e.message,true);
  }
}
function filtered(){const q=($('#search')?.value||'').trim().toLowerCase(),cat=$('#category')?.value||'',sub=$('#subcategory')?.value||'',prefix=cat&&sub?`${cat}(${sub})`:'';return (data.records||[]).filter(r=>(!cat||categoryNo(r.category)===Number(cat))&&(!prefix||String(r.code||'').replace(/\s/g,'').startsWith(prefix))&&(!q||JSON.stringify(r).toLowerCase().includes(q)));}
function render(){const list=filtered(),year=$('#year')?.value||'';page=Math.max(1,Math.min(page,Math.ceil(list.length/size)||1));$('#licensed').textContent=(data.records||[]).filter(r=>!r.cancelled&&(r.history||[]).some(h=>h.year===year&&h.number)).length;$('#result').textContent=`พบ ${list.length.toLocaleString('th-TH')} รายการ • ปีงบประมาณ ${year}`;$('#rows').innerHTML=list.slice((page-1)*size,page*size).map(r=>{const h=(r.history||[]).find(h=>h.year===year)||{},code=activityCode(r.code),cat=code.category||categoryNo(r.category),group=activityGroup(cat),item=activityItem(cat,code.subcategory),detail=activityDetail(cat,code.subcategory,r.activityDetail||code.detailSuffix),hasMap=Number.isFinite(Number(r.latitude))&&Number.isFinite(Number(r.longitude))&&r.latitude&&r.longitude;return `<tr class="${r.cancelled?'is-cancelled':''}"><td><div class="name">${escapeHTML(r.name)}</div><small>${escapeHTML(r.address)}</small><button class="map-link" data-map-record="${r.id}">⌖ ${hasMap?'ดูตำแหน่ง':'เพิ่มหมุด'}ในแผนที่</button></td><td class="activity-cell"><span class="tag">ประเภท ${cat||'—'}</span>${r.cancelled?`<span class="cancelled-badge">ยกเลิกกิจการ${r.cancelYear?` (ปี ${escapeHTML(r.cancelYear)})`:''}</span>`:''}<div class="category-name">${escapeHTML(group?.name||r.category||'ไม่ระบุประเภท')}</div><small class="subcategory-name"><b>${escapeHTML(r.code||'—')}</b>${item?' '+escapeHTML(item.name):''}${detail?`<span class="detail-line">${escapeHTML(detail.name)}</span>`:''}</small></td><td>${escapeHTML(r.business)}</td><td style="text-align:center">${r.fee?escapeHTML(Number.isFinite(Number(String(r.fee).replace(/,/g,'')))?Number(String(r.fee).replace(/,/g,'')).toLocaleString('th-TH'):r.fee):'—'}</td><td>${escapeHTML(h.number||'—')}<small>ต่ออายุ: ${escapeHTML(h.renewed||'—')}<br>หมดอายุ: ${escapeHTML(h.expires||'—')}</small></td><td><div class="row-actions"><button class="secondary" data-edit="${r.id}">เปิด / แก้ไข</button><button class="secondary delete" data-delete="${r.id}">ลบ</button></div></td></tr>`}).join('')||'<tr><td colspan="6" class="empty">ไม่พบรายการที่ค้นหา</td></tr>';$('#pageInfo').textContent=`หน้า ${page} / ${Math.ceil(list.length/size)||1}`;$('#prev').disabled=page===1;$('#next').disabled=page*size>=list.length;}
function historyRow(h={}){const tr=document.createElement('tr');tr.innerHTML=['year','number','renewed','expires'].map(k=>`<td><input data-key="${k}" aria-label="${escapeHTML(k)}" value="${escapeHTML(h[k]||'')}" ${k==='year'?'required pattern="[0-9]{4}"':''}></td>`).join('')+'<td><button type="button" class="secondary">ลบปี</button></td>';tr.querySelector('button').onclick=()=>tr.remove();$('#history').append(tr);}
function edit(r=null){
  editing=r;
  $('#form').reset();
  $('#formTitle').textContent=r?'รายละเอียด / แก้ไขทะเบียน':'เพิ่มทะเบียน';
  const code=activityCode(r?.code),main=code.category||categoryNo(r?.category),detailVal=r?.activityDetail||code.detailSuffix;
  $('#formCategory').value=main||'';
  populateFormSubcategories(main,code.subcategory);
  populateFormDetails(main,code.subcategory,detailVal);
  for(const k of ['code','fee','name','address','business','notes']){if($('#form').elements[k])$('#form').elements[k].value=r?.[k]||'';}
  const isCancelled=Boolean(r?.cancelled);
  $('#formCancelled').checked=isCancelled;
  if($('#cancelYearField'))$('#cancelYearField').hidden=!isCancelled;
  if($('#formCancelYear'))$('#formCancelYear').value=r?.cancelYear||(isCancelled?$('#year').value:'');
  $('#history').innerHTML='';
  (r?.history||[{year:$('#year').value}]).forEach(historyRow);
  $('#editor')?.showModal();
}
if($('#formCancelled'))$('#formCancelled').onchange=e=>{
  const checked=e.target.checked;
  if($('#cancelYearField'))$('#cancelYearField').hidden=!checked;
  if(checked&&$('#formCancelYear')&&!$('#formCancelYear').value){
    $('#formCancelYear').value=$('#year').value;
  }
};
if($('#form'))$('#form').onsubmit=async e=>{
  e.preventDefault();
  const fields=Object.fromEntries(new FormData(e.target)),main=Number(fields.categoryMain),sub=Number(fields.categorySub),detailVal=fields.categoryDetail||'',item=activityItem(main,sub);
  if(!item)return alert('กรุณาเลือกประเภทกิจการและกิจการย่อยให้ครบถ้วน');
  if(item.details?.length&&!activityDetail(main,sub,detailVal))return alert('กรุณาเลือกรายละเอียดกิจการย่อยให้ครบถ้วน');
  const isCancelled=Boolean(e.target.elements.cancelled.checked);
  const cancelYear=isCancelled?(fields.cancelYear?.trim()||editing?.cancelYear||$('#year').value):'';
  const r={
    ...editing,
    ...fields,
    sequence:editing?.sequence||'',
    cancelled:isCancelled,
    cancelYear,
    category:`หมวด ${main}`,
    activityDetail:detailVal||'',
    code:`${main}(${sub})${detailVal||''}`,
    history:[...$('#history').rows].map(tr=>Object.fromEntries([...tr.querySelectorAll('input')].map(i=>[i.dataset.key,i.value.trim()])))
  };
  delete r.categoryMain;delete r.categorySub;delete r.categoryDetail;
  if(!isCancelled)delete r.cancelYear;
  if(new Set(r.history.map(h=>h.year)).size!==r.history.length)return alert('ปีในประวัติใบอนุญาตซ้ำกัน กรุณาตรวจสอบ');
  const b=e.submitter;b.disabled=true;
  try{
    await api('/api/records'+(editing?'/'+editing.id:''),{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r)});
    $('#editor').close();
    notice(r.cancelled?`บันทึกสถานะยกเลิกกิจการแล้ว`:'บันทึกข้อมูลเรียบร้อย');
    await load();
    if(openedFromExpiryDialog){
      openedFromExpiryDialog=false;
      openExpiryDialog();
    }
  }catch(err){
    notice(err.message,true);alert(err.message);
  }finally{
    b.disabled=false;
  }
};
if($('#rows'))$('#rows').onclick=async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.edit){openedFromExpiryDialog=false;edit(data.records.find(r=>r.id===Number(b.dataset.edit)));}if(b.dataset.mapRecord)location.href=`map.html?id=${encodeURIComponent(b.dataset.mapRecord)}`;if(b.dataset.delete&&confirm('ลบทะเบียนนี้? แนะนำให้สำรองข้อมูลก่อนลบ')){try{await api('/api/records/'+b.dataset.delete,{method:'DELETE'});notice('ลบรายการแล้ว');await load();}catch(err){notice(err.message,true);}}};
if($('#add'))$('#add').onclick=()=>{openedFromExpiryDialog=false;edit();};
if($('#close'))$('#close').onclick=()=>{
  $('#editor')?.close();
  if(openedFromExpiryDialog){
    openedFromExpiryDialog=false;
    openExpiryDialog();
  }
};
if($('#addYear'))$('#addYear').onclick=()=>historyRow();
if($('#formCategory'))$('#formCategory').addEventListener('change',e=>{populateFormSubcategories(e.target.value);populateFormDetails(e.target.value,'');syncFormCode();});
if($('#formSubcategory'))$('#formSubcategory').addEventListener('change',e=>{populateFormDetails($('#formCategory').value,e.target.value);syncFormCode();});
if($('#formDetail'))$('#formDetail').addEventListener('change',e=>{syncFormCode();const fee=e.target.selectedOptions[0]?.dataset.fee;if(fee)$('#form').elements.fee.value=fee.replace(/,/g,'');});
if($('#search'))$('#search').addEventListener('input',()=>{page=1;render();});
if($('#year'))$('#year').addEventListener('change',()=>{page=1;render();});
if($('#category'))$('#category').addEventListener('change',()=>{page=1;updateSubcategories();render();});
if($('#subcategory'))$('#subcategory').addEventListener('change',()=>{page=1;render();});
if($('#prev'))$('#prev').onclick=()=>{page--;render();};
if($('#next'))$('#next').onclick=()=>{page++;render();};
if($('#toggleCategories'))$('#toggleCategories').onclick=()=>{const cards=$('#categoryCards'),open=cards.hidden;cards.hidden=!open;$('#toggleCategories').setAttribute('aria-expanded',String(open));$('#toggleCategories').textContent=open?'ซ่อนรายการ':'ดูทั้ง 13 ประเภท';};
if($('#categoryCards'))$('#categoryCards').onclick=e=>{const card=e.target.closest('[data-category]');if(!card)return;$('#category').value=card.dataset.category;updateSubcategories();page=1;render();document.querySelector('.panel')?.scrollIntoView({behavior:'smooth',block:'start'});};
if($('#registryNav'))$('#registryNav').onclick=()=>document.querySelector('.panel')?.scrollIntoView({behavior:'smooth'});
if($('#settingsNav'))$('#settingsNav').onclick=()=>$('#settingsDialog')?.showModal();
if($('#closeSettings'))$('#closeSettings').onclick=()=>$('#settingsDialog')?.close();
if($('#copySiteLink'))$('#copySiteLink').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);if($('#copyStatus'))$('#copyStatus').textContent='คัดลอกลิงก์แล้ว — เพิ่มอีเมลผู้ใช้จากเมนู Share ของเว็บไซต์';}catch{if($('#copyStatus'))$('#copyStatus').textContent='ลิงก์เว็บไซต์: '+location.href;}};
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
if($('#backup'))$('#backup').onclick=()=>download(JSON.stringify(data,null,2),'ทะเบียนคุม-backup-'+new Date().toISOString().slice(0,10)+'.json','application/json');
if($('#csv'))$('#csv').onclick=()=>{const year=$('#year')?.value||'';const rows=[['หมวด','ลำดับ','รหัส','ชื่อ-สกุล','ที่อยู่','ประเภทกิจการ','ค่าธรรมเนียม','สถานะ','ปีที่ยกเลิก','ปี','เล่ม/เลข','ต่ออายุ','หมดอายุ','หมายเหตุ'],...filtered().map(r=>{const h=(r.history||[]).find(h=>h.year===year)||{};return [r.category,r.sequence,r.code,r.name,r.address,r.business,r.fee,r.cancelled?'ยกเลิกกิจการ':'ดำเนินกิจการ',r.cancelYear||'',year,h.number,h.renewed,h.expires,r.notes];})];download('\ufeff'+rows.map(r=>r.map(v=>{let s=String(v??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(',')).join('\r\n'),'ทะเบียนคุม-'+year+'.csv','text/csv;charset=utf-8');};
function cellText(value){
  if(value==null)return'';
  if(value instanceof Date){
    const yr=value.getFullYear()>2400?value.getFullYear():value.getFullYear()+543;
    return String(value.getDate()).padStart(2,'0')+'/'+String(value.getMonth()+1).padStart(2,'0')+'/'+yr;
  }
  return String(value).trim();
}
function cleanFee(v){
  if(v==null)return'';
  return String(v).replace(/[^\d.]/g,'').trim();
}
function parseWorkbook(buffer){
  const xlsxLib=window.XLSX||(typeof XLSX!=='undefined'?XLSX:null);
  if(!xlsxLib)throw Error('ตัวอ่าน Excel โหลดไม่สำเร็จ กรุณาลองใหม่');
  const book=xlsxLib.read(buffer,{type:'array'});
  const records=[],categories=[];
  const normCat=name=>{
    const m=name.trim().match(/หมวด\s*(\d+)(?:\s*\(([^)]+)\))?/);
    if(!m)return name.trim();
    if(m[2])return 'หมวด '+m[1]+'('+m[2]+')';
    return 'หมวด'+m[1];
  };
  function parseDateCell(rawVal, fmtVal){
    if(typeof rawVal==='number'&&rawVal>10000&&xlsxLib.SSF){
      const d=xlsxLib.SSF.parse_date_code(rawVal);
      if(d&&d.y)return `${d.d}/${d.m}/${d.y%100}`;
    }
    const s=String(fmtVal||rawVal||'').trim();
    const m=s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,5})$/);
    if(m){
      let p1=parseInt(m[1],10),p2=parseInt(m[2],10),yr=parseInt(m[3],10);
      if(yr>25000)yr=parseInt(String(yr).slice(0,4),10);
      if(yr>=500&&yr<600)yr+=2000;
      const shortYr=yr%100;
      if(p1>12&&p2<=12)return `${p1}/${p2}/${shortYr}`;
      if(p2>12&&p1<=12)return `${p2}/${p1}/${shortYr}`;
      return `${p2}/${p1}/${shortYr}`;
    }
    return s;
  }
  for(const name of book.SheetNames){
    const sheet=book.Sheets[name];
    if(!sheet)continue;
    const rows=xlsxLib.utils.sheet_to_json(sheet,{header:1,raw:false,defval:''});
    const rawRows=xlsxLib.utils.sheet_to_json(sheet,{header:1,raw:true,defval:''});
    if(!rows.slice(0,6).some(row=>row.some(c=>String(c).includes('ชื่อ-สกุล'))))continue;
    const category=normCat(name);
    categories.push({name:category,source_title:cellText(rows[0]?.[0])});
    const years={};
    for(let r=0;r<Math.min(6,rows.length);r++){
      rows[r].forEach((c,idx)=>{
        const m=String(c).match(/\b(25[5-7]\d)\b/);
        if(m&&idx>=5)years[idx]=m[1];
      });
    }
    rows.forEach((row,index)=>{
      const bookCol=row.findIndex(c=>String(c).includes('เล่ม/เลข'));
      if(bookCol<0)return;
      let seq=cellText(row[0]),code='',nameVal='',address='',business='',fee='';
      if(bookCol===5){
        nameVal=cellText(row[1]);
        address=cellText(row[2]);
        business=cellText(row[3]);
        fee=cleanFee(row[4]);
      }else{
        code=cellText(row[1]);
        nameVal=cellText(row[2]);
        address=cellText(row[3]);
        business=cellText(row[4]);
        fee=cleanFee(row[5]);
      }
      if(!nameVal)return;
      const history=Object.entries(years).map(([colStr,year])=>{
        const col=Number(colStr);
        return {
          year,
          number:cellText(rows[index]?.[col]),
          renewed:parseDateCell(rawRows[index+1]?.[col],rows[index+1]?.[col]),
          expires:parseDateCell(rawRows[index+2]?.[col],rows[index+2]?.[col])
        };
      });
      records.push({category,sequence:seq,code,name:nameVal,address,business,fee,notes:'',history,source_row:index+1});
    });
  }
  return{records,categories};
}
const thaiNumber=value=>Number(String(value||'').replace(/[๐-๙]/g,c=>'๐๑๒๓๔๕๖๗๘๙'.indexOf(c)));
function classifyRecords(records,year){
  const numYear=Number(year);
  const old=records.filter(r=>(r.history||[]).some(h=>Number(h.year)<numYear&&String(h.number||'').trim()));
  const current=records.filter(r=>!r.cancelled&&(r.history||[]).some(h=>Number(h.year)===numYear&&String(h.number||'').trim()));
  const cancelled=records.filter(r=>{
    if(!r.cancelled)return false;
    if(r.cancelYear)return Number(r.cancelYear)===numYear;
    // หากไม่ได้ระบุ cancelYear ไว้ ให้ตรวจจากประวัติว่าปีล่าสุดก่อนยกเลิกคือปีก่อนหน้าหรือไม่ หรือเป็นปีนั้น
    const maxHistYear=Math.max(0,...(r.history||[]).filter(h=>String(h.number||'').trim()).map(h=>Number(h.year)||0));
    return maxHistYear>0?(maxHistYear===numYear||maxHistYear===numYear-1):false;
  });
  const renewed=current.filter(r=>(r.history||[]).some(h=>Number(h.year)<numYear&&String(h.number||'').trim()));
  return[old.length,cancelled.length,renewed.length,current.length-renewed.length];
}
function summaryCounts(category,sub,year){const prefix=`${category}(${sub})`;return classifyRecords(data.records.filter(r=>String(r.code||'').replace(/\s/g,'').startsWith(prefix)),year);}
function categoryReport(year){return categoryLabels().map((label,index)=>({number:index+1,label,values:classifyRecords(data.records.filter(r=>categoryNo(r.category)===index+1),year)}));}
function renderSummary(){const year=Number($('#year').value),report=categoryReport(year),totals=[0,0,0,0];$('#reportTitle').textContent=`สรุปกิจการที่เป็นอันตรายต่อสุขภาพ ปี ${year}`;$('#reportRows').innerHTML=report.map(row=>{row.values.forEach((v,i)=>totals[i]+=v);return `<tr><td><b>${row.number}.</b> ${escapeHTML(row.label)}</td>${row.values.map(v=>`<td>${v.toLocaleString('th-TH')}</td>`).join('')}</tr>`;}).join('');['Old','Cancelled','Renewed','New'].forEach((name,i)=>{$('#report'+name).textContent=totals[i].toLocaleString('th-TH');$('#reportTotal'+name).textContent=totals[i].toLocaleString('th-TH');});return{year,report,totals};}
async function downloadSummary(){const button=$('#downloadReport'),year=Number($('#year').value);button.disabled=true;notice('กำลังจัดทำ Excel พร้อมตาราง…');try{if(!window.ExcelJS)throw Error('ตัวสร้างเอกสาร Excel โหลดไม่สำเร็จ');const response=await fetch('summary-template.xlsx');if(!response.ok)throw Error('โหลดแม่แบบเอกสารไม่สำเร็จ');const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await response.arrayBuffer());const sheet=workbook.worksheets[0];sheet.getCell(1,1).value=`ข้อมูลการต่อใบอนุญาตกิจการที่เป็นอันตรายต่อสุขภาพ ประจำปี ${year} ( 1 ต.ค. ${year-1} - 30 ก.ย. ${year} )`;for(let r=1;r<=sheet.rowCount;r++){for(let c=9;c<=16;c++){sheet.getCell(r,c).value=null;}}let category=0;for(let row=5;row<=sheet.rowCount;row++){const a=String(sheet.getCell(row,1).text||'').trim(),heading=a.match(/^(\d{1,2})\s*\.\s*กิจการ/);if(heading){category=Number(heading[1]);continue;}if(category===1&&/^\(1\)\s*การฆ่า/.test(a))category=2;const sub=a.match(/^[（(]\s*([0-9๐-๙]+)\s*[）)]/)||a.match(/^([0-9๐-๙]+)\s*\./),numeric=[5,6,7,8].some(col=>typeof sheet.getCell(row,col).value==='number');if(!sub&&!numeric)continue;for(let col=5;col<=8;col++)sheet.getCell(row,col).value=0;if(!sub||!category)continue;summaryCounts(category,thaiNumber(sub[1]),year).forEach((value,index)=>sheet.getCell(row,5+index).value=value);}workbook.calcProperties.fullCalcOnLoad=true;const output=await workbook.xlsx.writeBuffer();download(output,`สรุปกิจการอันตราย-ปี-${year}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');notice(`ดาวน์โหลด Excel ปี ${year} พร้อมรูปแบบตารางแล้ว`);}catch(error){notice(error.message,true);}finally{button.disabled=false;}}
function printSummary(){const{year,report,totals}=renderSummary(),popup=window.open('','_blank');if(!popup)return notice('เบราว์เซอร์ปิดกั้นหน้าต่างพิมพ์ กรุณาอนุญาตป๊อปอัป',true);const rows=report.map(row=>`<tr><td>${row.number}. ${escapeHTML(row.label)}</td>${row.values.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('');popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานปี ${year}</title><style>body{font-family:Tahoma,sans-serif;padding:24px;color:#123}h1{text-align:center;font-size:20px}p{text-align:center}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #333;padding:7px}th{background:#dcebe5}td:not(:first-child),th:not(:first-child){text-align:center}tfoot{font-weight:bold}@page{size:A4 landscape;margin:12mm}</style></head><body><h1>ข้อมูลการต่อใบอนุญาตกิจการที่เป็นอันตรายต่อสุขภาพ</h1><p>ประจำปี ${year} (1 ต.ค. ${year-1} - 30 ก.ย. ${year})</p><table><thead><tr><th>ประเภทกิจการ</th><th>รายเก่า</th><th>ยกเลิก</th><th>รายต่อ</th><th>รายใหม่</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td>รวมทั้งหมด</td>${totals.map(v=>`<td>${v}</td>`).join('')}</tr></tfoot></table><script>onload=()=>{print();onafterprint=()=>close()}<\/script></body></html>`);popup.document.close();}
if($('#summaryXlsx'))$('#summaryXlsx').onclick=()=>{renderSummary();$('#reportDialog')?.showModal();};
if($('#closeReport'))$('#closeReport').onclick=()=>$('#reportDialog')?.close();
if($('#downloadReport'))$('#downloadReport').onclick=downloadSummary;
if($('#printReport'))$('#printReport').onclick=printSummary;

let currentExpiryList=[];

function parseThaiDate(str){
  if(!str)return null;
  const clean=String(str).trim();
  const m=clean.match(/^(\d{1,2})[\/\-\.](\d{1,3})[\/\-\.](\d{2,5})$/);
  if(!m)return null;
  let day=parseInt(m[1],10),month=parseInt(m[2],10);
  if(month>12){
    if(day<=12){const tmp=day;day=month;month=tmp;}
    else if(month===21||month===24)month=2;
    else if(month===85)month=8;
    else if(String(m[2]).startsWith('0'))month=parseInt(String(m[2]).replace(/^0+/,''),10);
  }
  if(month<1||month>12)return null;
  let year=parseInt(m[3],10);
  if(year<100)year+=2500;
  else if(year>=500&&year<600)year+=2000;
  else if(year>25000)year=parseInt(String(year).slice(0,4),10);
  return{day,month,year,raw:clean};
}

function getLatestLicense(r){
  const valid=(r.history||[]).filter(h=>h.expires&&String(h.expires).trim());
  if(!valid.length)return null;
  valid.sort((a,b)=>parseInt(a.year||0,10)-parseInt(b.year||0,10));
  return valid[valid.length-1];
}

function getUpcomingMonthInfo(){
  const now=new Date();
  const curMonth=now.getMonth()+1;
  const curYear=now.getFullYear()+543;
  let targetMonth=curMonth+1,targetYear=curYear;
  if(targetMonth>12){targetMonth=1;targetYear+=1;}
  return{curMonth,curYear,targetMonth,targetYear};
}

function cleanOwnerName(name){
  if(!name)return '—';
  let s=String(name).split('\n')[0].trim();
  s=s.replace(/\s*\d{1,2}[-\s]?\d{4}[-\s]?\d{5}[-\s]?\d{2}[-\s]?\d{1}/g,'');
  s=s.replace(/\s*\d{13}/g,'');
  s=s.replace(/\s*โทร\.?.*$/i,'');
  return s.trim()||String(name).split('\n')[0].trim();
}

function parseFeeValue(fee){
  if(fee==null||fee==='')return{text:'—',num:null};
  const s=String(fee).trim();
  const num=Number(s.replace(/,/g,'').replace(/[^\d.]/g,''));
  if(Number.isFinite(num)&&num>0&&/^\s*[\d,.]+\s*$/.test(s)){
    return{text:num.toLocaleString('th-TH'),num};
  }
  return{text:s,num:null};
}

function getExpiringRecords(targetMonth,targetYear,includePending=true){
  const results=[];
  data.records.forEach(r=>{
    if(r.cancelled)return;
    const lic=getLatestLicense(r);
    if(!lic)return;
    const parsed=parseThaiDate(lic.expires);
    if(!parsed)return;
    if(parsed.month!==targetMonth)return;
    if(!includePending&&parsed.year!==targetYear)return;
    const shortYear=parsed.year%100;
    const expiresText=`${parsed.day}/${parsed.month}/${shortYear}`;
    const cleanName=cleanOwnerName(r.name);
    const feeObj=parseFeeValue(r.fee);
    results.push({
      id:r.id,
      code:r.code||r.category||'—',
      name:cleanName,
      address:(r.address||'').replace(/\r?\n/g,' ').trim(),
      business:(r.business||'').replace(/\r?\n/g,' ').trim(),
      fee:feeObj.text,
      feeNum:feeObj.num,
      expiresText,
      day:parsed.day,
      year:parsed.year,
      fullExpires:lic.expires
    });
  });
  results.sort((a,b)=>a.day-b.day||a.code.localeCompare(b.code,'th'));
  return results;
}

function updateExpiryBadgeAndCard(){
  const{targetMonth,targetYear}=getUpcomingMonthInfo();
  const monthName=THAI_MONTHS[targetMonth-1];
  const shortYear=targetYear%100;
  const list=getExpiringRecords(targetMonth,targetYear,true);
  const cardLabel=$('#expiryStatLabel');
  if(cardLabel)cardLabel.textContent=`ใกล้หมดอายุเดือนหน้า (${monthName.slice(0,4)} ${shortYear})`;
  const cardCount=$('#expiryStatCount');
  if(cardCount)cardCount.textContent=list.length.toLocaleString('th-TH');
  const cardSub=$('#expiryStatSub');
  if(cardSub)cardSub.textContent=`ประจำเดือน${monthName} ${targetYear} (${list.length} รายการ)`;
  const badge=$('#expiryBadge');
  if(badge)badge.textContent=list.length.toLocaleString('th-TH');
}

function populateExpiryYears(){
  const select=$('#expiryYearSelect');
  if(!select)return;
  const curr=select.value;
  const years=[...new Set([...data.records.flatMap(r=>(r.history||[]).map(h=>h.year)),String(new Date().getFullYear()+543)])].filter(Boolean).map(Number).sort((a,b)=>b-a);
  select.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join('');
  if(curr&&years.includes(Number(curr)))select.value=curr;
  else{
    const{targetYear}=getUpcomingMonthInfo();
    select.value=String(targetYear);
  }
}

function renderExpiryModal(){
  const monthIdx=Number($('#expiryMonthSelect').value);
  const monthName=THAI_MONTHS[monthIdx-1];
  const year=Number($('#expiryYearSelect').value);
  const includePending=$('#expiryIncludePending').checked;
  const q=$('#expirySearchInput').value.trim().toLowerCase();
  
  let list=getExpiringRecords(monthIdx,year,includePending);
  if(q){
    list=list.filter(item=>JSON.stringify([item.name,item.address,item.code,item.business,item.expiresText]).toLowerCase().includes(q));
  }
  currentExpiryList=list;
  
  $('#expiryReportHeading').textContent=`บัญชีรายชื่อผู้ประกอบการที่ใบอนุญาตใกล้หมดอายุ ประจำเดือน${monthName} ${year}`;
  $('#expiryMatchCount').textContent=`พบ ${list.length.toLocaleString('th-TH')} รายการ`;
  
  const tbody=$('#expiryTableBody');
  if(!list.length){
    tbody.innerHTML='<tr><td colspan="8" class="empty" style="padding:35px;color:#80918a;text-align:center">ไม่พบกิจการที่ใบอนุญาตหมดอายุในเดือนนี้</td></tr>';
    return;
  }
  tbody.innerHTML=list.map((item,index)=>`
    <tr>
      <td style="text-align:center">${index+1}</td>
      <td style="text-align:center"><b>${escapeHTML(item.code)}</b></td>
      <td style="text-align:left"><div class="name">${escapeHTML(item.name)}</div></td>
      <td style="text-align:left"><small style="max-width:260px">${escapeHTML(item.address)}</small></td>
      <td style="text-align:left"><small style="max-width:240px">${escapeHTML(item.business)}</small></td>
      <td style="text-align:center">${escapeHTML(item.fee)}</td>
      <td style="text-align:center"><b>${escapeHTML(item.expiresText)}</b></td>
      <td style="text-align:center"><button type="button" class="secondary" style="padding:4px 8px;font-size:11px" data-open-record="${item.id}">แก้ไข</button></td>
    </tr>
  `).join('');
}

function openExpiryDialog(){
  populateExpiryYears();
  const{targetMonth,targetYear}=getUpcomingMonthInfo();
  $('#expiryMonthSelect').value=String(targetMonth);
  $('#expiryYearSelect').value=String(targetYear);
  $('#expiryIncludePending').checked=true;
  $('#expirySearchInput').value='';
  renderExpiryModal();
  $('#expiryDialog').showModal();
}

async function downloadExpiryExcel(){
  const monthIdx=Number($('#expiryMonthSelect').value);
  const monthName=THAI_MONTHS[monthIdx-1];
  const year=Number($('#expiryYearSelect').value);
  const items=currentExpiryList;
  if(!items.length)return alert('ไม่พบรายการที่ใกล้หมดอายุในเดือนที่เลือก');
  if(!window.ExcelJS)return alert('ระบบกำลังโหลด ExcelJS กรุณาลองใหม่อีกครั้ง');
  const btn=$('#downloadExpiryXlsx');
  btn.disabled=true;
  try{
    const workbook=new ExcelJS.Workbook();
    workbook.creator='เทศบาลนครบางบัวทอง';
    const sheet=workbook.addWorksheet(`ใกล้หมดอายุ-${monthName}`);
    
    // ตั้งค่าหน้ากระดาษให้พอดีหน้าพิมพ์ A4 แนวนอน
    sheet.pageSetup={
      paperSize:9, // A4
      orientation:'landscape',
      fitToPage:true,
      fitToWidth:1, // พอดี 1 หน้าแนวกว้างเสมอ ไม่ล้นหน้า 2
      fitToHeight:0, // ขยายตามจำนวนแถวจริง
      horizontalCentered:true,
      printTitlesRow:'1:3', // ซ้ำหัวตารางแถว 1-3 ทุกหน้าที่พิมพ์
      margins:{
        left:0.4,
        right:0.4,
        top:0.5,
        bottom:0.5,
        header:0.2,
        footer:0.2
      }
    };
    sheet.properties.pageSetUpProperties={fitToPage:true};

    const borderThinBlack={
      top:{style:'thin',color:{argb:'FF000000'}},
      left:{style:'thin',color:{argb:'FF000000'}},
      bottom:{style:'thin',color:{argb:'FF000000'}},
      right:{style:'thin',color:{argb:'FF000000'}}
    };

    // แถว 1: บัญชีรายชื่อผู้ประกอบการที่ใบอนุญาตใกล้หมดอายุ  ประจำเดือน...
    sheet.mergeCells('A1:G1');
    const t1=sheet.getCell('A1');
    t1.value=`บัญชีรายชื่อผู้ประกอบการที่ใบอนุญาตใกล้หมดอายุ  ประจำเดือน${monthName} ${year}`;
    t1.font={name:'TH SarabunPSK',size:16,bold:true};
    t1.alignment={vertical:'middle',horizontal:'center'};
    sheet.getRow(1).height=28;

    // แถว 2: ประเภทกิจการที่เป็นอันตรายต่อสุขภาพ
    sheet.mergeCells('A2:G2');
    const t2=sheet.getCell('A2');
    t2.value='ประเภทกิจการที่เป็นอันตรายต่อสุขภาพ';
    t2.font={name:'TH SarabunPSK',size:14,bold:true};
    t2.alignment={vertical:'middle',horizontal:'left'};
    sheet.getRow(2).height=24;

    // แถว 3: หัวตาราง พื้นขาว เส้นทึบดำ ตัวหนา จัดกลางทุกช่อง
    const headerRow=sheet.getRow(3);
    headerRow.height=26;
    const colTitles=['ลำดับ','หมวด','ชื่อ - สกุล','ที่อยู่','ประเภทกิจการ','ค่าธรรมเนียม','วันหมดอายุ'];
    colTitles.forEach((t,i)=>{
      const cell=headerRow.getCell(i+1);
      cell.value=t;
      cell.font={name:'TH SarabunPSK',size:14,bold:true};
      cell.border=borderThinBlack;
      cell.alignment={vertical:'middle',horizontal:'center'};
    });

    // แถว 4+: ข้อมูลตามต้นฉบับ เส้นทึบดำ จัดแนวกลางแนวตั้ง
    items.forEach((item,index)=>{
      const r=sheet.getRow(index+4);
      r.height=28;

      // Col 1: ลำดับ
      const c1=r.getCell(1);
      c1.value=index+1;
      c1.font={name:'TH SarabunPSK',size:14};
      c1.alignment={vertical:'middle',horizontal:'center'};
      c1.border=borderThinBlack;

      // Col 2: หมวด
      const c2=r.getCell(2);
      c2.value=item.code;
      c2.font={name:'TH SarabunPSK',size:14};
      c2.alignment={vertical:'middle',horizontal:'center'};
      c2.border=borderThinBlack;

      // Col 3: ชื่อ - สกุล
      const c3=r.getCell(3);
      c3.value=item.name;
      c3.font={name:'TH SarabunPSK',size:14};
      c3.alignment={vertical:'middle',horizontal:'left',wrapText:true};
      c3.border=borderThinBlack;

      // Col 4: ที่อยู่
      const c4=r.getCell(4);
      c4.value=item.address;
      c4.font={name:'TH SarabunPSK',size:14};
      c4.alignment={vertical:'middle',horizontal:'left',wrapText:true};
      c4.border=borderThinBlack;

      // Col 5: ประเภทกิจการ
      const c5=r.getCell(5);
      c5.value=item.business;
      c5.font={name:'TH SarabunPSK',size:14};
      c5.alignment={vertical:'middle',horizontal:'left',wrapText:true};
      c5.border=borderThinBlack;

      // Col 6: ค่าธรรมเนียม
      const c6=r.getCell(6);
      if(item.feeNum!=null){
        c6.value=item.feeNum;
        c6.numFmt='#,##0';
      }else{
        c6.value=item.fee;
      }
      c6.font={name:'TH SarabunPSK',size:14};
      c6.alignment={vertical:'middle',horizontal:'center'};
      c6.border=borderThinBlack;

      // Col 7: วันหมดอายุ
      const c7=r.getCell(7);
      c7.value=item.expiresText;
      c7.font={name:'TH SarabunPSK',size:14};
      c7.alignment={vertical:'middle',horizontal:'center'};
      c7.border=borderThinBlack;
    });

    // กำหนดความกว้างคอลัมน์ให้เหมือนต้นฉบับ และพอดี 1 หน้า A4 แนวนอน
    sheet.columns=[
      {width:6.5}, // ลำดับ
      {width:11},   // หมวด
      {width:26},   // ชื่อ - สกุล
      {width:28},   // ที่อยู่
      {width:28},   // ประเภทกิจการ
      {width:13},   // ค่าธรรมเนียม
      {width:12}    // วันหมดอายุ
    ];

    const buffer=await workbook.xlsx.writeBuffer();
    download(buffer,`รายชื่อใกล้หมดอายุ-ประจำเดือน${monthName}-${year}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    notice(`ส่งออก Excel รายชื่อใกล้หมดอายุ ประจำเดือน${monthName} ${year} สำเร็จ (ขนาดพอดีพิมพ์ A4)`);
  }catch(err){
    notice(err.message,true);
  }finally{
    btn.disabled=false;
  }
}

function downloadExpiryCsv(){
  const monthIdx=Number($('#expiryMonthSelect').value);
  const monthName=THAI_MONTHS[monthIdx-1];
  const year=Number($('#expiryYearSelect').value);
  const items=currentExpiryList;
  if(!items.length)return alert('ไม่พบรายการที่ใกล้หมดอายุในเดือนที่เลือก');
  const rows=[
    [`บัญชีรายชื่อผู้ประกอบการที่ใบอนุญาตใกล้หมดอายุ  ประจำเดือน${monthName} ${year}`,'','','','','',''],
    ['ประเภทกิจการที่เป็นอันตรายต่อสุขภาพ','','','','','',''],
    ['ลำดับ','หมวด','ชื่อ - สกุล','ที่อยู่','ประเภทกิจการ','ค่าธรรมเนียม','วันหมดอายุ'],
    ...items.map((item,index)=>[
      index+1,
      item.code,
      item.name,
      item.address,
      item.business,
      item.fee,
      item.expiresText
    ])
  ];
  const csvContent='\ufeff'+rows.map(r=>r.map(v=>{
    let s=String(v??'');
    if(/^[=+@\-\t\r]/.test(s))s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  }).join(',')).join('\r\n');
  download(csvContent,`รายชื่อใกล้หมดอายุ-ประจำเดือน${monthName}-${year}.csv`,'text/csv;charset=utf-8');
  notice(`ส่งออก CSV รายชื่อใกล้หมดอายุ ประจำเดือน${monthName} ${year} สำเร็จ`);
}

function printExpiryReport(){
  const monthIdx=Number($('#expiryMonthSelect').value);
  const monthName=THAI_MONTHS[monthIdx-1];
  const year=Number($('#expiryYearSelect').value);
  const items=currentExpiryList;
  const popup=window.open('','_blank');
  if(!popup)return window.print();
  const rows=items.map((item,index)=>`
    <tr>
      <td style="text-align:center">${index+1}</td>
      <td style="text-align:center">${escapeHTML(item.code)}</td>
      <td style="text-align:left">${escapeHTML(item.name)}</td>
      <td style="text-align:left">${escapeHTML(item.address)}</td>
      <td style="text-align:left">${escapeHTML(item.business)}</td>
      <td style="text-align:center">${escapeHTML(item.fee)}</td>
      <td style="text-align:center">${escapeHTML(item.expiresText)}</td>
    </tr>
  `).join('');
  popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>บัญชีรายชื่อผู้ประกอบการที่ใบอนุญาตใกล้หมดอายุ ประจำเดือน${monthName} ${year}</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:'TH SarabunPSK','TH Sarabun New',Tahoma,sans-serif;margin:0;padding:10mm;color:#000}.title{text-align:center;font-size:18pt;font-weight:bold;margin-bottom:4pt}.subhead{text-align:left;font-size:14pt;font-weight:bold;margin-bottom:8pt}table{width:100%;border-collapse:collapse;font-size:13pt;table-layout:fixed}th,td{border:1px solid #000;padding:5pt 6pt;vertical-align:middle;word-wrap:break-word}th{text-align:center;font-weight:bold;background:#fff}.col-idx{width:6%;text-align:center}.col-cat{width:10%;text-align:center}.col-name{width:23%;text-align:left}.col-addr{width:25%;text-align:left}.col-biz{width:24%;text-align:left}.col-fee{width:12%;text-align:center}.col-exp{width:10%;text-align:center}</style></head><body><div class="title">บัญชีรายชื่อผู้ประกอบการที่ใบอนุญาตใกล้หมดอายุ  ประจำเดือน${monthName} ${year}</div><div class="subhead">ประเภทกิจการที่เป็นอันตรายต่อสุขภาพ</div><table><thead><tr><th class="col-idx">ลำดับ</th><th class="col-cat">หมวด</th><th class="col-name">ชื่อ - สกุล</th><th class="col-addr">ที่อยู่</th><th class="col-biz">ประเภทกิจการ</th><th class="col-fee">ค่าธรรมเนียม</th><th class="col-exp">วันหมดอายุ</th></tr></thead><tbody>${rows}</tbody></table><script>onload=()=>{print();onafterprint=()=>close();}<\/script></body></html>`);
  popup.document.close();
}

if($('#openExpiryReport'))$('#openExpiryReport').onclick=openExpiryDialog;
if($('#expiryStatCard'))$('#expiryStatCard').onclick=openExpiryDialog;
if($('#expiryNav'))$('#expiryNav').onclick=openExpiryDialog;
if($('#closeExpiryDialog'))$('#closeExpiryDialog').onclick=()=>$('#expiryDialog')?.close();
if($('#expiryMonthSelect'))$('#expiryMonthSelect').onchange=renderExpiryModal;
if($('#expiryYearSelect'))$('#expiryYearSelect').onchange=renderExpiryModal;
if($('#expiryIncludePending'))$('#expiryIncludePending').onchange=renderExpiryModal;
if($('#expirySearchInput'))$('#expirySearchInput').oninput=renderExpiryModal;
if($('#downloadExpiryXlsx'))$('#downloadExpiryXlsx').onclick=downloadExpiryExcel;
if($('#downloadExpiryCsv'))$('#downloadExpiryCsv').onclick=downloadExpiryCsv;
if($('#printExpiryReport'))$('#printExpiryReport').onclick=printExpiryReport;
if($('#expiryTableBody'))$('#expiryTableBody').onclick=e=>{
  const btn=e.target.closest('[data-open-record]');
  if(!btn)return;
  const id=Number(btn.dataset.openRecord);
  const rec=data.records.find(r=>r.id===id);
  if(rec){
    openedFromExpiryDialog=true;
    $('#expiryDialog').close();
    edit(rec);
  }
};
if($('#import'))$('#import').onclick=()=>$('#excelFile')?.click();
if($('#excelFile'))$('#excelFile').onchange=async e=>{
  const f=e.target.files[0];
  if(!f)return;
  notice('กำลังอ่านและประมวลผลไฟล์ Excel…');
  try{
    const buf=await f.arrayBuffer();
    const parsed=parseWorkbook(buf);
    if(!parsed.records.length)throw Error('ไม่พบข้อมูลทะเบียนผู้ประกอบการในไฟล์ Excel กรุณาตรวจสอบว่าเป็นไฟล์ทะเบียนคุมที่ถูกต้อง');

    const replaceChoice=confirm(`พบข้อมูลผู้ประกอบการในไฟล์ Excel ทั้งหมด ${parsed.records.length} รายการ\n\n- กด "ตกลง (OK)" เพื่ออัปเดตและแทนที่ข้อมูลเดิมด้วยไฟล์นี้ (แนะนำ)\n- กด "ยกเลิก (Cancel)" เพื่อนำเข้าแบบเพิ่มต่อท้าย`);

    const coordMap=new Map();
    (data.records||[]).forEach(r=>{
      if(r.latitude&&r.longitude){
        const k=String(r.name||'').replace(/[\s\r\n]+/g,' ').trim().toLowerCase();
        if(k)coordMap.set(k,{latitude:r.latitude,longitude:r.longitude,mapSource:r.mapSource});
      }
    });

    if(replaceChoice){
      data.records=parsed.records.map((r,i)=>{
        const k=String(r.name||'').replace(/[\s\r\n]+/g,' ').trim().toLowerCase();
        const c=coordMap.get(k);
        return {
          ...r,
          id:i+1,
          latitude:c?c.latitude:(r.latitude||null),
          longitude:c?c.longitude:(r.longitude||null),
          mapSource:c?c.mapSource:(r.mapSource||null)
        };
      });
      data.categories=parsed.categories;
    }else{
      const existingNames=new Set((data.records||[]).map(r=>String(r.name||'').replace(/[\s\r\n]+/g,' ').trim().toLowerCase()));
      let nextId=Math.max(0,...(data.records||[]).map(r=>Number(r.id)||0))+1;
      parsed.records.forEach(r=>{
        const k=String(r.name||'').replace(/[\s\r\n]+/g,' ').trim().toLowerCase();
        if(!existingNames.has(k)){
          data.records.push({...r,id:nextId++});
          existingNames.add(k);
        }
      });
      const catNames=new Set((data.categories||[]).map(c=>c.name));
      (data.categories||[]).push(...parsed.categories.filter(c=>!catNames.has(c.name)));
    }

    save();
    renderAll();

    const cloudUrl=getCloudApiUrl();
    if(cloudUrl){
      fetch(cloudUrl+'/api/restore',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({records:data.records,categories:data.categories})
      }).then(()=>{
        notice(`นำเข้าเรียบร้อย ${parsed.records.length} รายการ (บันทึกและซิงก์ Cloudflare แล้ว)`);
      }).catch(()=>{
        notice(`นำเข้าเรียบร้อย ${parsed.records.length} รายการ (บันทึกในเครื่องแล้ว)`);
      });
    }else{
      notice(`นำเข้าเรียบร้อย ${parsed.records.length} รายการ`);
    }
  }catch(err){
    console.error('Import error:',err);
    notice('เกิดข้อผิดพลาดในการนำเข้า Excel: '+err.message,true);
  }
  e.target.value='';
};
if($('#restore'))$('#restore').onclick=()=>$('#jsonFile')?.click();
if($('#jsonFile'))$('#jsonFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const payload=JSON.parse(await f.text());if(!Array.isArray(payload.records)||!Array.isArray(payload.categories))throw Error('ไฟล์สำรองไม่ถูกต้อง');if(confirm(`กู้คืน ${payload.records.length} รายการและแทนที่ข้อมูลปัจจุบันทั้งหมด?`)){await api('/api/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});await load();notice('กู้คืนข้อมูลเรียบร้อย');}}catch(err){notice(err.message,true);}e.target.value='';};

function updateCloudSettingsUI(){
  const url=getCloudApiUrl();
  const input=$('#cloudApiInput'),status=$('#cloudStatus');
  if(input) input.value=url;
  if(status){
    const count = (data.records||[]).length;
    status.innerHTML = url
      ? `<span style="color:#059669;font-weight:600;">✓ ออนไลน์ &amp; ซิงค์อัตโนมัติ:</span> <span style="word-break:break-all;">${escapeHTML(url)}</span> <small style="display:block;margin-top:2px;color:#047857;">(ข้อมูล ${count} รายการเชื่อมโยงกับ Cloudflare เรียบร้อยแล้ว)</small>`
      : '<span style="color:#d97706;font-weight:600;">สถานะ:</span> ใช้งาน Local Storage ภายในเครื่อง (ออฟไลน์)';
  }
}
if($('#settingsNav')){
  const origSettingsClick=$('#settingsNav').onclick;
  $('#settingsNav').onclick=()=>{updateCloudSettingsUI();if(typeof renderUserManager==='function')renderUserManager();if(origSettingsClick)origSettingsClick();};
}
if($('#saveCloudApi')){
  $('#saveCloudApi').onclick=async()=>{
    const url=($('#cloudApiInput').value||'').trim().replace(/\/+$/,'');
    if(!url){localStorage.removeItem(CLOUD_API_KEY);updateCloudSettingsUI();notice('ยกเลิกการเชื่อมต่อ Cloudflare แล้ว');return;}
    notice('กำลังทดสอบการเชื่อมต่อ Cloudflare…');
    try{
      const res=await fetch(url+'/health');
      if(res.ok){
        localStorage.setItem(CLOUD_API_KEY,url);
        updateCloudSettingsUI();
        notice('เชื่อมต่อ Cloudflare สำเร็จ! กำลังโหลดข้อมูล…');
        await load();
      }else{throw Error('รหัส '+res.status);}
    }catch(e){
      localStorage.setItem(CLOUD_API_KEY,url);
      updateCloudSettingsUI();
      notice('บันทึกที่อยู่ Cloudflare แล้ว: '+url);
    }
  };
}
if($('#resetCloudApi')){
  $('#resetCloudApi').onclick=async()=>{
    localStorage.setItem(CLOUD_API_KEY,'none');
    updateCloudSettingsUI();
    notice('สลับกลับมาใช้ Local Storage เรียบร้อย');
    await load();
  };
}
if($('#syncToCloud')){
  $('#syncToCloud').onclick=async()=>{
    const url=getCloudApiUrl();
    if(!url)return alert('กรุณาระบุและบันทึก URL ของ Cloudflare ก่อนส่งข้อมูล');
    notice('กำลังตรวจสอบและซิงค์ข้อมูลขึ้น Cloudflare D1…');
    try{
      const res=await fetch(url+'/api/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({records:data.records,categories:data.categories})});
      if(res.ok){
        notice(`✓ อัปโหลดและซิงค์ข้อมูลขึ้น Cloudflare D1 เรียบร้อย (${data.records.length} รายการ)`);
      }else{throw Error('บันทึกไม่สำเร็จ รหัส '+res.status);}
    }catch(e){notice('ส่งข้อมูลไม่สำเร็จ: '+e.message,true);}
  };
}

window.addEventListener('auth-success',()=>{renderAll();load();});

const DATA_VERSION='20261008_dmy_v2';
if(typeof window!=='undefined'){
  if(window.ACTIVITY_TYPES&&Array.isArray(window.ACTIVITY_TYPES)) activityTypes=window.ACTIVITY_TYPES;
  if(window.SEED_DATA&&Array.isArray(window.SEED_DATA.records)&&window.SEED_DATA.records.length>0){
    const ver=localStorage.getItem('tabien_khum_data_ver');
    if(ver!==DATA_VERSION){
      data=JSON.parse(JSON.stringify(window.SEED_DATA));
      data.records=data.records.map((r,i)=>({...r,id:r.id||i+1}));
      save();
      localStorage.setItem('tabien_khum_data_ver',DATA_VERSION);
    }
  }
  if(window.SEED_DATA&&(!data.records||data.records.length===0)){
    const stored=localStorage.getItem(STORAGE_KEY);
    let valid=false;
    if(stored){
      try{
        const p=JSON.parse(stored);
        if(p&&Array.isArray(p.records)&&p.records.length>0){data=p;valid=true;}
      }catch(e){}
    }
    if(!valid){
      data=JSON.parse(JSON.stringify(window.SEED_DATA));
      data.records=data.records.map((r,i)=>({...r,id:r.id||i+1}));
      save();
    }
  }
}

function startApplication(){
  try{renderAll();}catch(e){}
  initialize().then(load).catch(e=>{
    console.error('App init error:',e);
    renderAll();
  });
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',startApplication);
}else{
  startApplication();
}

