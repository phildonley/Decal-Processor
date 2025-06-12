#target photoshop
app.bringToFront();

/** Simple logger */
function log(msg) { $.writeln(msg); }

/** Prompt for a folder */
function selectFolder(promptText) {
  var f = Folder.selectDialog(promptText);
  if (!f) throw new Error("No folder selected.");
  return f;
}

/** Resize & center a layer within maxW×maxH on its document */
function resizeAndCenterLayer(doc, layer, maxW, maxH) {
  if (layer.kind === LayerKind.SMARTOBJECT) 
    layer.rasterize(RasterizeType.ENTIRELAYER);
  if (layer.isBackgroundLayer) 
    layer.isBackgroundLayer = false;

  var b      = layer.bounds;
  var left   = b[0].as("px"),
      top    = b[1].as("px"),
      right  = b[2].as("px"),
      bottom = b[3].as("px");

  var w = right - left,
      h = bottom - top;
  if (w < 2 || h < 2) 
    throw new Error("Layer too small: " + w + "×" + h);

  var scale = Math.min(maxW / w, maxH / h);
  layer.resize(scale * 100, scale * 100);

  b      = layer.bounds;
  left   = b[0].as("px");
  top    = b[1].as("px");
  right  = b[2].as("px");
  bottom = b[3].as("px");
  w = right - left;
  h = bottom - top;

  var dx = (doc.width.as("px")  / 2) - (left + w/2),
      dy = (doc.height.as("px") / 2) - (top  + h/2);
  layer.translate(dx, dy);
}

/** Process one file: standard + rotated using your recorded actions */
function processImage(file, stdFolder, rotFolder) {
  log("Processing: " + file.name);
  var base = file.name.replace(/\.\w+$/, "");
  var doc  = open(file);

  // 1) Create white 1600×1600 canvas
  var canvas = app.documents.add(1600, 1600, 72, "Canvas",
                                 NewDocumentMode.RGB, DocumentFill.WHITE);

  // 2) Paste decal into canvas
  app.activeDocument = doc;
  doc.activeLayer.duplicate(canvas, ElementPlacement.PLACEATBEGINNING);
  doc.close(SaveOptions.DONOTSAVECHANGES);
  app.activeDocument = canvas;

  // 3) Resize & center decal
  resizeAndCenterLayer(canvas, canvas.activeLayer, 1520, 1520);

  // 4) Duplicate BEFORE applying any shadow
  var rotDoc = canvas.duplicate();

  // —— Standard view ——  
  app.activeDocument = canvas;
  app.doAction("Shadow", "Default Actions");    // your recorded Shadow action
  canvas.flatten();
  canvas.saveAs(
    new File(stdFolder + "/" + file.name),
    new JPEGSaveOptions(),
    /*asCopy*/ true,
    Extension.LOWERCASE
  );
  canvas.close(SaveOptions.DONOTSAVECHANGES);

  // —— Rotated view ——  
  app.activeDocument = rotDoc;
  resizeAndCenterLayer(rotDoc, rotDoc.activeLayer, 1520, 1520);
  app.doAction("Perspective", "Default Actions"); // your recorded Perspective action
  rotDoc.flatten();
  rotDoc.saveAs(
    new File(rotFolder + "/" + base + "103.jpg"),
    new JPEGSaveOptions(),
    /*asCopy*/ true,
    Extension.LOWERCASE
  );
  rotDoc.close(SaveOptions.DONOTSAVECHANGES);
}

/** Entry point: batch process all images in a folder */
function run() {
  var src    = selectFolder("Select folder with decal images"),
      output = selectFolder("Select output location");

  // gather files
  var files = src.getFiles(/\.(jpe?g|png|psd)$/i);
  alert("Found " + files.length + " image(s).");
  if (!files.length) return;

  // prepare output folders
  var stdDir = new Folder(output + "/Standard");
  if (!stdDir.exists) stdDir.create();
  var rotDir = new Folder(output + "/Rotated");
  if (!rotDir.exists) rotDir.create();

  // process each
  for (var i = 0; i < files.length; i++) {
    try {
      processImage(files[i], stdDir.fsName, rotDir.fsName);
    } catch (e) {
      alert("❌ Error on " + files[i].name + ":\n" + e.message);
    }
  }

  alert("✅ Done! Check Standard & Rotated folders.");
}

run();
