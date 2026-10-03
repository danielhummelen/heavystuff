let ctx: AudioContext | null = null

/** Must be called from a user gesture (e.g. tapping "Record set") so iOS allows audio later. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    // audio not available
  }
}

export function beep() {
  if (!ctx) unlockAudio()
  if (!ctx) return
  const now = ctx.currentTime
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    osc.connect(gain)
    gain.connect(ctx.destination)
    const t = now + i * 0.25
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    osc.start(t)
    osc.stop(t + 0.2)
  }
}

export function vibrate() {
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
}

export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator
