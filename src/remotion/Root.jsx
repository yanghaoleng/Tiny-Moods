import "@fontsource-variable/nunito";
import {Composition} from "remotion";
import {
  SHORT_LOOK_COUNT,
  SHORT_VIDEO_FRAMES,
  VIDEO_FPS,
  VIDEO_FRAMES,
} from "./config";
import {JennieVideo} from "./JennieVideo";
import "./video.css";

const sharedProps = {
  title: "Jennie",
  brand: "JENNIE 100",
  cornerText: "made for Jennie",
  avatarUrls: [],
  themes: [],
  appearance: {backgroundMode: "color", patternStyle: "dots", decorations: true},
};

export const RemotionRoot = () => (
  <>
    <Composition
      id="FaceNineLooksVideo"
      component={JennieVideo}
      durationInFrames={SHORT_VIDEO_FRAMES}
      fps={VIDEO_FPS}
      width={1080}
      height={1920}
      defaultProps={{...sharedProps, brand: "JENNIE 9", lookCount: SHORT_LOOK_COUNT}}
    />
    <Composition
      id="Jennie100Video"
      component={JennieVideo}
      durationInFrames={VIDEO_FRAMES}
      fps={VIDEO_FPS}
      width={1080}
      height={1920}
      defaultProps={{...sharedProps, lookCount: 100}}
    />
  </>
);
