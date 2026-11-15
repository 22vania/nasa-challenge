const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements=new Map();const initial={pitch:'12',scale:'continuous',duration:'45',speed:'1',volume:'30',instrument:'sine',dataset:'temperature'};
function el(id){if(!elements.has(id))elements.set(id,{value:initial[id]||'',textContent:'',innerHTML:'',hidden:false,href:'',style:{},addEventListener(){},setAttribute(k,v){this[k]=String(v)},getAttribute(k){return this[k]},setPointerCapture(){},getBoundingClientRect(){return{left:0,width:800}},showModal(){this.open=true},close(){this.open=false}});return elements.get(id)}
const file=p=>fs.readFileSync('dist/'+p,'utf8');
const context={document:{getElementById:el,querySelectorAll:()=>[]},localStorage:{getItem:k=>k==='earthtone-visited'?'yes':null,setItem(){}},fetch:async p=>({ok:true,text:async()=>file(p),json:async()=>JSON.parse(file(p))}),setTimeout,clearTimeout,console};vm.createContext(context);vm.runInContext(fs.readFileSync('dist/app.js','utf8'),context);
const run=c=>vm.runInContext(c,context);
const key=k=>el('chart').onkeydown({key:k,preventDefault(){}});
setTimeout(async()=>{
  // Temperature (the original dataset)
  assert.equal(run('rows.length'),146);assert.equal(run('rows[0].year'),1880);assert.equal(run('rows.at(-1).year'),2025);
  assert.equal(run('pitchFor(0)'),220);assert.equal(run('pitchFor(1)'),440);assert.equal(run('pitchFor(-1)'),110);
  assert(el('chart').innerHTML.includes('polyline'));
  run("$('scale').value='minor'");assert(run('rows.map(r=>pitchFor(r.value))').every(Number.isFinite));run("$('scale').value='continuous'");
  assert.equal(run('quiz.every(q=>q.options.length===4)'),true);
  // Interactive chart
  key('End');assert.equal(run('rows[index].year'),2025);assert(el('chart')['aria-valuetext'].startsWith('2025: '));
  key('PageDown');assert.equal(run('rows[index].year'),2015);key('ArrowRight');assert.equal(run('rows[index].year'),2016);
  key('Home');assert.equal(run('index'),0);el('chart').onpointerdown({clientX:775,pointerId:1});assert.equal(run('index'),145);
  // Night lights
  assert.equal(await run("selectDataset('nightlights')"),true);
  assert.equal(run('rows.length'),12);assert.equal(run('rows[0].label'),'2012');assert.equal(run('rows.at(-1).value'),1);
  assert.equal(run('pitchFor(.5)'),220);assert.equal(run('pitchFor(1)'),440);
  assert(run('data.places.length')>20);assert.equal(el('placeLabel').hidden,false);
  run("usePlace('Kyiv, Ukraine')");assert(run('rows[10].value')<run('rows[9].value')/2,'Kyiv should go dark in 2022');
  assert(el('facts').innerHTML.includes('<li>'));
  assert.equal(el('mapFig').hidden,false);assert.equal(el('mapImg').src,'data/maps/nightlights/2012.jpg');assert.equal(el('mapDot').hidden,false);assert(el('mapImg').alt.includes('Kyiv'));
  assert(Math.abs(parseFloat(el('mapDot').style.left)-(30.5+180)/360*100)<1);
  for(const y of run('rows.map(r=>r.label)'))assert(fs.existsSync(`dist/data/maps/nightlights/${y}.jpg`));
  // Listen across the map: 36 strips, west to east, India louder than the middle of the Pacific
  const sweep=run("sweepNotes(data.grids.byLabel['2023'])");assert.equal(sweep.length,36);assert(sweep.every(n=>n.value>=0&&n.value<=1));
  assert.equal(sweep[0].lon,-175);assert.equal(sweep[35].lon,175);assert(sweep[25].value>sweep[1].value,'India strip should be brighter than the Pacific');
  assert.equal(run('stripName(77)'),'India and Central Asia');assert.equal(run('areaName(25,75)'),'India');assert.equal(run('areaName(45,35)'),'eastern Europe');assert.equal(run('areaName(-45,-150)'),'the Pacific Ocean');assert.equal(run('stripName(-175)'),'the Pacific Ocean');
  // Lightning
  assert.equal(await run("selectDataset('lightning')"),true);
  assert.equal(run('rows.length'),77);assert.equal(run('rows[0].spoken'),'March 2017');
  run("usePlace('Congo rainforest')");assert(run('rows.every(r=>r.value>=0&&r.value<=1)'));
  key('End');assert(el('chart')['aria-valuetext'].startsWith('July 2023: '));
  assert.equal(el('mapImg').src,'data/maps/lightning/2023-07.jpg');assert(run("sweepNotes(data.grids.byLabel['2019-07'])").some(n=>n.value>.5));for(const m of run('rows.map(r=>r.label)'))assert(fs.existsSync(`dist/data/maps/lightning/${m}.jpg`));
  // Back to temperature
  assert.equal(await run("selectDataset('temperature')"),true);assert.equal(run('rows.length'),146);assert.equal(el('placeLabel').hidden,true);assert.equal(el('mapFig').hidden,true);
  console.log('PASS: temperature (146 years, pitch mapping, scales, chart, quiz), keyboard and pointer chart, night lights (12 years, 27 cities, Kyiv goes dark in 2022), lightning (77 months, regions), flat maps for every step, listening across the map, switching datasets.');
},50);
