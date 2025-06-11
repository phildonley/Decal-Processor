#target photoshop
app.bringToFront();

//–– Helpers ––//

// Prompt for a folder; throw if none chosen
function pickFolder(msg) {
  var f = Folder.selectDialog(msg);
  if (!f) throw "User cancelled.";
  return f.fsName;  // return as string
}

// Proportional resize of the active layer into maxW×maxH
function resizeLayer(maxW, maxH) {
  var doc = app.activeDocument,
      lyr = doc.activeLayer,
      b   = lyr.bounds,
      w   = b[2].as("px") - b[0].as("px"),
      h   = b[3].as("px") - b[1].as("px"),
      scale = Math.min(maxW/w, maxH/h)*100;
  lyr.resize(scale, scale, AnchorPosition.MIDDLECENTER);
}

// Center the active layer in its canvas
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

// Create a manual “shadow” layer by duplicating the decal, coloring it gray, blurring, opacity, offset.
function addManualShadow(blurRadius, offsetX, offsetY, opacityPct) {
  var doc   = app.activeDocument,
      decal = doc.activeLayer,
      shad  = decal.duplicate();      // copy decal
  shad.name = "shadow";

  // color-overlay the copy to 50% gray via layer-style + rasterize
  var desc = new ActionDescriptor(),
      ref  = new ActionReference();
  ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
  desc.putReference(charIDToTypeID("null"), ref);

  var fx = new ActionDescriptor(),
      col = new ActionDescriptor();
  col.putDouble(charIDToTypeID("Rd  "), 128);
  col.putDouble(charIDToTypeID("Grn "), 128);
  col.putDouble(charIDToTypeID("Bl  "), 128);
  fx.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), col);
  fx.putUnitDouble(charIDToTypeID("Opct"), charIDToTypeID("#Prc"), 100);

  var list = new ActionList();
  list.putObject(charIDToTypeID("SoFi"), fx);
  desc.putList(charIDToTypeID("Lefx"), list);

  executeAction(charIDToTypeID("setd"), desc, DialogModes.NO);

  // rasterize that style so it becomes pixels
  shad.rasterize(RasterizeType.LAYERSTYLE);

  // blur, fade, offset
  shad.applyGaussianBlur(blurRadius);
  shad.opacity = opacityPct;
  shad.move(decal, ElementPlacement.PLACEBEFORE);
  shad.translate(offsetX, offsetY);

  // restore decal as active
  doc.activeLayer = decal;
}

// Process one image file
function processOne(inPath, stdPath, rotPath) {
  // open & copy
  var doc = open(File(inPath));
  doc.selection.selectAll();
  doc.selection.copy();
  doc.close(SaveOptions.DONOTSAVECHANGES);

  // ----- STANDARD IMAGE -----
  var stdDoc = app.documents.add(1600, 1600, 72, "Standard", NewDocumentMode.RGB, DocumentFill.WHITE);
  stdDoc.paste();
  stdDoc.activeLayer.name = "decal";
  resizeLayer(1520, 1520);
  centerLayer();
  addManualShadow(8, 7, 7, 21);
  stdDoc.flatten();

  // save JPG
  var outStd = stdPath + "/" + (new File(inPath)).name;
  stdDoc.saveAs(File(outStd), new JPEGSaveOptions(), true);
  stdDoc.close(SaveOptions.DONOTSAVECHANGES);

  // ----- ROTATED IMAGE -----
  // re-open the standard so we get the same exact image
  var rotDoc = open(File(outStd));
  rotDoc.activeLayer.rotate(30, AnchorPosition.MIDDLECENTER);
  centerLayer();
  addManualShadow(8, 7, 7, 21);
  rotDoc.flatten();

  // rename final file to sequence 103
  var base    = (new File(inPath)).name.replace(/\.[^\.]+$/, ""),
      newName = base.replace(/\d+$/, "103") + ".jpg",
      outRot  = rotPath + "/" + newName;
  rotDoc.saveAs(File(outRot), new JPEGSaveOptions(), true);
  rotDoc.close(SaveOptions.DONOTSAVECHANGES);
}

//–– Main ––//
function main() {
  var srcFld = pickFolder("Select your source folder of decals"),
      outFld = pickFolder("Select your OUTPUT parent folder"),
      stdFld = outFld + "/Standard",
      rotFld = outFld + "/Rotated";

  // ensure output subfolders exist
  new Folder(stdFld).create();
  new Folder(rotFld).create();

  var list = Folder(srcFld).getFiles(/\.(jpg|jpeg|png|psd)$/i);
  for (var i = 0; i < list.length; i++) {
    try {
      processOne(list[i].fsName, stdFld, rotFld);
    } catch (e) {
      alert("❗ Error on " + list[i].name + ":\n" + e);
    }
  }
  alert("✅ All done!");
}

main();