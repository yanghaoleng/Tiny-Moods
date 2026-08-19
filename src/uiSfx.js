import {createUISFX} from "uisfx";

export const uiSfx = createUISFX({
  pack: "cinematic",
  volume: 0.56,
  preferences: {key: "9face:ui-sfx"},
});

let pendingDisableTimer = null;

export function playUISfx(cue, options) {
  return uiSfx.play(cue, options);
}

export async function unlockUISfx() {
  return uiSfx.unlock();
}

export function setUISfxEnabled(enabled) {
  globalThis.clearTimeout(pendingDisableTimer);
  pendingDisableTimer = null;
  uiSfx.setEnabled(enabled);
}

export function disableUISfxWithFeedback() {
  globalThis.clearTimeout(pendingDisableTimer);
  playUISfx("toggle-off");
  pendingDisableTimer = globalThis.setTimeout(() => {
    uiSfx.setEnabled(false);
    pendingDisableTimer = null;
  }, 80);
}

export function isUISfxEnabled() {
  return uiSfx.isEnabled();
}
