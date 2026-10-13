"""Synthesizes the soundtrack for the motion study (120 BPM, 15 s) with numpy only.
Every hit is placed on the same timeline as the visuals in comp.js.
    python3 audio.py  ->  out/soundtrack.wav
"""
import numpy as np, wave, os

SR = 48000
DUR = 15.0
N = int(SR * DUR)
rng = np.random.default_rng(3)
L = np.zeros(N); R = np.zeros(N)        # dry bus
RL = np.zeros(N); RR = np.zeros(N)      # reverb send

def note(n):  # MIDI -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)

def place(sig, t, gain=1.0, pan=0.0, verb=0.0):
    i = int(t * SR)
    if i >= N: return
    sig = sig[: N - i] * gain
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * gl * 1.414 / 1.414
    R[i:i + len(sig)] += sig * gr * 1.414 / 1.414
    if verb:
        RL[i:i + len(sig)] += sig * gl * verb
        RR[i:i + len(sig)] += sig * gr * verb

def tt(d): return np.arange(int(d * SR)) / SR

def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); g = np.ones_like(f)
    if lo: g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** 4)
    if hi: g *= 1 / np.sqrt(1 + (f / hi) ** 4)
    return np.fft.irfft(X * g, len(x))

def sweep_filter(x, f0, f1, q=3.0, hop=512):
    """time-varying band-pass by overlap-add of windowed FFT frames"""
    win = np.hanning(hop * 2); out = np.zeros(len(x) + hop * 2)
    xs = np.concatenate([x, np.zeros(hop * 2)])
    frames = range(0, len(x), hop)
    for k, i in enumerate(frames):
        seg = xs[i:i + hop * 2] * win
        fc = f0 * (f1 / f0) ** (i / max(1, len(x)))
        X = np.fft.rfft(seg); f = np.fft.rfftfreq(len(seg), 1 / SR)
        g = 1 / (1 + (q * (f / fc - fc / np.maximum(f, 1))) ** 2)
        out[i:i + hop * 2] += np.fft.irfft(X * g, len(seg))
    return out[: len(x)]

# ── instruments ──────────────────────────────────────────────────────────
def kick(punch=1.0, d=0.45):
    t = tt(d)
    f = 45 + 110 * np.exp(-t * 28) * punch
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7)
    click = fft_filter(rng.standard_normal(len(t)), lo=2000) * np.exp(-t * 250) * 0.3
    return np.tanh((body + click) * 1.6)

def clap(d=0.3):
    t = tt(d)
    n = fft_filter(rng.standard_normal(len(t)), lo=900, hi=7000)
    env = np.exp(-t * 18)
    for o in (0.0, 0.011, 0.022):  # three smeared hand claps
        env += (t >= o) * np.exp(-np.maximum(t - o, 0) * 120) * 0.8
    return n * env * 0.5

def hat(d=0.05, open_=False):
    t = tt(0.25 if open_ else d)
    n = fft_filter(rng.standard_normal(len(t)), lo=7000)
    return n * np.exp(-t * (14 if open_ else 70)) * 0.35

def blip(freq, d=0.25, decay=18, fm=0.0):
    t = tt(d)
    mod = np.sin(2 * np.pi * freq * 2.0 * t) * fm * np.exp(-t * 30)
    return np.sin(2 * np.pi * freq * t + mod) * np.exp(-t * decay) * np.minimum(1, t * 2000)

def bell(freq, d=2.0):
    t = tt(d)
    s = sum(a * np.sin(2 * np.pi * freq * m * t) * np.exp(-t * k)
            for m, a, k in [(1, 1, 2.2), (2.76, 0.35, 4), (5.4, 0.18, 7), (8.9, 0.08, 11)])
    return s * np.minimum(1, t * 3000)

def tick(d=0.02):
    t = tt(d)
    return fft_filter(rng.standard_normal(len(t)), lo=3000) * np.exp(-t * 400) * 0.5

def riser(d, f0=300, f1=6000, tone=True):
    t = tt(d)
    n = sweep_filter(rng.standard_normal(len(t)), f0, f1, q=2.0)
    env = (t / d) ** 2.2
    s = n * env * 0.6
    if tone:
        f = 110 * (8 ** (t / d) ** 1.6)
        s += np.sin(2 * np.pi * np.cumsum(f) / SR) * env * 0.12
    return s

def whoosh(d, f0=4000, f1=300, q=1.5):
    t = tt(d)
    n = sweep_filter(rng.standard_normal(len(t)), f0, f1, q=q)
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return n * env

def boom(d=2.5):
    t = tt(d)
    f = 30 + 60 * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    n = fft_filter(rng.standard_normal(len(t)), hi=900) * np.exp(-t * 3.5) * 0.6
    crash = fft_filter(rng.standard_normal(len(t)), lo=3500) * np.exp(-t * 2.4) * 0.25
    return np.tanh((s + n) * 1.4) + crash

def saw(freq, t, detune=0.0):
    ph = (freq * (1 + detune) * t) % 1.0
    return 2 * ph - 1

def pad(notes, d, cutoff=1800, attack=0.6, release=1.2):
    t = tt(d)
    s = np.zeros(len(t))
    for n in notes:
        for dt in (-0.006, 0.0, 0.007):
            s += saw(note(n), t, dt) / 3
    s = fft_filter(s, hi=cutoff) / len(notes)
    env = np.minimum(1, t / attack) * np.minimum(1, np.maximum(0, (d - t) / release))
    return s * env

def bass(n, d, cutoff=420):
    t = tt(d)
    s = np.sin(2 * np.pi * note(n) * t) + 0.5 * fft_filter(saw(note(n), t), hi=cutoff)
    env = np.minimum(1, t * 200) * np.exp(-t * 3.0) * np.minimum(1, np.maximum(0, (d - t) * 60))
    return np.tanh(s * env * 1.3)

# ── arrangement ──────────────────────────────────────────────────────────
# 01 SPARK
place(pad([45, 52, 59, 64], 4.2, cutoff=900, attack=1.6, release=0.6), 0.0, 0.22, verb=0.4)
place(blip(note(81), 0.5, 10, fm=0.6), 0.18, 0.32, verb=0.6)        # dot pop
for b, n in [(0.5, 76), (1.0, 83)]:
    place(blip(note(n), 0.8, 7), b, 0.22, pan=0.3 if n > 80 else -0.3, verb=0.8)  # ripples
for k in range(14):                                                   # guides ticking out
    place(tick(), 0.3 + k * 0.0625, 0.25 * (1 - k / 16), pan=np.sin(k) * 0.6, verb=0.3)
place(riser(0.32, 400, 3000, tone=False), 1.43, 0.35)                 # anticipation inhale
place(whoosh(0.45, 6000, 500, q=1.2), 1.72, 0.7, verb=0.3)            # line shoots out
place(blip(note(57), 0.35, 9), 1.75, 0.25)

# 02 PHYSICS — ball drop + bounces
t = tt(0.5); place(np.sin(2 * np.pi * np.cumsum(1600 - 1100 * t / 0.5) / SR) * 0.06 * (t / 0.5), 2.0, 1.0, pan=-0.4, verb=0.3)
for ti, g, pan in [(2.5, 0.9, -0.3), (3.0, 0.75, 0.1), (3.5, 0.6, 0.45)]:
    place(kick(1.2), ti, g, pan=pan * 0.3)
    place(blip(note(45 + int(ti * 4) % 12), 0.4, 8), ti, 0.15, pan=pan, verb=0.4)
    place(tick(0.03), ti + 0.03, 0.35, pan=pan)                        # label decode
for k in range(16):
    place(hat(), 2.0 + k * 0.125, 0.25 if k % 2 else 0.12, pan=0.25)
place(riser(0.5, 200, 7000), 3.5, 0.75)                               # launch
place(bass(33, 2.0), 2.0, 0.25)

# 03 TYPE — 4 slams + wipe
place(boom(1.8), 4.0, 0.85, verb=0.3)
for i, ti in enumerate([4.0, 4.5, 5.0, 5.5]):
    place(kick(1.3), ti, 1.0)
    place(blip(note(57 - i * 0), 0.3, 12, fm=1.5), ti, 0.18, verb=0.3)
for i, ti in enumerate([4.5, 5.5]):
    place(clap(), ti, 0.55, verb=0.5)
for k in range(32):
    place(hat(), 4.0 + k * 0.0625, 0.28 if k % 4 == 2 else 0.12, pan=0.3 * np.sin(k))
for i, (n, ti) in enumerate([(33, 4.0), (33, 4.5), (36, 5.0), (31, 5.5)]):
    place(bass(n, 0.5), ti, 0.5)
place(whoosh(0.6, 500, 7000, q=1.0), 5.35, 0.6, pan=-0.5, verb=0.2)   # colour wipe
place(whoosh(0.45, 2500, 8000), 5.9, 0.35, pan=0.4)                   # type exits up

# 04 EASING — sonified curves: each dot is a voice whose pitch follows its easing curve
def ease_voice(fn, base, timbre):
    t = tt(1.25); p = np.clip(t / 1.0, 0, 1)
    v = fn(p)
    f = note(base) * 2 ** (v * 1.0)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) + timbre * np.sin(2 * ph) + timbre * 0.5 * np.sin(3 * ph)
    env = np.minimum(1, t * 40) * np.clip((1.25 - t) / 0.25, 0, 1)
    return s * env * 0.1
lin = lambda p: p
ioc = lambda p: np.where(p < .5, 4 * p ** 3, 1 - (-2 * p + 2) ** 3 / 2)
wd = np.sqrt(196 - 36)
spr = lambda p: 1 - np.exp(-6 * p) * (np.cos(wd * p) + 6 / wd * np.sin(wd * p))
place(ease_voice(lin, 69, 0.0), 6.5, 0.7, pan=-0.5, verb=0.3)
place(ease_voice(ioc, 64, 0.3), 6.5, 0.7, pan=0.0, verb=0.3)
place(ease_voice(spr, 57, 0.6), 6.5, 0.8, pan=0.5, verb=0.3)
for i in range(3):
    place(blip(note(76 + i * 3), 0.3, 14), 6.2 + i * 0.08, 0.15, pan=-0.5 + i * 0.5, verb=0.5)
for k in range(24):
    place(hat(), 6.0 + k * 0.0625 + 0.0, 0.2 if k % 2 else 0.08, pan=-0.2)
place(kick(0.8), 6.0, 0.6); place(kick(0.8), 7.0, 0.55)
place(clap(), 6.5, 0.3, verb=0.6)
place(pad([41, 48, 55, 60], 2.0, cutoff=1200, attack=0.3, release=0.4), 6.0, 0.16, verb=0.3)
for k in range(8):                                                    # snare roll into the drop
    place(clap(0.12), 7.5 + k * 0.0625, 0.12 + 0.05 * k)
place(riser(0.5, 300, 9000), 7.5, 0.9)

# 05 PARTICLES — the drop
place(boom(3.0), 8.0, 1.0, verb=0.5)
place(whoosh(1.0, 8000, 200, q=0.8), 8.0, 0.45, verb=0.4)
chords = [(8.0, [45, 52, 57, 60, 64]), (9.0, [41, 48, 53, 57, 64]), (10.0, [48, 55, 60, 64, 67])]
for ti, ch in chords:
    place(pad(ch, 1.05, cutoff=2600, attack=0.05, release=0.3), ti, 0.2, verb=0.5)
for ti in np.arange(8.0, 11.0, 0.5):
    place(kick(1.1), ti, 0.95)
for ti in [8.5, 9.5, 10.5]:
    place(clap(), ti, 0.55, verb=0.4)
for k in range(48):
    place(hat(open_=(k % 8 == 4)), 8.0 + k * 0.0625, 0.25 if k % 2 else 0.12, pan=0.35 * np.sin(k * 1.3))
for ti, n in zip(np.arange(8.0, 11.0, 0.25), [33, 33, 45, 33, 29, 29, 41, 29, 36, 36, 48, 31]):
    place(bass(n, 0.24), ti, 0.55)
place(whoosh(0.8, 300, 5000, q=1.2), 9.45, 0.4, pan=-0.3)             # sphere → knot
for k in range(70):                                                   # particles snapping to the grid
    tk = 10.75 + rng.random() * 0.6
    place(tick(0.015), tk, 0.2 * rng.random() + 0.05, pan=rng.uniform(-1, 1))

# 06 SYSTEMS
for ti in np.arange(11.35, 12.75, 0.5):
    place(kick(1.0), ti + 0.15, 0.8)
for ti in [11.5, 12.0, 12.5]:
    place(blip(note(88), 0.2, 20, fm=2.0), ti, 0.12, pan=0.6, verb=0.6)
for k in range(22):
    place(hat(), 11.35 + k * 0.0625, 0.22 if k % 2 else 0.1, pan=0.2)
place(pad([43, 50, 55, 59, 62], 1.6, cutoff=3000, attack=0.2, release=0.3), 11.35, 0.17, verb=0.4)
place(riser(0.7, 200, 10000), 12.3, 0.8)
for k in range(10):
    place(clap(0.1), 12.375 + k * 0.0625, 0.08 + 0.04 * k)

# 07 FIN
place(kick(0.9), 13.0, 0.9)
place(boom(2.0), 13.0, 0.35, verb=0.5)
place(pad([41, 48, 52, 55, 57, 64], 2.0, cutoff=2200, attack=0.02, release=1.2), 13.0, 0.3, verb=0.7)
for i in range(12):                                                   # letters landing
    place(tick(0.02), 13.12 + i * 0.024, 0.18, pan=-0.6 + i * 0.1)
place(blip(note(81), 0.5, 10, fm=0.6), 13.62, 0.3, pan=0.35, verb=0.6) # dot pop
for k in range(10):
    place(tick(0.012), 13.3 + k * 0.04, 0.1, pan=-0.4)
place(whoosh(0.4, 1500, 6000), 14.2, 0.25)
place(bell(note(88), 1.0), 14.68, 0.22, verb=0.9)                      # the last ping

# ── mix: reverb, glue, limiter ───────────────────────────────────────────
def ir(d=1.8, seed=1):
    t = tt(d); g = np.random.default_rng(seed).standard_normal(len(t))
    return fft_filter(g, hi=6000) * np.exp(-t * 3.2) * 0.04
def conv(x, h):
    n = len(x) + len(h); m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(h, m), m)[: len(x)]
L += conv(RL, ir(seed=1)); R += conv(RR, ir(seed=2))
mix = np.stack([L, R], 1)
mix = fft_filter(mix[:, 0], lo=25)[:, None] * [1, 0] + fft_filter(mix[:, 1], lo=25)[:, None] * [0, 1]
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
fade = np.ones(N); fade[-int(0.12 * SR):] = np.linspace(1, 0, int(0.12 * SR))
mix *= fade[:, None]
mix *= 0.89 / np.max(np.abs(mix))
os.makedirs('out', exist_ok=True)
with wave.open('out/soundtrack.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote out/soundtrack.wav', mix.shape)
