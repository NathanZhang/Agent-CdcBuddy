"""Bounded summaries of recorded water measurements, not RF, kriging or risk inference."""
import math
import sqlite3
from datetime import date
from analytics_engine.repositories.datasets import resolve_dataset_path, connect_readonly


def evaluate_water_health_risk(city=None, district=None, db_path=None, from_date=None, as_of=None, limit=500):
    if type(limit) is not int or not 1 <= limit <= 1000:
        raise ValueError('Invalid sample limit')
    conditions, params = [], []
    for column, value in [('city', city), ('district', district)]:
        if value is not None:
            conditions.append(f'w.{column}=?')
            params.append(value)
    for operator, value in [('>=', from_date), ('<=', as_of)]:
        if value:
            conditions.append(f'w.monitoring_date{operator}?')
            params.append(date.fromisoformat(value).isoformat())
    where = ' WHERE ' + ' AND '.join(conditions) if conditions else ''
    with connect_readonly(db_path or resolve_dataset_path('env')) as conn:
        conn.row_factory = sqlite3.Row
        matched = conn.execute("SELECT COUNT(*) n,COUNT(DISTINCT NULLIF(TRIM(w.station_id),'')) stations FROM fact_water_monitoring w" + where, params).fetchone()
        rows = [dict(r) for r in conn.execute('SELECT w.*,s.latitude,s.longitude FROM fact_water_monitoring w LEFT JOIN dim_env_stations s ON w.station_id=s.station_id' + where + ' ORDER BY w.monitoring_date DESC,w.record_id LIMIT ?', [*params, limit])]
    if not rows:
        return {'status': 'NO_DATA', 'totalSamples': 0, 'payload': None}

    def valid(column):
        return [float(r[column]) for r in rows if isinstance(r.get(column), (int, float)) and math.isfinite(r[column]) and r[column] >= 0]

    def mean(column):
        values = valid(column)
        return sum(values) / len(values) if values else None

    columns = ['lead_val', 'cadmium_val', 'arsenic_val', 'chloroform_val', 'carcinogenic_risk', 'hazard_quotient']
    counts = {column: len(valid(column)) for column in columns}
    known = [r for r in rows if r.get('is_standard_met') in (0, 1)]
    pass_rate = round(100 * sum(r['is_standard_met'] == 1 for r in known) / len(known), 2) if known else None
    flags = ['random-forest-unavailable', 'kriging-unavailable', 'recorded-risk-values-not-recomputed', 'risk-policy-unvalidated']
    if matched['n'] > len(rows):
        flags.append('sample-limit-applied')
    if any(n < len(rows) for n in counts.values()) or len(known) < len(rows):
        flags.append('missing-measurement-values')
    if any(r.get(column) is not None and (not isinstance(r[column], (int, float)) or not math.isfinite(r[column]) or r[column] < 0) for r in rows for column in columns):
        flags.append('invalid-measurement-values-excluded')
    points = []
    for r in rows:
        values = [r.get(k) for k in ['latitude', 'longitude', 'hazard_quotient']]
        if all(isinstance(v, (int, float)) and math.isfinite(v) for v in values) and abs(values[0]) <= 90 and abs(values[1]) <= 180 and values[2] >= 0:
            points.append({'id': r['record_id'], 'stationId': r['station_id'], 'date': r['monitoring_date'], 'lat': values[0], 'lon': values[1], 'hazardIndex': values[2], 'city': r['city'], 'district': r['district']})
    return {
        'status': 'SUCCESS' if known or any(counts.values()) else 'INSUFFICIENT_DATA',
        'method': 'observed-water-summary-v1', 'qualityFlags': flags,
        'city': city, 'district': district, 'totalSamples': len(rows),
        'matchedSamples': matched['n'], 'matchedStations': matched['stations'],
        'returnedSamples': len(rows), 'sampleLimit': limit, 'truncated': matched['n'] > len(rows),
        'validValueCounts': counts, 'complianceKnownSamples': len(known),
        'passRate': pass_rate, 'observedPoints': points,
        'evaluationResult': {
            'totalStationsSampled': len({r['station_id'] for r in rows if r['station_id'] and str(r['station_id']).strip()}),
            'overallComplianceRate': f'{pass_rate:.1f}%' if pass_rate is not None else None,
            'maxCarcinogenicRiskCR': max(valid('carcinogenic_risk'), default=None),
            'maxHazardQuotientHQ': max(valid('hazard_quotient'), default=None)
        },
        'healthRiskSummary': {
            'carcinogenicRiskAverage': mean('carcinogenic_risk'),
            'nonCarcinogenicHqAverage': mean('hazard_quotient'),
            'carcinogenicEvaluation': None, 'nonCarcinogenicEvaluation': None,
            'carcinogenicThreshold': None, 'hazardQuotientThreshold': None
        },
        'contaminantAverages': {label: mean(column) for label, column in [('leadMgL', 'lead_val'), ('cadmiumMgL', 'cadmium_val'), ('arsenicMgL', 'arsenic_val'), ('chloroformMgL', 'chloroform_val')]},
        'featureImportance': [], 'randomForestFeatureImportances': [], 'krigingGridPoints': [], 'disposalAdvice': None
    }
