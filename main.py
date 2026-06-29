from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import cv2
from PIL import Image
import io
import base64
from typing import Optional

app = FastAPI(title="IVD Diagnostic API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # restrict in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def decode_image(contents: bytes) -> np.ndarray:
    np_arr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode image. Please upload a valid image file.")
    return img


def to_grayscale(img: np.ndarray) -> np.ndarray:
    if len(img.shape) == 2:
        return img  # already grayscale (8-bit or 16-bit)
    elif len(img.shape) == 3:
        if img.shape[2] == 4:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    raise HTTPException(status_code=400, detail="Unsupported image format.")


def validate_quality(gray: np.ndarray) -> dict:
    issues = []

    # Blur check (Laplacian variance)
    blur_score = float(cv2.Laplacian(gray.astype(np.uint8), cv2.CV_64F).var())
    if blur_score < 30:
        issues.append("Image is too blurry. Please retake with steady hands.")

    # Brightness check
    mean_brightness = float(np.mean(gray))
    if mean_brightness < 20:
        issues.append("Image is too dark. Please improve lighting.")
    elif mean_brightness > 240:
        issues.append("Image is overexposed. Please reduce lighting or move away from bright light.")

    # Resolution check
    h, w = gray.shape[:2]
    if h < 100 or w < 100:
        issues.append(f"Image resolution too low ({w}×{h}). Please use a higher resolution.")

    return {
        "passed": len(issues) == 0,
        "issues": issues,
        "blur_score": round(blur_score, 2),
        "mean_brightness": round(mean_brightness, 2),
        "resolution": f"{w}×{h}",
    }


def extract_roi(gray: np.ndarray, roi: Optional[dict]) -> np.ndarray:
    """Extract region of interest. If no ROI provided, use center 60% of image."""
    h, w = gray.shape[:2]
    if roi:
        x = max(0, int(roi.get("x", 0)))
        y = max(0, int(roi.get("y", 0)))
        rw = min(int(roi.get("width", w)), w - x)
        rh = min(int(roi.get("height", h)), h - y)
        return gray[y:y+rh, x:x+rw]
    else:
        # Default: center 60%
        margin_x = int(w * 0.2)
        margin_y = int(h * 0.2)
        return gray[margin_y:h-margin_y, margin_x:w-margin_x]


def calculate_measurements(region: np.ndarray) -> dict:
    region_f = region.astype(np.float64)
    area = int(region_f.size)
    mean_gray = float(np.mean(region_f))
    integrated_density = float(area * mean_gray)
    raw_integrated_density = float(np.sum(region_f))
    std_dev = float(np.std(region_f))
    min_val = float(np.min(region_f))
    max_val = float(np.max(region_f))

    return {
        "area_px": area,
        "mean_gray_value": round(mean_gray, 4),
        "integrated_density": round(integrated_density, 2),
        "raw_integrated_density": round(raw_integrated_density, 2),
        "std_deviation": round(std_dev, 4),
        "min_value": round(min_val, 2),
        "max_value": round(max_val, 2),
    }


def interpret_result(measurements: dict) -> dict:
    """
    Customer-defined thresholds go here.
    These are placeholder thresholds — replace with your calibration data.
    Based on Mean Gray Value (0–255 scale for 8-bit images).
    """
    mgv = measurements["mean_gray_value"]

    if mgv < 50:
        score = "NEGATIVE"
        interpretation = "Signal intensity is below detection threshold. Test result is negative."
        confidence = "High"
        color = "green"
        next_steps = [
            "No further action required.",
            "Retest if symptoms persist after 48 hours.",
        ]
    elif mgv < 100:
        score = "BORDERLINE"
        interpretation = "Signal intensity is in the borderline range. Result is inconclusive."
        confidence = "Low"
        color = "orange"
        next_steps = [
            "Retest with a fresh sample.",
            "Consult a healthcare professional if in doubt.",
        ]
    elif mgv < 180:
        score = "POSITIVE"
        interpretation = "Signal intensity exceeds the positive threshold. Test result is positive."
        confidence = "High"
        color = "red"
        next_steps = [
            "Seek medical consultation.",
            "Do not share personal items.",
            "Follow recommended isolation guidelines.",
        ]
    else:
        score = "INVALID"
        interpretation = "Signal intensity is unusually high. The image may be overexposed or incorrectly captured."
        confidence = "None"
        color = "gray"
        next_steps = [
            "Retake the image in better lighting conditions.",
            "Ensure the test strip is correctly positioned.",
        ]

    return {
        "diagnostic_score": score,
        "interpretation": interpretation,
        "confidence": confidence,
        "color": color,
        "next_steps": next_steps,
    }


def annotate_image(img_bgr: np.ndarray, roi: Optional[dict]) -> str:
    """Draw ROI box on image and return as base64 PNG."""
    h, w = img_bgr.shape[:2]
    annotated = img_bgr.copy()

    if roi:
        x = int(roi.get("x", 0))
        y = int(roi.get("y", 0))
        rw = int(roi.get("width", w))
        rh = int(roi.get("height", h))
    else:
        x = int(w * 0.2)
        y = int(h * 0.2)
        rw = w - 2 * x
        rh = h - 2 * y

    cv2.rectangle(annotated, (x, y), (x + rw, y + rh), (0, 200, 100), 3)
    cv2.putText(annotated, "Analysis Region", (x + 6, y + 28),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 200, 100), 2)

    _, buf = cv2.imencode(".png", annotated)
    return base64.b64encode(buf).decode("utf-8")


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/analyse")
async def analyse(
    file: UploadFile = File(...),
    roi_x: Optional[int] = None,
    roi_y: Optional[int] = None,
    roi_width: Optional[int] = None,
    roi_height: Optional[int] = None,
):
    contents = await file.read()

    # Decode
    img = decode_image(contents)
    gray = to_grayscale(img)

    # Validate quality
    quality = validate_quality(gray)
    if not quality["passed"]:
        return {
            "success": False,
            "quality": quality,
            "measurements": None,
            "result": None,
            "annotated_image": None,
        }

    # ROI
    roi = None
    if all(v is not None for v in [roi_x, roi_y, roi_width, roi_height]):
        roi = {"x": roi_x, "y": roi_y, "width": roi_width, "height": roi_height}

    region = extract_roi(gray, roi)
    measurements = calculate_measurements(region)
    result = interpret_result(measurements)

    # Annotate — convert to BGR if grayscale for drawing
    if len(img.shape) == 2:
        img_bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    elif img.shape[2] == 4:
        img_bgr = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    else:
        img_bgr = img

    annotated = annotate_image(img_bgr, roi)

    return {
        "success": True,
        "quality": quality,
        "measurements": measurements,
        "result": result,
        "annotated_image": annotated,
    }
