var vrtfthr = {}; // init lzr namespace

// ****************
// errng -> generate an earring & output cut file
//
vrtfthr.errng = function () {
  var errng = this;
  errng.mn = vec2.fromValues(50, 50); // min screen coord of bounds
  errng.sz = vec2.fromValues(1400, 400); // screen size of bounds
  errng.mmsz = vec2.fromValues(70, 20); // millimeter size of bounds

  errng.wide_thrsh = Math.PI / 1.5;

  errng.mxattmpts = 1000; // num times to attempt to generate vertices
  errng.cll = 0.6; // ratio of generated vertices to cull
  errng.mndst = 100; // min distance between vertices
  errng.strt = 12; // width of struts
  errng.mn_split_brdth = errng.strt * 3.0; // min breadth to split triangle

  errng.hkdst = 160.0; // top keepout (for hook) (on left)
  errng.hkvrts = [vec2.fromValues(150, 300), vec2.fromValues(150, 200)];
  errng.hkx = [
    vec2.fromValues(80, 220),
    vec2.fromValues(60, 250),
    vec2.fromValues(80, 280)];
  errng.hkvd = [ // will be offset by strut width
    vec2.fromValues(150, 200),
    vec2.fromValues(80, 220),
    vec2.fromValues(60, 250),
    vec2.fromValues(80, 280),
    vec2.fromValues(150, 300)];

  errng.dlny = null;
  errng.pn = null;
}

vrtfthr.errng.prototype = {

  constructor: vrtfthr.errng,

  // generate a new vrtfthr earring
  generate: function() {
    var errng = this;

    console.log("generating earring");

    // generate random vertices for delaunay
    // create delaunay triangulation
    errng.dlny = new lzr.dlny();
    var i = 0;
    var attmpts = 0;
    while (attmpts < errng.mxattmpts) {
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
    while (errng.dlny.vrts.length > i * errng.cll) errng.dlny.vrts.pop();
    console.log("generated " + i + " vertices in " + attmpts + " attempts");
    console.log("culled to " + errng.dlny.vrts.length + " vertices");

    // add hook vertex
    var hkdxs = [];
    for (var i = 0; i < errng.hkvrts.length; i++) {
      hkdxs.push(errng.dlny.vrts.length);
      errng.dlny.vrts.push(vec2.clone(errng.hkvrts[i]));
    }

    // triangulate
    errng.dlny.triangulate();

    // prune edge triangles
    errng.prune_edge_trngls(errng.wide_thrsh);
    errng.prune_edge_trngls(errng.wide_thrsh);

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

    // create earring panel
    errng.pn = new lzr.pn();

    // loop over edges (starting with first hook vrt dx) to generate boundary
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

    // add hook extension vertices
    for (var i = 0; i < errng.hkx.length; i++) {
      errng.pn.bndry.vrts.push(vec2.clone(errng.hkx[i]));
    }

    // offset boundary loop
    errng.pn.bndry.offset(errng.strt * 0.5);

    // add hook void
    var hkvd = new lzr.lp();
    for (var i = 0; i < errng.hkvd.length; i++) {
      hkvd.vrts.push(vec2.clone(errng.hkvd[i]));
    }
    hkvd.offset(errng.strt * -0.5);
    errng.pn.vds.push(hkvd);

    console.log("adding earring voids");

    for (var i = 0; i < errng.dlny.trngls.length; i++) {

      var otrngl = errng.dlny.trngls[i].clone();

      var omnb = otrngl.mn_brdth();
      if (omnb > errng.mn_split_brdth) {
        var cntr = vec2.create();
        otrngl.get_center(cntr);
        otrngl.vrts.push(cntr);
        var mwtrngls = otrngl.split(3);

        for (var j = 0; j < mwtrngls.length; j++) {
          var omwtrngl = mwtrngls[j].offset(errng.strt * -0.5);
          var vd = new lzr.lp();
          vd.vrts = omwtrngl.vrts.slice();
          errng.pn.vds.push(vd);
        }
      } else if (omnb > errng.splt * 2) {

        otrngl = otrngl.offset(errng.strt * -0.5);
        var vd = new lzr.lp();
        vd.vrts = otrngl.vrts.slice();
        errng.pn.vds.push(vd);
      }
    }
  },

  prune_edge_trngls: function (mnangl) {
    var errng = this;

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
      if (edges.length === 1 && trngl.get_angle(edges[0]) > mnangl) {
        //console.log("pruning triangle " + trngl);

      } else {
        nwtrngls.push(trngl);
      }
    }
    console.log("pruned " + (errng.dlny.trngls.length - nwtrngls.length).toString() + " triangles");
    errng.dlny.trngls = nwtrngls;
  },

  dl_dxf: function () {
    var errng = this;

    var mx = vec2.fromValues(
      errng.mn[0] * 2.0 + errng.sz[0],
      errng.mn[1] * 2.0 + errng.sz[1]);

    var scl = vec2.fromValues(
      errng.mmsz[0] / errng.sz[0],
      errng.mmsz[1] / errng.sz[1]);

    // generate dxf
    var dxf = errng.pn.dxffy(mx, scl);

    // download it
    lzr.dl.txt(dxf);

  }
}

vrtfthr.fthr = function() {
  var fthr = this;

  fthr.orgn = vec2.fromValues(3, 18);
  fthr.angl = 0.0;
  fthr.lngth = 60.0;
  fthr.lngth_br = 10.0;
  fthr.brdth = 2.0;
  fthr.rb_dltk = 4.0;
  fthr.rb_dltk_br = 0.5;
  fthr.rb_angl = 1.0; // radians
  fthr.rb_angl_br = 0.1;
  fthr.rb_lngth = 15.0;
  fthr.rb_lngth_br = 3.0;
  fthr.rb_brdth = 1.5;
  fthr.ndl_dltk = 1.0;
  fthr.ndl_dltk_br = 0.2;
  fthr.ndl_angl = 1.3;
  fthr.ndl_angl_br = 0.2;
  fthr.ndl_lngth = 3.0;
  fthr.ndl_lngth_br = 0.5;
  fthr.ndl_brdth = 1.0;

  fthr.spn = null;
}
vrtfthr.fthr.prototype = {

  constructor: vrtfthr.fthr,

  generate: function () {
    var fthr = this;

    // gen delta vector with length in bar
    var spn_lngth = vrtfthr.rndbr(fthr.lngth, fthr.lngth_br);
    var dlta = vec2.fromValues(spn_lngth, 0);

    // rotate vector by angle
    var rtmt = mat2.create();
    var angl = fthr.angl;
    mat2.fromRotation(rtmt, angl);
    vec2.transformMat2(dlta, dlta, rtmt);

    // gen spine
    var orgn = fthr.orgn;
    fthr.spn = new vrtfthr.spn(orgn, dlta, fthr.brdth);

    // gen ribs
    var dltk = fthr.rb_dltk; // start a ways down spine?
    var dir = 1.0;
    // console.log("dltk: " + dltk + ", limit: " + (1.0 - (fthr.rb_dltk + fthr.rb_dltk_br)).toString());
    while (dltk < (spn_lngth - (2 * fthr.rb_dltk))) {
      // console.log("rb dltk: " + dltk);
      dltk = dltk + vrtfthr.rndbr(fthr.rb_dltk, fthr.rb_dltk_br);
      dir = dir * -1.0;

      // gen rib origin
      orgn = vec2.create();
      vec2.normalize(orgn, fthr.spn.dlta);
      vec2.scale(orgn, orgn, dltk);
      vec2.add(orgn, orgn, fthr.spn.orgn);

      // gen rib delta
      dlta = vec2.create();
      vec2.normalize(dlta, fthr.spn.dlta);

      angl = vrtfthr.rndbr(fthr.rb_angl, fthr.rb_angl_br);
      mat2.fromRotation(rtmt, angl * dir);
      vec2.transformMat2(dlta, dlta, rtmt);

      var rb_lngth = vrtfthr.rndbr(fthr.rb_lngth, fthr.rb_lngth_br);
      rb_lngth = rb_lngth * ((spn_lngth - (dltk * 0.5)) / spn_lngth);
      vec2.scale(dlta, dlta, rb_lngth);

      fthr.spn.rbs.push(new vrtfthr.rb(orgn, dlta, fthr.rb_brdth));
    }

    // gen needles
    for (var i = 0; i < fthr.spn.rbs.length; i++) {
      var rb = fthr.spn.rbs[i];
      var rb_length = vec2.length(rb.dlta);
      dltk = fthr.ndl_dltk * 2.5;
      while (dltk < (rb_length - (2 * fthr.ndl_dltk))) {
        dltk = dltk + vrtfthr.rndbr(fthr.ndl_dltk, fthr.ndl_dltk_br);
        dir = dir * -1.0;

        // gen needle origin
        orgn = vec2.create();
        vec2.normalize(orgn, rb.dlta);
        vec2.scale(orgn, orgn, dltk);
        vec2.add(orgn, orgn, rb.orgn);

        // gen needdle delta
        dlta = vec2.create();
        vec2.normalize(dlta, rb.dlta);

        angl = vrtfthr.rndbr(fthr.ndl_angl, fthr.ndl_angl_br);
        mat2.fromRotation(rtmt, angl * dir);
        vec2.transformMat2(dlta, dlta, rtmt);

        lngth = vrtfthr.rndbr(fthr.ndl_lngth, fthr.ndl_lngth_br);
        vec2.scale(dlta, dlta, lngth);

        rb.ndls.push(new vrtfthr.ndl(orgn, dlta, fthr.ndl_brdth));
      }
    }
  }
}

// ****************
// spn -> spine of feather
//
vrtfthr.spn = function (orgn, dlta, brdth) {
  var spn = this;

  spn.orgn = orgn;
  spn.dlta = dlta;
  spn.brdth = brdth;
  spn.rbs = [];
}
vrtfthr.spn.prototype = {
  constructor: vrtfthr.spn
}

// ****************
// rb -> rib of feather
//
vrtfthr.rb = function (orgn, dlta, brdth) {
  var rb = this;

  rb.orgn = orgn;
  rb.dlta = dlta;
  rb.brdth = brdth;
  rb.ndls = [];
}
vrtfthr.rb.prototype = {
  constructor: vrtfthr.rb
}

// ****************
// ndl -> needle on rib of feather
//
vrtfthr.ndl = function (orgn, dlta, brdth) {
  var ndl = this;

  ndl.orgn = orgn;
  ndl.dlta = dlta;
  ndl.brdth = brdth;
}
vrtfthr.ndl.prototype = {
  constructor: vrtfthr.ndl
}

vrtfthr.rndbr = function(s, br) {
  return (Math.random() * br) + s - (br * 0.5);
}
