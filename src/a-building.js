
if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

import TileServer from './TileServer.js';

///
/// a-building
///
/// wrap cesium 3d tiles and adjust position and size
///
/// TODO buildings are still not centered perfectly
/// TODO rather than relying on TileServer a new lower level math library could be defined
/// See - https://github.com/KhronosGroup/glTF/tree/master/extensions/1.0/Vendor/CESIUM_RTC ...
///

let GLTFLoader = new AFRAME.THREE.GLTFLoader();

AFRAME.registerComponent('a-building', {
  schema: {
             lat: {type: 'number', default: 37.7983222 },
             lon: {type: 'number', default: -122.3972797 },
             lod: {type: 'number', default: 15},
         stretch: {type: 'number', default: 1},
          radius: {type: 'number', default: 6372798.2},
    world_radius: {type: 'number', default: 6372798.2},
  },
  init: function () {
    let data = this.data;
    let scheme = TileServer.instance().scheme_elaborate(data);

    GLTFLoader.load(scheme.building_url,(gltf) => {

      // compute scale if geometric radius differs from planet radius
      let s = data.world_radius ? data.radius/data.world_radius : 1;

      // apply scale
      this.el.object3D.scale.set(s,s,s);

      if(true) {
        // Buildings arrive rotated in 3d space as if they were being plunked onto the planet as is - also for a different cartesian XYZ axis
        // I prefer to remove that rotation so that they're facing outwards from longitude 0 latitude 0
        // (I suppose there's an ordered euler transform helper that could do this instead TODO)
        // first de-rotate by longitude - bringing the object to the GMT
        let q = new THREE.Quaternion();
        q.setFromAxisAngle( new THREE.Vector3(0,1,0), THREE.Math.degToRad(-data.lon) - Math.PI/2 );
        this.el.object3D.quaternion.premultiply(q);

        // then de-rotate by latitude
        q.setFromAxisAngle( new THREE.Vector3(1,0,0), THREE.Math.degToRad(data.lat) );
        this.el.object3D.quaternion.premultiply(q);
      }

      // add to mesh to entity
      this.el.setObject3D('mesh',gltf.scene);
    });
  }
});

