'use client';
import { createContext,createElement,useContext,type ReactNode,useMemo,useSyncExternalStore } from 'react';
import type { AgentDomain } from '@/contracts/dataset';
import { createWorkbenchController,type WorkbenchController } from './workbench-controller';
import { agentClient,type WorkbenchClient } from './session-client';
import { getCurrentAgentDomain } from '@/lib/config/agent-profile';
import { adaptFunctionalInteraction,type FunctionalAction } from '@/application/agent/interaction-adapter';
const WorkbenchContext=createContext<WorkbenchController|null>(null);
export function WorkbenchInteractionProvider({controller,children}:{controller:WorkbenchController;children?:ReactNode}){return createElement(WorkbenchContext.Provider,{value:controller},children);}
export function useFunctionalInteraction(){const scoped=useContext(WorkbenchContext);return (action:FunctionalAction)=>(scoped ?? getWorkbench()).interact(adaptFunctionalInteraction(action));}
const stores=new Map<AgentDomain,WorkbenchController>();
export function getWorkbench(domain:AgentDomain=getCurrentAgentDomain()):WorkbenchController{
 let store=stores.get(domain);if(!store){store=createWorkbenchController({domain,client:agentClient});stores.set(domain,store);}return store;
}
export function interactFunctional(action:FunctionalAction){return getWorkbench().interact(adaptFunctionalInteraction(action));}
export function useWorkbenchController({domain,client}:{domain:AgentDomain;client?:WorkbenchClient}){
 const controller=useMemo(()=>client?createWorkbenchController({domain,client}):getWorkbench(domain),[domain,client]);
 const state=useSyncExternalStore(controller.subscribe,controller.getState,controller.getState);
 return {...controller,state};
}
