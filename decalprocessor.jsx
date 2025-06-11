#target photoshop
app.bringToFront();

//──────────────────────────────────────────────────────────────────
// Constants
//──────────────────────────────────────────────────────────────────
var CANVAS_SIZE      = 1600;
var MAX_IMAGE_SIZE   = 1520;
var SUPPORTED_FORMATS = /\.(jpg|jpeg|png|psd|tiff|tif|bmp)$/i;

//──────────────────────────────────────────────────────────────────
// Logging & Error Handling
//──────────────────────────────────────────────────────────────────
function log(msg) {
    var ts = new Date().toISOString();
    $.writeln("[" + ts + "] " + msg);
}

function safeExecute(func, errorMsg) {
    try {
        return func();
    } catch (e) {
        log("ERROR: " + errorMsg + " – " + e.message);
        throw new Error(errorMsg + ": " + e.message);
    }
}

//──────────────────────────────────────────────────────────────────
// Folder & File Utilities
//──────────────────────────────────────────────────────────────────
function selectFolder(promptText) {
    return safeExecute(function() {
        var f = Folder.selectDialog(promptText);
        if (!f || !f.exists) throw new Error("Invalid folder");
        return f;
    }, "Folder selection failed");
}

function getImageFiles(folder) {
    return safeExecute(function() {
        var all = folder.getFiles(), out = [];
        for (var i = 0; i < all.length; i++) {
            var f = all[i];
            if (f instanceof File && f.exists && SUPPORTED_FORMATS.test(f.name.toLowerCase())) {
                out.push(f);
            }
        }
        log("Found " + out.length + " image(s)");
        return out;
    }, "Failed to gather image files");
}

//──────────────────────────────────────────────────────────────────
// Drop Shadow (ActionDescriptor)
//──────────────────────────────────────────────────────────────────
function addDropShadow(layer) {
    return safeExecute(function() {
        if (!layer) throw new Error("No layer for drop shadow");
        var doc = app.activeDocument;
        doc.activeLayer = layer;

        var idsetd = charIDToTypeID("setd"),
            desc1 = new ActionDescriptor(),
            ref1  = new ActionReference();
        ref1.putProperty(charIDToTypeID("Prpr"), charIDToTypeID("Lefx"));
        ref1.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        desc1.putReference(charIDToTypeID("null"), ref1);

        var fxDesc = new ActionDescriptor();
        fxDesc.putUnitDouble(charIDToTypeID("Scl "), charIDToTypeID("#Prc"), 100.0);

        var ds = new ActionDescriptor();
        ds.putBoolean(charIDToTypeID("enab"),           true);
        ds.putBoolean(charIDToTypeID("present"),        true);
        ds.putBoolean(charIDToTypeID("showInDialog"),   true);
        ds.putEnumerated(charIDToTypeID("Md  "), charIDToTypeID("BlnM"), charIDToTypeID("Nrml"));
        ds.putUnitDouble(charIDToTypeID("Opct"),        charIDToTypeID("#Prc"), 21.0);
        ds.putUnitDouble(charIDToTypeID("Angl"),        charIDToTypeID("#Ang"), 45.0);
        ds.putBoolean(charIDToTypeID("useGlobalAngle"), true);
        ds.putUnitDouble(charIDToTypeID("Dstn"),        charIDToTypeID("#Pxl"), 7.0);
        ds.putUnitDouble(charIDToTypeID("Ckmt"),        charIDToTypeID("#Pxl"), 8.0);
        ds.putUnitDouble(charIDToTypeID("Sprd"),        charIDToTypeID("#Prc"), 14.0);

        var clr = new ActionDescriptor();
        clr.putDouble(charIDToTypeID("Rd  "), 0.0);
        clr.putDouble(charIDToTypeID("Grn "), 0.0);
        clr.putDouble(charIDToTypeID("Bl  "), 0.0);
        ds.putObject(charIDToTypeID("Clr "), charIDToTypeID("RGBC"), clr);

        fxDesc.putObject(charIDToTypeID("DrSh"), charIDToTypeID("DrSh"), ds);
        desc1.putObject(charIDToTypeID("T   "), charIDToTypeID("Lefx"), fxDesc);
        executeAction(idsetd, desc1, DialogModes.NO);

        return true;
    }, "Failed to apply drop shadow");
}

//──────────────────────────────────────────────────────────────────
// Resize & Center with Bounds Check
//──────────────────────────────────────────────────────────────────
function resizeAndCenterLayer(doc, layer, maxW, maxH) {
    return safeExecute(function() {
        if (layer.kind === LayerKind.SMARTOBJECT) layer.rasterize(RasterizeType.ENTIRELAYER);
        if (layer.isBackgroundLayer)      layer.isBackgroundLayer = false;

        var b = layer.bounds,
            w = b[2].as("px") - b[0].as("px"),
            h = b[3].as("px") - b[1].as("px");
        if (w <= 1 || h <= 1) throw new Error("Invalid layer size: " + w + "×" + h);

        var scale = Math.min(maxW / w, maxH / h);
        layer.resize(scale * 100, scale * 100);

        b = layer.bounds;
        w = b[2].as("px") - b[0].as("px");
        h = b[3].as("px") - b[1].as("px");
        var dx = (doc.width.as("px")  / 2) - (b[0].as("px") + w/2),
            dy = (doc.height.as("px") / 2) - (b[1].as("px") + h/2);
        layer.translate(dx, dy);

        return layer;
    }, "Failed to resize/center layer");
}

//──────────────────────────────────────────────────────────────────
// Corner-based 30° Perspective Skew
//──────────────────────────────────────────────────────────────────
function pointDescriptor(x, y) {
    var d = new ActionDescriptor();
    d.putUnitDouble(charIDToTypeID("Hrzn"), charIDToTypeID("#Pxl"), x);
    d.putUnitDouble(charIDToTypeID("Vrtc"), charIDToTypeID("#Pxl"), y);
    return d;
}

function applyLeftPerspectiveSkew(layer) {
    return safeExecute(function() {
        app.activeDocument.activeLayer = layer;
        if (layer.isBackgroundLayer) layer.isBackgroundLayer = false;

        var b      = layer.bounds,
            x1     = b[0].as("px"), y1 = b[1].as("px"),
            x2     = b[2].as("px"), y2 = b[3].as("px"),
            offset = 0.3 * (x2 - x1);

        var desc = new ActionDescriptor(),
            ref  = new ActionReference();
        ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        desc.putReference(charIDToTypeID("null"), ref);
        desc.putEnumerated(charIDToTypeID("FTcs"), charIDToTypeID("QCSt"), charIDToTypeID("Qcsa"));

        var quad = new ActionList();
        quad.putObject(charIDToTypeID("Pnt "), pointDescriptor(x1 + offset,   y1));
        quad.putObject(charIDToTypeID("Pnt "), pointDescriptor(x2,           y1 - offset));
        quad.putObject(charIDToTypeID("Pnt "), pointDescriptor(x2,           y2 + offset));
        quad.putObject(charIDToTypeID("Pnt "), pointDescriptor(x1 + offset,   y2));
        desc.putList(charIDToTypeID("Quad"), quad);

        executeAction(charIDToTypeID("Trnf"), desc, DialogModes.NO);
        return layer;
    }, "Failed to apply perspective skew");
}

//──────────────────────────────────────────────────────────────────
// Single‐Image Processing
//──────────────────────────────────────────────────────────────────
function processImage(srcFile, stdFolder, rotFolder) {
    safeExecute(function() {
        log("Processing: " + srcFile.name);
        var base = srcFile.name.replace(/\.[^.]+$/, ""),
            doc  = app.open(srcFile),
            canvas = app.documents.add(
                CANVAS_SIZE, CANVAS_SIZE, 72,
                "Canvas_" + base, NewDocumentMode.RGB, DocumentFill.WHITE
            );

        // duplicate into canvas
        app.activeDocument = doc;
        doc.activeLayer.duplicate(canvas, ElementPlacement.PLACEATBEGINNING);
        doc.close(SaveOptions.DONOTSAVECHANGES);

        // standard version
        app.activeDocument = canvas;
        var layer = canvas.activeLayer;
        resizeAndCenterLayer(canvas, layer, MAX_IMAGE_SIZE, MAX_IMAGE_SIZE);
        addDropShadow(layer);
        canvas.flatten();
        canvas.saveAs(new File(stdFolder + "/" + srcFile.name),
                      new JPEGSaveOptions(), true, Extension.LOWERCASE);

        // rotated version
        var rot = canvas.duplicate("Rotated_" + base);
        app.activeDocument = rot;
        try {
            applyLeftPerspectiveSkew(rot.activeLayer);
            addDropShadow(rot.activeLayer);
        } catch (_) {
            log("⚠️ Skipped skew for " + srcFile.name);
        }
        rot.flatten();
        rot.saveAs(new File(rotFolder + "/" + base + "103.jpg"),
                   new JPEGSaveOptions(), true, Extension.LOWERCASE);

        // cleanup
        rot.close(SaveOptions.DONOTSAVECHANGES);
        canvas.close(SaveOptions.DONOTSAVECHANGES);
    }, "Error in processImage for " + srcFile.name);
}

//──────────────────────────────────────────────────────────────────
// Entry Point
//──────────────────────────────────────────────────────────────────
function main() {
    safeExecute(function() {
        app.displayDialogs     = DialogModes.ERROR;
        var origUnits = app.preferences.rulerUnits;
        app.preferences.rulerUnits = Units.PIXELS;

        log("=== Batch Start ===");
        var srcFolder = selectFolder("Select folder with decal images"),
            outFolder = selectFolder("Select output folder");

        var stdFolder = new Folder(outFolder.fsName + "/Standard");
        var rotFolder = new Folder(outFolder.fsName + "/Rotated");
        if (!stdFolder.exists) stdFolder.create();
        if (!rotFolder.exists) rotFolder.create();

        var files = getImageFiles(srcFolder),
            success=0, errors=0;
        for (var i=0; i<files.length; i++) {
            try { processImage(files[i], stdFolder.fsName, rotFolder.fsName); success++; }
            catch(e) { errors++; log("❌ " + files[i].name + " → " + e.message); }
        }

        app.preferences.rulerUnits = origUnits;
        log("=== Batch End === Success: " + success + "  Errors: " + errors);
        alert("Done! " + success + " processed, " + errors + " errors.");
    }, "Critical failure in main()");
}

main();