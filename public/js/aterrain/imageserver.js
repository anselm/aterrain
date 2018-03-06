
///
/// BingImageProvider - this is an optional provider to fetch Bing tiles without using Cesium
///
/// These are unfortunately in a Mercator projection which requires correction elsewhere (see below)
///

class BingImageProvider {
  constructor() {
    this.cached = {};
  }
  readyPromise(resolve) {
    let scope = this;
    if(scope.imageurl) {
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
      scope.imageurl = scope.imageurl.replace("jpeg", "png");
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

    let key = x + "-" + y + "-" + lod;
    let c = scope.cached[key];
    if(c) {
      return new Promise(function(resolve,reject) {
        resolve(c);
      });
    }

    return new Promise(function(resolve,reject) {
      let quadkey = scope.quadkey(x,y,lod);
      let url = scope.imageurl.replace("{quadkey}", quadkey);
      let image = new Image();
      image.onload = unused => {
        scope.cached[key] = image;
        resolve(image);
      }
      fetch(url).then(response => { return response.blob(); }).then( blob => {
        image.url = url;
        image.src = URL.createObjectURL(blob);
      });
    });
  }
}

///
/// ImageServer returns images on demand that match the terrain tile boundaries.
///

class ImageServer {

  constructor() {
    this.data = {};
    this.data.debug = true;
    //this.data.mapStyle = Cesium.BingMapsStyle.AERIAL;
    this.data.source = 0;
    if(this.data.source == 0) {
      // bypass cesium
      this.imageProvider = new BingImageProvider();
    } else if(this.data.source == 1) {
       // cesium for sf area - Something seems to be not working with this provider although it's the one I'd prefer to use right now - mar 1 2018
       this.data.CesiumionAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYmI0ZmY0My1hOTg5LTQzNWEtYWRjNy1kYzYzNTM5ZjYyZDciLCJpZCI6NjksImFzc2V0cyI6WzM3MDQsMzcwMywzNjk5LDM2OTNdLCJpYXQiOjE1MTY4MzA4ODZ9.kM-JnlG-00e7S_9fqS_QpXYTg7y5-cIEcZEgxKwRt5E';
       this.data.url = 'https://beta.cesium.com/api/assets/3693?access_token=' + this.data.CesiumionAccessToken;
       this.imageProvider = new Cesium.createTileMapServiceImageryProvider(this.data);
    } else if(this.data.source == 2) {
      // Cesium Bing abstraction in general - works ok although LOD is off by one?
      this.data.key = 'RsYNpiMKfN7KuwZrt8ur~ylV3-qaXdDWiVc2F5NCoFA~AkXwps2-UcRkk2L60K5qBy5kPnTmwvxdfwl532NTheLdFfvYlVJbLnNWG1iC-RGL';
      this.data.url = 'https://dev.virtualearth.net',
      this.imageProvider = new Cesium.BingMapsImageryProvider(this.data);
    }
  }

  ready(callback) {
    // TODO why do the readypromises differ?
    if(this.data.source == 0) {
      this.imageProvider.readyPromise(callback);
    } else {
      Cesium.when(this.imageProvider.readyPromise).then(callback);
    }
  }

  // this method calculates the image tile and fractional component (ie which pixel) of the image tile to fetch
  projection2tile(scheme,image_lod,y) {
    // which tile in the y axis - and retain fractional pixel pos
    let lat = scheme.rect.north - y*scheme.degrees_latrad/256; // range PI/2 to -PI/2
    // https://msdn.microsoft.com/en-us/library/bb259689.aspx -> no data past these points (I want max Y to be within the previous tile)
    if(lat >= 1.48442222975) lat = 1.48442222974;
    if(lat <= -1.48442222975) lat = -1.48442222974;
    let sinLat = Math.sin(lat);
    let tileY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * image_lod;
    return tileY;
  }

  provideImageProjected(scheme,callback) {

    // get image tiles at one level deeper than terrain tiles to take advantage of x lining up
    let image_lod = Math.pow(2,scheme.lod+1);

    // where is the top and bottom tile?
    let ty1 = this.projection2tile(scheme,image_lod,0,0);
    let ty2 = this.projection2tile(scheme,image_lod,255,255);
    let tx1 = scheme.xtile;

    // load entire range of tiles
    let promises = [];
    for(let i = Math.floor(ty1);i<=Math.floor(ty2);i++) {
      let p = this.imageProvider.requestImage(tx1,i,scheme.lod+1);
      promises.push(p);
    }

    // get canvas
    let canvas = this.canvas_new();

    // Paint once loaded
    Promise.all(promises).then(results => {

      // convert the img to something that can be read and written
      if(!results.length) {
        console.error("Image server no image content error 1");
        return;        
      }
      for(let i = 0; i < results.length;i++) {        
        if(typeof results[i] == 'undefined' || !results[i]) {
          console.error("Image server no image content error 2");
          return;
        }
        this.canvas_from_image(results[i]);
      }

      // walk the surface and copy pixels over laboriously
      for(let y = 0;y<256;y++) {

        // get reverse mercator pixel location (only y is needed)
        let txy = this.projection2tile(scheme,image_lod,y);

        // get that tile (offset from the set of tiles we happen to have)
        let image = results[Math.floor(txy)-Math.floor(ty1)];

        // get y in tile
        let yy = Math.floor(txy*256) & 255;

        // copy that row (there is no horizontal reprojection only vertical)
        for(let x = 0; x<256;x++) {
          canvas.imageData.data[(y*256+x)*4+0] = image.imageData.data[(yy*256+x)*4+0];
          canvas.imageData.data[(y*256+x)*4+1] = image.imageData.data[(yy*256+x)*4+1];
          canvas.imageData.data[(y*256+x)*4+2] = image.imageData.data[(yy*256+x)*4+2];
          canvas.imageData.data[(y*256+x)*4+3] = 255;
        }
      }

      // return to the caller
      callback(this.canvas_to_material_from_imagedata(canvas));
    });
  }

  provideImageUnprojectedUnused(scheme,callback) {
    // here is a version of the image mapper that doesn't do any projection
    let x = scheme.xtile;
    let y = scheme.ytile;
    let lod = scheme.lod;
    let p1 = this.imageProvider.requestImage(x,y+y,lod+1);
    let p2 = this.imageProvider.requestImage(x,y+y+1,lod+1);
    Promise.all([p1,p2]).then( results => {
      let canvas = this.canvas_new();
      this.canvas_paint(canvas,results[0],{x1:0,y1:0,x2:256,y2:128});
      this.canvas_paint(canvas,results[1],{x1:0,y1:128,x2:256,y2:128});
      callback(this.canvas_to_material(canvas));
    }, function(error) {
      console.error(error);
    });
  }

  provideImage(scheme,callback) {
    this.provideImageProjected(scheme,callback);
  }

  //////////////////////////////////////////////////////////// canvas assistance
  canvas_new() {
    let canvas = document.createElement('canvas');
    canvas.id = "canvas";
    canvas.width = 256;
    canvas.height = 256;
    canvas.ctx = canvas.getContext("2d");
    canvas.ctx.fillStyle = "#ff0000";
    canvas.ctx.fillRect(0,0,256,256);
    canvas.imageData = canvas.ctx.getImageData(0,0,256,256);
    //  var buf = new ArrayBuffer(imageData.data.length);
    //  var buf8 = new Uint8ClampedArray(buf);
    //  var data = new Uint32Array(buf);
    return canvas;
  }
  canvas_paint(canvas,image,extent) {
    let debug = this.data.debug;
    canvas.ctx.drawImage(image,extent.x1,extent.y1,extent.x2,extent.y2);
    if(debug) {
      let ctx = canvas.ctx;
      ctx.beginPath();
      ctx.lineWidth="6";
      ctx.strokeStyle="red";
      ctx.rect(0,0,255,255); 
      ctx.stroke();
    }
    return canvas;
  }
  canvas_from_image(image) {
    image.canvas = document.createElement('canvas');
    image.canvas.width = 256;
    image.canvas.height = 256;
    image.canvas.ctx = image.canvas.getContext("2d");
    image.canvas.ctx.fillStyle = "#ffff00";
    image.canvas.ctx.fillRect(0,0,256,256);
    image.canvas.ctx.drawImage(image,0,0,256,256);
    image.imageData = image.canvas.ctx.getImageData(0,0,256,256);
  }
  canvas_to_material(canvas) {
    let material = new THREE.MeshPhongMaterial( { color:0xffffff, wireframe:false });
    material.map = new THREE.Texture(canvas);
    material.map.needsUpdate = true;
    return material;
  }
  canvas_to_material_from_imagedata(canvas) {
    // data[y * canvasWidth + x] = 0xff00000+b<<16+g<<8+r;
    // imageData.data.set(buf8);
    canvas.ctx.putImageData(canvas.imageData, 0, 0);
    return this.canvas_to_material(canvas);
  }
  ////////////////////////////////////////////////////////////////////////////////////////////

}

///
/// Singelton convenience handles
/// TODO an AFrame System could do this https://aframe.io/docs/0.7.0/core/systems.html
///

ImageServer.instance = function() {
  if(ImageServer.imageServer) return ImageServer.imageServer;
  ImageServer.imageServer = new ImageServer();
  return ImageServer.imageServer;
};
