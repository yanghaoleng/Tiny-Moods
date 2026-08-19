import {useState} from "react";
import {SpeakerHigh} from "@phosphor-icons/react/SpeakerHigh";
import {SpeakerSlash} from "@phosphor-icons/react/SpeakerSlash";
import {disableUISfxWithFeedback, isUISfxEnabled, playUISfx, setUISfxEnabled, unlockUISfx} from "./uiSfx";

export default function UISoundToggle({className = ""}) {
  const [enabled, setEnabled] = useState(isUISfxEnabled);

  const toggleSound = async () => {
    if (enabled) {
      disableUISfxWithFeedback();
      setEnabled(false);
      return;
    }

    setUISfxEnabled(true);
    setEnabled(true);
    await unlockUISfx();
    playUISfx("toggle-on");
  };

  const label = enabled ? "关闭界面音效" : "开启界面音效";

  return (
    <button
      type="button"
      className={`ui-sfx-toggle ${className}`.trim()}
      onClick={toggleSound}
      data-analytics-action="sound_toggle"
      aria-pressed={enabled}
      aria-label={label}
      title={label}
    >
      {enabled ? <SpeakerHigh weight="bold" aria-hidden="true" /> : <SpeakerSlash weight="bold" aria-hidden="true" />}
      <span className="sr-only">{label}</span>
    </button>
  );
}
