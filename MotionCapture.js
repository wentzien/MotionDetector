const MotionCapture = class {
    constructor(settings) {
        this.stream = null;
        this.video = settings.videoRef || document.createElement("video");
        this.oldCapturedImage = false;

        this.settings = {
            captureIntervalTime: settings.captureIntervalTime || 100,
            showMotionBox: settings.showMotionBox || true,
            motionBoxColor: settings.motionBoxColor || "#ff0000",
            frameWidth: settings.frameWidth || 400,
            frameHeight: settings.frameHeight || 300
        };

        const {frameWidth, frameHeight} = this.settings;

        this.settings.pixelDiffThreshold = 100;

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

        this.score = settings.scoreRef || document.createElement("span");

        this.motionCanvas = settings.motionCanvasRef || document.createElement("canvas");
        this.captureCanvas = settings.captureCanvasRef || document.createElement("canvas");
        this.diffCanvas = document.createElement("canvas");
        const {motionCanvas, captureCanvas, diffCanvas} = this;

        motionCanvas.width = frameWidth;
        motionCanvas.height = frameHeight;
        this.motionContext = this.motionCanvas.getContext("2d");

        captureCanvas.width = frameWidth;
        captureCanvas.height = frameHeight;
        this.captureContext = this.captureCanvas.getContext("2d");

        diffCanvas.width = frameWidth;
        diffCanvas.height = frameHeight;
        this.diffContext = this.diffCanvas.getContext("2d");

    }

    async start() {
        const {video} = this;
        const {frameWidth, frameHeight} = this.settings;

        await this.#getMedia({
            audio: false,
            video: {
                width: frameWidth,
                height: frameHeight
            }
        });

        video.addEventListener("loadedmetadata", () => {
            video.play();
            this.#startCapture();
        });

        video.srcObject = this.stream;
    }

    #startCapture() {
        const {captureIntervalTime} = this.settings;
        setInterval(() => {
            this.#capture();
        }, captureIntervalTime);
    }

    #capture() {
        const {video, score} = this;
        let {oldCapturedImage} = this;
        const {frameWidth, frameHeight} = this.settings;
        const {captureContext, diffContext, motionContext} = this;

        captureContext.drawImage(video, 0, 0, frameWidth, frameHeight);
        const captureImageData = captureContext.getImageData(0, 0, frameWidth, frameHeight);

        // compositing operation to apply when drawing new shapes
        // (difference: Subtracts the bottom layer from the top layer or the other way round to
        // always get a positive value)
        diffContext.globalCompositeOperation = "difference";
        diffContext.drawImage(video, 0, 0, frameWidth, frameHeight);
        const diffImageData = diffContext.getImageData(0, 0, frameWidth, frameHeight);

        if (oldCapturedImage) {
            const diff = this.#getDifference(diffImageData);
            score.innerHTML = diff.score;

            motionContext.putImageData(diffImageData, 0, 0);
        }

        // set compositing operation to default
        // (source over: draws new shapes on top of the existing canvas content)
        diffContext.globalCompositeOperation = "source-over";
        diffContext.drawImage(this.video, 0, 0, frameWidth, frameHeight);
        this.oldCapturedImage = true;
    }

    #getDifference(diffImageData) {
        const {pixelDiffThreshold, frameWidth, showMotionBox} = this.settings;
        let rgba = diffImageData.data;

        let score = 0;

        for (let i = 0; i < rgba.length; i += 4) {
            const pixelDiff = rgba[i] * 0.3 + rgba[i + 1] * 0.6 + rgba[i + 2] * 0.1;
            const normalized = Math.min(255, pixelDiff * (255 / pixelDiffThreshold));
            rgba[i] = 0;
            rgba[i + 1] = normalized;
            rgba[i + 2] = 0;

            if (pixelDiff >= pixelDiffThreshold) {
                score++;
                this.#calcMotionBoxPixels(i / 4);
            }
        }

        if (score > 0 && showMotionBox) {
            this.#drawMotionBoxCaptureCanvas();
            // this.#drawMotionBoxMotionCanvas();
        }

        this.motionBox.x.min = frameWidth;
        this.motionBox.y.min = frameWidth;
        this.motionBox.x.max = 0;
        this.motionBox.y.max = 0;

        return {score};
    }

    #calcMotionBoxPixels(index) {
        const {frameWidth} = this.settings;
        const x = index % frameWidth;
        const y = Math.floor(index / frameWidth);

        this.motionBox.x.min = Math.min(this.motionBox.x.min, x);
        this.motionBox.y.min = Math.min(this.motionBox.y.min, y);
        this.motionBox.x.max = Math.max(this.motionBox.x.max, x);
        this.motionBox.y.max = Math.max(this.motionBox.y.max, y);

        // check if x or y is outer the actual box ?
    }

    #drawMotionBoxCaptureCanvas() {
        const {captureContext} = this;
        const {motionBoxColor} = this.settings;
        const {min: xMin, max: xMax} = this.motionBox.x;
        const {min: yMin, max: yMax} = this.motionBox.y;
        captureContext.strokeRect(xMin, yMin, xMax - xMin, yMax - yMin);
        captureContext.strokeStyle = motionBoxColor;

        // console.log("xMin: ", xMin, "yMin: s", yMin, "xMax: ", xMax, "yMax: ", yMax);
    }

    #drawMotionBoxMotionCanvas() {
        const {diffContext} = this;
        const {min: xMin, max: xMax} = this.motionBox.x;
        const {min: yMin, max: yMax} = this.motionBox.y;
        diffContext.strokeRect(xMin, yMin, xMax - xMin, yMax - yMin);
        diffContext.strokeStyle = "#fff";

        // console.log("xMin: ", xMin, "yMin: s", yMin, "xMax: ", xMax, "yMax: ", yMax);
    }

    async #getMedia(mediaSettings) {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia(mediaSettings);
        } catch (err) {
            console.log(err);
        }
    }
}