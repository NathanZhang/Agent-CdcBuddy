import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import taskDomains from '../../../config/analytics-tasks.json';
import { resolveDatasetLocation } from '@/infrastructure/db/dataset-manifest';
import type { AgentDomain } from '@/contracts/dataset';

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
    | 'satscan_spatial'
    | 'lstm_predictor'
    | 'satscan_kmeans_lstm_pipeline'
    | 'composable_workflow'
    | 'daemon_surveillance_cycle'
    | 'foodborne_cluster'
    | 'foodborne_phylogeny'
    | 'food_attribution'
    | 'water_safety_eval'
    | 'sewage_lag_tracing'
    | 'air_climate_health_risk'
    | 'river_basin_pollution_chain'
    | 'env_scenario_simulation'
    | (string & {});
  args?: Record<string, any>;
}

export async function runAnalyticsEngine<T = any>(
  task: AnalyticsEngineTask['task'],
  args: Record<string, any> = {}
): Promise<T> {
  const scriptPath = path.resolve(process.env.ANALYTICS_ENGINE_SCRIPT ?? path.join(process.cwd(),'analytics_engine/engine.py'));
  if (!fs.existsSync(scriptPath)) throw new Error('Analytics engine script missing');
  const domain = (taskDomains as Record<string,AgentDomain>)[task];
  if (!domain) throw new Error(`Unknown analytics task: ${task}`);
  const dbPath = resolveDatasetLocation(domain).path;
  const venvPython = path.resolve(process.cwd(),'.venv/bin/python');
  const pythonBin = process.env.PYTHON_BIN ?? (fs.existsSync(venvPython) ? venvPython : 'python3');
  const projectRoot = path.resolve(process.cwd());

  return new Promise((resolve, reject) => {
    const jsonArgs = JSON.stringify(args);
    const cmdArgs = [scriptPath, '--task', task, '--args', jsonArgs, '--domain',domain,'--db', dbPath];

    const child = spawn(pythonBin, cmdArgs, {
      cwd: path.dirname(scriptPath),
      env: {
        ...process.env,
        PYTHONPATH: `${projectRoot}:${path.dirname(scriptPath)}:${process.env.PYTHONPATH || ''}`,
        PYTHONIOENCODING: 'utf-8'
      }
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
        let rawOutput = stdout.trim();
        const firstBrace = rawOutput.indexOf('{');
        const lastBrace = rawOutput.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          rawOutput = rawOutput.substring(firstBrace, lastBrace + 1);
        }
        // 彻底清洗 NaN / Infinity / None 等非标 JSON 符号
        const sanitized = rawOutput
          .replace(/:\s*NaN\b/g, ': null')
          .replace(/:\s*Infinity\b/g, ': null')
          .replace(/:\s*-Infinity\b/g, ': null')
          .replace(/,\s*NaN\b/g, ', null')
          .replace(/\[\s*NaN\b/g, '[ null')
          .replace(/:\s*None\b/g, ': null');
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
