A multiplayer game built on top of a-terrain

map bugs:

1) Gudermannian implementation needs more thought.
   Right now it can be turned off and on with a parameter such as http://localhost:8000/?name=asdf&guder=1
   The problem is that it's being computed in vertex space... and that means the tiles are not all equal size.
   As well the Cesium Image Provider has some tension with directly warping the tiles - it's not clear... right now Bing is being used directly.

   https://en.wikipedia.org/wiki/Mercator_projection#Small_element_geometry -> https://en.wikipedia.org/wiki/Web_Mercator
   https://en.wikipedia.org/wiki/Gudermannian_function
   http://aperturetiles.com/docs/development/api/jsdocs/binning_WebMercatorTilePyramid.js.html
   https://stackoverflow.com/questions/1166059/how-can-i-get-latitude-longitude-from-x-y-on-a-mercator-map-jpeg
   https://msdn.microsoft.com/en-us/library/bb259689.aspx describes how pixels map to latitude and longitude
   https://github.com/AnalyticalGraphicsInc/cesium/blob/master/Source/Scene/ImageryLayer.js#L1026 discusses how cesium does it
   https://github.com/AnalyticalGraphicsInc/cesium/blob/master/Source/Core/Ellipsoid.js#L85
   https://github.com/AnalyticalGraphicsInc/cesium/blob/master/Source/Core/Ellipsoid.js#L386
 
   "For Mercator, check out Slide 39-43 of Rendering the Whole Wide World on the World Wide Web for some background and reprojectToGeographic() in ImageryLayer.js for how Cesium currently does it.  Note that you only have to reproject once, not per frame, and over the long-term, we can push this server-side.  I seem to recall that deep in the tree, e.g., level 16+, Mercator basically becomes WGS84 and that Cesium stops reprojecting – we did this at one point, but I don’t know if we stayed with it.

    For vertex transform precision, Cesium’s implementation is in:

         EncodedCartesian3.js
         translateRelativeToEye.glsl

2) Precise building placement relies on something a bit fancier math right now - there's an implementation for doubles that needs to be done.
   Or else this needs to be delegated to Cesium.

   "You shouldn’t have to rotate or place the origin at the southwest corner of the buildings. After talking with Shehzan, the center of the buildings should be the center of the tile. The reason you’re seeing misalignment is that Cesium renders these relative-to-center (RTC). There is a Cesium specific glTF extension for this. RTC is a technique for rendering with improved precision and prevents jitter. You can read more about the different rendering methods here. http://help.agi.com/AGIComponentsJava/html/BlogPrecisionsPrecisions.htm
   Is there a way you can modify the model-view-projection matrix of threejs?"

3) Tile visibility. Tile visibility strategy still appears to be imperfect. Need to fiddle with what is in the camera fov better.

4) Tile Image corruption. Sometimes some of the images seem wrong or broken - especially around the poles.
   Right now we're munging tiles from Bing and it would be better to have a server with image tiles that match terrain tiles.
   Another option would be to change the tile scheme to match the Bing image scheme.

5) Keep old mip map levels around until new ones are fully loaded.

6) Camera ZDepth. May want to adjust this based on zoom.
   Right now the world is 1000 units always. By default near is 0.5 and far is 10000.
   At near scale we would prefer the units be 1:1 where one meter = 1 unit.
   To do this it would be nice to be able to use a scale multipler on the world rather than stretching the tiles -> test

game todo:

 - Camera system.

	- we need a much nicer camera system for moving around
	- put camera on surface at any lod
	- let a player navigate easily
	- switch between an overview and a zoomed in camera mode


  - finish websocket support; it's breaking http traffic? why?
