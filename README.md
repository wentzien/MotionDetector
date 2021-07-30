# MotionDetector

With this engine it is possible to detect motion in a video stream. The output is a motion score. In addition, a box can be drawn around the moving parts of the video to make them visible.

## Integration via CDN
```javascript
<script src="https://cdn.jsdelivr.net/npm/motiondetector@1.0.3/index.min.js"></script>
```

## Exemplary use
Example in detailed form at [GitHub-Example-Repo](https://github.com/wentzien/MotionDetector-example) or 
live in action [motiondetector.wntzn.com](https://motiondetector.wntzn.com)

```html
<body>
<!-- for the output -->
<canvas id="motion-canvas"></canvas>
<canvas id="capture-canvas"></canvas>
<span id="motion-score">???</span>
<!-- setting the sensitivity with slider -->
<input id="slider" type="range" min="10" max="100" value="32"/>

<script src="https://cdn.jsdelivr.net/npm/motiondetector@1.0.3/index.min.js"></script>
<script>
    settings = {
        motionCanvasRef: document.getElementById("motion-canvas"),
        captureCanvasRef: document.getElementById("capture-canvas"),
        scoreRef: document.getElementById("motion-score")
    };

    const motionDetector = new MotionDetector(settings);
    motionDetector.start();
    
    const slider = document.getElementById("slider");
    slider.addEventListener("change", () => motionDetector.settings.sensitivity = slider.value);
</script>
</body>


```