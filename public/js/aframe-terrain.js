
///
/// Connect to Cesium image and terrain providers right now.
/// TODO ideally this would not be static
///

Cesium.imageProvider = new Cesium.BingMapsImageryProvider({
  url : 'https://dev.virtualearth.net',
  key : 'RsYNpiMKfN7KuwZrt8ur~ylV3-qaXdDWiVc2F5NCoFA~AkXwps2-UcRkk2L60K5qBy5kPnTmwvxdfwl532NTheLdFfvYlVJbLnNWG1iC-RGL',
  mapStyle : Cesium.BingMapsStyle.AERIAL
});

Cesium.terrainProvider = new Cesium.CesiumTerrainProvider({
  requestVertexNormals : true, 
  url:"https://assets.agi.com/stk-terrain/v1/tilesets/world/tiles",
});

///
/// Singelton convenience handle on TileServer
///

TileServer.getInstance = function() {
  if(TileServer.tileServer) return TileServer.tileServer;
  TileServer.tileServer = new TileServer(Cesium.terrainProvider, Cesium.imageProvider);
  return TileServer.tileServer;
};

///
/// A-ll
/// If this is inside an a-terrain then the child will be on the surface at the specified latitude and longitude
/// TODO should peek at the parent to find the radius rather than hard coded
///

AFRAME.registerComponent('a-ll', {
  schema: {
       lat: {type: 'number', default:  0},
       lon: {type: 'number', default:  0},
    radius: {type: 'number', default:  1},
  },
  init: function() {
    let scheme = TileServer.getInstance().ll2yx(this.data);
    let v = TileServer.getInstance().ll2v(scheme.latrad,scheme.lonrad,this.data.radius);
    this.el.object3D.position.set(v.x,v.y,v.z);
    // TODO this is kind of inelegant; it would be better to precisely rotate the entity out to this location in space - see world rotator
    this.el.object3D.lookAt( new THREE.Vector3(0,0,0) );
  },
});

///
/// a-building
/// wrap cesium 3d tiles and adjust position and size
///

let GLTFLoader = new THREE.GLTFLoader();

AFRAME.registerComponent('a-building', {
  schema: {
       lat: {type: 'number', default: 0},
       lon: {type: 'number', default: 0},
       lod: {type: 'number', default: 0},
    radius: {type: 'number', default: 1},
  },
  init: function () {
    let scope = this;
    let data = scope.data;
    let scheme = TileServer.getInstance().ll2yx(data);
    GLTFLoader.load(scheme.building_url,function(gltf) {
      scope.el.setObject3D('mesh',gltf.scene);
      // fix building scale to reflect radius here - see https://wiki.openstreetmap.org/wiki/Zoom_levels
      // TODO scaling is so confusing to me... I had to divide by 10 for some reason
      let earth_radius = 6372798.2;
      let s = data.radius/earth_radius;
      scope.el.object3D.scale.set(s,s,s);
      // fix building rotation to reflect frame of reference here (they are pre-rotated for a different frame of reference)
      scope.el.object3D.rotation.set(0,-Math.PI/2,0);
      // fix building elevation to include sea level (they appear to already include elevation above sea level)
      // fix building longitude and latitude centering to reflect tile center
      let lat = scheme.rect.south+scheme.degrees_latrad/2;
      let lon = scheme.rect.west+scheme.degrees_lonrad/2;
      let elevation = scheme.radius;
      let v = TileServer.getInstance().ll2v(lat,lon,elevation);
      scope.el.object3D.position.set(v.x,v.y,v.z);
    });
  }
});

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
    let scope = this;
    let data = scope.data;
    TileServer.getInstance().tile(data,function(scheme) {
      scope.el.setObject3D('mesh',scheme.mesh);
      scheme.elevation = TileServer.getInstance().findClosestElevation(scheme);
      //console.log("estimated elevation is " + scheme.elevation);
      let building = document.createElement('a-entity');
      building.setAttribute('a-building',{ lat:data.lat, lon:data.lon, lod:15, radius:data.radius });
      scope.el.appendChild(building);
    });
  }
});

///
/// a-terrain
/// manufactures a-tiles to cover an area of observed space as a sphere
/// currently has some input controls for testing
///

AFRAME.registerComponent('a-terrain', {

  schema: {
           lat: {type: 'number', default:    0},     // latitude - where to center the world and where to fetch tiles from therefore
           lon: {type: 'number', default:    0},     // longitude
           lod: {type: 'number', default:    0},     // zoom level for tiles
        radius: {type: 'number', default:    1},     // radius of the world at sea level
     elevation: {type: 'number', default:    1},     // height above ground
        adjust: {type: 'boolean',default: true},     // move globe to be near camera or not
  },

  init: function() {
    TileServer.getInstance().ready( unused => {
      this.updateTiles();
      this.updatePose();
      this.el.addEventListener('a-terrain:navigate', evt => {
        this.data.lat = evt.detail.lat;
        this.data.lon = evt.detail.lon;
        this.updateTiles();
        this.updatePose();
      });
    });
  },

  updateTiles: function() {
    // TODO this is pretty clumsy - it covers the screen but is not precise
    // TODO must throw away tiles that left the screen
    let scratch = {};
    Object.assign(scratch,this.data);
    let scheme = TileServer.getInstance().ll2yx(this.data);
    for(let i = -1;i<2;i++) {
      for(let j = -1;j<2;j++) {
        scratch.lat = this.data.lat + scheme.degrees_lat * i;
        scratch.lon = this.data.lon + scheme.degrees_lon * j;
        this.updateTile(scratch);
      }
    }
  },

  updateTile: function(data) {

    // find tile by uuid that would cover requested latitude, longitude, lod
    let scheme = TileServer.getInstance().ll2yx(data);
    let uuid = scheme.uuid;
    let tile = this.el.querySelector("#"+uuid);
    if(tile) {
      return;
    }
    // if not found then ask a tile to build itself in such a way that it covers the given latitude, longitude, lod
    let element = document.createElement('a-entity');
    element.setAttribute('id',uuid);
    element.setAttribute('a-tile',{lat:data.lat,lon:data.lon,lod:data.lod,radius:data.radius});
    this.el.appendChild(element);
  },

  updatePose: function() {

    let data = this.data;

    // allow moving world?
    if(!data.adjust) return;

    // rotate the world such that the supplied lat, lon is at 0,0
    let obj = this.el.object3D;

    // lazy way to get the world rotated correctly
    obj.rotation.set(0,0,0);
    var q = new THREE.Quaternion();
    q.setFromAxisAngle( new THREE.Vector3(0,1,0), THREE.Math.degToRad(-data.lon) );
    obj.quaternion.premultiply(q);
    q.setFromAxisAngle( new THREE.Vector3(1,0,0), THREE.Math.degToRad(data.lat) );
    obj.quaternion.premultiply(q);

    // quick set to avoid delays even if stale - ground level is not known yet but waiting for it causes visible delays
    let earth_radius = 6372798.2;
    if(data.groundLatched) {
      let groundValue = data.ground;
      obj.position.set(0,0,-(earth_radius+groundValue+data.elevation)*data.radius/earth_radius);
    }

    // get ground height
    TileServer.getInstance().getGround(data,groundValue => {
      data.ground = groundValue;
      data.groundLatched = true;
      obj.position.set(0,0,-(earth_radius+groundValue+data.elevation)*data.radius/earth_radius);
    });
  },

});

