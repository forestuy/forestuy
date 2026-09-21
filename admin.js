const $=s=>document.querySelector(s);
let items=[],revision=null,editing=null,busy=false;
function message(text,type=''){$('#message').textContent=text;$('#message').className=type;}
function setBusy(value){busy=value;document.querySelectorAll('button').forEach(b=>b.disabled=value);}
async function api(endpoint,method='GET',body){
 let response;try{response=await fetch('/.netlify/functions/'+endpoint,{method,credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined})}catch{throw new Error('No se pudo conectar. Revisá tu conexión y volvé a intentar.');}
 let data;try{data=await response.json()}catch{throw new Error(response.status===429?'Demasiados intentos. Esperá 3 minutos.':'El panel todavía no está activado en Netlify.');}
 if(!response.ok){
  if(response.status===401){$('#dashboard').hidden=true;$('#login-section').hidden=false;}
  throw new Error(data.error||'No se pudo completar la operación.');
 }return data;
}
function resetEditor(){editing=null;$('#editor').reset();$('#editor-title').textContent='Agregar RRPP';$('#cancel').hidden=true;}
function draw(){
 $('#total').textContent=items.length+' RRPP publicados';$('#list').replaceChildren();
 if(!items.length){const p=document.createElement('p');p.className='empty';p.textContent='Todavía no hay RRPP. Agregá el primero.';$('#list').append(p);}
 [...items].sort((a,b)=>a.name.localeCompare(b.name,'es')).forEach(person=>{
  const row=document.createElement('article');row.className='entry';
  const content=document.createElement('div'),name=document.createElement('h3'),contact=document.createElement('p');
  name.textContent=person.name+' / '+person.city;contact.textContent=[person.whatsapp,person.instagram?'@'+person.instagram:''].filter(Boolean).join(' · ');
  content.append(name,contact);const actions=document.createElement('div');actions.className='actions';
  const edit=document.createElement('button');edit.type='button';edit.textContent='Editar';edit.setAttribute('aria-label','Editar a '+person.name);
  edit.onclick=()=>{if(busy)return;editing=person.id;for(const key of ['name','city','whatsapp','instagram'])$('#editor').elements[key].value=person[key];$('#editor-title').textContent='Editar a '+person.name;$('#cancel').hidden=false;$('#editor').scrollIntoView({behavior:'smooth',block:'start'});$('#editor').elements.name.focus({preventScroll:true});};
  const remove=document.createElement('button');remove.type='button';remove.className='danger';remove.textContent='Eliminar';remove.setAttribute('aria-label','Eliminar a '+person.name);
  remove.onclick=async()=>{if(busy||!confirm('¿Eliminar a '+person.name+' de la página?'))return;setBusy(true);try{await save(items.filter(p=>p.id!==person.id));if(editing===person.id)resetEditor();message('RRPP eliminado. El cambio ya está publicado.','success')}catch(e){message(e.message,'error')}finally{setBusy(false)}};
  actions.append(edit,remove);row.append(content,actions);$('#list').append(row);
 });
}
async function load(){const data=await api('rrpp');items=data.items;revision=data.revision;draw();}
async function save(next){const data=await api('rrpp','PUT',{items:next,revision});items=data.items;revision=data.revision;draw();}
$('#login').onsubmit=async event=>{event.preventDefault();if(busy)return;setBusy(true);try{
 const form=new FormData(event.currentTarget);await api('session','POST',{username:form.get('username'),password:form.get('password')});event.target.elements.password.value='';await load();$('#login-section').hidden=true;$('#dashboard').hidden=false;message('Elegí un RRPP para editar o agregá uno nuevo.');
}catch(e){message(e.message,'error')}finally{setBusy(false)}};
$('#editor').onsubmit=async event=>{event.preventDefault();if(busy)return;const data=Object.fromEntries(new FormData(event.currentTarget));if(!data.whatsapp.trim()&&!data.instagram.trim()){message('Agregá WhatsApp o Instagram.','error');return;}setBusy(true);try{
 const person={id:editing||crypto.randomUUID(),...data};const next=editing?items.map(p=>p.id===editing?person:p):[...items,person];await save(next);resetEditor();message('Guardado. El cambio ya está publicado.','success');
}catch(e){message(e.message,'error')}finally{setBusy(false)}};
$('#cancel').onclick=resetEditor;
$('#reload').onclick=async()=>{if(busy)return;setBusy(true);try{await load();resetEditor();message('Lista actualizada.')}catch(e){message(e.message,'error')}finally{setBusy(false)}};
$('#logout').onclick=async()=>{if(busy)return;setBusy(true);try{await api('session','DELETE');items=[];revision=null;resetEditor();$('#dashboard').hidden=true;$('#login-section').hidden=false;message('Sesión cerrada.')}catch(e){message(e.message,'error')}finally{setBusy(false)}};
(async()=>{setBusy(true);try{const session=await api('session');if(session.authenticated){await load();$('#dashboard').hidden=false;message('Elegí un RRPP para editar o agregá uno nuevo.')}else{$('#login-section').hidden=false;message('Solo el administrador puede modificar los contactos.')}}catch(e){$('#login-section').hidden=false;message(e.message,'error')}finally{setBusy(false)}})();
