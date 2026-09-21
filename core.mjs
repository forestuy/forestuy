import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import seed from './seed.json' with {type:'json'};
export const COOKIE='__Host-forest_admin';
const TTL=8*60*60;
const digest=value=>createHash('sha256').update(value).digest('hex');
export const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const cookie=(token,age=TTL)=>`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
function tokenFrom(req){const match=(req.headers.get('cookie')||'').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})(?:;|$)`));return match?.[1]||null;}
async function body(req){
 if(!req.headers.get('content-type')?.startsWith('application/json'))throw new Error('Usá formato JSON.');
 const raw=await req.text();if(Buffer.byteLength(raw)>100000)throw new Error('Solicitud demasiado grande.');
 try{return JSON.parse(raw)}catch{throw new Error('Datos inválidos.')}
}
function sameOrigin(req){return req.headers.get('origin')===new URL(req.url).origin;}
export function validatePerson(p){
 if(!p||typeof p!=='object')throw new Error('Datos inválidos.');
 const name=typeof p.name==='string'?p.name.trim():'';
 const city=typeof p.city==='string'?p.city.trim():'';
 if(!name||name.length>60||!city||city.length>80||/[<>\u0000-\u001f]/u.test(name+city))throw new Error('Completá nombre y localidad válidos.');
 let whatsapp=typeof p.whatsapp==='string'?p.whatsapp.replace(/[\s()+-]/g,''):'';
 if(/^09\d{7}$/.test(whatsapp))whatsapp='598'+whatsapp.slice(1);
 if(whatsapp&&!/^[1-9]\d{7,14}$/.test(whatsapp))throw new Error('WhatsApp inválido. Usá el número uruguayo o el código de país.');
 let instagram=typeof p.instagram==='string'?p.instagram.trim():'';
 if(/^https?:\/\//i.test(instagram)){
  let u;try{u=new URL(instagram)}catch{throw new Error('Instagram inválido.')}
  if(!['instagram.com','www.instagram.com'].includes(u.hostname))throw new Error('Usá un enlace de Instagram.');
  instagram=u.pathname.replace(/^\/|\/$/g,'');
 }
 instagram=instagram.replace(/^@/,'');
 if(instagram&&!/^[a-zA-Z0-9._]{1,30}$/.test(instagram))throw new Error('Usuario de Instagram inválido.');
 if(!whatsapp&&!instagram)throw new Error('Agregá al menos WhatsApp o Instagram.');
 return {name,city,whatsapp,instagram};
}
export function createAPI({getStore,password=()=>process.env.FOREST_ADMIN_PASSWORD,now=()=>Date.now()}){
 const sessionStore=()=>getStore('forest-admin-sessions');
 const dataStore=()=>getStore('forest-rrpp-v1');
 const configured=()=>typeof password()==='string'&&password().length>=16;
 async function authenticated(req){
  if(!configured())return false;
  const token=tokenFrom(req);if(!token)return false;
  const session=await sessionStore().get(digest(token),{type:'json',consistency:'strong'});
  return !!session&&session.expires>now()&&session.passwordVersion===digest(password());
 }
 async function readData(){
  const stored=await dataStore().getWithMetadata('contacts',{type:'json',consistency:'strong'});
  return stored?{items:stored.data.items,revision:stored.etag}:{items:seed,revision:'initial'};
 }
 async function session(req){
  try{
   if(!configured())return json({error:'Falta configurar FOREST_ADMIN_PASSWORD (mínimo 16 caracteres) en Netlify y volver a desplegar.'},503);
   if(req.method==='GET')return json({authenticated:await authenticated(req)});
   if(!sameOrigin(req))return json({error:'Origen no permitido.'},403);
   if(req.method==='DELETE'){
    const token=tokenFrom(req);if(token)await sessionStore().delete(digest(token));
    return json({ok:true},200,{'Set-Cookie':cookie('',0)});
   }
   if(req.method!=='POST')return json({error:'Método no permitido.'},405);
   let input;try{input=await body(req)}catch(e){return json({error:e.message},400)}
   const given=typeof input.password==='string'?input.password:'';
   const valid=given.length<=512&&timingSafeEqual(Buffer.from(digest(given),'hex'),Buffer.from(digest(password()),'hex'));
   if(input.username!=='admin'||!valid)return json({error:'Usuario o contraseña incorrectos.'},401);
   const token=randomBytes(32).toString('hex');
   await sessionStore().setJSON(digest(token),{expires:now()+TTL*1000,passwordVersion:digest(password())});
   return json({authenticated:true},200,{'Set-Cookie':cookie(token)});
  }catch{return json({error:'No se pudo acceder. Intentá nuevamente.'},503)}
 }
 async function rrpp(req){
  try{
   if(req.method==='GET')return json(await readData());
   if(req.method!=='PUT')return json({error:'Método no permitido.'},405);
   if(!sameOrigin(req))return json({error:'Origen no permitido.'},403);
   if(!await authenticated(req))return json({error:'Tu sesión venció. Volvé a ingresar.'},401);
   let input;try{input=await body(req)}catch(e){return json({error:e.message},400)}
   const current=await readData();
   if(input.revision!==current.revision)return json({error:'La lista cambió en otra ventana. Recargá antes de guardar.'},409);
   if(!Array.isArray(input.items)||input.items.length>250)return json({error:'Lista inválida (máximo 250 RRPP).'},400);
   let items;try{
    const ids=new Set();items=input.items.map(p=>{
     const person=validatePerson(p);const id=p.id||randomUUID();
     if(typeof id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(id)||ids.has(id))throw new Error('Identificador inválido o repetido.');
     ids.add(id);return {id,...person};
    });
   }catch(e){return json({error:e.message},400)}
   const options=current.revision==='initial'?{onlyIfNew:true}:{onlyIfMatch:current.revision};
   const result=await dataStore().setJSON('contacts',{items},options);
   if(!result.modified)return json({error:'Otra ventana guardó cambios. Recargá y volvé a intentar.'},409);
   return json({items,revision:result.etag});
  }catch{return json({error:'No se pudo guardar o cargar la lista. Intentá nuevamente.'},503)}
 }
 return {session,rrpp};
}
