const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const html=readFileSync(join(__dirname,'../index.html'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(t,{reduced=true,canvas=true}={}) {
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://example.test/subpath/',virtualConsole:vc,beforeParse(w){
    w.matchMedia=()=>({matches:reduced});
    w.HTMLCanvasElement.prototype.getContext=()=>canvas?new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)}):null;
  }});
  t.after(()=>{dom.window.close();assert.deepEqual(errors,[]);});
  const w=dom.window,d=w.document,$=id=>d.getElementById(id),get=code=>w.eval(code);
  const change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('change'));};
  const category=value=>d.querySelector(`[data-category="${value}"]`).click();
  const range=value=>d.querySelector(`[data-range="${value}"]`).click();
  function available(){range('city');change('timeMode','any');category('全部');}
  return {w,d,$,get,change,category,range,available};
}
// Synthetic fixtures remain in tests; production never receives guessed times or prices.
const period=(start,end,endDayOffset=0)=>({start,end,endDayOffset});
const schedule=(p)=>Array.from({length:7},()=>p);
function record(overrides={}) {return {id:'fixture',name:'Fixture',short:'Fixture',status:'已收錄',city:'斗六市',categories:['正餐'],priceByCategory:{正餐:{amount:100,item:'meal',source:'https://example.test/menu',checkedAt:'2026-10-19'}},weeklyHours:schedule([period('11:00','14:00')]),hoursExceptions:{},accessRoutes:[],...overrides};}
const options={category:'正餐',range:'city',budget:'any',time:'at',at:'2026-10-19T12:00'};

test('published walking evidence matches the fixed gate, destination and rounded route time',t=>{
 const {get,w}=setup(t),evidence=JSON.parse(readFileSync(join(__dirname,'../data/routes-2026-10-19.json'),'utf8'));
 const rows=get('RESTAURANTS').filter(r=>w.routeFor(r));assert.equal(rows.length,9);
 for(const r of rows){
  const e=evidence[r.id],route=w.routeFor(r);
  assert.equal(e.request.costing,'pedestrian');
  assert.deepEqual(e.request.locations[0],{lat:23.693064,lon:120.533660});
  assert.deepEqual(e.request.locations[1],{lat:r.location.lat,lon:r.location.lon});
  assert.equal(route.minutes,Math.ceil(e.response.trip.summary.time/60));
  assert.equal(e.response.trip.status,0);assert.equal(route.source,e.source);
 }
});
test('real nearby meals are available at dinner and remain empty after closing',t=>{
 const {w,get,$}=setup(t),rows=get('RESTAURANTS'),f={...options,range:'near'};
 assert.deepEqual(plain(w.selectPool(rows,f,w.parseTaipei('2026-10-19T18:00'),null,false).pool.map(r=>r.id)),['datou','grayspace','leedong','viet','meiwei','nantou','chicken','myshop','seetea','edo','pengfood','hokkaido','mrblack','fage','oyster']);
 assert.equal(w.selectPool(rows,f,w.parseTaipei('2026-10-20T00:01'),null,false).pool.length,0);
 get("state.filters={...DEFAULTS,time:'at',at:'2026-10-19T18:00'};syncControls();refresh()");$('spin').click();
 assert.match($('oddsNote').textContent,/排除上次/);assert.doesNotMatch($('oddsNote').textContent,/允許重複/);
 get("state.filters.at='2026-10-20T00:01';syncControls();refresh({changed:true})");
 assert.equal($('spin').disabled,true);assert.doesNotMatch($('emptyMessage').textContent,/目前缺少符合此步行範圍/);
 assert.equal(get('state.filters.range'),'near');
});
test('corrected restaurant pins keep 31-minute and 33-minute walks outside the far range',t=>{
 const {w,get}=setup(t),rows=get('RESTAURANTS'),f={...options,range:'far',time:'any'};
 const pool=plain(w.selectPool(rows,f,w.parseTaipei(options.at),null,false).pool.map(r=>r.id));
 assert.ok(pool.includes('chico'));assert.ok(pool.includes('oldstreet'));
 assert.ok(!pool.includes('aci'));assert.ok(!pool.includes('aguoshi'));
});

test('default area remains usable without walking routes and keeps explicit time filters',t=>{
 const {$,get,change,range}=setup(t);
 assert.deepEqual(plain(get('state.filters')),{category:'正餐',range:'near',budget:'any',time:'now',at:''});
 assert.equal(get('GATE.verified'),true);change('timeMode','at');change('atTime','2026-10-19T18:00');
 const before=get('state.pool.map(r=>r.id).join()');get('RESTAURANTS.forEach(r=>r.accessRoutes=[])');get('refresh()');
 assert.equal(get('state.pool.map(r=>r.id).join()'),before);assert.equal($('spin').disabled,false);
 range('city');assert.equal(get('state.filters.time'),'at');assert.equal(get('state.filters.category'),'正餐');
 $('resetFilters').click();assert.equal(get('state.filters.range'),'near');assert.equal(get('state.filters.time'),'now');
});
test('all public records have unique identity, sources and honest optional fields',t=>{
 const {get}=setup(t),rows=get('RESTAURANTS');assert.equal(rows.length,66);assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 for(const r of rows){assert.equal(r.city,'斗六市');assert.ok(r.address.startsWith('雲林縣斗六市'));assert.equal(new URL(r.source).protocol,'https:');assert.match(r.checkedAt,/^\d{4}-\d{2}-\d{2}$/);for(const p of Object.values(r.priceByCategory))if(p){assert.ok(p.amount>0);assert.ok(p.source);assert.ok(p.item);assert.ok(p.checkedAt);}}
});
test('Taiwan time conversion and impossible date validation',t=>{
 const {w}=setup(t);
 assert.equal(w.taipeiParts(new Date('2026-10-18T16:01:00Z')).input,'2026-10-19T00:01');
 assert.equal(w.parseTaipei('2026-10-19T12:30').toISOString(),'2026-10-19T04:30:00.000Z');
 for(const value of ['', '2026-02-30T12:00','2026-13-01T12:00','2026-10-19T25:00','<script>'])assert.equal(w.parseTaipei(value),null);
});
test('opening intervals include start, exclude end, and handle split service',t=>{
 const {w}=setup(t),r=record({weeklyHours:schedule([period('11:00','14:00'),period('17:00','21:00')])});
 for(const [time,status] of [['10:59','closed'],['11:00','open'],['13:59','open'],['14:00','closed'],['17:00','open'],['21:00','closed']])assert.equal(w.openingStatus(r,w.parseTaipei('2026-10-19T'+time)).status,status);
});
test('overnight service crosses weekdays and ends at exact boundary',t=>{
 const {w}=setup(t),week=schedule([]);week[1]=[period('22:00','02:00',1)];const r=record({weeklyHours:week});
 for(const [time,status] of [['2026-10-19T22:00','open'],['2026-10-20T01:59','open'],['2026-10-20T02:00','closed'],['2026-10-20T22:00','closed']])assert.equal(w.openingStatus(r,w.parseTaipei(time)).status,status);
});
test('date exceptions override weekly and previous-day carryover; unknown remains distinct',t=>{
 const {w}=setup(t),r=record({weeklyHours:schedule([period('22:00','02:00',1)]),hoursExceptions:{'2026-10-20':{periods:[]}}});
 assert.equal(w.openingStatus(r,w.parseTaipei('2026-10-20T01:00')).status,'closed');
 r.hoursExceptions['2026-10-20'].periods=[period('09:00','12:00')];assert.equal(w.openingStatus(r,w.parseTaipei('2026-10-20T09:00')).status,'open');
 r.hoursExceptions['2026-10-20'].periods=null;assert.equal(w.openingStatus(r,w.parseTaipei('2026-10-20T09:00')).status,'unknown');
 assert.equal(w.openingStatus(record({hoursRestricted:true}),w.parseTaipei(options.at)).status,'unknown');
 assert.equal(w.openingStatus(record({weeklyHours:null}),w.parseTaipei(options.at)).status,'unknown');
});
test('all budget boundaries and category-specific prices',t=>{
 const {w}=setup(t),date=w.parseTaipei(options.at);
 for(const [amount,budget] of [[1,'100'],[100,'100'],[101,'200'],[200,'200'],[201,'300'],[300,'300'],[301,'301'],[999,'301']]){
  const r=record();r.priceByCategory.正餐.amount=amount;
  for(const band of ['100','200','300','301'])assert.equal(w.exclusionReason(r,{...options,budget:band},date),band===budget?null:'budget');
 }
 const r=record({categories:['正餐','飲料'],priceByCategory:{正餐:null,飲料:{amount:50,item:'tea',source:'https://example.test',checkedAt:'2026-10-19'}}});
 assert.equal(w.exclusionReason(r,{...options,budget:'100'},date),'priceUnknown');
 assert.equal(w.exclusionReason(r,{...options,budget:'100',category:'全部'},date),null);
 assert.equal(w.matchingPrices(r,{...options,budget:'100',category:'全部'})[0].category,'飲料');
});
test('unknown price is allowed only with unlimited budget; zero is not free',t=>{
 const {w}=setup(t),date=w.parseTaipei(options.at);
 for(const p of [null,{amount:0},{amount:-1},{amount:50}]){
  const r=record({priceByCategory:{正餐:p}});assert.equal(w.exclusionReason(r,options,date),null);assert.equal(w.exclusionReason(r,{...options,budget:'100'},date),'priceUnknown');
 }
});
test('near uses sourced geographic membership; far is its union with verified 30-minute walks',t=>{
 const {w,get}=setup(t),date=w.parseTaipei(options.at);
 const area={included:true,source:'https://example.test/address',checkedAt:'2026-10-19'};
 function withRoute(minutes,extra={}) {return record({longtanArea:{...area,included:false},accessRoutes:[{originId:'yuntech-longtan-gate',mode:'walking',verified:true,accessible:true,minutes,source:'https://example.test/route',checkedAt:'2026-10-19',...extra}]});}
 for(const m of [15,16,30,31]){assert.equal(w.exclusionReason(withRoute(m),{...options,range:'near'},date),'range');assert.equal(w.exclusionReason(withRoute(m),{...options,range:'far'},date),m<=30?null:'range');}
 for(const range of ['near','far'])assert.equal(w.exclusionReason(record({longtanArea:area}),{...options,range},date),null);
 for(const areaValue of [null,{included:true},{...area,source:null}])assert.equal(w.exclusionReason(record({longtanArea:areaValue}),{...options,range:'near'},date),'areaUnknown');
 for(const extra of [{verified:false},{accessible:false},{originId:'other'},{source:null},{minutes:0}])assert.equal(w.exclusionReason(withRoute(5,extra),{...options,range:'far'},date),'routeUnknown');
 assert.equal(w.exclusionReason(record({city:'古坑鄉',longtanArea:area}),{...options,range:'near'},date),'range');
 const ids=get("RESTAURANTS.filter(inLongtanArea).map(r=>r.id)");assert.ok(ids.includes('gouba'));assert.ok(ids.includes('myshop'));assert.ok(!ids.includes('chico'));assert.ok(!ids.includes('hans'));
});
test('filter composition and first exclusion counts never double count',t=>{
 const {w}=setup(t),date=w.parseTaipei(options.at),rows=[record({id:'a'}),record({id:'b',status:'停業'}),record({id:'c',categories:['點心']}),record({id:'d',priceByCategory:{}}),record({id:'e',weeklyHours:null}),record({id:'f',weeklyHours:schedule([])})];
 const s=w.selectPool(rows,{...options,budget:'100'},date,null,true);assert.deepEqual(plain(s.pool.map(r=>r.id)),['a']);assert.equal(Object.values(s.counts).reduce((a,b)=>a+b,0)+s.pool.length,rows.length);assert.equal(s.counts.status,1);assert.equal(s.counts.category,1);assert.equal(s.counts.priceUnknown,1);assert.equal(s.counts.hoursUnknown,1);assert.equal(s.counts.closed,1);
});
test('entire production filter matrix produces valid, unique candidates',t=>{
 const {w,get}=setup(t),rows=get('RESTAURANTS');
 for(const category of ['全部','正餐','早午餐','點心','飲料'])for(const range of ['near','far','city'])for(const budget of ['any','100','200','300','301'])for(const time of ['any','at']){
  const f={...options,category,range,budget,time},date=w.parseTaipei(f.at),s=w.selectPool(rows,f,date,null,true);
  assert.equal(s.pool.length,new Set(s.pool.map(r=>r.id)).size);s.pool.forEach(r=>assert.equal(w.exclusionReason(r,f,date),null));assert.equal(Object.values(s.counts).reduce((a,b)=>a+b,0)+s.pool.length,rows.length);
 }
});
test('single candidate can repeat and no-repeat otherwise removes only previous draw',t=>{
 const {w}=setup(t),a=record({id:'a'}),b=record({id:'b'}),date=w.parseTaipei(options.at);
 assert.equal(w.selectPool([a],options,date,'a',true).pool.length,1);assert.deepEqual(plain(w.selectPool([a,b],options,date,'a',true).pool.map(r=>r.id)),['b']);assert.equal(w.selectPool([a,b],options,date,'a',false).pool.length,2);
});
test('wheel pointer hits every correct slice/group for 1, 12, 18, 36, 37, 60 and 101 candidates',t=>{
 const {w}=setup(t);
 for(const n of [1,12,18,36,37,60,101]){
  const items=Array.from({length:n},(_,i)=>({short:String(i)})),groups=w.wheelGroups(items);assert.ok(groups.length<=(n>36?12:n));assert.equal(groups.reduce((s,g)=>s+g.end-g.start,0),n);
  for(let i=0;i<n;i++)for(const previous of [0,1813,28964.4]){const angle=w.targetRotation(previous,i,items),fraction=((360-angle%360)%360)/360;const g=groups.find(g=>fraction>=g.from-1e-8&&fraction<g.to);assert.ok(i>=g.start&&i<g.end);assert.ok(angle-previous>=1800);}
 }
});
test('crypto rejection sampling removes modulo bias and handles fallback',t=>{
 const {w}=setup(t);let calls=0;w.crypto.getRandomValues=a=>{a[0]=calls++===0?0xffffffff:17;return a;};assert.equal(w.randomIndex(18),17);assert.equal(calls,2);assert.throws(()=>w.randomIndex(0),/candidate/);w.crypto.getRandomValues=undefined;assert.ok(w.randomIndex(5)<5);
});
test('reduced-motion draws: current result, map, next pool, repeated draws and history limit',t=>{
 const {$,get,available,d}=setup(t);available();let last=null;
 for(let i=0;i<30;i++){$('spin').click();const id=get('state.lastId');assert.notEqual(id,last);last=id;assert.equal(get('state.spinning'),false);assert.equal(get('state.wheelItems.some(r=>r.id===state.lastId)'),true);assert.equal(get('state.pool.some(r=>r.id===state.lastId)'),false);}
 assert.equal(get('state.history.length'),5);assert.equal(d.querySelectorAll('#history button').length,5);assert.match($('result').textContent,/本次抽中/);assert.ok(new URL($('map').src).searchParams.get('q').includes(get('state.history[0].name')));assert.match($('candidateCount').textContent,/本次.*下次可抽/);
});
test('filter change marks old result and redraws eligible slices',t=>{
 const {$,get,available,category}=setup(t);available();$('spin').click();category('飲料');assert.match($('result').textContent,/上次結果/);assert.equal(get('state.preserveWheel'),false);assert.deepEqual(plain(get('state.wheelItems.map(r=>r.id)')),plain(get('state.pool.map(r=>r.id)')));
});
test('search is text-only and never changes draw pool; full directory includes pending data',t=>{
 const {$,get,d,w,available,change}=setup(t);available();const before=get('state.pool.map(r=>r.id).join()');
 $('search').value='<img src=x onerror=alert(1)>';$('search').dispatchEvent(new w.Event('input'));assert.equal(d.querySelectorAll('#restaurantGrid img').length,0);assert.equal(get('state.pool.map(r=>r.id).join()'),before);
 $('search').value='';change('listMode','all');assert.equal(d.querySelectorAll('.restaurant-card').length,66);assert.match($('restaurantGrid').textContent,/待核對/);
});
test('viewing a card or history changes map without affecting draw state',t=>{
 const {$,get,d,available}=setup(t);available();$('spin').click();const last=get('state.lastId'),history=get('state.history.map(r=>r.id).join()');d.querySelector('.card-actions button').click();assert.match($('result').textContent,/正在查看/);assert.equal(get('state.lastId'),last);d.querySelector('#history button').click();assert.equal(get('state.history.map(r=>r.id).join()'),history);
});
test('animation freezes controls and snapshot, ignores double clicks, and completes once',t=>{
 const {$,get,w,available,d}=setup(t,{reduced:false});available();$('spin').click();const ids=get('state.pool.map(r=>r.id).join()');$('spin').click();d.querySelector('[data-range="near"]').click();assert.equal(get('state.pool.map(r=>r.id).join()'),ids);assert.equal($('filterFields').disabled,true);assert.equal($('search').disabled,true);assert.equal(get('state.history.length'),0);
 const e=new w.Event('transitionend');Object.defineProperty(e,'propertyName',{value:'transform'});$('wheel').dispatchEvent(e);$('wheel').dispatchEvent(e);assert.equal(get('state.history.length'),1);assert.equal($('filterFields').disabled,false);assert.equal($('search').disabled,false);
});
test('fallback timer completes animation when transition event is missing',async t=>{
 const {$,get,available}=setup(t,{reduced:false});available();$('spin').click();await new Promise(resolve=>setTimeout(resolve,4600));assert.equal(get('state.spinning'),false);assert.equal(get('state.history.length'),1);
});
test('time refresh and visibility update now-mode pool',t=>{
 const {$,get,w,range,d}=setup(t);range('city');get("RESTAURANTS.forEach(r=>r.weeklyHours=null)");w.tick();assert.equal(get('state.pool.length'),0);assert.equal($('spin').disabled,true);
 get("RESTAURANTS[0].weeklyHours=Array.from({length:7},()=>[{start:'00:00',end:'00:00',endDayOffset:1}])");Object.defineProperty(d,'hidden',{value:false,configurable:true});d.dispatchEvent(new w.Event('visibilitychange'));assert.equal(get('state.pool.length'),1);
});
test('crossing schedule boundary during frozen draw preserves result and warns',t=>{
 const {$,get,w,range}=setup(t,{reduced:false});range('city');
 get("RESTAURANTS.forEach(r=>r.weeklyHours=null);RESTAURANTS[0].weeklyHours=Array.from({length:7},()=>[{start:'00:00',end:'00:00',endDayOffset:1}])");w.tick();$('spin').click();get('RESTAURANTS[0].weeklyHours=null');get('state.finish()');assert.match($('result').textContent,/跨越營業時刻/);assert.equal(get('state.pool.length'),0);assert.equal(get('state.history.length'),1);
});
test('invalid custom date blocks draw; budget all-category result names the matching item',t=>{
 const {$,get,change,category,range}=setup(t);range('city');change('timeMode','at');change('atTime','');assert.equal($('timeError').hidden,false);assert.equal($('spin').disabled,true);
 change('atTime','2026-10-19T12:00');category('全部');change('budget','100');get("RESTAURANTS.forEach(r=>{if(r.id!=='fourth')r.status='待核對'})");get('refresh({changed:true})');$('spin').click();assert.match($('result').textContent,/點心基準：純麥芽棒棒糖/);assert.match($('result').textContent,/飲料基準：洛神花茶/);
});
test('Canvas failure does not block text drawing; map/source links are safe',t=>{
 const {$,w,d,available,get}=setup(t,{canvas:false});available();assert.equal($('canvasFallback').hidden,false);$('spin').click();assert.equal(get('state.history.length'),1);assert.ok(d.querySelector('.direction').href.startsWith('https://www.google.com/maps/dir/'));d.querySelectorAll('a[target="_blank"]').forEach(a=>assert.match(a.rel,/noopener/));assert.equal(w.link('unsafe','javascript:alert(1)').hasAttribute('href'),false);
});
test('fresh page keeps shared defaults, no stored personal settings',t=>{
 const {$,w,get,available}=setup(t);available();$('spin').click();assert.equal(w.localStorage.length,0);assert.equal(w.sessionStorage.length,0);assert.equal(get('DATASET.version'),'2026-10-19.5');
});

test('a later time-boundary refresh relabels a completed draw without adding history',t=>{
 const {$,get,w,range}=setup(t);range('city');
 get("RESTAURANTS.forEach(r=>r.weeklyHours=null);RESTAURANTS[0].weeklyHours=Array.from({length:7},()=>[{start:'00:00',end:'00:00',endDayOffset:1}])");w.tick();$('spin').click();assert.equal(get('state.result.mode'),'drawn');get('RESTAURANTS[0].weeklyHours=null');w.tick();assert.equal(get('state.result.mode'),'previous');assert.equal(get('state.history.length'),1);assert.match($('liveStatus').textContent,/時刻已更新/);
});

test('near directory shows closed and pending shops independently of wheel filters',t=>{
 const {$,get,change,d}=setup(t);assert.equal($('listMode').value,'near');
 assert.equal(d.querySelectorAll('.restaurant-card').length,get('RESTAURANTS.filter(inLongtanArea).length'));
 change('timeMode','at');change('atTime','2026-10-20T00:01');assert.equal(get('state.pool.length'),0);
 assert.equal(d.querySelectorAll('.restaurant-card').length,53);change('listMode','eligible');assert.equal(d.querySelectorAll('.restaurant-card').length,0);
});
test('delivery schedules are identified in result and never used as on-site prices',t=>{
 const {get,$}=setup(t);get("state.filters.time='at';state.filters.at='2026-10-19T18:00';viewRestaurant(RESTAURANTS.find(r=>r.id==='viet'))");
 assert.match($('result').textContent,/外送平台供餐時段/);assert.match($('result').textContent,/內用／外帶請先/);
 assert.equal(get("RESTAURANTS.find(r=>r.id==='viet').priceByCategory.正餐"),null);
 assert.equal($('result').hidden,false);assert.match($('quickResult').textContent,/越南料理/);
});

test('new weekly schedules retain source weekdays and correctly convert midnight',t=>{
 const {get}=setup(t),rows=get('RESTAURANTS'),evidence=JSON.parse(readFileSync(join(__dirname,'../data/longtan-2026-10-19.json'),'utf8'));
 for(const e of evidence.weeklySources){
  const r=rows.find(r=>r.id===e.id),expected=Array.from({length:7},()=>[]);
  if(e.kind==='delivery')for(const p of e.openingHoursSpecification){for(const d of Array.isArray(p.dayOfWeek)?p.dayOfWeek:[p.dayOfWeek])expected[['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].indexOf(d)].push(period(p.opens,p.closes,Number(p.closes<=p.opens)));}
  else for(const text of e.openingHoursList){const d='日一二三四五六'.indexOf(text[2]);for(const m of text.matchAll(/(\d{2}:\d{2})-(\d{2}:\d{2})/g))expected[d].push(period(m[1],m[2],Number(m[2]<=m[1])));}
  assert.deepEqual(plain(r.weeklyHours),expected,r.id);assert.equal(r.hoursSource,e.source);
 }
});
