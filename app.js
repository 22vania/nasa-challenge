const $=id=>document.getElementById(id);
let rows=[],index=0,playing=false,timer=null,ctx,master,voices=new Set();
const controls=['instrument','scale','pitch','duration','speed','volume'];
const defaults={instrument:'piano',scale:'continuous',pitch:'12',duration:'45',speed:'1',volume:'30'};
function saved(){try{return JSON.parse(localStorage.getItem('earthtone-settings')||'null')}catch{return null}}
function persist(){try{localStorage.setItem('earthtone-settings',JSON.stringify(Object.fromEntries(controls.map(k=>[k,$(k).value]))))}catch{}}

// ---------- Datasets ----------
// Every dataset becomes a list of rows: {label, spoken, value}.
// `steps(value)` turns a value into "pitch steps": 0 is the 220 Hz baseline,
// and the pitch increment setting says how many semitones one step is.
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const relative={
  steps:v=>(v-.5)*2,
  axis:{min:0,max:1,step:.25,format:v=>Math.round(v*100)+'%'},
  readout:v=>Math.round(v*100)+'%',
  pitchUnit:'from the middle to the peak',
  sample:[.15,.3,.5,.65,.85,1],
};
const DATASETS={
  temperature:{
    eyebrow:'01 / GLOBAL TEMPERATURE',title:'The warming score',timeName:'YEAR',
    valueLabel:'°C ABOVE / BELOW BASELINE',
    legend:'NASA GISTEMP v4 · annual mean',baselineLegend:'Baseline: 1951–1980',
    steps:v=>v,
    axis:{min:-.5,max:1.5,step:.5,format:v=>`${v>0?'+':''}${v.toFixed(1)}°`},
    readout:v=>(v>=0?'+':'')+v.toFixed(2),
    pitchUnit:'/ °C',
    sample:[-.2,0,.3,.65,1.05,1.28],
    announceEvery:10,
    tick:(r,i,n)=>i===0||i===n-1||(r.year%20===0&&i<n-8),
    describe:r=>`${r.spoken}: ${Math.abs(r.value).toFixed(2)} degrees Celsius ${r.value>=0?'warmer':'cooler'} than the 1951 to 1980 average`,
    baselineText:'Reference tone: 220 Hz represents a 0°C anomaly, the 1951–1980 average.',
    context:'Each note is one year’s global temperature anomaly. Positive means warmer than the 1951–1980 average; negative means cooler. These are global averages, not temperatures in a particular city.',
    facts:['The notes stay low and wander until about 1980, then climb steadily.','2024 and 2025 are the two warmest years in the record, 1.2 to 1.3 °C above the 1951–1980 average.','Every year after 2014 is warmer than every year before 2014.'],
    sourceUrl:'https://data.giss.nasa.gov/gistemp/',download:'gistemp.csv',
    async load(){const res=await fetch('gistemp.csv');if(!res.ok)throw Error();const text=await res.text();
      const out=text.trim().split(/\r?\n/).filter(l=>/^\d{4},/.test(l)).map(l=>{let c=l.split(',');return{year:Number(c[0]),value:Number(c[13]),complete:c.slice(1,13).every(v=>v.trim()!==''&&Number.isFinite(Number(v)))}}).filter(r=>r.complete&&Number.isFinite(r.value));
      this.places=[{name:'Whole planet',rows:out.map(r=>({year:r.year,label:String(r.year),spoken:String(r.year),value:r.value}))}];
      this.sourceText=`NASA GISTEMP v4 · ${out[0].year}–${out.at(-1).year} · ${out.length} complete annual means. Downloaded November 14, 2026. Values relative to 1951–1980; later NASA revisions may change this snapshot.`}
  },
  nightlights:{
    ...relative,
    eyebrow:'02 / EARTH AT NIGHT',title:'The lights we make',timeName:'YEAR',
    valueLabel:'OF THE BRIGHTEST YEAR',
    legend:'NASA Black Marble · from SVS 5313',baselineLegend:'Middle note: half as bright as the brightest year',
    announceEvery:3,
    tick:(r,i,n)=>i%2===0||i===n-1,
    describe:r=>`${r.spoken}: ${Math.round(r.value*100)} percent as bright as the brightest year`,
    baselineText:'Reference tone: 220 Hz is half as bright as the brightest year. Brighter years sound higher.',
    context:'Each note is one year of light at night, from cities, roads and industry. Higher notes mean more light. Choose a city to hear its own story: every place is compared with its own brightest year.',
    map:r=>`data/maps/nightlights/${r.label}.jpg`,mapName:'The Earth at night',
    sourceUrl:'https://svs.gsfc.nasa.gov/5313/',download:'data/nightlights.json',
    async load(){const d=await fetch('data/nightlights.json').then(r=>{if(!r.ok)throw Error();return r.json()});
      const years=d.times.map(Number);
      const make=values=>values.map((v,i)=>({year:years[i],label:d.times[i],spoken:d.times[i],value:v}));
      this.grids=gridsFrom(d);
      this.places=[{name:'Whole planet',rows:make(d.summary.values)},...d.places.values.map(p=>({name:p.name,lat:p.lat,lon:p.lon,rows:make(p.light)}))];
      this.facts=d.facts;
      this.sourceText=`NASA Black Marble night lights, ${d.times[0]}–${d.times.at(-1)}, measured from the colors of NASA’s Earth Information Center movie “Change in Night Lights between 2012 and 2023” (SVS 5313). Values are relative: 100% is the brightest year for each place.`}
  },
  lightning:{
    ...relative,
    eyebrow:'03 / LIGHTNING FROM SPACE',title:'The storm rhythm',timeName:'MONTH',
    valueLabel:'OF THE STORMIEST MONTH',
    legend:'ISS Lightning Imaging Sensor · from SVS 5011',baselineLegend:'Middle note: half of the stormiest month',
    announceEvery:12,
    tick:(r,i,n)=>r.label.endsWith('-01')||i===0,
    tickLabel:r=>r.label.slice(0,4),
    describe:r=>`${r.spoken}: ${Math.round(r.value*100)} percent of the stormiest month`,
    baselineText:'Reference tone: 220 Hz is half as much lightning as the stormiest month. Stormier months sound higher.',
    context:'Each note is one month of lightning seen by the International Space Station. Higher notes mean more lightning. Listen for the seasons: storms rise every northern summer and fall every winter. Choose a region to hear its own rhythm.',
    map:r=>`data/maps/lightning/${r.label}.jpg`,mapName:'Lightning in the last month',
    sourceUrl:'https://svs.gsfc.nasa.gov/5011/',download:'data/lightning.json',
    regions:[['Congo rainforest',-2,23],['Colombia and Venezuela',6,-72],['Central United States',38,-96],['Northern India and Bangladesh',25,85],['Southeast Asia',16,103],['Taiwan',24,121],['Northern Australia',-15,132],['Southern Brazil and Argentina',-27,-55]],
    async load(){const d=await fetch('data/lightning.json').then(r=>{if(!r.ok)throw Error();return r.json()});
      const make=values=>values.map((v,i)=>{const [y,m]=d.times[i].split('-');return{year:Number(y),label:d.times[i],show:`${MONTHS[Number(m)-1].slice(0,3)} ${y}`,spoken:`${MONTHS[Number(m)-1]} ${y}`,value:v}}).filter(r=>r.value!==null);
      const regions=this.regions.map(([name,lat,lon])=>{const row=Math.floor((90-lat)/10),col=Math.floor((lon+180)/10);const series=d.values.map(g=>g?g[row][col]:null);const top=Math.max(...series.filter(v=>v!==null))||1;return{name,lat,lon,rows:make(series.map(v=>v===null?null:Math.round(v/top*1000)/1000))}});
      this.grids=gridsFrom(d);
      this.places=[{name:'Whole planet',rows:make(d.summary.values)},...regions];
      this.facts=d.facts;
      this.sourceText=`Lightning seen by the Lightning Imaging Sensor on the International Space Station, ${MONTHS[2]} 2017 to ${MONTHS[6]} 2023, measured from the yellow flashes in NASA’s Earth Information Center movie (SVS 5011). Values are relative: 100% is the stormiest month for each place. The station cannot see beyond about 55° north or south.`}
  },
};
let data=DATASETS.temperature,place=null;

function pitchFor(value,settings){let n=data.steps(value)*Number(settings?.pitch??$('pitch').value);const scales={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],pentatonic:[0,2,4,7,9]};const scale=scales[settings?.scale??$('scale').value];if(scale){let candidates=[];for(let oct=-5;oct<6;oct++)scale.forEach(s=>candidates.push(oct*12+s));n=candidates.reduce((a,b)=>Math.abs(b-n)<Math.abs(a-n)?b:a)}return 220*2**(n/12)}
function interval(){return Number($('duration').value)/rows.length/Number($('speed').value)}
async function audio(){if(!ctx){ctx=new(window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.connect(ctx.destination)}await ctx.resume();master.gain.setTargetAtTime(Number($('volume').value)/100,ctx.currentTime,.03)}
function silence(){voices.forEach(o=>{try{o.stop()}catch{}});voices.clear()}
const instruments={
 piano:{partials:[[1,1],[2,.45],[3,.2],[4,.09]],attack:.008,decay:true},
 strings:{partials:[[1,1],[2,.34],[3,.17],[4,.08]],attack:.08,decay:false},
 bell:{partials:[[1,1],[2.76,.35],[5.4,.12]],attack:.006,decay:true},
 triangle:{partials:[[1,1],[2.32,.4],[4.25,.16]],attack:.003,decay:true},
 harp:{partials:[[1,1],[2,.28],[3,.12]],attack:.012,decay:true}
};
function note(freq,seconds,type=$('instrument').value,pan=0){const now=ctx.currentTime,out=pan&&ctx.createStereoPanner?ctx.createStereoPanner():null;if(out){out.pan.value=pan;out.connect(master);setTimeout(()=>out.disconnect(),seconds*1000+200)}const dest=out||master,preset=instruments[type]||instruments.piano;const sum=preset.partials.reduce((n,p)=>n+p[1],0);for(const [multiple,amp]of preset.partials){const osc=ctx.createOscillator(),env=ctx.createGain();osc.type='sine';osc.frequency.value=freq*multiple;const peak=.4*amp/sum,attack=Math.min(preset.attack,seconds*.2);env.gain.setValueAtTime(.0001,now);env.gain.linearRampToValueAtTime(peak,now+attack);if(!preset.decay)env.gain.setValueAtTime(peak*.8,now+seconds*.65);env.gain.exponentialRampToValueAtTime(.0001,now+seconds*.95);osc.connect(env);env.connect(dest);osc.start(now);osc.stop(now+seconds);voices.add(osc);osc.onended=()=>{voices.delete(osc);osc.disconnect();env.disconnect()}}}
let previewTimers=[],previewToken=0;
function stopPreview(){previewToken++;previewTimers.forEach(clearTimeout);previewTimers=[];silence();document.querySelectorAll('[data-preview]').forEach(b=>{b.textContent='▶ Hear sample';b.setAttribute('aria-pressed','false')})}
async function previewChoice(choice,button){stopPreview();const token=previewToken;try{await audio();if(token!==previewToken)return;const settings={...Object.fromEntries(controls.map(k=>[k,$(k).value])),...answers,...choice};const gap=Math.min(1,Number(settings.duration)/(rows.length||146)/Number(settings.speed));const values=data.sample;button.textContent='■ Stop sample';button.setAttribute('aria-pressed','true');$('sampleStatus').textContent='Playing a short example. Previewing does not select an answer.';values.forEach((value,i)=>previewTimers.push(setTimeout(()=>{if(token===previewToken)note(pitchFor(value,settings),gap*.95,settings.instrument)},i*gap*1000)));previewTimers.push(setTimeout(()=>{if(token===previewToken){stopPreview();$('sampleStatus').textContent='Sample finished. Choose an answer or compare another.'}},values.length*gap*1000))}catch{$('sampleStatus').textContent='Audio could not start. You can still choose an answer.'}}
function fmt(seconds){return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`}
function esc(t){return String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function draw(){if(!rows.length)return;const svg=$('chart'),a=data.axis;const min=Math.min(a.min,...rows.map(r=>r.value)),max=Math.max(a.max,...rows.map(r=>r.value));const x=i=>45+i/Math.max(1,rows.length-1)*730,y=v=>220-(v-min)/(max-min)*195;const base=data===DATASETS.temperature?0:.5;const points=rows.map((r,i)=>`${x(i)},${y(r.value)}`).join(' ');let html='<defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ce542e" stop-opacity=".18"/><stop offset="1" stop-color="#ce542e" stop-opacity="0"/></linearGradient></defs>';for(let v=a.min;v<=max+1e-9;v+=a.step){const isBase=Math.abs(v-base)<1e-9;html+=`<line x1="45" x2="775" y1="${y(v)}" y2="${y(v)}" stroke="${isBase?'#849685':'#dce1d5'}" stroke-dasharray="${isBase?'4 4':'0'}"/><text x="0" y="${y(v)+4}" fill="#71816f" font-size="11">${a.format(v)}</text>`}html+=`<polygon points="45,220 ${points} ${x(rows.length-1)},220" fill="url(#fill)"/><polyline points="${points}" fill="none" stroke="#ce542e" stroke-width="2.5" stroke-linejoin="round"/>`;for(let i=0;i<rows.length;i++){if(data.tick(rows[i],i,rows.length))html+=`<text x="${x(i)}" y="248" text-anchor="middle" fill="#71816f" font-size="11">${esc(data.tickLabel?data.tickLabel(rows[i]):rows[i].label)}</text>`}html+=`<line x1="${x(index)}" x2="${x(index)}" y1="15" y2="225" stroke="#213e35" opacity=".35"/><circle cx="${x(index)}" cy="${y(rows[index].value)}" r="6" fill="#213e35" stroke="#fafbf5" stroke-width="3"/>`;svg.innerHTML=html}
function describe(r){return data.describe(r)}
function render(announce=false){if(!rows.length)return;let r=rows[index];$('year').textContent=r.show||r.label;$('anomaly').textContent=data.readout(r.value);$('frequency').textContent=Math.round(pitchFor(r.value));$('scrub').value=index;const spoken=describe(r);$('scrub').setAttribute('aria-valuetext',spoken);$('chart').setAttribute('aria-valuenow',index);$('chart').setAttribute('aria-valuetext',spoken);let total=Number($('duration').value)/Number($('speed').value);$('progress').textContent=`${fmt(index/rows.length*total)} / ${fmt(total)}`;if(announce)$('caption').textContent=`${spoken}. ${Math.round(pitchFor(r.value))} Hz.`;draw();drawMap(r)}
// ---------- Flat world map (NASA movie frame for the current step) ----------
function drawMap(r){$('mapFig').hidden=!data.map;if(!data.map)return;const src=data.map(r);if($('mapImg').getAttribute('src')!==src)$('mapImg').setAttribute('src',src);
  const here=place&&place.lat!==undefined;$('mapImg').setAttribute('alt',`${data.mapName}, ${r.spoken}.${here?' The ring marks '+place.name+'.':''}`);
  $('mapDot').hidden=!here;if(here){$('mapDot').style.left=`${(place.lon+180)/360*100}%`;$('mapDot').style.top=`${(90-place.lat)/180*100}%`}
  $('mapCaption').textContent=`${r.show||r.label} · ${here?place.name+' · ':''}NASA Scientific Visualization Studio`}
function preloadMaps(){if(!data.map||typeof Image==='undefined')return;const seen=new Set();for(const p of data.places)for(const r of p.rows){const src=data.map(r);if(!seen.has(src)){seen.add(src);new Image().src=src}}}
// ---------- Listen across the map ----------
// One note for each 10 degree strip of the world, from west to east. Higher = more light or lightning
// in that strip. The sound moves from the left ear (the Americas) to the right ear (Asia and Australia).
function gridsFrom(d){const grids=Object.fromEntries(d.times.map((t,i)=>[t,d.values[i]]));let top=0;
  for(const g of d.values)if(g)for(let c=0;c<36;c++)top=Math.max(top,columnTotal(g,c));return{byLabel:grids,top:top||1}}
function columnTotal(g,c){let n=0;for(const row of g)if(row[c]!==null)n+=row[c];return n}
const STRIPS=[[-180,'the Pacific Ocean'],[-130,'western North America'],[-100,'central North America and Mexico'],[-80,'eastern North America and western South America'],[-60,'eastern South America'],[-30,'the Atlantic Ocean'],[-10,'western Europe and West Africa'],[20,'eastern Europe and central Africa'],[40,'the Middle East and East Africa'],[60,'India and Central Asia'],[90,'Southeast Asia and China'],[110,'East Asia and Indonesia'],[130,'Japan and Australia'],[150,'the western Pacific Ocean']];
function stripName(lon){let name=STRIPS[0][1];for(const [start,n] of STRIPS)if(lon>=start)name=n;return name}
// Names for the end-of-sweep summary: the closest of these to the brightest square in a strip.
const AREAS=[['western Europe',48,5],['eastern Europe',50,30],['Russia',56,50],['Siberia',56,90],['the Middle East',30,45],['India',23,78],['China',32,112],['Japan and Korea',36,135],['Southeast Asia',12,103],['Indonesia',-5,110],['Australia',-28,145],['West Africa',8,3],['Central Africa',0,22],['East Africa',0,36],['southern Africa',-26,27],['Canada',57,-100],['the northern United States',46,-102],['Mongolia and northern China',46,110],['the eastern United States',38,-80],['the central United States',38,-96],['the western United States',38,-118],['Mexico and Central America',18,-95],['Colombia and Venezuela',6,-72],['Brazil',-15,-50],['southern South America',-32,-62]];
function areaName(lat,lon){let best=null,dist=Infinity;for(const [n,la,lo] of AREAS){const d=Math.hypot(la-lat,lo-lon);if(d<dist){best=n;dist=d}}return dist<=16?best:stripName(lon)}
function sweepNotes(g){const t=data.grids.top;return Array.from({length:36},(_,c)=>{const lon=-175+c*10;let peak=0,lat=0;g.forEach((row,r)=>{if(row[c]!==null&&row[c]>peak){peak=row[c];lat=85-r*10}});return{col:c,lon,lat,value:Math.sqrt(columnTotal(g,c)/t)}})}
let sweepTimers=[],sweepToken=0;
function stopSweep(){sweepToken++;sweepTimers.forEach(clearTimeout);sweepTimers=[];$('mapSweep').hidden=true;$('mapListen').textContent='🎧 Listen across the map';$('mapListen').setAttribute('aria-pressed','false')}
async function listenAcross(){if(sweepTimers.length){stopSweep();return}pause();const r=rows[index],g=data.grids&&data.grids.byLabel[r.label];if(!g)return;
  try{await audio()}catch{$('caption').textContent='Audio unavailable in this browser.';return}
  const token=sweepToken,notes=sweepNotes(g),step=.16/Number($('speed').value),words=data===DATASETS.lightning?'lightning':'light';
  $('mapListen').textContent='■ Stop';$('mapListen').setAttribute('aria-pressed','true');
  $('caption').textContent=`Listening across the map for ${r.spoken}, from west in your left ear to east in your right ear. Higher notes mean more ${words}. Silence means almost none.`;
  notes.forEach((n,i)=>sweepTimers.push(setTimeout(()=>{if(token!==sweepToken)return;$('mapSweep').hidden=false;$('mapSweep').style.left=`${n.col/36*100}%`;
    if(n.value>=.08)note(pitchFor(n.value),step*1.6,undefined,n.lon/180)},i*step*1000)));
  sweepTimers.push(setTimeout(()=>{if(token!==sweepToken)return;const loud=[];for(const n of [...notes].sort((a,b)=>b.value-a.value)){const name=areaName(n.lat,n.lon);if(n.value>=.08&&!loud.includes(name))loud.push(name);if(loud.length===3)break}
    stopSweep();$('caption').textContent=loud.length?`${r.spoken}: the most ${words} is in ${loud.join(', then ')}.`:`${r.spoken}: almost no ${words}.`},notes.length*step*1000+300))}
$('mapListen').onclick=listenAcross;
// Clicking the map picks the closest place (the Where menu does the same for keyboards).
$('mapImg').onclick=e=>{if(!data.map)return;const b=$('mapImg').getBoundingClientRect();const lon=(e.clientX-b.left)/b.width*360-180,lat=90-(e.clientY-b.top)/b.height*180;
  let best=null,dist=Infinity;for(const p of data.places){if(p.lat===undefined)continue;const d=Math.hypot(p.lat-lat,((p.lon-lon+540)%360)-180);if(d<dist){best=p;dist=d}}
  const pick=best&&dist<12?best.name:'Whole planet';$('place').value=pick;usePlace(pick);const r=rows[index];$('caption').textContent=`${pick}. ${describe(r)}.`}
function pause(){playing=false;clearTimeout(timer);stopPreview();stopSweep();$('play').textContent='▶ Listen to Earth';$('status').textContent='Ready to listen'}
function tick(){if(!playing)return;render(index%data.announceEvery===0);note(pitchFor(rows[index].value),interval());timer=setTimeout(()=>{if(index>=rows.length-1){pause();render(true);$('status').textContent='Journey complete';return}index++;tick()},interval()*1000)}
$('play').onclick=async()=>{if(playing){pause();return}try{await audio();if(index===rows.length-1)index=0;playing=true;$('play').textContent='Ⅱ Pause';$('status').textContent='● Playing live';tick()}catch{$('caption').textContent='Audio is unavailable in this browser. You can still explore every measurement with the timeline.'}};
$('reset').onclick=()=>{pause();index=0;render(true)};$('scrub').oninput=()=>{pause();index=Number($('scrub').value);render(true)};
$('baseline').onclick=async()=>{pause();try{await audio();note(220,.7);$('caption').textContent=data.baselineText}catch{$('caption').textContent='Audio unavailable in this browser.'}};
function labels(){$('speedOut').textContent=$('speed').value+'×';$('volumeOut').textContent=$('volume').value+'%'}
controls.forEach(k=>{$(k).oninput=()=>{labels();persist();if(k==='volume'&&master)master.gain.setTargetAtTime(Number($('volume').value)/100,ctx.currentTime,.03);else if(playing)pause();render(true)}});
function applySettings(s){s={...s,instrument:({sine:'piano',pluck:'harp'}[s.instrument]||s.instrument||'piano')};controls.forEach(k=>{if(s[k]!==undefined)$(k).value=s[k]});labels();persist();render(true)}
applySettings(saved()||defaults);
const modal=$('modal');function show(html){pause();$('modalContent').innerHTML=html;if(!modal.open)modal.showModal()}
$('closeModal').onclick=()=>modal.close();
const tour=[['Welcome to Earthtone','Listen to real NASA measurements: global temperature, Earth’s lights at night, and lightning seen from space. Higher notes mean more: warmer, brighter, or stormier. Press play to start sound; nothing plays automatically.'],['Choose what to hear','Use “What do you want to hear?” to pick a dataset. For night lights and lightning, “Where” lets you hear one city or region instead of the whole planet.'],['Follow the score','The chart, the numbers and the sound move together. Click the chart, or focus it and use the arrow keys, to hear any year or month. Use rewind to start again.'],['Make the sound your own','Choose an instrument, musical scale, pitch increment, speed, duration, and loudness. The exact measurements remain unchanged. Major and minor modes round notes to a musical scale.'],['Explore with confidence','Use the 220 Hz baseline tone as a reference. Read “What to listen for” and download the data below the player. Take the four-question listening quiz any time. All controls work with a keyboard.']];let tourIndex=0;
function showTour(){const last=tour.length-1;show(`<span class="eyebrow">QUICK TOUR · ${tourIndex+1} / ${tour.length}</span><h2>${tour[tourIndex][0]}</h2><p>${tour[tourIndex][1]}</p><div class="steps"><button id="skip">Skip tour</button><button class="primary" id="next">${tourIndex===last?'Start exploring':'Next →'}</button></div>`);$('skip').onclick=()=>modal.close();$('next').onclick=()=>{if(tourIndex===last)modal.close();else{tourIndex++;showTour()}}}
$('tourBtn').onclick=()=>{tourIndex=0;showTour()};modal.addEventListener('close',()=>{stopPreview();try{localStorage.setItem('earthtone-visited','yes')}catch{}});
const quiz=[{q:'Which sound feels most like you?',options:[['Piano','Clear & warm',{instrument:'piano'}],['Strings','Smooth & sustained',{instrument:'strings'}],['Bells','Bright & sparkling',{instrument:'bell'}],['Harp','Gentle & plucked',{instrument:'harp'}]]},{q:'What mood should your melody have?',options:[['Curious','Exact, continuous pitch',{scale:'continuous'}],['Hopeful','A major scale',{scale:'major'}],['Reflective','A minor scale',{scale:'minor'}],['Open & spacious','A pentatonic scale',{scale:'pentatonic'}]]},{q:'How much time do you have?',options:[['A quick glimpse','30-second journey',{duration:'30',speed:'1'}],['A little escape','45-second journey',{duration:'45',speed:'1'}],['Room to explore','60-second journey',{duration:'60',speed:'1'}],['Time to reflect','90-second journey',{duration:'90',speed:'1'}]]},{q:'How strongly should the pitch change?',options:[['Subtle','6 semitones per step',{pitch:'6'}],['Balanced','12 semitones per step',{pitch:'12'}],['Expressive','18 semitones per step',{pitch:'18'}],['Dramatic','24 semitones per step',{pitch:'24'}]]}];let qi=0,answers={};function showQuiz(){const q=quiz[qi];show(`<span class="eyebrow">FIND YOUR SOUND · ${qi+1} / 4</span><h2>${q.q}</h2><p>Listen before you choose. Samples are synthesized instrument previews, not recordings.</p><p id="sampleStatus" aria-live="polite">${qi===2?'Short excerpts demonstrate the pacing of each duration.':'Each sample uses the same illustrative rising values for a fair comparison.'}</p><div class="choices">${q.options.map((o,i)=>`<div class="choiceCard"><button data-choice="${i}" aria-label="Choose ${o[0]}">${o[0]}<small>${o[1]}</small></button><button class="sampleBtn" data-preview="${i}" aria-label="Preview ${o[0]}" aria-pressed="false">▶ Hear sample</button></div>`).join('')}</div>`);document.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>{if(b.getAttribute('aria-pressed')==='true'){stopPreview();$('sampleStatus').textContent='Sample stopped.'}else previewChoice(q.options[Number(b.dataset.preview)][2],b)});document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{Object.assign(answers,q.options[Number(b.dataset.choice)][2]);qi++;if(qi<4)showQuiz();else{applySettings(answers);show('<span class="eyebrow">YOUR EARTH, YOUR SOUND</span><h2>Your listening style is ready.</h2><p>Your choices are applied to the studio. Adjust speed and loudness there whenever you like. Your preferences stay in this browser.</p><button class="primary" id="finishQuiz">Explore my jukebox →</button>');$('finishQuiz').onclick=()=>modal.close()}})}$('quizBtn').onclick=()=>{qi=0;answers={};showQuiz()};
$('tableBtn').onclick=()=>{const place=$('place').value||'Whole planet';show(`<span class="eyebrow">${esc(data.eyebrow.replace(/^\d+ \/ /,''))} · ${esc(place.toUpperCase())}</span><h2>The measurements</h2><p>${esc(data.sourceText||'')}</p><table><thead><tr><th>${data.timeName==='MONTH'?'Month':'Year'}</th><th>${esc(data.valueLabel.toLowerCase().replace(/^./,c=>c.toUpperCase()))}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.spoken)}</td><td>${esc(data.readout(r.value))}</td></tr>`).join('')}</tbody></table>`)};
$('clearPrefs').onclick=()=>{pause();applySettings(defaults);$('caption').textContent='Default listening settings restored.'};

// Interactive chart: click, drag or use the keyboard to hear any year or month.
async function hearYear(i){index=Math.max(0,Math.min(rows.length-1,i));render(false);try{await audio();silence();note(pitchFor(rows[index].value),.45)}catch{}}
function yearAt(clientX){const box=$('chart').getBoundingClientRect();const x=(clientX-box.left)/box.width*800;return Math.round((x-45)/730*(rows.length-1))}
let dragging=false;
$('chart').onpointerdown=e=>{if(!rows.length)return;pause();dragging=true;try{$('chart').setPointerCapture(e.pointerId)}catch{}hearYear(yearAt(e.clientX))};
$('chart').onpointermove=e=>{if(!dragging)return;const i=Math.max(0,Math.min(rows.length-1,yearAt(e.clientX)));if(i!==index)hearYear(i)};
$('chart').onpointerup=$('chart').onpointercancel=()=>{dragging=false};
$('chart').onkeydown=e=>{if(!rows.length)return;const step={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1,PageUp:10,PageDown:-10}[e.key];let target=null;if(step!==undefined)target=index+step;else if(e.key==='Home')target=0;else if(e.key==='End')target=rows.length-1;else if(e.key==='Enter'||e.key===' ')target=index;else return;e.preventDefault();pause();hearYear(target)};

// ---------- Switching datasets and places ----------
function usePlace(name){place=data.places.find(p=>p.name===name)||data.places[0];rows=place.rows;index=Math.min(index,rows.length-1);if(index<0)index=0;
  $('scrub').max=rows.length-1;$('chart').setAttribute('aria-valuemin',0);$('chart').setAttribute('aria-valuemax',rows.length-1);
  $('legendSeries').innerHTML=`<i></i> ${esc(data.legend)}${place.name==='Whole planet'?'':' · '+esc(place.name)}`;
  render(false)}
function showDataset(){
  $('dataEyebrow').textContent=data.eyebrow;$('dataTitle').textContent=data.title;$('timeLabel').textContent=data.timeName;$('valueLabel').textContent=data.valueLabel;
  $('legendBaseline').textContent=data.baselineLegend;$('contextText').textContent=data.context;
  $('facts').innerHTML=(data.facts||[]).map(f=>`<li>${esc(f)}</li>`).join('');
  $('sourceDetail').textContent=data.sourceText;$('sourceLink').href=data.sourceUrl;$('downloadLink').href=data.download;
  document.querySelectorAll('#pitch option').forEach(o=>{o.textContent=`${o.value} semitones ${data.pitchUnit}`});
  const many=data.places.length>1;$('placeLabel').hidden=!many;
  $('place').innerHTML=data.places.map(p=>`<option>${esc(p.name)}</option>`).join('')}
async function selectDataset(key,announce=true){pause();
  const next=DATASETS[key]||DATASETS.temperature;$('status').textContent='Loading NASA data…';$('play').disabled=true;
  try{if(!next.places)await next.load()}catch{$('status').textContent='Data unavailable';$('caption').textContent='Could not load this dataset. Reload to try again. No synthetic data is substituted.';return false}
  data=next;index=0;showDataset();usePlace('Whole planet');preloadMaps();$('play').disabled=false;$('status').textContent='Ready to listen';
  try{localStorage.setItem('earthtone-dataset',key)}catch{}
  if(announce){const first=rows[0],last=rows.at(-1);$('caption').textContent=`${data.title}. ${rows.length} ${data.timeName==='MONTH'?'months':'years'}, from ${first.spoken} to ${last.spoken}. Higher notes mean ${data===DATASETS.temperature?'warmer':data===DATASETS.lightning?'more lightning':'more light'}.`}
  return true}
$('dataset').onchange=()=>selectDataset($('dataset').value);
$('place').onchange=()=>{pause();index=0;usePlace($('place').value);const r=rows[0],l=rows.at(-1);$('caption').textContent=`${$('place').value}: ${describe(r)}. ${describe(l)}.`};

async function load(){let key='temperature';try{key=localStorage.getItem('earthtone-dataset')||'temperature'}catch{}if(!DATASETS[key])key='temperature';$('dataset').value=key;
  const ok=await selectDataset(key,false);if(!ok)return;
  try{if(!localStorage.getItem('earthtone-visited'))showTour()}catch{showTour()}}
load();
