/** Original RPG adversaries: articulated frontier slingers and the Hollow Warden.
 * Root is the combat center, local -Z is forward. No franchise character is
 * represented by these original outlaw designs. Every resource is scene-owned.
 */
export function createEnemyVisual(THREE, { boss = false, variant = 0 } = {}) {
  const root = new THREE.Group();
  const materials = new Map();
  const material = (color, emissive = 0, intensity = 0) => {
    const key = `${color}:${emissive}:${intensity}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, roughness: .72, metalness: .2 }));
    return materials.get(key);
  };
  const add = (group, geometry, paint, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, paint); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  const joint = (group, x, y, z) => { const node = new THREE.Group(); node.position.set(x, y, z); group.add(node); return node; };
  const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
  const sphere = (radius, width = 12, height = 8) => new THREE.SphereGeometry(radius, width, height);
  const pink = material(0xe2a1d7, 0xdb55bd, .7);
  let body, eye, halo, muzzle, height, centerHeight, radius, animate;
  if (!boss) {
    root.name = 'Frontier outlaw slinger';
    root.userData.enemyDesign = 'original-frontier-slinger';
    const coats = [0x72534b, 0x385b66, 0x575067];
    const coat = material(coats[Math.abs(variant | 0) % coats.length]);
    const dark = material(0x202c37), cloth = material(0x293744), skin = material(0xc99773), metal = material(0x788892);
    body = add(root, new THREE.CapsuleGeometry(.23, .28, 4, 10), coat, 0, .28, 0); body.scale.z = .76;
    add(root, box(.43, .12, .27), dark, 0, -.01, 0);
    add(root, box(.09, .1, .025), metal, 0, .01, -.15);
    // Chest armor, slanted strap, scarf and a compact utility pack give a
    // readable frontier silhouette even against a dark cavern background.
    add(root, box(.27, .26, .035), metal, 0, .32, -.19);
    const strap = add(root, box(.075, .58, .07), dark, -.04, .3, -.22); strap.rotation.z = -.48;
    add(root, new THREE.TorusGeometry(.16, .07, 5, 12), material(0xb56a49), 0, .59, 0).rotation.x = Math.PI / 2;
    add(root, box(.32, .38, .17), cloth, 0, .27, .2);
    add(root, sphere(.19), skin, 0, .79, -.01).scale.set(1, 1.16, .95);
    add(root, new THREE.CylinderGeometry(.225, .23, .15, 10), dark, 0, .96, 0);
    add(root, new THREE.CylinderGeometry(.30, .30, .035, 12), dark, 0, .895, -.025);
    eye = add(root, box(.285, .07, .06), pink, 0, .79, -.175);
    add(root, box(.25, .135, .1), cloth, 0, .66, -.15);
    const arms = [], legs = [];
    for (const side of [-1, 1]) {
      const hip = joint(root, side * .155, -.05, 0);
      add(hip, new THREE.CapsuleGeometry(.11, .24, 3, 8), cloth, 0, -.21, 0);
      const knee = joint(hip, 0, -.43, 0);
      add(knee, new THREE.CapsuleGeometry(.095, .22, 3, 8), dark, 0, -.19, 0);
      add(knee, box(.18, .22, .32), dark, 0, -.46, -.055);
      add(knee, box(.125, .15, .04), metal, 0, -.03, -.10);
      legs.push({ hip, knee, side });
      const shoulder = joint(root, side * .27, .49, .015);
      add(shoulder, sphere(.13), coat);
      add(shoulder, new THREE.CapsuleGeometry(.085, .18, 3, 8), coat, 0, -.17, 0);
      const elbow = joint(shoulder, 0, -.33, 0);
      add(elbow, new THREE.CapsuleGeometry(.073, .18, 3, 8), dark, 0, -.15, 0);
      add(elbow, sphere(.085), dark, 0, -.31, 0);
      arms.push({ shoulder, elbow, side });
    }
    const weapon = joint(root, .22, .22, -.31);
    add(weapon, box(.14, .15, .39), metal, 0, 0, -.04);
    add(weapon, box(.11, .21, .1), dark, 0, -.12, .07).rotation.x = -.25;
    const barrel = add(weapon, new THREE.CylinderGeometry(.045, .06, .28, 10), dark, 0, .015, -.31); barrel.rotation.x = Math.PI / 2;
    halo = add(weapon, new THREE.TorusGeometry(.06, .012, 4, 12), pink, 0, .015, -.456);
    muzzle = joint(weapon, 0, .015, -.47);
    height = 2.13; centerHeight = 1.05; radius = .46;
    let gait = 0;
    animate = ({ time = 0, dt = 1 / 60, speed = 0, phase = 'patrol', telegraph = 0, aimPitch = 0, stagger = 0 } = {}) => {
      const blend = 1 - Math.exp(-12 * Math.max(0, dt));
      const stride = Math.min(1, Math.max(0, speed) / 2.4);
      gait += Math.max(0, dt) * Math.max(0, speed) * 3.2;
      for (const leg of legs) {
        const cycle = Math.sin(gait + (leg.side === 1 ? Math.PI : 0));
        leg.hip.rotation.x = cycle * .44 * stride;
        leg.knee.rotation.x = Math.max(0, -cycle) * .56 * stride;
      }
      const aiming = ['alert', 'windup', 'recovery', 'search'].includes(phase);
      for (const arm of arms) {
        const target = aiming ? 1.05 + aimPitch * .45 : Math.sin(gait + (arm.side === 1 ? 0 : Math.PI)) * .26 * stride;
        arm.shoulder.rotation.x += (target - arm.shoulder.rotation.x) * blend;
        arm.shoulder.rotation.z = -arm.side * (aiming ? .22 : .08);
        arm.elbow.rotation.x = aiming ? .7 : .12;
      }
      body.rotation.z = stagger > 0 ? Math.sin(time * 24) * .08 : Math.sin(gait * 2) * .015 * stride;
      weapon.visible = true; weapon.rotation.x = aiming ? aimPitch * .6 : -.12;
      halo.scale.setScalar(1 + telegraph * .45);
      eye.material.emissiveIntensity = phase === 'windup' ? 1.5 + telegraph * 3.5 : .65;
    };
  } else {
    root.name = 'Hollow Warden'; root.userData.enemyDesign = 'original-hollow-warden';
    const shell = material(0x303b4b, 0x291e35, .15), plate = material(0x546477);
    body = add(root, new THREE.IcosahedronGeometry(2.1, 2), shell); body.scale.y = .85;
    eye = add(root, sphere(.55, 16, 10), pink, 0, .2, -1.85);
    for (const side of [-1, 1]) {
      const horn = add(root, new THREE.ConeGeometry(.32, 2.1, 7), plate, side * 1.45, 1.55, -.1); horn.rotation.z = side * -.35;
    }
    const limbs = [];
    for (const side of [-1, 1]) for (const front of [-1, 1]) {
      const pivot = joint(root, side * 1.1, -.55, front * .85);
      const limb = add(pivot, new THREE.CylinderGeometry(.18, .26, 2.6, 7), shell, side * .4, -1.2, 0); limb.rotation.z = side * -.28;
      add(pivot, new THREE.ConeGeometry(.34, .5, 6), plate, side * .76, -2.4, -.12).rotation.x = Math.PI;
      limbs.push({ pivot, side, front });
    }
    halo = add(root, new THREE.TorusGeometry(2.55, .05, 5, 48), pink); halo.rotation.x = Math.PI / 2;
    muzzle = joint(root, 0, .2, -2.45);
    height = 5.9; centerHeight = 3.2; radius = 2.4;
    let gait = 0;
    animate = ({ time = 0, dt = 1 / 60, speed = 0, telegraph = 0 } = {}) => {
      gait += Math.max(0, dt) * speed * 1.7;
      for (const limb of limbs) limb.pivot.rotation.x = Math.sin(gait + (limb.side === limb.front ? 0 : Math.PI)) * .19 * Math.min(1, speed / 2);
      halo.rotation.z = time * .4; halo.scale.setScalar(1 + telegraph * .18);
    };
  }
  const hpGroup = joint(root, 0, boss ? 3 : 1.3, 0);
  add(hpGroup, new THREE.PlaneGeometry(boss ? 2.6 : 1.35, .075), new THREE.MeshBasicMaterial({ color: 0x243b42 }));
  const hpBar = add(hpGroup, new THREE.PlaneGeometry(boss ? 2.6 : 1.35, .075), new THREE.MeshBasicMaterial({ color: boss ? 0xf090c9 : 0x74eccd }), 0, 0, .005);
  root.userData.enemyType = boss ? 'warden' : 'slinger';
  return { root, body, eye, halo, hpGroup, hpBar, height, centerHeight, radius, muzzle, updatePose: animate };
}
