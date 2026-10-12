import sqlite3
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT / 'analytics_engine'))
from population_dynamics import calculate_population_dynamics
from transmission_risk import calculate_transmission_risk
from env.water_rf_kriging import evaluate_water_health_risk
from chronic.icd10_nlp_inference import infer_underlying_cause_and_icd10
from foodborne.cgmlst_cluster import calculate_cgmlst_distance

class ResultSemanticsTests(unittest.TestCase):
    def test_water_rate_and_max_derive_from_samples(self):
        with tempfile.TemporaryDirectory() as temp:
            db = Path(temp) / 'water.db'
            with closing(sqlite3.connect(db)) as conn, conn:
                conn.execute('CREATE TABLE dim_env_stations(station_id TEXT,latitude REAL,longitude REAL)')
                conn.execute('CREATE TABLE fact_water_monitoring(record_id TEXT,station_id TEXT,city TEXT,district TEXT,sample_type TEXT,disinfection_method TEXT,turbidity REAL,free_chlorine REAL,cod_mn REAL,total_coliforms INTEGER,lead_val REAL,cadmium_val REAL,arsenic_val REAL,fluoride_val REAL,chloroform_val REAL,is_standard_met INTEGER,carcinogenic_risk REAL,hazard_quotient REAL,monitoring_date TEXT)')
                for idx,(passed,cr,hq) in enumerate([(1,1e-6,0.1),(1,2e-5,1.7),(0,3e-6,0.3)]):
                    conn.execute('INSERT INTO fact_water_monitoring VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(str(idx),'station','郑州市','金水区','末梢水','次氯酸钠',0.2,0.6,1.0,0,0.01,0.001,0.001,0.1,0.01,passed,cr,hq,'2026-08-01'))
            output = evaluate_water_health_risk('郑州市',db_path=str(db))
            self.assertEqual(output['passRate'],66.67)
            self.assertEqual(output['evaluationResult']['overallComplianceRate'],'66.7%')
            self.assertAlmostEqual(float(output['evaluationResult']['maxCarcinogenicRiskCR']),2e-5)
            self.assertEqual(output['evaluationResult']['maxHazardQuotientHQ'],1.7)
            self.assertEqual(output['featureImportance'],[], 'untrained feature weights cannot be published as computed')
            self.assertEqual(output['krigingGridPoints'],[], 'measured points are not a kriging grid')

    def test_unknown_city_is_no_data(self):
        result=calculate_population_dynamics(str(ROOT / 'vector_monitoring.db'),city='不存在市')
        self.assertEqual(result.get('status'),'NO_DATA')
        self.assertIsNone(result.get('payload'))
        self.assertIsNone(result['r2Score'])
        risk=calculate_transmission_risk(str(ROOT / 'vector_monitoring.db'),city='不存在市')
        self.assertEqual(risk.get('status'),'NO_DATA')
        self.assertIsNone(risk.get('payload'))
        self.assertIsNone(risk['riskScore'])

    def test_zero_positive_remains_zero(self):
        with tempfile.TemporaryDirectory() as temp:
            db = Path(temp)/'vector.db'
            with closing(sqlite3.connect(db)) as conn, conn:
                conn.executescript("CREATE TABLE dim_location(location_id TEXT,city TEXT); CREATE TABLE fact_monitoring(location_id TEXT,capture_count INTEGER); CREATE TABLE fact_pathogen_detection(location_id TEXT,pcr_result TEXT); INSERT INTO dim_location VALUES('one','郑州市'); INSERT INTO fact_monitoring VALUES('one',0); INSERT INTO fact_pathogen_detection VALUES('one','阴性');")
            result=calculate_transmission_risk(str(db),city='郑州市')
            self.assertEqual(result['pathogenPositiveRate'],0.0)
            self.assertEqual(result['measuredAverageCapture'],0.0)

    def test_unknown_death_chain_has_no_default_diagnosis(self):
        result=infer_underlying_cause_and_icd10(input_chain={'a':'未知原因甲','b':'未知原因乙','c':'未知原因丙','d':'未知原因丁'})
        self.assertEqual(result['status'],'REVIEW_REQUIRED')
        self.assertIsNone(result['inferredUnderlyingCause'])
        self.assertIsNone(result['accuracyRate'])
        self.assertEqual(result['metrics']['accuracy']['evaluationKind'],'unvalidated')

    def test_known_dictionary_candidate_does_not_claim_validated_accuracy(self):
        result=infer_underlying_cause_and_icd10(input_chain={'a':'呼吸衰竭','c':'急性大面积脑梗死'})
        self.assertEqual(result['inferredUnderlyingCause']['standardIcd10'],'I63.9')
        self.assertIsNone(result['accuracyRate'])
        self.assertIsNone(result['inferredUnderlyingCause']['confidenceScore'])

    def test_empty_or_mismatched_genes_rejected(self):
        for a,b in [([],[1,2,3]),([1],[1,2]),([None],[1]),([-1],[1])]:
            with self.subTest(a=a,b=b), self.assertRaises(ValueError):
                calculate_cgmlst_distance(a,b)
        self.assertEqual(calculate_cgmlst_distance([1,2,3],[1,9,3]),1)

if __name__ == '__main__': unittest.main()
