# Made in code: a 15-second motion study

`made-in-code.mp4` is 1920×1080, 60 fps, 15 s, with a soundtrack synthesized at 120 BPM.
Every frame and every sound comes from code. There is no timeline app, no stock audio and no
hand-set keyframes.

| Time    | Scene       | What it shows |
|---------|-------------|---------------|
| 0–2 s   | 01 Spark    | An elastic dot pops in, layout guides draw out, then anticipation and a stretch into a line |
| 2–4 s   | 02 Physics  | A bouncing ball with squash and stretch, a 24 fps spacing chart, onion skins and a rippling floor; it launches at the camera |
| 4–6 s   | 03 Type     | Kinetic slot-reveal type ("EVERY FRAME IS A CHOICE.") with a clipped colour-scheme wipe |
| 6–8 s   | 04 Easing   | Linear, ease-in-out and a real spring (k=196, c=12), each plotted live; the sound follows each curve |
| 8–11 s  | 05 Particles| 2,304 particles burst into a 3D sphere with orbit rings, morph into a torus knot, then snap to a grid |
| 11–13 s | 06 Systems  | The same 2,304 cells become an op-art halftone spiral, then a wave fills the frame with cream |
| 13–15 s | 07 Fin      | Title card. The dot from the first second returns as the full stop and closes the piece |

The craft details: true motion blur (6 to 16 temporal sub-frames per frame, 180° shutter), bloom,
radial chromatic aberration and camera shake on impacts, a vignette, film grain, a frame-accurate
HUD timecode, and text that decodes with a scramble effect.

## Files

- `comp.js` holds the whole composition. Every visual is a pure function of time `t`, so frames can be rendered in any order or in parallel.
- `index.html` is a live preview. Open it in a browser: space plays and pauses, the arrow keys step frames, and the bar scrubs. Add `?sub=6` to see motion blur live (slower).
- `render.cjs` renders through headless Chromium (Playwright): `video` makes the lossless master, and `stills 1.5 8.2 …` saves single frames.
- `audio.py` is the soundtrack. It uses numpy only: kicks, claps, hats, bass, pads, risers, whooshes, booms and bells. In the easing scene, each dot's pitch follows its easing curve.
- `build.sh` runs the full pipeline and writes `made-in-code.mp4`.

## Re-render on your own machine

```sh
npm i -D playwright && npx playwright install chromium   # once
pip install numpy                                          # once
./build.sh                    # WORKERS=8 SUB=12 ./build.sh for a heavier, smoother render
```
