import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSceneCollision } from '../src/collision.js';
import { createCharacterPhysics } from '../src/physics.js';
import { createCavern } from '../src/caverns.js';

function sceneWith(...objects) { const group=new THREE.Group();group.add(...objects);return createSceneCollision(group); }
function box(x,y,z,w,h,d,rotation=0) { const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial());mesh.position.set(x,y,z);mesh.rotation.y=rotation;mesh.userData.collisionSolid=true;return mesh; }
function actor(collision, position={x:0,y:1.85,z:0}) { return {position,controller:createCharacterPhysics({position,groundHeight:()=>0,getCollisionWorld:()=>collision})}; }
function walk(actor,input,seconds=1) { for(let n=0;n<seconds*120;n++)actor.controller.step(1/120,input); }

test('actual thin triangle walls block sprint and high velocity while allowing sliding',()=>{
 const collision=sceneWith(box(3,2,0,.02,4,20));
 const a=actor(collision);walk(a,{x:1,sprint:true},2);assert.ok(a.position.x<2.62);assert.ok(a.position.x>2.5);
 const fast=actor(collision);fast.controller.velocity.x=1000;fast.controller.step(1/120,{});assert.ok(fast.position.x<2.62);
 const slide=actor(collision);walk(slide,{x:1,z:.6},2);assert.ok(slide.position.z>3);assert.ok(slide.position.x<2.62);
 collision.dispose();
});
test('rotated structural walls use their triangles rather than an axis-aligned blocker',()=>{
 const collision=sceneWith(box(3,2,0,.05,4,20,Math.PI/4));
 const a=actor(collision);walk(a,{x:1},1);assert.ok(a.position.x<5);assert.ok(a.position.z>1);
 collision.dispose();
});
test('falling lands on raised geometry and stays supported; jumping and walking off remain possible',()=>{
 const collision=sceneWith(box(0,1,0,5,2,5));
 const a=actor(collision,{x:0,y:7,z:0});walk(a,{},2);
 assert.ok(Math.abs(a.position.y-3.85)<.001);assert.equal(a.controller.grounded,true);
 walk(a,{},1);assert.ok(Math.abs(a.position.y-3.85)<.001);
 a.controller.step(1/120,{jump:true});assert.ok(a.controller.velocity.y>0);assert.equal(a.controller.grounded,false);
 walk(a,{x:1},2);assert.ok(a.position.x>3);assert.ok(Math.abs(a.position.y-1.85)<.001);
 collision.dispose();
});
test('undersides stop the capsule head and tall side walls never snap the player on top',()=>{
 const ceiling=sceneWith(box(0,2.5,0,10,.2,10));
 const a=actor(ceiling);let highest=a.position.y;a.controller.step(1/120,{jump:true});
 for(let i=0;i<120;i++){a.controller.step(1/120,{});highest=Math.max(highest,a.position.y);}
 assert.ok(highest+.12<=2.401);assert.ok(Math.abs(a.position.y-1.85)<.001);
 const wall=sceneWith(box(3,2.5,0,1,5,10));const b=actor(wall);b.controller.step(1/120,{jump:true,x:1});walk(b,{x:1},2);assert.ok(b.position.x<2.13);assert.ok(Math.abs(b.position.y-1.85)<.001);
 ceiling.dispose();wall.dispose();
});
test('explicit solids respect transformed instance matrices and invisible proxies; decorative meshes stay permeable',()=>{
 const instances=new THREE.InstancedMesh(new THREE.BoxGeometry(.1,4,8),new THREE.MeshBasicMaterial(),2);instances.userData.collisionSolid=true;
 instances.setMatrixAt(0,new THREE.Matrix4().makeTranslation(3,2,0));instances.setMatrixAt(1,new THREE.Matrix4().makeTranslation(-3,2,0));
 const decoration=box(0,1,0,1,2,1);decoration.userData.collisionSolid=false;
 const invisible=box(0,1,5,6,2,.1);invisible.visible=false;
 const collision=sceneWith(instances,decoration,invisible);
 assert.equal(collision.solidCount,3);assert.ok(collision.segmentHit({x:0,y:1,z:0},{x:5,y:1,z:0})<.61);
 assert.ok(collision.segmentHit({x:0,y:1,z:0},{x:0,y:1,z:8})<.64);
 assert.equal(collision.segmentHit({x:-.2,y:1,z:0},{x:.2,y:1,z:0}),null);
 collision.dispose();
});
test('backside ceilings and double-sided shelter panels block from the intended interior',()=>{
 const panel=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));panel.rotation.y=Math.PI/2;panel.position.x=3;panel.userData.collisionSolid=true;
 const collision=sceneWith(panel);const a=actor(collision);walk(a,{x:1},1);assert.ok(a.position.x<2.63);
 const b=actor(collision,{x:6,y:1.85,z:0});walk(b,{x:-1},1);assert.ok(b.position.x>3.37);
 const roof=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshBasicMaterial({side:THREE.BackSide}));roof.rotation.x=-Math.PI/2;roof.position.y=2.4;roof.userData.collisionSolid=true;
 const roofWorld=sceneWith(roof);const c=actor(roofWorld);c.controller.step(1/120,{jump:true});walk(c,{},.2);assert.ok(c.position.y+.12<=2.401);
 collision.dispose();roofWorld.dispose();
});
test('restoring inside a solid recovers sideways without teleporting to its top',()=>{
 const collision=sceneWith(box(0,1.5,0,3,3,3));const a=actor(collision);
 assert.ok(Math.hypot(a.position.x,a.position.z)>1.87);assert.ok(Math.abs(a.position.y-1.85)<.001);
 walk(a,{},.5);assert.ok(Math.abs(a.position.y-1.85)<.001);
 collision.dispose();
});

// The counter sits beside sloping river rocks. A capsule can be supported by a
// rock edge while its center ray sees terrain below: that must not repeatedly
// snap the player down and push them backwards along the shop front.
test('the actual Haven merchant counter allows sustained diagonal sliding over uneven support',()=>{
 const world=createCavern(THREE,{id:'luminous',quality:'low'});
 const collision=createSceneCollision(world.group);
 try {
  const position={x:11,y:world.groundHeight(11,31.5)+1.85,z:31.5};
  const controller=createCharacterPhysics({position,groundHeight:world.groundHeight,getCollisionWorld:()=>collision});
  const a={position,controller};
  walk(a,{z:1},2);
  const front={...position};
  assert.ok(front.z<33.7,'the solid counter stops forward movement');
  walk(a,{x:-1,z:1},1.3);
  assert.ok(position.x<front.x-3.5,`sustained lateral input must slide, rather than stick: ${JSON.stringify({front,end:position})}`);
  assert.ok(Number.isFinite(position.y));
 } finally { collision.dispose();world.dispose(); }
});
