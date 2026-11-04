/** Scene-owned elemental artwork. Gameplay durations live in the combat controller. */
export function createSlugEffects(THREE, scene) {
  const active = [];
  const colors = { fire: 0xff792d, healing: 0x80ffc0, earth: 0xcba58a, ice: 0xa6eeff, water: 0x42cfff, electric: 0xffe962, light: 0xffeab0, energy: 0x71ffee, web: 0xdcefe8 };
  const paint = (color, opacity = .8) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  function dispose(group) { const seen = new Set(); group.traverse(o => { if(o.geometry&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();} for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m&&!seen.has(m)){seen.add(m);m.dispose();} }); group.removeFromParent(); }
  function ring(group, color, radius = .6) { const m = new THREE.Mesh(new THREE.TorusGeometry(radius,.025,5,32),paint(color));m.rotation.x=Math.PI/2;group.add(m);return m; }
  function arc(group, color, radius=1) { const points=[];for(let i=0;i<13;i++)points.push(new THREE.Vector3((i/12-.5)*radius,Math.sin(i*5)*radius*.15,Math.cos(i*7)*radius*.13));const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color,transparent:true,opacity:.9}));group.add(line);return line; }
  function crosses(group, color) { for(let i=0;i<5;i++){const cross=new THREE.Group();for(const size of[[.06,.24,.035],[.22,.06,.035]])cross.add(new THREE.Mesh(new THREE.BoxGeometry(...size),paint(color)));cross.position.set(Math.sin(i*2.4)*.65,i*.22,Math.cos(i*2.4)*.65);group.add(cross);} }
  function emit(element, position, scale=1) {
    const color=colors[element]||0xc5fff2,group=new THREE.Group();group.position.copy(position);group.scale.setScalar(scale);scene.add(group);
    const count=element==='water'?44:28,positions=[],velocities=[];
    for(let i=0;i<count;i++){positions.push(0,0,0);const angle=i*2.39996;velocities.push(new THREE.Vector3(Math.cos(angle)*(1+i%4),1.3+(i%7)*.45,Math.sin(angle)*(1+i%4)));}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const points=new THREE.Points(geo,new THREE.PointsMaterial({color,size:element==='fire'?.13:.085,transparent:true,opacity:.9,depthWrite:false}));group.add(points);
    if(['water','earth','healing','ice'].includes(element))ring(group,color);
    if(element==='healing')crosses(group,color);
    if(element==='ice')for(let i=0;i<7;i++){const shard=new THREE.Mesh(new THREE.OctahedronGeometry(.18),paint(color));shard.position.set(Math.cos(i)*.55,.2,Math.sin(i)*.55);shard.scale.y=2;group.add(shard);}
    if(element==='electric')for(let i=0;i<4;i++){const line=arc(group,color,2);line.rotation.set(i*.7,i*1.3,i);}
    if(element==='earth'){const fist=new THREE.Mesh(new THREE.BoxGeometry(.55,.4,.45),paint(0xb8a293));fist.rotation.z=-.4;group.add(fist);}
    group.userData.element=element;active.push({group,points,velocities,life:element==='healing'?1.1:.7,max:element==='healing'?1.1:.7});
    if(active.length>30){const old=active.shift();dispose(old.group);}return group;
  }
  function projectile(p) {
    const group=new THREE.Group(),color=colors[p.element]||0xaaffee;group.userData.element=p.element;
    if(p.element==='electric'){for(let i=0;i<3;i++){const l=arc(group,color,.85);l.rotation.z=i*Math.PI/3;}}
    else if(p.element==='earth'){const fist=new THREE.Mesh(new THREE.BoxGeometry(.34,.28,.38),paint(0xc8b3a2));fist.position.z=-.18;group.add(fist);for(let i=0;i<4;i++){const k=new THREE.Mesh(new THREE.BoxGeometry(.075,.1,.1),paint(0x827e7a));k.position.set((i-1.5)*.075,.1,-.38);group.add(k);}}
    else if(p.element==='healing')crosses(group,color);
    else {for(let i=0;i<3;i++){const m=new THREE.Mesh(p.element==='fire'?new THREE.ConeGeometry(.12,.5,6):p.element==='ice'?new THREE.OctahedronGeometry(.14):new THREE.TorusGeometry(.17,.018,5,20),paint(color,.65));m.position.z=i*.16;if(p.element==='fire')m.rotation.x=Math.PI/2;group.add(m);}}
    p.mesh.add(group);p.elementEffect=group;return group;
  }
  function enemy(e,time) {
    if(!e.elementVisual){const group=new THREE.Group();e.root.add(group);const ice=new THREE.Mesh(new THREE.IcosahedronGeometry(e.radius*1.3,1),paint(0x8bdfff,.4));ice.scale.y=e.boss?1:2.5;group.add(ice);const flame=new THREE.Group();for(let i=0;i<6;i++){const f=new THREE.Mesh(new THREE.ConeGeometry(.13,.65,5),paint(i%2?0xffc457:0xff6423,.75));f.position.set(Math.cos(i)*e.radius,-.3,Math.sin(i)*e.radius);flame.add(f);}group.add(flame);e.elementVisual={group,ice,flame};}
    const {ice,flame}=e.elementVisual;ice.visible=e.frozen>0;flame.visible=e.burning>0;flame.children.forEach((f,i)=>{f.scale.y=.7+Math.sin(time*16+i)*.3;});
  }
  function update(dt) { for(let i=active.length-1;i>=0;i--){const fx=active[i];fx.life-=dt;if(fx.life<=0){dispose(fx.group);active.splice(i,1);continue;}const fraction=fx.life/fx.max;fx.group.children.forEach(o=>{if(o.material)o.material.opacity=fraction*.8;});const a=fx.points.geometry.attributes.position;fx.velocities.forEach((v,n)=>{v.y-=dt*4;a.setXYZ(n,a.getX(n)+v.x*dt,a.getY(n)+v.y*dt,a.getZ(n)+v.z*dt);});a.needsUpdate=true;fx.group.children.filter(o=>o.geometry?.type==='TorusGeometry').forEach(o=>o.scale.addScalar(dt*2));} }
  return {emit,projectile,enemy,update,clear(){for(const fx of active)dispose(fx.group);active.length=0;},get count(){return active.length;}};
}
