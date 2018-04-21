
if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

import TileServer from './TileServer.js';

///
/// A-location
/// If this is inside an a-terrain then the child will be on the surface at the specified latitude and longitude
///
/// TODO tileserver.scheme_elaborate could be moved to a lower level math module that everybody uses
/// TODO would be nice to adjust size so it is always visible based on observer eyeball size
///

AFRAME.registerComponent('a-location', {
  schema: {
       lat: {type: 'number', default:  0},
       lon: {type: 'number', default:  0},
    radius: {type: 'number', default:  1},
    world_radius: {type: 'number', default:  6372798.2},
  },
  init: function() {
    let scheme = TileServer.instance().scheme_elaborate(this.data);
    let v = TileServer.instance().ll2v(scheme.latrad,scheme.lonrad,this.data.radius);
    // TODO this approach is inelegant; it would be cleaner to apply the latitude and longitude rotations as done with rotating the world
    this.el.object3D.position.set(v.x,v.y,v.z);
    this.el.object3D.lookAt( new THREE.Vector3(0,0,0) );

    // This would be cleaner - would avoid the lookat which is clumsy
    //obj.rotation.set(0,0,0);
    //var q = new THREE.Quaternion();
    //q.setFromAxisAngle( new THREE.Vector3(0,1,0), THREE.Math.degToRad(-data.lon) );
    // obj.quaternion.premultiply(q);
    //q.setFromAxisAngle( new THREE.Vector3(1,0,0), THREE.Math.degToRad(data.lat) );
    // obj.quaternion.premultiply(q);
  },
});

