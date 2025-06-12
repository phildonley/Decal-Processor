#target photoshop
app.bringToFront();

/** Prompt the user to select a folder */
function selectFolder(promptText) {
    var f = Folder.selectDialog(promptText);
    if (!f) throw new Error("No folder selected.");
    return f;
}

/** Resize & center a single layer within maxW×maxH on its document */
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

/** Process the “Standard” version of one file */
function processStandard(file, stdFS) {
    var doc    = open(file),
        canvas = app.documents.add(1600, 1600, 72, "Canvas", NewDocumentMode.RGB, DocumentFill.WHITE);

    app.activeDocument = doc;
    doc.activeLayer.duplicate(canvas, ElementPlacement.PLACEATBEGINNING);
    doc.close(SaveOptions.DONOTSAVECHANGES);

    app.activeDocument = canvas;
    resizeAndCenterLayer(canvas, canvas.activeLayer, 1520, 1520);
    app.doAction("Shadow", "Default Actions"); // your recorded Shadow action
    canvas.flatten();

    var stdFile = new File(stdFS + "/" + file.name);
    var jpegOpt = new JPEGSaveOptions();
    jpegOpt.quality = 12;
    canvas.saveAs(stdFile, jpegOpt, true, Extension.LOWERCASE);
    canvas.close(SaveOptions.DONOTSAVECHANGES);
}

/** Process the “Rotated” version of one file */
function processRotated(file, rotFS) {
    var base   = file.name.replace(/\.\w+$/, ""),
        doc    = open(file),
        canvas = app.documents.add(1600, 1600, 72, "Canvas", NewDocumentMode.RGB, DocumentFill.WHITE);

    app.activeDocument = doc;
    doc.activeLayer.duplicate(canvas, ElementPlacement.PLACEATBEGINNING);
    doc.close(SaveOptions.DONOTSAVECHANGES);

    app.activeDocument = canvas;
    app.doAction("Perspective", "Default Actions"); // your recorded Perspective action
    resizeAndCenterLayer(canvas, canvas.activeLayer, 1520, 1520);
    canvas.flatten();

    var rotFile = new File(rotFS + "/" + base + "103.jpg");
    var jpegOpt = new JPEGSaveOptions();
    jpegOpt.quality = 12;
    canvas.saveAs(rotFile, jpegOpt, true, Extension.LOWERCASE);
    canvas.close(SaveOptions.DONOTSAVECHANGES);
}

/** Entry point */
function run() {
  // 1) pick source + parent output
  var src    = selectFolder("Select folder with decal images"),
      parent = selectFolder("Select output location");

  // 2) build a timestamped subfolder: Decals-MMDDYYYY-HHMM
  var now = new Date();
  function pad(n){ return (n<10?"0":"") + n; }
  var name = "Decals-" +
             pad(now.getMonth()+1) +
             pad(now.getDate()) +
             now.getFullYear() + "-" +
             pad(now.getHours()) +
             pad(now.getMinutes());
  var outFolder = new Folder(parent.fsName + "/" + name);
  if (!outFolder.exists) outFolder.create();

  // 3) find your images
  var files = src.getFiles(/\.(jpe?g|png|psd)$/i);
  alert("Found " + files.length + " image(s).");

  // 4) batch-process, sending both variants into the same folder
  for (var i = 0; i < files.length; i++) {
    try {
      processStandard(files[i], outFolder.fsName);  // saves .105.jpg
      processRotated (files[i], outFolder.fsName);  // saves .103.jpg
    } catch (e) {
      alert("Error on " + files[i].name + ":\n" + e.message);
    }
  }

  alert("✅ Done! All output in “" + outFolder.fsName + "”");
}

run();
