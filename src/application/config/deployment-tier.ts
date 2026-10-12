import type {DeploymentTier} from '@/contracts/execution-context';
export function getDeploymentTier():DeploymentTier{const tier=process.env.DEPLOYMENT_TIER??(process.env.NODE_ENV==='production'?'pilot':'local');if(!['local','demo','pilot'].includes(tier))throw new Error('Invalid deployment tier');return tier as DeploymentTier;}
