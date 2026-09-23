export type Point = {x:number;y:number;z:number};
export function orbitAboveCenter(camera:Point, target:Point, center:Point, change:number, min=0, max=85) {
  const dx=camera.x-center.x, dz=camera.z-center.z;
  const flat=Math.hypot(dx,dz);
  if(flat<1e-6) return {camera:{...camera},target:{...target},pitch:max};
  const old=Math.atan2(camera.y-center.y,flat)*180/Math.PI;
  const pitch=Math.max(min,Math.min(max,old+change));
  const delta=(pitch-old)*Math.PI/180, c=Math.cos(delta), s=Math.sin(delta);
  const fx=dx/flat,fz=dz/flat,rx=fz,rz=-fx;
  const turn=(p:Point):Point=>{
    const x=p.x-center.x,y=p.y-center.y,z=p.z-center.z;
    const radial=x*fx+z*fz,side=x*rx+z*rz;
    const newRadial=radial*c-y*s, newY=radial*s+y*c;
    return {x:center.x+fx*newRadial+rx*side,y:center.y+newY,z:center.z+fz*newRadial+rz*side};
  };
  return {camera:turn(camera),target:turn(target),pitch};
}
