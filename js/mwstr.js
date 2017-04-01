var mwstr = {}; // init lzr namespace

mwstr.errng = function () {
  var errng = this;
  errng.mn = vec2.fromValues(50, 50); // min screen coord of bounds
  errng.sz = vec2.fromValues(1200, 400); // screen size of bounds
  errng.mmsz = vec2.fromValues(60, 20); // mm size of bounds

  errng.hkvrt = null; // top vertex to connect to hook
  errng.wide_thrsh = Math.PI / 3.0;

  errng.nmvrts = 20; // num vertices
  errng.mndst = 80; // min distance between vertices
  errng.tpdst = 0; // top keepout (for hook)
  errng.strt = 8; // width of struts

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
    while (attmpts < 10000) {
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
    while (errng.dlny.vrts.length > i/2) errng.dlny.vrts.pop();
    console.log("generated " + i + " vertices in " + attmpts + " attempts");

    // triangulate
    errng.dlny.triangulate();

    // prune edge triangles
    var nwtrngls = [];
    for (var i = 0; i < errng.dlny.trngls.length; i++) {
      var trngl = errng.dlny.trngls[i];
      var edges = [];
      for (var j = 0; j < trngl.dxs.length; j++) {
        if (errng.dlny.get_adjacent(trngl, trngl.dxs[j]) === null) {
          edges.push(j);
        }
      }

      // prune triangles with one outside edge & wider than threshold
      if (edges.length === 1 && trngl.get_angle(edges[0]) > errng.wide_thrsh) {
        console.log("pruning triangle " + trngl);

      } else {
        nwtrngls.push(trngl);
      }
    }
    errng.dlny.trngls = nwtrngls;

    errng.pn = new lzr.pn();
    errng.pn.bndry.vrts = [
      vec2.fromValues(errng.mn[0], errng.mn[1]),
      vec2.fromValues(errng.mn[0] + errng.sz[0], errng.mn[1]),
      vec2.fromValues(errng.mn[0] + errng.sz[0], errng.mn[1] + errng.sz[1]),
      vec2.fromValues(errng.mn[0], errng.mn[1] + errng.sz[1])];

    console.log("adding earring voids");

    errng.otrngls = [];

    for (var i = 0; i < errng.dlny.trngls.length; i++) {
      var otrngl = errng.dlny.trngls[i].offset(errng.strt * -0.5);
      errng.otrngls.push(otrngl);
      var vd = new lzr.lp();
      vd.vrts = otrngl.vrts.slice();
      errng.pn.vds.push(vd);
      // console.log(i + " " + otrngl);
    }
  }
}
