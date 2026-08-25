// Shared accessibility toolbar — load after DOM ready
// Provides: dyslexia font, high contrast, large text, wide spacing, TTS, font size
(function () {
  var state = {
    dyslexia: false,
    highContrast: false,
    largeText: false,
    wideSpacing: false,
    tts: false,
    speechRate: 0.9,
    fontSize: 100
  };

  try {
    var saved = JSON.parse(localStorage.getItem('casuya_a11y'));
    if (saved) Object.assign(state, saved);
  } catch (e) {}

  function saveState() {
    try { localStorage.setItem('casuya_a11y', JSON.stringify(state)); } catch (e) {}
  }

  function applyState() {
    document.body.classList.toggle('dyslexia-mode', state.dyslexia);
    document.body.classList.toggle('high-contrast', state.highContrast);
    document.body.classList.toggle('large-text', state.largeText);
    document.body.classList.toggle('extra-large-text', state.fontSize >= 150 && state.fontSize < 200);
    document.body.classList.toggle('max-text', state.fontSize >= 200);
    document.body.classList.toggle('wide-spacing', state.wideSpacing);

    document.querySelectorAll('.a11y-toggle-btn').forEach(function (btn, i) {
      var vals = [state.dyslexia, state.highContrast, state.largeText, state.wideSpacing, state.tts];
      btn.classList.toggle('active', vals[i]);
    });

    var ids = ['a11y-dyslexia', 'a11y-contrast', 'a11y-large-text', 'a11y-wide-spacing', 'a11y-tts'];
    var keys = ['dyslexia', 'highContrast', 'largeText', 'wideSpacing', 'tts'];
    ids.forEach(function (id, i) {
      var el = document.getElementById(id);
      if (el) el.setAttribute('aria-pressed', state[keys[i]]);
    });

    var speedRow = document.getElementById('a11y-speed-row');
    var speechCtrl = document.getElementById('speech-controls');
    if (speedRow) speedRow.style.display = state.tts ? 'flex' : 'none';
    if (speechCtrl) speechCtrl.style.display = state.tts ? 'flex' : 'none';

    var fontSlider = document.getElementById('a11y-fontsize');
    var fontLabel = document.getElementById('a11y-fontsize-label');
    if (fontSlider && fontLabel) {
      fontSlider.value = state.fontSize;
      fontLabel.textContent = state.fontSize + '%';
    }

    saveState();
  }

  applyState();

  var toggleBtn = document.getElementById('a11y-toggle-btn');
  var panel = document.getElementById('a11y-panel');

  if (toggleBtn && panel) {
    toggleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = panel.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', isOpen);
    });

    document.addEventListener('click', function (e) {
      if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) {
        panel.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) {
        panel.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.focus();
      }
    });
  }

  // Toggle handlers
  var toggleMap = {
    'a11y-dyslexia': 'dyslexia',
    'a11y-contrast': 'highContrast',
    'a11y-large-text': 'largeText',
    'a11y-wide-spacing': 'wideSpacing'
  };
  Object.keys(toggleMap).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function () {
      state[toggleMap[id]] = !state[toggleMap[id]];
      applyState();
    });
  });

  var ttsBtn = document.getElementById('a11y-tts');
  if (ttsBtn) {
    ttsBtn.addEventListener('click', function () {
      state.tts = !state.tts;
      applyState();
      if (!state.tts && window.speechSynthesis) window.speechSynthesis.cancel();
    });
  }

  // Font size slider
  var fontSlider = document.getElementById('a11y-fontsize');
  if (fontSlider) {
    fontSlider.addEventListener('input', function () {
      state.fontSize = parseInt(this.value);
      applyState();
    });
  }

  // Keyboard support
  document.querySelectorAll('.a11y-option').forEach(function (el) {
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); }
    });
  });

  // Speech rate slider
  var speedSlider = document.getElementById('a11y-speed');
  var speedLabel = document.getElementById('a11y-speed-label');
  if (speedSlider) {
    speedSlider.addEventListener('input', function () {
      state.speechRate = parseFloat(this.value);
      if (speedLabel) speedLabel.textContent = state.speechRate.toFixed(1) + 'x';
      saveState();
    });
  }

  // Voice selection — prefer East African English
  function findVoice() {
    var voices = window.speechSynthesis.getVoices();
    var preferred = ['en-TZ', 'en-KE', 'en-UG', 'en-GH', 'en-ZA', 'en-GB', 'en-US'];
    for (var i = 0; i < preferred.length; i++) {
      var match = voices.filter(function (v) { return v.lang === preferred[i]; });
      if (match.length) return match[0];
    }
    for (var j = 0; j < voices.length; j++) {
      if (voices[j].lang.indexOf('en') === 0) return voices[j];
    }
    return null;
  }

  function getSelectedText() {
    var sel = window.getSelection();
    if (sel && sel.toString().trim()) return sel.toString().trim();
    return document.body.textContent.substring(0, 2000);
  }

  function speak(text) {
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    var voice = findVoice();
    if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = 'en-TZ'; }
    u.rate = state.speechRate || 0.9;
    u.pitch = 1.0;
    u.volume = 1.0;
    var speechStatus = document.getElementById('speech-status');
    u.onstart = function () { if (speechStatus) speechStatus.textContent = 'Speaking...'; };
    u.onend = function () { if (speechStatus) speechStatus.textContent = 'Done'; };
    u.onerror = function () { if (speechStatus) speechStatus.textContent = 'Error'; };
    window.speechSynthesis.speak(u);
  }

  // Speech controls
  var speechPlay = document.getElementById('speech-play');
  var speechPause = document.getElementById('speech-pause');
  var speechStop = document.getElementById('speech-stop');
  if (speechPlay) {
    speechPlay.addEventListener('click', function () {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      } else {
        speak(getSelectedText());
      }
    });
  }
  if (speechPause) {
    speechPause.addEventListener('click', function () {
      window.speechSynthesis.pause();
    });
  }
  if (speechStop) {
    speechStop.addEventListener('click', function () {
      window.speechSynthesis.cancel();
    });
  }

  // Ctrl+U shortcut
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.key === 'u' && toggleBtn) {
      e.preventDefault();
      toggleBtn.click();
    }
  });

  // Preload voices
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () {};
    window.speechSynthesis.getVoices();
  }

  // Expose for other scripts
  window.__casuyaA11y = { state: state, speak: speak, findVoice: findVoice };
})();
