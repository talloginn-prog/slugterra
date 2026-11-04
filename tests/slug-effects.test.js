import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createSlugEffects} from '../src/slug-effects.js';
test('each requested element has visible owned projectile artwork and impact resources are released',()=>{
 const scene=new THREE.Scene(),fx=createSlugEffects(THREE,scene);const signatures=new Set();
 for(const element of ['fire','healing','earth','ice','water','electric']){
  const p={mesh:new THREE.Group(),element};const aura=fx.projectile(p);assert.equal(aura.parent,p.mesh);assert.equal(aura.userData.element,element);
  signatures.add(JSON.stringify(aura.children.map(o=>[o.type,o.geometry?.type,o.material?.color?.getHex()])));
  const impact=fx.emit(element,new THREE.Vector3(1,2,3));assert.equal(impact.parent,scene);
  let disposed=false;impact.children.find(o=>o.geometry).geometry.addEventListener('dispose',()=>{disposed=true;});fx.update(2);assert.equal(disposed,true);assert.equal(impact.parent,null);
 }
 assert.equal(signatures.size,6);assert.equal(fx.count,0);
 fx.emit('water',new THREE.Vector3());fx.clear();assert.equal(scene.children.length,0);
});
test('fire and freeze target overlays follow their timers without replacing the enemy model',()=>{
 const scene=new THREE.Scene(),fx=createSlugEffects(THREE,scene),enemy={root:new THREE.Group(),radius:.46,burning:3,frozen:0};
 fx.enemy(enemy,0);assert.equal(enemy.elementVisual.flame.visible,true);assert.equal(enemy.elementVisual.ice.visible,false);
 enemy.burning=0;enemy.frozen=2;fx.enemy(enemy,1);assert.equal(enemy.elementVisual.flame.visible,false);assert.equal(enemy.elementVisual.ice.visible,true);
 enemy.frozen=0;fx.enemy(enemy,2);assert.equal(enemy.elementVisual.ice.visible,false);
});
