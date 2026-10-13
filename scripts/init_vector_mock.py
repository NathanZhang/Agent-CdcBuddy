#!/usr/bin/env python3
"""Seeded synthetic vector facts covering the UI's historical demo scenes."""
import argparse
from contextlib import closing
from datetime import date
import math
from pathlib import Path
import random
import sqlite3

ROOT = Path(__file__).resolve().parents[1]


def _populate(db_path, seed=42):
    if __package__:
        from .init_env_mock import HENAN_CITIES
        from .mock_geography import point_in_region
    else:
        from init_env_mock import HENAN_CITIES
        from mock_geography import point_in_region

    rng = random.Random(seed)
    with closing(sqlite3.connect(db_path)) as conn:
        conn.executescript((ROOT / 'analytics_engine/mock_schemas/vector.sql').read_text())
        conn.execute('PRAGMA foreign_keys=ON')
        conn.executemany('INSERT INTO dim_species VALUES(?,?,?,?)', [
            ('aedes', '蚊', '白纹伊蚊', 'Aedes albopictus'),
            ('culex', '蚊', '淡色库蚊', 'Culex pipiens pallens'),
            ('fly', '蝇', '家蝇', 'Musca domestica'),
            ('cockroach', '蟑螂', '德国小蠊', 'Blattella germanica'),
        ])
        conn.execute("INSERT INTO dim_method VALUES('lamp','诱蚊灯法')")
        conn.execute("INSERT INTO dim_pathogen VALUES('dengue','登革病毒')")
        conn.executemany('INSERT INTO dim_pesticide VALUES(?,?,?)', [
            ('deltamethrin', '溴氰菊酯', 'deltamethrin'),
            ('cypermethrin', '氯氰菊酯', 'cypermethrin'),
        ])
        locations = []
        for code, city, districts, lat, lon in HENAN_CITIES:
            for index, district in enumerate(districts):
                lat, lon = point_in_region(city, district, rng)
                location = (f'{code}-{index:02d}', '河南省', city, district,
                            f'Mock监测点{index + 1}', lat, lon)
                locations.append(location)
        conn.executemany('''INSERT INTO dim_location(location_id,province,city,district,street,latitude,longitude)
                            VALUES(?,?,?,?,?,?,?)''', locations)
        for year in range(2019, 2026):
            for month in range(1, 13 if year < 2025 else 12):
                observed = date(year, month, 5 if (year, month) == (2025, 11) else 15)
                day = observed.isoformat()
                season = ['冬', '春', '夏', '秋'][(month % 12) // 3]
                conn.execute('INSERT INTO dim_date VALUES(?,?,?,?,?)', (day, year, month, observed.day, season))
                summer = (1 + math.cos((month - 7) * math.pi / 6)) / 2
                for idx, location in enumerate(locations):
                    for species, multiplier in [('aedes', 1), ('culex', 1.8)]:
                        count = max(0, round((3 + 25 * summer + (year - 2019) * .7 + (idx % 5)) * multiplier + rng.uniform(-2, 2)))
                        conn.execute('''INSERT INTO fact_monitoring(monitoring_id,date_id,location_id,species_id,method_id,
                            capture_count,sampling_unit,weather_temp,weather_humidity,source_file) VALUES(?,?,?,?,?,?,?,?,?,?)''',
                            (f'{day}-{location[0]}-{species}', day, location[0], species, 'lamp', count, 1,
                             round(5 + summer * 27 + rng.uniform(-2, 2), 1), round(45 + summer * 25 + rng.uniform(-5, 5), 1), 'synthetic-vector-demo'))
        for idx, location in enumerate(locations):
            positive = 1 if idx % 4 == 0 else 0
            conn.execute('''INSERT INTO fact_pathogen_detection(detection_id,monitoring_id,location_id,date_id,species_id,
                pathogen_id,tested_count,positive_groups,total_groups,pcr_result,detection_method,source_file)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?)''',
                (f'pcr-{idx}', f'2024-06-15-{location[0]}-aedes', location[0], '2024-06-15', 'aedes', 'dengue',
                 50, positive, 10, '阳性' if positive else '阴性', 'PCR', 'synthetic-vector-demo'))
        # Keep real NULLs to exercise the missing-value UI.
        for idx, location in enumerate(locations):
            for species in ['fly', 'cockroach']:
                for pesticide in ['deltamethrin', 'cypermethrin']:
                    missing = idx % 5 == 0
                    mortality = None if missing else round(rng.uniform(65, 100), 1)
                    level = None if missing else '敏感' if mortality >= 98 else '可疑抗性' if mortality >= 90 else '抗性'
                    conn.execute('''INSERT INTO fact_insecticide_resistance(resistance_id,species_id,pesticide_id,location_id,
                        date_id,lc50,corrected_mortality,resistance_level,source_file) VALUES(?,?,?,?,?,?,?,?,?)''',
                        (f'resistance-{idx}-{species}-{pesticide}', species, pesticide, location[0], '2025-01-15',
                         None if missing else round(rng.uniform(.01, .5), 4), mortality, level, 'synthetic-vector-demo'))
        conn.commit()
        if conn.execute('PRAGMA foreign_key_check').fetchall():
            raise ValueError('Invalid synthetic vector references')


def generate_mock_data(db_path, seed=42, *, audit_dir=None, retention_days=7):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from analytics_engine.mock_lifecycle import generation
    with generation(db_path, 'vector', seed, __file__, audit_dir, retention_days):
        _populate(str(db_path), seed)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    # An implicit root output would be labelled observed by the default manifest.
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--audit-dir', type=Path, help='Persistent Mock audit/registry directory')
    parser.add_argument('--retention-days', type=int, default=7)
    args = parser.parse_args()
    generate_mock_data(str(args.output), args.seed, audit_dir=args.audit_dir, retention_days=args.retention_days)

    print(f'Mock dataset generated: {args.output} (seed={args.seed})')


if __name__ == '__main__':
    main()
