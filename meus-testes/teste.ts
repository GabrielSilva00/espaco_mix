import { Stagehand } from "@browserbasehq/stagehand";
import config from "./stagehand.config";

async function main() {
  let stagehand: Stagehand | null = null;

  try {
    stagehand = new Stagehand(config);
    await stagehand.init();

    console.log("🚀 Iniciando teste...");

    const page = await stagehand.context.awaitActivePage();
    await page.goto("http://localhost:5173");
    console.log("📄 Página carregada");

    const result = await stagehand.act("verifique se a página carregou corretamente");

    console.log("✅ Teste passou!", result);

  } catch (error) {
    console.error("❌ Teste falhou:", error);

    if (stagehand) {
      const page = stagehand.context.activePage();
      if (page) {
        await page.screenshot({ path: `erro-${Date.now()}.png` });
      }
    }
    
    process.exit(1);
  } finally {
    if (stagehand) {
      await stagehand.close();
    }
  }
}

main();