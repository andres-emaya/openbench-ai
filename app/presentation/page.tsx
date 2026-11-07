import { readFile } from "node:fs/promises";
import path from "node:path";

export default async function PresentationPage() {
  const deckPath = path.join(process.cwd(), "OpenBench-AI-Professor-Deck.html");
  const deckHtml = await readFile(deckPath, "utf8");

  return (
    <main className="h-screen w-screen overflow-hidden bg-background">
      <iframe
        title="OpenBench AI presentation deck"
        srcDoc={deckHtml}
        className="h-full w-full border-0"
      />
    </main>
  );
}
