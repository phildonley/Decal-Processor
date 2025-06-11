#target photoshop
app.bringToFront();

function log(msg) { $.writeln(msg); }

/** Prompt user to pick a folder */
function selectFolder(promptText) {
    var f = Folder.selectDialog(promptText);
    if (!f) throw new Error("No folder selected.");
    return f;
}

/** Gather all image files in the folder */
function getImageFiles(folder) {
    var all = folder.getFiles();
    var images = [];
    for (var i = 0; i < all.length; i++) {
        var f = all[i];
        if (f instanceof File) {
            var n = f.name.toLowerCase();
            if (n.match(/\.(jpg|jpeg|png|psd)$/)) {
                images.push(f);
            }
        }
    }
    log("Found " + images.length + " image(s) in folder.");
    return images;
}

/** Add your standard drop shadow via ActionDescriptor */
function addDropShadow() {
    var idsetd = charIDToTypeID("setd"),
        desc1 = new ActionDescriptor(),
        ref1  = new ActionReference();
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
    ds.putUnitDouble( charIDToTypeID("Opct"),        charIDToTypeID("#Prc"),  21.0);
    ds.putUnitDouble( charIDToTypeID("Angl"),        charIDToTypeID("#Ang"),  45.0);
    ds.putBoolean( charIDToTypeID("useGlobalAngle"), true);
    ds.putUnitDouble( charIDToTypeID("Dstn"),        charIDToTypeID("#Pxl"),   7.0);
    ds.putUnitDouble( charIDToTypeID("Ckmt"),        charIDToTypeID("#Pxl"),   8.0);
    ds.putUnitDouble( charIDToTypeID("Sprd"),        charIDToTypeID("#Prc"),  14.0);

    var clr = new ActionDescriptor();
    clr.putDouble(charIDToTypeID("Rd  "), 0.0);
    clr.putDouble(charIDToTypeID("Grn "), 0.0);
    clr.putDouble(charIDToTypeID("Bl  "), 0.0);
    ds.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), clr);

    fxDesc.putObject(charIDToTypeID("DrSh"), charIDToTypeID("DrSh"), ds);
    desc1.putObject(charIDToTypeID("T   "), charIDToTypeID("Lefx"), fxDesc);
    executeAction(idsetd, desc1, DialogModes.NO);
}

/** Resize & center, with bounds checks */
function resizeAndCenterLayer(doc, layer, maxW, maxH) {
    if (layer.kind === LayerKind.SMARTOBJECT)
        layer.rasterize(RasterizeType.ENTIRELAYER);
    if (layer.isBackgroundLayer)
        layer.isBackgroundLayer = false;

    var b = layer.bounds;
    var w = b[2].as("px") - b[0].as("px");
    var h = b[3].as("px") - b[1].as("px");
    if (w <= 1 || h <= 1) throw new Error("Invalid layer size: " + w + "×" + h);

    var scale = Math.min(maxW / w, maxH / h);
    layer.resize(scale * 100, scale * 100);

    b = layer.bounds;
    w = b[2].as("px") - b[0].as("px");
    h = b[3].as("px") - b[1].as("px");
    var dx = (doc.width.as("px") / 2) - (b[0].as("px") + w/2);
    var dy = (doc.height.as("px") / 2) - (b[1].as("px") + h/2);
    layer.translate(dx, dy);
}

/** Helper for corner descriptors */
function pointDescriptor(x, y) {
    var d = new ActionDescriptor();
    d.putUnitDouble(charIDToTypeID("Hrzn"), charIDToTypeID("#Pxl"), x);
    d.putUnitDouble(charIDToTypeID("Vrtc"), charIDToTypeID("#Pxl"), y);
    return d;
}

/** Robust corner-distort for ~30° left perspective */
function applyLeftPerspectiveSkew(layer) {
    app.activeDocument.activeLayer = layer;
    if (layer.isBackgroundLayer) layer.isBackgroundLayer = false;

    var b = layer.bounds;
    var x1 = b[0].as("px"), y1 = b[1].as("px");
    var x2 = b[2].as("px"), y2 = b[3].as("px");
    var offset = 0.3 * (x2 - x1);

    var idTrnf = charIDToTypeID("Trnf"),
        desc  = new ActionDescriptor(),
        ref   = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    desc.putReference(charIDToTypeID("null"), ref);
    desc.putEnumerated(charIDToTypeID("FTcs"), charIDToTypeID("QCSt"), charIDToTypeID("Qcsa"));

    var quad = new ActionList();
    quad.putObject(charIDToTypeID("Pnt "), pointDescriptor(x1 + offset,   y1));
    quad.putObject(charIDToTypeID("Pnt "), pointDescriptor(x2,           y1 - offset));
    quad.putObject(charIDToTypeID("Pnt "), pointDescriptor(x2,           y2 + offset));
    quad.putObject(charIDToTypeID("Pnt "), pointDescriptor(x1 + offset,   y2));
    desc.putList(charIDToTypeID("Quad"), quad);

    executeAction(idTrnf, desc, DialogModes.NO);
}

/** Process one file */
function processImage(file, stdFolder, rotFolder) {
    log("Processing: " + file.name);
    var base = file.name.replace(/\.\d+/, "");
    var doc = open(file);

    // New canvas
    var canvas = app.documents.add(1600,1600,72,"Canvas",NewDocumentMode.RGB,DocumentFill.WHITE);
    app.activeDocument = doc;
    doc.activeLayer.duplicate(canvas, ElementPlacement.PLACEATBEGINNING);
    doc.close(SaveOptions.DONOTSAVECHANGES);
    app.activeDocument = canvas;

    // Standard
    resizeAndCenterLayer(canvas, canvas.activeLayer, 1520, 1520);
    addDropShadow();
    canvas.flatten();
    canvas.saveAs(new File(stdFolder + "/" + file.name), new JPEGSaveOptions(), true);

    // Rotated
    var rot = canvas.duplicate();
    app.activeDocument = rot;
    try {
        applyLeftPerspectiveSkew(rot.activeLayer);
        addDropShadow();
    } catch(e) {
        log("⚠️ Skew skipped: " + e.message);
    }
    rot.flatten();
    rot.saveAs(new File(rotFolder + "/" + base + "103.jpg"), new JPEGSaveOptions(), true);
    rot.close(SaveOptions.DONOTSAVECHANGES);
    canvas.close(SaveOptions.DONOTSAVECHANGES);
}

/** Entry point */
function run() {
    var src = selectFolder("Select folder with decal images"),
        out = selectFolder("Select output location");

    var std = new Folder(out + "/Standard"); if (!std.exists) std.create();
    var rot = new Folder(out + "/Rotated");  if (!rot.exists) rot.create();

    var files = getImageFiles(src);
    for (var i = 0; i < files.length; i++) {
        try {
            processImage(files[i], std.fsName, rot.fsName);
        } catch(e) {
            alert("❌ Error on " + files[i].name + ":\n" + e.message);
        }
    }
    alert("✅ All done. Check the Standard & Rotated folders.");
}

run();
