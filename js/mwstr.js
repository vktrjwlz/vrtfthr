var mwstr = {}; // init lzr namespace

mwstr.errng = function () {
  var errng = this;
  errng.mn = vec2.fromValues(50, 50); // min screen coord of bounds
  errng.sz = vec2.fromValues(1400, 400); // screen size of bounds
  errng.mmsz = vec2.fromValues(70, 20); // mm size of bounds

  errng.wide_thrsh = Math.PI / 3.0;

  errng.nmvrts = 20; // num vertices
  errng.mndst = 60; // min distance between vertices
  errng.strt = 8; // width of struts

  errng.hkdst = 200.0; // top keepout (for hook) (on left)
  errng.hkvrts = [vec2.fromValues(150, 200), vec2.fromValues(150, 300)];

  errng.dlny = null;
  errng.pn = null;
}

mwstr.errng.prototype = {

  constructor: mwstr.errng,

  // generate a new mwstr earring
  generate: function() {
    var errng = this;

    console.log("generating earring");

    // generate random vertices for delaunay
    // create delaunay triangulation
    errng.dlny = new lzr.dlny();
    var i = 0;
    var attmpts = 0;
    while (attmpts < 10000) {
      attmpts++;
      var vrt = vec2.fromValues(
         (Math.random() * (errng.sz[0] - errng.hkdst)) + errng.mn[0] + errng.hkdst,
         (Math.random() * errng.sz[1]) + errng.mn[1]);
      var clst = errng.dlny.get_closest(vrt);
      if (clst === null || vec2.dist(vrt, clst) > errng.mndst) {
        errng.dlny.vrts.push(vrt);
        i++;
      }
    }
    while (errng.dlny.vrts.length > i/2) errng.dlny.vrts.pop();
    console.log("generated " + i + " vertices in " + attmpts + " attempts");

    // add hook vertex
    var hkdxs = [];
    for (var i = 0; i < errng.hkvrts.length; i++) {
      hkdxs.push(errng.dlny.vrts.length);
      errng.dlny.vrts.push(vec2.clone(errng.hkvrts[i]));
    }

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

    // generate boundary loop from triangle edges without adjacent triangles
    var edges = {}; // map from first vertex index to second vertex index
    for (var i = 0; i < errng.dlny.trngls.length; i++) {
      var trngl = errng.dlny.trngls[i];
      for (var j = 0; j < trngl.dxs.length; j++) {
        if (errng.dlny.get_adjacent(trngl, trngl.dxs[j]) === null) {
          var k = j + 1;
          if (k > 2) k = 0;
          var l = k + 1;
          if (l > 2) l = 0;
          edges[trngl.dxs[k]] = trngl.dxs[l];
        }
      }
    }

    console.log("edges: ");
    console.log(edges);

    errng.pn = new lzr.pn();

    var fvdx = hkdxs[0];
    var nvdx = fvdx;
    errng.pn.bndry.vrts.push(vec2.clone(errng.dlny.vrts[nvdx]));

    while (nvdx in edges) {

      var bvdx = edges[nvdx];
      if (bvdx === fvdx) {
        console.log("closed boundary loop!");
        break;
      }
      errng.pn.bndry.vrts.push(vec2.clone(errng.dlny.vrts[bvdx]));

      delete edges[nvdx];
      nvdx = bvdx;
    }

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
