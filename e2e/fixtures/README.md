# e2e fixtures

Tiny real files used by `e2e/media.spec.ts` (all < 70 KB). Regenerate with ffmpeg 7 (or any recent build with libvpx-vp9 and libopus):

```bash
# 2 s, 320×240, 30 fps VP9 + Opus  (WebM decodes in every Chromium build; H.264/HEVC is missing from many headless builds)
ffmpeg -f lavfi -i testsrc2=size=320x240:rate=30:duration=2 -f lavfi -i sine=frequency=440:duration=2 \
  -c:v libvpx-vp9 -b:v 200k -deadline realtime -cpu-used 8 -c:a libopus -b:a 32k -shortest clip.webm
# 8 s version, no audio — long enough that the timeline shows several filmstrip cells (clip8.webm)
ffmpeg -f lavfi -i testsrc2=size=320x240:rate=30:duration=8 -c:v libvpx-vp9 -b:v 120k -deadline realtime -cpu-used 8 -an clip8.webm
# 1 s, 16 kHz mono 440 Hz tone with a slow volume wobble → tone.wav   (see the Python snippet in the Phase 1a handover notes: wave module)
ffmpeg -f lavfi -i gradients=size=200x120:duration=1:rate=1 -frames:v 1 photo.png
# 1600×900 photo (big.png) — bigger than the 512 px poster, so tests can tell the original from the preview
ffmpeg -f lavfi -i gradients=size=1600x900:duration=1:rate=1 -frames:v 1 big.png
head -c 2048 /dev/urandom > broken.mp4        # a "video" that isn't
echo "this is not media" > notes.txt           # an unsupported type
```
The tests assert on these files' real properties (2 s → `00:02`, 1 s → `00:01`, 200×120 photo), so keep the durations if you regenerate.
