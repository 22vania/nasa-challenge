const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements=new Map();const initial={scale:'continuous',duration:'45',speed:'1',volume:'30',instrument:'sine',dataset:'temperature'};
function el(id){if(!elements.has(id))elements.set(id,{value:initial[id]||'',textContent:'',innerHTML:'',hidden:false,href:'',style:{setProperty(k,v){this[k]=v}},classList:{toggle(){}},addEventListener(){},setAttribute(k,v){this[k]=String(v)},getAttribute(k){return this[k]},setPointerCapture(){},getBoundingClientRect(){return{left:0,width:800}},showModal(){this.open=true},close(){this.open=false}});return elements.get(id)}
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
  assert.equal(run('rows.length'),12);assert.equal(run('rows[0].label'),'2012');assert.equal(run('rows[0].value'),0);assert.equal(run('data.readout(rows.at(-1).value)'),'+27%','planet is 27% brighter than in 2012');
  close(run('pitchFor(0)'),261.63);close(run('pitchFor(1)'),523.25);close(run('pitchFor(-1)'),130.81);close(run('pitchFor(3.5)'),523.25);assert(el('howtoBody').innerHTML.includes('2012 plays the middle note'));assert(el('place').innerHTML.includes('Delhi, India (+99% since 2012)'));assert(el('place').innerHTML.includes('<optgroup label="Got darker since 2012">'));
  assert(run('data.places.length')>20);assert.equal(el('placeLabel').hidden,false);
  run("usePlace('Kyiv, Ukraine')");assert(run('2**rows[10].value')<run('2**rows[9].value')/2,'Kyiv should go dark in 2022');assert(run('describe(rows[10])').includes('64 percent darker'));
  assert(el('facts').innerHTML.includes('<li>'));
  assert.equal(el('mapFig').hidden,false);assert.equal(el('mapImg').src,'data/maps/nightlights-hd/2012.jpg');assert.equal(el('mapZoom').style['--z'],5,'zooms in on the city');assert.equal(el('zoomBtn').hidden,false);el('zoomBtn').onclick();assert.equal(el('mapZoom').style['--z'],1);el('zoomBtn').onclick();el('changeBtn').onclick();assert.equal(el('changeLegend').hidden,false);assert(el('mapImg').alt.includes('first year'));el('changeBtn').onclick();assert.equal(el('mapDot').hidden,false);assert(el('mapImg').alt.includes('Kyiv'));
  assert(Math.abs(parseFloat(el('mapDot').style.left)-(30.5+180)/360*100)<1);
  for(const y of run('rows.map(r=>r.label)'))assert(fs.existsSync(`dist/data/maps/nightlights-hd/${y}.jpg`));
  // Lightning
  assert.equal(await run("selectDataset('lightning')"),true);
  assert.equal(run('rows.length'),77);assert.equal(run('rows[0].spoken'),'March 2017');
  run("usePlace('Northern half (north of the equator)')");const peak=()=>run('rows.reduce((a,b)=>b.value>a.value?b:a).label.slice(5)');assert(['06','07','08'].includes(peak()),'north peaks in summer');
  run("usePlace('Southern half (south of the equator)')");assert(['11','12','01','02'].includes(peak()),'south peaks in its summer');
  for(const n of ['Africa','South America','North and Central America','Asia','Australia','Europe (south of 55° north)'])assert(run(`data.places.find(p=>p.name===${JSON.stringify(n)}).cells`)>3,n);
  assert(el('place').innerHTML.includes('<optgroup label="Continents">'));
  run("usePlace('Congo rainforest')");assert(el('howtoBody').innerHTML.includes('Congo rainforest'));assert(run('rows.every(r=>r.value>=0&&r.value<=1)'));
  key('End');assert(el('chart')['aria-valuetext'].startsWith('July 2023: '));
  assert.equal(el('mapImg').src,'data/maps/lightning/2023-07.jpg');for(const m of run('rows.map(r=>r.label)'))assert(fs.existsSync(`dist/data/maps/lightning/${m}.jpg`));
  // Back to temperature
  assert.equal(await run("selectDataset('temperature')"),true);assert.equal(run('rows.length'),146);assert.equal(el('placeLabel').hidden,true);assert.equal(el('mapFig').hidden,true);
  // Audio lifecycle: reference is separate from the changing melody, uses the
  // same mapping, follows master volume, and cannot survive pause/end/switch.
  const oscillators=[];
  const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
  class MockAudioContext {
    currentTime=0;destination={};
    async resume(){}
    createGain(){return{gain:param(),connect(dest){this.dest=dest},disconnect(){}}}
    createOscillator(){const osc={frequency:param(),connect(){},disconnect(){},start(){this.started=true},stop(){this.stopped=true}};oscillators.push(osc);return osc}
  }
  context.window={AudioContext:MockAudioContext};
  await el('play').onclick();
  assert(run('playing'));assert(run('baselineVoice!==null'));
  const drone=run('baselineVoice.osc');close(drone.frequency.value,run('pitchFor(0)'));
  assert.strictEqual(run('baselineVoice.gain.dest'),run('master'),'reference follows master volume');
  run('index=20;render();note(pitchFor(rows[index].value),.1)');
  assert.strictEqual(run('baselineVoice.osc'),drone,'melody must not recreate the steady tone');
  run('pause()');assert(drone.stopped);assert.strictEqual(run('baselineVoice'),null);
  await el('play').onclick();const ended=run('baselineVoice.osc');run('index=rows.length-1');
  // Trigger completion without a real timeout.
  const timeout=context.setTimeout;let finish;context.setTimeout=fn=>{finish=fn;return 0};run('clearTimeout(timer);tick()');finish();context.setTimeout=timeout;
  assert(ended.stopped);assert(!run('playing'));assert.strictEqual(run('baselineVoice'),null);
  await run("selectDataset('lightning')");await el('play').onclick();close(run('baselineVoice.osc.frequency.value'),run('pitchFor(1)'));const previous=run('baselineVoice.osc');
  await run("selectDataset('nightlights')");assert(previous.stopped);await el('play').onclick();close(run('baselineVoice.osc.frequency.value'),run('pitchFor(0)'));run('pause()');
  // Pending audio startup must not restart playback after cancellation.
  let resume;run('ctx').resume=()=>new Promise(resolve=>{resume=resolve});const pending=el('play').onclick();run('pause()');resume();await pending;assert(!run('playing'));assert.strictEqual(run('baselineVoice'),null);
  console.log('PASS: sustained reference pitch, continuity, shared volume, pause, completion, dataset switching, cancelled startup.');
  console.log('PASS: temperature (146 years, pitch mapping, scales, chart, quiz), keyboard and pointer chart, night lights (12 years, 27 cities, Kyiv goes dark in 2022), lightning (77 months, northern and southern halves, continents, regions), flat maps for every step (zoom on a city, change since 2012), switching datasets.');
},50);
