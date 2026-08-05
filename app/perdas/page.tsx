import type { Metadata } from "next";
import { readFileSync } from "fs";
import { join } from "path";
import { PerdasClient } from "./PerdasClient";
import type { PerdasData } from "./PerdasClient";

export const metadata: Metadata = {
  title: "Perdas Operacionais — Rio Grande (RS)",
  description: "Estimativa de perdas econômicas operacionais causadas por cenários de inundação em Rio Grande/RS — metodologia DaLA/CEPAL.",
};

export default function PerdasPage() {
  let dados: PerdasData = {};
  try {
    const p = join(process.cwd(), "public", "dados_convertidos", "perdas_operacionais.json");
    dados = JSON.parse(readFileSync(p, "utf8"));
  } catch { /* graceful degradation */ }

  return <PerdasClient dados={dados} />;
}
