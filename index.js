const MotionDetector = class {
    constructor(settings) {
        // general required attributes
        this.stream = null;
        this.video = settings.videoRef || document.createElement("video");
        this.oldCapturedImage = false;
        this.captureInterval = null;
        // for download purposes of the recordings
        this.downloadTimer = 5;
        this.downloadCounter = 0;

        // init of attributes and adoption of transferred settings
        this.settings = {
            captureIntervalTime: settings.captureIntervalTime || 100,
            showMotionBox: settings.showMotionBox || true,
            motionBoxColor: settings.motionBoxColor || "#ff0000",
            frameWidth: settings.frameWidth || 400,
            frameHeight: settings.frameHeight || 300,
            sensitivity: settings.sensitivity || 16
        };

        const {frameWidth, frameHeight} = this.settings;

        // starting points of the motion box
        this.motionBox = {
            x: {
                min: frameWidth,
                max: frameWidth
            },
            y: {
                min: 0,
                max: 0
            }
        };

        // reference to the output element of the motion score
        this.score = settings.scoreRef || document.createElement("span");

        // passed references to canvas elements
        this.motionCanvas = settings.motionCanvasRef || document.createElement("canvas");
        this.captureCanvas = settings.captureCanvasRef || document.createElement("canvas");
        this.diffCanvas = document.createElement("canvas");
        const {motionCanvas, captureCanvas, diffCanvas} = this;

        // setting and context of the motioncanvas:
        // for the visualization of a heatmap
        motionCanvas.width = frameWidth;
        motionCanvas.height = frameHeight;
        this.motionContext = this.motionCanvas.getContext("2d");

        // setting and context of the capturecanvas:
        // to visualize the current image from the stream and display the motionbox
        captureCanvas.width = frameWidth;
        captureCanvas.height = frameHeight;
        this.captureContext = this.captureCanvas.getContext("2d");

        // setting and context of the diffcanvas:
        // to display the different pixels of the previous image and the current image from the stream
        diffCanvas.width = frameWidth;
        diffCanvas.height = frameHeight;
        this.diffContext = this.diffCanvas.getContext("2d");

    }

    async start() {
        // start of the capture process
        const {video} = this;
        const {frameWidth, frameHeight} = this.settings;

        // picking up the video stream if the user allows it
        await this.#getMedia({
            audio: false,
            video: {
                width: frameWidth,
                height: frameHeight
            }
        });

        // only when the metadata is loaded, the video from the stream can be played and the capture process can start
        video.addEventListener("loadedmetadata", () => {
            video.play();
            this.#startCapture();
        });

        // inserting the stream into the video element
        video.srcObject = this.stream;
    }

    #startCapture() {
        const {captureIntervalTime} = this.settings;

        // set an interval in which the motion is calculated
        this.captureInterval = setInterval(() => {
            this.#capture();
        }, captureIntervalTime);
    }

    #capture() {
        const {video, score} = this;
        let {oldCapturedImage} = this;
        const {frameWidth, frameHeight} = this.settings;
        const {captureContext, diffContext, motionContext} = this;

        // drawing the current stream image into the capturecontext
        captureContext.drawImage(video, 0, 0, frameWidth, frameHeight);

        // compositing operation to apply when drawing new shapes
        // (difference: Subtracts the bottom layer from the top layer or the other way round to
        // always get a positive value)
        diffContext.globalCompositeOperation = "difference";
        // drawing the difference image into the diffcontext
        diffContext.drawImage(video, 0, 0, frameWidth, frameHeight);
        const diffImageData = diffContext.getImageData(0, 0, frameWidth, frameHeight);

        // only when a previous image is available can differences be calculated
        if (oldCapturedImage) {
            // calling the method for calculating the diffscore
            const diff = this.#getDifference(diffImageData);
            // output of the motionscore to the referenced element
            score.innerHTML = diff.score;

            // reading in the image data for the heatmap
            motionContext.putImageData(diffImageData, 0, 0);
        }

        // overwriting the compositing operation with the default value "source-over
        // (source over: draws new shapes on top of the existing canvas content)
        // if this were not overwritten, the difference image would be used for the next
        // calculation.
        diffContext.globalCompositeOperation = "source-over";
        diffContext.drawImage(this.video, 0, 0, frameWidth, frameHeight);
        this.oldCapturedImage = true;
    }

    #getDifference(diffImageData) {
        const {sensitivity, frameWidth, showMotionBox} = this.settings;

        //rgba values from the passed diffImage object
        let rgba = diffImageData.data;

        // counter for the motion score within the current interval
        let score = 0;

        // iteration through the pixels
        for (let i = 0; i < rgba.length; i += 4) {
            // calculation of the differential value
            const pixelDiff = rgba[i] / 3 + rgba[i + 1] / 3 + rgba[i + 2] / 3;

            // normalizing the values for the heatmap
            const normalized = Math.min(255, pixelDiff * (255 / sensitivity));
            rgba[i] = normalized;
            rgba[i + 1] = normalized;
            rgba[i + 2] = normalized;

            // only if the difference value is above the defined sensitivity, the motion score is incremented
            // and only then the respective pixel is used for the calculation of the motionbox
            if (pixelDiff >= sensitivity) {
                score++;
                this.#calcMotionBoxPixels(i / 4);
            }
        }

        // if the motion score is greater than zero and the motion box is to be displayed, the
        // function for drawing in is called
        if (score > 0 && showMotionBox) {
            this.#drawMotionBoxCaptureCanvas();
            // this.#drawMotionBoxMotionCanvas();
        }

        // -----------------------------------------------
        // possibility to download the images from the different forms of presentation:

        // const {downloadTimer} = this;
        // let {downloadCounter} = this;
        //
        // if (downloadCounter === downloadTimer) {
        //     this.#downloadCaptureCanvas();
        //     this.downloadCounter = 0
        // } else {
        //     this.downloadCounter++;
        // }
        // -----------------------------------------------

        // resetting the motionbox
        this.motionBox.x.min = frameWidth;
        this.motionBox.y.min = frameWidth;
        this.motionBox.x.max = 0;
        this.motionBox.y.max = 0;

        // return the calculated motionscore
        return {score};
    }

    #downloadCaptureCanvas() {
        // possibility to download the capturecanvas
        const {captureCanvas} = this;
        const link = document.createElement("a");
        link.href = captureCanvas.toDataURL();
        link.download = "captureCanvas.png";
        link.click();
    }

    #downloadMotionCanvas() {
        // possibility to download the motioncanvas
        const {motionCanvas} = this;
        const link = document.createElement("a");
        link.href = motionCanvas.toDataURL();
        link.download = "motionCanvas.png";
        link.click();
    }

    #calcMotionBoxPixels(index) {
        // calculation of the motionbox pixel

        const {frameWidth} = this.settings;

        // calculation of the x and y coordinates of the passed pixel
        const x = index % frameWidth;
        const y = Math.floor(index / frameWidth);

        // if the coordinate is smaller or larger than before, it is inserted into the motionbox
        this.motionBox.x.min = Math.min(this.motionBox.x.min, x);
        this.motionBox.y.min = Math.min(this.motionBox.y.min, y);
        this.motionBox.x.max = Math.max(this.motionBox.x.max, x);
        this.motionBox.y.max = Math.max(this.motionBox.y.max, y);
    }

    #drawMotionBoxCaptureCanvas() {
        // drawing the motionbox in the corresponding context
        const {captureContext} = this;
        const {motionBoxColor} = this.settings;
        const {min: xMin, max: xMax} = this.motionBox.x;
        const {min: yMin, max: yMax} = this.motionBox.y;
        captureContext.strokeRect(xMin, yMin, xMax - xMin, yMax - yMin);
        captureContext.strokeStyle = motionBoxColor;

        // console.log("xMin: ", xMin, "yMin: s", yMin, "xMax: ", xMax, "yMax: ", yMax);
    }

    #drawMotionBoxMotionCanvas() {
        // drawing the motionbox in the corresponding context
        const {diffContext} = this;
        const {min: xMin, max: xMax} = this.motionBox.x;
        const {min: yMin, max: yMax} = this.motionBox.y;
        diffContext.strokeRect(xMin, yMin, xMax - xMin, yMax - yMin);
        diffContext.strokeStyle = "#fff";

        // console.log("xMin: ", xMin, "yMin: s", yMin, "xMax: ", xMax, "yMax: ", yMax);
    }

    async #getMedia(mediaSettings) {
        // access to the video stream of a webcam
        try {
            this.stream = await navigator.mediaDevices.getUserMedia(mediaSettings);
        } catch (err) {
            console.log(err);
        }
    }

    stop () {
        // stop the engine
        clearInterval(this.captureInterval);
        this.video.src = null;
        this.oldCapturedImage = false;
    }
}