"""
Pipeline de conversão de infraestrutura — Rio Grande
BASE + ATINGIDOS por cenário, EPSG:4326, GeoJSON.
Fonte: PMRG_231215_layer_* (Streamlit/Dados) + Excels para Prédios/Segurança.
"""

import os
import re
import unicodedata
import warnings

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point

warnings.filterwarnings("ignore")

# ─── Paths ───────────────────────────────────────────────────────────────────

ROOT     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS    = "/home/alisson/Downloads/Dashboard CIEX (Streamlit)/Dados"
INFRA_OUT    = f"{ROOT}/public/dados_convertidos/rio_grande/infraestrutura"
CENARIOS_DIR = f"{ROOT}/public/dados_convertidos/rio_grande/cenarios"

os.makedirs(INFRA_OUT, exist_ok=True)

# ─── Slugify ─────────────────────────────────────────────────────────────────

def slugify(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "_", s)
    return s.strip("_")

def scenario_slug(mun: str, cen: str) -> str:
    return f"{slugify(mun)}___{slugify(cen)}"

# ─── Cenários disponíveis ─────────────────────────────────────────────────────

CENARIOS = {
    "Cenário Maio 2024":       scenario_slug("Rio Grande", "Cenário Maio 2024"),
    "Cenário Maio 2024 + 50%": scenario_slug("Rio Grande", "Cenário Maio 2024 + 50%"),
}

def carregar_mancha(slug: str) -> gpd.GeoDataFrame:
    path = f"{CENARIOS_DIR}/{slug}.geojson"
    gdf = gpd.read_file(path).to_crs("EPSG:4326")
    return gpd.GeoDataFrame(geometry=[gdf.unary_union], crs="EPSG:4326")

# ─── Interseção ──────────────────────────────────────────────────────────────

def intersectar_infra(layer: gpd.GeoDataFrame, mancha: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """
    Pontos  → sjoin within   (ponto está dentro ou não, sem recorte)
    Linhas  → overlay intersection  (recorta o segmento exato dentro da mancha)
    Polígonos → overlay intersection (recorta o polígono exato dentro da mancha)
    """
    geom_type = layer.geom_type.dropna().iloc[0] if len(layer) > 0 else "Point"

    if "Point" in geom_type:
        result = gpd.sjoin(layer, mancha[["geometry"]], how="inner", predicate="within")
        result = result[layer.columns]
        return result.drop_duplicates()

    # Linhas e Polígonos — recorte geométrico exato
    data_cols = [c for c in layer.columns if c != "geometry"]
    try:
        result = gpd.overlay(layer, mancha[["geometry"]], how="intersection", keep_geom_type=True)
    except Exception:
        result = gpd.overlay(layer, mancha[["geometry"]], how="intersection")

    cols_keep = [c for c in data_cols if c in result.columns] + ["geometry"]
    result = result[cols_keep].copy()
    result = result[result.geometry.notna() & result.geometry.is_valid].copy()

    # Remove fragmentos degenerados
    if "Line" in geom_type:
        result = result[result.geometry.length > 1e-9].copy()
    else:
        result = result[result.geometry.area > 1e-12].copy()

    return result

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
    size_mb = os.path.getsize(path) / 1024 / 1024
    print(f"  ✓ {os.path.basename(path)}  ({len(gdf_out)} feats, {size_mb:.1f} MB)")

# ─── Processar camada ────────────────────────────────────────────────────────

def processar_camada(nome: str, gdf: gpd.GeoDataFrame):
    slug = slugify(nome)
    print(f"\n{'='*60}")
    print(f"  Camada: {nome}  ({len(gdf)} features, CRS: {gdf.crs})")

    gdf = gdf.to_crs("EPSG:4326")
    gdf = gdf[gdf.geometry.notna() & gdf.geometry.is_valid].copy()
    print(f"  → Após limpeza: {len(gdf)} features")

    salvar_geojson(gdf, f"{INFRA_OUT}/{slug}_BASE.geojson")

    for cen_nome, cen_slug in CENARIOS.items():
        mancha = carregar_mancha(cen_slug)
        atingidos = intersectar_infra(gdf, mancha)
        out_path = f"{CENARIOS_DIR}/infra_{slug}_ATINGIDOS_{cen_slug}.geojson"
        print(f"  {cen_nome}: {len(atingidos)} atingidos  ", end="")
        salvar_geojson(atingidos, out_path)

# ─── Carregar shapefile PMRG (EPSG:31982) ────────────────────────────────────

def carregar_shp(caminho: str) -> gpd.GeoDataFrame:
    gdf = gpd.read_file(caminho)
    if gdf.crs is None:
        gdf = gdf.set_crs("EPSG:31982")
    return gdf

# ─── MAIN ────────────────────────────────────────────────────────────────────

print("\n" + "="*60)
print("  PIPELINE: Infraestrutura Rio Grande → Dashboard Next.js")
print("="*60)

# 1. Logradouros — tipo, nome, drenagem, iluminacao (flags 0/1)
gdf_log = carregar_shp(f"{DADOS}/PMRG_231215_layer_Logradouros_segmentos.shp")
gdf_log = gdf_log[gdf_log.geom_type.isin(["LineString", "MultiLineString"])].copy()
cols_log = [c for c in ["tipo", "nome", "drenagem", "iluminacao", "compriment"] if c in gdf_log.columns]
gdf_log = gdf_log[cols_log + ["geometry"]].copy()
processar_camada("Logradouros", gdf_log)

# 2. Quadras — area, numero
gdf_qua = carregar_shp(f"{DADOS}/PMRG_231215_layer_Quadras.shp")
cols_qua = [c for c in ["numero", "area"] if c in gdf_qua.columns]
gdf_qua = gdf_qua[cols_qua + ["geometry"]].copy()
processar_camada("Quadras", gdf_qua)

# 3. Terrenos — agua, coleta_lix, esgoto_plu, esgoto_clo, condominio, area_lote
gdf_ter = carregar_shp(f"{DADOS}/PMRG_231215_layer_Terrenos.shp")
cols_ter = [c for c in ["area_lote", "agua", "coleta_lix", "esgoto_plu", "esgoto_clo", "condominio"] if c in gdf_ter.columns]
gdf_ter = gdf_ter[cols_ter + ["geometry"]].copy()
processar_camada("Terrenos", gdf_ter)

# 4. Prédios Públicos (Excel → pontos)
df_pp = pd.read_excel(f"{DADOS}/parcial prédios públicos.xlsx")
df_pp = df_pp.dropna(subset=["Latitude", "Longitude"])
gdf_pp = gpd.GeoDataFrame(
    df_pp,
    geometry=[Point(lon, lat) for lat, lon in zip(df_pp["Latitude"], df_pp["Longitude"])],
    crs="EPSG:4326"
)
processar_camada("Prédios Públicos", gdf_pp)

# 5. Segurança (Excel → pontos)
df_seg = pd.read_excel(f"{DADOS}/parcial segurança.xlsx")
df_seg = df_seg.dropna(subset=["Latitude", "Longitude"])
gdf_seg = gpd.GeoDataFrame(
    df_seg,
    geometry=[Point(lon, lat) for lat, lon in zip(df_seg["Latitude"], df_seg["Longitude"])],
    crs="EPSG:4326"
)
processar_camada("Segurança", gdf_seg)

print("\n" + "="*60)
print("  Conversão concluída!")
print("="*60)

print("\nArquivos em infraestrutura/:")
for f in sorted(os.listdir(INFRA_OUT)):
    size = os.path.getsize(f"{INFRA_OUT}/{f}") / 1024 / 1024
    print(f"  {f:50s}  {size:6.1f} MB")

print("\nArquivos ATINGIDOS em cenarios/:")
for f in sorted(f for f in os.listdir(CENARIOS_DIR) if "infra_" in f):
    size = os.path.getsize(f"{CENARIOS_DIR}/{f}") / 1024 / 1024
    print(f"  {f:75s}  {size:6.1f} MB")
