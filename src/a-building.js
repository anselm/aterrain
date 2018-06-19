
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
             lat: {type: 'number', default: 37.7983222 },
             lon: {type: 'number', default: -122.3972797 },
             lod: {type: 'number', default: 15},
         stretch: {type: 'number', default: 1},
          radius: {type: 'number', default: 6372798.2},
    world_radius: {type: 'number', default: 6372798.2},
             url: {type: 'string', default: "https://assets.agi.com/stk-terrain/v1/tilesets/world/tiles"}, // TODO remove
         project: {type: 'number', default: 0 }, // TODO remove
    building_url: {type: 'string', default: 'https://mozilla.cesium.com/SanFranciscoGltf15' },
//  building_url: {type: 'string', default: 'https://s3.amazonaws.com/cesium-dev/Mozilla/SanFranciscoGltf15Gz3' },
//  building_url: {type: 'string', default: 'mozilla.cesium.com' },
//  building_url: {type: 'string', default: 'https://s3.amazonaws.com/cesium-dev/Mozilla/SanFranciscoGltf15Gz1' },
//  building_url: {type: 'string', default: 'https://s3.amazonaws.com/cesium-dev/Mozilla/SanFranciscoGltf15Gz' }, 
  building_flags: {type: 'number', default: 2 } ,
 buildingTexture: {type: 'string', default: '' },
   groundTexture: {type: 'string', default: '' },
  },
  init: function () {
    let GLTFLoader = new AFRAME.THREE.GLTFLoader();
    let data = this.data;
    let scheme = TileServer.instance().scheme_elaborate(data);

    let url = data.building_url+"/"+scheme.lod+"/"+scheme.xtile+"/"+scheme.ytile+".gltf";

    GLTFLoader.load(url,(gltf) => {

      // down convert to geometry which is not as fast but the goal of this engine is collidability and interaction not speed
      this.toGeom(gltf.scene);

      // put lipstick on
      this.gussy(gltf.scene);

      // compute scale if geometric radius differs from planet radius
      let s = data.world_radius ? data.radius/data.world_radius : 1;

      // apply scale
      this.el.object3D.scale.set(s,s,s);

      if(data.building_flags & 2) {
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

/*
// translate to correct building offset centering stuff from cesium
let x = ( gltf.scene.boundingBox.max.x - gltf.scene.boundingBox.min.x ) / 2;
let y = ( gltf.scene.boundingBox.max.y - gltf.scene.boundingBox.min.y ) / 2;
let z = ( gltf.scene.boundingBox.max.z - gltf.scene.boundingBox.min.z ) / 2;
this.el.object3D.position.set(-gltf.scene.boundingBox.min.x,-gltf.scene.boundingBox.min.y,0);
*/
      // add to mesh to entity
      this.el.setObject3D('mesh',gltf.scene);
      gltf.scene.kind = "building"; // need some way to discriminate between kinds
    });
  },

  toGeom: function(group) {
    group.traverse( (child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }
      child.geometry = new THREE.Geometry().fromBufferGeometry( child.geometry );
      let geometry = child.geometry;
      geometry.computeBoundingBox();
      //geometry.computeBoundingSphere();
      group.boundingBox = geometry.boundingBox;
    });
  },

  gussy: function(group) {

    if(!this.data.buildingTexture || this.data.buildingTexture.length < 1) return;
    let texture = new THREE.TextureLoader().load('../env/'+this.data.buildingTexture);
    let material = new THREE.MeshBasicMaterial({map:texture,color:0xffffff});

    group.traverse( (child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }
      let geometry = child.geometry;
      var max = geometry.boundingBox.max,
          min = geometry.boundingBox.min;
      var offset = new THREE.Vector2(0 - min.x, 0 - min.y);
      var range = new THREE.Vector2(max.x - min.x, max.y - min.y);
      var faces = geometry.faces;
      if(!faces) return;

      geometry.faceVertexUvs[0] = [];
      for (var i = 0; i < faces.length ; i++) {
          var v1 = geometry.vertices[faces[i].a], 
              v2 = geometry.vertices[faces[i].b], 
              v3 = geometry.vertices[faces[i].c];
          geometry.faceVertexUvs[0].push([
              new THREE.Vector2((v1.x + offset.x)/range.x ,(v1.y + offset.y)/range.y),
              new THREE.Vector2((v2.x + offset.x)/range.x ,(v2.y + offset.y)/range.y),
              new THREE.Vector2((v3.x + offset.x)/range.x ,(v3.y + offset.y)/range.y)
          ]);
      }
      geometry.computeVertexNormals();
      geometry.computeFaceNormals();
      geometry.uvsNeedUpdate = true;

      child.material = material;
    });

  }

});

