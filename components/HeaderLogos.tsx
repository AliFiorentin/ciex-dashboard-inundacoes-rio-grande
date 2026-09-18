import Image from "next/image";

/**
 * Selo de logos (CIEX/GPEA) para o canto direito dos headers escuros de
 * /perdas e /metodologia — mesmo padrão de chip branco usado no header
 * principal do dashboard.
 */
export function HeaderLogos() {
  return (
    <div className="hidden sm:flex items-center gap-2 shrink-0 print:hidden">
      <div className="relative bg-white rounded-md h-9 w-16 p-1">
        <Image src="/CIEX2.png" alt="CIEX" fill className="object-contain p-1" />
      </div>
      <div className="relative bg-white rounded-md h-9 w-16 p-1">
        <Image src="/GPEA.png" alt="GPEA" fill className="object-contain p-1" />
      </div>
    </div>
  );
}
