import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface AnalyticsEngineTask {
  task: 
    | 'population_dynamics'
    | 'species_clustering'
    | 'resistance_prediction'
    | 'pathogen_apriori'
    | 'density_gbdt'
    | 'spatial_idw'
    | 'transmission_risk'
    | 'resistance_evolution'
    | 'satscan_cluster'
    | 'lstm_predictor'
    | 'satscan_kmeans_lstm_pipeline'
    | 'daemon_surveillance_cycle';
  args?: Record<string, any>;
}

export async function runAnalyticsEngine<T = any>(
  task: AnalyticsEngineTask['task'],
  args: Record<string, any> = {}
): Promise<T> {
  const engineScriptPaths = [
    path.resolve(process.cwd(), 'analytics_engine/engine.py'),
    path.resolve(process.cwd(), '../Agent-CdcBuddy/analytics_engine/engine.py'),
    '/Users/nathanzhang/Documents/DEV/AI-CDC/Agent-CdcBuddy/analytics_engine/engine.py'
  ];

  let scriptPath = engineScriptPaths[0];
  for (const p of engineScriptPaths) {
    if (fs.existsSync(p)) {
      scriptPath = p;
      break;
    }
  }

  const dbPaths = [
    path.resolve(process.cwd(), 'vector_monitoring.db'),
    path.resolve(process.cwd(), '../Agent-CdcBuddy/vector_monitoring.db'),
    '/Users/nathanzhang/Documents/DEV/AI-CDC/Agent-CdcBuddy/vector_monitoring.db'
  ];

  let dbPath = dbPaths[0];
  for (const p of dbPaths) {
    if (fs.existsSync(p)) {
      dbPath = p;
      break;
    }
  }

  const pythonCandidates = [
    path.resolve(process.cwd(), '.venv/bin/python3'),
    path.resolve(process.cwd(), '.venv/bin/python'),
    path.resolve(process.cwd(), '../Agent-CdcBuddy/.venv/bin/python3'),
    '/Users/nathanzhang/Documents/DEV/AI-CDC/Agent-CdcBuddy/.venv/bin/python3',
    'python3',
    'python'
  ];

  let pythonBin = 'python3';
  for (const py of pythonCandidates) {
    if (py.startsWith('/') || py.startsWith('.')) {
      if (fs.existsSync(py)) {
        pythonBin = py;
        break;
      }
    }
  }

  return new Promise((resolve, reject) => {
    const jsonArgs = JSON.stringify(args);
    const cmdArgs = [scriptPath, '--task', task, '--args', jsonArgs, '--db', dbPath];

    const child = spawn(pythonBin, cmdArgs, {
      cwd: path.dirname(scriptPath),
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf-8');
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf-8');
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`[AnalyticsEngine Error] code=${code} task=${task}`, stderr);
        return reject(new Error(`Analytics Engine task [${task}] failed: ${stderr || 'Unknown error'}`));
      }

      try {
        const rawOutput = stdout.trim();
        // 容错清洗 NaN / Infinity 等非标 JSON 符号
        const sanitized = rawOutput
          .replace(/:\s*NaN\b/g, ': null')
          .replace(/:\s*Infinity\b/g, ': null')
          .replace(/:\s*-Infinity\b/g, ': null');
        const parsed = JSON.parse(sanitized);
        resolve(parsed as T);
      } catch (err: any) {
        console.error(`[AnalyticsEngine JSON Parse Error]`, stdout);
        reject(new Error(`Failed to parse Analytics Engine output: ${err.message}`));
      }
    });

    child.on('error', (err) => {
      console.error(`[AnalyticsEngine Spawn Error]`, err);
      reject(err);
    });
  });
}
