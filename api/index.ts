import { createExpressApp } from "../server.js";
import type { Application } from "express";

// A promise é resolvida uma vez por instância (warm start reutiliza o app)
const appPromise: Promise<Application> = createExpressApp();

export default async function handler(req: any, res: any) {
  const app = await appPromise;
  app(req, res);
}
