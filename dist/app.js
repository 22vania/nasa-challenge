const $=id=>document.getElementById(id);
let rows=[],index=0,playing=false,timer=null,ctx,master,voices=new Set();
const controls=['instrument','scale','low','high','duration','speed','volume'];
const defaults={instrument:'piano',scale:'continuous',low:'48',high:'72',duration:'45',speed:'1',volume:'30'};
function saved(){try{return JSON.parse(localStorage.getItem('earthtone-settings')||'null')}catch{return null}}
function persist(){try{localStorage.setItem('earthtone-settings',JSON.stringify(Object.fromEntries(controls.map(k=>[k,$(k).value]))))}catch{}}

// ---------- Datasets ----------
// Every dataset becomes a list of rows: {label, spoken, value}.
// `range` says which value plays the lowest note (min) and which plays the highest note (max).
// `baseline` is the reference value (0 °C, or half of the peak) played by "Hear the baseline".
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const relative={
  range:{min:0,max:1},baseline:.5,
  axis:{min:0,max:1,step:.25,format:v=>Math.round(v*100)+'%'},
  readout:v=>Math.round(v*100)+'%',
  sample:[.15,.3,.5,.65,.85,1],
};
const DATASETS={
  temperature:{
    eyebrow:'01 / GLOBAL TEMPERATURE',title:'The warming score',timeName:'YEAR',
    valueLabel:'°C ABOVE / BELOW BASELINE',
    legend:'NASA GISTEMP v4 · annual mean',baselineLegend:'Baseline: 1951–1980',
    baseline:0,
    axis:{min:-.5,max:1.5,step:.5,format:v=>`${v>0?'+':''}${v.toFixed(1)}°`},
    readout:v=>(v>=0?'+':'')+v.toFixed(2),
    sample:[-.2,0,.3,.65,1.05,1.28],
    announceEvery:10,
    tick:(r,i,n)=>i===0||i===n-1||(r.year%20===0&&i<n-8),
    describe:r=>`${r.spoken}: ${Math.abs(r.value).toFixed(2)} degrees Celsius ${r.value>=0?'warmer':'cooler'} than the 1951 to 1980 average`,
    baselineText:'Reference tone: the note for a 0 °C anomaly, the 1951–1980 average.',
    context:'Each note is one year’s global temperature anomaly. Positive means warmer than the 1951–1980 average; negative means cooler. These are global averages, not temperatures in a particular city.',
    facts:['The notes stay low and wander until about 1980, then climb steadily.','2024 and 2025 are the two warmest years in the record, 1.2 to 1.3 °C above the 1951–1980 average.','Every year after 2014 is warmer than every year before 2014.'],
    sourceUrl:'https://data.giss.nasa.gov/gistemp/',download:'gistemp.csv',
    async load(){const res=await fetch('gistemp.csv');if(!res.ok)throw Error();const text=await res.text();
      const out=text.trim().split(/\r?\n/).filter(l=>/^\d{4},/.test(l)).map(l=>{let c=l.split(',');return{year:Number(c[0]),value:Number(c[13]),complete:c.slice(1,13).every(v=>v.trim()!==''&&Number.isFinite(Number(v)))}}).filter(r=>r.complete&&Number.isFinite(r.value));
      this.places=[{name:'Whole planet',rows:out.map(r=>({year:r.year,label:String(r.year),spoken:String(r.year),value:r.value}))}];
      // The coolest year plays the lowest note and the warmest year plays the highest note.
      const by=[...this.places[0].rows].sort((a,b)=>a.value-b.value);this.coolest=by[0];this.warmest=by.at(-1);
      this.range={min:this.coolest.value,max:this.warmest.value};
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
    baselineText:'Reference tone: the note for half as bright as the brightest year. Brighter years sound higher.',
    context:'Each note is one year of light at night, from cities, roads and industry. Higher notes mean more light. Choose a city to hear its own story: every place is compared with its own brightest year.',
    map:r=>`data/maps/nightlights/${r.label}.jpg`,mapName:'The Earth at night',
    sourceUrl:'https://svs.gsfc.nasa.gov/5313/',download:'data/nightlights.json',
    async load(){const d=await fetch('data/nightlights.json').then(r=>{if(!r.ok)throw Error();return r.json()});
      const years=d.times.map(Number);
      const make=values=>values.map((v,i)=>({year:years[i],label:d.times[i],spoken:d.times[i],value:v}));
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
    baselineText:'Reference tone: the note for half as much lightning as the stormiest month. Stormier months sound higher.',
    context:'Each note is one month of lightning seen by the International Space Station. Higher notes mean more lightning. Listen for the seasons: storms rise every northern summer and fall every winter. Choose a region to hear its own rhythm.',
    map:r=>`data/maps/lightning/${r.label}.jpg`,mapName:'Lightning in the last month',
    sourceUrl:'https://svs.gsfc.nasa.gov/5011/',download:'data/lightning.json',
    regions:[['Congo rainforest',-2,23],['Colombia and Venezuela',6,-72],['Central United States',38,-96],['Northern India and Bangladesh',25,85],['Southeast Asia',16,103],['Taiwan',24,121],['Northern Australia',-15,132],['Southern Brazil and Argentina',-27,-55]],
    async load(){const d=await fetch('data/lightning.json').then(r=>{if(!r.ok)throw Error();return r.json()});
      const make=values=>values.map((v,i)=>{const [y,m]=d.times[i].split('-');return{year:Number(y),label:d.times[i],show:`${MONTHS[Number(m)-1].slice(0,3)} ${y}`,spoken:`${MONTHS[Number(m)-1]} ${y}`,value:v}}).filter(r=>r.value!==null);
      const regions=this.regions.map(([name,lat,lon])=>{const row=Math.floor((90-lat)/10),col=Math.floor((lon+180)/10);const series=d.values.map(g=>g?g[row][col]:null);const top=Math.max(...series.filter(v=>v!==null))||1;return{name,lat,lon,rows:make(series.map(v=>v===null?null:Math.round(v/top*1000)/1000))}});
      this.places=[{name:'Whole planet',rows:make(d.summary.values)},...regions];
      this.facts=d.facts;
      this.sourceText=`Lightning seen by the Lightning Imaging Sensor on the International Space Station, ${MONTHS[2]} 2017 to ${MONTHS[6]} 2023, measured from the yellow flashes in NASA’s Earth Information Center movie (SVS 5011). Values are relative: 100% is the stormiest month for each place. The station cannot see beyond about 55° north or south.`}
  },
};
let data=DATASETS.temperature,place=null;

// ---------- From a value to a note ----------
// Notes are MIDI numbers: 60 is middle C (262 Hz), 69 is A4 (440 Hz), 12 numbers = one octave.
// The dataset's smallest value plays the lowest note, its biggest value plays the highest note,
// and every value in between gets an evenly spaced number of semitones.
const NOTE_NAMES=['C','C sharp','D','D sharp','E','F','F sharp','G','G sharp','A','A sharp','B'];
const SCALES={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],pentatonic:[0,2,4,7,9]};
const NOTE_CHOICES=[];for(let m=36;m<=96;m++)if(SCALES.major.includes(m%12))NOTE_CHOICES.push(m);
const hz=m=>440*2**((m-69)/12);
const noteName=m=>{const n=NOTE_NAMES[((Math.round(m)%12)+12)%12];return n+(n.length>1?' ':'')+(Math.floor(Math.round(m)/12)-1)};
const noteLabel=m=>`${noteName(m)} · ${Math.round(hz(m))} Hz${m===60?' · middle C':''}`;
function setting(k,settings){return settings?.[k]??$(k).value}
function midiFor(value,settings){const lo=Number(setting('low',settings)),hi=Number(setting('high',settings)),r=data.range;
  const t=Math.max(0,Math.min(1,(value-r.min)/((r.max-r.min)||1)));let m=lo+t*(hi-lo);
  const scale=SCALES[setting('scale',settings)];
  if(scale){let best=lo,gap=Infinity;for(let k=lo;k<=hi;k++)if(scale.includes((k-lo)%12)&&Math.abs(k-m)<gap){best=k;gap=Math.abs(k-m)}m=best}
  return m}
function pitchFor(value,settings){return hz(midiFor(value,settings))}
function interval(){return Number($('duration').value)/rows.length/Number($('speed').value)}
async function audio(volume=$('volume').value){if(!ctx){ctx=new(window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.connect(ctx.destination)}await ctx.resume();master.gain.setTargetAtTime(Number(volume)/100,ctx.currentTime,.03)}
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
// A preview plays with the answers chosen so far plus this option. For the lowest and highest
// note questions it first plays that note alone, then a short rising melody across the range.
async function previewChoice(choice,button,tone){stopPreview();const token=previewToken;const settings={...Object.fromEntries(controls.map(k=>[k,$(k).value])),...answers,...choice};
  if(Number(settings.high)<=Number(settings.low))settings[tone==='low'?'high':'low']=String(tone==='low'?Math.min(96,Number(settings.low)+12):Math.max(36,Number(settings.high)-12));
  try{await audio(settings.volume);if(token!==previewToken)return;const gap=Math.min(1,Number(settings.duration)/(rows.length||146)/Number(settings.speed));
    const lead=tone?1.4:0;if(tone)note(hz(Number(settings[tone])),1.2,settings.instrument);
    button.textContent='■ Stop sample';button.setAttribute('aria-pressed','true');
    $('sampleStatus').textContent=tone?`Playing ${noteLabel(Number(settings[tone]))} alone, then a short melody from your lowest to your highest note. Previewing does not select an answer.`:'Playing a short example. Previewing does not select an answer.';
    data.sample.forEach((value,i)=>previewTimers.push(setTimeout(()=>{if(token===previewToken)note(pitchFor(value,settings),gap*.95,settings.instrument)},(lead+i*gap)*1000)));
    previewTimers.push(setTimeout(()=>{if(token===previewToken){stopPreview();$('sampleStatus').textContent='Sample finished. Choose an answer or compare another.'}},(lead+data.sample.length*gap)*1000))}
  catch{$('sampleStatus').textContent='Audio could not start. You can still choose an answer.'}}
function fmt(seconds){return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`}
function esc(t){return String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function draw(){if(!rows.length)return;const svg=$('chart'),a=data.axis;const min=Math.min(a.min,...rows.map(r=>r.value)),max=Math.max(a.max,...rows.map(r=>r.value));const x=i=>45+i/Math.max(1,rows.length-1)*730,y=v=>220-(v-min)/(max-min)*195;const base=data.baseline;const points=rows.map((r,i)=>`${x(i)},${y(r.value)}`).join(' ');let html='<defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ce542e" stop-opacity=".18"/><stop offset="1" stop-color="#ce542e" stop-opacity="0"/></linearGradient></defs>';for(let v=a.min;v<=max+1e-9;v+=a.step){const isBase=Math.abs(v-base)<1e-9;html+=`<line x1="45" x2="775" y1="${y(v)}" y2="${y(v)}" stroke="${isBase?'#849685':'#dce1d5'}" stroke-dasharray="${isBase?'4 4':'0'}"/><text x="0" y="${y(v)+4}" fill="#71816f" font-size="11">${a.format(v)}</text>`}html+=`<polygon points="45,220 ${points} ${x(rows.length-1)},220" fill="url(#fill)"/><polyline points="${points}" fill="none" stroke="#ce542e" stroke-width="2.5" stroke-linejoin="round"/>`;for(let i=0;i<rows.length;i++){if(data.tick(rows[i],i,rows.length))html+=`<text x="${x(i)}" y="248" text-anchor="middle" fill="#71816f" font-size="11">${esc(data.tickLabel?data.tickLabel(rows[i]):rows[i].label)}</text>`}html+=`<line x1="${x(index)}" x2="${x(index)}" y1="15" y2="225" stroke="#213e35" opacity=".35"/><circle cx="${x(index)}" cy="${y(rows[index].value)}" r="6" fill="#213e35" stroke="#fafbf5" stroke-width="3"/>`;svg.innerHTML=html}
function describe(r){return data.describe(r)}
function render(announce=false){if(!rows.length)return;let r=rows[index];$('year').textContent=r.show||r.label;$('anomaly').textContent=data.readout(r.value);$('frequency').textContent=Math.round(pitchFor(r.value));$('scrub').value=index;const spoken=describe(r);$('scrub').setAttribute('aria-valuetext',spoken);$('chart').setAttribute('aria-valuenow',index);$('chart').setAttribute('aria-valuetext',spoken);let total=Number($('duration').value)/Number($('speed').value);$('progress').textContent=`${fmt(index/rows.length*total)} / ${fmt(total)}`;if(announce)$('caption').textContent=`${spoken}. ${Math.round(pitchFor(r.value))} Hz.`;draw();drawMap(r)}
// ---------- Flat world map (NASA movie frame for the current step) ----------
function drawMap(r){$('mapFig').hidden=!data.map;if(!data.map)return;const src=data.map(r);if($('mapImg').getAttribute('src')!==src)$('mapImg').setAttribute('src',src);
  const here=place&&place.lat!==undefined;$('mapImg').setAttribute('alt',`${data.mapName}, ${r.spoken}.${here?' The ring marks '+place.name+'.':''}`);
  $('mapDot').hidden=!here;if(here){$('mapDot').style.left=`${(place.lon+180)/360*100}%`;$('mapDot').style.top=`${(90-place.lat)/180*100}%`}
  $('mapCaption').textContent=`${r.show||r.label} · ${here?place.name+' · ':''}NASA Scientific Visualization Studio`}
function preloadMaps(){if(!data.map||typeof Image==='undefined')return;const seen=new Set();for(const p of data.places)for(const r of p.rows){const src=data.map(r);if(!seen.has(src)){seen.add(src);new Image().src=src}}}
// Clicking the map picks the closest place (the Where menu does the same for keyboards).
$('mapImg').onclick=e=>{if(!data.map)return;const b=$('mapImg').getBoundingClientRect();const lon=(e.clientX-b.left)/b.width*360-180,lat=90-(e.clientY-b.top)/b.height*180;
  let best=null,dist=Infinity;for(const p of data.places){if(p.lat===undefined)continue;const d=Math.hypot(p.lat-lat,((p.lon-lon+540)%360)-180);if(d<dist){best=p;dist=d}}
  const pick=best&&dist<12?best.name:'Whole planet';$('place').value=pick;usePlace(pick);const r=rows[index];$('caption').textContent=`${pick}. ${describe(r)}.`}
function pause(){playing=false;clearTimeout(timer);stopPreview();$('play').textContent='▶ Listen to Earth';$('status').textContent='Ready to listen'}
function tick(){if(!playing)return;render(index%data.announceEvery===0);note(pitchFor(rows[index].value),interval());timer=setTimeout(()=>{if(index>=rows.length-1){pause();render(true);$('status').textContent='Journey complete';return}index++;tick()},interval()*1000)}
$('play').onclick=async()=>{if(playing){pause();return}try{await audio();if(index===rows.length-1)index=0;playing=true;$('play').textContent='Ⅱ Pause';$('status').textContent='● Playing live';tick()}catch{$('caption').textContent='Audio is unavailable in this browser. You can still explore every measurement with the timeline.'}};
$('reset').onclick=()=>{pause();index=0;render(true)};$('scrub').oninput=()=>{pause();index=Number($('scrub').value);render(true)};
$('baseline').onclick=async()=>{pause();try{await audio();note(pitchFor(data.baseline),.7);$('caption').textContent=`${data.baselineText} With your settings it is ${Math.round(pitchFor(data.baseline))} Hz.`}catch{$('caption').textContent='Audio unavailable in this browser.'}};
$('hearRange').onclick=async()=>{pause();try{await audio();const lo=Number($('low').value),hi=Number($('high').value);note(hz(lo),.8);setTimeout(()=>note(hz(hi),.8),900);$('caption').textContent=`Lowest note ${noteLabel(lo)}, then highest note ${noteLabel(hi)}.`}catch{$('caption').textContent='Audio unavailable in this browser.'}};
function baselineButton(){if(data.range)$('baseline').textContent=`♪ Hear the baseline · ${Math.round(pitchFor(data.baseline))} Hz`}
function labels(){$('speedOut').textContent=$('speed').value+'×';$('volumeOut').textContent=$('volume').value+'%'}
// The highest note must stay above the lowest note: if a change crosses them, move the other one an octave away.
function keepRange(changed){const lo=Number($('low').value),hi=Number($('high').value);if(hi>lo)return '';
  const pick=target=>NOTE_CHOICES.reduce((a,b)=>Math.abs(b-target)<Math.abs(a-target)?b:a);
  // At the very bottom or top of the list there is no room, so the note you changed moves instead.
  if(changed==='high'&&hi>36){const m=pick(Math.max(36,hi-12));$('low').value=m;return ` The lowest note moved to ${noteLabel(m)} to stay below it.`}
  if(changed!=='high'&&lo<96){const m=pick(Math.min(96,lo+12));$('high').value=m;return ` The highest note moved to ${noteLabel(m)} to stay above it.`}
  if(changed==='high'){const m=pick(lo+12);$('high').value=m;return ` The highest note must be above the lowest note, so it is ${noteLabel(m)}.`}
  const m=pick(hi-12);$('low').value=m;return ` The lowest note must be below the highest note, so it is ${noteLabel(m)}.`}
['low','high'].forEach(k=>{$(k).innerHTML=NOTE_CHOICES.map(m=>`<option value="${m}">${noteLabel(m)}</option>`).join('')});
controls.forEach(k=>{$(k).oninput=()=>{const moved=keepRange(k);labels();persist();if(k==='volume'&&master)master.gain.setTargetAtTime(Number($('volume').value)/100,ctx.currentTime,.03);else if(playing)pause();render(true);renderHowto();if(moved)$('caption').textContent+=moved}});
function applySettings(s){s={...s,instrument:({sine:'piano',pluck:'harp'}[s.instrument]||s.instrument||'piano')};controls.forEach(k=>{if(s[k]!==undefined)$(k).value=s[k]});keepRange('low');labels();persist();render(true);renderHowto()}
applySettings({...defaults,...(saved()||{})});
// ---------- Text size ----------
// One switch scales the whole page (all sizes in style.css are rem). Saved in this browser.
function setTextSize(size){if(!['normal','large','xlarge'].includes(size))size='normal';document.documentElement.dataset.text=size;
  document.querySelectorAll('.textsize button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.text===size)));try{localStorage.setItem('earthtone-text',size)}catch{}}
document.querySelectorAll('.textsize button').forEach(b=>b.onclick=()=>setTextSize(b.dataset.text));
try{setTextSize(localStorage.getItem('earthtone-text')||'normal')}catch{setTextSize('normal')}
const modal=$('modal');function show(html){pause();$('modalContent').innerHTML=html;if(!modal.open)modal.showModal()}
$('closeModal').onclick=()=>modal.close();
const tour=[['Welcome to Earthtone','Listen to real NASA measurements: global temperature, Earth’s lights at night, and lightning seen from space. Higher notes mean more: warmer, brighter, or stormier. Press play to start sound; nothing plays automatically.'],['Choose what to hear','Use “What do you want to hear?” to pick a dataset. For night lights and lightning, “Where” lets you hear one city or region instead of the whole planet.'],['Follow the score','The chart, the numbers and the sound move together. Click the chart, or focus it and use the arrow keys, to hear any year or month. Use rewind to start again.'],['Make the sound your own','Choose an instrument, a musical scale, your lowest and highest notes, speed, duration and loudness. The exact measurements stay the same. “How the sound is made” explains the rule for each dataset. Use Text size at the top to make everything bigger.'],['Find your sound','Six short questions set your instrument, your lowest and highest notes, your loudness, the mood and the length. Every answer has a sample you can hear first. You can change all of it later in the studio.']];let tourIndex=0;
function showTour(){const last=tour.length-1;show(`<span class="eyebrow">QUICK TOUR · ${tourIndex+1} / ${tour.length}</span><h2>${tour[tourIndex][0]}</h2><p>${tour[tourIndex][1]}</p><div class="steps"><button id="skip">${tourIndex===last?'Not now':'Skip tour'}</button><button class="primary" id="next">${tourIndex===last?'Find my sound →':'Next →'}</button></div>`);$('skip').onclick=()=>modal.close();$('next').onclick=()=>{if(tourIndex===last)startQuiz();else{tourIndex++;showTour()}}}
$('tourBtn').onclick=()=>{tourIndex=0;showTour()};modal.addEventListener('close',()=>{stopPreview();try{localStorage.setItem('earthtone-visited','yes')}catch{}});
// ---------- Find your sound (onboarding quiz) ----------
// Each question: q, hint, tone ('low' or 'high' plays that note alone in the sample), options [name, detail, settings].
const quiz=[
 {q:'Which sound feels most like you?',hint:'Each sample uses the same rising values, so you can compare fairly.',options:[['Piano','Clear & warm',{instrument:'piano'}],['Strings','Smooth & sustained',{instrument:'strings'}],['Bells','Bright & sparkling',{instrument:'bell'}],['Harp','Gentle & plucked',{instrument:'harp'}]]},
 {q:'How low should your lowest note be?',tone:'low',hint:'The smallest value in the data will play this note. Each sample plays the note, then a short melody.',options:[['Very low','C2 · 65 Hz · deep, like a bass',{low:'36'}],['Low','C3 · 131 Hz · the lower part of a piano',{low:'48'}],['Middle-low','G3 · 196 Hz · just below middle C',{low:'55'}],['Middle','C4 · 262 Hz · middle C',{low:'60'}]]},
 {q:'How high should your highest note be?',tone:'high',hint:'The biggest value in the data will play this note. A wider range makes small changes easier to hear.',options:[['Not too high','C5 · 523 Hz',{high:'72'}],['High','G5 · 784 Hz',{high:'79'}],['Very high','C6 · 1047 Hz',{high:'84'}],['Sparkling','C7 · 2093 Hz',{high:'96'}]]},
 {q:'How loud should it be?',hint:'Set your device volume to a comfortable level first. Each sample plays at that loudness.',options:[['Quiet','15% loudness',{volume:'15'}],['Medium','30% loudness',{volume:'30'}],['Loud','50% loudness',{volume:'50'}],['Very loud','70% loudness',{volume:'70'}]]},
 {q:'What mood should your melody have?',hint:'A scale rounds each note to a musical key that starts on your lowest note.',options:[['Curious','Exact, continuous pitch',{scale:'continuous'}],['Hopeful','A major scale',{scale:'major'}],['Reflective','A minor scale',{scale:'minor'}],['Open & spacious','A pentatonic scale',{scale:'pentatonic'}]]},
 {q:'How much time do you have?',hint:'Short excerpts demonstrate the pacing of each duration.',options:[['A quick glimpse','30-second journey',{duration:'30',speed:'1'}],['A little escape','45-second journey',{duration:'45',speed:'1'}],['Room to explore','60-second journey',{duration:'60',speed:'1'}],['Time to reflect','90-second journey',{duration:'90',speed:'1'}]]}];
let qi=0,answers={};
function showQuiz(){const q=quiz[qi];show(`<span class="eyebrow">FIND YOUR SOUND · ${qi+1} / ${quiz.length}</span><h2>${q.q}</h2><p>Listen before you choose. Samples are synthesized instrument previews, not recordings.</p><p id="sampleStatus" aria-live="polite">${q.hint}</p><div class="choices">${q.options.map((o,i)=>`<div class="choiceCard"><button data-choice="${i}" aria-label="Choose ${o[0]}, ${o[1]}">${o[0]}<small>${o[1]}</small></button><button class="sampleBtn" data-preview="${i}" aria-label="Hear a sample of ${o[0]}" aria-pressed="false">▶ Hear sample</button></div>`).join('')}</div>`);
  document.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>{if(b.getAttribute('aria-pressed')==='true'){stopPreview();$('sampleStatus').textContent='Sample stopped.'}else previewChoice(q.options[Number(b.dataset.preview)][2],b,q.tone)});
  document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{Object.assign(answers,q.options[Number(b.dataset.choice)][2]);qi++;if(qi<quiz.length)showQuiz();else{applySettings(answers);
    show(`<span class="eyebrow">YOUR EARTH, YOUR SOUND</span><h2>Your listening style is ready.</h2><p>Your notes go from ${noteLabel(Number($('low').value))} to ${noteLabel(Number($('high').value))}, at ${$('volume').value}% loudness. Change anything later in the studio, and use Text size at the top of the page to make the page bigger. Your choices stay in this browser.</p><button class="primary" id="finishQuiz">Explore my jukebox →</button>`);$('finishQuiz').onclick=()=>modal.close()}})}
function startQuiz(){qi=0;answers={};showQuiz()}
$('quizBtn').onclick=startQuiz;
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

// ---------- How the sound is made ----------
// A plain-language explanation of the rule for the chosen dataset, filled in with the listener's own
// notes and timing, so the numbers in the text are exactly what the player does.
const SCALE_TEXT={
  continuous:'Continuous: every value gets its exact pitch, even between the keys of a piano, so the tiniest change is audible.',
  major:'Major: each pitch is rounded to the nearest note of the major scale that starts on your lowest note. Close values can land on the same note.',
  minor:'Minor: each pitch is rounded to the nearest note of the minor scale that starts on your lowest note. Close values can land on the same note.',
  pentatonic:'Pentatonic: each pitch is rounded to the nearest of five notes per octave, starting on your lowest note. Close values often share a note.'};
function num(v,d=1){return v.toFixed(d).replace('-','−')}
function signedC(v){return `${v>=0?'+':'−'}${Math.abs(v).toFixed(2)} °C`}
function exampleTable(list,valueName){return `<table><thead><tr><th scope="col">${data.timeName==='MONTH'?'Month':'Year'}</th><th scope="col">${valueName}</th><th scope="col">Note</th><th scope="col">Hz</th></tr></thead><tbody>${list.map(([r,why])=>{const m=midiFor(r.value);return `<tr><td>${esc(r.spoken)}${why?` <small>(${why})</small>`:''}</td><td>${esc(data===DATASETS.temperature?signedC(r.value):data.readout(r.value))}</td><td>${Number.isInteger(m)?'':'about '}${noteName(m)}</td><td>${Math.round(hz(m))}</td></tr>`}).join('')}</tbody></table>`}
function renderHowto(){if(!rows.length||!data.range||!$('howtoBody'))return;
  const lo=Number($('low').value),hi=Number($('high').value),span=hi-lo,r=data.range,secs=interval();
  const many=data.timeName==='MONTH'?'months':'years',one=data.timeName==='MONTH'?'month':'year';
  const timing=`<li><strong>One ${one}, one note</strong>${rows.length} ${many} in ${$('duration').value} seconds at ${$('speed').value}× speed, so each note lasts ${num(secs,2)} seconds. Every ${one} gets the same time.<span class="formula">note length = duration ÷ number of ${many} ÷ speed</span></li>`;
  const pitchRule=`<span class="formula">semitones above your lowest note = (value − smallest) ÷ (biggest − smallest) × ${span}</span><span class="formula">frequency = ${Math.round(hz(lo))} Hz × 2^(semitones ÷ 12)</span>`;
  const scale=`<li><strong>Musical scale</strong>${SCALE_TEXT[$('scale').value]}</li>`;
  const sameData=`<li><strong>What does not change the data</strong>Instrument, speed, duration and loudness change how it sounds, not which note a ${one} gets. The chart and the table always show the original numbers.</li>`;
  const ends=`your lowest note, ${noteLabel(lo)}`, top=`your highest note, ${noteLabel(hi)}`;
  let html;
  if(data===DATASETS.temperature){const perTenth=span/(r.max-r.min)*.1,base=midiFor(0);
    const pick=y=>rows.find(x=>x.year===y);const list=[[data.coolest,'coolest'],[pick(1950),''],[pick(2000),''],[data.warmest,'warmest'],[rows.at(-1),'latest']].filter((x,i,a)=>x[0]&&a.findIndex(y=>y[0]===x[0])===i);
    html=`<ol>
<li><strong>The data</strong>NASA GISTEMP v4: one number per year, ${rows[0].year} to ${rows.at(-1).year}. Each number is how much warmer or cooler the whole planet was than the 1951–1980 average, in degrees Celsius. It is a global average, not the temperature of one city.</li>
${timing}
<li><strong>Temperature becomes pitch</strong>The coolest year, ${data.coolest.spoken} (${signedC(r.min)}), plays ${ends}. The warmest year, ${data.warmest.spoken} (${signedC(r.max)}), plays ${top}. In between, every 0.1 °C warmer raises the note by ${num(perTenth)} semitones (one semitone is one piano key). The baseline, 0 °C, plays about ${noteName(base)}, ${Math.round(hz(base))} Hz.${pitchRule}</li>
<li><strong>Examples with your settings</strong>${exampleTable(list,'Anomaly')}</li>
${scale}${sameData}</ol>`}
  else{const lightning=data===DATASETS.lightning,per10=span/10,who=place&&place.name!=='Whole planet'?place.name:'the whole planet';
    const sorted=[...rows].sort((a,b)=>a.value-b.value);const list=[[rows[0],'first'],[sorted[0],'lowest'],[sorted.at(-1),lightning?'stormiest':'brightest'],[rows.at(-1),'latest']].filter((x,i,a)=>a.findIndex(y=>y[0]===x[0])===i);
    const source=lightning
      ?`<li><strong>The data</strong>The Lightning Imaging Sensor on the International Space Station saw lightning from March 2017 to July 2023. NASA’s Science On a Sphere movie (SVS 5011) shows each flash as a yellow dot on a flat world map. We count the yellow pixels in every 10 degree square of the map. A dot stays on screen for about 30 days, so we use the frame at the end of each month: one map per month.</li>
<li><strong>Where</strong>“Whole planet” adds up every square. A region uses the one 10 degree square (about 1,100 km across) that contains it. The station cannot see beyond about 55 degrees north or south.</li>
<li><strong>Make it relative</strong>Each place is compared with its own stormiest month, which counts as 100%. So every region uses the whole range of notes, and you hear its own rhythm. The numbers are amounts of yellow on the map, not exact flash counts.<span class="formula">value = yellow pixels this month ÷ yellow pixels in the stormiest month</span></li>`
      :`<li><strong>The data</strong>NASA Black Marble maps of the Earth at night, one per year from 2012 to 2023, from NASA’s Earth Information Center movie (SVS 5313). We read the color of every pixel. The land and ice underneath are never brighter than about 35 out of 255, so anything brighter than a pixel’s darkest year is light from cities, roads and industry.</li>
<li><strong>Where</strong>“Whole planet” adds up the light of the whole map. A city uses a small box around it, about 1.5 by 1.5 degrees (roughly 160 km).</li>
<li><strong>Make it relative</strong>Each place is compared with its own brightest year, which counts as 100%. So a small town and a megacity both use the whole range of notes. The numbers say brighter or darker, not watts or people.<span class="formula">value = light this year ÷ light in the brightest year</span></li>`;
    html=`<ol>${source}
${timing}
<li><strong>${lightning?'Lightning':'Light'} becomes pitch</strong>0% plays ${ends}. 100% plays ${top}. Every 10% more ${lightning?'lightning':'light'} raises the note by ${num(per10)} semitones (one semitone is one piano key). 50%, the middle, plays about ${noteName(midiFor(.5))}, ${Math.round(pitchFor(.5))} Hz.${pitchRule.replace('(value − smallest) ÷ (biggest − smallest)','value (0 to 1)')}</li>
<li><strong>Examples for ${esc(who)}, with your settings</strong>${exampleTable(list,lightning?'Of the stormiest month':'Of the brightest year')}</li>
${scale}${sameData}</ol>`}
  $('howtoBody').innerHTML=html+`<p class="note">You set the lowest note, the highest note and the scale in the studio, or in “Find your sound”.</p>`;
  baselineButton()}
// ---------- Switching datasets and places ----------
function usePlace(name){place=data.places.find(p=>p.name===name)||data.places[0];rows=place.rows;index=Math.min(index,rows.length-1);if(index<0)index=0;
  $('scrub').max=rows.length-1;$('chart').setAttribute('aria-valuemin',0);$('chart').setAttribute('aria-valuemax',rows.length-1);
  $('legendSeries').innerHTML=`<i></i> ${esc(data.legend)}${place.name==='Whole planet'?'':' · '+esc(place.name)}`;
  render(false);renderHowto()}
function showDataset(){
  $('dataEyebrow').textContent=data.eyebrow;$('dataTitle').textContent=data.title;$('timeLabel').textContent=data.timeName;$('valueLabel').textContent=data.valueLabel;
  $('legendBaseline').textContent=data.baselineLegend;$('contextText').textContent=data.context;
  $('facts').innerHTML=(data.facts||[]).map(f=>`<li>${esc(f)}</li>`).join('');
  $('sourceDetail').textContent=data.sourceText;$('sourceLink').href=data.sourceUrl;$('downloadLink').href=data.download;
  $('rangeHelp').textContent=data===DATASETS.temperature?'The coolest year plays your lowest note, the warmest year plays your highest note.':`0% plays your lowest note, 100% (the ${data===DATASETS.lightning?'stormiest month':'brightest year'}) plays your highest note.`;
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
