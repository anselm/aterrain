
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
//    building_url: {type: 'string', default: 'https://s3.amazonaws.com/cesium-dev/Mozilla/SanFranciscoGltf15Gz1' },
    //building_url: {type: 'string', default: 'https://s3.amazonaws.com/cesium-dev/Mozilla/SanFranciscoGltf15Gz' }, // older format
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

      // this is the mesh
      let mesh = gltf.scene;

      // put lipstick on
      this.gussy(mesh);

      // apply scale
      if(true) {
        // compute scale if geometric radius differs from planet radius
        let s = data.world_radius ? data.radius/data.world_radius : 1;

        // apply scale (to aframe handle on the above mesh)
        mesh.scale.set(s,s,s);
      }

      if(data.building_flags & 2) {
        // Buildings arrive rotated in 3d space as if they were being plunked onto the planet as is - also for a different cartesian XYZ axis
        // I prefer to remove that rotation so that they're facing outwards from longitude 0 latitude 0
        // (I suppose there's an ordered euler transform helper that could do this instead TODO)
        // first de-rotate by longitude - bringing the object to the GMT
        let q = new THREE.Quaternion();
        q.setFromAxisAngle( new THREE.Vector3(0,1,0), THREE.Math.degToRad(-data.lon) - Math.PI/2 );
        mesh.quaternion.premultiply(q);

        // then de-rotate by latitude
        q.setFromAxisAngle( new THREE.Vector3(1,0,0), THREE.Math.degToRad(data.lat) );
        mesh.quaternion.premultiply(q);
      }

      // aside from adjusting the building orientation the building also needs an absolute position in space

      let mesh2 = new THREE.Object3D();
      mesh2.add(mesh);

      if(true) {
        // translate to surface of sphere
        let offset = TileServer.instance().ll2v(scheme.rect.south, //+scheme.degrees_latrad/2,
                                      scheme.rect.west, //+scheme.degrees_lonrad/2,
                                      scheme.radius );
        mesh2.position.set(offset.x,offset.y,offset.z);
        // rotate to correct latitude
        let q = new THREE.Quaternion();
        q.setFromAxisAngle( new THREE.Vector3(1,0,0), -scheme.rect.south); //-scheme.degrees_latrad/2 );
        mesh2.quaternion.premultiply(q);
        // rotate to correct longitude
        q.setFromAxisAngle( new THREE.Vector3(0,1,0), scheme.rect.west); //+scheme.degrees_lonrad/2 );
        mesh2.quaternion.premultiply(q);
      }

      // tell aframe about mesh
      this.el.setObject3D('mesh',mesh2);

      // provide a hint for this engine about what kind of kind of thing it is 
      mesh2.kind = "building";

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

      child.geometry = new THREE.Geometry().fromBufferGeometry( child.geometry );

      let geometry = child.geometry;

      geometry.computeBoundingBox();

      var max = geometry.boundingBox.max,
          min = geometry.boundingBox.min;
      var offset = new THREE.Vector2(0 - min.x, 0 - min.y);
      var range = new THREE.Vector2(max.x - min.x, max.y - min.y);
      var faces = geometry.faces;

      geometry.faceVertexUvs[0] = [];

      if(!faces) return;

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
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      geometry.uvsNeedUpdate = true;

      child.material = material;
    });

  }

});

