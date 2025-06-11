#target photoshop
app.bringToFront();
app.displayDialogs = DialogModes.NO;

//—— Helpers ——//

function pickFolder(msg) {
  var f = Folder.selectDialog(msg);
  if (!f) throw "User cancelled";
  return f;
}

function resizeLayer(maxW, maxH) {
  var doc = app.activeDocument,
      lyr = doc.activeLayer,
      b   = lyr.bounds,
      w   = b[2].as("px") - b[0].as("px"),
      h   = b[3].as("px") - b[1].as("px"),
      p   = Math.min(maxW/w, maxH/h) * 100;
  lyr.resize(p, p, AnchorPosition.MIDDLECENTER);
}

function centerLayer() {
  var doc = app.activeDocument,
      lyr = doc.activeLayer,
      b   = lyr.bounds,
      lw  = b[2].as("px") - b[0].as("px"),
      lh  = b[3].as("px") - b[1].as("px"),
      cw  = doc.width.as("px"),
      ch  = doc.height.as("px"),
      dx  = (cw - lw)/2 - b[0].as("px"),
      dy  = (ch - lh)/2 - b[1].as("px");
  lyr.translate(dx, dy);
}

function addBasicShadow(blurRadius, offsetX, offsetY, opacityPct) {
  var doc   = app.activeDocument,
      decal = doc.activeLayer,
      shad  = decal.duplicate();
  shad.name      = "shadow";
  try { shad.applyGaussianBlur(blurRadius); } catch(e){}
  shad.blendMode = BlendMode.MULTIPLY;
  shad.opacity   = opacityPct;
  shad.move(decal, ElementPlacement.PLACEBEFORE);
  shad.translate(offsetX, offsetY);
  doc.activeLayer = decal;
}

//—— Main per-file routine ——//

function processFile(file, stdFld, rotFld) {
  // 1) open & copy
  var src = open(file);
  app.activeDocument = src;
  src.selection.selectAll();
  src.selection.copy();
  src.close(SaveOptions.DONOTSAVECHANGES);

  // 2) build STANDARD doc
  var stdDoc = app.documents.add(1600,1600,72,"Std",NewDocumentMode.RGB,DocumentFill.WHITE);
  app.activeDocument = stdDoc;
  stdDoc.paste();
  stdDoc.activeLayer.name = "decal";
  resizeLayer(1520,1520);
  centerLayer();
  addBasicShadow(8,7,7,21);

  // 2a) duplicate for rotation
  app.activeDocument = stdDoc;
  var rotDoc = stdDoc.duplicate("RotCanvas");

  // 2b) flatten & save STANDARD
  app.activeDocument = stdDoc;
  stdDoc.flatten();
  var outStd = new File(stdFld, file.name);
  stdDoc.saveAs(outStd, new JPEGSaveOptions(), true, Extension.LOWERCASE);
  stdDoc.close(SaveOptions.DONOTSAVECHANGES);

  // 3) prepare ROTATED doc
  app.activeDocument = rotDoc;
  var decalLayer = rotDoc.layers.getByName("decal");
  rotDoc.activeLayer = decalLayer;

  // 3a) rotate & re-shadow
  decalLayer.rotate(30, AnchorPosition.MIDDLECENTER);
  centerLayer();
  addBasicShadow(8,7,7,21);

  // 3b) flatten & save ROTATED
  app.activeDocument = rotDoc;
  rotDoc.flatten();

  // compute new filename with sequence 103
  var base    = file.name.replace(/\.[^\.]+$/, ""),
      newName = base.replace(/\d+$/, "103") + ".jpg";

  var outRot  = new File(rotFld, newName);
  rotDoc.saveAs(outRot, new JPEGSaveOptions(), true, Extension.LOWERCASE);
  rotDoc.close(SaveOptions.DONOTSAVECHANGES);
} // ← here is the missing closing brace

//—— Driver ——//

function main() {
  var srcF = pickFolder("Select source folder"),
      outP = pickFolder("Select output parent folder"),
      stdF = new Folder(outP.fsName + "/Standard"),
      rotF = new Folder(outP.fsName + "/Rotated");

  if (!stdF.exists) stdF.create();
  if (!rotF.exists) rotF.create();

  var list = srcF.getFiles(/\.(jpg|jpeg|png|psd)$/i);
  for (var i = 0; i < list.length; i++) {
    try {
      processFile(list[i], stdF, rotF);
    } catch (e) {
      alert("Error on " + list[i].name + "\n" + e);
    }
  }
  alert("All done!");
}

main();