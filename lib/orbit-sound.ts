
"use client";

type SoundEngine = {
  context: AudioContext;
  master: GainNode;
  ambientNodes: AudioNode[];
  ambientGain: GainNode | null;
  criticalTimers: number[];
};

let engine: SoundEngine | null = null;

function getEngine(): SoundEngine | null {
  if (typeof window === "undefined") return null;

  if (!engine) {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioContextClass) return null;

    const context = new AudioContextClass();
    const master = context.createGain();

    master.gain.value = 0.7;
    master.connect(context.destination);

    engine = {
      context,
      master,
      ambientNodes: [],
      ambientGain: null,
      criticalTimers: [],
    };
  }

  return engine;
}

export async function unlockOrbitAudio(): Promise<boolean> {
  const sound = getEngine();
  if (!sound) return false;

  try {
    if (sound.context.state !== "running") {
      await sound.context.resume();
    }

    return sound.context.state === "running";
  } catch (error) {
    console.error("Unable to start ORBIT audio:", error);
    return false;
  }
}

export async function startAmbientSound(): Promise<boolean> {
  const sound = getEngine();
  if (!sound) return false;

  try {
    if (sound.context.state !== "running") {
      await sound.context.resume();
    }

    if (sound.ambientGain) {
      return sound.context.state === "running";
    }

    const { context, master } = sound;
    const now = context.currentTime;

    const ambientGain = context.createGain();
    ambientGain.gain.setValueAtTime(0.0001, now);
    ambientGain.gain.exponentialRampToValueAtTime(0.12, now + 3);
    ambientGain.connect(master);

    sound.ambientGain = ambientGain;

    // Low, soft drone tones.
    const frequencies = [55, 82.41, 110, 164.81];

    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const voiceGain = context.createGain();

      oscillator.type = index === 1 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      voiceGain.gain.value = index === 0 ? 0.32 : 0.1;

      oscillator.connect(voiceGain);
      voiceGain.connect(ambientGain);
      oscillator.start();

      sound.ambientNodes.push(oscillator, voiceGain);
    });

    // Very slow modulation creates a gentle, drifting atmosphere.
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();

    lfo.type = "sine";
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 0.025;

    lfo.connect(lfoGain);
    lfoGain.connect(ambientGain.gain);
    lfo.start();

    sound.ambientNodes.push(lfo, lfoGain);

    return true;
  } catch (error) {
    console.error("Unable to start ambient sound:", error);
    return false;
  }
}

export function stopAmbientSound(): void {
  const sound = engine;
  if (!sound?.ambientGain) return;

  const gain = sound.ambientGain;
  const now = sound.context.currentTime;

  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

  window.setTimeout(() => {
    sound.ambientNodes.forEach((node) => {
      try {
        if (node instanceof OscillatorNode) node.stop();
        node.disconnect();
      } catch {
        // The node may already have stopped.
      }
    });

    gain.disconnect();
    sound.ambientNodes = [];
    sound.ambientGain = null;
  }, 600);
}

export async function playWarningSound(): Promise<void> {
  const sound = getEngine();
  if (!sound) return;

  try {
    if (sound.context.state !== "running") {
      await sound.context.resume();
    }
    if (sound.context.state !== "running") return;

    const { context, master } = sound;
    const now = context.currentTime;

    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + index * 0.16;

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

      oscillator.connect(gain);
      gain.connect(master);

      oscillator.start(start);
      oscillator.stop(start + 0.24);
    });
  } catch (error) {
    console.error("Unable to play warning sound:", error);
  }
}

export async function playCriticalSound(): Promise<void> {
  const sound = getEngine();
  if (!sound) return;

  try {
    if (sound.context.state !== "running") {
      await sound.context.resume();
    }
    if (sound.context.state !== "running") return;

    stopCriticalSound();

    const { context, master } = sound;

    // Three urgent siren sweeps, then stop automatically.
    for (let i = 0; i < 3; i++) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + i * 0.72;

      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(620, start);
      oscillator.frequency.linearRampToValueAtTime(920, start + 0.3);
      oscillator.frequency.linearRampToValueAtTime(620, start + 0.6);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.04);
      gain.gain.setValueAtTime(0.12, start + 0.48);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.62);

      oscillator.connect(gain);
      gain.connect(master);

      oscillator.start(start);
      oscillator.stop(start + 0.65);

      sound.criticalTimers.push(
        window.setTimeout(() => {
          try {
            oscillator.disconnect();
            gain.disconnect();
          } catch {
            // Already disconnected.
          }
        }, (i * 0.72 + 0.8) * 1000)
      );
    }
  } catch (error) {
    console.error("Unable to play critical sound:", error);
  }
}

export function stopCriticalSound(): void {
  const sound = engine;
  if (!sound) return;

  sound.criticalTimers.forEach((timer) => window.clearTimeout(timer));
  sound.criticalTimers = [];
}

export function setOrbitMasterVolume(volume: number): void {
  const sound = getEngine();
  if (!sound) return;

  sound.master.gain.setTargetAtTime(
    Math.max(0, Math.min(1, volume)),
    sound.context.currentTime,
    0.05
  );
}
