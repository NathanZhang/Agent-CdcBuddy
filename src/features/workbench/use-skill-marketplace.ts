'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {AgentDomain} from '@/contracts/dataset';
import {authHeaders} from '@/infrastructure/auth/client';
import {buildMarketplaceSkills} from '@/lib/skills/marketplace';

/** Navbar, drawer and user-created scenario entries share this one authorized snapshot. */
export function useSkillMarketplace(domain:AgentDomain,userId:string,role:string,runId?:string,busy=false){
 const [catalog,setCatalog]=useState<{owner:string;standard:any[];custom:any[]}|null>(null);
 const [error,setError]=useState('');
 const request=useRef(0);
 const owner=`${domain}/${userId}/${role}`;
 const refresh=useCallback(async()=>{
  const revision=++request.current;
  try{
   const response=await fetch('/api/skills',{headers:await authHeaders(),cache:'no-store'});
   const body=await response.json();
   if(!response.ok||!body.success||!Array.isArray(body.data?.standardSkills)||!Array.isArray(body.data?.customSkills))throw new Error(body.error??'读取技能列表失败');
   if(revision===request.current){setCatalog({owner,standard:body.data.standardSkills,custom:body.data.customSkills});setError('');}
  }catch(e){if(revision===request.current)setError(e instanceof Error?e.message:'读取技能列表失败');}
 },[owner]);
 useEffect(()=>{if(!busy)void refresh();return ()=>{request.current++;};},[refresh,runId,busy]);
 const current=catalog?.owner===owner?catalog:null;
 const skills=useMemo(()=>buildMarketplaceSkills(domain,current?.standard??[],current?.custom??[]),[domain,current]);
 return {skills,customSkills:current?.custom??[],loaded:!!current,error,refresh};
}
