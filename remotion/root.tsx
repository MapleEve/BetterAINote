import { Composition } from "remotion";
import { BetterAINoteHero } from "./scenes/betterainote-hero";

export const RemotionRoot = () => {
    return (
        <Composition
            id="BetterAINoteHero"
            component={BetterAINoteHero}
            durationInFrames={120}
            fps={30}
            width={1280}
            height={640}
        />
    );
};
