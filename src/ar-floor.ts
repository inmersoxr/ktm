export type Position={x:number;y:number;z:number};
export type Rotation={x:number;y:number;z:number;w:number};
export type FloorTracker={count:number;last:Position|null;lastAt:number};
export const FLOOR_HIT_TIMEOUT_MS=400;
export const REQUIRED_FLOOR_HITS=4;
export const createFloorTracker=():FloorTracker=>({count:0,last:null,lastAt:0});
export const resetFloorTracker=(state:FloorTracker):void=>{state.count=0;state.last=null;state.lastAt=0;};
export const isHorizontalUpward=(q:Rotation):boolean=>{
  if(![q.x,q.y,q.z,q.w].every(Number.isFinite))return false;
  const norm=Math.hypot(q.x,q.y,q.z,q.w);
  if(norm<1e-6)return false;
  // The hit pose's local +Y is the world-space surface normal.
  const x=q.x/norm,z=q.z/norm;
  return 1-2*(x*x+z*z)>=0.94;
};
export const acceptFloorSample=(state:FloorTracker,p:Position,q:Rotation,now:number):boolean=>{
  if(![p.x,p.y,p.z,now].every(Number.isFinite)||!isHorizontalUpward(q)){
    resetFloorTracker(state);return false;
  }
  const prior=state.last;
  const stable=!!prior&&now>=state.lastAt&&now-state.lastAt<=250&&
    Math.hypot(p.x-prior.x,p.y-prior.y,p.z-prior.z)<=0.12;
  state.count=stable?Math.min(REQUIRED_FLOOR_HITS,state.count+1):1;
  state.last={x:p.x,y:p.y,z:p.z};state.lastAt=now;
  return state.count>=REQUIRED_FLOOR_HITS;
};
