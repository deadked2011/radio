(function(){
  // player-fixes.js — sync play/pause; single reconnect attempt; prevent auto-next
  const audioEl = window.audio || document.getElementById('audio');
  const fullPlayBtn = document.querySelector('.fp-main-btn');
  const fullPlayIcon = document.getElementById('fPlayIcon');
  const miniPlayIcon = document.getElementById('mPlayIcon');
  const trackEl = document.getElementById('fTrack');

  let reconnectAttempted = false;
  let reconnectTimer = null;
  let waitingTimer = null;

  function setPlayIcons(isPlaying){
    document.body.classList.toggle('playing', !!isPlaying);
    if (fullPlayBtn) fullPlayBtn.classList.toggle('playing', !!isPlaying);

    if (fullPlayIcon) fullPlayIcon.innerHTML = isPlaying
      ? '<path d="M6 19h4V5H6v14zM14 5v14h4V5h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';

    if (miniPlayIcon) miniPlayIcon.innerHTML = isPlaying
      ? '<path d="M6 19h4V5H6v14zM14 5v14h4V5h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
  }

  function syncFromAudio(){
    const playing = audioEl && !audioEl.paused && !audioEl.ended && audioEl.readyState > 2;
    setPlayIcons(playing);
  }

  window.fatalError = function(){
    reconnectAttempted = false;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (waitingTimer) { clearTimeout(waitingTimer); waitingTimer = null; }

    if (trackEl) trackEl.textContent = 'Радио сейчас недоступно';
    try { audioEl.pause(); } catch(e){}
    setPlayIcons(false);
    // Не переключаем станцию автоматически
  };

  window.recover = function(reason){
    if (curIdx === -1 || !isPlaying) return;
    if (reconnectAttempted) { window.fatalError(); return; }
    reconnectAttempted = true;

    if (trackEl) trackEl.textContent = 'Соединение потеряно. Повторная попытка через 5 секунд...';

    reconnectTimer = setTimeout(async () => {
      const s = stations[curIdx];
      if (!s || !s.stream) { window.fatalError(); return; }
      try {
        if (typeof Hls !== 'undefined' && s.stream.includes('.m3u8')) {
          if (hls) { try { hls.destroy(); } catch(_){} }
          hls = new Hls({ enableWorker:true, lowLatencyMode:false, maxBufferLength:30 });
          hls.loadSource(s.stream);
          hls.attachMedia(audioEl);
          hls.on(Hls.Events.MANIFEST_PARSED, () => audioEl.play().catch(()=>window.fatalError()));
        } else {
          const vol = audioEl.volume || 0.8;
          audioEl.pause();
          audioEl.src = s.stream;
          audioEl.load();
          audioEl.volume = vol;
          await audioEl.play();
        }
        reconnectAttempted = false;
        if (trackEl) trackEl.textContent = 'В эфире';
      } catch (err) {
        console.warn('Reconnect failed', err);
        window.fatalError();
      }
    }, 5000);
  };

  if (audioEl) {
    audioEl.addEventListener('play', syncFromAudio);
    audioEl.addEventListener('playing', () => { syncFromAudio(); if (waitingTimer){ clearTimeout(waitingTimer); waitingTimer=null; } reconnectAttempted=false; });
    audioEl.addEventListener('pause', syncFromAudio);
    audioEl.addEventListener('ended', syncFromAudio);

    audioEl.addEventListener('stalled', () => { if (!audioEl.paused) window.recover && window.recover('stalled'); });
    audioEl.addEventListener('error', () => { window.fatalError && window.fatalError(); });
    audioEl.addEventListener('waiting', () => {
      if (!audioEl.paused) {
        if (waitingTimer) clearTimeout(waitingTimer);
        waitingTimer = setTimeout(()=>{ window.recover && window.recover('waiting'); }, 8000);
      }
    });
  }

  if (window.togglePlay) {
    const origToggle = window.togglePlay;
    window.togglePlay = function(){
      const res = origToggle.apply(this, arguments);
      setTimeout(syncFromAudio, 80);
      return res;
    };
  }

  if (window.playStation) {
    const origPlayStation = window.playStation;
    window.playStation = function(){
      reconnectAttempted = false;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (waitingTimer) { clearTimeout(waitingTimer); waitingTimer = null; }
      const res = origPlayStation.apply(this, arguments);
      setTimeout(syncFromAudio, 150);
      return res;
    };
  }

  setTimeout(syncFromAudio, 200);
})();
