"""
Gera PNGs coloridos do TIFF de Agricultura para renderizacao raster no MapLibre.
Evita a aparencia angular dos poligonos vetoriais ao manter a resolucao do pixel.

Gera:
  public/dados_convertidos/rio_grande/agricultura_raster.png            (BASE)
  public/dados_convertidos/rio_grande/cenarios/
    agricultura_raster_cenario_maio_2024.png
    agricultura_raster_cenario_maio_2024_50.png

Uso: conda run -n climada_env python scripts/converter_agricultura_raster.py
"""

import json
import numpy as np
import geopandas as gpd
import rasterio
from rasterio.warp import calculate_default_transform, reproject, Resampling
from rasterio.mask import mask as rasterio_mask
from rasterio.crs import CRS
from rasterio.transform import array_bounds
from PIL import Image
from pathlib import Path

ROOT        = Path(__file__).parent.parent
TIFF        = ROOT / "scripts/data/agricultura_30m_mapbiomas.tif"
CENARIOS_DIR = ROOT / "public/dados_convertidos/rio_grande/cenarios"
OUT_DIR     = ROOT / "public/dados_convertidos/rio_grande"

TARGET_CRS = CRS.from_epsg(4326)

# Cores RGB por classe agricola (MapaBiomas Col.10)
COLORS = {
    39: (212, 160,  23),   # Soja             — amarelo
    40: ( 79, 195, 247),   # Arroz            — azul claro
    41: (174, 213, 129),   # Outras Lavouras  — verde claro
}
OPACITY = 210  # ~82 %

CENARIOS = {
    "cenario_maio_2024":    CENARIOS_DIR / "rio_grande___cenario_maio_2024.geojson",
    "cenario_maio_2024_50": CENARIOS_DIR / "rio_grande___cenario_maio_2024_50.geojson",
}


def band_to_rgba(band: np.ndarray) -> Image.Image:
    rgba = np.zeros((*band.shape, 4), dtype=np.uint8)
    for class_val, (r, g, b) in COLORS.items():
        m = band == class_val
        rgba[m, 0] = r; rgba[m, 1] = g; rgba[m, 2] = b; rgba[m, 3] = OPACITY
    return Image.fromarray(rgba, "RGBA")


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    print(f"  Salvo: {path.name} ({path.stat().st_size // 1024} KB, {img.size[0]}x{img.size[1]} px)")


# ── Ler e reprojetar para EPSG:4326 ───────────────────────────────────────────

print("1. Lendo TIFF e reprojetando para EPSG:4326...")
with rasterio.open(TIFF) as src:
    src_crs = src.crs
    if src_crs.to_epsg() == 4326:
        band_base = src.read(1)
        dst_transform = src.transform
        dst_width, dst_height = src.width, src.height
    else:
        dst_transform, dst_width, dst_height = calculate_default_transform(
            src_crs, TARGET_CRS, src.width, src.height, *src.bounds
        )
        band_base = np.zeros((dst_height, dst_width), dtype=src.dtypes[0])
        reproject(
            source=rasterio.band(src, 1),
            destination=band_base,
            src_transform=src.transform,
            src_crs=src_crs,
            dst_transform=dst_transform,
            dst_crs=TARGET_CRS,
            resampling=Resampling.nearest,
        )

left, bottom, right, top = array_bounds(dst_height, dst_width, dst_transform)
print(f"  Bounds EPSG:4326: W={left:.6f} S={bottom:.6f} E={right:.6f} N={top:.6f}")
print(f"  Tamanho: {dst_width} x {dst_height} px")

# ── BASE ──────────────────────────────────────────────────────────────────────

print("\n2. Gerando PNG base...")
save_png(band_to_rgba(band_base), OUT_DIR / "agricultura_raster.png")

# ── Cenarios (mascara com mancha de inundacao) ────────────────────────────────

print("\n3. Gerando PNGs por cenario...")
for slug, mancha_path in CENARIOS.items():
    if not mancha_path.exists():
        print(f"  AVISO: {mancha_path.name} nao encontrado — pulando")
        continue

    mancha = gpd.read_file(mancha_path).to_crs("EPSG:4326")

    with rasterio.open(TIFF) as src:
        mancha_src = mancha.to_crs(src_crs)
        shapes_src  = [f.__geo_interface__ for f in mancha_src.geometry]
        band_masked_src, _ = rasterio_mask(src, shapes_src, crop=False, nodata=0)
        band_masked_src = band_masked_src[0]

        if src_crs.to_epsg() == 4326:
            band_masked = band_masked_src
        else:
            band_masked = np.zeros((dst_height, dst_width), dtype=band_masked_src.dtype)
            reproject(
                source=band_masked_src,
                destination=band_masked,
                src_transform=src.transform,
                src_crs=src_crs,
                dst_transform=dst_transform,
                dst_crs=TARGET_CRS,
                resampling=Resampling.nearest,
            )

    save_png(band_to_rgba(band_masked), CENARIOS_DIR / f"agricultura_raster_{slug}.png")

# ── Imprimir bounds para colar no page.tsx ────────────────────────────────────

print(f"""
Bounds para page.tsx:
const AGRI_RASTER_COORDS: [[number,number],[number,number],[number,number],[number,number]] = [
  [{left:.6f}, {top:.6f}],   // NW
  [{right:.6f}, {top:.6f}],  // NE
  [{right:.6f}, {bottom:.6f}], // SE
  [{left:.6f}, {bottom:.6f}],  // SW
];
""")
print("Concluido.")
