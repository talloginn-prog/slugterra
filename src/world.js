/** A self-contained procedural cavern. All artwork is generated locally. */
export function createWorld(THREE) {
  const group = new THREE.Group();
  group.name = 'The luminous frontier';
  let seed = 614209;
  const rand = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const range = (a,b) => a+(b-a)*rand();
  const riverX = z => -7 + Math.sin(z * .035) * 13;
  function groundHeight(x,z) {
    const base = 1.9 + Math.sin(x*.038)*1.1 + Math.cos(z*.041)*.85 + Math.sin(x*.09+z*.055)*.42;
    const d = Math.abs(x-riverX(z));
    const depression = Math.max(0,1-d/7.2);
    const groveIsland = 2.7 * Math.exp(-((x+20)**2+(z+35)**2)/24);
    return base*(1-depression*depression) - .48*depression*depression + groveIsland;
  }
  const mat = (color, emissive, intensity=0) => new THREE.MeshStandardMaterial({color, roughness:.87,metalness:.05,emissive:emissive||0,emissiveIntensity:intensity});
  // Small tileable textures add tactile detail without external assets or downloads.
  // Keep generation separate from the world RNG so artwork changes preserve layout.
  function surfaceTexture(kind) {
    if (typeof document === 'undefined') return null;
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d');if(!ctx)return null;
    const image=ctx.createImageData(256,256);
    const hash=(x,y)=>{let n=(x*374761393+y*668265263)>>>0;n=(n^(n>>>13))*1274126177;return((n^(n>>>16))>>>0)/4294967295;};
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const noise=hash(x,y),fine=hash(x*3+71,y*3+29),u=x/256*Math.PI*2,v=y/256*Math.PI*2;
      let value=220;
      if(kind==='moss'){
        const patches=Math.sin(u*3+Math.sin(v*2))*Math.cos(v*4+Math.sin(u*2));
        value=207+patches*20+noise*25;
        if(noise>.965)value-=60;
      }else if(kind==='bark'){
        const grain=Math.sin(u*18+Math.sin(v*2)*1.2+Math.sin(u*5)*.7);
        const crease=Math.pow((grain+1)*.5,6);
        value=211+noise*25-crease*61+Math.sin(v*7+u*3)*7;
      }else{
        const mottling=Math.sin(u*5+Math.sin(v*4))*Math.cos(v*7+Math.sin(u*2));
        const gills=Math.pow((Math.sin(u*33+Math.sin(v*2))+1)*.5,8);
        value=223+mottling*17+noise*10-gills*12;
        if(fine>.992)value=250;
      }
      const i=(y*256+x)*4;image.data[i]=value;image.data[i+1]=value+(kind==='moss'?4:0);image.data[i+2]=value-(kind==='bark'?7:kind==='moss'?3:0);image.data[i+3]=255;
    }
    ctx.putImageData(image,0,0);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
    if(kind==='moss')texture.repeat.set(18,18);else if(kind==='bark')texture.repeat.set(2,4);
    return texture;
  }
  const mossTexture=surfaceTexture('moss'),barkTexture=surfaceTexture('bark'),capTexture=surfaceTexture('cap');
  const stoneMat=mat(0x234948), barkMat=mat(0x254947), bronzeMat=mat(0x785b3e), glowCyan=mat(0x65e0d9,0x2ae8cd,1.4);
  if(barkTexture){barkMat.map=barkTexture;barkMat.bumpMap=barkTexture;barkMat.bumpScale=.17;}
  const mesh=(geo,material,x=0,y=0,z=0) => { const o=new THREE.Mesh(geo,material);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;};
  const dummy=new THREE.Object3D();
  const instanced=(geo, material, values) => {
    const batch=new THREE.InstancedMesh(geo,material,values.length);
    values.forEach((v,i)=>{dummy.position.set(v.x,v.y,v.z);dummy.rotation.set(v.rx||0,v.ry||0,v.rz||0);dummy.scale.set(v.sx??1,v.sy??1,v.sz??1);dummy.updateMatrix();batch.setMatrixAt(i,dummy.matrix);if(v.color!==undefined)batch.setColorAt(i,new THREE.Color(v.color));});
    batch.castShadow=false;batch.receiveShadow=true;batch.instanceMatrix.needsUpdate=true;group.add(batch);return batch;
  };
  const terrain=new THREE.PlaneGeometry(208,208,160,160);terrain.rotateX(-Math.PI/2);
  const positions=terrain.attributes.position, colors=[];
  const col=new THREE.Color();
  for(let i=0;i<positions.count;i++){
    const x=positions.getX(i),z=positions.getZ(i),y=groundHeight(x,z);positions.setY(i,y);
    const path=Math.abs(x-(7*Math.sin((z+20)*.041)+8));
    const noise=(Math.sin(x*1.7+z*.9)*Math.cos(z*1.3+x*.7)+1)*.5;
    col.setHex(path<2.2?0x737866:Math.abs(x-riverX(z))<7.5?0x39716d:0x265e54);
    col.multiplyScalar(.82+noise*.3);colors.push(col.r,col.g,col.b);
  }
  terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();
  const floor=mesh(terrain,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,map:mossTexture,bumpMap:mossTexture,bumpScale:.24}));floor.name='Living cavern floor';
  // A winding luminous stream, with an undulating reflective skin.
  const waterGeo=new THREE.PlaneGeometry(5.4,188,5,120);waterGeo.rotateX(-Math.PI/2);
  const wp=waterGeo.attributes.position;
  for(let i=0;i<wp.count;i++){const z=wp.getZ(i);wp.setX(i,wp.getX(i)+riverX(z));wp.setY(i,.2);}
  waterGeo.computeVertexNormals();
  const waterMaterial=new THREE.MeshStandardMaterial({color:0x147a85,emissive:0x0d788d,emissiveIntensity:.48,metalness:.65,roughness:.2,transparent:true,opacity:.88,side:THREE.DoubleSide});
  const water=mesh(waterGeo,waterMaterial);water.castShadow=false;
  const rippleGeo=new THREE.RingGeometry(.8,1,28);rippleGeo.rotateX(-Math.PI/2);
  const ripples=[];
  for(let i=0;i<18;i++){const z=range(-85,82),r=range(.3,1);ripples.push({x:riverX(z)+range(-1.8,1.8),y:.24,z,sx:r,sy:1,sz:r*.48});}
  instanced(rippleGeo,new THREE.MeshBasicMaterial({color:0x6bedee,transparent:true,opacity:.22,side:THREE.DoubleSide}),ripples);
  // River rocks and little stepping-stone crossings.
  const rocks=[];
  for(let i=0;i<230;i++){const z=range(-92,91),x=riverX(z)+(rand()<.5?-1:1)*range(3.2,8.6),s=range(.4,1.7);rocks.push({x,y:groundHeight(x,z)-.25,z,sx:s,sy:s*.65,sz:s*range(.7,1.6),ry:range(0,6.28),color:rand()<.2?0x467c7a:0x365752});}
  for(const z of [22,-18,-51])for(let i=-3;i<=3;i++){const x=riverX(z)+i*1.23;rocks.push({x,y:.3,z:z+Math.sin(i*2)*.4,sx:.8,sy:.5,sz:.85,ry:range(0,6)});}
  instanced(new THREE.DodecahedronGeometry(1,0),stoneMat,rocks);
  // Tall cliff teeth give the cavern a layered silhouette.
  const cliffs=[];
  for(let i=0;i<100;i++){const a=i/100*Math.PI*2,r=range(90,103),x=Math.sin(a)*r,z=Math.cos(a)*r;cliffs.push({x,y:groundHeight(x,z)+range(0,3),z,sx:range(4,11),sy:range(14,35),sz:range(4,10),ry:range(0,6.28),color:rand()<.3?0x173e40:0x1c4546});}
  instanced(new THREE.ConeGeometry(1,1,5),mat(0x234948),cliffs);
  // Glowing grasses: each cluster is a fan of three curved blades.
  const bladeGeo=new THREE.BufferGeometry();
  const bp=[],bi=[];
  for(let b=0;b<3;b++){
    const a=b*Math.PI/3,dx=Math.cos(a),dz=Math.sin(a),base=bp.length/3;
    bp.push(-dx*.16,0,-dz*.16, dx*.16,0,dz*.16, dx*.09,.7,dz*.09, dx*.6,1.65,dz*.6);
    bi.push(base,base+1,base+2,base,base+2,base+3);
  }
  bladeGeo.setAttribute('position',new THREE.Float32BufferAttribute(bp,3));bladeGeo.setIndex(bi);bladeGeo.computeVertexNormals();
  const foliageMat=new THREE.MeshStandardMaterial({color:0xffffff,emissive:0x1b9f83,emissiveIntensity:.25,roughness:.9,side:THREE.DoubleSide});
  const grass=[];const leafColors=[0x53a591,0x429d8c,0x1a9589,0x55c4a6,0x647cbb,0x9f66b5];
  for(let i=0;i<1800;i++){
    const x=range(-88,88),z=range(-87,87);if(x*x+z*z>90*90||Math.abs(x-riverX(z))<3.5)continue;
    const path=Math.abs(x-(7*Math.sin((z+20)*.041)+8));if(path<2.8&&rand()<.9)continue;
    const s=range(.28,.95);grass.push({x,y:groundHeight(x,z)-.03,z,sx:s,sy:s*range(.7,1.4),sz:s,ry:range(0,6.28),color:leafColors[Math.floor(rand()*leafColors.length)]});
  }
  instanced(bladeGeo,foliageMat,grass);
  // Ferns with luminous serrated fronds, concentrated on the banks and groves.
  const fernGeo=new THREE.BufferGeometry();const fp=[],fi=[];
  for(let f=0;f<7;f++){
    const a=f/7*Math.PI*2,dx=Math.sin(a),dz=Math.cos(a);
    for(let j=0;j<7;j++){
      const t=(j+1)/8,l=Math.sin(t*Math.PI)*.4,xx=dx*t*1.8,zz=dz*t*1.8,yy=Math.sin(t*Math.PI)*.75;
      const idx=fp.length/3;
      fp.push(xx,yy,zz,xx+dz*l,yy+.1,zz-dx*l,xx+dx*.32,yy+.1,zz+dz*.32,xx-dz*l,yy+.1,zz+dx*l);
      fi.push(idx,idx+1,idx+2,idx,idx+2,idx+3);
    }
  }
  fernGeo.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));fernGeo.setIndex(fi);fernGeo.computeVertexNormals();
  const ferns=[];
  for(let i=0;i<270;i++){const x=range(-76,76),z=range(-70,80);if(Math.abs(x-riverX(z))<4)continue;const s=range(.6,1.6);ferns.push({x,y:groundHeight(x,z),z,sx:s,sy:s,sz:s,ry:range(0,6.28),color:rand()<.23?0x9865b6:0x43aa91});}
  instanced(fernGeo,new THREE.MeshStandardMaterial({color:0xffffff,emissive:0x126b63,emissiveIntensity:.35,roughness:.8,side:THREE.DoubleSide}),ferns);
  // The iconic lantern mushrooms. Caps are broad, translucent-looking domes.
  const mushroomPositions=[[-23,34,9,6],[25,14,13,7],[-24,-5,17,8],[36,-28,14,8],[-49,-32,20,10],[14,-61,19,9],[52,42,15,8],[-55,48,17,8],[41,-67,22,10],[-33,-70,19,9],[-62,0,15,8]];
  for(let i=0;i<40;i++)mushroomPositions.push([range(-82,82),range(-80,75),range(3,9),range(2,4.4)]);
  const stems=[],caps=[],unders=[],rim=[],spots=[];
  const capColors=[0x399b92,0x268c8b,0x465c9d,0x7562ab,0x3c96b5];
  for(const [x,z,h,r] of mushroomPositions){if(Math.abs(x-riverX(z))<4)continue;const y=groundHeight(x,z);const ci=Math.floor(rand()*capColors.length);stems.push({x,y:y+h*.5,z,sx:r*.13,sy:h,sz:r*.13,rz:range(-.04,.04),color:0x6a9890});caps.push({x,y:y+h,z,sx:r,sy:r*.42,sz:r,ry:range(0,6.28),color:capColors[ci]});unders.push({x,y:y+h-.08,z,sx:r*.95,sy:r*.065,sz:r*.95,color:ci===3?0xd192e5:0x69d6bf});rim.push({x,y:y+h,z,sx:r,sy:1,sz:r,rx:-Math.PI/2,color:ci===3?0xd190f4:0x55e6d4});
    for(let s=0;s<11;s++){const a=range(0,6.28),rr=range(.15,.87),yoff=Math.sqrt(1-rr*rr)*r*.42;spots.push({x:x+Math.sin(a)*r*rr,y:y+h+yoff,z:z+Math.cos(a)*r*rr,sx:r*range(.025,.06),sy:r*.012,sz:r*range(.025,.06),color:ci===3?0xecb8ff:0xb8ffdf});}
  }
  instanced(new THREE.CylinderGeometry(.72,1,1,9),barkMat,stems);
  const mushroomCapMat=mat(0xffffff,0x16776d,.38);mushroomCapMat.map=capTexture;mushroomCapMat.bumpMap=capTexture;mushroomCapMat.bumpScale=.09;
  instanced(new THREE.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI/2),mushroomCapMat,caps);
  instanced(new THREE.SphereGeometry(1,16,8),mat(0xffffff,0x5ed7b9,.9),unders);
  instanced(new THREE.TorusGeometry(.97,.018,4,40),mat(0xffffff,0x4edacb,1.8),rim);
  instanced(new THREE.SphereGeometry(1,6,4),mat(0xffffff,0x98ffd8,2),spots);
  // Enormous ancient trunks, root arches and shelf fungi.
  function tube(points,r,material,segments=28){const c=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));return mesh(new THREE.TubeGeometry(c,segments,r,7,false),material);}
  const shelves=[];
  for(const [x,z,h] of [[-41,-23,41],[49,-41,43],[-69,30,38],[30,-85,49],[-30,-89,47]]){
    const y=groundHeight(x,z);
    const trunk=mesh(new THREE.CylinderGeometry(1.6,4.4,h,9,6),barkMat,x,y+h/2,z);trunk.rotation.z=Math.sin(x)*.06;
    for(let k=0;k<5;k++){const a=k/5*6.28;const ex=x+Math.sin(a)*range(9,15),ez=z+Math.cos(a)*range(9,15);tube([[x,y+10,z],[x+Math.sin(a)*4,y+3,z+Math.cos(a)*4],[ex,groundHeight(ex,ez),ez]],.9,barkMat,15);}
    for(let k=0;k<4;k++){const a=k/4*6.28+.3;const bx=x+Math.sin(a)*10,bz=z+Math.cos(a)*10;tube([[x,y+h*.58,z],[x+Math.sin(a)*6,y+h*.85,z+Math.cos(a)*6],[bx,y+h*.78,bz]],.65,barkMat,15);shelves.push({x:bx,y:y+h*.78,z:bz,sx:6,sy:1.1,sz:6,ry:a,color:0x25877c});}
    for(let k=0;k<8;k++){const a=range(0,6.28),hh=range(4,h*.6);shelves.push({x:x+Math.sin(a)*3,y:y+hh,z:z+Math.cos(a)*3,sx:range(1.3,2.8),sy:.35,sz:range(1.2,2.4),ry:a,color:rand()<.25?0x7c68b4:0x41aea0});}
  }
  instanced(new THREE.SphereGeometry(1,14,7,0,Math.PI*2,0,Math.PI/2),mat(0xffffff,0x22968c,.6),shelves);
  const rootArches=[[[ -17,2,50],[-13,14,41],[-3,16,31],[4,3,25]],[[32,2,-5],[25,15,-13],[13,18,-15],[7,2,-22]],[[-47,3,-48],[-39,16,-44],[-29,13,-39],[-24,2,-29]]];
  rootArches.forEach(p=>tube(p,1.15,barkMat,36));
  // Hanging glowing tendrils, all with the same reusable bead geometry.
  const beads=[];
  for(let i=0;i<18;i++){
    const x=range(-55,60),z=range(-73,35),top=range(23,38),len=range(6,14);const points=[];
    for(let k=0;k<5;k++)points.push([x+Math.sin(k*.8+i)*.6,top-k/4*len,z+Math.cos(k+i)*.4]);
    tube(points,.045,mat(0x418b89,0x168a8c,.4),12);
    for(let k=0;k<8;k++)beads.push({x:x+Math.sin(k/2*.8+i)*.6,y:top-k/8*len,z:z+Math.cos(k/2+i)*.4,sx:.13,sy:.26,sz:.13,color:rand()<.3?0x9a86ee:0x3dced5});
  }
  instanced(new THREE.SphereGeometry(1,6,5),mat(0xffffff,0x3cecf1,1.4),beads);
  // Six-sided crystals with clean, tall silhouettes.
  const crystalGeo=new THREE.CylinderGeometry(.01,.65,3,5,1);crystalGeo.translate(0,1.5,0);
  const crystals=[];
  for(let i=0;i<105;i++){const a=range(0,6.28),r=range(15,82),x=Math.sin(a)*r,z=Math.cos(a)*r;if(Math.abs(x-riverX(z))<5)continue;const s=range(.35,1.5);crystals.push({x,y:groundHeight(x,z),z,sx:s,sy:s*range(.7,1.8),sz:s,rx:range(-.25,.25),rz:range(-.25,.25),color:rand()<.35?0xb26ad4:0x66d6d3});}
  instanced(crystalGeo,new THREE.MeshStandardMaterial({color:0xffffff,emissive:0x50989c,emissiveIntensity:.75,roughness:.25,metalness:.3}),crystals);
  const landmarks=[
    {id:'guide',name:'Haven Outpost',subtitle:'Ranger outpost',position:{x:0,y:groundHeight(0,35),z:35},color:0xf5bb68},
    {id:'shard-west',name:'Luminous Grove',subtitle:'Echo fragment',position:{x:-34,y:groundHeight(-34,5),z:5},color:0x7ceacb},
    {id:'shard-east',name:'Violet Falls',subtitle:'Echo fragment',position:{x:30,y:groundHeight(30,-12),z:-12},color:0xb58cff},
    {id:'shard-depths',name:'Ancient Roots',subtitle:'Echo fragment',position:{x:-20,y:groundHeight(-20,-35),z:-35},color:0x6bcff2},
    {id:'boss',name:'The Heartstone',subtitle:'The corrupted guardian',position:{x:0,y:groundHeight(0,-52),z:-52},color:0xf185bf},
  ];
  const rotating=[],pulses=[];
  for(const lm of landmarks){
    const {x,y,z}=lm.position;
    if(lm.id==='guide')continue;
    mesh(new THREE.CylinderGeometry(3.4,3.9,.5,8),stoneMat,x,y+.05,z);
    const ring=mesh(new THREE.TorusGeometry(2.8,.04,6,64),mat(lm.color,lm.color,1.1),x,y+.33,z);ring.rotation.x=-Math.PI/2;
    const c=mesh(new THREE.OctahedronGeometry(lm.id==='boss'?2.4:.7,0),new THREE.MeshStandardMaterial({color:lm.color,emissive:lm.color,emissiveIntensity:.75,metalness:.4,roughness:.15}),x,y+(lm.id==='boss'?7:2),z);c.scale.y=lm.id==='boss'?1.7:1.4;lm.object=c;rotating.push({obj:c,base:c.position.y,phase:rand()*6});
    const beam=mesh(new THREE.CylinderGeometry(.08,.25,lm.id==='boss'?27:14,12,1,true),new THREE.MeshBasicMaterial({color:lm.color,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide}),x,y+(lm.id==='boss'?15:9),z);beam.castShadow=false;
    for(let k=0;k<5;k++){const a=k/5*Math.PI*2;mesh(crystalGeo,mat(0x537b7f,lm.color,.2),x+Math.sin(a)*2.3,y+.3,z+Math.cos(a)*2.3).scale.set(.5,range(.6,1.2),.5);}
    pulses.push(ring);
  }
  // Haven: a warm pocket of civilization in the vast blue wilderness.
  const hy=groundHeight(0,35);
  mesh(new THREE.CylinderGeometry(5.6,5.9,.45,32),stoneMat,0,hy-.05,35);
  const campRing=mesh(new THREE.TorusGeometry(5.3,.07,6,64),mat(0xffc180,0xffa33f,1.4),0,hy+.21,35);campRing.rotation.x=-Math.PI/2;
  for(const [x,z,a] of [[-5,38,-.4],[5,38,.4]]){
    const y=groundHeight(x,z);
    const tent=mesh(new THREE.ConeGeometry(3.3,5,5,1,true),new THREE.MeshStandardMaterial({color:0x827551,emissive:0x9b682b,emissiveIntensity:.17,roughness:.9,side:THREE.DoubleSide}),x,y+2.1,z);tent.rotation.y=a;
    mesh(new THREE.CylinderGeometry(.11,.14,4,6),bronzeMat,x,y+2,z);
    const lamp=mesh(new THREE.SphereGeometry(.22,8,6),mat(0xffd693,0xffa33a,3),x,y+4.5,z);
    const light=new THREE.PointLight(0xffb555,8,13,2);light.position.copy(lamp.position);group.add(light);
  }
  for(const [x,z]of [[-7,30],[7,30]]){
    const y=groundHeight(x,z);mesh(new THREE.CylinderGeometry(.13,.18,3.2,7),bronzeMat,x,y+1.6,z);mesh(new THREE.OctahedronGeometry(.4,0),mat(0xffe1a6,0xffad40,2),x,y+3.3,z);
    const hoop=mesh(new THREE.TorusGeometry(.55,.045,6,24),bronzeMat,x,y+3.3,z);hoop.rotation.y=Math.PI/2;
  }
  const light=new THREE.PointLight(0x56ffe3,14,32,2);light.position.set(-24,10,-5);group.add(light);
  const bossLight=new THREE.PointLight(0xe273cc,18,29,2);bossLight.position.set(0,8,-52);group.add(bossLight);
  // Drifting spores populate the space without hundreds of draw calls.
  const particleCount=460,particlePositions=new Float32Array(particleCount*3),particleColors=new Float32Array(particleCount*3),particleSeeds=[];
  for(let i=0;i<particleCount;i++){const x=range(-75,75),z=range(-80,75),y=range(1.2,24);particlePositions.set([x,y,z],i*3);col.setHex(rand()<.2?0xe2a0ef:rand()<.4?0x92fbe4:0x6cc6d9);particleColors.set([col.r,col.g,col.b],i*3);particleSeeds.push({x,y,z,s:range(.2,1),p:range(0,6.28)});}
  const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));particleGeo.setAttribute('color',new THREE.BufferAttribute(particleColors,3));
  const particleMat=new THREE.PointsMaterial({color:0xffffff,size:.13,vertexColors:true,transparent:true,opacity:.7,sizeAttenuation:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const particles=new THREE.Points(particleGeo,particleMat);particles.frustumCulled=false;group.add(particles);
  // A starry ceiling, high enough to feel like an immense cavern.
  const ceilingPositions=[];
  for(let i=0;i<230;i++){const a=range(0,6.28),r=range(30,110);ceilingPositions.push(Math.sin(a)*r,range(40,70),Math.cos(a)*r);}
  const ceilingGeo=new THREE.BufferGeometry();ceilingGeo.setAttribute('position',new THREE.Float32BufferAttribute(ceilingPositions,3));group.add(new THREE.Points(ceilingGeo,new THREE.PointsMaterial({color:0x77cfce,size:.12,transparent:true,opacity:.45,depthWrite:false})));
  return {
    group,groundHeight,spawn:{x:0,z:28},landmarks,bounds:95,
    update(time,dt){
      rotating.forEach(({obj,base,phase})=>{obj.rotation.y=time*.35;obj.rotation.z=Math.sin(time*.4+phase)*.12;obj.position.y=base+Math.sin(time*1.2+phase)*.22;});
      pulses.forEach((o,i)=>{o.material.emissiveIntensity=1+Math.sin(time*1.3+i)*.2;});
      const p=particleGeo.attributes.position;
      for(let i=0;i<particleCount;i++){const s=particleSeeds[i];p.setXYZ(i,s.x+Math.sin(time*.12+s.p)*1.4,s.y+Math.sin(time*.25*s.s+s.p)*.8,s.z+Math.cos(time*.15+s.p)*1.2);}p.needsUpdate=true;
      waterMaterial.emissiveIntensity=.42+Math.sin(time*.7)*.06;
    }
  };
}
