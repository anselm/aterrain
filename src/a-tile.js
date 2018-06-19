
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
             lat: {type: 'number', default: 37.7983222 },
             lon: {type: 'number', default: -122.3972797 },
             lod: {type: 'number', default: 15},
         stretch: {type: 'number', default: 1},
          radius: {type: 'number', default: 6372798.2},
    world_radius: {type: 'number', default: 6372798.2},
             url: {type: 'string', default: "https://assets.agi.com/stk-terrain/v1/tilesets/world/tiles"},
         project: {type: 'number', default: 0 },
   groundTexture: {type: 'string', default: '' },

    building_url: {type: 'string', default: 'https://mozilla.cesium.com/SanFranciscoGltf15' },
//    building_url: {type: 'string', default: 'https://s3.amazonaws.com/cesium-dev/Mozilla/SanFranciscoGltf15Gz3' },
  building_flags: {type: 'number', default: 2 } ,
 buildingTexture: {type: 'string', default: '' },

  },
  init: function () {

    let data = this.data;

    TileServer.instance().produceTile(data,scheme => {

      // show tile
      this.el.setObject3D('mesh',scheme.mesh);
      scheme.mesh.kind = "tile"; // need some way to discriminate between tiles and other things

      if(data.project) {

        // translate to surface of sphere
        let offset = TileServer.instance().ll2v(scheme.rect.south, //+scheme.degrees_latrad/2,
                                      scheme.rect.west, //+scheme.degrees_lonrad/2,
                                      scheme.radius );
        this.el.object3D.position.set(offset.x,offset.y,offset.z);

        // rotate to correct latitude
        let q = new THREE.Quaternion();
        q.setFromAxisAngle( new THREE.Vector3(1,0,0), -scheme.rect.south); //-scheme.degrees_latrad/2 );
        this.el.object3D.quaternion.premultiply(q);

        // rotate to correct longitude
        q.setFromAxisAngle( new THREE.Vector3(0,1,0), scheme.rect.west); //+scheme.degrees_lonrad/2 );
        this.el.object3D.quaternion.premultiply(q);


      }


        // look for buildings
        if(scheme.lod >= 14) {
          // try fetch a building - unfortunately this throws an error and there's no way to not log it if the building is not found
          let building = document.createElement('a-entity');
          building.setAttribute('a-building',data);
          this.el.appendChild(building);
        }


      // mark as complete
      this.el.loaded = 1;

    });
  }
});

