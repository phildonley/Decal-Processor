#target photoshop
app.bringToFront();

// ——— Prompt user to pick a folder ———
function selectFolder(promptText) {
    var f = Folder.selectDialog(promptText);
    if (!f) throw new Error("No folder selected.");
    return f;
}

// ——— Resize & perfectly center a layer ———
function resizeAndCenterLayer(doc, layer, maxW, maxH) {
    // ensure pixel content
    if (layer.kind === LayerKind.SMARTOBJECT) layer.rasterize(RasterizeType.ENTIRELAYER);
    if (layer.isBackgroundLayer) layer.isBackgroundLayer = false;

    // get bounds
    var b      = layer.bounds;
    var left   = b[0].as("px"),
        top    = b[1].as("px"),
        right  = b[2].as("px"),
        bottom = b[3].as("px");

    var w = right - left,
        h = bottom - top;
    if (w < 2 || h < 2) throw new Error("Layer too small: " + w + "×" + h);

    // scale to fit padded area
    var scale = Math.min(maxW / w, maxH / h);
    layer.resize(scale * 100, scale * 100);

    // re-read bounds
    b      = layer.bounds;
    left   = b[0].as("px");
    top    = b[1].as("px");
    right  = b[2].as("px");
    bottom = b[3].as("px");
    w = right - left;
    h = bottom - top;

    // center on canvas
    var dx = (doc.width.as("px")  / 2) - (left + w/2),
        dy = (doc.height.as("px") / 2) - (top  + h/2);
    layer.translate(dx, dy);
}

// ——— Main per-file routine ———
function processImage(file, stdFolder, rotFolder) {
    // derive base name (strip extension)
    var base = file.name.replace(/\.\w+$/, "");
    var doc  = open(file);

    // create white 1600×1600 canvas
    var canvas = app.documents.add(1600, 1600, 72, "Canvas",
                                   NewDocumentMode.RGB, DocumentFill.WHITE);

    // paste decal into canvas
    app.activeDocument = doc;
    doc.activeLayer.duplicate(canvas, ElementPlacement.PLACEATBEGINNING);
    doc.close(SaveOptions.DONOTSAVECHANGES);
    app.activeDocument = canvas;

    // — Standard view —
    resizeAndCenterLayer(canvas, canvas.activeLayer, 1520, 1520);
    // run your recorded “Shadow” action:
    app.doAction("Shadow", "Default Actions");
    canvas.flatten();
    canvas.saveAs(new File(stdFolder + "/" + file.name),
                  new JPEGSaveOptions(), /*asCopy*/ true, Extension.LOWERCASE);

    // — Rotated view —
    var rot = canvas.duplicate();
    app.activeDocument = rot;
    resizeAndCenterLayer(rot, rot.activeLayer, 1520, 1520);
    // run your recorded “Perspective” action:
    app.doAction("Perspective", "Default Actions");
    // re-center in case the perspective action moved it
    resizeAndCenterLayer(rot, rot.activeLayer, 1520, 1520);
    rot.flatten();
    rot.saveAs(new File(rotFolder + "/" + base + "103.jpg"),
               new JPEGSaveOptions(), /*asCopy*/ true, Extension.LOWERCASE);

    // clean up
    rot.close(SaveOptions.DONOTSAVECHANGES);
    canvas.close(SaveOptions.DONOTSAVECHANGES);
}

// ——— Entry point ———
function run() {
    var src    = selectFolder("Select folder with decal images"),
        output = selectFolder("Select output location");

    // gather only the image files
    var files = src.getFiles(/\.(jpe?g|png|psd)$/i);
    alert("Found " + files.length + " image(s) to process.");
    if (!files.length) return;

    // make output subfolders
    var stdFolder = new Folder(output + "/Standard");
    if (!stdFolder.exists) stdFolder.create();
    var rotFolder = new Folder(output + "/Rotated");
    if (!rotFolder.exists) rotFolder.create();

    // process each
    for (var i = 0; i < files.length; i++) {
        try {
            processImage(files[i], stdFolder.fsName, rotFolder.fsName);
        } catch (e) {
            alert("Error on " + files[i].name + ":\n" + e.message);
        }
    }

    alert("✅ All done! Check your “Standard” & “Rotated” folders.");
}

run();
