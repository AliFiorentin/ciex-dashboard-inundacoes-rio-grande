import { PerdasClient } from "@/app/perdas/PerdasClient";
import { getPerdasData } from "@/app/perdas/get-data";
import { RouteModal } from "@/components/RouteModal";

export default function PerdasModal() {
  return (
    <RouteModal>
      <PerdasClient dados={getPerdasData()} />
    </RouteModal>
  );
}
