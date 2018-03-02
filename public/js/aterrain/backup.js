
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// Use Cesium to fetch tiles from Bing
/// Uses a CPU based technique to build up an image tile.
/// TODO query for tile index instead?
/// TODO can I ask for non mercator?
/// TODO try correct images in WASM on cpu?
///
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class ImageServer {

  constructor() {

    this.data = {};
    this.data.CesiumionAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYmI0ZmY0My1hOTg5LTQzNWEtYWRjNy1kYzYzNTM5ZjYyZDciLCJpZCI6NjksImFzc2V0cyI6WzM3MDQsMzcwMywzNjk5LDM2OTNdLCJpYXQiOjE1MTY4MzA4ODZ9.kM-JnlG-00e7S_9fqS_QpXYTg7y5-cIEcZEgxKwRt5E';
    this.data.url = 'https://beta.cesium.com/api/assets/3693?access_token=' + this.data.CesiumionAccessToken;
    this.data.key = 'RsYNpiMKfN7KuwZrt8ur~ylV3-qaXdDWiVc2F5NCoFA~AkXwps2-UcRkk2L60K5qBy5kPnTmwvxdfwl532NTheLdFfvYlVJbLnNWG1iC-RGL';
    this.data.mapStyle = Cesium.BingMapsStyle.AERIAL;

    //this.imageProvider = new Cesium.createTileMapServiceImageryProvider(this.data);
    this.data.url = 'https://dev.virtualearth.net',
    this.imageProvider = new Cesium.BingMapsImageryProvider(this.data);
    this.pixelsWide = 256; // tile size
    this.debug = true;
  }

  ready(callback) {
    Cesium.when(this.imageProvider.readyPromise).then(callback);
  }

  scratchpad() {
    let canvas = document.createElement('canvas');
    canvas.id = "canvas";
    canvas.width = this.data.pixelsWide;
    canvas.height = this.data.pixelsWide;
    canvas.ctx = canvas.getContext("2d");
    canvas.ctx.fillStyle = "#ff00ff";
    canvas.ctx.fillRect(0,0,this.data.pixelsWide,this.data.pixelsWide);
    let debug = this.debug;
    canvas.paint = function(image,extent) {
      canvas.ctx.drawImage(image,extent.x1,extent.y1,extent.x2-extent.x1,extent.y2-extent.y1);
      if(debug) {
        let ctx = canvas.ctx;
        ctx.beginPath();
        ctx.lineWidth="6";
        ctx.strokeStyle="red";
        ctx.rect(0,0,255,255); 
        ctx.stroke();
      }
    }
    canvas.material = function() {
      let material = new THREE.MeshPhongMaterial( { color:0xffffff, wireframe:false });
      material.map = new THREE.Texture(canvas);
      material.map.needsUpdate = true;
      return material;
    }
    return canvas;
  }

  getExtent(scheme,offset) {

    // extent of terrain tile
    let trect = scheme.rect;

    // TODO improve - calculate this without relying on cesium
    // set the extent of an image tile overlapping this coordinate
    let poi = Cesium.Cartographic.fromDegrees(scheme.lon,scheme.lat);
    let ixy = this.imageProvider.tilingScheme.positionToTileXY(poi,scheme.lod);
    ixy.y += offset;

    // if the tile is off the edge of the world it is uninteresting
    if(ixy.y < 0) return { outofscope: true };
    //if(ixy.y > some limit) return { outofscope: true};

    let irect = this.imageProvider.tilingScheme.tileXYToRectangle(ixy.x,ixy.y,scheme.lod);

    // hardcoded for bing tiles; they are the same width as cesium TMS terrain tiles but not the same vertical coverage
    let x1 = 0;
    let x2 = this.data.pixelsWide;
    let y1 = (trect.north - irect.north) * this.data.pixelsWide / (trect.north-trect.south);
    let y2 = (trect.north - irect.south) * this.data.pixelsWide / (trect.north-trect.south);

    if(y1>=256 || y2 < 0 ) return { outofscope:true};

    let extents = {
      lod:scheme.lod,
      ixy:ixy,
      x1:x1,
      y1:y1,
      x2:x2,
      y2:y2,
    }

    return extents;
  }

  makePromise(scratch,extent,resolve) {
    let scope = this;
    let promise = function() {
      let request = scope.imageProvider.requestImage(extent.ixy.x,extent.ixy.y,extent.lod);
      Cesium.when(request,function(image) {
        scratch.paint(image,extent);
        if(resolve)resolve();
      });
    };
    return promise;
  }

  provideImage(scheme,callback) {

    // TODO this does a linear mapping of latitudes... but the globe is not linear; it is curved
    // so this has a large distortion at the middle of a tile...

    // get a 2d surface to paint onto (a canvas and a couple of helper methods)
    let scratch = this.scratchpad();

    // this will be called last in the chain built below - return material to the caller
    let chain = function() {
      callback(scratch.material());
    };

    // TODO get more accurate estimates of which tiles to fetch - although later hopefully this all gets replaced with a single image tile.
    for(let i = -2; i < 3; i++) {
      // consider image extents that may overlap the tile extent that needs to be fully painted
      let extent = this.getExtent(scheme,i);
      // ignore features outside of render area or entire images that are illegal (off edge of world)
      if(extent.outofscope) continue;
      // accumulate a chain of functions that will be called in sequence to paint onto the tile area
      chain = this.makePromise(scratch,extent,chain);
    }
    chain();
  }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///
/// Wrapper for fetching image tiles
/// These are unfortunately in a Mercator projection which requires correction elsewhere
/// TODO *** see if these can be corrected with WASM on CPU rather than in the tile vertex space?
///
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

class BingImageProvider {
  constructor() {
  }
  readyPromise(resolve) {
    console.log("starting");
    let scope = this;
    if(scope.imageurl) {
      console.log("good");
      resolve();
      return;
    }
    let metadata = "https://dev.virtualearth.net/REST/V1/Imagery/Metadata/Aerial?output=json&include=ImageryProviders&key=RsYNpiMKfN7KuwZrt8ur~ylV3-qaXdDWiVc2F5NCoFA~AkXwps2-UcRkk2L60K5qBy5kPnTmwvxdfwl532NTheLdFfvYlVJbLnNWG1iC-RGL";
    fetch(metadata).then(response => { return response.json() }).then( json => {
      let subdomains = json.resourceSets[0].resources[0].imageUrlSubdomains;
      scope.subdomain = subdomains[~~(subdomains.length * Math.random())];
      scope.imageurl = json.resourceSets[0].resources[0].imageUrl;
      scope.imageurl = scope.imageurl.replace("http", "https");
      scope.imageurl = scope.imageurl.replace("{culture}", "en-US");
      scope.imageurl = scope.imageurl.replace("{subdomain}",scope.subdomain);
      console.log("done");
      resolve();
    });
  }
  quadkey(x, y, z) {
    let quadKey = [];
    for (var i = z; i > 0; i--) {
      var digit = '0';
      var mask = 1 << (i - 1);
      if ((x & mask) != 0) {
          digit++;
      }
      if ((y & mask) != 0) {
          digit++;
          digit++;
      }
      quadKey.push(digit);
    }
    return quadKey.join('');
  }
  requestImage(x,y,lod) {
    let scope = this;
    return new Promise(function(resolve,reject) {
      let quadkey = scope.quadkey(x,y*2,lod+1);
      let url = scope.imageurl.replace("{quadkey}", quadkey);
      let image = new Image();
      image.onload = unused => { resolve(image); }
      fetch(url).then(response => { return response.blob(); }).then( blob => { image.src = URL.createObjectURL(blob); });
    });
  }
}
/*
class ImageServer {
  constructor() {

    this.data = {};
    this.data.debug = true;
    this.data.pixelsWide = 256; // tile size
    //this.data.mapStyle = Cesium.BingMapsStyle.AERIAL;

    // Custom abstraction - bypasses Cesium - not used
    this.imageProvider = new BingImageProvider();

    // Something seems to be not working with this provider although it's the one I'd prefer to use right now - mar 1 2018
    // this.data.CesiumionAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYmI0ZmY0My1hOTg5LTQzNWEtYWRjNy1kYzYzNTM5ZjYyZDciLCJpZCI6NjksImFzc2V0cyI6WzM3MDQsMzcwMywzNjk5LDM2OTNdLCJpYXQiOjE1MTY4MzA4ODZ9.kM-JnlG-00e7S_9fqS_QpXYTg7y5-cIEcZEgxKwRt5E';
    // this.data.url = 'https://beta.cesium.com/api/assets/3693?access_token=' + this.data.CesiumionAccessToken;
    // this.imageProvider = new Cesium.createTileMapServiceImageryProvider(this.data);

    // Cesium Bing abstraction
    //this.data.key = 'RsYNpiMKfN7KuwZrt8ur~ylV3-qaXdDWiVc2F5NCoFA~AkXwps2-UcRkk2L60K5qBy5kPnTmwvxdfwl532NTheLdFfvYlVJbLnNWG1iC-RGL';
    //this.data.url = 'https://dev.virtualearth.net',
    //this.imageProvider = new Cesium.BingMapsImageryProvider(this.data);

  }
  ready(callback) {
    //Cesium.when(this.imageProvider.readyPromise).then(callback);
    this.imageProvider.readyPromise(callback);
  }
  scratchpad() {
    let canvas = document.createElement('canvas');
    canvas.id = "canvas";
    canvas.width = this.pixelsWide;
    canvas.height = this.pixelsWide;
    canvas.ctx = canvas.getContext("2d");
    canvas.ctx.fillStyle = "#ff00ff";
    canvas.ctx.fillRect(0,0,this.pixelsWide,this.pixelsWide);
    let debug = this.data.debug;
    canvas.paint = function(image,extent) {
      canvas.ctx.drawImage(image,extent.x1,extent.y1,extent.x2,extent.y2);
      if(debug) {
        let ctx = canvas.ctx;
        ctx.beginPath();
        ctx.lineWidth="6";
        ctx.strokeStyle="red";
        ctx.rect(0,0,255,255); 
        ctx.stroke();
      }
    }
    canvas.material = function() {
      let material = new THREE.MeshPhongMaterial( { color:0xffffff, wireframe:false });
      material.map = new THREE.Texture(canvas);
      material.map.needsUpdate = true;
      return material;
    }
    return canvas;
  }

  provideImage(scheme,callback) {
    let x = scheme.xtile;
    let y = scheme.ytile;
    let lod = scheme.lod;
    //let p1 = this.imageProvider.requestImage(x,y*2,lod+1);
  //  let p2 = this.imageProvider.requestImage(x,y*2+1,lod+1);
    let scratch = this.scratchpad();
      callback(scratch.material());

      return;


    Promise.all([p1,p2]).then( results => {
      console.log("=========== got images ==========");
      console.log(results[0]);
      console.log(results[1]);

var src = document.getElementById("test");
let img = document.createElement("img");
img.src = results[0].src;
src.appendChild(img);

//      scratch.paint(img,{x1:0,y1:0,x2:256,y2:128});
  //    scratch.paint(img,{x1:0,y1:128,x2:256,y2:128});
      callback(scratch.material());
    }, function(error) {
      alert("failure");
      console.error(error);
    });
  }
}
*/

///
/// Singelton convenience handles
/// TODO an AFrame System could do this https://aframe.io/docs/0.7.0/core/systems.html
///

ImageServer.instance = function() {
  if(ImageServer.imageServer) return ImageServer.imageServer;
  ImageServer.imageServer = new ImageServer();
  return ImageServer.imageServer;
};
