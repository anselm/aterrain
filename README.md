## aframe-aterrain-component

[![Version](http://img.shields.io/npm/v/aframe-aterrain-component.svg?style=flat-square)](https://npmjs.org/package/aframe-aterrain-component)
[![License](http://img.shields.io/npm/l/aframe-aterrain-component.svg?style=flat-square)](https://npmjs.org/package/aframe-aterrain-component)

A 3d geographic rendering component for AFrame that uses Cesium data.

For [A-Frame](https://aframe.io).

### Examples

The primary use case of this component is on-the-ground street level rendering of pieces of the world. Here is an example of San Francisco:

<a href="https://anselm.github.io/aterrain/examples/sanfrancisco.html"> <img alt="sanfrancisco" target="_blank" src="https://github.com/anselm/aterrain/blob/master/examples/assets/sanfrancisco.png?raw=true" width="660"></a>

Here is an example of using ATerrain as a globe renderer (although you will probably prefer to use Cesium if you want to do this):

<a href="https://anselm.github.io/aterrain/examples/helloworld.html">
  <img alt="hello world" target="_blank" src="https://github.com/anselm/aterrain/blob/master/examples/assets/helloworld.png?raw=true" width="660">
</a>

### API

| Property | Description | Default Value |
| -------- | ----------- | ------------- |
| lat      | latitude    | 0             |
| lon      | longitude   | 0             |
| radius   | planet size | 1000          |

### Installation

#### Browser

Install and use by directly including the [browser files](dist):

```html
<head>
  <title>My A-Frame Scene</title>
  <script src="https://aframe.io/releases/0.6.0/aframe.min.js"></script>
  <script src="https://unpkg.com/aframe-aterrain-component/dist/aframe-aterrain-component.min.js"></script>
</head>

<body>
  <a-scene cursor="rayOrigin: mouse">
    <a-entity a-terrain="lat:45.557749; lon:-122.6794; radius:1000; elevation:263727982"></a-entity>
  </a-scene>
  <a-entity id="camera" camera="fov:45" mouse-cursor position="0 0 0"></a-entity>
</body>
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
    - ImageryProvider (aterrain this piece to fetch images to drape on elevation data)
    - 3d tiles (aterrain uses this piece to fetch and paint 3d buildings)
  - Cesium Scene (aterrain doesn't use any of the cesium scene graph support or any custom shaders or any shaders at all)
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
