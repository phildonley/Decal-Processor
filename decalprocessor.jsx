#target photoshop
app.bringToFront();

//–– Helpers ––//

// Prompt for a folder
function selectFolder(msg) {
  var f = Folder.selectDialog(msg);
  if (!f) throw "No folder selected.";
  return f;
}

// Drop shadow via Action Manager
function addDropShadow() {
  var desc = new ActionDescriptor(),
      ref  = new ActionReference();
  ref.putEnumerated( charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt") );
  desc.putReference( charIDToTypeID("null"), ref );

  var fx = new ActionDescriptor();
  fx.putUnitDouble   ( charIDToTypeID("Opct"), charIDToTypeID("#Prc"), 21 );
  fx.putEnumerated   ( charIDToTypeID("Md  "), charIDToTypeID("BlnM"), charIDToTypeID("Nrml") );
  fx.putUnitDouble   ( charIDToTypeID("lagl"), charIDToTypeID("#Ang"), 45 );
  fx.putBoolean      ( charIDToTypeID("uglg"), true );
  fx.putUnitDouble   ( charIDToTypeID("Dstn"), charIDToTypeID("#Pxl"), 7 );
  fx.putUnitDouble   ( charIDToTypeID("Ckmt"), charIDToTypeID("#Prc"), 14 );
  fx.putUnitDouble   ( charIDToTypeID("blur"), charIDToTypeID("#Pxl"), 8 );

  var list = new ActionList();
  list.putObject( charIDToTypeID("DrSh"), fx );
  desc.putList( charIDToTypeID("Lefx"), list );

  executeAction( charIDToTypeID("setd"), desc, DialogModes.NO );
}

// Proportional resize of the **active** layer to fit inside maxW×maxH
function resizeActiveLayer(maxW, maxH) {
  var doc   = app.activeDocument,
      lyr   = doc.activeLayer,
      b     = lyr.bounds,
      w     = b[2].as("px") - b[0].as("px"),
      h     = b[3].as("px") - b[1].as("px"),
      scale = Math.min(maxW / w, maxH / h) * 100;
  lyr.resize(scale, scale, AnchorPosition.MIDDLECENTER);
}

// Center the **active** layer in the canvas
function centerActiveLayer() {
  var doc = app.activeDocument,
      lyr = doc.activeLayer,
      b   = lyr.bounds,
      lw  = b[2].as("px") - b[0].as("px"),
      lh  = b[3].as("px") - b[1].as("px"),
      dw  = doc.width.as("px"),
      dh  = doc.height.as("px"),
      dx  = (dw - lw)/2 - b[0].as("px"),
      dy  = (dh - lh)/2 - b[1].as("px");
  lyr.translate(dx, dy);
}

// Create a light, blurred, offset “shadow” from the current layer
function addManualShadow(maxBlur, offsetX, offsetY, shadowOpacity){
    var doc   = app.activeDocument,
        decal = doc.activeLayer,
        // duplicate the decal layer
        shad  = decal.duplicate();
    shad.name = "shadow";
    
    // fill the shadow layer with 50% gray
    doc.activeLayer = shad;
    var gray = new SolidColor();
    gray.rgb.red   = 128;
    gray.rgb.green = 128;
    gray.rgb.blue  = 128;
    shad.clear();                     // remove any layer style
    shad.rasterize(RasterizeType.ENTIRELAYER);
    doc.selection.selectAll();
    doc.selection.fill(gray);
    doc.selection.deselect();
    
    // blur it
    shad.applyGaussianBlur(maxBlur);
    
    // lower opacity
    shad.opacity = shadowOpacity;
    
    // move it behind and offset
    shad.move(decal, ElementPlacement.PLACEBEFORE);
    shad.translate(offsetX, offsetY);
    
    // put decal back on top
    doc.activeLayer = decal;
}

// Process one file
function processFile(file, stdFld, rotFld) {
  // 1) OPEN & COPY
  var src = open(file);
  app.activeDocument = src;
  src.selection.selectAll();
  src.selection.copy();
  src.close(SaveOptions.DONOTSAVECHANGES);

  // 2) STANDARD IMAGE
  var stdDoc = app.documents.add(1600, 1600, 72, "Std", NewDocumentMode.RGB, DocumentFill.WHITE);
  stdDoc.paste();
  stdDoc.activeLayer.name = "decal";
  resizeActiveLayer(1520, 1520);
  centerActiveLayer();
  addManualShadow(
  /* maxBlur    */ 8, 
  /* offsetX    */ 7, 
  /* offsetY    */ 7, 
  /* opacity %  */ 21
);
  stdDoc.flatten();

  var jpgOpts = new JPEGSaveOptions(); jpgOpts.quality = 12;
  var outStd  = new File(stdFld, file.name);
  stdDoc.saveAs(outStd, jpgOpts, true);
  stdDoc.close(SaveOptions.DONOTSAVECHANGES);

  // 3) ROTATED IMAGE (2D)
  var rotDoc = open(outStd);
  app.activeDocument = rotDoc;
  rotDoc.activeLayer.rotate(30, AnchorPosition.MIDDLECENTER);
  centerActiveLayer();            // re-center after rotation
  addManualShadow(
  /* maxBlur    */ 8, 
  /* offsetX    */ 7, 
  /* offsetY    */ 7, 
  /* opacity %  */ 21
);
  rotDoc.flatten();

  // rename sequence ⇒ 103
  var base    = file.name.replace(/\.[^\.]+$/, ""),
      newName = base.replace(/\d+$/, "103") + ".jpg",
      outRot  = new File(rotFld, newName);
  rotDoc.saveAs(outRot, jpgOpts, true);
  rotDoc.close(SaveOptions.DONOTSAVECHANGES);
}

//–– Main ––//
function main() {
  var srcFld = selectFolder("Select source folder of decals"),
      outFld = selectFolder("Select parent output folder");

  var std = new Folder(outFld + "/Standard");
  if (!std.exists) std.create();
  var rot = new Folder(outFld + "/Rotated");
  if (!rot.exists) rot.create();

  var imgs = srcFld.getFiles(/\.(jpg|jpeg|png|psd)$/i);
  for (var i = 0; i < imgs.length; i++) {
    try {
      processFile(imgs[i], std, rot);
    } catch (e) {
      alert("Error on " + imgs[i].name + ":\n" + e);
    }
  }
  alert("All done!");
}

main();