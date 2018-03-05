
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
    let scheme = TileServer.instance().ll2yx(this.data);
    let v = TileServer.instance().ll2v(scheme.latrad,scheme.lonrad,this.data.radius);
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
    let scheme = TileServer.instance().ll2yx(data);
    GLTFLoader.load(scheme.building_url,function(gltf) {
      scope.el.setObject3D('mesh',gltf.scene);
      // fix building scale to reflect radius here - see https://wiki.openstreetmap.org/wiki/Zoom_levels
      // TODO scaling is so confusing to me... I had to divide by 10 for some reason???
      let earth_radius = 6372798.2;
      let s = data.radius/earth_radius;
      scope.el.object3D.scale.set(s,s,s);
      // fix building rotation to reflect frame of reference here (they are pre-rotated for a different frame of reference)
      scope.el.object3D.rotation.set(0,-Math.PI/2,0);
      // fix building elevation to include sea level (they appear to already include elevation above sea level)
      // fix building longitude and latitude centering to reflect tile center
      let lat = scheme.rect.south+scheme.degrees_latrad/2;
      let lon = scheme.rect.west+scheme.degrees_lonrad/2;
      let elevation = scheme.radius; // TODO consisting naming
      let v = TileServer.instance().ll2v(lat,lon,elevation);
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
    TileServer.instance().ready( unused => {
      TileServer.instance().produceTile(data,scheme => {
        scope.el.setObject3D('mesh',scheme.mesh);
        // estimate an elevation for this tile - actually this may not be the center of the tile depending on how it was created TODO
        // TODO probably shouldn't do this at all - is it needed?
        scheme.elevation = TileServer.instance().findClosestElevation(scheme);
        // TODO it would be nice to know better if there were buildings without triggering an error
        if(scheme.lod < 15) return;
        let building = document.createElement('a-entity');
        // TODO shouldn't the radius be the elevation?
        building.setAttribute('a-building',{ lat:data.lat, lon:data.lon, lod:15, radius:data.radius });
        scope.el.appendChild(building);
      });
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
        radius: {type: 'number', default:    1},     // radius of the world in game space
           lat: {type: 'number', default:    0},     // latitude - where to center the world and where to fetch tiles from therefore
           lon: {type: 'number', default:    0},     // longitude
           lod: {type: 'number', default:    1},     // this is computed
     elevation: {type: 'number', default:    1},     // height above ground
  },

  init: function() {
    TileServer.instance().ready( unused => {
      // update once prior to any events so that there is something to see even if not perfect
      this.updateView();
      // listen for events
      this.el.addEventListener('a-terrain:navigate', evt => {
        this.data.lat = evt.detail.lat;
        this.data.lon = evt.detail.lon;
        this.data.elevation = evt.detail.elevation;
        this.updateView();
      });
    });
  },

  updateView: function() {

    let data = this.data;

    // rotate the world such that the supplied lat, lon is at 0,0
    // TODO move camera instead
    let obj = this.el.object3D;
    obj.rotation.set(0,0,0);
    var q = new THREE.Quaternion();
    q.setFromAxisAngle( new THREE.Vector3(0,1,0), THREE.Math.degToRad(-data.lon) );
    obj.quaternion.premultiply(q);
    q.setFromAxisAngle( new THREE.Vector3(1,0,0), THREE.Math.degToRad(data.lat) );
    obj.quaternion.premultiply(q);

    // deal with distance and tiles
    let world_radius = TileServer.instance().getRadius();
    let world_circumference = TileServer.instance().getCircumference();

    // estimate level of detail ... 
    data.lod = TileServer.instance().elevation2lod(data.elevation);

    let move_globe = function(groundValue) {
      // the world surface should touch the origin
      let distance = (world_radius+groundValue+data.elevation)*data.radius/world_radius;
      // move earth surface here
      obj.position.set(0,0,-distance);
      //console.log("for elevation " + data.elevation + " the lod is " + data.lod + " and ground is at " + groundValue );
    };

    // quick set to avoid delays even if stale - ground level is not known yet but waiting for it causes visible delays
    if(data.groundLatched) {
      move_globe(data.ground);
    }

    // get ground height (has a delay)
    TileServer.instance().getGround(data,groundValue => {
      if(!groundValue || groundValue <0) groundValue = 0;
      data.ground = groundValue;
      data.groundLatched = true;
      move_globe(groundValue);
    });

    this.updateTiles();
  },

  updateTiles: function() {

    // mark all tiles to age them out
    if(!this.elements) this.elements = [];
    this.elements.forEach(element => { element.marked = element.marked > 0 ? element.marked + 1 : 1; });

    // ask tile server for facts about a given latitude, longitude, lod
    let scheme = TileServer.instance().ll2yx(this.data);

    // the number of tiles to fetch in each direction is a function of the camera fov (45') and elevation over the size of a tile at current lod
    let count = Math.floor(this.data.elevation / scheme.width_tile_lat) + 1;

    //console.log("width visible " + this.data.elevation*2 + " and decided this was the coverage " + count);

    if(false) {
      // test - just fetch one tile
      this.updateTile(this.data);
      return;
    }

    // render enough tiles to cover the degrees visible - regardless of current lod
    for(let i = -count;i<count+1;i++) {
      for(let j = -count;j<count+1;j++) {
        let scratch = { lat:this.data.lat + scheme.degrees_lat * i, lon:this.data.lon + scheme.degrees_lon * j, lod:this.data.lod, radius:this.data.radius };
        // hack terrible code TODO 
        while(scratch.lon < -180) scratch.lon += 360;
        while(scratch.lon > 180) scratch.lon -= 360;
        while(scratch.lat < -90) scratch.lat += 180;
        while(scratch.lat > 90) scratch.lat -= 180;
        // make tile
        this.updateTile(scratch);
      }
    }

    // delete older tiles using some aging strategy
    this.elements.forEach(element => {
      if(element.marked > 0) {
        element.setAttribute("visible",false);
      }
      if(element.marked > 5) {
        // actually delete them TODO
      }
    });

  },

  updateTile: function(data) {

    // find tile by uuid that would cover requested latitude, longitude, lod
    let scheme = TileServer.instance().ll2yx(data);
    let uuid = scheme.uuid;
    let element = this.el.querySelector("#"+uuid);
    if(element) {
      element.setAttribute("visible",true);
      element.marked = 0;
      return;
    }
    // if not found then ask a tile to build itself in such a way that it covers the given latitude, longitude, lod
    element = document.createElement('a-entity');
    element.setAttribute('id',uuid);
    element.setAttribute('a-tile',{lat:data.lat,lon:data.lon,lod:data.lod,radius:data.radius});
    this.el.appendChild(element);

    // track tile
    element.marked = 0;
    this.elements.push(element);
  },

});

