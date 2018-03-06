
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
    let data = this.data;
    TileServer.instance().ready( unused => {
      TileServer.instance().produceTile(data,scheme => {
        // show tile
        this.el.setObject3D('mesh',scheme.mesh);
        // mark as complete
        this.el.incomplete = 0;
        // publish a general message that this tile is visible
        this.el.emit("a-tile:visible", {lat:data.lat, lon: data.lon, lod:data.lod, id:this.el.id }, false);
        // estimate an elevation for this tile - actually this may not be the center of the tile depending on how it was created TODO
        // TODO probably shouldn't do this at all - is it needed?
        scheme.elevation = TileServer.instance().findClosestElevation(scheme);
        // TODO it would be nice to know better if there were buildings without triggering an error
        if(scheme.lod != 15) return;
        let building = document.createElement('a-entity');
        // TODO shouldn't the radius be the elevation - examine
        building.setAttribute('a-building',{ lat:data.lat, lon:data.lon, lod:15, radius:data.radius });
        // TODO also this could be parallelized - no reason to wait for the terrain
        this.el.appendChild(building);
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
      // listen for navigation
      this.el.addEventListener("a-terrain:navigate", evt => {
        this.data.lat = evt.detail.lat;
        this.data.lon = evt.detail.lon;
        this.data.elevation = evt.detail.elevation;
        this.updateView();
      });
      // listen to tiles being loaded for clearing backdrop
      this.el.addEventListener("a-tile:visible", evt => {
        alert(0); // WHYYYY TODO
        this.sweepTiles(evt);
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

  markTiles: function() {
    // mark all tiles to age them out - tiles with an age of zero are fresh
    if(!this.elements) this.elements = [];
    this.elements.forEach(element => {
      element.marked = element.marked > 0 ? element.marked + 1 : 1;
    });
  },

  sweepTiles: function() {

    // test: don't sweep till all tiles are complete - unsure if this will work because what if a tile never loads? also this list gets long...
    let dirty = 0;
    this.elements.forEach(element => {
      if(element.incomplete) dirty++;
    });

    if(dirty) return;

    //console.log("==============");

    // sweep all old tiles
    // TODO this should happen again after the system settles 
    this.elements.forEach(element => {
      if(!element.marked) {
      //  console.log("visible " + element.id);
      }
      else if(element.marked > 0) {
        element.setAttribute("visible",false);
      }
      else if(element.marked > 5) {
        // actually delete them TODO
      }
    });
  },

/*
  update: function() {
    this.sweepTiles();

    // TODO it is arguable if updateTiles should only be called here so that mark and sweep can be choreographed - would it cause other issues?
  },
*/

  updateTiles: function() {

    // mark for garbage collector
    this.markTiles();

    // test - just fetch one tile - unused
    if(false) {
      this.updateTile(this.data);
      return;
    }

    // ask tile server for facts about a given latitude, longitude, lod
    let scheme = TileServer.instance().ll2yx(this.data);

    // the number of tiles to fetch in each direction is a function of the camera fov (45') and elevation over the size of a tile at current lod
    let count = Math.floor(this.data.elevation / scheme.width_tile_lat) + 1;

    // render enough tiles to cover the degrees visible - regardless of current lod - however it depends on the camera fov being 45'
    for(let i = -count;i<count+1;i++) {
      for(let j = -count;j<count+1;j++) {
        // TODO this is also imperfect; there is a chance of a numerical error - it would be nice to be able to ask for tiles by index as well as by lat/lon
        let scratch = { lat:this.data.lat + scheme.degrees_lat * i, lon:this.data.lon + scheme.degrees_lon * j, lod:this.data.lod, radius:this.data.radius };
        // hack terrible code TODO cough forever loop
        while(scratch.lon < -180) scratch.lon += 360;
        while(scratch.lon > 180) scratch.lon -= 360;
        while(scratch.lat < -90) scratch.lat += 180;
        while(scratch.lat > 90) scratch.lat -= 180;
        // make tile
        this.updateTile(scratch);
      }
    }

    this.sweepTiles();
  },

  updateTile: function(data) {
    // find tile by uuid that would cover requested point latitude, longitude, lod
    let scheme = TileServer.instance().ll2yx(data);
    let uuid = scheme.uuid;
    let element = this.el.querySelector("#"+uuid);
    if(element) {
      element.setAttribute("visible",true);
      // issue this when visible
      element.emit("a-tile:visible", {lat:data.lat, lon: data.lon, lod:data.lod,id:uuid }, false);
    } else {
      // if not found then ask a tile to build itself in such a way that it covers the given latitude, longitude, lod
      element = document.createElement('a-entity');
      element.incomplete = 1;
      element.setAttribute('id',uuid);
      element.setAttribute('a-tile',{lat:data.lat,lon:data.lon,lod:data.lod,radius:data.radius});
      this.el.appendChild(element);
      this.elements.push(element);
    }
    element.marked = 0;
  },

});

///
/// camera control for the globe
///

AFRAME.registerComponent('a-terrain-controls', {

  schema: {
           lat: {type: 'number', default:  45.557749 },
           lon: {type: 'number', default:  -122.6794 },
     elevation: {type: 'number', default:  6372798   },
        radius: {type: 'number', default:  1000       },
  },

  init: function () {
    this.setup_some_game_controls();
  },

  setup_some_game_controls: function() {

    let dragging = 0;
    let dragstartx = 0;
    let dragstarty = 0;
    let dragstartlon = 0;
    let dragstartlat = 0;

    let world_radius = TileServer.instance().getRadius();
    let world_circumference = TileServer.instance().getCircumference();

    // allow click drag navigation around the globe
    window.addEventListener("mousedown", e => { dragging = 1; e.preventDefault(); });
    window.addEventListener("mouseup", e => { dragging = 0; e.preventDefault(); });
    window.addEventListener("mousemove", e => {
      if(dragging == 0) return;
      if(dragging == 1) {
        dragging = 2;
        dragstartx = e.clientX;
        dragstarty = e.clientY;
        dragstartlon = this.data.lon;
        dragstartlat = this.data.lat;
      }
      let x = e.clientX - dragstartx;
      let y = e.clientY - dragstarty;

      // roughly scale movement speed by current distance from surface
      this.data.lon = dragstartlon - x * this.data.elevation / world_circumference / 2;
      this.data.lat = dragstartlat + y * this.data.elevation / world_circumference / 2;

      // not critical but tidy up legal orientations
      if(this.data.lat > 80) this.data.lat = 80;
      if(this.data.lat < -80) this.data.lat = -80;
      if(this.data.lon < -180) this.data.lon += 360;
      if(this.data.lon > 180) this.data.lon -= 360;

      // Tell the terrain
      this.el.emit("a-terrain:navigate", {lat:this.data.lat, lon: this.data.lon, elevation:this.data.elevation }, false);

      e.preventDefault();
    });

    // zooming 
    window.addEventListener("wheel",e => {

      // throw away the speed (which is varys by browser anyway) and just get the direction
      const direction = Math.max(-1, Math.min(1, e.deltaY));

      // zoom in/out - roughly scaled by current elevation
      this.data.elevation += this.data.elevation * direction * 0.1;

      // limits
      if(this.data.elevation > world_circumference) this.data.elevation = world_circumference;

      // set near limit to 1 meter
      if(this.data.elevation < 1) this.data.elevation = 1;

      // tell the terrain engine about this
      this.el.emit("a-terrain:navigate", {lat:this.data.lat, lon: this.data.lon, elevation:this.data.elevation }, false);

      e.preventDefault();
    });
  }

});




