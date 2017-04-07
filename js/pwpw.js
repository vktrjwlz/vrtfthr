var rndrr;
var fthr;

function pwpw() {
  var cnvs = document.getElementById("lzrcnvs");
  rndrr = new lzr.rndrr(cnvs);

  rndrr.zoom = vec2.fromValues(20, 20);
  rndrr.setResolution();

  console.log("creating feather");

  // gen feather
  fthr = new vrtfthr.fthr();
  fthr.generate();

  var ln = new lzr.ln();
  ln.rgba = [0.7, 0.0, 0.0, 0.7]; // reddish

  // spine line
  var end = vec2.create();
  vec2.add(end, fthr.spn.orgn, fthr.spn.dlta);
  ln.vertices = [fthr.spn.orgn, end];
  ln.weight = fthr.spn.brdth;
  rndrr.mshs.push(ln);

  // rib lines
  for (var i = 0; i < fthr.spn.rbs.length; i++) {
    var rb = fthr.spn.rbs[i];

    ln = new lzr.ln();
    ln.rgba = [0.7, 0.0, 0.0, 0.7]; // reddish

    end = vec2.create();
    vec2.add(end, rb.orgn, rb.dlta);
    ln.vertices = [rb.orgn, end];
    ln.weight = rb.brdth;
    rndrr.mshs.push(ln);

    console.log("added rib line at " + ln.vertices);

    // needle lines
    for (var j = 0; j < rb.ndls.length; j++) {
      var ndl = rb.ndls[j];

      ln = new lzr.ln();
      ln.rgba = [0.7, 0.0, 0.0, 0.7]; // reddish

      end = vec2.create();
      vec2.add(end, ndl.orgn, ndl.dlta);
      ln.vertices = [ndl.orgn, end];
      ln.weight = ndl.brdth;
      rndrr.mshs.push(ln);

      console.log("added needle line at " + ln.vertices);
    }
  }

  console.log("buffing feather");

  window.addEventListener( 'resize', onWindowResize, false );

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
