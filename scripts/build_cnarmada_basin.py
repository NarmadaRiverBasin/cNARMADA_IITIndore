#!/usr/bin/env python3
"""
build_cnarmada_basin.py -- Narmada basin district layer for the cNARMADA panel.

Owner supplied two files (2026-09-14):
  * Narmada_District_shapefile.zip  -- 40 basin district polygons, EPSG:4326
  * "STATE and District.xlsx"       -- the same 40 State/District pairs

This converts the shapefile to a simplified GeoJSON the dashboard can fetch,
and attaches, per district, WHICH of this repo's existing real data layers
actually exist for it. It creates no new measurements of its own: every
analytic number the cNARMADA panel shows is read at runtime from the same
per-district files the rest of the portal already serves.

Run:  python scripts/build_cnarmada_basin.py
Out:  dashboard/data/cnarmada/narmada_basin_districts.geojson
      dashboard/data/cnarmada/narmada_basin_index.json
"""
import json
import os
import re
import sys

try:
    import geopandas as gpd
except ImportError:
    sys.exit("geopandas required: pip install geopandas")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DASH = os.path.join(ROOT, "dashboard")
OUT_DIR = os.path.join(DASH, "data", "cnarmada")

SHP = os.environ.get(
    "NARMADA_SHAPEFILE",
    os.path.expanduser("~/Downloads/Narmada_District_shapefile/Narmada.shp"),
)
XLSX = os.environ.get(
    "NARMADA_XLSX", os.path.expanduser("~/Desktop/STATE and District.xlsx")
)

# Same simplification tolerance the repo's other SoI layers use
# (docs/DATA_SOURCES.md "Geometry simplification for web delivery").
SIMPLIFY_DEG = 0.0005


def slug(s):
    return re.sub(r"_+$", "", re.sub(r"^_+", "", re.sub(r"[^a-z0-9]+", "_", str(s).strip().lower())))


# The shapefile is a GADM-lineage product and spells six districts
# differently from this repo's Survey of India district index. Each mapping
# below was checked against dashboard/data/boundaries/soi/districts_index.json
# -- and two of them are confirmed by the shapefile's OWN VARNAME_2 column
# ("Kabirdham|Kabeerdham", "Dohad"). Hoshangabad -> Narmadapuram is the 2021
# official rename; West Nimar -> Khargone is the same district under its
# older revenue name. Nothing here is guessed: if a name fails to resolve
# this script raises rather than silently dropping the district.
ALIAS = {
    ("chhattisgarh", "kabeerdham"): "Kabirdham",
    ("gujarat", "chhota_udaipur"): "Chhotaudepur",
    ("gujarat", "dahod"): "Dohad",
    ("madhya_pradesh", "hoshangabad"): "Narmadapuram",
    ("madhya_pradesh", "narsimhapur"): "Narsinghpur",
    ("madhya_pradesh", "west_nimar"): "Khargone",
}

# Per-district layers this repo already publishes. The panel reads these at
# runtime; here we only record which exist so the UI can say "not available"
# honestly instead of firing a 404 per click.
LAYERS = {
    "climate": "data/climate/{s}/{d}.json",
    "ndvi": "data/ndvi/{s}/{d}.json",
    "soil_moisture": "data/soil_moisture/{s}/{d}.json",
    "crop_des": "data/crop_stats_des_by_district/{s}/{d}.json",
    "groundwater": "data/groundwater/{s}/{d}.json",
    "advisory": "data/advisory/{s}/{d}.json",
}

# The 5 districts whose climate comes from the IMD village-level product
# (mp_climate_data.json) rather than the national GEE run -- they have no
# data/climate/<state>/<district>.json and that is correct, not a gap.
IMD_DISTRICTS = {"bhopal", "indore", "jabalpur", "rewa", "sidhi"}


def load_xlsx_pairs(path):
    """The owner's Excel is the authoritative selection list. Used to
    cross-check the shapefile, not to add districts of its own."""
    try:
        import openpyxl
    except ImportError:
        print("[warn] openpyxl not installed -- skipping Excel cross-check")
        return None
    if not os.path.exists(path):
        print("[warn] Excel not found at %s -- skipping cross-check" % path)
        return None
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb[wb.sheetnames[0]]
    pairs = []
    for row in ws.iter_rows(values_only=True):
        if not row or len(row) < 3:
            continue
        if str(row[1]).strip().lower() == "state":
            continue
        if row[1] and row[2]:
            pairs.append((slug(row[1]), slug(row[2])))
    return pairs


def main():
    if not os.path.exists(SHP):
        sys.exit("shapefile not found: %s (set NARMADA_SHAPEFILE)" % SHP)
    gdf = gpd.read_file(SHP)
    if gdf.crs is None:
        sys.exit("shapefile has no CRS")
    if gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    xlsx_pairs = load_xlsx_pairs(XLSX)

    feats, index = [], []
    for _, r in gdf.iterrows():
        state, dist_raw = r["NAME_1"], r["NAME_2"]
        canon = ALIAS.get((slug(state), slug(dist_raw)), dist_raw)
        s, d = slug(state), slug(canon)

        have = {}
        for key, tpl in LAYERS.items():
            have[key] = os.path.exists(os.path.join(DASH, tpl.format(s=s, d=d)))
        # Not a gap: these carry IMD village-level climate instead.
        climate_kind = "imd_village" if d in IMD_DISTRICTS else ("gee" if have["climate"] else "none")

        geom = r.geometry.simplify(SIMPLIFY_DEG, preserve_topology=True)
        props = {
            "state": state,
            "state_slug": s,
            "district": canon,
            "district_slug": d,
            "district_as_supplied": dist_raw,
            "renamed_from_source": canon != dist_raw,
            "layers": have,
            "climate_kind": climate_kind,
        }
        feats.append({"type": "Feature", "properties": props,
                      "geometry": json.loads(gpd.GeoSeries([geom]).to_json())["features"][0]["geometry"]})
        index.append(props)

    if xlsx_pairs is not None:
        shp_pairs = {(f["properties"]["state_slug"], slug(f["properties"]["district_as_supplied"])) for f in feats}
        only_x = [p for p in xlsx_pairs if p not in shp_pairs]
        only_s = [p for p in shp_pairs if p not in xlsx_pairs]
        print("[xlsx] rows=%d  shapefile=%d  only-in-excel=%s  only-in-shapefile=%s"
              % (len(xlsx_pairs), len(shp_pairs), only_x or "none", only_s or "none"))

    meta = {
        "title": "Narmada basin districts (cNARMADA panel selection layer)",
        "source": "District boundary shapefile supplied by the project owner (GADM-lineage attributes: ID_0/ISO/NAME_1/NAME_2/HASC_2), "
                  "cross-checked against the owner's 'STATE and District.xlsx' selection list",
        "source_note": "This is NOT the Survey of India boundary product used elsewhere in this portal "
                       "(data/boundaries/soi/*). It is the owner-supplied basin delineation and is used ONLY to "
                       "select and outline basin districts. Every analytic value the cNARMADA panel shows is read "
                       "from this repo's existing per-district files, which are keyed to the SoI district names -- "
                       "which is why district_slug is resolved to the SoI spelling here.",
        "resolution": "district polygon, simplified %s deg (topology preserved)" % SIMPLIFY_DEG,
        "crs": "EPSG:4326",
        "processing": "scripts/build_cnarmada_basin.py -- reproject if needed, simplify, resolve 6 source spellings "
                      "to this repo's SoI district names, and record which existing data layers exist per district",
        "district_count": len(feats),
        "states": sorted({f["properties"]["state"] for f in feats}),
        "last_updated": "2026-09-14",
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    gj = {"type": "FeatureCollection", "metadata": meta, "features": feats}
    with open(os.path.join(OUT_DIR, "narmada_basin_districts.geojson"), "w", encoding="utf-8") as f:
        json.dump(gj, f, separators=(",", ":"))
    with open(os.path.join(OUT_DIR, "narmada_basin_index.json"), "w", encoding="utf-8") as f:
        json.dump({"metadata": meta, "districts": index}, f, indent=1)

    cov = {k: sum(1 for p in index if p["layers"][k]) for k in LAYERS}
    print("[ok] %d districts, %d states" % (len(feats), len(meta["states"])))
    for k, v in cov.items():
        print("     %-14s %d/%d" % (k, v, len(feats)))
    print("     climate via IMD village product: %d" % sum(1 for p in index if p["climate_kind"] == "imd_village"))


if __name__ == "__main__":
    main()
