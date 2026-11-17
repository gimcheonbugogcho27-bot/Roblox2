import { createClient } from '@supabase/supabase-js';
import './style.css';

const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL||'';
const SUPABASE_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY||'';
const REALTIME_URL=import.meta.env.VITE_REALTIME_URL||'';
const $=id=>document.getElementById(id);

class RealtimeChannel {
 constructor(roomName,meta,token){this.roomName=roomName;this.meta={...meta};this.token=token;this.state='closed';this.ws=null;this.handlers=[];this.presence={};this.closedByUser=false;this.retry=0;this.retryTimer=null}
 on(kind,opts,callback){this.handlers.push({kind,event:opts?.event,callback});return this}
 emit(kind,event,payload){for(const h of this.handlers)if(h.kind===kind&&(!h.event||h.event===event)){try{h.callback(kind==='broadcast'?{payload}:{event,state:payload})}catch(e){console.error(e)}}}
 presenceState(){return this.presence}
 connect(callback){if(!REALTIME_URL)throw new Error('Render 환경변수 VITE_REALTIME_URL에 Cloudflare Worker 주소를 설정하세요.');this.closedByUser=false;this.connectCallback=callback;this.openSocket();return this}
 openSocket(){const url=new URL(REALTIME_URL);if(url.protocol==='https:')url.protocol='wss:';else if(url.protocol==='http:')url.protocol='ws:';url.searchParams.set('room',this.roomName);url.searchParams.set('token',this.token);url.searchParams.set('userId',this.meta.userId||'');url.searchParams.set('id',this.meta.id||'');url.searchParams.set('name',this.meta.name||'플레이어');url.searchParams.set('game',this.meta.game||'');const ws=new WebSocket(url.toString());this.ws=ws;
  ws.onopen=()=>{this.state='joined';this.retry=0;if(this.connectCallback)this.connectCallback('SUBSCRIBED');if(this.meta.id)ws.send(JSON.stringify({type:'track',payload:this.meta}))};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(_){return}if(m.type==='presence'){this.presence=m.state||{};this.emit('presence','sync',this.presence)}else if(m.type==='broadcast')this.emit('broadcast',m.event,m.payload);else if(m.type==='error')console.warn('Realtime server:',m.message||'error')};
  ws.onerror=()=>{};ws.onclose=()=>{this.state='closed';if(!this.closedByUser){const wait=Math.min(30000,1000*Math.pow(2,this.retry++));this.retryTimer=setTimeout(()=>this.openSocket(),wait)}}}
 async track(meta){this.meta={...this.meta,...meta};if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(JSON.stringify({type:'track',payload:this.meta}));return 'ok'}
 async send(message){if(this.ws?.readyState!==WebSocket.OPEN)throw new Error('실시간 서버 연결이 끊어졌습니다.');this.ws.send(JSON.stringify(message));return 'ok'}
 close(){this.closedByUser=true;clearTimeout(this.retryTimer);this.state='closed';if(this.ws){this.ws.onclose=null;this.ws.close();this.ws=null}}
 subscribe(callback){this.connect(callback);return this}
}
async function makeRealtimeChannel(roomName,meta){const {data:{session},error}=await ensureClient().auth.getSession();if(error||!session?.access_token)throw new Error('실시간 연결용 로그인 토큰을 가져오지 못했습니다.');return new RealtimeChannel(roomName,meta,session.access_token)}

const TITLES={speed:'스피드 키보드 탈출 3D · Ultimate Edition',egg:'계란 서리단',rivals:'RIVALS 3D',blockblast:'블록 블라스트',tower:'아무도 못 깨는 타워',forest99:'99 Nights in the Forest'};
const STUDENT_IDS=['김예은','김윤솔','김재은','나헤지','박솔아','박주아','박준희','송지아','신다원','전소현','전시은','주예진','김규담','김성현','김지유','김헤준','박서한','박우준','신유찬','안재현','이서빈','이승운','이시우','장재훈','전지훈','정유재','안시후'];
const studentEmail=(name)=>{const i=STUDENT_IDS.indexOf(name);return i<0?'':`bw2student${String(i+1).padStart(2,'0')}@blockworld2.invalid`};
const PSAVE=['egg','blockblast','tower'];
const DEFAULT_SPEED_SAVE={speed:0,coins:0,wins:0,rebirths:0,items:{},potions:0,cleared:{},codes:{},gift:false,muted:false,deaths:0,cos:{own:{},trail:'',aura:''}};
let supabase=null,channel=null,globalChannel=null,authUser=null,isAdmin=false,playerId=crypto.randomUUID(),playerName='플레이어',room='CLASS4',currentGame='';
let chatCooldown=0,toastTimer=null,lastPositionSent=0,lastSaveAt=0,pendingSave=null,latestAbuse=null,cloudLoadRequestedFor='';
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2600)}
function ensureClient(){if(!SUPABASE_URL||!SUPABASE_KEY)throw new Error('Render 환경변수 VITE_SUPABASE_URL 및 VITE_SUPABASE_ANON_KEY를 설정해야 합니다.');if(!supabase)supabase=createClient(SUPABASE_URL,SUPABASE_KEY);return supabase}
function addChat(name,message){const line=document.createElement('div');line.className='chat-line';const b=document.createElement('b');b.textContent=name+': ';line.append(b,document.createTextNode(message));$('chat-messages').append(line);$('chat-messages').scrollTop=$('chat-messages').scrollHeight;while($('chat-messages').children.length>50)$('chat-messages').firstChild.remove()}
function onlinePlayers(){if(!channel)return[];const out=[];Object.values(channel.presenceState()).forEach(list=>list.forEach(p=>{if(p.userId&&p.userId!==authUser?.id)out.push({userId:p.userId,name:p.name||'플레이어',game:p.game||''})}));return out}
function sendGameContext(){const frame=$('game-frame');if(!frame.contentWindow)return;frame.contentWindow.postMessage({type:'bw2:account',userId:authUser?.id||null,isAdmin,towerAdmin:!!authUser&&String(authUser.email||'').toLowerCase()===studentEmail('김지유'),players:onlinePlayers()},'*');}
function updateCount(){if(!channel)return;const state=channel.presenceState();let count=0;Object.values(state).forEach(list=>count+=list.length);$('online-count').textContent=count+'명 온라인';$('game-online').textContent='온라인 '+count+'명';if(currentGame==='speed'||currentGame==='tower')sendGameContext()}
async function loadSave(userId){const {data,error}=await supabase.from('speed_game_saves').select('data').eq('user_id',userId).maybeSingle();if(error)throw error;return data?.data||null}
async function persistSave(data){if(!authUser)return;const {error}=await supabase.from('speed_game_saves').upsert({user_id:authUser.id,data,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)console.error('speed save sync failed',error);persistLeaderboard(data)}
// TOP10 랭킹: 스피드 저장 시 랭킹 테이블에도 반영 (10초에 한 번, 랭킹 열 때는 즉시)
let lastLbAt=0;
function lbName(){const m=authUser?.user_metadata||{};return String(m.display_name||m.username||playerName||'플레이어').slice(0,16)}
async function persistLeaderboard(data,force){if(!authUser||!data)return;const now=Date.now();if(!force&&now-lastLbAt<10000)return;lastLbAt=now;const speed=Math.max(0,Number(data.speed)||0);const {error}=await supabase.from('speed_leaderboard').upsert({user_id:authUser.id,name:lbName(),speed,level:Math.max(1,Math.floor(Math.pow(speed/120,1/2.3)+1e-9)+1),wins:Math.max(0,Math.floor(Number(data.wins)||0)),rebirths:Math.max(0,Math.floor(Number(data.rebirths)||0)),updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)console.warn('leaderboard sync failed',error)}
window.addEventListener('message',async e=>{const frame=$('game-frame');if(!frame||e.source!==frame.contentWindow||!e.data||e.data.type!=='bw2:leaderboard-request'||currentGame!=='speed')return;const d=e.data;try{if(!authUser||!supabase)throw new Error('플랫폼 로그인이 필요합니다.');if(d.save)await persistLeaderboard(d.save,true);const col=d.sort==='wins'?'wins':'speed';const {data,error}=await supabase.from('speed_leaderboard').select('user_id,name,speed,level,wins,rebirths').order(col,{ascending:false}).limit(10);if(error)throw error;frame.contentWindow.postMessage({type:'bw2:leaderboard',rows:data||[],me:authUser.id,sort:col,req:d.req,mini:d.mini?1:0},'*')}catch(err){frame.contentWindow?.postMessage({type:'bw2:leaderboard',error:err.message||String(err),req:d.req,mini:d.mini?1:0},'*')}});
async function loadPlatformSave(gameKey){if(!authUser)return null;const {data,error}=await supabase.from('platform_game_saves').select('data').eq('user_id',authUser.id).eq('game_key',gameKey).maybeSingle();if(error)throw error;return data?.data??null}
async function persistPlatformSave(gameKey,data){if(!authUser)return;const {error}=await supabase.from('platform_game_saves').upsert({user_id:authUser.id,game_key:gameKey,data,updated_at:new Date().toISOString()},{onConflict:'user_id,game_key'});if(error)console.error(gameKey+' cloud save failed',error)}
function queueSave(data){pendingSave=data;const now=Date.now();if(now-lastSaveAt>1500){lastSaveAt=now;const copy=pendingSave;pendingSave=null;persistSave(copy)}else if(!window.__saveTimer){window.__saveTimer=setTimeout(()=>{window.__saveTimer=null;lastSaveAt=Date.now();const copy=pendingSave;pendingSave=null;if(copy)persistSave(copy)},1600)}}
let latestT150=false,latestUpdate=null,latestLocks=[];
const postSpeed=m=>{if(currentGame==='speed')$('game-frame').contentWindow?.postMessage(m,'*')};
const updMsg=(silent)=>({type:'bw2:update-notice',active:!!latestUpdate,endsAt:latestUpdate?.endsAt||0,text:latestUpdate?.text||'',silent:!!silent});
async function applyCommand(row){if(!row||row.game!=='speed')return;const p=row.payload||{};if(row.command==='abuse_start'){latestAbuse={...p,endsAt:Date.now()+Math.max(1,Number(p.durationSeconds)||60)*1000};if(currentGame==='speed')$('game-frame').contentWindow?.postMessage({type:'bw2:admin-abuse',active:true,...latestAbuse},'*')}
 else if(row.command==='cutscene'){const id=String(p.id||'');if(!id)return;if(currentGame==='speed')$('game-frame').contentWindow?.postMessage({type:'bw2:cutscene',id},'*');else toast('🎬 관리자가 스피드 키보드 탈출에서 컷신을 재생했어요!')}
 else if(row.command==='tread150_on'||row.command==='tread150_off'){const on=row.command==='tread150_on';latestT150=on;if(currentGame==='speed')$('game-frame').contentWindow?.postMessage({type:'bw2:tread150',active:on,cutscene:on},'*');else toast(on?'🚪 관리자가 스피드 키보드 탈출에 150x 러닝머신을 열었어요!':'🚪 150x 러닝머신이 닫혔어요')}
 else if(row.command==='update_notice'){const sec=Math.max(0,Math.min(86400,Number(p.seconds)||0));const base=row.created_at?new Date(row.created_at).getTime():Date.now();latestUpdate=sec>0?{endsAt:base+sec*1000,text:String(p.text||'').slice(0,40)}:null;if(currentGame==='speed')postSpeed(updMsg(false));else toast(latestUpdate?'🛠️ '+Math.ceil(sec/60)+'분 뒤 업데이트 예정'+(latestUpdate.text?' · '+latestUpdate.text:''):'🛠️ 업데이트 예고가 취소되었어요')}
 else if(row.command==='world_lock'){latestLocks=(Array.isArray(p.worlds)?p.worlds:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<15);postSpeed({type:'bw2:world-lock',worlds:latestLocks})}
 else if(row.command==='abuse_stop'){latestAbuse=null;if(currentGame==='speed')$('game-frame').contentWindow?.postMessage({type:'bw2:admin-abuse',active:false},'*')}
 else if(row.command==='reset_stats'&&row.target_user_id===authUser?.id){const reset=JSON.parse(JSON.stringify(DEFAULT_SPEED_SAVE));await persistSave(reset);if(currentGame==='speed')$('game-frame').contentWindow?.postMessage({type:'bw2:reset-stats',save:reset},'*');toast('관리자가 내 스탯을 초기화했습니다.')}
}
/* 전체 서버 연결 자동 복구: 끊기면 재연결 + 주기적으로 DB의 최신 상태와 맞춤 (끊긴 동안 놓친 어뷰즈/러닝머신 신호 복구) */
let globalWanted=false,globalRetry=0,globalRetryTimer=null,globalSyncTimer=null,globalSyncing=false;
function scheduleGlobalReconnect(){
 if(globalRetryTimer||!globalWanted||!supabase)return;
 const wait=Math.min(30000,1000*Math.pow(2,globalRetry++));
 globalRetryTimer=setTimeout(async()=>{
  globalRetryTimer=null;if(!globalWanted)return;
  try{if(globalChannel){const old=globalChannel;globalChannel=null;try{old.close()}catch(_){}}await ensureGlobalChannel();globalRetry=0;syncGlobalState()}
  catch(_){scheduleGlobalReconnect()}
 },wait);
}
async function syncGlobalState(){
 if(!supabase||!authUser||!globalWanted||globalSyncing)return;globalSyncing=true;
 try{
  const post=m=>{if(currentGame==='speed')$('game-frame').contentWindow?.postMessage(m,'*')};
  const {data:a,error:ae}=await supabase.from('speed_game_commands').select('command,payload,created_at').eq('room_code','__GLOBAL__').eq('game','speed').in('command',['abuse_start','abuse_stop']).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!ae){
   let want=null;
   if(a?.command==='abuse_start'){const p=a.payload||{};const end=new Date(a.created_at).getTime()+Math.max(1,Number(p.durationSeconds)||60)*1000;if(end>Date.now())want={...p,endsAt:end}}
   if(want&&(!latestAbuse||Math.abs((latestAbuse.endsAt||0)-want.endsAt)>5000)){latestAbuse=want;post({type:'bw2:admin-abuse',active:true,...latestAbuse})}
   else if(!want&&latestAbuse&&(latestAbuse.endsAt||0)>Date.now()+2000){latestAbuse=null;post({type:'bw2:admin-abuse',active:false})}
  }
  const {data:t,error:te}=await supabase.from('speed_game_commands').select('command').eq('room_code','__GLOBAL__').eq('game','speed').in('command',['tread150_on','tread150_off']).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!te&&t){const on=t.command==='tread150_on';if(on!==latestT150){latestT150=on;post({type:'bw2:tread150',active:on,cutscene:false})}}
  const {data:u,error:ue}=await supabase.from('speed_game_commands').select('payload,created_at').eq('room_code','__GLOBAL__').eq('game','speed').eq('command','update_notice').order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!ue){const sec=Number(u?.payload?.seconds)||0,end=u?new Date(u.created_at).getTime()+sec*1000:0,want=sec>0&&end>Date.now()-5*60000?{endsAt:end,text:String(u.payload?.text||'').slice(0,40)}:null;
   if(JSON.stringify(want)!==JSON.stringify(latestUpdate)){latestUpdate=want;post(updMsg(true))}}
  const {data:w,error:we}=await supabase.from('speed_game_commands').select('payload').eq('room_code','__GLOBAL__').eq('game','speed').eq('command','world_lock').order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!we){const lk=(Array.isArray(w?.payload?.worlds)?w.payload.worlds:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<15);if(JSON.stringify(lk)!==JSON.stringify(latestLocks)){latestLocks=lk;post({type:'bw2:world-lock',worlds:lk,silent:true})}}
 }catch(_){}
 finally{globalSyncing=false}
}
function checkGlobalNow(){if(!globalWanted)return;if(!globalChannel||globalChannel.state!=='joined'){globalRetry=0;scheduleGlobalReconnect()}syncGlobalState()}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkGlobalNow()});
window.addEventListener('online',checkGlobalNow);
window.addEventListener('focus',checkGlobalNow);
async function ensureGlobalChannel(){
 if(globalChannel&&globalChannel.state==='joined')return globalChannel;
 if(globalChannel)globalChannel.close();
 globalChannel=await makeRealtimeChannel('__GLOBAL__',{id:playerId,userId:authUser.id,name:playerName,game:currentGame});
 globalChannel.on('broadcast',{event:'server-msg'},({payload})=>{const text=String(payload?.text||'').slice(0,80);if(!text)return;if(currentGame==='speed')$('game-frame').contentWindow?.postMessage({type:'bw2:server-message',text},'*');else toast('📢 서버 메시지 | '+text)});
 globalChannel.on('broadcast',{event:'admin-abuse'},({payload})=>{if(payload?.game==='speed'&&['abuse_start','abuse_stop','tread150_on','tread150_off','cutscene','update_notice','world_lock'].includes(payload.command))applyCommand({game:'speed',command:payload.command,payload:payload.data||{}})});
 await new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>{if(!done){done=true;reject(new Error('전체 서버 동기화 연결 시간 초과'))}},12000);globalChannel.subscribe(status=>{if(status==='SUBSCRIBED'&&!done){done=true;clearTimeout(timer);resolve()}else if((status==='CHANNEL_ERROR'||status==='TIMED_OUT')&&!done){done=true;clearTimeout(timer);reject(new Error('전체 서버 동기화 채널 연결 실패'))}})});
 return globalChannel;
}
async function sendAdminCommand(command,payload={},targetUserId=null){
 if(!isAdmin)throw new Error('관리자 권한이 없습니다.');
 const global=['abuse_start','abuse_stop','tread150_on','tread150_off','cutscene','update_notice','world_lock'].includes(command);
 const scope=global?'__GLOBAL__':room;
 const {error}=await supabase.from('speed_game_commands').insert({room_code:scope,game:'speed',command,payload,target_user_id:targetUserId,created_by:authUser.id});
 if(error){if(command.startsWith('tread150')||command==='cutscene'||command==='update_notice'||command==='world_lock')console.warn('상태 저장 실패 (supabase/setup.sql 확인)',error);else throw error}
 const row={game:'speed',command,payload,target_user_id:targetUserId,created_by:authUser.id,created_at:new Date().toISOString()};
 if(global){await ensureGlobalChannel();await globalChannel.send({type:'broadcast',event:'admin-abuse',payload:{game:'speed',command,data:payload}});await applyCommand(row)}
 else if(channel)await channel.send({type:'broadcast',event:'command',payload:row});
}
async function joinRoom(){try{ensureClient();if(!authUser)throw new Error('먼저 계정 로그인 또는 회원가입을 해주세요.');
 if(!REALTIME_URL)throw new Error('Render 환경변수 VITE_REALTIME_URL에 Cloudflare Worker 주소를 설정해야 합니다.');
 const {data:adminRow,error:adminErr}=await supabase.from('speed_game_admins').select('user_id').eq('user_id',authUser.id).maybeSingle();if(adminErr)throw new Error('관리자 권한 확인 실패: '+adminErr.message);isAdmin=!!adminRow;
 channel=await makeRealtimeChannel('lobby-'+room,{id:playerId,userId:authUser.id,name:playerName,game:''});
 channel.on('presence',{event:'sync'},updateCount);
 channel.on('broadcast',{event:'chat'},({payload})=>addChat(payload.name,payload.message));
 channel.on('broadcast',{event:'anticheat'},({payload})=>{if(!isAdmin||!payload)return;const msg='⚠️ 부정행위 감지: '+String(payload.name||'플레이어').slice(0,16)+' ('+String(payload.reason||'').slice(0,30)+')';toast(msg);addChat('🛡️ 안티치트',msg)});
 channel.on('broadcast',{event:'game'},({payload})=>{if(payload.id!==playerId)toast(payload.name+' 님이 '+(TITLES[payload.game]||'게임')+' 플레이를 시작했습니다.')});
 channel.on('broadcast',{event:'position'},({payload})=>{if(!payload||payload.id===playerId||payload.game!==currentGame)return;$('game-frame').contentWindow?.postMessage({type:'bw2:remote',player:payload},'*')});
 channel.on('broadcast',{event:'command'},({payload})=>{if(payload)applyCommand(payload)});
 await new Promise((resolve,reject)=>{let finished=false;const timer=setTimeout(()=>{if(!finished){finished=true;reject(new Error('연결 시간 초과'))}},12000);channel.subscribe(async status=>{if(status==='SUBSCRIBED'&&!finished){finished=true;clearTimeout(timer);await channel.track({id:playerId,userId:authUser.id,name:playerName,game:''});$('online-status').textContent='Cloudflare 실시간 연결됨';$('online-status').classList.add('online');resolve()}else if((status==='CHANNEL_ERROR'||status==='TIMED_OUT')&&!finished){finished=true;clearTimeout(timer);reject(new Error('Cloudflare 실시간 서버 연결 실패'))}})});
 globalWanted=true;if(!globalSyncTimer)globalSyncTimer=setInterval(()=>{if(globalWanted&&document.visibilityState==='visible')checkGlobalNow()},15000);
 await ensureGlobalChannel();
 const {data:latest,error:latestError}=await supabase.from('speed_game_commands').select('*').eq('room_code','__GLOBAL__').eq('game','speed').in('command',['abuse_start','abuse_stop']).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(latestError)throw new Error('전체 서버 어뷰즈 상태 확인 실패: '+latestError.message);
 if(latest?.command==='abuse_start'){const p=latest.payload||{};const remaining=Math.max(0,(new Date(latest.created_at).getTime()+Math.max(1,Number(p.durationSeconds)||60)*1000)-Date.now());if(remaining>0)latestAbuse={...p,endsAt:Date.now()+remaining};else latestAbuse=null}else latestAbuse=null;
 try{const {data:t150}=await supabase.from('speed_game_commands').select('command').eq('room_code','__GLOBAL__').eq('game','speed').in('command',['tread150_on','tread150_off']).order('created_at',{ascending:false}).limit(1).maybeSingle();latestT150=t150?.command==='tread150_on'}catch(_){latestT150=false}
 syncGlobalState();return true;
 }catch(e){$('room-error').textContent=e.message;return false}}
async function sendChat(message){const clean=message.trim().slice(0,100);if(!clean||!channel||Date.now()-chatCooldown<500)return;chatCooldown=Date.now();addChat(playerName,clean);await channel.send({type:'broadcast',event:'chat',payload:{name:playerName,message:clean}})}
async function antiCheatApi(path,body){
 const {data:{session}}=await supabase.auth.getSession();
 if(!session?.access_token)throw new Error('로그인 세션이 없습니다.');
 const response=await fetch('/api/anticheat/'+path,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},body:JSON.stringify(body||{})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(result.error||'안티치트 서버 요청 실패');
 return result;
}
async function checkAntiCheatStatus(){
 const {data:{session}}=await supabase.auth.getSession();
 if(!session?.access_token)return {banned:false};
 const response=await fetch('/api/anticheat/status',{headers:{'Authorization':'Bearer '+session.access_token}});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(result.error||'제재 상태 확인 실패');
 return result;
}
async function launchGame(key){if(!TITLES[key])return;if(!authUser){toast('플랫폼 계정으로 먼저 로그인하세요.');$('room-modal').classList.add('show');return}if(key==='speed'){try{const status=await checkAntiCheatStatus();if(status.banned){toast('🚫 계정이 이용 제한 상태입니다: '+String(status.ban?.reason||'관리자 제재'));return}}catch(err){toast('안티치트 서버 확인 실패: '+err.message);return}}currentGame=key;cloudLoadRequestedFor='';$('active-game-title').textContent=TITLES[key];$('launcher').classList.add('hidden');$('game-view').classList.remove('hidden');const frame=$('game-frame');frame.onload=async()=>{if(cloudLoadRequestedFor===key)return;cloudLoadRequestedFor=key;try{if(key==='speed'){const saved=await loadSave(authUser.id);frame.contentWindow.postMessage({type:'bw2:load-save',save:saved||DEFAULT_SPEED_SAVE},'*');sendGameContext();if(latestT150)frame.contentWindow.postMessage({type:'bw2:tread150',active:true,cutscene:false},'*');frame.contentWindow.postMessage(updMsg(true),'*');frame.contentWindow.postMessage({type:'bw2:world-lock',worlds:latestLocks,silent:true},'*');if(latestAbuse&&latestAbuse.endsAt>Date.now())frame.contentWindow.postMessage({type:'bw2:admin-abuse',active:true,...latestAbuse,durationSeconds:Math.ceil((latestAbuse.endsAt-Date.now())/1000)},'*')}else if(PSAVE.includes(key)){const saved=await loadPlatformSave(key);frame.contentWindow.postMessage({type:'bw2:load-save',game:key,save:saved},'*');if(key==='tower')sendGameContext()}}catch(e){toast('계정 저장 데이터 불러오기 실패: '+e.message)}};frame.src='/games/'+key+'.html?v='+Date.now();/* 캐시 무시: 항상 최신 게임 파일 */$('chat-messages').replaceChildren();if(channel){await channel.track({id:playerId,userId:authUser.id,name:playerName,game:key});await channel.send({type:'broadcast',event:'game',payload:{id:playerId,name:playerName,game:key}})}toast(TITLES[key]+' 시작')}
async function backToGames(){$('game-frame').src='about:blank';$('game-view').classList.add('hidden');$('launcher').classList.remove('hidden');currentGame='';if(channel)await channel.track({id:playerId,userId:authUser.id,name:playerName,game:''})}
async function authAction(kind){try{ensureClient();if(kind==='signup'){const secret=prompt('Render 환경변수 CLASS_ACCOUNT_SETUP_SECRET 값을 입력하세요.');if(!secret)return;$('auth-error').textContent='학생 계정 27개를 준비하는 중...';const r=await fetch('/api/setup/class-accounts',{method:'POST',headers:{'Content-Type':'application/json','x-class-setup-secret':secret},body:'{}'});const data=await r.json();if(!r.ok)throw new Error(data.error||'계정 일괄 준비 실패');$('auth-error').textContent=`완료: ${data.total}개 계정 (새로 생성 ${data.created}개, 기존 계정 갱신 ${data.updated}개). 학생 ID와 공통 비밀번호 44class로 로그인하세요.`;return;}const username=$('account-email').value.trim();const email=studentEmail(username);const password=$('account-password').value;if(!email)throw new Error('목록에 있는 학생 ID를 정확히 입력하세요.');if(!password)throw new Error('비밀번호를 입력하세요.');$('auth-error').textContent='로그인 중...';const result=await supabase.auth.signInWithPassword({email,password});if(result.error)throw result.error;if(result.data.session){authUser=result.data.user;playerName=username;setAuthStatus();$('auth-error').textContent=username+' 계정으로 로그인되었습니다.'}}catch(e){$('auth-error').textContent=e.message}}
function setAuthStatus(){ const displayName=authUser?.user_metadata?.display_name||authUser?.user_metadata?.username||authUser?.email||''; $('account-status').textContent=authUser?'플랫폼 로그인됨: '+displayName:'플랫폼 로그인되지 않음';$('account-status').classList.toggle('online',!!authUser);$('platform-account').textContent=authUser?displayName:'로그아웃';if(authUser&&$('player-name'))$('player-name').value=displayName.slice(0,16);$('platform-logout').classList.toggle('hidden',!authUser); }
$('auth-login').addEventListener('click',()=>authAction('login'));$('auth-signup').addEventListener('click',()=>authAction('signup'));$('platform-logout').addEventListener('click',async()=>{if(!supabase)return;await supabase.auth.signOut();authUser=null;isAdmin=false;if(channel){channel.close();channel=null}globalWanted=false;if(globalChannel){const old=globalChannel;globalChannel=null;old.close()}$('room-modal').classList.add('show');setAuthStatus();toast('플랫폼에서 로그아웃했습니다.')});
if(SUPABASE_URL&&SUPABASE_KEY){supabase=createClient(SUPABASE_URL,SUPABASE_KEY);supabase.auth.getSession().then(({data})=>{authUser=data.session?.user||null;setAuthStatus()});supabase.auth.onAuthStateChange((_event,session)=>{authUser=session?.user||null;setAuthStatus()})}else{$('auth-error').textContent='Render 환경변수 VITE_SUPABASE_URL 및 VITE_SUPABASE_ANON_KEY를 설정해야 합니다.'}
$('room-form').addEventListener('submit',async e=>{e.preventDefault();playerName=$('player-name').value.trim().slice(0,16)||'플레이어';room=$('room-code').value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,16)||'CLASS4';$('room-error').textContent='';const btn=$('room-form').querySelector('button[type="submit"]');btn.disabled=true;btn.textContent='연결 중...';const ok=await joinRoom();btn.disabled=false;btn.textContent='입장하기';if(!ok)return;$('player-label').textContent=playerName;$('room-name').textContent=room;$('room-modal').classList.remove('show');toast(room+' 월드에 접속했습니다.')});
$('change-room').addEventListener('click',async()=>{if(channel){channel.close();channel=null}globalWanted=false;if(globalChannel){const old=globalChannel;globalChannel=null;old.close()}$('room-modal').classList.add('show');$('room-error').textContent=''});
document.querySelectorAll('[data-game]').forEach(btn=>btn.addEventListener('click',()=>launchGame(btn.dataset.game)));$('back-games').addEventListener('click',backToGames);
$('chat-form').addEventListener('submit',e=>{e.preventDefault();sendChat($('chat-input').value);$('chat-input').value=''});$('chat-toggle').addEventListener('click',()=>{const panel=$('chat-toggle').closest('.game-chat');panel.classList.toggle('collapsed');$('chat-toggle').textContent=panel.classList.contains('collapsed')?'+':'−'});
window.addEventListener('message',async e=>{if(e.source!==$('game-frame').contentWindow||!e.data)return;const d=e.data;if(d.type==='bw2:return-to-lobby'&&currentGame==='speed'){toast('부정행위 감지로 게임 로비로 이동합니다.');try{await antiCheatApi('report',{reason:String(d.reason||'unknown').slice(0,48)})}catch(err){console.warn('anti-cheat report failed',err.message)}try{if(channel)channel.send({type:'broadcast',event:'anticheat',payload:{name:playerName,reason:String(d.reason||'').slice(0,30)}})}catch(_){}await backToGames();return}else if(d.type==='bw2:position'&&channel&&currentGame){const now=Date.now();if(now-lastPositionSent<90)return;lastPositionSent=now;await channel.send({type:'broadcast',event:'position',payload:{id:playerId,userId:authUser.id,name:playerName,game:currentGame,x:Number(d.x)||0,y:Number(d.y)||0,z:Number(d.z)||0,rotation:Number(d.rotation)||0}})}else if(d.type==='bw2:save'&&d.save){if(currentGame==='speed'){const sv=d.save,okNum=v=>v===undefined||(typeof v==='number'&&Number.isFinite(v)&&v>=0);if(['speed','coins','wins','rebirths','potions'].every(k=>okNum(sv[k])))queueSave(sv);else console.warn('비정상 저장 데이터 무시')}else if(PSAVE.includes(currentGame))persistPlatformSave(currentGame,d.save)}else if(d.type==='bw2:admin-abuse-request'&&currentGame==='speed'){try{if(!isAdmin)throw new Error('관리자 권한이 없습니다.');if(d.active){const payload={stepMult:Math.max(1,Math.min(10000,Number(d.stepMult)||10)),winMult:Math.max(1,Math.min(10000,Number(d.winMult)||10)),durationSeconds:Math.max(1,Math.min(3600,Number(d.durationSeconds)||60))};await sendAdminCommand('abuse_start',payload)}else await sendAdminCommand('abuse_stop',{});toast('전체 플레이어에게 어뷰즈 설정을 전송했습니다.')}catch(err){toast(err.message)}}else if(d.type==='bw2:server-message-request'&&currentGame==='speed'){try{if(!isAdmin)throw new Error('관리자 권한이 없습니다.');const text=String(d.text||'').trim().slice(0,80);if(!text)return;await ensureGlobalChannel();await globalChannel.send({type:'broadcast',event:'server-msg',payload:{text}});toast('📢 전체 서버에 메시지를 보냈습니다.')}catch(err){toast('메시지 전송 실패: '+err.message)}}else if(d.type==='bw2:cutscene-request'&&currentGame==='speed'){try{if(!isAdmin)throw new Error('관리자 권한이 없습니다. (speed_game_admins에 등록된 계정만 가능)');const id=String(d.id||'').replace(/[^a-z0-9_]/gi,'').slice(0,20);if(!id)throw new Error('컷신 ID 오류');await sendAdminCommand('cutscene',{id});toast('전체 서버에 컷신을 보냈습니다.')}catch(err){toast(err.message)}}else if(d.type==='bw2:tread150-request'&&currentGame==='speed'){try{if(!isAdmin)throw new Error('관리자 권한이 없습니다. (speed_game_admins에 등록된 계정만 가능)');await sendAdminCommand(d.active?'tread150_on':'tread150_off',{});toast(d.active?'전체 서버에 150x 러닝머신 컷신을 보냈습니다.':'전체 서버의 150x 러닝머신을 닫았습니다.')}catch(err){toast(err.message)}}else if(d.type==='bw2:update-notice-request'&&currentGame==='speed'){try{if(!isAdmin)throw new Error('관리자 권한이 없습니다.');const m=Math.max(0,Math.min(1440,Math.floor(Number(d.minutes)||0)));await sendAdminCommand('update_notice',{seconds:m*60,text:String(d.text||'').trim().slice(0,40)});toast(m?'⏳ 전체 서버에 '+m+'분 뒤 업데이트 예고를 보냈습니다.':'⏳ 업데이트 예고를 취소했습니다.')}catch(err){toast(err.message)}}else if(d.type==='bw2:world-lock-request'&&currentGame==='speed'){try{if(!isAdmin)throw new Error('관리자 권한이 없습니다.');const worlds=[...new Set((Array.isArray(d.worlds)?d.worlds:[]).map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<15))].sort((a,b)=>a-b);await sendAdminCommand('world_lock',{worlds});toast(worlds.length?'🔒 전체 서버 월드 잠금: '+worlds.map(i=>'W'+(i+1)).join(', '):'🔓 모든 월드를 열었습니다.')}catch(err){toast(err.message)}}else if(d.type==='bw2:admin-reset-request'&&currentGame==='speed'){try{if(!isAdmin)throw new Error('관리자 권한이 없습니다.');const target=String(d.targetUserId||'');if(!target)throw new Error('초기화할 플레이어를 선택하세요.');const reset=JSON.parse(JSON.stringify(DEFAULT_SPEED_SAVE));const {error}=await supabase.from('speed_game_saves').upsert({user_id:target,data:reset,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;await supabase.from('speed_leaderboard').update({speed:0,level:1,wins:0,rebirths:0,updated_at:new Date().toISOString()}).eq('user_id',target);await sendAdminCommand('reset_stats',{},target);toast('선택한 플레이어의 스탯을 초기화했습니다.')}catch(err){toast(err.message)}}});
window.addEventListener('beforeunload',()=>{if(channel)channel.close();if(globalChannel)globalChannel.close()});
$('room-modal').classList.add('show');$('player-name').focus();
