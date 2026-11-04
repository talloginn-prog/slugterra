import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBlasterModel } from '../src/models.js';
import { SLUG_CATALOG } from '../src/content.js';
for(const spec of Object.values(SLUG_CATALOG))test(`${spec.species} fits lengthwise inside the cartridge and leaves it during flight`,()=>{
 const slug={...spec,inFlight:false},gun=createBlasterModel(THREE,[slug]);gun.setWeapon({id:'standard'});gun.group.updateMatrixWorld(true);
 const loaded=gun.group.getObjectByName('Loaded companion inside cartridge');assert.ok(loaded);
 const bounds=new THREE.Box3().setFromObject(loaded,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 assert.ok(size.x<=.105001&&size.y<=.105001&&size.z<=.130001,JSON.stringify(size));
 assert.ok(center.distanceTo(loaded.parent.getWorldPosition(new THREE.Vector3()))<1e-6);
 gun.update(.016);assert.equal(gun.group.userData.loadedSlugVisible,true);slug.inFlight=true;gun.update(.016);assert.equal(loaded.visible,false);
 slug.inFlight=false;gun.update(.016);assert.equal(loaded.visible,true);
});
