
if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

import TileServer from './TileServer.js';

///
/// a-tile
/// A single tile as specified by the tileServer abstraction
///

AFRAME.registerComponent('a-tile', {
  schema: {
             lat: {type: 'number', default: 0},
             lon: {type: 'number', default: 0},
             lod: {type: 'number', default: 0},
         stretch: {type: 'number', default: 1},
          radius: {type: 'number', default: 1},
    world_radius: {type: 'number', default: 1},
  },
  init: function () {
    let data = this.data;
    if(!this.el)return;
    // asynchronously begin loading process
    TileServer.instance().ready( unused => {
      TileServer.instance().produceTile(data,scheme => {
        // show tile
        this.el.setObject3D('mesh',scheme.mesh);
        // mark as complete
        this.el.loaded = 1;
        // TODO it would be nice to know better if there were buildings without triggering an error
        if(scheme.lod < 15) return;

// Disabled using a-building and am directly fetching buildings and forcing their position to be relative to the parent tile.
// There's something about the-aframe hierarchy that the normally loaded or appended objects don't seem to respect parent hierarchy position
// This may just be due to needing an update matrix? Anyway will circle back on that later on. Just coerce the results I want for now.


        // let building = document.createElement('a-entity');
        // building.setAttribute('a-building',data);
        // this.el.appendChild(building);

try {

// force move the tile to the world position and force update
let worldpos = scheme.geometry.offset; // (stashed in geometry by tileserver produce tile for now)
let parental = this.el.object3D;
parental.position.set(worldpos.x,worldpos.y,worldpos.z); // test - re-add it here
parental.updateMatrix();
parental.updateMatrixWorld();

// Verify - what is the position of the tile?
// console.log("tile is at " + parental.position.x + " " + parental.position.y + " " + parental.position.z );

// Verify - what is world position of the tile?
// let pos = parental.getWorldPosition();
// console.log("tile is at " + pos.x + " " + pos.y + " " + pos.z );

// Load building now
let GLTFLoader = new AFRAME.THREE.GLTFLoader();
GLTFLoader.load(scheme.building_url,function(gltf) {
  let mesh = gltf.scene;
  // compute scale if geometric radius differs from planet radius
  let s = data.world_radius ? data.radius/data.world_radius : 1;
  // multiply size by 10 for some unknown reason
  s = s * 10;
  // apply scale
  mesh.scale.set(s,s,s);
  // fix building rotation to reflect frame of reference here (they are pre-rotated for a different frame of reference)
  mesh.rotation.set(0,-Math.PI/2,0);
  // fix building longitude and latitude centering to reflect tile center
  // TODO this is wrong - there is some kind of offset specified in the building used to center it
  let lat = scheme.rect.south+scheme.degrees_latrad/2;
  let lon = scheme.rect.west+scheme.degrees_lonrad/2;
  let v = TileServer.instance().ll2v(lat,lon,scheme.radius);
  // Subtract the parent left corner so that this object is relative to the parent
  mesh.position.set(v.x-worldpos.x,v.y-worldpos.y,v.z-worldpos.z);
  mesh.updateMatrix();
  mesh.updateMatrixWorld();
  parental.add(mesh);
  parental.updateMatrix();
  parental.updateMatrixWorld();
  // Verify - is the feature where it claims to be
  console.log("feature is at " + mesh.position.x + " " + mesh.position.y + " " + mesh.position.z);
  let pos2 = mesh.getWorldPosition();
  console.log("tile child is at " + pos2.x + " " + pos2.y + " " + pos2.z );
});

} catch(e) {
  console.error(e);
}

      });
    });
  }
});

