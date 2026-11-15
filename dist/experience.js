(() => {
  const viewer = document.querySelector('.photo-viewer');
  const enlarged = viewer.querySelector('img');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let opener;
  for (const photo of document.querySelectorAll('a.photo')) {
    photo.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); opener = photo;
      enlarged.alt = photo.querySelector('img').alt; enlarged.src = photo.href; viewer.showModal();
    });
  }
  viewer.querySelector('.viewer-close').addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', (event) => { if (event.target === viewer) viewer.close(); });
  viewer.addEventListener('close', () => { enlarged.removeAttribute('src'); opener?.focus({preventScroll:true}); });

  const main = document.querySelector('main');
  const sections = [...main.querySelectorAll(':scope > section')];
  const candidates = [...main.querySelectorAll('.section-heading, #manifesto-title, .manifesto-copy, .story-copy, .visual-intro, .red-title, a.photo')];
  const chosen = candidates.filter((node) => !candidates.some((other) => other !== node && other.contains(node)));
  const world = document.createElement('div'); world.className = 'spatial-world'; world.id = 'manifesto'; world.setAttribute('aria-label','HOLYBERG stories and image archive');
  const stage = document.createElement('div'); stage.className = 'spatial-stage';
  const hud = document.createElement('div'); hud.className = 'spatial-hud';
  hud.innerHTML = '<a href="#contact">EXIT ↗</a><span> LAYER <b>01</b> / <b class="total"></b></span><span class="spatial-hint">DRAG IMAGES · SCROLL</span>';
  stage.append(hud); world.append(stage); main.prepend(world);
  for (const section of sections) section.classList.add('spatial-source');
  const items = chosen.map((node, index) => {
    const owner = node.closest('section');
    if (owner && !owner.dataset.spatialLinked) { node.id ||= owner.id; owner.dataset.spatialLinked = 'true'; }
    const panel = document.createElement('div'); panel.className = 'spatial-layer'; panel.dataset.index = String(index);
    panel.append(node); stage.append(panel); return panel;
  });
  hud.querySelector('.total').textContent = String(items.length).padStart(2,'0');
  world.style.height = `${items.length * 100}svh`;
  const drags = items.map(() => ({x:0,y:0,phase:Math.random()*6}));
  let raf = 0, active = 0, dragging = null;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function draw(){
    raf=0; if(reducedMotion.matches)return;
    const travel=Math.max(1,world.offsetHeight-stage.offsetHeight);
    const progress=clamp(-world.getBoundingClientRect().top/travel,0,1);
    const distance=progress*(items.length-1); active=Math.round(distance);
    hud.querySelector('b').textContent=String(active+1).padStart(2,'0');
    items.forEach((panel,i)=>{
      const z=i-distance; const scale=1/Math.max(.22,1.25+z*.48);
      const drift=drags[i]; const x=(i%2?22:-22)*scale;
      panel.style.transform=`translate(-50%,-50%) translate3d(calc(${x}vw + ${Math.sin(performance.now()/1800+drift.phase)*5+drift.x}px), calc(${Math.cos(performance.now()/2100+drift.phase)*4+drift.y}px), ${-z*480}px) scale(${scale})`;
      panel.style.opacity=String(clamp(1-Math.abs(z)*.38,0,1)); panel.style.zIndex=String(items.length-Math.round(Math.abs(z)));
      panel.style.visibility=Math.abs(z)<2.55?'visible':'hidden';
    });
  }
  function schedule(){if(!raf&&!reducedMotion.matches)raf=requestAnimationFrame(draw)}
  stage.addEventListener('pointerdown',e=>{const panel=e.target.closest('.spatial-layer');if(!panel||!e.target.closest('a.photo')||e.button!==0)return;dragging={panel,id:e.pointerId,x:e.clientX,y:e.clientY,index:+panel.dataset.index};panel.setPointerCapture(e.pointerId)});
  stage.addEventListener('pointermove',e=>{if(!dragging||dragging.id!==e.pointerId)return;const d=drags[dragging.index];d.x+=e.clientX-dragging.x;d.y+=e.clientY-dragging.y;dragging.x=e.clientX;dragging.y=e.clientY;dragging.panel.dataset.dragged='true';schedule()});
  stage.addEventListener('pointerup',()=>{dragging=null});
  stage.addEventListener('click',e=>{const a=e.target.closest('a.photo');if(a?.dataset.dragged){e.preventDefault();delete a.dataset.dragged}},true);
  addEventListener('scroll',schedule,{passive:true}); addEventListener('resize',schedule);
  reducedMotion.addEventListener('change',()=>{world.classList.toggle('static',reducedMotion.matches);schedule()});
  world.classList.toggle('static',reducedMotion.matches); schedule();
})();
