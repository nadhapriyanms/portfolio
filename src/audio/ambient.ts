/**
 * Original ambient score synthesised live with Web Audio — no external files or licences.
 * Two moods: a warm pad for the peaceful city and a pulsing synth for the security layer.
 * Starts only after the visitor turns sound on.
 */
type Mood = 'warm' | 'workshop' | 'cyber' | 'dawn'

class Ambient {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private pads: OscillatorNode[] = []
  private pulseTimer: number | null = null
  private mood: Mood = 'warm'

  private chords: Record<Mood, number[]> = {
    warm: [196, 246.94, 293.66, 392],
    workshop: [174.61, 220, 261.63, 349.23],
    cyber: [146.83, 174.61, 220, 277.18],
    dawn: [220, 277.18, 329.63, 440],
  }

  start() {
    if (this.ctx) {
      void this.ctx.resume()
      this.fade(0.16)
      return
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    this.ctx = ctx
    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    this.master = master

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 900
    filter.Q.value = 0.6
    filter.connect(master)
    this.filter = filter

    // Slow LFO breathing on the filter
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.07
    lfoGain.gain.value = 260
    lfo.connect(lfoGain).connect(filter.frequency)
    lfo.start()

    this.pads = this.chords.warm.map((f, i) => {
      const o = ctx.createOscillator()
      o.type = i % 2 ? 'triangle' : 'sine'
      o.frequency.value = f
      o.detune.value = (i - 1.5) * 6
      const g = ctx.createGain()
      g.gain.value = 0.11
      o.connect(g).connect(filter)
      o.start()
      return o
    })

    const pulseGain = ctx.createGain()
    pulseGain.gain.value = 0
    pulseGain.connect(master)
    void pulseGain

    this.fade(0.16)
    this.setMood(this.mood, true)
  }

  stop() {
    this.fade(0)
    if (this.pulseTimer) window.clearInterval(this.pulseTimer)
    this.pulseTimer = null
    window.setTimeout(() => void this.ctx?.suspend(), 900)
  }

  setMood(mood: Mood, force = false) {
    if (mood === this.mood && !force) return
    this.mood = mood
    const ctx = this.ctx
    if (!ctx || !this.filter) return
    const now = ctx.currentTime
    this.chords[mood].forEach((f, i) => this.pads[i]?.frequency.setTargetAtTime(f, now, 1.2))
    this.filter.frequency.setTargetAtTime(mood === 'cyber' ? 1600 : mood === 'workshop' ? 700 : 950, now, 1.5)
    if (this.pulseTimer) window.clearInterval(this.pulseTimer)
    this.pulseTimer = null
    if (mood === 'cyber') {
      const notes = [293.66, 349.23, 440, 349.23, 523.25, 440]
      let step = 0
      this.pulseTimer = window.setInterval(() => this.blip(notes[step++ % notes.length], 0.05), 230)
    }
  }

  blip(freq = 660, level = 0.06) {
    const ctx = this.ctx
    if (!ctx || !this.master || ctx.state !== 'running') return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'square'
    o.frequency.value = freq
    const now = ctx.currentTime
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(level, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = 2200
    o.connect(f).connect(g).connect(this.master)
    o.start(now)
    o.stop(now + 0.22)
  }

  private fade(to: number) {
    if (!this.ctx || !this.master) return
    this.master.gain.setTargetAtTime(to, this.ctx.currentTime, 0.6)
  }
}

export const ambient = new Ambient()

export function moodForChapter(id: string): Mood {
  if (id === 'cycle-workshop') return 'workshop'
  if (id === 'cyber-city' || id === 'project-skyline' || id === 'achievement-constellation') return 'cyber'
  if (id === 'contact-ending') return 'dawn'
  return 'warm'
}
