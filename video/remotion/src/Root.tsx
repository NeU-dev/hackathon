import { loadFont } from "@remotion/fonts";
import { Composition, staticFile } from "remotion";
import { HackathonVideo } from "./Video";

loadFont({ family: "Zen Maru Gothic", url: staticFile("fonts/ZenMaruGothic-Medium.ttf"), weight: "500" });
loadFont({ family: "Zen Maru Gothic", url: staticFile("fonts/ZenMaruGothic-Bold.ttf"), weight: "700" });
loadFont({ family: "Klee One", url: staticFile("fonts/KleeOne-SemiBold.ttf"), weight: "600" });

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HackathonV4"
        component={HackathonVideo}
        durationInFrames={5400}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
