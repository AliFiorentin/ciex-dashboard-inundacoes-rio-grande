import { readFileSync } from "fs";
import { join } from "path";
import type { PerdasData } from "./PerdasClient";

export function getPerdasData(): PerdasData {
  try {
    const p = join(process.cwd(), "public", "dados_convertidos", "perdas_operacionais.json");
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}
