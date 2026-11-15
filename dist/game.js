(() => {
  const frame = document.querySelector('.game-frame');
  const iframe = frame.querySelector('iframe');
  const status = frame.querySelector('.game-status');
  const fullscreen = frame.querySelector('.game-fullscreen');
  const contact = document.getElementById('contact');
  const game = document.getElementById('game');
  const note = game.querySelector('.game-note');
  const connection = navigator.connection;
  const gameOrigin = new URL(iframe.dataset.src).origin;
  const conserveData = connection?.saveData || /2g|3g/.test(connection?.effectiveType || '');
  let started = false;
  let slowTimer;

  frame.hidden = false;
  if (document.fullscreenEnabled && frame.requestFullscreen) {
    fullscreen.hidden = false;
    fullscreen.addEventListener('click', () => {
      if (document.fullscreenElement === frame) {
        document.exitFullscreen().catch(() => {});
      } else {
        frame.requestFullscreen().catch(() => {
          note.hidden = false;
          note.textContent = 'Full screen unavailable. Open the game in a new tab below.';
        });
      }
    });
    document.addEventListener('fullscreenchange', () => {
      fullscreen.textContent = document.fullscreenElement === frame ? 'Exit full screen' : 'Full screen';
    });
  }

  function showGame(event) {
    if (event.origin !== gameOrigin || event.source !== iframe.contentWindow || event.data !== 'holyworld:ready') return;
    clearTimeout(slowTimer);
    frame.classList.add('is-game-ready');
    status.hidden = true;
    removeEventListener('message', showGame);
  }

  function start() {
    if (started) return;
    started = true;
    observer.disconnect();
    iframe.hidden = false;
    addEventListener('message', showGame);
    iframe.src = iframe.dataset.src;
    slowTimer = setTimeout(() => {
      status.textContent = 'Still loading… You can also open the game in a new tab below.';
    }, 7000);
  }

  const observer = new IntersectionObserver((entries) => {
    if (entries.some(({ isIntersecting }) => isIntersecting)) start();
  }, { rootMargin: '0px 0px 60% 0px' });
  observer.observe(contact);
  observer.observe(game);

  if (location.hash === '#game') start();
  if (!conserveData) {
    const afterCover = () => {
      setTimeout(() => {
        if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1000 });
        else start();
      }, 250);
    };
    if (document.readyState === 'complete') afterCover();
    else addEventListener('load', afterCover, { once: true });
  }
})();
