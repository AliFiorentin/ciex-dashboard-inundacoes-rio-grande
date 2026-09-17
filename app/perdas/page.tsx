import type { Metadata } from "next";
import { PerdasClient } from "./PerdasClient";
import { getPerdasData } from "./get-data";

export const metadata: Metadata = {
  title: "Perdas Operacionais — Rio Grande (RS)",
  description: "Estimativa de perdas econômicas operacionais causadas por cenários de inundação em Rio Grande/RS — metodologia DaLA/CEPAL.",
};

export default function PerdasPage() {
  return <PerdasClient dados={getPerdasData()} />;
}
