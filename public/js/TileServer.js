///
/// TileServer is intended to be a prototypical elevation tile provider - by default for Cesium tiles
/// TODO change this to an aframe-system 
///

////////////////////////////////////////////////////////////////////////////////////////////////////////
// math
////////////////////////////////////////////////////////////////////////////////////////////////////////

// https://en.wikipedia.org/wiki/Gudermannian_function
// http://aperturetiles.com/docs/development/api/jsdocs/binning_WebMercatorTilePyramid.js.html
// https://stackoverflow.com/questions/1166059/how-can-i-get-latitude-longitude-from-x-y-on-a-mercator-map-jpeg

var EPSG_900913_SCALE_FACTOR = 20037508.342789244,
      EPSG_900913_LATITUDE = 85.05112878,
      DEGREES_TO_RADIANS = Math.PI / 180.0, // Factor for changing degrees to radians
      RADIANS_TO_DEGREES = 180.0 / Math.PI; // Factor for changing radians to degrees

function rootToTileMercator( lon, lat, level ) {
  var latR = lat * DEGREES_TO_RADIANS,
      pow2 = 1 << level,
      x = (lon + 180.0) / 360.0 * pow2,
      y = (pow2 * (1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2);
  return {
          x: x,
          y: pow2 - y
      };
}

function sinh( arg ) {
    return (Math.exp(arg) - Math.exp(-arg)) / 2.0;
}

function tileToLon( x, level ) {
  var pow2 = 1 << level;
  return x / pow2 * 360.0 - 180.0;
}

function tileToLat( y, level ) {
  var pow2 = 1 << level,
      n    = -Math.PI + (2.0 * Math.PI * y) / pow2;
  return Math.atan(sinh(n)) * RADIANS_TO_DEGREES;
}

function linearToGudermannian( value ) {
  function gudermannian( y ) {
    // converts a y value from -PI(bottom) to PI(top) into the
    // mercator projection latitude
    return Math.atan(sinh(y)) * RADIANS_TO_DEGREES;
  }
  return gudermannian( (value / EPSG_900913_LATITUDE) * Math.PI );
}

function gudermannianToLinear(value) {
  function gudermannianInv( latitude ) {
    // converts a latitude value from -EPSG_900913_LATITUDE to EPSG_900913_LATITUDE into
    // a y value from -PI(bottom) to PI(top)
    var sign = ( latitude !== 0 ) ? latitude / Math.abs(latitude) : 0,
        sin = Math.sin(latitude * DEGREES_TO_RADIANS * sign);
    return sign * (Math.log((1.0 + sin) / (1.0 - sin)) / 2.0);
  }
  return (gudermannianInv( value ) / Math.PI) * EPSG_900913_LATITUDE;
}

let Gudermannian = function(y) {
    return Math.atan(Math.sinh(y)) * (180 / Math.PI)
}

let GudermannianInv = function(latitude) {
    var sign = Math.sign(latitude);
    var sin  = Math.sin(latitude * (Math.PI / 180) * sign );
    return sign * ( Math.log( (1 + sin) / (1 - sin) ) / 2 );
}

let convertRange = function( value, r1, r2 ) { return ( value - r1[0] ) * ( r2[1] - r2[0] ) / ( r1[1] - r1[0] )  +   r2[0];  }

let pi2lat = function(v) {
  return (v*180/Math.PI);
}

let lat2pi = function(v) {
  return v*Math.PI/180;
}



////////////////////////////////////////////////////////////////////////////////////////////////////////
// tile server
////////////////////////////////////////////////////////////////////////////////////////////////////////

class TileServer  {
 
  constructor(terrainProvider,imageProvider) {
    this.terrainProvider = terrainProvider;
    this.imageServer = new ImageServer(terrainProvider, imageProvider);
  }

  ready(callback) {
    Cesium.when(this.terrainProvider.readyPromise).then( unused => {
      this.imageServer.ready(callback);
    });
  }

  getGround(data,callback) {
    // TODO replace with custom elevation derivation - see findClosestElevation() - but it needs to interpolate still
    let scope = this;
    let poi = Cesium.Cartographic.fromDegrees(data.lon,data.lat);
    Cesium.sampleTerrain(scope.terrainProvider,data.lod,[poi]).then(function(groundResults) {
      callback(groundResults[0].height);
    });
  }

  findClosestElevation(scheme) {
    // TODO may want to actually interpolate rather than merely taking the closest elevation...
    let tile = scheme.tile;
    let distance = Number.MAX_SAFE_INTEGER;
    let best = 0;
    for (let i=0; i<tile._uValues.length; i++) {
      let x = (scheme.x-scheme.xtile)*32767 - tile._uValues[i]; // compiler will optimize
      let y = (scheme.y-scheme.ytile)*32767 - tile._vValues[i];
      if(x*x+y*y < distance) {
        distance = x*x+y*y;
        best = (((tile._heightValues[i]*(tile._maximumHeight-tile._minimumHeight))/32767.0)+tile._minimumHeight);
      }
    }
    return best;
  }

  getRadius() {
    return 63727982.0;
  }

  getCircumference() {
    return 400414720.159; // 2*Math.PI*this.getRadius();
  }

  elevation2lod(d) {
    let c = this.getCircumference();
    // truncate reasonable estimations for lod
    if(d < 1) d = 1;
    if(d > c/2) d = c/2;
    // even a small camera fov of 45' would show the entire circumference of the earth at a distance of circumference/2 if the earth was flattened
    // the visible area is basically distance * 2 ... so  ... number of tiles = circumference / (distance*2)
    // visible coverage is 2^(lod+1) = number of tiles  or .... 2^(lod+1) = c / (d*2) ... or ... 
    // also see https://gis.stackexchange.com/questions/12991/how-to-calculate-distance-to-ground-of-all-18-osm-zoom-levels/142555#142555
    let lod = Math.floor(Math.log2(c/(d*2))) +1;
    // truncate
    if(lod < 0) lod = 0;
    if(lod > 19) lod = 19;
    return lod;
  }

  ll2yx(data) {

    // This commented out approach is the more correct way get below details from an arbitrary cesium terrain provider - but requires waiting for ready event
    // this.terrainProvider.tilingScheme.getNumberOfXTilesAtLevel(lod) * (180+lon) / 360;
    // this.terrainProvider.tilingScheme.getNumberOfYTilesAtLevel(lod) * ( 90-lat) / 180;
    // let poi = Cesium.Cartographic.fromDegrees(lon,lat);
    // let xy = this.terrainProvider.tilingScheme.positionToTileXY(poi,lod);
    // scheme.rect = this.terrainProvider.tilingScheme.tileXYToRectangle(xy.x,xy.y,lod);

    let scheme = {};

    let lat = scheme.lat = data.lat;
    let lon = scheme.lon = data.lon;
    let lod = scheme.lod = data.lod;
    let radius = scheme.radius = data.radius;

    // get number of tiles wide and tall - hardcoded to cesium terrain tiles TMS format
    scheme.w = Math.pow(2,lod+1);
    scheme.h = Math.pow(2,lod);

    // get tile index with fractional exact position
    scheme.x = (180+lon) * scheme.w / 360;
    scheme.y = ( 90-lat) * scheme.h / 180;

    // get tile index (remove fraction)
    scheme.xtile = Math.floor(scheme.x);
    scheme.ytile = Math.floor(scheme.y);

    // calculate uuid for tile
    scheme.uuid = "tile-"+scheme.xtile+"-"+scheme.ytile+"-"+lod;

    // position in radians
    scheme.lonrad = scheme.lon * Math.PI / 180;
    scheme.latrad = scheme.lat * Math.PI / 180;

    // extents in radians
    let a = ( (scheme.xtile + 0) * 360 / scheme.w - 180   ) * Math.PI / 180;
    let b = ( (scheme.xtile + 1) * 360 / scheme.w - 180   ) * Math.PI / 180;
    let c = ( - (scheme.ytile+0) * 180 / scheme.h + 90    ) * Math.PI / 180;
    let d = ( - (scheme.ytile+1) * 180 / scheme.h + 90    ) * Math.PI / 180;
    scheme.rect = { west:a, south:d, east:b, north:c };

    // degrees of coverage in radiams
    scheme.degrees_lonrad = scheme.rect.east-scheme.rect.west;
    scheme.degrees_latrad = scheme.rect.north-scheme.rect.south;

    // degrees of coverage
    scheme.degrees_lon = 360 / scheme.w; 
    scheme.degrees_lat = 180 / scheme.h;

    // TODO make this a parameter
    scheme.building_url = "https://s3.amazonaws.com/cesium-dev/Mozilla/SanFranciscoGltf15Gz/"+scheme.lod+"/"+scheme.xtile+"/"+scheme.ytile+".gltf";

    // convenience values
    scheme.width_world = this.getCircumference();
    scheme.width_tile_flat = scheme.width_world / scheme.w;
    scheme.width_tile_lat = scheme.width_tile_flat * Math.cos(data.lat * Math.PI / 180);

    return scheme;
  }

  ll2v(latrad,lonrad,r=1) {
    // given a latitude and longitude in radians return a vector
    let phi = Math.PI/2-latrad;
    let theta = Math.PI/2+lonrad;
    let x = -r*Math.sin(phi)*Math.cos(theta);
    let z = r*Math.sin(phi)*Math.sin(theta);
    let y = r*Math.cos(phi);
    return new THREE.Vector3(x,y,z);
  }


  toGeometry(scheme) {

    let geometry = new THREE.Geometry();
    let xs = 16;
    let ys = 16;
    let scale = 256;
    // build vertices (for a given x,y point calculate the longitude and latitude of that point)
    for(let y = 0; y <= scale; y+=ys) {
    //  console.log("---------");
      for(let x = 0; x <= scale; x+=xs) {
        let lonrad = scheme.degrees_lonrad * x / scale + scheme.rect.west;
        let latrad = scheme.rect.north - scheme.degrees_latrad * y / scale;
        let latrad2 = scheme.degrees_latrad * y / scale + scheme.rect.south;

latrad2 = latrad;
// ordinary lat
let lat = pi2lat(latrad);
let lat2 = linearToGudermannian(lat);
let yval = convertRange(GudermannianInv(lat),[Math.PI,-Math.PI],[0,256]);
let lat3 = Gudermannian( convertRange( yval,  [0, 256],  [Math.PI, -Math.PI] ));
//console.log("latrad="+latrad+" lat="+lat + "  y=" + GudermannianInv(lat) + " y="+gudermannianToLinear(lat) );
//console.log("lat="+lat2pi(lat)+" lat2="+lat2pi(lat2)+" latrad2="+latrad2);
latrad2 = lat2pi(lat2);

        let radius = scheme.radius;
        let v = this.ll2v(latrad2,lonrad,radius);
      //  console.log(v);
        geometry.vertices.push(v);
      }
    }
    // connect the dots
    for(let y = 0, v =0; y < scale; y+=ys) {
      for(let x = 0; x < scale; x+=xs) {
        geometry.faces.push(new THREE.Face3(v+1,v,v+scale/xs+1));
        geometry.faces.push(new THREE.Face3(v+1,v+scale/xs+1,v+scale/xs+1+1));
        v++;
      }
      v++;
    }
    // uvs
    geometry.faceVertexUvs[0] = [];
    for(let y = 0, v = 0; y < scale; y+=ys) {
      for(let x = 0; x < scale; x+=xs) {
        let vxa = x/scale;
        let vya = y/scale;
        let vxb = (x+xs)/scale;
        let vyb = (y+ys)/scale;
        vya = 1-vya;
        vyb = 1-vyb;
        geometry.faceVertexUvs[0].push([ new THREE.Vector2(vxb,vya), new THREE.Vector2(vxa,vya), new THREE.Vector2(vxa,vyb) ]);
        geometry.faceVertexUvs[0].push([ new THREE.Vector2(vxb,vya), new THREE.Vector2(vxa,vyb), new THREE.Vector2(vxb,vyb) ]);
      }
    }
    geometry.uvsNeedUpdate = true;
    // face normals
    geometry.computeFaceNormals();
    return geometry;
  }

  toGeometry2(scheme) {
    let tile = scheme.tile;
    let geometry = new THREE.Geometry();
    let earth_radius = this.getRadius();
    // terrain to vertices on globe
    for (let i=0; i<tile._uValues.length; i++) {
      let lonrad = tile._uValues[i]/32767*scheme.degrees_lonrad + scheme.rect.west;
      let latrad = tile._vValues[i]/32767*scheme.degrees_latrad + scheme.rect.south;
      let elevation = (((tile._heightValues[i]*(tile._maximumHeight-tile._minimumHeight))/32767.0)+tile._minimumHeight);
      let v = this.ll2v(latrad,lonrad,(earth_radius+elevation)*scheme.radius/earth_radius);
      geometry.vertices.push(v);
    }
    // vertices to faces
    for (let i=0; i<tile._indices.length-1; i=i+3) {
      geometry.faces.push(new THREE.Face3(tile._indices[i], tile._indices[i+1], tile._indices[i+2]));
    }
    // face vertices to linear distribution uv map
    let faces = geometry.faces;
    geometry.faceVertexUvs[0] = [];
    for (let i = 0; i < faces.length ; i++) {
      let vxa = tile._uValues[faces[i].a]/32767;
      let vya = tile._vValues[faces[i].a]/32767;
      let vxb = tile._uValues[faces[i].b]/32767;
      let vyb = tile._vValues[faces[i].b]/32767;
      let vxc = tile._uValues[faces[i].c]/32767;
      let vyc = tile._vValues[faces[i].c]/32767;
      geometry.faceVertexUvs[0].push([ new THREE.Vector2(vxa,vya), new THREE.Vector2(vxb,vyb), new THREE.Vector2(vxc,vyc) ]);
    }
    geometry.uvsNeedUpdate = true;
    // face normals
    geometry.computeFaceNormals();
    return geometry;
  }

  tile(data,callback) {
    let scope = this;
    scope.ready( function(){
      let scheme = scope.ll2yx(data);
      scope.imageServer.toMaterial(scheme,function(material) {
        scheme.material = material;
        Cesium.when(scope.terrainProvider.requestTileGeometry(scheme.xtile,scheme.ytile,scheme.lod),function(tile) {
          scheme.tile = tile;
          scheme.geometry = scope.toGeometry(scheme);
          scheme.mesh = new THREE.Mesh(scheme.geometry,scheme.material);
          callback(scheme);
        });
      });
    });
  }
}


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
/// TODO an AFrame System could do this https://aframe.io/docs/0.7.0/core/systems.html
///

TileServer.instance = function() {
  if(TileServer.tileServer) return TileServer.tileServer;
  TileServer.tileServer = new TileServer(Cesium.terrainProvider, Cesium.imageProvider);
  return TileServer.tileServer;
};
