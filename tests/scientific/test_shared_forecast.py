import unittest
from analytics_engine.shared_forecast import execute


class SharedForecast(unittest.TestCase):
    def rows(self):
        return [{'period': f'{2023+i//12}-{i%12+1:02d}', 'value': 20+i+(i%3)} for i in range(24)]

    def test_real_arima_has_future_periods_and_holdout(self):
        out = execute({'rows': self.rows(), 'unit': '例', 'horizon': 3})
        self.assertEqual(out['status'], 'SUCCESS')
        model = out['models'][0]
        self.assertEqual([p['period'] for p in model['forecasts']], ['2025-01', '2025-02', '2025-03'])
        self.assertEqual(model['validation']['trainEnd'], '2024-08')
        self.assertGreaterEqual(model['validation']['rmse'], 0)

    def test_rejects_missing_duplicate_unsorted_and_non_numeric_observations(self):
        rows = self.rows()
        for invalid in [rows[:17], rows[:9]+rows[10:], rows[:9]+[rows[8]]+rows[10:], list(reversed(rows)),
                        [{**r, 'value': None} for r in rows], [{**r, 'value': '2'} for r in rows],
                        [{**r, 'value': -1} for r in rows], [{**r, 'period': '2024-13'} for r in rows]]:
            out = execute({'rows': invalid, 'unit': '例', 'horizon': 3})
            self.assertEqual(out['status'], 'INSUFFICIENT_DATA')
            self.assertNotIn('models', out)

    def test_holdout_does_not_leak_future_targets(self):
        original=self.rows(); changed=[dict(r) for r in original]
        for r in changed[-4:]: r['value']+=100
        a=execute({'rows': original, 'unit': '例'})['models'][0]
        b=execute({'rows': changed, 'unit': '例'})['models'][0]
        self.assertEqual([r['predicted'] for r in a['validation']['rows']], [r['predicted'] for r in b['validation']['rows']])
