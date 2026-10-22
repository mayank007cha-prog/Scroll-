import { DepthField } from "@/components/DepthField";
import { Footer } from "@/components/Footer";
import { HeroVideo } from "@/components/HeroVideo";
import { ProjectStack } from "@/components/ProjectStack";
import { ScrollStage } from "@/components/ScrollStage";
import { SceneWarp } from "@/components/SceneWarp";
import { SceneTones } from "@/components/SceneTones";
import { contact, projects } from "@/data/projects";

export default function Home() {
  return (
    <main>
      <ScrollStage>
        <SceneTones tones={["video", ...projects.map((p) => p.tone), "end"]} />
        <DepthField />
        <SceneWarp>
          <HeroVideo src="/video/hero.mp4" webmSrc="/video/hero.webm" poster="/video/hero-poster.jpg" />
          <ProjectStack projects={projects}>
            <Footer {...contact} />
          </ProjectStack>
        </SceneWarp>
      </ScrollStage>
    </main>
  );
}
