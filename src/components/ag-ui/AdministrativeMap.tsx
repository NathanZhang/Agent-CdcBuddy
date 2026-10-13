'use client';
import React from 'react';
import type {MapView} from '@/contracts/map-view';
import {MapCanvas} from './MapCanvas';
export function AdministrativeMap({view}:{view:MapView}){return <MapCanvas composition={{type:'MAP_COMPOSITION',mapId:view.mapId,revision:0,baseResultRef:{runId:view.mapId.replace(/-map$/,'')},base:view,layers:[],layerOutcomes:[],legendGroups:[],cameraPolicy:'fitDisplayRegion',lineage:[]}}/>;}
