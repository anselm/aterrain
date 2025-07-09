///
/// ImageServer returns images on demand that match the terrain tile boundaries.
///
/// TODO Cesium access token should be settable
/// TODO Code is over-specialized around Cesium Elevation Tiles - but hard to generalize trivially.
///

class ImageServer {

  // constructor takes parameters which could be used to select the source.
  // imageSource defaults to ESRI World Imagery. imageURL and apikey optional. apiKey not implemented yet.
  // A imageSource of "custom" can be used along with imageryUrlTemplate as a url template for any arbitrary source.
  //
  // See Leaflet Providers project for api info on map image providers. https://github.com/leaflet-extras/leaflet-providers/blob/master/leaflet-providers.js
  // imageSource names for cases are using the same names as Leaflet Providers. This could provide some standardization in naming.
  //
  // TODO add cases for generic URL Template, or WMTS providers.
  // TODO update A-Terrain to allow setting properties to use imagery providers besides default.

  constructor(imageSource = "ESRI.WorldImagery", imageryUrlTemplate, apiKey) {
    this.data = {};
    this.data.debug = false;
    console.log('image server constructor using '+imageSource);
    //this.data.mapStyle = Cesium.BingMapsStyle.AERIAL;

    // Cesium JS (2017) contains the following imagery providers:
    // -- ArcGisMapServerImageryProvider
    // -- createOpenStreetMapImageryProvider
    // -- createTileMapServiceImageryProvider
    // -- GoogleEarthEnterpriseImageryProvider
    // -- GoogleEarthEnterpriseMapsProvider
    // -- GridImageryProvider
    // -- MapboxImageryProvider
    // -- SingleTileImageryProvider
    // -- TileCoordinatesImageryProvider
    // -- UrlTemplateImageryProvider
    // -- WebMapServiceImageryProvider
    // -- WebMapTileServiceImageryProvider

    // Cesium JS 1.131 (2022) contains the following imagery providers:
    // -- ArcGisMapServerImageryProvider
    // -- BingMapsImageryProvider
    // -- GoogleEarthEnterpriseImageryProvider
    // -- GridImageryProvider
    // -- IonImageryProvider
    // -- MapboxImageryProvider
    // -- MapboxStyleImageryProvider 
    // -- OpenStreetMapImageryProvider
    // -- SingleTileImageryProvider
    // -- TileCoordinatesImageryProvider
    // -- TileMapServiceImageryProvider
    // -- UrlTemplateImageryProvider
    // -- WebMapServiceImageryProvider
    // -- WebMapTileServiceImageryProvider

    switch (imageSource) {
        case "USGS.USImagery": //works in USA
            console.log('using USGS Imagery Only');
            this.data.url = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}';
            this.imageProvider = new Cesium.UrlTemplateImageryProvider(this.data);
            break;
        case "USGS.USImageryTopo": //works in USA
            console.log('using USGS Imagery Topo');
            this.data.url = 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}';
            this.imageProvider = new Cesium.UrlTemplateImageryProvider(this.data);
            break;
        case "GeoportailFrance.orthos": //works but may be LOD issues
            console.log('using GeoportailFrance.orthos WMTS');
            this.imageProvider = new Cesium.WebMapTileServiceImageryProvider({
                 url : 'https://data.geopf.fr/wmts',
                 layer : 'ORTHOIMAGERY.ORTHOPHOTOS',
                 style : 'normal',
                 format : 'image/jpeg',
                 tileMatrixSetID : 'PM',
                 maximumLevel: 19,
                 credit : new Cesium.Credit('GeoportailFrance')
            });
            break;
        /*
        case "GeoportailFrance.orthos": // works but may be LOD issues
            console.log('using GeoportailFrance.orthos');
            this.data.url = 'https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
            this.data.maxZoom = 18;
            this.imageProvider = new Cesium.UrlTemplateImageryProvider(this.data);
            break;
            */
        case "ESRI.WorldImagery": //works
            console.log('using ESRI World Imagery');
            this.data.url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
            this.imageProvider = new Cesium.UrlTemplateImageryProvider(this.data);
            break;
        case "OpenTopoMap":
            console.log('using OpenTopo');
            this.data.url = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
            this.imageProvider = new Cesium.UrlTemplateImageryProvider(this.data);
            break;
        case "OpenStreetMap.Mapnik":
            console.log('using Open Street Maps Mapnik');
            this.data.url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
            this.imageProvider = new Cesium.UrlTemplateImageryProvider(this.data);
            break;
        case "custom":
            console.log('using custom imagery source');
            this.data.url = imageryUrlTemplate;
            this.imageProvider = new Cesium.UrlTemplateImageryProvider(this.data);
        default:
            console.log('Invalid imagery source. DEFAULT to ESRI World Imagery');
            this.data.url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
            this.imageProvider = new Cesium.UrlTemplateImageryProvider(this.data);
            break;
    };
      console.log(this.imageProvider);
  }

  isReady() {
    // TODO examine why do the readypromises differ?
    if(this.data.source == 0) {
      return this.imageProvider && this.imageProvider.imageurl;
    } else {
      return this.imageProvider && this.imageProvider.ready;
    }    
  }

  ready(callback) {
    // TODO examine why do the readypromises differ?
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

    // For Mercator, check out Slide 39-43 of Rendering the Whole Wide World on the World Wide Web for some background and reprojectToGeographic() in ImageryLayer.js for how Cesium currently does it.
    // Here the reprojection is done on CPU...

    // circument a quirk with cesium data source
    let uselod = (this.data.source == 2) ? scheme.lod+1 : scheme.lod+1;

    // get image tiles at one level deeper than terrain tiles to take advantage of x lining up
    let image_lod = Math.pow(2,uselod);

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

    // get canvas to paint to for final output
    // TODO may as well put this indie the promise
    let canvas = this.canvas_new();

    // Paint once loaded
    Promise.all(promises).then(results => {

      // convert the img to something that can be read and written
      if(!results.length) {
        console.error("Image server no image content error 1");
        return;        
      }

      // a canvas is required per image source in order to get at the pixels
      for(let i = 0; i < results.length;i++) {        
        if(typeof results[i] == 'undefined' || !results[i]) {
          console.error("Image server no image content error 2");
          return;
        }
        this.canvas_from_image(results[i]);
      }

      // walk the sources and copy pixels to a target - this is labor intensive
      for(let y = 0;y<256;y++) {

        // get reverse mercator pixel location (only y is needed)
        let txy = this.projection2tile(scheme,image_lod,y);

        // get that tile (offset from the set of tiles we happen to have)
        let image = results[Math.floor(txy)-Math.floor(ty1)];

        // get y in tile
        let yy = Math.floor(txy*256) & 255;

        // copy that row (there is no horizontal reprojection only vertical)
        // TODO this could be optimized such as by not setting the alpha here and copying uints
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

  canvas_from_image(image) {
    if(image.canvas) return;
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

    if(this.data.debug) {
      let ctx = canvas.ctx;
      ctx.beginPath();
      ctx.lineWidth="6";
      ctx.strokeStyle="red";
      ctx.rect(0,0,255,255); 
      ctx.stroke();
    }

    //let material = new THREE.MeshPhongMaterial( { color:0xffffff, wireframe:false });
    let material = new THREE.MeshLambertMaterial( { color:0xffffff, wireframe:false }); //shading: THREE.SmoothShading});
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


// es6 glue

export default ImageServer;

