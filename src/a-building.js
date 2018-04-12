
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

AFRAME.registerComponent('a-building', {
  schema: {
       lat: {type: 'number', default: 0},
       lon: {type: 'number', default: 0},
       lod: {type: 'number', default: 0},
    radius: {type: 'number', default: 1000},
    world_radius: {type: 'number', default: 63727982},
  },
  init: function () {
    let GLTFLoader = new AFRAME.THREE.GLTFLoader();
    let scope = this;
    let data = scope.data;
    let scheme = TileServer.instance().scheme_elaborate(data);
    GLTFLoader.load(scheme.building_url,function(gltf) {
      // compute scale if geometric radius differs from planet radius
      let s = data.radius/data.world_radius;
      // multiply size by 10 for some unknown reason
      s = s * 10;
      // apply scale
      scope.el.object3D.scale.set(s,s,s);
      // fix building rotation to reflect frame of reference here (they are pre-rotated for a different frame of reference)
      scope.el.object3D.rotation.set(0,-Math.PI/2,0);
      // fix building longitude and latitude centering to reflect tile center
      // TODO this is wrong - there is some kind of offset specified in the building used to center it
      let lat = scheme.rect.south+scheme.degrees_latrad/2;
      let lon = scheme.rect.west+scheme.degrees_lonrad/2;
      let v = TileServer.instance().ll2v(lat,lon,scheme.radius);
      scope.el.object3D.position.set(v.x,v.y,v.z);
      // add to world
      scope.el.setObject3D('mesh',gltf.scene);
    });
  }
});

