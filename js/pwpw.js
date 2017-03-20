var rndrr;
var msh = null;
var rng = null;
var mnOff = 0.0;
var mxOff = 128.0;
var offset = 0.0;
var pointerDown = false;
var anchorP = vec2.fromValues(128.0, 128.0);
var lastP = vec2.create();
var mn = vec2.fromValues(48.0, 48.0);
var sz = vec2.fromValues(256.0, 256.0);


function pwpw() {
  var cnvs = document.getElementById("lzrcnvs");
  rndrr = new lzrpn.rndrr(cnvs);

  // create rectangular mesh
  msh = new lzrpn.msh();
  msh.rgba = [1.0, 0.0, 0.0, 0.7]; // reddish
  msh.vertices.push( vec2.clone(mn) );
  msh.vertices.push( vec2.fromValues(mn[0], mn[1] + sz[1]) );
  msh.vertices.push( vec2.fromValues(mn[0] + sz[0], mn[1]) );
  msh.vertices.push( vec2.fromValues(mn[0] + sz[0], mn[1] + sz[1]) );
  msh.triangles.push( [0, 1, 2] );
  msh.triangles.push( [1, 3, 2] );
  rndrr.mshs.push(msh);

  var mnb = vec2.fromValues(96.0, 128.0);
  var szb = vec2.fromValues(400.0, 600.0);

  var ln = new lzrpn.ln();
  ln.rgba = [0.0, 1.0, 1.0, 0.7]; // cyanish
  ln.weight = 24.0;
  ln.vertices.push( vec2.fromValues(200, 650) );
  ln.vertices.push( vec2.fromValues(400, 650) );
  rndrr.mshs.push(ln);



  rng = new lzrpn.rng();
  rng.rgba = [1.0, 0.0, 0.0, 0.7]; // reddish
  rng.center = vec2.fromValues( 300, 500 );
  rng.radius = 128.0;
  rng.weight = 16.0;
  rng.segments = 32;
  rndrr.mshs.push(rng);

  window.addEventListener( 'resize', onWindowResize, false );
  document.addEventListener( 'mousedown', onMouseDown, false );
  document.addEventListener( 'mousemove', onMouseMove, false );
  document.addEventListener( 'mouseup', onMouseUp, false );

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

  var l = new lzrpn.ln();
  l.weight = 4;
  l.rgba = [0.0, 1.0, 1.0, 1.0]
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
