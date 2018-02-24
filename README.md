A multiplayer game built on top of a-terrain

map related issues:

	- tile visibility bug - strategy broken in some way occasionally - especially around the poles
	- image draping bug - some of the image draping seems wrong especially around the poles - needs careful study
	- in the html i am initalizing both subsystems, the terrain and the game from different strings... should only set lat lon once

	- camera zdepth near/far may wish to be based on the zoom level? although it does seem "ok" at the moment - may make sense to scale up to 1:1
	- buildings and suchlike should only be fetched for a specific lod and perhaps area as well

	- move camera rather than earth
		- also build controllers to have fine grained motion on earth surface ( walking, turning head ) and tie into third party tools

	- the image draping strategy is wrongish; primarily at far field

  - using the ellipsoid representation of the surface rather than spherical:

    https://msdn.microsoft.com/en-us/library/bb259689.aspx describes how pixels map to latitude and longitude
    as well https://github.com/AnalyticalGraphicsInc/cesium/blob/master/Source/Scene/ImageryLayer.js#L1026 discusses how cesium does it
    basically i think that the image needs to be printed as a curve to the surface rather than linear distribution as a function of curvature of tile
    this calculation is
	   sinLatitude = sin(latitude * pi/180)
	   pixelX = ((longitude + 180) / 360) * 256 * 2level
	   pixelY = (0.5 – log((1 + sinLatitude) / (1 – sinLatitude)) / (4 * pi)) * 256 * 2level

  - should leave old tiles up until new tiles appear

  - should have more aggressive culling of older tiles

game related:

  - finish websocket support; it's breaking http traffic? why?
