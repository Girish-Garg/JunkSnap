import { CAPTURE_DEFAULTS, type CaptureSettings } from '../config/CaptureSettings';
import { CaptureError, type CaptureProblem } from '../domain/CaptureError';
import { CameraCapture } from './CameraCapture';
import type { FrameCounter } from './FrameCounter';
import type { PageVisibility } from './PageVisibility';
import type { Timer } from './Timer';

export type CameraState = 'starting' | 'live' | CaptureProblem;

/** Why the stream was opened again (or a recording cut short); logged so a field report can tell them apart. */
export type CameraEvent = 'stalled' | 'ended' | 'gave_up' | 'recording_cut';

/** What LiveCamera needs from the <video> element. */
export interface CameraScreen {
  srcObject: MediaProvider | null;
  play(): Promise<void>;
}

/**
 * The watchdog's timings (the config's capture settings): a visible viewfinder with no new frame for cameraStallMs is
 * frozen; it looks every cameraCheckMs; after cameraMaxRestarts restarts in a row without a frame the camera help
 * (Try again) shows.
 */
export type CameraWatchdog = Pick<CaptureSettings, 'cameraStallMs' | 'cameraCheckMs' | 'cameraMaxRestarts'>;

export interface LiveCameraPorts {
  readonly open: () => Promise<MediaStream>;
  readonly page: PageVisibility;
  readonly timer: Timer;
  readonly now: () => number;
  /** Absent: the defaults. */
  readonly watchdog?: CameraWatchdog;
}

export interface LiveCameraView {
  readonly screen: CameraScreen;
  /** Null where the browser cannot report frames: then a track muted for cameraStallMs counts as frozen. */
  readonly frames: FrameCounter | null;
  readonly onState: (state: CameraState) => void;
  readonly onEvent?: (event: CameraEvent, restarts: number) => void;
  /** True while a recording uses the stream: a frozen camera then ends the recording, never reopens under it. */
  readonly holding?: () => boolean;
  /** The camera froze during a recording; the recording should stop and keep its clip. Called once per freeze. */
  readonly onLost?: () => void;
}

/**
 * The viewfinder stream while it is on screen. Android can leave a stream "live" but muted for
 * good, for example when another app had the camera while JunkSnap was in the background: the
 * video then shows its last frame forever. A watchdog opens the stream again when no frame
 * arrives for cameraStallMs while the page is visible, or when the track ends; tries back off.
 * During a Scan recording it does not reopen; it asks the recording to stop, then reopens.
 */
export class LiveCamera {
  readonly #ports: LiveCameraPorts;
  readonly #watchdog: CameraWatchdog;
  readonly #view: LiveCameraView;
  #stream: MediaStream | null = null;
  #state: CameraState = 'starting';
  #stopped = false;
  #opening = false;
  #ended = false;
  #cut = false;
  #seen = -1;
  #quietSince = 0;
  #restarts = 0;
  #check: number | null = null;
  #unsubscribe: (() => void) | null = null;

  constructor(ports: LiveCameraPorts, view: LiveCameraView) {
    this.#ports = ports;
    this.#watchdog = ports.watchdog ?? CAPTURE_DEFAULTS;
    this.#view = view;
  }

  start(): void {
    this.#unsubscribe = this.#ports.page.subscribe(() => this.#pageChanged());
    this.#view.frames?.start();
    this.#seen = this.#view.frames?.count ?? -1;
    this.#open();
    this.#schedule();
  }

  /** Stops every track and timer; a stream that opens later is closed at once. */
  stop(): void {
    this.#stopped = true;
    if (this.#check !== null) this.#ports.timer.clear(this.#check);
    this.#unsubscribe?.();
    this.#view.frames?.stop();
    this.#release();
  }

  #open(): void {
    this.#opening = true;
    this.#ports.open().then(
      (stream) => this.#attach(stream),
      (error: unknown) => this.#failed(error),
    );
  }

  #attach(stream: MediaStream): void {
    this.#opening = false;
    if (this.#stopped) return CameraCapture.close(stream);
    this.#release();
    this.#stream = stream;
    this.#view.screen.srcObject = stream;
    for (const track of stream.getVideoTracks()) track.addEventListener('ended', () => (this.#ended = true));
    this.#play();
    this.#quietSince = this.#ports.now();
    this.#set('live');
  }

  // The first open reports its problem (denied, no camera). A reopen that fails waits for the
  // next check and tries again, since another app may still be letting go of the camera.
  #failed(error: unknown): void {
    this.#opening = false;
    if (this.#stopped) return;
    const problem = error instanceof CaptureError ? error.problem : 'camera_unavailable';
    if (this.#restarts > 0 && problem === 'camera_unavailable') return;
    this.#set(problem);
  }

  #schedule(): void {
    if (!this.#stopped) this.#check = this.#ports.timer.set(() => this.#tick(), this.#watchdog.cameraCheckMs);
  }

  #tick(): void {
    this.#schedule();
    if (!this.#ports.page.visible()) return;
    const moving = this.#progressing();
    if (this.#ended) return this.#lost('ended');
    if (!moving && this.#waiting() && this.#due()) this.#lost('stalled');
  }

  // A recording keeps the stream it started with: end the recording (once), reopen after it.
  #lost(event: CameraEvent): void {
    if (!this.#view.holding?.()) return this.#restart(event);
    if (this.#cut) return;
    this.#cut = true;
    this.#view.onEvent?.('recording_cut', this.#restarts);
    this.#view.onLost?.();
  }

  // Live, or between failed reopens; not while a getUserMedia call is still pending.
  #waiting(): boolean {
    if (this.#opening) return false;
    return this.#state === 'live' || (this.#state === 'starting' && this.#restarts > 0);
  }

  // A new frame (or, without a frame counter, an unmuted track) proves the stream works:
  // the quiet clock and the restart count start over.
  #progressing(): boolean {
    const counter = this.#view.frames;
    const moving = counter ? counter.count !== this.#seen : this.#unmuted();
    if (!moving) return false;
    if (counter) this.#seen = counter.count;
    this.#cut = false;
    this.#quietSince = this.#ports.now();
    if (this.#state === 'live') this.#restarts = 0;
    return true;
  }

  #unmuted(): boolean {
    return this.#stream !== null && this.#stream.getVideoTracks().every((track) => !track.muted);
  }

  // 2 s without progress, then 4, 8 and 16 s between tries.
  #due(): boolean {
    const wait = this.#watchdog.cameraStallMs * 2 ** Math.min(this.#restarts, 3);
    return this.#ports.now() - this.#quietSince >= wait;
  }

  #restart(event: CameraEvent): void {
    this.#ended = false;
    this.#cut = false;
    this.#restarts += 1;
    this.#release();
    this.#quietSince = this.#ports.now();
    if (this.#restarts > this.#watchdog.cameraMaxRestarts) {
      this.#view.onEvent?.('gave_up', this.#restarts - 1);
      return this.#set('camera_unavailable');
    }
    this.#view.onEvent?.(event, this.#restarts);
    this.#set('starting');
    this.#open();
  }

  // Back on screen (after the background, a permission dialog or the lock screen): play again,
  // and give the camera cameraStallMs to deliver before the watchdog judges it.
  #pageChanged(): void {
    if (!this.#ports.page.visible()) return;
    this.#quietSince = this.#ports.now();
    this.#play();
  }

  #play(): void {
    const screen = this.#view.screen;
    if (screen.srcObject) void Promise.resolve().then(() => screen.play()).catch(() => undefined);
  }

  #release(): void {
    if (this.#stream) CameraCapture.close(this.#stream);
    this.#stream = null;
    if (this.#view.screen.srcObject) this.#view.screen.srcObject = null;
  }

  #set(state: CameraState): void {
    if (this.#stopped || state === this.#state) return;
    this.#state = state;
    this.#view.onState(state);
  }
}
