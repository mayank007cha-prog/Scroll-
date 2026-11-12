# Move to Work: shot list for Flow

Written from the values in `hero/hero-loop.js`, so it describes the loop on the page exactly.
Reference stills for every beat are in `storyboard/frames/` (1920×1080).

## Setup

- **Length:** 15.0 s loop, 24 fps, 360 frames.
- **Frame:** 16:9. Keep all action inside the centre square; the site crops to roughly 1:1.
- **Camera:** one continuous camera, no cuts. Every move eases in and out.
- **Units:** distances are real-world scale. Heights are measured above the desk surface.
- **Lens:** given as full-frame equivalents (30° vertical field of view ≈ 45 mm).

## Look block (add to the end of every prompt)

```
Style: clean stylised 3D render with soft, clay-like materials and a premium product-film finish.
Background: completely flat solid near-black #0B0B10. No walls, no floor, no horizon, no props, no haze.
Lighting: soft warm key light from the upper front-left; cool periwinkle (#8F8DFF) rim light from
behind on the right; gentle cool fill from the front-right; soft shadows falling to the lower right.
Camera: smooth and cinematic, ease-in and ease-out on every move, no shake, no cuts.
No text, no logos, no extra objects. 16:9, subject kept inside the centre square of the frame.
```

For a realistic version, replace the first line with:
`Style: photoreal, shallow depth of field, natural skin and fabric.`

## Lighting

| Light | Colour | Where it comes from | What it does |
|---|---|---|---|
| Key | Warm white `#FFF0E2` | In front of the desk, high, to camera-left (about 45° up) | Main shape and all shadows |
| Rim | Periwinkle `#8F8DFF` | Behind the subject, to the right, slightly above | Coloured edge on hair, shoulder, ball |
| Fill | Cool white `#CFD4FF`, weak | Front-right, low | Lifts the shadow side |
| Ambient | Pale lavender from above, deep violet from below | Everywhere | Shadows read violet, never black |
| Screen | Cool blue-white, very weak | The laptop screen | Faint glow on the desk and hand |

Shadows are soft-edged and fall toward the lower right. Under the ball and dots there is a soft
periwinkle glow pool instead of a dark shadow; it tightens and brightens as they land.

## Objects

- **Ball:** glossy pearl white with soft periwinkle shading, 5.2 cm wide.
- **Dots:** same material and colour as the ball, 1.6 cm wide, 2.2 cm centre to centre, row of four is 8 cm wide.
- **Hand:** right hand, palm down, fingertips on the desk, fingers pointing toward the camera.
- **Person:** man in his mid-twenties, dark curly tousled hair fuller on top, moustache and light stubble, olive-khaki overshirt. Seated, looking down at the laptop.
- **Desk:** thin dark tabletop `#0F0F14`, rounded corners, 124 × 78 cm.
- **Laptop:** silver, open, screen tilted back 18°, in front of him. Screen shows a dark panel with the ball.
- **Chair:** slate-blue rounded backrest only.

## Timing

| Shot | Name | Time (s) | Frames | Length |
|---|---|---|---|---|
| 1 | Bounce | 0.000 – 3.125 | 0 – 75 | 3.125 s |
| 2 | Dot loader | 3.125 – 5.750 | 75 – 138 | 2.625 s |
| 3 | Fingertips | 5.750 – 8.250 | 138 – 198 | 2.500 s |
| 4 | Pull-out and orbit | 8.250 – 12.050 | 198 – 289 | 3.800 s |
| 5 | Screen push-in | 12.050 – 15.000 | 289 – 360 | 2.950 s |

The bounce cycle is 1.25 s (30 frames) for the whole film, including the ball on the laptop screen.
Apex at 0, 1.25, 2.5, 12.5, 13.75, 15.0 s. Contact at 0.625, 1.875, 3.125, 13.125, 14.375 s.

---

## Shot 1: Bounce (0.000 – 3.125 s)

**Action**
- 0.000: ball at the top of its bounce, 13 cm above the surface.
- 0.625, 1.875: contact. One frame of squash (20% flatter), slight stretch on the way down and up.
- 3.125: third contact. The ball does not rebound.
- The ball never moves sideways.

**Camera**
- Start: 45 mm, 45 cm from the ball, 10 cm above the surface, level, straight-on. Ball is about 22% of frame height; the contact point sits about 86% down the frame.
- Move: a very slow push-in of 4 cm, then the camera eases up and to the right. Most of the travel happens between 1.5 s and 3.5 s. It lands in shot 2's angle at 4.6 s.

**Frames:** start `01`, contact `02`, end `03`.

```
A single glossy pearl-white ball with soft periwinkle shading, about 5 cm wide, bounces in place on
an invisible surface. It never travels sideways. Each bounce takes 1.25 seconds: it hangs at the top,
accelerates down, squashes slightly for one frame on contact, and stretches slightly as it leaves.
The bounce is two and a half ball-widths high. A soft periwinkle glow pool on the surface under the
ball tightens and brightens as the ball lands. Camera: 45 mm lens, 45 cm from the ball, at the height
of the middle of the bounce, level and straight-on. It pushes in very slowly, then eases up and to the
right toward a three-quarter high angle.
```

## Shot 2: Dot loader (3.125 – 5.750 s)

**Action**
- 3.125 – 3.65: the ball gives one small hop (3 cm) and shrinks to a dot.
- 3.55 – 4.25: three identical dots slide out from behind it, one to the left and two to the right, starting 0.07 s apart. Each overshoots slightly and settles. The original dot is second from the left.
- 4.25 onward: loader wave. Each dot hops up about two dot-heights and lands, taking 0.48 s. Dots go left to right, 0.13 s apart. The whole pattern repeats every 1.1 s.

**Camera**
- Arrives at 4.6 s and holds: 50 mm, 37 cm away, front-right three-quarter (about 20° to the right), looking down 27°.
- At 5.4 s it starts rising for shot 3.

**Frames:** `04`, `05`.

```
The ball lands and does not rebound. It gives one small hop and shrinks into a small glossy dot about
1.5 cm wide. Three identical dots slide out from behind it, one to the left and two to the right,
overshoot slightly and settle into an evenly spaced row of four. The row then plays a loading
animation: each dot hops up about two dot-heights and lands, one after another from left to right,
followed by a short pause, repeating every 1.1 seconds. All four dots are the same colour and size.
Camera: 50 mm lens, 37 cm away, three-quarter high angle from the front-right, looking down 27
degrees, holding still.
```

## Shot 3: Fingertips (5.750 – 8.250 s)

**Action**
- 5.75 – 6.95: a fingertip grows out of each dot, rising up and back. Left to right, 0.07 s apart, 1 s each.
- 5.9 – 6.9: each dot lifts onto the top of its fingertip and becomes the fingernail.
- The hopping never stops, so the dots' wave becomes fingers drumming on a table.
- 6.4 – 7.7: the back of the hand, thumb, wrist and olive sleeve cuff form outward from the fingertips toward the elbow.
- 8.0 – 8.6: the drumming slows and the hand rests.

**Camera**
- 5.4 – 7.8: rises from shot 2's angle to a steep top-front angle. End: 45 mm, 46 cm from the hand, looking down 52°. Hand centred, wrist toward the top of the frame.

**Frames:** `06`, `07`, end `08`.

```
Four small pearl dots in a row keep hopping one after another. A human fingertip grows out of each
dot, rising up and back from the surface; each dot settles on top of its fingertip and becomes the
fingernail. The fingers keep the same left-to-right rhythm, so they are now drumming on a table. The
back of a right hand, the thumb, the wrist and an olive-green shirt cuff form outward from the
fingertips. The drumming slows and the hand comes to rest, palm down, fingertips on the table, fingers
pointing toward the camera. Camera: 45 mm lens, rising smoothly to a steep top-front angle, looking
down about 50 degrees from 45 cm away, hand centred, wrist toward the top of the frame.
```

## Shot 4: Pull-out and orbit (8.250 – 12.050 s)

**Action**
- The hand stays still. He sits looking down at the laptop; his right hand rests on the desk about 35 cm to his right of the laptop.
- 8.3 – 10.0: the tabletop spreads out from under the hand as the camera lifts away.
- 8.1 – 8.7: the laptop screen comes on, showing the bouncing ball.

**Camera:** one continuous move from 8.25 to 11.75, slow start, fastest around 10.0 s, slow settle. Then a 0.3 s hold.

| Time | Position | Angle | Lens |
|---|---|---|---|
| 8.25 | 46 cm above and in front of the right hand | Down 52° | 45 mm |
| about 9.6 | In front of the desk, 1.9 m from him, 80 cm above the desk, off to his right by about 35° | Down 15°, front three-quarter | 40 mm |
| about 10.35 | Directly to his right, 1.55 m away, 88 cm above the desk | Down 20°, profile | 40 mm |
| 11.75 | Behind his right shoulder: 85 cm behind, 85 cm to the right, 1.0 m above the desk | Down 27°, over the shoulder | 35 mm |

- Final frame: back of his head upper left, right shoulder and arm crossing the frame, laptop screen centre-right, right hand on the desk at right.
- The camera travels to screen-left around him, about 150° of arc.

**Frames:** start `08`, `09`, `10`, end `11`.

```
Start on a right hand resting palm down on a dark desk, seen from above and in front. The camera
pulls back and up in one smooth move to reveal a young man sitting in a chair at the desk, looking
down at an open silver laptop, his right hand resting on the desk beside it. As the camera lifts away,
a thin dark tabletop spreads out from under the hand. The camera keeps arcing around his right side,
past his profile, and settles behind his right shoulder, looking down over it at the laptop. On the
laptop screen a single pearl ball bounces in place. Camera: 35 to 40 mm lens, one continuous orbit of
about 150 degrees over 3.5 seconds with a slow start and a slow settle, then a short hold. Final
frame: back of his head upper left, right shoulder and arm crossing the frame, laptop screen
centre-right, right hand on the desk at right. The man is in his mid-twenties with dark curly tousled
hair, a moustache and light stubble, wearing an olive-khaki overshirt.
```

## Shot 5: Screen push-in (12.050 – 15.000 s)

**Action**
- The ball on the screen keeps the 1.25 s bounce: apex at 12.5 and 13.75, contact at 13.125 and 14.375.
- 14.375 – 15.0: the dark screen surface fades away to the plain background while the ball rises to its apex.
- 15.0 is identical to 0.0: ball at the top, faint glow below, nothing else.

**Camera**
- 12.05 – 14.375: pushes forward over his right shoulder with his head passing on the left of frame, descends to screen height and ends square-on to the screen. Lens tightens from 35 mm to 45 mm.
- At 14.375 the screen fills the frame edge to edge. The camera then holds still.

**Frames:** start `11`, `12`, `13`, `14`, end `15` (same as `01`).

```
Over-the-shoulder view of a man at a laptop. On the screen a single pearl ball bounces in place, 1.25
seconds per bounce. The camera pushes forward over his right shoulder, his head passing out of frame
on the left, descends to screen height and ends square-on to the screen, which fills the frame
completely. The camera then holds still. The dark screen surface fades away to the same flat
background while the ball rises to the top of its bounce. The last frame is only the ball at the top
of its bounce with a faint periwinkle glow below it. Camera: lens tightening from 35 mm to 45 mm, one
2.3 second push with ease-in and ease-out.
```

---

## Making it loop and match

- **Use the stills as first and last frames.** Give each clip the start and end frame listed for its shot, so neighbouring clips share a frame and join without a jump.
- **Retime in an editor.** A generated clip will not land on these timings by itself. Trim and speed each one to the lengths in the timing table.
- **Lock the bounce to 1.25 s.** This is what makes the screen ball line up with the opening ball.
- **Frame `15` must equal frame `01`.** Use the same image for both.
- **Background.** Generated video has no transparency. Either keep the flat `#0B0B10` and use it on the dark theme only, or generate on a flat green and key it out.
