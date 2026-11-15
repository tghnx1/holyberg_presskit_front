(() => {
  const photos = [...document.querySelectorAll('a.photo')];
  const viewer = document.querySelector('.photo-viewer');
  const enlarged = viewer.querySelector('img');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const compact = matchMedia('(max-width: 819px)');
  let opener;
  let startedOnBackdrop;

  if (typeof viewer.showModal === 'function') {
    for (const photo of photos) {
      photo.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        opener = photo;
        enlarged.alt = photo.querySelector('img').alt;
        enlarged.src = photo.href;
        viewer.showModal();
      });
    }

    viewer.querySelector('.viewer-close').addEventListener('click', () => viewer.close());
    viewer.addEventListener('pointerdown', (event) => {
      startedOnBackdrop = event.target === viewer;
    });
    viewer.addEventListener('click', (event) => {
      if (startedOnBackdrop && event.target === viewer) viewer.close();
      startedOnBackdrop = false;
    });
    viewer.addEventListener('close', () => {
      enlarged.removeAttribute('src');
      opener?.focus({ preventScroll: true });
    });
  }


  if (!window.Motion) return;
  const { scroll } = window.Motion;
  const stage = document.querySelector('.red-stage');
  const image = stage.querySelector('.red-image');
  let stopScroll;
  function configureMotion() {
    stopScroll?.();
    image.style.transform = '';
    if (reducedMotion.matches || compact.matches) return;
    stopScroll = scroll((progress) => {
      const scale = 0.9 + Math.min(progress * 2, 1) * 0.1;
      image.style.transform = 'scale(' + scale + ')';
    }, { target: stage, offset: ['start end', 'end start'] });
  }
  reducedMotion.addEventListener('change', configureMotion);
  compact.addEventListener('change', configureMotion);
  configureMotion();
})();
