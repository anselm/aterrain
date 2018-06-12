
if (typeof AFRAME === 'undefined') {
  throw new Error('Component attempted to register before AFRAME was available.');
}

// TODO there's no real reason why a-terrain should know about the tileserver - a-tile.js could have a system to return a collection of tiles on demand
import TileServer from './TileServer.js';

///
/// a-terrain
///
/// manufactures a-tile instances to cover an area of observed space as a sphere
///

AFRAME.registerComponent('a-terrain', {

  schema: {
    // World radius is the physical size of the planet in question. The current default is Earth with a radius of 63727982 meters.
    // TODO Earth is an oblate spheriod but I'm ignoring that fact... it could be improved.
    world_radius:     {type: 'number', default: 6372798.2    },
    // Radius is the geometric half width or height (or distance from surface to the center) of entire planet in a-frame.
    // A user can use any radius and the planet will render correctly but at a radius == world_radius then the world is 1:1 with human scale walking and a-frame default camera setup
    radius:           {type: 'number', default: 6372798.2    },
    // Observer
    // An observer may be null or may be a camera or other aframe 3d object with a position in 3d space that this component should watch
    // If an observer exists then the { latitude, longitude, elevation, lod } will be manufactured dynamically every frame.
    // If an observer does not exist or is invalid then the globe will use the supplied latitude, longitude and elevation to paint tiles
    // TODO note this is not considering the observers field of view yet and since tiles are logarithmic and movement is linear it requires some thought when using
    observer:         {type: 'string', default: ""          },
    // follow mode (bit set)
    //   1 = move globe such that the current latitude, longitude are at 0,0,0 (only if the observer is null)
    //   2 = move globe elevation also (only if the observer is null)
    follow:           {type: 'number', default: 3           },
    // Current latitude, longitude and elevation in meters - currently 600 meters above Cafe Coquetta on the Embarcadero next to the bay in San Francisco
    // Note elevation is NOT related to the rendering radius but is a planetary space value and should stay the same regardless of rendering radius
    // Note that this exact position and elevation is where we have 3d building tiles and it's a good vantage point to showcase the data set
    // Note if the observer is set then these below values are ignored and they are dynamically manufactured by looking at observers relative position
    latitude:         {type: 'number', default: 37.7983222  },
    longitude:        {type: 'number', default: -122.3972797},
    elevation:        {type: 'number', default: 600         },
    // How much to stretch planet heights by so that mountains are more visible
    // TODO not fully implemented
    stretch:          {type: 'number', default: 1           },
    // LOD = Level of detail. If not specified then it will be computed from elevation.
    lod:              {type: 'number', default: -1          },
    input:            {type: 'number', default: 0           },
    // fovpad is a hack to circumvent limits with observer field of view; basically a camera could be near the planet but see the whole planet at once
    // TODO the tilings strategy should be improved to deal with some of the possible cases of observer field of view - remove this fudge factor later
    fovpad:           {type: 'number', default: 0           },
    debug:            {type: 'number', default: 0           },
    url:              {type: 'string', default: "https://assets.agi.com/stk-terrain/v1/tilesets/world/tiles"},
    building_url:     {type: 'string', default: 'https://s3.amazonaws.com/cesium-dev/Mozilla/SanFranciscoGltf15Gz1'  },
    building_flags:   {type: 'number', default: 2           },
    buildingTexture:  {type: 'string', default: '' },
    groundTexture:    {type: 'string', default: '' },
  },

  ///
  /// No need for more than one copy of component
  /// 
  multiple: false,

  // Internal list of tiles for sweeper convenience
  tiles: {},

  // Latch for startup - TODO probably a more elegant way to latch tick() after init callback is done
  refreshState: 0,

/*
  inputControls: function() {
    if(!this.data.input)
      return;

    // this is an optional control to move the planet under the observer - constantly generating new tiles

    document.addEventListener('keydown', (event) => {
      switch(event.keyCode) {
        case 81: this.data.elevation = this.data.elevation * 1.5; break;
        case 69: this.data.elevation = this.data.elevation / 1.5; break;
        case 38: case 87: this.data.latitude += this.data.elevation / 10000; break;
        case 40: case 83: this.data.latitude -= this.data.elevation / 10000; break;
        case 39: case 68: this.data.longitude += this.data.elevation / 10000; break;
        case 37: case 65: this.data.longitude -= this.data.elevation / 10000; break;
      }
    });
  },

  init: function() {
    this.inputControls();
  },
*/

  init: function() {

    // refine soon - TODO
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4YzI5OGVlNy1jOWY2LTRjNmEtYWYzMC1iNzhkZDhkZmEwOWEiLCJpZCI6MTM2MCwiaWF0IjoxNTI4MTQ0MDMyfQ.itVtUPeeXb7dasKXTUYZ6r3Hbm7OVUoA26ahLaVyj5I';

    TileServer.instance().ready(this.data.url,function() {
      console.log("Lower level TileServer is ready");
    });
  },

  ///
  /// tick at 60fps
  ///
  tick: function() {
    if(!TileServer.instance().isReady()) {
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

    let data = this.data;

    let observer = (data.observer && data.observer.length) > 0 ? this.el.sceneEl.querySelector("#"+data.observer) : 0;

    if(observer) {

      // Throw away supplied position and elevation and compute relative to observer

      // get world positions of both the globe and the observer
      let v1 = this.el.object3D.getWorldPosition();
      let v2 = observer.object3D.getWorldPosition();

      // get distance between them...
      let d = v1.distanceTo(v2);

      // find relative vector of unit length pointing at the observer
      let m = new THREE.Matrix4();
      m.getInverse( this.el.object3D.matrixWorld );
      v2.transformDirection(m);

      let lat = Math.asin(v2.y);
      let lon = Math.atan2(v2.x,v2.z);
  
      // Exit now if no significant change
      if(this.previous_distance == d && this.previous_lat == lat && this.previous_lon == lon) {
        return;
      }
      this.previous_distance = d;
      this.previous_lat = lat;
      this.previous_lon = lon;

      // go to degrees (for user convenience - this is a bit messy tidy up later)
      data.latitude = lat * 180.0 / Math.PI;
      data.longitude = lon * 180.0 / Math.PI;

      // find planetary coordinate space distance from sealevel of ellipsoid (or a sphere as is the case in this engine)
      data.elevation = d * data.world_radius / data.radius - data.world_radius;

      // What is a pleasant level of detail for a given distance from the planets center in planetary coordinates?
      // TODO it is arguable that this could be specified separately from elevation rather than being inferred
      if(data.lod < 0 || data.lodLatch == 1) {
        data.lodLatch = 1;
        data.lod = TileServer.instance().elevation2lod(data.world_radius,data.elevation);
      }
    }

    else {

      // this is a slight hack to allow a caller to specify lat lon - it's not formally documented as a feature

      var hash = window.location.hash.substring(1);
      var params = {}
      hash.split('&').map(hk => { let temp = hk.split('='); params[temp[0]] = temp[1]; });
      if(params.lat) { data.latitude = parseFloat(params.lat); data.longitude = parseFloat(params.lon); }
      if(params.elev) {
        data.elevation = parseFloat(params.elev);
      }
      if(params.lod) {
        data.lod = parseInt(params.lod);
      }

      // Focus on user supplied latitude longitude and elevation

      // Exit now if no significant change
      if(this.previous_elevation == data.elevation && this.previous_lat == data.latitude && this.previous_lon == data.longitude) {
        return;
      }
      this.previous_elevation = data.elevation;
      this.previous_lat = data.latitude;
      this.previous_lon = data.longitude;

      if(data.follow & 1) {
        // rotate planet so that the salient interest area is pointing north - ie on a vector of 0,1,0
        this.el.object3D.rotation.set(0,0,0);
        var q = new THREE.Quaternion();
        q.setFromAxisAngle( new THREE.Vector3(0,1,0), THREE.Math.degToRad(-data.longitude) );
        this.el.object3D.quaternion.premultiply(q);
        q.setFromAxisAngle( new THREE.Vector3(1,0,0), THREE.Math.degToRad(-(90-data.latitude) ) );
        //q.setFromAxisAngle( new THREE.Vector3(1,0,0), THREE.Math.degToRad(data.lat) ); // <- if you wanted lat,lon just facing you if you were at 0,0,1
        this.el.object3D.quaternion.premultiply(q);
      }

      if(data.follow & 2) {
        // translate planet surface to 0,0,0 in model coordinates
        let height = data.radius * data.elevation * data.stretch / data.world_radius + data.radius;
        this.el.object3D.position.set(0,-height,0);
      }

      // What is a pleasant level of detail for a given distance from the planets center in planetary coordinates?
      // TODO it is arguable that this could be specified separately from elevation rather than being inferred
      if(data.lod < 0 || data.lodLatch == 1) {
        data.lodLatch = 1;
        data.lod = TileServer.instance().elevation2lod(data.world_radius,data.elevation);
      }

      TileServer.instance().getGround(data.latitude,data.longitude,data.lod,data.url, groundValue => {
        // deal with undefined
        if(!groundValue) groundValue = 0;
        // make sure is above ground
        let e = groundValue + data.elevation;
        // convert elevation above sea level to to model scale
        let height = data.radius * e * data.stretch / data.world_radius + data.radius;
        console.log("Dynamically moving planet to adjust for ground=" + groundValue + " height="+height + " stretch="+data.stretch + " elev="+e);
        this.el.object3D.position.set(0,-height,0);
      });

    }

    // Copy user values to internal - TODO remove this by code cleanup later - naming inconsistencies
    data.lat = data.latitude;
    data.lon = data.longitude;

    // TODO these limits are imposed by the current data sources - and should not be true for all data sources
    if(data.lat > 85) data.lat = 85;
    if(data.lat < -85) data.lat = -85;

    // ask tile server for facts about a given latitude, longitude, lod
    let scheme = TileServer.instance().scheme_elaborate(data);

    // the number of tiles to fetch in each direction is a function of the camera fov (45') and elevation over the size of a tile at current lod
    let count = Math.floor(data.elevation / scheme.width_tile_lat) + 1;

    // render the field of view - TODO this strategy is not comprehensive - the camera can see past the visible tiles depending on FOV and if not looking down.
    let fovpad = data.fovpad;
    for(let i = -count-fovpad;i<count+1+fovpad;i++) {
      for(let j = -count-fovpad;j<count+1+fovpad;j++) {
        // TODO this is sloppy; there is a chance of a numerical error - it would be better to be able to ask for tiles by index as well as by lat/lon
        let scratch = { lat:data.lat + scheme.degrees_lat * i,
                        lon:data.lon + scheme.degrees_lon * j,
                        lod:data.lod,
                    stretch:data.stretch,
                     radius:data.radius,
               world_radius:data.world_radius,
                        url:data.url,
               building_url:data.building_url,
               building_flags:data.building_flags,
               buildingTexture:data.buildingTexture,
               groundTexture:data.groundTexture,
                    project:1,
                      };
        // hack terrible code TODO cough forever loop
        while(scratch.lon < -180) scratch.lon += 360;
        while(scratch.lon >= 180) scratch.lon -= 360;
        while(scratch.lat < -90) scratch.lat += 180;
        while(scratch.lat >= 90) scratch.lat -= 180;
        this.updateOrCreateTile(scratch);

// this is a first pass
// i should see buildings at lod 15 now
// and i still would need to make sure i don't fetch them twice

        // look for buildings
        if(scheme.lod >= 15) {
          // try fetch a building - unfortunately this throws an error and there's no way to not log it if the building is not found
          let building = document.createElement('a-entity');
          building.setAttribute('a-building',scratch);
          this.el.appendChild(building);
        }


      }
    }


  },

  ///
  /// Satisfy that a given tile exists from supplied lat,lon,elevation
  ///
  updateOrCreateTile: function(data) {
    let scheme = TileServer.instance().scheme_elaborate(data);
    let element = this.tiles[scheme.uuid];
    if(element) {
      element.setAttribute("visible",true);
    } else {
      // if not found then ask a tile to build itself in such a way that it covers the given latitude, longitude, lod
      element = document.createElement('a-entity');
      element.setAttribute('id',scheme.uuid);
      element.setAttribute('a-tile',data);
      this.el.appendChild(element);
      // WARN set lod and loaded directly on the element right now because getAttribute() appears to sometimes not be set synchronously
      element.lod = data.lod;
      element.loaded = 0;
      this.tiles[scheme.uuid] = element;
    }
  },

  ///
  /// Hide any tiles that are not at the current LOD if current LOD is fully present
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

