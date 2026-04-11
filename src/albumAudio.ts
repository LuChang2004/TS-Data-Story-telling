const CROSSFADE_MS = 1400;

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * One mp3 per album number under `public/TS Music/{n}.mp3`.
 * Uses two HTMLAudioElement instances for crossfade (previous fades out while next fades in).
 */
export function createAlbumAudioController(options: {
  maxAlbum: number;
  /** Default `/TS Music` (served from `public/TS Music/`). */
  basePath?: string;
}) {
  const basePath = options.basePath ?? "/TS Music";
  const maxAlbum = options.maxAlbum;
  const a = new Audio();
  const b = new Audio();
  a.preload = "auto";
  b.preload = "auto";

  let playingEl: HTMLAudioElement | null = null;
  let currentAlbum: number | null = null;
  let raf = 0;
  let unlocked = false;
  let pendingAlbum: number | null = null;

  function urlFor(n: number): string {
    return `${basePath}/${n}.mp3`;
  }

  function cancelRaf(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /** Stop stray playback on the non-primary element. */
  function syncPausedState(): void {
    if (playingEl === a && !b.paused) {
      b.pause();
      b.volume = 1;
    } else if (playingEl === b && !a.paused) {
      a.pause();
      a.volume = 1;
    }
  }

  function crossfadeTo(albumNum: number): void {
    cancelRaf();

    if (albumNum < 1 || albumNum > maxAlbum) {
      const out = playingEl;
      if (!out) {
        currentAlbum = null;
        return;
      }
      const v0 = out.volume;
      const start = performance.now();
      function fadeOut(now: number) {
        const t = Math.min(1, (now - start) / CROSSFADE_MS);
        out.volume = v0 * (1 - smoothstep(t));
        if (t < 1) {
          raf = requestAnimationFrame(fadeOut);
        } else {
          out.pause();
          out.volume = 1;
          playingEl = null;
          currentAlbum = null;
          raf = 0;
        }
      }
      raf = requestAnimationFrame(fadeOut);
      return;
    }

    if (!unlocked) {
      pendingAlbum = albumNum;
      return;
    }

    if (currentAlbum === albumNum && playingEl && !playingEl.paused) {
      const other = playingEl === a ? b : a;
      if (!other.paused) {
        other.pause();
        other.volume = 1;
      }
      return;
    }

    syncPausedState();

    const outgoing = playingEl;
    const incoming: HTMLAudioElement = outgoing === a ? b : outgoing === b ? a : a;

    incoming.pause();
    incoming.src = urlFor(albumNum);
    incoming.volume = 0;
    incoming.currentTime = 0;
    void incoming.play().catch(() => {});

    const outStartVol = outgoing?.volume ?? 0;
    const start = performance.now();

    function tick(now: number): void {
      const t = Math.min(1, (now - start) / CROSSFADE_MS);
      const k = smoothstep(t);
      if (outgoing) outgoing.volume = outStartVol * (1 - k);
      incoming.volume = k;
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        if (outgoing) {
          outgoing.pause();
          outgoing.volume = 1;
        }
        incoming.volume = 1;
        playingEl = incoming;
        currentAlbum = albumNum;
        raf = 0;
      }
    }
    raf = requestAnimationFrame(tick);
  }

  function unlock(): void {
    if (unlocked) return;
    unlocked = true;
    const p = pendingAlbum;
    pendingAlbum = null;
    if (p != null) crossfadeTo(p);
  }

  return {
    crossfadeTo,
    unlock,
    getCurrentAlbum: () => currentAlbum,
  };
}
