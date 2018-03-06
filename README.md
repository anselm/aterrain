# ATerrain

Allows rendering of a globe or parts of a globe with elevation, images and buildings relying heavily on Cesium to accomplish all this.

## Examples

Need
 - a hello world example of a globe [done]
 - an example of viewing a single tile [tricky because the camera has to be placed or the tile placed]
 - an example of placing a thing in the world at a place
 - an example of multiple players

Although ATerrain isn't meant to be used as a globe renderer (because much more work would be required) it does have some support for globe rendering. Here's an example of that.

<a href="https://anselm.github.io/aterrain/public/helloworld.html">
  <img alt="helloworld" target="_blank" src="https://github.com/anselm/aterrain/blob/master/public/assets/helloworld.png?raw=true" width="660">
</a>

The primary expected use case is rendering bits and pieces of the world at will. We have data available only for San Francisco right now, and here is an example of that:

<a href="https://anselm.github.io/aterrain/public/sanfrancisco.html">
  <img alt="sanfrancisco" target="_blank" src="https://github.com/anselm/aterrain/blob/master/public/assets/sanfrancisco.png?raw=true" width="660">
</a>

Here is an example of using this tool as a simple multiplayer experience. Pick a name for yourself with the ?name=yourname parameter and it will give you an unique avatar on the globe. ( to run this you have to enable mixed http/https traffic since github serves the content with https and my own server which hosts the network does not - see <a href="https://kb.iu.edu/d/bdny">Allowing mixed content</a> and <a href="https://stackoverflow.com/questions/18321032/how-to-get-chrome-to-allow-mixed-content">https://stackoverflow.com/questions/18321032/how-to-get-chrome-to-allow-mixed-content</a>):

<a href="https://anselm.github.io/aterrain/public/game.html?name=yourname">
  <img alt="multiplayer" target="_blank" src="https://github.com/anselm/aterrain/blob/master/public/assets/game.png?raw=true" width="660">
</a>

## Features

  - produce the whole earth or pieces of the earth with elevation, imagery and buildings on demand
  - intended to work with <a href="http://github.com/aframevr">AFrame</a> to allow declarative embedding of cartographic data in html
  - leverages Cesium for most of the heavy lifting (although there is a bit of work in the wrapper itself)
  - avoids the use of custom shaders - geometries can be used for collision detection
  - navigation controls
  - open source

## Usage

```html
<html>
<head>
<script src="https://aframe.io/releases/0.7.1/aframe.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/webpack-cesium/1.37.0/webpack.cesium.js"></script>
<script src="js/aterrain/GLTFLoader.js"></script>
<script src="js/aterrain/math.js"></script>
<script src="js/aterrain/imageserver.js"></script>
<script src="js/aterrain/tileserver.js"></script>
<script src="js/aterrain/aterrain.js"></script>
<style>
body { background:#f0e0e0; overflow:hidden;}
</style>
</head>
<body>

<a-scene cursor="rayOrigin: mouse">
  <a-entity id="hello world" visible="true"
                a-terrain="lat:45.557749; lon:-122.6794; radius:1000; elevation:263727982"
                a-terrain-controls="lat:45.557749; lon:-122.6794; radius:1000; elevation:263727982"
                >
  </a-entity>
  <a-entity id="camera" camera="fov:45" mouse-cursor position="0 0 0"></a-entity>
</a-scene>

</body>
</html>
```

## Design approach currently chosen for connecting **Cesium** to **ThreeJS and AFrame**

### Goals

Design choices here include:

- a desire to avoid re-inventing the wheel.
- a desire to allow remixing and reuse; where Cesium geometry can be collided against game object.
- be ok with failing to do all the fancy stuff that Cesium does
- focus more at street level rather than globe views

In general a globe renderer often uses a tile based approach to render the planet surface. There is a pyramid of tiles at different resolutions that represent the terrain elevation and separately the images that are draped on the tiles. There are also 3d-tiles to represent buildings. A rendered view consists of fetching the visible sources at a given longitude, latitude and elevation from the ground and compositing them all together into a plausible view.

In the case of this engine it is possible to render a full globe - but the goal is more to be able to render a small piece of the earth. The use cases imagined are more focused on "near field" interactions, collisions, mixing in other aframe components, allowing activities such as exploring a city landscape on foot, or mixed reality use cases such as holding up a tablet (or wearing augmented reality glasses) and seeing a virtual world superimposed on the real world.

### Cesium

Cesium is a best of breed Virtual Globe with a javascript implementation. The work is complex and precise, and represents years of labor. For example see [Cesium Nasa Mars Trek](https://marstrek.jpl.nasa.gov/). For a technical perspective on the features of this globe viewer see [Cesium Presentation](https://cesium.com/presentations) and [3D Engine Design for Virtual Globes](https://www.virtualglobebook.com/). For a quick overview of concerns that affect even the implementation of this wrapper see [Under The Hood Of Virtual Globes](https://www.virtualglobebook.com/Under_the_Hood_of_Virtual_Globes.pdf).

The architecture of Cesium (at a high level and skipping many details) can be seen as something like so:

  - Cesium Navigation Controls
  - Cesium Geography
    - TerrainProvider
    - ImageryProvider
    - 3d tiles (buildings)
  - Cesium Scene
    - Scene, Camera, SkyBox, SkyAtmosphere, 
    - Material, Color
    - Globe, Geometry, Polylines, Primitives, Billboards, Label
    - Shaders
  - Cesium Math
    - Frustrum
    - Bounding Boxes and Spheres
    - Cartographic number
    - Cartesian number
    - Matrix3 / Matrix4
    - Ellipsoid concept
    - Map Projection

### ThreeJS

Cesium implements a high level 3d game engine in order to render the views to WebGL. That role collides with ThreeJS. Depending on a programmers expertise it isn't that hard to repurpose raw tile data, but it makes quick lightweight tests and projects less likely. The goal is to use the geographic powers of Cesium but switching to ThreeJS for WebGL bindings and Math.

### Current Choices

The approach currently looks something like this architecturally:

  - A-TERRAIN Navigation Controls ...
    - implements a visible tile strategy (what tiles can be seen at what elevation)
  - A-TERRAIN ... produces tiles on demand for a full globe coverage
    - A-LL ... an object placed on the globe
    - A-TILE ... a single tile of the globe
      - 
      - TileServer
        - Cesium TileProvider
        - Currently produce terrain tiles by hand into 3js
        - ** Currently this allows only spherical projection. It should allow flat and WGS84 **
        - ** Currently this does a reverse mercator or gudermannian distortion in vertex space to accomodate mercator projected image sources **
      - ImageServer
        - Cesium ImageProvider
        - ** Currently these images are in mercator and they should be converted to WGS84 using WASM **
  - AFrame
  - ThreeJS
  - WebGL

## Areas for improvement ##

A-TERRAIN in its current incarnation is a poor globe view. It allows zooming and panning to showcase the ability to produce a globe. However it lacks all of the features of Cesium and there are unresolved issues with respect to Camera zdepth (near/far) and suchlike. As well to some degree this wrapper does more work than it should - and there is an ongoing effort to find ideal cleaving points between the two engines to see if this work can be reduced. With the help of Cesium there may also be some collaboration to push some of the features here to Cesium and thus reduce the weight on this engine. One key factor is that Cesium does much of the reprojection work with shaders, and there is a goal here to avoid shaders.


