"""Bounded, path-free scientific kernels. Input comes only from authorized server artifacts."""
import json
import math
import sys
import numpy as np
from sklearn.cluster import KMeans
from analytics_engine.satscan_cluster import haversine_distance_km


def scan(data, params):
    sites = data['sites']
    if len(sites) < 3 or len(sites) > 500:
        raise ValueError('SCAN_SITE_BUDGET_OR_INSUFFICIENT')
    counts = np.array([s['count'] for s in sites], dtype=float)
    exposure = np.array([s['exposure'] for s in sites], dtype=float)
    if not np.isfinite(counts).all() or not np.isfinite(exposure).all() or (counts < 0).any() or (exposure <= 0).any() or not np.equal(counts, np.floor(counts)).all() or counts.sum() <= 0:
        raise ValueError('SCAN_COUNTS_EXPOSURE_INVALID')
    total = float(counts.sum())
    probability = exposure / exposure.sum()
    expected = total * probability
    windows, seen = [], set()
    for i, center in enumerate(sites):
        distances = np.array([haversine_distance_km(center['latitude'], center['longitude'], s['latitude'], s['longitude']) for s in sites])
        for radius in sorted(set(distances[distances <= params['maxRadiusKm']])):
            indices = tuple(np.flatnonzero(distances <= radius))
            e = float(expected[list(indices)].sum())
            if indices in seen or e >= total * .5 or e <= 0:
                continue
            seen.add(indices)
            windows.append((i, float(radius), indices, e))
    def llr(c, e):
        if c <= e:
            return 0.
        return c * math.log(c/e) + ((total-c) * math.log((total-c)/(total-e)) if total > c else 0.)
    scored = [(llr(float(counts[list(ix)].sum()), e), i, radius, ix, e) for i, radius, ix, e in windows]
    rng = np.random.default_rng(params['seed'])
    maxima = []
    for _ in range(params['simulations']):
        simulated = rng.multinomial(int(total), probability)
        maxima.append(max((llr(float(simulated[list(ix)].sum()), e) for _, _, ix, e in windows), default=0.))
    covered, clusters = set(), []
    for score, i, radius, ix, e in sorted(scored, reverse=True):
        p = (1 + sum(v >= score for v in maxima)) / (params['simulations'] + 1)
        if score <= 0 or p > params['pThreshold'] or covered.intersection(ix):
            continue
        clusters.append({'id': 'scan-' + str(len(clusters)+1), 'locationKeys': [sites[j]['locationKey'] for j in ix],
                         'center': [sites[i]['longitude'], sites[i]['latitude']], 'radiusKm': radius,
                         'observed': float(counts[list(ix)].sum()), 'expected': e, 'llr': score, 'pValue': p})
        covered.update(ix)
    return {'clusters': clusters, 'exposureUnit': data['exposureUnit'], 'siteCount': len(sites),
            'simulations': params['simulations'], 'seed': params['seed'], 'candidateWindows': len(windows)}


def kmeans(data, params):
    x = np.asarray(data['values'], dtype=float)
    k = params['k']
    if x.ndim != 2 or not np.isfinite(x).all() or not 2 <= k <= min(20, len(x)) or len(np.unique(x, axis=0)) < k:
        raise ValueError('KMEANS_INSUFFICIENT_DISTINCT_FINITE_ROWS')
    mean, scale = x.mean(axis=0), x.std(axis=0)
    scale[scale == 0] = 1.
    z = (x - mean) / scale
    fit = KMeans(n_clusters=k, n_init=10, random_state=params['seed']).fit(z)
    return {'assignments': [{'locationKey': key, 'cluster': int(label)} for key, label in zip(data['rowKeys'], fit.labels_)],
            'centroids': fit.cluster_centers_.tolist(), 'columns': data['columns'], 'mean': mean.tolist(),
            'scale': scale.tolist(), 'inertia': float(fit.inertia_), 'k': k, 'seed': params['seed']}


def main():
    raw = sys.stdin.buffer.read(16 * 1024 * 1024 + 1)
    if len(raw) > 16 * 1024 * 1024:
        raise ValueError('KERNEL_INPUT_BUDGET')
    request = json.loads(raw)
    functions = {'scan': scan, 'kmeans': kmeans}
    result = functions[request['operation']](request['data'], request['params'])
    print(json.dumps(result, allow_nan=False, separators=(',', ':')))


if __name__ == '__main__':
    main()
