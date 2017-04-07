// 2d geometry library for lazercut panel specification
// * specify pns (triangulated panels with optional holes)
// * render pns in browser with webgl
// * pack pns into jbs composed of a sht for each material
// * export shts as svg
var lzr = {}; // init lzr namespace

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
  rndrr.zoom = vec2.fromValues(1.0, 1.0);

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
  rndrr.sVars.uZoom = rndrr.gl.getUniformLocation(
    rndrr.shader, "u_zoom" );
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
      rndrr.sVars.uZoom, rndrr.zoom[0], rndrr.zoom[1]
    );

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

  "uniform vec2 u_zoom;" +
  "uniform vec2 u_resolution;" +

  "varying vec4 v_color;" +

  "void main() {" +

    // apply zoom factor
  "  vec2 zoomed = a_position * u_zoom;" +

     // convert the position from pixels to 0.0 to 1.0
  "  vec2 zeroToOne = zoomed / u_resolution;" +

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

lzr.sg.from_dlta = function (orig, dlta) {
  var out = new glMatrix.ARRAY_TYPE(4);
  out[0] = orig[0];
  out[1] = orig[1];
  out[2] = dlta[0];
  out[3] = dlta[1];
  return out;
}

lzr.sg.from_end = function (orig, end) {
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

lzr.sg.orgn = function (ouv, sg) {
  ouv[0] = sg[0];
  ouv[1] = sg[1];
  return ouv;
}

lzr.sg.set_orgn = function (out, p) {
  out[0] = p[0];
  out[1] = p[1];
  return out;
}

lzr.sg.dlta = function (ouv, sg) {
  ouv[0] = sg[2];
  ouv[1] = sg[3];
  return ouv;
}

lzr.sg.set_dlta = function (out, p) {
  out[2] = p[0];
  out[3] = p[1];
  return out;
}

lzr.sg.end = function (ouv, sg) {
  var o = vec2.create();
  lzr.sg.orgn( o, sg );
  var d = vec2.create();
  lzr.sg.dlta( d, sg );
  vec2.add( ouv, o, d );
  return ouv;
}

lzr.sg.set_end = function (out, p) {

  // get delta from origin of out to p end point vec2
  var o = vec2.create()
  var d = vec2.create();
  lzr.sg.orgn( o, out );
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

lzr.sg.mag = function (sg) {
  return vec2.length(vec2.fromValues(sg[2], sg[3]));
}

lzr.sg.mnx = function (sg) {
  if (sg[2] < 0) return sg[0] + sg[2];
  return sg[0];
}
lzr.sg.mxx = function (sg) {
  if (sg[2] > 0) return sg[0] + sg[2];
  return sg[0];
}
lzr.sg.mny = function (sg) {
  if (sg[3] < 0) return sg[1] + sg[3];
  return sg[1];
}
lzr.sg.mxy = function (sg) {
  if (sg[3] > 0) return sg[1] + sg[3];
  return sg[1];
}

// calculate angle from segment to vertex (with origin as root)
lzr.sg.angle_to = function (sg, vrt) {
  var orgn = vec2.create();
  lzr.sg.orgn(orgn, sg);
  var v1 = vec2.create();
  lzr.sg.dlta(v1, sg);
  var v2 = vec2.create();
  vec2.sub(v2, vrt, orgn);
  return Math.acos( vec2.dot(v1, v2) / (vec2.length(v1)*vec2.length(v2)) );
}

// test whether given point is left of segment
lzr.sg.is_left = function (sg, p) { // vec2 p
  var a = vec2.create();
  lzr.sg.orgn( a, sg );
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
  if (lzr.sg.is_left(sg, p)) return 1;
  return 0;
}

// find the point at the intersection of two segments
lzr.sg.intersect = function (ouv, sga, sgb) { // lzr.seg sg

  // Ax + By = C
  // A = y2 - y1
  // B = x1 - x2
  // C = A*x1 + B*y1
  var s1 = vec2.create();
  lzr.sg.orgn( s1, sga );
  var e1 = vec2.create();
  lzr.sg.end( e1, sga );
  var a1 = e1[1] - s1[1];
  var b1 = s1[0] - e1[0];
  var c1 = (a1 * s1[0]) + (b1 * s1[1]);
  var s2 = vec2.create();
  lzr.sg.orgn( s2, sgb );
  var e2 = vec2.create();
  lzr.sg.end( e2, sgb );
  var a2 = e2[1] - s2[1];
  var b2 = s2[0] - e2[0];
  var c2 = (a2 * s2[0]) + (b2 * s2[1]);

  // if determinant is ~0 lines are parallel
  var det = (a1 * b2) - (a2 * b1);
  if (Math.abs(det) < lzr.EPSILON) return false;

  ouv[0] = ((b2 * c1) - (b1 * c2)) / det;
  ouv[1] = ((a1 * c2) - (a2 * c1)) / det;

  return true;
}

// set origin of out seg to intersection of seg sg and other seg o
lzr.sg.intersect_orgn = function (out, sga, sgb) {

  var p = vec2.create();
  lzr.sg.intersect( p, sga, sgb );

  if (p == null) return false;

  lzr.sg.set_orgn( out, p );

  return true;
}

// set origin and delta of out sg to intersections of sga & om and sg & on
lzr.sg.intersect_intrvl = function (out, sga, sgb, sgc) { // lzr.sg
  var p = vec2.create();
  lzr.sg.intersect(p, sga, sgb);
  var q = vec2.create();
  lzr.sg.intersect(q, sga, sgc);

  if (p === null || q === null) return false;

  // set origin
  lzr.sg.set_orgn( out, p );

  // set delta from p -> q
  lzr.sg.set_end( out, q );

  return true;
}

// project vec2 p onto sg sg and set out vec2 ouv
lzr.sg.project = function (ouv, p, sg) { // vec2 ouv, p / lzr.sg sg

  var a = vec2.create();
  var orgn = vec2.create();
  lzr.sg.orgn(orgn, sg);
  vec2.sub(a, p, orgn); // a is vector from origin to p

  // project a onto delta vector
  var b = vec2.create();
  lzr.sg.dlta(b, sg);
  vec2.normalize(b, b);
  vec2.scale(b, b, vec2.dot(a, b));

  // add vector b to origin to get new point projected onto sgment
  vec2.add(ouv, orgn, b);
  return ouv;
}

// return distance from sg sg to vec2 p, orthogonal to sg
lzr.sg.distance = function (sg, p) { // vec2 p
  var a = vec2.create();
  lzr.sg.project( a, p, sg );
  vec2.sub( a, a, p );
  return vec2.length( a );
}

// reflect delta vec2 p across delta of sg sg and assign to vec2 ouv
lzr.sg.reflect_dlta = function (ouv, p, sg) {
  var a = vec2.clone( lzr.sg.dlta(sg) );
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
    vec2.sub( a, lzr.sg.orgn(sg), lzr.sg.orgn(msg) );
    var b = vec2.create();
    vec2.sub( b, lzr.sg.end(sg), lzr.sg.orgn(msg) );

    // reflect offset vectors across this segment
    lzr.sg.reflect_dlta( a, a, sg );
    lzr.sg.reflect_dlta( b, b, sg );

    // add to origin vector
    vec2.add( a, a, lzr.sg.orgn(sg) );
    vec2.add( b, b, lzr.sg.orgn(sg) );

    // set out sg origin and delta
    lzr.sg.set_orgn( out, a );
    lzr.sg.set_end( out, b );

    return out;
  },

lzr.sg.offset = function (out, sg, n) { // float n

    // get orthogonal normalized delta vector and multiply by offset distance
    var nrml = vec2.create();
    lzr.sg.ortho_nrml(nrml, sg);
    vec2.scale(nrml, nrml, n);

    // copy sg sg to out sg and offset out origin by offset vec2 a
    lzr.sg.copy(out, sg);
    var nwo = vec2.create();
    lzr.sg.orgn(nwo, out);
    vec2.add(nwo, nrml, nwo);
    lzr.sg.set_orgn(out, nwo);
  },

lzr.sg.qrot = function (out, sg) { // calc quarter rotation of delta vec
  var dlta = vec2.create();
  lzr.sg.dlta( dlta, sg );
  lzr.sg.copy( out, sg );
  vec2.set( dlta, -dlta[1], dlta[0] ); // quarter rotation
  lzr.sg.set_dlta( out, dlta );
}

lzr.sg.ortho_nrml = function (nrml, sg) { // calc normal orthogonal to segment

  // generate normal from segment delta
  lzr.sg.dlta(nrml, sg); // set normal to dlta component of segment
  vec2.normalize(nrml, nrml);
  lzr.v2.qrot(nrml, nrml);

  // if normal is to left of segment flip it
  var n = vec2.clone(nrml);
  var orig = vec2.create();
  lzr.sg.orgn(orig, sg);
  vec2.add(n, n, orig);
  if (lzr.sg.is_left(sg, n)) {
    lzr.v2.flip(nrml, nrml);
  }
}
// --sg
// ********

// ****************
// vect2 util funcs
lzr.EPSILON = 0.001
lzr.v2 = {}
lzr.v2.qrot = function (ouv, v) { // quarter rotation clockwise
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
lzr.v2.eq = function (a, b) {
  if (lzr.v2.cmp(a, b) === 0) return true;
  return false;
}
lzr.v2.lst_mn = function (lst) {
  if (lst.length < 1) return null;

  var mnv = lst[0];
  for (var i = 1; i < lst.length; i++) {
    if (lzr.v2.cmp(mnv, lst[i]) > 0) {
      mnv = lst[i];
    }
  }
  return mnv;
}
lzr.v2.lst_contains = function (lst, v) {
  for (var i = 0; i < lst.length; i++) {
    if (lzr.v2.cmp(lst[i], v) === 0) return true;
  }
  return false;
}
// remove first instance of vector from list and return index
lzr.v2.lst_remove = function (lst, v) {
  for (var i = 0; i < lst.length; i++) {
    if (lzr.v2.cmp(lst[i], v) === 0) {
      lst.splice(i, 1);
      return i;
    }
  }
  return -1;
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
    var sg = lzr.sg.from_end(ln.vertices[0], ln.vertices[1]);

    // TODO: end caps

    // offset a & b segments by weight / 2
    var sga = lzr.sg.create();
    lzr.sg.offset(sga, sg, ln.weight * 0.5);
    var sgb = lzr.sg.create();
    lzr.sg.offset(sgb, sg, ln.weight * -0.5);

    // build weighted vertices
    var wv = vec2.create();

    lzr.sg.orgn(wv, sga);
    wvs.push(vec2.clone(wv));

    lzr.sg.orgn(wv, sgb);
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
  pn.rgba = [0.7, 0, 0, 0.7]; // reddish
  pn.vd_rgba = [0.7, 0.7, 1.0, 0.7]; // whitish
  pn.vrts = null; // list of vec2s
  pn.trngls = null; // list of list of indices into vertices
  pn.colorBuff = new lzr.glbfr();
  pn.positionBuff = new lzr.glbfr();
}

lzr.pn.prototype = {

  constructor: lzr.pn,

  render: function (gl, sVars) {
    var pn = this;

    // set attribute pointers to position and color buffers for boundary loop
    pn.bndry.positionBuff.point(gl, sVars.aPosition);
    pn.bndry.colorBuff.point(gl, sVars.aColor);

    // render triangles
    gl.drawArrays(gl.TRIANGLES, 0, pn.bndry.positionBuff.numItems);

    for (var i = 0; i < pn.vds.length; i++) {
      // set attribute pointers to position and color buffers for boundary loop
      pn.vds[i].positionBuff.point(gl, sVars.aPosition);
      pn.vds[i].colorBuff.point(gl, sVars.aColor);

      // render triangles
      gl.drawArrays(gl.TRIANGLES, 0, pn.vds[i].positionBuff.numItems);
    }
  },

  buff: function (gl) {
    var pn = this;
    if (pn.bndry.vrts.length < 3) return;

    pn.bndry.rgba = pn.rgba;
    pn.bndry.buff(gl);
    for (var i = 0; i < pn.vds.length; i++) {
      pn.vds[i].rgba = pn.vd_rgba;
      pn.vds[i].buff(gl);
    }
  },

  // generate dxf file from this pn
  // http://paulbourke.net/dataformats/dxf/min3d.html
  dxffy: function (mx, scl) {
    var pn = this;

    var dxf = [ // array of string lines of dxf file

      // header
      "999", "dxf created from lzr.js",
      "0", "SECTION",
      "2", "HEADER",
        "9", "$ACADVER",
          "1", "AC1006",
        "9", "$INSUNITS",
          "70", "4",
        "9", "$INSBASE",
          "10", "0.0",
          "20", "0.0",
          "30", "0.0",
        "9", "$EXTMIN",
          "10", "0.0",
          "20", "0.0",
        "9", "$EXTMAX",
          "10", mx[0] * scl[0],
          "20", mx[1] * scl[1],
      "0", "ENDSEC",

      // tables
      "0", "SECTION",
      "2", "TABLES",
        "0", "TABLE",
        "2", "LTYPE",
          "70", "1",
          "0", "LTYPE",
          "2", "CONTINUOUS",
          "70", "64",
          "3", "Solid line",
          "72", "65",
          "73", "0",
          "40", "0.000000",
        "0", "ENDTAB",
        "0", "TABLE",
        "2", "LAYER",
          "70", "6",
          "0", "LAYER",
          "2", "bndry",
            "70", "64",
            "62", "7",
            "6", "CONTINUOUS",
          "0", "LAYER",
          "2", "vds",
            "70", "64",
            "62", "7",
            "6", "CONTINUOUS",
        "0", "ENDTAB",
        "0", "TABLE",
          "2", "STYLE",
          "70", "0",
        "0", "ENDTAB",
      "0", "ENDSEC",

      // blocks (empty)
      "0", "SECTION",
      "2", "BLOCKS",
      "0", "ENDSEC",

      // entities (opening)
      "0", "SECTION",
      "2", "ENTITIES",
    ];

    // write polyline for boundary loop
    dxf.push(
      "0", "LWPOLYLINE",
      "8", "bndry",
      "62", "7");
    for (var i = 0; i < pn.bndry.vrts.length; i++) {
      var v = pn.bndry.vrts[i];

      dxf.push(
        "10", v[0] * scl[0],
        "20", v[1] * scl[1],
        "30", "0.0");
    }
    // close loop
    dxf.push(
      "10", pn.bndry.vrts[0][0] * scl[0],
      "20", pn.bndry.vrts[0][1] * scl[1],
      "30", "0.0");

    // write polyline for each void loop
    for (var i = 0; i < pn.vds.length; i++) {
      dxf.push(
        "0", "LWPOLYLINE",
        "8", "vds",
        "62", "7");
      for (var j = 0; j < pn.vds[i].vrts.length; j++) {
        var v = pn.vds[i].vrts[j];
        dxf.push(
          "10", v[0] * scl[0],
          "20", v[1] * scl[1],
          "30", "0.0");
      }
      dxf.push(
        "10", pn.vds[i].vrts[0][0] * scl[0],
        "20", pn.vds[i].vrts[0][1] * scl[1],
        "30", "0.0");
    }

    // end dxf file
    dxf.push(
      "0", "ENDSEC", // end entities section
      "0", "EOF", "" // end file with newline
    );

    return dxf;
  }
}

// splice void loop into boundary vertices list
lzr.pn._splice_void = function (vs, lp) {
  if (lp.vrts.length <= 0) {
    console.log("cant splice empty void loop");
    return;
  }

  console.log("splicing " + lp.vrts + " into " + vs);

  // get min void loop vertex
  var vvdx = lp.get_mn();
  if (vvdx < 0) {
    console.log("failed to get min dx for loop " + lp);
    return false;
  }
  var vv = lp.vrts[vvdx];

  // get segment from min void loop vertex to boundary min x value
  var mnbv = lzr.v2.lst_mn(vs);
  var isg = lzr.sg.from_end(vv, vec2.fromValues(mnbv[0], vv[1]));

  console.log("isg " + lzr.sg.stringize(isg));

  // check if segment intersects any boundary vertices
  for (var i = 0; i < vs.length; i++) {
    var iv = vs[i];
    if (iv[0] < vv[0]) { // check that iv is left of vv
      if (Math.abs(iv[1] - vv[1]) < lzr.EPSILON) { // iv intersects! splice here

        // splice cw loop vertices into list
        var vvs = lp.ordered_vrts(false);
        while (vvs[0] !== vv) {
          vvs.push(vvs.shift());
        }
        vvs.push(vv); // add entry void vertex at end again
        vvs.push(iv); // add entry outer vertex again

        while (vvs.length > 0) {
          vs.splice(i + 1, 0, vvs.pop());
        }
        return true;
      }
    }
  }

  // check if segment intersects boundary segments
  var scts = []; // track potential intersections
  for (var i = 0; i < vs.length; i++) {
    var j = i + 1;
    if (j >= vs.length) j = 0;

    console.log("checking segment from " + vs[i] + " to " + vs[j]);

    // check that at least one end of segment is left of void vertex
    if (vs[i][0] < vv[0] || vs[j][0] < vv[0]) {

      console.log("seg is left of void vertex");

      // intersect segments
      var bsg = lzr.sg.from_end(vs[i], vs[j]);
      var sv = vec2.create();
      if (lzr.sg.intersect(sv, bsg, isg)) {

        console.log("segments intersect at " + sv);

        // check if intersection falls in bsgs y interval
        if (lzr.sg.mny(bsg) < sv[1] && sv[1] < lzr.sg.mxy(bsg)) {

          console.log("intersection falls within y interval!");

          // add to potential intersection list
          var sct = {};
          sct.i = i;
          sct.j = j;
          sct.sv = sv;
          sct.bsg = bsg;
          scts.push(sct);
        }
      }
    }
  }

  // find intersection with max x value
  if (scts.length > 0) {
    var mxx = scts[0].sv[0];
    var mxsct = scts[0];
    for (var i = 1; i < scts.length; i++) {
      var nx = scts[i].sv[0];
      if (nx > mxx) { // we want first intersection in a tie?
        mxx = nx;
        mxsct = scts[i];
      }
    }
    var sv = mxsct.sv;
    var i = mxsct.i;
    var j = mxsct.j;
    var bsg = mxsct.bsg;

    // set iv to max x vertex of bsg
    var iv = vec2.create();
    var idx = i;
    lzr.sg.orgn(iv, bsg);
    if (bsg[2] > 0) {
      lzr.sg.end(iv, bsg);
      idx = j;
    }

    // generate intersection triangle & assure it is ccw
    var itrngl = new lzr.trngl([vv, sv, iv], 0, 1, 2);
    itrngl.ccwize();

    // check whether any other boundary vertices are in itrngl
    var bdxs = [];
    for (var k = 0; k < vs.length; k++) {
      if (k !== idx && itrngl.contains(vs[k])) bdxs.push(k);
    }

    // if no boundary vertices found in itrngl splice at idx
    if (bdxs.length === 0) {

      console.log("no intersecting vertices! adding");

      // splice cw loop vertices into list
      var vvs = lp.ordered_vrts(false);
      while (vvs[0] !== vv) {
        vvs.push(vvs.shift());
      }
      vvs.push(vv); // add entry void vertex at end again
      vvs.push(iv); // add entry outer vertex again

      while (vvs.length > 0) {
        vs.splice(idx + 1, 0, vvs.pop());
      }
      return true;
    }

    console.log("found intersecting vertices: " + bdxs)

    // find vertex from bdxs with lowest angle from isg
    var xvdx = bdxs[0];
    var mnangl = lzr.sg.angle_to(isg, vs[xvdx]);
    for (var k = 1; k < bdxs.length; k++) {
      var dx = bdxs[k];
      var angl = lzr.sg.angle_to(isg, vs[dx]);
      if (angl <= mnangl) { // we want last vertex in a tie
        mnangl = angl;
        xvdx = dx;
      }
    }

    // splice at xvdx
    var vvs = lp.ordered_vrts(false);
    while (vvs[0] !== vv) {
      vvs.push(vvs.shift());
    }
    vvs.push(vv); // add entry void vertex at end again
    vvs.push(vs[xvdx]); // add entry outer vertex again

    while (vvs.length > 0) {
      vs.splice(xvdx + 1, 0, vvs.pop());
    }
    return true;
  }

  console.log("failed to splice void loop " + lp.vrts + " into " + vs);
  return false;
}

// identify ear, add to triangles list & remove center node from dxs
lzr.pn._clip_ear = function (trngls, vs, dxs) {
  if (dxs.length < 4) {
    console.log("cant clip ear from fewer than 4 vertices");
    return false;
  }

  // console.log("clipping ear from " + dxs.length + " dxs " + dxs);
  // console.log("from " + vs.length + " vertices " + vs);

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
        if (v !== vs[dxs[a]] && v !== vs[dxs[b]] && v !== vs[dxs[c]]) {
          var trngl = new lzr.trngl(vs, dxs[a], dxs[b], dxs[c]);
          if (trngl.contains(v)) {
            inside = true;
          }
        }
      }
      if (!inside) { // found an ear, clip it!!
        trngls.push([dxs[a], dxs[b], dxs[c]]); // add triangle to list
        // console.log("clipped ear " + [a, b, c] + " " + [dxs[a], dxs[b], dxs[c]] + " " + [vs[dxs[a]], vs[dxs[b]], vs[dxs[c]]]);
        dxs.splice(b, 1); // remove ear tip from vertex index list
        return true; // topology of remaining vertex indices has changed, return!
      }
    }
  }
  console.log("failed to clip ear!");
  return false;
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
  lp.vrts = [];
  lp.trngls = null;
  lp.rgba = [0, 0, 0, 1];
  lp.colorBuff = new lzr.glbfr();
  lp.positionBuff = new lzr.glbfr();
  lp.clipfail = false;
}

lzr.lp.prototype = {

  constructor: lzr.lp,

  get_mn: function (mn) {
    var lp = this;

    if (lp.vrts.length < 1) return -1;

    // calculate new min & max
    var mndx = 0;
    if (!mn) mn = vec2.create();
    vec2.copy(mn, lp.vrts[0]);
    for (var i = 1; i < lp.vrts.length; i++) {
      var v = lp.vrts[i];
      if (lzr.v2.cmp(v, mn) < 0) {
        vec2.copy(mn, v);
        mndx = i;
      }
    }
    return mndx;
  },

  get_mx: function (mx) {
    var lp = this;

    if (lp.vrts.length < 1) return -1;

    // calculate new min & max
    var mxdx = 0;
    if (!mx) mx = vec2.create();
    vec2.copy(mx, lp.vrts[0]);
    for (var i = 1; i < lp.vrts.length; i++) {
      var v = lp.vrts[i];
      if (lzr.v2.cmp(v, mx) > 0) {
        vec2.copy(mx, v);
        mxdx = i;
      }
    }
    return mxdx;
  },

  offset: function (s) {
    var lp = this;
    if (lp.vrts.length < 3) return false;

    // get ccw vertices list
    var ovrts = lp.ordered_vrts(true);

    // generate segments of polygon & offset
    var sgs = [];
    for (var i = 0; i < ovrts.length; i++) {
      var j = i - 1;
      if (j < 0) j = ovrts.length - 1;
      var sg = lzr.sg.from_end(ovrts[j], ovrts[i]);
      lzr.sg.offset(sg, sg, s);
      sgs.push(sg);
    }

    // intersect segment origins with previous segment & set triangle vertices
    for (i = 0; i < ovrts.length; i++) {
      var j = i - 1;
      if (j < 0) j = ovrts.length - 1;
      lzr.sg.intersect(ovrts[i], sgs[i], sgs[j]);
    }

    return true;
  },

  // return list of vertices in ccw (or cw) order
  ordered_vrts: function (ccw) {
    var lp = this;
    if (lp.vrts.length < 2) {
      return lp.vrts.slice();
    }

    var vs = lp.vrts.slice();

    // unless loop is ccw & thats what was requested, reverse vertices
    if (lp.is_ccw() !== ccw) vs.reverse();
    return vs;
  },

  // https://en.wikipedia.org/wiki/Curve_orientation#Orientation_of_a_simple_polygon
  is_ccw: function () {
    var lp = this;
    if (lp.vrts.length < 3) return false;

    // get min vertex & preceding & following vertices
    // min vertex of polygon is always convex
    var dx = lp.get_mn() - 1;
    if (dx < 0) dx = lp.vrts.length - 1;
    var a = lp.vrts[dx];
    dx++;
    if (dx >= lp.vrts.length) dx = 0;
    var b = lp.vrts[dx];
    dx++;
    if (dx >= lp.vrts.length) dx = 0;
    var c = lp.vrts[dx];

    // calculate determinant
    var det = ((b[0] - a[0]) * (c[1] - a[1])) - ((c[0] - a[0]) * (b[1] - a[1]));
    if (det < 0) return true;
    return false;
  },

  buff: function (gl) {
    var lp = this;

    var vs = lp.ordered_vrts(true)
    var dxs = [];
    var trngls = [];
    for (i = 0; i < vs.length; i++) dxs.push(i);
    lp.clipfail = false;
    while (dxs.length > 3 && !lp.clipfail) {
      if (!lzr.pn._clip_ear(trngls, vs, dxs)) lp.clipfail = true;
    }
    trngls.push([dxs[0], dxs[1], dxs[2]]); // add final triangle

    // load triangle buffer
    lp.positionBuff.loadTriangles(gl, vs, trngls);

    // load color vertex for each triangle vertex in position buffer
    lp.colorBuff.loadColor(gl, lp.positionBuff.numItems, lp.rgba);
  }
}

lzr.lp.cmp = function(a, b) {
  var amn = vec2.create();
  if (a.get_mn(amn) < 0) return -1;
  var bmn = vec2.create();
  if (b.get_mn(bmn) < 0) return 1;
  return lzr.v2.cmp(amn, bmn);
}
// --lp
// ********

// ****************
// trngl -> triangle geometry as indices into shared vertex list
//
lzr.trngl = function (vrts, a, b, c) {
  var trngl = this;
  trngl.vrts = vrts;
  trngl.dxs = [ a, b, c ];
  trngl.rgba = [0, 0, 1, 0.3];
  trngl.colorBuff = new lzr.glbfr();
  trngl.positionBuff = new lzr.glbfr();

  trngl.ccwize();
}

lzr.trngl.prototype = {

  constructor: lzr.trngl,

  render: lzr.msh.prototype.render,

  toString: function () {
    var trngl = this;
    return "trngl( " + trngl.dxs[0].toString() + "<"
                     + trngl.vrts[trngl.dxs[0]].toString() + ">, "
                     + trngl.dxs[1].toString() + "<"
                     + trngl.vrts[trngl.dxs[1]].toString() + ">, "
                     + trngl.dxs[2].toString() + "<"
                     + trngl.vrts[trngl.dxs[2]].toString() + "> )";
  },

  cmp: function (otrngl) {
    var trngl = this;
    for (var i = 0; i < 3; i++) {
      var d = lzr.v2.cmp(trngl.vrts[trngl.dxs[i]], otrngl.vrts[otrngl.dxs[i]]);
      if (d !== 0) return d;
    }
    return 0;
  },

  clone: function () {
    var trngl = this;

    var ovrts = [];
    for (var i = 0; i < 3; i++) {
      ovrts.push(vec2.clone(trngl.vrts[trngl.dxs[i]]));
    }

    return new lzr.trngl(ovrts, 0, 1, 2);
  },

  is_ccw: function () {
    var trngl = this;
    if (trngl.dxs.length !== 3) return false;

    var a = trngl.vrts[trngl.dxs[0]];
    var b = trngl.vrts[trngl.dxs[1]];
    var c = trngl.vrts[trngl.dxs[2]];

    // calculate determinant
    if (((b[0] - a[0]) * (c[1] - a[1])) - ((c[0] - a[0]) * (b[1] - a[1])) > 0)
      return false;

    return true;
  },

  ccwize: function () {
    var trngl = this;
    if (trngl.dxs.length !== 3) return false;

    // if not ccw flop second 2 nodes
    if (!trngl.is_ccw()) {
      var tmp_dx = trngl.dxs[1];
      trngl.dxs[1] = trngl.dxs[2];
      trngl.dxs[2] = tmp_dx;
    }
    return true;
  },

  // set position of passed vector to geometric center of triangle
  get_center: function (ouv) {
    var trngl = this;

    vec2.add(ouv, trngl.vrts[trngl.dxs[0]], trngl.vrts[trngl.dxs[1]]);
    vec2.add(ouv, ouv, trngl.vrts[trngl.dxs[2]]);
    vec2.scale(ouv, ouv, 1.0/3.0);
  },

  // calculate min breadth from vertex normal to opposite edge
  mn_brdth: function () {
    var trngl = this;

    var vrt =  trngl.vrts[trngl.dxs[0]];
    var osg = lzr.sg.from_end(trngl.vrts[trngl.dxs[1]], trngl.vrts[trngl.dxs[2]]);

    var mnbrdth = lzr.sg.distance(osg, vrt);
    for (var i = 1; i < 3; i++) {
      vrt = trngl.vrts[trngl.dxs[i]];
      var j = i + 1;
      if (j > 2) j = 0;
      var k = j + 1;
      if (k > 2) k = 0;
      osg = lzr.sg.from_end(trngl.vrts[trngl.dxs[j]], trngl.vrts[trngl.dxs[k]]);
      var brdth = lzr.sg.distance(osg, vrt);

      if (brdth < mnbrdth) mnbrdth = brdth;
    }

    return mnbrdth;
  },

  get_angle: function (vdxdx) { // takes index of vertex index [0-2]
    var trngl = this;

    // get triangle vertices, with b as angle vertex
    var ax = vdxdx - 1;
    if (ax < 0) ax = 2;
    var a = trngl.vrts[trngl.dxs[ax]];
    var b = trngl.vrts[trngl.dxs[vdxdx]];
    var cx = vdxdx + 1;
    if (cx > 2) cx = 0;
    var c = trngl.vrts[trngl.dxs[cx]];


    // get vectors from angle vertex b to vertices a & c
    var v1 = vec2.create();
    vec2.sub(v1, a, b);
    var v2 = vec2.create();
    vec2.sub(v2, c, b);

    // calculate angle from vector dot product
    var angle = Math.acos(vec2.dot(v1, v2) / (vec2.length(v1)*vec2.length(v2)));

    // console.log("angle between vertices " + [a, b, c].join(" | ") + " is " + angle);

    return angle;
  },

  // barycentric triangle interior test
  // http://stackoverflow.com/questions/2049582/how-to-determine-if-a-point-is-in-a-2d-triangle
  contains: function (vrt) {
    var trngl = this;
    if (trngl.dxs.length !== 3) return false;

    var a = trngl.vrts[trngl.dxs[0]];
    var b = trngl.vrts[trngl.dxs[1]];
    var c = trngl.vrts[trngl.dxs[2]];

    var s = a[1] * c[0] - a[0] * c[1] + (c[1] - a[1]) * vrt[0] + (a[0] - c[0]) * vrt[1];
    var t = a[0] * b[1] - a[1] * b[0] + (a[1] - b[1]) * vrt[0] + (b[0] - a[0]) * vrt[1];

    if ((s < 0) != (t < 0)) return false;

    var area = -b[1] * c[0] + a[1] * (c[0] - b[0]) + a[0] * (b[1] - c[1]) + b[0] * c[1];
    if (area < 0.0) {
        s = -s;
        t = -t;
        area = -area;
    }
    return s > 0 && t > 0 && (s + t) <= area;
  },

  // split triangle into 3 triangles at vertex index
  // assumes triangle contains vertex
  split:  function (dx) {
    var trngl = this;
    if (trngl.dxs.length !== 3) {
      console.log("cant split triangle without 3 vertices! " + trngl);
      return [];
    }
    var p = trngl.dxs[0];
    var q = trngl.dxs[1];
    var r = trngl.dxs[2];

    // break this triangle into 3 new triangles using the added
    // vertex index as the common vertex between all three
    return [
      new lzr.trngl(trngl.vrts, dx, p, q),
      new lzr.trngl(trngl.vrts, dx, q, r),
      new lzr.trngl(trngl.vrts, dx, r, p),
    ];
  },

  get_crcl: function () {
    var trngl = this;
    if (trngl.dxs.length !== 3) return null;

    var crcl = new lzr.crcl();
    if (!crcl.set(
        trngl.vrts[trngl.dxs[0]],
        trngl.vrts[trngl.dxs[1]],
        trngl.vrts[trngl.dxs[2]])) {
      console.log("failed to set circle from triangle " + trngl);
      return null;
    }
    return crcl;
  },

  crcl_contains: function (vrt) {
    var trngl = this;
    var crcl = trngl.get_crcl();

    if (crcl === null) {
      console.log("failed to get circle for triangle!");
      console.log(trngl);
      return false;
    }

    return crcl.contains(vrt);
  },

  // return new triangle with edges offset parallel to current triangle edges
  offset: function (s) {
    var trngl = this;
    if (trngl.dxs.length !== 3) return null;

    // clone indexed vertices into new vertex list
    var nwvrts = [];
    for (var i = 0; i < 3; i++)
      nwvrts.push(vec2.clone(trngl.vrts[trngl.dxs[i]]));

    var nwt = new lzr.trngl(nwvrts, 0, 1, 2);

    // generate segments of triangle & offset
    var sgs = [];
    for (var i = 0; i < 3; i++) {
      var j = i - 1;
      if (j < 0) j = 2;
      var sg = lzr.sg.from_end(nwt.vrts[j], nwt.vrts[i]);
      lzr.sg.offset(sg, sg, s);
      sgs.push(sg);
    }

    // intersect segment origins with previous segment & set triangle vertices
    for (i = 0; i < 3; i++) {
      var j = i - 1;
      if (j < 0) j = 2;
      lzr.sg.intersect(nwt.vrts[i], sgs[i], sgs[j]);
    }

    return nwt;
  },

  buff: function (gl) {
    var trngl = this;

    if (trngl.dxs.length != 3) {
      console.log("lzr.trngl doesnt have 3 vertices!")
      return;
    }

    // build triangles
    var ts = [ trngl.dxs ];

    // write data to buffers
    trngl.positionBuff.loadTriangles( gl, trngl.vrts, ts );
    trngl.colorBuff.loadColor( gl, trngl.positionBuff.numItems, trngl.rgba );
  }
}
// --trngl
// ********

// ****************
// crcl -> circle geometry
//
lzr.crcl = function () {
  this.cntr = null;
  this.rad = null;
}

lzr.crcl.prototype = {

  constructor: lzr.crcl,

  toString: function () {
    var crcl = this;

    return "crcl( (" + crcl.cntr[0] + " " + crcl.cntr[1] + ") " + crcl.rad + " )";
  },

  // set circle from 3 points of a triangle
  // https://gist.github.com/mutoo/5617691
  set: function (a, b, c) {
    var crcl = this;

    var ax = a[0],
        ay = a[1],
        bx = b[0],
        by = b[1],
        cx = c[0],
        cy = c[1],
        fabsy1y2 = Math.abs(ay - by),
        fabsy2y3 = Math.abs(by - cy),
        xc, yc, m1, m2, mx1, mx2, my1, my2, dx, dy;

    /* Check for coincident points */
    if(fabsy1y2 < lzr.EPSILON && fabsy2y3 < lzr.EPSILON) {
      console.log("Eek! Coincident points! " + [a, b, c]);
      return false;
    }

    if(fabsy1y2 < lzr.EPSILON) {
      m2  = -((cx - bx) / (cy - by));
      mx2 = (bx + cx) / 2.0;
      my2 = (by + cy) / 2.0;
      xc  = (bx + ax) / 2.0;
      yc  = m2 * (xc - mx2) + my2;
    }

    else if(fabsy2y3 < lzr.EPSILON) {
      m1  = -((bx - ax) / (by - ay));
      mx1 = (ax + bx) / 2.0;
      my1 = (ay + by) / 2.0;
      xc  = (cx + bx) / 2.0;
      yc  = m1 * (xc - mx1) + my1;
    }

    else {
      m1  = -((bx - ax) / (by - ay));
      m2  = -((cx - bx) / (cy - by));
      mx1 = (ax + bx) / 2.0;
      mx2 = (bx + cx) / 2.0;
      my1 = (ay + by) / 2.0;
      my2 = (by + cy) / 2.0;
      xc  = (m1 * mx1 - m2 * mx2 + my2 - my1) / (m1 - m2);
      yc  = (fabsy1y2 > fabsy2y3) ?
      m1 * (xc - mx1) + my1 :
      m2 * (xc - mx2) + my2;
    }

    dx = bx - xc;
    dy = by - yc;

    crcl.cntr = vec2.fromValues(xc, yc);
    crcl.rad = Math.sqrt((dx * dx) + (dy * dy));

    return true;
  },

  // test if vertex falls inside of circle
  contains: function (vrt) {
    var crcl = this;

    if (crcl.cntr === null || crcl.rad === null) {
      console.log("cant check containment for uninitialized circle");
      return false;
    }
    return vec2.dist(crcl.cntr, vrt) < (crcl.rad + lzr.EPSILON);
  }
}
// --crcl
// ********


// ****************
// dlny -> generate delaunay triangulation over a set of vertices
//
lzr.dlny = function () {
  var dlny = this;
  dlny.mn = null; // min coord vector
  dlny.mx = null; // max coord vector
  dlny.omgs = null; // omega vertices containing all other vertices
  dlny.vrts = [];
  dlny.trngls = null;
}

lzr.dlny.prototype = {

  constructor: lzr.dlny,

  // find closest vertex to given vertex
  get_closest: function (vrt) {
    var dlny = this;

    // check that there are more than omega vertices
    if (dlny.vrts.length < 1) return null;

    var mn_vrt = dlny.vrts[0];
    var mn_dlta = vec2.dist(vrt, mn_vrt);
    for (var i = 1; i < dlny.vrts.length; i++) {
      var nxt_vrt = dlny.vrts[i];
      var nxt_dlta = vec2.dist(vrt, nxt_vrt);
      if (nxt_dlta < mn_dlta) {
        mn_vrt = nxt_vrt;
        mn_dlta = nxt_dlta;
      }
    }
    return mn_vrt;
  },

  // assumes triangle shares vertex list with dlny
  get_adjacent: function (trngl, vdx) {
    var dlny = this;

    var match = trngl.dxs.slice();

    // find index of vertex index & remove from match indices
    var dxdx = match.indexOf(vdx);
    if (dxdx < 0) {
      console.log("couldnt find adjacent: vertex not in triangle!");
      return null;
    }
    match.splice(dxdx, 1);

    var p = match.pop();
    var q = match.pop();

    for (var i = 0; i < dlny.trngls.length; i++) {
      var otrngl = dlny.trngls[i];
      if (trngl !== otrngl
          && otrngl.dxs.indexOf(p) >= 0
          && otrngl.dxs.indexOf(q) >= 0)
        return otrngl;
    }

    // no adjacent and opposite triangle
    return null;
  },

  // return triangle containing vertex
  get_containing_trngl: function (vrt) {
    var dlny = this;

    for (var i =0; i < dlny.trngls.length; i++) {
      var t = dlny.trngls[i];
      if (t.contains(vrt)) {
        return t;
      }
    }
    return null;
  },

  //
  validate_edge: function (trngl, vdx) {
    var dlny = this;
    var adj = dlny.get_adjacent(trngl, vdx);

    if (adj === null) return false;

    // adjacent branch shouldnt be in circumscribed circle
    var crcl = adj.get_crcl();
    if (adj.crcl_contains(dlny.vrts[vdx])) {

      // flip the adjacent edge and revalidate the two new faces
      if (!lzr.dlny.flip_trngls(adj, trngl)) {
        console.log( "failed to flip!" );
        return false;
      }
      dlny.validate_edge(trngl, vdx);
      dlny.validate_edge(adj, vdx);
    }
    return true;
  },

  triangulate: function () {
    var dlny = this;

    if (dlny.vrts.length < 3) return;

    // generate omegas from mn & mx coords
    dlny.mn = vec2.clone(dlny.vrts[0]);
    dlny.mx = vec2.clone(dlny.vrts[0]);
    for (var i = 1; i < dlny.vrts.length; i++) {
      var v = dlny.vrts[i];
      if (v[0] < dlny.mn[0]) dlny.mn[0] = v[0];
      if (v[1] < dlny.mn[1]) dlny.mn[1] = v[1];
      if (v[0] > dlny.mx[0]) dlny.mx[0] = v[0];
      if (v[1] > dlny.mx[1]) dlny.mx[1] = v[1];
    }
    dlny.mn[0] -= 1000.0;
    dlny.mn[1] -= 1000.0;
    dlny.mx[0] += 1000.0;
    dlny.mx[1] += 1000.0;
    dlny.omgs = [
      dlny.mn,
      vec2.fromValues(dlny.mn[0], dlny.mx[1]),
      dlny.mx,
      vec2.fromValues(dlny.mx[0], dlny.mn[1])
    ];

    // console.log("mn " + dlny.mn + " max " + dlny.mx);

    // add omegas to end of delaunay vrts
    for (var i = 0; i < dlny.omgs.length; i++)
      dlny.vrts.push(dlny.omgs[i]);

    dlny.trngls = []; // reset triangles list

    // add the first two omega triangles covering dlny space
    var l = dlny.vrts.length;
    dlny.trngls.push(
      new lzr.trngl(dlny.vrts, l-2, l-3, l-4));
    dlny.trngls.push(
      new lzr.trngl(dlny.vrts, l-4, l-1, l-2));

    // console.log("omega triangles: " + dlny.trngls[0] + ", " + dlny.trngls[1]);

    // incrementally add all the nodes
    for (var i = 0; i < dlny.vrts.length - dlny.omgs.length; i++) {
      var vrt = dlny.vrts[i];

      // find the triangle that this node is inside of
      var trngl = dlny.get_containing_trngl(vrt);
      if (trngl === null) {
        console.log( "couldnt get containing triangle for vertex ", i, vrt );
        return false;
      }

      // pretend its always inside the triangle
      // (since technically it could be on the edge)
      if (true) {

        // remove the triangle that is getting broken up
        var tdx = dlny.trngls.indexOf(trngl);
        if (tdx >= 0) dlny.trngls.splice( tdx, 1 );

        var nwts = trngl.split(i);
        if (nwts.length === 3) {

          // add new triangles to list
          dlny.trngls = dlny.trngls.concat(nwts);

          // make sure each face is valid
          for (var j = 0; j < nwts.length; j++) {
            dlny.validate_edge(nwts[j], i);
          }
        }
      }
      else {} // on the edge
    }

    // remove omega vertices & triangles
    for (var i = 0; i < 4; i++) dlny.vrts.pop();
    var ntrngls = [];
    l = dlny.vrts.length;
    for (var i = 0; i < dlny.trngls.length; i++) {
      var trngl = dlny.trngls[i];
      var is_omg = false;
      for (var j = 0; j < trngl.dxs.length; j++)
        if (trngl.dxs[j] >= l)
          is_omg = true;
      if (!is_omg) ntrngls.push(trngl);
    }
    dlny.trngls = ntrngls;

    return true;
  }
}

// flip two triangles sharing an edge into new triangles sharing opposite edge
lzr.dlny.flip_trngls = function (atrngl, btrngl) {

  // clone vertices lists
  var adxs = atrngl.dxs.slice();
  var bdxs = btrngl.dxs.slice();
  var common = [];

  // remove common vertices
  // loop over original atrngl indices as we are changing adxs list
  for (var i = 0; i < atrngl.dxs.length; i++) {
    var dx = atrngl.dxs[i];
    var dxdx = bdxs.indexOf(dx);
    if (dxdx >= 0) {
      common.push(dx);
      bdxs.splice(dxdx, 1);
      dxdx = adxs.indexOf(dx);
      adxs.splice(dxdx, 1);
    }
  }

  // there should be 2 nodes in common
  if (common.length != 2) return false;

  // copy remaining unique nodes and split common
  adxs.push( bdxs[0] );
  bdxs.push( adxs[0] );
  adxs.push( common.pop() );
  bdxs.push( common.pop() );

  // replace nodes lists with new lists and ccwize
  atrngl.dxs = adxs;
  btrngl.dxs = bdxs;
  if (!atrngl.ccwize()) return false;
  if (!btrngl.ccwize()) return false;

  return true;
}
// --dlny
// ********

// ****************
// dl -> methods to download files from browser
//
lzr.dl = {};
lzr.dl.txt = function (lns) {
  var blburl = URL.createObjectURL(
    new Blob([lns.join("\n")], {type: 'application/octet-stream'}));
  location.href = blburl;
};
// --dl
// ********
