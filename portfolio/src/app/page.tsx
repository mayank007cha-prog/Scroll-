import { DepthField } from "@/components/DepthField";
import { Footer } from "@/components/Footer";
import { HeroVideo } from "@/components/HeroVideo";
import { ProjectStack } from "@/components/ProjectStack";
import { ScrollStage } from "@/components/ScrollStage";
import { contact, projects } from "@/data/projects";

export default function Home() {
  return (
    <main>
      <ScrollStage>
        <DepthField />
        <HeroVideo src="/video/hero.mp4" webmSrc="/video/hero.webm" poster="/video/hero-poster.jpg" />
        <ProjectStack projects={projects}>
          <Footer {...contact} />
        </ProjectStack>
      </ScrollStage>
    </main>
  );
}
