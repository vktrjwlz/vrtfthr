var mwstr = {}; // init lzr namespace

mwstr.errng = function () {
  var errng = this;
  errng.mn = vec2.fromValues(50, 50); // min screen coord of bounds
  errng.sz = vec2.fromValues(300, 600); // screen size of bounds
  errng.mmsz = vec2.fromValues(20, 40); // mm size of bounds

  errng.hkvrt = null; // top vertex to connect to hook

  errng.nmvrts = 20; // num vertices
  errng.mndst = 80; // min distance between vertices
  errng.tpdst = 100; // top keepout (for hook)
  errng.strt = 16; // width of struts

  errng.dlny = null;
  errng.pn = null;
}

mwstr.errng.prototype = {

  constructor: mwstr.errng,

  // generate a new mwstr earring
  generate: function(nmvrts, mndst, tpdst, strt, mn, sz, mmsz) {
    var errng = this;

    console.log("generating earring");

    // process args
    if (nmvrts) errng.nmvrts = nmvrts;
    if (mndst) errng.mndst = mndst;
    if (tpdst) errng.tpdst = tpdst;
    if (strt) errng.strt = strt;
    if (mn) errng.mn = vec2.fromValues(mn[0], mn[1]);
    if (sz) errng.sz = vec2.fromValues(sz[0], sz[1]);
    if (mmsz) errng.mmsz = vec2.fromValues(mmsz[0], mmsz[1]);

    // generate random vertices for delaunay
    // create delaunay triangulation
    errng.dlny = new lzr.dlny();
    var i = 0;
    var attmpts = 0;
    while (i < 20 && attmpts < 10000) {
      attmpts++;
      var vrt = vec2.fromValues(
         (Math.random() * errng.sz[0]) + errng.mn[0],
         (Math.random() * (errng.sz[1] - errng.tpdst)) + errng.mn[1] + errng.tpdst);
      var clst = errng.dlny.get_closest(vrt);
      if (clst === null || vec2.dist(vrt, clst) > errng.mndst) {
        errng.dlny.vrts.push(vrt);
        i++;
      }
    }
    console.log("generated " + i + " vertices in " + attmpts + " attempts");

    console.log("trianglulating earring");

    errng.dlny.triangulate();

    errng.pn = new lzr.pn();
    errng.pn.bndry.vrts = [
      vec2.fromValues(errng.mn[0], errng.mn[1]),
      vec2.fromValues(errng.mn[0] + errng.sz[0], errng.mn[1]),
      vec2.fromValues(errng.mn[0] + errng.sz[0], errng.mn[1] + errng.sz[1]),
      vec2.fromValues(errng.mn[0], errng.mn[1] + errng.sz[1])];

    console.log("adding earring voids");

    for (var i = 0; i < errng.dlny.trngls.length; i++) {
      var otrngl = errng.dlny.trngls[i].offset(errng.strt * -0.5);
      var vd = new lzr.lp();
      vd.vrts = otrngl.vrts.slice();
      errng.pn.vds.push(vd);
      console.log("added triangle void " + otrngl);
      console.log("triangle is ccw " + otrngl.is_ccw());
    }
  }
}
