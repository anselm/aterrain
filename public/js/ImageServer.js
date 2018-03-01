
///
/// ImageServer is intended to be a prototype for any arbitrary image provider. The default is for Bing and Cesium terrain tiles.
/// Note that image tiles cover different geography than terrain tiles.
/// Note that to avoid a shader the images are composited using a canvas.
///

class ImageServer {

}

class ImageServerCesium {
  constructor(imageProvider) {
    this.imageProvider = imageProvider;
    this.pixelsWide = 256; // bing tile size
    this.debug = true;
  }
  ready(callback) {
    Cesium.when(this.imageProvider.readyPromise).then(callback);
  }
  scratchpad() {
    let canvas = document.createElement('canvas');
    canvas.id = "canvas";
    canvas.width = this.pixelsWide;
    canvas.height = this.pixelsWide;
    canvas.ctx = canvas.getContext("2d");
    canvas.ctx.fillStyle = "#ff00ff";
    canvas.ctx.fillRect(0,0,this.pixelsWide,this.pixelsWide);
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
    let x2 = this.pixelsWide;
    let y1 = (trect.north - irect.north) * this.pixelsWide / (trect.north-trect.south);
    let y2 = (trect.north - irect.south) * this.pixelsWide / (trect.north-trect.south);

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


///
/// Directly fetch bing tiles
///

class ImageServerBing {
  constructor() {
    this.pixelsWide = 256; // bing tile size
    this.debug = true;
  }
  ready(callback) {
    let scope = this;
    let metadata = "https://dev.virtualearth.net/REST/V1/Imagery/Metadata/Aerial?output=json&include=ImageryProviders&key=RsYNpiMKfN7KuwZrt8ur~ylV3-qaXdDWiVc2F5NCoFA~AkXwps2-UcRkk2L60K5qBy5kPnTmwvxdfwl532NTheLdFfvYlVJbLnNWG1iC-RGL";
    fetch(metadata).then(response => { return response.json() }).then( json => {
      let subdomains = json.resourceSets[0].resources[0].imageUrlSubdomains;
      scope.subdomain = subdomains[~~(subdomains.length * Math.random())];
      scope.imageurl = json.resourceSets[0].resources[0].imageUrl;
      scope.imageurl = scope.imageurl.replace("{culture}", "en-US");
      scope.imageurl = scope.imageurl.replace("{subdomain}",scope.subdomain);
      callback();
    });
  }
  scratchpad() {
    let canvas = document.createElement('canvas');
    canvas.id = "canvas";
    canvas.width = this.pixelsWide;
    canvas.height = this.pixelsWide;
    canvas.ctx = canvas.getContext("2d");
    canvas.ctx.fillStyle = "#ff00ff";
    canvas.ctx.fillRect(0,0,this.pixelsWide,this.pixelsWide);
    let debug = this.debug;
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

  load(url) {
    return new Promise(function(resolve,reject) {
      let image = new Image();
      image.onload = unused => { resolve(image); }
      fetch(url).then(response => { return response.blob(); }).then( blob => { image.src = URL.createObjectURL(blob); });
    });
  }

  provideImage(scheme,callback) {

    // it so happens that one terrain tile at a given lod can be exactly covered by two bing tiles at that lod + 1
    // TODO this doesn't deal with mercator projection and somewhere the renderer should consider it

    let quadkey1 = this.quadkey(scheme.xtile,scheme.ytile*2,scheme.lod+1);
    let quadkey2 = this.quadkey(scheme.xtile,scheme.ytile*2+1,scheme.lod+1);

    let u1 = this.imageurl.replace("{quadkey}", quadkey1);
    let u2 = this.imageurl.replace("{quadkey}", quadkey2);

    Promise.all([this.load(u1),this.load(u2)]).then( results => {
      let scratch = this.scratchpad();
      scratch.paint(results[0],{x1:0,y1:0,x2:256,y2:128});
      scratch.paint(results[1],{x1:0,y1:128,x2:256,y2:128});
      callback(scratch.material());
    }, function(error) {
      alert("failure");
      console.error(error);
    });

  }
}



///
/// Singelton convenience handles
/// TODO an AFrame System could do this https://aframe.io/docs/0.7.0/core/systems.html
///

ImageServer.instance = function() {
  if(ImageServer.imageServer) return ImageServer.imageServer;
  //let provider = new Cesium.BingMapsImageryProvider({
  //  url : 'https://dev.virtualearth.net',
  //  key : 'RsYNpiMKfN7KuwZrt8ur~ylV3-qaXdDWiVc2F5NCoFA~AkXwps2-UcRkk2L60K5qBy5kPnTmwvxdfwl532NTheLdFfvYlVJbLnNWG1iC-RGL',
  //  mapStyle : Cesium.BingMapsStyle.AERIAL
  //});
  ImageServer.imageServer = new ImageServerBing();
  return ImageServer.imageServer;
};
