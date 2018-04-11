
if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

import TileServer from './TileServer.js';

///
/// a-terrain
///
/// manufactures a-tile instances to cover an area of observed space as a sphere
///

AFRAME.registerComponent('a-terrain', {

  schema: {
        radius: {type: 'number', default:    1},     // radius of the world in game space
           lat: {type: 'number', default:    0},     // latitude - where to center the world and where to fetch tiles from therefore
           lon: {type: 'number', default:    0},     // longitude
           lod: {type: 'number', default:    1},     // this is computed but left here since having a separate parent bucket/schema is a hassle
     elevation: {type: 'number', default:    1},     // height above ground
      observer: {type: 'string', default:   ""}      // id of camera or cameraRig - if there is not one then the lod has to be manually specified
  },

  ///
  /// No need for more than one copy of component
  /// 
  multiple: false,

  // internal list of tiles for sweeper convenience
  tiles: {},

  // delay for startup - TODO probably a more elegant way to latch tick()
  refreshState: 0,

  ///
  /// Init
  ///
  init: function() {
    this.refreshState = 0;
    TileServer.instance().ready( unused => {
      this.refreshState = 1;
    });
  },

  ///
  /// tick at 60fps
  ///
  tick: function() {
    // Ready?
    if(!this.refreshState) {
      return;
    }
    // Update level of detail based on viewing mode
    this.updateView();
    // Sweep old tiles if any
    this.sweepTiles();
  },

  ///
  /// Update view based on view mode
  ///
  updateView: function() {
    if(this.data.observer.length > 0) {
      this.updateView_Observer();
    } else {
      this.updateView_Origin();
    }
  },

  ///
  /// Generate surface tiles to provide a consistent view from the viewpoint of the supplied target or camera
  /// In this style of view the observer could interpenetrate mountains
  ///
  updateView_Observer: function() {

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

    // The observer does not know how high above the ellipsoid the current terrain elevation is - pick a number for now
    // TODO ponder
    let ground_value = 500;

    // Right now we know the world radius ... code could be refactored to not need to know this TODO
    let world_radius = TileServer.instance().getRadius();

    // Given a model distance in model coordinates obtain an elevation in world coordinates;
    this.data.elevation = model_distance * world_radius / this.data.radius - world_radius + ground_value;

    // Recover latitude and longitude from observer
    this.data.lat = -observer.object3D.rotation.x * 180.0 / Math.PI;
    this.data.lon = observer.object3D.rotation.y * 180.0 / Math.PI;

    // TODO mercator is giving us some trouble here - examine more later - constrain for now
    if(this.data.lat > 85) this.data.lat = 85;
    if(this.data.lat < -85) this.data.lat = -85;

    // Generate appropriate tiles for this viewing vantage point
    this.updateTiles();
  },

  ///
  /// In this viewing style the camera position not used
  /// the caller specifies a latitude and longitude and elevation
  /// this code rotates the world so that that given lat/lon is facing due north
  /// and then the surface of the planet is moved down to be at the origin
  /// the net effect is that if there was a camera at the origin that that point should appear to be on the earths surface
  ///
  /// however there is another problem here which is that the world may be very very tiny - tiles at a given lod may be smaller than a single pixel
  /// so the entire world has to also be scaled to a desired zoom level to see geometry in what appears to be a 1 = one meter kind of display
  /// we do not want to scale the camera (we don't want to mess with the developers camera at all) so instead the world must be scaled
  ///

  updateView_Origin: function() {

    let data = this.data;

    // rotate the world such that the supplied lat, lon is at 0,0

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

    let adjust_globe_elevation_relative_to_origin = function(groundValue) {
      // the world surface should touch the origin
      let distance = (world_radius+groundValue+data.elevation)*data.radius/world_radius;
      // move earth surface here
    //  obj.position.set(0,0,-distance);
      console.log("for elevation " + data.elevation + " the lod is " + data.lod + " and ground is at " + groundValue + " rad="+data.radius + " distance=" + distance );
    };


   // quick set to avoid delays even if stale - ground level is not known yet but waiting for it causes visible delays
    //if(data.groundLatched) {
    //  adjust_globe_elevation_relative_to_origin(data.ground);
    //}

    // get ground height (has a delay)
    TileServer.instance().getGround(data,groundValue => {
      if(!groundValue || groundValue <0) groundValue = 0;
      data.ground = groundValue;
      data.groundLatched = true;
      adjust_globe_elevation_relative_to_origin(groundValue);
    });

    // Generate appropriate tiles for this viewing vantage point
    this.updateTiles();
  },

  ///
  /// Given some facts about a desired longitude and latitude and level of detail generate some tiles here
  /// TODO the assumption here is that the player is looking straight down and the camera has an fov of 45' - this assumption is wrong.
  ///

  updateTiles: function() {

    // re-estimate level of detail given an elevation
    this.data.lod = TileServer.instance().elevation2lod(this.data.elevation);

    // ask tile server for facts about a given latitude, longitude, lod
    let scheme = TileServer.instance().scheme_elaborate(this.data);

    // the number of tiles to fetch in each direction is a function of the camera fov (45') and elevation over the size of a tile at current lod
    let count = Math.floor(this.data.elevation / scheme.width_tile_lat) + 1;

    // TODO improve view strategy - render enough tiles to cover the degrees visible - regardless of current lod - however it depends on the camera fov being 45'
    for(let i = -count;i<count+1;i++) {
      for(let j = -count;j<count+1;j++) {
        // TODO this is sloppy; there is a chance of a numerical error - it would be better to be able to ask for tiles by index as well as by lat/lon
        let scratch = { lat:this.data.lat + scheme.degrees_lat * i, lon:this.data.lon + scheme.degrees_lon * j, lod:this.data.lod, radius:this.data.radius };
        // hack terrible code TODO cough forever loop
        while(scratch.lon < -180) scratch.lon += 360;
        while(scratch.lon >= 180) scratch.lon -= 360;
        while(scratch.lat < -90) scratch.lat += 180;
        while(scratch.lat >= 90) scratch.lat -= 180;
        // make tile
        this.updateOrCreateTile(scratch);
      }
    }

  },

  ///
  /// Satisfy that a given tile exists
  ///

  updateOrCreateTile: function(data) {
    // find tile by uuid that would cover requested point latitude, longitude, lod
    let scheme = TileServer.instance().scheme_elaborate(data);
    let uuid = scheme.uuid;
    let element = this.el.querySelector("#"+uuid);
    if(element) {
      element.setAttribute("visible",true);
      // not used - issue this when visible
      // element.emit("a-tile:visible", {lat:data.lat, lon: data.lon, lod:data.lod,id:uuid }, false);
    } else {
      // if not found then ask a tile to build itself in such a way that it covers the given latitude, longitude, lod
      element = document.createElement('a-entity');
      element.setAttribute('id',uuid);
      element.setAttribute('a-tile',{lat:data.lat,lon:data.lon,lod:data.lod,radius:data.radius});
      // set lod and loaded directly on the element right now because getAttribute() appears to sometimes not be set synchronously
      element.lod = data.lod;
      element.loaded = 0;
      this.el.appendChild(element);
    }
    this.tiles[scheme.uuid] = element;
  },

  ///
  /// Hide tiles that are not interesting if they are occluded by interesting tiles
  ///

  sweepTiles: function() {

    let lod = this.data.lod;

    // bail immediately and do not sweep if any tiles at the current lod are not ready
    let keys = Object.keys(this.tiles);
    for(let i = 0; i < keys.length; i++) {
      let element = this.tiles[keys[i]];
      if(element.lod == lod && element.loaded != 1) {
        let properties = element.getAttribute('a-tile');
        return;
      }
    };

    // sweep other tiles that are not at current lod

    for(let i = 0; i < keys.length; i++) {
      let element = this.tiles[keys[i]];
      if(element.lod != lod && element.getAttribute("visible") != false) {
        element.setAttribute("visible",false); 
      }
    };

  },



});
