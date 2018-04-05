
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
  },
  init: function () {
    let data = this.data;
    TileServer.instance().ready( unused => {
      TileServer.instance().produceTile(data,scheme => {
        // show tile
        this.el.setObject3D('mesh',scheme.mesh);
        // mark as complete
        this.el.incomplete = 0;
        // publish a general message that this tile is visible
        this.el.emit("a-tile:visible", {lat:data.lat, lon: data.lon, lod:data.lod, id:this.el.id }, false);
        // TODO it would be nice to know better if there were buildings without triggering an error
        if(scheme.lod < 15) return;
        let building = document.createElement('a-entity');
        building.setAttribute('a-building',{ lat:data.lat, lon:data.lon, lod:15, radius:data.radius });
        this.el.appendChild(building);
      });
    });
  }
});

