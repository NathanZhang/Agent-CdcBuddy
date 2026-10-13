"""Synthetic points within the repository's versioned administrative boundaries."""
from functools import lru_cache
import json
from pathlib import Path
import random

ROOT = Path(__file__).resolve().parents[1]


def ring_contains(ring, lon, lat):
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def contains(polygon, lon, lat):
    return ring_contains(polygon[0], lon, lat) and not any(ring_contains(hole, lon, lat) for hole in polygon[1:])


def centroid(ring):
    pairs = list(zip(ring, ring[1:] + ring[:1]))
    cross = [a[0] * b[1] - b[0] * a[1] for a, b in pairs]
    area = sum(cross)
    if not area:
        raise ValueError('Degenerate mock boundary')
    return (sum((a[0] + b[0]) * c for (a, b), c in zip(pairs, cross)) / (3 * area),
            sum((a[1] + b[1]) * c for (a, b), c in zip(pairs, cross)) / (3 * area), abs(area))


@lru_cache(maxsize=1)
def boundaries():
    catalog = json.loads((ROOT / 'config/regions.json').read_text())['regions']
    features = {}
    for filename in ['henan city border.geojson', 'henan county border.geojson']:
        features.update({str(f['properties']['gb']): f['geometry']
                         for f in json.loads((ROOT / filename).read_text())['features']})
    return catalog, features


def region_geometry(city, district):
    catalog, features = boundaries()
    parent = next(r for r in catalog if r['level'] == 'city' and city in r['aliases'])
    region = next((r for r in catalog if r['parentCode'] == parent['code'] and district in r['aliases']), parent)
    return features[region['sourceId']]


def point_in_region(city, district, rng=None):
    geometry = region_geometry(city, district)
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    polygon = max(polygons, key=lambda p: centroid(p[0])[2])
    lon, lat, _ = centroid(polygon[0])
    if not contains(polygon, lon, lat):
        # A concave polygon can have an exterior centroid; find an interior
        # representative point deterministically without adding GIS dependencies.
        xs, ys = zip(*polygon[0])
        search = random.Random(f'{city}/{district}')
        for _ in range(10000):
            lon, lat = search.uniform(min(xs), max(xs)), search.uniform(min(ys), max(ys))
            if contains(polygon, lon, lat):
                break
        else:
            raise ValueError(f'No interior mock point for {city}/{district}')
    if rng is not None:
        for _ in range(100):
            candidate_lon, candidate_lat = lon + rng.uniform(-.002, .002), lat + rng.uniform(-.002, .002)
            if contains(polygon, candidate_lon, candidate_lat):
                return candidate_lat, candidate_lon
    return lat, lon
