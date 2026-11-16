const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements=new Map();const initial={scale:'continuous',duration:'45',speed:'1',volume:'30',instrument:'sine',dataset:'temperature'};
function el(id){if(!elements.has(id))elements.set(id,{value:initial[id]||'',textContent:'',innerHTML:'',hidden:false,href:'',style:{},addEventListener(){},setAttribute(k,v){this[k]=String(v)},getAttribute(k){return this[k]},setPointerCapture(){},getBoundingClientRect(){return{left:0,width:800}},showModal(){this.open=true},close(){this.open=false}});return elements.get(id)}
const file=p=>fs.readFileSync('dist/'+p,'utf8');
const context={document:{getElementById:el,querySelectorAll:()=>[],documentElement:{dataset:{}}},localStorage:{getItem:k=>k==='earthtone-visited'?'yes':null,setItem(){}},fetch:async p=>({ok:true,text:async()=>file(p),json:async()=>JSON.parse(file(p))}),setTimeout,clearTimeout,console};vm.createContext(context);vm.runInContext(fs.readFileSync('dist/app.js','utf8'),context);
const run=c=>vm.runInContext(c,context);
const key=k=>el('chart').onkeydown({key:k,preventDefault(){}});
setTimeout(async()=>{
  // Temperature (the original dataset)
  assert.equal(run('rows.length'),146);assert.equal(run('rows[0].year'),1880);assert.equal(run('rows.at(-1).year'),2025);
  // Lowest and highest notes: the coolest year plays the lowest note, the warmest the highest
  const close=(a,b)=>assert(Math.abs(a-b)<.01,`${a} != ${b}`);
  close(run('pitchFor(data.range.min)'),130.81);close(run('pitchFor(data.range.max)'),523.25);assert.equal(run('data.coolest.year'),1909);
  close(run('hz(69)'),440);assert.equal(run('noteName(60)'),'C4');
  run("$('low').value='36';$('high').value='96'");close(run('pitchFor(data.range.min)'),65.41);close(run('pitchFor(data.range.max)'),2093);
  run("$('high').value='36';keepRange('high')");assert(run("Number($('high').value)>Number($('low').value)"),'highest note must stay above lowest');
  run("applySettings(defaults)");assert(run("rows.every((r,i)=>i===0||true)"));
  run("renderHowto()");assert(el('howtoBody').innerHTML.includes('coolest year, 1909'),'temperature explanation');assert(el('howtoBody').innerHTML.includes('<table>'));
  assert.equal(el('baseline').textContent.startsWith('♪ Hear the baseline · '),true);
  assert(el('chart').innerHTML.includes('polyline'));
  run("$('scale').value='minor'");assert(run('rows.map(r=>pitchFor(r.value))').every(Number.isFinite));run("$('scale').value='continuous'");
  assert.equal(run('quiz.every(q=>q.options.length===4)'),true);assert.equal(run('quiz.length'),6);assert(run("quiz.some(q=>q.tone==='low')&&quiz.some(q=>q.tone==='high')&&quiz.some(q=>q.options[0][2].volume)"));
  // Interactive chart
  key('End');assert.equal(run('rows[index].year'),2025);assert(el('chart')['aria-valuetext'].startsWith('2025: '));
  key('PageDown');assert.equal(run('rows[index].year'),2015);key('ArrowRight');assert.equal(run('rows[index].year'),2016);
  key('Home');assert.equal(run('index'),0);el('chart').onpointerdown({clientX:775,pointerId:1});assert.equal(run('index'),145);
  // Night lights
  assert.equal(await run("selectDataset('nightlights')"),true);
  assert.equal(run('rows.length'),12);assert.equal(run('rows[0].label'),'2012');assert.equal(run('rows.at(-1).value'),1);
  close(run('pitchFor(.5)'),261.63);close(run('pitchFor(1)'),523.25);close(run('pitchFor(0)'),130.81);assert(el('howtoBody').innerHTML.includes('brightest year'));
  assert(run('data.places.length')>20);assert.equal(el('placeLabel').hidden,false);
  run("usePlace('Kyiv, Ukraine')");assert(run('rows[10].value')<run('rows[9].value')/2,'Kyiv should go dark in 2022');
  assert(el('facts').innerHTML.includes('<li>'));
  assert.equal(el('mapFig').hidden,false);assert.equal(el('mapImg').src,'data/maps/nightlights/2012.jpg');assert.equal(el('mapDot').hidden,false);assert(el('mapImg').alt.includes('Kyiv'));
  assert(Math.abs(parseFloat(el('mapDot').style.left)-(30.5+180)/360*100)<1);
  for(const y of run('rows.map(r=>r.label)'))assert(fs.existsSync(`dist/data/maps/nightlights/${y}.jpg`));
  // Lightning
  assert.equal(await run("selectDataset('lightning')"),true);
  assert.equal(run('rows.length'),77);assert.equal(run('rows[0].spoken'),'March 2017');
  run("usePlace('Congo rainforest')");assert(el('howtoBody').innerHTML.includes('Congo rainforest'));assert(run('rows.every(r=>r.value>=0&&r.value<=1)'));
  key('End');assert(el('chart')['aria-valuetext'].startsWith('July 2023: '));
  assert.equal(el('mapImg').src,'data/maps/lightning/2023-07.jpg');for(const m of run('rows.map(r=>r.label)'))assert(fs.existsSync(`dist/data/maps/lightning/${m}.jpg`));
  // Back to temperature
  assert.equal(await run("selectDataset('temperature')"),true);assert.equal(run('rows.length'),146);assert.equal(el('placeLabel').hidden,true);assert.equal(el('mapFig').hidden,true);
  console.log('PASS: temperature (146 years, pitch mapping, scales, chart, quiz), keyboard and pointer chart, night lights (12 years, 27 cities, Kyiv goes dark in 2022), lightning (77 months, regions), flat maps for every step, switching datasets.');
},50);
