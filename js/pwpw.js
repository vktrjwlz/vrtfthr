var rndrr;
var msh = null;
var rng = null;
var mnOff = 0.0;
var mxOff = 128.0;
var offset = 0.0;
var pointerDown = false;
var anchorP = vec2.fromValues(128.0, 128.0);
var lastP = vec2.create();
var mn = vec2.fromValues(50.0, 50.0);
var sz = vec2.fromValues(1200.0, 400.0);
var mndst = 80.0;

var dlny = null;


function pwpw() {
  var cnvs = document.getElementById("lzrcnvs");
  rndrr = new lzr.rndrr(cnvs);

  console.log("creating earring");

  var dlny = new lzr.dlny();
  var i = 0;
  var attmpts = 0;
  // while (i < 17 && attmpts < 10000) {
  while (attmpts < 10000) {
    attmpts++;
    var vrt = vec2.fromValues(
       (Math.random() * sz[0]) + mn[0],
       (Math.random() * sz[1]) + mn[1]);
    var clst = dlny.get_closest(vrt);
    if (clst === null || vec2.dist(vrt, clst) > mndst) {
      dlny.vrts.push(vrt);
      console.log(i + " " + vrt);
      var r = new lzr.rng();
      r.rgba = [0.0, 1.0, 0.0, 0.5]; // reddish
      r.center = vec2.clone(vrt);
      r.radius = 16.0;
      r.weight = 6.0;
      r.segments = 32;
      rndrr.mshs.push(r);
      i++;
    }
  }
  console.log("generated " + i + " vertices in " + attmpts + " attempts");
  var x = i / 2;
  for (var i = 0; i < x; i++) dlny.vrts.pop();

  dlny.triangulate();

  console.log("triangulated delaunay!");

  for (var i = 0; i < dlny.trngls.length; i++) {
    var t = dlny.trngls[i];
    t.rgba = [0.0, 0.0, 0.5, 0.3];
    rndrr.mshs.push(t);
    var ot = t.offset(-4.0);
    ot.rgba = [1.0, 0.0, 0.0, 0.5];
    rndrr.mshs.push(ot);
  }
  // create earring
  // errng = new mwstr.errng();


  // errng.generate();
  // errng.pn.rgba = [0.7, 0.0, 0.0, 0.7]; // reddish
  //
  // rndrr.mshs.push(errng.pn);
  //
  // console.log("buffing earring");

  // rndrr.buff();

  // for (var i = 0; i < errng.pn.vds.length; i++) {
  //   var ft = new lzr.trngl(errng.pn.vds[i].vrts[0], errng.pn.vds[i].vrts[1], errng.pn.vds[i].vrts[2]);
  //   ft.rgba = [0, 1, 0, 0.5];
  //   rndrr.mshs.push(ft);
  // }
  //
  // for (var i = 0; i < errng.pn.vertices.length; i++) {
  //   var r = new lzr.rng();
  //   r.rgba = [0.0, 0.0, 1.0, 0.5]; // reddish
  //   r.center = errng.pn.vertices[i];
  //   r.radius = 16.0;
  //   r.weight = 6.0;
  //   r.segments = 32;
  //   rndrr.mshs.push(r);
  // }
  //
  // for (var i = 0; i < errng.pn.triangles.length; i++) {
  //   var t = errng.pn.triangles[i];
  //   for (var j = 0; j < 3; j++) {
  //     var k = j - 1;
  //     if (k < 0) k = 2;
  //     var l = new lzr.ln();
  //     l.weight = 6;
  //     l.rgba = [0.0, 0.0, 1.0, 0.5]; // blueish
  //     l.vertices.push( errng.pn.vertices[t[k]] );
  //     l.vertices.push( errng.pn.vertices[t[j]] );
  //     // console.log("adding line vertices " + errng.pn.vertices[t[k]] + " " + errng.pn.vertices[t[j]]);
  //     rndrr.mshs.push( l );
  //   }
  // }

  // for (var i = 0; i < dlny.trngls.length; i++) {
  //   var trngl = dlny.trngls[i];
  //   if (!dlny.is_omg(trngl)) {
  //     for (var j = 0; j < 3; j++) {
  //       var k = j + 1;
  //       if (k >= 3) k = 0;
  //       var l = new lzr.ln();
  //       l.weight = 6;
  //       l.rgba = [0.0, 0.0, 1.0, 0.5]; // blueish
  //       l.vertices.push( trngl.vrts[j] );
  //       l.vertices.push( trngl.vrts[k] );
  //       rndrr.mshs.push( l );
  //     }

      // var crcl = trngl.get_crcl();
      // var r = new lzr.rng();
      // r.rgba = [0.0, 1.0, 0, 0.5]; // greenish
      // r.center = crcl.cntr;
      // r.radius = crcl.rad;
      // r.weight = 6.0;
      // r.segments = 32;
      // rndrr.mshs.push(r);
  //   }
  // }



  window.addEventListener( 'resize', onWindowResize, false );
  // document.addEventListener( 'mousedown', onMouseDown, false );
  // document.addEventListener( 'mousemove', onMouseMove, false );
  // document.addEventListener( 'mouseup', onMouseUp, false );

  rndrr.buff(); // build mesh buffers, call after changing meshes
  rndrr.render(); // draw meshes
}

function onWindowResize() {
  rndrr.setResolution();
  rndrr.render();
}

function updatePosition() {
  offset = lastP[1] - anchorP[1];
  if( offset < mnOff ) offset = mnOff;
  if( offset > mxOff ) offset = mxOff;

  msh.vertices[0][1] = mn[1] + offset;

  rndrr.buff();
  rndrr.render();
}

function onMouseDown( event ) {
  pointerDown = true;

  event.preventDefault();

  var l = new lzr.ln();
  l.weight = 16;
  l.rgba = [0.0, 1.0, 1.0, 0.7]
  l.vertices.push( vec2.clone(anchorP) );

  anchorP[0] = rndrr.px2gl( event.clientX );
  anchorP[1] = rndrr.px2gl( event.clientY );

  console.log("down: ", anchorP);

  vec2.copy(rng.center, anchorP);

  l.vertices.push( vec2.clone(anchorP) );
  rndrr.mshs.push( l );

  rndrr.buff();
  rndrr.render();
}

function onMouseMove( event ) {
  if (pointerDown) {
    lastP[0] = rndrr.px2gl( event.clientX );
    lastP[1] = rndrr.px2gl( event.clientY );

    vec2.copy(rng.center, lastP);

    updatePosition();
  }
}

function onMouseUp( event ) {
  pointerDown = false;
}
