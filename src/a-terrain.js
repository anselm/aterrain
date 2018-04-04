
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
      observer: {type: 'string', default: "camera"}  // id of an observer if any
  },

  ///
  /// This component may be instanced more than once.
  /// TODO data is conserved between instances but the back end server must be the same for all instances right now.
  /// 
  multiple: true,

  ///
  /// TBD
  /// 
  /// remove: function () { },

  ///
  /// TBD
  ///
  /// update: function (oldData) { },

  ///
  /// TBD
  ///
  /// tick: function (t) { },

  ///
  /// TBD
  /// 
  /// pause: function () { },

  ///
  /// TBD
  ///
  /// play: function () { },


  ///
  /// Init
  ///
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
    if(!this.elements) return;
    this.elements.forEach(element => {
      if(element.incomplete) dirty++;
    });

    if(dirty) return;

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
        while(scratch.lon >= 180) scratch.lon -= 360;
        while(scratch.lat < -90) scratch.lat += 180;
        while(scratch.lat >= 90) scratch.lat -= 180;
        // make tile
        this.updateTile(scratch);
      }
    }

    // this.sweepTiles();
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
      if(this.elements)this.elements.push(element);
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

    this.data.lat = -observer.object3D.rotation.x * 180.0 / Math.PI;
    this.data.lon = observer.object3D.rotation.y * 180.0 / Math.PI;

    // TODO mercator is giving us some trouble here - examine more later - constrain for now
    if(this.data.lat > 85) this.data.lat = 85;
    if(this.data.lat < -85) this.data.lat = -85;

    // Generate appropriate tiles for this distance
    this.updateTiles();
  },

});

