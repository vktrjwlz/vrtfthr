// 2d geometry library for lazercut panel specification
// * specify pns (triangulated panels with optional holes)
// * render pns in browser with webgl
// * pack pns into jbs composed of a sht for each material
// * export shts as svg
var lzr = {};

// lzr ontology
// * pn -> one lazercut pane, optionally with voids
//   ~ bnd -> boundary loop
//   ~ vds -> (0-n) void loops
// * lp -> closed ring defined by a series of verts
// * vrt -> 2d position defined by vector
// * ly -> ley construction line between 2 nds
// * nd -> contruction node defined by vector

// ****************
// rndrr -> render mshs in browser using webgl
//
lzr.rndrr = function (cnvs) {
  var rndrr = this;
  rndrr.cnvs = cnvs; // canvas element
  rndrr.pxl_rtio = window.devicePixelRatio || 1;
  rndrr.mshs = []; // list of mesh objects to render

  // init gl context
  rndrr.gl = rndrr.cnvs.getContext("webgl");
  if (!rndrr.gl) {
    alert("couldnt initialize webgl :(");
    return;
  }

  // init shader program
  rndrr.shader = null;
  var vertexShader = lzr._getShader(
    rndrr.gl, rndrr.gl.VERTEX_SHADER, lzr._vertexShader);
  var fragmentShader = lzr._getShader(
    rndrr.gl, rndrr.gl.FRAGMENT_SHADER, lzr._fragmentShader);
  rndrr.shader = rndrr.gl.createProgram();
  rndrr.gl.attachShader(rndrr.shader, vertexShader);
  rndrr.gl.attachShader(rndrr.shader, fragmentShader);
  rndrr.gl.linkProgram(rndrr.shader);
  if (!rndrr.gl.getProgramParameter(rndrr.shader, rndrr.gl.LINK_STATUS)) {
    alert("couldnt initialize shaders :(");
    return;
  }
  rndrr.gl.useProgram(rndrr.shader);

  // set blend function for when alpha blending is enabled
  rndrr.gl.blendFuncSeparate(
    rndrr.gl.SRC_ALPHA, rndrr.gl.ONE_MINUS_SRC_ALPHA,
    rndrr.gl.ZERO, rndrr.gl.ONE );
  rndrr.gl.enable( rndrr.gl.BLEND );

  // get gl shader variables
  rndrr.sVars = {};
  rndrr.sVars.uResolution = rndrr.gl.getUniformLocation(
    rndrr.shader, "u_resolution" );
  rndrr.sVars.aPosition = rndrr.gl.getAttribLocation(
    rndrr.shader, "a_position" );
  rndrr.gl.enableVertexAttribArray( rndrr.sVars.aPosition );
  rndrr.sVars.aColor = rndrr.gl.getAttribLocation(
    rndrr.shader, "a_color" );
  rndrr.gl.enableVertexAttribArray( rndrr.sVars.aColor );

  rndrr.setResolution();
}

lzr.rndrr.prototype = {

  constructor: lzr.rndrr,

  px2gl: function (px) {
    var rndrr = this;
    return Math.floor(px * rndrr.pxl_rtio);
  },

  // set the gl context resolution to canvas resolution
  setResolution: function () {
    var rndrr = this;

    // Lookup the size the browser is displaying the canvas in CSS pixels
    // and compute a size needed to make our drawingbuffer match it in
    // device pixels.
    var displayWidth  = rndrr.px2gl( rndrr.gl.canvas.clientWidth );
    var displayHeight = rndrr.px2gl( rndrr.gl.canvas.clientHeight );

    // check if the canvas is not the same size
    if (rndrr.cnvs.width != displayWidth
        || rndrr.cnvs.height != displayHeight) {
      rndrr.cnvs.width  = displayWidth;
      rndrr.cnvs.height = displayHeight;
    }

    rndrr.gl.viewport(0, 0, rndrr.cnvs.width, rndrr.cnvs.height);

    rndrr.gl.uniform2f(
      rndrr.sVars.uResolution, rndrr.cnvs.width, rndrr.cnvs.height
    );
  },

  // loop thru mshs and rebuffer them
  buff: function () {
    var rndrr = this;
    for (var i = 0; i < rndrr.mshs.length; i++) {
      rndrr.mshs[i].buff(rndrr.gl);
    }
  },

  render: function () {
    var rndrr = this;
    rndrr.gl.clearColor( 1, 1, 1, 1 );
    rndrr.gl.clear( rndrr.gl.COLOR_BUFFER_BIT ); // clear the canvas

    // render each mesh
    for (var i = 0; i < rndrr.mshs.length; i++) {
      rndrr.mshs[i].render(rndrr.gl, rndrr.sVars);
    }
  }
}

lzr._getShader = function (gl, type, str) {
  var shader;
  shader = gl.createShader(type);

  gl.shaderSource(shader, str);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}

lzr._vertexShader =
  "attribute vec2 a_position;" +
  "attribute vec4 a_color;" +

  "uniform vec2 u_resolution;" +

  "varying vec4 v_color;" +

  "void main() {" +

     // convert the position from pixels to 0.0 to 1.0
  "  vec2 zeroToOne = a_position / u_resolution;" +

     // convert from 0->1 to 0->2
  "  vec2 zeroToTwo = zeroToOne * 2.0;" +

     // convert from 0->2 to -1->+1 (clipspace)
  "  vec2 clipSpace = zeroToTwo - 1.0;" +

  "  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);" +
  "  v_color = a_color;" +
  "}";

lzr._fragmentShader =
  "precision mediump float;" +

  "varying vec4 v_color;" +

  "void main() {" +
  "  gl_FragColor = v_color;" +
  "}";

// --rndrr
// ********

// ****************
// glbfr -> gl data buffer
//
lzr.glbfr = function () {
  var glbfr = this;
  glbfr.itemSize = 0;
  glbfr.numItems = 0;
  glbfr.glid = null;
}

lzr.glbfr.prototype = {

  constructor: lzr.glbfr,

  loadTriangles: function(gl, vertices, triangles) {
    var glbfr = this;
    glbfr.itemSize = 2;
    glbfr.numItems = triangles.length * 3;
    if (glbfr.glid === null) glbfr.glid = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, glbfr.positionBuff);
    var vs = [];
    for (var i = 0; i < triangles.length; i++) {
      for (var j = 0; j < 3; j++) {
        v = vertices[triangles[i][j]];
        vs.push( v[0] ); // vertex x
        vs.push( v[1] ); // vertex y
      }
    }

    gl.bindBuffer( gl.ARRAY_BUFFER, glbfr.glid );
    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(vs), gl.STATIC_DRAW );
    return true;
  },

  loadColor: function (gl, numItems, rgba) {
    var glbfr = this;
    if (rgba.length != 4) return false;
    glbfr.itemSize = 4;
    glbfr.numItems = numItems;
    if (glbfr.glid === null) glbfr.glid = gl.createBuffer();

    var cs = [];
    for (var i = 0; i < numItems; i++) {
      cs = cs.concat( rgba );
    }

    gl.bindBuffer( gl.ARRAY_BUFFER, glbfr.glid );
    gl.bufferData( gl.ARRAY_BUFFER, new Float32Array(cs), gl.STATIC_DRAW );
    return true;
  },

  point: function(gl, glAtt) {
    var glbfr = this;
    gl.bindBuffer(gl.ARRAY_BUFFER, glbfr.glid);
    gl.vertexAttribPointer( glAtt, glbfr.itemSize, gl.FLOAT, false, 0, 0 );

    return true;
  }
}
// --glbfr
// ********

// ****************
// msh -> triangle mesh to be rendered by webgl
//
lzr.msh = function () {
  var msh = this;
  msh.rgba = [0, 0, 0, 1];
  msh.vertices = []; // list of vec2s
  msh.triangles = []; // list of list of indices into vertices
  msh.colorBuff = new lzr.glbfr();
  msh.positionBuff = new lzr.glbfr();
}

lzr.msh.prototype = {

  constructor: lzr.msh,

  buff: function (gl) {
    var msh = this;

    // load triangle vertices into position buffer
    msh.positionBuff.loadTriangles( gl, msh.vertices, msh.triangles );

    // load color vertex for each triangle vertex in position buffer
    msh.colorBuff.loadColor( gl, msh.positionBuff.numItems, msh.rgba );
  },

  render: function (gl, sVars) {
    var msh = this;

    // set attribute pointers to position and color buffers
    msh.positionBuff.point(gl, sVars.aPosition);
    msh.colorBuff.point(gl, sVars.aColor);

    // render triangles
    gl.drawArrays(gl.TRIANGLES, 0, msh.positionBuff.numItems);
  }

}
// --msh
// ********

// ****************
// sg -> line segment built on gl-matrix vec2s for geometry calculations
//

// sg data held by float32array of size 4
// sg[0], sg[1] -> origin vec2
// sg[2], sg[3] -> delta vec2
lzr.sg = {}

lzr.sg.create = function () {
  var out = new glMatrix.ARRAY_TYPE(4);
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  return out;
}

lzr.sg.fromDelta = function (orig, dlta) {
  var out = new glMatrix.ARRAY_TYPE(4);
  out[0] = orig[0];
  out[1] = orig[1];
  out[2] = dlta[0];
  out[3] = dlta[1];
  return out;
}

lzr.sg.fromEnd = function (orig, end) {
  var out = new glMatrix.ARRAY_TYPE(4);
  var d = vec2.create();
  vec2.sub(d, end, orig);
  out[0] = orig[0];
  out[1] = orig[1];
  out[2] = d[0];
  out[3] = d[1];
  return out;
}

lzr.sg.clone = function (sg) {
  var out = new glMatrix.ARRAY_TYPE(4);
  out[0] = sg[0];
  out[1] = sg[1];
  out[2] = sg[2];
  out[3] = sg[3];
  return out;
}

lzr.sg.copy = function (out, sg) {
  out[0] = sg[0];
  out[1] = sg[1];
  out[2] = sg[2];
  out[3] = sg[3];
  return out;
}

lzr.sg.origin = function (ouv, sg) {
  ouv[0] = sg[0];
  ouv[1] = sg[1];
  return ouv;
}

lzr.sg.setOrigin = function (out, p) {
  out[0] = p[0];
  out[1] = p[1];
  return out;
}

lzr.sg.delta = function (ouv, sg) {
  ouv[0] = sg[2];
  ouv[1] = sg[3];
  return ouv;
}

lzr.sg.setDelta = function (out, p) {
  out[2] = p[0];
  out[3] = p[1];
  return out;
}

lzr.sg.end = function (ouv, sg) {
  var o = vec2.create();
  lzr.sg.origin( o, sg );
  var d = vec2.create();
  lzr.sg.delta( d, sg );
  vec2.add( ouv, o, d );
  return ouv;
}

lzr.sg.setEnd = function (out, p) {

  // get delta from origin of out to p end point vec2
  var o = vec2.create()
  var d = vec2.create();
  lzr.sg.origin( o, out );
  vec2.sub( d, p, o );

  // set delta component of out sgment
  out[2] = d[0];
  out[3] = d[1];
  return out;
}

lzr.sg.stringize = function (sg) {
  return "sg( (" + sg[0] + ", " + sg[1] + "), ("
                  + sg[2] + ", " + sg[3] + ") )";
}

lzr.sg.mag = function(sg) {
  return vec2.length(vec2.fromValues(sg[2], sg[3]));
}


// test whether given point is left of segment
lzr.sg.isLeft = function (sg, p) { // vec2 p
  var a = vec2.create();
  lzr.sg.origin( a, sg );
  var b = vec2.create();
  lzr.sg.end( b, sg );
  return (((b[0]-a[0])*(p[1]-a[1])) - ((b[1]-a[1])*(p[0]-a[0]))) < 0;
}

// return code for indicating region is touching, left or right of segment
// p -> center of region, r -> radius of region
// -1 -> error
// 0 -> region is to right of line
// 1 -> region is to left of line
// 2 -> region intersects line
lzr.sg.inRadius = function (sg, p, r) { // vec2 p, float r
  if (lzr.sg.distance(sg, p) < r) return 2;
  if (lzr.sg.isLeft(sg, p)) return 1;
  return 0;
}

// find the point at the intersection of two segments
lzr.sg.intersect = function (ouv, sga, sgb) { // lzr.seg sg

  // Ax + By = C
  // A = y2 - y1
  // B = x1 - x2
  // C = A*x1 + B*y1
  var s1 = vec2.create();
  lzr.sg.origin( s1, sga );
  var e1 = vec2.create();
  lzr.sg.end( e1, sga );
  var a1 = e1[1] - s1[1];
  var b1 = s1[0] - e1[0];
  var c1 = (a1 * s1[0]) + (b1 * s1[1]);
  var s2 = vec2.create();
  lzr.sg.origin( s2, sgb );
  var e2 = vec2.create();
  lzr.sg.end( e2, sgb );
  var a2 = e2[1] - s2[1];
  var b2 = s2[0] - e2[0];
  var c2 = (a2 * s2[0]) + (b2 * s2[1]);

  // if determinant is ~0 lines are parallel
  var det = (a1 * b2) - (a2 * b1);
  if (Math.abs(det) < lzr.EPSILON) return null;

  ouv[0] = ((b2 * c1) - (b1 * c2)) / det;
  ouv[1] = ((a1 * c2) - (a2 * c1)) / det;

  return ouv;
}

// set origin of out seg to intersection of seg sg and other seg o
lzr.sg.intersectOrigin = function (out, sga, sgb) {

  var p = vec2.create();
  lzr.sg.intersect( p, sga, sgb );

  if (p == null) return false;

  lzr.sg.setOrigin( out, p );

  return true;
}

// set origin and delta of out sg to intersections of sga & om and sg & on
lzr.sg.intersectInterval = function (out, sga, sgb, sgc) { // lzr.sg
  var p = vec2.create();
  lzr.sg.intersect(p, sga, sgb);
  var q = vec2.create();
  lzr.sg.intersect(q, sga, sgc);

  if (p === null || q === null) return false;

  // set origin
  lzr.sg.setOrigin( out, p );

  // set delta from p -> q
  lzr.sg.setEnd( out, q );

  return true;
}

// project vec2 p onto sg sg and set out vec2 ouv
lzr.sg.project = function (ouv, p, sg) { // vec2 ouv, p / lzr.sg sg
  var a = vec2.create();
  vec2.sub( a, p, lzr.sg.origin(sg) ); // a is vector from origin to p

  // project a onto delta vector
  var b = vec2.clone( lzr.sg.delta(sg) );
  vec2.normalize( b, b );
  vec2.scalar( b, vec2.dot(a, b) );

  // add vector b to origin to get new point projected onto sgment
  vec2.add( out, lzr.sg.origin(sg), b );
  return out;
}

// return distance from sg sg to vec2 p, orthogonal to sg
lzr.sg.distance = function (sg, p) { // vec2 p
  var a = vec2.create();
  lzr.sg.project( a, p, sg );
  vec2.sub( a, a, p );
  return vec2.length( a );
}

// reflect delta vec2 p across delta of sg sg and assign to vec2 ouv
lzr.sg.reflectDelta = function (ouv, p, sg) {
  var a = vec2.clone( lzr.sg.delta(sg) );
  vec2.normalize( a, a );
  vec2.scalar( a, vec2.dot(p, a) ); // a is p projected onto sg
  var b = vec2.create();
  vec2.sub( b, a, p ); // b is vector from p perp to sgment

  vec2.add(ouv, a, b); // a + b -> p mirrored across sgment
  return ouv;
}

// reflect sg sg across mirror sg msg and assign to sg out
lzr.sg.reflect = function (out, sg, msg) { // lzr.sg out, sg

    // get offset vectors to start and end of sgment from start of this sg
    var a = vec2.create();
    vec2.sub( a, lzr.sg.origin(sg), lzr.sg.origin(msg) );
    var b = vec2.create();
    vec2.sub( b, lzr.sg.end(sg), lzr.sg.origin(msg) );

    // reflect offset vectors across this segment
    lzr.sg.reflectDelta( a, a, sg );
    lzr.sg.reflectDelta( b, b, sg );

    // add to origin vector
    vec2.add( a, a, lzr.sg.origin(sg) );
    vec2.add( b, b, lzr.sg.origin(sg) );

    // set out sg origin and delta
    lzr.sg.setOrigin( out, a );
    lzr.sg.setEnd( out, b );

    return out;
  },

lzr.sg.offset = function (out, sg, n) { // float n

    // get orthogonal normalized delta vector and multiply by offset distance
    var nrml = vec2.create();
    lzr.sg.orthoNorm(nrml, sg);
    vec2.scale(nrml, nrml, n);

    // copy sg sg to out sg and offset out origin by offset vec2 a
    lzr.sg.copy(out, sg);
    var nwo = vec2.create();
    lzr.sg.origin(nwo, out);
    vec2.add(nwo, nrml, nwo);
    lzr.sg.setOrigin(out, nwo);
  },

lzr.sg.qRot = function (out, sg) { // calc quarter rotation of delta vec
  var dlta = vec2.create();
  lzr.sg.dlta( dlta, sg );
  lzr.sg.copy( out, sg );
  vec2.set( dlta, -dlta[1], dlta[0] ); // quarter rotation
  lzr.sg.setDelta( out, dlta );
}

lzr.sg.orthoNorm = function (nrml, sg) { // calc normal orthogonal to segment

  // generate normal from segment delta
  lzr.sg.delta(nrml, sg); // set normal to dlta component of segment
  vec2.normalize(nrml, nrml);
  lzr.v2.qRot(nrml, nrml);

  // if normal is to left of segment flip it
  var n = vec2.clone(nrml);
  var orig = vec2.create();
  lzr.sg.origin(orig, sg);
  vec2.add(n, n, orig);
  if (lzr.sg.isLeft(sg, n)) {
    lzr.v2.flip(nrml, nrml);
  }
}
// --sg
// ********

// ****************
// vect2 util funcs
lzr.EPSILON = 0.01
lzr.v2 = {}
lzr.v2.qRot = function (ouv, v) { // quarter rotation clockwise
  vec2.set(ouv, v[1], -v[0]);
}
lzr.v2.flip = function (ouv, v) { // flip vector
  vec2.set(ouv, -v[0], -v[1]);
}
lzr.v2.cmp = function (a, b) {
  var c = a[0] - b[0];
  if (Math.abs(c) > lzr.EPSILON) {
    return c;
  }
  c = a[1] - b[1];
  if (Math.abs(c) > lzr.EPSILON) {
    return c;
  }
  return 0;
}
// barycentric triangle interior test
// http://stackoverflow.com/questions/2049582/how-to-determine-if-a-point-is-in-a-2d-triangle
lzr.v2.in_triangle = function (v, a, b, c) {
    var s = a[1] * c[0] - a[0] * c[1] + (c[1] - a[1]) * v[0] + (a[0] - c[0]) * v[1];
    var t = a[0] * b[1] - a[1] * b[0] + (a[1] - b[1]) * v[0] + (b[0] - a[0]) * v[1];

    if ((s < 0) != (t < 0)) return false;

    var area = -b[1] * c[0] + a[1] * (c[0] - b[0]) + a[0] * (b[1] - c[1]) + b[0] * c[1];
    if (area < 0.0) {
        s = -s;
        t = -t;
        area = -area;
    }
    return s > 0 && t > 0 && (s + t) <= area;
}
// --util
// ********

// ****************
// ln -> line segment to be rendered with webgl

lzr.ln = function () {
  var ln = this;
  ln.rgba = [0, 0, 0, 1];
  ln.vertices = []; // list of vec2s
  ln.weight = 1.0;
  ln.colorBuff = new lzr.glbfr();
  ln.positionBuff = new lzr.glbfr();
}

lzr.ln.prototype = {

  constructor: lzr.ln,
  render: lzr.msh.prototype.render,

  buff: function (gl) {
    var ln = this;
    if (ln.vertices.length != 2) {
      console.log("twogl.line doesnt have 2 vertices!")
      return;
    }
    var wvs = []; // weighted vertices
    var wts = []; // weighted triangles

    // generate segment from vertices
    var sg = lzr.sg.fromEnd(ln.vertices[0], ln.vertices[1]);

    // TODO: end caps

    // offset a & b segments by weight / 2
    var sga = lzr.sg.create();
    lzr.sg.offset(sga, sg, ln.weight * 0.5);
    var sgb = lzr.sg.create();
    lzr.sg.offset(sgb, sg, ln.weight * -0.5);

    // build weighted vertices
    var wv = vec2.create();

    lzr.sg.origin(wv, sga);
    wvs.push(vec2.clone(wv));

    lzr.sg.origin(wv, sgb);
    wvs.push(vec2.clone(wv));

    lzr.sg.end(wv, sga);
    wvs.push(vec2.clone(wv));

    lzr.sg.end(wv, sgb);
    wvs.push(vec2.clone(wv));

    // build triangles
    wts = [ [0, 1, 2], [3, 2, 1] ];

    // write data to buffers
    ln.positionBuff.loadTriangles(gl, wvs, wts);
    ln.colorBuff.loadColor(gl, ln.positionBuff.numItems, ln.rgba);
  }
}
// --ln
// ********

// ****************
// rng -> ring to be rendered with webgl
lzr.rng = function () {
  var rng = this;
  rng.radius = 8.0;
  rng.center = vec2.fromValues(0.0, 0.0);
  rng.weight = 1.0;
  rng.rgba = [0, 0, 0, 1];
  rng.segments = 8;
  rng.colorBuff = new lzr.glbfr();
  rng.positionBuff = new lzr.glbfr();
}

lzr.rng.prototype = {

  constructor: lzr.rng,
  render: lzr.msh.prototype.render,

  buff: function (gl) {
    var rng = this;

    // generate vertices
    var wvs = [];
    var step = Math.PI * 2.0 / rng.segments;
    var radin = rng.radius - (rng.weight * 0.5);
    var radout = rng.radius + (rng.weight * 0.5);
    var d = vec2.create();
    var ds = vec2.create();
    for (var i = 0; i < rng.segments; i++) {
      d[0] = Math.cos(step * i);
      d[1] = Math.sin(step * i);

      // inside vertex
      vec2.scale(ds, d, radin);
      vec2.add(ds, ds, rng.center);
      wvs.push(vec2.clone(ds));

      // outside vertex
      vec2.scale(ds, d, radout);
      vec2.add(ds, ds, rng.center);
      wvs.push(vec2.clone(ds));
    }

    // generate triangles
    var wts = [];
    for (var i = 0; i < wvs.length - 2; i += 2) {
      wts.push( [i, i+1, i+2] );
      wts.push( [i+3, i+2, i+1] );
    }
    wts.push( [wvs.length-2, wvs.length-1, 0] );
    wts.push( [1, 0, wvs.length-1] );

    // write data to buffers
    rng.positionBuff.loadTriangles(gl, wvs, wts);
    rng.colorBuff.loadColor(gl, rng.positionBuff.numItems, rng.rgba);
  }
}
// --rng
// ********

// ****************
// pn -> a single lazercut pane, defined by a boundary loop & 0+ void loops
//
// bndry, vds, vrts,
//
lzr.pn = function () {
  var pn = this;
  pn.bndry = new lzr.lp();
  pn.vds = []; // list of loops sorted by min x value
  pn.rgba = [0, 0, 0, 1];
  pn.vertices = []; // list of vec2s
  pn.triangles = []; // list of list of indices into vertices
  pn.colorBuff = new lzr.glbfr();
  pn.positionBuff = new lzr.glbfr();
}

lzr.pn.prototype = {

  constructor: lzr.pn,

  render: lzr.msh.prototype.render,

  buff: function (gl) {
    var pn = this;

    // splice void loops into boundary loop to create vertex list
    pn.bndry.set_mnmx();
    var vs = pn.bndry.ordered_vrts(true); // ccw vrts for boundary
    if (pn.vds.length > 0) {
      pn.vds.sort(lzr.lp.cmp);
      for (var i = 0; i < pn.vds.length; i++) {
        lzr.pn._splice_void(vs, pn.vds[i]);
      }
    }

    // generate triangles by clipping ears
    dxs = [];
    trngls = [];
    for (i = 0; i < vs.length; i++) dxs.push(i);
    while (dxs.length > 3) {
      lzr.pn._clip_ear(trngls, vs, dxs);
    }
    trngls.push([dxs[0], dxs[1], dxs[2]]); // add final triangle

    // load triangle vertices into position buffer
    pn.vertices = vs;
    pn.triangles = trngls;
    pn.positionBuff.loadTriangles(gl, pn.vertices, pn.triangles);

    // load color vertex for each triangle vertex in position buffer
    pn.colorBuff.loadColor(gl, pn.positionBuff.numItems, pn.rgba);
  }
}

// TODO - change for algo that works generally
lzr.pn._splice_void = function (vs, lp) {
  if (lp.vrts.length <= 0) {
    console.log("cant splice empty void loop");
    return;
  }

  // get min void loop vertex
  lp.set_mnmx();
  var vv = lp.mn;

  // find closest boundary vertex
  var j = 0;
  var mndx = 0;
  var bv = vs[0];
  var mndlta = lzr.sg.mag(lzr.sg.fromEnd(bv, vv));
  while (j < vs.length - 1) {
    j++;
    bv = vs[j];
    var dlta = lzr.sg.mag(lzr.sg.fromEnd(bv, vv));
    if (dlta < mndlta) {
      mndlta = dlta;
      mndx = j;
    }
  }

  // splice cw loop vertices into list
  var vvs = lp.ordered_vrts(false);
  vvs.push(vv); // add entry void vertex at end again
  vvs.push(vs[mndx]); // add entry outer vertex again

  while (vvs.length > 0) {
    vs.splice(mndx + 1, 0, vvs.pop());
  }
}

// identify ear, add to triangles list & remove center node from dxs
lzr.pn._clip_ear = function (trngls, vs, dxs) {
  if (dxs.length < 4) {
    console.log("cant clip ear from fewer than 4 vertices");
    return;
  }

  // loop thru groups of 3 vertex indices until an ear is found
  for (var i = 0; i < dxs.length; i++) {
    var a = i - 2;
    if (a < 0) a = dxs.length + a;
    var b = i - 1;
    if (b < 0) b = dxs.length + b;
    var c = i;

    // ears must be convex, test assumes vertices a->b->c are ccw
    if (lzr.pn._is_convex(vs[dxs[a]], vs[dxs[b]], vs[dxs[c]])) {

      // test if any *other* vertices are inside convexity
      var inside = false;
      for (var j = 0; j < vs.length; j++) {
        var v = vs[j];
        if (v !== vs[a] && v !== vs[b] && v !== vs[c]) {
          if (lzr.v2.in_triangle(v, vs[dxs[a]], vs[dxs[b]], vs[dxs[c]])) {
            inside = true;
          }
        }
      }
      if (!inside) { // found an ear, clip it!!
        trngls.push([dxs[a], dxs[b], dxs[c]]); // add triangle to list
        dxs.splice(b, 1); // remove ear tip from vertex index list
        return; // topology of remaining vertex indices has changed, return!
      }
    }
  }
  console.log("failed to clip ear!");
}

// same as ccw/cw test except now we know a->b->c is ccw & want to see if its convex
lzr.pn._is_convex = function (a, b, c) {
  var det = ((b[0] - a[0]) * (c[1] - a[1])) - ((c[0] - a[0]) * (b[1] - a[1]));
  if (det < 0) return true;
  return false;
}
// --pn
// ********

// ****************
// lp -> loop of vertices
//
lzr.lp = function () {
  var lp = this;
  lp.mn = vec2.create();
  lp.mx = vec2.create();
  lp.mndx = 0;
  lp.vrts = [];
}

lzr.lp.prototype = {

  constructor: lzr.lp,

  set_mnmx: function () {
    var lp = this;

    // calculate new min & max
    lp.mn = lp.vrts[0];
    lp.mx = lp.vrts[0];
    lp.mndx = 0;
    for (var i = 1; i < lp.vrts.length; i++) {
      var vi = lp.vrts[i];
      if (lzr.v2.cmp(vi, lp.mn) < 0) {
        lp.mn = vi;
        lp.mndx = i;
      }
      if (lzr.v2.cmp(vi, lp.mx) > 0) {
        lp.mx = vi;
      }
    }
  },

  // return list of vertices in ccw (or cw) order
  ordered_vrts: function (ccw) {
    var lp = this;
    if (lp.vrts.length < 2) {
      return lp.vrts.slice();
    }

    var vs = [];
    var i = lp.mndx;
    while (vs.length < lp.vrts.length - 1) {
      i++;
      if (i >= lp.vrts.length) i = 0;
      vs.push(lp.vrts[i]);
    }

    // unless loop is ccw & thats what was requested, reverse vertices
    if (lp.is_ccw() !== ccw) {
      vs.reverse();
    }

    // add min vertex to beginning & return list
    vs.unshift(lp.mn);
    return vs;
  },

  // https://en.wikipedia.org/wiki/Curve_orientation#Orientation_of_a_simple_polygon
  is_ccw: function () {
    var lp = this;
    if (lp.vrts.length < 3) return false;
    var dx = lp.mndx - 1;
    if (dx < 0) dx = lp.vrts.length - 1;
    var a = lp.vrts[dx];
    dx++;
    if (dx >= lp.vrts.length) dx = 0;
    var b = lp.vrts[dx];
    dx++;
    if (dx >= lp.vrts.length) dx = 0;
    var c = lp.vrts[dx];
    var det = ((b[0] - a[0]) * (c[1] - a[1])) - ((c[0] - a[0]) * (b[1] - a[1]));
    if (det < 0) return true;
    return false;
  }
}

lzr.lp.cmp = function(a, b) {
  return lzr.v2.cmp(a.mn, b.mn);
}
// --lp
// ********
