
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
          // TODO study -> there seem to be more missing tiles here - don't use this source for now?
          // url: {type: 'string', default: 'https://beta.cesium.com/api/assets/3699?access_token=' + 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYmI0ZmY0My1hOTg5LTQzNWEtYWRjNy1kYzYzNTM5ZjYyZDciLCJpZCI6NjksImFzc2V0cyI6WzM3MDQsMzcwMywzNjk5LDM2OTNdLCJpYXQiOjE1MTY4MzA4ODZ9.kM-JnlG-00e7S_9fqS_QpXYTg7y5-cIEcZEgxKwRt5E' },
         project: {type: 'number', default: 0 },
    building_url:     {type: 'string', default: 'https://s3.amazonaws.com/cesium-dev/Mozilla/SanFranciscoGltf15Gz1'  },
    building_flags:   {type: 'number', default: 2           }
  },
  init: function () {

    let data = this.data;

    TileServer.instance().produceTile(data,scheme => {

      // show tile
      this.el.setObject3D('mesh',scheme.mesh);

      if(data.project) {

        // translate to surface of sphere
        let offset = TileServer.instance().ll2v(scheme.rect.south+scheme.degrees_latrad/2,
                                      scheme.rect.west+scheme.degrees_lonrad/2,
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

      // mark as complete
      this.el.loaded = 1;
      // look for buildings
      if(scheme.lod >= 15) {
        // try fetch a building - unfortunately this throws an error and there's no way to not log it if the building is not found
        let building = document.createElement('a-entity');
        building.setAttribute('a-building',data);
        this.el.appendChild(building);
      }

    });
  }
});

