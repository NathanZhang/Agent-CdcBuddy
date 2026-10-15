"""Reusable nonnegative monthly forecast over server-authorized query rows."""
import math
import re
from analytics_engine.assessments.common import forecast, result


def execute(args):
    rows = args.get('rows', [])
    reason = None
    if not 18 <= len(rows) <= 200:
        reason = '需要18至200个连续月份的观测值，请调整历史范围。'
    elif any(set(r) != {'period', 'value'} or not isinstance(r['period'], str)
             or not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', r['period'])
             or isinstance(r['value'], bool) or not isinstance(r['value'], (float, int))
             or not math.isfinite(r['value']) or r['value'] < 0 for r in rows):
        reason = '输入必须仅含period（YYYY-MM）和非负有限数值value。'
    else:
        months = [int(r['period'][:4])*12+int(r['period'][5:]) for r in rows]
        if any(b-a != 1 for a, b in zip(months, months[1:])):
            reason = '月份必须升序、唯一且连续；缺失月份不能自动当作零。'
    if reason:
        return {'status': 'INSUFFICIENT_DATA', 'method': 'shared-arima-forecast-v1', 'reason': reason, 'qualityFlags': ['incomplete-monthly-series']}
    fitted = forecast([r['period'] for r in rows], [r['value'] for r in rows], args.get('horizon', 3), 'arima')
    return result('shared-arima-forecast-v1', models=[fitted], unit=args['unit'],
                  assumptions=['非负月度指标；ARIMA(1,1,1)；负预测截断为零', '按时间留出验证，不代表外部验证或业务风险判定'])
