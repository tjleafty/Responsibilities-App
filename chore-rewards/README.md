# Chore Rewards for Overskill

12 celebration animations that play when a kid finishes a chore. They match the app's 12 themes
(colors, font, background, and what kids earn: stars, shells, planets, dino eggs...).

Open **preview.html** in a browser to see every reward in every theme, with sound.

## What to upload to Overskill

Upload these files into your project (keep the folders):

| File | What it does |
|---|---|
| `lib/rewards.js` | Draws the animations (no other libraries needed) |
| `lib/sounds.js` | Makes the sound effects in the browser (no audio files needed) |
| `lib/RewardOverlay.jsx` | Ready-made React component that shows a reward full screen |
| `themes/themes.json` | The 12 app themes the rewards read their look from |

Optional: `sounds/*.wav` if you'd rather play audio files, and `videos/*.mp4` if you'd rather use plain videos (Sunny Room theme only, 1080×1080).

## Prompt to paste into Overskill

> I uploaded `lib/rewards.js`, `lib/sounds.js`, `lib/RewardOverlay.jsx` and `themes/themes.json`.
> When a kid marks a chore done, show `<RewardOverlay>` full screen using the kid's current theme
> from themes.json, and hide it when its `onDone` fires. Use these rewards:
> - each chore completed: `star-shower`
> - all of today's chores done: `trophy`
> - points earned: `coin-jar` with `text={{ points: <points earned> }}`
> - streak: `streak-flame` with `text={{ streak: <days in a row> }}`
> - new badge: `badge-unlock` with `text={{ title: <badge name> }}`
> - new level: `rocket-level-up` with `text={{ level: <level number> }}`
> - full week completed: `fireworks`

## All 12 rewards

| id | Length | Good for |
|---|---|---|
| `check-pop` | 2.2 s | Quick tick on every chore |
| `star-shower` | 3.6 s | A chore done (same ending as the how-to videos) |
| `balloons` | 4.4 s | A chore done, younger kids |
| `mascot-dance` | 4.2 s | A chore done, the kid mascot cheers |
| `coin-jar` | 4.2 s | Points or allowance earned (`points`) |
| `treasure-chest` | 4.8 s | A prize unlocked |
| `confetti-cannon` | 3.8 s | A whole routine finished |
| `streak-flame` | 4.2 s | Days in a row (`streak`) |
| `badge-unlock` | 4.2 s | New badge (`title`) |
| `trophy` | 4.6 s | All of today's chores done |
| `rocket-level-up` | 4.6 s | New level (`level`) |
| `fireworks` | 4.8 s | Biggest milestones |

Any words on screen can be changed with `text`, e.g. `text={{ title: 'Room is clean!', subtitle: 'Nice work, Maya' }}`.

## Without React

```html
<canvas id="reward"></canvas>
<script src="lib/rewards.js"></script>
<script src="lib/sounds.js"></script>
<script>
  RewardSounds.play('trophy');   // sound only plays after the user has tapped something
  Rewards.play(document.getElementById('reward'), 'trophy', {
    theme: Rewards.adaptTheme(currentTheme),   // an entry from themes.json
    transparent: true, scrim: 0.25,
    onDone: () => { /* hide the canvas */ },
  });
</script>
```
