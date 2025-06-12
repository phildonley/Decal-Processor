#target photoshop
app.bringToFront();

// Simple logger to the ExtendScript Console
function log(msg) { $.writeln(msg); }

// Prompt for a folder and verify
function selectFolder(promptText) {
  var f = Folder.selectDialog(promptText);
  if (!f) throw new Error("No folder selected.");
  return f;
}

// Add the exact drop shadow you specified
function addDropShadow() {
  var idsetd = charIDToTypeID("setd"),
      desc1  = new ActionDescriptor(),
      ref1   = new ActionReference();
  ref1.putProperty(charIDToTypeID("Prpr"), charIDToTypeID("Lefx"));
  ref1.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
  desc1.putReference(charIDToTypeID("null"), ref1);

  var fxDesc = new ActionDescriptor();
  fxDesc.putUnitDouble(charIDToTypeID("Scl "), charIDToTypeID("#Prc"), 100.0);

  var ds = new ActionDescriptor();
  ds.putBoolean( charIDToTypeID("enab"),           true);
  ds.putBoolean( charIDToTypeID("present"),        true);
  ds.putBoolean( charIDToTypeID("showInDialog"),   true);
  ds.putEnumerated(charIDToTypeID("Md  "), charIDToTypeID("BlnM"), charIDToTypeID("Nrml"));
  ds.putUnitDouble( charIDToTypeID("Opct"),        charIDToTypeID("#Prc"), 21.0);
  ds.putUnitDouble( charIDToTypeID("Angl"),        charIDToTypeID("#Ang"), 45.0);
  ds.putBoolean( charIDToTypeID("useGlobalAngle"), true);
  ds.putUnitDouble( charIDToTypeID("Dstn"),        charIDToTypeID("#Pxl"), 7.0);
  ds.putUnitDouble( charIDToTypeID("Ckmt"),        charIDToTypeID("#Pxl"), 8.0);
  ds.putUnitDouble( charIDToTypeID("Sprd"),        charIDToTypeID("#Prc"), 14.0);

  var clr = new ActionDescriptor();
  clr.putDouble(charIDToTypeID("Rd  "), 0.0);
  clr.putDouble(charIDToTypeID("Grn "), 0.0);
  clr.putDouble(charIDToTypeID("Bl  "), 0.0);
  ds.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), clr);

  fxDesc.putObject(charIDToTypeID("DrSh"), charIDToTypeID("DrSh"), ds);
  desc1.putObject(charIDToTypeID("T   "), charIDToTypeID("Lefx"), fxDesc);
  executeAction(idsetd, desc1, DialogModes.NO);
}

// Resize & center with padding
function resizeAndCenterLayer(doc, layer, maxW, maxH) {
  if (layer.kind === LayerKind.SMARTOBJECT) layer.rasterize(RasterizeType.ENTIRELAYER);
  if (layer.isBackgroundLayer) layer.isBackgroundLayer = false;

  var b = layer.bounds,
      w = b[2].as("px") - b[0].as("px"),
      h = b[3].as("px") - b[1].as("px");
  if (w < 2 || h < 2) throw new Error("Layer too small: " + w + "×" + h);

  var scale = Math.min(maxW / w, maxH / h);
  layer.resize(scale * 100, scale * 100);

  b = layer.bounds;
  w = b[2].as("px") - b[0].as("px");
  h = b[3].as("px") - b[1].as("px");
  var dx = (doc.width.as("px") / 2) - (b[0].as("px") + w/2),
      dy = (doc.height.as("px")/ 2) - (b[1].as("px") + h/2);
  layer.translate(dx, dy);
}

// Build a point for the quad list
function pointDescriptor(x,y) {
  var d = new ActionDescriptor();
  d.putUnitDouble(charIDToTypeID("Hrzn"), charIDToTypeID("#Pxl"), x);
  d.putUnitDouble(charIDToTypeID("Vrtc"), charIDToTypeID("#Pxl"), y);
  return d;
}

// True 30° perspective using corner distortion
function applyLeftPerspectiveSkew(layer) {
  app.activeDocument.activeLayer = layer;
  if (layer.isBackgroundLayer) layer.isBackgroundLayer = false;

  var b  = layer.bounds,
      x1 = b[0].as("px"), y1 = b[1].as("px"),
      x2 = b[2].as("px"), y2 = b[3].as("px"),
      halfW = (x2 - x1)/2,
      cos30 = Math.cos(Math.PI/6),      // ~0.866
      offL =  halfW * (1 - cos30),
      offR =  halfW * (1/cos30 - 1);

  var idTrnf = charIDToTypeID("Trnf"),
      desc   = new ActionDescriptor(),
      ref    = new ActionReference();
  ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
  desc.putReference(charIDToTypeID("null"), ref);
  desc.putEnumerated(charIDToTypeID("FTcs"), charIDToTypeID("QCSt"), charIDToTypeID("Qcsa"));

  var quad = new ActionList();
  quad.putObject(charIDToTypeID("Pnt "), pointDescriptor(x1 + offL, y1));
  quad.putObject(charIDToTypeID("Pnt "), pointDescriptor(x2 + offR, y1));
  quad.putObject(charIDToTypeID("Pnt "), pointDescriptor(x2 + offR, y2));
  quad.putObject(charIDToTypeID("Pnt "), pointDescriptor(x1 + offL, y2));
  desc.putList(charIDToTypeID("Quad"), quad);

  executeAction(idTrnf, desc, DialogModes.NO);
}

// Process each file
function processImage(file, stdFS, rotFS) {
  log("▶ " + file.name);
  var base = file.name.replace(/\\.\\d+/, ""),
      doc  = open(file),
      canvas = app.documents.add(1600,1600,72,"Canvas",NewDocumentMode.RGB,DocumentFill.WHITE);

  app.activeDocument = doc;
  doc.activeLayer.duplicate(canvas, ElementPlacement.PLACEATBEGINNING);
  doc.close(SaveOptions.DONOTSAVECHANGES);
  app.activeDocument = canvas;

  // Standard
  resizeAndCenterLayer(canvas, canvas.activeLayer, 1520, 1520);
  addDropShadow();
  canvas.flatten();
  canvas.saveAs(new File(stdFS + "/" + file.name), new JPEGSaveOptions(), true);

  // Rotated
  var rot = canvas.duplicate();
  app.activeDocument = rot;
  try {
    applyLeftPerspectiveSkew(rot.activeLayer);
    addDropShadow();
  } catch(e) {
    log("⚠ Skew skipped: " + e.message);
  }
  rot.flatten();
  rot.saveAs(new File(rotFS + "/" + base + "103.jpg"), new JPEGSaveOptions(), true);
  rot.close(SaveOptions.DONOTSAVECHANGES);
  canvas.close(SaveOptions.DONOTSAVECHANGES);
}

// Entry point
function run() {
  var src    = selectFolder("Select folder with decal images"),
      output = selectFolder("Select output location");

  // Show exactly where we're looking
  alert("Scanning: " + src.fsName);

  // Grab all JPG/PNG/PSD in one go
  var files = src.getFiles(/\.(jpg|jpeg|png|psd)$/i) || [];
  alert("Found " + files.length + " image(s).");

  if (!files.length) return;

  var stdDir = new Folder(output + "/Standard");
  if (!stdDir.exists) stdDir.create();
  var rotDir = new Folder(output + "/Rotated");
  if (!rotDir.exists) rotDir.create();

  for (var i = 0; i < files.length; i++) {
    try {
      processImage(files[i], stdDir.fsName, rotDir.fsName);
    } catch(e) {
      alert("❌ Error on " + files[i].name + ":\n" + e.message);
    }
  }

  alert("✅ Done! Check ‘Standard’ & ‘Rotated’ folders.");
}

run();
