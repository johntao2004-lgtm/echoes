const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DB = path.join(ROOT, 'data', 'db.json');
const PORT = Number(process.env.PORT || 5173);

const spirits = [
  {name:'白泽', trait:'洞察', prompt:'把今天没说出口的真相，轻轻说给未来的自己。'},
  {name:'麒麟', trait:'善意', prompt:'录下一句可以递给陌生人的祝福。'},
  {name:'凤凰', trait:'重生', prompt:'用一句话描述你重新开始的瞬间。'},
  {name:'玄鹿', trait:'宁静', prompt:'模仿夜色里最温柔的一种声音。'},
  {name:'鲲鹏', trait:'远行', prompt:'对正在路上的人说一句同行暗号。'}
];
const topics = [
  '如果今天的南京有回声，它会说什么？',
  '给 3 点还醒着的人留一句话。',
  '把一滴水落进森林前的心事说出来。',
  '用一句话邀请陌生人和你合唱明天。',
  '你希望哪种声音替你拥抱世界？'
];
const seedWorks = [
  { id:'w-seed-1', title:'凌晨三点共同写的诗', topic:'给 3 点还醒着的人留一句话。', spirit:'凤凰', author:'Echo_07', line:'如果你也没睡，就把月光借给我半句。', layers:[{name:'海浪',role:'background',mix:38},{name:'陌生吉他',role:'harmony',mix:52},{name:'你的回应',role:'lead',mix:70}], likes:128, createdAt:new Date().toISOString() },
  { id:'w-seed-2', title:'白泽在雨里听见答案', topic:'如果今天的南京有回声，它会说什么？', spirit:'白泽', author:'Lingrui_12', line:'城市没有睡，它只是把梦藏进秦淮河。', layers:[{name:'雨声',role:'background',mix:45},{name:'低声旁白',role:'lead',mix:65}], likes:92, createdAt:new Date().toISOString() }
];
function load(){
  if(!fs.existsSync(DB)) fs.writeFileSync(DB, JSON.stringify({users:[],works:[],passports:[]},null,2));
  const db = JSON.parse(fs.readFileSync(DB,'utf8'));
  if(!db.works || db.works.length===0){ db.works = seedWorks; save(db); }
  return db;
}
function save(db){ fs.writeFileSync(DB, JSON.stringify(db,null,2),'utf8'); }
function json(res, data, code=200){ res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*'}); res.end(JSON.stringify(data)); }
function body(req){ return new Promise(resolve=>{ let s=''; req.on('data',c=>s+=c); req.on('end',()=>{ try{resolve(s?JSON.parse(s):{})}catch(e){resolve({})} }); }); }
function todayTopic(){ const d = new Date(); return topics[(d.getFullYear()+d.getMonth()+d.getDate()) % topics.length]; }
function aiFromImage(desc=''){ const txt=String(desc).toLowerCase(); let s=spirits[0]; if(/火|红|sun|凤凰/.test(txt)) s=spirits[2]; else if(/鹿|林|绿|forest/.test(txt)) s=spirits[3]; else if(/海|天|blue|鸟|云/.test(txt)) s=spirits[4]; else if(/金|祝福|光|麒麟/.test(txt)) s=spirits[1]; return {spirit:s.name, trait:s.trait, topic:s.prompt, narration:`灵瑞 ${s.name} 识别到「${desc||'未命名图像'}」中的${s.trait}能量，建议把它转成一句可被他人叠录的声音种子。`, tags:['灵瑞集','图像生成命题','声音共创']}; }
function mime(file){ return {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/markdown; charset=utf-8'}[path.extname(file)] || 'application/octet-stream'; }
const server = http.createServer(async (req,res)=>{
  const url = new URL(req.url, `http://${req.headers.host}`);
  if(req.method==='OPTIONS') return json(res,{});
  if(url.pathname==='/api/today') return json(res,{topic:todayTopic(), deadline:'今晚 23:59 前有效', spirit:spirits[new Date().getDate()%spirits.length]});
  if(url.pathname==='/api/works' && req.method==='GET'){ const db=load(); return json(res,{works:db.works.sort((a,b)=>b.likes-a.likes)}); }
  if(url.pathname==='/api/works' && req.method==='POST'){ const db=load(); const b=await body(req); const w={id:'w-'+crypto.randomBytes(4).toString('hex'), title:b.title||'未命名回响', topic:b.topic||todayTopic(), spirit:b.spirit||'白泽', author:b.author||'匿名声音', line:b.line||'我在这里留下一句回声。', layers:b.layers||[], likes:0, createdAt:new Date().toISOString()}; db.works.push(w); save(db); return json(res,{ok:true,work:w}); }
  if(url.pathname.startsWith('/api/works/') && url.pathname.endsWith('/layer') && req.method==='POST'){ const id=url.pathname.split('/')[3]; const db=load(); const w=db.works.find(x=>x.id===id); if(!w) return json(res,{error:'work not found'},404); const b=await body(req); w.layers.push({name:b.name||'新的回应', role:b.role||'harmony', mix:Number(b.mix||55), note:b.note||'', at:new Date().toISOString()}); w.likes += 7; save(db); return json(res,{ok:true,work:w}); }
  if(url.pathname==='/api/ai/image-to-prompt' && req.method==='POST'){ const b=await body(req); return json(res,aiFromImage(b.description||b.fileName||'')); }
  if(url.pathname==='/api/passport'){ const db=load(); return json(res,{name:'Olivia', forestLevel:7, spirits:['白泽','凤凰','玄鹿'], ripples:db.works.reduce((n,w)=>n+(w.layers?.length||0),0), badges:['每日命题 3 连击','第12秒邀约','灵瑞图腾入选']}); }
  let file = url.pathname==='/' ? '/index.html' : decodeURIComponent(url.pathname);
  const full = path.normalize(path.join(PUBLIC,file));
  if(!full.startsWith(PUBLIC)) {res.writeHead(403); return res.end('Forbidden');}
  fs.readFile(full,(err,buf)=>{ if(err){res.writeHead(404);res.end('Not found')} else {res.writeHead(200,{'Content-Type':mime(full)});res.end(buf)} });
});
server.listen(PORT, ()=> console.log(`Echoes Lingrui demo: http://localhost:${PORT}`));
