#target photoshop
app.bringToFront();

//–– Helpers ––//

// Prompt user to pick a folder
function selectFolder(promptText) {
    var f = Folder.selectDialog(promptText);
    if (!f) { throw "No folder selected."; }
    return f;
}

// Apply your exact drop-shadow settings via Action Manager
function addDropShadowToCurrentLayer() {
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
        ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    desc.putReference(charIDToTypeID("null"), ref);

    var effectDesc = new ActionDescriptor();
        effectDesc.putUnitDouble(charIDToTypeID("Opct"), charIDToTypeID("#Prc"), 21);
        effectDesc.putEnumerated(charIDToTypeID("Md  "), charIDToTypeID("BlnM"), charIDToTypeID("Nrml"));
        effectDesc.putUnitDouble(charIDToTypeID("lagl"), charIDToTypeID("#Ang"), 45);
        effectDesc.putBoolean(charIDToTypeID("uglg"), true); // use global light
        effectDesc.putUnitDouble(charIDToTypeID("Dstn"), charIDToTypeID("#Pxl"), 7);
        effectDesc.putUnitDouble(charIDToTypeID("Ckmt"), charIDToTypeID("#Prc"), 14); // spread (“Choke”)
        effectDesc.putUnitDouble(charIDToTypeID("blur"), charIDToTypeID("#Pxl"), 8);

    var list = new ActionList();
        list.putObject(charIDToTypeID("DrSh"), effectDesc);
    desc.putList(charIDToTypeID("Lefx"), list);

    executeAction(charIDToTypeID("setd"), desc, DialogModes.NO);
}

// Resize the **active** layer to fit within maxW×maxH (proportional)
function resizeActiveLayer(maxW, maxH) {
    var layer = app.activeDocument.activeLayer;
    var b = layer.bounds;
    var w = b[2].as("px") - b[0].as("px");
    var h = b[3].as("px") - b[1].as("px");
    var scale = Math.min(maxW / w, maxH / h);
    layer.resize(scale * 100, scale * 100, AnchorPosition.MIDDLECENTER);
}

// Simulate a simple perspective warp (placeholder—you can refine later)
function simplePerspectiveLeft(doc) {
    // This uses the “Free Transform” with corner offsets to fake a 30° turn:
    var idTrnf = charIDToTypeID("Trnf");
    var desc = new ActionDescriptor();
      var idnull = charIDToTypeID("null");
      var ref = new ActionReference();
        ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
      desc.putReference(idnull, ref);
      desc.putEnumerated(charIDToTypeID("FTcs"), charIDToTypeID("QCSt"), charIDToTypeID("Qcsa")); 
      // New corner coordinates:
      var quad = new ActionList();
      function pt(x,y){ 
        var p = new ActionDescriptor();
        p.putUnitDouble(charIDToTypeID("Hrzn"), charIDToTypeID("#Prc"), x);
        p.putUnitDouble(charIDToTypeID("Vrtc"), charIDToTypeID("#Prc"), y);
        quad.putObject(charIDToTypeID("Pnt "), p);
      }
      // 4 corners (percent-values): top-left, top-right, bottom-right, bottom-left
      pt(10,0);   // pull TL in
      pt(100,10); // push TR out
      pt(90,100); // push BR out
      pt(0,90);   // pull BL in
      desc.putList(charIDToTypeID("Ofst"), quad);
    executeAction(idTrnf, desc, DialogModes.NO);
}

// Process one file
function processFile(file, stdFolder, rotFolder) {
    // open source
    var src = open(file);
    app.activeDocument = src;

    // copy entire canvas
    src.selection.selectAll();
    src.selection.copy();
    src.close(SaveOptions.DONOTSAVECHANGES);

    // build a new 1600×1600 white canvas
    var stdDoc = app.documents.add(1600, 1600, 72, "StdCanvas", NewDocumentMode.RGB, DocumentFill.WHITE);

    // paste decal as its own layer
    stdDoc.paste();
    stdDoc.activeLayer.name = "decal";
    resizeActiveLayer(1520, 1520);

    // drop-shadow & export Standard
    addDropShadowToCurrentLayer();
    stdDoc.flatten();

    // **use the two-arg File constructor here:**
    var stdFile = new File(stdFolder, file.name);
    var jpgOpts = new JPEGSaveOptions();
        jpgOpts.quality = 12;
    stdDoc.saveAs(stdFile, jpgOpts, true);

    // create Rotated copy (we’ll rebuild decal layer fresh)
    stdDoc.close(SaveOptions.DONOTSAVECHANGES);

    // reopen the standard we just saved, so we can re-paste for rotation
    var reopened = open(stdFile);
    reopened.selection.selectAll();
    reopened.selection.copy();
    reopened.close(SaveOptions.DONOTSAVECHANGES);

    // new canvas for rotation
    var rDoc = app.documents.add(1600, 1600, 72, "RotCanvas", NewDocumentMode.RGB, DocumentFill.WHITE);
    rDoc.paste();
    rDoc.activeLayer.name = "decal";
    resizeActiveLayer(1520, 1520);

    // apply fake perspective + shadow
    simplePerspectiveLeft(rDoc);
    addDropShadowToCurrentLayer();
    rDoc.flatten();

    // rename sequence to 103
    var base = file.name.replace(/\.[^\.]+$/, "");
    var newName = base.replace(/\d+$/, "103") + ".jpg";

    // **and here too:**
    var rotFile = new File(rotFolder, newName);
    rDoc.saveAs(rotFile, jpgOpts, true);

    // close
    rDoc.close(SaveOptions.DONOTSAVECHANGES);
}

function main() {
    var srcFld = selectFolder("Select source folder of decals");
    var outFld = selectFolder("Select parent output folder");
    var std = new Folder(outFld + "/Standard");
    if (!std.exists) std.create();
    var rot = new Folder(outFld + "/Rotated");
    if (!rot.exists) rot.create();
    
    var imgs = srcFld.getFiles(/\.(jpg|jpeg|png|psd)$/i);
    for (var i = 0; i < imgs.length; i++) {
      processFile(imgs[i], std, rot);
    } catch (e) {
        alert("Error on " + imgs[i].name + "\n" + e);
      }
    }
    alert("All done!");
}

main();