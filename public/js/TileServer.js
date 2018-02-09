///
/// TileServer is intended to be a prototypical elevation tile provider - by default for Cesium tiles
///

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

  elevation2lod(distance) {
    let osm_earth_radius = 63727982;
    let osm_earth_circumference = 2*Math.PI*osm_earth_radius;
    // cannot get closer than the ground
    if(distance < 1) distance = 1;
    // no point in getting further away than the distance to see everything
    if(distance > osm_earth_circumference / 2 ) distance = osm_earth_circumference / 2;
    // the camera is setup such that if circumference is N then at a distance of N the entire surface is visible on screen.
    // the visual field of view is a function of level of detail ie: fov=circumference/2^lod
    // so 2^lod=cir/fov or log(cir/fov)=log(2^lod)
    //let value = Math.log(osm_earth_circumference*2/distance) / Math.log(2);
    // hmm... https://gis.stackexchange.com/questions/12991/how-to-calculate-distance-to-ground-of-all-18-osm-zoom-levels/142555#142555
    let value2 = Math.floor(Math.log(osm_earth_circumference/distance,2));
    return value2;
  }

  ll2yx(data) {

    // This commented out approach is the more correct way to ask an arbitrary cesium terrain provider - but requires waiting for ready event
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

    let osm_earth_radius = 63727982;
    let osm_earth_circumference = 2*Math.PI*osm_earth_radius;

    // get the meters width size of the tile (this is vaguely helpful for scaling buildings but not really helpful for anything)
    // note that this meters_wide is problematic - really isn't that useful generally speaking; it is best for flat maps only
    // note that https://wiki.openstreetmap.org/wiki/Zoom_levels has a design flaw where they use +8 because their tiles are 256 pixels wide.
    // (there's no reason to have the resolution of a tile have anything to do with estimation of meters width of a tile in the real world)
    scheme.meters_wide = ( osm_earth_circumference * Math.cos(data.lat * Math.PI / 180) / Math.pow(2,data.lod) / 2 );

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

    // building url if any
//    scheme.building_url = "tiles3d/"+scheme.lod+"/"+scheme.xtile+"/"+(32767-scheme.ytile)+".gltf";

    scheme.building_url = "https://s3.amazonaws.com/cesium-dev/Mozilla/SanFranciscoGltf15Gz/"+scheme.lod+"/"+scheme.xtile+"/"+scheme.ytile+".gltf";

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
    let tile = scheme.tile;
    let geometry = new THREE.Geometry();
    // terrain to vertices on globe
    for (let i=0; i<tile._uValues.length; i++) {
      let lonrad = (tile._uValues[i]/32767*scheme.degrees_lonrad + scheme.rect.west);
      let latrad = (tile._vValues[i]/32767*scheme.degrees_latrad + scheme.rect.south);
      let elevation = (((tile._heightValues[i]*(tile._maximumHeight-tile._minimumHeight))/32767.0)+tile._minimumHeight);
      let earth_radius = 6372798.2;
      let v = this.ll2v(latrad,lonrad,(earth_radius+elevation)*scheme.radius/earth_radius);
      geometry.vertices.push(v);
    }
    // vertices to faces
    for (let i=0; i<tile._indices.length-1; i=i+3) {
      geometry.faces.push(new THREE.Face3(tile._indices[i], tile._indices[i+1], tile._indices[i+2]));
    }
    // face normals
    geometry.computeFaceNormals();
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

