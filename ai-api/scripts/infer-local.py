#!/usr/bin/env python
"""Run the delivered model against one or more local hand-image files."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api import load_model_version
from serve import RAScreeningService


def main() -> None:
    parser = argparse.ArgumentParser(description="Run RA screening inference on local image files")
    parser.add_argument("images", nargs="+", type=Path, help="JPEG or PNG hand-image file paths")
    parser.add_argument("--checkpoint", default="model/ra_screening_model.pt")
    parser.add_argument("--model-manifest", default="model/ra_screening_model.json")
    args = parser.parse_args()

    for image_path in args.images:
        if not image_path.is_file():
            parser.error(f"Image file does not exist: {image_path}")

    model_version = load_model_version(args.model_manifest)
    service = RAScreeningService.from_checkpoint(args.checkpoint, device="cpu")
    try:
        hands = []
        for image_path in args.images:
            with Image.open(image_path) as image:
                result = service.predict_from_image(ImageOps.exif_transpose(image).convert("RGB")).to_dict()
            hands.append({"image": str(image_path), **result})

        print(json.dumps({
            "model_version": model_version,
            "hands": hands,
            "ra_detected": any(hand["ra_detected"] for hand in hands),
            "total_positive_joints": sum(hand["num_positive_joints"] for hand in hands),
        }, ensure_ascii=False, indent=2))
    finally:
        service.cropper.close()


if __name__ == "__main__":
    main()
