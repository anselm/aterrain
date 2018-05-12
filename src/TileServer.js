
import ImageServer from './ImageServer.js';

///
/// TileServer
///
/// Provides a generic interface to height field based tiles.
/// The philosophy here is that if you want to implement a different data source then you write a separate class.
/// TODO change this to an aframe-system
/// TODO ellipsoid is spherical and should be oblate

class TileServer  {

 
  getGround(lat,lon,lod,url,callback) {
    // this whole routine is heavy due to needing to initialize cesium - a better approach is to look at loaded tile data - improve later TODO
 
    if(!this.terrainProvider) {
      // TODO arguably this should be set once globally in a setter method because changing providers mid-flight is a bit weird
      this.terrainProvider = new Cesium.CesiumTerrainProvider({ ellipsoid:new Cesium.Ellipsoid(1,1,1), requestVertexNormals:true, url:url });
    }


    // TODO replace with custom height derivation - see findClosestElevation() - but it needs to interpolate still
    Cesium.when(this.terrainProvider.readyPromise).then( () => {
      let poi = Cesium.Cartographic.fromDegrees(lon,lat);
      if(lod > 15) lod = 15; // there are no tiles at some higher levels of detail
      Cesium.sampleTerrain(this.terrainProvider,lod,[poi]).then(function(groundResults) {
        callback(groundResults[0].height);
      });
    });
  }

  findClosestElevation(scheme) {
    // TODO may want to actually interpolate rather than merely taking the closest elevation...
    if(!scheme.tile) return 0;
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

  elevation2lod(world_radius,d) {
    let c = 2*Math.PI*world_radius;
    // truncate reasonable estimations for lod where d = distane above planetary surface in planetary units
    if(d < 1) d = 1;
    if(d > c/2) d = c/2;
    // even a small camera fov of 45' would show the entire circumference of the planet at a distance of r*2 if the planet was flattened
    // the visible area is basically distance * 2 ... so  ... number of tiles = circumference / (distance*2)
    // visible coverage is 2^(lod+1) = number of tiles  or .... 2^(lod+1) = c / (d*2) ... or ... 
    // also see https://gis.stackexchange.com/questions/12991/how-to-calculate-distance-to-ground-of-all-18-osm-zoom-levels/142555#142555
    let lod = Math.floor(Math.log2(c/(d*2)));
    // truncate hard limits for external tile services
    if(lod < 0) lod = 0;
    if(lod > 19) lod = 19;
    return lod;
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

  scheme_elaborate(data) {

    // If I was doing this correctly:
    // Ellipsoid : https://github.com/AnalyticalGraphicsInc/cesium/blob/master/Source/Core/Ellipsoid.js#L85
    // cartographicToCartesian : https://github.com/AnalyticalGraphicsInc/cesium/blob/master/Source/Core/Ellipsoid.js#L386

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

    // the rendering radius
    let radius = scheme.radius = data.radius;

    // the planet radius
    scheme.world_radius = data.world_radius;

    // stretch
    scheme.stretch = data.stretch || 1;

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
    // TODO must generate custom schemes for multiple simultaneous globes on the same aframe app
    scheme.uuid = "tile-"+scheme.xtile+"-"+scheme.ytile+"-"+lod;

    // radian version of non-quantized exact position (will be somewhere inside of the quantized latitude and longitude extent)
    scheme.lonrad = scheme.lon * Math.PI / 180;
    scheme.latrad = scheme.lat * Math.PI / 180;

    // exact corners in radians where 0,0 is the equator off of africa
    let a = -Math.PI   + (scheme.xtile + 0) * Math.PI * 2 / scheme.w;
    let b = -Math.PI   + (scheme.xtile + 1) * Math.PI * 2 / scheme.w;
    let c =  Math.PI/2 - (scheme.ytile+0) * Math.PI / scheme.h;
    let d =  Math.PI/2 - (scheme.ytile+1) * Math.PI / scheme.h;
    scheme.rect = { west:a, south:d, east:b, north:c };

    // degrees of coverage in radiams
    scheme.degrees_lonrad = scheme.rect.east-scheme.rect.west;
    scheme.degrees_latrad = scheme.rect.north-scheme.rect.south;

    // degrees of coverage
    scheme.degrees_lon = 360 / scheme.w; 
    scheme.degrees_lat = 180 / scheme.h;

    // convenience values
    scheme.width_world = 2*Math.PI*scheme.world_radius;
    scheme.width_tile_flat = scheme.width_world / scheme.w;
    scheme.width_tile_lat = scheme.width_tile_flat * Math.cos(data.lat * Math.PI / 180);

    return scheme;
  }

  /*
  toGeometryUnusedTest(scene) {

    // some test code to look at how cesium was building the Gudermannian 

    // prepare to build a portion of the hull of the surface of the planet - this will be a curved mesh of x by y resolution (see below)
    let geometry = new THREE.Geometry();

    // scale is arbitrary
    let scale = 256;

    // stride across the hull at this x resolution
    let xs = 16;

    // stride across the hull at this y resolution
    let ys = 16;

    // here is the code from https://github.com/AnalyticalGraphicsInc/cesium/blob/master/Source/Scene/ImageryLayer.js#L1026
    // just wanted to see what the fractional values were over some extent

    var sinLatitude = Math.sin(scheme.rect.south);
    var southMercatorY = 0.5 * Math.log((1 + sinLatitude) / (1 - sinLatitude));

    sinLatitude = Math.sin(scheme.rect.north);
    var northMercatorY = 0.5 * Math.log((1 + sinLatitude) / (1 - sinLatitude));
    var oneOverMercatorHeight = 1.0 / (northMercatorY - southMercatorY);

    // build vertices (for a given x,y point on the hull calculate the longitude and latitude of that point)
    for(let y = 0; y <= scale; y+=ys) {
     // for(let x = 0; x <= scale; x+=xs) {
        let fraction = y / 255;
        let latitude = (scheme.rect.south-scheme.rect.north) * fraction;
         sinLatitude = Math.sin(latitude);
        let mercatorY = 0.5 * Math.log((1.0 + sinLatitude) / (1.0 - sinLatitude));
        let mercatorFraction = (mercatorY - southMercatorY) * oneOverMercatorHeight;
      //}
    }
  }
  */

  /*
  toGeometryIdealized(scheme) {

    // OBSOLETE

    // prepare to build a portion of the hull of the surface of the planet - this will be a curved mesh of x by y resolution (see below)
    let geometry = new THREE.Geometry();

    // scale is arbitrary
    let scale = 256;

    // stride across the hull at this x resolution
    let xs = 16;

    // stride across the hull at this y resolution
    let ys = 16;

    // build vertices (for a given x,y point on the hull calculate the longitude and latitude of that point)
    for(let y = 0; y <= scale; y+=ys) {
      for(let x = 0; x <= scale; x+=xs) {

        // x position for vertex within hull
        let lonrad = scheme.degrees_lonrad * x / scale + scheme.rect.west;

        // y position for vertex within hull
        let latrad = scheme.rect.north - scheme.degrees_latrad * y / scale;

        //if(this.guder) { latrad = gudermannian_radians(latrad); }

        let radius = scheme.radius;
        let v = this.ll2v(latrad,lonrad,radius);
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
    // normals
    geometry.computeVertexNormals();
    geometry.computeFaceNormals();
    return geometry;
  }
  */

  toGeometry(scheme) {

    //
    // see https://github.com/AnalyticalGraphicsInc/quantized-mesh
    //
    // note in cesium this is done on GPU - which is not an option sadly due to game collisions and physics - see:
    //    EncodedCartesian3.js
    //    translateRelativeToEye.glsl

    let tile = scheme.tile;
    let radius = scheme.radius;
    let world_radius = scheme.world_radius;
    let stretch = scheme.stretch || 1;

    // a slightly laborious way - help rotate vertices in the tile so that they're actually at the equator (at 0,0 lat lon)
    let angle1 = scheme.rect.south;
    let angle2 = scheme.rect.west;
    let axis1 = new THREE.Vector3(1,0,0);
    let axis2 = new THREE.Vector3(0,1,0);

    // store this here for now (it helps with building height)
    scheme.average_height = 0;

    // calculate vertices
    let vertices = [];
    for (let i=0; i<tile._uValues.length; i++) {
      // find exact latitude - it's important to consider the offset from the poles due to narrowing there
      let z = tile._vValues[i]/32767*scheme.degrees_latrad + scheme.rect.south;
      // find ~latitude - just take a GMT centered straddle so it reduces labor later on because I want this centered at 0,0,0
      let x = (tile._uValues[i]/32767)*scheme.degrees_lonrad + scheme.rect.west;
      // get height values in meters from the earths center above sea level (actually SF itself is about 24m below sea level)
      let y = (((tile._heightValues[i]*(tile._maximumHeight-tile._minimumHeight))/32767.0)+tile._minimumHeight)*stretch;

      // accumulate average height
      scheme.average_height += y / tile._uValues.length;

      // convert latitude, longitude and height to a position on the earths surface that will be at [ latitude,0 ]
      // TODO this could take into account the ellipsoid rather than being a perfect sphere
      let v = this.ll2v(z,x,y+world_radius);

      // scale down  the rendering radius
      v.x = v.x / world_radius * radius;
      v.y = v.y / world_radius * radius;
      v.z = v.z / world_radius * radius;

      // slide the tile horizontally to be centered vertically on GMT - TODO this is computationally sloppy and could be vastly optimized
      v.applyAxisAngle(axis2,-scheme.rect.west); //- scheme.degrees_lonrad / 2 ); // (used to center but now am leaving at corner)

      // slide the tile vertically to be centered vertically on 0,0 - TODO could be done more cleanly at less cost
      v.applyAxisAngle(axis1,scheme.rect.south);// + scheme.degrees_latrad / 2 ); // (used to center but now am leaving at corner)

      // in model space - center the vertices so that the entire tile is at the origin 0,0,0 in cartesian coordinates
      v.z -= radius;

      // save vertex
      vertices.push(v);
    }

    // build geometry
    let geometry = new THREE.Geometry();
    // build vertices
    geometry.vertices = vertices;
    // build faces
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
    // return geometry
    geometry.uvsNeedUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeFaceNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  produceTile(data,callback) {

    if(!this.terrainProvider) {
      // TODO arguably this should be set once globally in a setter method because changing providers mid-flight is a bit weird
      this.terrainProvider = new Cesium.CesiumTerrainProvider({ ellipsoid:new Cesium.Ellipsoid(1,1,1), requestVertexNormals:true, url:data.url });
    }

    let material = 0;

    if(data.groundTexture && data.groundTexture.length) {
      let texture = new THREE.TextureLoader().load(data.groundTexture);
      material = new THREE.MeshBasicMaterial({map:texture,color:0xffffff});
    }

    Cesium.when(this.terrainProvider.readyPromise).then( () => {
      ImageServer.instance().ready( () => {
        let scheme = this.scheme_elaborate(data);
        if(!material) {
          this.imageProvider = ImageServer.instance(); // not the most elegant... TODO move? have a parent wrapper for both providers?
          this.imageProvider.provideImage(scheme, material2 => {
            scheme.material = material2;
            Cesium.when(this.terrainProvider.requestTileGeometry(scheme.xtile,scheme.ytile,scheme.lod),tile => {
              scheme.tile = tile;
              scheme.geometry = this.toGeometry(scheme); // this.toGeometryIdealized(scheme);
              scheme.mesh = new THREE.Mesh(scheme.geometry,scheme.material);
              callback(scheme);
            });
          });
        } else {
            scheme.material = material;
            Cesium.when(this.terrainProvider.requestTileGeometry(scheme.xtile,scheme.ytile,scheme.lod),tile => {
              scheme.tile = tile;
              scheme.geometry = this.toGeometry(scheme); // this.toGeometryIdealized(scheme);
              scheme.mesh = new THREE.Mesh(scheme.geometry,scheme.material);
              callback(scheme);
            });
        }
      });
    });
  }
}

///
/// Singelton convenience handles
/// TODO an AFrame System could do this https://aframe.io/docs/0.7.0/core/systems.html
///

TileServer.instance = function() {
  if(TileServer.tileServer) return TileServer.tileServer;
  TileServer.tileServer = new TileServer();
  return TileServer.tileServer;
};

// es6 glue

export default TileServer;

