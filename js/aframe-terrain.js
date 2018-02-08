
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
/// A geographic feature attached to a specified latitude and longitude
/// Children features are placed appropriately
///

AFRAME.registerComponent('a-ll', {
  schema: {
       lat: {type: 'number', default:  0},
       lon: {type: 'number', default:  0},
       lod: {type: 'number', default: 15},
    radius: {type: 'number', default:  1},
  },
  init: function() {
    let scheme = TileServer.getInstance().ll2yx(this.data);
    let v = TileServer.getInstance().ll2v(scheme.latrad,scheme.lonrad,1);
    this.el.object3D.position.set(v.x,v.y,v.z);
    // should probably also set the rotation TODO
    //var q = new THREE.Quaternion();
    //q.setFromAxisAngle( new THREE.Vector3(0,1,0), THREE.Math.degToRad(-this.data.lon) );
    //obj.quaternion.premultiply(q);
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
    let scope = this;
    TileServer.getInstance().ready( function(){
      scope.getUserInput();
      scope.updateTiles();
      scope.updatePose();
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

    if(!this.data.adjust) return;

    let scope = this;
    let data = scope.data;

    // rotate such that the supplied lat, lon is at 0,0

    let obj = this.el.object3D;

    obj.rotation.set(0,0,0);

    var q = new THREE.Quaternion();
    q.setFromAxisAngle( new THREE.Vector3(0,1,0), THREE.Math.degToRad(-data.lon) );
    obj.quaternion.premultiply(q);

    q.setFromAxisAngle( new THREE.Vector3(1,0,0), THREE.Math.degToRad(data.lat) );
    obj.quaternion.premultiply(q);

    // quick set to avoid delays even if stale
    let earth_radius = 6372798.2;
    if(scope.data.groundLatched) {
      let groundValue = scope.data.ground;
      obj.position.set(0,0,-(earth_radius+groundValue+data.elevation)*data.radius/earth_radius);
    }

    // get ground height
    TileServer.getInstance().getGround(data,function(groundValue) {
      scope.data.ground = groundValue;
      scope.data.groundLatched = true;
      obj.position.set(0,0,-(earth_radius+groundValue+data.elevation)*data.radius/earth_radius);
    });
  },

  getUserInput: function() {
    let scope = this;

    let dragging = 0;
    let dragstartx = 0;
    let dragstarty = 0;
    let dragstartlon = 0;
    let dragstartlat = 0;

    window.addEventListener("mousedown", function(e) {
      dragging = 1;
      e.preventDefault();
    });
    window.addEventListener("mouseup", function(e){
      dragging = 0;
      e.preventDefault();
    });
    window.addEventListener("mousemove", function(e){
      if(dragging == 0) return;
      if(dragging == 1) {
        dragging = 2;
        dragstartx = e.clientX;
        dragstarty = e.clientY;
        dragstartlon = scope.data.lon;
        dragstartlat = scope.data.lat;
      }
      let x = e.clientX - dragstartx;
      let y = e.clientY - dragstarty;
      // TODO the exact scroll amount can be computed as a function of zoom
      // TODO set min max
      scope.data.lon = dragstartlon - x/100000;
      scope.data.lat = dragstartlat + y/100000;
      scope.updateTiles();
      scope.updatePose();
      e.preventDefault();
    });
    window.addEventListener("wheel",function(e) {
      const deltaY = Math.max(-1, Math.min(1, e.deltaY));
      // TODO the elevation should be precisely a function of radius! not absolute
      // TODO the rate of change here should be computed as a function of radius!
      // TODO set min max
      // TODO set zoom level appropriately
      scope.data.elevation += deltaY * 50;
      if(scope.data.elevation < 10) scope.data.elevation = 10;
      scope.updateTiles();
      scope.updatePose();
      e.preventDefault();
    });

    window.addEventListener("keydown", function(e) {
      let camera = document.querySelector('#camera');
      if(!camera) {
        console.error("No camera setup with id #camera");
        return;
      }
      let angle = camera.getAttribute('rotation').y;
      let position = camera.getAttribute('position');
      //console.log("camera is at x="+position.x+" y="+position.y+" z="+position.z+" angle="+angle);
      let stride = 0.001; // TODO compute
      switch(e.keyCode) {
        case 73: scope.data.lat += stride; break;
        case 74: scope.data.lon -= stride; break;
        case 75: scope.data.lon += stride; break;
        case 77: scope.data.lat -= stride; break;
      }
      /*
      if(camera && e.keyCode == 32) {
        let angle = camera.getAttribute('rotation').y;
        let position = camera.getAttribute('position');
        console.log("camera is at x="+position.x+" y="+position.y+" z="+position.z+" angle="+angle);
        let stride = 0.001;// TODO FIX
        scope.data.lon -= Math.sin(angle*Math.PI/180) * stride;
        scope.data.lat += Math.cos(angle*Math.PI/180) * stride;
      }
      */
      //if(e.keyCode == 74) scope.data.elevation -= 10;
      //if(e.keyCode == 75) scope.data.elevation += 10;
      scope.updateTiles();
      scope.updatePose();
    });
  }

});

