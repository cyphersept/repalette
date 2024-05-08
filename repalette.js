//import Sortable from 'sortablejs/modular/sortable.core.esm.js';
// https://github.com/SortableJS/Sortable?tab=readme-ov-file

const displayCanvas = document.getElementById("output-canvas");
const ctx = displayCanvas.getContext("2d");

const hiddenCanvas = document.getElementById("hidden-canvas");
const htx = hiddenCanvas.getContext("2d");
const images = {};
const palettes = {};

const imagesList = document.querySelector(".images.list");
const palettesList = document.querySelector("palettes.list");
const imgTemplate = document.querySelector(".image.template");
const paletteTemplate = document.querySelector(".palette.template");

document.getElementById("img-upload").onchange = function() {uploadFiles(this, "image")}
document.getElementById("palette-upload").onchange = function() {uploadFiles(this, "palette")}
//document.querySelector(".palettes .btn").onclick = function() {uploadPalette(this.nextElementSibling)}

// ============================
// #region Palette Upload
// ============================

// Process user-uploaded palette from file or URL
function uploadFiles(input, type) {
    const arr = (type == "image") ? images : palettes;

    for (const file of input.files) {
        if (arr[file.name] && arr[file.name].date == file.lastModified) {
            return false;
        }
        else {
            if (type == "image") console.log(addImage(file));
            else if (type == "palette") console.log(addPalette(file));
        }
    }
}


// function uploadPalette(input) {
//     const img = new Image();
//     const error = document.querySelector(".palettes .error")

//     // If the url is not a valid image, display error
//     img.onerror = () => { 
//         console.log("Invalid URL")
//         //error.hidden = false;
//     }
//     // If the image loads, add the palette list to the DOM
//     img.onload = () => {
//         console.log("Successfully loaded: " + img.width)
//         if (img.width > 0) {
//             const palette = paletteFromImg(loadImageToCanvas(img, hiddenCanvas, htx))
//             error.hidden = true;
//             document.querySelector(".palettes.list").appendChild(addPalette(palette))
//         }
//     }
//     // Set image source if input is a file
//     if (input instanceof File) {
//         const reader = new FileReader();
//         reader.onload = function(e) { img.src = e.target.result };
//         reader.readAsDataURL(input);
//     } 
//     // Set image source if input is a URL
//     else if (typeof input.value === "string") {
//         img.src = input.value.trim();
//         //document.querySelector(".palettes.list").appendChild(img)
//     }
// }

// Create DOM display of palette information-- returns node 
function addPalette(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        const id = file.name + file.lastModified;

        img.onload = () => {
            console.log("Successfully loaded: " + img.width)
            if (img.width > 0) {
                const palette = paletteFromImg(loadImageToCanvas(img, hiddenCanvas, htx))
                error.hidden = true;
                createPaletteNode(palette);
            }
        };

        img.src = e.target.result;
        reader.readAsDataURL(input);
    }
}

function createPaletteNode(obj) {
    const el = paletteTemplate.cloneNode(true);
    el.dataset.obj = obj;
    el.classList.remove("template");

    // Display each color in palette
    for (const color in obj) {
        const li = Document.createElement("li");
        li.classList.add("color");
        li.dataset.key = color.rgb.toString()
        li.style.backgroundColor = `rgb(${li.dataset.key})`
        el.appendChild(li);
    }
    palettesList.appendChild(el);
    return el;
}
// Scans the image for unique colours, generates an index of all values
function paletteFromImg(imageData){
    const id = Math.floor(Date.now() * Math.random());
    const palette = {id: id, colors: {}, order:[]};
    const data = imageData.data;
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

// Deletes palette from project
function deletePalette(el) {
    const palette = el.dataset.obj;
    const id = palette.id;

    // Remove each palette remap from img + img.defaultpalette
    for (const imgObj in images) {
        for (const color in imgObj.defaultPalette.colors) {
            delete color.remaps[id]
        }
        delete imgObj.repalettes[id];
    }

    // Remove DOM element
    el.remove();
}

// #endregion

// ============================
// #region Image Upload
// ============================

// Image upload logic
function uploadImages(input) {
    for (const file of input.files) {
        if (images[file.name] && images[file.name].date == file.lastModified) {
            return false;
        }
        else {
            console.log(addImage(file));
        }
    }
}

function imgFromUrl(id) {
    const url = document.getElementById(id).value;
}

// Create imgObj of image information
function addImage(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        // Create Image
        const img = new Image();
        const name = file.name;

        // Update and process image data once file is loaded
        img.onload = () => {
            // If the file is new, append an element to the DOM
            if (!images[name]) {
                createImgNode(file)
            }

            // Update the file's associated obj data
            images[name].name = name
            images[name].date = file.lastModified;
            images[name].img = img;
            images[name].imgData = loadImageToCanvas(img, hiddenCanvas, htx);
            images[name].defaultPalette = paletteFromImg(images[name].imgData);
            images[name].repalettes = {}; // Stores imgData of processed alt palettes
        };
        
        // Trigger image loading and reader
        img.src = e.target.result; 
    };
    reader.readAsDataURL(file);
    return images[file.name]
}

function createImgNode(file) {
    const el = imgTemplate.cloneNode(true)
    images[file.name] = {};
    el.lastElementChild.textContent = file.name;
    el.dataset.obj = images[file.name];
    el.classList.remove("template");
    el.hidden = false
    imagesList.appendChild(el);
    return el;
}

// Deletes image from project
function deleteImage(el) {
    delete images[el.dataset.obj.name];
    el.remove();
}

// #endregion


// Convert image to canvas API data
function loadImageToCanvas(img, canvas, context) {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    let imgData = context.getImageData(0, 0, canvas.width, canvas.height);
    console.log(imgData);

    return imgData;
}

//Toggles selected element in same parent group
function switchSelected(next) {
    const prev = next.parentElement.querySelector(".selected");
    prev.classList.toggle("selected");
    next.classList.toggle("selected");
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

function mapPalette(basePalette, newPalette) {
    const o1 = basePalette.order;
    const o2 = newPalette.order;
    const id = newPalette.id;
    // Map color of basePalette to corresponding in newPalette order
    for (let i = 0; i < basePalette.length; i++) {

        o1[i].remaps[id] = o2[i]
    }
}

// Uses palette mappings to generate recolored image
function repalette(imgObj, newPalette, show=true) {
    const newImg = new ImageData(
        new Uint8ClampedArray(imgObj.imgData.data),
        imgObj.imgData.width,
        imgObj.imgData.height
        )
    const basePalette = imgObj.defaultPalette;
    const id = newPalette.id
    for (const baseColor in basePalette.colors) {
        // Gets the base color's mapped color from the new palette
        const newR = baseColor.remaps[id].r;
        const newG = baseColor.remaps[id].g;
        const newB = baseColor.remaps[id].b;
        // Replace each index of mapped color with new color
        for (const i of baseColor.indices) {
            color.remaps[id]
            newImg.data[i] = newR;
            newImg.data[i+1] = newG;
            newImg.data[i+2] = newB;
        }
    }

    // Save imagedata to original image object
    imgObj.repalettes[id] = newImg;

    // Show result on output canvas (optional)
    if (show) {
        ctx.width = newImg.width;
        ctx.height = newImg.height;
        ctx.putImageData(newImg, 0, 0)
    }
}




//https://github.com/luukdv/color.js/

// https://github.com/leeoniya/RgbQuant.js <- For simplifying 

