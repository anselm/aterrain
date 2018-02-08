///
/// ImageServer is intended to be a prototype for any arbitrary image provider. The default is for Bing and Cesium terrain tiles.
/// Note that image tiles cover different geography than terrain tiles.
/// Note that to avoid a shader the images are composited using a canvas.
///

class ImageServer {
  constructor(terrainProvider, imageProvider) {
    this.terrainProvider = terrainProvider;
    this.imageProvider = imageProvider;
    this.pixelsWide = 256; // bing tile size
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
    canvas.paint = function(image,extent) {
      canvas.ctx.drawImage(image,extent.x1,extent.y1,extent.x2-extent.x1,extent.y2-extent.y1);
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
    let irect = this.imageProvider.tilingScheme.tileXYToRectangle(ixy.x,ixy.y,scheme.lod);

    // hardcoded for bing tiles; they are the same width as cesium TMS terrain tiles but not the same vertical coverage
    let x1 = 0;
    let x2 = this.pixelsWide;
    let y1 = (trect.north - irect.north) * this.pixelsWide / (trect.north-trect.south);
    let y2 = (trect.north - irect.south) * this.pixelsWide / (trect.north-trect.south);

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

  toMaterial(scheme,callback) {

    // get a 2d surface to paint onto (a canvas and a couple of helper methods)
    let scratch = this.scratchpad();

    // this will be called last in the chain built below - return material to the caller
    let chain = function() {
      callback(scratch.material());
    };

    for(let i = -2; i < 3; i++) {
      // consider image extents that may overlap the tile extent that needs to be fully painted
      let extent = this.getExtent(scheme,i);
      if(extent.y1>=256 || extent.y2<0)continue;
      // accumulate a chain of functions that will be called in sequence to paint onto the tile area
      chain = this.makePromise(scratch,extent,chain);
    }
    chain();
  }
}

