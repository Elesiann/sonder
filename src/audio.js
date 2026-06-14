// src/audio.js — optional ambient sound for sonder.
//
// Off by default: browsers block autoplay, and silence should be a choice. Tone
// itself is dynamically imported on the first enable, so it never weighs down
// the initial load — and the AudioContext starts inside the user's click
// gesture (the only time browsers allow it).
//
// Tonality: C-sharp minor — the key of Beethoven's Moonlight Sonata, for that
// hushed, melancholic beauty. Voices are pure/detuned sines (no chiptune edge),
// softened through a lowpass, chorus, and long reverb. The bed is a slow shimmer
// of consonant notes swelling and fading — never a held drone. Noticing a soul
// rings a soft bell with a quiet octave above it, a different note each time.

export function createAudio() {
  let Tone, transport;
  let built = false;
  let on = false;
  let master, pad, bell, reverb, chorus, filter, loop;

  // C# minor — lower register feeds the bed, the brighter notes ring on notice.
  // 12 bell notes across two octaves of the scale; a short memory keeps a note
  // from repeating any of the last three plays, so clicks never feel mechanical.
  const PAD_NOTES = ["C#3", "G#3", "B3", "C#4", "E4", "G#4", "B4"];
  const BELL_NOTES = ["C#4", "D#4", "E4", "F#4", "G#4", "A4", "B4", "C#5", "D#5", "E5", "F#5", "G#5"];
  const recent = []; // the last few bell notes, to avoid repeats

  function build() {
    reverb = new Tone.Reverb({ decay: 12, wet: 0.5 }).toDestination();
    chorus = new Tone.Chorus({ frequency: 0.2, delayTime: 5, depth: 0.45, wet: 0.25 }).connect(reverb).start();
    filter = new Tone.Filter({ frequency: 1500, type: "lowpass", rolloff: -12 }).connect(chorus);
    master = new Tone.Gain(0).connect(filter); // 0 = silent; toggle ramps it

    // a lush, soft pad — detuned sines bloom and dissolve over many seconds
    pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsine", spread: 18, count: 3 },
      envelope: { attack: 5, decay: 3, sustain: 0.2, release: 9 },
    }).connect(master);
    pad.volume.value = -23;
    pad.maxPolyphony = 10;

    // the sound of noticing — a soft sine bell, polyphonic so a note can ring
    // with a quiet octave above it (a piano-like overtone, not a chiptune ping)
    bell = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.006, decay: 2.2, sustain: 0, release: 2.0 },
    }).connect(reverb);
    bell.volume.value = -18;
    bell.maxPolyphony = 8;

    transport = Tone.getTransport();
    transport.bpm.value = 48;
    loop = new Tone.Loop((time) => {
      const n = PAD_NOTES[(Math.random() * PAD_NOTES.length) | 0];
      pad.triggerAttackRelease(n, "2m", time, 0.14 + Math.random() * 0.08);
      if (Math.random() < 0.4) {
        const m = PAD_NOTES[(Math.random() * PAD_NOTES.length) | 0];
        pad.triggerAttackRelease(m, "1m", time + 1.5, 0.09);
      }
    }, "2m").start(0);
    transport.start();

    built = true;
  }

  async function toggle() {
    if (!built) {
      Tone = await import("tone"); // pull the library only when sound is wanted
      await Tone.start(); // resume the AudioContext from within the gesture
      build();
    }
    on = !on;
    master.gain.rampTo(on ? 0.5 : 0, on ? 3 : 1.2);
    return on;
  }

  function pickNote() {
    const pool = BELL_NOTES.filter((n) => !recent.includes(n));
    const n = pool[(Math.random() * pool.length) | 0];
    recent.push(n);
    if (recent.length > 3) recent.shift(); // never repeat any of the last three
    return n;
  }

  function noticed() {
    if (!on || !built) return;
    const n = pickNote();
    const t = Tone.now();
    const vel = 0.28 + Math.random() * 0.18;
    bell.triggerAttackRelease(n, 1.2, t, vel);
    // a quiet octave above for a soft, piano-like sheen — only on the lower
    // notes, so the high ones never turn piercing
    if (Tone.Frequency(n).toFrequency() < 560) {
      bell.triggerAttackRelease(Tone.Frequency(n).transpose(12), 0.9, t + 0.012, vel * 0.4);
    }
  }

  return {
    toggle,
    noticed,
    get on() {
      return on;
    },
  };
}
