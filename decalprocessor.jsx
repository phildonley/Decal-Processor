#target photoshop
app.bringToFront();

// pick a folder
function pickFolder(msg) {
  var f = Folder.selectDialog(msg);
  if (!f) throw "Cancel";
  return f.fsName;
}

// resize active layer to fit within maxW×maxH
function resizeLayer(maxW, maxH) {
  var doc = app.activeDocument,
      lyr = doc.activeLayer,
      b   = lyr.bounds,
      w   = b[2].as("px") - b[0].as("px"),
      h   = b[3].as("px") - b[1].as("px"),
      p   = Math.min(maxW/w, maxH/h)*100;
  lyr.resize(p, p, AnchorPosition.MIDDLECENTER);
}

// center active layer in canvas
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

// simplified shadow: duplicate, blur, multiply, offset
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

function processOne(inPath, stdFld, rotFld) {
  // open & copy
  var doc = open(File(inPath));
  doc.selection.selectAll(); doc.selection.copy();
  doc.close(SaveOptions.DONOTSAVECHANGES);

  // Standard
  var stdDoc = app.documents.add(1600,1600,72,"Std",NewDocumentMode.RGB,DocumentFill.WHITE);
  stdDoc.paste(); stdDoc.activeLayer.name = "decal";
  resizeLayer(1520,1520); centerLayer();
  addBasicShadow(8,7,7,21);
  stdDoc.flatten();
  var jpg = new JPEGSaveOptions(); jpg.quality = 12;
  var outStd = stdFld + "/" + (new File(inPath)).name;
  stdDoc.saveAs(File(outStd), jpg, true);
  stdDoc.close(SaveOptions.DONOTSAVECHANGES);

  // Rotated
  var rotDoc = open(File(outStd));
  rotDoc.activeLayer.rotate(30,AnchorPosition.MIDDLECENTER);
  centerLayer();
  addBasicShadow(8,7,7,21);
  rotDoc.flatten();
  var base    = (new File(inPath)).name.replace(/\.[^\.]+$/,""),
      newName = base.replace(/\d+$/,"103") + ".jpg",
      outRot  = rotFld + "/" + newName;
  rotDoc.saveAs(File(outRot), jpg, true);
  rotDoc.close(SaveOptions.DONOTSAVECHANGES);
}

function main() {
  var src  = pickFolder("Select source folder"),
      out  = pickFolder("Select output parent folder"),
      stdF = out + "/Standard",
      rotF = out + "/Rotated";
  new Folder(stdF).create();
  new Folder(rotF).create();
  var list = Folder(src).getFiles(/\.(jpg|jpeg|png|psd)$/i);
  for (var i=0; i<list.length; i++) {
    try { processOne(list[i].fsName, stdF, rotF); }
    catch(e) { alert("Error on "+list[i].name+"\n"+e); }
  }
  alert("All done!");
}

main();