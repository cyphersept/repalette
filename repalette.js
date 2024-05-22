//import Sortable from 'sortablejs/modular/sortable.core.esm.js';
// https://github.com/SortableJS/Sortable?tab=readme-ov-file

// ============================
// #region Globals and Event Listeners
// ============================

const displayCanvas = document.getElementById("output-canvas");
const ctx = displayCanvas.getContext("2d", { willReadFrequently: true });
const displayOriginal = document.querySelector(".display img")

const hiddenCanvas = document.createElement("canvas");
const htx = hiddenCanvas.getContext("2d", { willReadFrequently: true });
const images = {};
const palettes = {};

const imagesList = document.querySelector(".images.list");
const palettesList = document.querySelector(".palettes.list");
const imgTemplate = document.querySelector(".image.template");
const paletteTemplate = document.querySelector(".palette.template");

htx.imageSmoothingEnabled = false;
ctx.imageSmoothingEnabled = false;

document.getElementById("img-upload").onchange = function() {uploadFiles(this, "image")};
document.getElementById("palette-upload").onchange = function() {uploadFiles(this, "palette")};

document.querySelector(".repalette").onclick = function() {repalette(getSelected("image"), getSelected("palette"))};
document.querySelector(".export").onclick  = function() {download(getSelected("image"), getSelected("palette"))}

imagesList.onclick = (event) => {listClicked(event)};
palettesList.onclick = (event) => {listClicked(event)};
imagesList.addEventListener('blur', (event) => lockName(event, "image"), true);
palettesList.addEventListener('blur', (event) => lockName(event, "palette"), true);

// Event listeners for image list and palette list sections
function listClicked(event) {
    const el = event.target
    if (el.matches(".close")) deleteObj(el.parentElement, event);
    else if (el.matches(".rename")) renamePalette(el.parentElement.parentElement);
    else if (el.matches(".expand")) el.parentElement.parentElement.classList.toggle("expanded");
    else if (el.matches(".tab")) switchSelected(el.parentElement);
    else if (el.matches(".name")) switchSelected(el.parentElement.parentElement);
}

function lockName(event, type) {
    if (event.target.matches(".name")) {
        const typeObj = (type == "image") ? images : palettes;
        const key = event.target.parentElement.parentElement.dataset.objKey;
        let str = event.target.textContent;
        console.log('Palette name edited at:', event.target);
        str = str.replace(/^\s+|\s+$/g, '');
        event.target.contentEditable = false;
        typeObj[key].name = str;
    }
}
// Implements click and drag scrolling for large canvases
class Scrollable {
    constructor(el) {
        this.el = el;
        this.isDown = false;
        this.startX = null;
        this.startY = null;
        this.scrollLeft = null;
        this.scrollTop = null;

        el.addEventListener('mousedown', this.startScroll);
        el.addEventListener('mouseup', this.stopScroll);
        document.addEventListener('mousemove', this.scroll);
    }

    startScroll = (event) => {
        this.isDown = true;
        this.startX = event.pageX //- this.el.offsetLeft;
        this.startY = event.pageY //- this.el.offsetTop;
        this.scrollLeft = this.el.scrollLeft;
        this.scrollTop = this.el.scrollTop;
    }

    stopScroll = () => {
        this.isDown = false;
    }

    scroll = (event) => {
        if (!this.isDown) return;
        event.preventDefault();

        const x = event.pageX //- this.el.offsetLeft;
        const y = event.pageY //- this.el.offsetTop;
        const walkX = (x - this.startX) * 1; // Adjust speed here
        const walkY = (y - this.startY) * 1; // Adjust speed here

        this.el.scrollLeft = this.scrollLeft - walkX;
        this.el.scrollTop = this.scrollTop - walkY;
    }
}

new Scrollable(displayCanvas.parentElement);
new Scrollable(displayOriginal.parentElement);

// #endregion

// ============================
// #region Palette Upload
// ============================

// Process user-uploaded palette from file or URL
async function uploadFiles(input, type) {
    const arr = (type == "image") ? images : palettes;
    let last;

    // Upload/update image only if it has changed
    for (const file of input.files) {
        if (type == "image") {
            if (arr[file.name] && arr[file.name].date == file.lastModified) return false;
            last = await addImage(file);
            console.log(last);
        }
        else if (type == "palette") {
            last = await addPalette(file);
            console.log(last);
        }
    }
    // Select the last-created node
    switchSelected(last.node);
}


// Create DOM display of palette information-- returns node 
function addPalette(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        let palette;

         // Update and process image data once reader and image load
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                if (img.width > 0) {
                    palette = paletteFromImg(loadImageToCanvas(img, hiddenCanvas, htx));
                    palette.name = file.name + " Palette";
                    palette.node = createPaletteNode(palette);
                    resolve(palette); // Resolve the promise with the palette object
                } else {
                    reject(new Error("Image width is 0"));
                }
            };
            img.src = e.target.result;
        };

        // Reject the promise on file read error
        reader.onerror = (error) => {reject(error)};
        
        // Attempt to read file
        reader.readAsDataURL(file);
    });
}

function createPaletteNode(obj) {
    const el = paletteTemplate.cloneNode(true);
    const ul = el.querySelector(".color-list");
    el.dataset.objKey = obj.id;
    el.classList.remove("template");
    el.querySelector(".name").textContent = obj.name

    initColorList(obj, ul);
    palettesList.appendChild(el);
    return el;
}

// Display each color in palette
function initColorList(obj, ul) {
    for (const key in obj.colors) {
        const li = document.createElement("li");
        li.classList.add("color");
        li.dataset.key = key;
        li.style.backgroundColor = `rgb(${li.dataset.key})`
        obj.colors[key].node = li;
        ul.appendChild(li);
    }
    obj.sortable = Sortable.create(ul, {
        animation: 50,
        easing: "cubic-bezier(0.65, 0, 0.35, 1)",
        onSort: function () {obj.hasChanged = true}
    })
}

// Scans the image for unique colours, generates an index of all values
function paletteFromImg(imageData){
    const id = Math.floor(Date.now() * Math.random());
    const palette = {id: id, colors: {}, sortable: {}, hasChanged: true};
    const data = imageData.data;
    palettes[id] = palette;
    for (let i = 0; i < data.length; i += 4) {
        // Use rgb string as key (Different alphas are ignored)
        const rgbKey = [data[i], data[i+1], data[i+2]].toString();   

        // If colour has not been indexed, add to palette
        if (!palette.colors[rgbKey]) {
            palette.colors[rgbKey] = {
                r: data[i],
                g: data[i+1],
                b: data[i+2],
                indices: [i], 
                remaps: {}
            }
        }
        // If already indexed, register new instance of colour at index
        else {
            palette.colors[rgbKey].indices.push(i)
        }
    }

    return palette;
}

// #endregion

// ============================
// #region Image Upload
// ============================

function imgFromUrl(id) {
    const url = document.getElementById(id).value;
}

// Create imgObj of image information
function addImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            // Create Image
            const img = new Image();
            const name = file.name;

            // Update and process image data once file is loaded
            img.onload = () => {
                const obj = images[name] || {}

                // Update the file's associated obj data
                obj.name = name;
                obj.date = file.lastModified;
                obj.img = img;
                obj.imgData = loadImageToCanvas(img, hiddenCanvas, htx);
                obj.defaultPalette = paletteFromImg(obj.imgData);
                obj.repalettes = {}; // Stores imgData of processed alt palettes

                // If the file is new, append an element to the DOM
                if (!images[name]) {
                    images[name] = obj;
                    obj.node = createImgNode(obj);
                }
                
                resolve(images[name]); // Resolve the promise with the updated images object
            };
            img.src = e.target.result; 
        };

        // Reject the promise if there's an error reading the file
        reader.onerror = (error) => {
            reject(error); 
        };
        reader.readAsDataURL(file);
    });
}

function createImgNode(obj) {
    const el = imgTemplate.cloneNode(true);
    const ul = el.querySelector(".color-list");
    el.querySelector(".name").textContent = obj.name;
    el.dataset.objKey = obj.name;
    el.classList.remove("template");
    obj.defaultPalette.node = ul;
    
    initColorList(obj.defaultPalette, ul);
    imagesList.appendChild(el);
    return el;
}

// Delete object and associated data from project
function deleteObj(el, event) {
    event.stopPropagation();

    // Delete image
    if (el.matches(".image")) {
        const obj = images[el.dataset.objKey];

        delete palettes[obj.defaultPalette.id];
        delete images[el.dataset.objKey];
    }
    // Delete palette
    else {
        const id = el.dataset.objKey;
    
        // Remove each palette remap from img + img.defaultpalette
        for (const key in images) {
            const basePalette = images[key].defaultPalette.colors;
            for (const color in basePalette) {
                if (basePalette[color].remaps[id]) delete basePalette[color].remaps[id]
            }
            delete images[key].repalettes[id];
        }
        delete palettes[id];
    }

    // If currently selected, switch to new selected 
    if (el.matches(".selected")) {
        const next = el?.nextElementSibling ?? el.previousElementSibling;
        switchSelected(next);
    }
    el.remove();
}

function getMaxScale(srcWidth, srcHeight, maxWidth, maxHeight) {
    const scalar = Math.min(parseFloat(maxWidth) / srcWidth, parseFloat(maxHeight) / srcHeight);
    return Math.max(1, Math.floor(scalar));
}

// Also converts image to canvas API data
function loadImageToCanvas(img, canvas, context, returnData = true) {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    if (returnData) {
        let imgData = context.getImageData(0, 0, canvas.width, canvas.height);
        console.log(imgData);
        return imgData;
    }
}

//Toggles selected element in same parent group
function switchSelected(next) {
    if (!next || next.matches(".template")) return false;
    const prev = next.parentElement.querySelector(".selected");

    if (!prev) {
        displayOriginal.classList.remove("initial");
        displayCanvas.classList.remove("initial");
    }
    // Highlights selected object in list
    else prev.classList.toggle("selected");
    next.classList.toggle("selected");

    // Displays selected image
    if (next.matches(".image")) {
        const obj = images[next.dataset.objKey];

        // Calculate the maximum scale
        const scalar = getMaxScale(
            obj.img.width,
            obj.img.height,
            window.getComputedStyle(displayOriginal).getPropertyValue('max-width'),
            window.getComputedStyle(displayOriginal).getPropertyValue('max-height')
        );

        // Changes left display
        displayOriginal.src = obj.img.src;
        displayOriginal.style.width = `${scalar * obj.img.width}px`;
        displayOriginal.style.aspectRatio = obj.img.width / obj.img.height;
        
        // Changes right display according to selected palette
        loadImageToCanvas(obj.img, displayCanvas, ctx, false);
        displayCanvas.style.width = displayOriginal.style.width;
        displayCanvas.style.aspectRatio = displayOriginal.style.aspectRatio;
    }
}

function getSelected(type) {
    let val;
    switch (type) {
        case "image": val = images[imagesList.querySelector(".selected")?.dataset.objKey]; break;
        case "palette": val = palettes[palettesList.querySelector(".selected")?.dataset.objKey]; break;
        default: console.log("Type for getSelected() must be 'image' or 'palette'");
    }
    return val || false;
}


// ============================
// #region Palette Sorting
// ============================

// !TO-DO: make blocks take user-inputted value from field
function sortPalette(palette, blocks, el) {
    const arr = Object.values(palette)
    arr.sort((a, b, blocks) => {
        let hsvA = step(a.r, a.g, a.b, blocks);
        let hsvB = step(b.r, b.g, b.b, blocks);

        // Compare h2, lum, v2 in descending order
        const res = (hsvA[0] !== hsvB[0]) 
            ? hsvB[0] - hsvA[0]
            : (hsvA[1] !== hsvB[1])
                ? (hsvA[1] - hsvB[1])
                : hsvB[2] - hsvA[2]
        return res;
    })

    palette.order = arr;
    // alt: palette.order = arr
    return arr;
}

//https://gist.github.com/mjackson/5311256
function rgbToHsv(r, g, b) {
    r /= 255, g /= 255, b /= 255;

    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, v = max;

    var d = max - min;
    s = max == 0 ? 0 : d / max;

    if (max == min) {
        h = 0; // achromatic
    } else {
        switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
        }

        h /= 6;
    }

    return [ h, s, v ];
}

// Implemented using step-sort from https://www.alanzucconi.com/2015/09/30/colour-sorting/#google_vignette 
function step(r, g, b, blocks = 1) {
    const lum = math.sqrt( .241 * r + .691 * g + .068 * b )
    const hsv = rgbToHsv(r, g, b)

    h2 = int(h * blocks)
    lum2 = int(lum * blocks)
    v2 = int(v * blocks)

    return (h2, lum, v2)
}


function findIndex(val, arr) {
    var lower = 0;
    var upper = arr.length;

    while (lower < higher) {
        const split = lower + upper >>> 1;
        if (array[split] < val) lower = split + 1;
        else upper = split;
    }

    arr.splice(lower, 0, val) //insert val at index found
    return arr
}

//#endregion

// ============================
// #region Palette Management
// ============================

function mapPalette(basePalette, newPalette) {
    const o1 = basePalette.sortable.el.children;
    const o2 = newPalette.sortable.el.children;
    const id = newPalette.id;

    // Map color of basePalette to corresponding in newPalette order
    for (let i = 0; i < o1.length; i++) {
        if (!o2[i]) break // Stop if there are no more new colors
        const key1 = o1[i].dataset.key;
        const key2 = o2[i].dataset.key;
        basePalette.colors[key1].remaps[id] = newPalette.colors[key2];
    }
}

// Uses palette mappings to generate recolored image
function repalette(imgObj, newPalette, show=true) {
    const basePalette = imgObj.defaultPalette;
    const id = newPalette.id;
    let img;

    // If the image has been repaletted before and nothing's changed, get the image data
    if (imgObj.repalettes[id] && !basePalette.hasChanged && !newPalette.hasChanged) {
        img = imgObj.repalettes[id];
    }

    // Generate a new recolor
    else {
        const data = new Uint8ClampedArray(imgObj.imgData.data);
        mapPalette(basePalette, newPalette);
    
        for (const key in basePalette.colors) {
            // Skip if the color has not been mapped
            const baseCol = basePalette.colors[key];
            if (!baseCol.remaps[id]) {
                continue;
            }
            // Gets the base color's mapped color from the new palette
            const newR = baseCol.remaps[id].r;
            const newG = baseCol.remaps[id].g;
            const newB = baseCol.remaps[id].b;
            // Replace each index of mapped color with new color
            for (const i of baseCol.indices) {
                data[i] = newR;
                data[i+1] = newG;
                data[i+2] = newB;
            }
        }
        // Save imagedata to original image object, reset flags
        img = new ImageData(data, imgObj.imgData.width, imgObj.imgData.height);
        imgObj.repalettes[id] = img;

        basePalette.hasChanged = false;
        newPalette.hasChanged = false;
    }

    // Show result on output canvas (optional)
    if (show) {
        ctx.width = img.width;
        ctx.height = img.height;
        ctx.putImageData(img, 0, 0)
    }
}

function deleteCol(palette, colorKey) {
    delete palette[colorKey];
    palette.hasChanged = true;
}
// #endregion

// ============================
// #region Export
// ============================

// Function to toggle the editable state
function renamePalette(el) {
    nameEl = el.querySelector(".name");
    nameEl.contentEditable = true;
    nameEl.focus();
}

// Process multiple images
function bulkProcess(images, palettes) {
    for (const imgObj of images) {
        for (const newPal of palettes) {
            repalette(imgObj, newPal, false);
        }
    }
}

// Save output to computer as img-name_palette-name
function download(imgObj, paletteObj) {
    const a = document.getElementById('download-single');
    a.setAttribute('download', imgObj.name + "_" + paletteObj.name);
    a.setAttribute('href', displayCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
    a.click();
}

// #endregion

//https://github.com/luukdv/color.js/

// https://github.com/leeoniya/RgbQuant.js <- For simplifying 

//region To-Do
/*
    - add function for bulk process
    - allow color deletion
    - (stretch): color picker
    - (bloat): change amount of allowed colours

Completed:
    - debug paletteMap -> repalette
    - debug palette deletion
    - display palette of base image
    - add "has changed" flag for palettes to determine if palette needs to be remapped
    - implement click and drag scrolling for canvases
    - implement drag and drop
    - implemented crisp rescale, but no more canvas scrolling
    - menu buttons set
    - debug rename
    - export function
*/