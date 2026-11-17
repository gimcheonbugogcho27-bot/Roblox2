import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'node:crypto';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express();
app.use(express.json({limit:'32kb'}));
const STUDENTS=['김예은','김윤솔','김재은','나헤지','박솔아','박주아','박준희','송지아','신다원','전소현','전시은','주예진','김규담','김성현','김지유','김헤준','박서한','박우준','신유찬','안재현','이서빈','이승운','이시우','장재훈','전지훈','정유재','안시후'];
const studentEmail=(i)=>`bw2student${String(i+1).padStart(2,'0')}@blockworld2.invalid`;
app.post('/api/setup/class-accounts',async(req,res)=>{
  try{
    const secret=String(req.get('x-class-setup-secret')||'');
    const expected=String(process.env.CLASS_ACCOUNT_SETUP_SECRET||'');
    if(!expected||secret.length!==expected.length||!timingSafeEqual(Buffer.from(secret),Buffer.from(expected)))return res.status(403).json({error:'설정 비밀번호가 올바르지 않습니다.'});
    const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url||!serviceKey)return res.status(500).json({error:'Render에 SUPABASE_URL(또는 VITE_SUPABASE_URL)과 SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요.'});
    const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:list,error:listError}=await admin.auth.admin.listUsers({page:1,perPage:1000});
    if(listError)throw listError;
    const byEmail=new Map((list.users||[]).map(u=>[u.email,u]));
    const results=[];
    for(let i=0;i<STUDENTS.length;i++){
      const email=studentEmail(i), name=STUDENTS[i], existing=byEmail.get(email);
      let result;
      if(existing){const r=await admin.auth.admin.updateUserById(existing.id,{password:'44class',email_confirm:true,user_metadata:{...(existing.user_metadata||{}),username:name,display_name:name}});if(r.error)throw new Error(name+': '+r.error.message);result='updated';}
      else{const r=await admin.auth.admin.createUser({email,password:'44class',email_confirm:true,user_metadata:{username:name,display_name:name}});if(r.error)throw new Error(name+': '+r.error.message);result='created';}
      results.push({username:name,status:result});
    }
    return res.json({success:true,total:results.length,created:results.filter(x=>x.status==='created').length,updated:results.filter(x=>x.status==='updated').length,accounts:results});
  }catch(e){return res.status(500).json({error:e.message||'계정 생성 실패'});}
});
const dist=path.join(__dirname,'dist');
// HTML(게임 파일 포함)은 항상 최신 버전 확인, 그 외 파일은 1시간 캐시
app.use(express.static(dist,{maxAge:'1h',setHeaders(res,filePath){if(filePath.endsWith('.html')||filePath.includes(path.sep+'games'+path.sep))res.setHeader('Cache-Control','no-cache, must-revalidate')}}));
app.get('*',(req,res)=>{res.setHeader('Cache-Control','no-cache, must-revalidate');res.sendFile(path.join(dist,'index.html'))});
// Server-side anti-cheat API. The service-role key must remain on the server only.
const supabaseUrl=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'';
const supabaseAnonKey=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY||'';
const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const adminDb=supabaseUrl&&serviceRoleKey?createClient(supabaseUrl,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}}):null;
const reportWindows=new Map();
async function authenticatedUser(req,res){
  const header=String(req.get('authorization')||'');
  const token=header.startsWith('Bearer ')?header.slice(7):'';
  if(!token||!supabaseUrl||!supabaseAnonKey){res.status(401).json({error:'로그인 인증이 필요합니다.'});return null;}
  const authClient=createClient(supabaseUrl,supabaseAnonKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data,error}=await authClient.auth.getUser(token);
  if(error||!data?.user){res.status(401).json({error:'로그인 세션이 유효하지 않습니다.'});return null;}
  return data.user;
}
function requireAdminDb(res){if(!adminDb){res.status(503).json({error:'서버의 SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.'});return false;}return true;}
app.get('/api/anticheat/status',async(req,res)=>{
  try{
    const user=await authenticatedUser(req,res);if(!user)return;
    if(!requireAdminDb(res))return;
    const {data,error}=await adminDb.from('player_bans').select('reason,created_at,expires_at').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    const active=!!data&&(!data.expires_at||new Date(data.expires_at).getTime()>Date.now());
    return res.json({banned:active,ban:active?data:null});
  }catch(e){return res.status(500).json({error:e.message||'제재 상태 확인 실패'});}
});
app.post('/api/anticheat/report',async(req,res)=>{
  try{
    const user=await authenticatedUser(req,res);if(!user)return;
    if(!requireAdminDb(res))return;
    const now=Date.now(),windowStart=reportWindows.get(user.id)||[];
    const recent=windowStart.filter(t=>now-t<60000);
    if(recent.length>=12)return res.status(429).json({error:'안티치트 보고 요청이 너무 많습니다.'});
    recent.push(now);reportWindows.set(user.id,recent);
    const allowed=new Set(['teleport','speed-hack','super-jump','air-hack','stat-invalid','speed-jump','coin-jump','win-jump','rebirth-jump','potion-jump','item-forge','clear-forge','admin-tools','admin-save','abuse-forge','abuse-mult','event-forge','t150-forge','buff-forge','potion-forge','god-mode','shield-forge','speed-setting','double-jump-skip']);
    const reason=String(req.body?.reason||'unknown').slice(0,48);
    if(!allowed.has(reason))return res.status(400).json({error:'허용되지 않은 탐지 코드입니다.'});
    const {error}=await adminDb.from('anticheat_events').insert({user_id:user.id,reason,details:{game:'speed',client_report:true}});
    if(error)throw error;
    return res.json({ok:true,recorded:true});
  }catch(e){return res.status(500).json({error:e.message||'안티치트 기록 실패'});}
});
app.post('/api/anticheat/admin/ban',async(req,res)=>{
  try{
    const user=await authenticatedUser(req,res);if(!user)return;
    if(!requireAdminDb(res))return;
    const {data:admin,error:adminError}=await adminDb.from('speed_game_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if(adminError)throw adminError;if(!admin)return res.status(403).json({error:'관리자 권한이 없습니다.'});
    const target=String(req.body?.userId||'');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(target))return res.status(400).json({error:'대상 UUID가 올바르지 않습니다.'});
    const reason=String(req.body?.reason||'관리자 제재').slice(0,160);
    const {error}=await adminDb.from('player_bans').upsert({user_id:target,reason,banned_by:user.id,created_at:new Date().toISOString(),expires_at:null},{onConflict:'user_id'});
    if(error)throw error;
    return res.json({ok:true});
  }catch(e){return res.status(500).json({error:e.message||'제재 처리 실패'});}
});
app.post('/api/anticheat/admin/unban',async(req,res)=>{
  try{
    const user=await authenticatedUser(req,res);if(!user)return;
    if(!requireAdminDb(res))return;
    const {data:admin,error:adminError}=await adminDb.from('speed_game_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if(adminError)throw adminError;if(!admin)return res.status(403).json({error:'관리자 권한이 없습니다.'});
    const target=String(req.body?.userId||'');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(target))return res.status(400).json({error:'대상 UUID가 올바르지 않습니다.'});
    const {error}=await adminDb.from('player_bans').delete().eq('user_id',target);
    if(error)throw error;
    return res.json({ok:true});
  }catch(e){return res.status(500).json({error:e.message||'제재 해제 실패'});}
});
const port=process.env.PORT||10000;
app.listen(port,'0.0.0.0',()=>console.log(`BlockWorld 2 running on ${port}`));
