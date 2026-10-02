// Drop-in React component that plays a chore reward over the app.
//
//   import RewardOverlay from './lib/RewardOverlay';
//   import themes from './themes/themes.json';
//
//   <RewardOverlay
//     reward="star-shower"                       // any id from the list in README
//     theme={themes.themes.find(t => t.id === kid.themeId)}
//     text={{ streak: 6 }}                        // optional words/numbers
//     onDone={() => setShowReward(false)}
//   />
//
// Render it only while the reward should show (e.g. {showReward && <RewardOverlay ... />}).
import { useEffect, useRef } from 'react';
import './rewards.js';   // defines window.Rewards
import './sounds.js';    // defines window.RewardSounds

export default function RewardOverlay({ reward = 'star-shower', theme, text, sound = true, onDone }) {
  const canvasRef = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    fit();
    window.addEventListener('resize', fit);
    let src = null;
    if (sound && window.RewardSounds) {
      try { src = window.RewardSounds.play(reward); } catch (e) { /* audio blocked until a tap */ }
    }
    const stop = window.Rewards.play(canvas, reward, {
      theme: window.Rewards.adaptTheme(theme),
      text,
      transparent: true,
      scrim: 0.25,
      onDone: () => doneRef.current && doneRef.current(),
    });
    return () => { stop(); window.removeEventListener('resize', fit); if (src) try { src.stop(); } catch (e) {} };
  }, [reward, theme, sound, JSON.stringify(text || {})]);

  return (
    <canvas
      ref={canvasRef}
      onClick={() => doneRef.current && doneRef.current()}
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 9999, cursor: 'pointer' }}
      aria-label="Chore complete celebration"
    />
  );
}
