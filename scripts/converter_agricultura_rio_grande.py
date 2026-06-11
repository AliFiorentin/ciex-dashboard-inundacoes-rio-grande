"""
Converte o TIFF de Agricultura 30m do MapaBiomas (Colecao 10) para GeoJSONs do dashboard CIEX.
Usa o TIFF de Uso Agricola (30m) que tem Soja/Arroz/Outras separadas.
Clipa ao limite real do municipio de Rio Grande (RS).

Classes agricolas (Colecao 10):
  39 = Soja
  40 = Arroz
  41 = Outras Lavouras Temporarias
  (49 e 50 = Restinga -- NAO sao agricultura na Colecao 10)

Gera:
  public/dados_convertidos/rio_grande/agricultura_BASE.geojson
  public/dados_convertidos/rio_grande/cenarios/
    agricultura_ATINGIDOS_rio_grande___cenario_maio_2024.geojson
    agricultura_ATINGIDOS_rio_grande___cenario_maio_2024_50.geojson

Requer: rasterio, geopandas, numpy, shapely (conda: climada_env)
Uso:    conda run -n climada_env python scripts/converter_agricultura_rio_grande.py
"""

import re
import unicodedata
from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio
from rasterio.features import shapes
from rasterio.mask import mask as rasterio_mask
from shapely.geometry import shape

# -- Configuracao --------------------------------------------------------------

ROOT     = Path(__file__).parent.parent
TIFF     = ROOT / "scripts/data/agricultura_30m_mapbiomas.tif"
LIMITE   = ROOT / "scripts/data/rio_grande_limite.geojson"
OUT_BASE     = ROOT / "public/dados_convertidos/rio_grande/agricultura_BASE.geojson"
CENARIOS_DIR = ROOT / "public/dados_convertidos/rio_grande/cenarios"

# Codigos corretos Colecao 10 — apenas agricultura real
CLASSES_AGRI = {
    39: "Soja",
    40: "Arroz",
    41: "Outras Lavouras Temporarias",
}

CENARIOS = {
    "cenario_maio_2024":    "rio_grande___cenario_maio_2024.geojson",
    "cenario_maio_2024_50": "rio_grande___cenario_maio_2024_50.geojson",
}

SIMPLIFY_TOL  = 0.0003   # ~30m — preserva forma dos polígonos
MIN_AREA_DEG2 = 0.000005  # ~0.5 ha


def vectorizar_tiff(tiff_path: Path, limite_path: Path) -> gpd.GeoDataFrame:
    print(f"  Lendo limite: {limite_path.name}...")
    limite = gpd.read_file(limite_path).to_crs("EPSG:4326")
    shapes_limite = [f.__geo_interface__ for f in limite.geometry]

    print(f"  Lendo {tiff_path.name} e clipando ao municipio...")
    with rasterio.open(tiff_path) as src:
        band_clipped, transform = rasterio_mask(src, shapes_limite, crop=True, nodata=0)
        band = band_clipped[0]
        crs  = src.crs

    mascara = np.isin(band, list(CLASSES_AGRI.keys()))
    print(f"    Pixels agricolas: {mascara.sum():,}")

    geoms = []
    for geom, val in shapes(band, mask=mascara.astype(np.uint8), transform=transform):
        classe = int(val)
        if classe in CLASSES_AGRI:
            geoms.append({
                "geometry":     shape(geom),
                "classe":       classe,
                "tipo_cultura": CLASSES_AGRI[classe],
            })

    gdf = gpd.GeoDataFrame(geoms, crs=crs).to_crs("EPSG:4326")
    print(f"    {len(gdf):,} poligonos antes da simplificacao")

    gdf["geometry"] = gdf["geometry"].simplify(SIMPLIFY_TOL, preserve_topology=True)
    gdf = gdf[gdf.geometry.area > 0].copy()

    # Clipa ao limite para remover artefatos nas bordas
    gdf = gpd.clip(gdf, limite)
    print(f"    {len(gdf):,} poligonos apos clip")

    # Dissolve por cultura
    gdf = gdf.dissolve(by="tipo_cultura").reset_index()
    gdf["classe"] = gdf["tipo_cultura"].map({v: k for k, v in CLASSES_AGRI.items()})
    print(f"    {len(gdf):,} cultivos apos dissolve")

    # Suaviza bordas de pixel com buffer round-trip
    gdf["geometry"] = gdf.geometry.buffer(0.0003, join_style=1, resolution=8).buffer(-0.0003, join_style=1, resolution=8)
    gdf = gdf[gdf.geometry.is_valid & (gdf.geometry.area > 0)].copy()

    return gdf[["tipo_cultura", "classe", "geometry"]]


def salvar_geojson(gdf: gpd.GeoDataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    gdf.to_file(path, driver="GeoJSON")
    size_kb = path.stat().st_size / 1024
    print(f"    Salvo: {path.name} ({size_kb:.0f} KB)")


def intersectar_com_cenario(base: gpd.GeoDataFrame, mancha_path: Path) -> gpd.GeoDataFrame:
    mancha = gpd.read_file(mancha_path).to_crs("EPSG:4326")
    atingidos = gpd.overlay(base, mancha[["geometry"]], how="intersection")
    return atingidos[["tipo_cultura", "classe", "geometry"]].copy()


# -- Main ----------------------------------------------------------------------

if __name__ == "__main__":
    print("=== Converter Agricultura 30m MapaBiomas (Col.10) -> GeoJSON ===\n")

    print("1. Vetorizando TIFF (clipado ao municipio)...")
    base = vectorizar_tiff(TIFF, LIMITE)

    print("\n2. Salvando BASE...")
    salvar_geojson(base, OUT_BASE)

    print("\n3. Intersectando com cenarios de inundacao...")
    for slug, mancha_file in CENARIOS.items():
        mancha_path = CENARIOS_DIR / mancha_file
        if not mancha_path.exists():
            print(f"    AVISO: {mancha_file} nao encontrado -- pulando")
            continue
        print(f"  {slug}...")
        atingidos = intersectar_com_cenario(base, mancha_path)
        out = CENARIOS_DIR / f"agricultura_ATINGIDOS_rio_grande___{slug}.geojson"
        salvar_geojson(atingidos, out)

    print("\nConcluido.")
