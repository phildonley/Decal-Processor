#target photoshop

// Modern error handling and constants
var CANVAS_SIZE = 1600;
var MAX_IMAGE_SIZE = 1520;
var SUPPORTED_FORMATS = /\.(jpg|jpeg|png|psd|tiff|tif|bmp)$/i;

// ExtendScript-compatible logging with timestamp
function log(msg) {
    var now = new Date();
    var timestamp = now.getFullYear() + "-" + 
                   padZero(now.getMonth() + 1) + "-" + 
                   padZero(now.getDate()) + " " +
                   padZero(now.getHours()) + ":" + 
                   padZero(now.getMinutes()) + ":" + 
                   padZero(now.getSeconds());
    $.writeln("[" + timestamp + "] " + msg);
}

// Helper function for date formatting
function padZero(num) {
    return (num < 10) ? "0" + num : num.toString();
}

// Enhanced error handling wrapper
function safeExecute(func, errorMsg) {
    try {
        return func();
    } catch (e) {
        log("ERROR: " + errorMsg + " - " + e.message);
        throw new Error(errorMsg + ": " + e.message);
    }
}

// Modern folder selection with validation
function selectFolder(promptText) {
    return safeExecute(function() {
        var folder = Folder.selectDialog(promptText);
        if (!folder || !folder.exists) {
            throw new Error("Invalid folder selection");
        }
        return folder;
    }, "Folder selection failed");
}

// Enhanced file gathering with better validation
function getImageFiles(folder) {
    return safeExecute(function() {
        var allFiles = folder.getFiles();
        var imageFiles = [];
        
        for (var i = 0; i < allFiles.length; i++) {
            var file = allFiles[i];
            if (file instanceof File && file.exists) {
                var fileName = file.name.toLowerCase();
                if (SUPPORTED_FORMATS.test(fileName)) {
                    imageFiles.push(file);
                }
            }
        }
        
        log("Found " + imageFiles.length + " valid image file(s)");
        return imageFiles;
    }, "Failed to gather image files");
}

// Simplified drop shadow that works reliably
function addDropShadow(layer) {
    // Ensure we have a valid document and layer
    if (!app.documents.length) throw new Error("No open document");
    if (!layer)           throw new Error("No layer to shadow");

    var doc = app.activeDocument;
    doc.activeLayer = layer;

    // Rasterize/unlock if needed
    if (layer.kind === LayerKind.SMARTOBJECT) 
        layer.rasterize(RasterizeType.ENTIRELAYER);
    if (layer.isBackgroundLayer) 
        layer.isBackgroundLayer = false;

    // Clear any existing effects
    try {
        layer.clearEffects(); // UXP bridge command; if unavailable, ignore
    } catch(_) {}

    // Apply drop shadow style
    layer.layerStyle = LayerStyle.DROP_SHADOW;
    var ds = layer.layerStyle.dropShadow;

    ds.enabled         = true;
    ds.mode            = ShadowMode.NORMAL;
    ds.opacity         = 21;
    ds.useGlobalAngle  = true;
    ds.angle           = 45;
    ds.distance        = 7;
    ds.spread          = 14;
    ds.size            = 8;
}

// Enhanced resize and center with better validation
function resizeAndCenterLayer(doc, layer, maxWidth, maxHeight) {
    return safeExecute(function() {
        // Validate inputs
        if (!doc || !layer) {
            throw new Error("Invalid document or layer");
        }
        
        // Make sure this layer is active
        doc.activeLayer = layer;
        
        // Ensure layer is rasterized and not background
        if (layer.kind === LayerKind.SMARTOBJECT) {
            layer.rasterize(RasterizeType.ENTIRELAYER);
        }
        if (layer.isBackgroundLayer) {
            layer.isBackgroundLayer = false;
        }
        
        // Get current bounds
        var bounds = layer.bounds;
        var currentWidth = bounds[2].as("px") - bounds[0].as("px");
        var currentHeight = bounds[3].as("px") - bounds[1].as("px");
        
        // Validate dimensions
        if (currentWidth <= 0 || currentHeight <= 0) {
            throw new Error("Invalid layer dimensions: " + currentWidth + "×" + currentHeight);
        }
        
        // Calculate scale factor
        var scaleX = maxWidth / currentWidth;
        var scaleY = maxHeight / currentHeight;
        var scale = Math.min(scaleX, scaleY);
        
        // Apply resize
        if (scale !== 1.0) {
            layer.resize(scale * 100, scale * 100, AnchorPosition.MIDDLECENTER);
        }
        
        // Center the layer
        var newBounds = layer.bounds;
        var newWidth = newBounds[2].as("px") - newBounds[0].as("px");
        var newHeight = newBounds[3].as("px") - newBounds[1].as("px");
        
        var docCenterX = doc.width.as("px") / 2;
        var docCenterY = doc.height.as("px") / 2;
        var layerCenterX = newBounds[0].as("px") + newWidth / 2;
        var layerCenterY = newBounds[1].as("px") + newHeight / 2;
        
        var deltaX = docCenterX - layerCenterX;
        var deltaY = docCenterY - layerCenterY;
        
        if (deltaX !== 0 || deltaY !== 0) {
            layer.translate(deltaX, deltaY);
        }
        
        return layer;
        
    }, "Failed to resize and center layer");
}

// Modern perspective distortion with improved validation
function applyLeftPerspectiveSkew(layer) {
    return safeExecute(function() {
        if (!layer || !app.activeDocument) {
            throw new Error("Invalid layer or document for perspective");
        }
        
        app.activeDocument.activeLayer = layer;
        
        if (layer.isBackgroundLayer) {
            layer.isBackgroundLayer = false;
        }
        
        var bounds = layer.bounds;
        var left = bounds[0].as("px");
        var top = bounds[1].as("px");
        var right = bounds[2].as("px");
        var bottom = bounds[3].as("px");
        
        var width = right - left;
        var height = bottom - top;
        var perspectiveOffset = width * 0.3;
        
        // Create perspective transformation
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        desc.putReference(charIDToTypeID("null"), ref);
        desc.putEnumerated(charIDToTypeID("FTcs"), charIDToTypeID("QCSt"), charIDToTypeID("Qcsa"));
        
        var cornersList = new ActionList();
        
        // Helper function for corner points
        function createPoint(x, y) {
            var pointDesc = new ActionDescriptor();
            pointDesc.putUnitDouble(charIDToTypeID("Hrzn"), charIDToTypeID("#Pxl"), x);
            pointDesc.putUnitDouble(charIDToTypeID("Vrtc"), charIDToTypeID("#Pxl"), y);
            return pointDesc;
        }
        
        // Define corner points for left perspective
        cornersList.putObject(charIDToTypeID("Pnt "), createPoint(left + perspectiveOffset, top));
        cornersList.putObject(charIDToTypeID("Pnt "), createPoint(right, top - perspectiveOffset));
        cornersList.putObject(charIDToTypeID("Pnt "), createPoint(right, bottom + perspectiveOffset));
        cornersList.putObject(charIDToTypeID("Pnt "), createPoint(left + perspectiveOffset, bottom));
        
        desc.putList(charIDToTypeID("Quad"), cornersList);
        executeAction(charIDToTypeID("Trnf"), desc, DialogModes.NO);
        
        return layer;
        
    }, "Failed to apply perspective transformation");
}

// Enhanced image processing with better state management
function processImage(sourceFile, standardFolder, rotatedFolder) {
    var doc = null;
    var canvas = null;
    var rotatedCanvas = null;
    
    try {
        log("Processing: " + sourceFile.name);
        var baseName = sourceFile.name.replace(/\.[^.]+$/, "");
        
        // Open source document
        doc = app.open(sourceFile);
        if (!doc) {
            throw new Error("Failed to open source file");
        }
        
        // Create canvas
        canvas = app.documents.add(
            CANVAS_SIZE, 
            CANVAS_SIZE, 
            72, 
            "Canvas_" + baseName, 
            NewDocumentMode.RGB, 
            DocumentFill.WHITE
        );
        
        // Duplicate source layer to canvas
        app.activeDocument = doc;
        var sourceLayer = doc.activeLayer;
        var duplicatedLayer = sourceLayer.duplicate(canvas, ElementPlacement.PLACEATBEGINNING);
        
        // Close source document
        doc.close(SaveOptions.DONOTSAVECHANGES);
        doc = null;
        
        // Process standard version
        app.activeDocument = canvas;
        canvas.activeLayer = duplicatedLayer;
        
        // Resize and center first
        resizeAndCenterLayer(canvas, duplicatedLayer, MAX_IMAGE_SIZE, MAX_IMAGE_SIZE);
        
        // Apply drop shadow BEFORE flattening
        addDropShadow();
        
        // Now flatten and save standard version
        canvas.flatten();
        var standardFile = new File(standardFolder + "/" + sourceFile.name);
        var jpegOptions = new JPEGSaveOptions();
        jpegOptions.quality = 12;
        jpegOptions.embedColorProfile = true;
        canvas.saveAs(standardFile, jpegOptions, true, Extension.LOWERCASE);
        
        // Create rotated version by duplicating the original canvas BEFORE flattening
        // We need to go back and create a fresh copy
        app.activeDocument = canvas;
        canvas.close(SaveOptions.DONOTSAVECHANGES);
        
        // Reopen and process for rotated version
        doc = app.open(sourceFile);
        rotatedCanvas = app.documents.add(
            CANVAS_SIZE, 
            CANVAS_SIZE, 
            72, 
            "RotatedCanvas_" + baseName, 
            NewDocumentMode.RGB, 
            DocumentFill.WHITE
        );
        
        app.activeDocument = doc;
        var rotatedLayer = doc.activeLayer.duplicate(rotatedCanvas, ElementPlacement.PLACEATBEGINNING);
        doc.close(SaveOptions.DONOTSAVECHANGES);
        
        app.activeDocument = rotatedCanvas;
        rotatedCanvas.activeLayer = rotatedLayer;
        
        // Resize and center
        resizeAndCenterLayer(rotatedCanvas, rotatedLayer, MAX_IMAGE_SIZE, MAX_IMAGE_SIZE);
        
        // Apply perspective transformation
        try {
            applyLeftPerspectiveSkew(rotatedLayer);
        } catch (perspectiveError) {
            log("⚠️ Perspective skipped for " + sourceFile.name + ": " + perspectiveError.message);
        }
        
        // Apply drop shadow BEFORE flattening
        addDropShadow();
        
        // Flatten and save rotated version
        rotatedCanvas.flatten();
        var rotatedFile = new File(rotatedFolder + "/" + baseName + "103.jpg");
        rotatedCanvas.saveAs(rotatedFile, jpegOptions, true, Extension.LOWERCASE);
        
        log("✅ Successfully processed: " + sourceFile.name);
        
    } catch (error) {
        log("❌ Error processing " + sourceFile.name + ": " + error.message);
        throw error;
    } finally {
        // Clean up documents
        try {
            if (doc) doc.close(SaveOptions.DONOTSAVECHANGES);
            if (rotatedCanvas) rotatedCanvas.close(SaveOptions.DONOTSAVECHANGES);
            if (canvas) canvas.close(SaveOptions.DONOTSAVECHANGES);
        } catch (cleanupError) {
            log("⚠️ Cleanup warning: " + cleanupError.message);
        }
    }
}

// Enhanced main execution function
function main() {
    try {
        // Bring Photoshop to front
        app.bringToFront();
        
        // Set up preferences for better performance
        app.displayDialogs = DialogModes.ERROR;
        var originalRulerUnits = app.preferences.rulerUnits;
        app.preferences.rulerUnits = Units.PIXELS;
        
        log("=== Starting batch processing ===");
        
        // Get folders
        var sourceFolder = selectFolder("Select folder containing decal images");
        var outputFolder = selectFolder("Select output destination folder");
        
        // Create output subfolders
        var standardFolder = new Folder(outputFolder.fsName + "/Standard");
        var rotatedFolder = new Folder(outputFolder.fsName + "/Rotated");
        
        if (!standardFolder.exists) standardFolder.create();
        if (!rotatedFolder.exists) rotatedFolder.create();
        
        // Process files
        var imageFiles = getImageFiles(sourceFolder);
        var processedCount = 0;
        var errorCount = 0;
        
        for (var i = 0; i < imageFiles.length; i++) {
            try {
                processImage(imageFiles[i], standardFolder.fsName, rotatedFolder.fsName);
                processedCount++;
            } catch (processingError) {
                errorCount++;
                log("Failed to process " + imageFiles[i].name + ": " + processingError.message);
            }
        }
        
        // Restore preferences
        app.preferences.rulerUnits = originalRulerUnits;
        app.displayDialogs = DialogModes.ALL;
        
        // Final report
        var summary = "=== Processing Complete ===\n" +
                     "Total files: " + imageFiles.length + "\n" +
                     "Successfully processed: " + processedCount + "\n" +
                     "Errors: " + errorCount + "\n\n" +
                     "Check the Standard and Rotated folders for results.";
        
        log(summary);
        alert(summary);
        
    } catch (mainError) {
        var errorMsg = "❌ Critical error: " + mainError.message;
        log(errorMsg);
        alert(errorMsg);
    }
}

// Execute main function
main();