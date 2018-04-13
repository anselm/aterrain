
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
        let building = document.createElement('a-entity');
        building.setAttribute('a-building',{ lat:data.lat, lon:data.lon, lod:15, radius:data.radius, world_radius:data.world_radius });
        this.el.appendChild(building);
      });
    });
  }
});

