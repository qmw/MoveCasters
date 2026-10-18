// Tiny WebAudio synth for retro sound effects (no audio files needed).
let ac = null;
let muted = false;
try { muted = localStorage.getItem('mc_mute') === '1'; } catch {}

export const isMuted = () => muted;
export function setMuted(m) { muted = m; try { localStorage.setItem('mc_mute', m ? '1' : '0'); } catch {} }

function ctx() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function tone({ f = 440, f2 = null, d = 0.08, type = 'square', v = 0.06, noise = false, delay = 0 }) {
  const a = ctx(); if (!a) return;
  const t = a.currentTime + delay;
  const gain = a.createGain();
  gain.gain.setValueAtTime(v, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + d);
  gain.connect(a.destination);
  if (noise) {
    const buf = a.createBuffer(1, Math.ceil(a.sampleRate * d), a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const flt = a.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = f;
    src.connect(flt); flt.connect(gain); src.start(t);
    return;
  }
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  o.connect(gain); o.start(t); o.stop(t + d + 0.02);
}

const last = {};
export function sfx(name) {
  if (muted) return;
  const now = performance.now();
  if (last[name] && now - last[name] < 35) return;
  last[name] = now;
  switch (name) {
    case 'step': return tone({ f: 120, f2: 90, d: 0.04, type: 'triangle', v: 0.05 });
    case 'swing': return tone({ f: 900, d: 0.06, noise: true, v: 0.05 });
    case 'hit': return tone({ f: 220, f2: 110, d: 0.08, v: 0.06 });
    case 'hurt': tone({ f: 160, f2: 60, d: 0.2, type: 'sawtooth', v: 0.08 }); return tone({ f: 600, d: 0.12, noise: true, v: 0.05 });
    case 'heal': tone({ f: 520, d: 0.08, type: 'triangle', v: 0.05 }); return tone({ f: 780, d: 0.1, type: 'triangle', v: 0.05, delay: 0.07 });
    case 'death': return tone({ f: 300, f2: 40, d: 0.18, type: 'square', v: 0.05 });
    case 'bolt': return tone({ f: 900, f2: 300, d: 0.1, type: 'sawtooth', v: 0.035 });
    case 'boom': return tone({ f: 400, d: 0.18, noise: true, v: 0.07 });
    case 'cast': tone({ f: 440, f2: 880, d: 0.1, type: 'triangle', v: 0.05 }); return tone({ f: 660, f2: 1320, d: 0.12, type: 'sine', v: 0.04, delay: 0.04 });
    case 'spawn': return tone({ f: 90, f2: 180, d: 0.15, type: 'sawtooth', v: 0.04 });
    case 'warn': return tone({ f: 330, d: 0.15, type: 'square', v: 0.04 });
    case 'die': tone({ f: 200, f2: 40, d: 0.6, type: 'sawtooth', v: 0.08 }); return;
    case 'clear': [523, 659, 784, 1047].forEach((f, i) => tone({ f, d: 0.12, type: 'triangle', v: 0.05, delay: i * 0.08 })); return;
    case 'pick': return tone({ f: 660, d: 0.06, type: 'triangle', v: 0.05 });
    case 'bad': return tone({ f: 110, d: 0.08, type: 'square', v: 0.04 });
  }
}
