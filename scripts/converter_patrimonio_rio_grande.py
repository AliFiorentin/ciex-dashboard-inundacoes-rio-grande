"""
Pipeline de conversão de Patrimônio Histórico — Rio Grande
BASE + ATINGIDOS por cenário, EPSG:4326, GeoJSON.
Fonte: patrimHistRG_verificados.shp (levantamento de patrimônio histórico).
"""

import os
import re
import unicodedata
import warnings

import geopandas as gpd

warnings.filterwarnings("ignore")

# ─── Paths ───────────────────────────────────────────────────────────────────

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHP_PATH = r"C:\Users\Alisson Fiorentin\Downloads\patrimHistRG_verificados.shp"
BASE_OUT = f"{ROOT}/public/dados_convertidos/rio_grande"
CENARIOS_DIR = f"{ROOT}/public/dados_convertidos/rio_grande/cenarios"

os.makedirs(BASE_OUT, exist_ok=True)
os.makedirs(CENARIOS_DIR, exist_ok=True)

# ─── Slugify (idêntico ao usado em converter_infra_rio_grande.py) ────────────

def slugify(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")

def scenario_slug(mun: str, cen: str) -> str:
    return f"{slugify(mun)}___{slugify(cen)}"

CENARIOS = {
    "Cenário Maio 2024":       scenario_slug("Rio Grande", "Cenário Maio 2024"),
    "Cenário Maio 2024 + 50%": scenario_slug("Rio Grande", "Cenário Maio 2024 + 50%"),
}

def carregar_mancha(slug: str) -> gpd.GeoDataFrame:
    path = f"{CENARIOS_DIR}/{slug}.geojson"
    gdf = gpd.read_file(path).to_crs("EPSG:4326")
    return gpd.GeoDataFrame(geometry=[gdf.union_all()], crs="EPSG:4326")

# ─── Salvar GeoJSON ──────────────────────────────────────────────────────────

def salvar_geojson(gdf: gpd.GeoDataFrame, path: str):
    if gdf is None or len(gdf) == 0:
        print(f"  ⚠ Vazio, não salvo: {os.path.basename(path)}")
        return
    gdf_out = gdf.to_crs("EPSG:4326").copy()
    for col in ["index_right", "index_left"]:
        if col in gdf_out.columns:
            gdf_out = gdf_out.drop(columns=[col])
    gdf_out.to_file(path, driver="GeoJSON")
    size_kb = os.path.getsize(path) / 1024
    print(f"  ✓ {os.path.basename(path)}  ({len(gdf_out)} feats, {size_kb:.1f} KB)")

# ─── MAIN ────────────────────────────────────────────────────────────────────

print("\n" + "=" * 60)
print("  PIPELINE: Patrimônio Histórico Rio Grande → Dashboard Next.js")
print("=" * 60)

gdf = gpd.read_file(SHP_PATH)
if gdf.crs is None:
    gdf = gdf.set_crs("EPSG:4326")
gdf = gdf.to_crs("EPSG:4326")
gdf = gdf[gdf.geometry.notna() & gdf.geometry.is_valid].copy()
print(f"\nCamada: Patrimônio Histórico ({len(gdf)} features, CRS: {gdf.crs})")

cols = [c for c in ["Label", "ENDEREÇO", "COMPLEMENT", "Tipologia", "Nome"] if c in gdf.columns]
gdf = gdf[cols + ["geometry"]].copy()

salvar_geojson(gdf, f"{BASE_OUT}/patrimonio_BASE.geojson")

for cen_nome, cen_slug in CENARIOS.items():
    mancha = carregar_mancha(cen_slug)
    atingidos = gpd.sjoin(gdf, mancha[["geometry"]], how="inner", predicate="intersects")
    atingidos = atingidos[cols + ["geometry"]].drop_duplicates()
    out_path = f"{CENARIOS_DIR}/patrimonio_ATINGIDOS_{cen_slug}.geojson"
    print(f"  {cen_nome}: {len(atingidos)} atingidos  ", end="")
    salvar_geojson(atingidos, out_path)

print("\n" + "=" * 60)
print("  Conversão concluída!")
print("=" * 60)
