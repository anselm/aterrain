

////////////////////////////////////////////////////////////////////////////////////////////////////////
// math helpers
// TODO perhaps put this somewhere cleaner later
////////////////////////////////////////////////////////////////////////////////////////////////////////

// https://en.wikipedia.org/wiki/Gudermannian_function
// http://aperturetiles.com/docs/development/api/jsdocs/binning_WebMercatorTilePyramid.js.html
// https://stackoverflow.com/questions/1166059/how-can-i-get-latitude-longitude-from-x-y-on-a-mercator-map-jpeg

var EPSG_900913_SCALE_FACTOR = 20037508.342789244;
var EPSG_900913_LATITUDE = 85.05112878;
var DEGREES_TO_RADIANS = Math.PI / 180.0; // Factor for changing degrees to radians
var RADIANS_TO_DEGREES = 180.0 / Math.PI; // Factor for changing radians to degrees

let pi2deg = function(v) { return v*RADIANS_TO_DEGREES; }
let deg2pi = function(v) { return v*DEGREES_TO_RADIANS; }

/*
function sinh( arg ) {
  return (Math.exp(arg) - Math.exp(-arg)) / 2.0;
}

function gudermannian( y ) {
  // converts a y value from -PI(bottom) to PI(top) into the mercator projection latitude
  return Math.atan(sinh(y)) * RADIANS_TO_DEGREES;
}

function gudermannianInv( latitude ) {
  // converts a latitude value from -EPSG_900913_LATITUDE to EPSG_900913_LATITUDE into a y value from -PI(bottom) to PI(top)
  let sign = ( latitude !== 0 ) ? latitude / Math.abs(latitude) : 0;
  let sin = Math.sin(latitude * DEGREES_TO_RADIANS * sign);
  return sign * (Math.log((1.0 + sin) / (1.0 - sin)) / 2.0);
}

function gudermannianToLinear(value) {
  return (gudermannianInv( value ) / Math.PI) * EPSG_900913_LATITUDE;
}

function gudermannian_radians(arg) {
  return Math.atan(sinh(arg*2));
}
*/