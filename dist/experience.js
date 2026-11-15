import { initGallery } from './gallery.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const compact = matchMedia('(max-width: 819px)');
const viewer = document.querySelector('.photo-viewer');
const image = viewer.querySelector('img');
const player = viewer.querySelector('video');
const caption = viewer.querySelector('.viewer-caption');
const controller = viewer.querySelector('.viewer-close');
let opener;
let startedOnBackdrop = false;

function showMedia(trigger, source, name, description, isVideo) {
  opener = trigger;
  image.hidden = isVideo;
  player.hidden = !isVideo;
  if (isVideo) {
    player.setAttribute('aria-label', name);
    player.src = source;
  } else {
    image.alt = name;
    image.src = source;
  }
  caption.replaceChildren(description);
  caption.hidden = !caption.textContent.trim();
  viewer.classList.toggle('has-caption', !caption.hidden);
  viewer.showModal();
  if (isVideo) player.play().catch(() => {});
}

function isPlainClick(event) {
  return !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

if (typeof viewer.showModal === 'function') {
  document.querySelectorAll('a.photo').forEach((photo) => {
    photo.addEventListener('click', (event) => {
      if (!isPlainClick(event)) return;
      event.preventDefault();
      const description = document.createDocumentFragment();
      description.append(photo.querySelector('.photo-caption')?.textContent || '');
      if (photo.dataset.captionLink) {
        const link = document.createElement('a');
        link.href = photo.dataset.captionLink;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = photo.dataset.captionLinkLabel || 'Resident Advisor ↗';
        description.append(link);
      }
      showMedia(photo, photo.href, photo.querySelector('img').alt, description, false);
    });
  });

  document.querySelectorAll('.gallery-clip video').forEach((video) => {
    const clip = video.closest('.gallery-clip');
    const label = video.getAttribute('aria-label') || clip.querySelector('.photo-caption').firstChild.textContent.trim();
    const trigger = document.createElement('button');
    trigger.className = 'clip-launch';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', `Play ${label}`);
    const poster = document.createElement('img');
    poster.src = video.poster;
    poster.alt = '';
    poster.loading = 'lazy';
    poster.decoding = 'async';
    const play = document.createElement('span');
    play.textContent = '▶';
    play.setAttribute('aria-hidden', 'true');
    trigger.append(poster, play);
    trigger.addEventListener('click', () => {
      const description = document.createDocumentFragment();
      clip.querySelector('.photo-caption').childNodes.forEach((child) => description.append(child.cloneNode(true)));
      showMedia(trigger, video.querySelector('source').src, label, description, true);
    });
    video.replaceWith(trigger);
  });

  controller.addEventListener('click', () => viewer.close());
  viewer.addEventListener('pointerdown', (event) => {
    startedOnBackdrop = event.target === viewer;
  });
  viewer.addEventListener('click', (event) => {
    if (startedOnBackdrop && event.target === viewer) viewer.close();
    startedOnBackdrop = false;
  });
  viewer.addEventListener('close', () => {
    image.removeAttribute('src');
    if (player.hasAttribute('src')) {
      player.pause();
      player.removeAttribute('src');
      player.load();
    }
    opener?.focus({ preventScroll: true });
  });
}

const menu = document.querySelector('.section-menu');
const cover = document.querySelector('.cover');
const gallery = initGallery(reducedMotion, compact, viewer);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu.open && !viewer.open) {
    menu.open = false;
    menu.querySelector('summary').focus();
  }
});
document.querySelectorAll('.navigation a[href^="#"], .section-menu a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.getElementById(link.hash.slice(1));
    if (!target || !isPlainClick(event)) return;
    event.preventDefault();
    gallery.stopRewind();
    if (menu.open) menu.open = false;
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    if (target.id === 'gallery') gallery.enter();
    else target.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
});
new IntersectionObserver(([entry]) => {
  menu.hidden = entry.isIntersecting;
  if (menu.hidden) menu.open = false;
}, { threshold: 0 }).observe(cover);

const redStage = document.querySelector('.red-stage');
const redImage = redStage.querySelector('.red-image');
const moving = [...document.querySelectorAll('.manifesto h2, .manifesto-photo, .manifesto-copy h3, .story-copy h2, .story-copy h3, .people .photo, .visual-intro h3')];
const visible = new Set();
const speeds = [18, -28, 12, -12, 24];
let motionFrame = 0;

function moveContent() {
  motionFrame = 0;
  if (reducedMotion.matches) return;
  const height = innerHeight;
  const offsets = [...visible].map((element) => {
    const measuredElement = element === redImage ? redStage : element;
    const rect = measuredElement.getBoundingClientRect();
    if (element === redImage) {
      const distance = Math.max(0, height - rect.top);
      const start = compact.matches ? .96 : .94;
      return [element, 'scale', String(start + (1 - start) * Math.min(distance / (height * .36), 1))];
    }
    const center = rect.top - (Number(element.dataset.shift) || 0) + rect.height / 2;
    const value = Math.max(-1, Math.min(1, (center - height / 2) / height));
    return [element, 'translate', value * speeds[moving.indexOf(element) % speeds.length] * (compact.matches ? .55 : 1)];
  });
  for (const [element, property, value] of offsets) {
    if (property === 'translate') {
      element.dataset.shift = value;
      element.style.translate = `0 ${value}px`;
    } else {
      element.style.scale = value;
    }
  }
}

function scheduleContentMotion() {
  if (!motionFrame && visible.size && !reducedMotion.matches) motionFrame = requestAnimationFrame(moveContent);
}

const motionObserver = new IntersectionObserver((entries) => {
  entries.forEach(({ target, isIntersecting }) => {
    const element = target === redStage ? redImage : target;
    if (isIntersecting) visible.add(element);
    else visible.delete(element);
  });
  scheduleContentMotion();
}, { rootMargin: '100px' });
[...moving, redStage].forEach((element) => motionObserver.observe(element));
addEventListener('scroll', scheduleContentMotion, { passive: true });
addEventListener('resize', scheduleContentMotion);
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    moving.forEach((element) => {
      element.style.translate = '';
      delete element.dataset.shift;
    });
    redImage.style.scale = '';
  } else scheduleContentMotion();
});
