"""Additional *inputs* for requirement acceptance; never model predictions or business delivery.

Called inside the existing lifecycle generation transaction before snapshot hashing.
All rows are synthetic, seeded, city/date scoped and only added to new Mock snapshots.
"""
import random
import math
import datetime


def populate(conn, domain, seed):
    rng = random.Random(seed + 5400)
    geo = ('郑州市', '金水区')
    if domain == 'vector':
        conn.execute('''CREATE TABLE fact_vector_exposure (record_id TEXT PRIMARY KEY, city TEXT, district TEXT,
            monitoring_date TEXT, species_name TEXT, population INTEGER, outdoor_person_hours REAL,
            pesticide_applications INTEGER, tested_alleles INTEGER, resistant_alleles INTEGER,
            temperature_c REAL, rainfall_mm REAL)''')
        for month in range(82):
            tested = 200
            conn.execute('INSERT INTO fact_vector_exposure VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
                         (f'MOCK-EXPOSURE-{month}', *geo, f'{2019+month//12}-{month%12+1:02d}-15',
                          '白纹伊蚊', 100000+month*100, 2000+month*10, month%4,
                          tested, min(tested, 20+month), round(rng.uniform(5,32),1), round(rng.uniform(10,150),1)))
        cols=[r[1] for r in conn.execute('PRAGMA table_info(fact_insecticide_resistance)')]
        templates=conn.execute('SELECT * FROM fact_insecticide_resistance LIMIT 12').fetchall()
        for group,t in enumerate(templates):
            for month in range(24):
                row=dict(zip(cols,t));row.update(resistance_id=f'MOCK-RESISTANCE-{group}-{month}',date_id=f'{2023+month//12}-{month%12+1:02d}-15',corrected_mortality=min(100,max(65,99-group*2+3*math.sin(month/3))),test_temp=24+month%7)
                conn.execute('INSERT INTO fact_insecticide_resistance VALUES('+','.join('?' for _ in cols)+')',list(row.values()))
    elif domain == 'foodborne':
        conn.execute('''CREATE TABLE fact_food_exposure (record_id TEXT PRIMARY KEY, city TEXT, district TEXT,
            exposure_date TEXT, cluster_id TEXT, cohort_id TEXT, batch_id TEXT, supplier TEXT,
            food_name TEXT, exposed_count INTEGER, exposed_ill INTEGER, unexposed_count INTEGER, unexposed_ill INTEGER)''')
        for i in range(3):
            conn.execute('INSERT INTO fact_food_exposure VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
                         (f'MOCK-FOOD-{i}',*geo,'2026-08-18','OUTBREAK-202608-01','MOCK-COHORT-01',
                          f'MOCK-BATCH-{i}','模拟供应商甲', ['海鲜便当','凉拌菜','米饭'][i],100,20-i*5,80,2+i))
        conn.execute('''CREATE TABLE fact_food_forecast_inputs (record_id TEXT PRIMARY KEY, city TEXT, district TEXT,
            monitoring_date TEXT, temperature_c REAL, rainfall_mm REAL, population INTEGER, transport_daily_passengers INTEGER)''')
        for month in range(32):
            conn.execute('INSERT INTO fact_food_forecast_inputs VALUES(?,?,?,?,?,?,?,?)',
                         (f'MOCK-FOOD-WEATHER-{month}',*geo,f'{2024+month//12}-{month%12+1:02d}-15',
                          round(rng.uniform(5,32),1),round(rng.uniform(10,150),1),100000,20000))
        template = conn.execute("SELECT * FROM fact_foodborne_case WHERE city=? AND district=? LIMIT 1",geo).fetchone()
        columns=[r[1] for r in conn.execute('PRAGMA table_info(fact_foodborne_case)')]
        for month in range(32):
            date=f'{2024+month//12}-{month%12+1:02d}-15'
            for pathogen in ['PATH_01','PATH_02']:
                count=18+int(8*(1+math.sin(2*math.pi*(month%12)/12)))+month//8
                for i in range(count):
                    row=dict(zip(columns,template));row.update(case_id=f'MOCK-HISTORY-{month}-{pathogen}-{i}',visit_date=date,symptom_onset_time=date+' 12:00:00',cluster_id=None,pathogen_id=pathogen,suspected_food='模拟历史餐食',patient_name='模拟匿名病例')
                    conn.execute('INSERT INTO fact_foodborne_case VALUES('+','.join('?' for _ in columns)+')',list(row.values()))
        columns=[r[1] for r in conn.execute('PRAGMA table_info(fact_outbreak_event)')]
        row=dict(zip(columns,conn.execute('SELECT * FROM fact_outbreak_event WHERE cluster_id=?',('OUTBREAK-202608-01',)).fetchone()))
        row.update(cluster_id='MOCK-HISTORICAL-OUTBREAK',event_title='模拟历史学校食堂处置案例',start_time='2026-08-05 10:00:00',end_time='2026-08-07 16:00:00',case_count=12,disposal_status='closed',trace_conclusion='模拟现场调查发现冷藏设备故障，完成设备检修及复查')
        conn.execute('INSERT INTO fact_outbreak_event VALUES('+','.join('?' for _ in columns)+')',list(row.values()))
        case_columns=[r[1] for r in conn.execute('PRAGMA table_info(fact_foodborne_case)')]
        for i in range(12):
            case=dict(zip(case_columns,template));case.update(case_id=f'MOCK-HISTORICAL-CASE-{i}',cluster_id='MOCK-HISTORICAL-OUTBREAK',visit_date='2026-08-06',symptom_onset_time=f'2026-08-06 {i+1:02d}:00:00',patient_name='模拟历史处置病例')
            conn.execute('INSERT INTO fact_foodborne_case VALUES('+','.join('?' for _ in case_columns)+')',list(case.values()))
    elif domain == 'env':
        conn.execute('''CREATE TABLE fact_env_raw_samples (record_id TEXT PRIMARY KEY, city TEXT, district TEXT,
            monitoring_date TEXT, sample_code TEXT, indicator_code TEXT, raw_value REAL, raw_unit TEXT,
            canonical_unit TEXT, quality_case TEXT)''')
        for i,(value,unit,case) in enumerate([(10,'ug/L','unit-conversion'),(None,'mg/L','missing'),(-1,'mg/L','invalid-negative'),(.02,'mg/L','valid')]):
            conn.execute('INSERT INTO fact_env_raw_samples VALUES(?,?,?,?,?,?,?,?,?,?)',
                         (f'MOCK-RAW-{i}',*geo,f'2026-08-{15+i:02d}',f'MOCK-SAMPLE-{i}','lead',value,unit,'mg/L',case))
        conn.execute('''CREATE TABLE fact_venue_scores (record_id TEXT PRIMARY KEY, city TEXT, district TEXT,
            inspection_date TEXT, venue_id TEXT, management REAL, staff REAL, disclosure REAL,
            testing REAL, smoking REAL, facilities REAL, visitor_count INTEGER, symptom_reports INTEGER, rule_version TEXT)''')
        venues=conn.execute('SELECT venue_id FROM fact_public_venue_inspection WHERE city=?',geo[:1]).fetchall()
        for i,(venue_id,) in enumerate(venues):
            scores=[max(5,98-(i%9)*8-j*2) for j in range(6)]
            conn.execute('INSERT INTO fact_venue_scores VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                         (f'MOCK-SCORE-{i}',*conn.execute('SELECT city,district FROM fact_public_venue_inspection WHERE venue_id=?',(venue_id,)).fetchone(),'2026-08-15',venue_id,*scores,100+i*10,i,'demo-equal-weight-v1'))
        conn.execute('''CREATE TABLE fact_env_activity (record_id TEXT PRIMARY KEY, city TEXT, district TEXT,
            monitoring_date TEXT, population_group TEXT, outdoor_hours REAL, indoor_hours REAL, indoor_pm25 REAL,
            population INTEGER, cardiovascular_deaths INTEGER, forecast_temp_24h REAL, forecast_temp_48h REAL, forecast_temp_72h REAL)''')
        for day in range(1,93):
            for group in ['儿童','老年人']:
                conn.execute('INSERT INTO fact_env_activity VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
                             (f'MOCK-ACTIVITY-{day}-{group}',*geo,(datetime.date(2026,6,1)+datetime.timedelta(days=day-1)).isoformat(),group,4,20,12,10000,day%3,37,38,39))
        conn.execute('''CREATE TABLE fact_sewage_network (record_id TEXT PRIMARY KEY, city TEXT, district TEXT,
            monitoring_date TEXT, upstream_node TEXT, downstream_node TEXT, flow_m3_day REAL, travel_hours REAL)''')
        plants=conn.execute('SELECT DISTINCT plant_id,city,district FROM fact_sewage_monitoring').fetchall()
        for plant,city,district in plants:
            for i in range(3):
                conn.execute('INSERT INTO fact_sewage_network VALUES(?,?,?,?,?,?,?,?)',
                             (f'MOCK-PIPE-{plant}-{i}',city,district,'2026-08-15',f'MOCK-UPSTREAM-{plant}-{i}',plant,10000+i*1000,2+i))
        conn.execute('''CREATE TABLE fact_env_mobile_tasks (record_id TEXT PRIMARY KEY, city TEXT, district TEXT,
            monitoring_date TEXT, sample_code TEXT, task_type TEXT, task_status TEXT, offline_client_key TEXT)''')
        for i,status in enumerate(['pending','in_progress','completed']):
            conn.execute('INSERT INTO fact_env_mobile_tasks VALUES(?,?,?,?,?,?,?,?)',
                         (f'MOCK-TASK-{i}',*geo,'2026-08-15',f'MOCK-SAMPLE-{i}','water-sampling',status,f'MOCK-OFFLINE-{i}'))
        conn.execute('''CREATE TABLE fact_env_intervention_inputs (record_id TEXT PRIMARY KEY, city TEXT, district TEXT,
            monitoring_date TEXT, source_name TEXT, baseline_emission_kg REAL, reduction_fraction REAL, assumption TEXT)''')
        conn.execute('INSERT INTO fact_env_intervention_inputs VALUES(?,?,?,?,?,?,?,?)',
                     ('MOCK-SCENARIO-1',*geo,'2026-08-15','模拟污染源甲',100,.5,'仅演示干预输入；无已验证浓度响应或健康效应系数'))
        conn.execute("CREATE TABLE fact_river_adjacency (record_id TEXT PRIMARY KEY,city TEXT,district TEXT,monitoring_date TEXT,section_a TEXT,section_b TEXT,topology_source TEXT)")
        sections=conn.execute('SELECT section_name,city,district,basin_id FROM fact_river_basin_monitoring ORDER BY basin_id,record_id').fetchall()
        for i,(a,b) in enumerate(zip(sections,sections[1:])):
            if a[3]==b[3]:conn.execute('INSERT INTO fact_river_adjacency VALUES(?,?,?,?,?,?,?)',(f'MOCK-ADJ-{i}',a[1],a[2],'2026-07-20',a[0],b[0],'synthetic consecutive reach topology'))
    elif domain == 'chronic':
        conn.execute('''CREATE TABLE fact_chronic_followup (record_id TEXT PRIMARY KEY, city TEXT, district TEXT,
            monitoring_date TEXT, age INTEGER, smoking INTEGER, family_history INTEGER, systolic_bp REAL,
            disease_name TEXT, complication TEXT, followup_months INTEGER, outcome_event INTEGER,
            screening_cost_yuan REAL, treatment_cost_yuan REAL, screened INTEGER, detected INTEGER, population INTEGER)''')
        for i in range(480):
            conn.execute('INSERT INTO fact_chronic_followup VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                         (f'MOCK-FOLLOWUP-{i}',*geo,f'{2024+i//192}-{i//16%12+1:02d}-08',40+i%40,i%2,i%3==0,110+i%70,
                          ['高血压','糖尿病','肿瘤'][i%3],['无','肾病','视网膜病变'][i%3],24,int(rng.random() < 1/(1+math.exp(-(-6+.055*(40+i%40)+.7*(i%2)+.6*(i%3==0)+.018*(110+i%70))))),150,10000,i%2==0,i%10==0,100000))
        conn.execute('''CREATE TABLE fact_injury_risk_inputs (record_id TEXT PRIMARY KEY, city TEXT, district TEXT,
            monitoring_date TEXT, injury_id TEXT, protective_equipment INTEGER, rural INTEGER, surface_wet INTEGER)''')
        cases=conn.execute('SELECT injury_id,city,district,substr(injury_time,1,10) FROM fact_injury_surveillance LIMIT 200').fetchall()
        for i,(injury_id,city,district,date) in enumerate(cases):
            conn.execute('INSERT INTO fact_injury_risk_inputs VALUES(?,?,?,?,?,?,?,?)',
                         (f'MOCK-PPE-{i}',city,district,date,injury_id,i%2,i%3==0,i%5==0))

        columns=[r[1] for r in conn.execute('PRAGMA table_info(fact_death_registry)')]
        template=conn.execute("SELECT * FROM fact_death_registry WHERE qc_status='VALID' AND underlying_cause LIKE '%心肌梗死%' LIMIT 1").fetchone()
        for month in range(44):
            for i in range(8+month%12):
                row=dict(zip(columns,template));row.update(death_cert_id=f'MOCK-DEATH-HISTORY-{month}-{i}',patient_name=f'模拟历史病例{month}-{i}',city=geo[0],district=geo[1],death_date=f'{2023+month//12}-{month%12+1:02d}-15',age=45+i, ypll=30-i)
                conn.execute('INSERT INTO fact_death_registry VALUES('+','.join('?' for _ in columns)+')',list(row.values()))
