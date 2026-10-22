import { DepthField } from "@/components/DepthField";
import { Footer } from "@/components/Footer";
import { HeroVideo } from "@/components/HeroVideo";
import { ProjectStack } from "@/components/ProjectStack";
import { ScrollStage } from "@/components/ScrollStage";
import { SceneWarp } from "@/components/SceneWarp";
import { SceneEdges, SceneTones } from "@/components/SceneTones";
import { contact, projects } from "@/data/projects";

const tones = ["video", ...projects.map((p) => p.tone), "end"];

export default function Home() {
  return (
    <main>
      <ScrollStage>
        <SceneTones tones={tones} />
        <DepthField />
        <SceneWarp>
          <HeroVideo src="/video/hero.mp4" webmSrc="/video/hero.webm" poster="/video/hero-poster.jpg" />
          <ProjectStack projects={projects}>
            <Footer {...contact} />
          </ProjectStack>
        </SceneWarp>
        <SceneEdges tones={tones} />
      </ScrollStage>
    </main>
  );
}
