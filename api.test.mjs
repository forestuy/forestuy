import test from 'node:test';
import assert from 'node:assert/strict';
import {createAPI,validatePerson,COOKIE} from '../server/core.mjs';
function setup(){
 const stores=new Map();let seq=0,time=1000000,secret='test-secret-never-use-in-production';
 const getStore=name=>{if(!stores.has(name))stores.set(name,new Map());const map=stores.get(name);return {
  async get(k){return map.get(k)?.data??null},
  async getWithMetadata(k){return map.get(k)??null},
  async setJSON(k,data,opts={}){const old=map.get(k);if(opts.onlyIfNew&&old||opts.onlyIfMatch&&old?.etag!==opts.onlyIfMatch)return {modified:false};const etag='"'+(++seq)+'"';map.set(k,{data:structuredClone(data),etag});return {modified:true,etag}},
  async delete(k){map.delete(k)}
 }};
 const make=()=>createAPI({getStore,password:()=>secret,now:()=>time});
 const req=(method,body,cookie='',origin='https://forest.test')=>new Request('https://forest.test/.netlify/functions/api',{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});
 const api=make();
 const login=async()=>{const r=await api.session(req('POST',{username:'admin',password:secret}));assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0]};
 return {api,make,req,login,advance:()=>time+=9*3600000,changePassword:()=>secret='another-long-secret-for-testing'};
}
test('Public read includes the 11 original contacts; unauthenticated write is blocked',async()=>{const t=setup();const data=await (await t.api.rrpp(t.req('GET'))).json();assert.equal(data.items.length,11);assert.equal((await t.api.rrpp(t.req('PUT',{items:[],revision:'initial'}))).status,401)});
test('Login rejects wrong credentials and cross-origin submissions',async()=>{const t=setup();assert.equal((await t.api.session(t.req('POST',{username:'admin',password:'wrong'}))).status,401);assert.equal((await t.api.session(t.req('POST',{},'','https://attacker.test'))).status,403)});
test('CRUD persists across API instances and protects against stale edits',async()=>{
 const t=setup(),cookie=await t.login();let state=await (await t.api.rrpp(t.req('GET'))).json();
 const newPerson={id:'new',name:'Prueba',city:'Los Cerrillos',whatsapp:'099 123 456',instagram:'https://www.instagram.com/prueba/?utm_source=x'};
 let r=await t.api.rrpp(t.req('PUT',{...state,items:[...state.items,newPerson]},cookie));assert.equal(r.status,200);state=await r.json();assert.equal(state.items.at(-1).whatsapp,'59899123456');
 assert.equal((await (await t.make().rrpp(t.req('GET'))).json()).items.length,12);
 assert.equal((await t.api.rrpp(t.req('PUT',{items:[],revision:'initial'},cookie))).status,409);
 state.items.at(-1).city='Montevideo';r=await t.api.rrpp(t.req('PUT',state,cookie));assert.equal(r.status,200);state=await r.json();assert.equal(state.items.at(-1).city,'Montevideo');
 state.items=state.items.filter(p=>p.id!=='new');assert.equal((await t.api.rrpp(t.req('PUT',state,cookie))).status,200);
});
test('Deleting all contacts stays empty rather than restoring seeds',async()=>{const t=setup(),cookie=await t.login();assert.equal((await t.api.rrpp(t.req('PUT',{items:[],revision:'initial'},cookie))).status,200);assert.deepEqual((await(await t.make().rrpp(t.req('GET'))).json()).items,[])});
test('Session cookie has security flags and logout revokes the token',async()=>{const t=setup();const r=await t.api.session(t.req('POST',{username:'admin',password:'test-secret-never-use-in-production'}));const h=r.headers.get('set-cookie');for(const f of ['HttpOnly','Secure','SameSite=Strict'])assert.ok(h.includes(f));const cookie=h.split(';')[0];await t.api.session(t.req('DELETE',null,cookie));assert.equal((await t.api.rrpp(t.req('PUT',{items:[],revision:'initial'},cookie))).status,401)});
test('Expired, forged and password-invalidated sessions cannot write',async()=>{const t=setup(),cookie=await t.login();t.advance();assert.equal((await t.api.rrpp(t.req('PUT',{},cookie))).status,401);assert.equal((await t.api.rrpp(t.req('PUT',{},COOKIE+'='+'a'.repeat(64)))).status,401);const fresh=await t.login();t.changePassword();assert.equal((await t.api.rrpp(t.req('PUT',{},fresh))).status,401)});
test('Authorized writes still require same origin; invalid contacts rejected',async()=>{const t=setup(),cookie=await t.login();assert.equal((await t.api.rrpp(t.req('PUT',{items:[],revision:'initial'},cookie,'https://attacker.test'))).status,403);assert.throws(()=>validatePerson({name:'<script>',city:'x',whatsapp:'093621742'}));assert.throws(()=>validatePerson({name:'x',city:'x',instagram:'https://evil.test/name'}));assert.throws(()=>validatePerson({name:'x',city:'x'}));});
test('Missing admin secret fails closed',async()=>{const api=createAPI({getStore:()=>{throw Error()},password:()=>undefined});assert.equal((await api.session(new Request('https://forest.test'))).status,503)});
