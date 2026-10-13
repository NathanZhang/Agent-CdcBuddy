import {expect,it} from 'vitest';
it('resolves aliases and county parents using real local boundaries',async()=>{
 const catalog=await import('@/infrastructure/geo/region-catalog').catch(()=>null);
 expect(catalog,'region candidate service must exist').not.toBeNull();if(!catalog)return;
 expect(catalog.searchRegionCandidates('郑州').candidates.map(c=>[c.code,c.name])).toEqual([['410100','郑州市']]);
 expect(catalog.searchRegionCandidates('新郑').candidates[0]).toMatchObject({code:'410184',level:'county',parentCode:'410100'});
 const bound=catalog.bindRegionSelection({includeCandidateIds:['410100'],excludeCandidateIds:[]},catalog.searchRegionCandidates('郑州').candidates);
 expect(bound.includeCodes).toEqual(['410100']);
 expect(()=>catalog.bindRegionSelection({includeCandidateIds:['999999'],excludeCandidateIds:[]},[])).toThrow();
});
it('rejects duplicate codes and dangling parents rather than silently guessing',async()=>{
 const catalog=await import('@/infrastructure/geo/region-catalog').catch(()=>null);expect(catalog).not.toBeNull();if(!catalog)return;
 const valid=catalog.loadRegionCatalog();
 expect(()=>catalog.validateRegionCatalog({...valid,regions:[...valid.regions,valid.regions[0]]})).toThrow(/duplicate/i);
 expect(()=>catalog.validateRegionCatalog({...valid,regions:valid.regions.filter(r=>r.code!=='410100')})).toThrow(/parent/i);
 expect(catalog.searchRegionCandidates('',undefined,20).hasMore).toBe(true);
});
