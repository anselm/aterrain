
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
             lat: {type: 'number',  default: 37.7983222 },
             lon: {type: 'number',  default: -122.3972797 },
             lod: {type: 'number',  default: 15},
         stretch: {type: 'number',  default: 1},
          radius: {type: 'number',  default: 6372798.2},
    world_radius: {type: 'number',  default: 6372798.2},
         project: {type: 'number',  default: 0 }
  },
  init: function () {
    let data = this.data;
    if(!this.el)return;

    // asynchronously begin loading process
    TileServer.instance().ready( unused => {
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
          q.setFromAxisAngle( new THREE.Vector3(1,0,0), -scheme.rect.south-scheme.degrees_latrad/2 );
          this.el.object3D.quaternion.premultiply(q);

          // rotate to correct longitude
          q.setFromAxisAngle( new THREE.Vector3(0,1,0), scheme.rect.west+scheme.degrees_lonrad/2 );
          this.el.object3D.quaternion.premultiply(q);


/*
try {
this.el.setAttribute('position', {x: offset.x, y: offset.y, z: offset.z }) ;
console.log(offset);
console.log(scheme);
this.el.object3D.updateMatrix();
console.log(this.el.getAttribute('position'));
this.el.setAttribute('position', {x: -688, y: 595, z: -412 }) ;
console.log("whyyy");
} catch(err) {
  console.error(err);
}
*/


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
    });
  }
});

