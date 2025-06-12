#target photoshop
app.bringToFront();

function log(msg) { $.writeln(msg); }

// clamp helper
function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

function selectFolder(promptText) {
  var f = Folder.selectDialog(promptText);
  if (!f) throw new Error("No folder selected.");
  return f;
}

function run() {
  // 1) pick source + output
  var src    = selectFolder("Select folder with decals"),
      output = selectFolder("Select output location");

  // 2) gather files via Photoshop’s native filter
  alert("Scanning: " + src.fsName);
  var files = src.getFiles(/\.(jpg|jpeg|png|psd)$/i);
  alert("Found " + files.length + " image(s).");
  if (!files || !files.length) return;

  // 3) prepare subfolders
  var stdDir = new Folder(output + "/Standard"); if (!stdDir.exists) stdDir.create();
  var rotDir = new Folder(output + "/Rotated");  if (!rotDir.exists) rotDir.create();

  // 4) loop
  for (var i = 0; i < files.length; i++) {
    try {
      processImage(files[i], stdDir.fsName, rotDir.fsName);
    } catch (e) {
      alert("Error on " + files[i].name + ":\n" + e.message);
    }
  }

  alert("✅ Done! Check “Standard” & “Rotated”.");
}

// ——— per-file work ———
function processImage(file, stdFS, rotFS) {
  log("▶ " + file.name);
  
  // Open the file and create a new canvas
  var doc;
  try {
    doc = open(file);
    var canvas = app.documents.add(1600, 1600, 72, "Canvas", NewDocumentMode.RGB, DocumentFill.WHITE);
  } catch (e) {
    throw new Error("Failed to open file or create canvas: " + e.message);
  }

  // Duplicate decal into canvas
  app.activeDocument = doc;
  
  try {
    doc.activeLayer.duplicate(canvas, ElementPlacement.PLACEATBEGINNING);
    doc.close(SaveOptions.DONOTSAVECHANGES);
    app.activeDocument = canvas;
    
    // Standard view
    resizeAndCenterLayer(canvas, canvas.activeLayer, 1520, 1520);
    addDropShadow();
    canvas.flatten();
    canvas.saveAs(new File(stdFS + "/" + file.name), new JPEGSaveOptions(), true, Extension.LOWERCASE);

    // Rotated view
    var rot = canvas.duplicate();
    app.activeDocument = rot;
    
    try {
      applyLeftPerspectiveSkew(rot.activeLayer);
      addDropShadow();
    } catch (e) {
      log("⚠ Skew skipped: " + e.message);
    }
    
    rot.flatten();
    rot.saveAs(new File(rotFS + "/" + file.name.replace(/\.\w+$/, "") + "103.jpg"), new JPEGSaveOptions(), true, Extension.LOWERCASE);
    rot.close(SaveOptions.DONOTSAVECHANGES);
    
    canvas.close(SaveOptions.DONOTSAVECHANGES);
    
  } catch (e) {
    throw new Error("Failed during image processing: " + e.message);
  }
}

// ——— Resize + Center ———
function resizeAndCenterLayer(doc, layer, maxW, maxH) {
  try {
    if (layer.kind === LayerKind.SMARTOBJECT) layer.rasterize(RasterizeType.ENTIRELAYER);
    if (layer.isBackgroundLayer) layer.isBackgroundLayer = false;

    var b = layer.bounds;
    var w = b.as("px") - b.as("px");
    var h = b.as("px") - b.as("px");
        
    if (w < 2 || h < 2) throw new Error("Too small: " + w + "×" + h);

    var scale = Math.min(maxW / w, maxH / h);
    layer.resize(scale * 100, scale * 100);

    b = layer.bounds;
    w = b.as("px") - b.as("px");
    h = b.as("px") - b.as("px");
    
    var dx = (doc.width.as("px") / 2) - (b.as("px") + w/2);
    var dy = (doc.height.as("px") / 2) - (b.as("px") + h/2);
        
    layer.translate(dx, dy);
    
  } catch (e) {
    throw new Error("Failed during resize and center: " + e.message);
  }
}

// ——— Drop Shadow ———
function addDropShadow() {
  try {
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
    
  } catch (e) {
    throw new Error("Failed to add drop shadow: " + e.message);
  }
}

// ——— Perspective Skew (30°) ———
function pointDescriptor(x,y) {
  var d = new ActionDescriptor();
  d.putUnitDouble(charIDToTypeID("Hrzn"), charIDToTypeID("#Pxl"), x);
  d.putUnitDouble(charIDToTypeID("Vrtc"), charIDToTypeID("#Pxl"), y);
  return d;
}

function applyLeftPerspectiveSkew(layer) {
    app.activeDocument.activeLayer = layer;
    if (layer.isBackgroundLayer) layer.isBackgroundLayer = false;

    // grab bounds
    var b   = layer.bounds;
    var x1  = b.as("px"), y1 = b.as("px");
    var x2  = b.as("px"), y2 = b.as("px");

    // compute a true 30° yaw: cos(30°)=0.866, tan(30°)=0.577
    var halfW = (x2 - x1) / 2;
    var cos30 = Math.cos(Math.PI/6);     // ~0.866
    var offL  = halfW * (1 - cos30);     // left side moves in
    var offR  = halfW * (1/cos30 - 1);   // right side moves out

    // build the ActionDescriptor
    var desc  = new ActionDescriptor();
    var ref   = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    desc.putReference(charIDToTypeID("null"), ref);
    desc.putEnumerated(charIDToTypeID("FTcs"), charIDToTypeID("QCSt"), charIDToTypeID("Qcsa"));

    // **This is the missing piece** — you MUST include an empty “Ofst” descriptor
    var od = new ActionDescriptor();
    od.putUnitDouble(charIDToTypeID("Hrzn"), charIDToTypeID("#Pxl"), 0);
    od.putUnitDouble(charIDToTypeID("Vrtc"), charIDToTypeID("#Pxl"), 0);
    desc.putObject(charIDToTypeID("Ofst"), charIDToTypeID("Ofst"), od);

    // now your four‐corner list
    var quad = new ActionList();
    quad.putObject(charIDToTypeID("Pnt "), pointDescriptor(x1 + offL,   y1));
    quad.putObject(charIDToTypeID("Pnt "), pointDescriptor(x2 + offR,   y1));
    quad.putObject(charIDToTypeID("Pnt "), pointDescriptor(x2 + offR,   y2));
    quad.putObject(charIDToTypeID("Pnt "), pointDescriptor(x1 + offL,   y2));
    desc.putList(charIDToTypeID("Quad"), quad);

    // execute transform
    executeAction(charIDToTypeID("Trnf"), desc, DialogModes.NO);
}

run();
