
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
    let scheme = TileServer.instance().scheme_elaborate(data);
    GLTFLoader.load(scheme.building_url,function(gltf) {
      scope.el.setObject3D('mesh',gltf.scene);
      let world_radius = TileServer.instance().getRadius() / 10; // unsure why this is TODO
      let s = data.radius/world_radius;
      scope.el.object3D.scale.set(s,s,s);
      // fix building rotation to reflect frame of reference here (they are pre-rotated for a different frame of reference)
      scope.el.object3D.rotation.set(0,-Math.PI/2,0);
      // fix building longitude and latitude centering to reflect tile center
      let lat = scheme.rect.south+scheme.degrees_latrad/2;
      let lon = scheme.rect.west+scheme.degrees_lonrad/2;
      let v = TileServer.instance().ll2v(lat,lon,scheme.radius);
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
        // TODO it would be nice to know better if there were buildings without triggering an error
        if(scheme.lod < 15) return;
        let building = document.createElement('a-entity');
        building.setAttribute('a-building',{ lat:data.lat, lon:data.lon, lod:15, radius:data.radius });
        this.el.appendChild(building);
      });
    });
  }
});

///
/// a-terrain
/// manufactures a-tiles to cover an area of observed space as a sphere
///

AFRAME.registerComponent('a-terrain', {

  schema: {
        radius: {type: 'number', default:    1},     // radius of the world in game space
           lat: {type: 'number', default:    0},     // latitude - where to center the world and where to fetch tiles from therefore
           lon: {type: 'number', default:    0},     // longitude
           lod: {type: 'number', default:    1},     // this is computed
     elevation: {type: 'number', default:    1},     // height above ground
      observer: {type: 'string', default: "camera"}  // id of an observer if any
  },

  init: function() {

    // Wait for tile engine
    TileServer.instance().ready( unused => {
      // update once prior to any events so that there is something to see even if not perfect
      this.updateTiles();
      // listen to tiles being loaded for clearing backdrop
      this.el.addEventListener("a-tile:visible", evt => {
        alert(0); // WHYYYY TODO
        this.sweepTiles(evt);
      });
    });
  },

  markTiles: function() {
    // TODO still debating the right approach here
    // mark all tiles to age them out - tiles with an age of zero are fresh
    if(!this.elements) this.elements = [];
    this.elements.forEach(element => {
      element.marked = element.marked > 0 ? element.marked + 1 : 1;
    });
  },

  sweepTiles: function() {

    // TODO still debating the right approach
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

  updateTiles: function() {

    // re-estimate lod
    this.data.lod = TileServer.instance().elevation2lod(this.data.elevation);

    // mark all tiles for garbage collector
    this.markTiles();

    // test - just fetch one tile - unused
    if(false) {
      this.updateTile(this.data);
      return;
    }

    // ask tile server for facts about a given latitude, longitude, lod
    let scheme = TileServer.instance().scheme_elaborate(this.data);

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
    let scheme = TileServer.instance().scheme_elaborate(data);
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

  tick: function() {
    this.updateView();
  },


  ///
  /// Generate surface tiles to provide a consistent view from the viewpoint of the supplied target or camera
  ///

  updateView: function() {

    // Find observer again every frame since it may change or just return
    let observer = this.el.sceneEl.querySelector("#"+this.data.observer);
    if(!observer) {
      return;
    }

    // Exit if no change
    if(this.observer_position && observer.object3D.position.equals(this.observer_position)) {
      return;
    }
    this.observer_position = observer.object3D.position.clone();

    // How far is the target from the globe in the model distance?
    let model_distance = this.el.object3D.position.distanceTo( this.observer_position );

    // The observer does not know how high above the ellipsoid the current terrain elevation is - pick a number for now TODO ponder
    let ground_value = 500;

    // Right now we know the world radius ... code could be refactored to not need to know this TODO
    let world_radius = TileServer.instance().getRadius();

    // Given a model distance in model coordinates obtain an elevation in world coordinates;
    this.data.elevation = model_distance * world_radius / this.data.radius - world_radius + ground_value;

    // Recover latitude and longitude from observer

    this.data.lat = -observer.object3D.rotation.x * RADIANS_TO_DEGREES;
    this.data.lon = observer.object3D.rotation.y * RADIANS_TO_DEGREES;

    // TODO mercator is giving us some trouble here - examine more later - constrain for now
    if(this.data.lat > 85) this.data.lat = 85;
    if(this.data.lat < -85) this.data.lat = -85;

    // Generate appropriate tiles for this distance
    this.updateTiles();
  },

});

