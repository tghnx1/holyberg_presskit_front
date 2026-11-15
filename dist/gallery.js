const positions = [[.34, -.03], [-.33, .17], [.02, -.25], [.29, .22], [-.31, -.18], [.13, .02], [-.12, -.04], [.38, .02], [-.38, .08]];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function initGallery(reducedMotion, compact, viewer) {
  const gallery = document.getElementById('gallery');
  const stage = gallery.querySelector('.depth-stage');
  const grid = gallery.querySelector('.installation-grid');
  const controls = gallery.querySelector('.depth-controls');
  const counter = controls.querySelector('.depth-counter');
  const [previous, next] = controls.querySelectorAll('button');
  const groups = gallery.querySelector('.gallery-groups');
  const buttons = [...groups.querySelectorAll('button')];
  const category = gallery.querySelector('.gallery-category');
  const select = category.querySelector('select');
  const order = buttons.map((button) => button.dataset.galleryGroup);
  const media = [...grid.children].sort((a, b) => order.indexOf(a.dataset.gallery) - order.indexOf(b.dataset.gallery));
  grid.append(...media);
  const last = media.length - 1;
  const total = String(media.length).padStart(2, '0');
  let visible = new Set();
  let intersecting = false;
  let frame = 0;
  let currentLayer = -1;
  let entryDirection = 1;
  let lastScrollY = scrollY;
  let inside = false;
  let rewind = 0;
  let exitDirection = 0;
  let distance = 0;

  function measure() {
    const bounds = gallery.getBoundingClientRect();
    const height = stage.clientHeight;
    const travel = Math.max(1, bounds.height - height * (compact.matches ? 1.45 : 1.8));
    return { bounds, height, travel };
  }

  function updateControls(index) {
    if (index === currentLayer) return;
    currentLayer = index;
    const group = media[index].dataset.gallery;
    counter.textContent = `LAYER ${String(index + 1).padStart(2, '0')} / ${total}`;
    if (select.value !== group) select.value = group;
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.galleryGroup === group)));
    previous.setAttribute('aria-disabled', String(index === 0));
    next.setAttribute('aria-disabled', String(index === last));
  }

  function render(position) {
    distance = position;
    const active = Math.round(position);
    updateControls(active);
    const displayed = new Set();
    for (let index = Math.max(0, Math.floor(position) - 2); index <= Math.min(last, Math.ceil(position) + 2); index++) {
      const depth = index - position;
      const isActive = index === active;
      const card = media[index];
      const magnitude = Math.abs(depth);
      if (magnitude >= (compact.matches ? 1.55 : 2.04)) continue;
      displayed.add(card);
      card.inert = !isActive;
      card.classList.toggle('is-active', isActive);

      if (compact.matches) {
        const scale = 1 - Math.min(magnitude, 1.5) * .38;
        const x = clamp(depth, -1.35, 1.35) * 31;
        const y = Math.min(magnitude, 1.5) * (depth < 0 ? 14 : -19);
        card.style.transform = `translate(-50%, -50%) translate(${x}vw, ${y}svh) scale(${scale})`;
        card.style.opacity = String(isActive ? 1 : clamp(1 - magnitude * .59, 0, .58));
      } else {
        const scale = 1 / Math.max(.25, 1.3 + depth * .56);
        const [x, y] = positions[index % positions.length];
        card.style.transform = `translate(-50%, -50%) translate(${100 * x * scale}vw, ${100 * y * scale}svh) scale(${scale})`;
        card.style.opacity = String(clamp((2.04 - magnitude) / .38, 0, 1) * clamp(1 - depth * .18, 0, 1));
      }
      card.style.zIndex = String(isActive ? 5 : 3 - Math.floor(magnitude));
      card.style.visibility = 'visible';
    }
    for (const card of visible) {
      if (displayed.has(card)) continue;
      card.inert = true;
      card.style.visibility = 'hidden';
    }
    visible = displayed;
  }

  function draw() {
    frame = 0;
    if (rewind || reducedMotion.matches || !intersecting) return;
    const { bounds, height, travel } = measure();
    if (exitDirection) {
      const reachedEdge = exitDirection > 0 ? bounds.bottom <= height : bounds.top >= 0;
      if (reachedEdge) {
        exitDirection = 0;
        inside = false;
        lastScrollY = scrollY;
      }
      return;
    }
    const pinned = bounds.top <= 1 && bounds.bottom > height;
    if (pinned && !inside) entryDirection = scrollY < lastScrollY ? -1 : 1;
    inside = pinned;
    lastScrollY = scrollY;
    render(clamp(-bounds.top / travel, 0, 1) * last);
  }

  function schedule() {
    if (!frame && intersecting && !reducedMotion.matches) frame = requestAnimationFrame(draw);
  }

  function stopRewind() {
    if (!rewind && !exitDirection) return;
    cancelAnimationFrame(rewind);
    rewind = 0;
    exitDirection = 0;
    schedule();
  }

  function goToLayer(index, instant = false) {
    stopRewind();
    const target = clamp(index, 0, last);
    if (reducedMotion.matches) {
      updateControls(target);
      media[target].scrollIntoView({ block: 'start' });
      return;
    }
    const { bounds, travel } = measure();
    scrollTo({ top: scrollY + bounds.top + travel * target / last, behavior: instant ? 'instant' : 'smooth' });
  }

  function goToGroup(group) {
    const index = media.findIndex((item) => item.dataset.gallery === group);
    if (index >= 0) goToLayer(index);
  }

  controls.querySelector('a').addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (rewind || exitDirection) return;
    const destination = document.getElementById(entryDirection > 0 ? 'events' : 'visual-story');
    const from = distance;
    const start = performance.now();
    const duration = Math.min(420, 120 + from * 18);
    function animate(now) {
      const progress = clamp((now - start) / duration, 0, 1);
      if (from > 0 && progress < 1) {
        render(from * (1 - progress) ** 2);
        rewind = requestAnimationFrame(animate);
        return;
      }
      rewind = 0;
      render(0);
      exitDirection = entryDirection;
      destination.setAttribute('tabindex', '-1');
      destination.focus({ preventScroll: true });
      destination.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    rewind = requestAnimationFrame(animate);
  });

  buttons.forEach((button) => button.addEventListener('click', () => goToGroup(button.dataset.galleryGroup)));
  select.addEventListener('change', () => goToGroup(select.value));
  previous.addEventListener('click', () => { if (currentLayer > 0) goToLayer(currentLayer - 1); });
  next.addEventListener('click', () => { if (currentLayer < last) goToLayer(currentLayer + 1); });
  gallery.addEventListener('focusin', (event) => {
    if (rewind || reducedMotion.matches || viewer.open || !event.target.matches(':focus-visible')) return;
    const index = media.findIndex((card) => card.contains(event.target) || card === event.target);
    if (index >= 0 && index !== currentLayer) goToLayer(index, true);
  });

  new IntersectionObserver(([entry]) => {
    intersecting = entry.isIntersecting;
    if (!intersecting) {
      exitDirection = 0;
      inside = false;
      lastScrollY = scrollY;
    }
    schedule();
  }).observe(gallery);
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  addEventListener('wheel', stopRewind, { passive: true });
  addEventListener('touchstart', stopRewind, { passive: true });

  function setMode() {
    stopRewind();
    const spatial = !reducedMotion.matches;
    gallery.classList.toggle('is-spatial', spatial);
    gallery.style.setProperty('--gallery-height', `${(compact.matches ? 145 : 180) + last * (compact.matches ? 30 : 100)}svh`);
    controls.hidden = !spatial;
    groups.hidden = compact.matches;
    category.hidden = !compact.matches;
    currentLayer = -1;
    media.forEach((card) => {
      card.inert = spatial;
      card.style.visibility = spatial ? 'hidden' : '';
      card.style.transform = '';
      card.style.opacity = '';
      card.style.zIndex = '';
    });
    if (spatial) {
      const { bounds, travel } = measure();
      render(clamp(-bounds.top / travel, 0, 1) * last);
    } else {
      updateControls(0);
    }
  }

  compact.addEventListener('change', setMode);
  reducedMotion.addEventListener('change', setMode);
  setMode();
  return { enter: () => goToLayer(0), stopRewind };
}
