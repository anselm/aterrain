## aframe-aterrain-component

[![Version](http://img.shields.io/npm/v/aframe-aterrain-component.svg?style=flat-square)](https://npmjs.org/package/aframe-aterrain-component)
[![License](http://img.shields.io/npm/l/aframe-aterrain-component.svg?style=flat-square)](https://npmjs.org/package/aframe-aterrain-component)

A 3d geographic rendering component for AFrame that uses Cesium data.

For [A-Frame](https://aframe.io).

### Examples

Here's an example of rendering a specific piece of the world at street level. In this case at the Coquetta Cafe on the Embarcadero in San Francisco with 3d buildings. In this example the world scale is set to 1:1 and the lighting and z-buffering are all stressed to their limits due to the numerical scales used. (It's more practical to set a smaller radius for the planet).

<a href="https://anselm.github.io/aterrain/examples/sanfrancisco"> <img alt="sanfrancisco" target="_blank" src="https://github.com/anselm/aterrain/blob/master/examples/assets/sanfrancisco.png?raw=true" width="660"></a>

Here is an example of using ATerrain as a globe renderer. In this example aterrain is observing the camera and adjusting what it shows dynamically so that the viewer sees that part of the earth at ever increasing levels of detail. If you zoom into San Francisco you will see buildings. If you want a general globe renderer it's probably better to use Cesium since it has specialized features for rendering globes.

<a href="https://anselm.github.io/aterrain/examples/helloworld">
  <img alt="hello world" target="_blank" src="https://github.com/anselm/aterrain/blob/master/examples/assets/helloworld.png?raw=true" width="660">
</a>

Here is an example of the full globe dropped into the basic demo scene. Unfortunately it's not possible to render the entire globe at any level of detail, but you could have it watch the camera and as you got close enough to the globe it could update that portion of the display. But since camera movement is linear through space and zooming into the earths surface is logarithmic this would not provide the kind of level of detail you want. Another option would be to perhaps render the entire globe at some intermediate level of detail - such as at a level of depth 4 or 5 - this is more data but it would allow a static globe that you could get fairly close to.

<a href="https://anselm.github.io/aterrain/examples/hellowebvr_globe">
  <img alt="hello world" target="_blank" src="https://github.com/anselm/aterrain/blob/master/examples/assets/hellowebvr_globe.png?raw=true" width="660">
</a>

Here is an example of the Grand Canyon.

<a href="https://anselm.github.io/aterrain/examples/grandcanyon">
  <img alt="hello world" target="_blank" src="https://github.com/anselm/aterrain/blob/master/examples/assets/grandcanyon.png?raw=true" width="660">
</a>

### API

| Property | Description | Default Value |
| -------- | ----------- | ------------- |
| lat      | latitude    | 0             |
| lon      | longitude   | 0             |
| radius   | planet size | 1000          |
| elevation| for lod     | 100000000     |
| fovpad   | extra tiles | 0             |
| observer | camera      |               |

Specify the latitude and longitude where you would like to see detail on the surface of the globe. This is where tiles will be generated. The elevation is used to estimate the level of detail, and this in turn dictates which layer of the tile pyramid will be used. A very small elevation would generate tiles that are very high resolution - and thus cover only a very small part of the earths surface. Fov padding can be used to force fetch some extra tiles (for example you may wish to render the entire world at a high resolution - so you could pick a lower elevation and pad it out with some extra tiles). If you specify an observer then the engine will automatically compute the latitude, longitude and elevation from the observers position in space relative to the globe. If you don't specify an observer then you need to set the latitude and longitude yourself - for example if you have a street level view of a city that you're interested in, but you also want to walk around in that city - then you have to update the position to fetch tiles so that you don't walk off the edge of visible tile space.

### Installation

#### Browser

Use in the browser with an html document like so:

```html
<script src="https://aframe.io/releases/0.7.1/aframe.min.js"></script>
<script src="../js/aframe-orbit-controls-component.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/webpack-cesium/1.37.0/webpack.cesium.js"></script>
<script src="../../dist/aframe-aterrain-component.js"></script>
<a-scene>
<a-entity a-terrain="follow:0; fovpad:2; latitude:37; longitude:-122; radius:1000; elevation:580000"></a-entity>
<a-entity id="camera" camera="fov:45" mouse-cursor position="0 0 5000"></a-entity>
</a-scene>
```

Or to [see a single tile on demand](https://anselm.github.io/aterrain/examples/helloworld/tile.html):

```html
<a-box id="target" width="10" height="10" depth="100"></a-box>
<a-entity id="camera" camera="fov:45" mouse-cursor position="0 0 700"></a-entity>
```

#### npm

Install via npm:

```bash
npm install aframe-aterrain-component
```

Then require and use.

```js
require('aframe');
require('aframe-aterrain-component');
```

#### Design and Technology

This engine is built on top of Cesium and is focused on an on-the-ground walking around experience as opposed to a view-the-globe experience. Typically in a cartographic rendering component a developer has three kinds of uses. There's a space-to-face kind of view where you can see the whole globe and zoom in. There's a birds-eye street maps style navigation view like Google Maps. There's an on-the-ground walking around kind of view. This engine is focused on that last case. It can be used as a globe renderer but Cesium is better at that and there's no point in reproducing Cesium itself. For an on-the-ground view it's important that shaders not be used for generating geometry - we want geometry to be collidable in game - and that the engine be able to produce small slices of the world accurately.

I'm using a few specific pieces of Cesium (with support from the Cesium team for this work). Cesium is an excellent javascript 3d globe renderer but has slightly different goals from this engine. See [Cesium Nasa Mars Trek](https://marstrek.jpl.nasa.gov/). For a technical perspective on the features of Cesium see [Cesium Presentation](https://cesium.com/presentations) and [3D Engine Design for Virtual Globes](https://www.virtualglobebook.com/). For a deeper technical overview see [Under The Hood Of Virtual Globes](https://www.virtualglobebook.com/Under_the_Hood_of_Virtual_Globes.pdf). I only using the lowest level components - here's a quick sketch of that framework and dependencies:

  - Cesium Navigation Controls (aterrain doesn't use these nav controls)
  - Cesium Geography
    - TerrainProvider (aterrain uses this piece to fetch elevation data)
    - ImageryProvider (aterrain can use this or go directly to a raw provider)
    - 3d tiles (aterrain uses this piece to fetch and paint 3d buildings)
  - Cesium Scene (aterrain doesn't use any of the cesium scene graph support or any shaders at all)
    - Scene, Camera, SkyBox, SkyAtmosphere, 
    - Material, Color
    - Globe, Geometry, Polylines, Primitives, Billboards, Label
    - Shaders
  - Cesium Math (aterrain uses some of the math services)
    - Frustrum
    - Bounding Boxes and Spheres
    - Cartographic number
    - Cartesian number
    - Matrix3 / Matrix4
    - Ellipsoid concept
    - Map Projection

### Remaining areas for improvement (April 22 2018)

  - There's a street level view that is automatically enabled if no camera is set as a target for a-terrain; more options here would be nice.
  - It's pretty easy to replace the Cesium zig-zag terrain decoder and in which case the entire engine would be more portable
  - There's a lot of small cleanup, marked with TODO 
  - Since ES6 is supported in browser - a compile step could be made optional
  - I have a 'stretch' attribute which should also be applied to camera position (or else camera can go under the ground)
  - The ground elevation could also be used better for helping camera from going under ground (it's not really used at all)
  - All data urls should be pushed up to the aterrain variables rather than buried in Image or Terrain components
  - There's a list of other bugs on the github
  - a-buildings should not be attached to a-tiles but should also be optionally totally independent so they can show up at lower levels of detail
  - It would be handy to elaborate on a-location nodes (which are undocumented but let you place things on the planet).
  - I have no way of knowing if a-buildings are found or not on the server - so it throws spurious 404's - there should be a management system

